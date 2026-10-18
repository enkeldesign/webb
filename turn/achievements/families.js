import { ACHIEVEMENT_FAMILIES } from './catalog.js';

// Render each family at its first catalog entry, master first. Keep every child:
// filtering/collapse changes visibility only, never achievement state or counts.
export function achievementGroups(achievements, families = ACHIEVEMENT_FAMILIES) {
  const byId = new Map(achievements.map((achievement) => [achievement.id, achievement]));
  const byMember = new Map();
  for (const family of families) {
    if (!byId.has(family.masterId)) continue;
    for (const id of [family.masterId, ...family.childIds]) byMember.set(id, family);
  }
  const rendered = new Set();
  const groups = [];
  for (const achievement of achievements) {
    const family = byMember.get(achievement.id);
    if (!family) {
      groups.push({ master: achievement, children: [], family: null });
    } else if (!rendered.has(family.masterId)) {
      rendered.add(family.masterId);
      groups.push({
        master: byId.get(family.masterId),
        children: family.childIds.map((id) => byId.get(id)).filter(Boolean),
        family
      });
    }
  }
  return groups;
}

export function completedAchievementFamily(family, isUnlocked) {
  return family.childIds.length > 0 && isUnlocked(family.masterId)
    && family.childIds.every((id) => isUnlocked(id));
}

// Filters own each card's hidden state. The disclosure owns only its child group,
// so filtering cannot accidentally reveal collapsed children. A track/NEW filter
// that excludes the master must still expose its matching children.
export function syncAchievementFamilies(list) {
  for (const group of list.querySelectorAll('[data-achievement-family]')) {
    const master = group.querySelector(':scope > .turn-achievement-card');
    const children = group.querySelector(':scope > .turn-achievement-children');
    const button = group.querySelector('[data-achievement-disclosure]');
    const hasChildren = [...children.children].some((card) => !card.hidden);
    group.hidden = master.hidden && !hasChildren;
    children.hidden = !hasChildren || (!master.hidden && button?.getAttribute('aria-expanded') === 'false');
    if (button) button.hidden = !hasChildren;
  }
}

export function setAchievementFamilyExpanded(button, expanded) {
  button.setAttribute('aria-expanded', String(expanded));
  button.textContent = `${button.dataset.familyCount} ${button.dataset.familyLabel} achievements · ${expanded ? 'HIDE' : 'SHOW'}`;
  button.setAttribute('aria-label', `${button.dataset.familyTitle}: ${expanded ? 'Hide' : 'Show'} ${button.dataset.familyCount} completed achievements`);
}

export function revealAchievementFamily(card) {
  const group = card.closest('[data-achievement-family]');
  const button = group?.querySelector('[data-achievement-disclosure]');
  if (!button) return;
  setAchievementFamilyExpanded(button, true);
  group.querySelector('.turn-achievement-children').hidden = false;
}
