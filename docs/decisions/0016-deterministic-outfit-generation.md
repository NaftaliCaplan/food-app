---
status: accepted
date: 2026-08-24
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Replacing AI-based outfit selection with a deterministic enumerator + scorer removes an entire class of recurring bugs (missing categories, duplicate items, wrong-color tips) at the root — those mechanisms existed only to validate an unreliable process after the fact, and a constructive generator can't produce an invalid or duplicated result in the first place.
tc-category: reliability
tc-conditions: Holds as long as `generateOutfit` continues to derive its result from `selectBestOutfit` (which enumerates from the actual filtered pool) rather than reintroducing any AI-generated item-selection path. If profile personalization is added later, it should extend the scoring/enumeration model rather than reintroducing free-form AI selection.
tc-signals:
  - regression-prevention
  - reduced-change-scope
tc-confidence: 4
---

# Deterministic Outfit Generation — Removing AI From Selection and Tip-Writing

## Context and Problem Statement

A fifth live-test round (after laundry status, the temperature slider, and the color/pattern re-ranking of ADR 0015) reported: tagging accuracy still poor enough to call the vision model "abysmal" for this use case (frequent "navy sweater" over-tagging, shorts misclassified as pants); a real duplicate-item bug (same item rendering twice, causing a React duplicate-key warning); crocs appearing in a smart-casual outfit; a hat that a better-looking alternative existed for but wasn't picked; and a recurring tip-text bug — a navy shirt described as "a black t-shirt" — that turned out to be a *different* root cause than the one fixed in ADR 0009 (that fix only helped when duplicate items competed for a capped slot; here there was only one top, and the AI simply wrote the wrong color).

The user's read, discussed at length before any code changed: the app's UI/UX is solid and usable, but the AI backend for both tagging and outfit generation is the actual bottleneck, and prompt-tuning it further has diminishing returns. Two directions were discussed — a bigger/different model, or removing AI from outfit generation's decision-making entirely in favor of deterministic rules built on top of what's already been built (category/style filtering, duplicate caps, color/pattern scoring). The user chose the latter.

## Decision Drivers

* A coupling check confirmed the blast radius was small: `outfitService.ts` exported only `GenerateOutfitOptions` and `generateOutfit()`; the only caller was `useOutfitGenerator.ts`, whose only consumer was `OutfitResultsScreen.tsx`, which only ever read `.items` and `.recommendation` off the result. Both of those call sites' tests were already mocked at a level fully decoupled from `outfitService`'s internals.
* Outfit generation never looked at photos — it only ever reasoned over the same tags a deterministic engine would read. Removing the AI doesn't lower the ceiling on tag-quality-driven errors; it makes them traceable (a bad pick can be traced to a specific tag and fixed by hand) instead of opaque.
* `capDuplicateCategories` was found to be the root cause of the reported duplicate-item bug: it deduped by category *count*, not by identity, so an AI response that echoed the same id twice could put the same `WardrobeItem` in the output array twice. Fixed immediately regardless of the bigger decision, since the function was going to be reused either way at the time.
* A hard requirement carried over from ADR 0014: never turn a possibly-wrong AI/manual tag into a hard exclusion. Temperature was explicitly required to become a *soft* score, not a filter.
* Two implementation gaps were found only by actually building the enumerator, not anticipated in the original plan: (1) a pure-penalty score can never make a 2-top layered look beat the better single top alone, since adding any item can only tie or add risk — layering would be structurally dead on arrival without a fix; (2) a naive "reward any clash-free 2-top pairing" rule would reward two flat t-shirts worn together just as much as a genuine cardigan-over-a-tee look, since color/pattern penalties say nothing about which garment can function as an outer layer.

## Considered Options

