import { render, screen } from '@testing-library/react-native';
import { ConfidenceBadge } from '../ConfidenceBadge';

describe('ConfidenceBadge', () => {
  it('displays the confidence percentage', () => {
    render(<ConfidenceBadge confidencePercent={85} />);
    expect(screen.getByText('85% confident')).toBeTruthy();
  });

  it('displays 0% confident', () => {
    render(<ConfidenceBadge confidencePercent={0} />);
    expect(screen.getByText('0% confident')).toBeTruthy();
  });

  it('displays 100% confident', () => {
    render(<ConfidenceBadge confidencePercent={100} />);
    expect(screen.getByText('100% confident')).toBeTruthy();
  });
});
