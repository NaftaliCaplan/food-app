import { fireEvent, render, screen } from '@testing-library/react-native';
import { CaptureButton } from '../CaptureButton';

describe('CaptureButton', () => {
  it('calls onPress when active', () => {
    const onPress = jest.fn();
    render(<CaptureButton onPress={onPress} accessibilityLabel="Take photo" />);
    fireEvent.press(screen.getByTestId('capture-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    render(<CaptureButton onPress={onPress} disabled accessibilityLabel="Take photo" />);
    fireEvent.press(screen.getByTestId('capture-button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes the given label and reflects disabled state to screen readers', () => {
    const onPress = jest.fn();
    render(<CaptureButton onPress={onPress} disabled accessibilityLabel="Take photo of food" />);
    const button = screen.getByTestId('capture-button');
    expect(button.props.accessibilityLabel).toBe('Take photo of food');
    expect(button.props.accessibilityState).toEqual({ disabled: true });
  });
});
