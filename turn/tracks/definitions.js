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

export function createTrackCatalogMetadata(definitions = TRACK_DEFINITIONS) {
  const ids = [];
  const names = {};
  const seen = new Set();

  for (const definition of definitions || []) {
    const id = typeof definition?.id === 'string' ? definition.id.trim() : '';
    const name = typeof definition?.name === 'string' ? definition.name.trim() : '';
    if (!id) throw new Error('TURN: every production track needs a non-empty id.');
    if (!name) throw new Error(`TURN: track ${id} needs a non-empty name.`);
    if (seen.has(id)) throw new Error(`TURN: duplicate production track id ${id}.`);
    seen.add(id);
    ids.push(id);
    names[id] = name;
  }

  return Object.freeze({
    ids: Object.freeze(ids),
    names: Object.freeze(names)
  });
}

const TRACK_METADATA = createTrackCatalogMetadata(TRACK_DEFINITIONS);
export const TRACK_IDS = TRACK_METADATA.ids;
export const TRACK_NAMES = TRACK_METADATA.names;

export function completeTrackOrder(preferredIds = [], trackIds = TRACK_IDS) {
  const available = new Set(trackIds);
  const ordered = [];
  const seen = new Set();

  for (const id of preferredIds || []) {
    if (!available.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  for (const id of trackIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return Object.freeze(ordered);
}

export function missingTrackConfigIds(config, trackIds = TRACK_IDS) {
  const source = config && typeof config === 'object' ? config : {};
  return Object.freeze(trackIds.filter((trackId) =>
    !Object.prototype.hasOwnProperty.call(source, trackId)
  ));
}

export function assertTrackConfigCoverage(config, label = 'track configuration', trackIds = TRACK_IDS) {
  const missing = missingTrackConfigIds(config, trackIds);
  if (missing.length) {
    throw new Error(`TURN: ${label} is missing: ${missing.join(', ')}.`);
  }
  return config;
}

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
