---
status: accepted
date: 2026-11-11
decision-makers: [Naftali Caplan]
consulted: []
informed: []
tc-schema-version: 1
tc-benefit: Swaps the single model backing all 4 AI checkers to one that measurably fixes real selfie-checker accuracy bugs (background-color bleed, hallucinated occluded garments) and improves the light checker's two known limitations, without raising the shared per-call cost as much as generic pricing would suggest. Also closes a real production outage this swap caused, at its actual root cause rather than by just reverting, and fixes two smaller but user-visible accessory-tagging defects found during the same on-device round.
tc-category: reliability
tc-conditions: Holds as long as Cloudflare Workers AI keeps serving `@cf/mistralai/mistral-small-3.1-24b-instruct` and that model's image decoder doesn't develop new input-shape sensitivities beyond the EXIF-orientation one found and fixed here. If a future model swap hits another unexplained backend error, the EXIF-rotation A/B method documented below is the first thing to try, not a fresh investigation from scratch.
tc-signals:
  - regression-prevention
  - user-research-integration
tc-confidence: 4
---

# Vision Model Swap (Mistral) and EXIF-Orientation Crash Fix

## Context and Problem Statement

A friend's on-device test of the selfie outfit checker (ADR 0022) surfaced two real accuracy bugs: a colorful couch's colors bled into detected clothing (`bottom:[blue,yellow,orange,purple,red,striped,...]` for plain blue jeans), and the model hallucinated garments that weren't visible at all (phantom shoes with no feet in frame, a phantom bottom+belt on a photo cropped at the chest). Tightening `buildSelfieDetectionPrompt()` (explicit background-exclusion and occlusion rules) did not fix it — re-tested against fresh seated/busy-background photos and 3 of 4 cases failed identically. This matched the same perception-ceiling pattern already documented for the light checker (ADR/testing history, `project_food-app_light_checker` memory): the model commits to a wrong read before any instruction-following can override it. The only remaining lever was a different vision model.

## Decision Drivers

* All 4 checkers (food/wardrobe/selfie/light) share one `MODEL` constant in `server/src/index.ts` — any swap needed validating across all of them, not just selfie, before touching production.
* Cloudflare's generic per-token pricing table suggested candidate models could cost 5-6.7x the current model per call — real measured cost needed to be confirmed before committing, not assumed.
* Whatever was chosen had to be testable without risking the shipped app or the real account's shared rate limits.

## Considered Options

**Model candidates** (free-tier-eligible only; paid-tier options `glm-5.3-flash`/`kimi-k2.6` explicitly deferred this round):
* `@cf/meta/llama-4-scout-17b-16e-instruct` — fixed all 3 selfie bugs, but noticeably slower (a full 21-photo batch exceeded a 180s timeout) and showed one reproducibility concern (a false "no clothing detected" on an easy, unambiguous photo — not reproducible on 3 immediate retries).
* `@cf/mistralai/mistral-small-3.1-24b-instruct` — chosen. Fixed all 3 selfie bugs, was faster, and measured cheaper than Scout (real `usage.neurons` from Workers AI's own response: ~37 neurons/selfie-check vs. Scout's ~49; ~27 vs. ~30 for the light checker — both far below the generic pricing-table estimate). Also incidentally fixed one of the light checker's two known limitations and improved the other.

**Comparison mechanism:**
* Add a test-only `model` override to the Worker proxy — chosen. `VisionRequestBody.model` is honored only when the request authenticates as the batch-testing harness's test client (never reachable from the shipped app), paired with a matching `modelOverride` param on `callCloudflareVision()`. Let `testing/`'s existing batch scripts compare candidates against the real deployed Worker with zero risk to the live app or its rate limits.
* Spin up a second separate Worker for comparison testing — rejected; more infrastructure for no real benefit over a request-scoped override gated to the already-trusted test secret.

