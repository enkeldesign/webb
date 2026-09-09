// Trophy Road presentation overlay for the authored track icons.
// Progression thresholds and reward behavior remain in the canonical module.

import * as base from './trophy-road.js?revision=r253-supercar-release-base';
import { TRACK_ICON_MARKUP } from '../ui/track-icons.js?revision=r1-track-reward-icons';

export * from './trophy-road.js?revision=r253-supercar-release-base';

export const TROPHY_ROAD_REWARD_ICONS = Object.freeze({
  ...base.TROPHY_ROAD_REWARD_ICONS,
  skyline: TRACK_ICON_MARKUP['midnight-city'],
  mountain: TRACK_ICON_MARKUP.mountain
});
