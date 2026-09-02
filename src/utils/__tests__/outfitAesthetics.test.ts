import { scoreOutfitAesthetics } from '../outfitAesthetics';
import { WardrobeItem } from '../../types/wardrobe';

function makeItem(tags: string[], overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: Math.random().toString(),
    photoUri: 'file://x.jpg',
    category: 'top',
    tags,
    addedAt: 0,
    ...overrides,
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

  it('flags pink+green as a clash (a confirmed live-testing gap in the original list)', () => {
    const clashing = scoreOutfitAesthetics([makeItem(['pink', 'solid']), makeItem(['green', 'solid'])]);
    const arbitrary = scoreOutfitAesthetics([makeItem(['blue', 'solid']), makeItem(['purple', 'solid'])]);
    expect(clashing).toBeGreaterThan(arbitrary);
  });

  it.each([
    ['red', 'purple'],
    ['red', 'yellow'],
    ['orange', 'yellow'],
    ['orange', 'green'],
    ['yellow', 'pink'],
    ['purple', 'green'],
  ])('flags %s+%s as a clash', (colorA, colorB) => {
    const clashing = scoreOutfitAesthetics([makeItem([colorA, 'solid']), makeItem([colorB, 'solid'])]);
    const arbitrary = scoreOutfitAesthetics([makeItem(['blue', 'solid']), makeItem(['purple', 'solid'])]);
    expect(clashing).toBeGreaterThan(arbitrary);
  });

  it.each([
    ['red', 'blue'],
    ['orange', 'blue'],
    ['pink', 'blue'],
    ['pink', 'purple'],
    ['yellow', 'blue'],
    ['blue', 'green'],
  ])('does not flag the classic combo %s+%s as a clash', (colorA, colorB) => {
    const result = scoreOutfitAesthetics([makeItem([colorA, 'solid']), makeItem([colorB, 'solid'])]);
    // Just the baseline "2 distinct accent colors" penalty (+1), no extra
    // known-clash penalty (which would push it to 3: +1 for the count, +2 for the clash).
    expect(result).toBe(1);
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

  it('does not reward two outerwear-tagged tops together — real layering needs exactly one base and one outer', () => {
    // Found via live testing: "at least one outerwear" let two outerwear
    // pieces (e.g. two sweaters) stack together with no actual base layer
    // underneath, which isn't a real layered look.
    const items = [
      makeItem(['black', 'solid', 'outerwear']),
      makeItem(['navy', 'solid', 'outerwear']),
    ];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('penalizes an item whose style does not match any requested style', () => {
    const items = [makeItem(['black', 'solid', 'casual'])];
    expect(scoreOutfitAesthetics(items, undefined, ['smart_casual'])).toBeGreaterThan(0);
  });

  it('does not penalize an item whose style matches the requested style', () => {
    const items = [makeItem(['black', 'solid', 'smart_casual'])];
    expect(scoreOutfitAesthetics(items, undefined, ['smart_casual'])).toBe(0);
  });

  it('does not penalize style at all when no style was requested', () => {
    const items = [makeItem(['black', 'solid', 'casual'])];
    expect(scoreOutfitAesthetics(items, undefined, [])).toBe(0);
  });

  it('does not penalize a casual item when casual is itself the requested style', () => {
    const items = [makeItem(['black', 'solid', 'casual'])];
    expect(scoreOutfitAesthetics(items, undefined, ['casual'])).toBe(0);
  });

  it('weighs a style mismatch at the same +2 tier as the known-clashing-pair penalty', () => {
    const styleMismatch = scoreOutfitAesthetics(
      [makeItem(['black', 'solid', 'casual'])],
      undefined,
      ['smart_casual'],
    );
    expect(styleMismatch).toBe(2);
  });

  it('penalizes a casual fallback item enough that a genuine style match wins between them', () => {
    const casualFallback = scoreOutfitAesthetics(
      [makeItem(['black', 'solid', 'casual'])],
      undefined,
      ['smart_casual'],
    );
    const genuineMatch = scoreOutfitAesthetics(
      [makeItem(['black', 'solid', 'smart_casual'])],
      undefined,
      ['smart_casual'],
    );
    expect(genuineMatch).toBeLessThan(casualFallback);
  });

  it('rewards a light+dark brightness contrast', () => {
    const items = [makeItem(['black', 'solid', 'dark']), makeItem(['white', 'solid', 'light'])];
    expect(scoreOutfitAesthetics(items)).toBeLessThan(0);
  });

  it('does not reward brightness when only one of light/dark is present', () => {
    const items = [makeItem(['black', 'solid', 'dark']), makeItem(['gray', 'solid', 'dark'])];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('penalizes stacking multiple vivid pieces', () => {
    const items = [makeItem(['black', 'solid', 'vivid']), makeItem(['gray', 'solid', 'vivid'])];
    expect(scoreOutfitAesthetics(items)).toBeGreaterThan(0);
  });

  it('does not penalize a single vivid piece', () => {
    const items = [makeItem(['black', 'solid', 'vivid']), makeItem(['gray', 'solid'])];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('rewards a belt matching the shoes in color', () => {
    const items = [
      makeItem(['brown', 'leather', 'belt'], { category: 'accessory' }),
      makeItem(['brown', 'solid'], { category: 'shoes' }),
    ];
    expect(scoreOutfitAesthetics(items)).toBeLessThan(0);
  });

  it('does not reward a belt that does not match the shoes', () => {
    const items = [
      makeItem(['brown', 'leather', 'belt'], { category: 'accessory' }),
      makeItem(['black', 'solid'], { category: 'shoes' }),
    ];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('does not reward an untyped accessory matching the shoes in color (must be a belt specifically)', () => {
    const items = [
      makeItem(['brown', 'leather'], { category: 'accessory' }),
      makeItem(['brown', 'solid'], { category: 'shoes' }),
    ];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('rewards a loose top with a fitted bottom (fit contrast)', () => {
    const items = [
      makeItem(['black', 'solid', 'loose'], { category: 'top' }),
      makeItem(['black', 'solid', 'fitted'], { category: 'bottom' }),
    ];
    expect(scoreOutfitAesthetics(items)).toBeLessThan(0);
  });

  it('does not reward or penalize two loose pieces (only the contrast case is rewarded)', () => {
    const items = [
      makeItem(['black', 'solid', 'loose'], { category: 'top' }),
      makeItem(['black', 'solid', 'loose'], { category: 'bottom' }),
    ];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('isolates the layering bonus to just the two tops, independent of an unrelated shoe/accessory clash', () => {
    // Found via live testing: the layering bonus used to be gated on the
    // WHOLE outfit's total penalty being 0, so an unrelated clash elsewhere
    // (e.g. the shoes and an accessory) could silently prevent layering even
    // though the two tops themselves paired perfectly well together.
    const topA = makeItem(['black', 'solid'], { category: 'top' });
    const topBWithOuterwear = makeItem(['navy', 'solid', 'outerwear'], { category: 'top' });
    const topBWithoutOuterwear = makeItem(['navy', 'solid'], { category: 'top' });
    const bottom = makeItem(['black', 'solid'], { category: 'bottom' });
    const clashingShoes = makeItem(['red', 'solid'], { category: 'shoes' });
    const clashingAccessory = makeItem(['green', 'solid'], { category: 'accessory' });

    const withLayering = scoreOutfitAesthetics([topA, topBWithOuterwear, bottom, clashingShoes, clashingAccessory]);
    const withoutLayering = scoreOutfitAesthetics([topA, topBWithoutOuterwear, bottom, clashingShoes, clashingAccessory]);

    // Same red+green clash penalty applies in both cases — the only
    // difference is whether the tops qualify for the layering bonus, so the
    // outerwear version must score exactly the bonus amount lower.
    expect(withoutLayering - withLayering).toBeCloseTo(0.5);
  });

  it('rewards a warm-flattering accent color when the profile undertone is warm', () => {
    const items = [makeItem(['black', 'solid']), makeItem(['orange', 'solid'])];
    expect(scoreOutfitAesthetics(items, undefined, undefined, 'warm')).toBeLessThan(0);
  });

  it('rewards a cool-flattering accent color when the profile undertone is cool', () => {
    const items = [makeItem(['black', 'solid']), makeItem(['blue', 'solid'])];
    expect(scoreOutfitAesthetics(items, undefined, undefined, 'cool')).toBeLessThan(0);
  });

  it('does not reward a cool-flattering color when the undertone is warm', () => {
    const items = [makeItem(['black', 'solid']), makeItem(['blue', 'solid'])];
    expect(scoreOutfitAesthetics(items, undefined, undefined, 'warm')).toBe(0);
  });

  it('never penalizes a non-flattering accent color for a given undertone — bonus only, never a penalty', () => {
    const withUndertone = scoreOutfitAesthetics([makeItem(['black', 'solid']), makeItem(['blue', 'solid'])], undefined, undefined, 'warm');
    const withoutUndertone = scoreOutfitAesthetics([makeItem(['black', 'solid']), makeItem(['blue', 'solid'])]);
    expect(withUndertone).toBe(withoutUndertone);
  });

  it('applies no undertone adjustment when undertone is neutral', () => {
    const items = [makeItem(['black', 'solid']), makeItem(['orange', 'solid'])];
    expect(scoreOutfitAesthetics(items, undefined, undefined, 'neutral')).toBe(0);
  });

  it('applies no undertone adjustment when no undertone is given at all', () => {
    const items = [makeItem(['black', 'solid']), makeItem(['orange', 'solid'])];
    expect(scoreOutfitAesthetics(items)).toBe(0);
  });

  it('applies the undertone bonus only once even with multiple flattering colors present', () => {
    // olive + burgundy are both warm-flattering and (unlike orange+yellow)
    // aren't themselves a known-clashing pair, isolating this test to just
    // the accent-color-count penalty and the undertone bonus.
    const twoFlattering = scoreOutfitAesthetics(
      [makeItem(['olive', 'solid']), makeItem(['burgundy', 'solid'])],
      undefined,
      undefined,
      'warm',
    );
    const oneFlattering = scoreOutfitAesthetics(
      [makeItem(['orange', 'solid']), makeItem(['black', 'solid'])],
      undefined,
      undefined,
      'warm',
    );
    // Two flattering accent colors still incurs the normal "2 distinct accent
    // colors" penalty (+1) on top of the single undertone bonus (-0.5) — the
    // bonus itself doesn't stack, it isn't a second -0.5 on top of that.
    expect(twoFlattering).toBeCloseTo(oneFlattering + 1);
  });
});
