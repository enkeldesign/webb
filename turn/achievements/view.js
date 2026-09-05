import {
  ACHIEVEMENTS,
  CATEGORY,
  CATEGORY_LABELS,
  ICONS,
  ONBOARDING_ACHIEVEMENT_IDS,
  TRACK_NAMES,
  VEHICLE_NAMES,
  TRACK_IDS
} from './catalog.js?revision=r241-learning-achievements';
import {
  TIME_TRIAL_ACHIEVEMENT_IDS
} from './time-trials.js?revision=r166-bella-records';
import {
  TRACK_SCORING_ACHIEVEMENT_IDS
} from './scoring-achievements.js?revision=r3-trophy-balance';
import {
  DRIVE_BY_EAR_ACHIEVEMENT_ID,
  DRIVE_BY_EAR_PART_IDS,
  HOW_TO_PLAY_DISCLOSURE_IDS,
  LEARN_TO_PLAY_ACHIEVEMENT_ID
} from './learning-progress.js?revision=r1-learning-achievements';
import {
  LOCK_ICON,
  TROPHY_ICON,
  TROPHY_ROAD_MAX_THRESHOLD,
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_REWARD_ICONS,
  getTrophyRoadReward,
  trophyRoadOverview
} from '../progression/trophy-road.js?revision=r243-mountain-1300';

const TOAST_VISIBLE_MS = 3600;
const ATTENTION_VISIBLE_MS = 900;
const TROPHY_ROAD_DETAIL_GAP = 8;
const TROPHY_ROAD_DETAIL_EDGE = 10;
const AVAILABLE_ACHIEVEMENTS = Object.freeze(
  ACHIEVEMENTS.filter((achievement) => achievement.calibrationPending !== true)
);
export const TROPHY_ROAD_RESPONSIVE_LAYOUTS = Object.freeze([
  Object.freeze({ name: 'narrow', rewardsPerRow: 3 }),
  Object.freeze({ name: 'medium', rewardsPerRow: 5 }),
  Object.freeze({ name: 'wide', rewardsPerRow: 7 })
]);

