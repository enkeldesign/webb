const SUPPORT_FEEDBACK_STORAGE_KEY = 'turn-support-feedback-v1';
const RACE_SUPPORT_BONUS_PATTERN = /^support:(?:winner|safety|drift):/;
const SUPPORT_PILL_VISIBLE_MS = 3200;
const TOAST_CONCEAL_MS = 220;
const REWARD_TOAST_VISIBLE_MS = 3600;
const LOT_SELECTION_TIMEOUT_MS = 12000;
const ACHIEVEMENT_FALLBACK_MS = 5600;
const STYLE_ID = 'turn-support-challenge-feedback-styles';

let installed = false;

export function isRaceSupportBonusId(id) {
  return typeof id === 'string' && RACE_SUPPORT_BONUS_PATTERN.test(id);
}

function safeStorage(storage = globalThis.localStorage) {
  return storage?.getItem && storage?.setItem && storage?.removeItem ? storage : null;
}

function loadPendingCompletion(storage = globalThis.localStorage) {
  const persistent = safeStorage(storage);
  if (!persistent) return null;
  try {
    const parsed = JSON.parse(persistent.getItem(SUPPORT_FEEDBACK_STORAGE_KEY) || 'null');
    const pending = parsed?.pending;
    const trophies = Math.round(Number(pending?.trophies));
    if (!isRaceSupportBonusId(pending?.id) || !Number.isFinite(trophies) || trophies <= 0) return null;
    return {
      id: pending.id,
      trophies,
      at: Number(pending.at) || Date.now()
    };
  } catch (_) {
    return null;
  }
}

function savePendingCompletion(completion, storage = globalThis.localStorage) {
  const persistent = safeStorage(storage);
  if (!persistent) return false;
  try {
    persistent.setItem(SUPPORT_FEEDBACK_STORAGE_KEY, JSON.stringify({
      version: 1,
      pending: completion
    }));
    return true;
  } catch (_) {
    return false;
  }
}

