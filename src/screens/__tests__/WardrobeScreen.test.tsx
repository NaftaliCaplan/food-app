import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { WardrobeScreen } from '../WardrobeScreen';
import { WardrobeItem } from '../../types/wardrobe';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

jest.mock('../../storage/wardrobeStorage', () => ({
  getWardrobe: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('../../storage/profileStorage', () => ({
  getUserProfile: jest.fn(),
}));
const { getWardrobe, removeItem } = require('../../storage/wardrobeStorage');
const { getUserProfile } = require('../../storage/profileStorage');

function makeItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: '1',
    photoUri: 'file://1.jpg',
    category: 'top',
    tags: [],
    addedAt: 0,
    ...overrides,
  };
}

describe('WardrobeScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    getWardrobe.mockReset();
    removeItem.mockReset().mockResolvedValue(undefined);
    getUserProfile.mockReset();
  });

  it('shows empty state when the wardrobe has no items', async () => {
    getWardrobe.mockResolvedValue([]);
    getUserProfile.mockResolvedValue(null);
    render(<WardrobeScreen />);
    await act(async () => {});
    expect(screen.getByText('Your wardrobe is empty')).toBeTruthy();
  });

  it('back button navigates back to the previous screen', async () => {
    getWardrobe.mockResolvedValue([]);
    getUserProfile.mockResolvedValue(null);
    render(<WardrobeScreen />);
    await act(async () => {});
    fireEvent.press(screen.getByText('← Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('empty state add button navigates to AddItem', async () => {
    getWardrobe.mockResolvedValue([]);
    getUserProfile.mockResolvedValue(null);
    render(<WardrobeScreen />);
    await act(async () => {});
    fireEvent.press(screen.getByText('+ Add your first item'));
    expect(mockNavigate).toHaveBeenCalledWith('AddItem');
  });

  it('renders wardrobe items in the grid', async () => {
    getWardrobe.mockResolvedValue([
      makeItem({ id: '1', category: 'top', name: 'White tee' }),
      makeItem({ id: '2', category: 'bottom' }),
    ]);
    getUserProfile.mockResolvedValue(null);
    render(<WardrobeScreen />);
    await act(async () => {});
    expect(screen.getByText('White tee')).toBeTruthy();
    expect(screen.getByText('Bottom')).toBeTruthy();
    expect(screen.getByText('[TOP]')).toBeTruthy();
    expect(screen.getByText('[BOT]')).toBeTruthy();
  });

  it('tapping an item image navigates to EditItem with that item', async () => {
    const item = makeItem({ id: '1', category: 'top', name: 'White tee' });
    getWardrobe.mockResolvedValue([item, makeItem({ id: '2', category: 'bottom' })]);
    getUserProfile.mockResolvedValue(null);
    render(<WardrobeScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByLabelText('Edit White tee'));
    expect(mockNavigate).toHaveBeenCalledWith('EditItem', { item });
  });

  it('removes an item when its delete button is pressed', async () => {
    getWardrobe.mockResolvedValue([
      makeItem({ id: '1', category: 'top', name: 'White tee' }),
      makeItem({ id: '2', category: 'bottom' }),
    ]);
    getUserProfile.mockResolvedValue(null);
    render(<WardrobeScreen />);
    await act(async () => {});

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Remove White tee'));
    });

    expect(removeItem).toHaveBeenCalledWith('1');
    expect(screen.queryByText('White tee')).toBeNull();
  });

  it('navigates to SavedOutfits when the Saved button is pressed', async () => {
    getWardrobe.mockResolvedValue([
      makeItem({ id: '1', category: 'top' }),
      makeItem({ id: '2', category: 'bottom' }),
    ]);
    getUserProfile.mockResolvedValue(null);
    render(<WardrobeScreen />);
    await act(async () => {});
    fireEvent.press(screen.getByLabelText('View saved outfits'));
    expect(mockNavigate).toHaveBeenCalledWith('SavedOutfits');
  });

  it('shows [P] when no profile exists and [P✓] when one does', async () => {
    getWardrobe.mockResolvedValue([]);
    getUserProfile.mockResolvedValue(null);
    render(<WardrobeScreen />);
    await act(async () => {});
    expect(screen.getByText('[P]')).toBeTruthy();

    getWardrobe.mockResolvedValue([]);
    getUserProfile.mockResolvedValue({ heightRange: 'average', build: 'average' });
    render(<WardrobeScreen />);
    await act(async () => {});
    expect(screen.getByText('[P✓]')).toBeTruthy();
  });

  it('disables Build an Outfit with fewer than 2 items', async () => {
    getWardrobe.mockResolvedValue([makeItem({ id: '1' })]);
    getUserProfile.mockResolvedValue(null);
    render(<WardrobeScreen />);
    await act(async () => {});
    expect(screen.getByText('Add at least 2 items to build an outfit')).toBeTruthy();
    const buildBtn = screen.getByLabelText('Build an outfit');
    expect(buildBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('enables Build an Outfit with 2+ items and navigates to OutfitBuilder', async () => {
    getWardrobe.mockResolvedValue([
      makeItem({ id: '1', category: 'top' }),
      makeItem({ id: '2', category: 'bottom' }),
    ]);
    getUserProfile.mockResolvedValue(null);
    render(<WardrobeScreen />);
    await act(async () => {});
    const buildBtn = screen.getByLabelText('Build an outfit');
    expect(buildBtn.props.accessibilityState?.disabled).toBeFalsy();
    fireEvent.press(buildBtn);
    expect(mockNavigate).toHaveBeenCalledWith('OutfitBuilder');
  });
});
