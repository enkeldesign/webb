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

- Newly supplied Kenney City Kit Suburban trees are used directly; the matching CC0 texture is vendored with them.
- Factory Kit, City Builder and Car Kit assets already present in POSTAL provide operators, conveyors, buildings, parcels, signage and trucks; these are reused rather than duplicated from the supplied packs.
- Sweden uses Natural Earth Admin 0 Countries 1:110m public-domain geometry.
- Three.js is retained in `vendor/` with its existing license file.

## Validation

Run the pure simulation tests with:

```sh
node postal/tests/model.test.mjs
```
