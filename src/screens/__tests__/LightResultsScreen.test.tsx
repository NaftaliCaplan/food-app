import { fireEvent, render, screen } from '@testing-library/react-native';
import { LightResultsScreen } from '../LightResultsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({
    params: { photoUri: 'file://test.jpg' },
  }),
}));

jest.mock('../../hooks/useLightAnalysis');
const { useLightAnalysis } = require('../../hooks/useLightAnalysis');

describe('LightResultsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    useLightAnalysis.mockReset().mockReturnValue({
      status: 'loading',
      result: null,
      error: null,
    });
  });

  it('shows a loading state', () => {
    render(<LightResultsScreen />);
    expect(screen.getByText('Reading the light...')).toBeTruthy();
  });

  it('shows an error state', () => {
    useLightAnalysis.mockReturnValue({
      status: 'error',
      result: null,
      error: 'AI proxy error 500',
    });
    render(<LightResultsScreen />);
    expect(screen.getByText('AI proxy error 500')).toBeTruthy();
  });

  it('renders the result card on success', () => {
    useLightAnalysis.mockReturnValue({
      status: 'success',
      result: { color: 'green', colorLabel: 'Green' },
      error: null,
    });
    render(<LightResultsScreen />);
    expect(screen.getByText('GREEN')).toBeTruthy();
  });

  it('"Check another" navigates back to LightChecker', () => {
    useLightAnalysis.mockReturnValue({
      status: 'success',
      result: { color: 'green', colorLabel: 'Green' },
      error: null,
    });
    render(<LightResultsScreen />);
    fireEvent.press(screen.getByText('Check another'));
    expect(mockNavigate).toHaveBeenCalledWith('LightChecker');
  });
});
