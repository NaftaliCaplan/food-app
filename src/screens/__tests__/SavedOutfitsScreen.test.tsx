import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SavedOutfitsScreen } from '../SavedOutfitsScreen';
import { SavedOutfit, WardrobeItem } from '../../types/wardrobe';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

jest.mock('../../storage/outfitStorage', () => ({
  getSavedOutfits: jest.fn(),
  removeOutfit: jest.fn(),
}));
jest.mock('../../storage/wardrobeStorage', () => ({
  getWardrobe: jest.fn(),
}));

const { getSavedOutfits, removeOutfit } = require('../../storage/outfitStorage');
const { getWardrobe } = require('../../storage/wardrobeStorage');

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

function makeOutfit(overrides: Partial<SavedOutfit> = {}): SavedOutfit {
  return {
    id: 'o1',
    itemIds: ['1', '2'],
    styleName: 'Smart Casual',
    savedAt: new Date('2026-07-26T12:00:00Z').getTime(),
    recommendation: 'Tuck in the shirt.',
    ...overrides,
  };
}

describe('SavedOutfitsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    getSavedOutfits.mockReset();
    removeOutfit.mockReset().mockResolvedValue(undefined);
    getWardrobe.mockReset();
  });

  it('shows empty state when there are no saved outfits', async () => {
    getSavedOutfits.mockResolvedValue([]);
    getWardrobe.mockResolvedValue([]);
    render(<SavedOutfitsScreen />);
    await act(async () => {});
    expect(screen.getByText('No saved outfits yet')).toBeTruthy();
  });

  it('back button navigates back to the previous screen', async () => {
    getSavedOutfits.mockResolvedValue([]);
    getWardrobe.mockResolvedValue([]);
    render(<SavedOutfitsScreen />);
    await act(async () => {});
    fireEvent.press(screen.getByText('← Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders a saved outfit with its style name, date, and resolved item thumbnails', async () => {
    getSavedOutfits.mockResolvedValue([makeOutfit()]);
    getWardrobe.mockResolvedValue([
      makeItem({ id: '1', category: 'top' }),
      makeItem({ id: '2', category: 'bottom' }),
    ]);
    render(<SavedOutfitsScreen />);
    await act(async () => {});

    expect(screen.getByText('Smart Casual')).toBeTruthy();
    expect(screen.getByText('Jul 26')).toBeTruthy();
    expect(screen.queryByText('[MISSING]')).toBeNull();
  });

  it('shows a [MISSING] placeholder for an item that no longer exists in the wardrobe', async () => {
    getSavedOutfits.mockResolvedValue([makeOutfit({ itemIds: ['1', '999'] })]);
    getWardrobe.mockResolvedValue([makeItem({ id: '1', category: 'top' })]);
    render(<SavedOutfitsScreen />);
    await act(async () => {});

    expect(screen.getByText('[MISSING]')).toBeTruthy();
  });

  it('hides item names and the tip until the card is tapped, then shows them', async () => {
    getSavedOutfits.mockResolvedValue([makeOutfit()]);
    getWardrobe.mockResolvedValue([
      makeItem({ id: '1', category: 'top', name: 'White tee' }),
      makeItem({ id: '2', category: 'bottom', name: 'Blue jeans' }),
    ]);
    render(<SavedOutfitsScreen />);
    await act(async () => {});

    expect(screen.queryByText(/White tee/)).toBeNull();
    expect(screen.queryByText(/Tuck in the shirt\./)).toBeNull();

    fireEvent.press(screen.getByLabelText('Show details for Smart Casual outfit from Jul 26'));

    expect(screen.getByText(/White tee/)).toBeTruthy();
    expect(screen.getByText(/Blue jeans/)).toBeTruthy();
    expect(screen.getByText(/Tuck in the shirt\./)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Hide details for Smart Casual outfit from Jul 26'));
    expect(screen.queryByText(/White tee/)).toBeNull();
  });

  it('shows a placeholder detail line for a missing item when expanded', async () => {
    getSavedOutfits.mockResolvedValue([makeOutfit({ itemIds: ['1', '999'] })]);
    getWardrobe.mockResolvedValue([makeItem({ id: '1', category: 'top', name: 'White tee' })]);
    render(<SavedOutfitsScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByLabelText('Show details for Smart Casual outfit from Jul 26'));
    expect(screen.getByText(/Item no longer in wardrobe/)).toBeTruthy();
  });

  it('shows a [LAUNDRY] tag for an item currently in laundry, distinct from [MISSING]', async () => {
    getSavedOutfits.mockResolvedValue([makeOutfit()]);
    getWardrobe.mockResolvedValue([
      makeItem({ id: '1', category: 'top', name: 'White tee' }),
      makeItem({ id: '2', category: 'bottom', name: 'Blue jeans', inLaundry: true }),
    ]);
    render(<SavedOutfitsScreen />);
    await act(async () => {});

    expect(screen.getByText('[LAUNDRY]')).toBeTruthy();
    expect(screen.queryByText('[MISSING]')).toBeNull();

    fireEvent.press(screen.getByLabelText('Show details for Smart Casual outfit from Jul 26'));
    expect(screen.getByText(/Blue jeans — \[LAUNDRY\]/)).toBeTruthy();
  });

  it('deletes a saved outfit when its delete button is pressed', async () => {
    getSavedOutfits.mockResolvedValue([makeOutfit()]);
    getWardrobe.mockResolvedValue([
      makeItem({ id: '1', category: 'top' }),
      makeItem({ id: '2', category: 'bottom' }),
    ]);
    render(<SavedOutfitsScreen />);
    await act(async () => {});

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Delete saved outfit from Jul 26'));
    });

    expect(removeOutfit).toHaveBeenCalledWith('o1');
    expect(screen.queryByText('Smart Casual')).toBeNull();
  });
});
