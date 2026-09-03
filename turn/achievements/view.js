import {
  ACHIEVEMENTS,
  CATEGORY,
  CATEGORY_LABELS,
  ICONS,
  ONBOARDING_ACHIEVEMENT_IDS,
  TRACK_NAMES,
  VEHICLE_NAMES,
  TRACK_IDS
} from './catalog.js?revision=r222-awd-label';
import {
  TIME_TRIAL_ACHIEVEMENT_IDS
} from './time-trials.js?revision=r166-bella-records';
import {
  TROPHY_ICON,
  TROPHY_ROAD_MAX_THRESHOLD,
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_REWARD_ICONS,
  getTrophyRoadReward
} from '../progression/trophy-road.js?revision=r166-bella-records';

const TOAST_VISIBLE_MS = 3600;
const ATTENTION_VISIBLE_MS = 900;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}

function contextLine(record) {
  if (!record) return '';
  const parts = [];
  if (record.trackId && TRACK_NAMES[record.trackId]) parts.push(TRACK_NAMES[record.trackId]);
  if (record.vehicleId && VEHICLE_NAMES[record.vehicleId]) parts.push(VEHICLE_NAMES[record.vehicleId]);
  if (record.time != null) parts.push(formatTime(record.time));
  return parts.join(' · ');
}

export function allOnboardingComplete(store) {
  return ONBOARDING_ACHIEVEMENT_IDS.every((id) => store.isUnlocked(id));
}

function progressFor(achievement, store, session) {
  if (achievement.id === 'new-ground') return Math.min(2, store.state.progress.tracks.length);
  if (achievement.id === 'around-the-turn') return Math.min(TRACK_IDS.length, store.state.progress.tracks.length);
  if (achievement.id === 'beyond-sight') return Math.min(TRACK_IDS.length, store.state.progress.blankTracks.length);
  if (achievement.id === 'faster-than-the-dev') {
    return TIME_TRIAL_ACHIEVEMENT_IDS.filter((id) => store.isUnlocked(id)).length;
  }
  if (achievement.id === 'listen-closely') {
    return Math.min(10, Math.floor((session.listenCloselyMs || 0) / 1000));
  }
  if (achievement.id === 'night-shift-sheriff') {
    return Math.min(4, session.currentLap?.nightShift?.overtakenRivals?.size || 0);
  }
  if (achievement.id === 'charge-through-it') {
    return Math.min(25, Math.round((session.currentLap?.driftChargeGained || 0) * 100));
  }
  if (achievement.id === 'watch-and-learn') {
    if (!session.spectateStartedAt) return 0;
    return Math.min(5, Math.floor((performance.now() - session.spectateStartedAt) / 1000));
  }
  return null;
}

function statusFor(achievement, store, session) {
  if (store.isUnlocked(achievement.id)) return 'UNLOCKED';
  const progress = progressFor(achievement, store, session);
  if (progress != null && progress > 0) return 'IN PROGRESS';
  return 'LOCKED';
}

function achievementCard(achievement, store, session) {
  const unlocked = store.isUnlocked(achievement.id);
  const record = store.state.unlocked[achievement.id];
  const progress = progressFor(achievement, store, session);
  const status = statusFor(achievement, store, session);
  const classes = [
    'turn-achievement-card',
    unlocked ? 'is-unlocked' : 'is-locked'
  ].join(' ');
  const progressMarkup = achievement.progressMax && !unlocked
    ? `<div class="turn-achievement-progress">
        <span>${progress || 0} of ${achievement.progressMax}</span>
        <div role="progressbar" aria-label="${achievement.title} progress" aria-valuemin="0" aria-valuemax="${achievement.progressMax}" aria-valuenow="${progress || 0}">
          <i style="--turn-achievement-progress:${Math.min(100, ((progress || 0) / achievement.progressMax) * 100)}%"></i>
        </div>
      </div>`
    : '';
  const context = unlocked ? contextLine(record) : '';

  return `
    <article class="${classes}" data-achievement-category="${achievement.category}" data-achievement-status="${status.toLowerCase().replace(' ', '-')}">
      <div class="turn-achievement-icon" aria-hidden="true">${ICONS[achievement.icon]}</div>
      <div class="turn-achievement-copy">
        <span>${CATEGORY_LABELS[achievement.category]} · ${achievement.trophies} trophies</span>
        <h4>${achievement.title}</h4>
        <p>${achievement.description}</p>
        ${achievement.recommendation && !unlocked ? `<small>${achievement.recommendation}</small>` : ''}
        ${progressMarkup}
        ${context ? `<small>Unlocked · ${context}</small>` : ''}
      </div>
      <strong class="turn-achievement-status">${status === 'UNLOCKED' ? '✓ UNLOCKED' : status}</strong>
    </article>`;
}

