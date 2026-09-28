# Architecture Map

This document exists to answer one question when you're looking at any file in this repo: **where does this slot in?** It's meant to be read alongside `docs/decisions/` (which explains *why* things are the way they are) — this doc explains *what's where and how it connects*, at a shape level, not implementation detail.

Maintained on a "significant change" cadence, not on every commit: expect an update whenever a genuinely new subsystem lands (the outfit-generation rewrite, or the selfie-check feature, would qualify; a button reposition wouldn't).

## The big picture: three one-shot checkers + one persisted engine

This codebase has two structurally different shapes, and one feature that deliberately straddles both:

1. **One-shot checkers** — take one photo, get back one result, nothing persisted. Two live today:
   - **Food ripeness/doneness** (`cloudflareService.ts` → `ResultsScreen`) — AI judges the verdict directly (a Cloudflare-hosted vision model returns a verdict + confidence).
   - **Selfie match check** (`selfieCheckService.ts` → `SelfieCheckScreen`/`SelfieCheckResultsScreen`) — shaped like a one-shot checker (one selfie in, one result out, nothing saved), but the AI's only job is to *detect and tag* the garments it sees; the actual match verdict comes from the same deterministic scoring function the wardrobe engine uses (`outfitAesthetics.ts`). It's the one file that bridges both shapes — don't assume it's part of the wardrobe engine's own pipeline (`outfitService.ts`/`outfitCandidates.ts` are not involved at all), and don't assume it works like the food checker either (no AI-judged verdict here).

2. **Wardrobe / Outfit Matcher** (the main feature, where most ongoing work happens) — a persisted wardrobe (`wardrobeStorage.ts`) plus a fully deterministic outfit-generation engine. No AI call anywhere in *generation* — AI only runs earlier, when tagging a photo as it's added to the wardrobe, or reading a profile reference photo.

If a file doesn't seem to connect to anything else you know about, check which of these three it belongs to first — `selfieCheckService.ts` and `outfitService.ts` both call into `outfitAesthetics.ts` but are otherwise unconnected code paths.

## How to read any file by its folder

| Folder | What lives here |
|---|---|
| `src/screens/` | What the user sees — one file per screen, owns its own layout/header (native nav headers are globally disabled) |
| `src/components/` | Shared UI pieces used by multiple screens |
| `src/hooks/` | Glue between a screen and a service — manages loading/error/success state around an async call |
| `src/services/` | The actual business logic / "what happens" — AI calls, or (for the wardrobe engine) the deterministic scoring/selection logic |
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
        → outfitAesthetics.scoreOutfitAesthetics()   [color/pattern/temperature/layering/personalization score]
      → outfitRecommendation.buildRecommendation()   [templated tip from the final items]
  → user accepts → outfitStorage.saveOutfit()  [persisted, item IDs only]
  → user rejects → same pipeline again, excluding the last few rejected combos

SavedOutfitsScreen
  → outfitStorage.getSavedOutfits() + wardrobeStorage.getWardrobe()
    [re-reads both to rehydrate saved item IDs back into full WardrobeItem objects]
```

For comparison, the selfie-check trace is much shorter and has no persistence step at all:

```
SelfieCheckScreen (capture selfie, optional "Personalize for me" toggle)
  → navigates to SelfieCheckResultsScreen

SelfieCheckResultsScreen
  → profileStorage.getUserProfile()  [only if personalize was toggled on]
  → useSelfieCheckAnalysis (hook)
    → selfieCheckService.checkSelfieOutfit()   [AI detects/tags garments, then scores via outfitAesthetics directly]
```

## Quick reference

### Screens (`src/screens/`)

| Screen | Purpose | Connects to |
|---|---|---|
| `HomeScreen` | Landing page, three feature buttons | → `FoodChecker`, → `Wardrobe`, → `SelfieCheck` |
| `FoodCheckerScreen` | Capture photo + food name (one-shot checker) | ← `Home`; → `Results` |
| `ResultsScreen` | Food verdict display | ← `FoodChecker` |
| `SelfieCheckScreen` | Capture a selfie of your current outfit | ← `Home`; → `SelfieCheckResults` |
| `SelfieCheckResultsScreen` | Detected garments + deterministic match tier + tip | ← `SelfieCheck` |
| `WardrobeScreen` | Grid of wardrobe items, laundry toggle, delete | ← `Home`; → `AddItem`, `EditItem`, `UserProfile`, `SavedOutfits`, `OutfitBuilder` |
| `AddItemScreen` | Capture → AI tag → review → save | ← `Wardrobe`; can hard-reject a non-clothing photo (no save path) |
| `EditItemScreen` | Edit an existing item | Receives the full item object via route params (no re-fetch) |
| `UserProfileScreen` | Optional style profile (undertone/contrast/height/build) | Feeds `outfitAesthetics.scoreOutfitAesthetics`'s personalization bonuses in both the wardrobe engine and the selfie checker |
| `OutfitBuilderScreen` | Pick style/temperature/accessories criteria | → `OutfitResults` |
| `OutfitResultsScreen` | Runs generation, accept/reject loop | → `Wardrobe` on save |
| `SavedOutfitsScreen` | List saved outfits, expandable detail | Resolves stale/deleted items gracefully (see Known Quirks) |

### Components (`src/components/`)

Shared: `AppText` (font-weight-aware text primitive, used almost everywhere), `ScreenHeader` (back button + title, since native headers are off), `CaptureButton`, `CategoryPicker`, `StylePicker`, `ToggleRow` (checkbox-style toggle row, shared by `OutfitBuilderScreen` and `SelfieCheckScreen`), `WardrobeItemForm` (the big add/edit form), `FeatureButton` (home screen cards). Checker-result display: `ResultCard`/`SelfieCheckResultCard`, `ConfidenceBadge`, `CueBulletList`, `StatusOverlay`/`SelfieCheckStatusOverlay`, `CheckAnotherButton`.

### Services (`src/services/`)

| File | Purpose |
|---|---|
| `tagService.ts` | AI: names/tags a wardrobe photo (one item per photo); also extracts skin tone/build for profiles |
| `cloudflareService.ts` | AI: food ripeness verdict (one-shot checker) |
| `selfieCheckService.ts` | AI: detects/tags garments from one selfie, then scores the result via `outfitAesthetics.scoreOutfitAesthetics` — no AI-judged verdict |
| `outfitService.ts` | Deterministic orchestrator for the wardrobe engine — see the trace above |

### Hooks (`src/hooks/`)

`useAnalysis` — thin async wrapper for the food checker. `useSelfieCheckAnalysis` — same shape, plus a `ready` gate so it doesn't fire before a requested profile has actually loaded. `useOutfitGenerator` — stateful wrapper around `outfitService.generateOutfit`; keeps a rolling window of the last 3 rejected combinations (not a permanent blacklist — see Known Quirks) in a `useRef` to dodge stale-closure bugs.

### Storage (`src/storage/`) — all AsyncStorage, one JSON blob per key

`wardrobeStorage.ts` (`WardrobeItem[]`, plus actual photo files on disk), `outfitStorage.ts` (`SavedOutfit[]`, item IDs only — not full items), `profileStorage.ts` (single `UserProfile` object).

### Utils (`src/utils/`)

`outfitCandidates.ts` (enumerates every valid wardrobe combination and scores them — also enforces at most one accessory per manually-tagged type, and breaks scoring ties: lowest score wins, then fewest total items, then genuinely at random), `outfitAesthetics.ts` (the shared scoring function — color, pattern, temperature-vs-weight-tag, layering, a style-match penalty, and three personalization bonuses keyed off the user's profile), `outfitRecommendation.ts` (templated tip for a finished wardrobe outfit), `styleTags.ts` (shared style-tag normalization, used by both AI tagging and manual edits), `parseLLMResponse.ts` (the food-checker's markdown-fence-fallback parser).

## The terminal visual design system

Lives in `theme/colors.ts` (one flat color object: near-black backgrounds, a single green accent for all "on" states, small semantic color sets for verdicts — always paired with a bracket-tag icon, never color alone, per the app's colorblind-assist premise) and `theme/spacing.ts` (one spacing scale). Enforced everywhere: monospace font via `AppText`, `borderRadius: 0` on every surface, `[x]`/`[ ]` and `(x)`/`( )` text glyphs instead of native switches/checkboxes, bracket tags (`[TOP]`, `[ERROR]`, `[L]`/`[L✓]`, etc.) instead of icons or emoji.

## Known quirks worth knowing on sight

- **`filterByStyle`'s casual-passthrough rule** (`outfitService.ts`): any item tagged `casual` passes the style filter for *any* requested style, not just casual requests — the actual, confirmed explanation for things like crocs showing up in a smart-casual outfit. `scoreOutfitAesthetics` penalizes the mismatch, so casual only wins when nothing genuinely matching is available — a fallback, not a default.
- **Ties in scoring are broken randomly, not by wardrobe scan order**: with a narrow-enough rule set, exact ties are common; `selectBestOutfit` breaks them by lowest score, then fewest total items, then genuinely random. This makes outfit generation not-strictly-deterministic for identical inputs — deliberate, not a bug.
- **`SavedOutfit` stores item IDs only**, never a snapshot of the actual items. Deleting or editing a wardrobe item after saving an outfit that used it is expected and handled (`SavedOutfitsScreen` resolves missing IDs gracefully), not a bug.
- **The rejected-outfit list is a rolling window, not a permanent blacklist** (`useOutfitGenerator.ts`, last 3 only) — so a small wardrobe can't get permanently stuck once its few genuinely good combinations are used up in one "Try Again" session.
- **Several services share near-identical AI-calling boilerplate** (photo → base64 → Cloudflare fetch → parse) that isn't factored into a shared util — see `docs/AUDIT-2026-09-24.md` for the current cleanup punch list rather than re-deriving this from scratch.
