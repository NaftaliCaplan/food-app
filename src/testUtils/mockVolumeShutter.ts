// Jest mock for modules/volume-shutter/src — the real module calls
// requireNativeModule(), which has nothing to resolve to in the test
// environment (no real native build exists there). Mapped in via
// jest.config.js's moduleNameMapper so every screen test gets this
// automatically, instead of repeating a mock per test file.
export function isVolumeShutterAvailable(): boolean {
  return false;
}

export function useVolumeShutter(): void {
  // no-op — screen tests exercise the on-screen capture button directly,
  // not the native hardware-button path (see modules/volume-shutter's own
  // tests, if any are added, for that).
}
