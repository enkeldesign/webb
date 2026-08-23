# TURN Supercar source

TURN's `toy-racer` vehicle is rendered from the user-supplied `A_R7.zip` low-poly car asset.

The archive includes this licence text:

> CC0
> You can copy, modify, distribute and perform the work, even for commercial purposes, all without asking permission.

TURN uses:

- `A_R7_Body_3.fbx`
- `Rims_1_R.fbx`
- `Rims_2_L.fbx`
- `A_R7_Spoiler_2fbx.fbx`

For TURN, those meshes and material assignments are converted into the same compact vehicle geometry format used by the RGSDev refresh. Vertex positions are quantized to 8-bit coordinates within the model bounds (about 1.3 cm worst-case in the source scale), while triangle assignments, material assignments and diffuse colours are preserved. The gzip-compressed payload is split into text-safe base64 parts for repository transport. Browsers without `DecompressionStream` fall back to TURN's previous `toy-racer.glb` asset.

The player-facing vehicle is deliberately called **Supercar** rather than using any real-world make or model name. TURN keeps the existing `toy-racer` logical id so saved selections, Trophy Road unlocks, ghosts, telemetry and the `TWITCHY TURNY` perk remain compatible.

PAINTJOB targets only the source material named `Car`; glass, lamps, trim, tyres, rims and spoiler materials keep their authored treatment.
