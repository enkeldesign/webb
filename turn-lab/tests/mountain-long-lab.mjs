import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  MOUNTAIN_BRIDGE_CENTERS as LAB_BRIDGE_CENTERS,
  MOUNTAIN_CONTROL_POINTS as LAB_CONTROL_POINTS,
  MOUNTAIN_LAYOUT_RULES as LAB_LAYOUT_RULES,
  MOUNTAIN_TUNNEL_SPECS as LAB_TUNNEL_SPECS
} from '../tracks/mountain-layout.js';
import {
  MOUNTAIN_BRIDGE_CENTERS as PRODUCTION_BRIDGE_CENTERS,
  MOUNTAIN_CONTROL_POINTS as PRODUCTION_CONTROL_POINTS,
  MOUNTAIN_LAYOUT_RULES as PRODUCTION_LAYOUT_RULES,
  MOUNTAIN_TUNNEL_SPECS as PRODUCTION_TUNNEL_SPECS
} from '../../turn/tracks/mountain-layout.js';
import { MOUNTAIN_CONTROL_POINTS as SHORT_BASELINE_CONTROL_POINTS } from '../../turn/tracks/mountain-layout-base.js';
import { TRACK_DEFINITIONS as PRODUCTION_TRACK_DEFINITIONS } from '../../turn/tracks/definitions.js';
import { MOUNTAIN_LONG_CHECKPOINTS } from '../../turn/race/lap-system-r86.js';
import { MOUNTAIN_LAB_CHECKPOINTS } from '../race/mountain-lap-system.js';
import { getTrackPaceNotes as getProductionPaceNotes } from '../../turn/tracks/pace-notes.js';
import { getTrackPaceNotes as getLabPaceNotes } from '../tracks/pace-notes.js';

const REPO_ROOT = new URL('../../', import.meta.url);
const [
  labIndex,
  productionIndex,
  labBootstrap,
  labDefinitions,
  labCollision,
  productionCollision,
  labBridgeGuide,
  productionBridgeGuide,
  labExtension,
  productionExtension,
  labWorld,
  productionWorld,
  visualWorkflow
] = await Promise.all([
  readText('turn-lab/index.html'),
  readText('turn/index.html'),
  readText('turn-lab/lab-bootstrap.js'),
  readText('turn-lab/tracks/definitions.js'),
  readText('turn-lab/race/world-collision.js'),
  readText('turn/race/world-collision.js'),
  readText('turn-lab/race/mountain-bridge-guide.js'),
  readText('turn/race/mountain-bridge-guide.js'),
  readText('turn-lab/tracks/mountain-long-extension-r1.js'),
  readText('turn/tracks/mountain-long-extension-r1.js'),
  readText('turn-lab/tracks/mountain-world-lab-r1.js'),
  readText('turn/tracks/mountain-world-long.js'),
  readText('.github/workflows/turn-lab-mountain-long-visual.yml')
]);

// TURN LAB remains a production-runtime shell with an isolated identity. Its first
// import map must still be production-identical; only its second scoped map may differ.
const labImportMaps = parseImportMaps(labIndex);
const productionImportMaps = parseImportMaps(productionIndex);
assert.equal(labImportMaps.length, 2);
assert.equal(productionImportMaps.length, 1);
assert.deepEqual(labImportMaps[0], productionImportMaps[0],
  'TURN LAB must continue to boot the exact production runtime map');
assert.deepEqual(
  stylesheetUrls(labIndex),
  stylesheetUrls(productionIndex),
  'TURN LAB must continue to inherit the production stylesheet set unchanged'
);
assert.deepEqual(
  scriptUrls(labIndex).filter((url) => url !== '/turn-lab/lab-bootstrap.js'),
  scriptUrls(productionIndex).filter((url) => !url.startsWith('./install-gate.js?')),
  'TURN LAB must continue to inherit production runtime entry modules unchanged'
);
assert.match(labIndex, /<base href="\/turn\/">/);
assert.doesNotMatch(labIndex, /portrait-play|portrait-centered-pad|roadtrip-world|build-a-car/i);
assert.match(labBootstrap, /LOCAL_PREFIX = 'turn-lab:'/);
assert.match(labBootstrap, /SESSION_PREFIX = 'turn-lab-session:'/);
assert.match(labBootstrap, /dataset\.turnLab = 'mountain-long-course'/);

// After promotion, LAB and production intentionally share the same long MOUNTAIN
// geometry. Compare both to the retained short-course rollback baseline instead of
// incorrectly expecting LAB to remain longer than production.
assert.deepEqual(LAB_CONTROL_POINTS, PRODUCTION_CONTROL_POINTS,
  'TURN LAB and production must now use the same tested long MOUNTAIN route');
