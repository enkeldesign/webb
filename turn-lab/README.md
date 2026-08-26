# TURN LAB — isolated gameplay experiments

`/turn-lab/` runs the current production TURN module graph through `<base href="/turn/">`, while keeping a separate PWA identity and separate `turn-lab:` storage namespace. Production `/turn/` files and save data are not modified by LAB testing.

## Active experiments

### BUILD-A-CAR prototype 1

The Lot now exposes a LAB-only **BUILD-A-CAR** action. It opens an accessible modal with a persistent live 3D preview and one isolated custom-car slot.

The first vertical prototype deliberately tests the smallest useful modular system:

- two compatible lower bodies and two cabins, virtually separated from Kenney Car Kit models at render time;
- three standalone wheel sets and two standalone spoilers from Kenney Car Kit 3.1;
- optional taxi and emergency-light roof accessories plus two headlight treatments;
- primary, secondary and accent paint channels;
- six attributes constrained to exactly 18 points, with values from 1 to 5;
- one explicit sidegrade perk from Long Burn, Holeshot and Drift Dynamo;
- a named build saved under the existing LAB-prefixed storage boundary.

This stage proves composition, fit, builder interaction and persistence. It does not yet replace the selected production vehicle in a race, alter physics, write rivals or extend YOUR TURN. The saved definition already separates visual parts, colours, stats, perk and deterministic build identity so those integrations can follow without changing the schema's basic shape.

The part system is removable by deleting its single dynamic entry installer from `turn-lab/index.html`. The canonical TURN catalogue, Lot, renderer and physics remain unchanged.

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
3. Choose a track and continue to **The Lot**.
4. Open **BUILD-A-CAR**, combine parts, spend exactly 18 attribute points and save your LAB build.
5. Reopen **EDIT MY CAR** to confirm that the isolated slot persists.
6. For portrait play, start a normal race, recalibrate in your natural grip and use the centred Drive Pad.

## Safety

- No production TURN file is changed for these experiments.
- LAB uses `turn-lab:` / `turn-lab-session:` storage prefixes and does not seed data from production.
- BUILD-A-CAR stores only its versioned definition; it does not modify the production vehicle selection.
- Portrait layout, centred Drive Pad and orientation-lock behavior are scoped to `data-turn-deployment="lab"`.
- The production physics, vehicle handling, drift, boost, Drive By Ear and accessibility systems remain the runtime source of truth.
