import { act, renderHook } from '@testing-library/react-native';
import { useAnalysis } from '../useAnalysis';

jest.mock('../../services/cloudflareService');
const { analyzeFood } = require('../../services/cloudflareService');

const mockResult = {
  state: 'ripe' as const,
  stateLabel: 'Ripe',
  confidencePercent: 72,
  visualCues: ['Yellow skin', 'Brown spots'],
  recommendation: 'Eat today.',
};

describe('useAnalysis', () => {
  beforeEach(() => {
    analyzeFood.mockReset();
  });

  it('starts in loading state', () => {
    analyzeFood.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAnalysis('file://test.jpg', 'banana'));
    expect(result.current.status).toBe('loading');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('transitions to success on resolve', async () => {
    analyzeFood.mockResolvedValue(mockResult);
    const { result } = renderHook(() => useAnalysis('file://test.jpg', 'banana'));
    await act(async () => {});
    expect(result.current.status).toBe('success');
    expect(result.current.result).toEqual(mockResult);
  });

  it('transitions to error on reject', async () => {
    analyzeFood.mockRejectedValue(new Error('CF error 500'));
    const { result } = renderHook(() => useAnalysis('file://test.jpg', 'banana'));
    await act(async () => {});
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('CF error 500');
  });

  it('re-runs when photoUri changes', async () => {
    analyzeFood.mockResolvedValue(mockResult);
    const { rerender } = renderHook(
      ({ uri }: { uri: string }) => useAnalysis(uri, 'banana'),
      { initialProps: { uri: 'file://a.jpg' } },
    );
    await act(async () => {});
    rerender({ uri: 'file://b.jpg' });
    expect(analyzeFood).toHaveBeenCalledTimes(2);
  });

  it('re-runs when foodLabel changes', async () => {
    analyzeFood.mockResolvedValue(mockResult);
    const { rerender } = renderHook(
      ({ label }: { label: string }) => useAnalysis('file://test.jpg', label),
      { initialProps: { label: 'banana' } },
    );
    await act(async () => {});
    rerender({ label: 'apple' });
    expect(analyzeFood).toHaveBeenCalledTimes(2);
    expect(analyzeFood).toHaveBeenLastCalledWith('file://test.jpg', 'apple');
  });
});
