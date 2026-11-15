import { fireEvent, render, screen } from '@testing-library/react-native';
import { ChipPicker } from '../ChipPicker';

const OPTIONS = [
  { key: 'a', label: 'Alpha' },
  { key: 'b', label: 'Beta' },
];

describe('ChipPicker', () => {
  it('reflects isSelected per option and uses the given accessibilityRole', () => {
    render(
      <ChipPicker
        options={OPTIONS}
        isSelected={key => key === 'b'}
        onPress={jest.fn()}
        variant="radio"
      />,
    );
    expect(screen.getByLabelText('Alpha').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Beta').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Alpha').props.accessibilityRole).toBe('radio');
  });

  it('calls onPress with the tapped option\'s key', () => {
    const onPress = jest.fn();
    render(
      <ChipPicker options={OPTIONS} isSelected={() => false} onPress={onPress} variant="checkbox" />,
    );
    fireEvent.press(screen.getByLabelText('Beta'));
    expect(onPress).toHaveBeenCalledWith('b');
  });
});
