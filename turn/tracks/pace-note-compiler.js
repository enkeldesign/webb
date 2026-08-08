import { getTrackPaceNoteRecipes } from './pace-note-recipes.js';

export const PACE_NOTE_LENGTH = Object.freeze({
  SHORT: 'short',
  MEDIUM: 'medium',
  LONG: 'long'
});

export const PACE_NOTE_DIRECTION = Object.freeze({
  LEFT: -1,
  RIGHT: 1
});

export const PACE_NOTE_CLASSIFICATION = Object.freeze({
  curvatureWindowMetres: 16,
  smoothingWindowMetres: 8,
  defaultSearchMetres: 42,
  edgeFraction: 0.56,
  minimumEdgeCurvature: 0.0017,
  maximumEdgeGapMetres: 5,
  maximumCurveHalfLengthMetres: 105,
  mediumRadiusMetres: 72,
  tightRadiusMetres: 34,
  mediumTurnAngleRadians: 1.62,
  tightTurnAngleRadians: 2.55,
  mediumLengthMetres: 58,
  longLengthMetres: 118,
  mediumLengthTurnAngleRadians: 1.15,
  longLengthTurnAngleRadians: 2.35,
  defaultFastLeadMetres: 148,
  defaultSlowLeadMetres: 68,
  linkedFastLeadAddMetres: 28,
  linkedSlowLeadAddMetres: 16
});

const EMPTY_NOTES = Object.freeze([]);
const compiledCache = new WeakMap();

export function compileTrackPaceNotes(trackId, samples, recipes = getTrackPaceNoteRecipes(trackId), options = {}) {
  if (!Array.isArray(samples) || samples.length < 8 || !recipes.length) return EMPTY_NOTES;
  const settings = Object.freeze({ ...PACE_NOTE_CLASSIFICATION, ...options });
  const route = buildRoute(samples, options.closed !== false);

  return Object.freeze(recipes.map((recipe) => compileRecipe(recipe, route, settings)));
}

export function getCompiledTrackPaceNotes(trackId, samples, options = {}) {
  if (!Array.isArray(samples)) return EMPTY_NOTES;
  let tracks = compiledCache.get(samples);
  if (!tracks) {
    tracks = new Map();
    compiledCache.set(samples, tracks);
  }
  const key = `${String(trackId || '').toLowerCase()}:${options.closed === false ? 'open' : 'closed'}`;
  if (!tracks.has(key)) tracks.set(key, compileTrackPaceNotes(trackId, samples, undefined, options));
  return tracks.get(key);
}

export function measureCurveAtProgress(samples, progress, options = {}) {
  const settings = Object.freeze({ ...PACE_NOTE_CLASSIFICATION, ...options });
  const route = buildRoute(samples, options.closed !== false);
  return measureCurve(route, { progress, searchMetres: options.searchMetres }, settings);
}

export function classifyCurveMetrics(metrics, options = {}) {
  const settings = Object.freeze({ ...PACE_NOTE_CLASSIFICATION, ...options });
  const radius = Math.max(0, Number(metrics?.radiusMetres) || Infinity);
  const angle = Math.abs(Number(metrics?.turnAngleRadians) || 0);
  const length = Math.max(0, Number(metrics?.lengthMetres) || 0);

  const severity = radius <= settings.tightRadiusMetres || angle >= settings.tightTurnAngleRadians
    ? 3
    : radius <= settings.mediumRadiusMetres || angle >= settings.mediumTurnAngleRadians
      ? 2
      : 1;
  const curveLength = length >= settings.longLengthMetres || angle >= settings.longLengthTurnAngleRadians
    ? PACE_NOTE_LENGTH.LONG
    : length >= settings.mediumLengthMetres || angle >= settings.mediumLengthTurnAngleRadians
      ? PACE_NOTE_LENGTH.MEDIUM
      : PACE_NOTE_LENGTH.SHORT;

  return Object.freeze({ severity, length: curveLength });
}

export function progressBeforeDistance(routeLength, targetDistance, leadMetres) {
  const length = Math.max(0, Number(routeLength) || 0);
  if (length <= 0) return 0;
  return normalizedProgress((Number(targetDistance) - Math.max(0, Number(leadMetres) || 0)) / length);
}

export function circularProgressSpan(start, end) {
  return normalizedProgress(Number(end) - Number(start));
}

