---
status: accepted
date: 2026-07-24
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: A single-accent, sharp-cornered, bracket-labeled terminal aesthetic gives every future screen one unambiguous visual vocabulary to extend (one accent token, borderRadius 0, bracket radio/checkbox controls) instead of accreting inconsistent per-screen styling, while every icon-driven signal still doubles as a colorblind-safe text label with no color dependency.
tc-category: ux
tc-conditions: Holds as long as future UI additions reuse AppText/shared color tokens rather than introducing new ad hoc colors or rounded components. A native platform control that can't be restyled (Switch, ActivityIndicator, the camera capture shutter) must be treated as a deliberate, listed exception rather than silently reintroducing rounded/colored chrome.
tc-signals:
  - interface-stability
  - reduced-change-scope
tc-confidence: 3
---

# Terminal-Style Visual Redesign: Monospace Type, Bracket Iconography, Single Accent, Sharp Corners

## Context and Problem Statement

The app inherited emoji-based icons, two separate brand accent colors (green for food-checking, purple/indigo for clothes/wardrobe), rounded pill-shaped chips and buttons, and native OS `Switch` toggles from its earlier "food app" incarnation. Partway through building the clothes-matcher/outfit feature, the user asked for the whole app to feel like a terminal instead. An initial pass — monospace font plus emoji-to-bracket-tag replacement, but keeping the existing colors and rounded shapes — did not read as terminal-like once actually run in a browser. The remaining rounded, dual-accent, native-control chrome dominated the visual impression more than the font/iconography change did. The question is how far the terminal treatment needs to go, and how to reconcile it with the pre-existing colorblind-accessibility requirement that state/verdict information never depend on color alone.

## Decision Drivers

* A monospace font and bracket-tag icons alone don't read as "terminal" if rounded pill chips, colored fills, and OS-native Switches remain
* The app's stated audience is colorblind users — any icon serving as a colorblind-safe signal (`ResultCard`/`ClothesResultCard` state icons) must keep a distinct, non-color-dependent representation, not just be deleted for the sake of styling
* Two competing accent colors (green/food, purple/clothes) work against a single-hue "terminal" identity
* Native `Switch` components are platform-rendered and can't be restyled to remove their rounded pill/track shape
* Minimizing touched surface area — `colors.ts` tokens are consumed by name across ~15 files, so repointing token values is much lower risk than search-replacing every call site

## Considered Options

* Font + iconography only, keep existing rounded/dual-accent chrome (the initial pass)
* Full monochrome terminal: single accent color, sharp corners, bracket radio/checkbox controls instead of colored pills and native switches
* Keep two accent colors but flatten/sharpen both independently

## Decision Outcome

Chosen option: "Full monochrome terminal" — one accent color app-wide, `borderRadius: 0` everywhere except the camera capture shutter (a deliberately circular real-world affordance), and bracket-style controls replacing both colored pill chips and native `Switch` toggles: `(x)`/`( )` for single-select pickers (category, height, build) and `[x]`/`[ ]` for multi-select pickers (outfit style) and toggles (include accessories, personalize for me). The single accent was implemented by repointing `clothesAccent`/`clothesAccentMuted` in `colors.ts` to the same values as `accent`/`accentMuted`, rather than rewriting every one of the ~15 consuming files — a much smaller, lower-risk diff that still achieves one visual accent everywhere.

### Consequences

* Good, because the app now has one unambiguous visual vocabulary (one accent, sharp corners, bracket controls) instead of accreting inconsistent per-screen styling as new screens are added.
* Good, because colorblind-accessible icons (`ResultCard`/`ClothesResultCard`) were preserved as distinct bracket tags rather than removed — color is still never the sole signal.
* Good, because repointing color tokens instead of rewriting call sites kept the palette change to a couple of lines in `colors.ts`, not a 15-file refactor.
* Neutral, because `ConfidenceBadge` and the free-form tag chips in `AddItemScreen` kept a subtle muted background fill (now sharp-cornered) since they're informational tokens, not selection controls — not everything went to zero-fill.
* Bad, because native `ActivityIndicator` spinners and the `CaptureButton` shutter remain circular/OS-styled — listed, deliberate exceptions, not oversights.
* Bad, because this was a purely visual/interaction-role change with no new automated test coverage for "does it look like a terminal" — verification of the actual look is necessarily manual/visual.

### Confirmation

Verified via: (1) full jest suite green (20/20 suites, 135/135 tests) after updating assertions from `accessibilityState.selected` / `Switch.props.value` to `accessibilityState.checked` on the new radio/checkbox rows; (2) `tsc --noEmit` clean except the pre-existing unrelated `wardrobeStorage.ts`/`expo-file-system` error; (3) a project-wide scan confirming zero pictorial emoji remain outside the intentionally-kept `← → ✓ ✕ •` glyphs. Manual visual confirmation in a real browser/device session was still pending as of this writing.

## Pros and Cons of the Options

### Font + iconography only

* Good, because smallest diff, no risk to existing rounded-chrome screens
* Bad, because it did not actually read as "terminal" once run — confirmed by direct user feedback after trying it

### Full monochrome terminal

* Good, because it addresses every element the user called out (duplicate accent colors, rounded chips/buttons, native switches)
* Good, because bracket radio (`(x)`/`( )`) vs checkbox (`[x]`/`[ ]`) conventions mirror real terminal UI idioms and communicate single- vs multi-select semantics for free
* Bad, because larger diff surface: `borderRadius` zeroed across ~15 files, plus structural JSX rewrites in three picker screens and the toggle rows

### Keep two accent colors, sharpen both

