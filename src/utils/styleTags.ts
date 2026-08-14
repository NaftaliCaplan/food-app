import { StylePreference } from '../types/wardrobe';

export const STYLE_KEYS: StylePreference[] = ['casual', 'smart_casual', 'formal', 'sporty'];

export const STYLE_LABELS: Record<StylePreference, string> = {
  casual: 'Casual',
  smart_casual: 'Smart Casual',
  formal: 'Formal',
  sporty: 'Sporty',
};

export function normalizeStyle(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, '');
}

export function isStyleWord(tag: string): boolean {
  const n = normalizeStyle(tag);
  return STYLE_KEYS.some(k => normalizeStyle(k) === n);
}

// Finds the style currently embedded in a tags array, if any — style isn't
// its own field on WardrobeItem, it lives as one of the free-form tags.
export function extractStyle(tags: string[]): StylePreference | undefined {
  for (const tag of tags) {
    const match = STYLE_KEYS.find(k => normalizeStyle(k) === normalizeStyle(tag));
    if (match) return match;
  }
  return undefined;
}

// Replaces whatever style tag is currently in `tags` (if any) with `style`,
// or removes it entirely if `style` is undefined. Used both when the AI
// resolves a style during tagging and when a user picks one manually via
// the StylePicker — one code path, so tags can never end up with two
// contradictory style words (see ADR 0008's casual+formal regression).
export function replaceStyle(tags: string[], style: StylePreference | undefined): string[] {
  const withoutStyle = tags.filter(t => !isStyleWord(t));
  return style ? [...withoutStyle, style] : withoutStyle;
}
