import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import { resolveWorldCollisionState } from '../race/world-collision.js';
import {
  MOUNTAIN_BRIDGE_CENTERS,
  MOUNTAIN_CONTROL_POINTS,
  MOUNTAIN_LAYOUT_RULES,
  MOUNTAIN_LOWER_TERRAIN_BOUNDS,
  MOUNTAIN_LOWER_VILLAGE_SITES,
  MOUNTAIN_REMOVED_EAST_PEAK,
  MOUNTAIN_TUNNEL_SPECS,
  MOUNTAIN_VIEW_SCREEN_SPECS
} from '../tracks/mountain-layout.js';
import { MOUNTAIN_CONTROL_POINTS as PRODUCTION_MOUNTAIN_CONTROL_POINTS } from '../../turn/tracks/mountain-layout.js';

const TRACK_WIDTH = 27;
const FREE_ROAM_DISTANCE = 18.2;
const ROUTE_SAMPLE_COUNT = 2160;
const REPO_ROOT = new URL('../../', import.meta.url);

const [
  labIndex,
  productionIndex,
  manifestSource,
  bootstrapSource,
  definitionsSource,
  collisionSource,
  bridgeGuideSource,
  lapSource,
  paceSource,
  worldSource,
  extensionSource,
  workflowSource
] = await Promise.all([
  readText('turn-lab/index.html'),
  readText('turn/index.html'),
  readText('turn-lab/site.webmanifest'),
  readText('turn-lab/lab-bootstrap.js'),
  readText('turn-lab/tracks/definitions.js'),
  readText('turn-lab/race/world-collision.js'),
  readText('turn-lab/race/mountain-bridge-guide.js'),
  readText('turn-lab/race/mountain-lap-system.js'),
  readText('turn-lab/tracks/pace-notes.js'),
  readText('turn-lab/tracks/mountain-world-lab-r1.js'),
  readText('turn-lab/tracks/mountain-long-extension-r1.js'),
  readText('.github/workflows/turn-lab-tests.yml')
]);

// TURN LAB must boot the exact production release surface first, then apply a
// deliberately small MOUNTAIN-only scope. This catches stale copied runtimes.
const labImportMaps = parseImportMaps(labIndex);
const productionImportMaps = parseImportMaps(productionIndex);
assert.equal(labImportMaps.length, 2, 'TURN LAB should have one production map and one LAB-only scoped map');
assert.equal(productionImportMaps.length, 1, 'Production TURN should retain one canonical import map');
assert.deepEqual(labImportMaps[0], productionImportMaps[0], 'TURN LAB first import map must be production-identical');
assert.deepEqual(labImportMaps[1], {
  scopes: {
    '/turn/': {
      './tracks/definitions.js': '/turn-lab/tracks/definitions.js',
      './tracks/mountain-layout.js': '/turn-lab/tracks/mountain-layout.js',
      './tracks/pace-notes.js': '/turn-lab/tracks/pace-notes.js',
      './tracks/mountain-world-r3.js?revision=r177-ipad-sky-aspect': '/turn-lab/tracks/mountain-world-lab-r1.js',
      '/turn/race/lap-system.js?build=20260720-r19': '/turn-lab/race/mountain-lap-system.js',
      '/turn/race/world-collision.js?build=20260723-r53': '/turn-lab/race/world-collision.js?revision=mountain-slip-bridge-r15'
    }
  }
});
assert.deepEqual(
  stylesheetUrls(labIndex),
  stylesheetUrls(productionIndex),
  'TURN LAB should inherit the current production stylesheet set unchanged'
);
assert.deepEqual(
  scriptUrls(labIndex).filter((url) => url !== '/turn-lab/lab-bootstrap.js'),
  scriptUrls(productionIndex).filter((url) => !url.startsWith('./install-gate.js?')),
  'TURN LAB should inherit the current production runtime entry modules unchanged'
);
assert.match(labIndex, /<base href="\/turn\/">/);
assert.doesNotMatch(labIndex, /portrait-play|portrait-centered-pad|roadtrip-world|build-a-car/i,
  'Retired experiments must not load in the MOUNTAIN runtime');
