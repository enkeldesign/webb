# TURN NEXT

`/turn-next/` is TURN’s protected architecture test runtime.

## Current milestone: product parity before Platform M5

TURN NEXT now runs the same canonical motion safe zone and steering-limit warning as production TURN.

Completed foundations:

- isolated TURN NEXT URL, PWA identity and storage namespace
- generated entry and bootstrap synchronized with production
- explicit platform contract and browser adapter
- platform-provided orientation-angle lookup in TURN NEXT
- physically validated `-24°` to `+24°` steering and horizon envelope
- physically validated inertial directional steering-limit warning
- audible limit cue on every rearmed hard crossing
- first-per-side VoiceOver announcement during each race

## Canonical motion safe zone

The accepted Safe Zone M3 and Limit M4.2 behavior is no longer a TURN NEXT override.

Production and TURN NEXT both load:

- `turn/motion-safe-zone.js`
- `turn/ui/steering-limit-warning.js`
- `turn/steering-limit-warning.css`

The shared behavior is:

- steering and horizon levelling remain active from `-24°` to `+24°`
- visual warning begins at `19°`
- hard-edge audio and haptic feedback begins at `24°`
- the hard-edge cue rearms below `22°`
- visual warning fully clears below `17.5°`
- the red gradient appears only on the side being pushed
- the gradient has a `300ms` threshold hold, `360ms` attack and `780ms` release
- the maximum gradient width is `75px`
- there are no keyframes, blink classes or flashing hard-edge states

The former yellow whole-screen warning and the staging-only safe-zone/warning assets have been removed.

## Next architecture milestone: Platform M5

The next extraction routes the complete motion lifecycle through the existing platform contract:

- motion availability
- iOS permission request
- `devicemotion` subscription
- deterministic listener cleanup

Fullscreen must still be requested synchronously from the user gesture before TURN awaits motion permission.

TURN NEXT will use the platform route first. Production keeps its current direct-browser motion startup until automated and physical parity pass.

## Generation

The staging bootstrap and entry page are generated from `turn/app.js` and `turn/index.html`:

```text
node turn-next/scripts/build-parity-app.mjs
node turn-next/scripts/build-parity-entry.mjs
```

CI verifies both files remain synchronized:

```text
node turn-next/scripts/build-parity-app.mjs --check
node turn-next/scripts/build-parity-entry.mjs --check
```

Do not edit `turn-next/app.js` or `turn-next/index.html` by hand. Edit the generators or production sources and regenerate them.

## Safety boundaries

- TURN NEXT prefixes all `localStorage` and `sessionStorage` keys before production modules load.
- It never copies production records automatically.
- Its manifest uses the separate `/turn-next/` application id, start URL and scope.
- The page is marked `noindex` and visibly labelled throughout gameplay.
- The platform is installed once at startup and cannot be silently replaced later.
- TURN NEXT contains no whole-viewport orientation transform, frozen drawing buffer or counter-rotation wrapper.

## Target architecture

The target remains one canonical source tree that can build:

```text
Web / PWA
TURN NEXT staging
Capacitor iOS
Capacitor Android
```
