import * as THREE from 'three';
import { TRACK_CATALOG as BASE_TRACK_CATALOG } from '/turn/tracks/catalog.js?airport-runway-base=r2';
import {
  DEFAULT_TRACK_ID,
  TRACK_PLACEHOLDERS,
  TRACK_SAMPLE_COUNT,
  TRACK_SELECTION_KEY,
  getTrackDefinitionData,
  normalizeTrackId as normalizeConfiguredTrackId
} from '/turn-next/airport-runway/definitions.js';
import { AIRPORT_RUNWAY_CONTROL_POINTS } from '/turn-next/airport-runway/spec.js';

export { DEFAULT_TRACK_ID, TRACK_PLACEHOLDERS, TRACK_SAMPLE_COUNT, TRACK_SELECTION_KEY };

function createAirportRunwayControlPoints() {
  return AIRPORT_RUNWAY_CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
}

export const TRACK_CATALOG = Object.freeze(BASE_TRACK_CATALOG.map((track) => {
  if (track.id !== 'airport') return track;
  return Object.freeze({
    ...getTrackDefinitionData('airport'),
    createControlPoints: createAirportRunwayControlPoints
  });
}));

export const TRACK_SELECTION_CATALOG = Object.freeze([
  ...TRACK_CATALOG,
  ...TRACK_PLACEHOLDERS
]);

export function getTrackDefinition(trackId = DEFAULT_TRACK_ID) {
  const normalized = getTrackDefinitionData(trackId).id;
  return TRACK_CATALOG.find((track) => track.id === normalized) || TRACK_CATALOG[0];
}

export function normalizeTrackId(trackId) {
  return normalizeConfiguredTrackId(trackId);
}

export function loadTrackSelection() {
  try {
    return normalizeTrackId(localStorage.getItem(TRACK_SELECTION_KEY));
  } catch (_) {
    return DEFAULT_TRACK_ID;
  }
}

export function saveTrackSelection(trackId) {
  const normalized = normalizeTrackId(trackId);
  try {
    localStorage.setItem(TRACK_SELECTION_KEY, normalized);
  } catch (_) {}
  return normalized;
}

export function createTrackRuntime(trackId, sampleCount = TRACK_SAMPLE_COUNT) {
  const definition = getTrackDefinition(trackId);
  const controlPoints = definition.createControlPoints();
  const curve = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal');
  const samples = [];
  let trackLength = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / sampleCount;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    if (index > 0) trackLength += point.distanceTo(samples[index - 1].point);
    samples.push({ point, tangent, normal, distance: trackLength });
  }

  trackLength += samples[0].point.distanceTo(samples.at(-1).point);
  return {
    id: definition.id,
    definition,
    controlPoints,
    curve,
    samples,
    trackLength,
    sampleCount
  };
}

export function getTrackPreviewPoints(trackId, count = 96) {
  return createTrackRuntime(trackId, count).samples.map((sample) => ({
    x: sample.point.x,
    z: sample.point.z
  }));
}
