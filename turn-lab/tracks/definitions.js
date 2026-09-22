// TURN LAB definition overlay. All production tracks are inherited unchanged;
// only the MOUNTAIN slot becomes BADLANDS inside the isolated LAB deployment.
import * as production from '/turn/tracks/definitions.js?lab-base=badlands-r1';

export const DEFAULT_TRACK_ID = production.DEFAULT_TRACK_ID;
export const TRACK_SAMPLE_COUNT = production.TRACK_SAMPLE_COUNT;
export const TRACK_SELECTION_KEY = production.TRACK_SELECTION_KEY;

export const TRACK_DEFINITIONS = Object.freeze(production.TRACK_DEFINITIONS.map((track) => {
  if (track.id !== 'mountain') return track;
  return Object.freeze({
    ...track,
    name: 'Badlands',
    difficulty: 'ADVANCED',
    eyebrow: 'LAB TRACK',
    description: 'Desert dusk. Canyon rhythm. Solar-basin speed.',
    accent: '#ff7a3d',
    accentSoft: '#ffd0ad',
    storageRevision: 'badlands-lab-r1',
    sampleCount: 1440,
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
    sky: 0x542841,
    fog: 0xb56355,
    fogNear: 360,
    fogFar: 1050,
    lighting: Object.freeze({
      hemisphereSky: 0xffb27a,
      hemisphereGround: 0x3a1f2b,
      hemisphereIntensity: 0.72,
      directionalColor: 0xffd1a3,
      directionalIntensity: 0.82
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
