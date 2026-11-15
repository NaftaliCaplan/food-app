// Jest mock for @sentry/react-native, mapped in via package.json's
// moduleNameMapper. The real SDK is large, ships ESM (needs transforming —
// see @sentry/react-native's own Jest troubleshooting docs), and appears to
// start some background native-bridge work on import that was making the
// full suite ~10x slower (12s -> 110s) and leaving a worker process that
// wouldn't exit gracefully. Screens only ever call init/wrap/captureException
// from this module, so that's all this stub needs to provide — if a future
// change calls another Sentry export (e.g. setUser), it'll throw here with
// "not a function," since moduleNameMapper substitutes the whole real
// package; add the new export as a jest.fn() below when that happens.
export const init = jest.fn();
export const wrap = jest.fn((Component: unknown) => Component);
export const captureException = jest.fn();
