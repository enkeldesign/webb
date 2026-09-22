# TURN LAB — DEAD CANYON experiment

`/turn-lab/` runs the current production TURN runtime while keeping a separate PWA identity and separate `turn-lab:` / `turn-lab-session:` storage namespaces. Production `/turn/` files and production save data are not modified by LAB testing.

## Active experiment

TURN LAB currently repurposes only the production MOUNTAIN slot as **DEAD CANYON**. The internal track id stays `mountain` so the mature race, rival, garage, minimap, scoring, accessibility and progression contracts can be reused without adding a production track id.

DEAD CANYON is a roughly 3.2 km advanced course with 72 authored control points and 2,160 runtime samples. It keeps BADLANDS' readable, fast rhythm but has roughly twice the lap distance: a long southern run, an eastern cliff climb, needle country, a high-mesa sweep, abandoned Retro Urban outposts, a western wash and a long desert return.

The eastern side is one continuous 210 m escarpment rather than a row of isolated pyramids. Eleven tall needles stand in front of it. Elsewhere the geology deliberately mixes table mesas, irregular buttes, eroded domes and small trackside rocks so the silhouette does not repeat one shape.

## Retro Urban Kit

DEAD CANYON uses a small CC0 subset of Kenney's **Retro Urban Kit 2.0** supplied for the experiment. To keep LAB light, only geometry is retained from selected kit models and TURN applies its own materials. The current set includes garage modules, broken walls, scaffolding, cargo trucks and damaged barriers.

The assets form four authored roadside scenes rather than a conventional city: the DEAD CANYON start outpost, a maintenance site below the eastern cliff, an abandoned scrapyard and a ghost service stop. They add no dynamic lights or shadow casters.

See `turn-lab/assets/kenney/retro-urban/LICENSE.txt` for the CC0 source license.

## Try it

1. Open `https://enkel.design/turn-lab/`.
2. Choose **Play in browser anyway**, or install **TURN LAB** as its own Home Screen app.
3. Choose **DEAD CANYON**. It appears in the slot where production TURN shows MOUNTAIN.
4. Pick a car in The Lot and start the race.
5. Check the longer rhythm, cliff scale, needles, outpost readability, off-road containment, pace notes, minimap and iPad performance.

## Safety

- No file under production `turn/` is changed for this experiment.
- The first import map remains identical to production TURN.
- A second LAB-only scoped import map replaces the MOUNTAIN definition, layout, pace notes and registry entry.
- LAB storage is isolated and unlocks only the underlying MOUNTAIN reward so DEAD CANYON is immediately testable.
- Production physics, handling, drift, boost, Drive By Ear, accessibility, vehicles, UI and scoring remain the runtime source of truth.
