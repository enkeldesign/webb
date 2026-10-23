import { getVehiclePerk } from '../vehicle/perks.js';

const RARITY_LABELS = Object.freeze({
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
  mythic: 'MYTHIC'
});

// What an achievement awards: trophies, or a collection master's PERK, which stays
// concealed until PERKULATOR (#1247).
export function achievementRewardText(achievement, { revealed = false, earned = false } = {}) {
  if (achievement.reward?.type !== 'perk') return `${achievement.trophies} trophies`;
  if (!revealed) return earned ? 'Collection reward earned · revealed with PERKULATOR' : 'Collection reward · revealed with PERKULATOR';
  const perk = getVehiclePerk(achievement.reward.perkId);
  return `REWARD: ${perk.title} · ${RARITY_LABELS[perk.rarity]} PERK${earned ? ' · Install in PERKULATOR' : ''}`;
}

// A PERK is a reward in its own right (#1274). It gets its own row on an ACHIEVEMENTS card:
// REWARD:, its rarity in words on its colour, its name, then where it goes. The row wraps
// rather than running on as one long line. Ordinary achievements return '' and keep their
// trophy count.
export function achievementRewardMarkup(achievement, { revealed = false, earned = false } = {}) {
  if (achievement.reward?.type !== 'perk') return '';
  const label = '<span class="turn-achievement-reward-label">REWARD:</span>';
  if (!revealed) {
    return `<p class="turn-achievement-reward is-concealed">${label} <span>${earned ? 'Earned' : 'Collection reward'}, revealed with PERKULATOR</span></p>`;
  }
  const perk = getVehiclePerk(achievement.reward.perkId);
  return `<p class="turn-achievement-reward">${label} <span class="turn-pr-chip is-${perk.rarity}"><span class="turn-sr-only">Rarity </span>${RARITY_LABELS[perk.rarity]}</span> <strong class="turn-achievement-reward-name">${perk.title}<span class="turn-sr-only"> perk</span></strong>${earned ? ' <span class="turn-achievement-reward-state">Install in PERKULATOR</span>' : ''}</p>`;
}
