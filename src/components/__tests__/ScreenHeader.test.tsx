import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ScreenHeader } from '../ScreenHeader';

describe('ScreenHeader', () => {
  it('renders the title and calls onBack when the back button is pressed', () => {
    const onBack = jest.fn();
    render(<ScreenHeader title="My Screen" onBack={onBack} />);
    expect(screen.getByText('My Screen')).toBeTruthy();
    fireEvent.press(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('supports a custom back label', () => {
    render(<ScreenHeader title="Reference Photo" onBack={jest.fn()} backLabel="← Cancel" />);
    expect(screen.getByText('← Cancel')).toBeTruthy();
    expect(screen.queryByText('← Back')).toBeNull();
  });

  it('renders right-side content when provided', () => {
    render(
      <ScreenHeader title="My Wardrobe" onBack={jest.fn()} right={<Text>Right content</Text>} />,
    );
    expect(screen.getByText('Right content')).toBeTruthy();
  });
});
