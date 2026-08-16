# POSTAL

A portrait-first, real-time “diner dash” management game about keeping package promises moving through a living Swedish delivery network.

## Player loop

1. **Read the live package rail.** Every active package remains visible at Depot, Region and Sweden scales, with carrier, route, deadline, location and a multi-stop breadcrumb.
2. **Select the pressure point.** The package itself reveals the next useful verb: sort, scan, reroute, load, send or follow.
3. **Shape each depot.** Sundsvall, Stockholm and Göteborg keep independent team focuses for late, complaint, express or international work.
4. **Choose departures.** Regional and national trucks never leave automatically. The player trades deadline protection against load efficiency.
5. **Build flow.** EXPRESS RUN, DEADLINE SAVE, SMART LOAD and FULL LOAD departures award points and can extend a dispatch chain.

## First morning

The first day is an interactive shift, not an onboarding dialog:

- Select and sort one DLH package from Söråker to Timrå.
- Load its regional truck and choose when it leaves.
- Meet a four-carrier intake wave and set Sundsvall’s focus.
- Find the Chicago → Timrå package in Stockholm, repair its missing scan and keep it visible through national and regional handoffs.
- Finish with a scored first-morning summary, then open the full incoming flow.

## Carrier rhythms

- **NORDPOST** — steady mixed domestic baseline.
- **DLH** — small, urgent express decisions.
- **BRUNG** — frequent local bursts.
- **STÄNKER** — bulky national and international cages.

## Visual system

- Nine distinct **Kenney Mini Characters** give every depot its own named team; skinned rigs are cloned through Three.js `SkeletonUtils` so they render correctly.
- **City Kit Suburban, Commercial and Industrial** buildings give every region a readable miniature identity.
- Correctly aligned **City Kit Roads** match the truck routes, while tree clusters frame the playable center instead of adding central clutter.
- **Factory Kit** conveyors, scanners, parcels, loading equipment and depot modules make the sorting floor legible.
- The selected package is marked in the 3D depot and its active route is highlighted in Region and Sweden views.
- Compact non-modal sheets preserve the world above them; the direct action remains in the main HUD.

## Validation

```sh
node postal/tests/model.test.mjs
node postal/tests/ui-contract.test.mjs
node postal/tests/character-rendering.test.mjs
node postal/tests/hierarchy.test.mjs
```
