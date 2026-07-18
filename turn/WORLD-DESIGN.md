# TURN world design direction

## Visual target

TURN should feel like a colourful toy-scale racing world rather than a realistic simulator. Keep the bold silhouettes, chunky geometry and black outlines, then use texture and material variation to make surfaces feel intentional rather than flat.

The road already reads well and should remain the visual anchor.

## Material language

### Grass
- Keep the bright green base, but break up the single flat colour with low-contrast large-scale variation.
- Add occasional darker grass patches and dry/yellow-green areas.
- Create a visibly worn shoulder near the track: compressed grass, dirt and gravel rather than an immediate hard transition from asphalt to perfect lawn.
- Avoid high-frequency photographic grass textures. They will fight the low-poly assets and shimmer at speed.

### Asphalt
- Preserve the current dark asphalt and red/white curbs.
- Keep subtle tonal noise broad and matte.
- Add occasional lightweight decals later: tyre marks, patched asphalt, grid markings and start/finish paint.

### Buildings and props
- Keep original Kenney material colours as the base palette.
- Use colour repetition deliberately so each area has its own identity.
- Prefer a few strong props over many small objects that become visual noise at racing speed.

## World zones

The full lap should pass through visually distinct sections so the player always has a sense of place.

1. **Start / paddock**
   - Garage buildings
   - Flags
   - Strong start/finish markings
   - More dense props and spectators later

2. **Forest section**
   - Denser trees close enough to create speed parallax
   - Darker ground and occasional dirt shoulders

3. **Open meadow**
   - Sparse trees
   - Long sight lines
   - Brighter grass and flowers/colour patches

4. **Town / park section**
   - Small buildings and fountains
   - More structured placement around the track
   - Good candidate for barriers, lamps and signs

A future fifth zone could introduce a completely different biome or weather treatment once the core world feels coherent.

## Horizon

Mountains are temporarily parked. When revisited, treat the horizon as a separate background layer rather than trackside scenery. It should never compete with the road or appear close enough to feel like a wall.

## Texture implementation

Prefer a small shared texture set instead of unique textures per object:

- 1 grass macro-variation texture
- 1 dirt/gravel shoulder texture
- 1 optional asphalt detail texture
- a small decal atlas for road markings and world details

Textures should tile cleanly, stay low-frequency and use modest resolution. The geometry and colour palette should remain responsible for most of the visual identity.

## Recommended next visual pass

1. Add grass macro variation and a dirt/gravel shoulder around the road.
2. Organise existing assets into the four world zones instead of distributing everything evenly.
3. Add start-grid and finish-line decals.
4. Tune lighting, fog and shadows per zone.
5. Revisit distant horizon scenery after the foreground world is stable.
