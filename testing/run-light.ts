// Batch-tests the light checker against every photo in photos/light/, reusing
// the real prompt-building, response-parsing, and majority-vote code from
// src/services/lightAnalysis.ts — mirrors lightCheckerService.ts's checkLight
// exactly (3 independent calls per photo, voted), so this measures the same
// behavior real app usage gets, not just a single raw call. See
// testing/README.md for setup.
//
// Label-free, same as run-selfie.ts — there's no claimed-label concept here.
import './lib/config';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { photoToBase64 } from './lib/readPhoto';
import { writeReport } from './lib/report';
import { callCloudflareVision } from '../src/services/visionClient';
import { buildLightPrompt, parseLightResponse, voteLightResults } from '../src/services/lightAnalysis';

const PHOTOS_DIR = join(__dirname, 'photos', 'light');
const IMAGE_PATTERN = /\.(jpe?g|png|webp)$/i;
const VOTES = 3;

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

  console.log(`Running ${files.length} photo(s) through the light checker...\n`);
  const results: unknown[] = [];

  for (const file of files) {
    process.stdout.write(`${file}... `);
    const filePath = join(PHOTOS_DIR, file);
    try {
      const { base64, mimeType } = photoToBase64(filePath);
      const prompt = buildLightPrompt();
      const raws = await Promise.all(
        Array.from({ length: VOTES }, () => callCloudflareVision(base64, prompt, 200, mimeType)),
      );
      const votes = raws.map(parseLightResponse);
      const result = voteLightResults(votes);
      const voteSummary = votes.map(v => v.colorLabel).join('/');
      console.log(`${result.colorLabel}${result.detail ? ' — ' + result.detail : ''} (votes: ${voteSummary})`);
      // Individual votes kept alongside the final result so disagreement
      // patterns are visible in the report, not just the aggregated outcome.
      results.push({ file, result, votes });
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
      results.push({ file, error: (e as Error).message });
    }
  }

  const path = writeReport('light', results);
  console.log(`\nReport written to ${path}`);
}

main();
