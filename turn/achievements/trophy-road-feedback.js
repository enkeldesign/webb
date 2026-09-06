import { CATEGORY } from './catalog.js?revision=r241-learning-achievements';
import { createTrophyRoadShowcase } from './trophy-road-showcase.js?revision=r243-mountain-1300';
import {
  achievementCardMatchesFilters
} from './filter-state.js?revision=r219-unified-achievement-filters';
import {
  TROPHY_ROAD_REWARD_ICONS,
  getTrophyRoadReward
} from '../progression/trophy-road.js?revision=r243-mountain-1300';

const TAG_FILTERS = Object.freeze([
  Object.freeze({ id: 'new', label: 'NEW' }),
  Object.freeze({ id: CATEGORY.ONBOARDING, label: 'GETTING STARTED' }),
  Object.freeze({ id: CATEGORY.WAYS_TO_PLAY, label: 'WAYS TO PLAY' }),
  Object.freeze({ id: CATEGORY.EXPLORATION, label: 'EXPLORATION' }),
  Object.freeze({ id: CATEGORY.RACING, label: 'RACING' }),
  Object.freeze({ id: CATEGORY.TIME_TRIALS, label: 'TIME TRIALS' }),
  Object.freeze({ id: 'hidden', label: 'HIDDEN' })
]);
const STATUS_FILTERS = Object.freeze([
  Object.freeze({ id: 'unlocked', label: 'UNLOCKED' }),
  Object.freeze({ id: 'locked', label: 'LOCKED' })
]);
let installed = null;

function ensureFeedbackStylesheet() {
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  let stylesheet = document.querySelector('link[data-turn-trophy-road-feedback]');
  if (!stylesheet) {
    stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `/turn/progression/trophy-road-r157.css?build=${buildKey}-r244-reward-toast-guide`;
    stylesheet.setAttribute('data-turn-trophy-road-feedback', '');
  }
  document.head.appendChild(stylesheet);
}

function makeFilterButton(id, label, pressed = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.achievementFilter = id;
  button.setAttribute('aria-pressed', String(pressed));
  button.textContent = label;
  return button;
}

function prepareSummary(dialog) {
  const summary = dialog.querySelector('.turn-achievements-summary');
  const summaryMain = summary?.querySelector('.turn-achievements-summary-main');
  const title = summary?.querySelector('#turnAchievementsSummaryTitle');
  const trophyMetric = summary?.querySelector('.turn-achievements-trophy-total');
  const road = summary?.querySelector('.turn-trophy-road');
  const track = road?.querySelector('.turn-trophy-road-track');
  if (!summary || !summaryMain || !title || !trophyMetric || !road || !track) return null;

  const detail = dialog.querySelector('.turn-trophy-road-detail');
  const detailLayer = dialog.querySelector('[data-trophy-road-detail-layer]');
  const markers = track.querySelector('.turn-trophy-road-markers');
  if (!detail || !detailLayer || !markers) return null;

  return Object.freeze({
    summary,
    summaryMain,
    road,
    track,
    detail,
    detailLayer,
    markers
  });
}

function prepareFilters(dialog) {
  const container = dialog.querySelector('.turn-achievements-filters');
  if (!container) return null;
  container.setAttribute('aria-label', 'Achievement filters. Choose one or more.');
  container.replaceChildren(
    makeFilterButton('all', 'ALL', true),
    ...TAG_FILTERS.map(({ id, label }) => makeFilterButton(id, label)),
    ...STATUS_FILTERS.map(({ id, label }) => makeFilterButton(id, label))
  );

  const tagIds = new Set(TAG_FILTERS.map(({ id }) => id));
  const statusIds = new Set(STATUS_FILTERS.map(({ id }) => id));
  const activeTags = new Set();
  const activeStatuses = new Set();
  const allButton = container.querySelector('[data-achievement-filter="all"]');
  const newButton = container.querySelector('[data-achievement-filter="new"]');
  const list = dialog.querySelector('.turn-achievements-list');

  function hasUnseenAchievements() {
    return Boolean(list?.querySelector('[data-achievement-unseen="true"]'));
  }

  function syncNewAvailability() {
    const available = hasUnseenAchievements();
    if (newButton) {
      newButton.disabled = !available;
      newButton.setAttribute('aria-disabled', String(!available));
      newButton.title = available ? 'Show newly unlocked achievements' : 'No new achievements';
    }
  }

  function syncButtons() {
    const all = activeTags.size === 0 && activeStatuses.size === 0;
    allButton?.setAttribute('aria-pressed', String(all));
    for (const button of container.querySelectorAll('[data-achievement-filter]:not([data-achievement-filter="all"])')) {
      const id = button.dataset.achievementFilter;
      const pressed = tagIds.has(id) ? activeTags.has(id) : activeStatuses.has(id);
      button.setAttribute('aria-pressed', String(pressed));
    }
  }

  function apply() {
    syncNewAvailability();
    let visibleCount = 0;
    for (const card of dialog.querySelectorAll('.turn-achievement-card')) {
      const visible = achievementCardMatchesFilters({
        tags: card.dataset.achievementTags,
        category: card.dataset.achievementCategory,
        unseen: card.dataset.achievementUnseen === 'true',
        status: card.dataset.achievementStatus
      }, { activeTags, activeStatuses });
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    }
    list?.toggleAttribute('data-filter-empty', visibleCount === 0);
    syncButtons();
  }

  function reset() {
    activeTags.clear();
    activeStatuses.clear();
    apply();
  }

  function handleFilterClick(event) {
    const button = event.target.closest('[data-achievement-filter]');
    if (!button) return;
    const id = button.dataset.achievementFilter;
    if (id === 'all') {
      reset();
      return;
    }
    if (tagIds.has(id)) {
      if (button.disabled) return;
      if (activeTags.has(id)) activeTags.delete(id);
      else activeTags.add(id);
    } else if (statusIds.has(id)) {
      if (activeStatuses.has(id)) activeStatuses.delete(id);
      else {
        activeStatuses.clear();
        activeStatuses.add(id);
      }
    }
    apply();
  }
  container.addEventListener('click', handleFilterClick);

  const listObserver = new MutationObserver(apply);
  if (list) {
    listObserver.observe(list, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'data-achievement-tags',
        'data-achievement-unseen',
        'data-achievement-status'
      ]
    });
  }
  apply();
  return Object.freeze({
    apply,
    reset,
    disconnect() {
      listObserver.disconnect();
      container.removeEventListener('click', handleFilterClick);
    }
  });
}

