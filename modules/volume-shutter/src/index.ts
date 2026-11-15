import { requireNativeModule } from 'expo-modules-core';
import { useEffect, useRef } from 'react';

const VolumeShutterNative = requireNativeModule('VolumeShutter');

// True only on iOS 17.2+/all supported Android versions — false on older
// iOS, where the native module no-ops startListening/stopListening and
// never fires onShutterPress. Screens don't need to check this directly;
// useVolumeShutter degrading to "never fires" on unsupported platforms is
// already the correct behavior (falls back to the existing tap-to-capture
// button, which every camera screen already has regardless).
export function isVolumeShutterAvailable(): boolean {
  return VolumeShutterNative.isAvailable();
}

// Fires onCapture whenever a hardware volume button (or, on iPhone 16+,
// the Camera Control button) is pressed, for as long as `enabled` is true —
// callers pass screen-focus state so this only arms while the relevant
// camera screen is actually the one in front. onCapture is read from a ref
// so it can change every render without needing to restart the native
// listener (and without an exhaustive-deps lint violation).
export function useVolumeShutter(onCapture: () => void, enabled: boolean): void {
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  useEffect(() => {
    if (!enabled) return;
    VolumeShutterNative.startListening();
    const subscription = VolumeShutterNative.addListener('onShutterPress', () => {
      onCaptureRef.current();
    });
    return () => {
      subscription.remove();
      VolumeShutterNative.stopListening();
    };
  }, [enabled]);
}
