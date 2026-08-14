---
status: accepted
date: 2026-07-26
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: The category cap and layout fix both close real defects that would otherwise recur on every formal or heavily-accessorized outfit; the shared styleTags util removes the third near-duplicate implementation of style-tag logic before it could accumulate independent bugs the way the earlier casual/formal contradiction did.
tc-category: reliability
tc-conditions: Holds as long as `tagService.ts` and the `StylePicker`/`WardrobeItemForm` keep importing from `utils/styleTags.ts` rather than reintroducing their own copies of `isStyleWord`/`replaceStyle`.
tc-signals:
  - regression-prevention
  - reduced-change-scope
tc-confidence: 4
---

# Outfit Layout Fix, Category Duplication Cap, and Style Picker

## Context and Problem Statement

A fourth live-test round surfaced three more issues: (1) formal-style outfit results showed text overlapping/cut off on screen; (2) an outfit came back with two bottoms, one top, and shoes — the earlier "at least one per category" guarantee (ADR 0009) had no upper bound, so the AI could and did over-select a category; (3) there was no way to view or change an item's style (casual/smart_casual/formal/sporty) from the edit/tag-picker UI added in ADR 0010 — style existed only as an opaque entry buried in the free-form tags array.

## Decision Drivers

* Every screen in the app omits `style={{flex:1}}` on its `ScrollView`, which is harmless when the ScrollView is the last element on screen but breaks when a fixed sibling (a button bar) follows it and content is long enough to overflow — `OutfitResultsScreen` and `OutfitBuilderScreen` both have this shape; only `OutfitResultsScreen`'s content (item count + reasoning length) varies enough with style/wardrobe to have actually surfaced it yet
* A user asked, correctly, whether capping every category at exactly one item would break legitimate outfits — layering a sweater over a t-shirt is a single top's worth of *look* but two wardrobe items
* Style-tag logic (`STYLE_KEYS`, normalizing separators, stripping/replacing the embedded style tag) already existed once in `tagService.ts`; building a `StylePicker` needed the identical logic a second time, which is exactly the kind of duplication that produced the earlier casual/formal contradiction bug when it existed in only one place and drifted

## Considered Options

* Category duplication: cap every category (including top) at exactly one vs. treat top specially to allow legitimate layering
* Style-tag logic: write StylePicker-local duplicate logic vs. extract a shared utility both `tagService.ts` and the picker import
* ScrollView fix scope: only fix the screen that actually broke (`OutfitResultsScreen`) vs. also proactively fix `OutfitBuilderScreen`, which has the same latent shape but hasn't broken yet

## Decision Outcome

**Category cap**: `bottom` and `shoes` are capped at exactly 1 (you don't wear two pairs of pants or two pairs of shoes); `top` is capped at 2 to allow a base layer plus one outer layer, matching the layering case the user raised. `accessory` stays uncapped. Enforced in code (`capDuplicateCategories`) rather than prompt wording alone — same reasoning as the ADR 0009 category-completeness guarantee: the AI has already ignored explicit singular wording ("one top, one bottom") before.

**ScrollView fix**: added `style={{flex:1}}` to both `OutfitResultsScreen` and `OutfitBuilderScreen`'s `ScrollView`, not just the one that visibly broke. The latent shape (ScrollView followed by a fixed button-bar sibling, with no explicit flex) is identical in both; `OutfitBuilderScreen`'s content just happens to always be short enough to mask it today.

**Shared style-tag utility**: extracted `STYLE_KEYS`, `STYLE_LABELS`, `normalizeStyle`, `isStyleWord`, `extractStyle`, and `replaceStyle` into `src/utils/styleTags.ts`. `tagService.ts` was refactored to import these instead of keeping its own private copies; the new `StylePicker` component and `WardrobeItemForm` import the same functions. `WardrobeItemForm` now derives the current style via `extractStyle(tags)`, renders it as its own single-select radio picker (mirroring `CategoryPicker`), and hides the style tag from the generic removable-tags list so it isn't shown (and editable) twice.

### Consequences

* Good, because a formal (or any sufficiently long) outfit result can no longer overflow off-screen — the fix generalizes past just "formal," since the actual trigger was content length, not style specifically.
* Good, because an outfit can never again come back with two bottoms or two pairs of shoes, while legitimate top-layering (t-shirt + sweater) still works.
* Good, because style-tag logic exists in exactly one place now; a future bug fix there benefits `tagService.ts`'s AI-tagging path and the manual `StylePicker` path simultaneously instead of needing to be applied twice.
* Neutral, because the outfit-generation prompt wording was also updated to describe the layering exception explicitly, even though the real guarantee is the code-level cap — kept for consistency with the existing pattern of the prompt describing intended behavior even where code enforces it.
* Bad, because the top-layering cap of 2 is a fixed heuristic, not a real understanding of what "layering" means — the AI could still pick two unrelated tops that don't actually work as a layered look; the cap only prevents raw over-selection, not bad-but-technically-valid pairs.

### Confirmation

Added 5 new `outfitService.test.ts` tests (trims excess bottom, trims excess shoes, allows 2 tops for layering, caps 3 tops down to 2, does not cap accessories) and 3 new `StylePicker.test.tsx` tests plus 3 `WardrobeItemForm.test.tsx` integration tests (style derived from tags, style change replaces via `onTagsChange` not `onToggleTag`, style hidden from the generic tags list). Full suite: 26/26 suites, 189/189 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* The top-layering cap (2) is a fixed number, not a judgment of whether two tops actually form a coherent layered look — it prevents obvious over-selection but doesn't validate quality.
* Other screens with a ScrollView followed by a fixed sibling weren't audited beyond `OutfitBuilderScreen` — if a similar shape exists elsewhere and its content ever grows, the same class of bug could recur there too.
