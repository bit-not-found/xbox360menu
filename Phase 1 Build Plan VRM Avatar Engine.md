# Phase 1 Build Plan: VRM Avatar Engine

*Agent-ready plan for the Avatar World app, Social blade, PWA console.*

## Scope

**Build:** the 3D engine foundation and VRM avatar pipeline, reachable from Social > Social Apps > Avatar World, showing the user's own avatar on a turntable.

**Do not build yet:** worlds, the editor, networking, voice, chat, boards, achievements, the Guide overlay. Leave clean extension points only (noted per step).

**Definition of done:** a user opens Avatar World from the Social blade, imports a VRoid `.vrm`, sees it rendered with idle animation, blinking, expressions and spring bones, and the avatar is still there after a reload and offline. Leaving the app frees all GPU memory. The main bundle does not grow.

## Ground rules for the agent

1. **Inspect the repo first.** Detect the existing framework (React, Vue, vanilla, etc.), router, build tool, state approach, and how blades/menus are defined. Follow existing conventions. Report findings before writing code.
2. **The engine is framework-agnostic TypeScript classes.** No React/Vue imports inside `engine/` or `avatar/`. A thin adapter component mounts it into a DOM element.
3. **Lazy-load all 3D code** behind dynamic `import()`. three.js and three-vrm must never be in the main bundle.
4. **No per-frame work through framework state.** The render loop reads from plain mutable objects.
5. **Everything that allocates GPU resources has a `dispose()`**, and it is called on unmount.
6. Pin versions of `three` and `@pixiv/three-vrm` (use matching, current releases). Use `@pixiv/three-vrm-animation` for VRMA.
7. Commit per step, each step leaving the app working.

## Target structure

```
src/social/
  registry.ts                     # social app registry
  avatar-world/
    index.ts                      # lazy entry, exports mount(el, opts) / unmount()
    hub/                          # blades-styled DOM screens (stub now)
    engine/
      Engine.ts                   # renderer, scene, camera, loop, resize, dispose
      Loop.ts                     # fixed/variable update, pause/resume, fps cap
      Quality.ts                  # device tier + settings (pixel ratio, shadows)
      Disposer.ts                 # tracks and disposes geometries/materials/textures
    avatar/
      VrmLoader.ts                # GLTFLoader + VRMLoaderPlugin, validation
      Avatar.ts                   # wrapper: vrm, mixer, expressions, update(dt), dispose()
      Animator.ts                 # VRMA load/retarget, crossfade, state names
      Expressions.ts              # blink, presets, mouth value setter (lip-sync hook)
      LookAt.ts                   # head/eye look-at target
      Optimizer.ts                # import-time texture downscale + size cap
    store/
      db.ts                       # Dexie schema
      avatars.ts                  # save/load/list/delete
      settings.ts
    assets/
      animations/                 # idle.vrma, walk.vrma, wave.vrma (placeholders ok)
      placeholder.vrm             # fallback avatar (CC0 or self-made)
```

## Steps

### Step 0: Recon and report

- Identify framework, router, build tool, PWA/service-worker setup, how blades and menu items are defined, and how gamepad input is currently handled (if at all).
- Output a short summary and confirm file locations before proceeding.

**Done when:** summary posted; no code changed.

### Step 1: Social app registry and lazy hub stub

- Create `registry.ts` with a `SocialApp` type (`id, title, icon, blade, group, load`).
- Register `avatar-world` under Social > Social Apps in the existing blades menu, using existing blade item styling.
- Route `/social/apps/avatar-world` renders a stub hub with tabs: Play, My Avatar, My Rooms, Chats, Settings. Only **My Avatar** is functional this phase; others show "Coming soon" in blades style.
- `load: () => import('./avatar-world')` so the hub itself is a separate chunk.
- Gamepad: tab switching with LB/RB, A to select, B to go back, if the existing app supports gamepad input. Reuse its input layer; do not write a second one.

**Done when:** menu entry navigates to the stub, back button returns to the blade, bundle analysis shows a separate chunk.

### Step 2: Engine core

