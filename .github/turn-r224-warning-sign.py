from pathlib import Path
import json


def replace(path, old, new, count=1):
    p = Path(path)
    source = p.read_text()
    if old not in source:
        raise SystemExit(f'Expected anchor not found in {path}: {old[:160]!r}')
    p.write_text(source.replace(old, new, count))


# 1. Authored MOUNTAIN warning sign at the summit-to-slalom plunge landmark.
r3_path = Path('turn/tracks/mountain-world-r3.js')
r3 = r3_path.read_text()
anchor = "const FINAL_VILLAGE_OPTIONS = Object.freeze({ skipRetiredHolidayCabins: true });\n"
sign_code = r'''const FINAL_VILLAGE_OPTIONS = Object.freeze({ skipRetiredHolidayCabins: true });
const MOUNTAIN_SLALOM_WARNING_TARGET = Object.freeze({ x: 66, z: 62 });
const MOUNTAIN_WARNING_YELLOW = 0xffc400;
const MOUNTAIN_WARNING_INK = 0x08090a;
const MOUNTAIN_WARNING_POST = 0x34383d;

function warningTriangleShape(scale = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.72 * scale);
  shape.lineTo(1.82 * scale, -1.38 * scale);
  shape.lineTo(-1.82 * scale, -1.38 * scale);
  shape.closePath();
  return shape;
}

function makeDownhillSlalomWarningSign() {
  const root = new THREE.Group();
  root.name = 'Mountain downhill slalom warning sign';
  root.userData.turnGameplayLandmark = true;
  root.userData.turnCollision = false;

  const yellow = new THREE.MeshBasicMaterial({ color: MOUNTAIN_WARNING_YELLOW, side: THREE.DoubleSide });
  const ink = new THREE.MeshBasicMaterial({ color: MOUNTAIN_WARNING_INK, side: THREE.DoubleSide });
  const postMaterial = new THREE.MeshStandardMaterial({ color: MOUNTAIN_WARNING_POST, roughness: 0.82, metalness: 0.18 });
  const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xeaf1f4, roughness: 1, metalness: 0 });

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.38, 4.2, 0.38), postMaterial);
  post.position.set(0, 2.1, -0.05);
  post.name = 'Mountain warning sign dark post';
  root.add(post);

  const snowFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.02, 0.30, 8), snowMaterial);
  snowFoot.position.y = 0.15;
  snowFoot.name = 'Mountain warning sign snow foot';
  root.add(snowFoot);

  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(warningTriangleShape(1), {
      depth: 0.18,
      bevelEnabled: false,
      curveSegments: 1
    }),
    yellow
  );
  plate.position.set(0, 4.58, -0.09);
  plate.name = 'Mountain warning sign yellow plate';
  root.add(plate);

  const border = new THREE.Mesh(new THREE.ShapeGeometry(warningTriangleShape(0.86)), ink);
  border.position.set(0, 4.58, 0.101);
  border.name = 'Mountain warning sign black border';
  root.add(border);

  const face = new THREE.Mesh(new THREE.ShapeGeometry(warningTriangleShape(0.70)), yellow);
  face.position.set(0, 4.58, 0.108);
  face.name = 'Mountain warning sign yellow face';
  root.add(face);

  const exclamationBar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.42, 0.08), ink);
  exclamationBar.position.set(0, 4.78, 0.16);
  exclamationBar.rotation.z = -0.03;
  exclamationBar.name = 'Mountain warning sign exclamation bar';
  root.add(exclamationBar);

  const exclamationDot = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 7), ink);
  exclamationDot.position.set(0, 3.82, 0.16);
  exclamationDot.name = 'Mountain warning sign exclamation dot';
  root.add(exclamationDot);

  root.traverse((object) => {
    if (!object?.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    // This prop carries its own graphic border. Do not let a later art pass
    // add a second TURN contour around it.
    object.userData.turnOutlined = true;
  });
  return root;
}

function nearestMountainSampleIndex(samples, target) {
  let nearestIndex = 0;
  let nearestDistanceSq = Infinity;
  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index].point;
    const dx = point.x - target.x;
    const dz = point.z - target.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= nearestDistanceSq) continue;
    nearestDistanceSq = distanceSq;
    nearestIndex = index;
  }
  return nearestIndex;
}

function installDownhillSlalomWarningSign(world, samples, trackWidth, terrainHeightAt) {
  const sampleIndex = nearestMountainSampleIndex(samples, MOUNTAIN_SLALOM_WARNING_TARGET);
  const sample = samples[sampleIndex];
  const roadOffset = trackWidth / 2 + 6.8;
  const positive = sample.point.clone().addScaledVector(sample.normal, roadOffset);
  const negative = sample.point.clone().addScaledVector(sample.normal, -roadOffset);
  // The old tree landmark sat on the north/outside shoulder in the player's
  // sightline before the plunge. Choosing the higher-z candidate preserves
  // that landmark even if the sampled normal flips direction.
  const point = positive.z >= negative.z ? positive : negative;
  point.y = terrainHeightAt(point.x, point.z) + 0.02;

  const sign = makeDownhillSlalomWarningSign();
  sign.position.copy(point);
  sign.rotation.y = Math.atan2(-sample.tangent.x, -sample.tangent.z);
  world.add(sign);

  world.userData.turnMountainSlalomWarningSign = Object.freeze({
    sampleIndex,
    targetX: MOUNTAIN_SLALOM_WARNING_TARGET.x,
    targetZ: MOUNTAIN_SLALOM_WARNING_TARGET.z,
    x: point.x,
    y: point.y,
    z: point.z,
    roadOffset,
    side: 'north-outside',
    facesApproach: true,
    collidable: false
  });
  return sign;
}
'''
if anchor not in r3:
    raise SystemExit('MOUNTAIN r3 options anchor not found')
