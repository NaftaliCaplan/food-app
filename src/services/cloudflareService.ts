import { AnalysisResult } from '../types/analysis';
import { buildPrompt, parseAnalyzeFoodResponse } from './foodAnalysis';
import { photoToBase64 } from './cloudflareVision';
import { callCloudflareVision } from './visionClient';

export async function analyzeFood(
  photoUri: string,
  foodLabel: string,
): Promise<AnalysisResult> {
  const { base64, size } = await photoToBase64(photoUri);
  const raw = await callCloudflareVision(base64, buildPrompt(foodLabel), 512);
  return parseAnalyzeFoodResponse(raw, size, foodLabel);
}
