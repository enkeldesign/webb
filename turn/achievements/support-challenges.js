import {
  HOW_TO_PLAY_DISCLOSURE_IDS,
  HOW_TO_PLAY_DISCLOSURE_OPENED_EVENT,
  LEARN_TO_PLAY_ACHIEVEMENT_ID
} from './learning-progress.js?revision=r1-learning-achievements';
import { TRACK_IDS, TRACK_NAMES, VEHICLE_NAMES } from './catalog.js?revision=r241-learning-achievements';
import {
  isTrackUnlocked,
  isVehicleUnlocked
} from '../progression/trophy-road-perks-r164.js?revision=r243-mountain-1300';
import { completeTrackOrder, getTrackStorageRevision } from '../tracks/definitions.js';

export const SUPPORT_CHALLENGE_STORAGE_KEY = 'turn-support-challenges-v1';
export const SUPPORT_CHALLENGE_CONFIG_CACHE_KEY = 'turn-support-challenge-config-cache-v1';
export const SUPPORT_CHALLENGE_CONFIG_URL = '/turn/support-challenges.json';

const STATE_VERSION = 1;
const RIVAL_STORAGE_KEY = 'turn-personal-rivals-v1';
const RIVAL_LIMIT = 4;
const STYLE_ID = 'turn-support-challenge-styles';
const SCORE_FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function safeStorage(storage = globalThis.localStorage) {
  return storage?.getItem && storage?.setItem ? storage : null;
}

function stringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === 'string' && item))]
    : [];
}

function positiveInteger(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function positiveNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeCars(value) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).map(([trackId, cars]) => [trackId, stringArray(cars)])
  );
}

function normalizeTargets(value) {
  if (!value || typeof value !== 'object') return {};
  const entries = Object.entries(value)
    .map(([trackId, target]) => [trackId, positiveNumber(target)])
    .filter(([, target]) => target != null);
  return Object.fromEntries(entries);
}

export function normalizeSupportChallengeConfig(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    version: positiveInteger(raw.version, 1),
    enabled: raw.enabled === true,
    offerAfterValidLapsWithoutTrophy: positiveInteger(raw.offerAfterValidLapsWithoutTrophy, 6),
    rerollAfterAdditionalValidLaps: positiveInteger(raw.rerollAfterAdditionalValidLaps, 10),
    stopAtTrophies: positiveInteger(raw.stopAtTrophies, 2300),
    priority: stringArray(raw.priority).length
      ? stringArray(raw.priority)
      : ['winner', 'learning', 'safety', 'drift'],
    trackOrder: stringArray(raw.trackOrder),
    winner: Object.freeze({
      enabled: raw.winner?.enabled === true,
      reward: positiveInteger(raw.winner?.reward, 25),
      cars: normalizeCars(raw.winner?.cars)
    }),
    learning: Object.freeze({
      enabled: raw.learning?.enabled === true,
      title: typeof raw.learning?.title === 'string' && raw.learning.title.trim()
        ? raw.learning.title.trim()
        : 'DID YOU READ ALL OF IT?',
      rewardPerPart: positiveInteger(raw.learning?.rewardPerPart, 5),
      description: typeof raw.learning?.description === 'string' && raw.learning.description.trim()
        ? raw.learning.description.trim()
        : 'Open every part of HOW TO PLAY.'
    }),
    safety: Object.freeze({
      enabled: raw.safety?.enabled === true,
      reward: positiveInteger(raw.safety?.reward, 25),
      cleanLapExplanation: typeof raw.safety?.cleanLapExplanation === 'string' && raw.safety.cleanLapExplanation.trim()
        ? raw.safety.cleanLapExplanation.trim()
        : 'A clean lap means staying on the road from start to finish. Going off-road breaks the clean lap.',
      targets: normalizeTargets(raw.safety?.targets),
      cars: normalizeCars(raw.safety?.cars)
    }),
    drift: Object.freeze({
      enabled: raw.drift?.enabled === true,
      requiredReward: typeof raw.drift?.requiredReward === 'string' && raw.drift.requiredReward
        ? raw.drift.requiredReward
        : 'drift-attack',
      reward: positiveInteger(raw.drift?.reward, 25),
      targets: normalizeTargets(raw.drift?.targets),
      cars: normalizeCars(raw.drift?.cars)
    })
  });
}

