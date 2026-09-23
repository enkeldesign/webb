# TURN LAB — DEAD CANYON experiment

`/turn-lab/` runs the current production TURN runtime while keeping a separate PWA identity and isolated `turn-lab:` / `turn-lab-session:` storage. Production `/turn/` files and production save data are not modified by LAB testing.

## Active experiment

TURN LAB repurposes only the production MOUNTAIN slot as **DEAD CANYON**. The internal id stays `mountain`, allowing the production race, rival, garage, minimap, scoring and accessibility contracts to remain the runtime source of truth.

The route remains the r2 course: roughly 3.35 km, 79 authored control points and 2,160 runtime samples, with one AIRPORT-derived northern hairpin and an early three-move chicane. Because the route geometry did not change in r3, the existing `dead-canyon-lab-r2` record namespace is intentionally retained.

## r3 visual direction

The goal is a stylised golden-hour canyon road rather than four perfect slabs.

- The eastern wall is still four large terraces, but each front is now made from 16 broad flat-shaded facets.
- The nearest cliff face has been moved east so the chase camera cannot enter it on the outer part of the route.
- Five integrated skyline mesas sit behind the terraces; there are still no freestanding needles.
- Twelve simple distant mesas provide silhouettes through the atmospheric haze.
- The eastern cliff run gets concrete canyon-edge barriers.
- The hairpin is now a visual landmark with a low-poly rock island, chevrons and an abandoned Retro Urban service/watchtower scene.
- Retro Urban remains geometry-only CC0 Kenney content with TURN materials, no dynamic lights and no scenery shadow casters.

## Fog / pop-in contract

The race camera in current TURN has a 900 m far plane. DEAD CANYON r2 used fog that became fully opaque at 1,350 m, so the video could show road and scenery hitting the camera clip plane while they were still visibly rendered.

r3 instead uses a shared warm sky/fog colour, starts haze at 260 m and reaches full opacity at 760 m. That leaves about 140 m between complete visual disappearance and the camera far plane. Large cliff meshes also disable frustum culling. The intended result is that distant geometry dissolves into dusty atmosphere rather than visibly loading/unloading or being chopped off.

## Try it

Open `https://enkel.design/turn-lab/`, choose **DEAD CANYON**, and test especially:

1. the long views down the road at speed;
2. the eastern cliff run where the old wall could swallow the camera;
3. the AIRPORT-style hairpin and its new landmark/service area;
4. whether distant road, mesas and cliff forms disappear gradually into haze;
5. iPad performance.

## Safety

- No production `turn/` files are changed.
- The first LAB import map remains identical to current production TURN.
- Only the second LAB-scoped map replaces the internal MOUNTAIN slot.
- Production physics, handling, Drive By Ear, vehicles, UI and scoring remain unchanged.
