# TURN LAB — long MOUNTAIN experiment

`/turn-lab/` runs the current production TURN module graph through `<base href="/turn/">`, while keeping a separate PWA identity and separate `turn-lab:` / `turn-lab-session:` storage namespaces. Production `/turn/` files and save data are not modified by LAB testing.

## Active experiment

TURN LAB currently replaces only MOUNTAIN's route definition, collision profile, pace-note map, checkpoint density and world installer. Everything else comes from the current production TURN import map and entry scripts.

The long course retains the established village, forest climb, summit river, slalom descent and waterfall, then continues across a Kenney-asset bridge into a lower valley. The added half contains two carved rock tunnels, an east-valley descent, long lower run, brown-and-snow village, forest return and final climb back to the original start area. The first bridge rails and hard colliders begin farther onto the deck, creating a forgiving but still envelope-contained entry funnel.

The production MOUNTAIN world still builds from 1,080 evenly spaced world samples, so road/scenery setup stays within the established cost. The LAB runtime uses 2,160 samples for collision, progress, checkpoints, ghosts and minimaps, preserving approximately the production route's spatial resolution across the longer lap.

Bridge deck, rails and supports reuse the repository's Kenney City Kit Roads, Fantasy Town and Nature Kit assets. The tunnel portals reuse the same Nature Kit rock source; their continuous interior lining is one modest mesh and their warm guidance reflectors are instanced without real lights. Added houses, forest, rock screens, light pools and road furniture use shared geometry or instancing. The lower village and tunnels add no dynamic lights, and no LAB scenery casts shadows.

## Retired experiments

Portrait play, Connected Roadtrip and BUILD-A-CAR are not loaded by this branch. Their source remains available for later experiments, but TURN LAB currently uses production landscape behavior and the production game flow so MOUNTAIN can be evaluated without unrelated overlays.

## Try it

1. Open `https://enkel.design/turn-lab/` in Safari.
2. Add **TURN LAB** to the Home Screen, or choose **Play in browser anyway**.
3. Choose **MOUNTAIN**, continue through The Lot and start the race.
4. Check the summit, descent, bridge, east-valley tunnel, lower-village tunnel, forest return and final climb as separate sections.
5. Try to leave the bridge and cut between folded road sections; containment and ordered checkpoints should prevent both.

## Safety

- No production TURN file is changed for this experiment.
- The first import map and all production entry scripts stay synchronized with `turn/index.html`.
- LAB route overrides live in a second `/turn/` scope and affect only requests made by the production TURN module graph inside `/turn-lab/`.
- LAB storage is isolated, never reads production saves and seeds only the MOUNTAIN reward so the active experiment is immediately testable.
- Production physics, handling, drift, boost, Drive By Ear, accessibility and vehicle systems remain the runtime source of truth.
