import {
  ACHIEVEMENTS,
  CATEGORY,
  CATEGORY_LABELS,
  ICONS,
  ONBOARDING_ACHIEVEMENT_IDS,
  TRACK_NAMES,
  VEHICLE_NAMES,
  TRACK_IDS
} from './catalog.js?revision=r144-achievements';

const TOAST_VISIBLE_MS = 3600;

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

export function nextOnboardingId(store) {
  return ONBOARDING_ACHIEVEMENT_IDS.find((id) => !store.isUnlocked(id)) || '';
}

export function allOnboardingComplete(store) {
  return !nextOnboardingId(store);
}

function progressFor(achievement, store, session) {
  if (achievement.id === 'new-ground') return Math.min(2, store.state.progress.tracks.length);
  if (achievement.id === 'around-the-turn') return Math.min(TRACK_IDS.length, store.state.progress.tracks.length);
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

function achievementCard(achievement, store, session, nextId) {
  const unlocked = store.isUnlocked(achievement.id);
  const record = store.state.unlocked[achievement.id];
  const progress = progressFor(achievement, store, session);
  const status = statusFor(achievement, store, session);
  const recommended = !unlocked && achievement.id === nextId;
  const classes = [
    'turn-achievement-card',
    unlocked ? 'is-unlocked' : 'is-locked',
    recommended ? 'is-recommended' : ''
  ].filter(Boolean).join(' ');
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
        <span>${CATEGORY_LABELS[achievement.category]} · ${achievement.points} points</span>
        <h4>${achievement.title}</h4>
        <p>${achievement.description}</p>
        ${achievement.recommendation && !unlocked ? `<small>${achievement.recommendation}</small>` : ''}
        ${progressMarkup}
        ${context ? `<small>Unlocked · ${context}</small>` : ''}
      </div>
      <strong class="turn-achievement-status">${recommended ? 'NEXT' : status === 'UNLOCKED' ? '✓ UNLOCKED' : status}</strong>
    </article>`;
}

function installStylesheet() {
  if (document.querySelector('link[data-turn-achievements]')) return;
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `/turn/achievements.css?build=${buildKey}-r144-achievements`;
  stylesheet.setAttribute('data-turn-achievements', '');
  document.head.appendChild(stylesheet);
}

function createTrigger(className, label = 'ACHIEVEMENTS') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-haspopup', 'dialog');
  button.innerHTML = `
    <span class="turn-achievements-trigger-icon" aria-hidden="true">${ICONS.trophy}</span>
    <span class="turn-achievements-trigger-label">${label}</span>
    <span class="turn-achievements-trigger-badge" hidden></span>`;
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
          <div>
            <strong id="turnAchievementsSummaryTitle">0 OF ${ACHIEVEMENTS.length} UNLOCKED</strong>
            <div class="turn-achievements-total-progress" role="progressbar" aria-label="Total achievement completion" aria-valuemin="0" aria-valuemax="${ACHIEVEMENTS.length}" aria-valuenow="0"><i></i></div>
          </div>
          <p><span>POINTS</span><strong class="turn-achievements-points">0</strong></p>
          <p><span>COMPLETION</span><strong class="turn-achievements-percent">0%</strong></p>
        </section>
        <p class="turn-achievements-storage-note" hidden>Achievement progress is available for this session but cannot be saved because local storage is unavailable.</p>
        <div class="turn-achievements-filters" aria-label="Achievement filters">
          <button type="button" aria-pressed="true" data-achievement-filter="all">ALL</button>
          <button type="button" aria-pressed="false" data-achievement-filter="onboarding">GETTING STARTED</button>
          <button type="button" aria-pressed="false" data-achievement-filter="unlocked">UNLOCKED</button>
        </div>
        <div class="turn-achievements-list"></div>
      </div>
    </article>`;
  document.body.appendChild(dialog);
  return dialog;
}

function createToast() {
  const toast = document.createElement('div');
  toast.className = 'turn-achievement-toast';
  toast.hidden = true;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = `
    <div class="turn-achievement-toast-icon" aria-hidden="true"></div>
    <div><span>ACHIEVEMENT UNLOCKED</span><strong></strong></div>
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

export function createAchievementView({ store, session, utilityGroup }) {
  const homeMenu = document.querySelector('.m8-home-menu');
  const homeStatus = homeMenu?.querySelector('.m8-home-status');
  const feedbackButton = homeMenu?.querySelector('.m8-feedback-button');
  const spectateButton = utilityGroup?.querySelector('.spectate-button');
  if (!homeMenu || !homeStatus || !utilityGroup) {
    throw new Error('TURN achievements could not find the complete Home and race menus.');
  }

  installStylesheet();
  const homeTrigger = createTrigger('m8-achievements-button');
  const raceTrigger = createTrigger('utility turn-race-achievements-button', 'Achievements');
  if (feedbackButton) homeMenu.insertBefore(homeTrigger, feedbackButton);
  else homeMenu.insertBefore(homeTrigger, homeStatus);
  if (spectateButton) utilityGroup.insertBefore(raceTrigger, spectateButton);
  else utilityGroup.appendChild(raceTrigger);

  const dialog = createDialog();
  const toast = createToast();
  const list = dialog.querySelector('.turn-achievements-list');
  const totalTitle = dialog.querySelector('#turnAchievementsSummaryTitle');
  const totalProgress = dialog.querySelector('.turn-achievements-total-progress');
  const totalProgressFill = totalProgress.querySelector('i');
  const points = dialog.querySelector('.turn-achievements-points');
  const percent = dialog.querySelector('.turn-achievements-percent');
  const storageNote = dialog.querySelector('.turn-achievements-storage-note');
  const closeButton = dialog.querySelector('[data-dialog-close]');
  const applyFilter = installFilters(dialog);
  let returnFocus = null;
  let toastHideTimer = 0;

  function render() {
    const unlockedCount = Object.keys(store.state.unlocked).length;
    const totalPoints = ACHIEVEMENTS.reduce((sum, achievement) =>
      sum + (store.isUnlocked(achievement.id) ? achievement.points : 0), 0);
    const completion = Math.round((unlockedCount / ACHIEVEMENTS.length) * 100);
    totalTitle.textContent = `${unlockedCount} OF ${ACHIEVEMENTS.length} UNLOCKED`;
    totalProgress.setAttribute('aria-valuenow', String(unlockedCount));
    totalProgressFill.style.setProperty('--turn-achievement-progress', `${completion}%`);
    points.textContent = String(totalPoints);
    percent.textContent = `${completion}%`;
    storageNote.hidden = store.storageAvailable();
    const nextId = nextOnboardingId(store);
    list.innerHTML = ACHIEVEMENTS
      .map((achievement) => achievementCard(achievement, store, session, nextId))
      .join('');
    applyFilter();
  }

  function syncTriggers() {
    const unseenCount = store.unseenIds().length;
    const incompleteOnboarding = !allOnboardingComplete(store);
    for (const button of [homeTrigger, raceTrigger]) {
      const badge = button.querySelector('.turn-achievements-trigger-badge');
      if (unseenCount > 0) {
        badge.textContent = `NEW ${unseenCount}`;
        badge.hidden = false;
      } else if (incompleteOnboarding) {
        badge.textContent = 'NEXT';
        badge.hidden = false;
      } else {
        badge.hidden = true;
        badge.textContent = '';
      }
      button.classList.toggle('has-unseen-achievements', unseenCount > 0);
      button.classList.remove('is-achievement-next');
    }
    raceTrigger.hidden = utilityGroup.dataset.menuState !== 'staged';
  }

  function open(trigger) {
    returnFocus = trigger;
    render();
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
    raceTrigger.classList.remove('is-achievement-pulsing');
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      raceTrigger.classList.add('is-achievement-next');
      return;
    }
    void raceTrigger.offsetWidth;
    raceTrigger.classList.add('is-achievement-pulsing');
    window.setTimeout(() => raceTrigger.classList.remove('is-achievement-pulsing'), 2300);
  }

  function showToastBatch(batch) {
    if (!batch.length) return;
    window.clearTimeout(toastHideTimer);
    const first = batch[0];
    const total = batch.reduce((sum, achievement) => sum + achievement.points, 0);
    toast.querySelector('.turn-achievement-toast-icon').innerHTML = batch.length === 1
      ? ICONS[first.icon]
      : ICONS.trophy;
    toast.querySelector('span').textContent = batch.length === 1
      ? 'ACHIEVEMENT UNLOCKED'
      : `${batch.length} ACHIEVEMENTS UNLOCKED`;
    toast.querySelector('strong').textContent = batch.length === 1
      ? first.title
      : `${first.title} + ${batch.length - 1} MORE`;
    toast.querySelector('b').textContent = `+${total} POINTS`;
    toast.setAttribute('aria-label', batch.length === 1
      ? `Achievement unlocked. ${first.title}. ${first.points} points.`
      : `${batch.length} achievements unlocked. ${batch.map((achievement) => achievement.title).join(', ')}. ${total} points.`);
    toast.hidden = false;
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    toastHideTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => { toast.hidden = true; }, 220);
    }, TOAST_VISIBLE_MS);
  }

  render();
  syncTriggers();
  return Object.freeze({
    homeTrigger,
    raceTrigger,
    dialog,
    toast,
    render,
    syncTriggers,
    pulseRaceTrigger,
    showToastBatch,
    open,
    close
  });
}
