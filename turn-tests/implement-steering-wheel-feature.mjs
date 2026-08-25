import fs from 'node:fs/promises';

const WHEEL_REVISION = 'r211-steering-wheels';

async function edit(path, transform) {
  const source = await fs.readFile(path, 'utf8');
  const output = transform(source);
  if (output === source) throw new Error(`${path}: transform made no changes`);
  await fs.writeFile(path, output);
}

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`${label}: expected 1 match, found ${matches.length}`);
  return source.replace(pattern, replacement);
}

await edit('turn/vehicle/catalog.js', (source) => {
  let output = replaceOnce(
    source,
    "  ['monster-truck', 'Monster Truck', 'rgsdev', { speed: 2, acceleration: 3, control: 2, drift: 5, boostPower: 2, boostDuration: 4 }, 0.83, 0, 0.62],",
    "  ['monster-truck', 'Monster Truck', 'toy', { speed: 2, acceleration: 3, control: 2, drift: 5, boostPower: 2, boostDuration: 4 }, 0.83, 2, 0.62],",
    'Monster Truck catalog row'
  );
  output = replaceOnce(
    output,
    "  'monster-truck': './assets/cars/monster-truck-rgsdev.glb',\n",
    '',
    'Monster Truck RGSDev asset override'
  );
  return output;
});

await edit('turn/vehicle/semantic-car-finish.js', (source) => {
  const vintageProfile = `  'vintage-racer': profile({\n    primary: [[7, 4], [7, 5]],\n    secondary: [[1, 6], [1, 7]],\n    rims: [[4, 6], [4, 7]]\n  }),\n`;
  const monsterProfile = `${vintageProfile}  'monster-truck': profile({\n    primary: [[7, 4], [7, 5]],\n    secondary: [[1, 6], [1, 7]],\n    rims: [[4, 7]]\n  }),\n`;
  return replaceOnce(source, vintageProfile, monsterProfile, 'Vintage Racer semantic profile anchor');
});

await edit('turn/vehicle/car-models.js', (source) => {
  let output = source.replaceAll('catalog.js?revision=r182-vintage-rally-paint', `catalog.js?revision=${WHEEL_REVISION}`)
    .replaceAll('semantic-car-finish.js?revision=r182-vintage-rally-paint', `semantic-car-finish.js?revision=${WHEEL_REVISION}`);
  if (output === source) throw new Error('Car model dependency cache revisions were not found');

  output = replaceOnce(
    output,
    'const FEATURED_SURFACE_TARGET_LENGTHS = new Set([5.15, 5.5]);\n',
    "const FEATURED_SURFACE_TARGET_LENGTHS = new Set([5.15, 5.5]);\nconst REVERSED_FRONT_WHEEL_LABEL_IDS = new Set(['vintage-racer']);\n",
    'featured surface constant'
  );

  output = replaceOnce(
    output,
    '  if (outline) addOutlines(model);\n  const featuredSurface = FEATURED_SURFACE_TARGET_LENGTHS.has(targetLength);',
    '  if (outline) addOutlines(model);\n  const frontWheelPivots = installFrontWheelSteeringRig(model, car);\n  const featuredSurface = FEATURED_SURFACE_TARGET_LENGTHS.has(targetLength);',
    'car outline / sizing boundary'
  );

  output = replaceOnce(
    output,
    '  root.userData.frontWheelPivots = [];\n',
    '  root.userData.frontWheelPivots = frontWheelPivots;\n',
    'front wheel pivot userData assignment'
  );

  const normalizationAnchor = 'function normalizeModelToGround(model, targetLength) {';
  const wheelRig = `function installFrontWheelSteeringRig(model, car) {\n  const actualFrontRole = REVERSED_FRONT_WHEEL_LABEL_IDS.has(car.id) ? 'back' : 'front';\n  const frontWheels = [];\n  model.traverse((node) => {\n    if (!node?.parent || wheelRole(node.name) !== actualFrontRole) return;\n    frontWheels.push(node);\n  });\n\n  const pivots = [];\n  for (const wheel of frontWheels) {\n    const parent = wheel.parent;\n    const localPosition = wheel.position.clone();\n    parent.remove(wheel);\n\n    const pivot = new THREE.Group();\n    pivot.name = \`\${wheel.name || 'wheel'}-steer-pivot\`;\n    pivot.position.copy(localPosition);\n    parent.add(pivot);\n\n    wheel.position.set(0, 0, 0);\n    pivot.add(wheel);\n    pivots.push(pivot);\n  }\n  return pivots;\n}\n\nfunction wheelRole(name = '') {\n  const label = String(name).toLowerCase();\n  if (/^wheel-(?:front|f[lr])(?:-|$)/.test(label)) return 'front';\n  if (/^wheel-(?:back|b[lr])(?:-|$)/.test(label)) return 'back';\n  return null;\n}\n\n`;
  output = replaceOnce(output, normalizationAnchor, wheelRig + normalizationAnchor, 'model normalization function');
  return output;
});

