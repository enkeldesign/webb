import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FLIGHT_LIMITS,
  checkpointReached,
  controlFromAngle,
  createFlightState,
  degreesToRadians,
  distanceBetween,
  formatCourseTime,
  headingToTarget,
  metresPerSecondToKnots,
  shortestAngle,
  updateFlightState
} from '../turnup/flight-model.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(repositoryRoot, path), 'utf8');
const [html, app, scene, css, readme, icon] = await Promise.all([
  read('turnup/index.html'),
  read('turnup/app.mjs'),
  read('turnup/scene.mjs'),
  read('turnup/styles.css'),
  read('turnup/README.md'),
  read('turnup/icon.svg')
]);

const tests = [];
function test(name, callback) {
  tests.push({ name, callback });
}

function simulate(state, controls, seconds, step = 0.05) {
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    updateFlightState(state, controls, Math.min(step, seconds - elapsed));
  }
  return state;
}

test('HTML exposes a mobile, accessible launch and fallback control surface', () => {
  assert.match(html, /<html lang="en"/);
  assert.match(html, /width=device-width, initial-scale=1, viewport-fit=cover/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no/i);
  assert.match(html, /TAKE OFF WITH TILT/);
  assert.match(html, /FLY WITH BUTTONS/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="targetNameValue"/);
  assert.match(html, /prefers-reduced-motion|styles\.css/);
});

test('the import map pins production map and rendering dependencies', () => {
  const importMapText = html.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(importMapText, 'import map is present');
  const imports = JSON.parse(importMapText).imports;
  assert.equal(imports['maplibre-gl'].includes('maplibre-gl@6.5.0'), true);
  assert.equal(imports.three.includes('three@0.184.0'), true);
  assert.equal(imports['/turn/input/motion.js'], '/turn/input/motion.js?revision=r164-ipad-motion-profile');
});

