// Jest mock for modules/volume-shutter/src — the real module calls
// requireNativeModule(), which has nothing to resolve to in the test
// environment (no real native build exists there). Mapped in via
// jest.config.js's moduleNameMapper so every screen test gets this
// automatically, instead of repeating a mock per test file. Exports are
// jest.fn() (matching mockSentry.ts's convention) so a screen test can
// assert on calls without first having to edit this shared mock.
export const isVolumeShutterAvailable = jest.fn(() => false);

// no-op — screen tests exercise the on-screen capture button directly, not
// the native hardware-button path (see modules/volume-shutter's own tests
// for that).
export const useVolumeShutter = jest.fn();
