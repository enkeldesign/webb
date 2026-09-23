# TURN LAB — DEAD CANYON experiment

`/turn-lab/` runs the current production TURN runtime while keeping a separate PWA identity and isolated `turn-lab:` / `turn-lab-session:` storage. Production `/turn/` files and production save data are not modified by LAB testing.

## Active experiment

TURN LAB repurposes only the production MOUNTAIN slot as **DEAD CANYON**. The internal id stays `mountain`, allowing the production race, rival, garage, minimap, scoring and accessibility contracts to remain the runtime source of truth.

DEAD CANYON r4 is about 3.23 km with 73 authored control points and 2,160 runtime samples. The AIRPORT-derived hairpin has been removed; the early chicane remains the deliberate technical interruption in an otherwise fast canyon lap. Because the route changed, records/rivals now use `dead-canyon-lab-r4`.

## r4 art direction

The canyon itself is the signature landmark.

- The east wall remains four broad faceted terraces in warm golden-hour haze.
- A large **DEAD CANYON CROWN** section is embedded into the wall: a deep recessed face with three stacked polygonal shelves, visible from the eastern approach.
- Four additional overhanging poly-rocks are inserted into the canyon side as secondary details.
- Raised terrain now has vertical skirts down to the desert floor, closing the visible holes that could appear underneath high ridges.
- The yellow/black chevrons are retained as graphic track detail but are positioned beyond the road edge.
- Retro Urban service dressing around the former hairpin area has been moved farther away from the racing line.
- Only one freestanding tall sentinel rock remains. The other former upright buttes are now low, fallen formations.
- The existing camera-safe haze remains 260–760 m against TURN's 900 m race-camera far plane.

## Intro composition

Production MOUNTAIN's intro camera intentionally looks upward to frame its moon. DEAD CANYON now overrides that camera only inside LAB. Its establishing shot sits high to the south-west and looks diagonally along the southern/eastern road toward the canyon wall, showing substantially more track and using the canyon scenery as the background.

## Retro Urban Kit

DEAD CANYON uses a small CC0 subset of Kenney's Retro Urban Kit 2.0. Only geometry is retained from the selected models and TURN supplies lightweight materials. No dynamic scenery lights or shadow casters are added.

See `turn-lab/assets/kenney/retro-urban/LICENSE.txt`.

## Try it

Open `https://enkel.design/turn-lab/`, choose **DEAD CANYON**, and check especially:

1. the formerly problematic northern hairpin area, which should now be a clean flowing sweep;
2. yellow/black roadside details staying clear of the driveable road;
3. the closed terrain/ridge edges with no daylight underneath;
4. the embedded overhangs and the DEAD CANYON CROWN landmark;
5. the new loading/intro angle and how much track/scenery it reveals;
6. whether one standing sentinel rock feels special rather than repetitive.

## Safety

- No production `turn/` files are changed.
- The first LAB import map remains identical to current production TURN.
- LAB overrides only the internal MOUNTAIN track modules plus its intro camera.
- Production physics, handling, Drive By Ear, vehicles, UI and scoring remain unchanged.
