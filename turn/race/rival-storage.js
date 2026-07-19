import { normalizeReplayFrames } from './replay-system.js';

export const RIVAL_LIMIT = 4;

const GHOST_KEY = 'turn-three-ghost-v4';
const COMPETITOR_KEY = 'turn-personal-rivals-v1';

export function saveRivalsState(state) {
  try {
    localStorage.setItem(COMPETITOR_KEY, JSON.stringify({
      version: 2,
      laps: state.competitorLaps
    }));
    return true;
  } catch (_) {
    return false;
  }
}

export function loadRivalsState({ state, samples, findNearestTrack }) {
  try {
    const savedRivals = JSON.parse(localStorage.getItem(COMPETITOR_KEY));
    let laps = Array.isArray(savedRivals?.laps) ? savedRivals.laps : [];

    if (!laps.length) {
      const oldGhost = JSON.parse(localStorage.getItem(GHOST_KEY));
      if (
        oldGhost &&
        Number.isFinite(oldGhost.bestTime) &&
        Array.isArray(oldGhost.frames) &&
        oldGhost.frames.length > 20
      ) {
        laps = [{ time: oldGhost.bestTime, hitAt: null, frames: oldGhost.frames }];
      }
    }

    const startSample = samples[0];
    const findProgress = (frame) => findNearestTrack(frame).index / samples.length;

    state.competitorLaps = laps
      .filter(isValidLap)
      .map((lap) => ({
        ...lap,
        hitAt: lap.hitAt != null && Number.isFinite(Number(lap.hitAt)) ? Number(lap.hitAt) : null,
        frames: normalizeReplayFrames(lap.frames, { startSample, findProgress })
      }))
      .sort((a, b) => a.time - b.time)
      .slice(0, RIVAL_LIMIT);

    syncPrimaryRivalState(state);
    if (state.competitorLaps.length) saveRivalsState(state);
    return state.competitorLaps;
  } catch (_) {
    state.competitorLaps = [];
    syncPrimaryRivalState(state);
    return state.competitorLaps;
  }
}

export function clearRivalsState(state) {
  state.competitorLaps = [];
  syncPrimaryRivalState(state);

  try {
    localStorage.removeItem(COMPETITOR_KEY);
    localStorage.removeItem(GHOST_KEY);
  } catch (_) {}
}

export function syncPrimaryRivalState(state) {
  state.bestTime = state.competitorLaps[0]?.time ?? Infinity;
  state.ghostFrames = state.competitorLaps[0]?.frames ?? [];
  state.ghostVisible = state.competitorLaps.length > 0;
}

function isValidLap(lap) {
  return Number.isFinite(lap?.time) && Array.isArray(lap?.frames) && lap.frames.length > 20;
}
