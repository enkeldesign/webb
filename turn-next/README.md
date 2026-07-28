# TURN NEXT

`/turn-next/` is TURN’s protected architecture test runtime.

## Current milestone: platform composition and visual orientation freeze

The physical parity baseline for TURN r110 has been confirmed on real devices. TURN NEXT now begins the architecture migration while continuing to load the proven production gameplay graph from `/turn/`.

Its first explicit seam is the platform layer:

- `turn/platform/platform-context.js` owns the runtime platform contract.
- `turn/platform/web-platform.js` implements motion, fullscreen and orientation services for browsers.
- TURN NEXT installs that web platform before `main.js` loads.
- `turn/input/motion.js` consumes the installed orientation port when present and retains the existing browser fallback for production TURN.

Platform M1 confirmed that the new route matches production, but physical testing also confirmed that iOS can still rotate the web view when it does not expose or accept the Screen Orientation lock request.

Orientation M2 therefore adds a TURN NEXT-only visual compensation prototype:

- `orientation-preflight.js` captures the browser’s native orientation getter before TURN installs its motion-axis compatibility shim.
- `orientation-freeze.js` captures the logical race viewport, counter-rotates the whole visual application after browser orientation changes and keeps the Three.js camera and drawing buffer at the locked logical size.
- `orientation-freeze.css` provides the transformable application viewport.
- The generated TURN NEXT entry wraps every visual surface in `#turnAppViewport`.

This is deliberately an experiment. It cannot stop the operating system’s own rotation animation or browser chrome from rotating. It tests whether TURN can visually compensate well enough in the PWA while preserving controls, aspect ratio and motion steering. A true host-level lock remains mandatory for native iOS and Android containers.

The staging bootstrap and entry page are generated from `turn/app.js` and `turn/index.html` by:

```text
node turn-next/scripts/build-parity-app.mjs
node turn-next/scripts/build-parity-entry.mjs
```

CI verifies that both generated files remain synchronized:

```text
node turn-next/scripts/build-parity-app.mjs --check
node turn-next/scripts/build-parity-entry.mjs --check
```

Do not edit `turn-next/app.js` or `turn-next/index.html` by hand. Edit the generators or production sources and regenerate them.

## Safety boundaries

- Production `/turn/` keeps its proven direct browser fallback and has no visual-freeze code.
- TURN NEXT prefixes all `localStorage` and `sessionStorage` keys before production modules load.
- It never copies production records automatically.
- Its manifest uses the separate `/turn-next/` application id, start URL and scope.
- The page is marked `noindex` and visibly labelled throughout gameplay.
- The platform is installed once at startup and cannot be silently replaced later.
- Orientation M2 activates only while gameplay is running and restores ordinary responsive behaviour outside the race.

## Transitional architecture

Reusing `/turn/` modules remains temporary and intentional. TURN NEXT will replace dependencies one subsystem at a time behind explicit interfaces, with production parity checked after every slice.

The target remains one canonical source tree that can build:

```text
Web / PWA
TURN NEXT staging
Capacitor iOS
Capacitor Android
```
