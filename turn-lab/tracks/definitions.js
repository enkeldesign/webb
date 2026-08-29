// TURN LAB definition overlay. All tracks inherit the current production contract;
// only MOUNTAIN gets an experiment-specific identity and a tighter no-drop envelope.
import * as production from '/turn/tracks/definitions.js?lab-base=mountain-long-r1';

export const DEFAULT_TRACK_ID = production.DEFAULT_TRACK_ID;
export const TRACK_SAMPLE_COUNT = production.TRACK_SAMPLE_COUNT;
export const TRACK_SELECTION_KEY = production.TRACK_SELECTION_KEY;

export const TRACK_DEFINITIONS = Object.freeze(production.TRACK_DEFINITIONS.map((track) => {
  if (track.id !== 'mountain') return track;
  return Object.freeze({
    ...track,
    description: 'Summit climb. Waterfall descent. Lake bridge. Valley lights.',
    storageRevision: 'mountain-lab-long-r1',
    // TURN already resolves a hard track-envelope collision before snapping the car
    // to the route surface. Tightening the LAB envelope keeps the car on the road or
    // bridge deck and prevents nearby folded road sections becoming shortcut portals.
    freeRoamDistance: 18.2,
    collisionProfile: Object.freeze({
      ...track.collisionProfile,
      freeRoamDistance: 18.2,
      shoulderStartDistance: 15.0,
      shoulderDrag: 1.78,
      boundaryBounce: 0.025,
      boundaryTangentRetention: 0.96,
      boundaryMinimumRecoverySpeed: 5.5,
      colliders: track.collisionProfile.colliders
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
