# cba-batch-test

A standalone test harness for running a batch of real photos through the app's actual pipelines (food checker, wardrobe tagging, selfie checker, outfit generation) without using a phone — useful for getting a real, concrete read on consistency across many photos at once instead of one real-device test at a time.

This reuses the *real* prompt-building and response-parsing code from `src/services/` — the only thing not real-app code is how a photo gets read off disk (plain Node `fs` here, `expo-file-system` in the app). It calls the same deployed Cloudflare Worker the app uses, but authenticates with a separate test-only secret (see below) with a much higher rate limit, so batch runs never compete with or loosen the real app's abuse protection.

## One-time setup

```sh
cd testing
npm install
cp .env.local.example .env.local
```

Open `.env.local` and fill in `TEST_SHARED_SECRET`. This is a *different* secret from the app's `EXPO_PUBLIC_APP_SHARED_SECRET` — see `server/README.md` for how to generate and set one via `wrangler secret put TEST_SHARED_SECRET`. `.env.local` is gitignored; never commit it.

## Adding test photos

`.jpg`/`.jpeg`/`.png`/`.webp` are all supported — the real mime type is detected from the extension and passed through correctly (not just assumed to be JPEG).

- **Food checker**: drop photos in `photos/food/`, named like `banana_01.jpg` — the label sent to the checker is derived from the filename (strip the extension and any trailing number, replace `_`/`-` with spaces). `green-tomato-2.png` → label "green tomato". **Word separators matter**: `mediumraresteak.webp` becomes the single run-on label "mediumraresteak", which breaks the label/observed-food match check (it only splits on whitespace) — use `medium_rare_steak.webp` or `medium-rare-steak.webp` instead.
- **Wardrobe tagging**: drop photos in `photos/wardrobe/<category>/`, where `<category>` is `top`, `bottom`, `shoes`, or `accessory` — this mirrors picking a category before taking the photo in the real app, and lets you see how often the AI's own independent category guess disagrees with it.
- **Selfie checker**: drop full-outfit photos in `photos/selfie/`. No filename convention needed.
- **Outfit generation**: reuses the same `photos/wardrobe/<category>/` photos as wardrobe tagging — no separate folder. Each run re-tags them fresh, then runs the real, fully-deterministic `generateOutfit()` across every everyday style (casual/smart_casual/formal/sporty) with and without accessories. Unlike the other three, this step itself makes no AI/network call at all — only the tagging step does (see ADR 0016).

These folders are gitignored (personal photos shouldn't be committed). Variety matters more than volume — a mix of lighting, framing, and a few deliberately ambiguous/edge-case shots will surface more real issues than many similar photos.

## Running

```sh
npm run food
npm run wardrobe
npm run selfie
npm run outfit
```

Each prints a one-line result per photo as it runs, then writes a full JSON report to `results/<feature>-<timestamp>.json` (also gitignored) with every raw result for later review.

## Notes

- `npm run typecheck` runs `tsc --noEmit` for this folder specifically.
- This hits the real deployed Worker and incurs real (small) Workers AI cost per photo — see the cost discussion in project memory/chat history before running very large batches.
- To compare a different AI model, swap the `MODEL` constant in `server/src/index.ts` and redeploy (`cd ../server && npm run deploy`) — then re-run the same photo set here and compare the new `results/` report against an older one.