function compileRecipe(recipe, route, settings) {
  const measuredGroups = recipe.groups.map((group) => {
    const metrics = measureCurve(route, group, settings);
    const classification = classifyCurveMetrics(metrics, settings);
    return Object.freeze({
      direction: metrics.direction,
      severity: normalizeSeverity(group.severity ?? classification.severity),
      length: normalizeLength(group.length ?? classification.length),
      geometry: Object.freeze(metrics),
      overrideReason: group.reason || null
    });
  });
  const first = measuredGroups[0];
  const linkedCount = Math.max(0, measuredGroups.length - 1);
  const fastLeadMetres = positiveNumber(
    recipe.fastLeadMetres,
    settings.defaultFastLeadMetres + linkedCount * settings.linkedFastLeadAddMetres
  );
  const slowLeadMetres = positiveNumber(
    recipe.slowLeadMetres,
    settings.defaultSlowLeadMetres + linkedCount * settings.linkedSlowLeadAddMetres
  );
  const triggerStart = progressBeforeDistance(route.trackLength, first.geometry.startDistance, fastLeadMetres);
  const triggerEnd = progressBeforeDistance(route.trackLength, first.geometry.startDistance, slowLeadMetres);

  return Object.freeze({
    id: recipe.id,
    triggerStart,
    triggerEnd,
    groups: Object.freeze(measuredGroups.map((group) => Object.freeze({
      direction: group.direction,
      severity: group.severity,
      length: group.length
    }))),
    geometry: Object.freeze({
      fastLeadMetres,
      slowLeadMetres,
      groups: measuredGroups
    })
  });
}

function measureCurve(route, group, settings) {
  const anchorDistance = normalizedProgress(group.progress) * route.trackLength;
  const searchMetres = positiveNumber(group.searchMetres, settings.defaultSearchMetres);
  const anchorIndex = indexNearDistance(route, anchorDistance);
  const localIndices = indicesWithinDistance(route, anchorIndex, searchMetres);
  const curvature = localCurvatureSeries(route, settings);
  const peakIndex = localIndices.reduce((best, index) => {
    const score = Math.abs(curvature[index]) / (1 + circularDistanceMetres(
      route,
      route.cumulative[index],
      anchorDistance
    ) / Math.max(1, searchMetres));
    return score > best.score ? { index, score } : best;
  }, { index: anchorIndex, score: -Infinity }).index;

  const peakCurvature = curvature[peakIndex];
  const direction = Math.sign(peakCurvature) || localDirection(route, peakIndex);
  const threshold = Math.max(
    settings.minimumEdgeCurvature,
    Math.abs(peakCurvature) * settings.edgeFraction
  );
  const averageStep = route.trackLength / Math.max(1, route.samples.length - (route.closed ? 0 : 1));
  const maximumSteps = Math.max(2, Math.round(settings.maximumCurveHalfLengthMetres / averageStep));
  const maximumGapSteps = Math.max(0, Math.round(settings.maximumEdgeGapMetres / averageStep));
  const before = expandCurveEdge(route, curvature, peakIndex, -1, direction, threshold, maximumSteps, maximumGapSteps);
  const after = expandCurveEdge(route, curvature, peakIndex, 1, direction, threshold, maximumSteps, maximumGapSteps);
  const indices = [...before.reverse(), peakIndex, ...after];

  let lengthMetres = 0;
  let turnAngleRadians = 0;
  for (let position = 1; position < indices.length; position += 1) {
    const previousIndex = indices[position - 1];
    const index = indices[position];
    lengthMetres += forwardDistanceBetweenIndices(route, previousIndex, index);
    turnAngleRadians += signedHeadingDelta(
      route.samples[previousIndex].tangent,
      route.samples[index].tangent
    );
  }

  const startIndex = indices[0];
  const endIndex = indices.at(-1);
  const startDistance = route.cumulative[startIndex] || 0;
  const peakDistance = route.cumulative[peakIndex] || 0;
  const endDistance = route.cumulative[endIndex] || peakDistance;

  return {
    anchorProgress: normalizedProgress(group.progress),
    startProgress: startDistance / route.trackLength,
    peakProgress: peakDistance / route.trackLength,
    endProgress: endDistance / route.trackLength,
    startDistance,
    peakDistance,
    endDistance,
    lengthMetres,
    turnAngleRadians,
    peakCurvature: Math.abs(peakCurvature),
    radiusMetres: Math.abs(peakCurvature) > 1e-7 ? 1 / Math.abs(peakCurvature) : Infinity,
    direction: turnAngleRadians < 0 ? PACE_NOTE_DIRECTION.LEFT : PACE_NOTE_DIRECTION.RIGHT
  };
}

function buildRoute(samples, closed) {
  const normalized = samples.map((sample) => ({
    point: {
      x: Number(sample?.point?.x) || 0,
      z: Number(sample?.point?.z) || 0
    },
    tangent: normalizeVector(sample?.tangent)
  }));
  const cumulative = [0];
  for (let index = 1; index < normalized.length; index += 1) {
    cumulative[index] = cumulative[index - 1] + pointDistance(normalized[index - 1].point, normalized[index].point);
  }
  let trackLength = cumulative.at(-1) || 0;
  if (closed && normalized.length > 1) trackLength += pointDistance(normalized.at(-1).point, normalized[0].point);
  return { samples: normalized, cumulative, trackLength, closed };
}

