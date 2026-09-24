---
status: accepted
date: 2026-09-24
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: A new feature — check whether the outfit you're currently wearing matches from a single selfie — reusing the deterministic scoring engine (scoreOutfitAesthetics, all research-backed bonuses, all three personalization rounds) instead of building a parallel AI-judged verdict system. Also repurposes a confirmed-orphaned legacy route rather than adding a third parallel checker flow.
tc-category: feature
tc-conditions: Holds as long as the AI's role here stays limited to visual detection/tagging (color, pattern, brightness, fit — concrete classification tasks), never subjective match judgment. If a future round is tempted to let the AI self-report a verdict or confidence for this feature, that would reverse the whole rationale (ADR 0016) and should be treated as a real regression, not a minor tweak. tierForScore's thresholds are a starting calibration, not a firm spec — expect to retune via live testing, same as CLASHING_COLOR_PAIRS was.
tc-signals:
  - user-research-integration
tc-confidence: 3
---

# Selfie Match Checker

## Context and Problem Statement

The user proposed a new feature: take a single selfie of the outfit currently being worn, and get told whether it matches — reusing the wardrobe app's existing matching intelligence rather than a separate judgment system. This didn't fit either existing pattern in the app: the wardrobe/outfit-generation system (`outfitService.ts` → `outfitCandidates.ts` → `outfitAesthetics.ts`) chooses the best combination from a *stored* wardrobe and never looks at a live photo; the legacy clothes-checker (`clothesService.ts`, `ClothesCheckerScreen`/`ClothesResultsScreen`) does take one photo and return one verdict, but via free-form AI judgment — the exact pattern ADR 0016 moved outfit generation away from after it repeatedly hallucinated.

Research confirmed two things before any code was written: `scoreOutfitAesthetics` only ever reads `category`/`tags` off each item (nothing WardrobeItem-specific), so a lightweight detected-garment shape could reuse it directly; and the `ClothesChecker`/`ClothesResults` routes were confirmed — by directly reading `HomeScreen`/`RootNavigator`, not just trusting the architecture doc — to have zero live entry point anywhere in the app, and nothing outside their own file cluster referenced them (verified by grep). That made repurposing them, rather than building a third parallel checker flow, a safe, deliberate choice.

## Decision Drivers

* Whether to trust the AI with a subjective match judgment (the legacy pattern) or keep it to visual detection only and let the existing deterministic scorer decide (the wardrobe pattern) was the central fork — checked with the user directly before any implementation, given how much of this project's history (ADR 0016 specifically) was about moving away from AI-judged reasoning after repeated hallucination.
* Multi-garment detection from a single photo is genuinely new ground — `tagService.ts`'s existing prompt only ever tags one isolated item per photo, and the legacy clothes-checker's prompt, while multi-item-aware, returns free-form judgment rather than structured per-item tags. Neither was a direct template.
* Personalization scope (whether to include the three already-built rounds) and whether to explain *why* a score landed where it did were both real judgment calls surfaced and decided before writing code, not assumed.

## Considered Options

**Core mechanism:**
* Deterministic scoring — AI only detects/tags each garment, `scoreOutfitAesthetics` judges — chosen. Higher prompting risk (multi-item structured detection is unproven), but reuses every existing rule and personalization round for free, and stays consistent with the rest of the app's philosophy.
* AI-judged verdict, mirroring the legacy clothes-checker — rejected; easier to prompt reliably, but reintroduces exactly the AI-subjective-judgment pattern this project deliberately moved away from.

**Detection prompt shape:**
* An open-ended array of garment objects for the model to enumerate — rejected; harder for Llama 3.2 11B Vision to fill in correctly than a bounded schema (the existing tagService.ts prompt already only handles one isolated item, so there was no working multi-item template to extend from).
* Fixed named slots (`top`/`bottom`/`shoes`, each with a `present` flag, plus a variable-length `accessories` array) — chosen. Matches how an outfit is actually worn (at most one of each core slot) and matches `scoreOutfitAesthetics`'s own tolerance for a missing category.

