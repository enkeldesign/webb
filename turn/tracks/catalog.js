import * as THREE from 'three';

export const DEFAULT_TRACK_ID = 'countryside';
export const TRACK_SAMPLE_COUNT = 720;
export const TRACK_SELECTION_KEY = 'turn-selected-track-v1';

const TRACKS = [
  {
    id: 'countryside',
    name: 'Countryside',
    difficulty: 'EASY',
    eyebrow: 'TRACK 1',
    description: 'Fast, flowing and forgiving.',
    accent: '#ff4fa3',
    accentSoft: '#ffc2dd',
    sky: 0x38d9ff,
    fog: 0x74c0fc,
    createControlPoints() {
      return Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2;
        const radiusX = 208 + Math.sin(angle * 2 + 0.35) * 20 + Math.sin(angle * 3 - 0.8) * 9;
        const radiusZ = 146 + Math.cos(angle * 2 - 0.4) * 14 + Math.sin(angle * 3 + 0.6) * 8;
        return new THREE.Vector3(Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ);
      });
    }
  },
  {
    id: 'airport',
    name: 'Airport',
    difficulty: 'MEDIUM',
    eyebrow: 'TRACK 2',
    description: 'Runway speed. Apron precision.',
    accent: '#ffd43b',
    accentSoft: '#fff0a6',
    sky: 0x55c9ed,
    fog: 0x9bdcf2,
    createControlPoints() {
      return [
        [-205, -126],
        [-120, -138],
        [-20, -142],
        [90, -140],
        [175, -128],
        [214, -100],
        [232, -58],
        [232, -12],
        [218, 34],
        [192, 70],
        [154, 98],
        [110, 118],
        [75, 120],
        [55, 108],
        [42, 88],
        [32, 65],
        [25, 43],
        [0, 22],
        [-25, 43],
        [-32, 65],
        [-42, 88],
        [-55, 108],
        [-85, 121],
        [-128, 126],
        [-168, 112],
        [-204, 84],
        [-228, 45],
        [-236, 2],
        [-229, -45],
        [-215, -88]
      ].map(([x, z]) => new THREE.Vector3(x, 0, z));
    }
  }
];

export const TRACK_CATALOG = Object.freeze(TRACKS.map((track) => Object.freeze({ ...track })));

export function getTrackDefinition(trackId = DEFAULT_TRACK_ID) {
  return TRACK_CATALOG.find((track) => track.id === trackId) || TRACK_CATALOG[0];
}

export function normalizeTrackId(trackId) {
  return getTrackDefinition(trackId).id;
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
  const runtime = createTrackRuntime(trackId, count);
  return runtime.samples.map((sample) => ({ x: sample.point.x, z: sample.point.z }));
}
