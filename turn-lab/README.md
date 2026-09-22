# TURN LAB — BADLANDS experiment

`/turn-lab/` runs the current production TURN runtime while keeping a separate PWA identity and separate `turn-lab:` / `turn-lab-session:` storage namespaces. Production `/turn/` files and production save data are not modified by LAB testing.

## Active experiment

TURN LAB currently repurposes only the production MOUNTAIN slot as **BADLANDS**. The track id stays `mountain` internally so the mature race, rival, garage, minimap, scoring, accessibility and progression contracts can be reused without adding a production-only track id.

BADLANDS is a roughly 1.6 km advanced course with 44 authored control points and 1,440 runtime samples. It is intentionally faster and more flowing than MOUNTAIN: a salt-flat start, an east-ridge climb, a tighter canyon rhythm, a broad north-mesa sweep, a west descent and a fast solar-basin return.

The world is procedural and LAB-only: warm dusk sky, red desert terrain, low-poly mesas, a central Needle Rock landmark, a 30-panel solar field, four telemetry masts, trackside rock scatter and a low setting sun. Scenery uses instancing where it matters, adds no dynamic lights and adds no shadow casters.

## Try it

1. Open `https://enkel.design/turn-lab/`.
2. Choose **Play in browser anyway**, or install **TURN LAB** as its own Home Screen app.
3. Choose **BADLANDS**. It appears in the slot where production TURN shows MOUNTAIN.
4. Pick a car in The Lot and start the race.
5. Check the road rhythm, readable landmarks, off-road containment, pace notes, minimap and performance on both iPhone and iPad.

## Safety

- No file under production `turn/` is changed for this experiment.
- The first import map remains identical to production TURN.
- A second LAB-only scoped import map replaces the MOUNTAIN definition, layout, pace notes and registry entry.
- LAB storage is isolated and seeds only the underlying MOUNTAIN reward so BADLANDS is immediately testable.
- Production physics, handling, drift, boost, Drive By Ear, accessibility, vehicles, UI and scoring remain the runtime source of truth.