test('TURN UP imports the canonical TURN platform and steering engine', () => {
  assert.match(app, /from '\/turn\/platform\/web-platform\.js'/);
  assert.match(app, /from '\/turn\/platform\/platform-context\.js'/);
  assert.match(app, /motionPoseFromGravity/);
  assert.match(app, /resolveMotionSteeringProfile/);
  assert.match(app, /updateMotionInputState/);
  assert.match(app, /controlFromAngle\(motionState\.pitch - motionState\.neutralPitch/);
  assert.match(app, /scene\.mjs\?build=20260823-r1/);
  assert.doesNotMatch(app, /DeviceMotionEvent\.requestPermission/);
});

test('the real Midlanda–Söråker course uses open 3D map infrastructure', () => {
  assert.match(scene, /tiles\.openfreemap\.org\/styles\/liberty/);
  assert.match(scene, /tiles\.mapterhorn\.com\/tilejson\.json/);
  assert.match(scene, /type: 'raster-dem'/);
  assert.match(scene, /renderingMode: '3d'/);
  assert.match(scene, /defaultProjectionData\.mainMatrix/);
  assert.doesNotMatch(scene, /maplibregl\.supported/);
  assert.match(scene, /getContext\('webgl2'\)/);
  assert.match(app, /TURN UP needs WebGL2 for its 3D map/);
  assert.match(scene, /RUNWAY 16/);
  assert.match(scene, /SÖRÅKER/);
  assert.match(scene, /STRIND AREA/);
  assert.match(scene, /17\.66/);
  assert.match(scene, /maxBounds: \[\[17\.22, 62\.39\], \[17\.84, 62\.67\]\]/);
});

test('the map declutters labels and the chase camera follows aircraft elevation', () => {
  assert.match(scene, /new Set\(\['place', 'aerodrome_label'\]\)/);
  assert.match(scene, /layer\.type !== 'symbol'/);
  assert.match(scene, /visible \? 'visible' : 'none'/);
  assert.doesNotMatch(scene, /turn-up-buildings/);
  assert.match(scene, /centerClampedToGround: false/);
  assert.match(scene, /CAMERA_LOOK_AHEAD_METRES = 220/);
  assert.match(scene, /terrainAtOrigin \+ flightState\.position\.y - CAMERA_TARGET_DROP_METRES/);
  assert.match(scene, /elevation: targetElevation/);
  assert.match(scene, /targetLength: 40/);
});

test('the real-world map uses a natural semantic palette', () => {
  assert.match(scene, /function applyNaturalMapPalette/);
  assert.match(scene, /\['water', '#4e9fc6'\]/);
  assert.match(scene, /\['landcover_wood', '#6f9362'\]/);
  assert.match(scene, /background-color', '#9eb47a'/);
  assert.match(scene, /turn-up-semantic-landuse/);
  assert.match(scene, /\['farmland', 'farmyard'\], '#b6b77c'/);
  assert.match(scene, /layer\['source-layer'\] === 'aeroway'/);
});

test('aircraft asset is immutable, attributed and has an offline visual fallback', () => {
  assert.match(scene, /91d835e8e851b2317fe79af291c9fed6153fd525/);
  assert.match(scene, /B737_nologo\.glb/);
  assert.match(scene, /createFallbackAircraft/);
  assert.match(html, /CC BY 4\.0/);
  assert.match(readme, /AMV Lab/);
});

test('privacy and map credits are visible in the product', () => {
  assert.match(html, /general Strind area/);
  assert.match(html, /does not place a marker on a private home/);
  assert.match(html, /OpenStreetMap contributors/);
  assert.match(html, /Mapterhorn/);
});

test('TURN styling includes focus, contrast and reduced-motion treatment', () => {
  assert.match(css, /@import url\('\/turn\/design-tokens\.css/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-contrast: more\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(icon, /#38d9ff/);
  assert.match(icon, /#ff4fa3/);
});

test('pitch control has a calm dead zone and a reversible response', () => {
  assert.equal(controlFromAngle(degreesToRadians(1)), 0);
  const standard = controlFromAngle(degreesToRadians(10));
  const inverted = controlFromAngle(degreesToRadians(10), { invert: true });
  assert.ok(standard > 0 && standard < 1);
  assert.equal(inverted, -standard);
  assert.equal(controlFromAngle(degreesToRadians(40)), 1);
});

test('flight model turns, climbs, dives and respects its envelope', () => {
  const turn = simulate(createFlightState(), { turn: 1 }, 1);
  assert.ok(turn.heading < 0);
  assert.ok(Math.abs(turn.bank) <= FLIGHT_LIMITS.maximumBank);

  const climb = simulate(createFlightState({ y: 100 }), { pitch: 1, thrust: true }, 2);
  assert.ok(climb.position.y > 100);
  assert.ok(climb.pitch <= FLIGHT_LIMITS.maximumPitch);
  assert.ok(climb.throttle <= 1);

  const dive = simulate(createFlightState({ y: 200 }), { pitch: -1 }, 2);
  assert.ok(dive.position.y < 200);
  assert.ok(dive.speed <= FLIGHT_LIMITS.maximumSpeed);
});

test('low airspeed produces a stall and measurable sink', () => {
  const stalled = simulate(createFlightState({ y: 120, speed: 40, throttle: 0 }), {}, 1);
  assert.equal(stalled.stalled, true);
  assert.ok(stalled.verticalSpeed < 0);
  assert.ok(stalled.position.y < 120);
});

test('navigation and course helpers remain deterministic', () => {
  const position = { x: 0, y: 0, z: 0 };
  const target = { x: 30, y: 0, z: -40 };
  assert.equal(distanceBetween(position, target), 50);
  assert.equal(checkpointReached(position, target, 50), true);
  assert.equal(checkpointReached(position, target, 49.9), false);
  assert.ok(headingToTarget(position, target) > 0);
  assert.ok(Math.abs(shortestAngle(degreesToRadians(179), degreesToRadians(-179))) < degreesToRadians(3));
  assert.equal(formatCourseTime(65.2), '1:05.20');
  assert.equal(Math.round(metresPerSecondToKnots(100)), 194);
});

let failures = 0;
for (const { name, callback } of tests) {
  try {
    await callback();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

if (failures) {
  console.error(`\n${failures} TURN UP production test${failures === 1 ? '' : 's'} failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} TURN UP production tests passed.`);
}
