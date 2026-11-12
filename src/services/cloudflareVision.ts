import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Shared by every service that sends a photo + prompt to Cloudflare Workers AI
// (cloudflareService.ts, tagService.ts, selfieCheckService.ts) — previously
// each had its own near-identical copy of this (account/model/base64/fetch)
// boilerplate, which had drifted into 3 independent copies. See
// docs/AUDIT-2026-09-24.md. The network-calling half (callCloudflareVision)
// moved to visionClient.ts (2026-11-03) — this file now holds only the
// RN-specific photo-reading step, so the pure network logic can be imported
// outside the app (see testing/).

// Real camera captures (expo-camera's takePictureAsync, no options passed)
// come back at full sensor resolution with an EXIF orientation tag — see
// project memory (vision-model-swap-attempt, 2026-11-11) for the full story:
// a vision model swap broke in production with an undocumented internal
// error, root-caused via direct A/B testing to a crash in that model's image
// decoder specifically on a non-identity EXIF orientation tag (the tag every
// portrait phone photo carries). Routing the photo through
// expo-image-manipulator here — even with no explicit rotate/resize
// action beyond this bounded decode — forces a real decode-to-bitmap and
// re-encode, which bakes the orientation into the actual pixels and drops
// the EXIF block from the output JPEG entirely. maxWidth/maxHeight only
// downsamples if the source exceeds it (never upscales), so this also
// cuts typical full-resolution upload size substantially as a side effect.
const MAX_DIMENSION = 1600;

export async function photoToBase64(photoUri: string): Promise<{ base64: string; size: number }> {
  const image = await ImageManipulator.manipulate(photoUri, {
    maxWidth: MAX_DIMENSION,
    maxHeight: MAX_DIMENSION,
  }).renderAsync();
  const result = await image.saveAsync({ base64: true, compress: 0.85, format: SaveFormat.JPEG });
  const base64 = result.base64 ?? '';
  // Byte size from the base64 string length (3 bytes per 4 base64 chars,
  // minus padding) rather than a separate file read — avoids a second disk
  // round-trip just to report a size that's only used for a food-photo
  // confidence heuristic (see foodAnalysis.ts), not for anything load-bearing.
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const size = Math.floor((base64.length * 3) / 4) - padding;
  return { base64, size };
}
