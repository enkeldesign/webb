# Trophy Road authored SVG sources

These are the approved authored source icons for the Trophy Road 2 / SVG icon-system work tracked by #740 and #749.

## Replace with these sources

| Trophy Road reward | Source |
| --- | --- |
| VINTAGE RACER | `vintage-racer.svg` |
| SHIFT | `shift.svg` |
| RACE CAR | `race-car.svg` |
| FUTURE RACER | `future-racer.svg` |
| RALLY RACER | `rally-racer.svg` |
| MONSTER | `monster-truck.svg` |

## Keep the current icon

Per the approved visual direction, do not replace these in this batch:

- MIDNIGHT CITY
- MOUNTAIN
- PERKS
- PAINTJOB

EMERGENCY! has no replacement source in this batch.

## Source handling

- The four supplied car SVGs keep their original path geometry. Generator/C2PA/editor metadata was removed and the viewBoxes were tightened to the visible artwork for small-icon legibility.
- The supplied VINTAGE RACER path geometry is preserved and uses `currentColor`.
- The supplied SHIFT H-pattern / gear-lever geometry is preserved and uses `currentColor`.
- The car silhouettes are filled SVGs; SHIFT is stroke-based. Trophy Road integration must support both rather than globally forcing every reward SVG to `fill: none`.
- Decorative instances remain hidden from assistive technology; the surrounding reward control owns the accessible name.

## Integration boundary

This directory intentionally stages source assets only. It does not change current Trophy Road thresholds, reward order, unlock state, progression migration, runtime imports, cache identity or live presentation.

When #740/#749 integrates the new icons, remove the legacy FUTURE RACER marker CSS-mask override in `turn/progression/trophy-road.css`; otherwise the authored SVG will be hidden on the road marker even if it is used in the detail view.
