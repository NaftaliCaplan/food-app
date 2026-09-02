---
status: accepted
date: 2026-09-01
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Makes the previously-inert UserProfile.profile parameter (accepted since ADR 0016 but never used by scoring) actually do something — a real, hand-curated warm/cool undertone-to-color bonus, scoped narrowly to the piece of the user's original research that's best-grounded and lowest-risk. Contrast-based brightness modulation and build/height fit personalization are explicitly deferred, not attempted here.
tc-category: accuracy
tc-conditions: Holds as long as personalization stays bonus-only (never a penalty for a color that doesn't flatter the user's undertone) — this was an explicit, deliberate choice, not just an unimplemented extension. If contrast or build/height personalization is ever added, re-confirm the bonus-only principle still applies before extending it, rather than assuming it carries over automatically.
tc-signals:
  - user-research-integration
tc-confidence: 4
---

# Undertone → Color Personalization (Round 1 of Deferred Research)

## Context and Problem Statement

ADR 0018 explicitly deferred all skin-tone/build personalization to its own future design conversation, while fixing the rest of the user's research-backed rules (brightness, belt-shoe, fit, layering). `GenerateOutfitOptions.profile` has existed since the AI-removal rewrite (ADR 0016) purely for forward-compatibility — accepted by `generateOutfit`, threaded through `useOutfitGenerator`, loaded by `OutfitResultsScreen` behind the existing "Personalize for me" toggle, but never actually read by any scoring code. This round picks that thread back up.

`UserProfile` already carries a `skinToneDesc` field — a free-text AI-generated description — but the underlying `buildSkinTonePrompt` was already instructing the model to categorize the person's undertone as warm/cool/neutral and their feature contrast as high/medium/low; that categorization just wasn't being extracted into a queryable field, only folded into prose for display.

## Decision Drivers

* Per the standing collaboration process (surface judgment calls before deciding), scope and bonus-shape were checked with the user before implementation, given how sensitive body/appearance-based clothing advice can be if handled carelessly.
* The user's original PDF research covered multiple personalization threads (undertone/color, brightness contrast, height/build proportion) of noticeably different confidence levels — undertone-color matching ("seasonal color analysis") is well-established personal styling advice; build/height fit-nudging is exactly what ADR 0016 flagged as wanting to become "a real tagging dimension," not hand-written proportion rules, and hasn't been designed at all.
* Whether personalization should ever *penalize* an existing wardrobe item based on someone's skin tone is a materially different, more sensitive claim than rewarding a color that already flatters them.

## Considered Options

**Scope for this round:**
* Undertone → color bonus only — narrowest, best-grounded piece, chosen.
* Undertone + contrast (also modulate the existing ADR 0018 brightness-balance bonus by contrast level) — considered, deferred; ties naturally into existing scoring but more speculative.
* Everything now, including build/height → fit-tag nudging — rejected for this round; the least-designed, most speculative piece, explicitly still owed its own separate conversation.

**Bonus shape:**
* Bonus-only, never penalize a color for not matching the undertone — chosen.
* Also penalize known-unflattering colors per undertone — rejected; would need a second hand-curated "clashes with this undertone" list and is a stronger, more sensitive claim to make about someone's appearance than the first option.

## Decision Outcome

**Structured `undertone` field, not just prose.** `buildSkinTonePrompt`'s OUTPUT schema now asks for `"undertone": "<warm|cool|neutral>"` alongside the existing free-text `skinToneDesc` (kept, unchanged, for on-screen display). `extractSkinTone` parses and validates it (object path and markdown-fence regex fallback, mirroring the same validate-and-drop-if-unrecognized pattern used for colors/styles elsewhere in `tagService.ts`) into a new `SkinToneResult.undertone` field. `UserProfile.undertone` is optional, so profiles saved before this change simply personalize as "no adjustment" rather than needing any migration.

