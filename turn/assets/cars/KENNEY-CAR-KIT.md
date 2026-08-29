# Kenney Car Kit vehicles

TURN includes these unmodified model files from Kenney's **Car Kit 3.1**:

- `ambulance.glb`
- `firetruck.glb`
- `police.glb`

`training-car.glb` is derived from the kit's `taxi.glb`. An earlier attempt to
remove the Taxi roof sign also exposed part of the roof mount, so TURN now puts
a fixed green Training Car sign over that mount and adds matching green door
plaques at render time. Those training identifiers are deliberately separate
from PAINTJOB: body and trim colours can still change while the signs remain
green. The remaining body and four independently addressable wheel meshes retain
Kenney's authored UVs and `Textures/colormap.png` reference.

Asset source: https://kenney.nl/assets/car-kit

License: Creative Commons CC0 1.0 Universal. Attribution is not required, but TURN credits Kenney because the work is excellent.
