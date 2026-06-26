import { fireEvent, render, screen } from '@testing-library/react-native';
import { ClothesCheckerScreen } from '../ClothesCheckerScreen';

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

describe('ClothesCheckerScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  it('shows empty view when permission is null', () => {
    useCameraPermissions.mockReturnValue([null, jest.fn()]);
    const { toJSON } = render(<ClothesCheckerScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows permission request when not granted', () => {
    useCameraPermissions.mockReturnValue([{ granted: false }, jest.fn()]);
    render(<ClothesCheckerScreen />);
    expect(screen.getByText('Camera access needed')).toBeTruthy();
    expect(screen.getByText('Grant Permission')).toBeTruthy();
  });

  it('shows camera UI when permission is granted', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<ClothesCheckerScreen />);
    expect(screen.getByText('Does it match?')).toBeTruthy();
    expect(screen.getByText('Point at your outfit — tap to capture')).toBeTruthy();
  });

  it('capture button is never blocked by a label — enabled immediately', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<ClothesCheckerScreen />);
    const captureBtn = screen.getByTestId('capture-button');
    expect(captureBtn.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('back button calls goBack', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<ClothesCheckerScreen />);
    fireEvent.press(screen.getByText('← Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
