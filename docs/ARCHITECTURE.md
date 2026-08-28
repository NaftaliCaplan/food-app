# Architecture Map

This document exists to answer one question when you're looking at any file in this repo: **where does this slot in?** It's meant to be read alongside `docs/decisions/` (which explains *why* things are the way they are) — this doc explains *what's where and how it connects*.

Maintained on a "significant change" cadence, not on every commit: expect an update whenever a genuinely new subsystem lands (the outfit-generation rewrite would qualify; a button reposition wouldn't).

## The big picture: two apps sharing a shell

This codebase is genuinely **two separate features** that share only visual conventions and a Cloudflare AI vendor — not code:

1. **Food/Outfit Checker (legacy, single-photo AI verdict)** — take one photo, send it to a Cloudflare-hosted vision model, get back a verdict. No persistence at all — stateless, one-shot. Two sub-modes:
   - Food ripeness/doneness (`cloudflareService.ts` → `ResultsScreen`)
   - "Does my current outfit clash" (`clothesService.ts` → `ClothesResultsScreen`, header title "Does it match?")

   These two sub-modes are structurally identical (same shape: screen → hook → service → Cloudflare → parsed verdict) but are **not** shared or generalized into a common implementation — that duplication is intentional-by-omission, not an oversight to "fix."

2. **Wardrobe / Outfit Matcher (main feature, where all current work happens)** — a persisted wardrobe (`wardrobeStorage.ts`) plus a fully **deterministic** outfit-generation engine. As of ADR 0016, there is **no AI call anywhere in outfit generation** — selection and the tip text are both pure computation. AI is only involved earlier, when *adding* an item to the wardrobe (tagging the photo).

If you're staring at a file and it doesn't seem to connect to anything else you know about — check which of these two features it belongs to first. `clothesService.ts` (legacy checker) and `outfitService.ts` (main generator) sound related by name but are unconnected code paths.

The main feature is where nearly all effort goes right now (per the project owner's own priority), so it gets the most depth below.

## How to read any file by its folder

| Folder | What lives here |
|---|---|
| `src/screens/` | What the user sees — one file per screen, owns its own layout/header (native nav headers are globally disabled) |
| `src/components/` | Shared UI pieces used by multiple screens |
| `src/hooks/` | Glue between a screen and a service — manages loading/error/success state around an async call |
| `src/services/` | The actual business logic / "what happens" — AI calls, or (for the main feature) the deterministic outfit engine |
| `src/storage/` | What's actually persisted to disk (AsyncStorage + photo files) |
| `src/utils/` | Pure functions, no side effects, no I/O |
| `src/constants/` | Shared vocabulary/config (e.g. the curated tag list) |
| `src/types/` | The domain model everything else is built on |
| `src/theme/` | The terminal visual design system (see below) |
| `src/navigation/` | The single source of truth for every route and its params |

## End-to-end trace: building and saving an outfit

The single most useful thing in this document if you're trying to understand "when does this file actually run":

```
AddItemScreen (capture photo)
  → tagService.tagClothingItem()          [AI: names/tags the item]
  → wardrobeStorage.copyPhotoToApp() + addItem()   [persisted]

OutfitBuilderScreen (pick style/temperature/accessories)
  → navigates to OutfitResultsScreen with those criteria as route params

OutfitResultsScreen
  → wardrobeStorage.getWardrobe() + profileStorage.getUserProfile()  [loaded from disk]
  → useOutfitGenerator (hook)
    → outfitService.generateOutfit()          [orchestrator, filters by style + laundry]
      → outfitCandidates.selectBestOutfit()   [enumerates every valid combo, greedy accessories]
        → outfitAesthetics.scoreOutfitAesthetics()   [color/pattern/temperature/layering score]
      → outfitRecommendation.buildRecommendation()   [templated tip from the final items]
  → user accepts → outfitStorage.saveOutfit()  [persisted, item IDs only]
  → user rejects → same pipeline again, excluding the last few rejected combos

SavedOutfitsScreen
  → outfitStorage.getSavedOutfits() + wardrobeStorage.getWardrobe()
    [re-reads both to rehydrate saved item IDs back into full WardrobeItem objects]
```

Everything in the main feature is reachable from this one trace. If a file isn't on this list, it's either UI chrome (a shared component), a one-off screen (add/edit/profile), or part of the legacy checker feature instead.

## Quick reference

### Screens (`src/screens/`)

| Screen | Purpose | Connects to |
|---|---|---|
| `HomeScreen` | Landing page, two feature buttons | → `FoodChecker`, → `Wardrobe` |
| `FoodCheckerScreen` | Capture photo + food name (legacy) | ← `Home`; → `Results` |
| `ResultsScreen` | Food verdict display (legacy) | ← `FoodChecker` |
| `ClothesCheckerScreen` | Capture a worn-outfit photo (legacy) | → `ClothesResults`. **Currently orphaned** — nothing navigates in except its own results screen's "check another" button; see Known Quirks. |
| `ClothesResultsScreen` | Outfit clash verdict display (legacy) | ← `ClothesChecker` |
| `WardrobeScreen` | Grid of wardrobe items, laundry toggle, delete | ← `Home`; → `AddItem`, `EditItem`, `UserProfile`, `SavedOutfits`, `OutfitBuilder` |
| `AddItemScreen` | Capture → AI tag → review → save | ← `Wardrobe`; can hard-reject a non-clothing photo (no save path) |
| `EditItemScreen` | Edit an existing item | Receives the full item object via route params (no re-fetch) |
| `UserProfileScreen` | Optional style profile (skin tone/height/build) | Feeds `outfitService`'s currently-unused `profile` option |
| `OutfitBuilderScreen` | Pick style/temperature/accessories criteria | → `OutfitResults` |
| `OutfitResultsScreen` | Runs generation, accept/reject loop | → `Wardrobe` on save |
| `SavedOutfitsScreen` | List saved outfits, expandable detail | Resolves stale/deleted items gracefully (see Known Quirks) |

### Components (`src/components/`)

Shared: `AppText` (font-weight-aware text primitive, used almost everywhere), `ScreenHeader` (back button + title, since native headers are off), `CaptureButton`, `CategoryPicker`, `StylePicker`, `WardrobeItemForm` (the big add/edit form), `FeatureButton` (home screen cards). Legacy-checker-only: `ResultCard`/`ClothesResultCard`, `ConfidenceBadge`, `CueBulletList`, `StatusOverlay`/`ClothesStatusOverlay`, `CheckAnotherButton`, `PrimaryInput`.

### Services (`src/services/`)

| File | Purpose |
|---|---|
| `tagService.ts` | AI: names/tags a wardrobe photo; also extracts skin tone for profiles. The **only** AI call left in the main feature's path. |
| `cloudflareService.ts` | AI: food ripeness verdict (legacy) |
| `clothesService.ts` | AI: outfit clash verdict from one photo (legacy) |
| `outfitService.ts` | Deterministic orchestrator for the main feature — see the trace above |

### Hooks (`src/hooks/`)

`useAnalysis`/`useClothesAnalysis` — thin async wrappers for the legacy checkers. `useOutfitGenerator` — stateful wrapper around `outfitService.generateOutfit`; keeps a rolling window of the last 3 rejected combinations (not a permanent blacklist — see Known Quirks) in a `useRef` to dodge stale-closure bugs.

### Storage (`src/storage/`) — all AsyncStorage, one JSON blob per key

`wardrobeStorage.ts` (`WardrobeItem[]`, plus actual photo files on disk), `outfitStorage.ts` (`SavedOutfit[]`, item IDs only — not full items), `profileStorage.ts` (single `UserProfile` object).

### Utils (`src/utils/`)

`outfitCandidates.ts` (the enumerator/scorer core — also enforces at most one accessory per manually-tagged type, e.g. one hat, and breaks scoring ties: lowest score wins, then fewest total items, then genuinely at random — see ADR 0017), `outfitAesthetics.ts` (the scoring function — color, pattern, temperature-vs-weight-tag, layering, and a style-match penalty that makes a casual fallback item lose to a genuinely style-matching one), `outfitRecommendation.ts` (templated tip), `styleTags.ts` (shared style-tag normalization, used by both AI tagging and manual edits), `parseLLMResponse.ts` (legacy food-checker's markdown-fence-fallback parser).

## The terminal visual design system

Lives in `theme/colors.ts` (one flat color object: near-black backgrounds, a single green accent for all "on" states, small semantic color sets for verdicts — always paired with a bracket-tag icon, never color alone, per the app's colorblind-assist premise) and `theme/spacing.ts` (one spacing scale). Enforced everywhere: monospace font via `AppText`, `borderRadius: 0` on every surface, `[x]`/`[ ]` and `(x)`/`( )` text glyphs instead of native switches/checkboxes, bracket tags (`[TOP]`, `[ERROR]`, `[L]`/`[L✓]`, etc.) instead of icons or emoji.

## Known quirks worth knowing on sight

- **`filterByStyle`'s casual-passthrough rule** (`outfitService.ts`): any item tagged `casual` passes the style filter for *any* requested style, not just casual requests — a deliberate design choice from early on, when tagging was far less reliable. This is the actual, confirmed explanation for things like crocs showing up in a smart-casual outfit. As of ADR 0017, eligibility is unchanged but `scoreOutfitAesthetics` now penalizes the mismatch, so casual only wins when nothing genuinely matching is available — a fallback, not a default.
- **Ties in scoring are broken randomly, not by wardrobe scan order** (ADR 0017): with a narrow-enough rule set, exact ties are common, and `selectBestOutfit` used to silently default to whichever item was added to the wardrobe first — which looked like "tags don't matter" until diagnosed. Now: lowest score wins, then fewest total items (so a tied 2-top pairing never edges out a simpler single top), then genuinely random. This makes outfit generation not-strictly-deterministic for identical inputs, a deliberate departure from how ADR 0016 originally framed it.
- **The orphaned `ClothesChecker` route**: `ClothesCheckerScreen`'s own header title is literally "Does it match?" — the exact same string as the `HomeScreen` button that actually navigates to `Wardrobe` instead. Nothing in the app currently navigates into `ClothesChecker` except its own results screen's "check another" loop. Either dead code or a missing entry point — not yet resolved either way.
- **`SavedOutfit` stores item IDs only**, never a snapshot of the actual items. Deleting or editing a wardrobe item after saving an outfit that used it is expected and handled (`SavedOutfitsScreen` resolves missing IDs gracefully), not a bug.
- **Duplicated logic that looks shared but isn't**: `adjustConfidence` (near-identical between `cloudflareService.ts` and `clothesService.ts`), the 75°F/45°F temperature thresholds (duplicated between `outfitAesthetics.ts` and `outfitRecommendation.ts`), `normalizeStyle` (duplicated between `styleTags.ts` and `outfitService.ts`). None of these are wired together — changing one doesn't change the others.
- **The rejected-outfit list is a rolling window, not a permanent blacklist** (`useOutfitGenerator.ts`, last 3 only) — a deliberate choice so a small wardrobe can't get permanently stuck once its few genuinely good combinations are used up in one "Try Again" session.
