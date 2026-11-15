import { AnalysisResult } from '../types/analysis';
import { buildFoodPrompt, parseAnalyzeFoodResponse } from './foodAnalysis';
import { photoToBase64 } from './cloudflareVision';
import { callVisionProxy } from './visionClient';

export async function analyzeFood(
  photoUri: string,
  foodLabel: string,
): Promise<AnalysisResult> {
  const { base64, size } = await photoToBase64(photoUri);
  const raw = await callVisionProxy(base64, buildFoodPrompt(foodLabel), 512);
  return parseAnalyzeFoodResponse(raw, size, foodLabel);
}
