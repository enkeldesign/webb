// Production track-definition overlay for the promoted long MOUNTAIN course.
// Every non-MOUNTAIN track is the exact previous production definition.
import * as base from './definitions-base.js';

export const DEFAULT_TRACK_ID = base.DEFAULT_TRACK_ID;
export const TRACK_SAMPLE_COUNT = base.TRACK_SAMPLE_COUNT;
export const TRACK_SELECTION_KEY = base.TRACK_SELECTION_KEY;

const bridgeGuide = Object.freeze({
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
  // The smoothed start/finish approach shortens the closed curve slightly, so
  // the same physical rail endpoints land two samples later after arc-length
  // resampling. Keep the slippery guide aligned with the visible bridge rails.
  positiveNormalRange: Object.freeze({
    startIndex: 1005,
    endIndex: 1095,
    featherSamples: 4
  }),
  negativeNormalRange: Object.freeze({
    startIndex: 994,
    endIndex: 1095,
    featherSamples: 4
  })
});

export const TRACK_DEFINITIONS = Object.freeze(base.TRACK_DEFINITIONS.map((track) => {
  if (track.id !== 'mountain') return track;
  return Object.freeze({
    ...track,
    description: 'Summit climb. Waterfall descent. Lake bridge. Valley lights.',
    // The smoothed start/finish approach changes absolute replay coordinates.
    // Deliberately start fresh rather than reinterpret r2 ghosts/PBs on r3 geometry.
    storageRevision: 'mountain-r3-start-seam',
    sampleCount: 2160,
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
      colliders: Object.freeze([...(track.collisionProfile.colliders || [])])
    })
  });
}));

export const TRACK_PLACEHOLDERS = base.TRACK_PLACEHOLDERS;

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
