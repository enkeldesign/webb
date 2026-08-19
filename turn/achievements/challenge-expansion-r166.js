import {
  ONBOARDING_ACHIEVEMENT_IDS,
  TRACK_IDS
} from './catalog.js?revision=r166-bella-records';

export const CHALLENGE_PROGRESS_STORAGE_KEY = 'turn-achievement-challenges-v1';
export const CLEAN_LAP_TARGETS = Object.freeze({
  countryside: 30,
  airport: 30,
  cliffside: 30,
  harbor: 60,
  'midnight-city': 120,
  mountain: 110
});

const SAMPLE_INTERVAL_MS = 50;
const GOT_STARTED_ID = 'got-started';

function normalizedTracks(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((trackId) => TRACK_IDS.includes(trackId)))];
}

export function normalizeChallengeProgress(value) {
  return {
    armyTracks: normalizedTracks(value?.armyTracks),
    cleanTracks: normalizedTracks(value?.cleanTracks)
  };
}

export function qualifiesForArmyLap(attempt, detail) {
  return Number(attempt?.rivalCountAtStart) >= 4
    && Number(detail?.position) === 1
    && Number(detail?.total) >= 5;
}

export function qualifiesForCleanLap(attempt, detail) {
  const target = CLEAN_LAP_TARGETS[attempt?.trackId];
  const seconds = Number(detail?.time);
  return attempt?.onCourseThroughout === true
    && Number.isFinite(target)
    && Number.isFinite(seconds)
    && seconds > 5
    && seconds < target;
}

function winnerAchievementId(trackId) {
  return `${trackId}-winner`;
}

function safetyAchievementId(trackId) {
  return `${trackId}-safety`;
}

function achievementContext(trackId, vehicleId = '', time = null) {
  return {
    trackId,
    vehicleId,
    time: Number.isFinite(Number(time)) ? Number(time) : null
  };
}

function loadProgress(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(CHALLENGE_PROGRESS_STORAGE_KEY);
    return normalizeChallengeProgress(raw ? JSON.parse(raw) : null);
  } catch (_) {
    return normalizeChallengeProgress(null);
  }
}

function saveProgress(progress, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(CHALLENGE_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch (_) {
    return false;
  }
}

function addTrack(progress, key, trackId) {
  if (!TRACK_IDS.includes(trackId) || progress[key].includes(trackId)) return false;
  progress[key].push(trackId);
  return true;
}

function allTracksComplete(trackIds) {
  return TRACK_IDS.every((trackId) => trackIds.includes(trackId));
}

export function installAchievementChallengeExpansion({
  runtime = globalThis.__turnRuntime,
  achievements = globalThis.__turnAchievements,
  storage = globalThis.localStorage
} = {}) {
  if (globalThis.__turnAchievementChallengeExpansion) {
    return globalThis.__turnAchievementChallengeExpansion;
  }
  if (!runtime?.state || !achievements?.unlock) return null;

  const progress = loadProgress(storage);
  let currentLap = null;

  function syncGotStarted() {
    const state = achievements.getState?.();
    const unlocked = state?.unlocked;
    if (!unlocked || Object.prototype.hasOwnProperty.call(unlocked, GOT_STARTED_ID)) return null;
    const complete = ONBOARDING_ACHIEVEMENT_IDS.every(
      (id) => Object.prototype.hasOwnProperty.call(unlocked, id)
    );
    if (!complete) return null;
    return achievements.unlock(
      GOT_STARTED_ID,
      achievementContext(
        runtime.state.trackId || globalThis.__turnGetTrackId?.() || '',
        runtime.state.vehicleId || ''
      )
    );
  }

  function unlockStoredTrackAchievements() {
    for (const trackId of progress.armyTracks) {
      achievements.unlock(winnerAchievementId(trackId), achievementContext(trackId));
    }
    for (const trackId of progress.cleanTracks) {
      achievements.unlock(safetyAchievementId(trackId), achievementContext(trackId));
    }
    if (allTracksComplete(progress.armyTracks)) {
      achievements.unlock('an-army-of-me', achievementContext(''));
    }
    if (allTracksComplete(progress.cleanTracks)) {
      achievements.unlock('on-course-of-course', achievementContext(''));
    }
  }

  function beginLap() {
    const state = runtime.state;
    currentLap = {
      trackId: state.trackId || globalThis.__turnGetTrackId?.() || '',
      vehicleId: state.vehicleId || '',
      rivalCountAtStart: Array.isArray(state.competitorLaps) ? state.competitorLaps.length : 0,
      onCourseThroughout: state.offRoad !== true
    };
  }

  function sampleCourseState() {
    if (currentLap && runtime.state.offRoad === true) currentLap.onCourseThroughout = false;
  }

  function resetLap() {
    currentLap = null;
  }

  function completeLap(detail) {
    const attempt = currentLap;
    resetLap();
    if (!attempt || !TRACK_IDS.includes(attempt.trackId)) return;

    const context = achievementContext(attempt.trackId, attempt.vehicleId, detail?.time);
    let changed = false;
    if (qualifiesForArmyLap(attempt, detail)) {
      achievements.unlock(winnerAchievementId(attempt.trackId), context);
      changed = addTrack(progress, 'armyTracks', attempt.trackId) || changed;
      if (allTracksComplete(progress.armyTracks)) {
        achievements.unlock('an-army-of-me', context);
      }
    }

    if (qualifiesForCleanLap(attempt, detail)) {
      achievements.unlock(safetyAchievementId(attempt.trackId), context);
      changed = addTrack(progress, 'cleanTracks', attempt.trackId) || changed;
      if (allTracksComplete(progress.cleanTracks)) {
        achievements.unlock('on-course-of-course', context);
      }
    }

    if (changed) saveProgress(progress, storage);
  }

  const handleUiState = (event) => {
    const reason = event.detail?.reason;
    if (reason === 'lap-started') beginLap();
    if (reason === 'race-reset') resetLap();
    if (Object.prototype.hasOwnProperty.call(event.detail || {}, 'running')
        && event.detail.running === false) {
      resetLap();
    }
  };
  const handleLapResult = (event) => completeLap(event.detail || {});
  const handleLapInvalid = () => resetLap();
  const handleAchievementsUpdated = () => syncGotStarted();

  unlockStoredTrackAchievements();
  syncGotStarted();
  globalThis.addEventListener?.('turn:ui-state-change', handleUiState);
  globalThis.addEventListener?.('turn:lap-result', handleLapResult);
  globalThis.addEventListener?.('turn:lap-invalid', handleLapInvalid);
  globalThis.addEventListener?.('turn:achievements-updated', handleAchievementsUpdated);
  const sampler = globalThis.setInterval?.(sampleCourseState, SAMPLE_INTERVAL_MS) || 0;

  const api = Object.freeze({
    progress,
    beginLap,
    sampleCourseState,
    completeLap,
    syncGotStarted,
    disconnect() {
      globalThis.removeEventListener?.('turn:ui-state-change', handleUiState);
      globalThis.removeEventListener?.('turn:lap-result', handleLapResult);
      globalThis.removeEventListener?.('turn:lap-invalid', handleLapInvalid);
      globalThis.removeEventListener?.('turn:achievements-updated', handleAchievementsUpdated);
      globalThis.clearInterval?.(sampler);
      delete globalThis.__turnAchievementChallengeExpansion;
    }
  });
  globalThis.__turnAchievementChallengeExpansion = api;
  return api;
}
