// Loads testing/.env.local and sets the same env vars visionClient.ts reads
// at module-load time — this file must be imported FIRST in every runner
// script, before anything that transitively imports visionClient.ts, since
// those values are read into top-level consts the instant that module loads.
//
// Deliberately points EXPO_PUBLIC_APP_SHARED_SECRET at TEST_SHARED_SECRET's
// value (not the app's real secret) — the harness authenticates as the
// Worker's separate, much-higher-rate-limited test client (see
// server/src/index.ts), so batch runs never compete with or loosen the real
// app's abuse protection.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const envPath = join(__dirname, '..', '.env.local');

let raw: string;
try {
  raw = readFileSync(envPath, 'utf-8');
} catch {
  throw new Error(
    `Missing ${envPath} — copy .env.local.example to .env.local and fill in PROXY_URL/TEST_SHARED_SECRET (see testing/README.md).`,
  );
}

for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  if (key === 'PROXY_URL') process.env.EXPO_PUBLIC_PROXY_URL = value;
  if (key === 'TEST_SHARED_SECRET') process.env.EXPO_PUBLIC_APP_SHARED_SECRET = value;
}

if (!process.env.EXPO_PUBLIC_PROXY_URL || !process.env.EXPO_PUBLIC_APP_SHARED_SECRET) {
  throw new Error(`${envPath} is missing PROXY_URL or TEST_SHARED_SECRET — see testing/README.md.`);
}
