export type MatchVerdict =
  | 'strong_match'
  | 'good_match'
  | 'neutral'
  | 'mild_clash'
  | 'strong_clash'
  | 'unknown';

export interface ClothesAnalysisResult {
  verdict: MatchVerdict;
  verdictLabel: string;
  confidencePercent: number;
  garmentDescriptions: string[];
  contrastNotes: string[];
  patternNotes: string[];
  toneNotes: string[];
  recommendation: string;
}