**Hand-curated warm/cool flattering-color sets, scoped to `ACCENT_COLORS` only.** New `WARM_FLATTERING_COLORS` (olive, orange, yellow, red, burgundy) and `COOL_FLATTERING_COLORS` (blue, purple, pink, green) in `outfitAesthetics.ts`, same curation style as `CLASHING_COLOR_PAIRS` — hand-picked to the user's own taste and common styling convention, not derived from a formula. Deliberately excludes the existing `NEUTRAL_COLORS` set (black/white/gray/navy/tan/khaki/brown) since those already read as universally safe for everyone regardless of undertone — nothing to personalize there.

**Bonus-only, applied once per outfit.** `scoreOutfitAesthetics` gained a 4th optional param, `undertone`. When set and not `'neutral'`, if *any* accent color present in the outfit is in the matching flattering set, a single `UNDERTONE_COLOR_BONUS` (0.5, same tier as the other ADR 0018 nudges) applies — never a second time for a second flattering color, so this can't fight against the existing "too many accent colors" penalty by rewarding stacking more of them. No undertone, `'neutral'` undertone, and non-matching colors all produce zero adjustment — there is no penalty path at all, by design.

**Threaded scalar-style, not as a whole profile object.** Matching how `stylePrefs`/`temperatureF` already flow through the scoring layer as individual values rather than an options bag, `outfitService.generateOutfit` derives `profile?.undertone` and passes just that through `selectBestOutfit`/`addAccessoriesGreedily`/`scoreOutfitAesthetics`, rather than threading the whole `UserProfile` object further than `outfitService.ts`. `filterByStyle` and item eligibility are completely untouched — this is scoring-only, same as every other ADR 0018 addition.

**No new UI.** The existing "Personalize for me" toggle (`useProfile`) already gated whether `OutfitResultsScreen` loads and passes a profile at all; that plumbing needed no changes. `UserProfileScreen`'s existing skin-tone-photo flow now also captures and round-trips `undertone` through load/save/clear, with no new visible field — the existing `skinToneDesc` prose already communicates the same information to the user.

### Consequences

* Good, because this closes the "profile does nothing" gap that's existed since ADR 0016, for the specific, best-grounded slice of the user's research, without touching the parts that are still genuinely undesigned.
* Good, because the bonus-only design means personalization can only ever help an outfit's ranking, never imply an existing wardrobe item is wrong for the user's skin tone — a deliberate, lower-risk framing given the sensitivity of appearance-based advice.
* Neutral, because contrast-based brightness modulation and build/height fit-nudging remain fully unaddressed — flagged explicitly, not silently dropped, as their own future rounds.
* Neutral, because a profile's `undertone` can only reach this code path via a fresh `extractSkinTone` capture — existing profiles saved before this change have `undertone: undefined` until the user retakes their reference photo, and simply get no adjustment in the meantime (same graceful-degradation pattern already established for missing fit/weight tags elsewhere).

### Confirmation

Extended `outfitAesthetics.test.ts` (warm/cool bonus reward, wrong-undertone no-reward, bonus-only-never-penalty check, neutral/no-undertone no-op, bonus applies once even with 2 flattering colors present). Extended `tagService.test.ts` (`extractSkinTone`: structured undertone parses, unrecognized value dropped, markdown-fence fallback parses undertone too, missing field leaves it undefined). Extended `outfitService.test.ts` (integration test: a wardrobe with one flattering-colored top and one neutral-colored top, given a `warm` profile, deterministically selects the flattering one). Extended `UserProfileScreen.test.tsx` (an existing profile's `undertone` loads and round-trips through an unchanged re-save). Full suite: 30/30 suites, 290/290 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* Contrast-based brightness modulation (tying the user's own high/medium/low feature contrast to the existing ADR 0018 brightness-balance bonus) remains unaddressed — a natural next round, since the data (`buildSkinTonePrompt` already asks for contrast) exists but isn't extracted or used yet.
* Build/height → fit-tag personalization remains fully undesigned — the most speculative piece of the user's research, deliberately left for its own separate, carefully-scoped conversation.
