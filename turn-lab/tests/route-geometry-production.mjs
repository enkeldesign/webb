import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { register } from 'node:module';

// SWOOSH route geometry (#909, #928): bends from the centreline, equal-angle segments of
// at most 90°, each read from the road's heading at its own start. Synthetic tracks pin
// the rules; every production track is then parsed and cross-checked.
const threeUrl = new URL('../../turn/vendor/three-0.184.0/build/three.module.js', import.meta.url).href;
register(`data:text/javascript,export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: ${JSON.stringify(threeUrl)}, shortCircuit: true };
  return next(specifier, context);
}`);

const { computeRouteGeometry, upcomingRouteSegments, ROUTE_DIRECTION } = await import('../../turn/audio/route-geometry.js');
const { createTrackRuntime } = await import('../../turn/tracks/catalog.js');
const { TRACK_DEFINITIONS } = await import('../../turn/tracks/definitions.js');
const { getTrackPaceNotes } = await import('../../turn/tracks/pace-notes.js');

const SPACING = 0.5;
const DEG = Math.PI / 180;

// A closed track from turtle steps: ['S', metres] or ['R'|'L', degrees, radius]. Heading
// h gives tangent (sin h, cos h); turning right lowers h (TURN's y-up world).
function track(steps, { rotate = 0, mirror = false, jitter = 0 } = {}) {
  let x = 0;
  let z = 0;
  let h = rotate;
  const samples = [];
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  for (const [kind, amount, radius] of steps) {
    // Whole samples per step, each turning an exact share, so a 180° arc turns 180°.
    const sampleCount = Math.max(1, Math.round((kind === 'S' ? amount : amount * DEG * radius) / SPACING));
    const turn = kind === 'S' ? 0 : (kind === 'R' ? -1 : 1) * amount * DEG / sampleCount;
    for (let index = 0; index < sampleCount; index += 1) {
      const wobble = jitter ? random() * jitter * DEG : 0;
      const heading = h + wobble;
      samples.push({ point: { x: mirror ? -x : x, z }, tangent: { x: mirror ? -Math.sin(heading) : Math.sin(heading), z: Math.cos(heading) } });
      x += Math.sin(h) * SPACING;
      z += Math.cos(h) * SPACING;
      h += turn;
    }
  }
  return samples;
}

const sides = (route) => route.segments.map((segment) => segment.side[0].toUpperCase()).join('');
const angles = (route) => route.segments.map((segment) => Math.round(segment.angleDegrees));
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

// Stadium: two continuous 180° right-handers. N → E → S is two linked RIGHT swooshes.
{
  const route = computeRouteGeometry(track([['S', 200], ['R', 180, 40], ['S', 200], ['R', 180, 40]]));
  assert.equal(sides(route), 'RRRR', 'each 180° right-hander is RIGHT → RIGHT');
  assert.deepEqual(angles(route), [90, 90, 90, 90]);
  assert.deepEqual(route.segments.map((segment) => `${segment.part}/${segment.parts}`), ['1/2', '2/2', '1/2', '2/2']);
  for (const segment of route.segments) near(segment.peakRadius, 40, 3, 'a 40 m hairpin reads as radius 40');
}

// S-curve N → E → N, then a wide return. R → L, never R → nothing: the net heading of
// the S is zero, but both turns stay.
const sCurve = [['S', 100], ['R', 90, 30], ['L', 90, 30], ['S', 100], ['R', 180, 60], ['S', 400], ['R', 180, 90], ['S', 140]];
{
  const route = computeRouteGeometry(track(sCurve));
  assert.equal(sides(route).slice(0, 2), 'RL', 'N → E → N is RIGHT → LEFT');
  assert.deepEqual(angles(route).slice(0, 2), [90, 90]);
  const mirrored = computeRouteGeometry(track(sCurve, { mirror: true }));
  assert.equal(sides(mirrored).slice(0, 2), 'LR', 'the mirrored S is LEFT → RIGHT');
  for (const rotate of [37, 90, 180, 271]) {
    const rotated = computeRouteGeometry(track(sCurve, { rotate: rotate * DEG }));
    assert.equal(sides(rotated), sides(route), `rotating the track ${rotate}° keeps the sequence`);
    assert.deepEqual(angles(rotated), angles(route));
  }
}