- Install `three`, `@pixiv/three-vrm`, `@pixiv/three-vrm-animation`, `dexie`.
- `Engine` class: `constructor(container)`, creates `WebGLRenderer` (antialias on desktop, off on low tier, `outputColorSpace = SRGBColorSpace`), scene, `PerspectiveCamera`, soft lighting (one directional + hemisphere), `ResizeObserver` for resize.
- `Loop`: `requestAnimationFrame`, delta clamped (max 0.1s), `pause()/resume()`, optional fps cap (default 60, settable to 30 for the future Guide overlay), pauses automatically on `visibilitychange`.
- `Quality`: detect tier (mobile UA/`hardwareConcurrency`/`deviceMemory`) and set `pixelRatio` (desktop min(dpr,2), mobile min(dpr,1.5)), shadows on/off.
- `Disposer` and `Engine.dispose()`: stops loop, removes listeners, disposes renderer, forces context loss, removes canvas.
- Handle `webglcontextlost` / `webglcontextrestored` gracefully (show message, rebuild on restore).
- Engine exposes `addUpdatable(fn)` and `scene` so later phases (world, networking) plug in without edits.

**Done when:** a spinning test cube renders in the hub's My Avatar tab; mounting and unmounting 10 times leaves no growth in GPU/JS memory (check `renderer.info`).

### Step 3: VRM loading

- `VrmLoader.load(source: ArrayBuffer | Blob | URL)`: `GLTFLoader` with `VRMLoaderPlugin`, parse, return the VRM.
- After load: `VRMUtils.removeUnnecessaryVertices`, `VRMUtils.combineSkeletons` (or the version-appropriate equivalent), and `VRMUtils.rotateVRM0` for VRM 0.x models. Set `frustumCulled = false` on skinned meshes.
- Validate: reject files that are not valid glTF/VRM, have no humanoid, or exceed the hard cap (see Step 5) with specific user-facing error messages.
- Support both VRM 1.0 (VRoid Studio default) and 0.x.
- `Avatar` wraps the VRM: `update(dt)` calls `vrm.update(dt)`, owns its `AnimationMixer`, and `dispose()` calls `VRMUtils.deepDispose`.
- Bundle a small `placeholder.vrm` and show it while the real avatar loads or if loading fails.

**Done when:** a hard-coded `.vrm` renders with correct orientation, MToon shading and outlines, and spring bones (hair and clothes) move.

### Step 4: Animation, expressions, look-at

- `Animator`: loads `.vrma` via `VRMAnimationLoaderPlugin`, creates clips with `createVRMAnimationClip(vrmAnimation, vrm)`, caches clips by name, `play(name, {fade})` crossfades. Start with `idle`; stub `walk` and `wave` for Phase 2.
- Source animation clips: use free VRMA files (for example the VRM Consortium sample animations, or create with a Vroid-compatible tool). Record the license in `assets/animations/LICENSES.md`.
- `Expressions`: automatic blink on a randomized 2-6 s timer, `setExpression(name, weight)` for `happy/sad/angry/surprised/relaxed`, and `setMouth(value01)` driving `aa`. The mouth setter is the future hook for voice lip-sync; keep it a plain method.
- `LookAt`: use `vrm.lookAt.target` set to an object that follows the pointer (turntable) or the camera.
- Expression and animation state names must be small enums or strings. Phase 4 will network these.

**Done when:** avatar idles, blinks, and expression buttons in the UI change the face; the head and eyes follow the pointer.

### Step 5: Import pipeline and optimizer

- My Avatar tab: "Import .vrm" button using file input (`accept=".vrm"`), plus drag-and-drop on desktop.
- `Optimizer`, run in a **Web Worker** so the UI stays responsive:
  - Parse the glTF, find textures, downscale any larger than 2048 px to a 2048 px max edge (1024 px in the "lite" profile) using `OffscreenCanvas` and re-encode as WebP or JPEG (keep PNG where alpha is required).
  - Never touch humanoid or spring-bone data.
  - Report progress for a progress bar.
- Size policy as constants: warn above 25 MB input; hard reject above 100 MB; target output under 15 MB. Show before/after size.
- Keep the original untouched in storage only if the user opts in; default is to store the optimized file.
- If optimizing fails, fall back to storing the original with a warning, provided it is under the hard cap.

