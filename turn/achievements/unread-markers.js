const STYLE_ID = 'turn-achievement-unread-marker-styles';
const ALL_FILTER = 'all';
const NEW_FILTER = 'new';
const ONBOARDING_FILTER = 'onboarding';
const WAYS_TO_PLAY_FILTER = 'ways-to-play';
const EXPLORATION_FILTER = 'exploration';
const RACING_FILTER = 'racing';
const TIME_TRIALS_FILTER = 'time-trials';
const HIDDEN_FILTER = 'hidden';
const UNLOCKED_FILTER = 'unlocked';
const LOCKED_FILTER = 'locked';

const TAG_LABELS = Object.freeze({
  [ONBOARDING_FILTER]: 'GETTING STARTED',
  [WAYS_TO_PLAY_FILTER]: 'WAYS TO PLAY',
  [EXPLORATION_FILTER]: 'EXPLORATION',
  [RACING_FILTER]: 'RACING',
  [TIME_TRIALS_FILTER]: 'TIME TRIALS',
  [HIDDEN_FILTER]: 'HIDDEN',
  [NEW_FILTER]: 'NEW'
});

function installStyles() {
  if (document.querySelector(`#${STYLE_ID}`)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .turn-achievement-icon {
      position: relative;
    }
    .turn-achievement-unread-dot {
      position: absolute;
      z-index: 2;
      top: -10px;
      right: -10px;
      width: 20px;
      height: 20px;
      border: 3px solid var(--turn-ink, #08090a);
      border-radius: 50%;
      background: var(--turn-action-warning, #ffd43b);
      box-shadow: 2px 2px 0 var(--turn-ink, #08090a);
      pointer-events: none;
    }
    .turn-achievement-unread-text {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .turn-achievement-meta {
      display: flex !important;
      flex-wrap: wrap;
      gap: 5px 7px;
      align-items: center;
      margin-bottom: 3px;
    }
    .turn-achievement-tag {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 2px 7px;
      border: 2px solid var(--turn-ink, #08090a);
      border-radius: var(--turn-radius-pill, 999px);
      background: var(--turn-surface-page, #fff8e8);
      color: var(--turn-ink, #08090a);
      font-size: .58rem;
      font-weight: 950;
      line-height: 1;
      letter-spacing: .08em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .turn-achievement-tag[data-achievement-tag="hidden"] {
      background: var(--turn-muted, #d6d0c2);
    }
    .turn-achievement-tag[data-achievement-tag="new"] {
      background: var(--turn-action-warning, #ffd43b);
    }
    .turn-achievement-trophies {
      font-size: .68rem;
      font-weight: 950;
      letter-spacing: .11em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .turn-achievements-filters button {
      min-height: 34px;
      padding: 3px 10px;
      line-height: 1;
    }
    .turn-achievements-filters button:disabled {
      opacity: .5;
      cursor: default;
    }
    .turn-achievement-card:focus {
      outline: 5px solid var(--turn-action-information, #38d9ff);
      outline-offset: 4px;
    }
    .turn-achievement-toast:not(.turn-trophy-reward-toast) {
      pointer-events: auto;
    }
    .turn-achievement-toast-open {
      position: absolute;
      z-index: 3;
      inset: 0;
      padding: 0;
      border: 0;
      border-radius: inherit;
      background: transparent;
      cursor: pointer;
    }
    .turn-achievement-toast-open:focus-visible {
      outline: 5px solid var(--turn-action-information, #38d9ff);
      outline-offset: 4px;
    }
  `;
  document.head.appendChild(style);
}

function createFilterButton(filter, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.achievementFilter = filter;
  button.setAttribute('aria-pressed', String(filter === ALL_FILTER));
  button.textContent = label;
  return button;
}

function installFilterButtons(filters) {
  if (!filters) return new Map();
  const nodes = [
    createFilterButton(ALL_FILTER, 'ALL'),
    createFilterButton(NEW_FILTER, 'NEW'),
    createFilterButton(ONBOARDING_FILTER, 'GETTING STARTED'),
    createFilterButton(WAYS_TO_PLAY_FILTER, 'WAYS TO PLAY'),
    createFilterButton(EXPLORATION_FILTER, 'EXPLORATION'),
    createFilterButton(RACING_FILTER, 'RACING'),
    createFilterButton(TIME_TRIALS_FILTER, 'TIME TRIALS'),
    createFilterButton(HIDDEN_FILTER, 'HIDDEN'),
    createFilterButton(UNLOCKED_FILTER, 'UNLOCKED'),
    createFilterButton(LOCKED_FILTER, 'LOCKED')
  ];
  filters.replaceChildren(...nodes);
  return new Map(nodes.map((button) => [button.dataset.achievementFilter, button]));
}

function staticAchievementTags(achievement) {
  const declared = Array.isArray(achievement?.tags)
    ? achievement.tags
    : [achievement?.category];
  const tags = declared.filter(Boolean);

  // Time trials are races too. Keeping both tags makes car choice and race craft
  // part of the challenge without collapsing TIME TRIALS into a separate silo.
  if (achievement?.category === TIME_TRIALS_FILTER && !tags.includes(RACING_FILTER)) {
    tags.unshift(RACING_FILTER);
  }
  if (achievement?.hidden === true && !tags.includes(HIDDEN_FILTER)) tags.push(HIDDEN_FILTER);
  return [...new Set(tags)];
}

function visibleAchievementTags(achievement, isNew) {
  const tags = staticAchievementTags(achievement);
  if (isNew && !tags.includes(NEW_FILTER)) tags.push(NEW_FILTER);
  return tags;
}

function decorateMeta(copy, achievement, isNew) {
  if (!copy || !achievement) return;
  let meta = copy.querySelector(':scope > .turn-achievement-meta');
  if (!meta) {
    meta = copy.querySelector(':scope > span:not(.turn-achievement-unread-text)');
    if (!meta) {
      meta = document.createElement('span');
      copy.prepend(meta);
    }
    meta.className = 'turn-achievement-meta';
  }

  const tags = visibleAchievementTags(achievement, isNew);
  const nodes = tags.map((tag) => {
    const label = document.createElement('span');
    label.className = 'turn-achievement-tag';
    label.dataset.achievementTag = tag;
    label.textContent = TAG_LABELS[tag] || String(tag).toUpperCase();
    return label;
  });
  const trophies = document.createElement('span');
  trophies.className = 'turn-achievement-trophies';
  trophies.textContent = `${achievement.trophies} trophies`;
  meta.replaceChildren(...nodes, trophies);
}

function removeTimeTrialRecommendation(copy, achievement) {
  if (!copy || achievement?.category !== TIME_TRIALS_FILTER) return;
  for (const small of copy.querySelectorAll(':scope > small')) {
    if (/^Recommended:/i.test(small.textContent?.trim() || '')) small.remove();
  }
}

export function installAchievementUnreadMarkers(
  achievements = globalThis.__turnAchievements
) {
  if (!achievements?.store || !achievements?.dialog || !Array.isArray(achievements.catalog)) {
    return null;
  }
  if (achievements.dialog.dataset.turnUnreadMarkers === 'installed') {
    return globalThis.__turnAchievementUnreadMarkers || null;
  }

  installStyles();
  const dialog = achievements.dialog;
  const list = dialog.querySelector('.turn-achievements-list');
  const filters = dialog.querySelector('.turn-achievements-filters');
  const filterButtons = installFilterButtons(filters);
  const newFilter = filterButtons.get(NEW_FILTER) || null;
  const triggers = [achievements.homeTrigger, achievements.raceTrigger].filter(Boolean);
  const achievementById = new Map(
    achievements.catalog.map((achievement) => [achievement.id, achievement])
  );
  let pendingIds = new Set();
  let decorationQueued = false;
  let activeFilter = ALL_FILTER;

  function cardsWithAchievements() {
    return [...list.querySelectorAll('.turn-achievement-card')].map((card, index) => ({
      card,
      achievement: achievementById.get(card.dataset.achievementId)
        || achievements.catalog[index]
        || null
    }));
  }

  function matchesFilter(card, achievement) {
    if (activeFilter === ALL_FILTER) return true;
    if (activeFilter === UNLOCKED_FILTER) return card.dataset.achievementStatus === 'unlocked';
    if (activeFilter === LOCKED_FILTER) return card.dataset.achievementStatus !== 'unlocked';
    if (activeFilter === NEW_FILTER) return Boolean(achievement && pendingIds.has(achievement.id));
    return staticAchievementTags(achievement).includes(activeFilter);
  }

  function applyFilter() {
    for (const { card, achievement } of cardsWithAchievements()) {
      card.hidden = !matchesFilter(card, achievement);
    }
  }

  function setActiveFilter(filter) {
    if (!filterButtons.has(filter)) filter = ALL_FILTER;
    if (filter === NEW_FILTER && pendingIds.size === 0) filter = ALL_FILTER;
    activeFilter = filter;
    for (const [candidate, button] of filterButtons) {
      button.setAttribute('aria-pressed', String(candidate === activeFilter));
    }
    applyFilter();
  }

  function syncNewFilter() {
    if (!newFilter) return;
    const hasNewAchievements = pendingIds.size > 0;
    newFilter.disabled = !hasNewAchievements;
    newFilter.setAttribute('aria-disabled', String(!hasNewAchievements));
    newFilter.title = hasNewAchievements ? 'Show newly unlocked achievements' : 'No new achievements';
    if (!hasNewAchievements && activeFilter === NEW_FILTER) setActiveFilter(ALL_FILTER);
  }

  function handleFilterClick(event) {
    const button = event.target.closest?.('[data-achievement-filter]');
    if (!button || !filters?.contains(button)) return;
    setActiveFilter(button.dataset.achievementFilter || ALL_FILTER);
  }
  filters?.addEventListener('click', handleFilterClick);

  function snapshotUnseen() {
    pendingIds = new Set(achievements.store.unseenIds());
    syncNewFilter();
  }

  function decorate() {
    decorationQueued = false;
    for (const { card, achievement } of cardsWithAchievements()) {
      if (!achievement) continue;
      card.dataset.achievementId = achievement.id;
      card.dataset.achievementHidden = String(achievement.hidden === true);
      card.dataset.achievementTags = staticAchievementTags(achievement).join(' ');
      card.tabIndex = -1;
      const isNew = pendingIds.has(achievement.id);
      const icon = card.querySelector('.turn-achievement-icon');
      const copy = card.querySelector('.turn-achievement-copy');
      let dot = icon?.querySelector('.turn-achievement-unread-dot');
      let text = copy?.querySelector('.turn-achievement-unread-text');

      decorateMeta(copy, achievement, isNew);
      removeTimeTrialRecommendation(copy, achievement);

      if (isNew) {
        if (!dot && icon) {
          dot = document.createElement('span');
          dot.className = 'turn-achievement-unread-dot';
          dot.setAttribute('aria-hidden', 'true');
          icon.appendChild(dot);
        }
        if (!text && copy) {
          text = document.createElement('span');
          text.className = 'turn-achievement-unread-text';
          text.textContent = 'Newly unlocked achievement.';
          copy.prepend(text);
        }
        card.dataset.achievementUnseen = 'true';
      } else {
        dot?.remove();
        text?.remove();
        delete card.dataset.achievementUnseen;
      }
    }
    syncNewFilter();
    applyFilter();
  }

  function queueDecoration() {
    if (decorationQueued) return;
    decorationQueued = true;
    queueMicrotask(decorate);
  }

  function captureBeforeOpen() {
    snapshotUnseen();
    queueDecoration();
  }

  for (const trigger of triggers) {
    trigger.addEventListener('click', captureBeforeOpen, { capture: true });
  }

  const listObserver = new MutationObserver(queueDecoration);
  listObserver.observe(list, { childList: true });

  const handleAchievementUpdate = (event) => {
    for (const id of event.detail?.unlocked || []) pendingIds.add(id);
    syncNewFilter();
    queueDecoration();
  };
  window.addEventListener('turn:achievements-updated', handleAchievementUpdate);

  function achievementFromToast() {
    const heading = achievements.toast?.querySelector('strong')?.textContent?.trim() || '';
    return achievements.catalog.find((achievement) => (
      heading === achievement.title || heading.startsWith(`${achievement.title} + `)
    )) || null;
  }

  function focusAchievement(achievementId) {
    const target = list.querySelector(`[data-achievement-id="${achievementId}"]`);
    if (!target) return false;
    setActiveFilter(ALL_FILTER);
    target.hidden = false;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', behavior: 'auto' });
    return true;
  }

  const toastOpen = achievements.toast && !achievements.toast.querySelector('.turn-achievement-toast-open')
    ? document.createElement('button')
    : null;
  if (toastOpen) {
    toastOpen.type = 'button';
    toastOpen.className = 'turn-achievement-toast-open';
    toastOpen.setAttribute('aria-label', 'Open unlocked achievement');
    toastOpen.title = 'Open achievement';
    achievements.toast.appendChild(toastOpen);
  }

  function openToastAchievement() {
    const achievement = achievementFromToast();
    if (!achievement) return;
    snapshotUnseen();
    const returnTrigger = achievements.raceTrigger?.hidden === false
      ? achievements.raceTrigger
      : achievements.homeTrigger;
    achievements.open(returnTrigger || null);
    queueMicrotask(() => {
      decorate();
      focusAchievement(achievement.id);
    });
  }
  toastOpen?.addEventListener('click', openToastAchievement);

  dialog.addEventListener('close', () => {
    pendingIds.clear();
    syncNewFilter();
    setActiveFilter(ALL_FILTER);
  });

  // The first achievement list already exists before this enhancer installs.
  // Decorate it immediately so tags and the complete filter set are available
  // even before the player has unlocked anything new.
  decorate();

  dialog.dataset.turnUnreadMarkers = 'installed';
  const api = Object.freeze({
    snapshotUnseen,
    decorate,
    focusAchievement,
    disconnect() {
      listObserver.disconnect();
      window.removeEventListener('turn:achievements-updated', handleAchievementUpdate);
      filters?.removeEventListener('click', handleFilterClick);
      toastOpen?.removeEventListener('click', openToastAchievement);
      toastOpen?.remove();
      for (const trigger of triggers) {
        trigger.removeEventListener('click', captureBeforeOpen, { capture: true });
      }
      pendingIds.clear();
      delete dialog.dataset.turnUnreadMarkers;
    }
  });
  globalThis.__turnAchievementUnreadMarkers = api;
  return api;
}
