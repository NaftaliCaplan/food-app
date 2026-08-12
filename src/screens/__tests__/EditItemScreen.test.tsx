import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { EditItemScreen } from '../EditItemScreen';
import { WardrobeItem } from '../../types/wardrobe';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const testItem: WardrobeItem = {
  id: '42',
  photoUri: 'file://42.jpg',
  category: 'top',
  name: 'Navy Sweater',
  tags: ['navy', 'solid', 'casual'],
  addedAt: 0,
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { item: testItem } }),
}));

jest.mock('../../storage/wardrobeStorage', () => ({
  updateItem: jest.fn(),
}));

const { updateItem } = require('../../storage/wardrobeStorage');

describe('EditItemScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    updateItem.mockReset().mockResolvedValue(undefined);
  });

  it('pre-fills the form from the item passed via route params', () => {
    render(<EditItemScreen />);
    expect(screen.getByDisplayValue('Navy Sweater')).toBeTruthy();
    expect(screen.getByText('navy ✕')).toBeTruthy();
    expect(screen.getByText('solid ✕')).toBeTruthy();
    expect(screen.getByLabelText('Top').props.accessibilityState?.checked).toBe(true);
  });

  it('saves the edited fields via updateItem and navigates back', async () => {
    render(<EditItemScreen />);
    fireEvent.changeText(screen.getByDisplayValue('Navy Sweater'), 'Blue Sweater');
    fireEvent.press(screen.getByLabelText('Bottom'));

    await act(async () => {
      fireEvent.press(screen.getByText('✓ Save Changes'));
    });

    expect(updateItem).toHaveBeenCalledWith('42', {
      category: 'bottom',
      name: 'Blue Sweater',
      tags: ['navy', 'solid', 'casual'],
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('back button navigates back without saving', () => {
    render(<EditItemScreen />);
    fireEvent.press(screen.getByText('← Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(updateItem).not.toHaveBeenCalled();
  });
});
