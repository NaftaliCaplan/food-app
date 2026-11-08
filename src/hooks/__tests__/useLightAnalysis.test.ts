import { act, renderHook } from '@testing-library/react-native';
import { useLightAnalysis } from '../useLightAnalysis';

jest.mock('../../services/lightCheckerService');
const { checkLight } = require('../../services/lightCheckerService');

const mockResult = {
  color: 'red' as const,
  colorLabel: 'Red',
};

describe('useLightAnalysis', () => {
  beforeEach(() => {
    checkLight.mockReset();
  });

  it('starts in loading state', () => {
    checkLight.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useLightAnalysis('file://test.jpg'));
    expect(result.current.status).toBe('loading');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('transitions to success on resolve', async () => {
    checkLight.mockResolvedValue(mockResult);
    const { result } = renderHook(() => useLightAnalysis('file://test.jpg'));
    await act(async () => {});
    expect(result.current.status).toBe('success');
    expect(result.current.result).toEqual(mockResult);
  });

  it('transitions to error on reject', async () => {
    checkLight.mockRejectedValue(new Error('AI proxy error 500'));
    const { result } = renderHook(() => useLightAnalysis('file://test.jpg'));
    await act(async () => {});
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('AI proxy error 500');
  });

  it('re-runs when photoUri changes', async () => {
    checkLight.mockResolvedValue(mockResult);
    const { rerender } = renderHook(
      ({ uri }: { uri: string }) => useLightAnalysis(uri),
      { initialProps: { uri: 'file://a.jpg' } },
    );
    await act(async () => {});
    rerender({ uri: 'file://b.jpg' });
    expect(checkLight).toHaveBeenCalledTimes(2);
  });
});
