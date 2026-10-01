// SWOOSH route geometry (#909): the bends of a closed track, derived from its
// centreline, as the segments a SWOOSH will paint.
//
// - A bend is a run of road turning one way. Left and right are never merged, so an
//   S-curve is two bends even when it ends on the heading it started with.
// - A bend over 90° is split into equal-angle segments (n = ceil(angle / 90°)), so
//   160° is 80° + 80° and 198° is 66° + 66° + 66°. Equal angles, not equal lengths:
//   each segment keeps its own length and tightness.
// - Direction is relative to the road's heading at the start of each segment, so
//   rotating or mirroring a track never changes the sequence (mirroring swaps sides).
// - Tightness is curvature (κ = dθ/ds = 1/R), not total angle. Each segment carries its
//   average curvature and the tightest sustained curvature, smoothed over a stretch of
//   road so a single noisy sample cannot read as a hairpin.
//
// Pure functions over plain { point: { x, z }, tangent: { x, z } } samples spaced
// evenly along the track; no three.js, no DOM. The thresholds below remove geometric
// noise only; they are tuning values shown in the admin route HUD, not product rules.

export const ROUTE_GEOMETRY_TUNING = Object.freeze({
  // Curvature is averaged over this much road before anything else reads it.
  smoothingMetres: 8,
  // The tightest sustained curvature is averaged over this much road.
  sustainedMetres: 12,
  // Road is turning while its smoothed curvature exceeds this (1/m; radius 2 km), low
  // enough that long gentle bends still count: every lap's bends add up to ~360°.
  turningCurvature: 1 / 2000,
  // A same-direction bend that eases off for less than this much road stays one bend.
  joinGapMetres: 10,
  // Corners joined by road that keeps turning the same way, but much more gently, are
  // separate bends: cut where the curvature (averaged over reliefMetres) eases to at most
  // this fraction of the tighter part on both sides.
  reliefMetres: 30,
  reliefRatio: 0.35,
  // Bends that change heading by less than this are sampling noise, not route.
  noiseAngleDegrees: 3,
  // One SWOOSH never represents more than this much heading change...
  maxSegmentDegrees: 90,
  // ...within measurement accuracy: a sampled 180° hairpin can measure 180.3°, and must
  // still be two swooshes, not three.
  splitToleranceDegrees: 1
});

export const ROUTE_DIRECTION = Object.freeze({ LEFT: -1, RIGHT: 1 });

const DEGREES = 180 / Math.PI;

function wrapAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= 2 * Math.PI;
  while (value < -Math.PI) value += 2 * Math.PI;
  return value;
}

function headingOf(sample) {
  return Math.atan2(sample.tangent.x, sample.tangent.z);
}

// Signed heading change per sample: positive is a RIGHT turn. TURN's world is y-up
// with the right-hand side of travel at (-tangent.z, tangent.x), so turning right
// lowers atan2(x, z).
function turnPerSample(samples) {
  const count = samples.length;
  const headings = samples.map(headingOf);
  return headings.map((heading, index) => -wrapAngle(headings[(index + 1) % count] - heading));
}

function movingAverage(values, radius) {
  const count = values.length;
  const result = new Array(count);
  let sum = 0;
  for (let offset = -radius; offset <= radius; offset += 1) sum += values[(offset + count) % count];
  for (let index = 0; index < count; index += 1) {
    result[index] = sum / (2 * radius + 1);
    sum += values[(index + radius + 1) % count] - values[(index - radius + count) % count];
  }
  return result;
}

function pointDistance(a, b) {
  return Math.hypot(a.point.x - b.point.x, a.point.z - b.point.z);
}

function trackLengthOf(samples) {
  let length = 0;
  for (let index = 0; index < samples.length; index += 1) {
    length += pointDistance(samples[index], samples[(index + 1) % samples.length]);
  }
  return length;
}

