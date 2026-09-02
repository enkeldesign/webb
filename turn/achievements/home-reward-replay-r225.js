import {
  TROPHY_ROAD_REWARD_ICONS,
  getTrophyRoadReward
} from '../progression/trophy-road-perks-r164.js?revision=r226-shift';

const PENDING_STORAGE_KEY = 'turn-home-reward-replay-v1';
const ACHIEVEMENT_STORAGE_KEY = 'turn-achievements-v1';
const HOME_REPLAY_DELAY_MS = 350;
const CURRENT_SESSION_FALLBACK_MS = 9000;
const TOAST_VISIBLE_MS = 3600;
const TOAST_CONCEAL_MS = 220;

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

function rewardToastElement() {
  return document.querySelector('.turn-trophy-reward-toast');
}

function toastIsVisible(toast) {
  return Boolean(toast && !toast.hidden && toast.classList.contains('is-visible'));
}

function writeRewardToast(toast, rewards) {
  const first = rewards[0];
  toast.querySelector('.turn-achievement-toast-icon').innerHTML = TROPHY_ROAD_REWARD_ICONS[first.icon] || '';
  toast.querySelector('span').textContent = rewards.length === 1
    ? 'TROPHY ROAD REWARD'
    : `${rewards.length} TROPHY ROAD REWARDS`;
  toast.querySelector('strong').textContent = rewards.length === 1
    ? first.title
    : `${first.title} + ${rewards.length - 1} MORE`;
  toast.querySelector('b').textContent = 'UNLOCKED';
  toast.setAttribute(
    'aria-label',
    `${rewards.length === 1 ? 'Trophy Road reward unlocked' : `${rewards.length} Trophy Road rewards unlocked`}. ${rewards.map((reward) => reward.shortTitle).join(', ')}.`
  );
}

function presentRewardToast(toast, rewards, onShown) {
  if (!toast || !rewards.length) return false;
  writeRewardToast(toast, rewards);
  toast.hidden = false;
  toast.classList.remove('is-visible');
  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
    onShown?.();
  });
  globalThis.setTimeout(() => {
    toast.classList.remove('is-visible');
    globalThis.setTimeout(() => {
      toast.hidden = true;
    }, TOAST_CONCEAL_MS);
  }, TOAST_VISIBLE_MS);
  return true;
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
  // across a closed/reopened app. A carried reward has no live race-toast timer,
  // so it can be replayed as soon as Home is ready next session.
  const addedThisSession = new Set();
  const shownAwayFromHome = new Set();
  const addedAt = new Map();
  let replayTimer = 0;
  let replayInProgress = false;
  let observedToast = null;
  let toastWasVisible = false;
  let toastObserver = null;

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

  function ensureToastObserver() {
    const toast = rewardToastElement();
    if (!toast || toast === observedToast) return toast;
    toastObserver?.disconnect();
    observedToast = toast;
    toastWasVisible = toastIsVisible(toast);
    toastObserver = new MutationObserver(() => {
      const visible = toastIsVisible(toast);
      if (visible && !toastWasVisible && !replayInProgress) {
        const currentIds = [...pending].filter((id) => addedThisSession.has(id));
        if (homeIsReady()) {
          // The ordinary race reward toast reached the player only after they had
          // already returned Home. That already satisfies the Home reminder, so do
          // not immediately show a duplicate copy of the same message.
          consume(currentIds);
        } else {
          for (const id of currentIds) shownAwayFromHome.add(id);
        }
      }
      toastWasVisible = visible;
    });
    toastObserver.observe(toast, {
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
    return toast;
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

  function flushHomeReplay() {
    replayTimer = 0;
    if (!homeIsReady() || !pending.size) return;
    const toast = ensureToastObserver();
    if (!toast) {
      replayTimer = globalThis.setTimeout(flushHomeReplay, 120);
      return;
    }
    if (toastIsVisible(toast)) {
      replayTimer = globalThis.setTimeout(flushHomeReplay, 300);
      return;
    }

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

    replayInProgress = true;
    presentRewardToast(toast, rewards, () => {
      consume(ids);
      // Keep the observer from treating our deliberately replayed toast as the
      // original in-race presentation.
      toastWasVisible = true;
      replayInProgress = false;
    });
  }

  function scheduleHomeReplay(delay = HOME_REPLAY_DELAY_MS) {
    if (!homeIsReady() || !pending.size) return;
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
    ensureToastObserver();
    scheduleHomeReplay();
  }

  let homeWasOpen = document.body.classList.contains('turn-home-open');
  const homeObserver = new MutationObserver(() => {
    ensureToastObserver();
    const open = document.body.classList.contains('turn-home-open');
    if (open && !homeWasOpen) scheduleHomeReplay();
    homeWasOpen = open;
  });
  homeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const toastMountObserver = new MutationObserver(() => ensureToastObserver());
  toastMountObserver.observe(document.body, { childList: true });

  const handleHomeReady = () => scheduleHomeReplay();
  window.addEventListener('turn:trophy-road-updated', handleRewardUpdate);
  document.addEventListener('turn:home-ready', handleHomeReady);
  ensureToastObserver();
  scheduleHomeReplay();

  installed = Object.freeze({
    storageKey: PENDING_STORAGE_KEY,
    pendingIds: () => [...pending],
    presentedIds: () => [...presented],
    flush: flushHomeReplay,
    disconnect() {
      globalThis.clearTimeout(replayTimer);
      homeObserver.disconnect();
      toastMountObserver.disconnect();
      toastObserver?.disconnect();
      window.removeEventListener('turn:trophy-road-updated', handleRewardUpdate);
      document.removeEventListener('turn:home-ready', handleHomeReady);
      installed = null;
    }
  });
  return installed;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  installHomeRewardReplay();
}