**Screen reuse:**
* Build new screens from scratch, leave the orphaned `ClothesChecker`/`ClothesResults` alone — rejected; would leave a third near-duplicate checker flow in the codebase for no benefit, once the orphan status was confirmed rather than assumed.
* Repurpose/rename the orphaned cluster into `SelfieCheck`/`SelfieCheckResults` — chosen.

**Explaining the result:**
* A per-rule "why" breakdown (e.g. "the red top and green bottom clash") — rejected for v1; `scoreOutfitAesthetics` only returns a number, not which rule fired, so this would require either a return-shape change to that shared function (used by outfit generation too) or duplicating its detection logic outside it — exactly the kind of drift risk this project's own architecture notes already flag elsewhere.
* Generic, tier-based templated tip text — chosen, mirroring `outfitRecommendation.ts`'s own explicit tradeoff: "necessarily less insightful than free prose, but always accurate."

**Personalization:**
* Reuse the saved `UserProfile` (undertone/contrast/height/build) exactly as outfit generation does — chosen; `scoreOutfitAesthetics` already accepted all four fields at zero extra cost, and the "Personalize for me" toggle pattern (`ToggleRow`, `hasProfile` gate) already existed in `OutfitBuilderScreen`.

## Decision Outcome

**New types** (`src/types/selfieCheck.ts`): `DetectedGarment` (`{ category, tags }` — deliberately not a `WardrobeItem`, confirmed unnecessary by reading `outfitAesthetics.ts` directly), `SelfieMatchTier` (5 values mirroring the legacy `MatchVerdict` enum/colors), `SelfieCheckResult` (`{ tier, garments, tip }`).

**`src/services/selfieCheckService.ts`** — the core new logic. `buildSelfieDetectionPrompt()` uses the fixed-slot schema above. Parsing (`extractJsonObject`) strips markdown fences and attempts one real `JSON.parse` of the extracted `{...}` block (borrowing the food-checker's `parseLLMResponse.ts` approach rather than the legacy clothes-checker's weaker keyword-only fallback) — multi-slot nested JSON is too fragile to patch key-by-key with per-field regexes the way `tagService.ts`'s flat single-item fallback does. If parsing fails entirely, or detects nothing, the result is a thrown "no clothing detected" error — a fail-closed outcome, same as `AddItemScreen`'s "not clothing, retake only" pattern, rather than guessing at partial data. Colors reuse `tagService.ts`'s exported `normalizeColor` (extracting real canonical words from a compound phrase like "olive green") instead of re-deriving that fix a second time. `tierForScore` buckets the raw score into a tier (starting calibration, explicitly expected to be retuned via live testing). Each `DetectedGarment` is wrapped in a placeholder `WardrobeItem` (synthetic id, the selfie's own photo URI, `addedAt: Date.now()`) purely to satisfy `scoreOutfitAesthetics`'s existing parameter type — zero changes to that function's signature or behavior.

**`src/hooks/useSelfieCheckAnalysis.ts`** — mirrors the legacy `useClothesAnalysis`'s loading/success/error shape, plus a `ready` gate (default `true`) the results screen uses to defer firing until the profile has actually resolved from storage — without it, the effect would fire once immediately with `profile: null` and then again once the real profile loaded, wasting a network call and briefly showing the wrong result. Same class of bug `OutfitResultsScreen` already solved with its own ready flag; caught and fixed before it shipped, not after.

**Repurposed cluster**: `ClothesCheckerScreen`→`SelfieCheckScreen` (facing="front" instead of "back"; adds the reused `ToggleRow`/`hasProfile` personalize toggle), `ClothesResultsScreen`→`SelfieCheckResultsScreen`, `ClothesResultCard`→`SelfieCheckResultCard` (per-category TOP/BOTTOM/SHOES/ACCESSORIES breakdown showing real detected tags instead of AI-written prose; no confidence badge, since a deterministic score has no model-confidence concept to display), `ClothesStatusOverlay`→`SelfieCheckStatusOverlay` (content reused verbatim, already generic). `CheckAnotherButton` reused untouched. The old files were deleted outright, not kept in parallel, once confirmed nothing else referenced them.

