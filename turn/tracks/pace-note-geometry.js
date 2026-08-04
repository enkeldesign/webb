export const PACE_NOTE_GEOMETRY_DEFAULTS = Object.freeze({
  curvatureWindowMetres: 18,
  smoothingWindowMetres: 12,
  minimumPeakCurvature: 0.003,
  peakNeighborhoodMetres: 30,
  minimumPeakSeparationMetres: 52,
  curveEdgeFraction: 0.34,
  minimumEdgeCurvature: 0.00125,
  maximumEdgeGapMetres: 14,
  maximumCurveHalfLengthMetres: 150,
  minimumCurveLengthMetres: 14,
  minimumTurnAngleRadians: 0.14,
  gentleRadiusMetres: 72,
  tightRadiusMetres: 36,
  mediumTurnAngleRadians: 1.75,
  tightTurnAngleRadians: 2.55,
  shortCurveMetres: 52,
  longCurveMetres: 108,
  mediumLengthTurnAngleRadians: 1.2,
  minimumLeadMetres: 16,
  maximumLeadMetres: 230,
  maximumLinkedGapMetres: 125
});

export function analyzePaceNoteGeometry(samples, options = {}) {
  const settings = Object.freeze({ ...PACE_NOTE_GEOMETRY_DEFAULTS, ...options });
  const closed = options.closed !== false;
  const route = normalizeRoute(samples, closed);
  if (route.samples.length < 8 || route.trackLength <= 0) return Object.freeze([]);

  const averageStep = route.trackLength / Math.max(1, route.samples.length - (closed ? 0 : 1));
  const curvatureRadius = Math.max(1, Math.round(settings.curvatureWindowMetres / averageStep / 2));
  const smoothingRadius = Math.max(0, Math.round(settings.smoothingWindowMetres / averageStep / 2));
  const rawCurvature = route.samples.map((_, index) => localCurvature(route, index, curvatureRadius));
  const curvature = smoothValues(rawCurvature, smoothingRadius, closed);
  const peakNeighborhood = Math.max(1, Math.round(settings.peakNeighborhoodMetres / averageStep));
  const minimumPeakSeparation = Math.max(1, Math.round(settings.minimumPeakSeparationMetres / averageStep));

  const candidates = curvature
    .map((value, index) => ({ index, value, magnitude: Math.abs(value) }))
    .filter(({ magnitude }) => magnitude >= settings.minimumPeakCurvature)
    .filter(({ index, magnitude }) => isLocalPeak(curvature, index, magnitude, peakNeighborhood, closed))
    .sort((a, b) => b.magnitude - a.magnitude);

  const accepted = [];
  for (const candidate of candidates) {
    if (accepted.some((peak) => circularIndexDistance(
      peak.index,
      candidate.index,
      route.samples.length,
      closed
    ) < minimumPeakSeparation)) continue;
    accepted.push(candidate);
  }

  const curves = accepted
    .map((peak) => describePeakCurve(route, curvature, peak, settings, averageStep))
    .filter((curve) => (
      curve.lengthMetres >= settings.minimumCurveLengthMetres
      && Math.abs(curve.turnAngleRadians) >= settings.minimumTurnAngleRadians
    ))
    .sort((a, b) => a.peakDistance - b.peakDistance)
    .map((curve, index) => Object.freeze({ ...curve, index }));

  return Object.freeze(curves);
}

