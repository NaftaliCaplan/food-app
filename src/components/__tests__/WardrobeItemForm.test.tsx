import { fireEvent, render, screen } from '@testing-library/react-native';
import { WardrobeItemForm } from '../WardrobeItemForm';

function renderForm(overrides: Partial<Parameters<typeof WardrobeItemForm>[0]> = {}) {
  const props = {
    category: 'top' as const,
    onCategoryChange: jest.fn(),
    name: '',
    onNameChange: jest.fn(),
    tags: [] as string[],
    onToggleTag: jest.fn(),
    onSave: jest.fn(),
    saving: false,
    saveLabel: '✓ Save',
    ...overrides,
  };
  render(<WardrobeItemForm {...props} />);
  return props;
}

describe('WardrobeItemForm', () => {
  it('renders current tags as removable chips', () => {
    renderForm({ tags: ['navy', 'solid'] });
    expect(screen.getByText('navy ✕')).toBeTruthy();
    expect(screen.getByText('solid ✕')).toBeTruthy();
  });

  it('tapping a current tag chip toggles it off via onToggleTag', () => {
    const props = renderForm({ tags: ['navy'] });
    fireEvent.press(screen.getByText('navy ✕'));
    expect(props.onToggleTag).toHaveBeenCalledWith('navy');
  });

  it('tapping an unselected curated color chip toggles it on', () => {
    const props = renderForm({ tags: [] });
    fireEvent.press(screen.getByLabelText('navy'));
    expect(props.onToggleTag).toHaveBeenCalledWith('navy');
  });

  it('shows a curated chip as checked when it is already in tags', () => {
    renderForm({ tags: ['navy'] });
    expect(screen.getByLabelText('navy').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('solid').props.accessibilityState?.checked).toBe(false);
  });

  it('shows fit/weight secondary attributes for top and bottom categories', () => {
    renderForm({ category: 'top' });
    expect(screen.getByText('FIT')).toBeTruthy();
    expect(screen.getByLabelText('fitted')).toBeTruthy();
  });

  it('shows material/type secondary attributes for shoes instead of fit', () => {
    renderForm({ category: 'shoes' });
    expect(screen.getByText('MATERIAL/TYPE')).toBeTruthy();
    expect(screen.getByLabelText('canvas')).toBeTruthy();
    expect(screen.queryByText('FIT')).toBeNull();
  });

  it('shows material secondary attributes for accessories', () => {
    renderForm({ category: 'accessory' });
    expect(screen.getByText('MATERIAL')).toBeTruthy();
    expect(screen.getByLabelText('metal')).toBeTruthy();
  });

  it('adding a custom tag via free text calls onToggleTag with a normalized value', () => {
    const props = renderForm();
    fireEvent.changeText(screen.getByPlaceholderText('or type a custom tag...'), 'Extra Warm');
    fireEvent.press(screen.getByText('＋'));
    expect(props.onToggleTag).toHaveBeenCalledWith('extra-warm');
  });

  it('calls onSave when the save button is pressed', () => {
    const props = renderForm();
    fireEvent.press(screen.getByText('✓ Save'));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner and disables save while saving', () => {
    renderForm({ saving: true });
    expect(screen.queryByText('✓ Save')).toBeNull();
  });

  it('calls onNameChange when the name input changes', () => {
    const props = renderForm();
    fireEvent.changeText(screen.getByPlaceholderText('e.g. white button-up shirt'), 'My Sweater');
    expect(props.onNameChange).toHaveBeenCalledWith('My Sweater');
  });
});
