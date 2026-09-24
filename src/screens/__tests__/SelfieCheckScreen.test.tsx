import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SelfieCheckScreen } from '../SelfieCheckScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(),
}));

jest.mock('../../storage/profileStorage', () => ({
  getUserProfile: jest.fn(),
}));

const { useCameraPermissions } = require('expo-camera');
const { getUserProfile } = require('../../storage/profileStorage');

describe('SelfieCheckScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    getUserProfile.mockReset();
  });

  it('shows empty view when permission is null', () => {
    useCameraPermissions.mockReturnValue([null, jest.fn()]);
    getUserProfile.mockResolvedValue(null);
    const { toJSON } = render(<SelfieCheckScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows permission request when not granted', () => {
    useCameraPermissions.mockReturnValue([{ granted: false }, jest.fn()]);
    getUserProfile.mockResolvedValue(null);
    render(<SelfieCheckScreen />);
    expect(screen.getByText('Camera access needed')).toBeTruthy();
    expect(screen.getByText('Grant Permission')).toBeTruthy();
  });

  it('shows the camera UI and header when permission is granted', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    getUserProfile.mockResolvedValue(null);
    render(<SelfieCheckScreen />);
    expect(screen.getByText("How's my outfit?")).toBeTruthy();
    expect(screen.getByText('Frame your outfit — tap to capture')).toBeTruthy();
  });

  it('hides the personalize toggle when no profile exists', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    getUserProfile.mockResolvedValue(null);
    render(<SelfieCheckScreen />);
    await act(async () => {});
    expect(screen.queryByLabelText('Personalize for me')).toBeNull();
  });

  it('shows the personalize toggle, defaulted off, when a profile exists', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    getUserProfile.mockResolvedValue({ heightRange: 'average', build: 'average' });
    render(<SelfieCheckScreen />);
    await act(async () => {});
    expect(screen.getByLabelText('Personalize for me').props.accessibilityState?.checked).toBe(false);
  });

  it('toggling personalize updates the checked state', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    getUserProfile.mockResolvedValue({ heightRange: 'average', build: 'average' });
    render(<SelfieCheckScreen />);
    await act(async () => {});
    fireEvent.press(screen.getByLabelText('Personalize for me'));
    expect(screen.getByLabelText('Personalize for me').props.accessibilityState?.checked).toBe(true);
  });

  it('back button calls goBack', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    getUserProfile.mockResolvedValue(null);
    render(<SelfieCheckScreen />);
    fireEvent.press(screen.getByText('← Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
