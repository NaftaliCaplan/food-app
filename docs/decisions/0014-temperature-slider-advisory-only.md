---
status: accepted
date: 2026-08-23
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Passing temperature as prompt-only context, with no hard filter, avoids the exact failure class that hard-exclusion has already caused twice in this project (khakis tagged casual instead of smart_casual, the ADR 0009 style-alignment ceiling) — a wrong fit tag would silently make an item permanently unselectable in extreme weather rather than just look a little off.
tc-category: reliability
tc-conditions: Holds as long as `lightweight`/`heavyweight` tagging accuracy remains unverified at scale. If tagging reliability for that attribute is specifically measured and found trustworthy, hard-exclusion becomes viable and should be revisited (not before).
tc-signals:
  - regression-prevention
tc-confidence: 3
---

# Temperature Slider — Advisory Context, Not a Hard Filter

## Context and Problem Statement

Queued task: let the user set a current temperature so outfit generation can account for weather. `WardrobeItemForm`/`tagService.ts` already tag top/bottom items `lightweight` or `heavyweight` (ADR 0009's category-aware attribute work), which looks like a ready-made signal to filter on.

## Decision Drivers

* This project has hard-excluded on AI-assigned tags before and been burned by tagging unreliability twice: the casual/formal contradiction (ADR 0008) and the khakis-tagged-casual-instead-of-smart_casual case (ADR 0009) — both were classification errors that silently produced wrong behavior downstream
* Hard-excluding on `lightweight`/`heavyweight` would mean a single mistagged item becomes permanently unselectable at that temperature, with no visible indication to the user of why — a worse failure mode than a merely suboptimal AI suggestion, since it fails silently
* `lightweight`/`heavyweight` tagging accuracy has never been specifically measured, unlike category/style which have had multiple live-test rounds of scrutiny

## Considered Options

* Hard-exclude wrong-weight items from the candidate pool at temperature extremes (same code-level-guarantee pattern used for laundry status and category caps) plus pass temperature to the AI as context
* Prompt-only: tell the AI the temperature, let it weigh fabric weight/coverage using its own judgment, no code-level filter
* Build the slider UI only and defer wiring it into generation at all

## Decision Outcome

**Prompt-only.** User explicitly declined hard-exclusion for now: "hard exclusion has led to some serious issues due to scanning problems... we can go to hard exclude if we're able to make the scanning and tagging more reliable in the future but not till that's more concrete." `generateOutfit` takes an optional `temperatureF`; when present, `buildOutfitPrompt` adds a `WEATHER` block stating the temperature in both °F and °C and asking the model to factor it into fabric weight/coverage choices "where the wardrobe allows," but explicitly subordinate to style goal and item availability. No candidate is ever excluded based on `lightweight`/`heavyweight` tags.

**UI**: a 0–100°F slider on `OutfitBuilderScreen` (`@react-native-community/slider`, newly added dependency — no built-in RN slider exists in SDK 54), showing the live value as `<F>°F (<C>°C)`, defaulting to 70°F. Placed on the same screen as the style/accessory/personalize controls, per the user's own direction, rather than a separate screen. The temperature is threaded through as a plain route param → `useOutfitGenerator` → `generateOutfit`, the same pattern already used for `includeAccessories`/`useProfile`.

### Consequences

* Good, because a wrong `lightweight`/`heavyweight` tag can no longer make an item silently unselectable — worst case is a suboptimal suggestion, not a permanently-excluded item with no explanation.
* Good, because this establishes the reversal point explicitly: if weight-tag accuracy is later verified, hard-exclusion is the documented next step, not something to redecide from scratch.
* Neutral, because the slider introduces the app's first native platform control (a round drag thumb) into an otherwise fully custom-drawn, sharp-cornered terminal UI — track colors are themed to match, but the thumb shape itself isn't overridable without a custom-drawn slider. Flagged rather than silently accepted; revisit if it reads as visually inconsistent once tested on-device.
* Bad, because outfit generation currently has zero code-level guarantee that temperature is respected at all — same as the general "reasoning quality" ceiling already logged in ADR 0009, just for a new dimension (weather) instead of style.

### Confirmation

Added tests: `outfitService.test.ts` (WEATHER block appears only when `temperatureF` is set and includes the correct °F/°C conversion; a `heavyweight` item is NOT excluded even at 100°F), `useOutfitGenerator.test.ts` (`temperatureF` passed through), `OutfitBuilderScreen.test.tsx` (default value display, slider interaction updates the shown °F/°C, value passed through on Generate). Full suite: 27/27 suites, 207/207 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* `lightweight`/`heavyweight` tagging accuracy is unverified at scale — the same category of open question already logged for style classification in ADR 0009.
* The temperature slider's native rounded thumb is a one-off visual exception in an otherwise fully custom terminal UI; not revisited in this decision.
* No persistence of the last-used temperature across sessions — it resets to the 70°F default every time `OutfitBuilderScreen` is opened, same as the style/accessory selections already do.
