import { CATEGORY } from './catalog.js?revision=r181-hatchback-rally';
import { createTrophyRoadShowcase } from './trophy-road-showcase.js?revision=r179-native-car-surfaces';
import {
  achievementCardMatchesFilters
} from './filter-state.js?revision=r219-unified-achievement-filters';
import {
  LOCK_ICON,
  TROPHY_ROAD_MAX_THRESHOLD,
  TROPHY_ROAD_REWARD_ICONS,
  TROPHY_ROAD_VIEWPORT_THRESHOLD,
  getTrophyRoadReward
} from '../progression/trophy-road.js?revision=r166-bella-records';

const EDGE_PX = 34;
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
const ROAD_ARROW_ICONS = Object.freeze({
  previous: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"></path></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg>'
});

let installed = null;

function ensureFeedbackStylesheet() {
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  let stylesheet = document.querySelector('link[data-turn-trophy-road-feedback]');
  if (!stylesheet) {
    stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `/turn/progression/trophy-road-r157.css?build=${buildKey}-r166-bella-records`;
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

function makeRoadScrollButton(direction) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `turn-trophy-road-scroll-button is-${direction}`;
  button.setAttribute('aria-label', `Scroll Trophy Road ${direction === 'previous' ? 'left' : 'right'}`);
  button.innerHTML = ROAD_ARROW_ICONS[direction];
  return button;
}

function prepareSummary(dialog) {
  const summary = dialog.querySelector('.turn-achievements-summary');
  const summaryMain = summary?.querySelector('.turn-achievements-summary-main');
  const title = summary?.querySelector('#turnAchievementsSummaryTitle');
  const trophyMetric = summary?.querySelector('.turn-achievements-trophy-total');
  const completionMetric = summary?.querySelector('.turn-achievements-percent')?.closest('p');
  const road = summary?.querySelector('.turn-trophy-road');
  const track = road?.querySelector('.turn-trophy-road-track');
  if (!summary || !summaryMain || !title || !trophyMetric || !completionMetric || !road || !track) return null;

  let header = summary.querySelector('.turn-achievements-summary-header');
  if (!header) {
    header = document.createElement('div');
    header.className = 'turn-achievements-summary-header';
    const metrics = document.createElement('div');
    metrics.className = 'turn-achievements-summary-metrics';
    metrics.append(trophyMetric, completionMetric);
    header.append(title, metrics);
    summary.insertBefore(header, summaryMain);
  }

  let scroll = road.querySelector('.turn-trophy-road-scroll');
  let content = road.querySelector('.turn-trophy-road-content');
  if (!scroll || !content) {
    scroll = document.createElement('div');
    scroll.className = 'turn-trophy-road-scroll';
    scroll.tabIndex = 0;
    scroll.setAttribute('aria-label', 'Trophy Road. Use arrow keys or the scroll buttons for later rewards.');
    content = document.createElement('div');
    content.className = 'turn-trophy-road-content';
    scroll.appendChild(content);
    content.appendChild(track);
  }

  let controls = road.querySelector('.turn-trophy-road-controls');
  let previousButton = road.querySelector('.turn-trophy-road-scroll-button.is-previous');
  let nextButton = road.querySelector('.turn-trophy-road-scroll-button.is-next');
  if (!controls || !previousButton || !nextButton) {
    controls = document.createElement('div');
    controls.className = 'turn-trophy-road-controls';
    previousButton = makeRoadScrollButton('previous');
    nextButton = makeRoadScrollButton('next');
    road.replaceChildren(controls);
    controls.append(previousButton, scroll, nextButton);
  }

  let help = summary.querySelector('.turn-trophy-road-help');
  const detail = summary.querySelector('.turn-trophy-road-detail');
  if (!help && detail) {
    help = document.createElement('p');
    help.className = 'turn-trophy-road-help';
    help.textContent = 'Select a reward for details.';
    detail.before(help);
  }

  return Object.freeze({
    summary,
    summaryMain,
    road,
    track,
    scroll,
    content,
    controls,
    previousButton,
    nextButton,
    help,
    detail
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
  const { store } = achievements;
  const dialog = summary.summary.closest('dialog');
  const markers = summary.track.querySelector('.turn-trophy-road-markers');
  if (!markers) return null;
  const showcase = createTrophyRoadShowcase();
  let selectedByPlayer = '';
  let geometryFrame = 0;
  let selectionSyncQueued = false;

  function updateScrollButtons() {
    const maximum = Math.max(0, summary.scroll.scrollWidth - summary.scroll.clientWidth);
    const atStart = summary.scroll.scrollLeft <= 1;
    const atEnd = maximum <= 1 || summary.scroll.scrollLeft >= maximum - 1;
    summary.previousButton.disabled = atStart;
    summary.previousButton.setAttribute('aria-disabled', String(atStart));
    summary.nextButton.disabled = atEnd;
    summary.nextButton.setAttribute('aria-disabled', String(atEnd));
  }

  function roadGeometry() {
    cancelAnimationFrame(geometryFrame);
    geometryFrame = requestAnimationFrame(() => {
      const viewportWidth = Math.max(260, summary.scroll.clientWidth || 0);
      const viewportRoadWidth = Math.max(1, viewportWidth - EDGE_PX * 2);
      const contentRoadWidth = viewportRoadWidth
        * (TROPHY_ROAD_MAX_THRESHOLD / TROPHY_ROAD_VIEWPORT_THRESHOLD);
      const contentWidth = Math.ceil(contentRoadWidth + EDGE_PX * 2);
      summary.content.style.width = `${contentWidth}px`;

      for (const marker of markers.querySelectorAll('[data-trophy-reward]')) {
        const reward = getTrophyRoadReward(marker.dataset.trophyReward);
        if (!reward) continue;
        marker.style.setProperty(
          '--turn-trophy-road-position',
          `${EDGE_PX + (reward.threshold / TROPHY_ROAD_MAX_THRESHOLD) * contentRoadWidth}px`
        );
      }
      updateScrollButtons();
      showcase.resize();
    });
  }

  function decorateMarkers() {
    for (const marker of markers.querySelectorAll('[data-trophy-reward]')) {
      const reward = getTrophyRoadReward(marker.dataset.trophyReward);
      const icon = marker.querySelector('span');
      if (icon) {
        icon.classList.add('turn-trophy-road-marker-icon');
        if (reward?.icon && TROPHY_ROAD_REWARD_ICONS[reward.icon]) {
          icon.innerHTML = TROPHY_ROAD_REWARD_ICONS[reward.icon];
        }
      }
      if (reward && !store.isRewardUnlocked(reward.id) && !marker.querySelector('.turn-trophy-road-marker-lock')) {
        const lock = document.createElement('i');
        lock.className = 'turn-trophy-road-marker-lock';
        lock.setAttribute('aria-hidden', 'true');
        lock.innerHTML = LOCK_ICON;
        marker.appendChild(lock);
      }
    }
  }

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
    if (!reward || !host) {
      showcase.clear();
      return;
    }

    if (reward.type === 'track' || reward.type === 'feature') {
      showcase.clear();
      restoreStaticRewardIcon(reward, host);
      return;
    }

    host.classList.add('turn-trophy-road-detail-model-host');
    void showcase.show(reward, host);
    if (dialog?.open) showcase.resume();
  }

  function preserveUserSelection({ adoptRendered = false } = {}) {
    decorateMarkers();
    roadGeometry();
    if (adoptRendered || !selectedByPlayer) {
      selectedByPlayer = renderedSelection() || selectedByPlayer;
    }
    if (!selectedByPlayer) {
      showcase.clear();
      if (summary.detail) summary.detail.hidden = true;
      if (summary.help) summary.help.hidden = false;
      return;
    }
    for (const marker of markers.querySelectorAll('[data-trophy-reward]')) {
      const selected = marker.dataset.trophyReward === selectedByPlayer;
      marker.classList.toggle('is-selected', selected);
      marker.setAttribute('aria-pressed', String(selected));
    }
    if (summary.detail) summary.detail.hidden = false;
    if (summary.help) summary.help.hidden = true;
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

  function clearSelection() {
    selectedByPlayer = '';
    showcase.clear();
    for (const marker of markers.querySelectorAll('[data-trophy-reward]')) {
      marker.classList.remove('is-selected');
      marker.setAttribute('aria-pressed', 'false');
    }
    if (summary.detail) {
      summary.detail.hidden = true;
      summary.detail.replaceChildren();
    }
    if (summary.help) summary.help.hidden = false;
  }

  function releaseSelection() {
    selectedByPlayer = '';
    showcase.clear();
  }

  function scrollRoad(direction) {
    const distance = Math.max(180, summary.scroll.clientWidth * 0.78);
    const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    summary.scroll.scrollBy({
      left: direction * distance,
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  }

  summary.previousButton.addEventListener('click', () => scrollRoad(-1));
  summary.nextButton.addEventListener('click', () => scrollRoad(1));
  summary.scroll.addEventListener('scroll', updateScrollButtons, { passive: true });
  summary.scroll.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    scrollRoad(event.key === 'ArrowLeft' ? -1 : 1);
  });

  markers.addEventListener('click', (event) => {
    const marker = event.target.closest('[data-trophy-reward]');
    if (!marker) return;
    selectedByPlayer = marker.dataset.trophyReward;
    queueSelectionSync();
  });

  const markerObserver = new MutationObserver(() => queueSelectionSync());
  markerObserver.observe(markers, { childList: true });

  function alignToProgress() {
    roadGeometry();
    requestAnimationFrame(() => {
      const viewportWidth = summary.scroll.clientWidth || 0;
      const contentRoadWidth = Math.max(1, summary.content.clientWidth - EDGE_PX * 2);
      const total = Math.min(store.trophyTotal(), TROPHY_ROAD_MAX_THRESHOLD);
      const position = EDGE_PX + (total / TROPHY_ROAD_MAX_THRESHOLD) * contentRoadWidth;
      summary.scroll.scrollLeft = Math.max(0, position - viewportWidth * .35);
      updateScrollButtons();
    });
  }

  window.addEventListener('resize', roadGeometry, { passive: true });
  dialog?.addEventListener('close', showcase.pause);
  preserveUserSelection({ adoptRendered: true });
  updateScrollButtons();
  return Object.freeze({
    clearSelection,
    releaseSelection,
    syncRenderedSelection: () => preserveUserSelection({ adoptRendered: true }),
    alignToProgress,
    syncScrollButtons: updateScrollButtons,
    pauseShowcase: showcase.pause,
    disconnect() {
      cancelAnimationFrame(geometryFrame);
      markerObserver.disconnect();
      showcase.dispose();
      window.removeEventListener('resize', roadGeometry);
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
    summary.scroll.scrollLeft = 0;
    road.syncScrollButtons();
  }

  const openObserver = new MutationObserver(() => {
    if (!dialog.hasAttribute('open')) return;
    filters.reset();
    road.syncRenderedSelection();
    road.alignToProgress();
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
