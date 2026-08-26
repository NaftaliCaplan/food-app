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

  it('ignores weight tags entirely when no temperature is given', () => {
    const items = [makeItem(['black', 'heavyweight'])];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('penalizes a heavyweight item above the hot threshold', () => {
    const items = [makeItem(['black', 'heavyweight'])];
    expect(scoreOutfitAesthetics(items, 90)).toBeGreaterThan(0);
  });

  it('does not penalize a heavyweight item at a mild temperature', () => {
    const items = [makeItem(['black', 'heavyweight'])];
    expect(scoreOutfitAesthetics(items, 65)).toBe(0);
  });

  it('penalizes a lightweight item below the cold threshold', () => {
    const items = [makeItem(['black', 'lightweight'])];
    expect(scoreOutfitAesthetics(items, 30)).toBeGreaterThan(0);
  });

  it('does not penalize a lightweight item in the heat', () => {
    const items = [makeItem(['black', 'lightweight'])];
    expect(scoreOutfitAesthetics(items, 90)).toBe(0);
  });

  it('never returns a penalty for a mistagged weight item so severe it would matter more than a real clash', () => {
    // The weight penalty should stay soft — comparable in magnitude to the
    // existing color/pattern penalties, not dominate them.
    const weightOnly = scoreOutfitAesthetics([makeItem(['black', 'heavyweight'])], 90);
    const clash = scoreOutfitAesthetics([makeItem(['red', 'solid']), makeItem(['green', 'solid'])]);
    expect(weightOnly).toBeLessThan(clash);
  });

  it('rewards a clash-free 2-top pairing only when one top is tagged outerwear', () => {
    const withOuterwear = scoreOutfitAesthetics([
      makeItem(['black', 'solid']),
      makeItem(['navy', 'solid', 'outerwear']),
    ]);
    expect(withOuterwear).toBeLessThan(0);
  });

  it('does not reward a clash-free 2-top pairing when neither top is outerwear', () => {
    const items = [makeItem(['black', 'solid']), makeItem(['navy', 'solid'])];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('does not reward layering if the pairing itself clashes, even with outerwear present', () => {
    const items = [makeItem(['red', 'solid']), makeItem(['green', 'solid', 'outerwear'])];
    expect(scoreOutfitAesthetics(items)).toBeGreaterThan(0);
  });

  it('does not apply the layering bonus to a solo outerwear-tagged top', () => {
    const items = [makeItem(['navy', 'solid', 'outerwear'])];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });
});
