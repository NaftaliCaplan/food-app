import { act, renderHook } from '@testing-library/react-native';
import { useClothesAnalysis } from '../useClothesAnalysis';

jest.mock('../../services/clothesService');
const { analyzeClothes } = require('../../services/clothesService');

const mockResult = {
  verdict: 'good_match' as const,
  verdictLabel: 'Good Match',
  confidencePercent: 68,
  garmentDescriptions: ['Dark-toned solid jacket'],
  contrastNotes: [],
  patternNotes: [],
  toneNotes: [],
  recommendation: 'Looks good.',
};

describe('useClothesAnalysis', () => {
  beforeEach(() => {
    analyzeClothes.mockReset();
  });

  it('starts in loading state', () => {
    analyzeClothes.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useClothesAnalysis('file://test.jpg'));
    expect(result.current.status).toBe('loading');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('transitions to success on resolve', async () => {
    analyzeClothes.mockResolvedValue(mockResult);
    const { result } = renderHook(() => useClothesAnalysis('file://test.jpg'));
    await act(async () => {});
    expect(result.current.status).toBe('success');
    expect(result.current.result).toEqual(mockResult);
  });

  it('transitions to error on reject', async () => {
    analyzeClothes.mockRejectedValue(new Error('CF error 500'));
    const { result } = renderHook(() => useClothesAnalysis('file://test.jpg'));
    await act(async () => {});
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('CF error 500');
  });

  it('re-runs when photoUri changes', async () => {
    analyzeClothes.mockResolvedValue(mockResult);
    const { rerender } = renderHook(
      ({ uri }: { uri: string }) => useClothesAnalysis(uri),
      { initialProps: { uri: 'file://a.jpg' } },
    );
    await act(async () => {});
    rerender({ uri: 'file://b.jpg' });
    expect(analyzeClothes).toHaveBeenCalledTimes(2);
  });
});
