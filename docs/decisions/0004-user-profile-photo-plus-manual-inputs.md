---
status: accepted
date: 2026-07-02
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Combining a reference photo (AI-extracted complexion description) with manual height and build inputs gives the outfit AI enough personal context to reason about proportion and contrast without requiring the user to self-describe attributes they cannot perceive due to color blindness.
tc-category: ux
tc-conditions: The AI can reliably extract undertone and contrast description from a face/body photo without relying on color names, and the user is willing to take a reference photo once during setup.
tc-signals:
  - interface-stability
tc-confidence: 3
---

# Combine Reference Photo and Manual Inputs for User Profile (B1)

## Context and Problem Statement

The B1 personalisation path needs to know enough about the person wearing the outfit to give the AI meaningful context — things like complexion undertone, feature contrast, height, and build. The question is how to collect that data in a way that is accurate, accessible for a colorblind user, and low-friction enough to not block first use.

## Decision Drivers

* A colorblind user cannot reliably self-report their own skin tone or undertone — asking "are you warm or cool toned?" is inaccessible
* Height and build are attributes the user can self-report accurately (they know if they are tall or slim)
* A reference photo lets the AI extract complexion context (undertone, feature contrast) without requiring the user to describe it
* Profile setup must be optional — B2 outfit generation works without it
* The profile is captured once and reused indefinitely — high setup cost is acceptable

## Considered Options

* Photo only — AI infers everything including height and build from the image
* Manual inputs only — user selects all attributes from dropdown/chip pickers
* Photo for complexion + manual for height and build

## Decision Outcome

Chosen option: "Photo for complexion + manual for height and build", because each input method is matched to what the user can accurately provide. The AI reads the photo for complexion (which the user cannot self-report reliably) and the user selects height/build from labelled chips (which they know exactly). This avoids asking the AI to infer height from a photo (unreliable) and avoids asking the colorblind user to self-describe tone (inaccessible).

The `extractSkinTone` function in `tagService.ts` is instructed never to use color names — it describes undertone (warm/cool/neutral) and feature contrast (high/medium/low), which are the attributes an AI stylist can actually act on.

### Consequences

* Good, because complexion data is extracted without asking the user to perceive their own skin tone.
* Good, because height and build selections are immediately accurate — no AI inference needed.
* Good, because profile is optional — skipping it drops to B2 (style-only outfit generation) with no degraded experience.
* Bad, because setup requires two steps (photo + manual selection) rather than one — mitigated by the profile being a one-time setup.
* Bad, because the reference photo must be retaken if the user's appearance changes significantly.

### Confirmation

`UserProfileScreen.tsx` captures a reference photo via camera, calls `extractSkinTone(photoUri)` from `tagService.ts` to get a `skinToneDesc` string, and combines it with manual `heightRange` and `build` chip selections into a `UserProfile` object persisted via `profileStorage.ts`. The `outfitService.ts` B1 path prepends this profile as a PERSON context block in the outfit prompt.

## Pros and Cons of the Options

### Photo only

* Good, because single capture step — lowest friction
* Bad, because AI height/build inference from a photo is unreliable — depends on camera angle, what the user is wearing in the photo, and background context

### Manual inputs only

* Good, because no camera required for profile setup
* Bad, because asking a colorblind user to select their own skin tone or undertone is inaccessible — they may not be able to perceive the difference between warm and cool tones

### Photo for complexion + manual for height and build

* Good, because each method is matched to what the user can accurately provide
* Good, because `extractSkinTone` uses undertone and contrast language rather than color names, keeping output usable in the AI outfit prompt
* Neutral, because two-step setup adds some friction, acceptable given it is done once
