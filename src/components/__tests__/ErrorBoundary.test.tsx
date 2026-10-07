import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '../ErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <Text>safe content</Text>;
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // React logs the caught error (and a dev-mode duplicate) to console.error
    // — expected noise for these tests, not something to assert on or let
    // print.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeTruthy();
  });

  it('shows the fallback UI and the error message when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('[ERROR] Something broke')).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();
  });

  it('Try Again resets the boundary and re-renders children once they no longer throw', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('[ERROR] Something broke')).toBeTruthy();

    rerender(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    fireEvent.press(screen.getByText('Try Again'));
    expect(screen.getByText('safe content')).toBeTruthy();
  });
});