function clampedNumber(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

export function trophyRoadDetailPlacement({
  rowRect,
  mapRect,
  detailHeight,
  viewportWidth,
  viewportHeight,
  gap = TROPHY_ROAD_DETAIL_GAP,
  edge = TROPHY_ROAD_DETAIL_EDGE
} = {}) {
  const safeViewportWidth = Math.max(1, Number(viewportWidth) || 1);
  const safeViewportHeight = Math.max(1, Number(viewportHeight) || 1);
  const safeGap = Math.max(0, Number(gap) || 0);
  const safeEdge = Math.max(0, Number(edge) || 0);
  const safeDetailHeight = Math.max(0, Number(detailHeight) || 0);
  const rowTop = Number(rowRect?.top) || 0;
  const rowBottom = Number(rowRect?.bottom) || rowTop;
  const mapLeft = Number(mapRect?.left) || safeEdge;
  const mapRight = Number(mapRect?.right) || (safeViewportWidth - safeEdge);
  const left = clampedNumber(mapLeft, safeEdge, Math.max(safeEdge, safeViewportWidth - safeEdge));
  const right = clampedNumber(mapRight, left, Math.max(left, safeViewportWidth - safeEdge));
  const belowSpace = safeViewportHeight - safeEdge - rowBottom - safeGap;
  const aboveSpace = rowTop - safeEdge - safeGap;
  const placement = belowSpace >= safeDetailHeight || belowSpace >= aboveSpace ? 'below' : 'above';
  const idealTop = placement === 'below'
    ? rowBottom + safeGap
    : rowTop - safeGap - safeDetailHeight;
  const maximumTop = Math.max(safeEdge, safeViewportHeight - safeEdge - safeDetailHeight);

  return Object.freeze({
    placement,
    top: clampedNumber(idealTop, safeEdge, maximumTop),
    left,
    width: Math.max(0, right - left)
  });
}

export function trophyRoadVisualSlot(step, rewardsPerRow) {
  const normalizedRewardsPerRow = Math.max(1, Math.floor(Number(rewardsPerRow) || 1));
  const normalizedStep = Math.max(1, Math.floor(Number(step) || 1));
  const row = Math.floor((normalizedStep - 1) / normalizedRewardsPerRow) + 1;
  const position = (normalizedStep - 1) % normalizedRewardsPerRow;
  const column = row % 2 === 1
    ? position + 2
    : normalizedRewardsPerRow - position + 1;
  return Object.freeze({ row, column });
}

export function trophyRoadVisualLayout(rewardCount, rewardsPerRow) {
  const normalizedRewardCount = Math.max(0, Math.floor(Number(rewardCount) || 0));
  const normalizedRewardsPerRow = Math.max(1, Math.floor(Number(rewardsPerRow) || 1));
  const rowCount = Math.max(1, Math.ceil(normalizedRewardCount / normalizedRewardsPerRow));
  const columnCount = normalizedRewardsPerRow + 2;
  const rewardSlots = Object.freeze(
    Array.from(
      { length: normalizedRewardCount },
      (_, index) => trophyRoadVisualSlot(index + 1, normalizedRewardsPerRow)
    )
  );
  const lastReward = rewardSlots.at(-1) || Object.freeze({ row: 1, column: 1 });
  const finish = Object.freeze({
    row: lastReward.row,
    column: lastReward.column + (lastReward.row % 2 === 1 ? 1 : -1)
  });
  const bends = [];
  for (let row = 1; row < rowCount; row += 1) {
    const onRight = row % 2 === 1;
    const column = onRight ? columnCount : 1;
    bends.push(Object.freeze({ row, column, rotation: onRight ? 0 : 270 }));
    bends.push(Object.freeze({ row: row + 1, column, rotation: onRight ? 90 : 180 }));
  }
  return Object.freeze({
    rewardsPerRow: normalizedRewardsPerRow,
    rowCount,
    columnCount,
    start: Object.freeze({ row: 1, column: 1 }),
    finish,
    bends: Object.freeze(bends),
    rewardSlots
  });
}

const TROPHY_ROAD_VISUAL_LAYOUTS = Object.freeze(
  TROPHY_ROAD_RESPONSIVE_LAYOUTS.map(({ name, rewardsPerRow }) => Object.freeze({
    name,
    ...trophyRoadVisualLayout(TROPHY_ROAD_REWARDS.length, rewardsPerRow)
  }))
);

function trophyRoadBend({ row, column, rotation }) {
  return `<i class="turn-trophy-road-bend" style="--turn-road-row:${row};--turn-road-column:${column};--turn-road-rotation:${rotation}deg"></i>`;
}

function trophyRoadScenery(layout) {
  const { name, rewardsPerRow, rowCount, start, finish, bends } = layout;
  return `<div
    class="turn-trophy-road-scenery is-${name}"
    data-turn-road-rewards-per-row="${rewardsPerRow}"
    data-turn-road-rows="${rowCount}"
    aria-hidden="true"
  >
    <span class="turn-trophy-road-landmark is-start" style="--turn-road-row:${start.row};--turn-road-column:${start.column}"><b>START</b></span>
    ${bends.map(trophyRoadBend).join('')}
    <span class="turn-trophy-road-landmark is-finish" style="--turn-road-row:${finish.row};--turn-road-column:${finish.column}"><b>FINISH</b></span>
  </div>`;
}

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
  if (achievement.id === 'drift-flow-master') {
    return TRACK_SCORING_ACHIEVEMENT_IDS.filter((id) => store.isUnlocked(id)).length;
  }
  if (achievement.id === DRIVE_BY_EAR_ACHIEVEMENT_ID) {
    return Math.min(DRIVE_BY_EAR_PART_IDS.length, store.state.progress.driveByEarParts.length);
  }
  if (achievement.id === LEARN_TO_PLAY_ACHIEVEMENT_ID) {
    return Math.min(
      HOW_TO_PLAY_DISCLOSURE_IDS.length,
      store.state.progress.howToPlayDisclosures.length
    );
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
  if (achievement.calibrationPending === true) return 'TARGET PENDING';
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
          <div class="turn-achievements-summary-header">
            <strong id="turnAchievementsSummaryTitle">0 OF ${AVAILABLE_ACHIEVEMENTS.length} UNLOCKED</strong>
            <div class="turn-achievements-summary-metrics">
              <p class="turn-achievements-trophy-total"><span>TROPHIES</span><strong><i aria-hidden="true">${TROPHY_ICON}</i><b>0</b></strong></p>
            </div>
          </div>
          <div class="turn-achievements-summary-main">
            <div class="turn-trophy-road">
              <div class="turn-trophy-road-position">
                <div>
                  <span>TROPHY ROAD</span>
                  <strong data-trophy-road-position>0 / ${TROPHY_ROAD_MAX_THRESHOLD}</strong>
                  <small data-trophy-road-next-copy>First reward at 400 trophies.</small>
                </div>
                <div class="turn-trophy-road-progress" role="progressbar" aria-label="Trophy Road progress" aria-valuemin="0" aria-valuemax="${TROPHY_ROAD_MAX_THRESHOLD}" aria-valuenow="0"><i></i></div>
              </div>
              <div class="turn-trophy-road-highlights" aria-label="Trophy Road status">
                <article data-trophy-road-highlight="earned"></article>
                <article data-trophy-road-highlight="next"></article>
                <article data-trophy-road-highlight="horizon"></article>
              </div>
              <div class="turn-trophy-road-map">
                <div class="turn-trophy-road-map-heading">
                  <strong>THE ROAD</strong>
                  <span>Choose any reward for details.</span>
                </div>
                <div class="turn-trophy-road-track">
                  <p id="turnTrophyRoadSequence" class="turn-sr-only">The road runs from START through every reward in progression order to FINISH.</p>
                  ${TROPHY_ROAD_VISUAL_LAYOUTS.map(trophyRoadScenery).join('')}
                  <ol class="turn-trophy-road-markers" aria-label="Trophy Road rewards in unlock order" aria-describedby="turnTrophyRoadSequence"></ol>
                </div>
              </div>
            </div>
          </div>
        </section>
        <p class="turn-achievements-storage-note" hidden>Achievement progress is available for this session but cannot be saved because local storage is unavailable.</p>
        <div class="turn-achievements-filters" aria-label="Achievement filters">
          <button type="button" aria-pressed="true" data-achievement-filter="all">ALL</button>
          <button type="button" aria-pressed="false" data-achievement-filter="onboarding">GETTING STARTED</button>
          <button type="button" aria-pressed="false" data-achievement-filter="time-trials">TIME TRIALS</button>
          <button type="button" aria-pressed="false" data-achievement-filter="scoring">SCORING</button>
          <button type="button" aria-pressed="false" data-achievement-filter="unlocked">UNLOCKED</button>
        </div>
        <div class="turn-achievements-list"></div>
      </div>
    </article>
    <div class="turn-trophy-road-detail-layer" data-trophy-road-detail-layer hidden>
      <section
        id="turnTrophyRoadDetailDialog"
        class="turn-trophy-road-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="turnTrophyRoadDetailTitle"
        aria-describedby="turnTrophyRoadDetailDescription"
      >
        <button type="button" class="turn-trophy-road-detail-close" data-trophy-road-detail-close aria-label="Close reward details">×</button>
        <div class="turn-trophy-road-detail-content"></div>
      </section>
    </div>`;
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
        || (current === 'scoring' && card.dataset.achievementCategory === CATEGORY.SCORING)
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
  const trophyRoadDetailLayer = dialog.querySelector('[data-trophy-road-detail-layer]');
  const trophyRoadDetailContent = dialog.querySelector('.turn-trophy-road-detail-content');
  const trophyRoadDetailClose = dialog.querySelector('[data-trophy-road-detail-close]');
  const trophyRoadMap = dialog.querySelector('.turn-trophy-road-map');
  const achievementsCard = dialog.querySelector('.turn-achievements-card');
  const trophyRoadPosition = dialog.querySelector('[data-trophy-road-position]');
  const trophyRoadNextCopy = dialog.querySelector('[data-trophy-road-next-copy]');
  const trophyRoadHighlights = Object.fromEntries(
    [...dialog.querySelectorAll('[data-trophy-road-highlight]')]
      .map((element) => [element.dataset.trophyRoadHighlight, element])
  );
  const trophyTotal = dialog.querySelector('.turn-achievements-trophy-total b');
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

  function detailIsOpen() {
    return trophyRoadDetailLayer.hidden === false;
  }

  function selectedRewardMarker() {
    return trophyRoadMarkers.querySelector(`[data-trophy-reward="${selectedRewardId}"]`);
  }

  function syncDetailMarkerState(open = detailIsOpen()) {
    for (const marker of trophyRoadMarkers.querySelectorAll('[data-trophy-reward]')) {
      marker.setAttribute(
        'aria-expanded',
        String(open && marker.dataset.trophyReward === selectedRewardId)
      );
    }
  }

  function positionTrophyRoadDetail() {
    if (!detailIsOpen()) return null;
    const marker = selectedRewardMarker();
    const row = marker?.closest('li');
    if (!row || !trophyRoadMap) return null;
    const visualViewport = globalThis.visualViewport;
    const rowRect = row.getBoundingClientRect();
    const mapRect = trophyRoadMap.getBoundingClientRect();
    const viewportWidth = visualViewport?.width || globalThis.innerWidth;
    const viewportHeight = visualViewport?.height || globalThis.innerHeight;
    const horizontalPlacement = trophyRoadDetailPlacement({
      rowRect,
      mapRect,
      detailHeight: 0,
      viewportWidth,
      viewportHeight
    });
    trophyRoadDetail.style.setProperty('--turn-trophy-road-detail-left', `${horizontalPlacement.left}px`);
    trophyRoadDetail.style.setProperty('--turn-trophy-road-detail-width', `${horizontalPlacement.width}px`);
    const placement = trophyRoadDetailPlacement({
      rowRect,
      mapRect,
      detailHeight: trophyRoadDetail.getBoundingClientRect().height,
      viewportWidth,
      viewportHeight
    });
    trophyRoadDetail.dataset.placement = placement.placement;
    trophyRoadDetail.style.setProperty('--turn-trophy-road-detail-top', `${placement.top}px`);
    trophyRoadDetail.style.setProperty('--turn-trophy-road-detail-left', `${placement.left}px`);
    trophyRoadDetail.style.setProperty('--turn-trophy-road-detail-width', `${placement.width}px`);
    return placement;
  }

  function closeTrophyRoadDetail({ restoreFocus = true } = {}) {
    if (!detailIsOpen()) return false;
    trophyRoadDetailLayer.hidden = true;
    achievementsCard.inert = false;
    dialog.classList.remove('is-trophy-road-detail-open');
    syncDetailMarkerState(false);
    trophyRoadDetailLayer.dispatchEvent(new CustomEvent('turn:trophy-road-detail-closed'));
    if (restoreFocus && dialogIsOpen()) selectedRewardMarker()?.focus({ preventScroll: true });
    return true;
  }

  function openTrophyRoadDetail() {
    trophyRoadDetailLayer.hidden = false;
    achievementsCard.inert = true;
    dialog.classList.add('is-trophy-road-detail-open');
    syncDetailMarkerState(true);
    positionTrophyRoadDetail();
    trophyRoadDetailClose.focus({ preventScroll: true });
    trophyRoadDetailLayer.dispatchEvent(new CustomEvent('turn:trophy-road-detail-opened'));
  }

  function renderTrophyRoad(total) {
    if (!selectedRewardId || !getTrophyRoadReward(selectedRewardId)) {
      selectedRewardId = initialRewardSelection(store);
    }
    const unlockedRewardIds = TROPHY_ROAD_REWARDS
      .filter((reward) => store.isRewardUnlocked(reward.id))
      .map((reward) => reward.id);
    const overview = trophyRoadOverview({
      trophies: total,
      unlockedRewardIds,
      unseenRewardIds: store.unseenRewardIds()
    });
    const nextReward = overview.next;
    trophyRoad.setAttribute('aria-valuenow', String(Math.min(total, TROPHY_ROAD_MAX_THRESHOLD)));
    trophyRoad.setAttribute(
      'aria-valuetext',
      nextReward
        ? `${total} trophies. ${overview.remaining} trophies until ${nextReward.shortTitle}.`
        : `${total} trophies. Every current Trophy Road reward is unlocked.`
    );
    trophyRoadFill.style.setProperty(
      '--turn-trophy-road-progress',
      `${overview.progress * 100}%`
    );
    trophyRoadPosition.textContent = `${total} / ${TROPHY_ROAD_MAX_THRESHOLD}`;
    trophyRoadNextCopy.textContent = nextReward
      ? `${overview.remaining} trophies to ${nextReward.title}.`
      : 'Road complete. Every current reward is yours.';
    const grandfatheredIds = new Set(store.state.rewards?.grandfathered || []);

    function renderHighlight(element, label, reward, copy) {
      if (!element) return;
      const icon = reward ? TROPHY_ROAD_REWARD_ICONS[reward.icon] : TROPHY_ICON;
      element.innerHTML = `
        <div class="turn-trophy-road-highlight-icon" aria-hidden="true">${icon}</div>
        <div><span>${label}</span><strong>${reward?.title || 'ROAD OPEN'}</strong><small>${copy}</small></div>`;
      element.dataset.trophyRewardType = reward?.type || 'complete';
    }
    renderHighlight(
      trophyRoadHighlights.earned,
      overview.earnedIsNew
        ? (overview.newRewards.length > 1 ? `${overview.newRewards.length} JUST EARNED` : 'JUST EARNED')
        : (grandfatheredIds.has(overview.earned?.id) ? 'KEPT REWARD' : 'LATEST REWARD'),
      overview.earned,
      overview.earned
        ? `${overview.earned.threshold} trophies · ${overview.earnedIsNew
          ? (overview.newRewards.length > 1 ? `Plus ${overview.newRewards.length - 1} more` : 'New on this visit')
          : (grandfatheredIds.has(overview.earned.id) ? 'Kept from Trophy Road 1' : 'Unlocked')}`
        : 'First reward begins at 400 trophies'
    );
    renderHighlight(
      trophyRoadHighlights.next,
      nextReward ? 'NEXT' : 'COMPLETE',
      nextReward,
      nextReward ? `${overview.remaining} trophies to go` : 'Every current reward unlocked'
    );
    renderHighlight(
      trophyRoadHighlights.horizon,
      overview.horizon ? 'ON THE HORIZON' : 'FINISH LINE',
      overview.horizon,
      overview.horizon ? `${overview.horizon.threshold} trophies` : `${TROPHY_ROAD_MAX_THRESHOLD} trophies`
    );

    trophyRoadMarkers.innerHTML = TROPHY_ROAD_REWARDS.map((reward, index) => {
      const unlocked = store.isRewardUnlocked(reward.id);
      const selected = reward.id === selectedRewardId;
      const grandfathered = unlocked && grandfatheredIds.has(reward.id);
      const isNext = reward.id === nextReward?.id;
      const stateLabel = grandfathered ? 'Kept' : unlocked ? 'Earned' : isNext ? 'Next' : 'Locked';
      const step = index + 1;
      const visualPosition = TROPHY_ROAD_VISUAL_LAYOUTS.map(({ name, rewardSlots }) => {
        const slot = rewardSlots[index];
        return `--turn-road-${name}-row:${slot.row};--turn-road-${name}-column:${slot.column}`;
      }).join(';');
      return `<li
          data-trophy-road-step="${step}"
          data-trophy-reward-major="${reward.major}"
          style="${visualPosition}"
        ><button
          type="button"
          class="turn-trophy-road-marker ${unlocked ? 'is-unlocked' : 'is-locked'} ${isNext ? 'is-next' : ''} ${selected ? 'is-selected' : ''}"
          data-trophy-reward="${reward.id}"
          data-trophy-reward-type="${reward.type}"
          aria-haspopup="dialog"
          aria-pressed="${selected}"
          aria-controls="turnTrophyRoadDetailDialog"
          aria-expanded="${selected && detailIsOpen()}"
          aria-label="${reward.shortTitle}. ${reward.threshold} trophies. ${stateLabel}."
        ><span class="turn-trophy-road-marker-state">${unlocked ? '✓ ' : ''}${stateLabel}</span><span class="turn-trophy-road-marker-icon" aria-hidden="true">${TROPHY_ROAD_REWARD_ICONS[reward.icon]}</span><b>${reward.threshold}</b><small>${reward.shortTitle}</small>${unlocked ? '' : `<i class="turn-trophy-road-marker-lock" aria-hidden="true">${LOCK_ICON}</i>`}</button></li>`;
    }).join('');

    const reward = getTrophyRoadReward(selectedRewardId) || TROPHY_ROAD_REWARDS[0];
    const unlocked = store.isRewardUnlocked(reward.id);
    const grandfathered = unlocked && grandfatheredIds.has(reward.id);
    const remaining = Math.max(0, reward.threshold - total);
    trophyRoadDetail.dataset.trophyRewardType = reward.type;
    trophyRoadDetail.dataset.trophyRewardState = unlocked ? 'unlocked' : 'locked';
    trophyRoadDetailContent.innerHTML = `
      <div class="turn-trophy-road-detail-icon" aria-hidden="true">${TROPHY_ROAD_REWARD_ICONS[reward.icon]}</div>
      <div>
        <span>${reward.threshold} TROPHIES · ${grandfathered ? 'KEPT FROM TROPHY ROAD 1' : unlocked ? 'UNLOCKED' : `${remaining} TO GO`}</span>
        <h3 id="turnTrophyRoadDetailTitle">${reward.title}</h3>
        <p id="turnTrophyRoadDetailDescription">${reward.description}</p>
      </div>`;
    if (detailIsOpen()) positionTrophyRoadDetail();
  }

  trophyRoadMarkers.addEventListener('click', (event) => {
    const marker = event.target.closest('[data-trophy-reward]');
    if (!marker) return;
    selectedRewardId = marker.dataset.trophyReward;
    renderTrophyRoad(store.trophyTotal());
    openTrophyRoadDetail();
  });

  function render({ force = false } = {}) {
    if (!force && !dialogIsOpen()) {
      dialogDirty = true;
      return false;
    }
    const unlockedCount = AVAILABLE_ACHIEVEMENTS.filter((achievement) => (
      store.isUnlocked(achievement.id)
    )).length;
    const trophies = store.trophyTotal();
    totalTitle.textContent = `${unlockedCount} OF ${AVAILABLE_ACHIEVEMENTS.length} UNLOCKED`;
    trophyTotal.textContent = String(trophies);
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
    closeTrophyRoadDetail({ restoreFocus: false });
    selectedRewardId = initialRewardSelection(store);
    render({ force: true });
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    closeButton.focus();
    store.markAllSeen();
    syncTriggers();
  }

  function close() {
    closeTrophyRoadDetail({ restoreFocus: false });
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    returnFocus?.focus?.();
  }

  homeTrigger.addEventListener('click', () => open(homeTrigger));
  raceTrigger.addEventListener('click', () => open(raceTrigger));
  closeButton.addEventListener('click', close);
  trophyRoadDetailClose.addEventListener('click', () => closeTrophyRoadDetail());
  trophyRoadDetailLayer.addEventListener('click', (event) => {
    if (event.target === trophyRoadDetailLayer) closeTrophyRoadDetail();
  });
  trophyRoadDetailLayer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeTrophyRoadDetail();
      return;
    }
    if (event.key !== 'Tab') return;
    event.preventDefault();
    trophyRoadDetailClose.focus({ preventScroll: true });
  });
  globalThis.addEventListener?.('resize', positionTrophyRoadDetail, { passive: true });
  globalThis.visualViewport?.addEventListener?.('resize', positionTrophyRoadDetail, { passive: true });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => {
    closeTrophyRoadDetail({ restoreFocus: false });
    returnFocus?.focus?.();
  });

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
