import { COLOR_TAGS } from '../constants/tagVocabulary';
import { WardrobeItem } from '../types/wardrobe';

// Colors that read as neutral in outfit pairing — they pair safely with
// anything, including each other, so they never count toward the
// "too many accent colors" penalty below.
const NEUTRAL_COLORS = new Set(['black', 'white', 'gray', 'navy', 'tan', 'khaki', 'brown']);

const ACCENT_COLORS = new Set(COLOR_TAGS.filter(c => !NEUTRAL_COLORS.has(c)));

// Specific accent-color pairs that clash by common styling convention — not
// pure color-wheel complementary theory, which doesn't map cleanly to
// clothing (red+green is complementary but reads as a clash, not a match).
const CLASHING_COLOR_PAIRS: [string, string][] = [
  ['red', 'green'],
  ['red', 'orange'],
  ['red', 'pink'],
  ['orange', 'purple'],
  ['orange', 'pink'],
  ['yellow', 'purple'],
];

function hasClashingPair(colors: Set<string>): boolean {
  return CLASHING_COLOR_PAIRS.some(([a, b]) => colors.has(a) && colors.has(b));
}

// Patterns that visually compete for attention — mixing two of these in one
// outfit is the classic "don't mix patterns" mistake. 'solid' and 'textured'
// are deliberately excluded: solids pair with anything, and texture (e.g.
// corduroy, waffle knit) isn't a visual pattern in the clash sense.
const BUSY_PATTERNS = new Set(['striped', 'plaid', 'checked', 'floral', 'graphic']);

// Lower is better; 0 means no detected issues. This is a heuristic used to
// rank several already-complete, AI-generated candidate outfits against each
// other — it never excludes an item or blocks generation, only helps choose
// between finished options (see ADR 0015). Deliberately limited to color and
// pattern, which have well-established pairing conventions; fit/silhouette
// balance was considered and dropped — "loose top with fitted bottom is
// always good" and "two loose pieces is sloppy" aren't reliable enough rules
// to encode as a penalty.
export function scoreOutfitAesthetics(items: WardrobeItem[]): number {
  const colors = new Set<string>();
  let busyPatternCount = 0;

  for (const item of items) {
    for (const rawTag of item.tags) {
      const tag = rawTag.toLowerCase();
      if (ACCENT_COLORS.has(tag)) colors.add(tag);
      if (BUSY_PATTERNS.has(tag)) busyPatternCount += 1;
    }
  }

  let penalty = 0;

  // More than one accent color starts to compete for attention — the classic
  // "one accent color, let neutrals do the rest" guideline.
  if (colors.size > 1) penalty += colors.size - 1;

  // A specific known-clashing pair is worse than just "too many accents."
  if (hasClashingPair(colors)) penalty += 2;

  // Two or more busy patterns in one outfit is the classic pattern-mixing mistake.
  if (busyPatternCount > 1) penalty += 2;

  return penalty;
}
