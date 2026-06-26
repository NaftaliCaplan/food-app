export type RipenessState =
  | 'ripe'
  | 'unripe'
  | 'overripe'
  | 'almost_ready'
  | 'use_soon'
  | 'raw'
  | 'rare'
  | 'medium-rare'
  | 'medium'
  | 'well-done'
  | 'unknown';

export interface AnalysisResult {
  state: RipenessState;
  stateLabel: string;
  confidencePercent: number;
  visualCues: string[];
  recommendation: string;
  observedFood?: string;
}
