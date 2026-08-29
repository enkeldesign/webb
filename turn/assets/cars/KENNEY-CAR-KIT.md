# Kenney Car Kit vehicles

TURN includes these unmodified model files from Kenney's **Car Kit 3.1**:

- `ambulance.glb`
- `firetruck.glb`
- `police.glb`

`training-car.glb` uses the kit's `taxi.glb` body and four independently
addressable wheel meshes. An earlier conversion removed the Taxi roof sign;
TURN restores that sign from the **exact original Kenney Taxi source geometry**
(`taxi.obj` vertices 367–370 and 375–378, using the same 10 source triangles).
No substitute sign shape is generated.

The player-facing vehicle is the **Learner Car**. TURN keeps the Taxi body yellow,
uses dark trim, and applies fixed yellow learner identifiers with a black border
and black `L`. The door identifier is a colour treatment on the existing body
surface; it adds no door geometry. The body and trim retain the normal PAINTJOB
behaviour while the learner identifiers stay visually stable.

Asset source: https://kenney.nl/assets/car-kit

License: Creative Commons CC0 1.0 Universal. Attribution is not required, but TURN credits Kenney because the work is excellent.
