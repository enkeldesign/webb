import { getVehiclePerk } from '../vehicle/perks.js';

export function achievementRewardText(achievement, { revealed = false, earned = false } = {}) {
  if (achievement.reward?.type !== 'perk') return `${achievement.trophies} trophies`;
  if (!revealed) return earned ? 'Collection reward earned · revealed with PERKULATOR' : 'Collection reward · revealed with PERKULATOR';
  const perk = getVehiclePerk(achievement.reward.perkId);
  return `PERK: ${perk.title}${earned ? ' · Install in PERKULATOR' : ''}`;
}