**`ToggleRow` extracted** from `OutfitBuilderScreen.tsx` into its own `src/components/ToggleRow.tsx` — it was a private, unexported local function, so `SelfieCheckScreen` needed it pulled out to reuse rather than duplicate, same "extract on second use" precedent as `CategoryPicker`/`WardrobeItemForm` earlier in this project's history.

**Navigation**: `ClothesChecker`/`ClothesResults` renamed to `SelfieCheck`/`SelfieCheckResults` in `RootStackParamList` and `RootNavigator`. `HomeScreen` gained a third `FeatureButton` ("How's my outfit?") — necessary, not optional, since repurposing the orphaned route without a real entry point would just reproduce the exact problem this ADR opens by describing.

### Consequences

* Good, because the feature gets every existing scoring rule and all three personalization rounds automatically, with zero duplication of matching logic.
* Good, because a confirmed-dead code cluster became a real feature instead of leaving a third parallel checker flow to maintain.
* Good, because two genuinely latent, unrelated bugs were caught and fixed as a side effect of running the full suite for this round: a stale/misleading test description, and two flaky `outfitService.test.ts` tests (from ADR 0021) where two independently-correct bonuses — `FIT_BALANCE_BONUS` (rewards a fit *contrast*) and `HEIGHT_FIT_BONUS`/`BUILD_FIT_BONUS` (rewards a fit *match*) — happened to tie at the same magnitude for those specific fixtures, making the outcome a genuine coin-flip via `selectBestOutfit`'s intentional random tie-break (ADR 0017) rather than the deterministic result the tests assumed. Fixed by isolating each fixture with an unrelated color clash rather than changing any scoring behavior — confirmed deterministic across 10 repeated runs after the fix, versus roughly 50% failure before it.
* Neutral, because the tip text is deliberately generic (tier-based, not per-rule) — a real scope cut, not an oversight, given `scoreOutfitAesthetics` doesn't expose which rule fired.
* Bad/unproven, because multi-garment detection accuracy at real selfie framing/distance is genuinely new ground for this app's AI usage — nothing else uses `facing="front"` at this kind of full-body distance (only `UserProfileScreen`'s static close-up reference photo), and this is explicitly flagged as needing live on-device testing before the `tierForScore` thresholds or the detection prompt itself can be considered validated.

### Confirmation

New test files: `selfieCheckService.test.ts` (21 tests — prompt-shape via fetch call args, fixed-slot parsing, compound-color extraction reuse, unrecognized-vocabulary dropping, accessory parsing, markdown-fence fallback, fail-closed on no-detection and on unparseable responses, non-OK HTTP, `tierForScore` boundaries, personalization threading), `useSelfieCheckAnalysis.test.ts` (7 tests — loading/success/error, profile threading, the `ready`-gate fix specifically), `SelfieCheckResultCard.test.tsx` (10 tests), `SelfieCheckStatusOverlay.test.tsx` (4 tests), `SelfieCheckScreen.test.tsx` (7 tests), `SelfieCheckResultsScreen.test.tsx` (5 tests), `ToggleRow.test.tsx` (3 tests, for the extracted component). Updated `HomeScreen.test.tsx` for the third feature button (the original wasn't actually asserting a fixed count, so it silently passed without covering the new button until this was corrected). Deleted the 6 old `Clothes*` test files, replaced 1:1. Fixed 2 flaky `outfitService.test.ts` tests as described above. Full suite: 31/31 suites, 329/329 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* Live on-device testing of multi-garment detection accuracy has not happened yet — this is explicitly the biggest unproven risk, flagged rather than assumed away by unit tests alone.
* `tierForScore`'s thresholds are a first-pass calibration, expected to need tuning once real detection results are seen, same as `CLASHING_COLOR_PAIRS` was tuned iteratively.
* Per-rule "why" explanation, flip-camera/back-camera mirror-selfie support, and photo-library import were all explicitly scoped out of v1 (see the plan's "Explicitly deferred" section) — none are started here.
