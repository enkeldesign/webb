import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

const [
  plannedWorld,
  worldAssets,
  beauty,
  identity,
  intensity,
  cleanup,
  landmark,
  worldRender,
  app,
  index,
  labIndex,
  attribution,
  bella,
  bellaRescue,
  visualHarness,
  visualSmoke,
  visualWorkflow
] = await Promise.all([
  readText('../turn/tracks/countryside-world-r531.js'),
  readText('../turn/world-assets.js'),
  readText('../turn/world-beauty.js'),
  readText('../turn/track-identity.js'),
  readText('../turn/section-intensity.js'),
  readText('../turn/tracks/countryside-scenery-r177.js'),
  readText('../turn/tracks/kenney-track-landmarks-r517.js'),
  readText('../turn/render/world.js'),
  readText('../turn/app.js'),
  readText('../turn/index.html'),
  readText('../turn-lab/index.html'),
  readText('../turn/assets/KENNEY-ASSETS.md'),
  readBuffer('../turn/tracks/countryside-bella-r166.js'),
  readBuffer('../turn/tracks/countryside-bella-rescue-r524.js'),
  readText('../turn-lab/countryside-visual.html'),
  readText('./countryside-visual-smoke.mjs'),
  readText('../.github/workflows/turn-countryside-visual-smoke.yml')
]);

