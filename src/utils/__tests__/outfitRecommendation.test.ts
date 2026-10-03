import { buildRecommendation } from '../outfitRecommendation';
import { makeWardrobeItem as makeItem } from '../../testUtils/makeWardrobeItem';

describe('buildRecommendation', () => {

  it('names both tops in a layering tip, with the outerwear-tagged one as the outer layer', () => {
    const inner = makeItem({ category: 'top', name: 'navy tee', tags: ['navy', 'solid'] });
    const outer = makeItem({ category: 'top', name: 'black cardigan', tags: ['black', 'solid', 'outerwear'] });
    const text = buildRecommendation([inner, outer]);
    expect(text).toContain("'black cardigan'");
    expect(text).toContain("'navy tee'");
    expect(text.indexOf('black cardigan')).toBeLessThan(text.indexOf('navy tee'));
  });

  it('gives a warm-weather note naming the heavyweight item when temperature is hot', () => {
    const top = makeItem({ category: 'top', name: 'wool sweater', tags: ['heavyweight'] });
    const bottom = makeItem({ category: 'bottom', name: 'jeans' });
    const text = buildRecommendation([top, bottom], 90);
    expect(text).toContain("'wool sweater'");
    expect(text).toContain('warm');
  });

  it('gives a cold-weather note naming the lightweight item when temperature is cold', () => {
    const top = makeItem({ category: 'top', name: 'linen shirt', tags: ['lightweight'] });
    const bottom = makeItem({ category: 'bottom', name: 'shorts' });
    const text = buildRecommendation([top, bottom], 30);
    expect(text).toContain("'linen shirt'");
    expect(text).toContain('cold');
  });

  it('does not give a weather note at a mild temperature', () => {
    const top = makeItem({ category: 'top', name: 'tee', tags: ['heavyweight'] });
    const bottom = makeItem({ category: 'bottom', name: 'jeans' });
    const text = buildRecommendation([top, bottom], 65);
    expect(text).not.toContain('warm');
    expect(text).not.toContain('cold');
  });

  it('mentions an accessory when one is present and no layering/weather condition applies', () => {
    const top = makeItem({ category: 'top', name: 'tee' });
    const bottom = makeItem({ category: 'bottom', name: 'jeans' });
    const hat = makeItem({ category: 'accessory', name: 'wool cap' });
    const text = buildRecommendation([top, bottom, hat]);
    expect(text).toContain("'wool cap'");
  });

  it('falls back to a generic tip when nothing special applies', () => {
    const top = makeItem({ category: 'top', name: 'tee' });
    const bottom = makeItem({ category: 'bottom', name: 'jeans' });
    const text = buildRecommendation([top, bottom]);
    expect(text).toBe('These pieces already work well together — wear them as-is.');
  });

  it('falls back to the item\'s category when it has no name', () => {
    const top = makeItem({ category: 'top', name: 'tee' });
    const bottom = makeItem({ category: 'bottom', name: 'jeans' });
    const unnamedAccessory = makeItem({ category: 'accessory' });
    const text = buildRecommendation([top, bottom, unnamedAccessory]);
    expect(text).toBe("Finish the look with the 'accessory'.");
  });
});