r3 = r3.replace(anchor, sign_code, 1)
r3 = r3.replace(
    "  const terrainContext = installMountainTerrain(world, samples, trackWidth);\n  installMountainR3Polish(world, samples, trackWidth);",
    "  const terrainContext = installMountainTerrain(world, samples, trackWidth);\n  installMountainR3Polish(world, samples, trackWidth);\n  installDownhillSlalomWarningSign(world, samples, trackWidth, terrainContext.terrainHeightAt);",
    1
)
r3 = r3.replace(
    "    routeClearanceProtected: true,\n",
    "    routeClearanceProtected: true,\n    downhillSlalomLandmark: 'authored-yellow-warning-sign-on-north-outside-shoulder',\n",
    1
)
r3_path.write_text(r3)

# 2. Give the changed MOUNTAIN world a release-bound identity through the existing wrapper chain.
replace(
    'turn/tracks/registry.js',
    "      './mountain-world-long.js?revision=mountain-long-r1'",
    "      './mountain-world-long.js?build=20260913-r224'"
)
replace(
    'turn/tracks/mountain-world-long.js',
    "import { installMountainWorld as installBaseMountainWorld } from './mountain-world-r3.js?revision=r177-ipad-sky-aspect&base=mountain-long-r1';",
    "import { installMountainWorld as installBaseMountainWorld } from './mountain-world-r3.js?build=20260913-r224';"
)

# 3. Teach the release generator to advance those existing build identities in future releases.
release_path = Path('turn/scripts/release.mjs')
release = release_path.read_text()
old_companion = "  'turn/tracks/registry.js',\n  'turn/tracks/midnight-city-world-r2.js',"
new_companion = "  'turn/tracks/registry.js',\n  'turn/tracks/mountain-world-long.js',\n  'turn/tracks/midnight-city-world-r2.js',"
if old_companion not in release:
    raise SystemExit('release companion list anchor not found')
release = release.replace(old_companion, new_companion, 1)
old_registry = r'''  if (repositoryPath === 'turn/tracks/registry.js') {
    return source.replace(
      /(await import\(\s*'\.\/midnight-city-world-r11\.js\?build=)[^']+('\s*\))/,
      `$1${release.cacheKey}$2`
    );
  }
'''
new_registry = r'''  if (repositoryPath === 'turn/tracks/registry.js') {
    return source
      .replace(
        /(await import\(\s*'\.\/midnight-city-world-r11\.js\?build=)[^']+('\s*\))/,
        `$1${release.cacheKey}$2`
      )
      .replace(
        /(await import\(\s*'\.\/mountain-world-long\.js\?build=)[^']+('\s*\))/,
        `$1${release.cacheKey}$2`
      );
  }
  if (repositoryPath === 'turn/tracks/mountain-world-long.js') {
    return source.replace(
      /(from '\.\/mountain-world-r3\.js\?build=)[^']+(')/,
      `$1${release.cacheKey}$2`
    );
  }
'''
if old_registry not in release:
    raise SystemExit('release registry renderer anchor not found')
release_path.write_text(release.replace(old_registry, new_registry, 1))

