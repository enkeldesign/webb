const STYLE_ID = 'turn-achievement-unread-marker-styles';

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
  `;
  document.head.appendChild(style);
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
  const triggers = [achievements.homeTrigger, achievements.raceTrigger].filter(Boolean);
  let pendingIds = new Set();
  let decorationQueued = false;

  function snapshotUnseen() {
    pendingIds = new Set(achievements.store.unseenIds());
  }

  function decorate() {
    decorationQueued = false;
    const cards = [...list.querySelectorAll('.turn-achievement-card')];
    cards.forEach((card, index) => {
      const achievement = achievements.catalog[index];
      const isNew = Boolean(achievement && pendingIds.has(achievement.id));
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
    });
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
    queueDecoration();
  };
  window.addEventListener('turn:achievements-updated', handleAchievementUpdate);
  dialog.addEventListener('close', () => {
    pendingIds.clear();
  });

  dialog.dataset.turnUnreadMarkers = 'installed';
  const api = Object.freeze({
    snapshotUnseen,
    decorate,
    disconnect() {
      listObserver.disconnect();
      window.removeEventListener('turn:achievements-updated', handleAchievementUpdate);
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
