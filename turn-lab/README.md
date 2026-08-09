# TURN LAB — viewport flight recorder

`/turn-lab/` is a temporary real-device diagnostic shell for issue #394.

It intentionally runs the **current production TURN 1.7.0 / 2026.08.09-r163 module graph** through `<base href="/turn/">`, while keeping a separate PWA identity and a separate storage namespace. Production `/turn/` files and save data are not modified by LAB testing.

## Why this exists

The intermittent bottom strip only reproduces reliably in the installed iOS Home Screen app. Desktop/browser DevTools are therefore not a sufficient observation point. The LAB flight recorder starts before the production PWA viewport boundary and persists several launches so a random good launch can be compared with a random bad launch later.

## Real-device procedure

1. Open `https://enkel.design/turn-lab/` in Safari.
2. Add **TURN LAB** to the Home Screen.
3. Cold-launch it in the orientations that have produced the strip.
4. Open the fixed **LAB** control.
5. While the symptom is visible, choose **MARK BAD**. For a normal launch choose **MARK GOOD**.
6. Optionally choose **COLOR LAYERS** while the strip is visible. This changes diagnostic backgrounds only after launch: HTML = red/pink, BODY = green, `#game` = blue, with outlined full-screen TURN surfaces.
7. After at least one good and one bad session, choose **COPY LOG** and paste the JSON into the debugging thread.

The recorder captures screen, window, document, Visual Viewport, orientation, body/game/Home/rotate/loading rectangles, TURN's own `__turnPwaViewportDiagnostics`, CSS app dimensions, and event timing around startup/rotation/visibility changes.

## Safety

- No production TURN code is changed to make the diagnostic build work.
- LAB uses `turn-lab:` / `turn-lab-session:` storage prefixes and does not seed data from production.
- The diagnostic UI is fixed/overlayed and does not consume layout space.
- The production PWA viewport boundary remains unchanged, so the lab should preserve the failure mode instead of "fixing" it before measurement.
- Old historical `turn-lab` implementation files may still exist in the repository, but the current LAB entry point does not load them; current gameplay assets resolve from `/turn/`.
