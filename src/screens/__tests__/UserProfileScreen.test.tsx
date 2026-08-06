import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { UserProfileScreen } from '../UserProfileScreen';

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
  extractSkinTone: jest.fn(),
}));

jest.mock('../../storage/profileStorage', () => ({
  getUserProfile: jest.fn(),
  saveUserProfile: jest.fn(),
  clearUserProfile: jest.fn(),
}));

const { useCameraPermissions } = require('expo-camera');
const { getUserProfile, saveUserProfile, clearUserProfile } = require('../../storage/profileStorage');

describe('UserProfileScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    getUserProfile.mockReset();
    saveUserProfile.mockReset().mockResolvedValue(undefined);
    clearUserProfile.mockReset().mockResolvedValue(undefined);
  });

  it('defaults to average/average and shows the camera placeholder when no profile exists', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<UserProfileScreen />);
    await act(async () => {});
    expect(screen.getByText('Tap to take reference photo')).toBeTruthy();
    expect(screen.queryByText('Retake photo')).toBeNull();
  });

  it('loads an existing profile into the chips and photo row', async () => {
    getUserProfile.mockResolvedValue({
      photoUri: 'file://ref.jpg',
      skinToneDesc: 'warm undertone, high contrast',
      heightRange: 'tall',
      build: 'slim',
    });
    render(<UserProfileScreen />);
    await act(async () => {});

    expect(screen.getByLabelText('Tall').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Petite').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Slim').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Broad').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByText('warm undertone, high contrast')).toBeTruthy();
    expect(screen.getByText('Retake photo')).toBeTruthy();
  });

  it('selecting a height chip updates the selected state', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<UserProfileScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByLabelText('Petite'));
    expect(screen.getByLabelText('Petite').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Tall').props.accessibilityState?.checked).toBe(false);
  });

  it('selecting a build chip updates the selected state', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<UserProfileScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByLabelText('Broad'));
    expect(screen.getByLabelText('Broad').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Slim').props.accessibilityState?.checked).toBe(false);
  });

  it('save profile persists the current fields and navigates back', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<UserProfileScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByLabelText('Tall'));
    await act(async () => {
      fireEvent.press(screen.getByText('✓ Save Profile'));
    });

    expect(saveUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({ heightRange: 'tall', build: 'average' }),
    );
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('skip navigates back without saving', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<UserProfileScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByText('Skip for now'));
    expect(saveUserProfile).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('does not show a clear button when there is no photo or skin tone', async () => {
    getUserProfile.mockResolvedValue(null);
    render(<UserProfileScreen />);
    await act(async () => {});
    expect(screen.queryByText('✕ Clear profile')).toBeNull();
  });

  it('clear profile resets fields and calls clearUserProfile', async () => {
    getUserProfile.mockResolvedValue({
      photoUri: 'file://ref.jpg',
      skinToneDesc: 'warm undertone, high contrast',
      heightRange: 'tall',
      build: 'slim',
    });
    render(<UserProfileScreen />);
    await act(async () => {});

    await act(async () => {
      fireEvent.press(screen.getByText('✕ Clear profile'));
    });

    expect(clearUserProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Tap to take reference photo')).toBeTruthy();
    expect(screen.queryByText('✕ Clear profile')).toBeNull();
  });
});