assert.match(bootstrapSource, /LOCAL_PREFIX = 'turn-lab:'/);
assert.match(bootstrapSource, /SESSION_PREFIX = 'turn-lab-session:'/);
assert.match(bootstrapSource, /dataset\.turnLab = 'mountain-long-course'/);
assert.match(bootstrapSource, /ACHIEVEMENT_KEY = `\$\{LOCAL_PREFIX\}turn-achievements-v1`/);
assert.match(bootstrapSource, /MOUNTAIN_REWARD_ID = 'mountain'/);
assert.match(bootstrapSource, /nativeStorage\.setItem\.call\(localStorageRef, ACHIEVEMENT_KEY/,
  'LAB MOUNTAIN access must write only through the already-prefixed isolated storage key');
assert.doesNotMatch(bootstrapSource, /localStorageRef\.setItem\(['"]turn-achievements-v1/,
  'LAB bootstrap must never write the production achievement key directly');
const manifest = JSON.parse(manifestSource);
assert.equal(manifest.orientation, 'landscape', 'The retired portrait experiment must not keep an any-orientation manifest');

// Geometry/topology: test the actual centripetal closed curve rather than only
// its control polygon, so Catmull-Rom bowing cannot hide an intersection.
assert.equal(MOUNTAIN_CONTROL_POINTS.length, 72);
assert.equal(MOUNTAIN_LAYOUT_RULES.noDropCourse, true);
assert.deepEqual(MOUNTAIN_LAYOUT_RULES.routeNarrative, [
  'village',
  'forest-climb',
  'backside',
  'snow-summit',
  'river',
  'slalom-descent',
  'waterfall',
  'lake-bridge',
  'east-valley-descent',
  'lower-run',
  'lower-village-tunnel',
  'lower-village',
  'forest-return',
  'final-climb',
  'village-return'
]);
assert.ok(
  MOUNTAIN_LAYOUT_RULES.bridgeStartControlPoint
    < MOUNTAIN_LAYOUT_RULES.lowerVillageControlPoint
    && MOUNTAIN_LAYOUT_RULES.lowerVillageControlPoint
      < MOUNTAIN_LAYOUT_RULES.forestReturnControlPoint
    && MOUNTAIN_LAYOUT_RULES.forestReturnControlPoint
      < MOUNTAIN_LAYOUT_RULES.finalClimbControlPoint,
  'Bridge, lower village, forest return and climb must be distinct ordered sections'
);

const route = sampleClosedCentripetal(MOUNTAIN_CONTROL_POINTS, ROUTE_SAMPLE_COUNT);
const productionRoute = sampleClosedCentripetal(PRODUCTION_MOUNTAIN_CONTROL_POINTS, ROUTE_SAMPLE_COUNT);
const routeLength = closedLength(route);
const productionLength = closedLength(productionRoute);
const lengthRatio = routeLength / productionLength;
assert.ok(lengthRatio >= 2.0 && lengthRatio <= 2.25,
  `Expected a substantially longer ~2.1x lap, got ${lengthRatio.toFixed(3)}x`);
assert.equal(findProperIntersections(route).length, 0, 'The sampled long route must not self-intersect');
const separation = minimumNonLocalDistance(route, 130);
assert.ok(separation.distance >= FREE_ROAM_DISTANCE * 2,
  `Non-local road envelopes overlap by shortcut distance: ${separation.distance.toFixed(2)} m at ${separation.indices.join('/')} (${JSON.stringify(separation.indices.map((index) => route[index].map((value) => Number(value.toFixed(2)))))} )`);
assert.ok(maximumSampleGap(route) <= 2.5,
  '2160 runtime samples must keep long-course road and collision interpolation dense');
assert.ok(maximumGrade(route) <= 0.16, 'The long route must avoid unrealistic or grounding-hostile grades');

const bounds = routeBounds(route);
assert.ok(bounds.minX <= -404 && bounds.maxX >= 409);
assert.ok(bounds.minZ <= -374 && bounds.maxZ >= 193);
assert.equal(MOUNTAIN_LOWER_TERRAIN_BOUNDS.segmentsX * MOUNTAIN_LOWER_TERRAIN_BOUNDS.segmentsZ * 2, 5264);
assert.equal(
  (MOUNTAIN_LOWER_TERRAIN_BOUNDS.segmentsX + 1) * (MOUNTAIN_LOWER_TERRAIN_BOUNDS.segmentsZ + 1),
  2755,
  'The lower terrain should stay one modest grid, not a high-poly second mountain'
);
for (const point of route) {
  if (point[2] >= MOUNTAIN_LOWER_TERRAIN_BOUNDS.maxZ) continue;
  assert.ok(point[0] >= MOUNTAIN_LOWER_TERRAIN_BOUNDS.minX && point[0] <= MOUNTAIN_LOWER_TERRAIN_BOUNDS.maxX);
  assert.ok(point[2] >= MOUNTAIN_LOWER_TERRAIN_BOUNDS.minZ, 'Every lower-course centre sample needs terrain coverage');
}

assert.equal(MOUNTAIN_BRIDGE_CENTERS.length, 6);
for (const center of MOUNTAIN_BRIDGE_CENTERS) {
  const nearest = nearestRoutePoint(route, center.x, center.z);
  assert.ok(nearest.distance <= 3.2, `Bridge module at ${center.x}/${center.z} must follow the sampled route`);
  const tangent = routeTangent(route, nearest.index);
  assert.ok(Math.abs(Math.atan2(tangent[2], tangent[0])) <= 0.20,
    'Kenney bridge modules require the bridge to remain nearly east-west');
  assert.ok(nearest.point[1] >= 2.7 && nearest.point[1] <= 3.3, 'Bridge deck elevation must remain level');
}
for (const site of MOUNTAIN_LOWER_VILLAGE_SITES) {
  assert.ok(nearestRoutePoint(route, site.x, site.z).distance <= 4.0,
    'Lower-village anchors should remain tied to their authored route section');
}
for (const screen of MOUNTAIN_VIEW_SCREEN_SPECS) {
  const nearest = nearestRoutePoint(route, screen.x, screen.z);
  assert.ok(nearest.distance >= TRACK_WIDTH / 2 + Math.min(screen.sx, screen.sz),
    `Sightline screen at ${screen.x}/${screen.z} intrudes into the playable road`);
}

// Exercise the LAB overlays with small production stubs. This validates their
// exported behavior in Node without copying the production engine into LAB.
const definitionModule = await importSourceModule(
  definitionsSource
    .replace(
      /import \* as production from '[^']+';/,
      `const countryside = Object.freeze({ id: 'countryside', freeRoamDistance: 170, collisionProfile: Object.freeze({ colliders: Object.freeze([]) }) });
       const mountain = Object.freeze({ id: 'mountain', freeRoamDistance: 22.2, collisionProfile: Object.freeze({ colliders: Object.freeze([]) }) });
       const production = Object.freeze({ DEFAULT_TRACK_ID: 'countryside', TRACK_SAMPLE_COUNT: 720, TRACK_SELECTION_KEY: 'turn-selected-track-v1', TRACK_DEFINITIONS: Object.freeze([countryside, mountain]), TRACK_PLACEHOLDERS: Object.freeze([]) });`
    )
    .replace(
      /import \{[\s\S]*?\} from '\.\/mountain-layout\.js';/,
      `const MOUNTAIN_BRIDGE_CENTERS = Object.freeze(${JSON.stringify(MOUNTAIN_BRIDGE_CENTERS)});`
    ),
  'mountain definitions overlay'
);
const mountainDefinition = definitionModule.TRACK_DEFINITIONS.find((track) => track.id === 'mountain');
const countrysideDefinition = definitionModule.TRACK_DEFINITIONS.find((track) => track.id === 'countryside');
assert.equal(countrysideDefinition.freeRoamDistance, 170, 'Non-MOUNTAIN definitions must pass through production');
assert.equal(mountainDefinition.sampleCount, ROUTE_SAMPLE_COUNT);
assert.equal(mountainDefinition.storageRevision, 'mountain-lab-long-r1');
assert.equal(mountainDefinition.freeRoamDistance, FREE_ROAM_DISTANCE);
assert.deepEqual(mountainDefinition.collisionProfile.colliders, [],
  'The bridge must not append padded boxes with perpendicular entry, seam or exit faces');
assert.doesNotMatch(definitionsSource, /mountain-lab-bridge-(?:north|south)|BRIDGE_RAIL_COLLIDERS/,
  'TURN LAB must not reconstruct the invisible bridge boxes under another name');
const bridgeGuide = mountainDefinition.collisionProfile.bridgeGuide;
assert.ok(Object.isFrozen(bridgeGuide), 'The bridge guide must remain immutable with the track definition');
assert.equal(bridgeGuide.assistStartDistance, TRACK_WIDTH / 2 + 0.35,
  'Slippery assistance must start at the visible rail, as in DBE 101');
assert.equal(bridgeGuide.hardLimitDistance, TRACK_WIDTH / 2 + 0.42,
  'The continuous fallback must align with the visible rail rather than the deck edge');
assert.ok(bridgeGuide.hardLimitDistance < 30.4 / 2,
  'The route-normal fallback must keep the car centre on the Kenney bridge deck');
assert.equal(bridgeGuide.offRoadDrag, 0.34,
  'A rail scrape should receive only TURN\'s ordinary off-road drag');
assert.ok(bridgeGuide.positiveNormalRange.startX > bridgeGuide.negativeNormalRange.startX,
  'The omitted left entry rail must retain the longer open funnel');
assert.equal(bridgeGuide.positiveNormalRange.endX, bridgeGuide.negativeNormalRange.endX);
assert.equal(bridgeGuide.positiveNormalRange.feather, 6);
assert.match(collisionSource, /resolveProductionWorldCollisionState/,
  'The LAB adapter must wrap the current production collision resolver');
assert.match(collisionSource, /bridgeGuide\.active[\s\S]*Math\.min/,
  'Production must receive the guide\'s tapered normal limit instead of applying a second envelope response');
assert.match(bridgeGuideSource, /1 - Math\.exp\(-damping \* influence \* seconds\)/,
  'The rail must use DBE 101-style frame-rate-independent outward damping');
assert.match(bridgeGuideSource, /outwardSpeed > -minimumInwardSpeed/,
  'The containment fallback must preserve route-tangential velocity');
assert.doesNotMatch(bridgeGuideSource, /for\s*\(|while\s*\(/,
  'The per-frame bridge guide must remain O(1)');

// Reproduce the old padded x-faces on the open shoulder. They sit outside
// the visible longitudinal rail spans, so neither the soft guide nor production
// may register a collision, reverse the car or scrub its forward speed.
const formerBridgeCaps = [
  { label: 'south entry cap', x: MOUNTAIN_BRIDGE_CENTERS[0].x - 6.3, center: MOUNTAIN_BRIDGE_CENTERS[0], side: -1, velocityX: 30 },
  { label: 'north handoff cap', x: MOUNTAIN_BRIDGE_CENTERS[1].x - 19.1, center: MOUNTAIN_BRIDGE_CENTERS[1], side: 1, velocityX: 30 },
  { label: 'south exit cap', x: MOUNTAIN_BRIDGE_CENTERS.at(-1).x + 19.1, center: MOUNTAIN_BRIDGE_CENTERS.at(-1), side: -1, velocityX: -30 },
  { label: 'north exit cap', x: MOUNTAIN_BRIDGE_CENTERS.at(-1).x + 19.1, center: MOUNTAIN_BRIDGE_CENTERS.at(-1), side: 1, velocityX: -30 }
];
for (const cap of formerBridgeCaps) {
  const state = {
    position: { x: cap.x, y: 3.18, z: cap.center.z + cap.side * 15 },
    velocity: { x: cap.velocityX, y: 0, z: 0 },
    speed: Math.abs(cap.velocityX)
  };
  const collision = resolveWorldCollisionState({
    state,
    trackId: 'mountain',
    nearestTrack: {
      distance: 15,
      sample: {
        point: { x: cap.x, y: 3, z: cap.center.z },
        tangent: { x: Math.sign(cap.velocityX), y: 0, z: 0 },
        normal: { x: 0, y: 0, z: 1 }
      }
    },
    collisionProfile: mountainDefinition.collisionProfile
  });
  assert.equal(collision.collided, false, cap.label + ' must be completely absent');
  assert.equal(collision.bridgeGuide, false, cap.label + ' must remain outside the tapered rail span');
  assert.equal(state.velocity.x, cap.velocityX, cap.label + ' must not reverse or scrub forward motion');
}

// The exact visible rail endpoints have zero influence. This is the deliberate
// no-end-cap contract: assistance grows only after the car moves alongside a rail.
for (const [side, range] of [
  [-1, bridgeGuide.negativeNormalRange],
  [1, bridgeGuide.positiveNormalRange]
]) {
  for (const [label, x] of [['start', range.startX], ['end', range.endX]]) {
    const state = {
      position: { x, y: 3.18, z: -205 + side * 15 },
      velocity: { x: 30, y: 0, z: 0 },
      speed: 30
    };
    const collision = resolveWorldCollisionState({
      state,
      trackId: 'mountain',
      nearestTrack: {
        distance: 15,
        sample: {
          point: { x, y: 3, z: -205 },
          tangent: { x: 1, y: 0, z: 0 },
          normal: { x: 0, y: 0, z: 1 }
        }
      },
      collisionProfile: mountainDefinition.collisionProfile
    });
    assert.equal(collision.bridgeGuide, false, 'Rail ' + label + ' side ' + side + ' must expose no orthogonal cap');
    assert.equal(state.velocity.x, 30, 'Rail ' + label + ' side ' + side + ' must preserve forward speed');
  }
}

// Alongside the actual rails, exercise both sides at the beginning, middle and
// release. The guide must contain the car at the rail centre, remove only outward
// motion, and retain at least 99% of one-frame forward speed (ordinary off-road drag).
const bridgeGuideSites = [
  nearestRoutePoint(route, MOUNTAIN_BRIDGE_CENTERS[1].x, MOUNTAIN_BRIDGE_CENTERS[1].z),
  nearestRoutePoint(route, MOUNTAIN_BRIDGE_CENTERS[3].x, MOUNTAIN_BRIDGE_CENTERS[3].z),
  nearestRoutePoint(route, MOUNTAIN_BRIDGE_CENTERS.at(-1).x, MOUNTAIN_BRIDGE_CENTERS.at(-1).z)
];
for (const [siteIndex, site] of bridgeGuideSites.entries()) {
  const tangent = routeTangent(route, site.index);
  const normal = [-tangent[2], 0, tangent[0]];
  for (const side of [-1, 1]) {
    const forwardSpeed = 28;
    const outwardSpeed = 4;
    const distance = bridgeGuide.hardLimitDistance + 0.8;
    const state = {
      position: {
        x: site.point[0] + normal[0] * side * distance,
        y: site.point[1] + 0.18,
        z: site.point[2] + normal[2] * side * distance
      },
      velocity: {
        x: tangent[0] * forwardSpeed + normal[0] * side * outwardSpeed,
        y: 0,
        z: tangent[2] * forwardSpeed + normal[2] * side * outwardSpeed
      },
      speed: 0
    };
    const collision = resolveWorldCollisionState({
      state,
      trackId: 'mountain',
      nearestTrack: {
        distance,
        sample: {
          point: { x: site.point[0], y: site.point[1], z: site.point[2] },
          tangent: { x: tangent[0], y: 0, z: tangent[2] },
          normal: { x: normal[0], y: 0, z: normal[2] }
        }
      },
      collisionProfile: mountainDefinition.collisionProfile,
      dt: 1 / 60
    });
    const retainedForward = state.velocity.x * tangent[0] + state.velocity.z * tangent[2];
    const remainingOutward = (
      state.velocity.x * normal[0] + state.velocity.z * normal[2]
    ) * side;
    const siteLabel = 'Bridge guide site ' + (siteIndex + 1) + ' side ' + side;
    assert.equal(collision.bridgeGuide, true, siteLabel + ' must engage beside a visible rail');
    assert.equal(collision.bridgeRailAssist, true, siteLabel + ' must use the slippery assist');
    assert.equal(collision.bridgeRailContainment, true, siteLabel + ' must remain on the deck');
    assert.equal(collision.boundary, true, siteLabel + ' must report containment');
    assert.equal(collision.obstacles, 0, siteLabel + ' must have no hard box hit');
    assert.ok(retainedForward >= forwardSpeed * 0.99,
      siteLabel + ' must retain its forward slide, got ' + retainedForward.toFixed(3));
    assert.ok(remainingOutward < 0, siteLabel + ' must guide the car gently inward');
    assert.ok(state.speed >= forwardSpeed * 0.99, siteLabel + ' must never produce a stop');
    assert.ok(Math.hypot(
      state.position.x - site.point[0],
      state.position.z - site.point[2]
    ) <= bridgeGuide.hardLimitDistance + 1e-6,
    siteLabel + ' must keep the car centre at or inside the visible rail');
  }
}

assert.equal(MOUNTAIN_TUNNEL_SPECS.length, 1);
assert.equal(MOUNTAIN_TUNNEL_SPECS[0].id, 'lower-village');
for (const tunnel of MOUNTAIN_TUNNEL_SPECS) {
  assert.deepEqual(tunnel.sourcePeak, { x: -392, z: -228 },
    `${tunnel.id} must relocate the known production peak rather than duplicating it`);
  assert.deepEqual(tunnel.peak, { x: -431, z: -287, radius: 132, height: 136 },
    `${tunnel.id} must use the radial portal alignment derived from the long route`);
  assert.ok(Math.hypot(
    tunnel.peak.x - tunnel.sourcePeak.x,
    tunnel.peak.z - tunnel.sourcePeak.z
  ) > 65, `${tunnel.id} production peak needs a material LAB-only relocation`);
  const start = nearestRoutePoint(route, tunnel.start.x, tunnel.start.z);
  const end = nearestRoutePoint(route, tunnel.end.x, tunnel.end.z);
  assert.ok(start.distance <= 4 && end.distance <= 4,
    `${tunnel.id} tunnel endpoints must remain tied to the sampled route`);
  assert.ok(tunnel.halfWidth >= FREE_ROAM_DISTANCE + 2,
    `${tunnel.id} tunnel lining must stay outside the complete no-drop envelope`);
  assert.ok(tunnel.clearHeight >= 18, `${tunnel.id} tunnel needs generous visible vehicle clearance`);
  assert.ok(tunnel.carveHalfWidth >= FREE_ROAM_DISTANCE - 2.6 + 14 + 4,
    `${tunnel.id} hidden cut must contain the no-drop edge plus TURN's low-speed chase camera`);
  assert.ok(tunnel.carveClearHeight >= 23,
    `${tunnel.id} hidden cut must clear the highest production chase-camera position with margin`);
  const midpoint = route[Math.round((start.index + end.index) / 2) % route.length];
  assert.ok(Math.hypot(midpoint[0] - tunnel.peak.x, midpoint[2] - tunnel.peak.z) < tunnel.peak.radius,
    `${tunnel.id} tunnel must correspond to a real integrated mountain crossing`);
  const tunnelRoute = start.index <= end.index
    ? route.slice(start.index, end.index + 1)
    : [...route.slice(start.index), ...route.slice(0, end.index + 1)];
  const portalSamples = tunnelRoute.filter((point) => (
    Math.hypot(point[0] - tunnel.peak.x, point[2] - tunnel.peak.z) <= tunnel.portalRadius
  ));
  assert.ok(portalSamples.length > 80, `${tunnel.id} needs a substantial mountain-contained lining`);
  for (const [portalIndex, portal] of [portalSamples[0], portalSamples.at(-1)].entries()) {
    const portalRadius = Math.hypot(
      portal[0] - tunnel.peak.x,
      portal[2] - tunnel.peak.z
    );
    const coneSurfaceAtPortalCentre = -7
      + tunnel.peak.height * (1 - portalRadius / tunnel.peak.radius);
    assert.ok(coneSurfaceAtPortalCentre >= portal[1] + tunnel.clearHeight + 1.5,
      `${tunnel.id} drive opening must meet the mountain while its broad collar covers the lateral shell transition`);
    const routeIndex = route.indexOf(portal);
    const previous = route[(routeIndex - 1 + route.length) % route.length];
    const next = route[(routeIndex + 1) % route.length];
    const tangentLength = Math.hypot(next[0] - previous[0], next[2] - previous[2]);
    const direction = portalIndex === 0 ? -1 : 1;
    const roadOutwardX = direction * (next[0] - previous[0]) / tangentLength;
    const roadOutwardZ = direction * (next[2] - previous[2]) / tangentLength;
    const radialLength = Math.hypot(portal[0] - tunnel.peak.x, portal[2] - tunnel.peak.z);
    const radialOutwardX = (portal[0] - tunnel.peak.x) / radialLength;
    const radialOutwardZ = (portal[2] - tunnel.peak.z) / radialLength;
    const yawError = Math.acos(Math.max(-1, Math.min(
      1,
      roadOutwardX * radialOutwardX + roadOutwardZ * radialOutwardZ
    ))) * 180 / Math.PI;
    assert.ok(yawError < 0.75,
      `${tunnel.id} portal ${portalIndex + 1} must meet the circular mountain radially; got ${yawError.toFixed(3)}°`);
  }
  const portalBottomSurfaceRadius = tunnel.peak.radius
    * (1 - ((portalSamples[0][1] - 0.95) + 7) / tunnel.peak.height);
  const portalCrownSurfaceRadius = tunnel.peak.radius
    * (1 - ((portalSamples[0][1] + tunnel.clearHeight + 8) + 7) / tunnel.peak.height);
  assert.ok(portalBottomSurfaceRadius - portalCrownSurfaceRadius > 25,
    `${tunnel.id} portal face must lean materially into the mountain slope from foot to crown`);
  const mountainSlopeDegrees = Math.atan(tunnel.peak.height / tunnel.peak.radius) * 180 / Math.PI;
  assert.ok(mountainSlopeDegrees > 45 && mountainSlopeDegrees < 47,
    `${tunnel.id} portal pitch must follow the integrated peak's mountainside`);
}
const eastPeakRouteDistance = nearestRoutePoint(
  route,
  MOUNTAIN_REMOVED_EAST_PEAK.x,
  MOUNTAIN_REMOVED_EAST_PEAK.z
).distance;
assert.ok(eastPeakRouteDistance < MOUNTAIN_REMOVED_EAST_PEAK.radius,
  'The retired east peak really was intersecting the post-bridge road and must be removed, not merely left uncarved');

const productionCheckpoints = Object.freeze([0.2, 0.4, 0.6, 0.8]);
const lapModule = await importSourceModule(
  lapSource.replace(
    /import \* as production from '[^']+';/,
    `const production = Object.freeze({
      LAP_CHECKPOINTS: Object.freeze(${JSON.stringify(productionCheckpoints)}),
      beginTimedLapState: () => 'begin', completeLapState: () => 'complete', crossedForwardGate: () => true,
      updateLapProgressState: (options) => options
    });`
  ),
  'mountain lap overlay'
);
assert.equal(lapModule.MOUNTAIN_LAB_CHECKPOINTS.length, 24);
assert.deepEqual(lapModule.MOUNTAIN_LAB_CHECKPOINTS, Array.from({ length: 24 }, (_, index) => (index + 1) / 25));
assert.equal(lapModule.updateLapProgressState({ state: { trackId: 'mountain' } }).checkpoints.length, 24);
assert.deepEqual(lapModule.updateLapProgressState({ state: { trackId: 'harbor' } }).checkpoints, productionCheckpoints);
const explicitCheckpoints = Object.freeze([0.5]);
assert.equal(lapModule.updateLapProgressState({ state: { trackId: 'mountain' }, checkpoints: explicitCheckpoints }).checkpoints, explicitCheckpoints);

const paceModule = await importSourceModule(
  paceSource.replace(
    /import \* as production from '[^']+';/,
    `const production = Object.freeze({
      PACE_NOTE_DIRECTION: Object.freeze({ LEFT: -1, RIGHT: 1 }),
      PACE_NOTE_LENGTH: Object.freeze({ SHORT: 'short', MEDIUM: 'medium', LONG: 'long' }),
      getTrackPaceNotes: (trackId) => Object.freeze([{ id: 'production-' + trackId }]),
      speedAdjustedPaceNoteTrigger: () => 0
    });`
  ),
  'mountain pace-note overlay'
);
assert.equal(paceModule.MOUNTAIN_LONG_PACE_NOTES.length, 10);
for (let index = 0; index < paceModule.MOUNTAIN_LONG_PACE_NOTES.length; index += 1) {
  const note = paceModule.MOUNTAIN_LONG_PACE_NOTES[index];
  assert.ok(note.triggerStart >= 0 && note.triggerStart < note.triggerEnd && note.triggerEnd < 1);
  if (index > 0) assert.ok(note.triggerStart > paceModule.MOUNTAIN_LONG_PACE_NOTES[index - 1].triggerEnd);
}
assert.deepEqual(
  paceModule.MOUNTAIN_LONG_PACE_NOTES.slice(2, 5).map((note) => note.groups[0].direction),
  [1, -1, 1],
  'The summit descent must retain the right/left/right slalom sequence'
);
for (const note of paceModule.MOUNTAIN_LONG_PACE_NOTES) {
  const geometricDirection = dominantTurnDirection(route, note.triggerStart, note.triggerEnd);
  assert.equal(note.groups[0].direction, geometricDirection,
    `${note.id} must call the sampled route's driver-perspective turn direction`);
}
assert.equal(paceModule.getTrackPaceNotes('mountain'), paceModule.MOUNTAIN_LONG_PACE_NOTES);
assert.equal(paceModule.getTrackPaceNotes('harbor')[0].id, 'production-harbor');

// Asset and performance contract. The bridge must use the supplied kits and
// the extension must stay render-driven, batched and shadowless.
for (const assetPath of [
  'postal/assets/kenney/roads/road-straight.glb',
  'turn/assets/scenery/mountain/fantasy/fence.glb',
  'turn/assets/scenery/mountain/nature/cliff-waterfall-rock.glb'
]) {
  const buffer = await fs.readFile(new URL(assetPath, REPO_ROOT));
  const gltf = parseGlbJson(buffer, assetPath);
  assert.equal(gltf.asset?.version, '2.0');
  assert.ok(gltf.meshes?.length > 0, `${assetPath} needs a renderable mesh`);
  for (const image of gltf.images || []) {
    if (!image.uri || image.uri.startsWith('data:')) continue;
    await fs.access(new URL(image.uri, new URL(assetPath, REPO_ROOT)));
  }
}
assert.match(extensionSource, /\/postal\/assets\/kenney\/roads\/road-straight\.glb/);
assert.match(extensionSource, /\/turn\/assets\/scenery\/mountain\/fantasy\/fence\.glb/);
assert.match(extensionSource, /\/turn\/assets\/scenery\/mountain\/nature\/cliff-waterfall-rock\.glb/);
assert.doesNotMatch(extensionSource, /road-bridge\.glb|bridge-pillar-wide\.glb|procedural slab/i);
assert.ok((extensionSource.match(/new THREE\.InstancedMesh/g) || []).length >= 10,
  'Bridge, houses, lights, forest and view screens should be aggressively instanced');
assert.match(extensionSource, /Mountain lower village instanced brown snow houses LAB/);
assert.match(extensionSource, /BRIDGE_ENTRY_RAIL_LENGTH = 20\.5/,
  'The retained right entry rail must preserve the established shortened funnel');
assert.match(extensionSource, /moduleIndex === 0 && side === 1/,
  'The visible first left rail opening must preserve the forgiving turning approach');
assert.match(extensionSource, /Mountain carved tunnel continuous rock lining LAB/);
assert.match(extensionSource, /Mountain Kenney Nature tunnel portal rocks LAB/);
assert.match(extensionSource, /PORTAL_ROCK_GREY = 0x7d878d/,
  'Portal-side rocks should use the established mountain mid-grey');
assert.match(extensionSource, /PORTAL_ROCK_EMISSIVE = 0x30383d/,
  'Portal-side facets need a small baked night-time floor instead of a real light');
assert.match(extensionSource, /mesh\.material = clonePortalRockMaterials\(source\.material\)/,
  'The brighter portal material must stay isolated from the bridge-support instances');
assert.match(extensionSource, /mesh\.receiveShadow = false/,
  'The low portal-side rocks must not collapse back to black in the mountain shadow');
assert.match(extensionSource, /Mountain tunnel batched mountain-aligned granite arches LAB/);
assert.match(extensionSource, /const snowCap = new THREE\.Color\(0xdce8ec\)/,
  'The retained portal crown should remain readable against the night mountain without a real light');
assert.match(extensionSource, /vertexColors: true/,
  'Portal stone and snow variation should stay inside the existing batched arch draw call');
assert.match(extensionSource, /Mountain tunnel instanced warm wall lamps LAB/);
assert.doesNotMatch(extensionSource, /Mountain tunnel instanced granite portal frames LAB/,
  'The floating rectangular portal-frame experiment must stay retired');
assert.match(extensionSource, /cpuCarvedMountainGeometry/,
  'The retained integrated peak should be carved once on the CPU instead of using a recurring shader cut');
assert.match(extensionSource, /removeRetiredEastTunnelMountain/,
  'The post-bridge tunnel mountain must be explicitly removed from the LAB world');
assert.match(extensionSource, /disposeObjectMesh\(peak\)/,
  'Retiring the east peak must also release its one-off GPU resources');
assert.match(extensionSource, /TUNNEL_PORTAL_MARGIN = 5/);
assert.match(extensionSource, /TUNNEL_PEAK_BASE_Y = -7/);
assert.match(extensionSource, /TUNNEL_PORTAL_SURFACE_OFFSET = 0\.65/,
  'The collar must clear the faceted shell without floating visibly off the mountain');
assert.match(extensionSource, /TUNNEL_PORTAL_BACK_INSET = 1\.6/,
  'The slope-matched reveal must remain joined to the sampled tunnel lining');
assert.match(extensionSource, /TUNNEL_PORTAL_RING = 8/);
assert.match(extensionSource, /TUNNEL_PORTAL_SEAM_OVERLAP = 5/,
  'The collar must hide the complete finite CPU-carve triangle step');
assert.match(extensionSource, /TUNNEL_PORTAL_APERTURE_MARGIN = TUNNEL_PORTAL_RING - TUNNEL_PORTAL_SEAM_OVERLAP/,
  'The baked opening must clear the drive aperture while leaving a robust hidden seam');
assert.match(extensionSource, /TUNNEL_PORTAL_APERTURE_HEIGHT_MARGIN = TUNNEL_PORTAL_RING - TUNNEL_PORTAL_SEAM_OVERLAP/,
  'The projected crown must keep the same robust hidden seam');
assert.match(extensionSource, /TUNNEL_PORTAL_ARC_SEGMENTS = 12/);
assert.match(extensionSource, /visibleTunnelSampleRange/,
  'The visible arch and lining must start deeper than the hidden exterior camera carve');
assert.match(extensionSource, /function makeTunnelPortal/);
assert.match(extensionSource, /outward\.dot\(roadOutward\)/,
  'Each portal must measure the road-radius error instead of assuming an aligned mountain');
assert.match(extensionSource, /surfaceRadius \* surfaceRadius - profilePoint\.lateral \* profilePoint\.lateral/,
  'Every collar vertex must be projected onto the cone, including the tangent-axis displacement');
assert.match(extensionSource, /tunnelMountainSurfaceRadius/,
  'The portal foot and crown must follow the actual mountain pitch');
assert.match(extensionSource, /addScaledVector\(portal\.roadOutward, -TUNNEL_PORTAL_BACK_INSET\)/,
  'The slope-matched front must taper cleanly back into the road-aligned lining');
assert.match(extensionSource, /cameraExpansion = THREE\.MathUtils\.smoothstep/,
  'The wide camera cut must taper down at the portal instead of punching an oversized hole through the mountain face');
assert.match(extensionSource, /1 - normalizedLateral \* normalizedLateral/,
  'The portal carve must follow the arched collar instead of exposing a rectangular hole above it');
assert.match(extensionSource, /tunnelPortalApertureMargin: TUNNEL_PORTAL_APERTURE_MARGIN/,
  'The portal-shell clearance must be exposed to the browser geometry smoke test');
assert.match(extensionSource, /tunnelPortalCarveProfile: 'arched'/,
  'The browser geometry smoke test must identify the profiled portal carve');
assert.doesNotMatch(extensionSource, /appendPortalRetainingReturn|TUNNEL_PORTAL_RETURN_LENGTH/,
  'The relocated radial portal must not retain the old asymmetric tongue workaround');
assert.match(extensionSource, /tunnelPortalRetainingReturns: tunnels\.portalRetainingReturns/);
assert.match(extensionSource, /tunnelPortalSurfaceAligned: true/);
assert.match(extensionSource, /tunnelPortalMaximumYawError: tunnels\.portalMaximumYawError/);
assert.match(extensionSource, /tunnelPortalSlopeDegrees: tunnels\.portalSlopeDegrees/);
assert.match(extensionSource, /tunnelPortalFrontLean: tunnels\.portalFrontLean/);
assert.match(extensionSource, /findIntegratedPeak\(world, spec\.sourcePeak \|\| spec\.peak\)/,
  'The existing production peak must be found at its source position before its LAB-only relocation');
assert.match(extensionSource, /peak\.position\.x = spec\.peak\.x/);
assert.match(extensionSource, /peak\.position\.z = spec\.peak\.z/);
assert.match(extensionSource, /relocatedTunnelMountainMeshes: tunnels\.relocatedMountainMeshes/);
assert.match(extensionSource, /expandedTunnelSampleRange/,
  'The hidden CPU cut should extend cleanly outside each integrated peak shell');
assert.match(extensionSource, /carvePath: Object\.freeze/,
  'The hidden exterior carve path must be separate from the visible tunnel lining');
assert.match(extensionSource, /TUNNEL_PEAK_RADIAL_SEGMENTS = 144/);
assert.match(extensionSource, /TUNNEL_PEAK_HEIGHT_SEGMENTS = 72/,
  'Only the retained tunnel peak should receive enough one-time tessellation for a clean opening');
assert.match(extensionSource, /previousGeometry\?\.dispose\?\.\(\)/,
  'The replaced low-detail peak geometry should be released after the one-time carve');
assert.match(extensionSource, /one-relocated-cpu-carved-camera-safe-peak/);
assert.doesNotMatch(extensionSource, /onBeforeCompile|customProgramCacheKey/,
  'Tunnel openings must not add recurring per-fragment shader work to the large mountain occluders');
assert.match(extensionSource, /carvedMountainMeshes: tunnels\.carvedMountainMeshes/);
assert.match(extensionSource, /carvedMountainTriangles: tunnels\.carvedMountainTriangles/);
assert.match(extensionSource, /carvedMountainRenderedTriangles: tunnels\.carvedMountainRenderedTriangles/,
  'The retained peak total must be exposed so the visual smoke test guards its static triangle budget');
assert.match(extensionSource, /removedMountainMeshes: tunnels\.removedMountainMeshes/);
assert.match(extensionSource, /tunnelSceneryTreesRemoved: tunnels\.removedSceneryTrees/);
assert.match(extensionSource, /clearTunnelSpruceInstances/,
  'Production spruce batching should be compacted once so trees do not grow inside the retained tunnel');
assert.match(extensionSource, /tunnelPortalArches: tunnels\.portalArches/);
assert.match(extensionSource, /\+ tunnels\.drawCalls/,
  'Tunnel lining, portals and reflectors must be included in the draw-call budget');
assert.match(extensionSource, /\+ village\.drawCalls/,
  'House batching cost must be included in the published draw-call budget');
assert.doesNotMatch(extensionSource, /new THREE\.(PointLight|SpotLight|DirectionalLight|HemisphereLight)/,
  'The lower village must not proliferate dynamic lights');
assert.doesNotMatch(extensionSource, /castShadow\s*=\s*true/,
  'No LAB extension mesh should add shadow-rendering cost');
assert.doesNotMatch(extensionSource, /requestAnimationFrame|setAnimationLoop|setInterval/,
  'The extension must not add an independent render or timer loop');
assert.match(extensionSource, /dynamicPointLightsAdded: 0/);
assert.match(extensionSource, /addedShadowCasters: 0/);
assert.match(worldSource, /PRODUCTION_WORLD_SAMPLE_COUNT = 1080/);
assert.match(worldSource, /installMountainLongExtension\(world, fullSamples/);
assert.match(worldSource, /runtimeSamples: fullSamples\.length/);
assert.match(workflowSource, /node turn-lab\/tests\/mountain-long-lab\.mjs/,
  'The long-course contract must run in the required PR regression suite');

console.log(
  `TURN LAB MOUNTAIN long-course contract passed: ${routeLength.toFixed(0)} m, `
  + `${lengthRatio.toFixed(3)}x production, ${separation.distance.toFixed(1)} m minimum non-local separation, `
  + '24 checkpoints, an open-left slippery bridge guide, one camera-safe arched tunnel, instanced scenery and zero added dynamic lights.'
);

async function readText(path) {
  return fs.readFile(new URL(path, REPO_ROOT), 'utf8');
}

function parseImportMaps(html) {
  return [...html.matchAll(/<script\s+type="importmap">\s*([\s\S]*?)\s*<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
}

function stylesheetUrls(html) {
  return [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((match) => match[1]);
}

function scriptUrls(html) {
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)].map((match) => match[1]);
}

async function importSourceModule(source, label) {
  const url = `data:text/javascript;base64,${Buffer.from(`${source}\n//# sourceURL=${label.replace(/\s+/g, '-')}.mjs`).toString('base64')}`;
  return import(url);
}

function sampleClosedCentripetal(points, count) {
  const denseCount = Math.max(count * 4, points.length * 120);
  const dense = Array.from({ length: denseCount }, (_, index) => {
    const scaled = index / denseCount * points.length;
    const current = Math.floor(scaled) % points.length;
    const weight = scaled - Math.floor(scaled);
    const p0 = points[(current - 1 + points.length) % points.length];
    const p1 = points[current];
    const p2 = points[(current + 1) % points.length];
    const p3 = points[(current + 2) % points.length];
    return centripetalPoint(p0, p1, p2, p3, weight);
  });
  const cumulative = [0];
  for (let index = 1; index <= dense.length; index += 1) {
    cumulative.push(cumulative.at(-1) + distance3(dense[index - 1], dense[index % dense.length]));
  }
  const total = cumulative.at(-1);
  return Array.from({ length: count }, (_, index) => {
    const target = index / count * total;
    let low = 0;
    let high = dense.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (cumulative[middle] <= target) low = middle;
      else high = middle;
    }
    const span = Math.max(1e-9, cumulative[low + 1] - cumulative[low]);
    return interpolateAt(dense[low], dense[(low + 1) % dense.length], 0, 1, (target - cumulative[low]) / span);
  });
}

function centripetalPoint(p0, p1, p2, p3, weight) {
  const t0 = 0;
  const t1 = t0 + Math.sqrt(distance3(p0, p1));
  const t2 = t1 + Math.sqrt(distance3(p1, p2));
  const t3 = t2 + Math.sqrt(distance3(p2, p3));
  const t = t1 + (t2 - t1) * weight;
  const a1 = interpolateAt(p0, p1, t0, t1, t);
  const a2 = interpolateAt(p1, p2, t1, t2, t);
  const a3 = interpolateAt(p2, p3, t2, t3, t);
  const b1 = interpolateAt(a1, a2, t0, t2, t);
  const b2 = interpolateAt(a2, a3, t1, t3, t);
  return interpolateAt(b1, b2, t1, t2, t);
}

function interpolateAt(a, b, start, end, value) {
  const denominator = Math.max(1e-9, end - start);
  const weight = (value - start) / denominator;
  return a.map((entry, index) => entry + (b[index] - entry) * weight);
}

function distance3(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

function closedLength(points) {
  return points.reduce((length, point, index) => length + distance3(point, points[(index + 1) % points.length]), 0);
}

function maximumSampleGap(points) {
  return points.reduce((maximum, point, index) => Math.max(maximum, distance3(point, points[(index + 1) % points.length])), 0);
}

function maximumGrade(points) {
  return points.reduce((maximum, point, index) => {
    const next = points[(index + 1) % points.length];
    const horizontal = Math.hypot(next[0] - point[0], next[2] - point[2]);
    return Math.max(maximum, Math.abs(next[1] - point[1]) / Math.max(1e-9, horizontal));
  }, 0);
}

function routeBounds(points) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point[0]),
    maxX: Math.max(bounds.maxX, point[0]),
    minZ: Math.min(bounds.minZ, point[2]),
    maxZ: Math.max(bounds.maxZ, point[2])
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
}

function minimumNonLocalDistance(points, minimumArcDistance) {
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative.at(-1) + distance3(points[index - 1], points[index]));
  }
  const total = cumulative.at(-1) + distance3(points.at(-1), points[0]);
  let distance = Infinity;
  let indices = [-1, -1];
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const forwardArc = cumulative[second] - cumulative[first];
      if (Math.min(forwardArc, total - forwardArc) <= minimumArcDistance) continue;
      const candidate = Math.hypot(
        points[first][0] - points[second][0],
        points[first][2] - points[second][2]
      );
      if (candidate < distance) {
        distance = candidate;
        indices = [first, second];
      }
    }
  }
  return { distance, indices };
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
      if (orientation(a, b, c) * orientation(a, b, d) < -1e-8
          && orientation(c, d, a) * orientation(c, d, b) < -1e-8) intersections.push([first, second]);
    }
  }
  return intersections;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
}

