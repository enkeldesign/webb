# POSTAL portrait game campaign

POSTAL is a mobile-portrait parcel-network management game set in Sweden. The current playable build contains a guided first shift followed by four distinct operations rather than one unexplained scenario.

## Shift campaign

1. **First rounds — guided terminal shift.** Read the blue Express lane, move spare crew, inspect the scanner, watch six promises and send the morning van. Instruction steps do not run a deadline.
2. **Northbound promises — systems shift.** Protect a departure, investigate a misrouted parcel, correlate matching failures, repair the routing rule and verify the later flow.
3. **Snow over E4 — network shift.** Inspect three depots, allocate one spare truck, choose between the restricted coast road and the inland route, then run the weather window.
4. **Scanner fever — triage shift.** Diagnose a jam, order three parcel groups by their promises, choose repair or manual bypass and clear the live queue. Parcel groups change on replays.
5. **Priority parcel — investigation shift.** Read a temperature-controlled parcel's event trail, infer its location, choose a recovery connection and follow it to delivery. Evidence changes on replays.

Completing the first shift opens the full shift board. Completion, best results and replay variants are stored locally in the browser.

## Presentation and feedback

- Fixed isometric 3D terminal, regional and parcel scenes use small CC0 Kenney assets vendored under `assets/`; see [`assets/ATTRIBUTION.md`](./assets/ATTRIBUTION.md).
- The required three.js modules are vendored locally, so the game does not depend on a third-party CDN at runtime.
- Snow, scanner congestion, live routing, crew movement, parcel flow and recovery progress are shown in the miniature worlds.
- Interface feedback uses a quiet family of short, low-volume triangle tones synthesized by the Web Audio API. The previous sharp sample cues are no longer played.
- Consequential detail remains available on demand through a scenario-specific structured Shift details dialog.

## Accessibility

- Every consequential canvas state is repeated in semantic HTML.
- Projected world hotspots are real buttons with accessible names, and each required object action has a large HTML alternative.
- Colour is paired with labels, shapes, values and patterns.
- The first shift introduces one action at a time and does not start time while explaining it.
- Opening detailed information pauses live simulation and restores the previous running state on close.
- Reduced-motion preferences remove camera sweeps, pulsing and non-essential animation.
- A no-WebGL fallback keeps every shift playable through the command deck and structured details.

## Local run and checks

Serve the repository root over HTTP and open `/postal/`.

```sh
python -m http.server 4173
node --test postal/tests/sim.test.mjs
node --check postal/main.mjs
node --check postal/world.mjs
```
