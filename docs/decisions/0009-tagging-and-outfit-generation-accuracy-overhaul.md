---
status: accepted
date: 2026-07-26
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Real color detection plus structural (code-level) guarantees for category coverage give the outfit generator actual signal to reason about and a hard floor it cannot fall below, instead of hoping prompt wording alone produces varied, complete, correctly-styled results — this should meaningfully reduce the "everything comes back casual, same 3 items, outfit missing a bottom" failure pattern reported in live testing.
tc-category: accuracy
tc-conditions: Holds as long as the AI response schema keeps colors/category/style as their own dedicated fields (not folded back into free-form tags), and as long as `filterByStyle`'s candidate pool remains the source of truth `outfitService.ts` draws guaranteed-fill items from — if the candidate-pool filtering logic changes shape, the guarantee-fill logic needs to be re-verified against it.
tc-signals:
  - regression-prevention
  - interface-stability
tc-confidence: 3
---

# Tagging and Outfit-Generation Accuracy Overhaul

## Context and Problem Statement

A second round of live device testing (after the ADR 0008 fixes made saves actually work) surfaced that the AI tagging and outfit generation were far less accurate than the earlier fixes assumed. Nearly every wardrobe item came back tagged "casual" regardless of what it actually was (a collared polo, khakis), the outfit generator repeatedly returned the same 2-3 items despite ten available, outfits were missing categories (no bottom) even though matching items existed and were tagged, and a computer mouse got classified as an "accessory." The user's own diagnosis, which turned out to be correct: the tagging system wasn't extracting enough distinguishing signal per item — "muted, solid, casual" on almost everything gives neither the style-classifier nor the outfit-generator anything real to reason about or match on.

## Decision Drivers

* The original design (ADR 0002, ADR 0003) deliberately avoided literal color-name tags because a colorblind user can't independently verify "this is red" the way they can verify "this is striped" — but zero color signal also meant the AI itself had almost nothing to differentiate items by, which is a real cost that had not been weighed against the verification concern until this session
* "If genuinely unsure, pick casual" in the style prompt was over-triggering — the model was defaulting to the easy answer rather than making its best garment-type judgment, e.g. never noticing a collar
* A hard "2-5 items" cap on outfit size doesn't fit a fully-accessorized outfit (top + bottom + shoes + hat + bag can already be 5 items before any style consideration)
* Prompt-only instructions ("you must include a bottom") had already proven unreliable once for the style-tag contradiction (ADR 0008) — the same unreliability was now showing up for category completeness in outfit generation, suggesting the same fix pattern (code-level guarantee, not just stronger wording) should apply again
* `isClothing`'s furniture/sticker examples weren't specific enough to stop small handheld objects (a computer mouse) from being misclassified as a wearable "accessory"

## Considered Options

* Color tags: keep avoiding color names (status quo) vs. add real color detection as a dedicated field and show it as a normal tag vs. detect colors but keep them internal-only (not user-facing)
* Missing outfit categories: strengthen prompt wording only vs. add a validate-and-retry step (already done in ADR 0008 for category presence) vs. add a hard structural guarantee that back-fills from the candidate pool in code
* Outfit item count: keep a fixed range vs. let the wardrobe/style goal determine size with no fixed cap

## Decision Outcome

**Color tags** — chose to add real color detection as a dedicated `"colors"` field in the AI response and expose it as a normal, visible, editable tag (user's explicit choice, flagged as a reversal of prior policy before implementing). The reasoning that won out: the original "colorblind users can't verify color tags" concern is about *trust in an unverifiable guess*, but the user can already edit/remove any tag today regardless of whether they can independently verify it (same as they already can't fully verify pattern/texture calls without close inspection) — and the cost of *not* having color data (a matching system with almost no signal) was worse in practice than the unverifiable-tag risk.

**Tagging priority order** — restructured the prompt so color detection of the garment itself (explicitly not the background) comes first, before category, name, and style, matching the user's own diagnosis that color should anchor identification since it's the primary signal people actually use to match an outfit. Names were also allowed to include the color now (e.g. "navy sweater") since that's both simpler and more natural than the prior color-avoidant naming scheme.

**Style classification** — rewrote the style step to judge by garment *type* first ("does it have a collar, buttons, or structured tailoring?") rather than "vibe," restricted the casual bucket to true plain basics, and removed the "if unsure, pick casual" escape hatch in favor of "make your single best guess based on what the garment actually is."

**Non-clothing detection** — added an explicit rule that small handheld electronics/gadgets (phones, computer mice, remotes, keys) never count as accessories just because they're small; only things clearly designed to be worn on the body do.

**Outfit category completeness** — extended the ADR 0008 validate-and-retry mechanism with a hard structural guarantee: if a required-and-available category is still missing after the one retry, the code now back-fills one item of that category directly from the candidate pool before returning, rather than shipping an incomplete outfit and hoping the model does better next time. Accessories also became required-if-available (not just optional) whenever the user has the "include accessories" toggle on — the toggle wording ("let suggestions add...") implies an actual attempt, not just permission.

**Item count** — removed the fixed "2-5 items" cap entirely; the prompt now describes the actual requirement (one top/bottom/shoes when available, plus as many genuinely-fitting accessories as make sense) and explicitly allows both a minimal 2-item outfit and a 6+ item fully-accessorized one.

### Consequences

* Good, because the outfit generator now has real per-item signal (actual colors) instead of relying on 3-4 vague, largely-identical buckets across most of a wardrobe.
* Good, because a missing required category can no longer make it into a returned outfit when the wardrobe actually has one available — this is now a code-level guarantee, not a hope.
* Good, because outfit size is no longer artificially capped below what a real accessorized outfit needs.
* Neutral, because color tags reverse a documented accessibility design choice from ADR 0002/0003 — flagged explicitly to the user before implementing, not decided unilaterally.
* Bad, because the tagging prompt now asks for one more field (`colors`) and one more upfront reasoning step, which is unverified against actual token/latency cost at the time of writing (no truncation issues observed yet, but not load-tested).
* Bad, because style-classification quality still ultimately depends on an 11B vision model's actual judgment — sharper prompt anchors (collar detection, garment-type-first) should help, but this doesn't guarantee every item will now be classified correctly; it's a probabilistic improvement, not a fix with a ceiling of 100%.

### Confirmation

Added test coverage for every new mechanism: `tagService.test.ts` gained color-tag merging/deduplication/normalization/fallback-path tests (13 tests total now); `outfitService.test.ts` gained tests for the structural guarantee-fill (both the "AI never includes an available category, even after retry" case and the "accessory required-if-toggled" case), replacing three tests that had encoded the old best-effort-only behavior as their expectation. Full suite: 22/22 suites, 156/156 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* Style-classification accuracy is still fundamentally bounded by the underlying vision model's judgment; sharper prompting narrows the failure rate but doesn't eliminate it. If misclassification remains common after this round, the next lever discussed with the user (deferred, not yet explored) is trying a larger/different vision model on Cloudflare Workers AI.
* The "outfit keeps returning the same 2-3 items across separate (non-rejection) generate calls" complaint is expected to improve as a side effect of richer tags giving the model more to differentiate on, but no dedicated anti-repetition mechanism was added — `rejectedIdSets` still only tracks rejections within one Try-Again session, not across separate builds, by design.
* Color detection accuracy itself (is "navy" actually navy, not black) is unverified beyond the mocked unit tests — real-world accuracy depends on the same vision model and hasn't been checked against a battery of real photos.
