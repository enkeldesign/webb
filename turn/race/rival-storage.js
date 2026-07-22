import { normalizeReplayFrames } from './replay-system.js';
import {
  DEFAULT_VEHICLE_COLOR,
  DEFAULT_VEHICLE_ID,
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  normalizeVehicleColor,
  normalizeVehicleId,
  normalizeVehicleSecondaryColor
} from '../vehicle/catalog.js?build=20260720-r19';

export const RIVAL_LIMIT = 4;

const DEFAULT_TRACK_ID = 'countryside';
const GHOST_KEY = 'turn-three-ghost-v4';
const COMPETITOR_KEY = 'turn-personal-rivals-v1';
const LEGACY_RIVAL_COLORS = ['#38d9ff', '#ff4fa3', '#9775fa', '#ff922b'];

function normalizeTrackId(trackId) {
  return typeof trackId === 'string' && trackId.trim() ? trackId.trim() : DEFAULT_TRACK_ID;
}

function rivalKey(trackId) {
  const normalized = normalizeTrackId(trackId);
  return normalized === DEFAULT_TRACK_ID ? COMPETITOR_KEY : `${COMPETITOR_KEY}:${normalized}`;
}

function ghostKey(trackId) {
  const normalized = normalizeTrackId(trackId);
  return normalized === DEFAULT_TRACK_ID ? GHOST_KEY : `${GHOST_KEY}:${normalized}`;
}

function stateTrackId(state, explicitTrackId) {
  return normalizeTrackId(explicitTrackId || state?.trackId || DEFAULT_TRACK_ID);
}

export function saveRivalsState(state, { trackId } = {}) {
  try {
    const activeTrackId = stateTrackId(state, trackId);
    localStorage.setItem(rivalKey(activeTrackId), JSON.stringify({
      version: 5,
      trackId: activeTrackId,
      laps: state.competitorLaps
    }));
    return true;
  } catch (_) {
    return false;
  }
}

export function loadRivalsState({ state, samples, findNearestTrack, trackId }) {
  const activeTrackId = stateTrackId(state, trackId);

  try {
    const savedRivals = JSON.parse(localStorage.getItem(rivalKey(activeTrackId)));
    let laps = Array.isArray(savedRivals?.laps) ? savedRivals.laps : [];

    if (!laps.length && activeTrackId === DEFAULT_TRACK_ID) {
      const oldGhost = JSON.parse(localStorage.getItem(ghostKey(activeTrackId)));
      if (
        oldGhost &&
        Number.isFinite(oldGhost.bestTime) &&
        Array.isArray(oldGhost.frames) &&
        oldGhost.frames.length > 20
      ) {
        laps = [{
          time: oldGhost.bestTime,
          hitAt: null,
          carId: DEFAULT_VEHICLE_ID,
          carColor: DEFAULT_VEHICLE_COLOR,
          carSecondaryColor: DEFAULT_VEHICLE_SECONDARY_COLOR,
          frames: oldGhost.frames
        }];
      }
    }

    const startSample = samples[0];
    const findProgress = (frame) => findNearestTrack(frame).index / samples.length;

    state.trackId = activeTrackId;
    state.competitorLaps = laps
      .filter(isValidLap)
      .map((lap, index) => ({
        ...lap,
        hitAt: lap.hitAt != null && Number.isFinite(Number(lap.hitAt)) ? Number(lap.hitAt) : null,
        carId: normalizeVehicleId(lap.carId),
        carColor: lap.carColor
          ? normalizeVehicleColor(lap.carColor)
          : LEGACY_RIVAL_COLORS[index % LEGACY_RIVAL_COLORS.length],
        carSecondaryColor: normalizeVehicleSecondaryColor(lap.carSecondaryColor),
        frames: normalizeReplayFrames(lap.frames, { startSample, findProgress })
      }))
      .sort((a, b) => a.time - b.time)
      .slice(0, RIVAL_LIMIT);

    syncPrimaryRivalState(state);
    if (state.competitorLaps.length) saveRivalsState(state, { trackId: activeTrackId });
    return state.competitorLaps;
  } catch (_) {
    state.trackId = activeTrackId;
    state.competitorLaps = [];
    syncPrimaryRivalState(state);
    return state.competitorLaps;
  }
}

export function clearRivalsState(state, { trackId } = {}) {
  const activeTrackId = stateTrackId(state, trackId);
  state.trackId = activeTrackId;
  state.competitorLaps = [];
  syncPrimaryRivalState(state);

  try {
    localStorage.removeItem(rivalKey(activeTrackId));
    localStorage.removeItem(ghostKey(activeTrackId));
  } catch (_) {}
}

export function getStoredBestTime(trackId = DEFAULT_TRACK_ID) {
  const activeTrackId = normalizeTrackId(trackId);
  try {
    const savedRivals = JSON.parse(localStorage.getItem(rivalKey(activeTrackId)));
    const times = Array.isArray(savedRivals?.laps)
      ? savedRivals.laps.map((lap) => Number(lap?.time)).filter(Number.isFinite)
      : [];
    if (times.length) return Math.min(...times);

    if (activeTrackId === DEFAULT_TRACK_ID) {
      const oldGhost = JSON.parse(localStorage.getItem(ghostKey(activeTrackId)));
      if (Number.isFinite(Number(oldGhost?.bestTime))) return Number(oldGhost.bestTime);
    }
  } catch (_) {}
  return Infinity;
}

export function syncPrimaryRivalState(state) {
  state.bestTime = state.competitorLaps[0]?.time ?? Infinity;
  state.ghostFrames = state.competitorLaps[0]?.frames ?? [];
  state.ghostVisible = state.competitorLaps.length > 0;
}

function isValidLap(lap) {
  return Number.isFinite(lap?.time) && Array.isArray(lap?.frames) && lap.frames.length > 20;
}