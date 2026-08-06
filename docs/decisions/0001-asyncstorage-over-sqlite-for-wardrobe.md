---
status: accepted
date: 2026-07-02
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: AsyncStorage requires no schema definition or migration logic, letting the wardrobe data model evolve freely as new item attributes are added without breaking existing stored data.
tc-category: data-management
tc-conditions: The wardrobe remains a flat list of fewer than ~200 items and query patterns stay simple (load-all, filter in JS).
tc-signals:
  - reduced-change-scope
  - interface-stability
tc-confidence: 4
---

# Use AsyncStorage over SQLite for Wardrobe Persistence

## Context and Problem Statement

The wardrobe feature needs persistent local storage to save clothing items and user profile data across app restarts. Two realistic options exist in the Expo ecosystem: `@react-native-async-storage/async-storage` (key-value JSON store) and `expo-sqlite` (relational database). The choice affects complexity, query capability, and future scalability.

## Decision Drivers

* Wardrobe items are loaded all-at-once — no pagination needed at this scale
* Query patterns are simple: load all, filter in JS, save all
* SQLite requires schema migrations when data shape changes
* AsyncStorage is compatible with Expo managed workflow with no extra native config
* Single developer — minimising operational overhead matters

## Considered Options

* AsyncStorage with JSON arrays per key
* expo-sqlite with relational tables and SQL queries

## Decision Outcome

Chosen option: "AsyncStorage with JSON arrays per key", because the wardrobe data model is a flat list with no joins, no aggregations, and no queries that benefit from SQL. All filtering (by style tag, by category) happens in JavaScript after a single load. SQLite would add schema definition, migration logic, and query boilerplate for no practical gain at this scale.

### Consequences

* Good, because data shape changes (adding a field to `WardrobeItem`) require no migration — old JSON is parsed with defaults.
* Good, because photos are stored as files via expo-file-system alongside AsyncStorage metadata, keeping payloads small.
* Bad, because if the wardrobe grows to hundreds of items, JS-side filtering becomes a bottleneck — SQLite would be the right migration at that point.
* Bad, because there are no foreign key guarantees — an orphaned photo is possible if a crash occurs mid-save. Mitigated by always copying the file before writing metadata.

### Confirmation

`wardrobeStorage.ts` uses a single `@cba_wardrobe` AsyncStorage key containing a JSON array of `WardrobeItem`. Photos are copied to `FileSystem.documentDirectory/wardrobe/<id>.jpg` before the metadata entry is written, ensuring a crash cannot produce a metadata record pointing to a missing file.

## Pros and Cons of the Options

### AsyncStorage with JSON arrays per key

* Good, because zero schema to maintain
* Good, because compatible with Expo managed workflow — no extra native linking
* Neutral, because entire wardrobe is loaded on every read — acceptable for small wardrobes, revisit if scale grows

### expo-sqlite with relational tables and SQL queries

* Good, because supports indexed queries and complex filtering
* Bad, because requires schema definition and migration scripts for every data model change
* Bad, because adds setup complexity for queries we never actually need
