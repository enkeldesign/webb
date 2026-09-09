// Production achievement presentation overlay for the authored track-icon pass.
// Requirements, trophy values and completion logic stay owned by the canonical
// production catalog; this layer changes only icon assignments.

import * as production from './catalog-production.js?revision=r241-learning-achievements-base';
import { TRACK_ICON_MARKUP } from '../ui/track-icons.js?revision=r1-track-reward-icons';

export * from './catalog-production.js?revision=r241-learning-achievements-base';

const TRACK_ICON_KEYS = Object.freeze(Object.fromEntries(
  production.TRACK_IDS.map((trackId) => [trackId, `track-${trackId}`])
));

export const ICONS = Object.freeze({
  ...production.ICONS,
  ...Object.fromEntries(
    Object.entries(TRACK_ICON_MARKUP).map(([trackId, markup]) => [TRACK_ICON_KEYS[trackId], markup])
  )
});

function presentationIcon(achievement) {
  if (achievement.id === 'charge-through-it') return 'drift';
  if (achievement.id === 'catch-the-charge') return 'safety';
  if (achievement.id === 'your-own-rival') return 'flag';
  if (achievement.id === 'an-army-of-me') return 'trophy';

  const winnerTrack = production.TRACK_IDS.find((trackId) => achievement.id === `${trackId}-winner`);
  if (winnerTrack) return TRACK_ICON_KEYS[winnerTrack];
  return achievement.icon;
}

function withPresentationIcon(achievement) {
  const icon = presentationIcon(achievement);
  return icon === achievement.icon
    ? achievement
    : Object.freeze({ ...achievement, icon });
}

export const TRACK_WINNER_ACHIEVEMENTS = Object.freeze(
  production.TRACK_WINNER_ACHIEVEMENTS.map(withPresentationIcon)
);

export const CATCH_THE_CHARGE_ACHIEVEMENT = withPresentationIcon(
  production.CATCH_THE_CHARGE_ACHIEVEMENT
);

export const ACHIEVEMENTS = Object.freeze(
  production.ACHIEVEMENTS.map(withPresentationIcon)
);

const achievementById = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));

export function getAchievement(id) {
  return achievementById.get(id) || null;
}
