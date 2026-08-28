import { OutfitSuggestion, StylePreference, UserProfile, WardrobeItem } from '../types/wardrobe';
import { selectBestOutfit } from '../utils/outfitCandidates';
import { buildRecommendation } from '../utils/outfitRecommendation';

// Style prefs use underscores ('smart_casual') but the tagger emits hyphens
// ('smart-casual'), so we normalise separators and case before comparing —
// otherwise multi-word styles would never match their tags.
function normalizeStyle(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, '');
}

// Pre-filter: only consider items whose tags overlap with the requested
// style prefs. Casual-tagged items always pass through as a universal
// fallback base regardless of the requested style — a deliberate design
// choice (ADR 0009), and the actual explanation for the "crocs showing up in
// a smart-casual outfit" complaint (crocs tagged 'casual' pass through
// unconditionally). Eligibility is intentionally unchanged here — casual
// still needs to be a real fallback for a small wardrobe — but
// scoreOutfitAesthetics now penalizes a style mismatch (see ADR 0017), so a
// casual item only wins when nothing genuinely matching is available.
//
// Accessories normally complement any style and pass through unconditionally.
// When includeAccessories is false, the user has asked for an outfit without
// accessories, so we drop the whole category before generation ever sees it.
function filterByStyle(
  items: WardrobeItem[],
  prefs: StylePreference[],
  includeAccessories: boolean,
): WardrobeItem[] {
  const prefSet = new Set(prefs.map(normalizeStyle));
  return items.filter(item => {
    if (item.category === 'accessory') return includeAccessories;
    return item.tags.some(t => {
      const n = normalizeStyle(t);
      return prefSet.has(n) || n === 'casual';
    });
  });
}

export interface GenerateOutfitOptions {
  wardrobe: WardrobeItem[];
  stylePrefs: StylePreference[];
  // Each inner array is a previously rejected combination's item IDs. Never
  // reused verbatim, though see useOutfitGenerator.ts for how long a
  // rejection is actually remembered.
  rejectedIdSets?: string[][];
  // Accepted for forward-compatibility but currently unused. Outfit
  // selection is fully deterministic now and has no code-level equivalent
  // yet for body-type/proportion personalization — deliberately deferred,
  // see ADR 0016.
  profile?: UserProfile | null;
  // When false, accessory-category items are excluded from the candidate pool.
  includeAccessories?: boolean;
  // Current temperature in Fahrenheit, if the user set one. A soft scoring
  // input (see scoreOutfitAesthetics) — items are never excluded on it.
  temperatureF?: number;
}

// Fully deterministic: filters the wardrobe down to style- and
// laundry-eligible items, then hands off to selectBestOutfit (which
// enumerates every valid combination and scores them) and buildRecommendation
// (a templated tip built only from the final chosen items). There's no AI
// call anywhere in this path anymore — see ADR 0016 for why, and for what
// this replaced.
export function generateOutfit(options: GenerateOutfitOptions): OutfitSuggestion {
  const { wardrobe, stylePrefs, rejectedIdSets = [], includeAccessories = true, temperatureF } = options;

  // Items in the laundry are unavailable to wear, full stop.
  const available = wardrobe.filter(item => !item.inLaundry);
  const filtered = filterByStyle(available, stylePrefs, includeAccessories);

  if (filtered.length < 2) {
    throw new Error(
      'Not enough wardrobe items match the selected style. Add more items or choose a broader style.',
    );
  }

  const items = selectBestOutfit({
    pool: filtered,
    includeAccessories,
    temperatureF,
    stylePrefs,
    rejectedIdSets,
  });

  if (!items) {
    throw new Error(
      'No wearable top, bottom, or shoes match the selected style. Add more items or choose a broader style.',
    );
  }

  return {
    items,
    recommendation: buildRecommendation(items, temperatureF),
  };
}
