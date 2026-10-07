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

  it('shows neither the permission request nor the camera UI while permission is still loading', () => {
    useCameraPermissions.mockReturnValue([null, jest.fn()]);
    getUserProfile.mockResolvedValue(null);
    render(<SelfieCheckScreen />);
    expect(screen.queryByText('Camera access needed')).toBeNull();
    expect(screen.queryByText("How's my outfit?")).toBeNull();
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
    await act(async () => {});
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

  it('back button calls goBack', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    getUserProfile.mockResolvedValue(null);
    render(<SelfieCheckScreen />);
    await act(async () => {});
    fireEvent.press(screen.getByText('← Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('defaults to the front camera and flips to back on press', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    getUserProfile.mockResolvedValue(null);
    render(<SelfieCheckScreen />);
    await act(async () => {});

    const cameraType = 'CameraView' as any;
    expect(screen.UNSAFE_getByType(cameraType).props.facing).toBe('front');
    fireEvent.press(screen.getByLabelText('Switch camera'));
    expect(screen.UNSAFE_getByType(cameraType).props.facing).toBe('back');
    fireEvent.press(screen.getByLabelText('Switch camera'));
    expect(screen.UNSAFE_getByType(cameraType).props.facing).toBe('front');
  });

  it('defaults the timer to Off and selecting another option updates the checked state', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    getUserProfile.mockResolvedValue(null);
    render(<SelfieCheckScreen />);
    await act(async () => {});

    expect(screen.getByLabelText('Timer Off').props.accessibilityState?.checked).toBe(true);
    fireEvent.press(screen.getByLabelText('Timer 3s'));
    expect(screen.getByLabelText('Timer 3s').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Timer Off').props.accessibilityState?.checked).toBe(false);
  });

  it('capturing with a timer selected shows a countdown instead of capturing immediately', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    getUserProfile.mockResolvedValue(null);
    render(<SelfieCheckScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByLabelText('Timer 3s'));
    fireEvent.press(screen.getByTestId('capture-button'));

    expect(screen.getByText('Get in position...')).toBeTruthy();
    expect(screen.getByTestId('capture-button').props.accessibilityState?.disabled).toBe(true);
  });
});
