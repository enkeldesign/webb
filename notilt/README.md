# NO TILT

Portrait-first motion balancing game at `https://enkel.design/notilt/`.

## First playable scope

- **EASY — THE BROOM:** a forgiving two-axis inverted balance on a broad concave dish.
- **MEDIUM — MARKER ON MARKER:** a smaller pivot, faster instability and stronger drift.
- **HARD — THE SIGNAL:** the same balance problem with side projectiles. A quick upward phone movement jumps; the visible JUMP control and Space key are equivalent fallbacks.
- Five flow/combo stages progressively raise score multiplication, procedural music density, lighting, color and attack pressure.
- Motion permission is requested from the explicit start action. Calibration uses the current portrait grip and reruns automatically after returning from landscape.
- TOUCH MODE and arrow/WASD controls run through the same physics as motion input.

## Sensor mapping

Gravity is transformed into screen space before roll and pitch are calculated. The calibrated pose becomes neutral. Roughly 17° side tilt or 13° fore/aft tilt reaches full control. HARD detects a short vertical acceleration impulse from `DeviceMotionEvent.acceleration`, with a high-pass gravity fallback for devices that do not expose linear acceleration.

The control is intentionally counter-steering: move the yellow input dot opposite the pink falling-object dot.

## YOUR TURN groundwork

Only the actual game ships in this first version. The best run for each difficulty is stored under `notilt.best-runs.v1` with:

- mode, seed, survival time, score and maximum combo;
- a 15 Hz compact frame stream containing `[milliseconds, inputX, inputY, angleX, angleY, jumpHeight]`;
- a schema version and recording timestamp.

That is enough to add deterministic ghost playback and self-contained challenge-link encoding without changing the game physics.

## Verification

```sh
node --test notilt/*.test.mjs
node --check notilt/app.mjs
node --check notilt/audio.mjs
node --check notilt/game-core.mjs
node --check notilt/game-view.mjs
node --check notilt/input.mjs
```
