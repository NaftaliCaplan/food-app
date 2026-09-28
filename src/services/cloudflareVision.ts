import { File } from 'expo-file-system/next';

// Shared by every service that sends a photo + prompt to Cloudflare Workers AI
// (cloudflareService.ts, tagService.ts, selfieCheckService.ts) — previously
// each had its own near-identical copy of this (account/model/base64/fetch)
// boilerplate, which had drifted into 3 independent copies. See
// docs/AUDIT-2026-09-24.md.
const ACCOUNT_ID = process.env.EXPO_PUBLIC_CF_ACCOUNT_ID;
const API_TOKEN = process.env.EXPO_PUBLIC_CF_API_TOKEN;
const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

// Building the binary string one character at a time (bytes.length calls to
// `binary +=`) was a real hot-path cost — every photo capture (wardrobe item,
// selfie check, food check) re-runs this, and captured photos can be
// hundreds of KB to a few MB. Chunking avoids both the O(n) single-char
// concatenation and the risk of exceeding an engine's argument-length limit
// on `String.fromCharCode`.
const BASE64_CHUNK_SIZE = 8192;

export async function photoToBase64(photoUri: string): Promise<{ base64: string; size: number }> {
  const bytes = await new File(photoUri).bytes();
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
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
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
    throw new Error(`Cloudflare AI error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  return json.result?.response;
}
