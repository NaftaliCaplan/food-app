import * as Sentry from '@sentry/react-native';

// Shared by every screen's catch block that needs to both log locally (for
// on-device debugging during development) and report to Sentry (for
// visibility into production errors after a user closes the app without
// describing what broke) — previously an identical 2-line
// console.error+Sentry.captureException pattern independently copied into
// 10 catch blocks across 7 screens (see docs/AUDIT-2026-11-15.md's
// Duplication findings). A single call site means a future change to
// error-reporting behavior (severity tags, redaction, etc.) only needs to
// happen once instead of 10 times.
export function reportError(message: string, error: unknown, extra?: Record<string, unknown>): void {
  console.error(message, error, extra ?? '');
  Sentry.captureException(error, extra ? { extra } : undefined);
}