function installStylesheet() {
  if (document.querySelector('link[data-turn-achievements]')) return;
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `/turn/achievements.css?build=${buildKey}-r224-modal-headings`;
  stylesheet.setAttribute('data-turn-achievements', '');
  document.head.appendChild(stylesheet);
}

function createTrigger(className, label = 'ACHIEVEMENTS') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-label', 'Achievements');
  button.innerHTML = `
    <span class="turn-achievements-trigger-label">${label}</span>
    <span class="turn-achievements-trigger-badge" aria-hidden="true" hidden></span>`;
  return button;
}

function createDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog turn-achievements-dialog';
  dialog.setAttribute('aria-labelledby', 'turnAchievementsTitle');
  dialog.innerHTML = `
    <article class="m8-dialog-card turn-achievements-card">
      <header class="m8-dialog-head turn-achievements-head">
        <div><span>YOUR PROGRESS</span><h2 id="turnAchievementsTitle">ACHIEVEMENTS</h2></div>
        <button type="button" data-dialog-close aria-label="Close Achievements">×</button>
      </header>
      <div class="turn-achievements-content">
        <section class="turn-achievements-summary" aria-labelledby="turnAchievementsSummaryTitle">
          <div class="turn-achievements-summary-main">
            <strong id="turnAchievementsSummaryTitle">0 OF ${ACHIEVEMENTS.length} UNLOCKED</strong>
            <div class="turn-trophy-road">
              <div class="turn-trophy-road-track">
                <div class="turn-trophy-road-progress" role="progressbar" aria-label="Trophy Road progress" aria-valuemin="0" aria-valuemax="${TROPHY_ROAD_MAX_THRESHOLD}" aria-valuenow="0"><i></i></div>
                <div class="turn-trophy-road-markers" aria-label="Trophy Road rewards"></div>
              </div>
            </div>
          </div>
          <p class="turn-achievements-trophy-total"><span>TROPHIES</span><strong><i aria-hidden="true">${TROPHY_ICON}</i><b>0</b></strong></p>
          <p><span>COMPLETION</span><strong class="turn-achievements-percent">0%</strong></p>
          <div class="turn-trophy-road-detail" aria-live="polite"></div>
        </section>
        <p class="turn-achievements-storage-note" hidden>Achievement progress is available for this session but cannot be saved because local storage is unavailable.</p>
        <div class="turn-achievements-filters" aria-label="Achievement filters">
          <button type="button" aria-pressed="true" data-achievement-filter="all">ALL</button>
          <button type="button" aria-pressed="false" data-achievement-filter="onboarding">GETTING STARTED</button>
          <button type="button" aria-pressed="false" data-achievement-filter="time-trials">TIME TRIALS</button>
          <button type="button" aria-pressed="false" data-achievement-filter="unlocked">UNLOCKED</button>
        </div>
        <div class="turn-achievements-list"></div>
      </div>
    </article>`;
  document.body.appendChild(dialog);
  return dialog;
}

function createToast(className, label) {
  const toast = document.createElement('div');
  toast.className = className;
  toast.hidden = true;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = `
    <div class="turn-achievement-toast-icon" aria-hidden="true"></div>
    <div><span>${label}</span><strong></strong></div>
    <b></b>`;
  document.body.appendChild(toast);
  return toast;
}

function installFilters(dialog) {
  const buttons = [...dialog.querySelectorAll('[data-achievement-filter]')];
  let current = 'all';

  function apply() {
    for (const card of dialog.querySelectorAll('.turn-achievement-card')) {
      const visible = current === 'all'
        || (current === 'onboarding' && card.dataset.achievementCategory === CATEGORY.ONBOARDING)
        || (current === 'time-trials' && card.dataset.achievementCategory === CATEGORY.TIME_TRIALS)
        || (current === 'unlocked' && card.dataset.achievementStatus === 'unlocked');
      card.hidden = !visible;
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      current = button.dataset.achievementFilter;
      for (const candidate of buttons) candidate.setAttribute('aria-pressed', String(candidate === button));
      apply();
    });
  }

  return apply;
}