// Equal-angle splitting: 160° is 80 + 80, 198° is 66 + 66 + 66, a 90° bend stays whole.
{
  const route = computeRouteGeometry(track([['S', 150], ['R', 160, 50], ['S', 150], ['R', 198, 35], ['S', 60], ['R', 2, 400]]));
  const bends = route.segments.filter((segment) => segment.bendAngleDegrees > 100);
  assert.deepEqual(bends.map((segment) => Math.round(segment.angleDegrees)), [80, 80, 66, 66, 66], 'equal-angle parts');
  const tight = computeRouteGeometry(track([['S', 100], ['R', 90, 25], ['S', 300], ['R', 270, 60]]));
  assert.equal(tight.segments[0].parts, 1, 'exactly 90° is one swoosh');
  for (const segment of route.segments) assert.ok(segment.angleDegrees <= 90.5, 'no swoosh exceeds 90° (within measurement accuracy)');
}

// Tightness is curvature, not angle: a 20° kink at radius 15 is tighter than a 90°
// sweeper at radius 150, and gentle heading-changing bends (N → NNE) are kept.
{
  const route = computeRouteGeometry(track([['S', 200], ['L', 20, 15], ['S', 150], ['L', 90, 150], ['S', 150], ['R', 22.5, 300], ['S', 150], ['L', 112.5, 120], ['L', 140, 60]]));
  const kink = route.segments.find((segment) => Math.round(segment.angleDegrees) === 20);
  const sweeper = route.segments.find((segment) => Math.round(segment.angleDegrees) === 90 && segment.side === 'left');
  const gentle = route.segments.find((segment) => segment.side === 'right');
  // Sustained curvature spreads the 5 m kink over 12 m of road: still r < 40 against r150.
  assert.ok(kink && sweeper && kink.peakCurvature > sweeper.peakCurvature * 4, 'the short kink is far tighter than the long sweeper');
  assert.ok(gentle, 'a 22.5° bend at radius 300 (N → NNE) is a swoosh');
  near(gentle.angleDegrees, 22.5, 1, 'gentle bend angle');
}

// Sampling noise on straights is not route; the lap seam never splits a bend.
{
  const clean = computeRouteGeometry(track([['S', 300], ['R', 180, 50], ['S', 300], ['R', 180, 50]]));
  const noisy = computeRouteGeometry(track([['S', 300], ['R', 180, 50], ['S', 300], ['R', 180, 50]], { jitter: 0.4 }));
  assert.equal(sides(noisy), sides(clean), 'jitter adds no swooshes');
  const samples = track([['R', 90, 50], ['S', 300], ['R', 180, 50], ['S', 300], ['R', 90, 50]]);
  const seam = computeRouteGeometry(samples);
  assert.equal(seam.bends.length, 2, 'a bend across the lap seam is one bend');
  assert.deepEqual(seam.bends.map((bend) => Math.round(bend.angleDegrees)).sort(), [180, 180]);
}

// Turning that runs through the lap seam is counted once: a plain circle is 360° in
// four 90° swooshes, and a seam-crossing bend next to another bend keeps its angle.
{
  const circle = computeRouteGeometry(track([['R', 360, 80]]));
  assert.deepEqual(angles(circle), [90, 90, 90, 90], 'a circle is four 90° swooshes');
  const loop = computeRouteGeometry(track([['R', 45, 60], ['S', 200], ['R', 180, 50], ['S', 200], ['R', 135, 60]]));
  assert.deepEqual(loop.bends.map((bend) => Math.round(bend.angleDegrees)).sort((a, b) => a - b), [180, 180], 'the seam bend is 45° + 135°, counted once');
}

