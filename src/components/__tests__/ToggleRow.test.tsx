import { fireEvent, render, screen } from '@testing-library/react-native';
import { ToggleRow } from '../ToggleRow';

describe('ToggleRow', () => {
  it('shows unchecked state with bracket glyph and sublabel', () => {
    render(<ToggleRow label="Include accessories" sublabel="Adds extras" value={false} onToggle={jest.fn()} />);
    expect(screen.getByText('[ ] Include accessories')).toBeTruthy();
    expect(screen.getByText('Adds extras')).toBeTruthy();
    expect(screen.getByLabelText('Include accessories').props.accessibilityState?.checked).toBe(false);
  });

  it('shows checked state with bracket glyph', () => {
    render(<ToggleRow label="Include accessories" sublabel="Adds extras" value={true} onToggle={jest.fn()} />);
    expect(screen.getByText('[x] Include accessories')).toBeTruthy();
    expect(screen.getByLabelText('Include accessories').props.accessibilityState?.checked).toBe(true);
  });

  it('calls onToggle when pressed', () => {
    const onToggle = jest.fn();
    render(<ToggleRow label="Include accessories" sublabel="Adds extras" value={false} onToggle={onToggle} />);
    fireEvent.press(screen.getByLabelText('Include accessories'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