export async function loadSupportChallengeConfig({
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
  now = Date.now
} = {}) {
  const persistent = safeStorage(storage);
  if (typeof fetchImpl === 'function') {
    try {
      const base = globalThis.location?.href || 'https://enkel.design/turn/';
      const url = new URL(SUPPORT_CHALLENGE_CONFIG_URL, base);
      url.searchParams.set('fresh', String(now()));
      const response = await fetchImpl(url, { cache: 'no-store' });
      if (!response?.ok) throw new Error(`TURN support challenge rules returned ${response?.status || 'an error'}.`);
      const raw = await response.json();
      const config = normalizeSupportChallengeConfig(raw);
      try {
        persistent?.setItem(SUPPORT_CHALLENGE_CONFIG_CACHE_KEY, JSON.stringify(raw));
      } catch (_) { /* Live rules still work when offline caching is unavailable. */ }
      return config;
    } catch (_) {}
  }

  if (persistent) {
    try {
      const raw = persistent.getItem(SUPPORT_CHALLENGE_CONFIG_CACHE_KEY);
      if (raw) return normalizeSupportChallengeConfig(JSON.parse(raw));
    } catch (_) {}
  }
  return normalizeSupportChallengeConfig({ enabled: false });
}

function defaultSupportState() {
  return {
    version: STATE_VERSION,
    dryValidLaps: 0,
    lapsSinceChallengeProgress: 0,
    active: null,
    seenActiveKey: '',
    completed: [],
    skipped: []
  };
}

export function normalizeSupportChallengeState(value) {
  if (!value || typeof value !== 'object') return defaultSupportState();
  const active = value.active && typeof value.active === 'object'
    && typeof value.active.key === 'string'
    && typeof value.active.type === 'string'
    ? {
        key: value.active.key,
        type: value.active.type,
        trackId: typeof value.active.trackId === 'string' ? value.active.trackId : '',
        vehicleId: typeof value.active.vehicleId === 'string' ? value.active.vehicleId : '',
        sourceAchievementId: typeof value.active.sourceAchievementId === 'string'
          ? value.active.sourceAchievementId
          : '',
        baselineParts: stringArray(value.active.baselineParts)
      }
    : null;
  return {
    version: STATE_VERSION,
    dryValidLaps: Math.max(0, Math.floor(Number(value.dryValidLaps) || 0)),
    lapsSinceChallengeProgress: Math.max(0, Math.floor(Number(value.lapsSinceChallengeProgress) || 0)),
    active,
    seenActiveKey: typeof value.seenActiveKey === 'string' ? value.seenActiveKey : '',
    completed: stringArray(value.completed),
    skipped: stringArray(value.skipped)
  };
}

function loadSupportState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(SUPPORT_CHALLENGE_STORAGE_KEY);
    return normalizeSupportChallengeState(raw ? JSON.parse(raw) : null);
  } catch (_) {
    return defaultSupportState();
  }
}

function saveSupportState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(SUPPORT_CHALLENGE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (_) {
    return false;
  }
}

function validStoredRival(lap) {
  return Number.isFinite(Number(lap?.time))
    && Array.isArray(lap?.frames)
    && lap.frames.length > 20;
}

function rivalStorageKey(trackId) {
  const revision = getTrackStorageRevision(trackId);
  return revision === 'countryside' ? RIVAL_STORAGE_KEY : `${RIVAL_STORAGE_KEY}:${revision}`;
}

export function storedRivalCount(trackId, {
  runtime = globalThis.__turnRuntime,
  storage = globalThis.localStorage
} = {}) {
  if (runtime?.state?.trackId === trackId && Array.isArray(runtime.state.competitorLaps)) {
    return Math.min(RIVAL_LIMIT, runtime.state.competitorLaps.filter(validStoredRival).length);
  }
  try {
    const payload = JSON.parse(storage?.getItem?.(rivalStorageKey(trackId)) || 'null');
    return Math.min(
      RIVAL_LIMIT,
      Array.isArray(payload?.laps) ? payload.laps.filter(validStoredRival).length : 0
    );
  } catch (_) {
    return 0;
  }
}

function firstOwnedVehicle(vehicleIds, storage = globalThis.localStorage) {
  return stringArray(vehicleIds).find((vehicleId) => isVehicleUnlocked(vehicleId, storage)) || '';
}

function sourceAchievementId(type, trackId) {
  if (type === 'winner') return `${trackId}-winner`;
  if (type === 'safety') return `${trackId}-safety`;
  if (type === 'drift') return `${trackId}-drift-score`;
  if (type === 'learning') return LEARN_TO_PLAY_ACHIEVEMENT_ID;
  return '';
}

