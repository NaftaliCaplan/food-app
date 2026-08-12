---
status: accepted
date: 2026-07-26
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Extracting the shared form (category picker + name + tags + curated picker + save) once, rather than duplicating it across AddItemScreen's review step and the new EditItemScreen, means any future tagging/category UI improvement (e.g. a new curated attribute group) only needs to be made in one place and both flows get it automatically.
tc-category: ux
tc-conditions: Holds as long as the add-flow and edit-flow forms stay functionally identical (same fields, same tag mechanics) — if they diverge meaningfully (e.g. edit gains a delete action, add gains a retake-photo-in-place action), the shared component's prop surface should absorb the difference rather than forking into two copies.
tc-signals:
  - reduced-change-scope
  - interface-stability
tc-confidence: 4
---

# Edit-Item Flow and Curated Tag Picker

## Context and Problem Statement

Two related gaps existed: (1) there was no way to correct a wardrobe item after saving it — a wrong AI guess (name, category, or tags) was permanent unless the item was deleted and re-added from scratch; (2) the only way to add a tag was free-text typing, which the user flagged as risky ("I'm not sure if my typed ones will even line up") since `outfitService.ts`'s style/category matching depends on tags using specific vocabulary. Both were explicitly requested together, and both touch the same underlying UI (category picker + name + tags), so they were designed and built together.

## Decision Drivers

* `wardrobeStorage.ts` already had an `updateItem(id, updates)` function with no UI ever calling it — the storage layer was ready, only the screen was missing
* The review-step form inside `AddItemScreen` (category picker + name input + tag chips + free-text add) is materially the same UI an edit screen would need, and was already going to be duplicated a second time
* A curated tag picker only helps if its vocabulary actually matches what `tagService.ts`'s AI prompt uses — a picker with different words would create the same "doesn't line up" problem it's meant to solve
* `AddItemScreen` carries camera-specific state (permissions, camera ref, capturing) that a pure edit flow (no camera, always pre-filled) has no use for — bundling edit-mode into `AddItemScreen` via a mode flag would import that machinery unnecessarily

## Considered Options

* Edit access point: reuse `AddItemScreen` with an `editItemId` mode flag vs. a separate dedicated `EditItemScreen`
* Shared UI: duplicate the category/name/tags form in both places vs. extract one shared component
* Tag picker: replace free-text entry entirely vs. curated picker as the primary path with free-text kept as a fallback for anything uncovered (user's choice, made earlier when this was first proposed)
* Curated tag vocabulary: invent a new tag list vs. mirror the exact words `tagService.ts`'s prompt already asks the AI for

## Decision Outcome

**Separate `EditItemScreen`**, reached by tapping a wardrobe item's photo on `WardrobeScreen` (new `EditItem: { item: WardrobeItem }` route). Chosen over an `AddItemScreen` mode flag specifically to avoid pulling `expo-camera` permissions/ref/capturing state into a screen that never touches the camera, and to sidestep the back-vs-retake ambiguity a shared header would otherwise create (edit mode's back button unambiguously exits to Wardrobe; add mode's still retakes the photo).

**Extracted two shared components**: `CategoryPicker` (single-select category chips, pulled out of `AddItemScreen` where it was already duplicated between the camera and review steps) and `WardrobeItemForm` (category picker + name input + tag chips + curated tag picker + free-text fallback + save button), used by both `AddItemScreen`'s review step and `EditItemScreen`. Both screens only differ in surrounding logic (camera capture vs. pre-fill from a passed item, `addItem`+`copyPhotoToApp` vs. `updateItem`).

**Curated tag picker vocabulary lives in one file** (`src/constants/tagVocabulary.ts`) and deliberately mirrors `tagService.ts`'s prompt: same color list, same pattern/brightness words, and the same category-dependent secondary group (fit/weight for top/bottom, material/type for shoes, material for accessories) introduced in ADR 0009's follow-up. Tapping a curated chip and typing a custom tag both funnel through the same `onToggleTag` handler as removing an existing tag chip, so there's exactly one code path for tag state — the curated picker's checked/unchecked display and the "current tags" remove-list can never disagree about what's actually applied.

### Consequences

* Good, because a wrong AI guess is now correctable in-app without deleting and re-adding the item.
* Good, because curated tags are guaranteed to match the AI's own vocabulary — picking `[x] navy` from the list produces the exact same tag string the tagger would have produced.
* Good, because the shared-component extraction means the category picker and the whole tag-editing UI only exist in one place now, not duplicated a third time.
* Neutral, because `EditItemScreen` doesn't support retaking the photo or changing the underlying image — v1 is scoped to name/category/tags only, matching what was explicitly asked for.
* Bad, because the curated vocabulary in `tagVocabulary.ts` and the AI prompt's vocabulary in `tagService.ts` are two separate string lists that happen to match today — if one changes without the other, they'll silently drift out of sync. No shared single source of truth was set up between the prompt strings and the UI constants.

### Confirmation

Added test coverage for every new piece: `CategoryPicker.test.tsx` (2 tests), `WardrobeItemForm.test.tsx` (11 tests covering tag toggling, curated-chip checked state, category-dependent secondary groups, custom-tag normalization, save/saving states), `EditItemScreen.test.tsx` (3 tests: pre-fill from route params, save calls `updateItem` and navigates back, back button doesn't save), and a new `WardrobeScreen` test for the tap-to-edit navigation. Full suite: 25/25 suites, 178/178 tests, `tsc --noEmit` clean (0 errors).

## Known tech debt / open items (not addressed by this decision)

* The curated tag vocabulary (`tagVocabulary.ts`) and the AI prompt's vocabulary (`tagService.ts`) are not derived from a single shared source — they must be kept in sync by hand if either changes.
* `EditItemScreen` cannot retake the photo or delete the item (deletion remains only on `WardrobeScreen`'s card) — deliberately out of scope for v1, not a known bug, but a natural next increment if requested.
