import { generateOutfit } from '../outfitService';
import { WardrobeItem } from '../../types/wardrobe';

let nextId = 1;

function makeItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: String(nextId++),
    photoUri: 'file://1.jpg',
    category: 'top',
    tags: [],
    addedAt: 0,
    ...overrides,
  };
}

describe('generateOutfit', () => {
  beforeEach(() => {
    nextId = 1;
  });

  it('throws when fewer than 2 items match the requested style', () => {
    const wardrobe = [makeItem({ category: 'top', tags: ['formal'] })];
    expect(() => generateOutfit({ wardrobe, stylePrefs: ['formal'] })).toThrow(
      'Not enough wardrobe items',
    );
  });

  it('always includes casual-tagged items regardless of requested style', () => {
    const wardrobe = [
      makeItem({ category: 'top', tags: ['casual'] }),
      makeItem({ category: 'bottom', tags: ['formal'] }),
    ];
    const result = generateOutfit({ wardrobe, stylePrefs: ['formal'] });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('normalizes underscore/hyphen style tags so smart_casual matches smart-casual', () => {
    const wardrobe = [
      makeItem({ category: 'top', tags: ['smart-casual'] }),
      makeItem({ category: 'bottom', tags: ['smart-casual'] }),
    ];
    const result = generateOutfit({ wardrobe, stylePrefs: ['smart_casual'] });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('excludes accessories from the candidate pool when includeAccessories is false', () => {
    const wardrobe = [
      makeItem({ category: 'top', tags: ['casual'] }),
      makeItem({ category: 'bottom', tags: ['casual'] }),
      makeItem({ category: 'accessory', tags: [] }),
    ];
    const result = generateOutfit({ wardrobe, stylePrefs: ['casual'], includeAccessories: false });
    expect(result.items.some(i => i.category === 'accessory')).toBe(false);
  });

  it('includes a non-clashing accessory by default', () => {
    const wardrobe = [
      makeItem({ category: 'top', tags: ['casual', 'red', 'solid'] }),
      makeItem({ category: 'bottom', tags: ['casual', 'black', 'solid'] }),
      makeItem({ category: 'accessory', tags: ['black'] }),
    ];
    const result = generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.some(i => i.category === 'accessory')).toBe(true);
  });

  it('excludes items marked inLaundry from the candidate pool', () => {
    const wardrobe = [
      makeItem({ category: 'top', tags: ['casual'] }),
      makeItem({ category: 'bottom', tags: ['casual'], inLaundry: true }),
      makeItem({ category: 'bottom', tags: ['casual'] }),
    ];
    const result = generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.some(i => i.inLaundry)).toBe(false);
  });

  it('throws a distinct error when the style-matching pool has no top, bottom, or shoes at all', () => {
    const wardrobe = [
      makeItem({ category: 'accessory', tags: ['casual'] }),
      makeItem({ category: 'accessory', tags: ['casual'] }),
    ];
    expect(() => generateOutfit({ wardrobe, stylePrefs: ['casual'] })).toThrow(
      'No wearable top, bottom, or shoes',
    );
  });

  it('prefers a genuinely style-matching item over a casual fallback with the same colors', () => {
    const wardrobe = [
      makeItem({ category: 'bottom', tags: ['black', 'solid', 'casual'] }),
      makeItem({ category: 'shoes', tags: ['black', 'solid', 'casual'] }),
      makeItem({ category: 'top', name: 'casual tee', tags: ['black', 'solid', 'casual'] }),
      makeItem({ category: 'top', name: 'smart casual polo', tags: ['black', 'solid', 'smart_casual'] }),
    ];
    const result = generateOutfit({ wardrobe, stylePrefs: ['smart_casual'] });
    expect(result.items.some(i => i.name === 'smart casual polo')).toBe(true);
    expect(result.items.some(i => i.name === 'casual tee')).toBe(false);
  });

  it('returns a recommendation built from the actual final items', () => {
    const wardrobe = [
      makeItem({ category: 'top', name: 'navy tee', tags: ['casual'] }),
      makeItem({ category: 'bottom', name: 'khakis', tags: ['casual'] }),
    ];
    const result = generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(typeof result.recommendation).toBe('string');
    expect(result.recommendation.length).toBeGreaterThan(0);
  });

  it('excludes a previously rejected exact combination on the next call', () => {
    const wardrobe = [
      makeItem({ category: 'top', tags: ['casual', 'red', 'solid'] }),
      makeItem({ category: 'bottom', tags: ['casual', 'green', 'solid'] }), // clashes with the top
      makeItem({ category: 'bottom', tags: ['casual', 'black', 'solid'] }), // safe
    ];
    const first = generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    const firstIds = first.items.map(i => i.id).sort();

    const second = generateOutfit({ wardrobe, stylePrefs: ['casual'], rejectedIdSets: [firstIds] });
    expect(second.items.map(i => i.id).sort()).not.toEqual(firstIds);
  });

  it('passes temperatureF through so weight tags affect which item wins a tie', () => {
    const wardrobe = [
      makeItem({ category: 'top', tags: ['casual', 'black', 'solid'] }),
      makeItem({ category: 'bottom', tags: ['casual', 'black', 'solid', 'heavyweight'] }),
      makeItem({ category: 'bottom', tags: ['casual', 'black', 'solid', 'lightweight'] }),
    ];
    const result = generateOutfit({ wardrobe, stylePrefs: ['casual'], temperatureF: 95 });
    expect(result.items.some(i => i.tags.includes('lightweight'))).toBe(true);
    expect(result.items.some(i => i.tags.includes('heavyweight'))).toBe(false);
  });

  it('accepts a profile without erroring, even though it is currently unused', () => {
    const wardrobe = [
      makeItem({ category: 'top', tags: ['casual'] }),
      makeItem({ category: 'bottom', tags: ['casual'] }),
    ];
    expect(() =>
      generateOutfit({
        wardrobe,
        stylePrefs: ['casual'],
        profile: { heightRange: 'tall', build: 'slim' },
      }),
    ).not.toThrow();
  });
});
