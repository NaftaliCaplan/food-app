import { WardrobeItem } from '../types/wardrobe';

// Shared factory for the identical makeItem/makeWardrobeItem shape that was
// independently duplicated across outfitAesthetics.test.ts, outfitCandidates.test.ts,
// outfitService.test.ts, and outfitRecommendation.test.ts. Random ids (rather
// than a per-file nextId counter) since nothing in those suites depends on a
// specific or sequential id value, only uniqueness.
export function makeWardrobeItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: Math.random().toString(),
    photoUri: 'file://x.jpg',
    category: 'top',
    tags: [],
    addedAt: 0,
    ...overrides,
  };
}
