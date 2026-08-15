# POSTAL

A portrait-first, pausable real-time logistics game spanning parcel, depot, regional, national and international flows.

## Core loop

- Choose one operational focus: late parcels, complaints, express or international.
- Workers automatically pull the highest-value parcel that matches that focus.
- Regional trucks deliver locally or feed the national handoff.
- National linehaul connects Sundsvall, Stockholm and Göteborg.
- International transports handle both outbound and inbound parcels at Sweden's gateways.
- Exceptions and complaints require parcel-level investigation; resolved parcels re-enter the live system and can be watched all the way to delivery.

## Demo detective cases

- `US-77104`: USA → Timrå, stuck in Stockholm after a missing scan.
- `GBG-23018`: Mölndal → Uppsala, sorted to the wrong dock in Göteborg.
- `SOR-48219`: Söråker → Denmark, demonstrating local → national → international flow.

## Assets

- Three distinct **Kenney Mini Characters** are used as the depot team; the old Factory Kit alien operators are no longer loaded.
- Supplied **City Kit (Suburban)**, **City Kit (Commercial)** and **City Kit (Industrial)** buildings give each region its own readable miniature identity.
- **City Kit (Roads) 2.0** supplies the modular crossroads, crossings, straights, road ends, lights and work-zone props used by the depot and region dioramas.
- Factory Kit equipment provides the cutaway depot shell, conveyors, scanner, control panels, parcels and floor signage.
- The postal truck remains the existing Kenney Car Kit model shared with TURN.
- Sweden uses Natural Earth Admin 0 Countries 1:110m public-domain geometry.
- Three.js is retained in `vendor/` with its existing license file.

The UI is a single full-height portrait stage: game information and controls are layered around the 3D world instead of shrinking it into a dashboard card. A non-WebGL fallback preserves package investigation and operational controls on constrained devices.

## Validation

Run the pure simulation tests with:

```sh
node postal/tests/model.test.mjs
node postal/tests/ui-contract.test.mjs
```
