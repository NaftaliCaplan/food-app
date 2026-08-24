---
status: accepted
date: 2026-08-23
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Generating 3 independent candidates and deterministically re-ranking them by a real color/pattern compatibility model gives outfit selection an actual, testable notion of "better," rather than trusting the first thing the AI returns to reflect good style judgment.
tc-category: accuracy
tc-conditions: Holds as long as `generateOneOutfit`'s single-candidate behavior (retry, category guarantee-fill, laundry/temperature handling) stays a self-contained building block that `generateOutfit` calls repeatedly, and as long as `scoreOutfitAesthetics` stays a pure function of item tags with no side effects — if either changes shape, the candidate-count/scoring math in tests needs re-deriving.
tc-signals:
  - regression-prevention
tc-confidence: 3
---

# Color/Pattern Aesthetics Scoring + Multi-Candidate Re-Ranking

## Context and Problem Statement

User's diagnosis of persistently poor outfit choices (e.g. a slides-vs-sneakers shoe pick that felt arbitrary): the AI is given almost no explicit fashion-pairing knowledge to reason with today — each item is just `[id] category (name) — tags: ...`, and the prompt's only instruction is "pick items that work well together for this style." There's no color theory, no pattern-mixing guidance, nothing — the model is relying entirely on its own untuned, generic sense of style. The user explicitly wants to move away from leaving this to the AI's judgment and make selection more concrete wherever reasonably possible, while having already ruled out (in ADR 0014, for a different reason) a full hard-exclusion approach given past tagging-reliability problems.

## Decision Drivers

* Prompt-only fixes for outfit-generation judgment have already been tried multiple times this project (grounding instructions, style-alignment nudges) and consistently landed as "nudge, not guarantee" — the user wants a code-level mechanism this time, not another prompt tweak
* A hard candidate-pool filter based on color/pattern tags would repeat the same brittleness risk already flagged in ADR 0014 (tag data reliability) — but re-ranking *already-complete* AI-generated outfits against each other doesn't carry that risk, since nothing is ever excluded, only compared
* This project's structural-guarantee pattern (category completeness, duplicate caps, laundry exclusion) has so far only covered objectively-checkable invariants (counts, category membership) — color/pattern "goodness" is inherently a matter of convention/taste, not a strict invariant, so the scoring rules are explicitly an opinionated heuristic, not a guarantee of quality
* Cost/latency: each additional candidate is one more text-only Cloudflare call (cheap relative to the vision-tagging calls), but not free — the user asked to weigh whether the added cost was likely worth it before committing to the multi-candidate approach

## Considered Options

* Scope of the compatibility rules: color only vs. color + pattern vs. color + pattern + fit/silhouette balance
* How to use the score: hard-filter candidates below a threshold vs. generate N candidates and pick the best-scoring one vs. use it purely as a post-hoc validator that triggers a prompt retry
* Model swap (a larger/different LLM for outfit generation) as an alternative or complement to explicit rules

## Decision Outcome

**Rule scope**: color and pattern compatibility only. Fit/silhouette balance (e.g. "pair a loose top with a fitted bottom") was proposed and explicitly rejected by the user — they pushed back that a loose top with fitted bottom is often not the more expected pairing, and that two loose pieces are not reliably sloppy — so unlike color-clash and pattern-mixing (which have well-established, less contested conventions), fit-balance rules didn't have confident-enough grounding to encode as a penalty.

**Mechanism**: `generateOutfit` now generates `CANDIDATE_COUNT = 3` independent candidate outfits (each via the full existing single-candidate pipeline — retry, category guarantee-fill, laundry exclusion, temperature context — extracted unchanged into a private `generateOneOutfit`) and returns whichever candidate scores lowest (best) on `scoreOutfitAesthetics`. Each successive candidate is asked to avoid every combination generated so far, reusing the exact same `rejectedIdSets`/`CONSTRAINTS` mechanism the user-facing "Try Again" flow already uses for real rejections — without this, the model tends to return the same handful of items across separate calls (a repetition pattern already observed with real Try-Again presses), which would make ranking 3 near-identical candidates pointless.

