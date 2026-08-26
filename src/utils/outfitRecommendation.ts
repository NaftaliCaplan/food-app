import { WardrobeItem } from '../types/wardrobe';

const HOT_THRESHOLD_F = 75;
const COLD_THRESHOLD_F = 45;

function displayName(item: WardrobeItem): string {
  return item.name ?? item.category;
}

// Ordered rule list, first match wins. Every branch only ever references
// attributes of the actual final items — there's no free-form generation
// here, so there's no way for this to describe a color or item that isn't
// really in the outfit, which was the recurring bug class the old AI-written
// tips kept hitting (see ADR 0016). Necessarily less "insightful" than free
// prose, but always accurate.
export function buildRecommendation(items: WardrobeItem[], temperatureF?: number): string {
  const tops = items.filter(i => i.category === 'top');

  if (tops.length === 2) {
    const outer = tops.find(t => t.tags.some(tag => tag.toLowerCase() === 'outerwear')) ?? tops[1];
    const inner = tops.find(t => t.id !== outer.id) ?? tops[0];
    return `Leave the '${displayName(outer)}' open over the '${displayName(inner)}' for a layered look.`;
  }

  if (temperatureF !== undefined) {
    const heavyweightItem = items.find(
      i =>
        (i.category === 'top' || i.category === 'bottom') &&
        i.tags.some(t => t.toLowerCase() === 'heavyweight') &&
        temperatureF > HOT_THRESHOLD_F,
    );
    if (heavyweightItem) {
      return `It's warm out — consider rolling up the sleeves on the '${displayName(heavyweightItem)}'.`;
    }

    const lightweightItem = items.find(
      i =>
        (i.category === 'top' || i.category === 'bottom') &&
        i.tags.some(t => t.toLowerCase() === 'lightweight') &&
        temperatureF < COLD_THRESHOLD_F,
    );
    if (lightweightItem) {
      return `It's cold out — the '${displayName(lightweightItem)}' alone may not be enough, consider layering up.`;
    }
  }

  const accessories = items.filter(i => i.category === 'accessory');
  if (accessories.length > 0) {
    return `Finish the look with the '${displayName(accessories[0])}'.`;
  }

  return 'These pieces already work well together — wear them as-is.';
}
