---
status: accepted
date: 2026-09-21
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Personalization round 3 — the last of the three UserProfile fields (heightRange, build) finally affects scoring, reusing the existing fitted/loose tags rather than adding any new tagging dimension or capture step. Closes the "profile fields accepted but unused" gap entirely.
tc-category: accuracy
tc-conditions: Holds as long as all three bonuses stay bonus-only and additive (never a penalty for the "other" fit, and multiple matching signals simply stack rather than one suppressing another). If a body-type rule is ever added that could read as corrective (e.g. explicitly discouraging a fit for a given build), that would break with the framing established across all three personalization rounds and should be reconsidered, not just extended.
tc-signals:
  - user-research-integration
tc-confidence: 4
---

# Height/Build Fit Personalization (Round 3)

## Context and Problem Statement

ADR 0019 (undertone) and ADR 0020 (contrast) closed most of the "profile accepted but unused" gap left by ADR 0016, but both required a new AI-read data field, since `extractSkinTone`'s reference-photo prompt didn't originally categorize either. `heightRange` and `build` are different: they've been present on `UserProfile` since the very first profile screen, manually self-reported via chips (`UserProfileScreen`'s `HEIGHT_OPTIONS`/`BUILD_OPTIONS`) — the data already exists and needs no new capture step. What was missing was any scoring rule that actually reads them.

This is also the most sensitive of the three personalization rounds: color/undertone matching and brightness/contrast are relatively neutral, well-established styling concepts, but height/build fit advice edges closer to claims about someone's body shape specifically — exactly the territory ADR 0016 flagged wanting "a real tagging dimension, not hand-written proportion rules" for.

## Decision Drivers

* Given the higher sensitivity of body-shape-based advice specifically, the exact rule mechanics were checked with the user in plain conversation before implementation (not via the structured multi-choice tool, which the user opted out of for this particular topic) — consistent with the standing collaboration process, just via a different interaction shape for this round.
* The user was confident about the height rule (petite → fitted) but explicitly said they weren't sure of the specific build rules, and asked for a concrete recommendation rather than being asked to choose among pre-built options — a different collaboration pattern than the first two rounds, where the user picked directly from presented options.
* Every prior personalization bonus (undertone, contrast) established a firm precedent: additive/bonus-only, never a penalty for the "other" choice. Height/build needed to hold that line at least as strictly, given the higher sensitivity.

## Considered Options

**Height:**
* Petite → reward fitted top+bottom (clean vertical line); average/tall → no rule — chosen.
* Also add a tall → loose bonus — considered, dropped: "tall can wear volume" is a weaker, less universally-agreed claim than the petite one, and the user didn't ask for it.

**Build:**
* Skip build entirely this round, given its higher sensitivity and lack of a dedicated tag — considered, but the user explicitly said they didn't mind having some build scoring, just wasn't sure of the specifics, so proceeded instead of deferring.
* Broad → reward fitted top+bottom (streamlined tailoring); slim → reward loose top+bottom (adds visual volume/dimension); average → no rule — chosen, reusing the same fitted/loose tags as height rather than inventing a new tagging dimension.

## Decision Outcome

**No new data pipeline needed.** `heightRange`/`build` are already manually self-reported via `UserProfileScreen`'s existing chip pickers — no AI prompt change, no new `UserProfileScreen` field, no migration.

**Three new bonuses in `scoreOutfitAesthetics`, all keyed off the existing `fitted`/`loose` tags already used by `FIT_BALANCE_BONUS` (ADR 0018).** Computed in the same block that already finds a top+bottom pair and their fit tags:
- `HEIGHT_FIT_BONUS` (0.5): `heightRange === 'petite'` AND both top and bottom are `fitted`.
- `BUILD_FIT_BONUS` (0.5): `build === 'broad'` AND both `fitted`; OR `build === 'slim'` AND both `loose`.
- Average height/build (or no profile) get no rule at all — mirroring the "no change for the unaddressed case" pattern from both prior rounds.

**Independently stacking, not mutually exclusive.** A profile matching more than one signal (e.g. petite AND broad, both pointing to "fitted") simply earns both bonuses — they're two separately-justified reasons (elongating line vs. streamlined tailoring) that happen to share a mechanical condition, not the same claim counted twice. This can't double-count the *same* condition either, since a top+bottom pair can't be simultaneously "both fitted" and "both loose" — so height's petite-fitted bonus and build's slim-loose bonus, for instance, would never both apply to the same outfit at once; a genuinely conflicting profile (petite + slim) would instead see the two signals pull toward opposite fit choices, each still earning its own bonus on whichever outfit satisfies it.

**Bonus-only, same as every prior round.** No penalty exists anywhere in this design for the "other" fit choice on any build/height combination — wearing loose as a petite/broad profile, or fitted as a slim profile, is simply neutral, never penalized. This was treated as non-negotiable given how much more sensitive body-shape advice is than color/brightness advice.

### Consequences

* Good, because this closes the "profile accepted but incompletely used" gap entirely — all of `UserProfile`'s fields now do something, three rounds after ADR 0016 first left `profile` as a forward-compatible no-op.
* Good, because it required zero new tagging dimension or capture flow — pure reuse of `fitted`/`loose`, already present on wardrobe items today.
* Good, because the bonus-only/additive framing that's held across all three personalization rounds was preserved rather than loosened for this more sensitive domain — if anything, more scrutinized, not less.
* Neutral, because — like undertone/contrast — this only ever affects scoring for wardrobes that already carry `fitted`/`loose` tags on relevant items; an untagged wardrobe just gets no adjustment, same graceful-degradation behavior as every other tag-dependent bonus in this file.

### Confirmation

Extended `outfitAesthetics.test.ts` (petite+fitted reward, no reward for petite+loose, no adjustment for average/tall/no-profile, broad+fitted reward, slim+loose reward, no reward for the mismatched build/fit pairing, no adjustment for average build, and a stacking test confirming petite+broad on a fitted pairing scores lower than petite alone). Extended `outfitService.test.ts` (two new integration tests: a petite profile deterministically prefers a fitted top over an otherwise-identical loose one; a slim profile deterministically prefers a loose top over an otherwise-identical fitted one). Updated a stale test description that pre-dated this round's implementation. Full suite: 30/30 suites, 314/314 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* The poor-layering-penalty gap (from ADR 0018's live-test follow-up) remains open and deliberately deferred, per the user's own "hold off, keep observing" call — unchanged by this round.
* A new, separate feature idea was raised this session: a selfie-based "does what I'm currently wearing right now match" checker. Structurally closer to the old stateless one-photo-in/one-verdict-out food/clothes-checker pattern (ADR-era, pre-wardrobe) than to the wardrobe-based outfit-generation system this ADR extends — flagged for its own future design conversation, not scoped or started here.
