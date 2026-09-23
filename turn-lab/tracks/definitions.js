// TURN LAB definition overlay. All production tracks are inherited unchanged;
// only the internal MOUNTAIN slot becomes SUBURBS inside /turn-lab/.
import * as production from '/turn/tracks/definitions.js?lab-base=suburbs';

export const DEFAULT_TRACK_ID = production.DEFAULT_TRACK_ID;
export const TRACK_SAMPLE_COUNT = production.TRACK_SAMPLE_COUNT;
export const TRACK_SELECTION_KEY = production.TRACK_SELECTION_KEY;

export const TRACK_DEFINITIONS = Object.freeze(production.TRACK_DEFINITIONS.map((track) => {
  if (track.id !== 'mountain') return track;
  return Object.freeze({
    ...track,
    name: 'Suburbs',
    difficulty: 'EASY',
    eyebrow: 'LAB TRACK',
    description: 'Sunny streets. Wide corners. Park, lake and colourful homes.',
    accent: '#25b97a',
    accentSoft: '#d8ffd8',
    storageRevision: 'suburbs-lab',
    sampleCount: 1440,
    freeRoamDistance: 21.5,
    collisionProfile: Object.freeze({
      freeRoamDistance: 21.5,
      shoulderStartDistance: 15.5,
      shoulderDrag: 1.35,
      boundaryBounce: 0.028,
      boundaryTangentRetention: 0.965,
      boundaryMinimumRecoverySpeed: 5,
      colliders: Object.freeze([])
    }),
    sky: 0x74ccf4,
    fog: 0x9edff4,
    fogNear: 480,
    fogFar: 880,
    lighting: Object.freeze({
      hemisphereSky: 0xcaf5ff,
      hemisphereGround: 0x73b85f,
      hemisphereIntensity: 1.2,
      directionalColor: 0xffefc2,
      directionalIntensity: 1.35
    })
  });
}));

export const TRACK_PLACEHOLDERS = production.TRACK_PLACEHOLDERS;

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
