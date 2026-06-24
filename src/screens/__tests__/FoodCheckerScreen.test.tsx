import { fireEvent, render, screen } from '@testing-library/react-native';
import { FoodCheckerScreen } from '../FoodCheckerScreen';

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

describe('FoodCheckerScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  it('shows loading state when permission is null', () => {
    useCameraPermissions.mockReturnValue([null, jest.fn()]);
    const { toJSON } = render(<FoodCheckerScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows permission request when not granted', () => {
    useCameraPermissions.mockReturnValue([{ granted: false }, jest.fn()]);
    render(<FoodCheckerScreen />);
    expect(screen.getByText('Camera access needed')).toBeTruthy();
    expect(screen.getByText('Grant Permission')).toBeTruthy();
  });

  it('shows camera UI when permission is granted', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<FoodCheckerScreen />);
    expect(screen.getByText('What are you checking?')).toBeTruthy();
    expect(screen.getByTestId('food-label-input')).toBeTruthy();
  });

  it('capture button is disabled when food label is empty', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<FoodCheckerScreen />);
    const captureBtn = screen.getByTestId('capture-button');
    expect(captureBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('capture button enables after typing a food label', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<FoodCheckerScreen />);
    fireEvent.changeText(screen.getByTestId('food-label-input'), 'banana');
    const captureBtn = screen.getByTestId('capture-button');
    expect(captureBtn.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('back button calls goBack', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<FoodCheckerScreen />);
    fireEvent.press(screen.getByText('← Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