await edit('turn/vehicle/emergency-livery-models.js', (source) => replaceOnce(
  source,
  "} from './car-models.js?build=20260823-r183-native-car-surfaces';",
  `} from './car-models.js?build=20260823-r183-native-car-surfaces&revision=${WHEEL_REVISION}';`,
  'car-model bridge import'
));

for (const path of ['turn/index.html', 'turn-lab/index.html', 'turn-next/index.html', 'yourturn/index.html']) {
  await edit(path, (source) => {
    let changed = 0;
    const output = source.replace(/(:\s*"[^"]*(?:emergency-livery-models|vehicle\/catalog)\.js\?[^"]*)(")/g, (match, target, quote) => {
      if (target.includes(`wheel=${WHEEL_REVISION}`)) return match;
      changed += 1;
      return `${target}&wheel=${WHEEL_REVISION}${quote}`;
    });
    if (changed === 0) throw new Error(`${path}: no vehicle import-map targets cache-busted`);
    return output;
  });
}

await edit('turn-lab/tests/car-orientation-production.mjs', (source) => {
  let output = replaceOnce(source, "  ['monster-truck', 0],", "  ['monster-truck', 2],", 'Monster Truck yaw expectation');
  output = replaceOnce(
    output,
    "  const rawFront = car.pack === 'rgsdev'\n    ? { x: 0, z: 1 }\n    : getKenneyWheelAxis(json, car);",
    '  const rawFront = getKenneyWheelAxis(json, car);',
    'RGSDev orientation exception'
  );
  output = replaceOnce(output, "assert.equal(monsterTruck.pack, 'rgsdev');", "assert.equal(monsterTruck.pack, 'toy');", 'Monster Truck pack expectation');
  output = replaceOnce(output, "assert.equal(monsterTruck.asset, './assets/cars/monster-truck-rgsdev.glb');", "assert.equal(monsterTruck.asset, './assets/cars/monster-truck.glb');", 'Monster Truck asset expectation');
  const anchor = "assert.match(carModels, /turnEffectiveVisualScale = effectiveVisualScale/);\n";
  const assertions = `${anchor}assert.match(carModels, /REVERSED_FRONT_WHEEL_LABEL_IDS = new Set\\(\\['vintage-racer'\\]\\)/,\n  'Vintage Racer must keep its verified authored wheel-label reversal');\nassert.match(carModels, /installFrontWheelSteeringRig\\(model, car\\)/,\n  'Every GLB visual must install the shared steering-wheel rig');\nassert.match(carModels, /root\\.userData\\.frontWheelPivots = frontWheelPivots/,\n  'The race wheel animator must receive the real GLB front-wheel pivots');\n`;
  return replaceOnce(output, anchor, assertions, 'car model source assertion anchor');
});

