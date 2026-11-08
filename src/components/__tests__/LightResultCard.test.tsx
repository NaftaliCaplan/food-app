import { render, screen } from '@testing-library/react-native';
import { LightResultCard } from '../LightResultCard';
import { LightCheckResult } from '../../types/light';

function makeResult(overrides: Partial<LightCheckResult> = {}): LightCheckResult {
  return {
    color: 'red',
    colorLabel: 'Red',
    ...overrides,
  };
}

describe('LightResultCard', () => {
  it('shows the RED label', () => {
    render(<LightResultCard result={makeResult({ color: 'red', colorLabel: 'Red' })} />);
    expect(screen.getByText('RED')).toBeTruthy();
  });

  it('shows the GREEN label', () => {
    render(<LightResultCard result={makeResult({ color: 'green', colorLabel: 'Green' })} />);
    expect(screen.getByText('GREEN')).toBeTruthy();
  });

  it('shows the AMBER label', () => {
    render(<LightResultCard result={makeResult({ color: 'amber', colorLabel: 'Amber' })} />);
    expect(screen.getByText('AMBER')).toBeTruthy();
  });

  it('shows the UNCLEAR label with a distinct icon', () => {
    render(<LightResultCard result={makeResult({ color: 'unclear', colorLabel: 'Unclear' })} />);
    expect(screen.getByText('UNCLEAR')).toBeTruthy();
    expect(screen.getByText('[?]')).toBeTruthy();
  });

  it('shows the detail text only for an unclear result', () => {
    render(<LightResultCard result={makeResult({
      color: 'unclear',
      colorLabel: 'Unclear',
      detail: 'No illuminated light visible in the photo',
    })} />);
    expect(screen.getByText('No illuminated light visible in the photo')).toBeTruthy();
  });

  it('does not show detail text for a clean red/green/amber result', () => {
    render(<LightResultCard result={makeResult({ color: 'red', colorLabel: 'Red', detail: 'should not show' })} />);
    expect(screen.queryByText('should not show')).toBeNull();
  });
});
