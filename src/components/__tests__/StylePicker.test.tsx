import { fireEvent, render, screen } from '@testing-library/react-native';
import { StylePicker } from '../StylePicker';

describe('StylePicker', () => {
  it('marks the current style as checked and others as unchecked', () => {
    render(<StylePicker style="smart_casual" onChange={jest.fn()} />);
    expect(screen.getByLabelText('Smart Casual').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Casual').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Formal').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Sporty').props.accessibilityState?.checked).toBe(false);
  });

  it('shows nothing checked when style is undefined', () => {
    render(<StylePicker style={undefined} onChange={jest.fn()} />);
    expect(screen.getByLabelText('Casual').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Smart Casual').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Formal').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Sporty').props.accessibilityState?.checked).toBe(false);
  });

  it('calls onChange with the tapped style', () => {
    const onChange = jest.fn();
    render(<StylePicker style="casual" onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('Formal'));
    expect(onChange).toHaveBeenCalledWith('formal');
  });
});
