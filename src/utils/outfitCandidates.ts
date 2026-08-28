import { scoreOutfitAesthetics } from './outfitAesthetics';
import { ACCESSORY_TYPE_TAGS } from '../constants/tagVocabulary';
import { ItemCategory, StylePreference, WardrobeItem } from '../types/wardrobe';

const ACCESSORY_TYPES = new Set(ACCESSORY_TYPE_TAGS);

// The manually-set type tag an accessory carries (hat/belt/bag/etc.), or
// undefined if it has none. Accessories with no type tag are treated as
// slot-less and never conflict with anything — this is what keeps existing,
// not-yet-retagged wardrobes behaving exactly as before this existed.
function accessoryType(item: WardrobeItem): string | undefined {
  return item.tags.map(t => t.toLowerCase()).find(t => ACCESSORY_TYPES.has(t));
}

// Every one-item and (for tops only) two-item combination from a category's
// pool, or a single "nothing" placeholder if the pool is empty. This is what
// makes "include one whenever the pool has one, never force one that
// doesn't exist" automatic: a non-empty pool never produces an empty
// variant, so every resulting candidate is guaranteed complete by
// construction — never validated or retried after the fact.
function slotVariants(pool: WardrobeItem[], allowPair: boolean): WardrobeItem[][] {
  if (pool.length === 0) return [[]];
  const variants: WardrobeItem[][] = pool.map(item => [item]);
  if (allowPair) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        variants.push([pool[i], pool[j]]);
      }
    }
  }
  return variants;
}

function cartesianCombine(a: WardrobeItem[][], b: WardrobeItem[][]): WardrobeItem[][] {
  const result: WardrobeItem[][] = [];
  for (const itemsA of a) {
    for (const itemsB of b) {
      result.push([...itemsA, ...itemsB]);
    }
  }
  return result;
}

// Adds accessories one at a time, each round picking whichever remaining
// accessory results in the best score, stopping once none of the remaining
// accessories tie or improve the current score. Deliberately uncapped in
// total count — a wardrobe with several genuinely non-clashing accessories
// can end up wearing all of them, matching the original "as many as actually
// make sense, don't force it, but don't artificially cap it either" intent.
// It IS capped per accessory type (at most one hat, one belt, etc. — see
// accessoryType above) since two of the same slot is never actually
// wearable, unlike "a hat AND a belt AND a watch." An accessory is only ever
// added because it doesn't hurt the look — never to satisfy an "include one"
// requirement, a deliberate change from the old AI-era "accessory
// required-if-available" policy (see ADR 0016).
function addAccessoriesGreedily(
  base: WardrobeItem[],
  accessories: WardrobeItem[],
  temperatureF: number | undefined,
  stylePrefs: StylePreference[] | undefined,
): WardrobeItem[] {
  const current = [...base];
  let currentScore = scoreOutfitAesthetics(current, temperatureF, stylePrefs);
  const remaining = new Set(accessories);
  const usedTypes = new Set<string>();

  while (remaining.size > 0) {
    let best: WardrobeItem | null = null;
    let bestScore = Infinity;

    for (const accessory of remaining) {
      const type = accessoryType(accessory);
      if (type && usedTypes.has(type)) continue; // slot already filled — e.g. a second hat

      const trialScore = scoreOutfitAesthetics([...current, accessory], temperatureF, stylePrefs);
      if (trialScore < bestScore) {
        bestScore = trialScore;
        best = accessory;
      }
    }

    if (best === null || bestScore > currentScore) break; // every remaining option would make it worse
    current.push(best);
    remaining.delete(best);
    const bestType = accessoryType(best);
    if (bestType) usedTypes.add(bestType);
    currentScore = bestScore;
  }

  return current;
}

function idsKey(items: WardrobeItem[]): string {
  return items.map(i => i.id).sort().join(',');
}

export interface SelectOutfitOptions {
  // Already style-filtered and laundry-excluded — this function is agnostic
  // to why an item is or isn't in the pool. stylePrefs is passed through
  // separately purely for scoring (see scoreOutfitAesthetics's style-match
  // penalty) — it doesn't affect which items are even in the pool.
  pool: WardrobeItem[];
  includeAccessories: boolean;
  temperatureF?: number;
  stylePrefs?: StylePreference[];
  rejectedIdSets: string[][];
}

// Enumerates every valid outfit combination from the pool and returns the
// best-scoring one. "Valid" means: at most one bottom, at most one pair of
// shoes, one top or a layered pair of two tops — each present only if the
// pool actually has one. Falls back to ignoring rejectedIdSets if honoring
// them would leave zero candidates, since a very small wardrobe can
// otherwise get permanently stuck once its one good combination is
// rejected. Ties are broken first by fewest total items (so an equally-good
// 2-top pairing never edges out a simpler single-top option), then
// genuinely at random — not by array/scan order, which used to make the
// same non-top items win every single time regardless of what a retry
// changed, since ties are common with a narrow rule set (see ADR 0017).
// Returns null only if the pool has nothing to build even a single
// top/bottom/shoes combination from at all.
export function selectBestOutfit(options: SelectOutfitOptions): WardrobeItem[] | null {
  const { pool, includeAccessories, temperatureF, stylePrefs, rejectedIdSets } = options;

  const byCategory = new Map<ItemCategory, WardrobeItem[]>();
  for (const item of pool) {
    const group = byCategory.get(item.category) ?? [];
    group.push(item);
    byCategory.set(item.category, group);
  }

  const bottomVariants = slotVariants(byCategory.get('bottom') ?? [], false);
  const shoeVariants = slotVariants(byCategory.get('shoes') ?? [], false);
  const topVariants = slotVariants(byCategory.get('top') ?? [], true);
  const accessories = includeAccessories ? byCategory.get('accessory') ?? [] : [];

  const baseCandidates = cartesianCombine(
    cartesianCombine(bottomVariants, shoeVariants),
    topVariants,
  ).filter(combo => combo.length > 0);

  if (baseCandidates.length === 0) return null;

  const fullCandidates = baseCandidates.map(base =>
    accessories.length > 0 ? addAccessoriesGreedily(base, accessories, temperatureF, stylePrefs) : base,
  );

  const scored = fullCandidates.map(items => ({
    items,
    score: scoreOutfitAesthetics(items, temperatureF, stylePrefs),
    key: idsKey(items),
  }));

  const rejectedKeys = new Set(rejectedIdSets.map(ids => [...ids].sort().join(',')));
  const nonRejected = scored.filter(c => !rejectedKeys.has(c.key));
  const candidates = nonRejected.length > 0 ? nonRejected : scored;

  const bestScore = Math.min(...candidates.map(c => c.score));
  const bestByScore = candidates.filter(c => c.score === bestScore);

  const fewestItems = Math.min(...bestByScore.map(c => c.items.length));
  const finalists = bestByScore.filter(c => c.items.length === fewestItems);

  return finalists[Math.floor(Math.random() * finalists.length)].items;
}