function installRoadBehavior({ achievements, summary }) {
  const dialog = summary.summary.closest('dialog');
  const { markers } = summary;
  const showcase = createTrophyRoadShowcase();
  let selectedByPlayer = '';
  let selectionSyncQueued = false;

  function renderedSelection() {
    const selected = markers.querySelector(
      '[data-trophy-reward].is-selected, [data-trophy-reward][aria-pressed="true"]'
    );
    return selected?.dataset.trophyReward || '';
  }

  function restoreStaticRewardIcon(reward, host) {
    host.classList.remove('turn-trophy-road-detail-model-host', 'is-loading');
    delete host.dataset.trophyRewardModel;
    const icon = TROPHY_ROAD_REWARD_ICONS[reward.icon];
    if (icon) host.innerHTML = icon;
  }

  function syncShowcase() {
    const reward = getTrophyRoadReward(selectedByPlayer);
    const host = summary.detail?.querySelector('.turn-trophy-road-detail-icon');
    if (summary.detailLayer.hidden || !reward || !host) {
      showcase.clear();
      return;
    }

    if (reward.type !== 'vehicle' && reward.type !== 'vehicle-pack') {
      showcase.clear();
      restoreStaticRewardIcon(reward, host);
      return;
    }

    host.classList.add('turn-trophy-road-detail-model-host');
    void showcase.show(reward, host);
    if (dialog?.open) showcase.resume();
  }

  function preserveUserSelection({ adoptRendered = false } = {}) {
    if (adoptRendered || !selectedByPlayer) {
      selectedByPlayer = renderedSelection() || selectedByPlayer;
    }
    if (!selectedByPlayer) {
      showcase.clear();
      return;
    }
    for (const marker of markers.querySelectorAll('[data-trophy-reward]')) {
      const selected = marker.dataset.trophyReward === selectedByPlayer;
      marker.classList.toggle('is-selected', selected);
      marker.setAttribute('aria-pressed', String(selected));
    }
    syncShowcase();
  }

  function queueSelectionSync({ adoptRendered = true } = {}) {
    if (selectionSyncQueued) return;
    selectionSyncQueued = true;
    queueMicrotask(() => {
      selectionSyncQueued = false;
      preserveUserSelection({ adoptRendered });
    });
  }

  function releaseSelection() {
    selectedByPlayer = '';
    showcase.clear();
  }

  markers.addEventListener('click', (event) => {
    const marker = event.target.closest('[data-trophy-reward]');
    if (!marker) return;
    selectedByPlayer = marker.dataset.trophyReward;
    queueSelectionSync();
  });

  const markerObserver = new MutationObserver(() => queueSelectionSync());
  markerObserver.observe(markers, { childList: true });

  function handleDetailOpened() {
    preserveUserSelection({ adoptRendered: true });
  }

  function handleDetailClosed() {
    showcase.clear();
  }

  summary.detailLayer.addEventListener('turn:trophy-road-detail-opened', handleDetailOpened);
  summary.detailLayer.addEventListener('turn:trophy-road-detail-closed', handleDetailClosed);
  dialog?.addEventListener('close', showcase.pause);
  preserveUserSelection({ adoptRendered: true });
  return Object.freeze({
    releaseSelection,
    syncRenderedSelection: () => preserveUserSelection({ adoptRendered: true }),
    resizeShowcase: showcase.resize,
    pauseShowcase: showcase.pause,
    disconnect() {
      markerObserver.disconnect();
      showcase.dispose();
      summary.detailLayer.removeEventListener('turn:trophy-road-detail-opened', handleDetailOpened);
      summary.detailLayer.removeEventListener('turn:trophy-road-detail-closed', handleDetailClosed);
      dialog?.removeEventListener('close', showcase.pause);
    }
  });
}

export function installTrophyRoadFeedback(achievements = globalThis.__turnAchievements) {
  if (installed) return installed;
  ensureFeedbackStylesheet();
  const dialog = achievements?.dialog;
  if (!dialog || !achievements.store) return null;

  const summary = prepareSummary(dialog);
  const filters = prepareFilters(dialog);
  if (!summary || !filters) return null;
  const road = installRoadBehavior({ achievements, summary });
  if (!road) return null;

  function resetView() {
    filters.reset();
    road.syncRenderedSelection();
  }

  const openObserver = new MutationObserver(() => {
    if (!dialog.hasAttribute('open')) return;
    filters.reset();
    road.syncRenderedSelection();
    road.resizeShowcase();
  });
  openObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  dialog.addEventListener('close', () => {
    road.releaseSelection();
    filters.reset();
  });

  installed = Object.freeze({
    reset: resetView,
    disconnect() {
      openObserver.disconnect();
      filters.disconnect();
      road.disconnect();
      installed = null;
    }
  });
  return installed;
}
