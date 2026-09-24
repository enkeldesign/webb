# Adding a production track to TURN

TURN's production track count is deliberately variable. The current catalog may have six tracks, but runtime and responsive UI code must not treat six, eight, or any other number as a product maximum.

## Source of truth

Register production track metadata in `turn/tracks/definitions-base.js` (or the current canonical definitions layer if that changes later). `turn/tracks/definitions.js` derives `TRACK_IDS` and `TRACK_NAMES` from the active production definitions.

Do not add a second literal list of production track ids just to make another subsystem aware of the track.

## Runtime contract

A newly registered track must provide the explicit track-specific pieces that cannot sensibly be inferred:

- geometry/control-point factory in `turn/tracks/catalog.js`;
- world installer and forgiving-surface policy in `turn/tracks/registry.js`;
- Drive By Ear pace-note map;
- projected-shadow road height;
- track icon;
- Color Cue identity;
- racing music;
- any required progression/unlock definition.

The catalog and runtime registry intentionally throw when core geometry/world integration is missing. Other mandatory maps use `assertTrackConfigCoverage()` so adding a track cannot silently inherit an unrelated track's presentation.

## Every-track progression and calibration

Systems whose promise literally means "every track" must either cover the new track or deliberately expose a pending/unconfigured state before release:

- WINNER and SAFETY achievements;
- clean-lap targets;
- DRIFT/FLOW scoring targets;
- developer time trial;
- Chromatic Camouflage;
- support-challenge eligibility.

Support-challenge preference order is only a preference: any new catalog tracks are appended automatically. A track without a suitable calibrated support challenge is skipped rather than hidden from the production catalog.

## Variable-length UI

Track UI must consume catalog contents rather than cap them with `slice(0, N)`, nth-card assumptions, or a fixed number of rows.

Issue #905 owns the responsive composition work for variable catalog lengths. Its regression fixtures may use 9 or 10 synthetic tracks to expose fixed-row assumptions, but fixture count is never a product limit.

## Release gate

Before a production track ships:

1. run the full TURN regression suite, including `track-catalog-scalability-production.mjs`;
2. verify every mandatory explicit track registry is complete;
3. validate track selection, Home records, achievements, Stats, DBE, music, shadows, records/rivals and accessibility;
4. validate responsive track presentation under #905's viewport matrix;
5. bump the TURN build in the same merge and verify release integrity before and after merge.

Do not create a new manual `revision=` identifier for track integration work. Use the normal release/build process.
