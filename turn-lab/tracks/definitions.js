// TURN LAB definition overlay. All tracks inherit the current production contract;
// only MOUNTAIN gets the long-course identity and its no-drop collision profile.
import * as production from '/turn/tracks/definitions.js?lab-base=mountain-long-r1';

export const DEFAULT_TRACK_ID = production.DEFAULT_TRACK_ID;
export const TRACK_SAMPLE_COUNT = production.TRACK_SAMPLE_COUNT;
export const TRACK_SELECTION_KEY = production.TRACK_SELECTION_KEY;

const bridgeGuide = Object.freeze({
  // Match DBE 101: assistance begins at the visible rail, applies ordinary
  // off-road drag and removes only route-normal outward motion. A route-normal
  // fallback at the rail centre keeps the car on the deck without an end face.
  baselineLimitDistance: 18.2 - 2.6,
  baselineAssistStartDistance: 15.0,
  assistStartDistance: 27 / 2 + 0.35,
  safetyAssistStartDistance: 14.45,
  hardLimitDistance: 27 / 2 + 0.42,
  railDamping: 6,
  railAcceleration: 9,
  safetyDamping: 12,
  safetyAcceleration: 24,
  penetrationAcceleration: 3.5,
  maximumPenetrationAcceleration: 28,
  minimumInwardSpeed: 2.4,
  offRoadDrag: 0.34,
  sampleCount: 2160,
  // These indices are the tested nearest samples for the actual instanced rail
  // endpoints on the 2,160-sample long route. +normal is the omitted left/north
  // entry rail, hence its later start. Feathering stays inside each visible span.
  positiveNormalRange: Object.freeze({
    startIndex: 1003,
    endIndex: 1093,
    featherSamples: 4
  }),
  negativeNormalRange: Object.freeze({
    startIndex: 992,
    endIndex: 1093,
    featherSamples: 4
  })
});

export const TRACK_DEFINITIONS = Object.freeze(production.TRACK_DEFINITIONS.map((track) => {
  if (track.id !== 'mountain') return track;
  return Object.freeze({
    ...track,
    description: 'Summit climb. Waterfall descent. Lake bridge. Valley lights.',
    storageRevision: 'mountain-lab-long-r1',
    sampleCount: 2160,
    // TURN's sampled envelope remains the general no-drop/anti-shortcut guard.
    // The bridge adds one O(1), route-normal slippery guide aligned with the
    // visible rail and selected by this bridge's unique sampled route segment.
    freeRoamDistance: 18.2,
    collisionProfile: Object.freeze({
      ...track.collisionProfile,
      freeRoamDistance: 18.2,
      shoulderStartDistance: 15.0,
      shoulderDrag: 1.78,
      boundaryBounce: 0.025,
      boundaryTangentRetention: 0.96,
      boundaryMinimumRecoverySpeed: 5.5,
      bridgeGuide,
      colliders: Object.freeze([
        ...(track.collisionProfile.colliders || [])
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
