const STYLE_ID = 'turn-achievement-unread-marker-styles';
const HIDDEN_FILTER = 'hidden';
const NEW_FILTER = 'new';

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
  button.setAttribute('aria-pressed', 'false');
  button.textContent = label;
  return button;
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
  const allFilter = filters?.querySelector('[data-achievement-filter="all"]');
  const unlockedFilter = filters?.querySelector('[data-achievement-filter="unlocked"]');
  const triggers = [achievements.homeTrigger, achievements.raceTrigger].filter(Boolean);
  const achievementById = new Map(
    achievements.catalog.map((achievement) => [achievement.id, achievement])
  );
  let hiddenFilter = filters?.querySelector(`[data-achievement-filter="${HIDDEN_FILTER}"]`) || null;
  let newFilter = filters?.querySelector(`[data-achievement-filter="${NEW_FILTER}"]`) || null;
  let pendingIds = new Set();
  let decorationQueued = false;
  let activeSpecialFilter = '';

  if (filters && !hiddenFilter) {
    hiddenFilter = createFilterButton(HIDDEN_FILTER, 'HIDDEN');
    if (unlockedFilter) unlockedFilter.before(hiddenFilter);
    else filters.appendChild(hiddenFilter);
  }
  if (filters && !newFilter) {
    newFilter = createFilterButton(NEW_FILTER, 'NEW');
    newFilter.hidden = true;
    if (unlockedFilter) unlockedFilter.before(newFilter);
    else filters.appendChild(newFilter);
  }

  function cardsWithAchievements() {
    return [...list.querySelectorAll('.turn-achievement-card')].map((card, index) => ({
      card,
      achievement: achievementById.get(card.dataset.achievementId)
        || achievements.catalog[index]
        || null
    }));
  }

  function applySpecialFilter() {
    if (!activeSpecialFilter) return;
    for (const { card, achievement } of cardsWithAchievements()) {
      const visible = activeSpecialFilter === HIDDEN_FILTER
        ? achievement?.hidden === true
        : activeSpecialFilter === NEW_FILTER
          ? Boolean(achievement && pendingIds.has(achievement.id))
          : true;
      card.hidden = !visible;
    }
  }

  function syncNewFilter() {
    if (!newFilter) return;
    const hasNewAchievements = pendingIds.size > 0;
    newFilter.hidden = !hasNewAchievements;
    if (!hasNewAchievements && activeSpecialFilter === NEW_FILTER) {
      allFilter?.click();
      activeSpecialFilter = '';
    }
  }

  function activateSpecialFilter(filter) {
    if (filter !== HIDDEN_FILTER && filter !== NEW_FILTER) return;
    if (filter === NEW_FILTER && pendingIds.size === 0) return;
    allFilter?.click();
    activeSpecialFilter = filter;
    for (const button of filters?.querySelectorAll('[data-achievement-filter]') || []) {
      button.setAttribute('aria-pressed', String(button.dataset.achievementFilter === filter));
    }
    applySpecialFilter();
  }

  function handleFilterClick(event) {
    const button = event.target.closest?.('[data-achievement-filter]');
    if (!button || !filters?.contains(button)) return;
    const filter = button.dataset.achievementFilter;
    if (filter === HIDDEN_FILTER || filter === NEW_FILTER) {
      activateSpecialFilter(filter);
      return;
    }
    activeSpecialFilter = '';
    hiddenFilter?.setAttribute('aria-pressed', 'false');
    newFilter?.setAttribute('aria-pressed', 'false');
  }
  filters?.addEventListener('click', handleFilterClick, { capture: true });

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
      card.tabIndex = -1;
      const isNew = pendingIds.has(achievement.id);
      const icon = card.querySelector('.turn-achievement-icon');
      const copy = card.querySelector('.turn-achievement-copy');
      let dot = icon?.querySelector('.turn-achievement-unread-dot');
      let text = copy?.querySelector('.turn-achievement-unread-text');

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
    applySpecialFilter();
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
    allFilter?.click();
    activeSpecialFilter = '';
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
    if (activeSpecialFilter) allFilter?.click();
    activeSpecialFilter = '';
    pendingIds.clear();
    syncNewFilter();
  });

  dialog.dataset.turnUnreadMarkers = 'installed';
  const api = Object.freeze({
    snapshotUnseen,
    decorate,
    focusAchievement,
    disconnect() {
      listObserver.disconnect();
      window.removeEventListener('turn:achievements-updated', handleAchievementUpdate);
      filters?.removeEventListener('click', handleFilterClick, { capture: true });
      toastOpen?.removeEventListener('click', openToastAchievement);
      toastOpen?.remove();
      for (const trigger of triggers) {
        trigger.removeEventListener('click', captureBeforeOpen, { capture: true });
      }
      hiddenFilter?.remove();
      newFilter?.remove();
      pendingIds.clear();
      delete dialog.dataset.turnUnreadMarkers;
    }
  });
  globalThis.__turnAchievementUnreadMarkers = api;
  return api;
}
