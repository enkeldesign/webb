# TURN performance checks

TURN's production build exposes diagnostics only when the page is opened with `?perf=1`.
The overlay reports frame rate, p50/p95 frame interval, frames slower than 33 ms,
draw calls, triangles, GPU resource counts, device pixel ratio and average track-index
checks per query. The latest sample is also available through
`globalThis.__turnGetPerfSnapshot()` and the `turn:perf-snapshot` browser event.

## Target-device pass

Use the same released build and run each scenario for at least 60 seconds after assets
have loaded:

1. Start line, stationary.
2. Race with no saved rivals.
3. Race with four saved rivals.
4. Sustained drift and boost effects.
5. The Lot with the 3D viewer open, then closed.
6. Spectate with four rivals.

Record the final snapshot for each scenario together with the device and OS version.
For the inclusive-device baseline, include a 9th-generation iPad or comparable hardware.
Compare p95 frame interval and slow-frame percentage before accepting visual additions;
an average FPS value alone can hide disruptive spikes.
