// Batch-tests outfit generation against the real wardrobe photos in
// photos/wardrobe/<category>/ — tags them fresh via the same pipeline as
// run-wardrobe.ts (shared buildTestWardrobe() helper), then runs the real,
// fully-deterministic generateOutfit() (src/services/outfitService.ts)
// across every everyday style x with/without-accessories combination.
//
// Unlike the other 3 scripts, outfit generation itself makes no AI/network
// call at all (see ADR 0016) — only the tagging step above does. generateOutfit
// is imported completely unmodified; no service split was needed for this one.
import './lib/config';
import { join } from 'node:path';
import { buildTestWardrobe } from './lib/buildWardrobe';
import { writeReport } from './lib/report';
import { generateOutfit } from '../src/services/outfitService';
import { StylePreference, WardrobeItem } from '../src/types/wardrobe';

const PHOTOS_DIR = join(__dirname, 'photos', 'wardrobe');
// The "everyday" styles (see WardrobeItem's own StylePreference comment) —
// sleepwear/beachwear are "occasion" categories deliberately excluded from
// the casual-passthrough fallback, so they're left out of this general sweep
// rather than implying they're equally expected to always produce a result.
const STYLES: StylePreference[] = ['casual', 'smart_casual', 'formal', 'sporty'];

async function main() {
  console.log(`Tagging wardrobe photos under ${PHOTOS_DIR}...\n`);
  const tagged = await buildTestWardrobe(PHOTOS_DIR);
  const wardrobe: WardrobeItem[] = tagged.flatMap(t => t.item ? [t.item] : []);
  const skipped = tagged.filter(t => t.error || (t.tagResult && !t.tagResult.isClothing));

  if (wardrobe.length === 0) {
    console.log(`No taggable clothing photos found under ${PHOTOS_DIR}/<top|bottom|shoes|accessory>/ — add some (see testing/README.md).`);
    return;
  }

  console.log(`Tagged ${wardrobe.length} wardrobe item(s)${skipped.length > 0 ? ` (${skipped.length} skipped — not flagged as clothing, or a tagging error)` : ''}.\n`);
  console.log('Generating outfits...\n');

  const results: unknown[] = [];

  for (const style of STYLES) {
    for (const includeAccessories of [true, false]) {
      const label = `${style}${includeAccessories ? '' : ' (no accessories)'}`;
      process.stdout.write(`${label}... `);
      try {
        const suggestion = generateOutfit({ wardrobe, stylePrefs: [style], includeAccessories });
        const itemSummary = suggestion.items
          .map(i => `${i.category}:${i.name ?? '(unnamed)'}`)
          .join(', ');
        console.log(`${suggestion.items.length} item(s) — ${itemSummary}`);
        console.log(`  tip: ${suggestion.recommendation}`);
        results.push({ style, includeAccessories, suggestion });
      } catch (e) {
        console.log(`no outfit — ${(e as Error).message}`);
        results.push({ style, includeAccessories, error: (e as Error).message });
      }
    }
  }

  const path = writeReport('outfit', results);
  console.log(`\nReport written to ${path}`);
}

main();
