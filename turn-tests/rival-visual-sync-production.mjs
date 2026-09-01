import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  releaseSource,
  index,
  main,
  trackManager,
  leaderMarker,
  carModels,
  trackRegistry,
  airportWorld,
  maydayPolish,
  maydayHud,
  maydayFinal
] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/track-manager.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/leader-marker-r500.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/airport-world-r56.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/airport-emergency-r494.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/airport-emergency-r496.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/airport-emergency-r497.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));

const ensureSection = section(main, 'function ensureCompetitorCars()', '\nfunction syncCompetitorVisuals()');
assert.match(ensureSection, /while \(competitorCars\.length < COMPETITOR_LIMIT\)/, 'The fixed rival visual pool must still be created on demand');
assert.doesNotMatch(ensureSection, /syncCompetitorVisual|installCarVisual|createCarVisual/, 'Pool creation must not trigger model identity work');

const syncSection = section(main, 'function syncCompetitorVisuals()', '\nasync function syncCompetitorVisual');
assert.match(syncSection, /ensureCompetitorCars\(\)/, 'Identity sync must ensure the fixed visual pool exists');
assert.match(syncSection, /state\.competitorLaps\[i\]/, 'Identity sync must follow the current saved rival set');
assert.match(syncSection, /void syncCompetitorVisual\(car, lap\)/, 'Only the explicit identity sync path may request model changes');
assert.doesNotMatch(syncSection, /requestAnimationFrame|setAnimationLoop|setInterval/, 'Rival identity sync must create no recurring scheduler');

const placementSection = section(main, 'function placeCompetitorCars(dt)', '\nfunction updateScene');
assert.match(placementSection, /lapFrameAt\(lap, state\.lapElapsed\)/, 'The frame loop must continue sampling rival replay transforms');
assert.match(placementSection, /trackSampleAtProgress\(samples, frame\.p\)/, 'Rival elevation must remain frame-driven from replay progress');
assert.match(placementSection, /car\.position\.set\(frame\.x, trackSurfaceY\(surfaceSample\), frame\.z\)/, 'Rival X, Z and road height must remain frame-driven');
assert.match(placementSection, /car\.rotation\.x = trackPitch\(surfaceSample\)/, 'Rival road pitch must remain visual-frame work');
assert.match(placementSection, /car\.rotation\.y = frame\.h \+ Math\.PI/, 'Rival heading must remain frame-driven');
assert.match(placementSection, /if \(car === ghostCar\) animateWheels\(car, frame\.s, 45, dt\)/, 'The primary ghost wheel animation must remain visual-frame work');
assert.doesNotMatch(placementSection, /ensureCompetitorCars|syncCompetitorVisual|installCarVisual|createCarVisual/, 'The frame loop must perform no rival pool or model identity synchronisation');