* Good, because it preserves the food-vs-clothes wayfinding cue the two colors provided
* Bad, because explicitly rejected by the user in favor of one unified accent — not pursued

## Follow-up: header/spacing consistency pass (2026-07-25)

A full-codebase audit (grouping every style mismatch across all 9 screens with a back button) found: three different header layouts in use (centered, left-aligned row, stacked column); `screenTitle` at three different font sizes/weights; `backText` split between two color tokens (`accent` vs `clothesAccent`) that only rendered identically because of this ADR's earlier token-repointing; inconsistent back-button tap-target padding; a stray-spaced `[ EMPTY ]` bracket tag; `WardrobeScreen`'s disabled Build button using a different disabled-state treatment than every other screen; and minor button-text size drift (15 vs 16).

Resolved by extracting `src/components/ScreenHeader.tsx` — a single component now used by all 9 screens with a back button (`WardrobeScreen`, `AddItemScreen`, `ClothesCheckerScreen`, `ClothesResultsScreen`, `FoodCheckerScreen`, `OutfitBuilderScreen`, `OutfitResultsScreen`, `ResultsScreen`, `UserProfileScreen`). It renders a back button (`backLabel` overridable for "← Cancel"/"← Retake" cases) and a `flex:1, textAlign:'center'` title (18px/600, the `AddItemScreen` standard) between two equal `minWidth` side slots so the title stays centered whether or not a screen has right-side content (profile/add icons, attempt counter, or nothing). `backText` color unified to `Colors.clothesAccent` everywhere. `FoodCheckerScreen` gained a title ("Is it ready?") it never had. `[ EMPTY ]` → `[EMPTY]`. `WardrobeScreen`'s `buildBtnDisabled` switched to the app-wide `opacity: 0.6` pattern. This is exactly the class of drift a shared component prevents going forward — extracting it now, rather than earlier, was justified because the pattern only became provably identical (not just similar) once traced across all 9 screens.

Verified via: full jest suite (21/21 suites, 138/138 tests, including a new `ScreenHeader.test.tsx`) and `tsc --noEmit` clean except the same pre-existing `wardrobeStorage.ts` error.

## Follow-up: zero exceptions + confidence cap (2026-07-25)

User asked to remove every remaining rounded element with no exceptions, including the `CaptureButton` shutter this ADR had previously carved out as deliberate (circular real-world camera-shutter affordance). Flattened it too (`borderRadius: 0` on both the outer ring and inner fill) — there are now zero non-zero `border*Radius` values anywhere in `src`.

While re-auditing for uniformity, found the accent-color fragility this ADR flagged earlier (`clothesAccent`/`clothesAccentMuted` as separate tokens that only rendered identically because they'd been repointed to the same hex values as `accent`/`accentMuted`) was still latent in ~9 files beyond the `backText` fix already applied. Fully collapsed: every `Colors.clothesAccent(Muted)` reference renamed to `Colors.accent(Muted)`, then the now-dead `clothesAccent`/`clothesAccentMuted` keys deleted from `colors.ts` entirely — one canonical accent token, no duplicate aliases left to drift.

Unrelated to the visual redesign but requested in the same pass: raised the food-checker's displayed confidence ceiling from 95 to 99 (`adjustConfidence()` in `cloudflareService.ts`, final `Math.min(95, adjusted)` → `Math.min(99, adjusted)`). Note the model-inflation compression formula in the same function (`75 + (adjusted - 85) * 0.4` for raw scores above 85) already caps realistic output around 81 in practice — the 95→99 ceiling change was the literal ask (the hard cap itself) and was left as the only change; the compression formula was intentionally not touched since recalibrating it is a separate, not-requested decision.

Verified via: full jest suite (21/21 suites, 138/138 tests) and `tsc --noEmit` clean (same pre-existing error only).

## Follow-up: on-device visual feedback (2026-07-25)

First live Expo Go test surfaced two more visual notes. (1) The single accent color (`#4ADE80`) read as "too neon" on an actual phone screen — dialed back to a more muted/desaturated `#4A9B6E` (with `accentMuted`/`accentText` adjusted to match), applied as a judgment call for the user to react to live rather than debated in the abstract, since a real device is a much faster feedback loop than describing hex codes. Only the brand-chrome accent changed — the food/clothes state/verdict colors (`stateRipe`, `clothesStrongMatch`, etc.) were left alone, consistent with this ADR's original accessibility-color boundary. (2) `AddItemScreen`'s 4-chip category row (Top/Bottom/Shoes/Accessory) stranded "Accessory" alone on a second row on a real phone width — converted from 4 equal `flex:1` columns to a `flexWrap` grid (`minWidth: '45%'`, matching the pattern already used by `OutfitBuilderScreen`'s style picker) so it renders as a deliberate 2×2 grid at phone width instead of an accidental 3-plus-1 split.

## Known tech debt / open items (not addressed by this decision)

* `expo-camera`'s `takePictureAsync()` does not appear to work in the browser (Expo web) build — capture silently stalls with no error surfaced. Suspected to be a web-only limitation of `expo-camera` rather than an app bug; unconfirmed on native until a full Expo Go session is run on-device.
* `src/storage/wardrobeStorage.ts` fails `tsc --noEmit`: `FileSystem.documentDirectory` no longer exists on the `expo-file-system` API surface after the earlier SDK 54 migration (see git history: "Upgrade to SDK 54, migrate to Cloudflare Workers AI"). Pre-existing, unrelated to this redesign, still unresolved.
* Checkpoint 4 (Wardrobe → Build an Outfit → style picks → AI suggestion → Yes/No loop) has still never been verified end-to-end on a live device or in a real browser session — only unit/component tests and a `tsc` pass have verified it so far.
