# Trophy Road authored sources

These are the approved authored source icons for the Trophy Road / SVG icon-system work tracked by #740 and #749, plus the shared track pictograms used by Trophy Road, Achievements and The Lot.

The three `road-sand-*.png` files are unchanged 128 × 128 tiles from Kenney Racing Pack 1.1's `PNG/Tiles/Sand road` set, supplied for #761:

- `road-sand-bend.png` is source tile `road_sand01.png`; CSS rotation creates every bend orientation.
- `road-sand-straight.png` is source tile `road_sand33.png`; it sits behind the readable category-coloured reward cards.
- `road-sand-checkered.png` is source tile `road_sand39.png`; it gives START and FINISH their checkered treatment.

Kenney Racing Pack is CC0. These small primitives are kept as original PNGs rather than baking the complete responsive road into one large image.

## Authored reward sources

| Trophy Road reward | Source |
| --- | --- |
| VINTAGE RACER | `vintage-racer.svg` |
| SHIFT | `shift.svg` |
| RACE CAR | `race-car.svg` |
| FUTURE RACER | `future-racer.svg` |
| RALLY RACER | `rally-racer.svg` |
| MONSTER | `monster-truck.svg` |
| MIDNIGHT CITY | `midnight-city.svg` |
| MOUNTAIN | `mountain.svg` |

PERKS and PAINTJOB keep their current artwork. EMERGENCY! has no replacement source in this batch.

## Shared track pictograms

The six track SVGs are the source-of-truth pictograms for track-specific presentation:

- `countryside.svg`
- `airport.svg`
- `cliffside.svg`
- `harbor.svg`
- `midnight-city.svg`
- `mountain.svg`

They are reused for the six `… WINNER` achievements. MIDNIGHT CITY and MOUNTAIN also replace the previous generic Trophy Road reward drawings. The Lot may mirror the already-selected track with the same pictogram; this is decorative and does not create another track-selection state.

## Source handling

- The supplied car SVGs keep their original path geometry. Generator/C2PA/editor metadata was removed and the viewBoxes were tightened to the visible artwork for small-icon legibility.
- The supplied VINTAGE RACER path geometry is preserved and uses `currentColor`.
- The supplied SHIFT H-pattern / gear-lever geometry is preserved and uses `currentColor`.
- The track pictograms are filled single-colour vectors exposed through same-origin CSS masks so each surface can inherit its existing `currentColor`.
- The car silhouettes are filled SVGs; SHIFT is stroke-based. Trophy Road integration must support both rather than globally forcing every reward SVG to `fill: none`.
- Decorative instances remain hidden from assistive technology; the surrounding reward or achievement control owns the accessible name.

## Integration boundaries

The road primitives and pictograms are presentation-only. They do not change Trophy Road thresholds, reward order, unlock state, progression migration, achievement requirements or entitlements. The responsive road keeps the reward buttons as semantic HTML above these static images.

The authored reward icons remain the responsibility of #749; #761 does not redraw or reorder them.
