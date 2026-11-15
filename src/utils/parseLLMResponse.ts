import { AnalysisResult, RipenessState } from '../types/analysis';
import { extractJsonObject } from './extractJsonObject';

export function parseLLMResponse(raw: string): AnalysisResult {
  const parsed = extractJsonObject(raw);
  if (parsed) {
    return {
      state: (parsed.state as RipenessState) ?? 'unknown',
      stateLabel: (parsed.stateLabel as string) ?? labelForState(parsed.state as RipenessState),
      confidencePercent: (parsed.confidencePercent as number) ?? 50,
      visualCues: Array.isArray(parsed.visualCues) ? parsed.visualCues as string[] : [],
      recommendation: (parsed.recommendation as string) ?? '',
      ...(parsed.observedFood ? { observedFood: parsed.observedFood as string } : {}),
    };
  }

  // Fallback: parse markdown-formatted response from Llama
  const lower = raw.toLowerCase();
  let state: RipenessState = 'unknown';

  if (lower.includes('well-done') || lower.includes('well done')) state = 'well-done';
  else if (lower.includes('medium-rare') || lower.includes('medium rare')) state = 'medium-rare';
  else if (lower.includes('medium')) state = 'medium';
  else if (lower.includes('rare')) state = 'rare';
  else if (lower.includes('raw')) state = 'raw';
  else if (lower.includes('overripe') || lower.includes('over-ripe')) state = 'overripe';
  else if (lower.includes('almost ready') || lower.includes('almost_ready')) state = 'almost_ready';
  else if (lower.includes('use soon') || lower.includes('use_soon')) state = 'use_soon';
  else if (lower.includes('unripe') || lower.includes('not ripe') || lower.includes('under-ripe')) state = 'unripe';
  else if (lower.includes('ripe')) state = 'ripe';

  // Extract confidence percent from markdown e.g. "100%" or "Confidence Percent: 85%"
  const confMatch = raw.match(/(\d+)%/);
  const confidencePercent = confMatch ? parseInt(confMatch[1], 10) : 50;

  // Extract bullet point visual cues
  const cueMatches = raw.match(/^\*\s+(.+)$/gm) ?? [];
  const visualCues = cueMatches.map(c => c.replace(/^\*\s+/, '').trim()).slice(0, 3);

  // Extract recommendation — last sentence or line after "Recommendation"
  const recMatch = raw.match(/[Rr]ecommendation[:\*\s]+(.+)/s);
  const recommendation = recMatch ? recMatch[1].trim().slice(0, 200) : raw.slice(0, 150);

  return {
    state,
    stateLabel: labelForState(state),
    confidencePercent,
    visualCues,
    recommendation,
  };
}

export function labelForState(state: RipenessState): string {
  const labels: Record<RipenessState, string> = {
    ripe:         'Ripe',
    unripe:       'Not ready yet',
    overripe:     'Past its prime',
    almost_ready: 'Almost ready',
    use_soon:     'Use soon',
    raw:          'Raw',
    rare:         'Rare',
    'medium-rare':'Medium-rare',
    medium:       'Medium',
    'well-done':  'Well-done',
    unknown:      'Unknown',
  };
  return labels[state] ?? 'Unknown';
}
