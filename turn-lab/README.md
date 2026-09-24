# TURN LAB — DEAD CANYON + SUBURBS

`/turn-lab/` runs the current production TURN runtime with isolated LAB storage. Production `/turn/` files and production save data stay untouched.

## Two LAB tracks at once

TURN LAB exposes both current experiments simultaneously:

- **DEAD CANYON** uses the internal MOUNTAIN slot. It is restored to the post-#970 / #974 open-canyon state: about 3.25 km, ADVANCED, golden-hour canyon wall, the opening chicane, DEAD CANYON CROWN geology and the corrected DBE ear directions.
- **SUBURBS** uses the internal CLIFFSIDE slot. Its existing roughly 1.9 km course geometry is preserved exactly, but the world now follows the mockup direction: a compact, toy-like **summer island** surrounded by water.

Both are available from the normal track chooser. LAB still uses isolated save namespaces, and its bootstrap unlocks only the internal MOUNTAIN reward needed to make DEAD CANYON immediately testable.

## SUBURBS island pass

The road geometry is unchanged. The composition is not:

- the huge grass plane is replaced by a bounded green island with a sandy shoreline and water on every side;
- houses, driveways, colourful parked cars, trees and fences are pulled materially closer to the racing line;
- the second house row is retained but pulled inward so the neighbourhood stays dense;
- the park remains inside the long sweep, with playground, picnic blanket, planters and paths;
- the eastern turnaround remains the cul-de-sac/backyard section;
- the dock is moved to the coast and extends over the surrounding water, with the Kenney rowboat moored beside it;
- Kenney City Kit Suburban 2.0 houses and multiple palette variants remain the main visual language.

SUBURBS is labelled **MEDIUM**, not EASY.

## DEAD CANYON restoration

`turn-lab/tracks/dead-canyon-world.js` was never deleted. The matching r4 course geometry, ADVANCED metadata, DBE pace notes and wide canyon intro camera are restored alongside SUBURBS instead of being replaced by it.

## LAB isolation

- Production `turn/` runtime files are unchanged.
- The first LAB import map remains identical to production TURN.
- LAB repurposes only MOUNTAIN and CLIFFSIDE for the two experiments.
- Production handling, vehicles, replay/rivals, scoring, input and accessibility remain authoritative.
- LAB keeps separate save namespaces.
