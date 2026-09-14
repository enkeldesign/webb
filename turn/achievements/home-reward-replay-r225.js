import {
  getTrophyRoadReward
} from '../progression/trophy-road-perks-r164.js?revision=r243-mountain-1300';

const PENDING_STORAGE_KEY = 'turn-home-reward-replay-v1';
const ACHIEVEMENT_STORAGE_KEY = 'turn-achievements-v1';
const HOME_REPLAY_DELAY_MS = 350;
const CURRENT_SESSION_FALLBACK_MS = 9000;
const SUPPORT_HOME_STARTED_EVENT = 'turn:support-home-feedback-started';
const SUPPORT_HOME_ENDED_EVENT = 'turn:support-home-feedback-ended';

let installed = null;

function normalizedIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === 'string' && getTrophyRoadReward(id)))];
}

function loadReplayState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(PENDING_STORAGE_KEY);
    if (!raw) return { pending: [], presented: [] };
    const parsed = JSON.parse(raw);
    return {
      pending: normalizedIds(parsed?.pending),
      presented: normalizedIds(parsed?.presented)
    };
  } catch (_) {
    return { pending: [], presented: [] };
  }
}

function unseenStoredRewards(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(ACHIEVEMENT_STORAGE_KEY);
    if (!raw) return [];
    const state = JSON.parse(raw);
    const unlocked = normalizedIds(state?.rewards?.unlocked);
    const seen = new Set(normalizedIds(state?.rewards?.seen));
    return unlocked.filter((id) => !seen.has(id));
  } catch (_) {
    return [];
  }
}

function saveReplayState(pending, presented, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(PENDING_STORAGE_KEY, JSON.stringify({
      version: 1,
      pending: [...pending],
      presented: [...presented]
    }));
    return true;
  } catch (_) {
    return false;
  }
}

function homeIsReady() {
  return Boolean(
    document.documentElement.classList.contains('turn-home-ready')
    && document.body.classList.contains('turn-home-open')
    && document.querySelector('.m8-home:not([hidden])')
  );
}

