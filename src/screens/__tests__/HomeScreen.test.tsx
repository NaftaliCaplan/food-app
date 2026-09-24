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

  it('renders all three feature buttons', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Is it ready?')).toBeTruthy();
    expect(screen.getByText('Does it match?')).toBeTruthy();
    expect(screen.getByText("How's my outfit?")).toBeTruthy();
  });

  it('navigates to FoodChecker when food button is pressed', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText('Is it ready?'));
    expect(mockNavigate).toHaveBeenCalledWith('FoodChecker');
  });

  it('navigates to Wardrobe when clothes button is pressed', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText('Does it match?'));
    expect(mockNavigate).toHaveBeenCalledWith('Wardrobe');
  });

  it('navigates to SelfieCheck when the selfie-check button is pressed', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText("How's my outfit?"));
    expect(mockNavigate).toHaveBeenCalledWith('SelfieCheck');
  });
});
