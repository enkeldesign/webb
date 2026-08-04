export const PACE_NOTE_GEOMETRY_DEFAULTS = Object.freeze({
  curvatureWindowMetres: 20,
  smoothingWindowMetres: 14,
  enterCurvature: 0.0032,
  exitCurvature: 0.0018,
  maximumStraightGapMetres: 18,
  sameDirectionMergeGapMetres: 28,
  minimumCurveLengthMetres: 16,
  minimumTurnAngleRadians: 0.16,
  gentleRadiusMetres: 105,
  tightRadiusMetres: 52,
  shortCurveMetres: 48,
  longCurveMetres: 96,
  minimumLeadMetres: 18,
  maximumLeadMetres: 150,
  maximumLinkedGapMetres: 95
});

export function analyzePaceNoteGeometry(samples, options = {}) {
  const settings = Object.freeze({ ...PACE_NOTE_GEOMETRY_DEFAULTS, ...options });
  const closed = options.closed !== false;
  const route = normalizeRoute(samples, closed);
  if (route.samples.length < 8 || route.trackLength <= 0) return Object.freeze([]);

  const averageStep = route.trackLength / route.samples.length;
  const curvatureRadius = Math.max(1, Math.round(settings.curvatureWindowMetres / averageStep / 2));
  const smoothingRadius = Math.max(0, Math.round(settings.smoothingWindowMetres / averageStep / 2));
  const rawCurvature = route.samples.map((_, index) => localCurvature(route, index, curvatureRadius));
  const curvature = rawCurvature.map((_, index) => {
    let weighted = 0;
    let weight = 0;
    for (let offset = -smoothingRadius; offset <= smoothingRadius; offset += 1) {
      const sampleIndex = routeIndex(index + offset, route.samples.length, closed);
      if (sampleIndex == null) continue;
      const localWeight = smoothingRadius > 0 ? smoothingRadius + 1 - Math.abs(offset) : 1;
      weighted += rawCurvature[sampleIndex] * localWeight;
      weight += localWeight;
    }
    return weight > 0 ? weighted / weight : 0;
  });

  const order = orderedIndices(curvature, closed);
  const preliminary = detectCurveRanges(route, curvature, order, settings, closed);
  const merged = mergeCurveRanges(route, curvature, preliminary, settings, closed);
  const curves = merged
    .map((range, index) => describeCurve(route, curvature, range, settings, closed, index))
    .filter((curve) => (
      curve.lengthMetres >= settings.minimumCurveLengthMetres
      && Math.abs(curve.turnAngleRadians) >= settings.minimumTurnAngleRadians
    ));

  curves.sort((a, b) => a.startDistance - b.startDistance);
  return Object.freeze(curves.map((curve, index) => Object.freeze({ ...curve, index })));
}

