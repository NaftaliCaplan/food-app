import { render, screen } from '@testing-library/react-native';
import { ClothesStatusOverlay } from '../ClothesStatusOverlay';

describe('ClothesStatusOverlay', () => {
  it('shows loading text while analyzing', () => {
    render(<ClothesStatusOverlay status="loading" />);
    expect(screen.getByText('Analyzing your outfit...')).toBeTruthy();
  });

  it('shows error title on failure', () => {
    render(<ClothesStatusOverlay status="error" error="Network error" />);
    expect(screen.getByText('Analysis failed')).toBeTruthy();
  });

  it('shows the specific error message', () => {
    render(<ClothesStatusOverlay status="error" error="Cloudflare AI error 503" />);
    expect(screen.getByText('Cloudflare AI error 503')).toBeTruthy();
  });

  it('shows connection hint on error', () => {
    render(<ClothesStatusOverlay status="error" />);
    expect(screen.getByText('Check your connection and try again')).toBeTruthy();
  });

  it('does not show Ollama hint', () => {
    render(<ClothesStatusOverlay status="error" />);
    expect(screen.queryByText(/ollama/i)).toBeNull();
  });
});
