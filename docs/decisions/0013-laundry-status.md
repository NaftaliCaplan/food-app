---
status: accepted
date: 2026-08-23
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Excluding laundry items at the single `available` computation point in generateOutfit (rather than in each of the several places wardrobe/filtered/available get read) means every future candidate-pool consumer in that function inherits the exclusion automatically instead of needing its own laundry check.
tc-category: feature
tc-conditions: Holds as long as generateOutfit continues to derive `filtered` and its guarantee-fill fallback from `available` rather than reading `options.wardrobe` directly anywhere internally.
tc-signals:
  - reduced-change-scope
tc-confidence: 4
---

# Laundry Status Per Wardrobe Item

## Context and Problem Statement

Queued for a while behind tagging/outfit-generation accuracy work: users need a way to mark an item as currently unavailable (in the laundry) without deleting it, so outfit generation stops suggesting it and existing saved outfits that depended on it are visibly flagged as currently incomplete.

## Decision Drivers

* User wanted the toggle kept lightweight and consistent with the app's terminal visual language — explicitly flagged "no emoji, keep with the vibe" rather than picking a UI pattern outright, deferring to whatever fit that constraint
* `generateOutfit`'s guarantee-fill fallback (ADR 0009) already reads from the raw `wardrobe` array when the style filter excludes every candidate of a category — if laundry exclusion were only applied to the style-filtered pool, that same fallback path could silently reintroduce a laundry item
* `SavedOutfitsScreen` (ADR 0012) already has an established pattern for "item exists but isn't fully available" (`[MISSING]` for deleted items) that a laundry state needed to sit alongside, not replace

## Considered Options

* Toggle entry point: a per-card button on `WardrobeScreen`'s grid (fast, no extra screen) vs. a field inside `EditItemScreen`'s form
* Saved-outfit laundry display: reuse the exact `[MISSING]` treatment vs. a distinct dimmed-thumbnail-plus-`[LAUNDRY]`-tag state
* Where to apply the exclusion inside `generateOutfit`: only in the style-filtered pool vs. at a single upstream point that everything downstream (including the guarantee-fill fallback) derives from

## Decision Outcome

**Toggle entry point**: a small `[W]` / `[W✓]` button per `WardrobeScreen` grid card (mirrors the existing `[P]`/`[P✓]` profile-icon convention exactly), next to the existing delete button. The in-laundry thumbnail also dims (`opacity: 0.4`) so laundry status is visible while just browsing the grid, not only on the saved-outfits screen.

**Saved-outfit display**: a laundry item keeps its dimmed thumbnail with a `[LAUNDRY]` tag beneath it — visually distinct from `[MISSING]`, since "temporarily unavailable" and "no longer exists" are different situations a user should be able to tell apart. The whole saved-outfit card also dims slightly (`opacity: 0.6`) as a quick at-a-glance signal that something in it currently isn't wearable.

**Exclusion point**: rather than filtering laundry items out only where `filterByStyle` runs, `generateOutfit` now computes `available = wardrobe.filter(i => !i.inLaundry)` once, immediately after destructuring options, and every subsequent internal reference that previously read the raw `wardrobe` (the id map, the style filter input, and critically the guarantee-fill fallback's last-resort search) now reads `available` instead. This was deliberate: the guarantee-fill fallback exists specifically to search past the style filter when it excludes every candidate of a category, and if it had kept reading raw `wardrobe`, it could reintroduce exactly the laundry item the style filter (or the laundry filter) was supposed to keep out.

### Consequences

* Good, because a laundry item can no longer appear in a newly generated outfit through any code path in `generateOutfit`, including the fallback path that exists specifically to search past the style filter.
* Good, because `WardrobeItem.inLaundry` is optional and defaults to absent/undefined for all existing items — no migration needed, and `updateItem`'s existing generic partial-merge is reused rather than adding a dedicated laundry storage function.
* Neutral, because a saved outfit's laundry state is resolved live (same pattern as the `[MISSING]` resolution already established in ADR 0012) — toggling an item back to clean automatically un-dims any saved outfit that used it, with no extra sync code.
* Bad, because there's no notion of *when* laundry status was set or any expiry — it's a manual on/off switch the user has to remember to flip back.

### Confirmation

Added tests: `WardrobeScreen.test.tsx` (toggle flips `updateItem` calls and the button label), `outfitService.test.ts` (laundry item excluded from the prompt sent to the AI, a hallucinated/leaked laundry id doesn't resolve through the id map, and the guarantee-fill fallback specifically does not reach for a laundry item), `SavedOutfitsScreen.test.tsx` (`[LAUNDRY]` tag distinct from `[MISSING]`, shown in both the collapsed thumbnail and the expanded detail line). Full suite: 27/27 suites, 203/203 tests, `tsc --noEmit` clean (0 errors).

## Follow-up: toggle redesigned — clearer label, moved off the delete row (2026-08-23)

Live testing found the `[W]`/`[W✓]` toggle (buried in the card footer, directly adjacent to the delete `✕`) hard to understand at a glance and risky to tap by accident next to delete. User feedback: unclear why "W" stood for laundry, and the size/position needed to change.

Moved to a badge overlaid on the top-left corner of the item's photo, using `[L]`/`[L✓]` instead (mirrors the existing `[P]`/`[P✓]` profile-icon convention) — larger, visually separated from the delete action entirely, and dims the item's thumbnail the same way as before when active.

Caught one accessibility regression while implementing this: the first pass only changed the badge's background/border color between states, with the same `[L]` text either way — a color-only signal, which directly conflicts with this app's own established rule that verdict/state colors are always paired with an icon or text change, never used alone (colorblind users can't rely on color alone). Fixed by making the bracket text itself change (`[L]` → `[L✓]`), matching the `[P]`/`[P✓]` pattern exactly, so the distinction never depends on color perception.

Verified via updated `WardrobeScreen.test.tsx` assertions (both the accessibility label and the visible bracket text change between states). Full suite green.
