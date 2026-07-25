import fs from 'node:fs/promises';

const patches = new Map([
  ['turn/tracks/catalog.js', [[
    "import { CLIFFSIDE_CONTROL_POINTS } from './cliffside-layout.js?build=20260725-r68';",
    "import { CLIFFSIDE_CONTROL_POINTS } from './cliffside-layout.js';"
  ]]],
  ['turn/tracks/registry.js', [[
    "import { installCliffsideWorld } from './cliffside-world.js?build=20260725-r68';",
    "import { installCliffsideWorld } from './cliffside-world.js';"
  ]]],
  ['turn/tracks/cliffside-world.js', [[
    "import { trackPitch } from './elevation.js?build=20260725-r67';",
    "import { trackPitch } from './elevation.js';"
  ]]],
  ['turn/index.html', [[
    `        "./tracks/catalog.js": "./tracks/catalog.js?build=20260725-r67",\n        "./tracks/definitions.js": "./tracks/definitions.js?build=20260725-r67",\n        "./tracks/registry.js": "./tracks/registry.js?build=20260725-r67",`,
    `        "./tracks/catalog.js": "./tracks/catalog.js?build=20260725-r67",\n        "./tracks/cliffside-layout.js": "./tracks/cliffside-layout.js?build=20260725-r67",\n        "./tracks/cliffside-world.js": "./tracks/cliffside-world.js?build=20260725-r67",\n        "./tracks/definitions.js": "./tracks/definitions.js?build=20260725-r67",\n        "./tracks/elevation.js": "./tracks/elevation.js?build=20260725-r67",\n        "./tracks/registry.js": "./tracks/registry.js?build=20260725-r67",`
  ]]]
]);

for (const [path, replacements] of patches) {
  let source = await fs.readFile(path, 'utf8');
  for (const [before, after] of replacements) {
    const count = source.split(before).length - 1;
    if (count !== 1) throw new Error(`${path}: expected one exact match, found ${count}`);
    source = source.replace(before, after);
  }
  await fs.writeFile(path, source);
}

console.log(`TURN r68 stable imports patched in ${patches.size} files.`);
