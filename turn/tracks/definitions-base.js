import {
  HARBOR_COLLIDERS,
  HARBOR_COLLISION_RULES
} from './harbor-collision.js';

export const DEFAULT_TRACK_ID = 'countryside';
export const TRACK_SAMPLE_COUNT = 720;
export const TRACK_SELECTION_KEY = 'turn-selected-track-v1';

// Canonical production order: difficulty first (EASY, MEDIUM, ADVANCED, EXPERT),
// two tracks per tier. Every track-derived surface follows this order.
const TRACKS = [
  {
    id: 'countryside',
    name: 'Countryside',
    difficulty: 'EASY',
    eyebrow: 'TRACK 1',
    description: 'Fast, flowing and forgiving.',
    accent: '#ff4fa3',
    accentSoft: '#ffc2dd',
    storageRevision: 'countryside',
    freeRoamDistance: 170,
    collisionProfile: {
      freeRoamDistance: 170,
      colliders: []
    },
    sky: 0x38d9ff,
    fog: 0x74c0fc
  },
  {
    id: 'cliffside',
    name: 'Cliffside',
    difficulty: 'EASY',
    eyebrow: 'TRACK 2',
    description: 'Linked curves. Mountain rhythm. Ocean flow.',
    accent: '#26c7c3',
    accentSoft: '#bcefeb',
    storageRevision: 'cliffside-r68',
    freeRoamDistance: 22.2,
    collisionProfile: {
      freeRoamDistance: 22.2,
      shoulderStartDistance: 15.2,
      shoulderDrag: 1.65,
      boundaryBounce: 0.04,
      boundaryTangentRetention: 0.94,
      boundaryMinimumRecoverySpeed: 5.5,
      colliders: []
    },
    sky: 0x63c7ef,
    fog: 0xb5dded
  },
  {
    id: 'airport',
    name: 'Airport',
    difficulty: 'MEDIUM',
    eyebrow: 'TRACK 3',
    description: 'Runway speed. Apron precision.',
    accent: '#ffd43b',
    accentSoft: '#fff0a6',
    storageRevision: 'airport-r50',
    freeRoamDistance: 95,
    collisionProfile: {
      freeRoamDistance: 95,
      colliders: []
    },
    sky: 0x55c9ed,
    fog: 0x9bdcf2
  },
  {
    id: 'beachfront',
    name: 'Beachfront',
    difficulty: 'MEDIUM',
    eyebrow: 'TRACK 4',
    description: 'Bright beachfront island. Seaside sweepers. Hotel skyline. Tropical interior.',
    accent: '#25b97a',
    accentSoft: '#d8ffd8',
    storageRevision: 'beachfront',
    sampleCount: 1440,
    freeRoamDistance: 21.5,
    collisionProfile: {
      freeRoamDistance: 21.5,
      shoulderStartDistance: 15.5,
      shoulderDrag: 1.35,
      boundaryBounce: 0.028,
      boundaryTangentRetention: 0.965,
      boundaryMinimumRecoverySpeed: 5,
      colliders: []
    },
    sky: 0x74ccf4,
    fog: 0x9edff4,
    fogNear: 480,
    fogFar: 880,
    lighting: {
      hemisphereSky: 0xcaf5ff,
      hemisphereGround: 0x73b85f,
      hemisphereIntensity: 1.2,
      directionalColor: 0xffefc2,
      directionalIntensity: 1.35
    }
  },
  {
    id: 'harbor',
    name: 'Harbor',
    difficulty: 'ADVANCED',
    eyebrow: 'TRACK 5',
    description: 'Switchbacks. Container canyons. Quayside speed.',
    accent: '#ff8f3d',
    accentSoft: '#ffd0a8',
    storageRevision: 'harbor-r80',
    freeRoamDistance: HARBOR_COLLISION_RULES.freeRoamDistance,
    collisionProfile: {
      freeRoamDistance: HARBOR_COLLISION_RULES.freeRoamDistance,
      colliders: HARBOR_COLLIDERS
    },
    sky: 0x79c3d3,
    fog: 0xb6d6d4
  },
  {
    id: 'dead-canyon',
    name: 'Dead Canyon',
    difficulty: 'ADVANCED',
    eyebrow: 'TRACK 6',
    description: 'Canyon road. Dust haze. One chicane. Long desert speed.',
    // LAB's #df3045, lifted just enough for WCAG AA black text on the selected card.
    accent: '#e5404f',
    accentSoft: '#f3a0a8',
    storageRevision: 'dead-canyon',
    sampleCount: 2160,
    freeRoamDistance: 23.5,
    collisionProfile: {
      freeRoamDistance: 23.5,
      shoulderStartDistance: 15.2,
      shoulderDrag: 1.55,
      boundaryBounce: 0.035,
      boundaryTangentRetention: 0.95,
      boundaryMinimumRecoverySpeed: 6,
      colliders: []
    },
    sky: 0xe4ad8b,
    fog: 0xe4ad8b,
    fogNear: 260,
    fogFar: 900,
    lighting: {
      hemisphereSky: 0xffd7b4,
      hemisphereGround: 0x6b3b32,
      hemisphereIntensity: 1.05,
      directionalColor: 0xffcf8d,
      directionalIntensity: 1.18
    }
  },
  {
    id: 'midnight-city',
    name: 'Midnight City',
    difficulty: 'EXPERT',
    eyebrow: 'TRACK 7',
    description: 'District avenues. Neon corners. A full-city endurance lap.',
    accent: '#9d7cff',
    accentSoft: '#d8ccff',
    storageRevision: 'midnight-city-r2',
    sampleCount: 1080,
    freeRoamDistance: 34,
    collisionProfile: {
      freeRoamDistance: 34,
      shoulderStartDistance: 19.8,
      shoulderDrag: 1.55,
      boundaryBounce: 0.04,
      boundaryTangentRetention: 0.94,
      boundaryMinimumRecoverySpeed: 6,
      colliders: []
    },
    sky: 0x070b1b,
    fog: 0x11162b,
    fogNear: 250,
    fogFar: 880,
    lighting: {
      hemisphereSky: 0x5370a8,
      hemisphereGround: 0x0b0d16,
      hemisphereIntensity: 0.72,
      directionalColor: 0x9eb9ff,
      directionalIntensity: 0.68
    }
  },
  {
    id: 'mountain',
    name: 'Mountain',
    difficulty: 'EXPERT',
    eyebrow: 'TRACK 8',
    description: 'Village climb. Snow line. Hairpin descent.',
    accent: '#4dabf7',
    accentSoft: '#d7efff',
    storageRevision: 'mountain-r1',
    sampleCount: 1080,
    freeRoamDistance: 22.2,
    collisionProfile: {
      freeRoamDistance: 22.2,
      shoulderStartDistance: 20.4,
      shoulderDrag: 1.62,
      boundaryBounce: 0.035,
      boundaryTangentRetention: 0.95,
      boundaryMinimumRecoverySpeed: 5.5,
      colliders: []
    },
    sky: 0x06132c,
    fog: 0x172744,
    fogNear: 430,
    fogFar: 1250,
    lighting: {
      hemisphereSky: 0x5a78a8,
      hemisphereGround: 0x07101b,
      hemisphereIntensity: 0.56,
      directionalColor: 0xb8d7ff,
      directionalIntensity: 0.92
    }
  }
];

