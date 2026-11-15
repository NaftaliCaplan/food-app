import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PhotoResultLayout } from '../PhotoResultLayout';

describe('PhotoResultLayout', () => {
  it('renders the title and the photo placeholder', () => {
    render(
      <PhotoResultLayout title="Light Check" onBack={jest.fn()} photoUri="file://test.jpg">
        <Text>child content</Text>
      </PhotoResultLayout>,
    );
    expect(screen.getByText('Light Check')).toBeTruthy();
    expect(screen.getByText('Photo captured')).toBeTruthy();
  });

  it('renders its children inside the content area', () => {
    render(
      <PhotoResultLayout title="Light Check" onBack={jest.fn()} photoUri="file://test.jpg">
        <Text>a unique child marker</Text>
      </PhotoResultLayout>,
    );
    expect(screen.getByText('a unique child marker')).toBeTruthy();
  });

  it('calls onBack when the header back button is pressed', () => {
    const onBack = jest.fn();
    render(
      <PhotoResultLayout title="Light Check" onBack={onBack} photoUri="file://test.jpg">
        <Text>child content</Text>
      </PhotoResultLayout>,
    );
    fireEvent.press(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
