import { render, screen } from '@testing-library/react-native';
import { LightStatusOverlay } from '../LightStatusOverlay';

describe('LightStatusOverlay', () => {
  it('shows loading text while analyzing', () => {
    render(<LightStatusOverlay status="loading" />);
    expect(screen.getByText('Reading the light...')).toBeTruthy();
  });

  it('shows error title on failure', () => {
    render(<LightStatusOverlay status="error" error="AI proxy error 500" />);
    expect(screen.getByText('Analysis failed')).toBeTruthy();
  });

  it('shows the specific error message', () => {
    render(<LightStatusOverlay status="error" error="Cloudflare AI error 503" />);
    expect(screen.getByText('Cloudflare AI error 503')).toBeTruthy();
  });

  it('shows connection hint on error', () => {
    render(<LightStatusOverlay status="error" />);
    expect(screen.getByText('Check your connection and try again')).toBeTruthy();
  });
});