const PLACEHOLDERS = [];

export const TRACK_DEFINITIONS = Object.freeze(TRACKS.map((track) => Object.freeze({
  ...track,
  lighting: Object.freeze({ ...(track.lighting || {}) }),
  collisionProfile: Object.freeze({
    ...track.collisionProfile,
    colliders: Object.freeze([...(track.collisionProfile?.colliders || [])])
  })
})));

export const TRACK_PLACEHOLDERS = Object.freeze(PLACEHOLDERS.map((track) => Object.freeze({ ...track })));

export function getTrackDefinitionData(trackId = DEFAULT_TRACK_ID) {
  return TRACK_DEFINITIONS.find((track) => track.id === trackId) || TRACK_DEFINITIONS[0];
}

export function normalizeTrackId(trackId) {
  return getTrackDefinitionData(trackId).id;
}

export function getTrackStorageRevision(trackId = DEFAULT_TRACK_ID) {
  const configured = TRACK_DEFINITIONS.find((track) => track.id === trackId);
  return configured?.storageRevision || trackId || DEFAULT_TRACK_ID;
}

export function getTrackFreeRoamDistance(trackId = DEFAULT_TRACK_ID) {
  const configured = TRACK_DEFINITIONS.find((track) => track.id === trackId);
  return configured?.freeRoamDistance || getTrackDefinitionData(DEFAULT_TRACK_ID).freeRoamDistance;
}
