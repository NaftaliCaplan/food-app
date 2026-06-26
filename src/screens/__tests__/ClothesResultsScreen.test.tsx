import { fireEvent, render, screen } from '@testing-library/react-native';
import { ClothesResultsScreen } from '../ClothesResultsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({
    params: { photoUri: 'file://test.jpg' },
  }),
}));

jest.mock('../../hooks/useClothesAnalysis');
const { useClothesAnalysis } = require('../../hooks/useClothesAnalysis');

const mockResult = {
  verdict: 'good_match' as const,
  verdictLabel: 'Good Match',
  confidencePercent: 72,
  garmentDescriptions: ['Dark-toned solid jacket', 'Light-toned solid shirt'],
  contrastNotes: ['Good light-to-dark contrast between pieces'],
  patternNotes: ['Both pieces are solid — no pattern conflict'],
  toneNotes: ['Neutral tones complement each other'],
  recommendation: 'This combination works well. The contrast is clear and intentional.',
};

describe('ClothesResultsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  it('shows screen title', () => {
    useClothesAnalysis.mockReturnValue({ status: 'loading', result: null, error: null });
    render(<ClothesResultsScreen />);
    expect(screen.getByText('Outfit Check')).toBeTruthy();
  });

  it('shows loading overlay while analyzing', () => {
    useClothesAnalysis.mockReturnValue({ status: 'loading', result: null, error: null });
    render(<ClothesResultsScreen />);
    expect(screen.getByText(/analyzing your outfit/i)).toBeTruthy();
  });

  it('shows error overlay on failure', () => {
    useClothesAnalysis.mockReturnValue({ status: 'error', result: null, error: 'Network error' });
    render(<ClothesResultsScreen />);
    expect(screen.getByText(/analysis failed/i)).toBeTruthy();
  });

  it('shows result card on success', () => {
    useClothesAnalysis.mockReturnValue({ status: 'success', result: mockResult, error: null });
    render(<ClothesResultsScreen />);
    expect(screen.getByText('GOOD MATCH')).toBeTruthy();
    expect(screen.getByText('This combination works well. The contrast is clear and intentional.')).toBeTruthy();
  });

  it('shows check another button on success', () => {
    useClothesAnalysis.mockReturnValue({ status: 'success', result: mockResult, error: null });
    render(<ClothesResultsScreen />);
    expect(screen.getByText(/check another/i)).toBeTruthy();
  });

  it('check another button navigates to ClothesChecker', () => {
    useClothesAnalysis.mockReturnValue({ status: 'success', result: mockResult, error: null });
    render(<ClothesResultsScreen />);
    fireEvent.press(screen.getByText(/check another/i));
    expect(mockNavigate).toHaveBeenCalledWith('ClothesChecker');
  });
});
