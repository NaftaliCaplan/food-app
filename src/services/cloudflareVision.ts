import { File } from 'expo-file-system';

// Shared by every service that sends a photo + prompt to Cloudflare Workers AI
// (cloudflareService.ts, tagService.ts, selfieCheckService.ts) — previously
// each had its own near-identical copy of this (account/model/base64/fetch)
// boilerplate, which had drifted into 3 independent copies. See
// docs/AUDIT-2026-09-24.md.
//
// This calls our own proxy Worker (server/), not Cloudflare Workers AI
// directly — the real Cloudflare account credential now lives only inside
// that Worker (via its `AI` binding), never in the client bundle. See
// server/README.md. PROXY_URL/APP_SHARED_SECRET are still EXPO_PUBLIC_ (so
// still client-bundled), but they only grant "can call this one endpoint,
// rate-limited" — not a real Cloudflare account token.
const PROXY_URL = process.env.EXPO_PUBLIC_PROXY_URL;
const APP_SHARED_SECRET = process.env.EXPO_PUBLIC_APP_SHARED_SECRET;

// Building the binary string one character at a time (bytes.length calls to
// `binary +=`) was a real hot-path cost — every photo capture (wardrobe item,
// selfie check, food check) re-runs this, and captured photos can be
// hundreds of KB to a few MB. Chunking avoids both the O(n) single-char
// concatenation and the risk of exceeding an engine's argument-length limit
// on `String.fromCharCode`.
const BASE64_CHUNK_SIZE = 8192;

export async function photoToBase64(photoUri: string): Promise<{ base64: string; size: number }> {
  const buffer = await new File(photoUri).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return { base64: btoa(binary), size: bytes.length };
}

export async function callCloudflareVision(
  base64: string,
  promptText: string,
  maxTokens = 400,
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
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: 'text', text: promptText },
          ],
        },
      ],
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI proxy error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  return json.result?.response;
}
