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

## Follow-up: reasoning hallucination, style-tagging ceiling accepted, category-aware attributes (2026-07-26)

A second round of live testing after the color-tag/guarantee-fill changes found tagging itself much improved (user's words: "colors seemed accurate," "scanning and tagging felt much better"), but outfit generation's free-text reasoning was fabricating details not grounded in the actual item data — describing a black hat as "green and tan," calling a wardrobe item tagged "plaid pajama pants" a "plaid jogger" in the outfit's own reasoning, and suggesting garments in the recommendation text that weren't among the selected items.

**Explored and rejected a fully-mechanical (code-templated) fix** for the reasoning text after the user asked what "mechanical" would concretely look like — shown a side-by-side example (AI prose vs. flat template output) and the tradeoff (guaranteed-accurate but reads like a spec sheet, no actual styling insight). User chose a middle ground instead: **keep the AI writing the prose, but constrain the format tightly** — every reference to a selected item in `reasoning`/`styleNotes`/`recommendation` must now quote that item's exact inventory name, with a concrete filled-in example embedded in the prompt itself (few-shot-style) rather than only an abstract instruction. This is explicitly *not* a guarantee — user directly and correctly challenged an earlier claim that prompt wording alone "forces" anything; only the code-level category guarantee-fill (see main decision above) is a real guarantee. The quoted-name constraint is a stronger *nudge*, not a fix with a ceiling of 100%.

**Investigated and deliberately dropped a "style-alignment enforcement" idea**: the reported "khakis added to a casual+sporty outfit" bug turned out not to be an outfit-generation defect at all — `casual`-tagged items are supposed to pass through into any style request as the universal base (by original design), and the khakis were tagged `casual` (not `smart_casual`) during scanning despite khakis being explicitly named as a `smart_casual` example in the prompt. A code-level "swap out style-mismatched items" would have had to treat casual-tagged items as mismatched, directly contradicting the intentional casual-passthrough design. Root cause is the same still-unsolved style-classification reliability gap already logged above, not a new bug — user chose to accept this as a known ceiling for now rather than pursue a third calibration attempt.

**Made per-category tag attributes explicit**: "fitted"/"loose" fit language was showing up on shoes tags (doesn't make sense for footwear). `buildTagPrompt`'s attribute step now branches on the passed-in category — top/bottom still get weight/fit language, shoes get material/closure-type language (canvas/leather/suede/athletic/slip-on/lace-up), accessories get material language (leather/metal/fabric/knit/woven).

Verified via: `tagService.test.ts` gained 3 tests asserting the actual prompt text sent to the model varies by category (not just that parsing works); `outfitService.test.ts` gained a test asserting the GROUNDING block and exact-name-quoting instruction are present in the prompt. Full suite: 22/22 suites, 160/160 tests, `tsc --noEmit` clean (0 errors).

## Follow-up: guarantee-fill had a real gap — style-filtered pool, not full wardrobe (2026-07-26)

A third live-test round (grounding fix confirmed working "at least largely") still found outfits sometimes missing a top. Root cause: `missingRequiredCategories()`'s "available" check only looked at the *style-filtered* candidate pool (`filtered`), not the full wardrobe. With a small wardrobe, it's entirely possible for zero tops to carry a tag matching the requested style (and not be `casual`), in which case `filtered` legitimately contains no top at all — the category is never flagged as missing (by original design, so as not to waste a retry asking the AI to select something it can't see), and the earlier guarantee-fill, which only searched `filtered`, never found anything to add either. The result: a genuinely-missing category could silently survive both the retry *and* the guarantee-fill.

Fixed by splitting the concern in two: the retry loop's correction-block logic still only considers `filtered` (asking the AI for something not in its own inventory listing would be pointless), but the *final* guarantee-fill now recomputes what's missing directly from `best.items` and, for each gap, tries `filtered` first and falls back to the full `wardrobe` if the style filter excluded every candidate of that category. Completeness intentionally wins over strict style-matching at this last-resort stage — a top that doesn't perfectly match the style goal is a better outcome than no top at all.

Verified via a new regression test (`falls back to the full wardrobe for a required category the style filter excluded entirely`) plus the existing 18 tests all still passing unchanged. Full suite: 22/22 suites, 161/161 tests, `tsc --noEmit` clean (0 errors).

## Follow-up: quote-collision bug found, then reasoning/styleNotes dropped entirely (2026-08-13)

Live testing surfaced that `reasoning` was rendering as just "The" (and `recommendation` as just "tuck") — a real bug, not another style-alignment ceiling. Root cause: the exact-name-quoting fix above (Follow-up, 2026-07-26) told the model to wrap quoted item names in double quotes inside its example (e.g. `"navy polo"`). Since the whole model response is itself JSON — which uses `"` as its string delimiter — the model dutifully followed the example literally and emitted embedded, unescaped double quotes inside a JSON string value. The regex fallback parser (`/"reasoning"\s*:\s*"([^"]+)"/`) stops at the first unescaped quote it finds, so text like `"reasoning": "The "navy polo" pairs with..."` was captured as just `"The "`. Fixed by switching the quoting convention from double quotes to single quotes (`'navy polo'`) in both the prompt's instructions and its example — single quotes need no JSON escaping and can't collide with the regex.

While confirming the fix, the user was asked whether to stop there or also revisit the screen now that the bug had already forced a look at this code path. Decision: do both. The user did not want the "why it works" reasoning or style-notes bullets at all going forward ("I feel like I would just want the outfit and maybe a tip, I don't really care that much") — this was a scope cut, not just a bug fix. `OutfitSuggestion` was simplified to `{ items, recommendation }` (removed `reasoning: string` and `styleNotes: string[]`), the prompt's schema and STEP numbering were simplified to match (selection step + one single-sentence "how to wear it" tip step), and `OutfitResultsScreen` dropped the "WHY IT WORKS" and "STYLE NOTES" sections, keeping only the item grid and the tip box.

This also fully resolves the "ghost pants" complaint from the same testing round (the reasoning text naming garments that weren't actually in the selected outfit) as a side effect — there's no more free-text description left to hallucinate into.

Verified via: updated fixtures/assertions across `outfitService.test.ts`, `useOutfitGenerator.test.ts`, and `OutfitResultsScreen.test.tsx` to match the trimmed `OutfitSuggestion` shape (removed all `reasoning`/`styleNotes` fixture fields and assertions). Full suite: 26/26 suites, 189/189 tests, `tsc --noEmit` clean (0 errors).

## Follow-up: tip mismatch traced to capDuplicateCategories, not hallucination (2026-08-13)

User reported a smart-casual outfit whose tip told them to tuck in "the khaki pants" while the actual generated outfit contained black pants instead. First reaction was to treat this as another instance of the still-unsolved reasoning-hallucination ceiling and patch it defensively (validate the recommendation post-hoc, fall back to a generic tip if it names something not in the final items). **User explicitly rejected patching the symptom and asked for the actual root cause** — correctly reasoning that if both khakis and black pants were genuinely offered to the AI, and the tip clearly names khakis, something in the code path between the AI's own selection and the final item list must have dropped the "right" one.

Reading `capDuplicateCategories` (added in ADR 0011 to cap `bottom`/`shoes` at 1 and `top` at 2) confirmed this as the actual root cause, not a guess: it trims duplicates within a capped category purely by **array order** — whichever duplicate happens to appear first in the AI's own `itemIds` list survives, with zero awareness of what the recommendation text says. If the AI listed black pants before khaki pants in `itemIds` (regardless of which one its own tip discusses), black pants would always win. This is a genuine code gap: the recommendation and the final item set were never actually connected to each other.

**Fix**: `capDuplicateCategories` now takes the recommendation text as a second argument and, when trimming a capped category down, prefers whichever duplicate the recommendation actually names (via the same single-quoted-exact-name convention already required by the prompt) over array order. Only falls back to array order when nothing in the recommendation names any of the duplicates — same behavior as before in that case, so this is additive, not a regression for the no-signal case. This directly ties duplicate-resolution to the AI's own stated intent instead of an arbitrary array position.

Deferred, not fixed here: the user separately noted the outfit also kept defaulting to slides over sneakers despite both being tagged casual — but attributed this (correctly, per earlier live-test rounds) to the model's own fashion judgment being weak, not a code bug, and explicitly said this is a "fix later" item: giving the AI real fashion-pairing reference material (rather than just tag overlap) to reason from. Logged as a new deferred task, queued after 45/46.

Verified via a new regression test (`keeps the duplicate bottom the recommendation actually names, even if it was listed second`) plus all 24 existing `outfitService.test.ts` tests still passing unchanged (the no-signal cap tests use an empty `recommendation`, so they exercise the unchanged array-order fallback path). Full suite: 27/27 suites, 198/198 tests, `tsc --noEmit` clean (0 errors).
