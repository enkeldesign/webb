# TURN UP

TURN UP is a small motion-controlled flight game at `https://enkel.design/turnup/`. It reuses TURN's production web platform and steering engine, then adds calibrated pitch control for climbing and diving.

The first route starts over Sundsvall–Timrå Airport (Midlanda), crosses Söråker and the general Strind area, continues east, then returns along the coast and Indalsälven. The course never identifies a private home.

## Runtime

- MapLibre GL JS 6.5 renders the vector map, 3D terrain, buildings and Three.js custom flight layer.
- OpenFreeMap's Liberty style supplies OpenStreetMap/OpenMapTiles map data.
- AWS Terrain Tiles supply Terrarium elevation data.
- Three.js 0.184 renders gates and the aircraft.
- `B737_nologo.glb` loads at runtime from AMV Lab's `aircraft-models` commit `91d835e8e851b2317fe79af291c9fed6153fd525` under CC BY 4.0. A lightweight local aircraft is used if the remote asset is unavailable.
- TURN design tokens, platform adapters and canonical motion steering remain shared from `/turn/`.

## Controls

- Tilt left/right to bank using TURN's canonical motion profile.
- Tilt the device's top edge up/down to climb or dive.
- Hold Thrust or Air Brake to adjust speed.
- Button, keyboard and switch-accessible controls are always available.

Keyboard: arrows or W/A/S/D fly, Space/R adds thrust, Shift/F slows, C recalibrates and Escape pauses.

## Test

From the repository root:

```sh
node turn-tests/turnup-production.mjs
```

The production test checks the flight model, TURN integration contract, map/terrain sources, attribution, privacy copy and accessibility fallbacks.

## Credits

Map data © OpenStreetMap contributors, served through OpenFreeMap/OpenMapTiles. Terrain data is hosted through the AWS Registry of Open Data. Aircraft © AMV Lab contributors, CC BY 4.0.
