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
    expect(screen.getByText('Is it ready?')).toBeTruthy();
    expect(screen.getByText('Does it match?')).toBeTruthy();
  });

  it('navigates to FoodChecker when food button is pressed', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText('Is it ready?'));
    expect(mockNavigate).toHaveBeenCalledWith('FoodChecker');
  });

  it('navigates to ClothesChecker when clothes button is pressed', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText('Does it match?'));
    expect(mockNavigate).toHaveBeenCalledWith('ClothesChecker');
  });
});
