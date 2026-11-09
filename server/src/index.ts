// Thin proxy standing between the app and Cloudflare Workers AI. The app used
// to call Workers AI directly with a bearer token that was EXPO_PUBLIC_-
// prefixed — meaning the real Cloudflare credential shipped inside the
// client JS bundle itself (see docs/decisions/ and project memory). This
// Worker removes that: it holds AI access via Cloudflare's native `AI`
// binding (no account ID / API token needed anywhere, client- or
// server-side — the binding is implicitly authenticated as this Worker's
// own Cloudflare account), and the only thing the client now holds is a
// narrowly-scoped shared secret that can only call this one endpoint,
// subject to the rate limit below.

const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

// Defensive ceiling so a client can't ask for an arbitrarily expensive
// response regardless of what it passes.
const MAX_TOKENS_CEILING = 600;

// Fixed-window per-IP cap — a cost backstop, not a precise rate limiter.
// KV reads/writes aren't atomic, so concurrent bursts from the same IP can
// overshoot slightly; that's an acceptable tradeoff for "stop one bad actor
// from running up the bill," not a security boundary.
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_SECONDS = 600;

// A separate, much higher limit for the batch-testing harness (testing/) —
// it authenticates with its own TEST_SHARED_SECRET, never shipped in any app
// bundle, so raising its limit doesn't loosen the real app's abuse
// protection at all. Each mode gets its own KV key prefix so a big batch run
// can never eat into (or be throttled by) the app-client budget.
const TEST_RATE_LIMIT_MAX = 1000;

interface Env {
  AI: Ai;
  RATE_LIMIT: KVNamespace;
  APP_SHARED_SECRET: string;
  TEST_SHARED_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function checkRateLimit(ip: string, kv: KVNamespace, max: number, keyPrefix: string): Promise<boolean> {
  const windowIndex = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SECONDS);
  const key = `${keyPrefix}:${ip}:${windowIndex}`;
  const current = Number((await kv.get(key)) ?? '0');
  if (current >= max) return false;
  try {
    await kv.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  } catch {
    // KV enforces its own ~1-write/sec-per-key limit, independent of our own
    // `max`/window above — several near-simultaneous requests from the same
    // client (e.g. the light checker's 3-call majority vote, all hitting the
    // same key at once) can legitimately exceed that, throwing here. This is
    // a cost backstop, not a security boundary (see this function's own
    // call site comment) — failing open on the write (still letting the
    // request through) is the right tradeoff; failing the whole request
    // because our own bookkeeping write collided with itself is not.
  }
  return true;
}

interface VisionMessage {
  role: 'user';
  content: Array<
    | { type: 'image_url'; image_url: { url: string } }
    | { type: 'text'; text: string }
  >;
}

interface VisionRequestBody {
  messages: VisionMessage[];
  max_tokens?: number;
}

function isValidBody(value: unknown): value is VisionRequestBody {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return Array.isArray(body.messages) && body.messages.length > 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST' || new URL(request.url).pathname !== '/vision') {
      return json({ error: 'Not found' }, 404);
    }

    const providedSecret = request.headers.get('X-App-Secret');
    const isTestClient = !!env.TEST_SHARED_SECRET && providedSecret === env.TEST_SHARED_SECRET;
    const isAppClient = providedSecret === env.APP_SHARED_SECRET;
    if (!isAppClient && !isTestClient) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const limit = isTestClient ? TEST_RATE_LIMIT_MAX : RATE_LIMIT_MAX;
    const withinLimit = await checkRateLimit(ip, env.RATE_LIMIT, limit, isTestClient ? 'rl-test' : 'rl');
    if (!withinLimit) {
      return json({ error: 'Rate limit exceeded, try again later' }, 429);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    if (!isValidBody(body)) {
      return json({ error: 'Expected a non-empty "messages" array' }, 400);
    }

    const maxTokens = Math.min(body.max_tokens ?? 400, MAX_TOKENS_CEILING);

    try {
      // Our own VisionMessage shape intentionally mirrors what the client
      // actually sends, rather than importing Workers AI's generated
      // per-model input type directly — that type is narrower/brittler than
      // needed here and tends to shift across @cloudflare/workers-types
      // versions. `as never` sidesteps the generated overload union; the
      // real validation this relies on is isValidBody() above.
      const result = await env.AI.run(MODEL, {
        messages: body.messages,
        max_tokens: maxTokens,
      } as never);
      // Wrapped in `{ result }` to match the shape the client already parses
      // (`json.result?.response`) from the old direct-REST-API days — zero
      // client-side parsing changes needed beyond the fetch target itself.
      return json({ result });
    } catch (e) {
      return json({ error: `AI proxy error: ${(e as Error).message}` }, 502);
    }
  },
};