export function auditAuthoredPaceNotes({
  trackId,
  samples,
  notes,
  closed = true,
  options = {}
}) {
  const curves = analyzePaceNoteGeometry(samples, { ...options, closed });
  const route = normalizeRoute(samples, closed);
  const entries = [];

  for (const note of notes || []) {
    const groups = Array.isArray(note.groups) ? note.groups : [];
    const approachProgress = normalizedProgress(
      Number.isFinite(Number(note.triggerEnd)) ? note.triggerEnd : note.progress
    );
    const matched = matchFollowingCurves({
      curves,
      trackLength: route.trackLength,
      approachProgress,
      count: groups.length,
      options
    });
    const expectedGroups = matched.curves.map((curve) => Object.freeze({
      direction: curve.direction,
      severity: curve.severity,
      length: curve.length
    }));
    const issues = [];

    if (matched.curves.length !== groups.length) {
      issues.push(`expected ${groups.length} curve group(s), found ${matched.curves.length}`);
    }

    groups.forEach((group, groupIndex) => {
      const expected = expectedGroups[groupIndex];
      if (!expected) return;
      if (Number(group.direction) !== expected.direction) {
        issues.push(`group ${groupIndex + 1} direction ${directionName(group.direction)} should be ${directionName(expected.direction)}`);
      }
      if (Number(group.severity) !== expected.severity) {
        issues.push(`group ${groupIndex + 1} severity ${group.severity} should be ${expected.severity}`);
      }
      const authoredLength = normalizeLength(group.length, group.long);
      if (authoredLength && authoredLength !== expected.length) {
        issues.push(`group ${groupIndex + 1} length ${authoredLength} should be ${expected.length}`);
      }
    });

    const firstCurve = matched.curves[0] || null;
    const triggerStart = Number.isFinite(Number(note.triggerStart))
      ? normalizedProgress(note.triggerStart)
      : approachProgress;
    const slowLeadMetres = firstCurve
      ? forwardRouteDistance(route.trackLength, approachProgress * route.trackLength, firstCurve.startDistance)
      : null;
    const fastLeadMetres = firstCurve
      ? forwardRouteDistance(route.trackLength, triggerStart * route.trackLength, firstCurve.startDistance)
      : null;
    const settings = { ...PACE_NOTE_GEOMETRY_DEFAULTS, ...options };

    if (slowLeadMetres != null && (
      slowLeadMetres < settings.minimumLeadMetres
      || slowLeadMetres > settings.maximumLeadMetres
    )) {
      issues.push(`slow trigger lead ${slowLeadMetres.toFixed(1)} m is outside ${settings.minimumLeadMetres}-${settings.maximumLeadMetres} m`);
    }
    if (fastLeadMetres != null && fastLeadMetres + 0.5 < slowLeadMetres) {
      issues.push(`fast trigger lead ${fastLeadMetres.toFixed(1)} m is later than slow trigger lead ${slowLeadMetres.toFixed(1)} m`);
    }

    entries.push(Object.freeze({
      trackId,
      id: note.id,
      approachProgress,
      authoredGroups: Object.freeze(groups.map((group) => Object.freeze({ ...group }))),
      expectedGroups: Object.freeze(expectedGroups),
      matchedCurves: Object.freeze(matched.curves),
      slowLeadMetres,
      fastLeadMetres,
      issues: Object.freeze(issues)
    }));
  }

  return Object.freeze({
    trackId,
    trackLength: route.trackLength,
    curves,
    entries: Object.freeze(entries),
    issueCount: entries.reduce((sum, entry) => sum + entry.issues.length, 0)
  });
}

export function matchFollowingCurves({
  curves,
  trackLength,
  approachProgress,
  count = 1,
  options = {}
}) {
  const settings = { ...PACE_NOTE_GEOMETRY_DEFAULTS, ...options };
  const approachDistance = normalizedProgress(approachProgress) * trackLength;
  const candidates = (curves || [])
    .map((curve) => ({
      curve,
      lead: forwardRouteDistance(trackLength, approachDistance, curve.startDistance)
    }))
    .filter(({ lead }) => lead >= 1 && lead <= settings.maximumLeadMetres)
    .sort((a, b) => a.lead - b.lead);

  if (!candidates.length || count <= 0) {
    return Object.freeze({ curves: Object.freeze([]), leads: Object.freeze([]) });
  }

  const selected = [candidates[0].curve];
  const leads = [candidates[0].lead];
  while (selected.length < count) {
    const previous = selected.at(-1);
    const nextCandidates = (curves || [])
      .filter((curve) => !selected.includes(curve))
      .map((curve) => ({
        curve,
        gap: forwardRouteDistance(trackLength, previous.endDistance, curve.startDistance)
      }))
      .filter(({ gap }) => gap >= 0 && gap <= settings.maximumLinkedGapMetres)
      .sort((a, b) => a.gap - b.gap);
    if (!nextCandidates.length) break;
    selected.push(nextCandidates[0].curve);
    leads.push(forwardRouteDistance(trackLength, approachDistance, nextCandidates[0].curve.startDistance));
  }

  return Object.freeze({ curves: Object.freeze(selected), leads: Object.freeze(leads) });
}

export function forwardRouteDistance(trackLength, fromDistance, toDistance) {
  const length = Math.max(0, Number(trackLength) || 0);
  if (length <= 0) return 0;
  return ((Number(toDistance) - Number(fromDistance)) % length + length) % length;
}

