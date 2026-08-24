import { act, renderHook } from '@testing-library/react-native';
import { useOutfitGenerator } from '../useOutfitGenerator';
import { WardrobeItem } from '../../types/wardrobe';

jest.mock('../../services/outfitService');
const { generateOutfit } = require('../../services/outfitService');

const wardrobe: WardrobeItem[] = [
  { id: '1', photoUri: 'file://1.jpg', category: 'top', tags: ['casual'], addedAt: 0 },
  { id: '2', photoUri: 'file://2.jpg', category: 'bottom', tags: ['casual'], addedAt: 0 },
];

const mockSuggestion = {
  items: wardrobe,
  recommendation: 'Wear it out.',
};

describe('useOutfitGenerator', () => {
  beforeEach(() => {
    generateOutfit.mockReset();
  });

  it('starts idle and has not called generateOutfit', () => {
    const { result } = renderHook(() => useOutfitGenerator(wardrobe, ['casual'], null));
    expect(result.current.status).toBe('idle');
    expect(result.current.suggestion).toBeNull();
    expect(result.current.attemptCount).toBe(0);
    expect(generateOutfit).not.toHaveBeenCalled();
  });

  it('transitions idle -> loading -> success on generate()', async () => {
    generateOutfit.mockResolvedValue(mockSuggestion);
    const { result } = renderHook(() => useOutfitGenerator(wardrobe, ['casual'], null));

    act(() => {
      result.current.generate();
    });
    expect(result.current.status).toBe('loading');

    await act(async () => {});
    expect(result.current.status).toBe('success');
    expect(result.current.suggestion).toEqual(mockSuggestion);
    expect(result.current.attemptCount).toBe(1);
  });

  it('transitions to error and does not bump attemptCount on failure', async () => {
    generateOutfit.mockRejectedValue(new Error('Not enough wardrobe items match the selected style.'));
    const { result } = renderHook(() => useOutfitGenerator(wardrobe, ['casual'], null));

    await act(async () => {
      result.current.generate();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Not enough wardrobe items match the selected style.');
    expect(result.current.attemptCount).toBe(0);
  });

  it('passes includeAccessories through to generateOutfit', async () => {
    generateOutfit.mockResolvedValue(mockSuggestion);
    const { result } = renderHook(() => useOutfitGenerator(wardrobe, ['casual'], null, false));

    await act(async () => {
      result.current.generate();
    });

    expect(generateOutfit).toHaveBeenCalledWith(
      expect.objectContaining({ includeAccessories: false }),
    );
  });

  it('passes temperatureF through to generateOutfit when provided', async () => {
    generateOutfit.mockResolvedValue(mockSuggestion);
    const { result } = renderHook(() => useOutfitGenerator(wardrobe, ['casual'], null, true, 85));

    await act(async () => {
      result.current.generate();
    });

    expect(generateOutfit).toHaveBeenCalledWith(
      expect.objectContaining({ temperatureF: 85 }),
    );
  });

  it('reject() records the current suggestion as rejected and regenerates', async () => {
    generateOutfit.mockResolvedValue(mockSuggestion);
    const { result } = renderHook(() => useOutfitGenerator(wardrobe, ['casual'], null));

    await act(async () => {
      result.current.generate();
    });
    expect(generateOutfit).toHaveBeenCalledTimes(1);
    expect(generateOutfit).toHaveBeenLastCalledWith(
      expect.objectContaining({ rejectedIdSets: [] }),
    );

    const secondSuggestion = { ...mockSuggestion, recommendation: 'A different combo.' };
    generateOutfit.mockResolvedValue(secondSuggestion);

    await act(async () => {
      result.current.reject();
    });

    expect(generateOutfit).toHaveBeenCalledTimes(2);
    expect(generateOutfit).toHaveBeenLastCalledWith(
      expect.objectContaining({ rejectedIdSets: [['1', '2']] }),
    );
    expect(result.current.suggestion).toEqual(secondSuggestion);
    expect(result.current.attemptCount).toBe(2);
  });

  it('reject() accumulates multiple rejected combinations across calls', async () => {
    generateOutfit.mockResolvedValue(mockSuggestion);
    const { result } = renderHook(() => useOutfitGenerator(wardrobe, ['casual'], null));

    await act(async () => {
      result.current.generate();
    });

    const secondSuggestion = {
      ...mockSuggestion,
      items: [wardrobe[0]],
    };
    generateOutfit.mockResolvedValue(secondSuggestion);
    await act(async () => {
      result.current.reject();
    });

    generateOutfit.mockResolvedValue(mockSuggestion);
    await act(async () => {
      result.current.reject();
    });

    expect(generateOutfit).toHaveBeenLastCalledWith(
      expect.objectContaining({ rejectedIdSets: [['1', '2'], ['1']] }),
    );
  });
});
