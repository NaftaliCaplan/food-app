---
status: accepted
date: 2026-08-13
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Outfits could already be saved (outfitStorage.ts's saveOutfit/removeOutfit have existed since Step 18) but had nowhere to be viewed — this closes that loop with a screen that resolves saved itemIds back to live wardrobe items at render time, so it stays correct as the wardrobe changes underneath it instead of needing its own copy of item data.
tc-category: feature
tc-conditions: Holds as long as SavedOutfit keeps storing itemIds (not denormalized item snapshots) and WardrobeScreen remains the natural place users land after building/viewing outfits. If saved outfits ever need to reflect an item's state *at the time it was saved* (e.g. a photo that was later re-taken), this resolve-at-render approach would need to change to a snapshot.
tc-signals:
  - reduced-change-scope
tc-confidence: 4
---

# Saved Outfits Screen

## Context and Problem Statement

Outfits have been saveable since Step 18 (`OutfitResultsScreen`'s "Keep This Outfit" calls `saveOutfit`), but there was never a screen to view them — saved outfits went into AsyncStorage and were never read back. The user asked for this repeatedly across several live-test rounds ("i vote we also add in the saved outfits screen so i can see proper progressions") but it was deliberately queued behind tagging/outfit-generation accuracy work each time.

## Decision Drivers

* `SavedOutfit` stores only `itemIds` (plus `styleName`/`savedAt`), not the wardrobe items themselves — so displaying a saved outfit requires resolving those ids against the live wardrobe at render time, not just reading the saved record in isolation.
* Wardrobe items can be deleted (`removeItem`) or have their category/photo changed (`EditItemScreen`) independently of any saved outfit that references them, so a saved outfit's itemIds can legitimately go stale.
* `removeOutfit(id)` already existed in `outfitStorage.ts` with no caller — deletion was already designed for, just never wired to UI.

## Considered Options

* Entry point: a header icon on `WardrobeScreen` (mirrors the existing profile-icon pattern) vs. a dedicated tile on `HomeScreen` vs. both
* Stale/missing items: silently skip items that no longer resolve vs. render an explicit placeholder tile so the user can see the outfit is now incomplete

## Decision Outcome

**Entry point** — a header icon on `WardrobeScreen` only (`[OUT]`, next to the existing profile icon), not a `HomeScreen` tile. User's choice — Saved Outfits is a view *of* the wardrobe/outfit-building flow, not a peer top-level feature next to the food/clothes checkers.

**Stale items** — render an explicit `[MISSING]` placeholder tile in place of any itemId that no longer resolves against the current wardrobe, rather than silently shrinking the outfit. User's choice: seeing that an outfit is now incomplete is more useful than quietly hiding the gap, especially since the upcoming laundry-status feature (task 45) will need this same screen to visibly represent "this outfit is currently missing/unavailable something."

**New screen** `SavedOutfitsScreen` (route `SavedOutfits: undefined`) lists saved outfits as cards (style name, save date formatted as e.g. "Jul 26", a row of item thumbnails or `[MISSING]` placeholders, and a delete `✕` button wired to the existing `removeOutfit`). Items are resolved via a `Map<id, WardrobeItem>` built from `getWardrobe()` on each focus, so the screen always reflects the current wardrobe state rather than a stale snapshot.

### Consequences

* Good, because saved outfits are finally viewable and deletable — closes a gap that existed since Step 18.
* Good, because resolving items live (not storing a snapshot) means edits/deletes in the wardrobe are automatically reflected here with no extra sync code.
* Neutral, because the `[MISSING]` placeholder is a new UI state that other outfit-list-like screens don't have yet — if a similar view is built elsewhere (e.g. for the laundry-status feature), it should reuse this same resolve-and-placeholder pattern rather than inventing a new one.
* Bad, because there's currently no way to know *what* a missing item was (name/category) — the placeholder is generic. Acceptable for now since the alternative (denormalizing item data into `SavedOutfit`) reopens the staleness problem this design deliberately avoids.

### Confirmation

Added `SavedOutfitsScreen.test.tsx` (empty state, back navigation, resolved-item rendering, missing-item placeholder, delete) and a `WardrobeScreen.test.tsx` case for the new header icon. Full suite: 27/27 suites, 195/195 tests, `tsc --noEmit` clean (0 errors).

## Follow-up: entry point moved to bottom bar; tap-to-expand item names + tip (2026-08-13)

Two changes from the same live-test round as ADR 0011's button-centering follow-up:

**Entry point moved.** The `[OUT]` header icon was replaced with a "Saved" button in `WardrobeScreen`'s bottom bar, next to "Build an Outfit →" (each `flex: 1` in a row). User's reasoning: the header icon crowded the profile icon and add-item button, and the outfit-related actions (build, view saved) read better grouped together at the bottom than split between header and footer.

**Tap-to-expand item names + tip added.** `SavedOutfit` gained an optional `recommendation?: string` field (existing saved records predate this and won't have it — kept optional rather than backfilled, matches how `photoUri`/`name` etc. already only exist going forward from when they were introduced). `OutfitResultsScreen`'s `handleAccept` now passes `suggestion.recommendation` through to `saveOutfit`. Each `SavedOutfitsScreen` card is now itself a `TouchableOpacity` (nesting the existing delete button, which still works independently — RN's touch responder resolves to the innermost touchable under the finger) that toggles a `detailBox` showing each item's category + name (or "[MISSING] Item no longer in wardrobe") and the saved tip, one card expanded at a time. Motivation: item thumbnails are small, and if the photo itself is ambiguous (bad lighting, small crop) the user has no way to confirm what an item actually is without this.

Verified via new `SavedOutfitsScreen.test.tsx` cases (expand reveals names/tip and collapses again, missing-item detail line) and an updated `OutfitResultsScreen.test.tsx` assertion that `saveOutfit` receives `recommendation`. Full suite: 27/27 suites, 197/197 tests, `tsc --noEmit` clean (0 errors).
