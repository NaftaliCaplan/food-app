// The network-calling half of what used to be cloudflareVision.ts — split out
// (2026-11-03) so this file has zero React Native dependency and can be
// imported directly by the batch-testing harness (testing/) in plain Node,
// unlike photoToBase64 (still in cloudflareVision.ts), which needs
// expo-file-system's native module and only runs inside the app.
//
// This calls our own proxy Worker (server/), not Cloudflare Workers AI
// directly — the real Cloudflare account credential now lives only inside
// that Worker (via its `AI` binding), never in the client bundle. See
// server/README.md. PROXY_URL/APP_SHARED_SECRET are still EXPO_PUBLIC_ (so
// still client-bundled), but they only grant "can call this one endpoint,
// rate-limited" — not a real Cloudflare account token.
const PROXY_URL = process.env.EXPO_PUBLIC_PROXY_URL;
const APP_SHARED_SECRET = process.env.EXPO_PUBLIC_APP_SHARED_SECRET;

export async function callCloudflareVision(
  base64: string,
  promptText: string,
  maxTokens = 400,
  // The app always captures real JPEGs (expo-camera's output format), so
  // this has always been correct for real app usage. Exposed as a parameter
  // (not hardcoded) so the batch-testing harness (testing/) — which accepts
  // whatever format a test photo actually is (.webp, .png, etc.) — can pass
  // the real mime type instead of silently mislabeling the data URI.
  mimeType = 'image/jpeg',
  // Only honored by the Worker when the request authenticates as its test
  // client (see server/src/index.ts) — the real app never passes this, so
  // this is a no-op for every existing call site. Lets the batch-testing
  // harness (testing/) compare candidate models against the real deployed
  // Worker without touching the shipped app's behavior.
  modelOverride?: string,
): Promise<unknown> {
  const response = await fetch(`${PROXY_URL}/vision`, {
    method: 'POST',
    headers: {
      'X-App-Secret': APP_SHARED_SECRET ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: promptText },
          ],
        },
      ],
      max_tokens: maxTokens,
      ...(modelOverride ? { model: modelOverride } : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI proxy error ${response.status}: ${errText}`);
  }

  const json = await response.json() as { result?: { response?: unknown } };
  return json.result?.response;
}