// Runs of samples turning one way, as { side, from, length } in sample counts from a
// straight starting sample, so no bend is cut in two at the lap seam.
function bendRuns(curvature, side, joinGapSamples) {
  const count = curvature.length;
  let start = curvature.findIndex((value) => side(value) === 0);
  if (start < 0) {
    // The whole lap turns: start where the turning direction changes, else anywhere.
    start = curvature.findIndex((value, index) => side(value) !== side(curvature[(index + count - 1) % count]));
    if (start < 0) start = 0;
  }

  const runs = [];
  let run = null;
  let gap = 0;
  for (let step = 0; step < count; step += 1) {
    const index = (start + step) % count;
    const turn = side(curvature[index]);
    if (run && turn === run.side) {
      run.length = step - run.from + 1;
      gap = 0;
      continue;
    }
    if (run && turn === 0 && gap < joinGapSamples) {
      gap += 1;
      continue;
    }
    if (run) runs.push(run);
    run = turn ? { side: turn, from: step, length: 1 } : null;
    gap = 0;
  }
  if (run) runs.push(run);
  return { start, runs };
}

// Cut a same-direction run at its deepest relief: a dip in curvature to at most
// reliefRatio of the peak on both sides. Recurse until no relief remains.
function splitByRelief(run, curvatureAt, ratio, minimumSamples) {
  const values = Array.from({ length: run.length }, (_, offset) => Math.abs(curvatureAt(run.from + offset)));
  let best = null;
  for (let cut = minimumSamples; cut < run.length - minimumSamples; cut += 1) {
    const value = values[cut];
    if (value > values[cut - 1] || value > values[cut + 1]) continue;
    const before = Math.max(...values.slice(0, cut));
    const after = Math.max(...values.slice(cut + 1));
    const depth = value / Math.min(before, after);
    if (depth <= ratio && (!best || depth < best.depth)) best = { cut, depth };
  }
  if (!best) return [run];
  return [
    ...splitByRelief({ side: run.side, from: run.from, length: best.cut + 1 }, curvatureAt, ratio, minimumSamples),
    ...splitByRelief({ side: run.side, from: run.from + best.cut + 1, length: run.length - best.cut - 1 }, curvatureAt, ratio, minimumSamples)
  ];
}

/**
 * The bends of a closed track and the SWOOSH segments that paint them.
 * @param {Array<{point:{x:number,z:number},tangent:{x:number,z:number}}>} samples
 *   evenly spaced along the centreline, in driving order.
 */
