import { StylePreference } from '../types/wardrobe';

// 'sleepwear' and 'beachwear' are occasion categories, not everyday styles —
// see the StylePreference comment in types/wardrobe.ts for why they live in
// the same list anyway (ADR 0018).
export const STYLE_KEYS: StylePreference[] = [
  'casual', 'smart_casual', 'formal', 'sporty', 'sleepwear', 'beachwear',
];

export const STYLE_LABELS: Record<StylePreference, string> = {
  casual: 'Casual',
  smart_casual: 'Smart Casual',
  formal: 'Formal',
  sporty: 'Sporty',
  sleepwear: 'Sleepwear',
  beachwear: 'Beachwear',
};

export function normalizeStyle(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, '');
}

export function isStyleWord(tag: string): boolean {
  const n = normalizeStyle(tag);
  return STYLE_KEYS.some(k => normalizeStyle(k) === n);
}

// Every style tag present in a tags array, in the order they appear. An item
// can legitimately carry more than one (ADR 0018) — a plain t-shirt can be
// both 'casual' and 'beachwear' — so this returns an array, not a single
// value like the old (deleted) extractStyle did.
export function extractStyles(tags: string[]): StylePreference[] {
  const found: StylePreference[] = [];
  for (const tag of tags) {
    const match = STYLE_KEYS.find(k => normalizeStyle(k) === normalizeStyle(tag));
    if (match && !found.includes(match)) found.push(match);
  }
  return found;
}
