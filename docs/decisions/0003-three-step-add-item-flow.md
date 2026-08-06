---
status: accepted
date: 2026-07-02
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Surfacing AI-generated tags for user review before save ensures every wardrobe item has verified tags, which directly improves outfit generation accuracy for every subsequent use of the wardrobe.
tc-category: ux
tc-conditions: The AI tagging call succeeds within a tolerable wait time (~5-10s) and the tag review UX stays lightweight enough not to discourage adding items.
tc-signals:
  - interface-stability
tc-confidence: 3
---

# Three-Step Add Item Flow: Camera → AI Tagging → Review

## Context and Problem Statement

Adding a clothing item to the wardrobe requires capturing a photo, generating tags that describe it, and persisting it. The question is how much control the user should have over the AI-generated tags before the item is saved — silent auto-tagging, a mandatory review step, or fully manual entry.

## Decision Drivers

* The AI makes mistakes — it may misidentify a garment or apply incorrect tags
* Bad tags silently corrupt outfit generation quality — the AI recommends clothes based on tags, so wrong tags lead to wrong outfits for every future session
* Colorblind users cannot verify color tags visually, but can verify pattern and style tags (e.g. "striped" is perceivable without color vision)
* Adding friction to fix errors post-save (editing items after the fact) is worse UX than a review step upfront
* The tagService prompt returns a suggested item name that is useful to surface for editing, avoiding a separate rename flow

## Considered Options

* Silent tagging — camera captures, AI tags, auto-saves with no review
* Manual tagging — camera captures, user enters all tags manually with no AI assistance
* AI tags first, user reviews before save

## Decision Outcome

Chosen option: "AI tags first, user reviews before save", because the tag review step costs ~15 seconds of interaction but ensures every saved item has verified tags. Given that tags directly drive all future outfit generation, the accuracy investment pays off on every subsequent use.

The three steps are implemented as local state within a single component (`step: 'camera' | 'tagging' | 'review'`) rather than three separate screens. This avoids passing photo URI and tag results through navigation params and makes "Retake" a simple state reset rather than a navigation pop.

### Consequences

* Good, because every wardrobe item has human-verified tags before storage.
* Good, because the category picker is present on both the camera and review steps, allowing correction of a misclassification at review time without retaking the photo.
* Bad, because adds ~15 seconds to the add flow compared to silent tagging.
* Bad, because if the AI tagging call fails, the screen falls back to the camera step and the user must retake — there is no "skip AI, enter tags manually" escape hatch in v1.

### Confirmation

`AddItemScreen.tsx` manages a `step` state variable. On capture, `step` moves to `'tagging'` (shows spinner), the `tagClothingItem` call resolves, then `step` moves to `'review'` (shows editable name, tag chips, and save button). The `copyPhotoToApp` + `addItem` writes happen only on explicit save button press.

## Pros and Cons of the Options

### Silent tagging

* Good, because fastest path to a populated wardrobe — no friction
* Bad, because AI errors are invisible until the user notices bad outfit suggestions, at which point the source of the problem is hard to trace

### Manual tagging

* Good, because user has full control and no AI dependency
* Bad, because burdensome — a colorblind user trying to self-describe "warm tone, light brightness, solid pattern" is error-prone and slow
* Bad, because no AI-suggested item name means the user must also provide a name from scratch

### AI tags first, user reviews before save

* Good, because combines AI efficiency with human verification
* Good, because tag chips make review fast — removing a wrong tag is one tap
* Neutral, because the 15-second add flow may feel slow on first use but becomes familiar quickly
