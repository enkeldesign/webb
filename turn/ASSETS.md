# TURN asset strategy

## Primary library: Kenney

Use **Kenney** as the default visual asset library for TURN.

Recommended packs:

- **Car Kit**: 45 vehicle assets, CC0.
- **Racing Kit**: 110 racing/track/vehicle assets, CC0.

Kenney states that assets published on its asset pages are public-domain licensed under CC0 and can be used commercially without attribution.

Sources:

- https://kenney.nl/assets/car-kit
- https://kenney.nl/assets/racing-kit
- https://kenney.nl/support

## Permanence policy

Do not hotlink production game assets from Kenney or another asset CDN.

Instead:

1. Download the chosen original asset pack.
2. Select only the models TURN actually uses.
3. Commit those files under `turn/assets/kenney/`.
4. Keep the included license/readme alongside the assets.
5. Load the local copies with Three.js `GLTFLoader`.

This makes the deployed game independent of changes to third-party URLs while keeping the source and license clear.

Three.js glTF loader documentation:

- https://threejs.org/docs/pages/GLTFLoader.html

## Current prototype

The current player car remains procedural for now because TURN needs explicit control over the front-wheel steering pivots and exaggerated black outlines. When a Kenney car is selected, map its wheel nodes to the same steering interface or wrap its wheel meshes in steering pivots during load.