function trackCandidate(type, trackId, config, achievements, storage, runtime) {
  const section = config[type];
  if (!section?.enabled || !isTrackUnlocked(trackId, storage)) return null;
  const sourceId = sourceAchievementId(type, trackId);
  if (!sourceId || achievements.store.isUnlocked(sourceId)) return null;
  if (type === 'winner' && storedRivalCount(trackId, { runtime, storage }) < RIVAL_LIMIT) return null;
  if (type === 'drift' && !achievements.store.isRewardUnlocked(config.drift.requiredReward)) return null;
  const vehicleId = firstOwnedVehicle(section.cars?.[trackId], storage);
  if (!vehicleId) return null;
  const target = type === 'safety' || type === 'drift'
    ? positiveNumber(section.targets?.[trackId])
    : null;
  if ((type === 'safety' || type === 'drift') && target == null) return null;
  return Object.freeze({
    key: `${type}:${trackId}`,
    type,
    trackId,
    vehicleId,
    sourceAchievementId: sourceId,
    target,
    reward: positiveInteger(section.reward, 25)
  });
}

function learningCandidate(config, achievements) {
  if (!config.learning.enabled || achievements.store.isUnlocked(LEARN_TO_PLAY_ACHIEVEMENT_ID)) return null;
  const opened = achievements.store.state.progress?.howToPlayDisclosures || [];
  if (HOW_TO_PLAY_DISCLOSURE_IDS.every((id) => opened.includes(id))) return null;
  return Object.freeze({
    key: 'learning:how-to-play',
    type: 'learning',
    trackId: '',
    vehicleId: '',
    sourceAchievementId: LEARN_TO_PLAY_ACHIEVEMENT_ID,
    target: HOW_TO_PLAY_DISCLOSURE_IDS.length,
    reward: config.learning.rewardPerPart
  });
}

export function selectSupportChallenge({
  config,
  achievements,
  runtime = globalThis.__turnRuntime,
  storage = globalThis.localStorage,
  excluded = []
}) {
  if (!config?.enabled || !achievements?.store) return null;
  if (achievements.store.trophyTotal() >= config.stopAtTrophies) return null;
  const blocked = new Set(stringArray(excluded));
  const tracks = completeTrackOrder(config.trackOrder, TRACK_IDS);

  for (const type of config.priority) {
    if (type === 'learning') {
      const candidate = learningCandidate(config, achievements);
      if (candidate && !blocked.has(candidate.key)) return candidate;
      continue;
    }
    if (!['winner', 'safety', 'drift'].includes(type)) continue;
    for (const trackId of tracks) {
      const candidate = trackCandidate(type, trackId, config, achievements, storage, runtime);
      if (candidate && !blocked.has(candidate.key)) return candidate;
    }
  }
  return null;
}

function trackName(trackId) {
  return TRACK_NAMES[trackId] || trackId.replaceAll('-', ' ').toUpperCase();
}

function vehicleName(vehicleId) {
  return VEHICLE_NAMES[vehicleId] || vehicleId.replaceAll('-', ' ');
}

function formatTime(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return '';
  if (value < 60) return `${value.toFixed(2)} seconds`;
  const minutes = Math.floor(value / 60);
  const remainder = (value % 60).toFixed(2).padStart(5, '0');
  return `${minutes}:${remainder}`;
}

function activeChallengeIsConfigured(active, config) {
  if (!active) return false;
  if (active.type === 'learning') return config.learning.enabled;
  const section = config[active.type];
  if (!section?.enabled) return false;
  if (active.type === 'safety' || active.type === 'drift') {
    return positiveNumber(section.targets?.[active.trackId]) != null;
  }
  return active.type === 'winner';
}