function localCurvatureSeries(route, settings) {
  const averageStep = route.trackLength / Math.max(1, route.samples.length - (route.closed ? 0 : 1));
  const curvatureRadius = Math.max(1, Math.round(settings.curvatureWindowMetres / averageStep / 2));
  const smoothingRadius = Math.max(0, Math.round(settings.smoothingWindowMetres / averageStep / 2));
  const raw = route.samples.map((_, index) => {
    const before = routeIndex(index - curvatureRadius, route.samples.length, route.closed);
    const after = routeIndex(index + curvatureRadius, route.samples.length, route.closed);
    if (before == null || after == null || before === after) return 0;
    const angle = signedHeadingDelta(route.samples[before].tangent, route.samples[after].tangent);
    const distance = forwardDistanceBetweenIndices(route, before, after);
    return distance > 0.001 ? angle / distance : 0;
  });

  return raw.map((_, index) => {
    let weighted = 0;
    let weight = 0;
    for (let offset = -smoothingRadius; offset <= smoothingRadius; offset += 1) {
      const source = routeIndex(index + offset, raw.length, route.closed);
      if (source == null) continue;
      const localWeight = smoothingRadius > 0 ? smoothingRadius + 1 - Math.abs(offset) : 1;
      weighted += raw[source] * localWeight;
      weight += localWeight;
    }
    return weight > 0 ? weighted / weight : 0;
  });
}

function expandCurveEdge(route, curvature, peakIndex, stepDirection, turnDirection, threshold, maximumSteps, maximumGapSteps) {
  const result = [];
  let gap = 0;
  for (let step = 1; step <= maximumSteps; step += 1) {
    const index = routeIndex(peakIndex + stepDirection * step, route.samples.length, route.closed);
    if (index == null || index === peakIndex) break;
    const value = curvature[index];
    const sameDirection = Math.sign(value) === turnDirection || Math.abs(value) < 1e-8;
    if (sameDirection && Math.abs(value) >= threshold) {
      result.push(index);
      gap = 0;
      continue;
    }
    if (sameDirection && gap < maximumGapSteps) {
      result.push(index);
      gap += 1;
      continue;
    }
    if (gap > 0) result.splice(-gap);
    break;
  }
  return result;
}

function indicesWithinDistance(route, centerIndex, metres) {
  const values = new Set([centerIndex]);
  for (const direction of [-1, 1]) {
    let travelled = 0;
    let current = centerIndex;
    let guard = 0;
    while (travelled <= metres && guard < route.samples.length) {
      const next = routeIndex(current + direction, route.samples.length, route.closed);
      if (next == null || next === centerIndex) break;
      travelled += direction > 0
        ? forwardDistanceBetweenIndices(route, current, next)
        : forwardDistanceBetweenIndices(route, next, current);
      values.add(next);
      current = next;
      guard += 1;
    }
  }
  return [...values];
}

function indexNearDistance(route, targetDistance) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  route.cumulative.forEach((distance, index) => {
    const difference = circularDistanceMetres(route, distance, targetDistance);
    if (difference < bestDistance) {
      bestDistance = difference;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function circularDistanceMetres(route, a, b) {
  const direct = Math.abs(Number(a) - Number(b));
  return route.closed ? Math.min(direct, route.trackLength - direct) : direct;
}

function forwardDistanceBetweenIndices(route, fromIndex, toIndex) {
  const from = route.cumulative[fromIndex] || 0;
  const to = route.cumulative[toIndex] || 0;
  if (!route.closed || to >= from) return Math.max(0, to - from);
  return route.trackLength - from + to;
}

function localDirection(route, index) {
  const before = routeIndex(index - 1, route.samples.length, route.closed);
  const after = routeIndex(index + 1, route.samples.length, route.closed);
  if (before == null || after == null) return PACE_NOTE_DIRECTION.RIGHT;
  return Math.sign(signedHeadingDelta(route.samples[before].tangent, route.samples[after].tangent)) || PACE_NOTE_DIRECTION.RIGHT;
}

function signedHeadingDelta(from, to) {
  const fromHeading = Math.atan2(Number(from?.x) || 0, Number(from?.z) || 0);
  const toHeading = Math.atan2(Number(to?.x) || 0, Number(to?.z) || 0);
  return normalizeAngle(toHeading - fromHeading);
}

function routeIndex(index, length, closed) {
  if (closed) return ((index % length) + length) % length;
  if (index < 0 || index >= length) return null;
  return index;
}

function normalizeAngle(value) {
  let angle = Number(value) || 0;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function normalizeVector(vector) {
  const x = Number(vector?.x) || 0;
  const z = Number(vector?.z) || 0;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function pointDistance(a, b) {
  return Math.hypot((Number(b?.x) || 0) - (Number(a?.x) || 0), (Number(b?.z) || 0) - (Number(a?.z) || 0));
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeSeverity(value) {
  return Math.min(3, Math.max(1, Math.round(Number(value) || 1)));
}

function normalizeLength(value) {
  const normalized = String(value || '').toLowerCase();
  return Object.values(PACE_NOTE_LENGTH).includes(normalized) ? normalized : PACE_NOTE_LENGTH.SHORT;
}

function normalizedProgress(value) {
  const progress = Number(value) || 0;
  return ((progress % 1) + 1) % 1;
}
