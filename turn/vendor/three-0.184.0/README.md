# three.js 0.184.0 (vendored)

TURN serves the three.js files it uses from its own origin so the installed app
works offline (#1030). Copied unchanged from the `three@0.184.0` npm package:

- `build/three.module.js`, `build/three.core.js`
- `examples/jsm/loaders/GLTFLoader.js`, `examples/jsm/loaders/OBJLoader.js`
- `examples/jsm/utils/BufferGeometryUtils.js`, `examples/jsm/utils/SkeletonUtils.js`

The version is part of the path, so these URLs never change content. To upgrade,
add a new `three-X.Y.Z` directory from the npm package and point the import maps
(`"three-native"`, `"three/addons/"`) at it. MIT licence: see `LICENSE`.
