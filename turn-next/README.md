# TURN NEXT

`/turn-next/` is TURN’s protected architecture test runtime.

## Current milestone: platform composition

The physical parity baseline for TURN r110 has been confirmed on real devices. TURN NEXT now begins the architecture migration while continuing to load the proven production gameplay graph from `/turn/`.

Its first explicit seam is the platform layer:

- `turn/platform/platform-context.js` owns the runtime platform contract.
- `turn/platform/web-platform.js` implements motion, fullscreen and orientation services for browsers.
- TURN NEXT installs that web platform before `main.js` loads.
- `turn/input/motion.js` consumes the installed orientation port when present and retains the existing browser fallback for production TURN.

Only screen-orientation input is routed through the platform in this milestone. Motion permission, event subscription, fullscreen and landscape lock are already represented and tested as platform services, but will be promoted one behaviour at a time after parity testing.

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

- Production `/turn/` keeps its proven direct browser fallback.
- TURN NEXT prefixes all `localStorage` and `sessionStorage` keys before production modules load.
- It never copies production records automatically.
- Its manifest uses the separate `/turn-next/` application id, start URL and scope.
- The page is marked `noindex` and visibly labelled throughout gameplay.
- The platform is installed once at startup and cannot be silently replaced later.

## Transitional architecture

Reusing `/turn/` modules remains temporary and intentional. TURN NEXT will replace dependencies one subsystem at a time behind explicit interfaces, with production parity checked after every slice.

The target remains one canonical source tree that can build:

```text
Web / PWA
TURN NEXT staging
Capacitor iOS
Capacitor Android
```
