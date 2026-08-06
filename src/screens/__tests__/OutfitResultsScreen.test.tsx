import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { OutfitResultsScreen } from '../OutfitResultsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({
    params: { stylePrefs: ['casual'], useProfile: false, includeAccessories: true },
  }),
}));

jest.mock('../../hooks/useOutfitGenerator');
const { useOutfitGenerator } = require('../../hooks/useOutfitGenerator');

jest.mock('../../storage/wardrobeStorage', () => ({
  getWardrobe: jest.fn(),
}));
jest.mock('../../storage/profileStorage', () => ({
  getUserProfile: jest.fn(),
}));
jest.mock('../../storage/outfitStorage', () => ({
  saveOutfit: jest.fn(),
}));

const { getWardrobe } = require('../../storage/wardrobeStorage');
const { saveOutfit } = require('../../storage/outfitStorage');

const mockGenerate = jest.fn();
const mockReject = jest.fn();

const mockSuggestion = {
  items: [
    { id: '1', photoUri: 'file://1.jpg', category: 'top', tags: [], addedAt: 0, name: 'White tee' },
    { id: '2', photoUri: 'file://2.jpg', category: 'bottom', tags: [], addedAt: 0 },
  ],
  reasoning: 'Contrast and balance work well.',
  styleNotes: ['Bright top pairs with dark bottom'],
  recommendation: 'Add clean shoes to finish it off.',
};

describe('OutfitResultsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockGenerate.mockClear();
    mockReject.mockClear();
    getWardrobe.mockReset().mockResolvedValue([]);
    saveOutfit.mockReset().mockResolvedValue(undefined);
    useOutfitGenerator.mockReturnValue({
      status: 'idle',
      suggestion: null,
      error: null,
      attemptCount: 0,
      generate: mockGenerate,
      reject: mockReject,
    });
  });

  it('shows a loading state before data has loaded', async () => {
    render(<OutfitResultsScreen />);
    expect(screen.getByText('Styling your outfit...')).toBeTruthy();
    await act(async () => {});
  });

  it('fires the first generation once the wardrobe has loaded', async () => {
    render(<OutfitResultsScreen />);
    await act(async () => {});
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('shows a retry-specific loading message when re-generating', async () => {
    useOutfitGenerator.mockReturnValue({
      status: 'loading',
      suggestion: null,
      error: null,
      attemptCount: 1,
      generate: mockGenerate,
      reject: mockReject,
    });
    render(<OutfitResultsScreen />);
    await act(async () => {});
    expect(screen.getByText('Finding another combination...')).toBeTruthy();
  });

  it('shows an error state with retry and adjust-style options', async () => {
    useOutfitGenerator.mockReturnValue({
      status: 'error',
      suggestion: null,
      error: 'Not enough wardrobe items match the selected style.',
      attemptCount: 0,
      generate: mockGenerate,
      reject: mockReject,
    });
    render(<OutfitResultsScreen />);
    await act(async () => {});

    expect(screen.getByText('Not enough wardrobe items match the selected style.')).toBeTruthy();
    fireEvent.press(screen.getByText('← Adjust Style'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders the suggestion on success', async () => {
    useOutfitGenerator.mockReturnValue({
      status: 'success',
      suggestion: mockSuggestion,
      error: null,
      attemptCount: 1,
      generate: mockGenerate,
      reject: mockReject,
    });
    render(<OutfitResultsScreen />);
    await act(async () => {});

    expect(screen.getByText(/White tee/)).toBeTruthy();
    expect(screen.getByText('Contrast and balance work well.')).toBeTruthy();
    expect(screen.getByText(/Bright top pairs with dark bottom/)).toBeTruthy();
    expect(screen.getByText(/Add clean shoes to finish it off\./)).toBeTruthy();
  });

  it('Keep This Outfit saves the suggestion and navigates to Wardrobe', async () => {
    useOutfitGenerator.mockReturnValue({
      status: 'success',
      suggestion: mockSuggestion,
      error: null,
      attemptCount: 1,
      generate: mockGenerate,
      reject: mockReject,
    });
    render(<OutfitResultsScreen />);
    await act(async () => {});

    await act(async () => {
      fireEvent.press(screen.getByText('✓ Keep This Outfit'));
    });

    expect(saveOutfit).toHaveBeenCalledWith(
      expect.objectContaining({ itemIds: ['1', '2'], styleName: 'Casual' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('Wardrobe');
  });

  it('Try Again calls reject to regenerate', async () => {
    useOutfitGenerator.mockReturnValue({
      status: 'success',
      suggestion: mockSuggestion,
      error: null,
      attemptCount: 1,
      generate: mockGenerate,
      reject: mockReject,
    });
    render(<OutfitResultsScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByText('✕ Try Again'));
    expect(mockReject).toHaveBeenCalledTimes(1);
  });
});
