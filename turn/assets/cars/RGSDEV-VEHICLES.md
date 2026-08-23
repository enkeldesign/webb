# RGSDev vehicle models in TURN

TURN uses selected models from **Free Low Poly Vehicles Pack** by Raphael Gonçalves (Rgsdev).

Source: https://rgsdev.itch.io/free-low-poly-vehicles-pack

The source pack's `License.txt` states:

> Assets created by Raphael Gonçalves (Rgsdev)
> This asset is under CC0 License
> Public domain and free to use on any project, even commercial.
> Credit is not required.

The original FBX files are stored in TURN as a compact, gzip-compressed runtime mesh bundle. Triangle topology, material assignments, material names and source colours are preserved. Vertex positions are quantized inside each vehicle's source bounds before compression; at TURN's approximately five-metre display scale the maximum coordinate error is about two centimetres. Three.js supplies flat-shaded surface normals at render time. Browsers without `DecompressionStream` keep using TURN's previous individual GLB models as a compatibility fallback.

## TURN mapping

| TURN vehicle ID | RGSDev source model |
| --- | --- |
| `convertible` | Roadster |
| `classic` | Hatchback |
| `vintage-racer` | Muscle |
| `monster-truck` | Monster Truck |
| `race` | Sports |
| `sedan` | Sedan |
| `suv` | SUV |
| `firetruck` | Firetruck |
| `police` | Police Sedan |
| `ambulance` | Ambulance |
| `truck` | Truck |
| `van` | Van |

TURN deliberately retains its existing `toy-racer` (Rally Racer), `race-future` (Future Racer) and `sedan-sports` (Sport Sedan) models because those cars have distinctive visual/gameplay contracts. In particular, Sport Sedan retains its separately paintable spoiler and hidden secondary-colour easter egg.

PAINTJOB is applied only to the selected primary body material of each paintable RGSDev model; trim, windows, lights, wheel rims and secondary body accents retain the source art. Emergency vehicle liveries, flashing light rigs and siren behaviour remain TURN-owned systems keyed to the existing logical vehicle IDs.