await edit('turn-lab/tests/semantic-car-finish-production.mjs', (source) => {
  const oldBlock = `const monster = catalog.getCarDefinition('monster-truck');\nassert.equal(monster.pack, 'rgsdev');\nassert.equal(monster.asset, './assets/cars/monster-truck-rgsdev.glb');\nassert.equal(monster.secondaryPaint?.label, 'Suspension trim');\nconst monsterGlb = await fs.readFile(new URL('../../turn/assets/cars/monster-truck-rgsdev.glb', import.meta.url));\nassert.equal(sha256(monsterGlb), '7119741b9647855ffd050ddbc1618dca2868574271beffdf9c79e4846919c7a3');\nconst monsterJson = readGlbJson(monsterGlb, monster.id);\nassert.deepEqual(\n  (monsterJson.materials || []).map((material) => material.name),\n  ['body light blue', 'body black', 'windows', 'rear lights', 'body grey', 'headlights', 'tires', 'wheels'],\n  'The standalone Monster Truck must preserve the source semantic material split'\n);\nassert.equal((monsterJson.images || []).length, 0, 'The Monster Truck must have no missing runtime texture dependency');\nconst monsterPrimitives = (monsterJson.meshes || []).flatMap((mesh) => mesh.primitives || []);\nassert.equal(monsterPrimitives.length, 8);\nassert.ok(monsterPrimitives.every((primitive) => Number.isInteger(primitive.attributes?.NORMAL)),\n  'Every Monster Truck surface must retain explicit flat normals');\nassert.equal(\n  monsterPrimitives.reduce((count, primitive) => count + monsterJson.accessors[primitive.attributes.POSITION].count / 3, 0),\n  3588,\n  'The selected RGSDev mesh must retain its verified source triangle count'\n);\nassert.match(semanticSource, /RGSDEV_PRIMARY_MATERIALS = new Set\\(\\['body light blue', 'wheels'\\]\\)/);\nassert.match(semanticSource, /RGSDEV_SECONDARY_MATERIALS = new Set\\(\\['body grey'\\]\\)/);\n`;

  const newBlock = `const monster = catalog.getCarDefinition('monster-truck');\nassert.equal(monster.pack, 'toy');\nassert.equal(monster.asset, './assets/cars/monster-truck.glb');\nassert.equal(monster.secondaryPaint?.label, 'Suspension trim');\nconst monsterGlb = await fs.readFile(new URL('../../turn/assets/cars/monster-truck.glb', import.meta.url));\nconst monsterNative = readGlb(monsterGlb, monster.id);\nconst monsterJson = monsterNative.json;\nassert.deepEqual(\n  (monsterJson.images || []).map((image) => image.uri),\n  ['Textures/colormap.png'],\n  'Monster Truck must use the authored Kenney Toy/Prototype palette URI'\n);\nassert.deepEqual(\n  (monsterJson.nodes || []).map((node) => node.name).filter(Boolean),\n  ['wheel-bl', 'wheel-fr', 'wheel-fl', 'wheel-br', 'body'],\n  'Monster Truck must preserve four independently addressable authored wheel nodes'\n);\nconst monsterCells = triangleCellCounts(monsterNative, { flipV: false });\nconst monsterBody = mergeNodeCells(monsterCells, (name) => !/wheel/i.test(name));\nconst monsterWheels = mergeNodeCells(monsterCells, (name) => /wheel/i.test(name));\nassert.ok(cellHits(monsterBody, [[7, 4], [7, 5]]) > 0,\n  'Monster Truck primary body paint must intersect authored body triangles');\nassert.ok(cellHits(monsterBody, [[1, 6], [1, 7]]) > 0,\n  'Monster Truck secondary trim must intersect authored body triangles');\nassert.ok(cellHits(monsterWheels, [[4, 7]]) > 0,\n  'Monster Truck rim paint must intersect authored wheel triangles');\nassert.match(semanticSource, /'monster-truck': profile\\(\\{[\\s\\S]*primary: \\[\\[7, 4\\], \\[7, 5\\]\\][\\s\\S]*secondary: \\[\\[1, 6\\], \\[1, 7\\]\\][\\s\\S]*rims: \\[\\[4, 7\\]\\]/,\n  'Monster Truck semantic paint profile must follow its verified native palette cells');\n`;
  return replaceOnce(source, oldBlock, newBlock, 'RGSDev Monster Truck semantic regression block');
});

console.log('Applied steering-wheel + Kenney Monster Truck implementation patches.');
