import { fireEvent, render, screen } from '@testing-library/react-native';
import { StylePicker } from '../StylePicker';

describe('StylePicker', () => {
  it('marks every selected style as checked and others as unchecked', () => {
    render(<StylePicker selected={['smart_casual', 'beachwear']} onToggle={jest.fn()} />);
    expect(screen.getByLabelText('Smart Casual').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Beachwear').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Casual').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Formal').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Sporty').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Sleepwear').props.accessibilityState?.checked).toBe(false);
  });

  it('shows nothing checked when selected is empty', () => {
    render(<StylePicker selected={[]} onToggle={jest.fn()} />);
    expect(screen.getByLabelText('Casual').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Smart Casual').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Formal').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Sporty').props.accessibilityState?.checked).toBe(false);
  });

  it('calls onToggle with the tapped style', () => {
    const onToggle = jest.fn();
    render(<StylePicker selected={['casual']} onToggle={onToggle} />);
    fireEvent.press(screen.getByLabelText('Formal'));
    expect(onToggle).toHaveBeenCalledWith('formal');
  });

  it('calls onToggle for an already-selected style too, so tapping it again deselects', () => {
    const onToggle = jest.fn();
    render(<StylePicker selected={['casual', 'beachwear']} onToggle={onToggle} />);
    fireEvent.press(screen.getByLabelText('Beachwear'));
    expect(onToggle).toHaveBeenCalledWith('beachwear');
  });
});
