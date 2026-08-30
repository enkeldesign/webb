// TURN LAB definition overlay. All tracks inherit the current production contract;
// only MOUNTAIN gets an experiment-specific identity and a tighter no-drop envelope.
import * as production from '/turn/tracks/definitions.js?lab-base=mountain-long-r1';
import { MOUNTAIN_BRIDGE_CENTERS } from './mountain-layout.js';

const BRIDGE_RAIL_COLLIDERS = Object.freeze(MOUNTAIN_BRIDGE_CENTERS.flatMap(({ x, z }, index) => [
  Object.freeze({
    id: `mountain-lab-bridge-north-${index + 1}`,
    type: 'box',
    // The west approach is still turning as it reaches the deck. Start the
    // first hard rail where the shortened visible rail begins, leaving a
    // contained but forgiving funnel onto the bridge.
    minX: x - (index === 0 ? 3.8 : 16.6),
    maxX: x + 16.6,
    minZ: z + 14.0,
    maxZ: z + 23.0
  }),
  Object.freeze({
    id: `mountain-lab-bridge-south-${index + 1}`,
    type: 'box',
    minX: x - (index === 0 ? 3.8 : 16.6),
    maxX: x + 16.6,
    minZ: z - 23.0,
    maxZ: z - 14.0
  })
]));

export const DEFAULT_TRACK_ID = production.DEFAULT_TRACK_ID;
export const TRACK_SAMPLE_COUNT = production.TRACK_SAMPLE_COUNT;
export const TRACK_SELECTION_KEY = production.TRACK_SELECTION_KEY;

export const TRACK_DEFINITIONS = Object.freeze(production.TRACK_DEFINITIONS.map((track) => {
  if (track.id !== 'mountain') return track;
  return Object.freeze({
    ...track,
    description: 'Summit climb. Waterfall descent. Lake bridge. Valley lights.',
    storageRevision: 'mountain-lab-long-r1',
    sampleCount: 2160,
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
      colliders: Object.freeze([
        ...(track.collisionProfile.colliders || []),
        ...BRIDGE_RAIL_COLLIDERS
      ])
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
