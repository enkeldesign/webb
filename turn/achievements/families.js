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
export function syncAchievementFamilies(list, { revealMatches = false } = {}) {
  for (const group of list.querySelectorAll('[data-achievement-family]')) {
    const master = group.querySelector(':scope > .turn-achievement-card');
    const children = group.querySelector(':scope > .turn-achievement-children');
    const button = group.querySelector('[data-achievement-disclosure]');
    const hasChildren = [...children.children].some((card) => !card.hidden);
    group.hidden = master.hidden && !hasChildren;
    children.hidden = !hasChildren || (!revealMatches && !master.hidden && button?.getAttribute('aria-expanded') === 'false');
    // NEW/track scopes show their exact matching cards. No collapsed disclosure
    // claims to hide children that the filter deliberately exposes.
    if (button) button.hidden = !hasChildren || revealMatches;
  }
}

// A completed collection's parts (#984): a quiet line at the foot of the master card,
// not a second card. "✓ 8 SPRINT  SHOW ⌄": what is there, then whether it shows.
// The underlined word carries the state; the chevron only supports it.
export function achievementFamilyDisclosureMarkup({ masterId, title, label, count, expanded, controls }) {
  return `<button type="button" class="turn-achievement-disclosure" data-achievement-disclosure="${masterId}" data-family-count="${count}" data-family-label="${label}" data-family-title="${title}" aria-expanded="${expanded}" aria-controls="${controls}" aria-label="${disclosureName(title, count, expanded)}">`
    + `<span class="turn-achievement-disclosure-parts"><span aria-hidden="true">✓</span> ${count} ${label}</span>`
    + `<span class="turn-achievement-disclosure-state">${expanded ? 'Hide' : 'Show'}</span>`
    + '<span class="turn-achievement-disclosure-chevron" aria-hidden="true"></span></button>';
}

function disclosureName(title, count, expanded) {
  return `${title}: ${expanded ? 'Hide' : 'Show'} ${count} completed achievements`;
}

export function setAchievementFamilyExpanded(button, expanded) {
  button.setAttribute('aria-expanded', String(expanded));
  const state = button.querySelector('.turn-achievement-disclosure-state');
  if (state) state.textContent = expanded ? 'Hide' : 'Show';
  button.setAttribute('aria-label', disclosureName(button.dataset.familyTitle, button.dataset.familyCount, expanded));
}

export function revealAchievementFamily(card) {
  const group = card.closest('[data-achievement-family]');
  const button = group?.querySelector('[data-achievement-disclosure]');
  if (!button) return;
  setAchievementFamilyExpanded(button, true);
  group.querySelector('.turn-achievement-children').hidden = false;
}
