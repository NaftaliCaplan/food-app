// Node-native substitute for cloudflareVision.ts's photoToBase64 — the real
// app reads photos via expo-file-system's native module, which only runs
// inside the app. Same output shape ({ base64, size }), different I/O
// backend appropriate for a plain Node script. Everything downstream of this
// (the prompt builders, callCloudflareVision, the response parsers) is the
// real app code, unmodified.
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export function photoToBase64(filePath: string): { base64: string; size: number; mimeType: string } {
  const buffer = readFileSync(filePath);
  const mimeType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'image/jpeg';
  return { base64: buffer.toString('base64'), size: buffer.byteLength, mimeType };
}
