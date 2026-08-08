import * as THREE from 'three';
import {
  DEFAULT_TRACK_ID,
  TRACK_SAMPLE_COUNT,
  TRACK_SELECTION_KEY,
  TRACK_PLACEHOLDERS
} from '/turn/tracks/definitions.js?build=20260808-r162';
import { TRACK_CATALOG as CANONICAL_TRACK_CATALOG } from '/turn/tracks/catalog.js?source=20260729-r118-m8';
import { createAirportRunwayControlPoints } from '/turn-next/airport-runway-layout.js';

export { DEFAULT_TRACK_ID, TRACK_SAMPLE_COUNT, TRACK_SELECTION_KEY, TRACK_PLACEHOLDERS };

const AIRPORT_RUNWAY_ID = 'airport-runway';

const AIRPORT_RUNWAY_DEFINITION = Object.freeze({
  ...CANONICAL_TRACK_CATALOG.find((track) => track.id === 'airport'),
  id: AIRPORT_RUNWAY_ID,
  name: 'Airport: Runway',
  eyebrow: 'TURN NEXT',
  difficulty: 'MEDIUM',
  description: 'Runway diversions. Aircraft obstacle. Hangar shortcut.',
  storageRevision: 'airport-runway-prototype-r1',
  createControlPoints: createAirportRunwayControlPoints
});

export const TRACK_CATALOG = Object.freeze([
  ...CANONICAL_TRACK_CATALOG,
  AIRPORT_RUNWAY_DEFINITION
]);

export const TRACK_SELECTION_CATALOG = Object.freeze([
  ...TRACK_CATALOG,
  ...TRACK_PLACEHOLDERS
]);

export function getTrackDefinition(trackId = DEFAULT_TRACK_ID) {
  return TRACK_CATALOG.find((track) => track.id === trackId) || TRACK_CATALOG[0];
}

export function normalizeTrackId(trackId) {
  return TRACK_CATALOG.some((track) => track.id === trackId) ? trackId : DEFAULT_TRACK_ID;
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
  try { localStorage.setItem(TRACK_SELECTION_KEY, normalized); } catch (_) {}
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
  return { id: definition.id, definition, controlPoints, curve, samples, trackLength, sampleCount };
}

export function getTrackPreviewPoints(trackId, count = 96) {
  return createTrackRuntime(trackId, count).samples.map((sample) => ({ x: sample.point.x, z: sample.point.z }));
}
