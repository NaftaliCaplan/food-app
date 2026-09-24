import { render, screen } from '@testing-library/react-native';
import { SelfieCheckResultCard } from '../SelfieCheckResultCard';
import { SelfieCheckResult } from '../../types/selfieCheck';

function makeResult(overrides: Partial<SelfieCheckResult> = {}): SelfieCheckResult {
  return {
    tier: 'neutral',
    garments: [],
    tip: '',
    ...overrides,
  };
}

describe('SelfieCheckResultCard', () => {
  it('shows strong_match icon and label', () => {
    render(<SelfieCheckResultCard result={makeResult({ tier: 'strong_match' })} />);
    expect(screen.getByText('[MATCH]')).toBeTruthy();
    expect(screen.getByText('STRONG MATCH')).toBeTruthy();
  });

  it('shows good_match icon and label', () => {
    render(<SelfieCheckResultCard result={makeResult({ tier: 'good_match' })} />);
    expect(screen.getByText('[GOOD]')).toBeTruthy();
    expect(screen.getByText('GOOD MATCH')).toBeTruthy();
  });

  it('shows neutral icon and label', () => {
    render(<SelfieCheckResultCard result={makeResult({ tier: 'neutral' })} />);
    expect(screen.getByText('[NEUT]')).toBeTruthy();
    expect(screen.getByText('NEUTRAL')).toBeTruthy();
  });

  it('shows mild_clash icon and label', () => {
    render(<SelfieCheckResultCard result={makeResult({ tier: 'mild_clash' })} />);
    expect(screen.getByText('[CLASH?]')).toBeTruthy();
    expect(screen.getByText('MILD CLASH')).toBeTruthy();
  });

  it('shows strong_clash icon and label', () => {
    render(<SelfieCheckResultCard result={makeResult({ tier: 'strong_clash' })} />);
    expect(screen.getByText('[CLASH]')).toBeTruthy();
    expect(screen.getByText('STRONG CLASH')).toBeTruthy();
  });

  it('shows detected tags for a garment slot', () => {
    render(<SelfieCheckResultCard result={makeResult({
      garments: [{ category: 'top', tags: ['navy', 'solid'] }],
    })} />);
    expect(screen.getByText('TOP')).toBeTruthy();
    expect(screen.getByText('navy')).toBeTruthy();
    expect(screen.getByText('solid')).toBeTruthy();
  });

  it('shows "Not detected" for a missing garment slot', () => {
    render(<SelfieCheckResultCard result={makeResult({ garments: [] })} />);
    expect(screen.getAllByText('Not detected')).toHaveLength(3); // top, bottom, shoes
  });

  it('hides the accessories section when none are detected', () => {
    render(<SelfieCheckResultCard result={makeResult({ garments: [] })} />);
    expect(screen.queryByText('ACCESSORIES')).toBeNull();
  });

  it('shows an accessories section when at least one is detected', () => {
    render(<SelfieCheckResultCard result={makeResult({
      garments: [{ category: 'accessory', tags: ['belt', 'brown', 'leather'] }],
    })} />);
    expect(screen.getByText('ACCESSORIES')).toBeTruthy();
    expect(screen.getByText('belt, brown, leather')).toBeTruthy();
  });

  it('shows the tip text', () => {
    render(<SelfieCheckResultCard result={makeResult({ tip: 'These pieces really work together.' })} />);
    expect(screen.getByText('TIP')).toBeTruthy();
    expect(screen.getByText('These pieces really work together.')).toBeTruthy();
  });
});
