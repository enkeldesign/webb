import {
  HARBOR_COLLIDERS,
  HARBOR_COLLISION_RULES
} from './harbor-collision.js';

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
    id: 'airport',
    name: 'Airport',
    difficulty: 'MEDIUM',
    eyebrow: 'TRACK 2',
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
    id: 'cliffside',
    name: 'Cliffside',
    difficulty: 'MEDIUM',
    eyebrow: 'TRACK 3',
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
    id: 'harbor',
    name: 'Harbor',
    difficulty: 'HARD',
    eyebrow: 'TRACK 4',
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
    id: 'midnight-city',
    name: 'Midnight City',
    difficulty: 'HARD',
    eyebrow: 'TRACK 5',
    description: 'Boulevard speed. Neon corners. A full-city endurance lap.',
    accent: '#9d7cff',
    accentSoft: '#d8ccff',
    storageRevision: 'midnight-city-r1',
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
    fog: 0x11162b
  }
];

const PLACEHOLDERS = [
  {
    id: 'track-6-tba',
    name: 'TBA',
    difficulty: '???',
    eyebrow: 'TRACK 6',
    description: 'The next district is still under construction.',
    accent: '#8c98a8',
    accentSoft: '#d7dde5',
    locked: true
  }
];

export const TRACK_DEFINITIONS = Object.freeze(TRACKS.map((track) => Object.freeze({
  ...track,
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
