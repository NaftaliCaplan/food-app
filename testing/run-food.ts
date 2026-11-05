// Batch-tests the food checker against every photo in photos/food/, reusing
// the real prompt-building and response-parsing code from src/services/ — the
// only thing not real-app code is how the photo gets read off disk (Node fs
// here, expo-file-system in the app). See testing/README.md for setup.
//
// Label per photo is derived from the filename: strip the extension and any
// trailing _NN/-NN counter, replace remaining _/- with spaces. E.g.
// "banana_01.jpg" -> "banana", "green-tomato-3.png" -> "green tomato".
import './lib/config';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { photoToBase64 } from './lib/readPhoto';
import { writeReport } from './lib/report';
import { callCloudflareVision } from '../src/services/visionClient';
import { buildPrompt, parseAnalyzeFoodResponse } from '../src/services/foodAnalysis';

const PHOTOS_DIR = join(__dirname, 'photos', 'food');
const IMAGE_PATTERN = /\.(jpe?g|png|webp)$/i;

function labelFromFilename(filename: string): string {
  return filename
    .replace(IMAGE_PATTERN, '')
    .replace(/[_-]?\d+$/, '')
    .replace(/[_-]/g, ' ')
    .trim();
}

async function main() {
  let files: string[];
  try {
    files = readdirSync(PHOTOS_DIR).filter(f => IMAGE_PATTERN.test(f));
  } catch {
    console.log(`No photos directory found at ${PHOTOS_DIR} — create it and add some test photos (see testing/README.md).`);
    return;
  }
  if (files.length === 0) {
    console.log(`No photos found in ${PHOTOS_DIR} — add some, named like "banana_01.jpg" (label is derived from the filename).`);
    return;
  }

  console.log(`Running ${files.length} photo(s) through the food checker...\n`);
  const results: unknown[] = [];

  for (const file of files) {
    const label = labelFromFilename(file);
    process.stdout.write(`${file} (label: "${label}")... `);
    try {
      const { base64, size, mimeType } = photoToBase64(join(PHOTOS_DIR, file));
      const raw = await callCloudflareVision(base64, buildPrompt(label), 512, mimeType);
      const result = parseAnalyzeFoodResponse(raw, size, label);
      const observedDisplay = result.observedFood ?? '(not provided — response fell back to string parsing)';
      const matchDisplay = result.labelMatch === undefined ? 'n/a' : result.labelMatch;
      console.log(`${result.stateLabel} (${result.confidencePercent}%) — observed: "${observedDisplay}", labelMatch: ${matchDisplay}`);
      results.push({ file, label, result });
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
      results.push({ file, label, error: (e as Error).message });
    }
  }

  const path = writeReport('food', results);
  console.log(`\nReport written to ${path}`);
}

main();
