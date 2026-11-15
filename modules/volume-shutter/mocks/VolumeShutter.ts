// Auto-discovered by jest-expo's native-module mocking convention (a
// `mocks/<ModuleName>` file next to the module's package.json) — this is
// what backs requireNativeModule('VolumeShutter') inside Jest, instead of
// the real native module that only exists in an actual compiled build.
export const isAvailable = jest.fn(() => true);
export const startListening = jest.fn();
export const stopListening = jest.fn();
export const addListener = jest.fn(() => ({ remove: jest.fn() }));
