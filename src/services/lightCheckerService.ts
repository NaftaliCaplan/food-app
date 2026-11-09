import { LightCheckResult } from '../types/light';
import { buildLightPrompt, parseLightResponse } from './lightAnalysis';
import { photoToBase64 } from './cloudflareVision';
import { callCloudflareVision } from './visionClient';

export async function checkLight(photoUri: string): Promise<LightCheckResult> {
  const { base64 } = await photoToBase64(photoUri);
  // Small JSON payload (two short fields) vs. food's 512/selfie's 500 —
  // bump if testing/run-light.ts ever shows truncation.
  const raw = await callCloudflareVision(base64, buildLightPrompt(), 200);
  return parseLightResponse(raw);
}
