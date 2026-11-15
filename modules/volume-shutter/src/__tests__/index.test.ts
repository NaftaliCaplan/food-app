import { act, renderHook } from '@testing-library/react-native';

// jest-expo auto-discovers ../../mocks/VolumeShutter.ts for
// requireNativeModule('VolumeShutter') — see that file's own comment.
// Importing it directly here gets the same jest.fn() instances it hands
// the real module, for assertions.
import * as mockNative from '../../mocks/VolumeShutter';

import { isVolumeShutterAvailable, useVolumeShutter } from '../index';

describe('isVolumeShutterAvailable', () => {
  it('delegates to the native module', () => {
    (mockNative.isAvailable as jest.Mock).mockReturnValue(true);
    expect(isVolumeShutterAvailable()).toBe(true);
    (mockNative.isAvailable as jest.Mock).mockReturnValue(false);
    expect(isVolumeShutterAvailable()).toBe(false);
  });
});

describe('useVolumeShutter', () => {
  beforeEach(() => {
    (mockNative.startListening as jest.Mock).mockClear();
    (mockNative.stopListening as jest.Mock).mockClear();
    (mockNative.addListener as jest.Mock).mockClear();
  });

  it('does not start listening while disabled', () => {
    renderHook(() => useVolumeShutter(jest.fn(), false));
    expect(mockNative.startListening).not.toHaveBeenCalled();
    expect(mockNative.addListener).not.toHaveBeenCalled();
  });

  it('starts listening and subscribes while enabled', () => {
    renderHook(() => useVolumeShutter(jest.fn(), true));
    expect(mockNative.startListening).toHaveBeenCalledTimes(1);
    expect(mockNative.addListener).toHaveBeenCalledWith('onShutterPress', expect.any(Function));
  });

  it('fires the latest onCapture callback when the native event fires, even after a re-render', () => {
    const firstCapture = jest.fn();
    const secondCapture = jest.fn();
    const { rerender } = renderHook(
      ({ onCapture }: { onCapture: () => void }) => useVolumeShutter(onCapture, true),
      { initialProps: { onCapture: firstCapture } },
    );

    rerender({ onCapture: secondCapture });

    const nativeHandler = (mockNative.addListener as jest.Mock).mock.calls[0][1];
    act(() => {
      nativeHandler();
    });

    expect(firstCapture).not.toHaveBeenCalled();
    expect(secondCapture).toHaveBeenCalledTimes(1);
  });

  it('does not re-subscribe on every re-render while enabled stays true', () => {
    const { rerender } = renderHook(
      ({ onCapture }: { onCapture: () => void }) => useVolumeShutter(onCapture, true),
      { initialProps: { onCapture: jest.fn() } },
    );
    rerender({ onCapture: jest.fn() });
    rerender({ onCapture: jest.fn() });

    expect(mockNative.startListening).toHaveBeenCalledTimes(1);
    expect(mockNative.addListener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes and stops listening on unmount', () => {
    const removeMock = jest.fn();
    (mockNative.addListener as jest.Mock).mockReturnValueOnce({ remove: removeMock });
    const { unmount } = renderHook(() => useVolumeShutter(jest.fn(), true));
    unmount();
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(mockNative.stopListening).toHaveBeenCalledTimes(1);
  });

  it('stops listening when enabled flips from true to false', () => {
    const removeMock = jest.fn();
    (mockNative.addListener as jest.Mock).mockReturnValueOnce({ remove: removeMock });
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useVolumeShutter(jest.fn(), enabled),
      { initialProps: { enabled: true } },
    );
    rerender({ enabled: false });

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(mockNative.stopListening).toHaveBeenCalledTimes(1);
  });
});