export function directionName(direction) {
  return Number(direction) < 0 ? 'left' : 'right';
}

function normalizeRoute(samples, closed) {
  const normalized = (samples || []).map((sample) => ({
    point: {
      x: Number(sample?.point?.x) || 0,
      z: Number(sample?.point?.z) || 0
    },
    tangent: normalizedVector(sample?.tangent)
  }));
  const cumulative = [0];
  for (let index = 1; index < normalized.length; index += 1) {
    cumulative[index] = cumulative[index - 1] + pointDistance(normalized[index - 1].point, normalized[index].point);
  }
  let trackLength = cumulative.at(-1) || 0;
  if (closed && normalized.length > 1) {
    trackLength += pointDistance(normalized.at(-1).point, normalized[0].point);
  }
  return { samples: normalized, cumulative, trackLength, closed };
}

function localCurvature(route, index, radius) {
  const beforeIndex = routeIndex(index - radius, route.samples.length, route.closed);
  const afterIndex = routeIndex(index + radius, route.samples.length, route.closed);
  if (beforeIndex == null || afterIndex == null || beforeIndex === afterIndex) return 0;
  const before = route.samples[beforeIndex];
  const after = route.samples[afterIndex];
  const angle = signedHeadingDelta(before.tangent, after.tangent);
  const distance = routeDistanceBetween(route, beforeIndex, afterIndex);
  return distance > 0.001 ? angle / distance : 0;
}

function orderedIndices(curvature, closed) {
  const indices = curvature.map((_, index) => index);
  if (!closed || !indices.length) return indices;
  let cut = 0;
  for (let index = 1; index < curvature.length; index += 1) {
    if (Math.abs(curvature[index]) < Math.abs(curvature[cut])) cut = index;
  }
  return [...indices.slice(cut), ...indices.slice(0, cut)];
}

function detectCurveRanges(route, curvature, order, settings, closed) {
  const ranges = [];
  const averageStep = route.trackLength / route.samples.length;
  const allowedGap = Math.max(1, Math.round(settings.maximumStraightGapMetres / averageStep));
  let active = null;

  for (let position = 0; position < order.length; position += 1) {
    const index = order[position];
    const value = curvature[index];
    const magnitude = Math.abs(value);
    const sign = Math.sign(value);

    if (!active) {
      if (magnitude >= settings.enterCurvature) {
        active = { indices: [index], sign, gap: 0 };
      }
      continue;
    }

    const sameDirection = sign === 0 || sign === active.sign;
    if (sameDirection && magnitude >= settings.exitCurvature) {
      active.indices.push(index);
      active.gap = 0;
      continue;
    }

    if (sameDirection && active.gap < allowedGap) {
      active.indices.push(index);
      active.gap += 1;
      continue;
    }

    trimRangeGap(active);
    if (active.indices.length) ranges.push(active);
    active = magnitude >= settings.enterCurvature
      ? { indices: [index], sign, gap: 0 }
      : null;
  }

  if (active) {
    trimRangeGap(active);
    if (active.indices.length) ranges.push(active);
  }

  return ranges.map((range) => ({
    indices: range.indices,
    sign: range.sign,
    closed
  }));
}

function trimRangeGap(range) {
  if (range.gap > 0) range.indices.splice(-range.gap);
  range.gap = 0;
}

function mergeCurveRanges(route, curvature, ranges, settings, closed) {
  if (ranges.length < 2) return ranges;
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (!previous || previous.sign !== range.sign) {
      merged.push({ ...range, indices: [...range.indices] });
      continue;
    }
    const gap = routeDistanceBetween(route, previous.indices.at(-1), range.indices[0]);
    if (gap <= settings.sameDirectionMergeGapMetres) {
      const bridge = indicesBetween(previous.indices.at(-1), range.indices[0], route.samples.length, closed);
      previous.indices.push(...bridge.slice(1), ...range.indices.slice(1));
    } else {
      merged.push({ ...range, indices: [...range.indices] });
    }
  }
  return merged;
}

