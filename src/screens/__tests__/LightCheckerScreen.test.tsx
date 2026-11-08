import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LightCheckerScreen } from '../LightCheckerScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(),
}));

const { useCameraPermissions } = require('expo-camera');

describe('LightCheckerScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  it('shows neither the permission request nor the camera UI while permission is still loading', () => {
    useCameraPermissions.mockReturnValue([null, jest.fn()]);
    render(<LightCheckerScreen />);
    expect(screen.queryByText('Camera access needed')).toBeNull();
    expect(screen.queryByText('What color is it?')).toBeNull();
  });

  it('shows permission request when not granted', () => {
    useCameraPermissions.mockReturnValue([{ granted: false }, jest.fn()]);
    render(<LightCheckerScreen />);
    expect(screen.getByText('Camera access needed')).toBeTruthy();
    expect(screen.getByText('Grant Permission')).toBeTruthy();
  });

  it('shows the camera UI and header when permission is granted', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<LightCheckerScreen />);
    await act(async () => {});
    expect(screen.getByText('What color is it?')).toBeTruthy();
    expect(screen.getByText('Point at the light — tap to capture')).toBeTruthy();
  });

  it('uses the back camera', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<LightCheckerScreen />);
    await act(async () => {});
    const cameraType = 'CameraView' as any;
    expect(screen.UNSAFE_getByType(cameraType).props.facing).toBe('back');
  });

  it('back button calls goBack', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<LightCheckerScreen />);
    await act(async () => {});
    fireEvent.press(screen.getByText('← Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders the capture button', async () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<LightCheckerScreen />);
    await act(async () => {});
    expect(screen.getByTestId('capture-button')).toBeTruthy();
  });
});
