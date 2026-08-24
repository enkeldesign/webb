# TURN vendored Kenney assets

The vehicle models in `cars/` are selected from Kenney Prototype Kit 1.0, Toy Car Kit 1.2, and Car Kit 3.1.
The scenery pieces in `lot-bricks/` are selected from Kenney Brick Kit 1.0.
The legacy `scenery/fantasy-town/windmill.glb` file is the Fantasy Town Kit 2.0 rotor/blades component, not a complete windmill building. MOUNTAIN r3 deliberately does **not** place it as a freestanding landmark.
The `scenery/watercraft/ship-ocean-liner.glb` model and its `Textures/colormap.png` palette are from Kenney Watercraft Kit 2.1.

## COUNTRYSIDE planned world

`scenery/countryside/` contains the restrained asset vocabulary used to turn the original scattershot scenery into six readable rural districts: race paddock, managed forest edge, windmill farm, orchard, Birchfield village and lake.

### City Kit Suburban

The complete `building-type-a`, `b`, `h`, `m`, `s` and `u` GLBs, together with `driveway-short` and `fence-low`, come from Kenney City Kit Suburban 2.0. The local `Textures/colormap.png` is Kenney's supplied Variation B palette. It gives the small village a coherent Swedish-red house family instead of distributing unrelated City Builder shops around the circuit.

### Nature Kit

The selected crop beds, wheat, corn, fences, broadleaf trees, shrubs, logs and shoreline rocks come from Kenney Nature Kit. TURN maps the named flat-colour materials into a quieter countryside palette at load time while preserving the original geometry. Assets are placed in rows, boundaries and small clusters rather than scattered randomly.

### Watercraft Kit

`scenery/watercraft/boat-row-small.glb` shares the Watercraft Kit palette already vendored for CLIFFSIDE. COUNTRYSIDE places one rowboat beside the lake island; it is decorative and static.

The planned-world group is explicitly scenery-only. It does not import or alter track samples, road meshes, collision profiles, lap rules, achievements or the separate BELLA rescue module. Every authored placement also observes a protected clearing around BELLA and her tree.

The Fantasy Town windmill remains in its established track-relative position. Its supplied warm-wood/pale-cloth blade palette and the neutral custom tower are now locked against the retired global zone tint that previously shifted the blades toward orange/pink.

## Vehicle palette routing

The vehicle GLBs retain Kenney's authored `TEXCOORD_0` palette mapping for body panels, glass, lamps, trim and wheels. Car Kit models use `cars/palettes/car-kit.png`; Prototype Kit and Toy Car Kit share `cars/palettes/toy-prototype.png`. Although the source GLBs all refer to `Textures/colormap.png`, TURN routes that URI by the catalog's `pack` field so models from different kits cannot receive the wrong palette.

Player paint is applied at render time to selected palette cells on the existing surfaces. Every repaintable car exposes primary body/rim paint plus a secondary native trim region; the exact regions vary with the source model. This does not add meshes or change source topology. Police, Ambulance and Fire Truck use the authored Car Kit service liveries without player recolouring.

## MOUNTAIN r3

MOUNTAIN treats Kenney's packs as modular kits rather than assuming every GLB is a complete building.

### Holiday Kit

`scenery/mountain/holiday/` contains the original Kenney Holiday Kit GLBs used for the alpine village and roadside winter detail:

- `cabin-wall.glb`
- `cabin-doorway.glb`
- `cabin-window-large.glb`
- `cabin-roof-snow.glb`
- `bench.glb`
- `lantern.glb`
- `sled.glb`
- `snow-pile.glb`
- `snow-flat-large.glb`
- `tree-snow-a.glb`

The cabin wall/door/window pieces use Kenney's one-unit modular grid. TURN assembles one wall row and then builds the gable from two `cabin-roof-snow` halves: one normal half and one X-mirrored half meeting at the ridge. The roof halves are not rotated through each other and wall rows are not arbitrarily overlapped.

### Fantasy Town Kit

`scenery/mountain/fantasy/` supplies complete village details rather than the old loose windmill rotor:

- `stall-green.glb`
- `stall-red.glb`
- `cart.glb`
- `fountain-round-detail.glb`
- `fence.glb`

These provide a small market/plaza vocabulary around the Holiday cabins without turning MOUNTAIN into a Christmas theme park.

### Nature Kit

`scenery/mountain/nature/` contains `cliff-waterfall-top-rock.glb` and `cliff-waterfall-rock.glb`. They are used as repeated modest-scale accents on top of MOUNTAIN's structural low-poly waterfall cliff. They must not be stretched into one enormous rectangular cliff slab. Nature materials are mapped semantically: water stays water, grass becomes snow, dirt becomes granite and the remaining rock surfaces use MOUNTAIN granite.

### Placement and loading rules

Holiday and Fantasy Town GLBs retain their original `Textures/colormap.png` references, so each vendored pack keeps the corresponding palette in its own `Textures/` directory. The production regression parses every MOUNTAIN GLB and checks referenced images are readable, preventing the earlier Codespaces asset-loading failure.

Imported MOUNTAIN props are grounded from their **transformed world-space bounding box** (`THREE.Box3.setFromObject`) against the same terrain-height function used to generate the visible mountain. Placement therefore does not assume a GLB origin is at its feet. Route-clearance checks run before placement so cabins, props, snow and rocks cannot silently migrate onto the road.

MOUNTAIN also has browser-rendered fixed-camera smoke coverage (aerial, village, summit, descent and waterfall). CI uploads those screenshots together with geometry/grounding metrics so source-level tests are not the only visual quality gate.

All referenced Kenney packs and models are released under Creative Commons CC0 1.0. Attribution is not required.
Original source: https://kenney.nl/assets