function nearestRoutePoint(points, x, z) {
  let result = { point: null, index: -1, distance: Infinity };
  points.forEach((point, index) => {
    const distance = Math.hypot(point[0] - x, point[2] - z);
    if (distance < result.distance) result = { point, index, distance };
  });
  return result;
}

function routeTangent(points, index) {
  const previous = points[(index - 1 + points.length) % points.length];
  const next = points[(index + 1) % points.length];
  const length = Math.hypot(next[0] - previous[0], next[2] - previous[2]);
  return [(next[0] - previous[0]) / length, 0, (next[2] - previous[2]) / length];
}

function dominantTurnDirection(points, start, end) {
  const first = Math.max(1, Math.floor(start * points.length));
  const last = Math.min(points.length - 2, Math.ceil(end * points.length));
  let signedTurn = 0;
  for (let index = first; index <= last; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const incoming = [current[0] - previous[0], current[2] - previous[2]];
    const outgoing = [next[0] - current[0], next[2] - current[2]];
    const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
    const dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1];
    signedTurn += Math.atan2(cross, dot);
  }
  assert.ok(Math.abs(signedTurn) >= 0.04, 'Every pace-note window should contain a meaningful bend');
  return signedTurn < 0 ? -1 : 1;
}

function parseGlbJson(buffer, label) {
  assert.ok(buffer.length >= 20, `${label} is too short to be a GLB`);
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'glTF', `${label} has an invalid GLB header`);
  assert.equal(buffer.readUInt32LE(4), 2, `${label} must use GLB version 2`);
  assert.equal(buffer.readUInt32LE(8), buffer.length, `${label} byte length must match its header`);
  const jsonChunkLength = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, `${label} must begin with JSON`);
  return JSON.parse(buffer.subarray(20, 20 + jsonChunkLength).toString('utf8').replace(/\u0000/g, '').trim());
}
