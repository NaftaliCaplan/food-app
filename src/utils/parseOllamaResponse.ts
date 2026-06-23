import { AnalysisResult, RipenessState } from '../types/analysis';

export function parseOllamaResponse(raw: string): AnalysisResult {
  // Strip markdown code fences LLaVA sometimes wraps around JSON
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

  // Try JSON parse first
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        state: parsed.state ?? 'unknown',
        stateLabel: parsed.stateLabel ?? labelForState(parsed.state),
        confidencePercent: parsed.confidencePercent ?? 50,
        visualCues: Array.isArray(parsed.visualCues) ? parsed.visualCues : [],
        recommendation: parsed.recommendation ?? '',
      };
    } catch {}
  }

  // Fallback: keyword matching on plain text
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

  return {
    state,
    stateLabel: labelForState(state),
    confidencePercent: 50,
    visualCues: [],
    recommendation: raw.slice(0, 150),
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
