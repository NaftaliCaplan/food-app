import { COLOR_TAGS } from '../constants/tagVocabulary';
import { StylePreference, UserProfile, WardrobeItem } from '../types/wardrobe';
import { extractStyles } from './styleTags';

// Colors that read as neutral in outfit pairing — they pair safely with
// anything, including each other, so they never count toward the
// "too many accent colors" penalty below.
const NEUTRAL_COLORS = new Set(['black', 'white', 'gray', 'navy', 'tan', 'khaki', 'brown']);

const ACCENT_COLORS = new Set(COLOR_TAGS.filter(c => !NEUTRAL_COLORS.has(c)));
const ALL_COLORS = new Set(COLOR_TAGS);

function itemColors(item: WardrobeItem): Set<string> {
  return new Set(item.tags.map(t => t.toLowerCase()).filter(t => ALL_COLORS.has(t)));
}

// Specific accent-color pairs that clash by common styling convention — not
// pure color-wheel complementary theory, which doesn't map cleanly to
// clothing (red+green is complementary but reads as a clash, not a match;
// theory would call that pairing maximally harmonious, which is backwards).
// This list is deliberately hand-curated taste, not derived from a formula —
// expanded on 2026-08-25 (ADR 0017 follow-up) after live testing showed the
// original 6 pairs left real, confirmed gaps (pink+green specifically).
// Popular/classic combos (red+blue, orange+blue, pink+blue, pink+purple,
// yellow+blue, blue+green) are deliberately NOT included even though some are
// bold — boldness isn't clashing.
const CLASHING_COLOR_PAIRS: [string, string][] = [
  ['red', 'green'],
  ['red', 'orange'],
  ['red', 'pink'],
  ['red', 'purple'],
  ['red', 'yellow'],
  ['orange', 'purple'],
  ['orange', 'pink'],
  ['orange', 'yellow'],
  ['orange', 'green'],
  ['yellow', 'purple'],
  ['yellow', 'pink'],
  ['pink', 'green'],
  ['purple', 'green'],
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

const LAYERING_BONUS = 0.5;

// Same weight as a color clash — `filterByStyle` still lets a 'casual'-tagged
// item through as a fallback base regardless of requested style (so a small
// wardrobe never comes up empty), but nothing used to prefer an item that
// genuinely matches the requested style over one that only qualified via
// that fallback. Without this, a neutral-colored casual item could
// out-score (or tie, and then win on stable sort order) a real smart-casual
// match on color grounds alone — this makes casual a true fallback, not a
// default, while still letting it win when nothing else is eligible at all.
const STYLE_MISMATCH_PENALTY = 2;

// Research-backed additions (ADR 0018): reward a light+dark brightness
// contrast (an all-one-brightness outfit reads as flat), penalize stacking
// multiple high-intensity ("vivid") pieces the same way multiple accent
// colors are penalized, reward the classic belt-matches-shoes convention,
// and lightly reward a loose+fitted top/bottom contrast. All four are
// deliberately soft "nudge" bonuses/penalties (same tier as the layering
// bonus), not strict rules — and none of them are gated behind "the rest of
// the outfit is also clean," specifically because that exact gating pattern
// on the layering bonus (below) was found to produce a real bug: an
// unrelated shoe issue could silently block layering regardless of how well
// the two tops paired with each other.
const BRIGHTNESS_BALANCE_BONUS = 0.5;
const VIVID_OVERLOAD_PENALTY = 1;
const BELT_SHOE_MATCH_BONUS = 0.5;
const FIT_BALANCE_BONUS = 0.5;

// Personalization round 1 (ADR pending — undertone-based color matching):
// hand-curated warm/cool "flattering" accent-color splits, same idea as
// CLASHING_COLOR_PAIRS above but for personal color matching instead of
// general color-pairing convention. Only covers ACCENT_COLORS — neutrals are
// already treated as universally safe for everyone, so there's nothing to
// personalize there. Deliberately bonus-only, never a penalty: rewarding a
// flattering color already in the wardrobe is a much lighter claim than
// telling someone an existing item is unflattering for their skin tone, and
// the user explicitly chose to keep it that way. 'neutral' undertone (or no
// profile/undertone at all) gets no adjustment either direction.
const WARM_FLATTERING_COLORS = new Set(['olive', 'orange', 'yellow', 'red', 'burgundy']);
const COOL_FLATTERING_COLORS = new Set(['blue', 'purple', 'pink', 'green']);
const UNDERTONE_COLOR_BONUS = 0.5;

// The whole-outfit rules only — color, pattern, weight-vs-temperature, and
// style match. Deliberately excludes every bonus below: this is reused as an
// *isolated* score for just the two tops when checking whether a layered
// pairing is clean on its own (see the layering bonus), so it must never
// itself depend on anything outside whatever `items` it's given, or on the
// bonuses that call it.
function baseScore(
  items: WardrobeItem[],
  temperatureF?: number,
  stylePrefs?: StylePreference[],
): number {
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

  // Every item whose styles share none with any requested style — including
  // 'casual'-only ones, which are only an *eligible fallback*, not
  // automatically preferred. An item with multiple style tags (ADR 0018 — a
  // t-shirt can be both casual and beachwear) only avoids the penalty if AT
  // LEAST ONE of its styles matches; no penalty at all if no style was
  // requested (in which case filterByStyle only lets casual items through
  // anyway, so penalizing them would be counterproductive — they'd be the
  // only options).
  if (stylePrefs && stylePrefs.length > 0) {
    for (const item of items) {
      const itemStyles = extractStyles(item.tags);
      const matchesAny = itemStyles.some(s => stylePrefs.includes(s));
      if (itemStyles.length > 0 && !matchesAny) {
        penalty += STYLE_MISMATCH_PENALTY;
      }
    }
  }

  return penalty;
}

// Lower is better; 0 means no detected issues, though several combined
// bonuses can push the result below 0 — it's only ever used for relative
// ranking between candidates, never compared to an absolute threshold. This
// ranks already-valid candidate outfits against each other (see ADR 0016) —
// it never excludes an item, only helps choose between finished options.
export function scoreOutfitAesthetics(
  items: WardrobeItem[],
  temperatureF?: number,
  stylePrefs?: StylePreference[],
  undertone?: UserProfile['undertone'],
): number {
  let penalty = baseScore(items, temperatureF, stylePrefs);

  let hasLight = false;
  let hasDark = false;
  let vividCount = 0;
  for (const item of items) {
    for (const rawTag of item.tags) {
      const tag = rawTag.toLowerCase();
      if (tag === 'light') hasLight = true;
      if (tag === 'dark') hasDark = true;
      if (tag === 'vivid') vividCount += 1;
    }
  }

  // Reward a light+dark brightness contrast — an outfit where everything
  // sits at the same brightness level can read as flat. Rewarding the
  // presence of both rather than penalizing its absence means a wardrobe
  // without much brightness-tagged data isn't punished for missing data.
  if (hasLight && hasDark) penalty -= BRIGHTNESS_BALANCE_BONUS;

  // Too many high-intensity pieces compete for attention the same way too
  // many accent colors do — one vivid piece as a deliberate pop is fine,
  // several together isn't.
  if (vividCount > 1) penalty += VIVID_OVERLOAD_PENALTY;

  // The classic "match your belt to your shoes" convention. Unconditional on
  // anything else in the outfit — deliberately not gated behind the rest of
  // the outfit being clean, same reasoning as the layering bonus below.
  const belt = items.find(i => i.category === 'accessory' && i.tags.some(t => t.toLowerCase() === 'belt'));
  const shoes = items.find(i => i.category === 'shoes');
  if (belt && shoes) {
    const beltColors = itemColors(belt);
    const shoeColors = itemColors(shoes);
    const sharesColor = [...beltColors].some(c => shoeColors.has(c));
    if (sharesColor) penalty -= BELT_SHOE_MATCH_BONUS;
  }

  // A loose top with a fitted bottom (or vice versa) is a classic balance
  // principle — but this is deliberately a light reward for the contrast
  // case only, not a penalty for two loose or two fitted pieces (ADR 0015
  // already found "two loose pieces is sloppy" too strong a claim to encode).
  const top = items.find(i => i.category === 'top');
  const bottom = items.find(i => i.category === 'bottom');
  if (top && bottom) {
    const topFit = top.tags.map(t => t.toLowerCase()).find(t => t === 'fitted' || t === 'loose');
    const bottomFit = bottom.tags.map(t => t.toLowerCase()).find(t => t === 'fitted' || t === 'loose');
    if (topFit && bottomFit && topFit !== bottomFit) penalty -= FIT_BALANCE_BONUS;
  }

  // Reward layering only when the two tops are clean *in isolation* (color,
  // pattern, style, and weight checked only between the two of them) AND
  // exactly one is tagged 'outerwear' — not zero (two flat base-layer tees
  // isn't a real layered look) and not two either (two outerwear pieces
  // stacked, e.g. two sweaters, still has no actual base layer underneath).
  // Deliberately isolated to just the two tops rather than gated on the
  // whole outfit's total penalty — the original "whole outfit must be
  // clean" gate was found via live testing to let an unrelated shoe issue
  // silently block layering no matter how well the two tops paired (see
  // ADR 0017/0018).
  const tops = items.filter(i => i.category === 'top');
  const outerwearCount = tops.filter(i => i.tags.some(t => t.toLowerCase() === 'outerwear')).length;
  if (tops.length === 2 && outerwearCount === 1) {
    const topPairPenalty = baseScore(tops, temperatureF, stylePrefs);
    if (topPairPenalty === 0) penalty -= LAYERING_BONUS;
  }

  // Reward an accent color that flatters the user's own undertone, when
  // profile personalization is opted into for this generation (undertone is
  // only ever passed when the caller resolved a profile — see
  // outfitService.ts). Applied once per outfit regardless of how many
  // flattering colors are present, so this can't fight against the
  // too-many-accent-colors penalty above by rewarding stacking more of them.
  if (undertone && undertone !== 'neutral') {
    const flattering = undertone === 'warm' ? WARM_FLATTERING_COLORS : COOL_FLATTERING_COLORS;
    const outfitColors = new Set(items.flatMap(item => [...itemColors(item)]));
    const hasFlatteringAccent = [...outfitColors].some(c => ACCENT_COLORS.has(c) && flattering.has(c));
    if (hasFlatteringAccent) penalty -= UNDERTONE_COLOR_BONUS;
  }

  return penalty;
}