export function computeRouteGeometry(samples, tuning = ROUTE_GEOMETRY_TUNING) {
  const count = samples?.length || 0;
  if (count < 8) return Object.freeze({ trackLength: 0, sampleSpacing: 0, bends: [], segments: [] });

  const trackLength = trackLengthOf(samples);
  const spacing = trackLength / count;
  const turn = turnPerSample(samples);
  const smoothing = Math.max(1, Math.round(tuning.smoothingMetres / spacing / 2));
  const sustained = Math.max(smoothing, Math.round(tuning.sustainedMetres / spacing / 2));
  const curvature = movingAverage(turn, smoothing).map((value) => value / spacing);
  const sustainedCurvature = movingAverage(turn, sustained).map((value) => Math.abs(value) / spacing);
  const side = (value) => (Math.abs(value) < tuning.turningCurvature ? 0 : Math.sign(value));
  const joinGapSamples = Math.round(tuning.joinGapMetres / spacing);
  const { start, runs: turningRuns } = bendRuns(curvature, side, joinGapSamples);
  const relief = movingAverage(turn, Math.max(1, Math.round(tuning.reliefMetres / spacing / 2)));
  const reliefAt = (step) => relief[((start + step) % count + count) % count];
  const runs = turningRuns.flatMap((run) => splitByRelief(run, reliefAt, tuning.reliefRatio, Math.max(1, smoothing)));

  const bends = [];
  const segments = [];
  runs.forEach((run, runIndex) => {
    // Smoothing spreads a bend's turn over `smoothing` samples beyond each end of its
    // run. Take that road too, but never past halfway to the neighbouring bend, then
    // integrate the raw turn so every bend's angle is exact and no turn counts twice.
    const previous = runs[runIndex - 1];
    const next = runs[runIndex + 1];
    const runEnd = run.from + run.length - 1;
    const from = previous
      ? Math.max(run.from - smoothing, Math.floor((previous.from + previous.length - 1 + run.from) / 2) + 1)
      : run.from - smoothing;
    const to = next
      ? Math.min(runEnd + smoothing, Math.floor((runEnd + next.from) / 2))
      : runEnd + smoothing;
    const indices = [];
    for (let step = from; step <= to; step += 1) indices.push(((start + step) % count + count) % count);
    const signedAngle = indices.reduce((sum, index) => sum + turn[index], 0);
    const angleDegrees = Math.abs(signedAngle) * DEGREES;
    if (angleDegrees < tuning.noiseAngleDegrees || Math.sign(signedAngle) !== run.side) return;

    const bendId = bends.length + 1;
    const parts = Math.max(1, Math.ceil((angleDegrees - tuning.splitToleranceDegrees) / tuning.maxSegmentDegrees));
    const partAngle = Math.abs(signedAngle) / parts;
    bends.push(Object.freeze({
      id: bendId,
      direction: run.side,
      angleDegrees,
      startIndex: indices[0],
      endIndex: indices.at(-1),
      startDistance: indices[0] * spacing,
      length: indices.length * spacing,
      segmentCount: parts
    }));

    // Equal-angle parts: cut whenever the turn accumulated along the bend reaches the
    // next multiple of partAngle. Turn against the bend's side counts negatively.
    let accumulated = 0;
    let partStart = 0;
    for (let part = 1; part <= parts; part += 1) {
      let partEnd = indices.length - 1;
      if (part < parts) {
        for (let cursor = partStart; cursor < indices.length - (parts - part); cursor += 1) {
          accumulated += turn[indices[cursor]] * run.side;
          partEnd = cursor;
          if (accumulated >= partAngle * part) break;
        }
      }
      const partIndices = indices.slice(partStart, partEnd + 1);
      const partLength = partIndices.length * spacing;
      const peakCurvature = Math.max(...partIndices.map((index) => sustainedCurvature[index]));
      const averageCurvature = partAngle / partLength;
      segments.push(Object.freeze({
        id: `${bendId}.${part}`,
        bendId,
        part,
        parts,
        direction: run.side,
        side: run.side === ROUTE_DIRECTION.RIGHT ? 'right' : 'left',
        angleDegrees: partAngle * DEGREES,
        bendAngleDegrees: angleDegrees,
        startIndex: partIndices[0],
        endIndex: partIndices.at(-1),
        startDistance: partIndices[0] * spacing,
        length: partLength,
        averageCurvature,
        peakCurvature,
        averageRadius: 1 / averageCurvature,
        peakRadius: 1 / peakCurvature
      }));
      partStart = partEnd + 1;
    }
  });

  segments.sort((a, b) => a.startIndex - b.startIndex);
  return Object.freeze({
    trackLength,
    sampleSpacing: spacing,
    tuning,
    bends: Object.freeze(bends.sort((a, b) => a.startIndex - b.startIndex)),
    segments: Object.freeze(segments)
  });
}

/** Segments ahead of a track distance, nearest first, each with its distance ahead. */
export function upcomingRouteSegments(route, distance, count = 4) {
  const segments = route?.segments || [];
  const length = route?.trackLength || 0;
  if (!segments.length || !length) return [];
  return segments
    .map((segment) => ({ segment, ahead: ((segment.startDistance - distance) % length + length) % length }))
    .sort((a, b) => a.ahead - b.ahead)
    .slice(0, count);
}