assert.match(plannedWorld, /REVISION = 'r532-countryside-nature-polish'/);
assert.match(plannedWorld, /name = 'Countryside Planned World'/);
assert.match(plannedWorld, /districts: \['paddock', 'forest-edge', 'nature-landscape', 'windmill-farm', 'orchard', 'village', 'lake'\]/);
assert.match(plannedWorld, /name = 'Countryside Birchfield Village'/);
assert.match(plannedWorld, /name = 'Countryside Windmill Farm Fields'/);
assert.match(plannedWorld, /name = 'Countryside Ordered Orchard'/);
assert.match(plannedWorld, /name = 'Countryside Lake Life'/);
assert.match(plannedWorld, /name = 'Countryside Nature Kit Landscape'/);
assert.match(plannedWorld, /five large-scale copses with layered canopy, understorey, meadow grass and rock accents/);
assert.match(plannedWorld, /natureCopses: nature\.copses/);
assert.match(plannedWorld, /natureCanopyTrees: nature\.canopyTrees/);
assert.match(plannedWorld, /gameplayGeometryUnchanged = true/);
assert.match(plannedWorld, /BELLA_CLEAR_RADIUS = 34/);
assert.match(plannedWorld, /function bellaProtectedPoint\(/);
assert.match(plannedWorld, /safelyOutsideBella\(position, protectedPoint\)/g,
  'Every authored land district must respect the protected Bella clearing');
assert.match(plannedWorld, /turnTownPlan = 'five red homes around a T-shaped gravel lane/);
assert.match(plannedWorld, /turnTownPlan = 'parallel crop beds contained by a roadside fence and centred gate'/);
assert.match(plannedWorld, /turnTownPlan = 'two aligned rows with a clear sightline between trunks'/);
assert.match(plannedWorld, /turnPalette: 'Swedish-red variation B'/);
assert.match(plannedWorld, /mesh\.userData\.turnPaletteLocked = true/,
  'Village lanes, farm soil and orchard ground must keep their planned rural palette');
assert.match(plannedWorld, /turnStaticSceneryCar = true/);
assert.match(plannedWorld, /randomZoneLandmarks: 0/);
assert.match(plannedWorld, /scatteredTownBuildings: 0/);
assert.doesNotMatch(
  plannedWorld,
  /resolveWorldCollisionState|collisionProfile|freeRoamDistance|checkpoint|lapActive|setAnimationLoop|requestAnimationFrame|setInterval/,
  'The redesign must remain a one-shot decorative layer with no gameplay or animation-loop changes'
);
assert.doesNotMatch(plannedWorld, /samples\[[^\]]+\]\s*=|\.point\.set\(|world\.remove\(/,
  'The planned world must not rewrite track samples or remove gameplay objects');

assert.match(worldAssets, /installCountrysideWorld/);
assert.match(worldAssets, /function placeTreeBelt/,
  'The familiar original tree belt must remain');
assert.doesNotMatch(worldAssets, /building-small-[a-d]\.glb|building-garage\.glb|pavement-fountain\.glb|placeTracksideTown/,
  'The scattered generic City Builder town must not return');

assert.doesNotMatch(beauty, /addTownPads|addSigns|BRAKE\?|FOREST|TOWN|GO!/,
  'Unexplained parking pads and billboard slogans must not return');
assert.doesNotMatch(beauty, /addPaddock|barrierColors|BoxGeometry\(58, 0\.12, 34\)/,
  'The broad parking slab and random coloured blocks must not return');
assert.doesNotMatch(beauty, /addZoneGround|addGroundPatch/,
  'Legacy section-coloured ground patches must not return');
assert.doesNotMatch(beauty, /addFlowerFields|DodecahedronGeometry\(0\.32|proceduralFlower/,
  'Tiny procedural coloured flower dots must not return');
assert.match(beauty, /prepareModel\(source, 12 \+ seeded01\(15100 \+ i\) \* 9/,
  'Beauty-pass tree clusters must read at a substantial landscape scale');
assert.match(worldAssets, /targetHeight = 11\.5 \+ secondRandom \* 9/,
  'Original tree-belt clusters must no longer appear miniature');

assert.doesNotMatch(identity, /TorusGeometry|RingGeometry|crystalLandmark|sunsetLandmark|addTurnLandmarks|tintTracksideAssets/,
  'The gold ring, crystals and global scenery tint must be gone');
assert.match(identity, /randomZoneLandmarks: 0/);
assert.match(identity, /globalAssetTinting: false/);

assert.doesNotMatch(intensity, /new THREE\.|setTimeout|turnSectionPunch/,
  'Section identity must no longer add coloured geometry or recolour scenery');
assert.match(intensity, /colouredVerges: 0/);
assert.match(intensity, /repeaterPosts: 0/);
assert.match(intensity, /sceneryMaterialTints: 0/);

assert.doesNotMatch(cleanup, /VEHICLE_SLOTS|createCarVisual|relocateLakeBuildings|expectedTownPlacements/,
  'The legacy random roadside traffic and lake-building relocation hack must be gone');
assert.match(cleanup, /scatteredRoadsideVehicles: 0/);
assert.match(cleanup, /lakeRelocationHacks: 0/);

assert.match(landmark, /paletteLocked: true/);
assert.match(landmark, /outline: false/,
  'Thin windmill sail panels must not be obscured by a back-face contour shell');
assert.match(landmark, /turnBladePalette = 'authored warm wood and pale sail cloth'/);
assert.match(landmark, /node\.userData\.turnPaletteLocked = true/);
assert.match(landmark, /node\.userData\.turnZoneStyled = true/);

assert.match(worldRender, /world-beauty\.js\?revision=r532-countryside-nature-polish/);
assert.match(worldRender, /track-identity\.js\?revision=r532-countryside-nature-polish/);
assert.match(worldRender, /section-intensity\.js\?revision=r532-countryside-nature-polish/);
assert.match(worldRender, /countryside-scenery-r177\.js\?revision=r532-countryside-nature-polish/);
assert.match(app, /render\/world\.js\?revision=r532-countryside-nature-polish/);
assert.match(index, /world-assets\.js\?build=20260823-r183&revision=r532-countryside-nature-polish/);
assert.match(index, /kenney-track-landmarks-r517\.js\?revision=r532-countryside-nature-polish/);
assert.match(index, /app\.js\?build=[^"']*-r532-countryside-nature/);
assert.match(labIndex, /world-assets\.js\?build=20260823-r183&revision=r532-countryside-nature-polish/);

assert.equal(sha256(bella), '7133abe99b37322407cebe8ab4c627e3cd91663c3a981427fd328d403a734bf4',
  'BELLA and her rescue tree implementation must remain byte-for-byte unchanged');
assert.equal(sha256(bellaRescue), '608464227f3a19e0b08eafc747d55276d1cbed5364a45232fb45d3973dd9c58a',
  'BELLA rescue behavior must remain byte-for-byte unchanged');

const suburbanFiles = [
  'building-type-a.glb',
  'building-type-b.glb',
  'building-type-h.glb',
  'building-type-m.glb',
  'building-type-s.glb',
  'building-type-u.glb',
  'driveway-short.glb',
  'fence-low.glb'
];
for (const file of suburbanFiles) {
  const glb = readGlb(await readBuffer(`../turn/assets/scenery/countryside/suburban/${file}`));
  assert.equal(glb.images?.[0]?.uri, 'Textures/colormap.png', `${file} must keep the local Suburban palette path`);
}

const suburbanPalette = await readBuffer('../turn/assets/scenery/countryside/suburban/Textures/colormap.png');
assert.equal(sha256(suburbanPalette), '476b218961c0485bc4c32f80368db7cfdd5d3f1aba2573ad941069996c89bc5f',
  'Birchfield must keep Kenney City Kit Suburban Variation B');

const natureFiles = [
  'crops_wheatStageB.glb', 'crops_cornStageD.glb', 'crops_dirtDoubleRow.glb',
  'fence_simple.glb', 'fence_gate.glb', 'tree_oak.glb', 'tree_default.glb',
  'tree_small.glb', 'tree_pineRoundB.glb', 'plant_bushDetailed.glb',
  'plant_bushLarge.glb', 'grass_large.glb', 'log_stack.glb', 'rock_largeA.glb',
  'rock_largeB.glb', 'rock_smallD.glb', 'stump_oldTall.glb'
];
for (const file of natureFiles) {
  const glb = readGlb(await readBuffer(`../turn/assets/scenery/countryside/nature/${file}`));
  assert.ok(glb.meshes?.length >= 1, `${file} must contain real Kenney geometry`);
  assert.equal(glb.images?.length || 0, 0, `${file} should remain a compact flat-material Nature asset`);
}

const boat = readGlb(await readBuffer('../turn/assets/scenery/watercraft/boat-row-small.glb'));
assert.equal(boat.images?.[0]?.uri, 'Textures/colormap.png');
assert.match(attribution, /COUNTRYSIDE planned world/);
assert.match(attribution, /Swedish-red house family/);
assert.match(attribution, /protected clearing around BELLA and her tree/);
assert.match(attribution, /retired global zone tint/);

assert.match(visualHarness, /installKenneyWorld/);
assert.match(visualHarness, /installCountrysideBella/);
assert.match(visualHarness, /installCountrysideWindmill/);
assert.match(visualHarness, /__turnSetCountrysideVisualView/);
for (const view of ['aerial', 'first-impression', 'nature', 'village', 'farm-windmill', 'orchard', 'lake', 'bella']) {
  assert.match(visualSmoke, new RegExp(`['\"]${view}['\"]`), `Visual smoke must capture the ${view} view`);
}
assert.match(visualSmoke, /lockedPaletteViolations/);
assert.match(visualSmoke, /closestPlannedGeometryToBella/);
assert.match(visualWorkflow, /playwright@1\.55\.0/);
assert.match(visualWorkflow, /countryside-visual-smoke/);

console.log('TURN planned COUNTRYSIDE world, protected BELLA scene and Kenney asset palette passed.');

function readText(relative) {
  return fs.readFile(new URL(relative, import.meta.url), 'utf8');
}

function readBuffer(relative) {
  return fs.readFile(new URL(relative, import.meta.url));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function readGlb(buffer) {
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.subarray(16, 20).toString('ascii'), 'JSON');
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
}