function clearPendingCompletion(storage = globalThis.localStorage) {
  try {
    storage?.removeItem?.(SUPPORT_FEEDBACK_STORAGE_KEY);
  } catch (_) {}
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .turn-support-bonus-toast {
      top: calc(max(8px, env(safe-area-inset-top)) + clamp(82px, 17vh, 112px)) !important;
      bottom: auto !important;
      display: flex !important;
      align-items: center;
      justify-content: center;
      gap: .45em !important;
      width: max-content !important;
      min-width: 0 !important;
      max-width: min(92vw, 560px) !important;
      padding: 8px 16px !important;
      border: 4px solid var(--turn-ink, #08090a) !important;
      border-radius: 999px !important;
      background: var(--turn-green-500, #8ce99a) !important;
      box-shadow: 5px 5px 0 var(--turn-ink, #08090a) !important;
      line-height: 1 !important;
      white-space: nowrap;
      transform: translate(-50%, -8px) scale(.96) !important;
      transition: opacity .18s ease, transform .22s cubic-bezier(.2,.85,.3,1.18) !important;
    }
    .turn-support-bonus-toast[hidden] { display: none !important; }
    .turn-support-bonus-toast.is-visible {
      opacity: 1 !important;
      transform: translate(-50%, 0) scale(1) !important;
    }
    .turn-support-bonus-toast span,
    .turn-support-bonus-toast strong {
      display: inline !important;
      margin: 0 !important;
      font-size: clamp(.66rem, 1.6vw, .86rem) !important;
      font-weight: 950 !important;
      letter-spacing: .045em !important;
      line-height: 1 !important;
    }
    .turn-support-bonus-toast strong { letter-spacing: .025em !important; }
    .turn-support-completion-indicator {
      pointer-events: none !important;
      animation: turn-support-completion-pulse 3.2s ease-out both;
    }
    .turn-support-completion-indicator .turn-support-challenge-mark {
      background: var(--turn-green-500, #8ce99a) !important;
    }
    @keyframes turn-support-completion-pulse {
      0% { opacity: 1; transform: scale(1); }
      13% { opacity: 1; transform: scale(1.14); }
      27% { opacity: 1; transform: scale(1); }
      42% { opacity: 1; transform: scale(1.10); }
      58% { opacity: 1; transform: scale(1); }
      78% { opacity: .78; transform: scale(.92); }
      100% { opacity: 0; transform: scale(.70); }
    }
    @media (prefers-reduced-motion: reduce) {
      .turn-support-bonus-toast { transition: opacity .12s linear !important; transform: translate(-50%, 0) !important; }
      .turn-support-bonus-toast.is-visible { transform: translate(-50%, 0) !important; }
      .turn-support-completion-indicator { animation: turn-support-completion-fade 3.2s linear both; }
      @keyframes turn-support-completion-fade {
        0%, 72% { opacity: 1; }
        100% { opacity: 0; }
      }
    }
  `;
  document.head.appendChild(style);
}

function recommendedLotButton(vehicleId) {
  if (!vehicleId) return null;
  return document.querySelector(`.lot-screen .lot-car-option[data-car-id="${vehicleId}"]:not([disabled])`);
}

function selectRecommendedLotCar(vehicleId) {
  if (!vehicleId) return false;
  const select = () => {
    const button = recommendedLotButton(vehicleId);
    if (!button) return false;
    button.click();
    return true;
  };
  if (select()) return true;

  const observer = new MutationObserver(() => {
    if (!select()) return;
    observer.disconnect();
    globalThis.clearTimeout(timeout);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timeout = globalThis.setTimeout(() => observer.disconnect(), LOT_SELECTION_TIMEOUT_MS);
  return true;
}

function homeIsOpen() {
  return Boolean(
    document.body.classList.contains('turn-home-open')
    && document.querySelector('.m8-home:not([hidden])')
  );
}

function supportToastElement() {
  return document.querySelector('.turn-support-bonus-toast:not(.turn-support-home-toast)');
}

function achievementToastElement() {
  return document.querySelector('.turn-achievement-toast:not(.turn-trophy-reward-toast)');
}

function rewardToastElement() {
  return document.querySelector('.turn-trophy-reward-toast');
}

function toastIsVisible(toast) {
  return Boolean(toast && !toast.hidden && toast.classList.contains('is-visible'));
}

function setSupportPillCopy(toast, { label = 'CHALLENGE COMPLETE', trophies = 0 } = {}) {
  if (!toast) return;
  const labelNode = toast.querySelector('span');
  const valueNode = toast.querySelector('strong');
  if (labelNode) labelNode.textContent = label;
  if (valueNode) valueNode.textContent = `+${Math.max(0, Math.round(Number(trophies) || 0))} 🏆`;
}

function revealSupportPill(toast, completion, { duration = SUPPORT_PILL_VISIBLE_MS } = {}) {
  if (!toast || !completion) return false;
  setSupportPillCopy(toast, completion);
  toast.hidden = false;
  toast.classList.remove('is-visible');
  globalThis.requestAnimationFrame(() => toast.classList.add('is-visible'));
  globalThis.setTimeout(() => {
    toast.classList.remove('is-visible');
    globalThis.setTimeout(() => { toast.hidden = true; }, TOAST_CONCEAL_MS);
  }, duration);
  return true;
}

function makeHomePill(completion) {
  const toast = document.createElement('div');
  toast.className = 'turn-support-bonus-toast turn-support-home-toast';
  toast.hidden = true;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = '<span></span><strong></strong>';
  document.body.appendChild(toast);
  revealSupportPill(toast, completion);
  return toast;
}

function makeCompletionIndicator() {
  const source = document.querySelector('.turn-support-challenge-trigger');
  if (!source) return null;
  const indicator = source.cloneNode(true);
  indicator.classList.add('turn-support-completion-indicator');
  indicator.hidden = false;
  indicator.disabled = true;
  indicator.tabIndex = -1;
  indicator.setAttribute('aria-hidden', 'true');
  indicator.removeAttribute('aria-label');
  const mark = indicator.querySelector('.turn-support-challenge-mark');
  if (mark) {
    mark.hidden = false;
    mark.textContent = '✓';
  }
  source.insertAdjacentElement('afterend', indicator);
  return indicator;
}

function snapshotRewardToast(toast) {
  if (!toast) return null;
  const guide = toast.querySelector('[data-trophy-reward-guide]');
  return {
    icon: toast.querySelector('.turn-achievement-toast-icon')?.innerHTML || '',
    label: toast.querySelector('[data-achievement-toast-label]')?.textContent || '',
    title: toast.querySelector('[data-achievement-toast-title]')?.textContent || '',
    badge: toast.querySelector('[data-achievement-toast-badge]')?.textContent || '',
    guideHidden: guide ? guide.hidden : true,
    ariaLabel: toast.getAttribute('aria-label') || '',
    interceptedAt: Date.now()
  };
}

function restoreRewardToast(toast, snapshot) {
  if (!toast || !snapshot) return;
  const icon = toast.querySelector('.turn-achievement-toast-icon');
  const label = toast.querySelector('[data-achievement-toast-label]');
  const title = toast.querySelector('[data-achievement-toast-title]');
  const badge = toast.querySelector('[data-achievement-toast-badge]');
  const guide = toast.querySelector('[data-trophy-reward-guide]');
  if (icon) icon.innerHTML = snapshot.icon;
  if (label) label.textContent = snapshot.label;
  if (title) title.textContent = snapshot.title;
  if (badge) badge.textContent = snapshot.badge;
  if (guide) guide.hidden = snapshot.guideHidden;
  if (snapshot.ariaLabel) toast.setAttribute('aria-label', snapshot.ariaLabel);
}

function concealToastImmediately(toast) {
  if (!toast) return;
  toast.classList.remove('is-visible');
  toast.hidden = true;
}

export function installSupportChallengeFeedback({ storage = globalThis.localStorage } = {}) {
  if (installed || typeof document === 'undefined' || typeof window === 'undefined') return installed;
  installed = true;
  installStyles();

  let recentAchievementIds = [];
  let recentAchievementClearTimer = 0;
  let lastRaceCompletion = null;
  let raceAwaitingAchievement = false;
  let raceRewardBlocked = false;
  let achievementFallbackTimer = 0;
  let homeFeedbackBusy = false;
  let homeFeedbackShownFor = '';
  let deferredReward = null;
  let deferredRewardTimer = 0;
  let supportObserver = null;
  let supportObservedNode = null;
  let achievementObserver = null;
  let achievementObservedNode = null;
  let rewardObserver = null;
  let rewardObservedNode = null;

  function rewardBlocked() {
    return raceRewardBlocked || homeFeedbackBusy;
  }

  function scheduleDeferredReward() {
    globalThis.clearTimeout(deferredRewardTimer);
    if (!deferredReward || rewardBlocked()) return;
    const safeAt = deferredReward.snapshot.interceptedAt + REWARD_TOAST_VISIBLE_MS + TOAST_CONCEAL_MS + 80;
    const wait = Math.max(120, safeAt - Date.now());
    deferredRewardTimer = globalThis.setTimeout(() => {
      deferredRewardTimer = 0;
      if (!deferredReward || rewardBlocked()) return;
      const toast = rewardToastElement();
      if (!toast) {
        scheduleDeferredReward();
        return;
      }
      const pending = deferredReward;
      deferredReward = null;
      restoreRewardToast(toast, pending.snapshot);
      toast.hidden = false;
      toast.classList.remove('is-visible');
      globalThis.requestAnimationFrame(() => toast.classList.add('is-visible'));
      globalThis.setTimeout(() => {
        toast.classList.remove('is-visible');
        globalThis.setTimeout(() => { toast.hidden = true; }, TOAST_CONCEAL_MS);
      }, REWARD_TOAST_VISIBLE_MS);
    }, wait);
  }

  function deferVisibleReward(toast) {
    const snapshot = snapshotRewardToast(toast);
    if (!snapshot) return;
    deferredReward = { snapshot };
    concealToastImmediately(toast);
  }

  function handleSupportToastMutation(toast) {
    if (!toastIsVisible(toast)) return;
    if (lastRaceCompletion) setSupportPillCopy(toast, lastRaceCompletion);
    if (!raceAwaitingAchievement) return;
    concealToastImmediately(toast);
  }

  function handleAchievementToastMutation(toast) {
    const visible = toastIsVisible(toast);
    if (visible && raceAwaitingAchievement && lastRaceCompletion) {
      raceAwaitingAchievement = false;
      globalThis.clearTimeout(achievementFallbackTimer);
      achievementFallbackTimer = 0;
      const supportToast = supportToastElement();
      if (supportToast) revealSupportPill(supportToast, lastRaceCompletion);
      return;
    }
    if (!visible && raceRewardBlocked && !raceAwaitingAchievement) {
      raceRewardBlocked = false;
      scheduleDeferredReward();
    }
  }

  function handleRewardToastMutation(toast) {
    if (!toastIsVisible(toast)) return;
    if (rewardBlocked()) {
      deferVisibleReward(toast);
      return;
    }
    // A normally queued reward reached the player after the challenge/achievement
    // sequence ended. It owns the presentation now; a previously intercepted copy
    // would only duplicate it.
    deferredReward = null;
    globalThis.clearTimeout(deferredRewardTimer);
    deferredRewardTimer = 0;
  }

  function ensureToastObservers() {
    const supportToast = supportToastElement();
    if (supportToast && supportToast !== supportObservedNode) {
      supportObserver?.disconnect();
      supportObservedNode = supportToast;
      supportObserver = new MutationObserver(() => handleSupportToastMutation(supportToast));
      supportObserver.observe(supportToast, { attributes: true, attributeFilter: ['class', 'hidden'], childList: true, subtree: true });
    }

    const achievementToast = achievementToastElement();
    if (achievementToast && achievementToast !== achievementObservedNode) {
      achievementObserver?.disconnect();
      achievementObservedNode = achievementToast;
      achievementObserver = new MutationObserver(() => handleAchievementToastMutation(achievementToast));
      achievementObserver.observe(achievementToast, { attributes: true, attributeFilter: ['class', 'hidden'] });
    }

    const rewardToast = rewardToastElement();
    if (rewardToast && rewardToast !== rewardObservedNode) {
      rewardObserver?.disconnect();
      rewardObservedNode = rewardToast;
      rewardObserver = new MutationObserver(() => handleRewardToastMutation(rewardToast));
      rewardObserver.observe(rewardToast, { attributes: true, attributeFilter: ['class', 'hidden'] });
    }
  }

  function showHomeCompletion(completion) {
    if (!completion || !homeIsOpen() || homeFeedbackBusy || homeFeedbackShownFor === completion.id) return false;
    homeFeedbackBusy = true;
    homeFeedbackShownFor = completion.id;
    ensureToastObservers();

    const pill = makeHomePill({ label: 'CHALLENGE COMPLETE', trophies: completion.trophies });
    const indicator = makeCompletionIndicator();

    globalThis.setTimeout(() => {
      pill.classList.remove('is-visible');
      globalThis.setTimeout(() => pill.remove(), TOAST_CONCEAL_MS);
      indicator?.remove();
      clearPendingCompletion(storage);
      homeFeedbackBusy = false;
      scheduleDeferredReward();
    }, SUPPORT_PILL_VISIBLE_MS);
    return true;
  }

  function maybeShowPendingHomeCompletion() {
    if (!homeIsOpen()) return false;
    const pending = loadPendingCompletion(storage);
    return showHomeCompletion(pending);
  }

  document.addEventListener('click', (event) => {
    const start = event.target?.closest?.('[data-support-start]');
    if (!start) return;
    const active = globalThis.__turnSupportChallenges?.state?.active;
    if (!active || active.type === 'learning' || !active.trackId || !active.vehicleId) return;
    // The existing support handler remains authoritative for track selection and
    // navigation. Arm the Lot selection first so its recommended car is selected
    // as soon as the showroom DOM is created, before the next paint.
    selectRecommendedLotCar(active.vehicleId);
  }, true);

  window.addEventListener('turn:achievements-updated', (event) => {
    recentAchievementIds = Array.isArray(event.detail?.unlocked)
      ? event.detail.unlocked.filter((id) => typeof id === 'string' && id)
      : [];
    globalThis.clearTimeout(recentAchievementClearTimer);
    recentAchievementClearTimer = globalThis.setTimeout(() => {
      recentAchievementIds = [];
      recentAchievementClearTimer = 0;
    }, 0);
  });

  window.addEventListener('turn:trophy-bonus', (event) => {
    const detail = event.detail || {};
    if (!isRaceSupportBonusId(detail.id)) return;
    const completion = {
      id: detail.id,
      trophies: Math.max(1, Math.round(Number(detail.trophies) || 0)),
      at: Date.now()
    };
    lastRaceCompletion = completion;
    savePendingCompletion(completion, storage);
    ensureToastObservers();

    if (recentAchievementIds.length) {
      raceAwaitingAchievement = true;
      raceRewardBlocked = true;
      globalThis.clearTimeout(achievementFallbackTimer);
      achievementFallbackTimer = globalThis.setTimeout(() => {
        if (!raceAwaitingAchievement || !lastRaceCompletion) return;
        raceAwaitingAchievement = false;
        raceRewardBlocked = false;
        const toast = supportToastElement();
        if (toast) revealSupportPill(toast, lastRaceCompletion);
        scheduleDeferredReward();
      }, ACHIEVEMENT_FALLBACK_MS);
    }
  });

  const bodyObserver = new MutationObserver(() => {
    ensureToastObservers();
    maybeShowPendingHomeCompletion();
  });
  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'hidden']
  });

  ensureToastObservers();
  maybeShowPendingHomeCompletion();

  return Object.freeze({
    storageKey: SUPPORT_FEEDBACK_STORAGE_KEY,
    selectRecommendedLotCar,
    showPendingHomeCompletion: maybeShowPendingHomeCompletion,
    disconnect() {
      supportObserver?.disconnect();
      achievementObserver?.disconnect();
      rewardObserver?.disconnect();
      bodyObserver.disconnect();
      globalThis.clearTimeout(recentAchievementClearTimer);
      globalThis.clearTimeout(achievementFallbackTimer);
      globalThis.clearTimeout(deferredRewardTimer);
      installed = false;
    }
  });
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  installSupportChallengeFeedback();
}
