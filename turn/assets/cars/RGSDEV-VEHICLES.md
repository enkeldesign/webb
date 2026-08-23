# RGSDev vehicle models in TURN

TURN uses selected models from **Free Low Poly Vehicles Pack** by Raphael Gonçalves (Rgsdev).

Source: https://rgsdev.itch.io/free-low-poly-vehicles-pack

The source pack's `License.txt` states:

> Assets created by Raphael Gonçalves (Rgsdev)
> This asset is under CC0 License
> Public domain and free to use on any project, even commercial.
> Credit is not required.

The original FBX files were converted to compact glTF 2.0 binary files for TURN while preserving geometry, normals, material assignments, material names and diffuse colours. The converted GLBs are stored in a gzip-compressed tar bundle split into text-safe base64 parts for repository transport. Browsers without `DecompressionStream` keep using TURN's previous individual GLB models as a compatibility fallback.

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

PAINTJOB is applied only to the selected primary body material of each paintable RGSDev model; trim, windows, lights, wheels and secondary body accents retain the source art. Emergency vehicle liveries, flashing light rigs and siren behaviour remain TURN-owned systems keyed to the existing logical vehicle IDs.