**Scoring** (`src/utils/outfitAesthetics.ts`): colors are split into a neutral set (black/white/gray/navy/tan/khaki/brown, which pair safely with anything including each other) and an accent set (everything else in the existing 16-color vocabulary). Penalty accrues for more than one distinct accent color present (the "one accent color, let neutrals do the rest" convention), with an extra penalty for a small curated list of specifically-clashing accent pairs (e.g. red+green) — deliberately not pure color-wheel complementary theory, which doesn't map cleanly to clothing. A second, independent penalty applies when 2+ "busy" patterns (striped/plaid/checked/floral/graphic) appear together; `solid` and `textured` are excluded from that count since they don't compete visually with other patterns. This is explicitly a heuristic nudge for choosing between already-valid candidates, not a hard filter — it never excludes an item or blocks generation.

**Model swap**: explicitly declined for now, both for cost and because it addresses the wrong bottleneck right now — the model currently has zero domain guidance to work with, so its judgment quality can't be fairly evaluated yet. Logged as the next lever to reconsider specifically if quality problems persist on dimensions the color/pattern rules can't address, once this round has had a chance to work.

### Consequences

* Good, because outfit selection now has an actual, deterministic, testable notion of "which of these options is better," instead of trusting whichever the AI returned first.
* Good, because nothing is ever hard-excluded — a wrongly-tagged color/pattern can make one candidate score worse than it should, but can never make an item unselectable, unlike the hard-exclusion approach declined in ADR 0014.
* Neutral, because this adds real latency and cost: up to 3× the text-only Cloudflare calls per generation (each candidate can still internally retry once for category completeness, so worst case is 6 calls instead of 2). Outfit generation already showed a loading state for the single-call case, and the user weighed and accepted this cost before proceeding.
* Bad, because the color/pattern rules are an opinionated model of taste encoded in code — reasonable people could disagree with specific choices (e.g. which pairs count as "clashing"), and unlike category-count guarantees, there's no way to verify these rules are "correct," only that they're consistently applied.
* Bad, because fit/silhouette balance — a real styling consideration — is left entirely unaddressed after being explicitly discussed and dropped; if it resurfaces as a complaint, the color/pattern precedent here doesn't automatically extend to it, since the user's specific objection was to the *rules themselves*, not the mechanism.

### Confirmation

Added `outfitAesthetics.test.ts` (9 tests: neutral-only outfits score 0, a single accent color is fine, multiple distinct accents are penalized, a repeated single accent color is not, a known-clashing pair scores worse than an arbitrary two-accent combo, busy-pattern mixing is penalized, a busy pattern paired with solids is not, `textured` isn't treated as busy, tag matching is case-insensitive). Updated all call-count assertions across `outfitService.test.ts` for the new ×3 candidate multiplier, and added 2 new tests specifically for the ranking behavior (a lower-scoring candidate among 3 distinct ones wins even though it wasn't first; a later candidate's outright failure doesn't prevent returning an earlier successful one). Full suite: 28/28 suites, 218/218 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* Fit/silhouette balance was discussed and deliberately left unimplemented — not because it's unimportant, but because the specific rules proposed didn't hold up to the user's own styling instincts. Revisit only with better-grounded rules, not the same "loose pairs with fitted" framing.
* The curated clashing-color-pair list and busy-pattern set are both small, hand-picked lists — like the curated tag vocabulary (ADR 0010), these are a separate hand-maintained source of truth from anything else in the app, with the same drift risk if the underlying color/pattern tag vocabulary changes.
* A bigger/different model for outfit generation remains a deferred lever, to be reconsidered specifically if quality issues persist on dimensions outside color/pattern after this round is live-tested.
