// Batch-tests wardrobe item tagging against every photo in
// photos/wardrobe/<category>/, reusing the real prompt-building and
// response-parsing code from src/services/tagAnalysis.ts (via the shared
// buildTestWardrobe() helper, also used by run-outfit.ts). See
// testing/README.md for setup.
//
// Organize photos by the category you'd select before taking the photo in
// the real app: photos/wardrobe/top/, .../bottom/, .../shoes/,
// .../accessory/ — this mirrors tagClothingItem(photoUri, category)'s own
// signature, and lets you see how often the AI's independent category guess
// (detectedCategory) disagrees with what you "selected."
import './lib/config';
import { join } from 'node:path';
import { buildTestWardrobe, WARDROBE_CATEGORIES } from './lib/buildWardrobe';
import { writeReport } from './lib/report';

const PHOTOS_DIR = join(__dirname, 'photos', 'wardrobe');

async function main() {
  console.log(`Using model: ${process.env.TEST_MODEL_OVERRIDE ?? '(default)'}\n`);
  const tagged = await buildTestWardrobe(PHOTOS_DIR);

  if (tagged.length === 0) {
    console.log(`No photos found under ${PHOTOS_DIR}/<top|bottom|shoes|accessory>/ — add some (see testing/README.md).`);
    return;
  }

  for (const folderCategory of WARDROBE_CATEGORIES) {
    const inCategory = tagged.filter(t => t.folderCategory === folderCategory);
    if (inCategory.length === 0) continue;

    console.log(`\n-- ${folderCategory} (${inCategory.length} photo${inCategory.length === 1 ? '' : 's'}) --`);
    for (const t of inCategory) {
      if (t.error) {
        console.log(`${t.file}... ERROR: ${t.error}`);
        continue;
      }
      const result = t.tagResult!;
      const categoryNote = result.detectedCategory && result.detectedCategory !== folderCategory
        ? ` [AI guessed ${result.detectedCategory} instead]`
        : '';
      const clothingNote = result.isClothing ? '' : ' [NOT flagged as clothing]';
      console.log(`${t.file}... "${result.name}" — tags: [${result.tags.join(', ')}]${categoryNote}${clothingNote}`);
    }
  }

  const results = tagged.map(t => ({
    file: t.file,
    category: t.folderCategory,
    result: t.tagResult ?? undefined,
    error: t.error ?? undefined,
  }));
  const path = writeReport('wardrobe', results);
  console.log(`\nReport written to ${path}`);
}

main();