// Corners joined by gentler road in the same direction are separate bends.
{
  const route = computeRouteGeometry(track([['S', 100], ['R', 80, 30], ['R', 30, 600], ['R', 80, 30], ['S', 400], ['R', 170, 80]]));
  const first = route.bends[0];
  assert.ok(first.angleDegrees < 100, `two right corners with a relief between are two bends (${Math.round(first.angleDegrees)}°)`);
}

// Upcoming segments wrap past the line.
{
  const route = computeRouteGeometry(track([['S', 200], ['R', 180, 40], ['S', 200], ['R', 180, 40]]));
  const ahead = upcomingRouteSegments(route, route.trackLength - 10, 2);
  assert.equal(ahead.length, 2);
  assert.ok(ahead[0].ahead < ahead[1].ahead && ahead[0].ahead >= 0);
}

// Every production track parses, its swooshes honour the rules, and every hand-written
// pace note has a computed swoosh on the same side close behind its trigger.
for (const definition of TRACK_DEFINITIONS) {
  const runtime = createTrackRuntime(definition.id, definition.sampleCount || 2160);
  const route = computeRouteGeometry(runtime.samples);
  assert.ok(route.segments.length >= 3, `${definition.id}: swooshes found`);
  near(route.trackLength, runtime.trackLength, runtime.trackLength * 0.01, `${definition.id}: track length`);
  const net = route.bends.reduce((sum, bend) => sum + bend.direction * bend.angleDegrees, 0);
  assert.ok(Math.abs(Math.abs(net) - 360) < 25, `${definition.id}: bends add up to one lap (${Math.round(net)}°)`);
  for (const segment of route.segments) {
    assert.ok(segment.angleDegrees <= 90.5 && segment.length > 0 && segment.peakCurvature >= segment.averageCurvature * 0.5);
  }
  // Each hand-written phrase's groups appear as swooshes on the same sides, in the same
  // order, starting just behind or after its trigger.
  const count = runtime.samples.length;
  const lapFraction = (segment, from) => (((segment.startIndex / count) - from) % 1 + 1) % 1;
  for (const note of getTrackPaceNotes(definition.id)) {
    const ahead = route.segments
      .filter((segment) => lapFraction(segment, note.triggerStart - 0.03) < 0.33)
      .sort((a, b) => lapFraction(a, note.triggerStart - 0.03) - lapFraction(b, note.triggerStart - 0.03));
    let cursor = 0;
    for (const group of note.groups) {
      const side = group.direction === ROUTE_DIRECTION.RIGHT ? 'right' : 'left';
      while (cursor < ahead.length && ahead[cursor].side !== side) cursor += 1;
      assert.ok(cursor < ahead.length, `${definition.id} ${note.id}: a ${side} swoosh where the hand-written note has one`);
      cursor += 1;
    }
  }
}

// The admin route HUD: admin profiles only, above blank screen, silent to screen readers,
// and loaded by the production page.
{
  const hud = await fs.readFile(new URL('../../turn/testing/route-test-hud.js', import.meta.url), 'utf8');
  const blank = await fs.readFile(new URL('../../turn/ui/screen-blanking.js', import.meta.url), 'utf8');
  const page = await fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8');
  assert.match(hud, /if \(!isAdminProfile\(\) \|\| !document\.body\) return;/, 'the HUD installs nothing for players');
  assert.match(hud, /'turn-admin-unlock-v1'/);
  assert.match(hud, /setAttribute\('aria-hidden', 'true'\)/, 'the HUD is silent to screen readers');
  const hudLayer = Number(hud.match(/z-index: (\d+);/)[1]);
  const blankLayers = [...blank.matchAll(/z-index: (\d+);/g)].map((match) => Number(match[1]));
  assert.ok(hudLayer > Math.max(...blankLayers), 'the HUD stays visible above blank screen');
  assert.match(page, /<script type="module" src="\.\/testing\/route-test-hud\.js\?build=/);
}

console.log('TURN route geometry: equal-angle swooshes ≤90°, per-segment perspective, mirrored/rotated/seam cases and all production tracks passed.');