const lapSection = section(main, 'function completeLap(now)', '\nfunction saveGhost');
assert.match(lapSection, /completeLapState\(/, 'Lap completion must retain the production race-state boundary');
assert.match(lapSection, /syncCompetitorVisuals\(\)/, 'A newly saved top-four lap must refresh rival model identity immediately');
assert.ok(
  lapSection.indexOf('completeLapState(') < lapSection.indexOf('syncCompetitorVisuals()'),
  'Rival identity must sync after the saved lap set has been updated'
);

const loadSection = section(main, 'function loadGhost()', '\nglobalThis.__turnHasGhosts');
assert.match(loadSection, /loadRivalsState\(/, 'Initial rival storage must still load through the shared race module');
assert.match(loadSection, /syncCompetitorVisuals\(\)/, 'Initial rival loading must install the stored models once');
assert.ok(
  loadSection.indexOf('loadRivalsState(') < loadSection.indexOf('syncCompetitorVisuals()'),
  'Stored rival identity must sync only after storage has populated the state'
);

assert.match(main, /competitorCars,\s*ensureCompetitorCars,\s*syncCompetitorVisuals,/, 'The runtime must expose separate pool and identity operations');
assert.match(main, /if \(root\.userData\.turnVisualKey === key \|\| root\.userData\.turnVisualPendingKey === key\) return;/, 'Model installation must retain its duplicate-key fast path');

const selectionSection = section(main, 'async function applyVehicleSelection(selection)', '\nvoid installCarVisual(playerCar');
assert.match(selectionSection, /if \(!state\.competitorLaps\.length\)/,
  'Only an empty rival roster should prepare the first saved rival from the player identity');
assert.match(selectionSection, /await installCarVisual\(ghostCar,[\s\S]*ghost: true/,
  'The first hidden rival visual must finish preparing before racing starts');
assert.ok(
  selectionSection.indexOf('await installCarVisual(playerCar')
    < selectionSection.indexOf('await installCarVisual(ghostCar'),
  'The visible player model should load before its hidden first-rival counterpart'
);

const createVisualSection = section(carModels, 'export async function createCarVisual({', '\nfunction reusableCompetitorGhostKey');
assert.match(createVisualSection, /competitorGhostTemplateCache\.get\(competitorTemplateKey\)/,
  'Repeated 5.5-unit rival identities must consult the in-memory visual template cache');
assert.ok(
  createVisualSection.indexOf('competitorGhostTemplateCache.get(competitorTemplateKey)')
    < createVisualSection.indexOf('const source = await loadCarSource(car.id)'),
  'A cached rival identity must avoid GLTF cloning, material classification and normalization entirely'
);
assert.match(createVisualSection, /return cloneCompetitorGhostVisual\(cachedCompetitorTemplate\)/,
  'Cached rival identities must use the lightweight clone path');
assert.match(createVisualSection, /rememberCompetitorGhostTemplate\(competitorTemplateKey, root\)/,
  'The first fully prepared rival identity must become the reusable template');

const cloneSection = section(carModels, 'function cloneCompetitorGhostVisual(template)', '\nfunction installWheelAnimationHostBridge');
assert.match(cloneSection, /for \(const child of template\.children\) clone\.add\(child\.clone\(true\)\)/,
  'Fast rival clones must reuse the already-prepared geometry/material graph');
assert.match(cloneSection, /frontWheelPivots\.push\(node\)/,
  'Fast rival clones must rebuild their own steering-pivot references');
assert.match(cloneSection, /turnFastGhostClone = true/,
  'The optimized path must remain inspectable in diagnostics');
assert.doesNotMatch(cloneSection, /loadCarSource|installSemanticCarFinish|normalizeModelToGround|addOutlines/,
  'Fast rival cloning must not repeat the expensive first-build pipeline');

const outlineSection = section(carModels, 'function addOutlines(model)', '\nfunction installFrontWheelSteeringRig');
assert.match(carModels, /const CAR_OUTLINE_MATERIAL = new THREE\.MeshBasicMaterial\(/,
  'All car outlines must share one immutable material instead of allocating one material per mesh');
assert.match(outlineSection, /new THREE\.Mesh\(node\.geometry, CAR_OUTLINE_MATERIAL\)/,
  'Outline meshes must reuse the shared material');
assert.doesNotMatch(outlineSection, /new THREE\.MeshBasicMaterial/,
  'Repeated rival creation must not allocate outline materials per mesh');

const normalizationSection = section(carModels, 'function normalizeModelToGround', '\nfunction isProtectedPart');
assert.match(carModels, /const normalizationMetricsCache = new Map\(\)/,
  'Geometry normalization metrics must be cached by stable car geometry identity');
assert.match(normalizationSection, /normalizationMetricsCache\.get\(cacheKey\)/,
  'Repeated visuals must reuse the already-measured footprint');
assert.equal(
  (normalizationSection.match(/new THREE\.Box3\(\)\.setFromObject\(model\)/g) || []).length,
  1,
  'A cold normalization may measure bounds once; the old second full scene traversal must not return'
);
assert.doesNotMatch(normalizationSection, /model\.updateMatrixWorld\(true\)[\s\S]*model\.updateMatrixWorld\(true\)/,
  'Normalization must not force two complete matrix/bounds passes per visual');

assert.doesNotMatch(trackRegistry, /rival-visual-prewarm/,
  'Track metadata loading must not own unrelated rival preparation side effects');

assert.match(airportWorld, /deferWreckCalibration: true/,
  'Production Airport must consolidate historical MAYDAY depth calibration into one pass');
assert.match(maydayPolish, /if \(options\.deferWreckCalibration !== true\) installWreckPenetration\(world, runtime\)/,
  'r494 must skip its legacy first-lap polling loop in production');
assert.match(maydayHud, /if \(options\.deferWreckCalibration !== true\) installWreckCalibration\(options\.world, runtime\)/,
  'r496 must skip its second legacy first-lap polling loop in production');
assert.match(maydayFinal, /deferredParentCalibration = options\.deferWreckCalibration === true/,
  'The final MAYDAY layer must know when it owns the complete tested wreck depth');
assert.match(maydayFinal, /mount\.position\.y -= TARGET_WRECK_PENETRATION_Y/,
  'The consolidated production path must apply the tested 16-unit penetration directly');
assert.match(maydayFinal, /turnMaydayR494DepthApplied = true[\s\S]*turnMaydayR496DepthApplied = true/,
  'Consolidated calibration must preserve historical depth-stage diagnostics');
assert.doesNotMatch(maydayFinal, /world\.updateMatrixWorld\(true\)/,
  'The final MAYDAY calibration must not synchronously traverse the whole Airport world');

const leaderRoofSection = section(leaderMarker, 'function carRoofHeight', '\nfunction installRuntime');
assert.match(leaderRoofSection, /child\.userData\?\.turnAssetVisual/, 'The leader marker must measure the installed rival model');
assert.match(leaderRoofSection, /child\.visible !== false/, 'The procedural car must remain a fallback while its asset loads');
assert.doesNotMatch(leaderRoofSection, /children\?\.\[0\]/, 'The hidden procedural body must not determine an installed rival model height');

const activationSection = section(trackManager, 'export async function activateTrack', '\nfunction installRuntime');
assert.match(activationSection, /loadRivalsState\(/, 'Track activation must load the selected track rival namespace');
assert.match(activationSection, /await ensureTrackState\(nextTrack, currentRuntime\)/,
  'Track activation must await the selected lazy world installer');
assert.match(activationSection, /currentRuntime\.syncCompetitorVisuals\?\.\(\)/, 'Track changes must refresh model identity once after rival loading');
assert.doesNotMatch(activationSection, /currentRuntime\.ensureCompetitorCars\?\.\(\)/, 'Track activation must not stop at pool creation without refreshing models');

const infrastructureSection = section(trackManager, 'function ensureTrackInfrastructure', '\nfunction isRaceParticle');
assert.match(infrastructureSection, /currentRuntime\.ensureCompetitorCars\?\.\(\)/, 'Dynamic-world setup must still create the full fixed rival pool before reparenting');
assert.doesNotMatch(infrastructureSection, /syncCompetitorVisuals/, 'World-layer setup must not perform unrelated model identity work');

console.log(`TURN ${release.id} event-driven rival synchronisation, deterministic first-rival preparation and MAYDAY finish-line fast paths passed.`);

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}
