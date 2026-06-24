import { render, screen } from '@testing-library/react-native';
import { ResultsScreen } from '../ResultsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({
    params: { photoUri: 'file://test.jpg', foodLabel: 'banana' },
  }),
}));

jest.mock('../../hooks/useAnalysis');
const { useAnalysis } = require('../../hooks/useAnalysis');

const mockResult = {
  state: 'ripe' as const,
  stateLabel: 'Ripe',
  confidencePercent: 92,
  visualCues: ['Yellow skin', 'Slight brown spots'],
  recommendation: 'Ready to eat now.',
};

describe('ResultsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  it('shows food label in header', () => {
    useAnalysis.mockReturnValue({ status: 'loading', result: null, error: null });
    render(<ResultsScreen />);
    expect(screen.getAllByText('banana').length).toBeGreaterThan(0);
  });

  it('shows loading overlay while analyzing', () => {
    useAnalysis.mockReturnValue({ status: 'loading', result: null, error: null });
    render(<ResultsScreen />);
    expect(screen.getByText(/analyzing/i)).toBeTruthy();
  });

  it('shows error overlay on failure', () => {
    useAnalysis.mockReturnValue({ status: 'error', result: null, error: 'Ollama not running' });
    render(<ResultsScreen />);
    expect(screen.getByText(/analysis failed/i)).toBeTruthy();
  });

  it('shows result card on success', () => {
    useAnalysis.mockReturnValue({ status: 'success', result: mockResult, error: null });
    render(<ResultsScreen />);
    expect(screen.getByText('RIPE')).toBeTruthy();
    expect(screen.getByText('Ready to eat now.')).toBeTruthy();
  });

  it('shows check another button on success', () => {
    useAnalysis.mockReturnValue({ status: 'success', result: mockResult, error: null });
    render(<ResultsScreen />);
    expect(screen.getByText(/check another/i)).toBeTruthy();
  });
});
