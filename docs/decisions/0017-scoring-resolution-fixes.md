---
status: accepted
date: 2026-08-25
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Three targeted fixes to the deterministic outfit-generation engine (ADR 0016) close a connected set of live-test findings that all traced back to one root cause — the scoring function had too few real signals, causing frequent exact ties, which fell back to an arbitrary and meaningless tie-break (wardrobe scan order).
tc-category: accuracy
tc-conditions: Holds as long as selectBestOutfit continues to break ties by (1) score, (2) fewest total items, (3) random — in that order. If a future scoring dimension is added, verify it doesn't silently reintroduce a scan-order bias by skipping the random tie-break step.
tc-signals:
  - regression-prevention
tc-confidence: 4
---

# Scoring Resolution Fixes: Tie-Breaking, Style Match, Accessory Slots

## Context and Problem Statement

First live-test round of the fully-deterministic engine (ADR 0016) surfaced three connected problems, diagnosed live with the user during testing:

1. **The same non-top items kept winning regardless of style category selected**, and casual items kept appearing even when genuine style-matching alternatives existed in the wardrobe.
2. **Two hats could be selected in the same outfit** — accessories have no notion of "slot," so nothing stopped the greedy algorithm from adding two of a physically-exclusive item type.
3. **"Try Again" only ever changed the top**, cycling through tops until the rejection window cleared and then repeating — bottom/shoes/accessories always landed on the same choice no matter what.

The user's own diagnosis, arrived at by testing (moving an item to a different style category to see if *anything* about the outcome changed) was the key insight: changing an item's tags didn't change which item got picked, unless the tag change made the item ineligible outright. That, combined with "bonuses are too easy and negatives are too minimal," pointed to the actual root cause: the scoring function's rule set is narrow enough that many candidates land on an *exact* tie, and `Array.prototype.sort`'s stability meant ties were always resolved by whichever candidate happened to be enumerated first — which follows wardrobe scan/add order, a value with zero connection to outfit quality. Tags "not mattering" was really ties not being decided by anything meaningful at all.

## Decision Drivers

* The user explicitly asked to have the *judgment calls* in these fixes (not just the mechanism) checked before implementation, per the collaboration process established the same day — specifically the style-mismatch penalty's magnitude, and how much to invest in the accessory-slot problem.
* `filterByStyle`'s casual-passthrough rule (ADR 0009) needed to stay unchanged as an *eligibility* mechanism — a small wardrobe still needs casual as a real fallback — but nothing was making genuinely-matching items *win* over that fallback when both existed.
* The layering bonus (ADR 0016) and greedy accessory addition both already tolerated ties in the scorer's favor (added on any non-worsening outcome), which compounds the same underlying resolution problem rather than being a separate bug.

## Considered Options

* Style-mismatch penalty magnitude: same tier as weight/temperature (+1) vs. same tier as a color clash (+2)
* Accessory-slot conflicts: a real manually-set type tag (mirroring the `outerwear` precedent) vs. a simple total-accessory-count cap
* Tie-breaking: leave as-is vs. randomize all ties vs. a tiered approach (score, then simplicity, then random)

## Decision Outcome

**Style-mismatch penalty: +2, same tier as a color clash.** The user's reasoning: casual should really only be a fallback, not competitive with a genuine match — a lighter +1 could still lose to a casual item with better colors, which wouldn't fully fix the reported problem. Implemented in `scoreOutfitAesthetics` as a new optional `stylePrefs` parameter: for every item whose own style tag doesn't appear in the requested style list, add +2 — including casual items, when the request isn't literally 'casual'. No penalty at all when no style was requested (matching `filterByStyle`'s existing behavior of only letting casual through in that case, where penalizing it would be self-defeating).

**Accessory slots: a real manually-set `TYPE` tag**, not a count cap. The user explicitly rejected the cap as "too restrictive" — a hat + belt + watch is completely normal, and a blunt total cap would prevent that while not even specifically fixing the two-hats case. New curated tag group (`ACCESSORY_TYPE_TAGS`: hat/belt/bag/watch/scarf/jewelry), manual-only and never AI-suggested — same reasoning as `outerwear`: this is exactly the kind of judgment the user doesn't want left to AI guessing. `addAccessoriesGreedily` now tracks which types are already in the outfit and skips any remaining accessory whose type is already filled. Untyped accessories (existing wardrobes, or anything the user hasn't gotten around to tagging) remain slot-less and stack freely, exactly as before — no regression for anyone who doesn't use the new tag.

