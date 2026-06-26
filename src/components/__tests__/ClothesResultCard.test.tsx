import { render, screen } from '@testing-library/react-native';
import { ClothesResultCard } from '../ClothesResultCard';
import { ClothesAnalysisResult } from '../../types/clothesAnalysis';

function makeResult(overrides: Partial<ClothesAnalysisResult> = {}): ClothesAnalysisResult {
  return {
    verdict: 'neutral',
    verdictLabel: 'Neutral',
    confidencePercent: 60,
    garmentDescriptions: [],
    contrastNotes: [],
    patternNotes: [],
    toneNotes: [],
    recommendation: '',
    ...overrides,
  };
}

describe('ClothesResultCard', () => {
  it('shows strong_match icon and label', () => {
    render(<ClothesResultCard result={makeResult({ verdict: 'strong_match', verdictLabel: 'Strong Match' })} />);
    expect(screen.getByText('✅')).toBeTruthy();
    expect(screen.getByText('STRONG MATCH')).toBeTruthy();
  });

  it('shows good_match icon and label', () => {
    render(<ClothesResultCard result={makeResult({ verdict: 'good_match', verdictLabel: 'Good Match' })} />);
    expect(screen.getByText('👍')).toBeTruthy();
    expect(screen.getByText('GOOD MATCH')).toBeTruthy();
  });

  it('shows neutral icon and label', () => {
    render(<ClothesResultCard result={makeResult({ verdict: 'neutral', verdictLabel: 'Neutral' })} />);
    expect(screen.getByText('➖')).toBeTruthy();
    expect(screen.getByText('NEUTRAL')).toBeTruthy();
  });

  it('shows mild_clash icon and label', () => {
    render(<ClothesResultCard result={makeResult({ verdict: 'mild_clash', verdictLabel: 'Mild Clash' })} />);
    expect(screen.getByText('⚠️')).toBeTruthy();
    expect(screen.getByText('MILD CLASH')).toBeTruthy();
  });

  it('shows strong_clash icon and label', () => {
    render(<ClothesResultCard result={makeResult({ verdict: 'strong_clash', verdictLabel: 'Strong Clash' })} />);
    expect(screen.getByText('❌')).toBeTruthy();
    expect(screen.getByText('STRONG CLASH')).toBeTruthy();
  });

  it('shows unknown icon and label', () => {
    render(<ClothesResultCard result={makeResult({ verdict: 'unknown', verdictLabel: 'Unknown' })} />);
    expect(screen.getByText('❓')).toBeTruthy();
    expect(screen.getByText('UNKNOWN')).toBeTruthy();
  });

  it('shows garment descriptions section when present', () => {
    render(<ClothesResultCard result={makeResult({ garmentDescriptions: ['Dark-toned solid jacket'] })} />);
    expect(screen.getByText('GARMENTS')).toBeTruthy();
    expect(screen.getByText('Dark-toned solid jacket')).toBeTruthy();
  });

  it('hides garments section when empty', () => {
    render(<ClothesResultCard result={makeResult({ garmentDescriptions: [] })} />);
    expect(screen.queryByText('GARMENTS')).toBeNull();
  });

  it('shows contrast notes section when present', () => {
    render(<ClothesResultCard result={makeResult({ contrastNotes: ['Good contrast'] })} />);
    expect(screen.getByText('CONTRAST')).toBeTruthy();
  });

  it('shows patterns & tone section with combined notes', () => {
    render(<ClothesResultCard result={makeResult({
      patternNotes: ['Solid + solid'],
      toneNotes: ['Both warm-toned'],
    })} />);
    expect(screen.getByText('PATTERNS & TONE')).toBeTruthy();
    expect(screen.getByText('Solid + solid')).toBeTruthy();
    expect(screen.getByText('Both warm-toned')).toBeTruthy();
  });

  it('shows recommendation when present', () => {
    render(<ClothesResultCard result={makeResult({ recommendation: 'Try a belt to tie the look together.' })} />);
    expect(screen.getByText('RECOMMENDATION')).toBeTruthy();
    expect(screen.getByText('Try a belt to tie the look together.')).toBeTruthy();
  });

  it('shows confidence badge', () => {
    render(<ClothesResultCard result={makeResult({ confidencePercent: 75 })} />);
    expect(screen.getByText(/75/)).toBeTruthy();
  });
});
