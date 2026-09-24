import { render, screen } from '@testing-library/react-native';
import { SelfieCheckStatusOverlay } from '../SelfieCheckStatusOverlay';

describe('SelfieCheckStatusOverlay', () => {
  it('shows loading text while analyzing', () => {
    render(<SelfieCheckStatusOverlay status="loading" />);
    expect(screen.getByText('Analyzing your outfit...')).toBeTruthy();
  });

  it('shows error title on failure', () => {
    render(<SelfieCheckStatusOverlay status="error" error="No clothing detected" />);
    expect(screen.getByText('Analysis failed')).toBeTruthy();
  });

  it('shows the specific error message', () => {
    render(<SelfieCheckStatusOverlay status="error" error="Cloudflare AI error 503" />);
    expect(screen.getByText('Cloudflare AI error 503')).toBeTruthy();
  });

  it('shows connection hint on error', () => {
    render(<SelfieCheckStatusOverlay status="error" />);
    expect(screen.getByText('Check your connection and try again')).toBeTruthy();
  });
});
