// Batch-tests the selfie outfit checker against every photo in
// photos/selfie/, reusing the real prompt-building, parsing, and scoring
// code from src/services/selfieCheckService.ts (which itself calls the real
// scoreOutfitAesthetics). See testing/README.md for setup.
//
// No personalization profile is passed — this tests the base (no-profile)
// scoring path. The placeholder "photoUri" passed to buildSelfieCheckResult
// is never actually read (see that function's own comment) — the local file
// path works fine as a stand-in.
import './lib/config';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { photoToBase64 } from './lib/readPhoto';
import { writeReport } from './lib/report';
import { callCloudflareVision } from '../src/services/visionClient';
import { buildSelfieCheckResult, buildSelfieDetectionPrompt } from '../src/services/selfieAnalysis';

const PHOTOS_DIR = join(__dirname, 'photos', 'selfie');
const IMAGE_PATTERN = /\.(jpe?g|png)$/i;

async function main() {
  let files: string[];
  try {
    files = readdirSync(PHOTOS_DIR).filter(f => IMAGE_PATTERN.test(f));
  } catch {
    console.log(`No photos directory found at ${PHOTOS_DIR} — create it and add some test photos (see testing/README.md).`);
    return;
  }
  if (files.length === 0) {
    console.log(`No photos found in ${PHOTOS_DIR} — add some (see testing/README.md).`);
    return;
  }

  console.log(`Running ${files.length} photo(s) through the selfie checker...\n`);
  const results: unknown[] = [];

  for (const file of files) {
    process.stdout.write(`${file}... `);
    const filePath = join(PHOTOS_DIR, file);
    try {
      const { base64 } = photoToBase64(filePath);
      const raw = await callCloudflareVision(base64, buildSelfieDetectionPrompt(), 500);
      const result = buildSelfieCheckResult(raw, filePath, null);
      const garmentSummary = result.garments.map(g => `${g.category}:[${g.tags.join(',')}]`).join(' ');
      console.log(`${result.tier} — ${garmentSummary}`);
      results.push({ file, result });
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
      results.push({ file, error: (e as Error).message });
    }
  }

  const path = writeReport('selfie', results);
  console.log(`\nReport written to ${path}`);
}

main();