assert.deepEqual(LAB_BRIDGE_CENTERS, PRODUCTION_BRIDGE_CENTERS);
assert.deepEqual(LAB_TUNNEL_SPECS, PRODUCTION_TUNNEL_SPECS);
assert.deepEqual(LAB_LAYOUT_RULES.routeNarrative, PRODUCTION_LAYOUT_RULES.routeNarrative);
assert.equal(PRODUCTION_CONTROL_POINTS.length, 72);
assert.equal(PRODUCTION_LAYOUT_RULES.noDropCourse, true);
assert.equal(findProperIntersections(PRODUCTION_CONTROL_POINTS).length, 0);
const longLength = closedLength(PRODUCTION_CONTROL_POINTS);
const shortLength = closedLength(SHORT_BASELINE_CONTROL_POINTS);
const ratio = longLength / shortLength;
assert.ok(ratio >= 2.0 && ratio <= 2.25,
  `Promoted MOUNTAIN should remain ~2.1x the retired short course, got ${ratio.toFixed(3)}x`);

const productionMountain = PRODUCTION_TRACK_DEFINITIONS.find((track) => track.id === 'mountain');
assert.equal(productionMountain?.storageRevision, 'mountain-r3-start-seam');
assert.equal(productionMountain?.sampleCount, 2160);
assert.equal(productionMountain?.freeRoamDistance, 18.2);
assert.equal(productionMountain?.collisionProfile?.colliders?.length, 0);
assert.equal(productionMountain?.collisionProfile?.bridgeGuide?.sampleCount, 2160);
assert.deepEqual(
  productionMountain?.collisionProfile?.bridgeGuide?.positiveNormalRange,
  { startIndex: 1005, endIndex: 1095, featherSamples: 4 }
);
assert.deepEqual(
  productionMountain?.collisionProfile?.bridgeGuide?.negativeNormalRange,
  { startIndex: 994, endIndex: 1095, featherSamples: 4 }
);
assert.match(labDefinitions, /storageRevision: 'mountain-lab-long-r2'/,
  'LAB keeps an isolated fresh rival namespace for the smoothed shared geometry');
assert.match(labDefinitions, /startIndex: 1005[\s\S]*endIndex: 1095/,
  'LAB positive-side guide must follow the same re-sampled physical rail span');
assert.match(labDefinitions, /startIndex: 994[\s\S]*endIndex: 1095/,
  'LAB negative-side guide must follow the same re-sampled physical rail span');

// The tested MOUNTAIN content promoted to production must remain byte-identical to
// the LAB source where possible, preventing accidental divergence during promotion.
assert.equal(productionExtension, labExtension,
  'Production long-course extension must be the exact tested LAB implementation');
assert.equal(productionBridgeGuide, labBridgeGuide,
  'Production bridge guide must be the exact tested LAB implementation');
assert.deepEqual(getProductionPaceNotes('mountain'), getLabPaceNotes('mountain'));
assert.deepEqual(MOUNTAIN_LONG_CHECKPOINTS, MOUNTAIN_LAB_CHECKPOINTS);
assert.equal(MOUNTAIN_LONG_CHECKPOINTS.length, 24);

// Production now owns the bridge guide. LAB must detect that result and return it
// directly rather than applying its historical adapter a second time.
assert.match(productionCollision, /trackId !== 'mountain'/,
  'Production collision must keep an exact non-MOUNTAIN fast path');
assert.match(productionCollision, /mountain-bridge-guide\.js/);
assert.match(labCollision, /promotedCollision\?\.bridgeGuide === true/,
  'LAB must not double-apply the promoted production bridge guide');
assert.match(labCollision, /Compatibility fallback/,
  'LAB should retain compatibility with pre-promotion production revisions');

// Both wrappers still build the mature r177 production mountain world first, then
// apply the same long-course extension. LAB only adds its isolated diagnostics/name.
assert.match(productionWorld, /mountain-world-r3\.js\?revision=r177-ipad-sky-aspect/);
assert.match(productionWorld, /installMountainLongExtension/);
assert.match(productionWorld, /BASE_WORLD_SAMPLE_COUNT = 1080/);
assert.match(labWorld, /mountain-world-r3\.js\?lab-base=mountain-long/);
assert.match(labWorld, /installMountainLongExtension/);
assert.match(labWorld, /PRODUCTION_WORLD_SAMPLE_COUNT = 1080/);

assert.match(visualWorkflow, /node turn-lab\/tests\/mountain-long-lab\.mjs/);
assert.match(visualWorkflow, /mountain-long-visual-smoke\.mjs/);

console.log(`TURN LAB post-promotion parity passed: production/LAB long MOUNTAIN ${ratio.toFixed(3)}x retired short course, 2160 samples, 24 checkpoints.`);

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

function stylesheetUrls(html) {
  return [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((match) => match[1]);
}

function scriptUrls(html) {
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)].map((match) => match[1]);
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
