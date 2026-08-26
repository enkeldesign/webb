# BUILD-A-CAR prototype assets

The standalone wheel and spoiler GLBs in `parts/` come unmodified from **Kenney Car Kit 3.1**:

- `wheel-default.glb`
- `wheel-racing.glb`
- `wheel-dark.glb`
- `debris-spoiler-a.glb`
- `debris-spoiler-b.glb`

Source: https://kenney.nl/assets/car-kit

License: Creative Commons CC0 1.0 Universal. Attribution is not required, but TURN credits Kenney because the work is excellent.

The prototype routes the GLBs' authored `Textures/colormap.png` reference to TURN's existing Car Kit palette at runtime. Lower-body and cabin parts are currently virtual geometry slices of the already vendored `hatchback-sports.glb` and `sedan-sports.glb`; they are not duplicated here. This lets the LAB experiment evaluate modular fit before committing to a permanent processed asset library.
