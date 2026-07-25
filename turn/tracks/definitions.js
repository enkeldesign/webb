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
    accent: '#ff6b6b',
    accentSoft: '#ffd0c7',
    storageRevision: 'cliffside-r68',
    freeRoamDistance: 15.7,
    collisionProfile: {
      freeRoamDistance: 15.7,
      colliders: []
    },
    sky: 0x63c7ef,
    fog: 0xb5dded
  }
];

const PLACEHOLDERS = [
  {
    id: 'track-4-tba',
    name: 'TBA',
    difficulty: '',
    eyebrow: 'TRACK 4',
    description: 'A future TURN course.',
    accent: '#8b8f94',
    accentSoft: '#d1d3d5',
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
