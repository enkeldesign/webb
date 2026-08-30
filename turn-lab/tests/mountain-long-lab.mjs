import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import { resolveWorldCollisionState } from '../../turn/race/world-collision.js';
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
      '/turn/race/lap-system.js?build=20260720-r19': '/turn-lab/race/mountain-lap-system.js'
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
    'Kenney bridge modules and axis-aligned rail colliders require the bridge to remain nearly east-west');
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
assert.equal(mountainDefinition.collisionProfile.colliders.length, 11,
  'Only the first left entry rail should be open; every exposed bridge edge remains hard-contained');
for (let index = 0; index < MOUNTAIN_BRIDGE_CENTERS.length; index += 1) {
  const center = MOUNTAIN_BRIDGE_CENTERS[index];
  const north = mountainDefinition.collisionProfile.colliders.find(
    (collider) => collider.id === `mountain-lab-bridge-north-${index + 1}`
  );
  const south = mountainDefinition.collisionProfile.colliders.find(
    (collider) => collider.id === `mountain-lab-bridge-south-${index + 1}`
  );
  if (index === 0) assert.equal(north, undefined, 'The left entry must not retain an invisible hard box');
  else assert.equal(north.minZ - center.z, 14);
  assert.equal(center.z - south.maxZ, 14);
  if (index === 0) {
    assert.equal(south.minX, center.x - 3.8);
  } else {
    assert.ok(north.minX <= center.x - 16 && north.maxX >= center.x + 16);
    assert.ok(south.minX <= center.x - 16 && south.maxX >= center.x + 16);
  }

  for (const side of [-1, 1]) {
    const state = {
      position: { x: center.x, y: 3.18, z: center.z + side * 15 },
      velocity: { x: 20, y: 0, z: side * 8 },
      speed: 0
    };
    const collision = resolveWorldCollisionState({
      state,
      trackId: 'mountain',
      nearestTrack: {
        distance: 15,
        sample: { point: { x: center.x, y: 3, z: center.z } }
      },
      collisionProfile: mountainDefinition.collisionProfile
    });
    if (index === 0 && side === 1) {
      assert.equal(collision.collided, false,
        'The car must remain free on the visually open left entry asphalt');
    } else {
      assert.equal(collision.obstacles, 1, 'A car touching a visible bridge rail must hit its physical collider');
      assert.ok(Math.abs(state.position.z - center.z) <= 11.5,
        'Bridge rail resolution must eject the car back onto the deck, never over the outside edge');
    }
  }
}

const entry = MOUNTAIN_BRIDGE_CENTERS[0];
for (const xOffset of [-11, 0, 8]) {
  const state = {
    position: { x: entry.x + xOffset, y: 3.18, z: entry.z + 12.5 },
    velocity: { x: 24, y: 0, z: -2 },
    speed: 0
  };
  const collision = resolveWorldCollisionState({
    state,
    trackId: 'mountain',
    nearestTrack: {
      distance: 12.5,
      sample: { point: { x: entry.x + xOffset, y: 3, z: entry.z } }
    },
    collisionProfile: mountainDefinition.collisionProfile
  });
  assert.equal(collision.collided, false,
    'The complete visually open left entry lane must remain driveable');
}

const envelopeState = {
  position: { x: entry.x, y: 3.18, z: entry.z + 16.4 },
  velocity: { x: 22, y: 0, z: 5 },
  speed: 0
};
const envelopeCollision = resolveWorldCollisionState({
  state: envelopeState,
  trackId: 'mountain',
  nearestTrack: {
    distance: 16.4,
    sample: { point: { x: entry.x, y: 3, z: entry.z } }
  },
  collisionProfile: mountainDefinition.collisionProfile
});
assert.equal(envelopeCollision.boundary, true,
  'The normal no-drop envelope must still contain the open side before the second hard rail');
assert.ok(envelopeState.position.z - entry.z <= FREE_ROAM_DISTANCE - 2.6 + 1e-6);

assert.equal(MOUNTAIN_TUNNEL_SPECS.length, 1);
assert.equal(MOUNTAIN_TUNNEL_SPECS[0].id, 'lower-village');
for (const tunnel of MOUNTAIN_TUNNEL_SPECS) {
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
  for (const portal of [portalSamples[0], portalSamples.at(-1)]) {
    const portalIndex = route.indexOf(portal);
    const tangent = routeTangent(route, portalIndex);
    const normal = [-tangent[2], 0, tangent[0]];
    const outerHalfWidth = tunnel.halfWidth + 3.2;
    const widestPortalRadius = Math.max(...[-1, 1].map((side) => Math.hypot(
      portal[0] + normal[0] * outerHalfWidth * side - tunnel.peak.x,
      portal[2] + normal[2] * outerHalfWidth * side - tunnel.peak.z
    )));
    const coneSurfaceAtPortalEdge = -7
      + tunnel.peak.height * (1 - widestPortalRadius / tunnel.peak.radius);
    assert.ok(coneSurfaceAtPortalEdge >= portal[1] + tunnel.clearHeight + 3.2,
      `${tunnel.id} complete arch width must sit inside enough mountain shell to look structurally grounded`);
  }
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
  'The visible first left rail must match the removed north collider');
assert.match(extensionSource, /Mountain carved tunnel continuous rock lining LAB/);
assert.match(extensionSource, /Mountain Kenney Nature tunnel portal rocks LAB/);
assert.match(extensionSource, /Mountain tunnel batched mountain-aligned granite arches LAB/);
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
assert.match(extensionSource, /TUNNEL_PORTAL_ARC_SEGMENTS = 12/);
assert.match(extensionSource, /visibleTunnelSampleRange/,
  'The visible arch and lining must start deeper than the hidden exterior camera carve');
assert.match(extensionSource, /cameraExpansion = THREE\.MathUtils\.smoothstep/,
  'The wide camera cut must taper down at the portal instead of punching an oversized hole through the mountain face');
assert.match(extensionSource, /expandedTunnelSampleRange/,
  'The hidden CPU cut should extend cleanly outside each integrated peak shell');
assert.match(extensionSource, /carvePath: Object\.freeze/,
  'The hidden exterior carve path must be separate from the visible tunnel lining');
assert.match(extensionSource, /new THREE\.ConeGeometry\(spec\.peak\.radius, spec\.peak\.height, 72, 36\)/,
  'Only the retained tunnel peak should receive enough one-time tessellation for a clean opening');
assert.match(extensionSource, /previousGeometry\?\.dispose\?\.\(\)/,
  'The replaced low-detail peak geometry should be released after the one-time carve');
assert.match(extensionSource, /one-cpu-carved-camera-safe-peak/);
assert.doesNotMatch(extensionSource, /onBeforeCompile|customProgramCacheKey/,
  'Tunnel openings must not add recurring per-fragment shader work to the large mountain occluders');
assert.match(extensionSource, /carvedMountainMeshes: tunnels\.carvedMountainMeshes/);
assert.match(extensionSource, /carvedMountainTriangles: tunnels\.carvedMountainTriangles/);
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
  + '24 checkpoints, an open-left bridge funnel, one camera-safe arched tunnel, instanced scenery and zero added dynamic lights.'
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
