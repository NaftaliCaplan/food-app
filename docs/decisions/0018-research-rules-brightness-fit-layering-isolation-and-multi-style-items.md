---
status: accepted
date: 2026-08-31
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Translates the user's own handwritten styling research (color balance, fit/silhouette contrast, shoe coordination) into four new deterministic scoring signals, fixes a real scope bug in the layering bonus surfaced by that work, and reframes sleepwear/beachwear as genuine multi-valued style categories instead of a forced single slot — closing the gap where a plain t-shirt couldn't be tagged as both casual and beachwear.
tc-category: accuracy
tc-conditions: Holds as long as any future "sub-group" bonus (a bonus that should only look at part of the outfit, like layering) follows the isolated-baseScore pattern established here rather than gating on the whole outfit's total penalty. If StylePreference ever needs a third occasion category, the OCCASION section in OutfitBuilderScreen is designed to absorb it without a new UI pattern.
tc-signals:
  - regression-prevention
  - user-research-integration
tc-confidence: 4
---

# Research-Backed Rules, Layering-Isolation Fix, and Multi-Style Items

## Context and Problem Statement

The user shared a personal handwritten research document (color balance, skin-tone/undertone matching, height/build proportion, fit/silhouette contrast, shoe coordination, and formal-material conventions) and asked directly for design help turning it into buildable rules, rather than just having the notes reflected back. Separately, continued live testing of the deterministic engine (ADR 0016/0017) found that putting a pair of slides in the laundry silently stopped layering from ever triggering again — traced to the layering bonus being gated on the *whole outfit's* total penalty being zero, so an unrelated shoe issue could block a bonus that should only depend on how well the two tops paired with each other.

A separate, harder problem came out of the research discussion: how should items like pajamas or swimwear be represented at all? The user's first framing (sleepwear/beachwear as two new values in the existing single style slot) was self-caught mid-implementation as insufficiently flexible — "a t-shirt could be good for both," i.e. a single plain tee can legitimately be both `casual` and `beachwear` at once, which a mutually-exclusive single slot can never represent.

## Decision Drivers

* Per the collaboration process established in ADR 0017 (surface judgment calls, even small magnitudes, before implementing), the user was checked in with at each step: which research items were rule-worthy vs. too vague to encode, the build order for the four new signals, whether sleepwear/beachwear should be hard exclusions or their own categories, and the multi-select-everywhere decision itself.
* Personalization (skin-tone/build matching) was explicitly named as real, valuable research but deliberately deferred to its own future round rather than bundled in here — the user's words: "yeah that works and we can always come back to add more occasion fits," said about scope in general, with personalization specifically carved out earlier in the same conversation.
* The layering-isolation bug needed a general fix, not a one-off patch — future "only look at part of the outfit" bonuses should follow the same pattern rather than reintroducing the same class of bug.

## Considered Options

**Research → rules translation:**
* Color balance (brightness/value contrast): build now, using the already-defined-but-unused `BRIGHTNESS_TAGS` — no new tagging work needed.
* Skin-tone/build personalization: valuable but its own separate design conversation — deferred.
* Fit/silhouette contrast: light nudge using existing `fitted`/`loose` tags, not a strict rule (a strict fit rule was already rejected once in ADR 0015).
* Shoe coordination: narrowed from "general shoe-matches-outfit" (too vague to encode reliably) to the one concrete, high-confidence case — belt color matching shoe color.
* Sleepwear/beachwear material distinction: too dependent on unreliable material tagging to encode directly; reframed as style/occasion categories instead, which the AI can classify directly from garment type.

**Sleepwear/beachwear representation:**
* Two new values in the existing single-style slot, still mutually exclusive per item — rejected once the user caught that an item can genuinely belong to two categories at once.
* Keep single-select for the four original styles, let beachwear/sleepwear stack on top additively as a special case — considered, but inconsistent (two different mental models for "style").
* **Make style multi-select everywhere** — the option the user explicitly chose, at the cost of touching the picker UI, the AI prompt/schema, and the already-written style-mismatch scoring, in exchange for one consistent model with no special-cased exception.

