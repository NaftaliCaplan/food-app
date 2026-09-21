---
status: accepted
date: 2026-09-15
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Personalization round 2 — extracts the user's own feature contrast (already read by the AI reference-photo prompt since ADR 0019, but never used) into a real profile field, and gives a low-contrast profile an additional way to earn a brightness-related bonus (a deliberately blended "tonal" outfit) alongside the existing universal light+dark contrast bonus from ADR 0018.
tc-category: accuracy
tc-conditions: Holds as long as the tonal bonus stays strictly additive — it must never suppress or replace the universal light+dark bonus for any profile, low-contrast included. If a third contrast tier or a penalty path is ever considered, re-confirm the additive-only principle first rather than assuming it carries over.
tc-signals:
  - user-research-integration
tc-confidence: 4
---

# Contrast-Based Brightness Personalization (Round 2)

## Context and Problem Statement

ADR 0019 closed the "profile does nothing" gap with an undertone-based color bonus, and explicitly flagged contrast as the natural next round — `buildSkinTonePrompt` (`tagService.ts`) already asks the AI to categorize the user's feature contrast as high/medium/low, in the same reference-photo capture that produces undertone, but that categorization was only ever folded into the free-text `skinToneDesc` shown on screen, never extracted as real data.

Separately, the existing brightness-balance bonus (ADR 0018) rewards any outfit that mixes a `light`-tagged and `dark`-tagged item — a universal "contrast reads as intentional" rule that doesn't account for the fact that a naturally low-contrast person (similar lightness between skin/hair) is often better served by a deliberately blended, tonal look rather than bold light/dark contrast.

## Decision Drivers

* Per the standing collaboration process, scope and the specific rule mechanics were checked with the user before implementation — same pattern as every prior ADR round.
* The user chose to tackle this before the two other open items (poor-layering penalty, build/height personalization), specifically because the underlying data pipeline already exists (unlike build/height, which has no AI-read equivalent at all) — same reasoning that made undertone the first personalization round.
* Whether a low-contrast profile should get a *replacement* rule (suppressing the existing bonus) or an *additional* one was a real judgment call, given how the undertone bonus in ADR 0019 was deliberately additive/bonus-only rather than adding a competing penalty.

## Considered Options

**Tonal-match definition:**
* Require 2+ items sharing the same brightness tag (light+light, dark+dark, or muted+muted) — chosen, avoids rewarding an outfit that simply has sparse/missing brightness data as if it were a deliberate choice.
* Reward any outfit that simply isn't light+dark, regardless of how much brightness-tag data actually exists — rejected; would reward outfits with zero real signal.

**High-contrast treatment:**
* No change — the existing universal light+dark bonus (ADR 0018) already rewards exactly what a high-contrast person wants — chosen.
* Stack a second, reinforcing bonus on top for high-contrast profiles specifically — rejected; adds a second bonus tier to reason about for no clear benefit, since the existing bonus already does the job.

## Decision Outcome

**Structured `contrast` field, same pattern as `undertone`.** `buildSkinTonePrompt`'s OUTPUT schema gained `"contrast": "<high|medium|low>"` alongside the existing `undertone` and `skinToneDesc` fields. `extractSkinTone` parses and validates it the same validate-and-drop-if-unrecognized way (object path + markdown-fence regex fallback). `UserProfile.contrast` is optional — profiles saved before this change simply get no adjustment until the reference photo is retaken, same graceful-degradation pattern as `undertone`.

**Low-contrast "tonal" bonus, additive only, never a replacement.** `scoreOutfitAesthetics` gained a 5th optional param, `contrast`. Brightness tags are now counted (not just detected as present/absent) so "at least 2 items share a value" can be checked. When `contrast === 'low'` and the outfit does *not* already qualify for the universal light+dark bonus, a `CONTRAST_TONAL_BONUS` (0.5, same tier as every other ADR 0018/0019 nudge) applies if 2+ items share the same brightness tag (all-light, all-dark, or all-muted). A low-contrast profile that happens to land on a bold light+dark outfit still earns the *existing* bonus exactly as before — this only adds a second path to a bonus, it never takes the first one away, and high/medium contrast (or no profile at all) get zero behavior change.

**Threaded scalar-style, matching `undertone`/`stylePrefs`/`temperatureF`.** `outfitService.generateOutfit` derives `profile?.contrast` and passes it through `selectBestOutfit`/`addAccessoriesGreedily`/`scoreOutfitAesthetics` as an individual value, not as part of a passed-through profile object — consistent with every other scoring input.

**No new UI.** Same as ADR 0019 — the existing "Personalize for me" toggle and reference-photo flow needed no new visible controls; `UserProfileScreen` now also loads/saves/clears `contrast` alongside `undertone`.

### Consequences

* Good, because it reuses data the AI was already producing (feature contrast) rather than requiring any new capture step or user-facing change.
* Good, because the additive-only design means a low-contrast profile can never be worse off than before this change — it only ever gains a new way to earn a bonus.
* Neutral, because build/height personalization remains the one fully undesigned piece of the user's original research — still deliberately deferred, no code-level equivalent exists yet.
* Neutral, because (as with undertone) an existing profile's `contrast` stays `undefined` until the reference photo is retaken — no migration, no forced re-capture.

### Confirmation

Extended `outfitAesthetics.test.ts` (tonal bonus for all-light/all-dark/all-muted, no bonus for high/medium contrast or no profile, requires 2+ matching items not just 1, does not stack with the light+dark bonus, still lets a low-contrast profile earn the light+dark bonus on a different outfit). Extended `tagService.test.ts` (`extractSkinTone`: structured contrast parses, unrecognized value dropped, markdown-fence fallback parses contrast too, missing field leaves it undefined). Extended `outfitService.test.ts` (integration test: a wardrobe with one tonal-tagged top and one plain top, given a `low`-contrast profile, deterministically selects the tonal one). Extended `UserProfileScreen.test.tsx` (an existing profile's `contrast` loads and round-trips through an unchanged re-save). Full suite: 30/30 suites, 304/304 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* Build/height → fit-tag personalization remains fully undesigned — no AI-read data pipeline exists for it at all (unlike undertone/contrast, both already extracted from the reference photo), so this is a bigger design lift than either personalization round so far.
* The poor-layering-penalty gap flagged live-testing ADR 0018 (a sporty outerwear top pairing with a non-base-layer top still earns the full layering bonus) remains open and deliberately deferred, per the user's own "hold off, keep observing" call.
