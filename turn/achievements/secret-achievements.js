import { ACHIEVEMENTS, ICONS } from './catalog.js?revision=r181-hatchback-rally';
import { takePendingSecretAchievements } from './secret-events.js?revision=r174-bella-siren-zone';

const SAVE_BELLA_ID = 'save-bella';
const HIDDEN_BY_ID = new Map(
  ACHIEVEMENTS.filter((achievement) => achievement.hidden)
    .map((achievement) => [achievement.id, achievement])
);
const HIDDEN_BY_TITLE = new Map(
  [...HIDDEN_BY_ID.values()].map((achievement) => [achievement.title, achievement])
);

let installed = null;

function validSecretContext(achievementId, context = {}) {
  return achievementId !== SAVE_BELLA_ID || context.rescueConfirmed === true;
}

function decorateHiddenCards(achievements) {
  const dialog = achievements?.dialog;
  if (!dialog) return;

  for (const card of dialog.querySelectorAll('.turn-achievement-card')) {
    const title = card.querySelector('h4')?.textContent?.trim() || '';
    const achievement = HIDDEN_BY_TITLE.get(title);
    if (!achievement) continue;

    const unlocked = achievements.store?.isUnlocked?.(achievement.id) === true;
    card.classList.toggle('is-hidden-achievement', !unlocked);
    if (unlocked) continue;

    const description = card.querySelector('.turn-achievement-copy p');
    const icon = card.querySelector('.turn-achievement-icon');
    const lockedDescription = Object.hasOwn(achievement, 'lockedDescription')
      ? achievement.lockedDescription
      : 'Hidden achievement. The title is your clue.';
    if (description) {
      if (lockedDescription) description.textContent = lockedDescription;
      else description.remove();
    }
    if (icon && ICONS.secret) icon.innerHTML = ICONS.secret;
    card.querySelectorAll('.turn-achievement-copy small, .turn-achievement-progress').forEach((node) => node.remove());
  }
}

export function installSecretAchievements(achievements = globalThis.__turnAchievements) {
  if (installed) return installed;
  if (!achievements?.store || !achievements?.unlock || !achievements?.dialog) return null;

  const unlockId = (achievementId, context = {}) => {
    if (!validSecretContext(achievementId, context)) return false;
    if (!HIDDEN_BY_ID.has(achievementId) || achievements.store.isUnlocked(achievementId)) return false;
    achievements.unlock(achievementId, context);
    decorateHiddenCards(achievements);
    return true;
  };

  const handleSecret = (event) => {
    unlockId(event.detail?.achievementId, event.detail?.context || {});
  };
  globalThis.addEventListener?.('turn:secret-achievement', handleSecret);

  for (const pending of takePendingSecretAchievements()) {
    unlockId(pending.achievementId, pending.context);
  }

  const list = achievements.dialog.querySelector('.turn-achievements-list');
  const observer = typeof MutationObserver === 'function' && list
    ? new MutationObserver(() => decorateHiddenCards(achievements))
    : null;
  observer?.observe(list, { childList: true });
  decorateHiddenCards(achievements);

  installed = Object.freeze({
    unlock: unlockId,
    decorate: () => decorateHiddenCards(achievements),
    disconnect() {
      observer?.disconnect();
      globalThis.removeEventListener?.('turn:secret-achievement', handleSecret);
      installed = null;
    }
  });
  globalThis.__turnSecretAchievements = installed;
  return installed;
}
