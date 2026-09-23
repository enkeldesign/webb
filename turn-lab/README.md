# TURN LAB — DEAD CANYON experiment

`/turn-lab/` runs the current production TURN runtime while keeping a separate PWA identity and isolated `turn-lab:` / `turn-lab-session:` storage. Production `/turn/` files and production save data are not modified by LAB testing.

## Active experiment

TURN LAB repurposes only the production MOUNTAIN slot as **DEAD CANYON**. The internal id stays `mountain`, allowing the production race, rival, garage, minimap, scoring and accessibility contracts to remain the runtime source of truth.

DEAD CANYON r4 is about 3.23 km with 73 authored control points and 2,160 runtime samples. The AIRPORT-derived hairpin has been removed; the early chicane remains the deliberate technical interruption in an otherwise fast canyon lap. Because the route changed, records/rivals now use `dead-canyon-lab-r4`.

## Post-#970 polish baseline

The canyon itself is the signature landmark.

- The east wall remains four broad faceted terraces in warm golden-hour haze.
- The #972/#973 dark-tunnel experiment has been **fully rolled back**. This pass starts from the merged #970 state and keeps the original open canyon route.
- The four embedded overhang rocks and the three DEAD CANYON CROWN shelves are pushed farther into the east wall so no large rock reads as detached/floating.
- Large fallen formations are sunk deeper into the terrain.
- The yellow Kenney damaged-barrier/"step" asset is no longer loaded or placed anywhere on DEAD CANYON. The pale procedural canyon-edge barriers remain.
- The open shed roof is seated against the top of its pole frame from actual object bounds instead of a guessed Y offset.
- DEAD CANYON DBE pace-note directions were re-audited against the route using production MOUNTAIN's verified coordinate-handness convention. LEFT stays in the left ear and RIGHT in the right ear.
- The intro/loading camera is farther back and wider so substantially more track is visible while the east canyon wall stays in the background.
- **DEAD CANYON CROWN** is now pure geology: three very broad, tall, shallow polygonal strata shelves embedded directly into the wall. The artificial dark backing block is removed.
- Four additional embedded wall rocks use the same rule: wider and taller, but much shallower so they cannot read as floating boulders.
- Raised terrain now has vertical skirts down to the desert floor, closing the visible holes that could appear underneath high ridges.
- The yellow/black chevrons are retained as graphic track detail but are positioned beyond the road edge.
- Retro Urban service dressing around the former hairpin area has been moved farther away from the racing line.
- Only one freestanding tall sentinel rock remains. The other former upright buttes are now low, fallen formations, and only one table/mushroom mesa remains.
- The existing camera-safe haze remains 260–760 m against TURN's 900 m race-camera far plane.

## Intro composition

Production MOUNTAIN's intro camera intentionally looks upward to frame its moon. DEAD CANYON overrides that camera only inside LAB. r5 moves the camera farther back, widens the FOV and aims higher so the loading frame shows more of the route *and* substantially more canyon wall.

## Retro Urban Kit

DEAD CANYON uses a CC0 subset of Kenney's Retro Urban Kit 2.0. r5 adds the actual park-tree geometry **with its original autumn `treeA.png` foliage texture** plus the kit's open metal roof/poles as a wall-less shed. Existing kit geometry supplies a rust-rematerialed abandoned truck, broken-wall ruins and roadside barriers. TURN supplies lightweight materials to the non-foliage surfaces; no dynamic scenery lights or shadow casters are added.

See `turn-lab/assets/kenney/retro-urban/LICENSE.txt`.

## Try it

Open `https://enkel.design/turn-lab/`, choose **DEAD CANYON**, and check especially:

1. the formerly problematic northern hairpin area, which should now be a clean flowing sweep;
2. yellow/black roadside details staying clear of the driveable road;
3. the closed terrain/ridge edges with no daylight underneath;
4. the embedded overhangs and the DEAD CANYON CROWN landmark;
5. the wider loading/intro angle: more of the route should fit in frame, with the canyon wall reading as distant/background scenery;
6. whether one standing sentinel rock and one table mesa feel special rather than repetitive;
7. the yellow-tree/open-shed/rust-truck cluster and the separate ruin/barrier cluster.

## Safety

- No production `turn/` files are changed.
- The first LAB import map remains identical to current production TURN.
- LAB overrides only the internal MOUNTAIN track modules plus its intro camera.
- Production physics, handling, Drive By Ear, vehicles, UI and scoring remain unchanged.
