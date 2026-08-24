import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { OutfitBuilderScreen } from '../OutfitBuilderScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

jest.mock('../../storage/profileStorage', () => ({
  getUserProfile: jest.fn(),
}));

const { getUserProfile } = require('../../storage/profileStorage');

describe('OutfitBuilderScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    getUserProfile.mockReset();
  });

  it('allows selecting multiple style chips at once', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<OutfitBuilderScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByLabelText('Casual'));
    fireEvent.press(screen.getByLabelText('Sporty'));

    expect(screen.getByLabelText('Casual').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Sporty').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Formal').props.accessibilityState?.checked).toBe(false);
  });

  it('toggling a selected style chip off deselects it', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<OutfitBuilderScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByLabelText('Casual'));
    fireEvent.press(screen.getByLabelText('Casual'));
    expect(screen.getByLabelText('Casual').props.accessibilityState?.checked).toBe(false);
  });

  it('defaults accessories to included', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<OutfitBuilderScreen />);
    await act(async () => {});
    expect(screen.getByLabelText('Include accessories').props.accessibilityState?.checked).toBe(true);
  });

  it('hides the personalize toggle when no profile exists', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<OutfitBuilderScreen />);
    await act(async () => {});
    expect(screen.queryByLabelText('Personalize for me')).toBeNull();
  });

  it('shows the personalize toggle, defaulted off, when a profile exists', async () => {
    getUserProfile.mockResolvedValue({ heightRange: 'average', build: 'average' });
    render(<OutfitBuilderScreen />);
    await act(async () => {});
    expect(screen.getByLabelText('Personalize for me').props.accessibilityState?.checked).toBe(false);
  });

  it('Generate works with zero styles selected using the defaults', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<OutfitBuilderScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByLabelText('Generate outfit'));
    expect(mockNavigate).toHaveBeenCalledWith('OutfitResults', {
      stylePrefs: [],
      useProfile: false,
      includeAccessories: true,
      temperatureF: 70,
    });
  });

  it('Generate passes selected styles and toggled options', async () => {
    getUserProfile.mockResolvedValue({ heightRange: 'average', build: 'average' });
    render(<OutfitBuilderScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByLabelText('Casual'));
    fireEvent.press(screen.getByLabelText('Sporty'));
    fireEvent.press(screen.getByLabelText('Include accessories'));
    fireEvent.press(screen.getByLabelText('Personalize for me'));
    fireEvent.press(screen.getByLabelText('Generate outfit'));

    expect(mockNavigate).toHaveBeenCalledWith('OutfitResults', {
      stylePrefs: ['casual', 'sporty'],
      useProfile: true,
      includeAccessories: false,
      temperatureF: 70,
    });
  });

  it('shows the default temperature and passes an adjusted value through on generate', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<OutfitBuilderScreen />);
    await act(async () => {});

    expect(screen.getByText('70°F (21°C)')).toBeTruthy();

    fireEvent(screen.getByLabelText('Current temperature'), 'valueChange', 90);
    expect(screen.getByText('90°F (32°C)')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Generate outfit'));
    expect(mockNavigate).toHaveBeenCalledWith(
      'OutfitResults',
      expect.objectContaining({ temperatureF: 90 }),
    );
  });
});
