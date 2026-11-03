import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function writeReport(feature: string, results: unknown[]): string {
  const dir = join(__dirname, '..', 'results');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(dir, `${feature}-${timestamp}.json`);
  writeFileSync(path, JSON.stringify(results, null, 2));
  return path;
}
