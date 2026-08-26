import { scoreOutfitAesthetics } from './outfitAesthetics';
import { ItemCategory, WardrobeItem } from '../types/wardrobe';

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
// accessories tie or improve the current score. Deliberately uncapped — a
// wardrobe with several genuinely non-clashing accessories can end up
// wearing all of them, matching the original "as many as actually make
// sense, don't force it, but don't artificially cap it either" intent. An
// accessory is only ever added because it doesn't hurt the look — never to
// satisfy an "include one" requirement, a deliberate change from the old
// AI-era "accessory required-if-available" policy (see ADR 0016).
function addAccessoriesGreedily(
  base: WardrobeItem[],
  accessories: WardrobeItem[],
  temperatureF: number | undefined,
): WardrobeItem[] {
  const current = [...base];
  let currentScore = scoreOutfitAesthetics(current, temperatureF);
  const remaining = new Set(accessories);

  while (remaining.size > 0) {
    let best: WardrobeItem | null = null;
    let bestScore = Infinity;

    for (const accessory of remaining) {
      const trialScore = scoreOutfitAesthetics([...current, accessory], temperatureF);
      if (trialScore < bestScore) {
        bestScore = trialScore;
        best = accessory;
      }
    }

    if (best === null || bestScore > currentScore) break; // every remaining option would make it worse
    current.push(best);
    remaining.delete(best);
    currentScore = bestScore;
  }

  return current;
}

function idsKey(items: WardrobeItem[]): string {
  return items.map(i => i.id).sort().join(',');
}

export interface SelectOutfitOptions {
  // Already style-filtered and laundry-excluded — this function is agnostic
  // to why an item is or isn't in the pool.
  pool: WardrobeItem[];
  includeAccessories: boolean;
  temperatureF?: number;
  rejectedIdSets: string[][];
}

// Enumerates every valid outfit combination from the pool and returns the
// single best-scoring one. "Valid" means: at most one bottom, at most one
// pair of shoes, one top or a layered pair of two tops — each present only
// if the pool actually has one. Falls back to ignoring rejectedIdSets if
// honoring them would leave zero candidates, since a very small wardrobe can
// otherwise get permanently stuck once its one good combination is rejected.
// Returns null only if the pool has nothing to build even a single
// top/bottom/shoes combination from at all.
export function selectBestOutfit(options: SelectOutfitOptions): WardrobeItem[] | null {
  const { pool, includeAccessories, temperatureF, rejectedIdSets } = options;

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
    accessories.length > 0 ? addAccessoriesGreedily(base, accessories, temperatureF) : base,
  );

  const scored = fullCandidates.map(items => ({
    items,
    score: scoreOutfitAesthetics(items, temperatureF),
    key: idsKey(items),
  }));

  const rejectedKeys = new Set(rejectedIdSets.map(ids => [...ids].sort().join(',')));
  const nonRejected = scored.filter(c => !rejectedKeys.has(c.key));
  const candidates = nonRejected.length > 0 ? nonRejected : scored;

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0].items;
}
