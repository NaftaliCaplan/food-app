import { scoreOutfitAesthetics } from '../outfitAesthetics';
import { WardrobeItem } from '../../types/wardrobe';

function makeItem(tags: string[]): WardrobeItem {
  return {
    id: Math.random().toString(),
    photoUri: 'file://x.jpg',
    category: 'top',
    tags,
    addedAt: 0,
  };
}

describe('scoreOutfitAesthetics', () => {
  it('scores 0 for an all-neutral outfit', () => {
    const items = [makeItem(['black', 'solid']), makeItem(['navy', 'solid'])];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('scores 0 for a single accent color paired with neutrals', () => {
    const items = [makeItem(['red', 'solid']), makeItem(['black', 'solid']), makeItem(['gray', 'solid'])];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('penalizes multiple distinct accent colors', () => {
    const items = [makeItem(['blue', 'solid']), makeItem(['yellow', 'solid'])];
    expect(scoreOutfitAesthetics(items)).toBeGreaterThan(0);
  });

  it('does not penalize the same accent color repeated (a tonal look)', () => {
    const items = [makeItem(['red', 'solid']), makeItem(['red', 'solid'])];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('penalizes a known-clashing color pair more than an arbitrary two-accent combo', () => {
    const clashing = scoreOutfitAesthetics([makeItem(['red', 'solid']), makeItem(['green', 'solid'])]);
    const arbitrary = scoreOutfitAesthetics([makeItem(['blue', 'solid']), makeItem(['purple', 'solid'])]);
    expect(clashing).toBeGreaterThan(arbitrary);
  });

  it('penalizes mixing two busy patterns', () => {
    const items = [makeItem(['black', 'plaid']), makeItem(['white', 'floral'])];
    expect(scoreOutfitAesthetics(items)).toBeGreaterThan(0);
  });

  it('does not penalize a busy pattern paired with solids', () => {
    const items = [makeItem(['black', 'plaid']), makeItem(['white', 'solid']), makeItem(['gray', 'solid'])];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('does not treat textured as a busy pattern', () => {
    const items = [makeItem(['black', 'textured']), makeItem(['white', 'textured'])];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('is case-insensitive on tag matching', () => {
    const items = [makeItem(['RED', 'Solid']), makeItem(['GREEN', 'Solid'])];
    expect(scoreOutfitAesthetics(items)).toBeGreaterThan(0);
  });
});
