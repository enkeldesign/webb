import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  MOUNTAIN_CONTROL_POINTS as DEAD_CANYON_CONTROL_POINTS,
  DEAD_CANYON_LAYOUT_RULES
} from '../tracks/mountain-layout.js';
import {
  MOUNTAIN_CONTROL_POINTS as PRODUCTION_MOUNTAIN_CONTROL_POINTS
} from '../../turn/tracks/mountain-layout.js';

const REPO_ROOT = new URL('../../', import.meta.url);
const RETRO_ASSETS = Object.freeze([
  'wall-a-garage.obj',
  'wall-broken-type-a.obj',
  'scaffolding-structure.obj',
  'truck-green-cargo.obj',
  'detail-barrier-strong-damaged.obj',
  'tree-park-large.obj',
  'roof-metal-poles.obj',
  'roof-metal-type-a.obj'
]);

const [
  labIndex,
  productionIndex,
  labBootstrap,
  labDefinitions,
  labRegistry,
  labWorld,
  labPaceNotes,
  labIntroCamera,
  labManifest,
  retroLicense,
  ...retroAssetSources
] = await Promise.all([
  readText('turn-lab/index.html'),
  readText('turn/index.html'),
  readText('turn-lab/lab-bootstrap.js'),
  readText('turn-lab/tracks/definitions.js'),
  readText('turn-lab/tracks/registry.js'),
  readText('turn-lab/tracks/dead-canyon-world.js'),
  readText('turn-lab/tracks/pace-notes.js'),
  readText('turn-lab/render/track-intro-camera.js'),
  readText('turn-lab/site.webmanifest'),
  readText('turn-lab/assets/kenney/retro-urban/LICENSE.txt'),
  ...RETRO_ASSETS.map((name) => readText(`turn-lab/assets/kenney/retro-urban/${name}`))
]);

const labImportMaps = parseImportMaps(labIndex);
const productionImportMaps = parseImportMaps(productionIndex);
assert.equal(labImportMaps.length, 2);
assert.equal(productionImportMaps.length, 1);
assert.deepEqual(
  labImportMaps[0],
  productionImportMaps[0],
  'TURN LAB must boot the exact production runtime map before applying LAB-only overrides'
);

const labScope = labImportMaps[1]?.scopes?.['/turn/'] || {};
assert.equal(labScope['./tracks/definitions.js'], '/turn-lab/tracks/definitions.js');
assert.equal(labScope['./tracks/mountain-layout.js'], '/turn-lab/tracks/mountain-layout.js');
assert.equal(labScope['./tracks/pace-notes.js'], '/turn-lab/tracks/pace-notes.js');
assert.equal(labScope['./tracks/registry.js'], '/turn-lab/tracks/registry.js');
assert.equal(
  labScope['/turn/race/lap-system.js?build=20260720-r19'],
  '/turn-lab/race/mountain-lap-system.js'
);
assert.equal(
  labScope['/turn/render/track-intro-camera.js?revision=r133-midnight-downtown&build=20260922-r285'],
  '/turn-lab/render/track-intro-camera.js'
);
assert.equal(
  Object.keys(labScope).some((specifier) => specifier.includes('world-collision')),
  false,
  'DEAD CANYON must use production world collision without a LAB-specific collision adapter'
);

assert.equal(DEAD_CANYON_CONTROL_POINTS.length, 73);
assert.notDeepEqual(
  DEAD_CANYON_CONTROL_POINTS,
  PRODUCTION_MOUNTAIN_CONTROL_POINTS,
  'DEAD CANYON must remain isolated from production MOUNTAIN geometry'
);
assert.equal(findProperIntersections(DEAD_CANYON_CONTROL_POINTS).length, 0);
const routeLength = closedLength(DEAD_CANYON_CONTROL_POINTS);
assert.ok(routeLength > 3180 && routeLength < 3270,
  `Expected a ~3.23 km course, got ${routeLength.toFixed(1)} m`);
assert.equal(DEAD_CANYON_LAYOUT_RULES.sampleCount, 2160);
assert.equal(DEAD_CANYON_LAYOUT_RULES.easternEscarpment, true);
assert.equal(DEAD_CANYON_LAYOUT_RULES.airportDerivedHairpin, false);
assert.equal(DEAD_CANYON_LAYOUT_RULES.chicane, true);
assert.equal(DEAD_CANYON_LAYOUT_RULES.routeNarrative.length, 10);
assert.equal(DEAD_CANYON_CONTROL_POINTS.some(([x, , z]) => x === 280.8 && z === 212.4), false,
  'The AIRPORT-derived hairpin apex must be removed');
