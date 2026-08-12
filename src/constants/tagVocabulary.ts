import { ItemCategory } from '../types/wardrobe';

// Curated tag options for the picker in WardrobeItemForm. Mirrors the
// vocabulary tagService.ts's AI prompt uses, so tags a user picks by hand
// line up with the same words the AI would have generated.
export const COLOR_TAGS = [
  'black', 'white', 'gray', 'navy', 'blue', 'green', 'olive',
  'brown', 'tan', 'khaki', 'red', 'burgundy', 'pink', 'purple', 'yellow', 'orange',
];

export const PATTERN_TAGS = ['solid', 'striped', 'plaid', 'checked', 'floral', 'textured', 'graphic'];

export const BRIGHTNESS_TAGS = ['light', 'dark', 'vivid', 'muted'];

// Secondary attribute group depends on category, same split as the AI prompt:
// fit/weight only makes sense for top/bottom, shoes/accessories get
// material-type words instead.
export function secondaryTagGroup(category: ItemCategory): { label: string; tags: string[] } {
  if (category === 'top' || category === 'bottom') {
    return { label: 'FIT', tags: ['fitted', 'loose', 'lightweight', 'heavyweight'] };
  }
  if (category === 'shoes') {
    return { label: 'MATERIAL/TYPE', tags: ['canvas', 'leather', 'suede', 'athletic', 'slip-on', 'lace-up'] };
  }
  return { label: 'MATERIAL', tags: ['leather', 'metal', 'fabric', 'knit', 'woven'] };
}
