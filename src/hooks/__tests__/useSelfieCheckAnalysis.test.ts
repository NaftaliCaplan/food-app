import { act, renderHook } from '@testing-library/react-native';
import { useSelfieCheckAnalysis } from '../useSelfieCheckAnalysis';

jest.mock('../../services/selfieCheckService');
const { checkSelfieOutfit } = require('../../services/selfieCheckService');

const mockResult = {
  tier: 'good_match' as const,
  garments: [{ category: 'top' as const, tags: ['navy', 'solid'] }],
  tip: 'Solid outfit — these pieces pair nicely.',
};

describe('useSelfieCheckAnalysis', () => {
  beforeEach(() => {
    checkSelfieOutfit.mockReset();
  });

  it('starts in loading state', () => {
    checkSelfieOutfit.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSelfieCheckAnalysis('file://test.jpg', null));
    expect(result.current.status).toBe('loading');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('transitions to success on resolve', async () => {
    checkSelfieOutfit.mockResolvedValue(mockResult);
    const { result } = renderHook(() => useSelfieCheckAnalysis('file://test.jpg', null));
    await act(async () => {});
    expect(result.current.status).toBe('success');
    expect(result.current.result).toEqual(mockResult);
  });

  it('transitions to error on reject', async () => {
    checkSelfieOutfit.mockRejectedValue(new Error('No clothing detected'));
    const { result } = renderHook(() => useSelfieCheckAnalysis('file://test.jpg', null));
    await act(async () => {});
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('No clothing detected');
  });

  it('passes the resolved profile through to checkSelfieOutfit', async () => {
    checkSelfieOutfit.mockResolvedValue(mockResult);
    const profile = { heightRange: 'average' as const, build: 'average' as const, undertone: 'warm' as const };
    renderHook(() => useSelfieCheckAnalysis('file://test.jpg', profile));
    await act(async () => {});
    expect(checkSelfieOutfit).toHaveBeenCalledWith('file://test.jpg', profile);
  });

  it('does not call checkSelfieOutfit at all while ready is false', async () => {
    checkSelfieOutfit.mockResolvedValue(mockResult);
    const { result } = renderHook(() => useSelfieCheckAnalysis('file://test.jpg', null, false));
    await act(async () => {});
    expect(checkSelfieOutfit).not.toHaveBeenCalled();
    expect(result.current.status).toBe('loading');
  });

  it('fires exactly once, with the final profile, once ready flips to true', async () => {
    checkSelfieOutfit.mockResolvedValue(mockResult);
    const profile = { heightRange: 'average' as const, build: 'average' as const, undertone: 'warm' as const };
    const { rerender } = renderHook(
      ({ ready, p }: { ready: boolean; p: typeof profile | null }) => useSelfieCheckAnalysis('file://test.jpg', p, ready),
      { initialProps: { ready: false, p: null } },
    );
    await act(async () => {});
    expect(checkSelfieOutfit).not.toHaveBeenCalled();

    rerender({ ready: true, p: profile });
    await act(async () => {});
    expect(checkSelfieOutfit).toHaveBeenCalledTimes(1);
    expect(checkSelfieOutfit).toHaveBeenCalledWith('file://test.jpg', profile);
  });

  it('re-runs when photoUri changes', async () => {
    checkSelfieOutfit.mockResolvedValue(mockResult);
    const { rerender } = renderHook(
      ({ uri }: { uri: string }) => useSelfieCheckAnalysis(uri, null),
      { initialProps: { uri: 'file://a.jpg' } },
    );
    await act(async () => {});
    rerender({ uri: 'file://b.jpg' });
    expect(checkSelfieOutfit).toHaveBeenCalledTimes(2);
  });
});
