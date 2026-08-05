# POSTAL visual game slice

POSTAL is a mobile-portrait parcel-network management game set in Sweden. This directory contains a polished, playable shift rather than the earlier interaction prototype.

## Playable shift

The 18:20 northbound Express flow is at risk in Sundsvall. The player can:

1. read the animated parcel flow and protect the departure;
2. rebalance crew or accept the downstream cost of holding the truck;
3. trace an Express parcel that entered the Standard lane;
4. light up matching parcels and identify the shared routing signature;
5. correct the rule order;
6. verify twelve later parcels in live flow;
7. dispatch the truck and receive a graded shift report.

The shift is pausable, supports 1× and 2× time, and takes roughly five minutes on a first playthrough.

## Presentation

- A fixed isometric 3D terminal, regional diorama and parcel-inspection scene replace the former CSS-drawn map and explanatory card stack.
- The world uses small CC0 Kenney assets vendored under `assets/`; see [`assets/ATTRIBUTION.md`](./assets/ATTRIBUTION.md).
- The required three.js modules are vendored locally, so the game world does not depend on a third-party CDN at runtime.
- Consequential detail stays available on demand through the structured Shift details dialog.
- The interface is portrait-first and remains usable on narrow and short phone viewports.

## Accessibility

- Every consequential canvas state is repeated in semantic HTML.
- Projected world hotspots are real buttons with accessible names.
- Colour is paired with labels, shapes and patterns.
- Opening detailed information pauses the simulation and restores the previous running state on close.
- The game responds to reduced-motion preferences and pauses when the page becomes hidden.
- Full play does not depend on precise canvas picking; every required action is also exposed as a large HTML control.

## Local run and checks

Serve the repository root over HTTP and open `/postal/`.

```sh
python -m http.server 4173
node --test postal/tests/sim.test.mjs
```
