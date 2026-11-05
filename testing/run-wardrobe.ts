// Batch-tests wardrobe item tagging against every photo in
// photos/wardrobe/<category>/, reusing the real prompt-building and
// response-parsing code from src/services/tagService.ts. See
// testing/README.md for setup.
//
// Organize photos by the category you'd select before taking the photo in
// the real app: photos/wardrobe/top/, .../bottom/, .../shoes/,
// .../accessory/ — this mirrors tagClothingItem(photoUri, category)'s own
// signature, and lets you see how often the AI's independent category guess
// (detectedCategory) disagrees with what you "selected."
import './lib/config';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { photoToBase64 } from './lib/readPhoto';
import { writeReport } from './lib/report';
import { callCloudflareVision } from '../src/services/visionClient';
import { buildTagPrompt, parseTagResponse } from '../src/services/tagAnalysis';
import { ItemCategory } from '../src/types/wardrobe';

const PHOTOS_DIR = join(__dirname, 'photos', 'wardrobe');
const IMAGE_PATTERN = /\.(jpe?g|png|webp)$/i;
const CATEGORIES: ItemCategory[] = ['top', 'bottom', 'shoes', 'accessory'];

async function main() {
  const results: unknown[] = [];
  let totalFiles = 0;

  for (const category of CATEGORIES) {
    const dir = join(PHOTOS_DIR, category);
    let files: string[];
    try {
      files = readdirSync(dir).filter(f => IMAGE_PATTERN.test(f));
    } catch {
      continue;
    }
    if (files.length === 0) continue;

    console.log(`\n-- ${category} (${files.length} photo${files.length === 1 ? '' : 's'}) --`);
    for (const file of files) {
      totalFiles += 1;
      process.stdout.write(`${file}... `);
      try {
        const { base64, mimeType } = photoToBase64(join(dir, file));
        const raw = await callCloudflareVision(base64, buildTagPrompt(category), 400, mimeType);
        const result = parseTagResponse(raw, category);
        const categoryNote = result.detectedCategory && result.detectedCategory !== category
          ? ` [AI guessed ${result.detectedCategory} instead]`
          : '';
        console.log(`"${result.name}" — tags: [${result.tags.join(', ')}]${categoryNote}`);
        results.push({ file, category, result });
      } catch (e) {
        console.log(`ERROR: ${(e as Error).message}`);
        results.push({ file, category, error: (e as Error).message });
      }
    }
  }

  if (totalFiles === 0) {
    console.log(`No photos found under ${PHOTOS_DIR}/<top|bottom|shoes|accessory>/ — add some (see testing/README.md).`);
    return;
  }

  const path = writeReport('wardrobe', results);
  console.log(`\nReport written to ${path}`);
}

main();
