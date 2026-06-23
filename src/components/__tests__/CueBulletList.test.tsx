import { render, screen } from '@testing-library/react-native';
import { CueBulletList } from '../CueBulletList';

describe('CueBulletList', () => {
  it('renders each cue', () => {
    render(<CueBulletList cues={['Yellow skin', 'Brown spots', 'Soft texture']} />);
    expect(screen.getByText('Yellow skin')).toBeTruthy();
    expect(screen.getByText('Brown spots')).toBeTruthy();
    expect(screen.getByText('Soft texture')).toBeTruthy();
  });

  it('renders nothing when cues is empty', () => {
    const { toJSON } = render(<CueBulletList cues={[]} />);
    expect(toJSON()).toBeNull();
  });
});
