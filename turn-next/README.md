# TURN NEXT

`/turn-next/` is TURN’s protected architecture test runtime.

## Current milestone: platform composition, motion safe zone and directional limit feedback

The physical parity baseline for TURN r110 has been confirmed on real devices. TURN NEXT now begins the architecture migration while continuing to load the proven production gameplay graph from `/turn/`.

Its first explicit seam is the platform layer:

- `turn/platform/platform-context.js` owns the runtime platform contract.
- `turn/platform/web-platform.js` implements motion, fullscreen and orientation services for browsers.
- TURN NEXT installs that web platform before `main.js` loads.
- `turn/input/motion.js` consumes the installed orientation port when present and retains the existing browser fallback for production TURN.

Platform M1 confirmed that the new route matches production, but physical testing also confirmed that iOS can still rotate the web view when it does not expose or accept the Screen Orientation lock request.

Orientation M2 attempted to counter-rotate the whole application after browser orientation changes. Physical testing showed that this was based on the wrong UX model and introduced an upside-down landscape regression. The visual-freeze experiment has therefore been removed completely.

Safe Zone M3 instead defines a deliberately limited web operating envelope:

- `safe-zone-bootstrap.js` configures TURN NEXT at `-24°` to `+24°` relative to the calibrated position.
- Steering remains active throughout that range and reaches full lock at `24°`.
- Horizon levelling follows the device throughout the same range and clamps at `24°`.
- Beyond the safe zone, TURN adds no further horizon rotation or steering magnitude.
- The browser remains responsible for any operating-system orientation flip beyond the usable range.

Limit M4 replaces the former whole-screen yellow border with directional feedback:

- A red-to-transparent gradient appears only on the side being pushed.
- The gradient begins fading in at `19°` and strengthens continuously toward the `24°` edge.
- A fresh hard-edge crossing blinks briefly and then remains solid while the device stays at or beyond `24°`.
- The hard-edge cue rearms below `22°`, preventing threshold jitter while ensuring a new audible cue on each genuine return to the limit.
- Every fresh hard-edge crossing plays a short two-part cue through TURN’s existing audio system.
- VoiceOver announces `Left steering limit reached.` and `Right steering limit reached.` only the first time each side is reached during a race session.
- `prefers-reduced-motion` removes the blink while retaining the solid hard-edge warning.

The shared production modules now accept an optional safe-zone configuration, but production `/turn/` retains its existing steering, horizon and feedback limits when no configuration is installed. This lets TURN NEXT test the larger range and directional warning without silently changing the live game.

A true host-level orientation lock remains mandatory for native iOS and Android containers. The safe zone can be revisited once the native host controls interface orientation.

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

- Production `/turn/` keeps its current motion limits and warning presentation unless a platform host explicitly installs a safe-zone configuration.
- TURN NEXT prefixes all `localStorage` and `sessionStorage` keys before production modules load.
- It never copies production records automatically.
- Its manifest uses the separate `/turn-next/` application id, start URL and scope.
- The page is marked `noindex` and visibly labelled throughout gameplay.
- The platform is installed once at startup and cannot be silently replaced later.
- TURN NEXT contains no whole-viewport orientation transform, frozen drawing buffer or counter-rotation wrapper.

## Transitional architecture

Reusing `/turn/` modules remains temporary and intentional. TURN NEXT will replace dependencies one subsystem at a time behind explicit interfaces, with production parity checked after every slice.

The target remains one canonical source tree that can build:

```text
Web / PWA
TURN NEXT staging
Capacitor iOS
Capacitor Android
```