* Keep some AI involvement (a small call just to write the tip, given the already-chosen items) vs. remove it entirely and template the tip.
* Accessory selection: full subset enumeration vs. a greedy add-if-it-doesn't-hurt approach.
* Layering: drop 2-top pairing entirely vs. a weak heuristic on existing weight tags vs. a new manually-set "outerwear" tag.
* Rejected-combination memory: permanent blacklist (today's behavior) vs. a rolling window.

## Decision Outcome

**AI removed entirely**, including tip-writing. The user's reasoning: the tip is already so templated in practice that free-form generation wasn't buying much, and removing it eliminates the wrong-color-tip bug class structurally rather than mitigating it (a validator was considered and explicitly rejected as "a patch, not the root fix" earlier in this same line of work — see ADR 0009's fourth follow-up for that precedent).

**Accessories: greedy.** `addAccessoriesGreedily` adds one accessory at a time, always picking whichever remaining accessory ties or improves the running score, stopping once none do. Deliberately uncapped — matches the original "as many as make sense, don't force it, don't artificially cap it" intent — but avoids the combinatorial blowup of enumerating every subset (2^n for n accessories).

**Layering: a new manually-set `outerwear` tag**, not a heuristic on existing weight tags. The user explicitly wanted this to *not* also block solo selection of an outerwear-tagged item (a jacket worn alone is completely normal) — already true by construction, since the enumerator's `slotVariants` unconditionally includes every single-item variant regardless of tags; the `outerwear` tag only ever gates the *layering bonus*, never eligibility. It's deliberately excluded from the AI tagging prompt (manual-only) — the same reasoning as the deferred "material" tag idea: this is exactly the kind of judgment call the user didn't want left to AI guessing.

**Layering bonus mechanics**: `scoreOutfitAesthetics` gained a small (`0.5`) negative penalty applied only when there are exactly 2 tops, the outfit is otherwise completely clean (`penalty === 0`), and at least one of the two tops carries the `outerwear` tag. Without this, layering would never be selected at all under a pure-penalty score, since a second item can only tie or add risk — this was found by reasoning through the design, not requested, and is disclosed here rather than shipped silently.

**Rejected-set memory: a rolling window of the last 3**, not a permanent blacklist. The user's framing: with full enumeration, a small wardrobe can have very few genuinely good options, and permanently blacklisting each one after a Try Again could exhaust all of them within a handful of presses, leaving nothing but worse options for the rest of the session — "it might be a solid outfit but not the vibe right then" should be able to resurface later. Implemented in `useOutfitGenerator.ts` as `.slice(-MAX_REMEMBERED_REJECTIONS)`.

**`selectBestOutfit`'s rejection fallback**: if honoring `rejectedIdSets` would leave zero candidates at all (a very small wardrobe with only one truly valid combination), it's ignored rather than the function returning nothing — a repeat of the same outfit beats an error.

**`generateOutfit` is no longer `async`.** There's no network call left anywhere in this path, so it's a plain synchronous function now. `useOutfitGenerator.ts`'s `await generateOutfit(...)` needed no changes — `await` on a non-Promise value resolves immediately, which is standard JS/TS behavior.

**Explicitly not addressed here:**
* Profile personalization (skin tone/height/build) — this was already prompt-text-only with zero code-side effect before this change, so nothing was lost, but there's still no deterministic equivalent. Deferred; the user's own suggested direction is to eventually make it a proper tagging dimension rather than hand-written proportion rules, not attempted now.
* The "crocs for smart-casual" complaint — traced during this work to `filterByStyle`'s universal casual-passthrough rule (any `casual`-tagged item passes the filter for *any* requested style, a deliberate ADR 0009 decision from when tagging was far less reliable). Confirmed as the actual explanation, not a new AI-judgment failure, but not changed in this decision — flagged as a good candidate for revisiting now that tagging has improved.
* Tagging/scanning accuracy itself — out of scope; this decision only concerns outfit *generation*, which never looked at photos in the first place.

### Consequences

* Good, because an entire class of bugs is now structurally impossible rather than mitigated: missing categories, duplicate items, and tip text that doesn't match the actual items can't occur, because nothing is validated after the fact — every result is built to be correct from the start.
* Good, because every remaining behavior (which outfit "won," why an accessory was or wasn't added, why a tip says what it says) is fully traceable and debuggable, unlike an opaque model call.
* Good, because outfit generation now has zero latency and zero ongoing Cloudflare cost for this feature — it's pure local computation.
* Neutral, because tip quality is now categorically more limited — a handful of templated rules instead of free-form prose. Always accurate, never insightful beyond what's explicitly encoded.
* Neutral, because the color/pattern/temperature rules (and now the layering bonus and outerwear gating) are an increasingly large surface of hand-encoded taste — reasonable people could disagree with specific choices, and there's no way to verify they're "correct," only that they're consistently applied.
* Bad, because personalization has no path forward yet, and the casual-passthrough behavior that's directly implicated in at least one live complaint was left unchanged.

### Confirmation

New pure modules with full unit coverage: `outfitCandidates.ts` (`selectBestOutfit` — 12 tests: null on an empty/accessory-only pool, complete-outfit construction, graceful category omission, color-clash avoidance, greedy accessory add/reject, `includeAccessories` exclusion, layering gated correctly on the `outerwear` tag both ways, rejection fallback to next-best and to ignoring rejections entirely when nothing else exists, temperature-driven tie-breaking); `outfitRecommendation.ts` (`buildRecommendation` — 6 tests covering the layering/weather/accessory/generic branches); `outfitAesthetics.ts` extended (10 new tests: temperature penalty thresholds, the layering bonus gated on `outerwear`, magnitude sanity checks against existing penalties). `outfitService.ts` fully rewritten (11 tests, orchestration-focused since the deep logic is covered elsewhere) and `useOutfitGenerator.ts` gained a dedicated rolling-window test. `tagVocabulary.ts`/`WardrobeItemForm.tsx` gained the `outerwear` curated tag (top-only) with 2 new tests confirming it coexists with fit/weight tags and doesn't appear for bottoms. Full suite: 30/30 suites, 228/228 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* Profile personalization has no deterministic implementation and no clear design yet.
* The casual-passthrough-causes-crocs-in-smart-casual issue is understood but unchanged.
* Tagging/scanning accuracy (the vision model's classification quality) is unaffected by this decision and remains the other half of the user's "AI backend is the bottleneck" assessment.
* The hand-encoded aesthetic rule set (color clashes, busy patterns, layering, weight-vs-temperature) will keep growing in an ad hoc way as new complaints surface; no structural plan exists yet for organizing or validating that growth beyond "add another rule, write a test for it."
