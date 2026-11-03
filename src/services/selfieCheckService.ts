import { SelfieCheckResult } from '../types/selfieCheck';
import { UserProfile } from '../types/wardrobe';
import { buildSelfieCheckResult, buildSelfieDetectionPrompt, tierForScore } from './selfieAnalysis';
import { photoToBase64 } from './cloudflareVision';
import { callCloudflareVision } from './visionClient';

export { tierForScore, buildSelfieCheckResult, buildSelfieDetectionPrompt };

export async function checkSelfieOutfit(
  photoUri: string,
  profile?: UserProfile | null,
): Promise<SelfieCheckResult> {
  const { base64 } = await photoToBase64(photoUri);
  const raw = await callCloudflareVision(base64, buildSelfieDetectionPrompt(), 500);
  return buildSelfieCheckResult(raw, photoUri, profile);
}