**Production break response** (`8005: Internal server error`, undocumented in Cloudflare's own Workers AI error table, hit within minutes of swapping):
* Revert immediately, investigate separately — chosen for the first pass, to restore service without time pressure.
* Root-cause via direct A/B testing rather than guesswork — chosen for the follow-up. Ruled out plain image size first (a synthetic 5MB+ high-entropy JPEG succeeded on both models). Then isolated the actual variable: the same photo, byte-identical except for its EXIF orientation tag, failed 3/3 on Mistral with a non-identity orientation value and succeeded 3/3 with no EXIF or an identity orientation value — and succeeded 3/3 on `llama-3.2-11b` regardless. Conclusively a Mistral-specific image-decoder bug, not a routing/capacity flake (which would have shown inconsistent results across identical repeated calls) and not a generic Workers AI limit (which would have affected both models).
* Fix path once root-caused: strip/normalize EXIF orientation client-side (chosen) vs. wait on Cloudflare to fix their model-serving pipeline (rejected — no visibility into if/when, and the client-side fix is a genuine improvement regardless of which model is ever running).

## Decision Outcome

**`server/src/index.ts`** — `MODEL` is `@cf/mistralai/mistral-small-3.1-24b-instruct`. `VisionRequestBody` gained an optional `model` field, honored only for the test client (`isTestClient`), falling back to the `MODEL` constant otherwise; `env.AI.run()`'s first argument is cast `as never` the same way its second argument already was, to sidestep the generated per-model overload union.

**`src/services/visionClient.ts`** — `callCloudflareVision()` gained an optional trailing `modelOverride` param, included in the request body only when defined. Every real app call site keeps passing nothing for it, so this is purely additive.

**`src/services/cloudflareVision.ts`** — `photoToBase64()` rewritten. Previously read the camera's raw file bytes directly (`new File(photoUri).arrayBuffer()`) and base64-encoded them as-is. Now routes every photo through `expo-image-manipulator` (`ImageManipulator.manipulate(uri, { maxWidth: 1600, maxHeight: 1600 }).renderAsync()` → `saveAsync({ base64: true, compress: 0.85, format: SaveFormat.JPEG })`) before upload. The decode-and-re-encode this forces bakes any EXIF rotation into the actual pixels and drops the orientation tag from the output JPEG entirely — fixing the crash regardless of which model is serving requests. The `maxWidth`/`maxHeight` bound only downsamples if the source exceeds it (never upscales), which also shrinks typical full-resolution captures substantially as a side effect. `size` is now derived from the output base64 string's own length rather than a separate file read.

**Two accessory-tagging fixes found during the same on-device round** (`src/services/selfieAnalysis.ts`, `src/constants/tagVocabulary.ts`):
* `parseAccessories` was keeping an accessory entry even when the model's `type` didn't match the known vocabulary — producing a type-less, color-only "ghost" accessory that rendered as unhelpful clutter in the result card (e.g. the model mislabeling a handheld phone as a wearable accessory). Now an unrecognized type drops the whole entry instead of keeping it half-empty.
* Real (non-tinted) glasses were being mislabeled `sunglasses` — there was no separate vocabulary option for plain glasses. Added `glasses` to `ACCESSORY_TYPE_TAGS`, which flows automatically into both the selfie-detection and wardrobe-tagging prompts since they generate their type lists from that same shared array.

### Consequences

* Good, because the selfie checker's two reported accuracy bugs are fixed, confirmed via `testing/run-selfie.ts` against the exact photos that reproduced them, not just reasoned about.
* Good, because the light checker's two previously-documented "model ceiling" limitations (`project_food-app_light_checker` memory) are improved — one (vent-trim false positive) now correctly resolves to "Unclear," the other (multi-light) correctly perceives both lights even where it doesn't yet always resolve to "Unclear."
* Good, because the EXIF fix is a durable, client-side improvement independent of model choice — any future model swap benefits from it too, and it also reduces typical upload payload size.
* Good, because a real production outage was root-caused with hard evidence (deterministic A/B reproduction) rather than assumed-and-worked-around, and the fix address the actual defect rather than just avoiding it by picking a different model.
* Neutral, because Mistral's real per-call cost (~2-2.6x the previous model, measured) is higher than before, though still free-tier-eligible at current usage levels — revisit if/when the already-flagged backend-cost-at-scale decision (`project_food-app_full_launch_checklist` memory) is picked up.
* Bad/unproven, because the light checker's multi-light case is improved but not 100% reliably fixed — a fresh full `testing/run-light.ts` pass against all known photos, now that Mistral is staying live, would give a more current read than the single-run observations this decision was based on.

### Confirmation

Verified via `testing/`'s batch harness across all 4 checkers (model-override comparison, food/wardrobe smoke tests, full selfie/light batches) before any production change, then via direct on-device testing after deploying — confirmed no more `8005` errors on real captures, confirmed the accessory fixes render correctly. Updated 4 existing service tests (`cloudflareService`/`tagService`/`selfieCheckService`/`lightCheckerService` `.test.ts`) to mock `expo-image-manipulator` instead of the old `expo-file-system` read; added `src/testUtils/fakeBase64.ts` so `cloudflareService.test.ts`'s image-size-based confidence tests could still control the effective output size. Updated one `selfieCheckService.test.ts` case to assert an unrecognized accessory type now drops the whole entry rather than keeping it half-empty. Full suite: 41/41 suites, 421/421 tests, `tsc --noEmit` and lint both clean.

## Known tech debt / open items (not addressed by this decision)

* The light checker's multi-light case is improved, not fully fixed — see Consequences above.
* Backend cost at real public scale (beyond the current friend-group round) is still an open decision, now with a real ~2-2.6x cost multiplier to factor in instead of a generic estimate.
* `expo-image-manipulator`'s orientation-normalizing behavior was verified empirically (the crash stopped, confirmed on-device) but its exact internal mechanism (how the native decode step resolves EXIF orientation) was not independently verified beyond that outcome.
