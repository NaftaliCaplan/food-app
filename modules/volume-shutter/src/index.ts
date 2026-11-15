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

// The native module is a single global on/off switch (one shared capture
// interaction on iOS, one shared Window.Callback wrapper on Android) — it
// has no concept of "which screen" asked for it. React Navigation's
// native-stack keeps a screen mounted after a forward navigate() (no
// unmountOnBlur), so more than one camera screen's useVolumeShutter can be
// enabled at once even when callers correctly gate `enabled` on focus (e.g.
// during a push/pop transition). Reference-counting here means a second
// screen's effect cleanup can never silently switch off a first screen's
// still-active listener — the native switch only actually flips off once
// nothing wants it anymore. See docs/AUDIT-2026-11-15.md's Critical #2.
let activeCount = 0;
let nativeSubscription: { remove: () => void } | null = null;
const activeCallbacks = new Set<() => void>();

// Fires onCapture whenever a hardware volume button (or, on iPhone 16+,
// the Camera Control button) is pressed, for as long as `enabled` is true —
// callers MUST also gate `enabled` on screen-focus state (e.g. React
// Navigation's useIsFocused()), not just their own local busy/step state,
// since a backgrounded-but-still-mounted screen staying "enabled" is exactly
// how a hidden screen can ghost-capture on a volume press meant for the
// screen actually on top. See docs/AUDIT-2026-11-15.md's Critical #1 — this
// was a real bug, not a hypothetical. onCapture is read from a ref so it can
// change every render without needing to restart the native listener (and
// without an exhaustive-deps lint violation).
export function useVolumeShutter(onCapture: () => void, enabled: boolean): void {
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  useEffect(() => {
    if (!enabled) return;

    const callback = () => onCaptureRef.current();
    activeCallbacks.add(callback);
    activeCount += 1;
    if (activeCount === 1) {
      VolumeShutterNative.startListening();
      nativeSubscription = VolumeShutterNative.addListener('onShutterPress', () => {
        activeCallbacks.forEach(cb => cb());
      });
    }

    return () => {
      activeCallbacks.delete(callback);
      activeCount -= 1;
      if (activeCount === 0) {
        nativeSubscription?.remove();
        nativeSubscription = null;
        VolumeShutterNative.stopListening();
      }
    };
  }, [enabled]);
}
