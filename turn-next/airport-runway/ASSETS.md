# AIRPORT: RUNWAY prototype assets

This directory is **TURN NEXT test-only**. Nothing here is part of the production TURN asset bundle unless the prototype is explicitly promoted later.

## Airbus A380 model

- Source: [amvlab/aircraft-models](https://github.com/amvlab/aircraft-models)
- Asset: `models/A380_nologo.glb`
- Source revision: `91d835e8e851b2317fe79af291c9fed6153fd525`
- License: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- Runtime use: logo-free model, scaled and oriented in Three.js to serve as the AIRPORT: RUNWAY obstacle. The source GLB is not modified or redistributed by this prototype.

Attribution: **amvlab 3D Aircraft Models**, licensed under CC BY 4.0.

## Traffic cones

The runway barriers use a tiny procedural low-poly cone built from Three.js primitives. This follows the same approach already used by TURN's canonical Airport scenery and avoids adding another remote dependency for dozens of small repeated objects.

If AIRPORT: RUNWAY is promoted into production TURN, carry the A380 attribution into TURN's production asset/credit documentation at the same time.
