export {
  ACHIEVEMENTS,
  ONBOARDING_ACHIEVEMENT_IDS
} from './achievements/catalog.js?revision=r181-hatchback-rally';
export {
  ACHIEVEMENT_STORAGE_KEY,
  loadAchievementState,
  normalizeAchievementState,
  totalAvailableTrophies
} from './achievements/store.js?revision=r164-perks';
export {
  TIME_TRIALS,
  TIME_TRIAL_ACHIEVEMENT_IDS,
  TIME_TRIAL_MASTER_ID,
  completedAllTimeTrials,
  qualifyingTimeTrial
} from './achievements/time-trials.js?revision=r166-bella-records';
export {
  CLEAN_LAP_TARGETS,
  CHALLENGE_PROGRESS_STORAGE_KEY,
  normalizeChallengeProgress,
  qualifiesForArmyLap,
  qualifiesForCleanLap,
  installAchievementChallengeExpansion
} from './achievements/challenge-expansion-r166.js?revision=r166-bella-records';
export {
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_MAX_THRESHOLD,
  isTrackUnlocked,
  isVehicleUnlocked,
  isPaintUnlocked,
  prepareTrophyRoadProfile
} from './progression/trophy-road-perks-r164.js?revision=r164-perks';
export { installAchievements } from './achievements/runtime.js?revision=r164-long-session-robustness';
