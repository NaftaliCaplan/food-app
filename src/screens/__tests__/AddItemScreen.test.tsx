import { fireEvent, render, screen } from '@testing-library/react-native';
import { AddItemScreen } from '../AddItemScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(),
}));

jest.mock('../../services/tagService', () => ({
  tagClothingItem: jest.fn(),
}));

jest.mock('../../storage/wardrobeStorage', () => ({
  addItem: jest.fn(),
  copyPhotoToApp: jest.fn(),
}));

const { useCameraPermissions } = require('expo-camera');

describe('AddItemScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  it('shows empty view when permission is null', () => {
    useCameraPermissions.mockReturnValue([null, jest.fn()]);
    const { toJSON } = render(<AddItemScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows permission request when not granted', () => {
    useCameraPermissions.mockReturnValue([{ granted: false }, jest.fn()]);
    render(<AddItemScreen />);
    expect(screen.getByText('Camera access needed')).toBeTruthy();
    expect(screen.getByText('Grant Permission')).toBeTruthy();
  });

  it('shows the camera UI and category picker when permission is granted', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<AddItemScreen />);
    expect(screen.getByText('Add Item')).toBeTruthy();
    expect(screen.getByLabelText('Top')).toBeTruthy();
    expect(screen.getByLabelText('Bottom')).toBeTruthy();
    expect(screen.getByLabelText('Shoes')).toBeTruthy();
    expect(screen.getByLabelText('Accessory')).toBeTruthy();
  });

  it('defaults to the Top category selected', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<AddItemScreen />);
    expect(screen.getByLabelText('Top').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Bottom').props.accessibilityState?.checked).toBe(false);
  });

  it('selecting a different category updates the selected state', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<AddItemScreen />);
    fireEvent.press(screen.getByLabelText('Shoes'));
    expect(screen.getByLabelText('Shoes').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Top').props.accessibilityState?.checked).toBe(false);
  });

  it('back button calls goBack', () => {
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    render(<AddItemScreen />);
    fireEvent.press(screen.getByText('← Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
