# TURN LAB — SUBURBS experiment

`/turn-lab/` runs the current production TURN runtime with separate LAB storage. Production `/turn/` files and production save data stay untouched.

## Active experiment

TURN LAB repurposes only the internal MOUNTAIN slot as **SUBURBS**. The internal id remains `mountain` so the mature race, rival, minimap, scoring, input and accessibility systems continue to come directly from production.

SUBURBS is an **EASY**, flat, roughly 1.9 km summer course and is unlocked immediately in a fresh LAB profile. It is deliberately broad and readable while still containing an S-bend, long sweepers and one tighter backyard/cul-de-sac turn for drift and FLOW.

## Art direction

The target is cheerful, colourful and unmistakably summery rather than epic.

- Kenney **City Kit Suburban 2.0** provides complete houses, driveways, fences, planters and large/small trees.
- The experiment uses the kit's default palette plus Variations A, B and C so streets read as colourful neighbourhoods rather than one repeated house family.
- Eight static TURN cars are parked at driveways in different bright colours.
- The infield contains a green park with a small colourful playground and picnic blanket.
- A blue neighbourhood lake has a wooden dock and a moored Kenney Watercraft rowboat.
- Wide sidewalks, white road edges and sunny yellow centre dashes keep the racing line legible.
- No dynamic scenery lights or shadow casters are introduced.

The City Kit source is the same immutable Kenney City Kit Suburban 2.0 package already used by TURN. SUBURBS expands its use to more house types and all supplied palette variations.

## Try it

Open `https://enkel.design/turn-lab/`, choose **SUBURBS**, and check especially:

1. first-glance readability as an easy track;
2. whether the neighbourhood feels dense enough beyond the road without hiding corners;
3. colour variety across houses and parked cars;
4. the park/lake/dock/boat composition;
5. whether the tighter eastern turn feels like a fun skill moment rather than a difficulty spike;
6. performance on iPhone 16 and iPad 9.

## Safety

- Production `turn/` files are unchanged.
- The first LAB import map remains identical to current production TURN.
- LAB overrides only the internal MOUNTAIN track modules plus its intro camera.
- Production physics, handling, vehicles, UI, scoring and Drive By Ear remain the runtime source of truth.
