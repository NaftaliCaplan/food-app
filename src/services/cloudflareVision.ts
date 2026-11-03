import { File } from 'expo-file-system';

// Shared by every service that sends a photo + prompt to Cloudflare Workers AI
// (cloudflareService.ts, tagService.ts, selfieCheckService.ts) — previously
// each had its own near-identical copy of this (account/model/base64/fetch)
// boilerplate, which had drifted into 3 independent copies. See
// docs/AUDIT-2026-09-24.md. The network-calling half (callCloudflareVision)
// moved to visionClient.ts (2026-11-03) — this file now holds only the
// RN-specific photo-reading step, so the pure network logic can be imported
// outside the app (see testing/).

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