**Done when:** a 30-50 MB VRoid export imports with a progress bar and ends smaller, renders identically at a glance, and the UI never freezes.

### Step 6: Persistence

- Dexie schema (version it from the start):
  - `avatars`: `id, name, hash (SHA-256), size, createdAt, blob, thumbnail, profile`
  - `settings`: key/value (`activeAvatarId`, quality overrides)
- Compute the hash with WebCrypto; dedupe identical imports.
- Generate a thumbnail by rendering the avatar once to a small offscreen canvas.
- Support multiple saved avatars: list, set active, rename, delete. The active avatar auto-loads on opening My Avatar.
- Request persistent storage with `navigator.storage.persist()` after the first import and display storage usage in Settings.
- Handle quota errors with a clear message.

**Done when:** reload and offline both restore the active avatar with no network.

### Step 7: My Avatar screen (blades styling)

- Layout: large turntable viewport, with an item list on the side in blades style: Import, Saved Avatars, Pose (idle only for now), Expression, Quality profile (Full/Lite).
- Turntable: drag to rotate (pointer events, touch-friendly), pinch/scroll to zoom with limits, slow auto-rotate that stops during interaction. Camera framing computed from the model's bounding box, so any avatar size fits.
- Gamepad: right stick rotates, triggers zoom, A/B per the shared mapping.
- Loading, empty state ("No avatar yet, import one from VRoid Studio"), and error states all styled consistently.
- Short help text: how to export from VRoid Studio (Export > VRM, VRM 1.0).

**Done when:** a first-time user can go from empty state to a rendered, saved avatar without help.

### Step 8: PWA and caching

- Add the lazy chunks (engine, three-vrm) to runtime caching with cache-first and versioned names. Do not precache them.
- Cache bundled animation files and the placeholder VRM the same way.
- Do not store user avatars in the Cache API. IndexedDB only.
- Verify the offline path end to end.

**Done when:** Lighthouse PWA passes, the app works offline after one visit, and avatars do not appear in the service worker cache.

### Step 9: Hardening and performance

- Mobile pass: confirm acceptable frame rate on a mid-range phone; adjust pixel ratio and spring bones (disable above a distance later, or on low tier now).
- Memory: repeated import, switch, delete cycles show no leak (`renderer.info.memory` stable).
- Pause rendering when the tab is hidden or the app is not on the My Avatar screen.
- Unit tests for: optimizer size logic, hash dedupe, Dexie store, expression state clamping. Manual test checklist in the PR for rendering.
- Error boundaries around mount so an engine failure never takes down the blades shell.

## Extension points to leave in place (do not implement)

| Later phase | Hook left now |
| --- | --- |
| World scene and editor | `Engine.scene`, `Engine.addUpdatable`, `Loop` fps cap |
| Walking | `Animator.play('walk')` stub, `Avatar.root` transform separate from the VRM internals |
| Multiplayer | `Avatar` constructible from a `Blob` and hash; animation and expression names as plain strings |
| Voice lip-sync | `Expressions.setMouth(0..1)` |
| Guide overlay | `Loop.pause/resume`, fps cap, `Engine.dispose()` |
| Many avatars on mobile | `Quality` tier and per-avatar `setSpringBonesEnabled(bool)` method (stub) |

## Acceptance checklist

- [ ] Avatar World appears under Social > Social Apps and navigates correctly
- [ ] Main bundle size unchanged; 3D code is in separate chunks
- [ ] VRM 1.0 and 0.x both load with correct orientation
- [ ] MToon, outlines, spring bones, blink, expressions, look-at, idle animation all work
- [ ] Import runs in a worker with progress and size reporting
- [ ] Avatars persist across reload and offline
- [ ] Mount/unmount repeatedly causes no memory growth
- [ ] Works with touch, mouse, and gamepad
- [ ] No framework code inside `engine/` or `avatar/`

## Questions the agent should ask before starting if the repo does not answer them

1. Which framework and router does the PWA use?
2. Is there an existing gamepad/input layer?
3. Are there existing license or asset conventions for bundled files?
