import { fireEvent, render, screen } from '@testing-library/react-native';
import { CategoryPicker } from '../CategoryPicker';

describe('CategoryPicker', () => {
  it('marks the current category as checked and others as unchecked', () => {
    render(<CategoryPicker category="bottom" onChange={jest.fn()} />);
    expect(screen.getByLabelText('Bottom').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Top').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Shoes').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Accessory').props.accessibilityState?.checked).toBe(false);
  });

  it('calls onChange with the tapped category', () => {
    const onChange = jest.fn();
    render(<CategoryPicker category="top" onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('Shoes'));
    expect(onChange).toHaveBeenCalledWith('shoes');
  });
});
