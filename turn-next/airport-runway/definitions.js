import {
  DEFAULT_TRACK_ID,
  TRACK_DEFINITIONS as CANONICAL_TRACK_DEFINITIONS,
  TRACK_PLACEHOLDERS,
  TRACK_SAMPLE_COUNT,
  TRACK_SELECTION_KEY
} from '/turn/tracks/definitions.js?airport-runway-base=r2';
import { AIRPORT_RUNWAY_COLLISION_PROFILE } from '/turn-next/airport-runway/collision.js';
import { AIRPORT_RUNWAY_STORAGE_REVISION } from '/turn-next/airport-runway/spec.js';

export { DEFAULT_TRACK_ID, TRACK_PLACEHOLDERS, TRACK_SAMPLE_COUNT, TRACK_SELECTION_KEY };

export const TRACK_DEFINITIONS = Object.freeze(CANONICAL_TRACK_DEFINITIONS.map((track) => {
  if (track.id !== 'airport') return track;

  return Object.freeze({
    ...track,
    name: 'Airport: Runway',
    difficulty: 'MEDIUM',
    eyebrow: 'TURN NEXT TEST',
    description: 'Runway diversions. A380 obstacle. Open hangar.',
    storageRevision: AIRPORT_RUNWAY_STORAGE_REVISION,
    freeRoamDistance: AIRPORT_RUNWAY_COLLISION_PROFILE.freeRoamDistance,
    collisionProfile: AIRPORT_RUNWAY_COLLISION_PROFILE
  });
}));

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