function challengePresentation(active, config, achievements) {
  if (!active) return null;
  if (active.type === 'learning') {
    const opened = achievements.store.state.progress?.howToPlayDisclosures || [];
    const count = HOW_TO_PLAY_DISCLOSURE_IDS.filter((id) => opened.includes(id)).length;
    return {
      title: config.learning.title,
      eyebrow: 'HOW TO PLAY',
      reward: `+${config.learning.rewardPerPart} EACH`,
      objective: `${config.learning.description} Each new part you open while this challenge is active earns ${config.learning.rewardPerPart} trophies.`,
      explanation: `${count} of ${HOW_TO_PLAY_DISCLOSURE_IDS.length} parts opened.`,
      startLabel: 'OPEN HOW TO PLAY'
    };
  }

  const name = trackName(active.trackId).toUpperCase();
  const car = vehicleName(active.vehicleId).toUpperCase();
  const reward = `+${positiveInteger(config[active.type]?.reward, 25)} TROPHIES`;
  if (active.type === 'winner') {
    return {
      title: `${name} · WINNER`,
      eyebrow: `${name} · ${car}`,
      reward,
      objective: `Finish first against all four saved rivals using ${vehicleName(active.vehicleId)}.`,
      explanation: 'You already have four rivals on this track. Beat all of them in one race.',
      startLabel: 'START CHALLENGE'
    };
  }
  if (active.type === 'safety') {
    const target = positiveNumber(config.safety.targets?.[active.trackId]);
    return {
      title: `${name} · CLEAN RUN`,
      eyebrow: `${name} · ${car}`,
      reward,
      objective: `Finish a clean lap under ${formatTime(target)} using ${vehicleName(active.vehicleId)}.`,
      explanation: config.safety.cleanLapExplanation,
      startLabel: 'START CHALLENGE'
    };
  }
  if (active.type === 'drift') {
    const target = positiveNumber(config.drift.targets?.[active.trackId]);
    return {
      title: `${name} · DRIFT RUN`,
      eyebrow: `${name} · ${car}`,
      reward,
      objective: `Score ${SCORE_FORMATTER.format(Math.round(target))} DRIFT points using ${vehicleName(active.vehicleId)}.`,
      explanation: 'Bank the target score in one valid lap.',
      startLabel: 'START CHALLENGE'
    };
  }
  return null;
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .m8-home-fixed-layout .m8-home-pitch {
      display: flex;
      align-items: center;
      gap: clamp(10px, 1.5vw, 18px);
    }
    .turn-support-challenge-trigger {
      position: relative;
      flex: 0 0 auto;
      width: clamp(42px, 5vw, 54px);
      height: clamp(42px, 5vw, 54px);
      padding: 8px;
      border: 4px solid var(--turn-ink, #08090a);
      border-radius: 50%;
      background: var(--turn-yellow-500, #ffd43b);
      color: var(--turn-ink, #08090a);
      box-shadow: 4px 4px 0 var(--turn-ink, #08090a);
      cursor: pointer;
    }
    .turn-support-challenge-trigger svg {
      display: block;
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .turn-support-challenge-trigger:hover { transform: translateY(-2px); }
    .turn-support-challenge-trigger:active {
      transform: translate(3px, 3px);
      box-shadow: 1px 1px 0 var(--turn-ink, #08090a);
    }
    .turn-support-challenge-trigger:focus-visible,
    .turn-support-challenge-dialog button:focus-visible {
      outline: 5px solid var(--turn-blue-500, #38d9ff);
      outline-offset: 4px;
    }
    .turn-support-challenge-mark {
      position: absolute;
      top: -9px;
      right: -9px;
      display: grid;
      place-items: center;
      min-width: 22px;
      height: 22px;
      padding: 0 4px;
      border: 3px solid var(--turn-ink, #08090a);
      border-radius: 999px;
      background: var(--turn-pink-500, #ff4fa3);
      color: var(--turn-ink, #08090a);
      font-size: 12px;
      font-weight: 950;
      line-height: 1;
    }
    .turn-support-challenge-dialog {
      width: min(520px, calc(100vw - 28px));
      max-height: calc(100dvh - 28px);
      padding: 0;
      border: 5px solid var(--turn-ink, #08090a);
      border-radius: 16px;
      background: var(--turn-paper, #fff8e8);
      color: var(--turn-ink, #08090a);
      box-shadow: 10px 10px 0 var(--turn-ink, #08090a);
    }
    .turn-support-challenge-dialog::backdrop { background: rgb(8 9 10 / .65); }
    .turn-support-challenge-card { padding: clamp(20px, 4vw, 32px); }
    .turn-support-challenge-topline {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: start;
      margin-bottom: 14px;
      font-size: .76rem;
      font-weight: 950;
      letter-spacing: .08em;
    }
    .turn-support-challenge-topline b {
      padding: 5px 8px;
      border: 3px solid currentColor;
      border-radius: 999px;
      background: var(--turn-yellow-500, #ffd43b);
      white-space: nowrap;
    }
    .turn-support-challenge-dialog h2 {
      margin: 0 0 6px;
      font-size: clamp(1.65rem, 5vw, 2.5rem);
      line-height: .95;
    }
    .turn-support-challenge-objective {
      margin: 16px 0 8px;
      font-size: 1.08rem;
      font-weight: 850;
    }
    .turn-support-challenge-explanation { margin: 0; }
    .turn-support-challenge-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 24px;
    }
    .turn-support-challenge-actions button {
      min-height: 48px;
      padding: 8px 16px;
      border: 4px solid var(--turn-ink, #08090a);
      border-radius: 999px;
      background: var(--turn-green-500, #8ce99a);
      color: var(--turn-ink, #08090a);
      box-shadow: 4px 4px 0 var(--turn-ink, #08090a);
      font: inherit;
      font-weight: 950;
      cursor: pointer;
    }
    .turn-support-challenge-actions [data-support-reroll] { background: var(--turn-blue-200, #bdefff); }
    .turn-support-challenge-actions [data-support-close] { background: var(--turn-paper, #fff8e8); }
    .turn-support-bonus-toast {
      position: fixed;
      z-index: 12000;
      left: 50%;
      bottom: max(22px, env(safe-area-inset-bottom));
      transform: translate(-50%, 18px);
      display: grid;
      gap: 2px;
      min-width: min(360px, calc(100vw - 28px));
      max-width: calc(100vw - 28px);
      padding: 12px 16px;
      border: 4px solid var(--turn-ink, #08090a);
      border-radius: 12px;
      background: var(--turn-yellow-500, #ffd43b);
      color: var(--turn-ink, #08090a);
      box-shadow: 7px 7px 0 var(--turn-ink, #08090a);
      opacity: 0;
      pointer-events: none;
      transition: opacity .18s ease, transform .18s ease;
    }
    .turn-support-bonus-toast.is-visible {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    .turn-support-bonus-toast span {
      font-size: .68rem;
      font-weight: 950;
      letter-spacing: .09em;
    }
    .turn-support-bonus-toast strong { font-size: 1.05rem; }
    @media (prefers-reduced-motion: reduce) {
      .turn-support-challenge-trigger,
      .turn-support-bonus-toast { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

function makeTrigger() {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'turn-support-challenge-trigger';
  trigger.hidden = true;
  trigger.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 4h10v4c0 4-2 7-5 8-3-1-5-4-5-8V4Z"></path>
      <path d="M7 6H4v2c0 2 1 3 4 4M17 6h3v2c0 2-1 3-4 4M9 20h6M12 16v4"></path>
    </svg>
    <span class="turn-support-challenge-mark" aria-hidden="true"></span>`;
  return trigger;
}

function makeDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'turn-support-challenge-dialog';
  dialog.setAttribute('aria-labelledby', 'turnSupportChallengeTitle');
  dialog.innerHTML = `
    <article class="turn-support-challenge-card">
      <div class="turn-support-challenge-topline">
        <span data-support-eyebrow>CHALLENGE</span>
        <b data-support-reward></b>
      </div>
      <h2 id="turnSupportChallengeTitle"></h2>
      <p class="turn-support-challenge-objective" data-support-objective></p>
      <p class="turn-support-challenge-explanation" data-support-explanation></p>
      <div class="turn-support-challenge-actions">
        <button type="button" data-support-start>START CHALLENGE</button>
        <button type="button" data-support-reroll hidden>REROLL CHALLENGE</button>
        <button type="button" data-support-close>CLOSE</button>
      </div>
    </article>`;
  document.body.appendChild(dialog);
  return dialog;
}

function makeBonusToast() {
  const toast = document.createElement('div');
  toast.className = 'turn-support-bonus-toast';
  toast.hidden = true;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = '<span></span><strong></strong>';
  document.body.appendChild(toast);
  return toast;
}

export async function installSupportChallenges({
  achievements = globalThis.__turnAchievements,
  runtime = globalThis.__turnRuntime,
  storage = globalThis.localStorage,
  fetchImpl = globalThis.fetch
} = {}) {
  if (globalThis.__turnSupportChallenges) return globalThis.__turnSupportChallenges;
  if (!achievements?.store || !runtime) return null;

  const config = await loadSupportChallengeConfig({ fetchImpl, storage });
  if (!config.enabled) return null;

  installStyles();
  const state = loadSupportState(storage);
  const home = document.querySelector('.m8-home');
  const pitch = home?.querySelector('.m8-home-pitch');
  const howButton = home?.querySelector('.m8-how-button');
  const raceButton = home?.querySelector('.m8-track-continue');
  if (!home || !pitch || !howButton || !raceButton) return null;

  const trigger = makeTrigger();
  pitch.appendChild(trigger);
  const dialog = makeDialog();
  const bonusToast = makeBonusToast();
  const startButton = dialog.querySelector('[data-support-start]');
  const rerollButton = dialog.querySelector('[data-support-reroll]');
  const closeButton = dialog.querySelector('[data-support-close]');
  let achievementUnlockedThisTask = false;
  let offerScheduled = false;
  let toastTimer = 0;
  let toastConcealTimer = 0;
  let toastShowFrame = 0;
  let restoreTriggerFocus = true;

  function save() {
    saveSupportState(state, storage);
  }

  function excludedKeys(extra = []) {
    return [...new Set([...state.completed, ...state.skipped, ...extra])];
  }

  function currentChallenge() {
    const active = state.active;
    if (!active || !activeChallengeIsConfigured(active, config)) return null;
    if (active.sourceAchievementId && achievements.store.isUnlocked(active.sourceAchievementId)) return null;
    if (achievements.store.trophyTotal() >= config.stopAtTrophies) return null;
    return active;
  }

  function alternateChallenge() {
    if (!state.active) return null;
    return selectSupportChallenge({
      config,
      achievements,
      runtime,
      storage,
      excluded: excludedKeys([state.active.key])
    });
  }

  function rerollAvailable() {
    return Boolean(
      state.active
      && state.lapsSinceChallengeProgress >= config.rerollAfterAdditionalValidLaps
      && alternateChallenge()
    );
  }

  function render() {
    const active = currentChallenge();
    if (!active && state.active) {
      state.active = null;
      state.seenActiveKey = '';
      state.lapsSinceChallengeProgress = 0;
      save();
    }
    const challenge = state.active;
    trigger.hidden = !challenge;
    if (!challenge) {
      if (dialog.open) dialog.close();
      return;
    }

    const presentation = challengePresentation(challenge, config, achievements);
    if (!presentation) return;
    const reroll = rerollAvailable();
    const isNew = state.seenActiveKey !== challenge.key;
    const mark = trigger.querySelector('.turn-support-challenge-mark');
    mark.textContent = reroll ? '↻' : isNew ? '!' : '';
    mark.hidden = !reroll && !isNew;
    trigger.setAttribute(
      'aria-label',
      `${isNew ? 'New ' : ''}challenge available: ${presentation.title}.${reroll ? ' Reroll available.' : ''}`
    );

    dialog.querySelector('[data-support-eyebrow]').textContent = presentation.eyebrow;
    dialog.querySelector('[data-support-reward]').textContent = presentation.reward;
    dialog.querySelector('#turnSupportChallengeTitle').textContent = presentation.title;
    dialog.querySelector('[data-support-objective]').textContent = presentation.objective;
    dialog.querySelector('[data-support-explanation]').textContent = presentation.explanation;
    startButton.textContent = presentation.startLabel;
    rerollButton.hidden = !reroll;
  }

  function hideBonusToast() {
    clearTimeout(toastTimer);
    clearTimeout(toastConcealTimer);
    cancelAnimationFrame(toastShowFrame);
    bonusToast.classList.remove('is-visible');
    bonusToast.hidden = true;
  }

  function showBonusToast(label, text) {
    hideBonusToast();
    bonusToast.querySelector('span').textContent = label;
    bonusToast.querySelector('strong').textContent = text;
    bonusToast.hidden = false;
    toastShowFrame = requestAnimationFrame(() => bonusToast.classList.add('is-visible'));
    toastTimer = window.setTimeout(() => {
      bonusToast.classList.remove('is-visible');
      toastConcealTimer = window.setTimeout(() => { bonusToast.hidden = true; }, 220);
    }, 3200);
  }

  function grantBonus(id, trophies, context, { label = 'CHALLENGE COMPLETE', title = '' } = {}) {
    const bonus = achievements.grantBonus?.(id, trophies, context, { rewardDelay: 3900 });
    if (!bonus) return null;
    state.dryValidLaps = 0;
    state.lapsSinceChallengeProgress = 0;
    save();
    // Wait for every listener on this lap/learning event to finish awarding.
    // The runtime then pairs this cue with any achievement from the same event.
    queueMicrotask(() => achievements.queueSupportFeedback(() => {
      if (label === 'CHALLENGE COMPLETE' && document.body.classList.contains('turn-home-open')) return;
      showBonusToast(label, title || `+${bonus.trophies} 🏆`);
    }));
    return bonus;
  }

  function activate(candidate) {
    if (!candidate) return false;
    state.active = {
      key: candidate.key,
      type: candidate.type,
      trackId: candidate.trackId,
      vehicleId: candidate.vehicleId,
      sourceAchievementId: candidate.sourceAchievementId,
      baselineParts: candidate.type === 'learning'
        ? [...(achievements.store.state.progress?.howToPlayDisclosures || [])]
        : []
    };
    state.lapsSinceChallengeProgress = 0;
    state.seenActiveKey = '';
    save();
    render();
    return true;
  }

  function chooseChallenge({ force = false } = {}) {
    if (!config.enabled || achievements.store.trophyTotal() >= config.stopAtTrophies) return false;
    if (state.active) return false;
    if (!force && state.dryValidLaps < config.offerAfterValidLapsWithoutTrophy) return false;
    const candidate = selectSupportChallenge({
      config,
      achievements,
      runtime,
      storage,
      excluded: excludedKeys()
    });
    return activate(candidate);
  }

  function scheduleChallengeSelection() {
    if (offerScheduled || state.active) return;
    offerScheduled = true;
    const run = () => {
      offerScheduled = false;
      chooseChallenge();
    };
    if (typeof globalThis.requestIdleCallback === 'function') {
      globalThis.requestIdleCallback(run, { timeout: 900 });
    } else {
      window.setTimeout(run, 80);
    }
  }

  function completeActiveRaceChallenge(detail) {
    const active = state.active;
    if (!active || !['winner', 'safety', 'drift'].includes(active.type)) return false;
    const trackId = runtime.state?.trackId || globalThis.__turnGetTrackId?.() || '';
    const vehicleId = runtime.state?.vehicleId || '';
    if (trackId !== active.trackId || vehicleId !== active.vehicleId) return false;

    let complete = false;
    if (active.type === 'winner') {
      complete = Number(detail?.position) === 1 && Number(detail?.total) >= 5;
    } else if (active.type === 'safety') {
      const target = positiveNumber(config.safety.targets?.[active.trackId]);
      const time = Number(detail?.time);
      complete = detail?.onCourseThroughout === true
        && Number.isFinite(time)
        && time > 5
        && target != null
        && time < target;
    } else if (active.type === 'drift') {
      const target = positiveNumber(config.drift.targets?.[active.trackId]);
      const score = Number(detail?.drift?.score);
      complete = detail?.drift?.eligible === true
        && Number.isFinite(score)
        && target != null
        && score >= target;
    }
    if (!complete) return false;

    const reward = positiveInteger(config[active.type]?.reward, 25);
    const context = {
      trackId: active.trackId,
      vehicleId: active.vehicleId,
      reason: `support-${active.type}`
    };
    const granted = grantBonus(`support:${active.key}`, reward, context, {
      title: `+${reward} 🏆`
    });
    if (!granted && !achievements.store.hasBonus?.(`support:${active.key}`)) return false;
    if (!state.completed.includes(active.key)) state.completed.push(active.key);
    state.active = null;
    state.seenActiveKey = '';
    state.dryValidLaps = 0;
    state.lapsSinceChallengeProgress = 0;
    save();
    render();
    return true;
  }

  function openChallenge() {
    if (!state.active) return;
    state.seenActiveKey = state.active.key;
    restoreTriggerFocus = true;
    save();
    render();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    startButton.focus();
  }

  function closeChallenge({ restoreFocus = true } = {}) {
    restoreTriggerFocus = restoreFocus;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else {
      dialog.removeAttribute('open');
      if (restoreFocus) trigger.focus({ preventScroll: true });
    }
  }

  function startChallenge() {
    const active = state.active;
    if (!active) return;
    closeChallenge({ restoreFocus: false });
    if (active.type === 'learning') {
      howButton.click();
      return;
    }
    const card = home.querySelector(`.track-card[data-track-id="${active.trackId}"]:not([disabled])`);
    if (!card) return;
    card.click();
    raceButton.click();
  }

  function rerollChallenge() {
    const active = state.active;
    if (!active || !rerollAvailable()) return false;
    const replacement = alternateChallenge();
    if (!replacement) return false;
    if (!state.skipped.includes(active.key)) state.skipped.push(active.key);
    closeChallenge({ restoreFocus: false });
    state.active = null;
    state.lapsSinceChallengeProgress = 0;
    save();
    activate(replacement);
    openChallenge();
    return true;
  }

  trigger.addEventListener('click', openChallenge);
  closeButton.addEventListener('click', () => closeChallenge());
  startButton.addEventListener('click', startChallenge);
  rerollButton.addEventListener('click', rerollChallenge);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeChallenge();
  });
  dialog.addEventListener('close', () => {
    if (restoreTriggerFocus && !home.hidden) trigger.focus({ preventScroll: true });
    restoreTriggerFocus = true;
  });

  window.addEventListener('turn:achievements-updated', () => {
    achievementUnlockedThisTask = true;
    state.dryValidLaps = 0;
    state.lapsSinceChallengeProgress = 0;
    save();
    queueMicrotask(() => {
      achievementUnlockedThisTask = false;
      if (state.active?.sourceAchievementId && achievements.store.isUnlocked(state.active.sourceAchievementId)) {
        state.active = null;
        state.seenActiveKey = '';
        save();
      }
      render();
    });
  });

  window.addEventListener('turn:lap-result', (event) => {
    const time = Number(event.detail?.time);
    if (!Number.isFinite(time) || time <= 5 || event.detail?.valid === false) return;

    if (completeActiveRaceChallenge(event.detail)) return;
    if (!achievementUnlockedThisTask) {
      state.dryValidLaps += 1;
      if (state.active) state.lapsSinceChallengeProgress += 1;
    }
    save();
    render();
    if (!state.active) scheduleChallengeSelection();
  });

  window.addEventListener(HOW_TO_PLAY_DISCLOSURE_OPENED_EVENT, (event) => {
    const active = state.active;
    const partId = event.detail?.disclosureId;
    if (active?.type !== 'learning' || !HOW_TO_PLAY_DISCLOSURE_IDS.includes(partId)) return;

    if (!active.baselineParts?.includes(partId)) {
      const reward = config.learning.rewardPerPart;
      const bonusId = `support:how-to-play:${partId}`;
      const granted = grantBonus(bonusId, reward, {
        reason: 'support-how-to-play'
      }, {
        label: 'HOW TO PLAY',
        title: `+${reward} 🏆`
      });
      if (granted) state.lapsSinceChallengeProgress = 0;
    }

    const opened = achievements.store.state.progress?.howToPlayDisclosures || [];
    if (
      achievements.store.isUnlocked(LEARN_TO_PLAY_ACHIEVEMENT_ID)
      || HOW_TO_PLAY_DISCLOSURE_IDS.every((id) => opened.includes(id))
    ) {
      if (!state.completed.includes(active.key)) state.completed.push(active.key);
      state.active = null;
      state.seenActiveKey = '';
    }
    save();
    render();
  });

  // Reward unlocks can be nested inside the normal achievement lap handler.
  // Retire the challenge only after its own listener can award the same lap.
  window.addEventListener('turn:trophy-road-updated', () => queueMicrotask(render));
  window.addEventListener('turn:home-shown', hideBonusToast);

  if (state.active?.sourceAchievementId && achievements.store.isUnlocked(state.active.sourceAchievementId)) {
    state.active = null;
    state.seenActiveKey = '';
    save();
  }
  render();
  if (!state.active && state.dryValidLaps >= config.offerAfterValidLapsWithoutTrophy) {
    scheduleChallengeSelection();
  }

  const api = Object.freeze({
    config,
    state,
    trigger,
    dialog,
    chooseChallenge: () => chooseChallenge({ force: true }),
    reroll: rerollChallenge,
    render
  });
  globalThis.__turnSupportChallenges = api;
  window.dispatchEvent(new CustomEvent('turn:support-challenges-ready'));
  return api;
}

function installWhenAchievementsReady(event) {
  const achievements = event?.detail || globalThis.__turnAchievements;
  void installSupportChallenges({ achievements });
}

if (typeof window !== 'undefined') {
  window.addEventListener('turn:achievements-ready', installWhenAchievementsReady, { once: true });
  if (globalThis.__turnAchievements) queueMicrotask(() => installWhenAchievementsReady());
}
