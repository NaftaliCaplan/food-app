import { selectBestOutfit } from '../outfitCandidates';
import { StylePreference, WardrobeItem } from '../../types/wardrobe';

let nextId = 1;

function makeItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: String(nextId++),
    photoUri: 'file://x.jpg',
    category: 'top',
    tags: [],
    addedAt: 0,
    ...overrides,
  };
}

function idsOf(items: WardrobeItem[]): string[] {
  return items.map(i => i.id).sort();
}

describe('selectBestOutfit', () => {
  beforeEach(() => {
    nextId = 1;
  });

  it('returns null when the pool has nothing to build a top/bottom/shoes combo from', () => {
    const accessoryOnly = makeItem({ category: 'accessory' });
    expect(
      selectBestOutfit({ pool: [accessoryOnly], includeAccessories: true, rejectedIdSets: [] }),
    ).toBeNull();
    expect(selectBestOutfit({ pool: [], includeAccessories: true, rejectedIdSets: [] })).toBeNull();
  });

  it('builds a complete outfit from one item per category', () => {
    const top = makeItem({ category: 'top', tags: ['black', 'solid'] });
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });
    const result = selectBestOutfit({ pool: [top, bottom, shoes], includeAccessories: true, rejectedIdSets: [] });
    expect(idsOf(result!)).toEqual(idsOf([top, bottom, shoes]));
  });

  it('omits a category entirely when the pool has nothing for it, without erroring', () => {
    const top = makeItem({ category: 'top', tags: ['black', 'solid'] });
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const result = selectBestOutfit({ pool: [top, bottom], includeAccessories: true, rejectedIdSets: [] });
    expect(idsOf(result!)).toEqual(idsOf([top, bottom]));
    expect(result!.some(i => i.category === 'shoes')).toBe(false);
  });

  it('picks the non-clashing bottom over a clashing one', () => {
    const top = makeItem({ category: 'top', tags: ['red', 'solid'] });
    const clashingBottom = makeItem({ category: 'bottom', tags: ['green', 'solid'] });
    const safeBottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });

    const result = selectBestOutfit({
      pool: [top, clashingBottom, safeBottom, shoes],
      includeAccessories: true,
      rejectedIdSets: [],
    });

    expect(result!.some(i => i.id === safeBottom.id)).toBe(true);
    expect(result!.some(i => i.id === clashingBottom.id)).toBe(false);
  });

  it('greedily adds a non-clashing accessory', () => {
    const top = makeItem({ category: 'top', tags: ['red', 'solid'] });
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });
    const accessory = makeItem({ category: 'accessory', tags: ['black'] });

    const result = selectBestOutfit({
      pool: [top, bottom, shoes, accessory],
      includeAccessories: true,
      rejectedIdSets: [],
    });

    expect(result!.some(i => i.id === accessory.id)).toBe(true);
  });

  it('does not add an accessory that would introduce a clash', () => {
    const top = makeItem({ category: 'top', tags: ['red', 'solid'] });
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });
    const clashingAccessory = makeItem({ category: 'accessory', tags: ['green'] });

    const result = selectBestOutfit({
      pool: [top, bottom, shoes, clashingAccessory],
      includeAccessories: true,
      rejectedIdSets: [],
    });

    expect(result!.some(i => i.id === clashingAccessory.id)).toBe(false);
  });

  it('excludes accessories entirely when includeAccessories is false, even non-clashing ones', () => {
    const top = makeItem({ category: 'top', tags: ['red', 'solid'] });
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });
    const accessory = makeItem({ category: 'accessory', tags: ['black'] });

    const result = selectBestOutfit({
      pool: [top, bottom, shoes, accessory],
      includeAccessories: false,
      rejectedIdSets: [],
    });

    expect(result!.some(i => i.id === accessory.id)).toBe(false);
  });

  it('does not add a second top as "layering" unless it is tagged outerwear', () => {
    const topA = makeItem({ category: 'top', tags: ['red', 'solid'] });
    const topB = makeItem({ category: 'top', tags: ['red', 'solid'] }); // no outerwear tag
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });

    const result = selectBestOutfit({
      pool: [topA, topB, bottom, shoes],
      includeAccessories: true,
      rejectedIdSets: [],
    });

    expect(result!.filter(i => i.category === 'top')).toHaveLength(1);
  });

  it('does add a genuine outerwear layering pair when it scores better than either top alone', () => {
    const topA = makeItem({ category: 'top', tags: ['red', 'solid'] });
    const topB = makeItem({ category: 'top', tags: ['red', 'solid', 'outerwear'] });
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });

    const result = selectBestOutfit({
      pool: [topA, topB, bottom, shoes],
      includeAccessories: true,
      rejectedIdSets: [],
    });

    expect(result!.filter(i => i.category === 'top')).toHaveLength(2);
  });

  it('falls back to the next-best combination when the best one is rejected', () => {
    const top = makeItem({ category: 'top', tags: ['red', 'solid'] });
    const clashingBottom = makeItem({ category: 'bottom', tags: ['green', 'solid'] });
    const safeBottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });

    const best = selectBestOutfit({
      pool: [top, clashingBottom, safeBottom, shoes],
      includeAccessories: true,
      rejectedIdSets: [],
    })!;
    expect(best.some(i => i.id === safeBottom.id)).toBe(true);

    const rejected = selectBestOutfit({
      pool: [top, clashingBottom, safeBottom, shoes],
      includeAccessories: true,
      rejectedIdSets: [idsOf(best)],
    })!;
    expect(rejected.some(i => i.id === clashingBottom.id)).toBe(true);
  });

  it('ignores rejections rather than returning null if honoring them would leave nothing', () => {
    const top = makeItem({ category: 'top', tags: ['black', 'solid'] });
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });
    const onlyCombo = idsOf([top, bottom, shoes]);

    const result = selectBestOutfit({
      pool: [top, bottom, shoes],
      includeAccessories: true,
      rejectedIdSets: [onlyCombo],
    });

    expect(result).not.toBeNull();
    expect(idsOf(result!)).toEqual(onlyCombo);
  });

  it('applies the temperature score when picking between two otherwise-tied bottoms', () => {
    const top = makeItem({ category: 'top', tags: ['black', 'solid'] });
    const heavyBottom = makeItem({ category: 'bottom', tags: ['black', 'solid', 'heavyweight'] });
    const lightBottom = makeItem({ category: 'bottom', tags: ['black', 'solid', 'lightweight'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });

    const result = selectBestOutfit({
      pool: [top, heavyBottom, lightBottom, shoes],
      includeAccessories: true,
      temperatureF: 95,
      rejectedIdSets: [],
    });

    expect(result!.some(i => i.id === lightBottom.id)).toBe(true);
    expect(result!.some(i => i.id === heavyBottom.id)).toBe(false);
  });

  it('prefers an item matching the requested style over a casual fallback with otherwise-identical colors', () => {
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });
    const casualTop = makeItem({ category: 'top', tags: ['black', 'solid', 'casual'] });
    const matchingTop = makeItem({ category: 'top', tags: ['black', 'solid', 'smart_casual'] });

    const result = selectBestOutfit({
      pool: [bottom, shoes, casualTop, matchingTop],
      includeAccessories: true,
      stylePrefs: ['smart_casual'] as StylePreference[],
      rejectedIdSets: [],
    });

    expect(result!.some(i => i.id === matchingTop.id)).toBe(true);
    expect(result!.some(i => i.id === casualTop.id)).toBe(false);
  });

  it('never selects two accessories of the same manually-tagged type (e.g. two hats)', () => {
    const top = makeItem({ category: 'top', tags: ['black', 'solid'] });
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });
    const hatA = makeItem({ category: 'accessory', tags: ['black', 'hat'] });
    const hatB = makeItem({ category: 'accessory', tags: ['gray', 'hat'] });

    const result = selectBestOutfit({
      pool: [top, bottom, shoes, hatA, hatB],
      includeAccessories: true,
      rejectedIdSets: [],
    });

    const hatCount = result!.filter(i => i.id === hatA.id || i.id === hatB.id).length;
    expect(hatCount).toBe(1);
  });

  it('allows two different-typed accessories together (a hat and a belt)', () => {
    const top = makeItem({ category: 'top', tags: ['black', 'solid'] });
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });
    const hat = makeItem({ category: 'accessory', tags: ['black', 'hat'] });
    const belt = makeItem({ category: 'accessory', tags: ['black', 'belt'] });

    const result = selectBestOutfit({
      pool: [top, bottom, shoes, hat, belt],
      includeAccessories: true,
      rejectedIdSets: [],
    });

    expect(result!.some(i => i.id === hat.id)).toBe(true);
    expect(result!.some(i => i.id === belt.id)).toBe(true);
  });

  it('still allows untyped accessories to stack freely (no regression from adding accessory types)', () => {
    const top = makeItem({ category: 'top', tags: ['black', 'solid'] });
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });
    const accA = makeItem({ category: 'accessory', tags: ['black'] });
    const accB = makeItem({ category: 'accessory', tags: ['gray'] });

    const result = selectBestOutfit({
      pool: [top, bottom, shoes, accA, accB],
      includeAccessories: true,
      rejectedIdSets: [],
    });

    expect(result!.some(i => i.id === accA.id)).toBe(true);
    expect(result!.some(i => i.id === accB.id)).toBe(true);
  });

  it('breaks a genuine tie randomly rather than always favoring whichever item was in the pool first', () => {
    const top = makeItem({ category: 'top', tags: ['black', 'solid'] });
    const bottomA = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const bottomB = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });
    const pool = [top, bottomA, bottomB, shoes];

    const randomSpy = jest.spyOn(Math, 'random');
    try {
      randomSpy.mockReturnValue(0);
      const first = selectBestOutfit({ pool, includeAccessories: true, rejectedIdSets: [] });
      expect(first!.some(i => i.id === bottomA.id)).toBe(true);

      randomSpy.mockReturnValue(0.99);
      const second = selectBestOutfit({ pool, includeAccessories: true, rejectedIdSets: [] });
      expect(second!.some(i => i.id === bottomB.id)).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('prefers the simpler (single-top) outfit on a score tie, before falling back to random', () => {
    // Same setup as the outerwear-gated layering test, but explicitly verifies
    // the tie-break order itself: a 2-top pairing must never win a pure score
    // tie against a single top, regardless of what Math.random returns.
    const topA = makeItem({ category: 'top', tags: ['red', 'solid'] });
    const topB = makeItem({ category: 'top', tags: ['red', 'solid'] }); // no outerwear tag — ties, doesn't beat
    const bottom = makeItem({ category: 'bottom', tags: ['black', 'solid'] });
    const shoes = makeItem({ category: 'shoes', tags: ['black', 'solid'] });

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99); // would pick a "later" finalist if it could
    try {
      const result = selectBestOutfit({
        pool: [topA, topB, bottom, shoes],
        includeAccessories: true,
        rejectedIdSets: [],
      });
      expect(result!.filter(i => i.category === 'top')).toHaveLength(1);
    } finally {
      randomSpy.mockRestore();
    }
  });
});