function initialRewardSelection(store) {
  const unseen = store.unseenRewardIds()[0];
  if (unseen) return unseen;
  const next = TROPHY_ROAD_REWARDS.find((reward) => !store.isRewardUnlocked(reward.id));
  return next?.id || TROPHY_ROAD_REWARDS.at(-1)?.id || '';
}

export function createAchievementView({ store, session, utilityGroup }) {
  const homeMenu = document.querySelector('.m8-home-menu');
  const homeStatus = homeMenu?.querySelector('.m8-home-status');
  const feedbackButton = homeMenu?.querySelector('.m8-feedback-button');
  const spectateButton = utilityGroup?.querySelector('.spectate-button');
  if (!homeMenu || !homeStatus || !utilityGroup) {
    throw new Error('TURN achievements could not find the complete Home and race menus.');
  }

  installStylesheet();
  const homeTrigger = createTrigger('m8-feedback-button m8-achievements-button');
  homeTrigger.style.setProperty('background', 'var(--turn-action-success, #8ce99a)');
  const raceTrigger = createTrigger('utility turn-race-achievements-button', 'Achievements');
  if (feedbackButton) feedbackButton.after(homeTrigger);
  else homeMenu.insertBefore(homeTrigger, homeStatus);
  if (spectateButton) utilityGroup.insertBefore(raceTrigger, spectateButton);
  else utilityGroup.appendChild(raceTrigger);

  const dialog = createDialog();
  const toast = createToast('turn-achievement-toast', 'ACHIEVEMENT UNLOCKED');
  const rewardToast = createToast('turn-achievement-toast turn-trophy-reward-toast', 'TROPHY ROAD REWARD');
  const list = dialog.querySelector('.turn-achievements-list');
  const totalTitle = dialog.querySelector('#turnAchievementsSummaryTitle');
  const trophyRoad = dialog.querySelector('.turn-trophy-road-progress');
  const trophyRoadFill = trophyRoad.querySelector('i');
  const trophyRoadMarkers = dialog.querySelector('.turn-trophy-road-markers');
  const trophyRoadDetail = dialog.querySelector('.turn-trophy-road-detail');
  const trophyTotal = dialog.querySelector('.turn-achievements-trophy-total b');
  const percent = dialog.querySelector('.turn-achievements-percent');
  const storageNote = dialog.querySelector('.turn-achievements-storage-note');
  const closeButton = dialog.querySelector('[data-dialog-close]');
  const applyFilter = installFilters(dialog);
  let selectedRewardId = '';
  let returnFocus = null;
  let toastHideTimer = 0;
  let rewardToastHideTimer = 0;
  let toastConcealTimer = 0;
  let rewardToastConcealTimer = 0;
  let toastShowFrame = 0;
  let rewardToastShowFrame = 0;
  let attentionTimer = 0;
  let attentionFrame = 0;
  let dialogDirty = true;

  function dialogIsOpen() {
    return dialog.open === true || dialog.hasAttribute('open');
  }

  function renderTrophyRoad(total) {
    if (!selectedRewardId || !getTrophyRoadReward(selectedRewardId)) {
      selectedRewardId = initialRewardSelection(store);
    }
    const nextReward = TROPHY_ROAD_REWARDS.find((reward) => !store.isRewardUnlocked(reward.id));
    trophyRoad.setAttribute('aria-valuenow', String(Math.min(total, TROPHY_ROAD_MAX_THRESHOLD)));
    trophyRoad.setAttribute(
      'aria-valuetext',
      nextReward
        ? `${total} trophies. ${Math.max(0, nextReward.threshold - total)} trophies until ${nextReward.shortTitle}.`
        : `${total} trophies. Every current Trophy Road reward is unlocked.`
    );
    trophyRoadFill.style.setProperty(
      '--turn-trophy-road-progress',
      `${Math.min(100, (total / TROPHY_ROAD_MAX_THRESHOLD) * 100)}%`
    );
    trophyRoadMarkers.innerHTML = TROPHY_ROAD_REWARDS.map((reward) => {
      const unlocked = store.isRewardUnlocked(reward.id);
      const selected = reward.id === selectedRewardId;
      const position = Math.min(100, (reward.threshold / TROPHY_ROAD_MAX_THRESHOLD) * 100);
      return `<button
        type="button"
        class="turn-trophy-road-marker ${unlocked ? 'is-unlocked' : 'is-locked'} ${selected ? 'is-selected' : ''}"
        data-trophy-reward="${reward.id}"
        data-trophy-reward-type="${reward.type}"
        style="--turn-trophy-road-position:${position}%"
        aria-pressed="${selected}"
        aria-label="${reward.shortTitle}. ${reward.threshold} trophies. ${unlocked ? 'Unlocked' : 'Locked'}"
      ><span aria-hidden="true">${TROPHY_ROAD_REWARD_ICONS[reward.icon]}</span><b>${reward.threshold}</b></button>`;
    }).join('');

    const reward = getTrophyRoadReward(selectedRewardId) || TROPHY_ROAD_REWARDS[0];
    const unlocked = store.isRewardUnlocked(reward.id);
    const remaining = Math.max(0, reward.threshold - total);
    trophyRoadDetail.innerHTML = `
      <div class="turn-trophy-road-detail-icon" aria-hidden="true">${TROPHY_ROAD_REWARD_ICONS[reward.icon]}</div>
      <div>
        <span>${reward.threshold} TROPHIES · ${unlocked ? 'UNLOCKED' : `${remaining} TO GO`}</span>
        <h3>${reward.title}</h3>
        <p>${reward.description}</p>
      </div>`;
  }

  trophyRoadMarkers.addEventListener('click', (event) => {
    const marker = event.target.closest('[data-trophy-reward]');
    if (!marker) return;
    selectedRewardId = marker.dataset.trophyReward;
    renderTrophyRoad(store.trophyTotal());
    trophyRoadMarkers.querySelector(`[data-trophy-reward="${selectedRewardId}"]`)?.focus();
  });

  function render({ force = false } = {}) {
    if (!force && !dialogIsOpen()) {
      dialogDirty = true;
      return false;
    }
    const unlockedCount = Object.keys(store.state.unlocked).length;
    const trophies = store.trophyTotal();
    const completion = Math.round((unlockedCount / ACHIEVEMENTS.length) * 100);
    totalTitle.textContent = `${unlockedCount} OF ${ACHIEVEMENTS.length} UNLOCKED`;
    trophyTotal.textContent = String(trophies);
    percent.textContent = `${completion}%`;
    renderTrophyRoad(trophies);
    storageNote.hidden = store.storageAvailable();
    list.innerHTML = ACHIEVEMENTS
      .map((achievement) => achievementCard(achievement, store, session))
      .join('');
    applyFilter();
    dialogDirty = false;
    return true;
  }

  function syncTriggers() {
    const unseenCount = store.unseenCount();
    for (const button of [homeTrigger, raceTrigger]) {
      const badge = button.querySelector('.turn-achievements-trigger-badge');
      if (unseenCount > 0) {
        badge.textContent = unseenCount > 9 ? '9+' : String(unseenCount);
        badge.hidden = false;
        button.setAttribute(
          'aria-label',
          `Achievements, ${unseenCount} new item${unseenCount === 1 ? '' : 's'}`
        );
      } else {
        badge.hidden = true;
        badge.textContent = '';
        button.setAttribute('aria-label', 'Achievements');
      }
      button.classList.toggle('has-unseen-achievements', unseenCount > 0);
    }
    raceTrigger.hidden = utilityGroup.dataset.menuState !== 'staged';
  }

  function open(trigger) {
    returnFocus = trigger;
    selectedRewardId = initialRewardSelection(store);
    render({ force: true });
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    closeButton.focus();
    store.markAllSeen();
    syncTriggers();
  }

  function close() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    returnFocus?.focus?.();
  }

  homeTrigger.addEventListener('click', () => open(homeTrigger));
  raceTrigger.addEventListener('click', () => open(raceTrigger));
  closeButton.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => returnFocus?.focus?.());

  function pulseRaceTrigger() {
    window.clearTimeout(attentionTimer);
    if (attentionFrame) window.cancelAnimationFrame(attentionFrame);
    raceTrigger.classList.remove('is-achievement-pulsing', 'is-achievement-attention');
    attentionFrame = window.requestAnimationFrame(() => {
      attentionFrame = 0;
      if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        raceTrigger.classList.add('is-achievement-attention');
      } else {
        raceTrigger.classList.add('is-achievement-pulsing');
      }
      attentionTimer = window.setTimeout(() => {
        raceTrigger.classList.remove('is-achievement-pulsing', 'is-achievement-attention');
        attentionTimer = 0;
      }, ATTENTION_VISIBLE_MS);
    });
  }

  function showToast(toastElement, batch, { reward = false } = {}) {
    if (!batch.length) return;
    const timerKey = reward ? 'reward' : 'achievement';
    if (timerKey === 'reward') {
      window.clearTimeout(rewardToastHideTimer);
      window.clearTimeout(rewardToastConcealTimer);
      if (rewardToastShowFrame) window.cancelAnimationFrame(rewardToastShowFrame);
    } else {
      window.clearTimeout(toastHideTimer);
      window.clearTimeout(toastConcealTimer);
      if (toastShowFrame) window.cancelAnimationFrame(toastShowFrame);
    }
    const first = batch[0];
    const total = reward
      ? 0
      : batch.reduce((sum, achievement) => sum + achievement.trophies, 0);
    toastElement.querySelector('.turn-achievement-toast-icon').innerHTML = reward
      ? TROPHY_ROAD_REWARD_ICONS[first.icon]
      : (batch.length === 1 ? ICONS[first.icon] : ICONS.trophy);
    toastElement.querySelector('span').textContent = reward
      ? (batch.length === 1 ? 'TROPHY ROAD REWARD' : `${batch.length} TROPHY ROAD REWARDS`)
      : (batch.length === 1 ? 'ACHIEVEMENT UNLOCKED' : `${batch.length} ACHIEVEMENTS UNLOCKED`);
    toastElement.querySelector('strong').textContent = batch.length === 1
      ? first.title
      : `${first.title} + ${batch.length - 1} MORE`;
    toastElement.querySelector('b').textContent = reward
      ? 'UNLOCKED'
      : `+${total} TROPHIES`;
    toastElement.setAttribute('aria-label', reward
      ? `${batch.length === 1 ? 'Trophy Road reward unlocked' : `${batch.length} Trophy Road rewards unlocked`} . ${batch.map((item) => item.shortTitle).join(', ')} .`.replaceAll(' .', '.')
      : `${batch.length === 1 ? 'Achievement unlocked' : `${batch.length} achievements unlocked`} . ${batch.map((achievement) => achievement.title).join(', ')} . ${total} trophies.`.replaceAll(' .', '.'));

    const alreadyVisible = !toastElement.hidden && toastElement.classList.contains('is-visible');
    toastElement.hidden = false;
    if (!alreadyVisible) {
      toastElement.classList.remove('is-visible');
      const frame = window.requestAnimationFrame(() => {
        toastElement.classList.add('is-visible');
        if (reward) rewardToastShowFrame = 0;
        else toastShowFrame = 0;
      });
      if (reward) rewardToastShowFrame = frame;
      else toastShowFrame = frame;
    }

    const timer = window.setTimeout(() => {
      toastElement.classList.remove('is-visible');
      const concealTimer = window.setTimeout(() => {
        toastElement.hidden = true;
        if (reward) rewardToastConcealTimer = 0;
        else toastConcealTimer = 0;
      }, 220);
      if (reward) rewardToastConcealTimer = concealTimer;
      else toastConcealTimer = concealTimer;
    }, TOAST_VISIBLE_MS);
    if (timerKey === 'reward') rewardToastHideTimer = timer;
    else toastHideTimer = timer;
  }

  function showToastBatch(batch) {
    showToast(toast, batch);
  }

  function showRewardToastBatch(batch) {
    showToast(rewardToast, batch, { reward: true });
  }

  render();
  syncTriggers();
  return Object.freeze({
    homeTrigger,
    raceTrigger,
    dialog,
    toast,
    rewardToast,
    render,
    syncTriggers,
    pulseRaceTrigger,
    showToastBatch,
    showRewardToastBatch,
    open,
    close
  });
}
