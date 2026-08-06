---
status: accepted
date: 2026-07-02
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Keeping camera as local state within UserProfileScreen avoids duplicating navigator registration and navigation param passing just to handle a sub-flow that only exists within profile setup.
tc-category: ux
tc-conditions: The camera sub-flow does not need to be navigated to from outside UserProfileScreen, and the screen has no other sub-flows that would make local state unwieldy.
tc-signals:
  - interface-stability
  - reduced-change-scope
tc-confidence: 4
---

# Manage Camera Sub-Flow as Local State Inside UserProfileScreen

## Context and Problem Statement

`UserProfileScreen` needs a camera capture step to take a reference photo. The question is whether that camera view should be a separate registered screen in the navigator (requiring navigation params and a dedicated route) or an in-component state toggle (showing/hiding the camera within the same component).

## Decision Drivers

* The camera view is only ever reached from UserProfileScreen, never from any other screen
* The captured photo URI and extracted skinToneDesc must be passed back to the profile form — keeping them in the same component avoids navigation params
* AddItemScreen used the same three-step local state pattern successfully for the same reason
* A separate screen would require registering another route in types.ts and RootNavigator.tsx and passing photo data through navigation params — extra wiring with no benefit

## Considered Options

* Separate `ProfileCameraScreen` registered in the navigator
* Camera sub-flow as `showCamera` boolean state within UserProfileScreen

## Decision Outcome

Chosen option: "Camera sub-flow as `showCamera` boolean state within UserProfileScreen", because the camera is an internal step of a single-purpose screen. The component uses a `showCamera` boolean and a `cameraStep: 'preview' | 'capturing' | 'extracting'` state variable to conditionally render either the camera view or the profile edit form. This avoids all navigation param passing and keeps the entire profile flow's state in one place.

### Consequences

* Good, because captured photo URI and skinToneDesc flow directly from the camera handler into profile form state — no params, no route.
* Good, because "Cancel" during camera step simply sets `showCamera = false` — no navigation.pop() needed.
* Good, because one less route to register and one less navigator entry to maintain.
* Bad, because if another screen ever needs to launch a profile photo capture directly, a separate screen would be cleaner — acceptable tradeoff given the current single-entry-point requirement.

### Confirmation

`UserProfileScreen.tsx` uses `const [showCamera, setShowCamera] = useState(false)` and `const [cameraStep, setCameraStep] = useState<CameraStep>('preview')`. The render block checks `if (showCamera)` first and returns the camera UI; otherwise returns the profile edit ScrollView. Capture calls `extractSkinTone()`, sets `photoUri` and `skinToneDesc`, then calls `setShowCamera(false)` — all within the same component.

## Pros and Cons of the Options

### Separate `ProfileCameraScreen` registered in the navigator

* Good, because follows the same screen-per-step pattern as other screens in the app
* Bad, because requires passing photo URI back via navigation params or a global store — adds complexity for a one-way data flow
* Bad, because adds another route entry and navigator registration for a sub-flow with exactly one caller

### Camera sub-flow as `showCamera` boolean state within UserProfileScreen

* Good, because photo URI, skinToneDesc, and all form state live in one component — zero param passing
* Good, because cancelling camera is a local state reset, not a navigation action
* Neutral, because conditional render of two distinct UIs in one file adds length to the component — acceptable given it is a self-contained flow