**Tie-breaking: three tiers — score, then item count, then random.** Score is the primary signal (unchanged). Among score ties, the candidate with *fewer total items* wins — this is what keeps the `outerwear`-gating guarantee intact (a 2-top pairing that merely ties a single top, with no bonus earned, must never win the tie; it needs to be a strict score improvement). Only among candidates tied on *both* score and item count does the final tie-break become genuinely random — replacing the previous silent, meaningless "whichever was scanned first."

### Consequences

* Good, because the connected symptom set (casual sliding in, two hats, retry only touching the top) all trace to real, fixed causes rather than needing separate ad hoc patches.
* Good, because `selectBestOutfit`'s output is no longer secretly a function of wardrobe entry order — a real bug that was invisible until the user specifically tested for it.
* Good, because the accessory-type fix follows the same low-risk pattern as `outerwear`: manual-only, opt-in, no regression for anyone who ignores it.
* Neutral, because `selectBestOutfit` is no longer purely deterministic given identical inputs (true ties now resolve randomly) — this is intentional, matching the user's ask that "Try Again" produce real variety, but is a deliberate departure from ADR 0016's "fully deterministic" framing worth noting if it's ever surprising.
* Bad, because the underlying diagnosis ("not enough negative signals, bonuses too easy to earn") is only partially addressed — these three fixes target the specific reported symptoms, not a general expansion of the scoring rule set. More live testing may surface further thin-resolution cases (e.g. the persistently-recurring "slides + plaid pajamas + olive hat" combination flagged during this same round, which wasn't traced to a specific rule gap and is left as an open question).

### Confirmation

Extended `outfitAesthetics.test.ts` (6 new tests: style match/mismatch, no-penalty-when-no-style-requested, casual-matches-casual-request, penalty magnitude equals the color-clash tier, casual loses to a genuine match). Extended `outfitCandidates.test.ts` (6 new tests: style preference threading, same-type accessory conflict, different-type accessories both allowed, untyped accessories unaffected, random tie-break via mocked `Math.random`, simplicity-before-randomness ordering). Extended `WardrobeItemForm.test.tsx` (1 new test: TYPE section only for accessories) and `outfitService.test.ts` (1 new integration test: style preference flows all the way through from `generateOutfit`). All 228 pre-existing tests continued passing unchanged — notably including the outerwear-layering tests, confirming the item-count tie-break tier correctly preserves that guarantee under the new random tie-breaking. Full suite: 30/30 suites, 242/242 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* The recurring slides/plaid-pajamas/olive-hat combination remains unexplained by any specific rule gap; flagged for continued observation, not acted on here.
* `selectBestOutfit` is no longer strictly deterministic for identical inputs (true ties resolve randomly) — a deliberate, disclosed departure from ADR 0016's framing, not itself a problem, but worth remembering if test flakiness or "why did this change with no code change" questions come up later.

## Follow-up: compound color tags were making the scorer color-blind, plus a much larger clash-pair list (2026-08-25)

Live testing of the fixes above surfaced two further findings, both traced to specifics rather than guessed:

**Compound color tags made scoring blind to the color entirely.** The user re-tested with an item they'd manually labeled exactly `pink` — and it still appeared next to a clashing green item. Investigating traced this to a *different* item earlier in the same session that had been auto-tagged "neon pink" by the AI: `buildTagPrompt`'s STEP 1 example list included `"olive green"` as a valid color description, which is a two-word phrase — the model tends to follow the shape of its own examples, so it regularly returned similar multi-word phrases (`"neon pink"`, `"bright red"`) for other items. `mergeColorTags` then converted the whole phrase to a single hyphenated tag (`"neon-pink"`), which never matches anything in the single-word `COLOR_TAGS` vocabulary `scoreOutfitAesthetics` checks against — the item's color became completely invisible to color-clash scoring, contributing nothing to any penalty. Two-part fix: (1) `buildTagPrompt`'s STEP 1 now gives the model the closed 16-word canonical list directly and explicitly forbids multi-word/modified descriptions; (2) `mergeColorTags` no longer trusts the model to comply — `normalizeColor` extracts every canonical color word that actually appears inside whatever phrase comes back (`"olive green"` → both `olive` and `green` as separate tags), falling back to the old hyphenated-phrase behavior only if the phrase contains no recognizable canonical word at all. This is the same established pattern in this project: prompt wording alone isn't trusted, the code enforces it structurally.

**The re-tested `pink`-vs-`green` case, once the tag was genuinely correct, showed a second, separate gap**: pink+green isn't in the original 6-pair `CLASHING_COLOR_PAIRS` list, so it only incurred the generic +1 "multiple accent colors" penalty, not a real clash penalty — often not enough to outweigh whatever else made that combination look "cheapest" elsewhere. The user asked directly why this wasn't derived from color-wheel theory instead of hand-curation — worth recording the answer: complementary-color theory (opposite hues = strongest pairing) actually gets the flagship case backwards (red+green is complementary yet universally read as a clash, not a match), because wheel geometry has no model for proportion, saturation, or cultural association, which are what actually decide whether two garments clash. The list stays hand-curated, deliberately. Expanded from 6 to 13 pairs after walking through all 36 accent-accent combinations for common styling convention: added `pink`+`green` (the confirmed case), `red`+`purple`, `red`+`yellow`, `orange`+`yellow`, `orange`+`green`, `yellow`+`pink`, `purple`+`green`. Popular/classic combos (`red`+`blue`, `orange`+`blue`, `pink`+`blue`, `pink`+`purple`, `yellow`+`blue`, `blue`+`green`) were deliberately left unflagged — boldness isn't clashing.

Verified via: `tagService.test.ts` (2 tests — extracts both canonical words from a compound phrase; falls back to a hyphenated phrase only when no canonical word is recognizable at all), `outfitAesthetics.test.ts` (13 new tests — the 7 new clash pairs individually, plus parameterized checks that the 6 deliberately-not-flagged classic combos still score only the baseline 2-accent penalty). Full suite: 30/30 suites, 256/256 tests, `tsc --noEmit` clean (0 errors).

## Follow-up: layering required only "at least one" outerwear top, and accessory type became AI-suggested (2026-08-25)

Continued live testing on the round above found two more things:

**Layering allowed two outerwear pieces stacked with no base layer.** The condition was "at least one of the two tops is tagged `outerwear`," which also lets *both* be outerwear — the user found real cases of two sweaters (or a jersey and a sweater) pairing up, technically satisfying the check while having no actual base layer underneath, which isn't what layering means. Changed to require *exactly* one outerwear-tagged top: `outerwearCount === 1`, not "some." This isn't really a taste call the way the color list was — it's a definitional correction of what layering actually requires (one base + one outer, never outer-on-outer), so it was implemented directly rather than treated as an open judgment call.

**Accessory type (`hat`/`belt`/`bag`/etc.) became AI-suggested**, reversing the manual-only design from earlier in this same ADR. The user hit the two-hats problem again, traced it to their own workflow (a re-added item hadn't had the type tag re-checked), and asked whether this should just be automated given how integral it is. Agreed, for a reason specific to this tag and different from `outerwear`: classifying "is this a hat or a belt" is a concrete visual judgment the model is reasonably reliable at — much closer to category/style classification (already AI-suggested) than to `outerwear`'s genuinely subjective "does this function as an outer layer" call. Just as importantly, the failure mode is safe: a wrong or missing guess just makes the item slot-less, which is already today's default for anything untagged — there's no way for an AI mistake here to actively break an outfit the way a wrong style tag could. `buildTagPrompt`'s STEP 4 now asks for a type guess for accessories (reusing `ACCESSORY_TYPE_TAGS` so the AI's vocabulary and the curated picker's stay identical), folded into the plain `tags` array via the existing STEP 6 instruction — no new JSON field or merge logic needed, since it behaves exactly like pattern/brightness/material already do. Still fully overridable via the curated picker. `outerwear` remains manual-only — the reasoning that justified moving accessory type doesn't apply to it.

Verified via: `outfitAesthetics.test.ts` (1 test — two outerwear-tagged tops together get no bonus), `tagService.test.ts` (2 tests — the accessory prompt includes the type options and other categories don't; an AI-returned type tag passes through as a plain tag). Full suite: 30/30 suites, 259/259 tests, `tsc --noEmit` clean (0 errors).
