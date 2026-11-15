import { reportError } from '../reportError';

const mockCaptureException = jest.fn();
jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

describe('reportError', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockCaptureException.mockClear();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('logs to the console and reports to Sentry', () => {
    const error = new Error('boom');
    reportError('Capture failed', error);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Capture failed', error, '');
    expect(mockCaptureException).toHaveBeenCalledWith(error, undefined);
  });

  it('passes extra context through to Sentry when provided', () => {
    const error = new Error('boom');
    const extra = { componentStack: 'at Foo\nat Bar' };
    reportError('Uncaught render error', error, extra);

    expect(mockCaptureException).toHaveBeenCalledWith(error, { extra });
  });
});
