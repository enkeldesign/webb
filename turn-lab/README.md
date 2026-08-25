# TURN LAB — isolated gameplay experiments

`/turn-lab/` runs the current production TURN module graph through `<base href="/turn/">`, while keeping a separate PWA identity and separate `turn-lab:` storage namespace. Production `/turn/` files and save data are not modified by LAB testing.

## Active experiments

### Portrait play R3

Portrait is now a real race layout rather than a rotate-device blocker:

- the rendered game occupies the upper portrait stage;
- the existing four-zone Drive Pad keeps its production behavior in a large, centred rectangle in the lower control deck;
- the pad occupies nearly all available portrait width up to a 480 px maximum, while every zone remains larger than a 44 px touch target on supported phone sizes;
- the HUD is condensed into a five-chip row with the map, boost and a LAB-only live steering meter above it;
- the camera uses `zoom = 0.78` to recover useful horizontal road context without changing race physics;
- production's forced landscape lock is suppressed only while LAB is already in portrait.

The first steering hypothesis deliberately preserves the proven production transfer function. Phone steering still engages at 2.2°, releases at 0.9°, and reaches full lock at ±24°. The existing damped iPad profile still engages at 3.2° and releases at 1.4°. Only visible camera roll is reduced to ±16° in portrait; landscape LAB remains at ±24°.

The R3 pad reuses the same four production buttons, 50% / 50% Drift/Boost split and 32% / 44% / 24% vertical zone contract. Sliding between zones, boost charge, drift recharge, braking, reverse, pointer capture and VoiceOver labels remain owned by the production control module. Landscape still uses the untouched production Drive Pad and hit geometry.

Steering remains directly comparable between orientations: any difference in steering feel comes from the portrait grip and viewport, not a hidden sensitivity change. Landscape remains the recommended orientation when it is practical for the player; portrait is a fully supported universal-design alternative.

#### Future control customisation

Add a player setting that places the Drive Pad on the left, centre or right in portrait and on either side in landscape. The setting must preserve the same control semantics, hit geometry and screen-reader labels in every placement.

### Connected roadtrip R1

The six-track connected-world experiment remains active in both orientations. Each track retains its two experimental exits and isolated LAB state.

## Try it

1. Open `https://enkel.design/turn-lab/` in Safari.
2. Add **TURN LAB** to the Home Screen, or choose **Play in browser anyway**.
3. Keep the device in portrait, choose a car and track, and start a motion-steering race.
4. Recalibrate in your natural two-handed portrait grip.
5. Use the centred Drive Pad and slide through Brake/Reverse → Gas → Drift or Boost.
6. Use the live steering meter to compare physical angle with delivered steering. Full lock is ±24°.
7. Rotate back to landscape before starting another race if you want a direct control comparison.

## Safety

- No production TURN file is changed for these experiments.
- LAB uses `turn-lab:` / `turn-lab-session:` storage prefixes and does not seed data from production.
- Portrait layout, centred Drive Pad and orientation-lock behavior are scoped to `data-turn-deployment="lab"`.
- The production physics, vehicle handling, drift, boost, Drive By Ear and accessibility systems remain the runtime source of truth.
