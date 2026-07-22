# TURN performance checks

TURN's production build exposes diagnostics only when the page is opened with `?perf=1`.
The overlay reports frame rate, p50/p95 frame interval, frames slower than 33 ms,
draw calls, triangles, GPU resource counts, actual device pixel ratio, the active renderer
profile and average track-index checks per query. The latest sample is also available through
`globalThis.__turnGetPerfSnapshot()` and the `turn:perf-snapshot` browser event.

## Renderer A/B profiles

Normal TURN keeps the production renderer unchanged. Renderer overrides are only honored when
`perf=1` is present, so the same release can be measured without changing the normal player build.

Append these query strings to `/turn/`:

- `?perf=1` — production baseline: DPR cap 2.0, 1024 shadow map.
- `?perf=1&dpr=1.5` — lower WebGL resolution only.
- `?perf=1&dpr=1.25` — stronger resolution reduction for comparison.
- `?perf=1&shadow=512` — smaller shadow map only.
- `?perf=1&dpr=1.5&shadow=512` — combined candidate profile.
- `?perf=1&shadow=off` — diagnostic ceiling with dynamic shadows disabled.

The overlay prints the requested profile and the renderer's actual DPR, so screenshots remain
self-describing. DPR values are clamped to 0.75–2.0 and supported shadow-map sizes are 256, 512
and 1024.

## Target-device pass

Use the same released build and run each scenario for at least 60 seconds after assets
have loaded:

1. Start line, stationary.
2. Race with no saved rivals.
3. Race with four saved rivals.
4. Sustained drift and boost effects.
5. The Lot with the 3D viewer open, then closed.
6. Spectate with four rivals.

For the iPad 9 baseline, run the production profile first, then repeat the most demanding
four-rival race with DPR 1.5, shadows 512, and the combined DPR 1.5 + shadows 512 profile.
Only run DPR 1.25 and shadows-off if the first comparison does not clearly identify the bottleneck.

Record the final snapshot for each scenario together with the device and OS version.
For the inclusive-device baseline, include a 9th-generation iPad or comparable hardware.
Compare p95 frame interval and slow-frame percentage before accepting visual additions;
an average FPS value alone can hide disruptive spikes.