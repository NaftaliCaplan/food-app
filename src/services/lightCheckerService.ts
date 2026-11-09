import { LightCheckResult } from '../types/light';
import { buildLightPrompt, parseLightResponse, voteLightResults } from './lightAnalysis';
import { photoToBase64 } from './cloudflareVision';
import { callCloudflareVision } from './visionClient';

// 3 independent calls on the same photo+prompt, majority-voted (see
// voteLightResults) — a single call isn't reliable enough on borderline
// photos to state its answer "plainly and confidently" (confirmed via
// batch-testing 2026-11-08: the same photo flipped color run-to-run).
// Costs ~3x the AI usage per check (~29 neurons vs ~10 for one call).
const VOTES = 3;

export async function checkLight(photoUri: string): Promise<LightCheckResult> {
  const { base64 } = await photoToBase64(photoUri);
  const prompt = buildLightPrompt();
  // Small JSON payload (two short fields) vs. food's 512/selfie's 500 —
  // bump if testing/run-light.ts ever shows truncation.
  const raws = await Promise.all(
    Array.from({ length: VOTES }, () => callCloudflareVision(base64, prompt, 200)),
  );
  return voteLightResults(raws.map(parseLightResponse));
}
