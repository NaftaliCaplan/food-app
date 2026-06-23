// V2 stub — Gemini API integration
// Implement this with the same signature as ollamaService.analyzeFood
// then swap the import in useAnalysis.ts

import { AnalysisResult } from '../types/analysis';

export async function analyzeFood(
  _photoUri: string,
  _foodLabel: string,
): Promise<AnalysisResult> {
  throw new Error('Gemini service not yet implemented');
}
