// TURN LAB definition overlay. All production tracks are inherited unchanged;
// only the internal MOUNTAIN slot becomes DEAD CANYON inside /turn-lab/.
import * as production from '/turn/tracks/definitions.js?lab-base=dead-canyon-r6';

export const DEFAULT_TRACK_ID = production.DEFAULT_TRACK_ID;
export const TRACK_SAMPLE_COUNT = production.TRACK_SAMPLE_COUNT;
export const TRACK_SELECTION_KEY = production.TRACK_SELECTION_KEY;

export const TRACK_DEFINITIONS = Object.freeze(production.TRACK_DEFINITIONS.map((track) => {
  if (track.id !== 'mountain') return track;
  return Object.freeze({
    ...track,
    name: 'Dead Canyon',
    difficulty: 'ADVANCED',
    eyebrow: 'LAB TRACK',
    description: 'Canyon road. Dust haze. Dark tunnel. Long desert speed.',
    accent: '#ff7a3d',
    accentSoft: '#ffd0ad',
    storageRevision: 'dead-canyon-lab-r4',
    sampleCount: 2160,
    freeRoamDistance: 23.5,
    collisionProfile: Object.freeze({
      freeRoamDistance: 23.5,
      shoulderStartDistance: 15.2,
      shoulderDrag: 1.55,
      boundaryBounce: 0.035,
      boundaryTangentRetention: 0.95,
      boundaryMinimumRecoverySpeed: 6,
      colliders: Object.freeze([])
    }),
    sky: 0xe4ad8b,
    fog: 0xe4ad8b,
    fogNear: 260,
    fogFar: 760,
    lighting: Object.freeze({
      hemisphereSky: 0xffd7b4,
      hemisphereGround: 0x6b3b32,
      hemisphereIntensity: 1.05,
      directionalColor: 0xffcf8d,
      directionalIntensity: 1.18
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
