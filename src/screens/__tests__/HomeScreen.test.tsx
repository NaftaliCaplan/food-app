import { render, screen, fireEvent } from '@testing-library/react-native';
import { HomeScreen } from '../HomeScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe('HomeScreen', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('renders title and tagline', () => {
    render(<HomeScreen />);
    expect(screen.getByText('CBA')).toBeTruthy();
    expect(screen.getByText('color-blind assist')).toBeTruthy();
  });

  it('renders both feature buttons', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Is it ready or ripe?')).toBeTruthy();
    expect(screen.getByText('Does it match?')).toBeTruthy();
  });

  it('navigates to FoodChecker when food button is pressed', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText('Is it ready or ripe?'));
    expect(mockNavigate).toHaveBeenCalledWith('FoodChecker');
  });

  it('does not navigate when clothes button is pressed (disabled)', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText('Does it match?'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
