import { render, screen } from '@testing-library/react-native';
import { ResultStatusOverlay } from '../ResultStatusOverlay';

describe('ResultStatusOverlay', () => {
  it('shows the caller-provided loading text while analyzing', () => {
    render(<ResultStatusOverlay status="loading" loadingText="Reading the light..." />);
    expect(screen.getByText('Reading the light...')).toBeTruthy();
  });

  it('shows error title on failure', () => {
    render(<ResultStatusOverlay status="error" error="AI proxy error 500" loadingText="Loading..." />);
    expect(screen.getByText('Analysis failed')).toBeTruthy();
  });

  it('shows the specific error message', () => {
    render(<ResultStatusOverlay status="error" error="Cloudflare AI error 503" loadingText="Loading..." />);
    expect(screen.getByText('Cloudflare AI error 503')).toBeTruthy();
  });

  it('shows connection hint on error', () => {
    render(<ResultStatusOverlay status="error" loadingText="Loading..." />);
    expect(screen.getByText('Check your connection and try again')).toBeTruthy();
  });
});
