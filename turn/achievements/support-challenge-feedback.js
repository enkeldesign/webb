const SUPPORT_FEEDBACK_STORAGE_KEY = 'turn-support-feedback-v1';
const RACE_SUPPORT_BONUS_PATTERN = /^support:(?:winner|safety|drift):/;
const SUPPORT_PILL_VISIBLE_MS = 3200;
const TOAST_CONCEAL_MS = 220;
const LOT_SELECTION_TIMEOUT_MS = 12000;
const STYLE_ID = 'turn-support-challenge-feedback-styles';
const HOME_SHOWN_EVENT = 'turn:home-shown';
const SUPPORT_HOME_STARTED_EVENT = 'turn:support-home-feedback-started';
const SUPPORT_HOME_ENDED_EVENT = 'turn:support-home-feedback-ended';
const SUPPORT_REWARD_HOLD = 'support-home-feedback';

let installed = null;

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

function setSupportPillCopy(toast, { label = 'CHALLENGE COMPLETE', trophies = 0 } = {}) {
  if (!toast) return;
  const labelNode = toast.querySelector('span');
  const valueNode = toast.querySelector('strong');
  if (labelNode) labelNode.textContent = label;
  if (valueNode) valueNode.textContent = `+${Math.max(0, Math.round(Number(trophies) || 0))} 🏆`;
}

function revealSupportPill(toast, completion) {
  if (!toast || !completion) return false;
  setSupportPillCopy(toast, completion);
  toast.hidden = false;
  toast.classList.remove('is-visible');
  globalThis.requestAnimationFrame(() => toast.classList.add('is-visible'));
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

function dispatchSupportHomeEvent(type, completion) {
  window.dispatchEvent(new CustomEvent(type, {
    detail: completion ? { ...completion } : {}
  }));
}

export function installSupportChallengeFeedback({ storage = globalThis.localStorage } = {}) {
  if (installed || typeof document === 'undefined' || typeof window === 'undefined') return installed;
  installStyles();

  let homeFeedbackBusy = false;
  let homeFeedbackTimer = 0;
  let homeConcealTimer = 0;
  let pending = loadPendingCompletion(storage);
  let active = null;
  let pill = null;
  let indicator = null;
  let disconnected = false;

  function beginHomeFeedback(completion) {
    globalThis.__turnAchievements?.holdRewardPresentation?.(SUPPORT_REWARD_HOLD);
    dispatchSupportHomeEvent(SUPPORT_HOME_STARTED_EVENT, completion);
  }

  function finishHomeFeedback({ consume = false } = {}) {
    const completion = active;
    if (!completion) return;
    globalThis.clearTimeout(homeFeedbackTimer);
    globalThis.clearTimeout(homeConcealTimer);
    pill?.remove();
    indicator?.remove();
    pill = indicator = null;
    active = null;
    if (consume && pending?.id === completion.id && pending?.at === completion.at) {
      pending = null;
      clearPendingCompletion(storage);
    }
    homeFeedbackBusy = false;
    globalThis.__turnAchievements?.releaseRewardPresentation?.(SUPPORT_REWARD_HOLD, { delay: 120 });
    dispatchSupportHomeEvent(SUPPORT_HOME_ENDED_EVENT, completion);
  }

  function showHomeCompletion(completion) {
    if (!completion || !homeIsOpen() || homeFeedbackBusy) return false;
    homeFeedbackBusy = true;
    active = completion;
    beginHomeFeedback(completion);

    pill = makeHomePill({ label: 'CHALLENGE COMPLETE', trophies: completion.trophies });
    indicator = makeCompletionIndicator();

    globalThis.clearTimeout(homeFeedbackTimer);
    globalThis.clearTimeout(homeConcealTimer);
    homeFeedbackTimer = globalThis.setTimeout(() => {
      homeFeedbackTimer = 0;
      pill.classList.remove('is-visible');
      indicator?.remove();
      homeConcealTimer = globalThis.setTimeout(() => {
        homeConcealTimer = 0;
        finishHomeFeedback({ consume: true });
        maybeShowPendingHomeCompletion();
      }, TOAST_CONCEAL_MS);
    }, SUPPORT_PILL_VISIBLE_MS);
    return true;
  }

  function maybeShowPendingHomeCompletion() {
    if (disconnected || document.visibilityState === 'hidden' || !homeIsOpen()
      || !globalThis.__turnAchievements || !document.querySelector('.turn-support-challenge-trigger')) return false;
    return showHomeCompletion(pending);
  }

  const handleStart = (event) => {
    const start = event.target?.closest?.('[data-support-start]');
    if (!start) return;
    const active = globalThis.__turnSupportChallenges?.state?.active;
    if (!active || active.type === 'learning' || !active.trackId || !active.vehicleId) return;
    // The existing support handler remains authoritative for track selection and
    // navigation. Arm the recommended Lot choice before that handler opens it.
    selectRecommendedLotCar(active.vehicleId);
  };
  document.addEventListener('click', handleStart, true);

  const handleBonus = (event) => {
    const detail = event.detail || {};
    if (!isRaceSupportBonusId(detail.id)) return;
    pending = {
      id: detail.id,
      trophies: Math.max(1, Math.round(Number(detail.trophies) || 0)),
      at: Date.now()
    };
    savePendingCompletion(pending, storage);
  };
  window.addEventListener('turn:trophy-bonus', handleBonus);

  const handleHomeShown = () => maybeShowPendingHomeCompletion();
  const handleAchievementsReady = () => maybeShowPendingHomeCompletion();
  const handleHomeHidden = () => finishHomeFeedback();
  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') finishHomeFeedback();
    else maybeShowPendingHomeCompletion();
  };
  window.addEventListener(HOME_SHOWN_EVENT, handleHomeShown);
  window.addEventListener('turn:home-hidden', handleHomeHidden);
  window.addEventListener('turn:achievements-ready', handleAchievementsReady);
  window.addEventListener('turn:support-challenges-ready', handleAchievementsReady);
  document.addEventListener('visibilitychange', handleVisibility);

  queueMicrotask(maybeShowPendingHomeCompletion);

  installed = Object.freeze({
    storageKey: SUPPORT_FEEDBACK_STORAGE_KEY,
    selectRecommendedLotCar,
    showPendingHomeCompletion: maybeShowPendingHomeCompletion,
    disconnect() {
      disconnected = true;
      finishHomeFeedback();
      document.removeEventListener('click', handleStart, true);
      window.removeEventListener('turn:trophy-bonus', handleBonus);
      window.removeEventListener(HOME_SHOWN_EVENT, handleHomeShown);
      window.removeEventListener('turn:home-hidden', handleHomeHidden);
      window.removeEventListener('turn:achievements-ready', handleAchievementsReady);
      window.removeEventListener('turn:support-challenges-ready', handleAchievementsReady);
      document.removeEventListener('visibilitychange', handleVisibility);
      installed = null;
    }
  });
  return installed;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  installSupportChallengeFeedback();
}