export function installHomeRewardReplay({ storage = globalThis.localStorage } = {}) {
  if (installed) return installed;
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;

  const stored = loadReplayState(storage);
  const presented = new Set(stored.presented);
  const pending = new Set(stored.pending.filter((id) => !presented.has(id)));
  for (const id of unseenStoredRewards(storage)) {
    if (!presented.has(id)) pending.add(id);
  }
  saveReplayState(pending, presented, storage);

  // These distinguish rewards earned during this document from rewards carried
  // across a closed/reopened app. A carried reward has no live runtime queue,
  // so it can be replayed as soon as Home is ready next session.
  const addedThisSession = new Set();
  const shownAwayFromHome = new Set();
  const addedAt = new Map();
  let replayTimer = 0;
  let supportFeedbackActive = false;

  const persist = () => saveReplayState(pending, presented, storage);

  function consume(ids) {
    let changed = false;
    for (const id of ids) {
      if (pending.delete(id)) changed = true;
      if (!presented.has(id)) {
        presented.add(id);
        changed = true;
      }
      addedThisSession.delete(id);
      shownAwayFromHome.delete(id);
      addedAt.delete(id);
    }
    if (changed) persist();
  }

  function rewardObjects(ids) {
    return ids.map((id) => getTrophyRoadReward(id)).filter(Boolean);
  }

  function idsReadyForHomeReplay() {
    const now = Date.now();
    return [...pending].filter((id) => {
      if (!addedThisSession.has(id)) return true;
      if (shownAwayFromHome.has(id)) return true;
      const started = Number(addedAt.get(id)) || now;
      return now - started >= CURRENT_SESSION_FALLBACK_MS;
    });
  }

  function showReplayRewards(rewards) {
    const achievements = globalThis.__turnAchievements;
    if (!achievements?.showRewardToastBatch) return false;
    achievements.showRewardToastBatch(rewards, { announce: false });
    return true;
  }

  function flushHomeReplay() {
    replayTimer = 0;
    if (supportFeedbackActive || !homeIsReady() || !pending.size) return;

    const ids = idsReadyForHomeReplay();
    if (!ids.length) {
      const waits = [...pending]
        .filter((id) => addedThisSession.has(id))
        .map((id) => CURRENT_SESSION_FALLBACK_MS - (Date.now() - (addedAt.get(id) || Date.now())));
      const nextWait = waits.length ? Math.max(250, Math.min(...waits)) : 500;
      replayTimer = globalThis.setTimeout(flushHomeReplay, nextWait);
      return;
    }

    const rewards = rewardObjects(ids);
    if (!rewards.length) {
      consume(ids);
      return;
    }
    if (!showReplayRewards(rewards)) {
      replayTimer = globalThis.setTimeout(flushHomeReplay, 120);
      return;
    }
    consume(ids);
  }

  function scheduleHomeReplay(delay = HOME_REPLAY_DELAY_MS) {
    if (supportFeedbackActive || !homeIsReady() || !pending.size) return;
    globalThis.clearTimeout(replayTimer);
    replayTimer = globalThis.setTimeout(flushHomeReplay, delay);
  }

  function handleRewardUpdate(event) {
    const ids = normalizedIds(event.detail?.unlocked);
    if (!ids.length) return;
    const now = Date.now();
    for (const id of ids) {
      presented.delete(id);
      pending.add(id);
      addedThisSession.add(id);
      shownAwayFromHome.delete(id);
      addedAt.set(id, now);
    }
    persist();
    scheduleHomeReplay();
  }

  function handleRewardToastShown(event) {
    const ids = normalizedIds(event.detail?.ids)
      .filter((id) => pending.has(id) && addedThisSession.has(id));
    if (!ids.length) return;
    if (homeIsReady()) {
      consume(ids);
      return;
    }
    for (const id of ids) shownAwayFromHome.add(id);
  }

  function handleSupportFeedbackStarted() {
    supportFeedbackActive = true;
    globalThis.clearTimeout(replayTimer);
    replayTimer = 0;
  }

  function handleSupportFeedbackEnded() {
    supportFeedbackActive = false;
    scheduleHomeReplay(220);
  }

  const handleHomeShown = () => scheduleHomeReplay();
  const handleHomeReady = () => scheduleHomeReplay();
  const handleAchievementsReady = () => scheduleHomeReplay();

  window.addEventListener('turn:trophy-road-updated', handleRewardUpdate);
  window.addEventListener('turn:trophy-road-toast-shown', handleRewardToastShown);
  window.addEventListener('turn:home-shown', handleHomeShown);
  window.addEventListener(SUPPORT_HOME_STARTED_EVENT, handleSupportFeedbackStarted);
  window.addEventListener(SUPPORT_HOME_ENDED_EVENT, handleSupportFeedbackEnded);
  window.addEventListener('turn:achievements-ready', handleAchievementsReady);
  document.addEventListener('turn:home-ready', handleHomeReady);
  scheduleHomeReplay();

  installed = Object.freeze({
    storageKey: PENDING_STORAGE_KEY,
    pendingIds: () => [...pending],
    presentedIds: () => [...presented],
    flush: flushHomeReplay,
    disconnect() {
      globalThis.clearTimeout(replayTimer);
      window.removeEventListener('turn:trophy-road-updated', handleRewardUpdate);
      window.removeEventListener('turn:trophy-road-toast-shown', handleRewardToastShown);
      window.removeEventListener('turn:home-shown', handleHomeShown);
      window.removeEventListener(SUPPORT_HOME_STARTED_EVENT, handleSupportFeedbackStarted);
      window.removeEventListener(SUPPORT_HOME_ENDED_EVENT, handleSupportFeedbackEnded);
      window.removeEventListener('turn:achievements-ready', handleAchievementsReady);
      document.removeEventListener('turn:home-ready', handleHomeReady);
      installed = null;
    }
  });
  return installed;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  installHomeRewardReplay();
}
