---
status: accepted
date: 2026-07-02
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Serialising wardrobe items as tag strings rather than images removes the per-item base64 encoding cost and keeps the outfit generation prompt a single affordable text call, regardless of wardrobe size.
tc-category: performance
tc-conditions: Item tags are sufficiently descriptive that the AI can reason about outfit compatibility without seeing the item photos. This holds as long as the tagging step (AddItemScreen) produces good tags.
tc-signals:
  - reduced-change-scope
  - interface-stability
tc-confidence: 4
---

# Serialise Wardrobe as Tag Strings for Outfit Generation (Text-Only Prompt)

## Context and Problem Statement

Outfit generation needs to reason about all wardrobe items to select a combination. The question is whether to send each item's photo to the AI (vision call, one image per item) or to describe items in text using their stored tags (text-only call).

## Decision Drivers

* Cloudflare's vision model accepts at most one image per call in the current API — sending multiple item photos in a single outfit request is not supported
* Encoding and transmitting one photo per item would require N separate API calls for N items or a multi-step aggregation approach
* Item tags were specifically designed to capture the attributes that matter for outfit matching: brightness, pattern, tone, style, fit
* A text prompt listing `[id] category — tags: light, warm-tone, solid, casual` gives the AI enough to reason about contrast, pattern balance, and style alignment without seeing the image
* The tag review step in AddItemScreen ensures tags are human-verified before storage

## Considered Options

* Vision call per item — send each item's photo to the AI separately and aggregate
* Single text-only call — serialise all items as tag strings in one prompt

## Decision Outcome

Chosen option: "Single text-only call", because the Cloudflare vision model's one-image-per-call constraint makes multi-image vision approaches require multiple round trips, and the tag data model was designed specifically to support this. A single text call is cheaper, faster, and produces equivalent outfit quality because the AI's decisions (contrast, pattern mix, style coherence) are determined by the tag attributes, not the visual content of the photos.

### Consequences

* Good, because one API call for any wardrobe size — latency does not scale with number of items.
* Good, because no base64 encoding overhead on the outfit generation path.
* Bad, because outfit quality depends on tag quality — if a user skips the review step or the AI produces poor tags, outfit suggestions degrade silently.
* Bad, because the AI cannot see actual visual appearance — it cannot catch combinations that look off despite matching tags (e.g., two items with identical brightness that clash visually).

### Confirmation

`outfitService.ts` exports `generateOutfit()` which calls `callCloudflareText()` (not `callCloudflare()`) — no image encoding step. Each `WardrobeItem` is serialised by `serializeItem()` into `[id] category (name) — tags: tag1, tag2, ...` and sent as plain text in a structured prompt.

## Pros and Cons of the Options

### Vision call per item

* Good, because the AI sees actual visual content — can detect mismatches tags don't capture
* Bad, because requires N API calls for N items or a complex multi-image aggregation
* Bad, because the current Cloudflare vision endpoint accepts one image per call — no multi-image support

### Single text-only call

* Good, because one round trip regardless of wardrobe size
* Good, because tag strings carry the attributes the AI needs (brightness, pattern, tone, style)
* Neutral, because quality ceiling is bounded by tag accuracy — acceptable given the human tag review step
