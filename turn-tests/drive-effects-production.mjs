import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// DRIFT and BOOST effects (#1209): render/drive-effects.js with the real three.js, no
// renderer. What it draws, what it reuses, and the camera kick it hands
// render/camera.js.
const THREE = await import(new URL('../turn/vendor/three-0.184.0/build/three.module.js', import.meta.url).href);
const {
  BOOST_CAMERA_KICK_DEGREES,
  OVERCHARGE_CAMERA_KICK_DEGREES,
  createDriveEffects,
  effectColour,
  readEffectColours
} = await import('../turn/render/drive-effects.js');
const { resolveCameraKickFov, updateRaceCameraState } = await import('../turn/render/camera.js');

const read = (path) => fs.readFile(new URL(path, import.meta.url), 'utf8');

function race() {
  return {
    position: new THREE.Vector3(0, 0, 0),
    velocity: new THREE.Vector3(0, 0, 40),
    speed: 40,
    steering: 0.3,
    driftSlipAngle: 0.4
  };
}
const forward = new THREE.Vector3(0, 0, 1);
const right = new THREE.Vector3(1, 0, 0);
function drive(effects, state, frames, inputs) {
  for (let frame = 0; frame < frames; frame += 1) {
    state.position.addScaledVector(state.velocity, 1 / 60);
    effects.update({ dt: 1 / 60, state, forward, right, ...inputs });
  }
}

// Colours come from the design tokens; without a page, their sRGB values.
const colours = readEffectColours(null);
const tokens = await read('../turn/design-tokens.css');
for (const [key, token] of [['boost', '--turn-yellow-400'], ['overcharge', '--turn-control-overcharge'],
  ['overchargeLight', '--turn-control-overcharge-light'], ['overchargeDeep', '--turn-control-overcharge-deep']]) {
  const declared = new RegExp(`${token}:\\s*(#[0-9a-f]{6});`, 'i').exec(tokens)?.[1];
  assert.equal(colours[key].toLowerCase(), declared.toLowerCase(), `${key} is ${token}`);
}
// Wide-gamut screens get the palette as color(display-p3 …), which three.js cannot parse.
const p3 = effectColour(THREE, 'color(display-p3 0.998 0.831 0.168)');
assert.equal(p3.getHexString(), 'fed42b', 'A display-p3 token still becomes its yellow');
assert.equal(effectColour(THREE, '#5f3dc4').getHexString(), '5f3dc4');

// Two drawable objects in all, created once.
const parent = new THREE.Group();
const effects = createDriveEffects({ THREE, parent, colours });
const drawables = [];
effects.group.traverse((object) => { if (object.isMesh) drawables.push(object); });
assert.equal(drawables.length, 2, 'One wake mesh and one instanced puff mesh');
const puffs = drawables.find((object) => object.isInstancedMesh);
const wake = drawables.find((object) => !object.isInstancedMesh);
assert.equal(puffs.count, 0);
assert.equal(wake.visible, false);
assert.equal(puffs.visible, false, 'Nothing is drawn while nothing happens');
assert.ok(puffs.instanceColor, 'Per-puff colour exists from the start, so the first puff does not recompile');
assert.equal(wake.material.forceSinglePass, true, 'The transparent double-sided wake draws in one pass');
assert.equal(wake.material.depthWrite, false);
assert.equal(puffs.material.depthWrite, false);

// DRIFT: puffs while sliding, from a fixed pool.
const state = race();
drive(effects, state, 60, { driftHeld: true, slip: 0.45 });
assert.equal(puffs.visible, true, 'A slide leaves smoke');
const livePuffs = () => Array.from(puffs.geometry.attributes.instanceAlpha.array).filter((alpha) => alpha > 0).length;
assert.ok(livePuffs() > 4, 'Several puffs at once');
const geometry = puffs.geometry;
drive(effects, state, 600, { driftHeld: true, slip: 0.45 });
assert.equal(puffs.geometry, geometry, 'The same geometry, frame after frame');
assert.equal(puffs.instanceMatrix.count, effects.puffCapacity, 'The pool never grows');
assert.ok(livePuffs() <= effects.puffCapacity);
drive(effects, state, 90, { driftHeld: false });
assert.equal(puffs.visible, false, 'Smoke clears after the slide');
const gentle = race();
const gentleEffects = createDriveEffects({ THREE, parent: new THREE.Group(), colours });
drive(gentleEffects, gentle, 30, { driftHeld: true, slip: 0.1 });
const gentlePuffs = gentleEffects.group.children.find((object) => object.isInstancedMesh);
const hard = race();
const hardEffects = createDriveEffects({ THREE, parent: new THREE.Group(), colours });
drive(hardEffects, hard, 30, { driftHeld: true, slip: 0.5 });
const hardPuffs = hardEffects.group.children.find((object) => object.isInstancedMesh);
const count = (mesh) => Array.from(mesh.geometry.attributes.instanceAlpha.array).filter((alpha) => alpha > 0).length;
assert.ok(count(hardPuffs) > count(gentlePuffs), 'A harder slide makes more smoke');

// BOOST: the wake and a kick that rises and eases away.
const boostState = race();
const boost = createDriveEffects({ THREE, parent: new THREE.Group(), colours });
const boostWake = boost.group.children.find((object) => object.isMesh && !object.isInstancedMesh);
drive(boost, boostState, 4, { boostActive: true, overcharge: 0 });
assert.equal(boostWake.visible, true, 'BOOST shows its wake at once');
const kickEarly = boostState.cameraKickFov;
assert.ok(kickEarly > 0 && kickEarly <= BOOST_CAMERA_KICK_DEGREES, `A kick of up to ${BOOST_CAMERA_KICK_DEGREES}°`);
drive(boost, boostState, 60, { boostActive: true, overcharge: 0 });
assert.ok(boostState.cameraKickFov < kickEarly / 2, 'The kick eases away while the burst goes on');
const head = boostWake.geometry.attributes.color;
const boostHead = new THREE.Color(head.getX(1), head.getY(1), head.getZ(1));
assert.equal(boostHead.getHexString(), effectColour(THREE, colours.boost).getHexString(), 'The wake starts in BOOST yellow');
drive(boost, boostState, 2, { boostActive: false });
assert.equal(boostWake.visible, false, 'Letting go ends the wake');
assert.equal(boostState.cameraKickFov, 0);

