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

interface Env {
  AI: Ai;
  RATE_LIMIT: KVNamespace;
  APP_SHARED_SECRET: string;
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

async function checkRateLimit(ip: string, kv: KVNamespace): Promise<boolean> {
  const windowIndex = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SECONDS);
  const key = `rl:${ip}:${windowIndex}`;
  const current = Number((await kv.get(key)) ?? '0');
  if (current >= RATE_LIMIT_MAX) return false;
  await kv.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
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

    if (request.headers.get('X-App-Secret') !== env.APP_SHARED_SECRET) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const withinLimit = await checkRateLimit(ip, env.RATE_LIMIT);
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
