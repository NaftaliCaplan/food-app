---
status: accepted
date: 2026-07-25
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Fixing the file-system API at the source (rather than re-suppressing the type error) and structurally preventing contradictory style tags means both defects can't silently regress — a future SDK bump can't reintroduce the same deprecated-API crash, and no amount of model drift can put two mutually-exclusive style tags on one item again.
tc-category: reliability
tc-conditions: Holds as long as `expo-file-system`'s `File`/`Directory`/`Paths` class API (the same one `tagService.ts`/`cloudflareService.ts`/`clothesService.ts` already used) remains the supported surface, and as long as the AI response schema keeps `style` as its own field rather than folding it back into free-form `tags`.
tc-signals:
  - regression-prevention
  - interface-stability
tc-confidence: 4
---

# Live Device Test Fixes: File-System API, Style-Tag Integrity, Non-Clothing Guard

## Context and Problem Statement

The first real on-device Expo Go test (as opposed to the Expo-web browser check, which can't exercise the real camera or native file system) surfaced three defects that only manifest on native: wardrobe saves silently failing, a photo of nothing still being tagged and saveable as a wardrobe item, and the AI tagging the same garment with two contradictory style tags (`casual` and `formal` on one pair of plaid pajama pants). None of these were catchable from the web build or from `tsc`/tests alone — the file-system bug in particular had been sitting behind a `tsc` error for multiple sessions, tracked as known tech debt, until it actually blocked saves on a real device.

## Decision Drivers

* `wardrobeStorage.ts` was calling `FileSystem.documentDirectory`/`getInfoAsync`/`makeDirectoryAsync`/`copyAsync`/`deleteAsync` — the legacy static-function API, which SDK 54's `expo-file-system` root export no longer provides (confirmed via package source: the old API only survives under `expo-file-system/legacy`; the root/`next` export is now the `Paths`/`File`/`Directory` class API that `tagService.ts`, `cloudflareService.ts`, and `clothesService.ts` already use)
* A wardrobe item saved from a non-clothing photo pollutes the dataset permanently and degrades every future outfit suggestion — much more consequential than the food checker's equivalent "not food" case, which is a one-shot ephemeral analysis with nothing persisted
* Relying on prompt wording alone ("pick one style") to keep an LLM's free-form tag list internally consistent is not reliable — the model had already violated it once in observed testing
* `outfitService.ts`'s `filterByStyle` depends on exactly one clean style tag per item to make sensible outfit suggestions; contradictory or missing style tags degrade its output silently

## Considered Options

* Storage: switch `wardrobeStorage.ts` to `expo-file-system/legacy` (same old function-call API, minimal diff) vs. migrate it to the `File`/`Directory`/`Paths` class API already used elsewhere in the codebase
* Style-tag integrity: strengthen the prompt wording only vs. add a dedicated `style` field to the AI response schema and enforce single-style-per-item in code
* Non-clothing photos: block save and force retake vs. warn but allow saving anyway

## Decision Outcome

**Storage** — migrated `wardrobeStorage.ts` to the modern `Paths`/`File`/`Directory` API (`Paths.document`, `new Directory(...)`, `.create({ intermediates, idempotent })`, `.copy()`, `.exists`, `.delete()`), matching the pattern every other service in the codebase already uses, instead of taking the smaller-diff legacy-subpath shortcut. Chosen because the legacy path is still explicitly deprecated and would only postpone the same class of failure to a future SDK bump; migrating now costs the same effort as re-pointing the import and removes the deprecated surface entirely. Confirmed fix: `tsc --noEmit` is now fully clean (zero errors, not just the previously-tracked one).

**Style-tag integrity** — added a dedicated `"style"` field to the AI JSON response (separate from `"tags"`), and `tagClothingItem()` now strips any of the four style words out of the raw tags array and re-appends only the single resolved style. This makes a contradictory result structurally impossible in code, regardless of what the model puts in the free-form tags list — prompt wording alone ("pick exactly one") was also strengthened (with casual/smart_casual/formal/sporty examples, and an explicit "pajamas are always casual, never formal" rule) but is treated as a secondary defense, not the fix itself.

**Non-clothing photos** — user chose to block save and force retake, mirroring the food checker's existing "NOT FOOD AT ALL" pattern. `tagClothingItem()` now returns `isClothing: boolean` (via a `STEP 0` check in the prompt); `AddItemScreen` gained a `'notClothing'` step that shows a blocking message with only a "Retake Photo" action — no path to save reaches the wardrobe.

### Consequences

* Good, because wardrobe saves (and therefore the entire outfit-builder flow, which requires ≥2 saved items) now actually work on a real device.
* Good, because a bad/irrelevant photo can no longer become permanent wardrobe clutter that quietly degrades future outfit suggestions.
* Good, because outfit generation's style-based filtering (`filterByStyle`) now always sees at most one style tag per item — no more contradictory casual+formal items.
* Neutral, because on an `isClothing` parse miss (garbled response) the code defaults to `true` rather than `false` — deliberately biased toward not blocking a legitimate save over occasionally missing a bad one.
* Bad, because `isClothing`/`style` add two more fields the model must get right in one response — slightly larger prompt/response surface, though `max_tokens` was left unchanged and hasn't shown truncation issues.

### Confirmation

Added `src/services/__tests__/tagService.test.ts` (6 tests) covering: style-field merging, stripping contradictory style words from free-form tags (the exact regression case), hyphen/underscore style normalization, `isClothing` true/false/missing-defaults-true, and the markdown-fence fallback path. Writing that hyphen-normalization test caught a real bug before it shipped — `parseStyle` only normalized spaces to underscores, not hyphens, so `"smart-casual"` from the model would have passed through unconverted. Full suite: 22/22 suites, 144/144 tests, `tsc --noEmit` fully clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* The "photo of nothing" fix depends entirely on the vision model correctly self-reporting `isClothing` — not independently verified against a battery of real non-clothing photos beyond the one the user hit during testing.
* Style-tag calibration (casual vs. smart_casual vs. formal vs. sporty) still depends on the model's visual judgment for the *initial* classification; this fix only guarantees the *output* is single-valued, not that the single value chosen is always correct.