assert.ok(DEAD_CANYON_CONTROL_POINTS.some(([x, , z]) => x === 198 && z === -394),
  'The southern route must retain the chicane direction change');

assert.match(labDefinitions, /name: 'Dead Canyon'/);
assert.match(labDefinitions, /Dark tunnel/);
assert.match(labDefinitions, /difficulty: 'ADVANCED'/);
assert.match(labDefinitions, /storageRevision: 'dead-canyon-lab-r4'/);
assert.match(labDefinitions, /sampleCount: 2160/);
assert.match(labDefinitions, /sky: 0xe4ad8b/);
assert.match(labDefinitions, /fog: 0xe4ad8b/);
assert.match(labDefinitions, /fogNear: 260/);
assert.match(labDefinitions, /fogFar: 760/);
assert.doesNotMatch(labDefinitions, /bridgeGuide/);

assert.match(labRegistry, /installDeadCanyonWorld/);
assert.match(labRegistry, /\/turn-lab\/tracks\/dead-canyon-world\.js/);
assert.match(labRegistry, /entry\.id !== 'mountain'/);

assert.match(labWorld, /world\.userData\.turnDeadCanyon/);
assert.match(labWorld, /version: 'dead-canyon-r6'/);
assert.match(labWorld, /const TUNNEL = Object\.freeze/);
assert.match(labWorld, /route: 'RIGHT > LEFT > OUT'/);
assert.match(labWorld, /start: 0\.018/);
assert.match(labWorld, /darkStart: 0\.040/);
assert.match(labWorld, /bulb: 0\.073/);
assert.match(labWorld, /darkEnd: 0\.098/);
assert.match(labWorld, /end: 0\.122/);
assert.match(labWorld, /makeDarkTunnel/);
assert.match(labWorld, /makeDyingTunnelBulb/);
assert.match(labWorld, /installTunnelDarknessController/);
assert.match(labWorld, /tunnelGuiUnaffected: true/);
assert.match(labWorld, /tunnelDynamicLights: 0/);
assert.match(labWorld, /Dead Canyon tunnel walls/);
assert.match(labWorld, /Dead Canyon tunnel ceiling/);
assert.match(labWorld, /makeTunnelPortal\(group, samples\[startIndex\], trackWidth, 'entrance'/);
assert.match(labWorld, /makeTunnelPortal\(group, samples\[endIndex\], trackWidth, 'exit'/);
assert.match(labWorld, /'Dead Canyon tunnel ' \+ name \+ ' portal'/);
assert.match(labWorld, /Dead Canyon dying tunnel bulb/);
assert.doesNotMatch(labWorld, /new THREE\.PointLight/);
assert.match(labWorld, /roadMaterial\.opacity = THREE\.MathUtils\.lerp\(1, 0\.008, darkness\)/);
assert.match(labWorld, /easternEscarpmentHeight: 220/);
assert.match(labWorld, /cliffBands: 4/);
assert.match(labWorld, /cliffSegmentsPerBand: 16/);
assert.match(labWorld, /cliffFrontX: 715/);
assert.match(labWorld, /cliffDepth: 2800/);
assert.match(labWorld, /fogFadeNear: 260/);
assert.match(labWorld, /fogFadeFar: 760/);
assert.match(labWorld, /distantMesaCount: 12/);
assert.match(labWorld, /hairpinLandmark: false/);
assert.match(labWorld, /makeFacetedCliffBand/);
assert.match(labWorld, /makeCanyonEdgeBarriers/);
assert.doesNotMatch(labWorld, /makeHairpinLandmark/);
assert.match(labWorld, /makeRoadsideChevrons/);
assert.match(labWorld, /makeTerrainSkirts/);
assert.match(labWorld, /makeCanyonOverhangs/);
assert.match(labWorld, /makeDeadCanyonLandmark/);
assert.match(labWorld, /landmark: 'DEAD CANYON CROWN'/);
assert.match(labWorld, /tableMesaCount: 1/);
assert.match(labWorld, /yellowTreeCount: 6/);
assert.match(labWorld, /openShedCount: 1/);
assert.match(labWorld, /rustTruckCount: 1/);
assert.match(labWorld, /ruinClusterCount: 1/);
assert.doesNotMatch(labWorld, /new THREE\.BoxGeometry\(5, 170, 210\)/,
  'The artificial dark backing block behind DEAD CANYON CROWN must stay removed');
assert.match(labWorld, /tree-park-large\.obj/);
assert.match(labWorld, /treeA\.png/);
assert.match(labWorld, /TextureLoader/);
assert.match(labWorld, /SRGBColorSpace/);
assert.match(labWorld, /alphaTest: 0\.12/);
assert.match(labWorld, /roof-metal-poles\.obj/);
assert.match(labWorld, /roof-metal-type-a\.obj/);
assert.match(labWorld, /placeVisibleRetroLandmarks/);
assert.match(labWorld, /placeRustTruck/);
assert.match(labWorld, /placeOpenShed/);
assert.match(labWorld, /placeRuinCluster/);
assert.match(labWorld, /standingRockCount: 1/);
assert.match(labWorld, /needleCount: 0/);
assert.doesNotMatch(labWorld, /makeNeedleCountry/);
assert.match(labWorld, /geologyArchetypes: 4/);
assert.match(labWorld, /solarPanels: 24/);
assert.match(labWorld, /OBJLoader/);
assert.match(labWorld, /Kenney Retro Urban/);
assert.match(labWorld, /dynamicLights: 0/);
assert.match(labWorld, /const tunnelHalf = trackWidth \/ 2 \+ 11\.5/);
assert.match(labWorld, /const half = trackWidth \/ 2 \+ 14/);
assert.match(labWorld, /const outpost = frameAt\(samples, 0\.145\)/);
assert.match(labWorld, /shadowCasters: 0/);
assert.match(labWorld, /InstancedMesh/);
assert.doesNotMatch(labWorld, /GLTFLoader/);

assert.match(retroLicense, /Creative Commons Zero \(CC0\)/);
assert.match(retroLicense, /Kenney/);
for (let index = 0; index < RETRO_ASSETS.length; index += 1) {
  assert.match(retroAssetSources[index], /Kenney Retro Urban Kit 2\.0 CC0/,
    `${RETRO_ASSETS[index]} must retain source attribution/license provenance`);
  assert.match(retroAssetSources[index], /^o /m,
    `${RETRO_ASSETS[index]} must remain valid geometry-only OBJ source`);
  assert.match(retroAssetSources[index], /^f /m,
    `${RETRO_ASSETS[index]} must contain faces`);
}

assert.equal((labPaceNotes.match(/note\('dead-canyon-/g) || []).length, 12);
assert.match(labPaceNotes, /dead-canyon-chicane/);
assert.doesNotMatch(labPaceNotes, /dead-canyon-hairpin/);
assert.match(labPaceNotes, /dead-canyon-north-sweep/);
assert.match(labBootstrap, /dataset\.turnLab = 'dead-canyon'/);
assert.match(labBootstrap, /dataset\.turnLabExperimentAccess/);
assert.match(labIndex, /TURN LAB · DEAD CANYON/);
assert.match(labIndex, /Test DEAD CANYON, a long canyon-and-ruins track/);
assert.match(labManifest, /DEAD CANYON track experiment/);
assert.match(labIntroCamera, /position: Object\.freeze\(\[80, 165, -590\]\)/);
assert.match(labIntroCamera, /target: Object\.freeze\(\[465, 35, -80\]\)/);
assert.match(labIntroCamera, /fov: 60/);
assert.match(labIntroCamera, /dead-canyon-track-intro-r5/);

const maxRouteX = Math.max(...DEAD_CANYON_CONTROL_POINTS.map(([x]) => x));
assert.ok(715 - maxRouteX > 70,
  `Nearest cliff front must stay well clear of the eastern route; clearance was ${(715 - maxRouteX).toFixed(1)} m`);

console.log(`TURN LAB DEAD CANYON r6 contract passed: ${routeLength.toFixed(1)} m, route unchanged, dark RIGHT > LEFT > OUT tunnel, GUI-safe darkness and one dying bulb.`);

async function readText(path) {
  return fs.readFile(new URL(path, REPO_ROOT), 'utf8');
}

function parseImportMaps(html) {
  const maps = [];
  const pattern = /<script type="importmap">([\s\S]*?)<\/script>/g;
  let match = null;
  while ((match = pattern.exec(html))) maps.push(JSON.parse(match[1]));
  return maps;
}

function closedLength(points) {
  let length = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    length += Math.hypot(next[0] - current[0], next[2] - current[2]);
  }
  return length;
}

function findProperIntersections(points) {
  const intersections = [];
  for (let first = 0; first < points.length; first += 1) {
    const a = points[first];
    const b = points[(first + 1) % points.length];
    for (let second = first + 2; second < points.length; second += 1) {
      if ((second + 1) % points.length === first) continue;
      const c = points[second];
      const d = points[(second + 1) % points.length];
      if (segmentsProperlyIntersect(a, b, c, d)) intersections.push([first, second]);
    }
  }
  return intersections;
}

function segmentsProperlyIntersect(a, b, c, d) {
  return orientation(a, b, c) * orientation(a, b, d) < -1e-8
    && orientation(c, d, a) * orientation(c, d, b) < -1e-8;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
}