function describeCurve(route, curvature, range, settings, closed, fallbackIndex) {
  const indices = uniqueInOrder(range.indices);
  const startIndex = indices[0] ?? fallbackIndex;
  const endIndex = indices.at(-1) ?? startIndex;
  let lengthMetres = 0;
  let turnAngleRadians = 0;
  let peakCurvature = 0;

  for (let position = 0; position < indices.length; position += 1) {
    const index = indices[position];
    peakCurvature = Math.max(peakCurvature, Math.abs(curvature[index]));
    if (position === 0) continue;
    const previousIndex = indices[position - 1];
    lengthMetres += routeDistanceBetween(route, previousIndex, index);
    turnAngleRadians += signedHeadingDelta(
      route.samples[previousIndex].tangent,
      route.samples[index].tangent
    );
  }

  const direction = turnAngleRadians < 0 ? -1 : 1;
  const radiusMetres = peakCurvature > 0 ? 1 / peakCurvature : Infinity;
  const severity = radiusMetres >= settings.gentleRadiusMetres
    ? 1
    : radiusMetres <= settings.tightRadiusMetres
      ? 3
      : 2;
  const length = lengthMetres >= settings.longCurveMetres
    ? 'long'
    : lengthMetres < settings.shortCurveMetres
      ? 'short'
      : 'medium';
  const startDistance = route.cumulative[startIndex] || 0;
  const endDistance = route.cumulative[endIndex] || startDistance;
  const centerDistance = advanceDistance(
    route.trackLength,
    startDistance,
    lengthMetres / 2,
    closed
  );

  return {
    startIndex,
    endIndex,
    startDistance,
    centerDistance,
    endDistance,
    startProgress: route.trackLength > 0 ? startDistance / route.trackLength : 0,
    centerProgress: route.trackLength > 0 ? centerDistance / route.trackLength : 0,
    endProgress: route.trackLength > 0 ? endDistance / route.trackLength : 0,
    lengthMetres,
    turnAngleRadians,
    peakCurvature,
    radiusMetres,
    direction,
    severity,
    length
  };
}

function routeDistanceBetween(route, fromIndex, toIndex) {
  if (fromIndex === toIndex) return 0;
  const from = route.cumulative[fromIndex] || 0;
  const to = route.cumulative[toIndex] || 0;
  if (!route.closed || to >= from) return Math.max(0, to - from);
  return route.trackLength - from + to;
}

function indicesBetween(from, to, length, closed) {
  const values = [from];
  let current = from;
  let guard = 0;
  while (current !== to && guard <= length) {
    current += 1;
    if (current >= length) {
      if (!closed) break;
      current = 0;
    }
    values.push(current);
    guard += 1;
  }
  return values;
}

function routeIndex(index, length, closed) {
  if (closed) return ((index % length) + length) % length;
  if (index < 0 || index >= length) return null;
  return index;
}

function uniqueInOrder(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function advanceDistance(trackLength, start, distance, closed) {
  const value = start + distance;
  return closed && trackLength > 0 ? value % trackLength : Math.min(trackLength, value);
}

function signedHeadingDelta(from, to) {
  const fromHeading = Math.atan2(Number(from?.x) || 0, Number(from?.z) || 0);
  const toHeading = Math.atan2(Number(to?.x) || 0, Number(to?.z) || 0);
  return normalizeAngle(toHeading - fromHeading);
}

function normalizeAngle(value) {
  let angle = Number(value) || 0;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function normalizedVector(vector) {
  const x = Number(vector?.x) || 0;
  const z = Number(vector?.z) || 0;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function normalizedProgress(value) {
  const progress = Number(value) || 0;
  return ((progress % 1) + 1) % 1;
}

function normalizeLength(length, long) {
  if (long === true) return 'long';
  const value = String(length || '').toLowerCase();
  return ['short', 'medium', 'long'].includes(value) ? value : null;
}

function pointDistance(a, b) {
  return Math.hypot((Number(b?.x) || 0) - (Number(a?.x) || 0), (Number(b?.z) || 0) - (Number(a?.z) || 0));
}
