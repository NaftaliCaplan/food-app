import { fireEvent, render, screen } from '@testing-library/react-native';
import { CaptureButton } from '../CaptureButton';

describe('CaptureButton', () => {
  it('calls onPress when active', () => {
    const onPress = jest.fn();
    render(<CaptureButton onPress={onPress} />);
    fireEvent.press(screen.getByTestId('capture-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    render(<CaptureButton onPress={onPress} disabled />);
    fireEvent.press(screen.getByTestId('capture-button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
