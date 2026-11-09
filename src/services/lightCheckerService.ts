import { LightCheckResult } from '../types/light';
import { buildLightPrompt, parseLightResponse } from './lightAnalysis';
import { photoToBase64 } from './cloudflareVision';
import { callCloudflareVision } from './visionClient';

export async function checkLight(photoUri: string): Promise<LightCheckResult> {
  const { base64 } = await photoToBase64(photoUri);
  // 300 to fit the forced-reasoning "observation" sentence plus color/detail
  // — bump further if testing/run-light.ts ever shows truncation.
  const raw = await callCloudflareVision(base64, buildLightPrompt(), 300);
  return parseLightResponse(raw);
}
