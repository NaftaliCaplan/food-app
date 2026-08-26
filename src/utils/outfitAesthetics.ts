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

// Weight-tag temperature thresholds. Deliberately soft (a scoring penalty,
// never an exclusion) — weight-tag accuracy hasn't been verified at scale,
// and hard-excluding on it before caused real problems elsewhere (ADR 0014).
// A wrongly-tagged item can lose the ranking here, but can never become
// unselectable.
const HOT_THRESHOLD_F = 75;
const COLD_THRESHOLD_F = 45;

// A small bonus for a genuinely clash-free layered look (two tops, whole
// outfit otherwise penalty-free). Necessary because this score is otherwise
// pure-penalty: adding any second item can only tie or add risk, never win
// outright, which would make layering a strictly dominated choice against
// wearing the single best top alone — never selected even when it's a
// perfectly good look. Deliberately small: any real clash anywhere in the
// outfit still outweighs it.
const LAYERING_BONUS = 0.5;

// Lower is better; 0 means no detected issues. This ranks already-valid
// candidate outfits against each other (see ADR 0016) — it never excludes an
// item, only helps choose between finished options. Deliberately limited to
// color, pattern, and (optionally) temperature-vs-weight-tag, which have
// well-established or directly-measurable bases; fit/silhouette balance was
// considered and dropped — "loose top with fitted bottom is always good" and
// "two loose pieces is sloppy" aren't reliable enough rules to encode.
export function scoreOutfitAesthetics(items: WardrobeItem[], temperatureF?: number): number {
  const colors = new Set<string>();
  let busyPatternCount = 0;
  let weightMismatchCount = 0;

  for (const item of items) {
    for (const rawTag of item.tags) {
      const tag = rawTag.toLowerCase();
      if (ACCENT_COLORS.has(tag)) colors.add(tag);
      if (BUSY_PATTERNS.has(tag)) busyPatternCount += 1;

      if (temperatureF === undefined) continue;
      if (tag === 'heavyweight' && temperatureF > HOT_THRESHOLD_F) weightMismatchCount += 1;
      if (tag === 'lightweight' && temperatureF < COLD_THRESHOLD_F) weightMismatchCount += 1;
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

  // A heavyweight piece in the heat, or a lightweight piece in the cold.
  penalty += weightMismatchCount;

  // Reward layering only when it's otherwise clean AND at least one of the
  // two tops is manually tagged 'outerwear' — two flat base-layer tees with
  // no color clash between them still isn't a real layered look. 'outerwear'
  // is user-set only (never AI-suggested, see tagVocabulary.ts), so this
  // never depends on AI judgment the way the color/pattern rules' underlying
  // tags do.
  const tops = items.filter(i => i.category === 'top');
  const hasOuterwear = tops.some(i => i.tags.some(t => t.toLowerCase() === 'outerwear'));
  if (tops.length === 2 && penalty === 0 && hasOuterwear) penalty -= LAYERING_BONUS;

  return penalty;
}
