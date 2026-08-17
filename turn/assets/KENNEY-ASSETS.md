# TURN vendored Kenney assets

The vehicle models in `cars/` are selected from Kenney Prototype Kit 1.0, Toy Car Kit 1.2, and Car Kit 3.1.
The scenery pieces in `lot-bricks/` are selected from Kenney Brick Kit 1.0.
The `scenery/fantasy-town/windmill.glb` rotor and its `Textures/colormap.png` palette are from Kenney Fantasy Town Kit 2.0. The self-contained `scenery/fantasy-town/fountainCenter.glb` used in MOUNTAIN's village is from Kenney Fantasy Town Kit 1.0.
The MOUNTAIN r2 village uses the Kenney Holiday Kit geometry at `scenery/mountain/holiday/cabin-wall.glb` and `cabin-roof-snow-dormer.glb`. These TURN-vendored copies are deliberately small, self-contained GLBs with simple material colors, so the village does not depend on a separately fetched palette texture. The original Holiday palette remains bundled for source/reference compatibility.
The MOUNTAIN r2 waterfall cliff uses `scenery/mountain/nature/cliff-waterfall-top-rock.glb` and `cliff-waterfall-rock.glb` from Kenney Nature Kit. TURN recolours the Nature grass/dirt materials to snow/granite at runtime so the cliff belongs to MOUNTAIN's winter biome.
The `scenery/watercraft/ship-ocean-liner.glb` model and its `Textures/colormap.png` palette are from Kenney Watercraft Kit 2.1.

Palette-dependent models stay beside their pack-specific palette because their GLBs refer to the same relative `Textures/colormap.png` path. Self-contained assets do not require an external palette texture. MOUNTAIN's production contract parses its vendored GLB binaries in CI so truncated or malformed asset commits fail before visual testing.

All bundled Kenney packs and models are released under Creative Commons CC0 1.0. Attribution is not required.
Original source: https://kenney.nl/assets
