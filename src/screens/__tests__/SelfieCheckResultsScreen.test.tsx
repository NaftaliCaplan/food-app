import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SelfieCheckResultsScreen } from '../SelfieCheckResultsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({
    params: { photoUri: 'file://test.jpg', useProfile: false },
  }),
}));

jest.mock('../../hooks/useSelfieCheckAnalysis');
const { useSelfieCheckAnalysis } = require('../../hooks/useSelfieCheckAnalysis');

jest.mock('../../storage/profileStorage', () => ({
  getUserProfile: jest.fn(),
}));
const { getUserProfile } = require('../../storage/profileStorage');

const mockResult = {
  tier: 'good_match' as const,
  garments: [{ category: 'top' as const, tags: ['navy', 'solid'] }],
  tip: 'Solid outfit — these pieces pair nicely.',
};

describe('SelfieCheckResultsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    getUserProfile.mockReset().mockResolvedValue(null);
    useSelfieCheckAnalysis.mockReset().mockReturnValue({
      status: 'loading',
      result: null,
      error: null,
    });
  });

  it('shows a loading state before the profile has resolved', async () => {
    render(<SelfieCheckResultsScreen />);
    expect(screen.getByText('Analyzing your outfit...')).toBeTruthy();
    await act(async () => {});
  });

  it('shows an error state', async () => {
    useSelfieCheckAnalysis.mockReturnValue({
      status: 'error',
      result: null,
      error: 'No clothing detected in this photo — try again with your outfit clearly visible.',
    });
    render(<SelfieCheckResultsScreen />);
    await act(async () => {});
    expect(screen.getByText('No clothing detected in this photo — try again with your outfit clearly visible.')).toBeTruthy();
  });

  it('renders the result card on success', async () => {
    useSelfieCheckAnalysis.mockReturnValue({
      status: 'success',
      result: mockResult,
      error: null,
    });
    render(<SelfieCheckResultsScreen />);
    await act(async () => {});
    expect(screen.getByText('GOOD MATCH')).toBeTruthy();
    expect(screen.getByText('Solid outfit — these pieces pair nicely.')).toBeTruthy();
  });

  it('"Check another" navigates back to SelfieCheck', async () => {
    useSelfieCheckAnalysis.mockReturnValue({
      status: 'success',
      result: mockResult,
      error: null,
    });
    render(<SelfieCheckResultsScreen />);
    await act(async () => {});
    fireEvent.press(screen.getByText('Check another'));
    expect(mockNavigate).toHaveBeenCalledWith('SelfieCheck');
  });

  it('does not load a profile when useProfile is false (route param)', async () => {
    render(<SelfieCheckResultsScreen />);
    await act(async () => {});
    expect(getUserProfile).not.toHaveBeenCalled();
  });
});