// OVERCHARGE: a stronger kick, its own colours, a wider wake.
const overState = race();
const over = createDriveEffects({ THREE, parent: new THREE.Group(), colours });
const overWake = over.group.children.find((object) => object.isMesh && !object.isInstancedMesh);
drive(over, overState, 5, { boostActive: true, overcharge: 0.6 });
assert.ok(overState.cameraKickFov > BOOST_CAMERA_KICK_DEGREES, 'OVERCHARGE kicks harder than BOOST');
assert.ok(overState.cameraKickFov <= OVERCHARGE_CAMERA_KICK_DEGREES);
const overPuffs = over.group.children.find((object) => object.isInstancedMesh);
assert.equal(overPuffs.visible, true, 'Its first moment throws OVERCHARGE sparks');
const overHeadColour = overWake.geometry.attributes.color;
const overHead = new THREE.Color(overHeadColour.getX(1), overHeadColour.getY(1), overHeadColour.getZ(1));
assert.equal(overHead.getHexString(), effectColour(THREE, colours.overchargeLight).getHexString(), 'OVERCHARGE light leads the wake');
const width = (mesh) => {
  const position = mesh.geometry.attributes.position;
  return Math.hypot(position.getX(0) - position.getX(2), position.getZ(0) - position.getZ(2));
};
drive(boost, boostState, 30, { boostActive: true, overcharge: 0 });
drive(over, overState, 30, { boostActive: true, overcharge: 0.6 });
assert.ok(width(overWake) > width(boostWake) * 1.2, 'OVERCHARGE runs wider, not only another colour');

// clear(): a restart, GARAGE or Home leaves nothing behind.
over.clear(overState);
assert.equal(overWake.visible, false);
assert.equal(overPuffs.visible, false);
assert.equal(overState.cameraKickFov, 0);

// Low Graphics thins the smoke and keeps the one-call wake.
const low = createDriveEffects({ THREE, parent: new THREE.Group(), colours, lowGraphics: true });
assert.ok(low.puffCapacity < effects.puffCapacity);
assert.equal(low.group.children.length, 2);

// The camera owner applies the kick; Reduced Motion never does, and it never builds
// into the speed FOV.
assert.equal(resolveCameraKickFov({ kick: 4, reducedMotion: true }), 0);
assert.equal(resolveCameraKickFov({ kick: 4, reducedMotion: false }), 4);
assert.equal(resolveCameraKickFov({ kick: 40, reducedMotion: false }), 6, 'Never more than 6°');
function cameraRun({ kicks, reducedMotion }) {
  const camera = new THREE.PerspectiveCamera(68, 1.5, 0.1, 900);
  const cameraState = {
    ...race(), speed: 30, heading: 0, nearestTrackIndex: 0, driftCameraYawOffset: 0, sensorMode: false
  };
  const fovs = [];
  for (const kick of kicks) {
    cameraState.cameraKickFov = kick;
    updateRaceCameraState({
      state: cameraState,
      camera,
      cameraPosition: new THREE.Vector3(),
      cameraTarget: new THREE.Vector3(),
      getForward: () => forward,
      getRight: () => right,
      samples: [],
      maxSpeed: 60,
      dt: 1 / 60,
      reducedMotion
    });
    fovs.push(camera.fov);
  }
  return fovs;
}
const steady = cameraRun({ kicks: Array(240).fill(0), reducedMotion: false });
const kicked = cameraRun({ kicks: [...Array(120).fill(0), ...Array(20).fill(5), ...Array(100).fill(0)], reducedMotion: false });
assert.ok(kicked[130] > steady[130] + 4, 'The kick widens the view on top of the speed FOV');
assert.ok(Math.abs(kicked.at(-1) - steady.at(-1)) < 1e-9, 'and leaves nothing behind once it ends');
const still = cameraRun({ kicks: [...Array(120).fill(0), ...Array(20).fill(5), ...Array(100).fill(0)], reducedMotion: true });
assert.ok(still.every((fov) => Math.abs(fov - 68) < 1e-6), 'Reduced Motion keeps the base view, through a burst too');

// main.js: no other effect owner, cleared with the race, compiled up front.
const main = await read('../turn/main.js');
assert.doesNotMatch(main, /smokePool|flamePool|launchParticle/, 'The per-mesh particle pools are gone');
assert.match(main, /const driveEffects = createDriveEffects\(\{ THREE, parent: world, lowGraphics: graphicsProfile\.lowGraphics \}\);\ndriveEffects\.warm\(renderer, camera, scene\);/);
assert.match(main, /\['race-started', 'race-reset', 'lot-open', 'home-open'\]\.includes\(event\.detail\?\.reason\)\) driveEffects\.clear\(state\);/);
const module = await read('../turn/render/drive-effects.js');
assert.doesNotMatch(module, /requestAnimationFrame|setInterval|setTimeout/, 'No frame loop or timer of its own');

console.log('TURN DRIFT and BOOST effects: two draw calls, pooled, token colours, OVERCHARGE wider and stronger, cleared with the race, kick through the camera owner and none under Reduced Motion passed.');