export function auditAuthoredPaceNotes({
  trackId,
  samples,
  notes,
  closed = true,
  options = {}
}) {
  const settings = Object.freeze({ ...PACE_NOTE_GEOMETRY_DEFAULTS, ...options });
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
      peakLead: forwardRouteDistance(trackLength, approachDistance, curve.peakDistance)
    }))
    .filter(({ peakLead }) => peakLead >= 1 && peakLead <= settings.maximumLeadMetres + settings.maximumCurveHalfLengthMetres)
    .sort((a, b) => a.peakLead - b.peakLead);

  if (!candidates.length || count <= 0) {
    return Object.freeze({ curves: Object.freeze([]), leads: Object.freeze([]) });
  }

  const selected = [candidates[0].curve];
  const leads = [candidates[0].peakLead];
  while (selected.length < count) {
    const previous = selected.at(-1);
    const nextCandidates = (curves || [])
      .filter((curve) => !selected.includes(curve))
      .map((curve) => ({
        curve,
        gap: forwardRouteDistance(trackLength, previous.peakDistance, curve.peakDistance)
      }))
      .filter(({ gap }) => gap >= settings.minimumPeakSeparationMetres * 0.6 && gap <= settings.maximumLinkedGapMetres)
      .sort((a, b) => a.gap - b.gap);
    if (!nextCandidates.length) break;
    selected.push(nextCandidates[0].curve);
    leads.push(forwardRouteDistance(trackLength, approachDistance, nextCandidates[0].curve.peakDistance));
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

function describePeakCurve(route, curvature, peak, settings, averageStep) {
  const sign = Math.sign(peak.value) || 1;
  const threshold = Math.max(settings.minimumEdgeCurvature, peak.magnitude * settings.curveEdgeFraction);
  const maximumSteps = Math.max(2, Math.round(settings.maximumCurveHalfLengthMetres / averageStep));
  const allowedGapSteps = Math.max(1, Math.round(settings.maximumEdgeGapMetres / averageStep));
  const before = expandFromPeak(route, curvature, peak.index, -1, sign, threshold, maximumSteps, allowedGapSteps);
  const after = expandFromPeak(route, curvature, peak.index, 1, sign, threshold, maximumSteps, allowedGapSteps);
  const indices = [...before.reverse(), peak.index, ...after];
  const uniqueIndices = uniqueInOrder(indices);
  const startIndex = uniqueIndices[0];
  const endIndex = uniqueIndices.at(-1);
  let lengthMetres = 0;
  let turnAngleRadians = 0;

  for (let position = 1; position < uniqueIndices.length; position += 1) {
    const previousIndex = uniqueIndices[position - 1];
    const index = uniqueIndices[position];
    lengthMetres += routeDistanceBetween(route, previousIndex, index);
    turnAngleRadians += signedHeadingDelta(
      route.samples[previousIndex].tangent,
      route.samples[index].tangent
    );
  }

  const radiusMetres = peak.magnitude > 0 ? 1 / peak.magnitude : Infinity;
  const absoluteAngle = Math.abs(turnAngleRadians);
  const severity = radiusMetres <= settings.tightRadiusMetres || absoluteAngle >= settings.tightTurnAngleRadians
    ? 3
    : radiusMetres <= settings.gentleRadiusMetres || absoluteAngle >= settings.mediumTurnAngleRadians
      ? 2
      : 1;
  const length = lengthMetres >= settings.longCurveMetres || absoluteAngle >= settings.tightTurnAngleRadians
    ? 'long'
    : lengthMetres >= settings.shortCurveMetres || absoluteAngle >= settings.mediumLengthTurnAngleRadians
      ? 'medium'
      : 'short';
  const startDistance = route.cumulative[startIndex] || 0;
  const peakDistance = route.cumulative[peak.index] || 0;
  const endDistance = route.cumulative[endIndex] || peakDistance;

  return {
    startIndex,
    peakIndex: peak.index,
    endIndex,
    startDistance,
    peakDistance,
    endDistance,
    startProgress: route.trackLength > 0 ? startDistance / route.trackLength : 0,
    peakProgress: route.trackLength > 0 ? peakDistance / route.trackLength : 0,
    endProgress: route.trackLength > 0 ? endDistance / route.trackLength : 0,
    lengthMetres,
    turnAngleRadians,
    peakCurvature: peak.magnitude,
    radiusMetres,
    direction: turnAngleRadians < 0 ? -1 : 1,
    severity,
    length
  };
}

function expandFromPeak(route, curvature, peakIndex, direction, sign, threshold, maximumSteps, allowedGapSteps) {
  const values = [];
  let gap = 0;
  for (let step = 1; step <= maximumSteps; step += 1) {
    const index = routeIndex(peakIndex + direction * step, route.samples.length, route.closed);
    if (index == null || index === peakIndex) break;
    const value = curvature[index];
    const sameDirection = Math.sign(value) === sign || Math.abs(value) < 1e-9;
    if (sameDirection && Math.abs(value) >= threshold) {
      values.push(index);
      gap = 0;
      continue;
    }
    if (sameDirection && gap < allowedGapSteps) {
      values.push(index);
      gap += 1;
      continue;
    }
    if (gap > 0) values.splice(-gap);
    break;
  }
  return values;
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
  const angle = signedHeadingDelta(
    route.samples[beforeIndex].tangent,
    route.samples[afterIndex].tangent
  );
  const distance = routeDistanceBetween(route, beforeIndex, afterIndex);
  return distance > 0.001 ? angle / distance : 0;
}

function smoothValues(values, radius, closed) {
  return values.map((_, index) => {
    let weighted = 0;
    let weight = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sampleIndex = routeIndex(index + offset, values.length, closed);
      if (sampleIndex == null) continue;
      const localWeight = radius > 0 ? radius + 1 - Math.abs(offset) : 1;
      weighted += values[sampleIndex] * localWeight;
      weight += localWeight;
    }
    return weight > 0 ? weighted / weight : 0;
  });
}

function isLocalPeak(values, index, magnitude, radius, closed) {
  for (let offset = -radius; offset <= radius; offset += 1) {
    if (offset === 0) continue;
    const sampleIndex = routeIndex(index + offset, values.length, closed);
    if (sampleIndex == null) continue;
    if (Math.abs(values[sampleIndex]) > magnitude) return false;
  }
  return true;
}

function circularIndexDistance(a, b, length, closed) {
  const direct = Math.abs(a - b);
  return closed ? Math.min(direct, length - direct) : direct;
}

function routeDistanceBetween(route, fromIndex, toIndex) {
  if (fromIndex === toIndex) return 0;
  const from = route.cumulative[fromIndex] || 0;
  const to = route.cumulative[toIndex] || 0;
  if (!route.closed || to >= from) return Math.max(0, to - from);
  return route.trackLength - from + to;
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