**Layering bonus scope:**
* Patch this one case (check only shoes/accessories are excluded from the gate) — rejected as too narrow; the next unrelated-signal bug would need the same fix again.
* **Extract an isolated `baseScore()`** containing only whole-outfit rules (color/pattern/weight/style), reused to score just the two tops on their own as the layering bonus's gating condition, while the bonus itself still applies against the outer total — the general fix, chosen.

## Decision Outcome

**Brightness balance and vivid overload.** Reuses the existing `BRIGHTNESS_TAGS` (`light`/`dark`/`vivid`/`muted`), previously unused by scoring. A light+dark pairing in one outfit earns a small bonus (contrast reads as intentional; all-one-brightness reads as flat) — same tier as the layering bonus. Stacking more than one `vivid` item is penalized at the same tier as pattern-mixing, mirroring the existing "too many accent colors" logic.

**Belt-shoe color match.** Narrowed down from the research's broader "shoes should coordinate with the outfit" (too vague to encode without real risk of false positives) to the one concrete, well-established convention: a belt and shoes sharing a color earns a small bonus. Deliberately unconditional — never gated behind the rest of the outfit also being clean, specifically to avoid reintroducing the exact class of bug the layering fix (below) exists to solve.

**Fit/silhouette contrast — soft nudge, not a rule.** A top and bottom with contrasting `fitted`/`loose` tags earns a small bonus. Explicitly *not* the strict pass/fail fit rule already rejected in ADR 0015 — this is a nudge at the same tier as the other three additions, applied only when both items happen to carry a fit tag, with no penalty for missing tags.

**Layering bonus isolated to just the two tops.** Extracted `baseScore()` — the whole-outfit-only rules (color, pattern, weight-vs-temperature, style match) — and reused it as an isolated call against just the two candidate tops (`baseScore(tops, ...)`) purely as the layering bonus's gating condition, while the bonus itself is still applied to the outer running `penalty` so it correctly affects overall ranking. This call never triggers the bonus logic again (no recursion), and generalizes: any future bonus that should only look at a sub-group of the outfit can follow the same pattern rather than gating on the whole outfit's total.

**Sleepwear and beachwear are their own style categories, not hard-excluded and not folded into casual.** `StylePreference` gained two new values. Style is now genuinely multi-valued per item — `extractStyles`/`isStyleWord`/`STYLE_KEYS` in `styleTags.ts` all operate on arrays, `StylePicker` is a `[x]`/`[ ]` multi-select checkbox grid (previously `(x)`/`( )` single-select radio), `WardrobeItemForm` reuses the same generic `onToggleTag` handler for style that it already used for every other tag category (no special-case handler needed anymore — `onTagsChange` and `replaceStyle` were both deleted as genuinely dead once the single-slot "replace" semantics no longer applied). `outfitAesthetics.ts`'s style-mismatch check now treats an item as matching if *any* of its styles overlaps the requested styles, not a single-value comparison. `tagService.ts`'s prompt now asks for 1-2 styles (`"styles": [...]` array, replacing the old singular `"style"` field), with explicit sleepwear/beachwear criteria and the old "pajamas are always casual" framing removed — a plain t-shirt can be tagged both `casual` and `beachwear`, but pajama pants are `sleepwear` only, never `casual`. `filterByStyle` in `outfitService.ts` needed *zero* changes — its existing `item.tags.some(...)` scan was already agnostic to one-vs-many style tags per item, confirmed by direct re-reading rather than assumed.

**OutfitBuilderScreen: STYLE stays a fixed 4-chip grid; sleepwear/beachwear live behind a "+ More" toggle into a new OCCASION section**, per the user's own concern that an open-ended, growing list of occasion categories would clutter the main screen "like a cramped keyboard." Both sections share the same flat `selected: StylePreference[]` state and `toggleStyle` handler — which section a chip lives in is purely a UI grouping, not a different data model.