# 4. Focused regression: landmark geometry, placement contract and release-bound wrapper identity.
test_path = Path('turn-tests/mountain-track-production.mjs')
test = test_path.read_text()
test = test.replace(
    "assert.match(registry, /mountain-world-long\\.js\\?revision=mountain-long-r1/);",
    "assert.match(registry, /mountain-world-long\\.js\\?build=20260913-r224/);"
)
test = test.replace(
    "assert.match(longWorld, /installBaseMountainWorld/);\n",
    "assert.match(longWorld, /mountain-world-r3\\.js\\?build=20260913-r224/);\nassert.match(longWorld, /installBaseMountainWorld/);\n",
    1
)
landmark_assertions = r'''
assert.match(baseWorld, /MOUNTAIN_SLALOM_WARNING_TARGET = Object\.freeze\(\{ x: 66, z: 62 \}\)/,
  'MOUNTAIN warning sign must stay anchored to the summit-to-slalom landmark');
assert.match(baseWorld, /Mountain downhill slalom warning sign/);
assert.match(baseWorld, /new THREE\.ExtrudeGeometry\(warningTriangleShape\(1\)/,
  'The warning plate must be authored geometry, not a downloaded scenery dependency');
assert.match(baseWorld, /Mountain warning sign black border/);
assert.match(baseWorld, /Mountain warning sign exclamation bar/);
assert.match(baseWorld, /side: 'north-outside'/,
  'The warning sign must remain on the old tree sightline side of the road');
assert.match(baseWorld, /collidable: false/,
  'The warning landmark must remain visual only and must not become collision bait');
assert.match(baseWorld, /object\.userData\.turnOutlined = true/,
  'The authored sign border must not receive a second automatic TURN contour');
'''
anchor_test = "assert.doesNotMatch(baseWorld, /setAnimationLoop|requestAnimationFrame|setInterval/);\n"
if anchor_test not in test:
    raise SystemExit('mountain test insertion anchor not found')
test = test.replace(anchor_test, anchor_test + landmark_assertions, 1)
test_path.write_text(test)

# 5. Patch release metadata and release-facing history.
Path('turn/release.json').write_text(json.dumps({
    'version': '1.19.10',
    'id': '2026.09.13-r224',
    'cacheKey': '20260913-r224'
}, indent=2) + '\n')

history_path = Path('turn/content/about-history-current.js')
history = history_path.read_text()
release_history = r'''
const MOUNTAIN_WARNING_HISTORY = Object.freeze({
  period: '13 September',
  title: 'A warning before the MOUNTAIN plunge',
  paragraphs: Object.freeze([
    'TURN 1.19.10 restores a strong visual timing landmark before MOUNTAIN’s technical downhill slalom. A large yellow triangular warning sign now stands on the north/outside shoulder where the earlier tree used to help drivers judge the plunge.',
    'The sign is authored from lightweight TURN geometry with its own black border and exclamation mark, faces the approaching driver, has no collision role and does not require another downloaded scenery asset.'
  ]),
  milestones: Object.freeze([
    'Readable warning landmark before the downhill slalom',
    'Authored low-poly sign with no extra asset download or collision',
    'TURN 1.19.10 · 2026.09.13-r224'
  ])
});

'''
anchor_history = "const previousLatest = BASE_CHANGELOG.at(-1);\n"
if anchor_history not in history:
    raise SystemExit('history insertion anchor not found')
history = history.replace(anchor_history, release_history + anchor_history, 1)
history = history.replace(
    "  LOW_GRAPHICS_RENDER_ONLY_HISTORY\n]);",
    "  LOW_GRAPHICS_RENDER_ONLY_HISTORY,\n  MOUNTAIN_WARNING_HISTORY\n]);",
    1
)
history = history.replace(
    "      Object.freeze(['No post-hoc contour removal', 'Contour producers now skip their outline meshes before allocation; the shared Three runtime no longer traverses the scene to hide them.'])",
    "      Object.freeze(['No post-hoc contour removal', 'Contour producers now skip their outline meshes before allocation; the shared Three runtime no longer traverses the scene to hide them.']),\n      Object.freeze(['1.19.10 r224', 'Adds a large yellow warning sign before MOUNTAIN’s downhill slalom, restoring the visual timing landmark that the old tree provided.']),\n      Object.freeze(['Slalom landmark', 'The sign is lightweight authored geometry, faces the approach and remains visual-only with no collision or extra asset download.'])",
    1
)
history = history.replace("  version: '1.19.9',", "  version: '1.19.10',", 1)
history = history.replace("  build: '2026.09.13-r223',", "  build: '2026.09.13-r224',", 1)
history = history.replace(
    "  note: 'TURN 1.19.9 makes LOW GRAPHICS a rendering-only performance profile.'",
    "  note: 'TURN 1.19.10 adds a warning landmark before MOUNTAIN’s downhill slalom.'",
    1
)
history_path.write_text(history)
