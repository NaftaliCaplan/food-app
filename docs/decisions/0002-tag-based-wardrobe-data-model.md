---
status: accepted
date: 2026-07-02
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: A flat tag array lets AI-generated descriptions flow directly into outfit prompts without a translation layer, while a typed category field gives the UI enough structure for icons and grouping.
tc-category: data-management
tc-conditions: Tag vocabulary stays stable enough that the AI produces consistent tags across different items and sessions.
tc-signals:
  - interface-stability
  - reduced-change-scope
tc-confidence: 4
---

# Use Hybrid Category + Tag Array as Wardrobe Item Data Model

## Context and Problem Statement

Each clothing item in the wardrobe must carry enough structured information for two purposes: (1) display in the wardrobe grid UI with icons and labels, and (2) serialisation into an AI prompt that generates outfit suggestions. The data model must balance structure (for reliable UI rendering) with flexibility (for the AI's open-ended descriptive vocabulary).

## Decision Drivers

* The AI prompt needs items described in plain language — tags map directly to that
* The user's design notes explicitly called out tags as the primary categorisation mechanism ("use tags to categorise, more the better")
* Item attributes (brightness, pattern, tone, style, fit) are not mutually exclusive and vary by item type — a rigid enum schema would need nullable fields everywhere
* Tags can be extended by the user or AI without any schema change
* Category is a closed set (top/bottom/shoes/accessory) that drives UI icons — it will never need new values at this scale

## Considered Options

* Rigid typed fields (brightness, pattern, tone, style as enums)
* Pure free-text description string
* Hybrid: typed category + flexible tag array

## Decision Outcome

Chosen option: "Hybrid: typed category + flexible tag array", because `category` is a small closed set that drives UI (icons, grouping) and `tags` is an open array that the AI fills in on add and the user can edit. Tags flow directly into the outfit generation prompt as `"top — tags: light, warm-tone, striped, casual"` with no translation layer.

### Consequences

* Good, because AI-generated tags feed into outfit prompts with no mapping step.
* Good, because user-added custom tags work automatically — no enum to extend.
* Good, because `category` gives enough structure for UI without constraining the descriptive layer.
* Bad, because there is no type safety on tag values — a typo (`"causal"` vs `"casual"`) won't be caught at compile time. Mitigated by the tag prompt specifying a canonical vocabulary list.

### Confirmation

`src/types/wardrobe.ts` defines `ItemCategory` as a typed union and `WardrobeItem.tags` as `string[]`. The tag prompt in `tagService.ts` includes an explicit list of expected tag values to keep vocabulary consistent across items and sessions.

## Pros and Cons of the Options

### Rigid typed fields (brightness, pattern, tone, style as enums)

* Good, because fully type-safe and filterable at compile time
* Bad, because every new attribute requires a schema change and migration of stored data
* Bad, because doesn't match how the AI naturally describes clothing — requires a mapping layer

### Pure free-text description string

* Good, because maximally flexible and easy for the AI to generate
* Bad, because cannot be filtered by tag in JS — outfit generation would have to send every item's full description regardless of style relevance
* Bad, because no consistency between items across sessions

### Hybrid: typed category + flexible tag array

* Good, because combines UI structure with AI-friendly descriptive flexibility
* Good, because tag filtering in `outfitService.ts` is a simple `item.tags.some(t => stylePrefs.includes(t))`
* Neutral, because tag consistency depends on prompt stability rather than type system guarantees