### Consequences

* Good, because the four new signals are directly traceable to the user's own research rather than invented, and each was scoped down to the specific, high-confidence part of a broader (sometimes too-vague-to-encode) idea rather than over-fitting to notes that weren't specific enough yet.
* Good, because the layering-isolation fix is a real generalizable pattern, not a one-off patch — confirmed by a dedicated regression test that reproduces the exact original symptom (an unrelated shoe clash blocking layering) and asserts the bonus now applies regardless.
* Good, because multi-style unlocks a real, previously-impossible case (a t-shirt as both casual and beachwear) with no special-cased data model — one consistent mental model for style everywhere it's touched.
* Neutral, because sleepwear/beachwear classification now depends entirely on the AI's garment-type judgment (no material-tag cross-check) — accepted because the failure mode is safe: a wrong guess just means an item doesn't show up under a style it should, never that it appears somewhere actively wrong.
* Bad/deferred, because skin-tone/build personalization — a real, substantive part of the same research — is not addressed here at all; flagged for its own future design round, not forgotten.

### Confirmation

Extended `outfitAesthetics.test.ts` (brightness balance reward + no-reward-single, vivid overload, belt-shoe match reward/no-match/untyped-exclusion, fit-balance reward/no-reward-same, style-mismatch overlap logic, and the layering-isolation regression test asserting the bonus is unaffected by an unrelated shoe/accessory clash). Rewrote `styleTags.ts`, `StylePicker.tsx`/`.test.tsx`, `WardrobeItemForm.tsx`/`.test.tsx`, `tagService.ts`/`.test.tsx` (multi-style prompt/schema, sleepwear/beachwear criteria), and `OutfitBuilderScreen.tsx`/`.test.tsx` (occasion section, "+ More" toggle) for the multi-select migration. Full suite: 30/30 suites, 277/277 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* Skin-tone/build personalization, a substantive part of the user's original research, remains fully deferred to its own future design conversation.
* Sleepwear/beachwear classification has no material-based cross-check (e.g. confirming swim trunks are actually a swim-appropriate fabric) — relies entirely on the AI's single-pass garment-type judgment.

## Live-test round: confirmed working, one gap identified and deliberately deferred (2026-09-01)

User tested this round's changes on-device. Confirmed working: sleepwear/beachwear multi-style tagging ("seems to be capable"), the OCCASION "+ More" section, and the layering-isolation fix specifically — the user reported seeing valid non-layered combinations that never surfaced before the fix, direct evidence the isolated `baseScore()` gate is doing its job. Brightness balance also read as beneficial ("more variation in the outfits"), though the user was less certain about how much to attribute to it specifically.

One real gap surfaced: the layering bonus still has no way to penalize *poor* layering, only reward good layering — it checks for exactly one `outerwear`-tagged top and a clash-free pairing, but never checks whether the *other* top actually reads as a legitimate base layer. The user's own example: a sporty outerwear piece can pair with something that isn't really a base layer and still earn the full bonus, since nothing beyond color/pattern/weight/style is checked between the two tops. Two remediation directions were discussed: (a) a new manually-set `base-layer` tag mirroring `outerwear`'s precedent, so the bonus only fires when one top is genuinely outerwear and the other is genuinely base-layer-appropriate; (b) a formality-consistency penalty between the two tops' own styles, independent of the requested style.

**Decision: hold off, keep observing.** The user was explicitly unsure how big a problem this is in practice, and flagged that sporty wardrobes may simply lack the tag granularity to fix it well right now (no designated "sporty base layer" tag exists). Per the standing collaboration process, this is logged as an open observation rather than acted on — revisit with more concrete recurring examples before picking between the two directions above, rather than guessing now.
