import * as base from './catalog-base.js?revision=r241-trophy-balance';
import {
  SCORING_MASTER_ACHIEVEMENT,
  TRACK_SCORING_ACHIEVEMENTS
} from './scoring-achievements.js?revision=r3-trophy-balance';
import {
  DRIVE_BY_EAR_ACHIEVEMENT_ID,
  DRIVE_BY_EAR_PART_IDS,
  HOW_TO_PLAY_DISCLOSURE_IDS,
  LEARN_TO_PLAY_ACHIEVEMENT_ID
} from './learning-progress.js?revision=r1-learning-achievements';
import {
  AUTHORED_DRIFT_ICON,
  AUTHORED_SAFETY_ICON
} from '../ui/authored-icons.js?revision=r245-shared-drift-safety-icons';

export const HEAD_START_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" aria-hidden="true">
  <g fill="currentColor" stroke="none">
    <!-- Flying car -->
    <g transform="rotate(24 400 300)">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="
          M 320 82
          H 480
          Q 520 82 520 122
          V 454
          Q 520 494 480 494
          H 320
          Q 280 494 280 454
          V 122
          Q 280 82 320 82
          Z

          M 326 142
          H 474
          Q 490 142 490 158
          V 220
          H 310
          V 158
          Q 310 142 326 142
          Z

          M 310 372
          H 490
          V 434
          Q 490 450 474 450
          H 326
          Q 310 450 310 434
          Z
        "
      />
    </g>

    <!-- Launch streaks -->
    <path d="M 290 500 L 332 520 L 268 636 Z" />
    <path d="M 386 520 L 430 542 L 362 650 Z" />

    <!-- Checkered finish -->
    <rect x="80" y="642" width="80" height="68" />
    <rect x="240" y="642" width="80" height="68" />
    <rect x="400" y="642" width="80" height="68" />
    <rect x="560" y="642" width="80" height="68" />
    <rect x="160" y="710" width="80" height="68" />
    <rect x="320" y="710" width="80" height="68" />
    <rect x="480" y="710" width="80" height="68" />
    <rect x="640" y="710" width="80" height="68" />
  </g>
</svg>`;

export const ICONS = Object.freeze({
  ...base.ICONS,
  drift: AUTHORED_DRIFT_ICON,
  safety: AUTHORED_SAFETY_ICON,
  headStart: HEAD_START_ICON
});

const DRIVE_BY_EAR_FAMILY_ICON = 'blind';
const DRIVE_BY_EAR_FAMILY_ACHIEVEMENT_IDS = Object.freeze([
  'trust-your-ears',
  'listen-closely',
  'beyond-sight'
]);

const CHROMATIC_CAMOUFLAGE = Object.freeze({
  id: 'chromatic-camouflage',
  category: base.CATEGORY.EXPLORATION,
  trophies: 50,
  hidden: true,
  title: 'CHROMATIC CAMOUFLAGE',
  description: 'Set your personal best on every track in a car painted to match that track.',
  icon: 'secret'
});

const MAYDAY = Object.freeze({
  id: 'golden-hour',
  category: base.CATEGORY.RACING,
  trophies: 100,
  hidden: true,
  lockedDescription: 'Hidden achievement. You’ll know what to do when the moment comes.',
  title: 'MAYDAY!',
  description: 'In the Ambulance, answer the Airport MAYDAY with sirens and deliver the patient to the terminal medical bay within 30 seconds.',
  icon: 'siren'
});

export const CATCH_THE_CHARGE_ACHIEVEMENT = Object.freeze({
  id: 'catch-the-charge',
  category: base.CATEGORY.ONBOARDING,
  trophies: 25,
  title: 'CATCH THE CHARGE',
  description: 'With BOOST full, keep using DRIFT to build purple OVERCHARGE. Slide to GAS to catch it before it leaks away.',
  icon: 'charge'
});

export const HEAD_START_ACHIEVEMENT = Object.freeze({
  id: 'head-start',
  category: base.CATEGORY.ONBOARDING,
  trophies: 50,
  title: 'HEAD START',
  description: 'Finish a valid lap with OVERCHARGE, then use that carried OVERCHARGE with BOOST to beat it on the next lap.',
  recommendation: 'Build OVERCHARGE before the line, catch it with GAS, then BOOST after crossing for a flying start.',
  icon: 'headStart'
});

export const GOT_STARTED_ACHIEVEMENT = Object.freeze({
  id: 'got-started',
  category: base.CATEGORY.ONBOARDING,
  trophies: 75,
  title: 'GOT STARTED',
  description: 'Finish all Getting Started achievements.',
  icon: 'trophy'
});

export const LEARN_TO_PLAY_ACHIEVEMENT = Object.freeze({
  id: LEARN_TO_PLAY_ACHIEVEMENT_ID,
  category: base.CATEGORY.WAYS_TO_PLAY,
  trophies: 50,
  title: 'LEARN TO PLAY',
  description: 'Read all parts of How to Play.',
  icon: 'map',
  progressMax: HOW_TO_PLAY_DISCLOSURE_IDS.length
});

export const DRIVE_BY_EAR_ACHIEVEMENT = Object.freeze({
  id: DRIVE_BY_EAR_ACHIEVEMENT_ID,
  category: base.CATEGORY.WAYS_TO_PLAY,
  trophies: 50,
  title: 'DRIVE BY EAR',
  description: 'Finish all five parts of Drive By Ear 101.',
  icon: DRIVE_BY_EAR_FAMILY_ICON,
  progressMax: DRIVE_BY_EAR_PART_IDS.length
});

export const ONBOARDING_ACHIEVEMENT_IDS = Object.freeze([
  ...base.ONBOARDING_ACHIEVEMENT_IDS,
  CATCH_THE_CHARGE_ACHIEVEMENT.id,
  HEAD_START_ACHIEVEMENT.id
]);

const SAFETY_TARGET_LABELS = Object.freeze({
  countryside: '15 seconds',
  airport: '20 seconds',
  cliffside: '20 seconds',
  harbor: '30 seconds',
  'midnight-city': '70 seconds',
  mountain: '70 seconds'
});

export const TRACK_WINNER_ACHIEVEMENTS = Object.freeze(
  base.TRACK_IDS.map((trackId) => Object.freeze({
    id: `${trackId}-winner`,
    category: base.CATEGORY.RACING,
    trophies: 50,
    title: `${base.TRACK_NAMES[trackId].toUpperCase()} WINNER`,
    description: `Finish first against four saved rivals on ${base.TRACK_NAMES[trackId]}.`,
    icon: 'rival'
  }))
);

export const TRACK_SAFETY_ACHIEVEMENTS = Object.freeze(
  base.TRACK_IDS.map((trackId) => Object.freeze({
    id: `${trackId}-safety`,
    category: base.CATEGORY.RACING,
    trophies: 75,
    title: `${base.TRACK_NAMES[trackId].toUpperCase()} SAFETY`,
    description: `Finish ${base.TRACK_NAMES[trackId]} without going off-road in under ${SAFETY_TARGET_LABELS[trackId]}.`,
    icon: 'safety'
  }))
);

const rebalancedBaseAchievements = base.ACHIEVEMENTS.map((achievement) => {
  if (DRIVE_BY_EAR_FAMILY_ACHIEVEMENT_IDS.includes(achievement.id)) {
    return Object.freeze({
      ...achievement,
      icon: DRIVE_BY_EAR_FAMILY_ICON
    });
  }
  if (achievement.id === 'around-the-turn') {
    return Object.freeze({
      ...achievement,
      icon: 'safety'
    });
  }
  if (achievement.id === 'on-course-of-course') {
    return Object.freeze({
      ...achievement,
      icon: 'safety',
      recommendation: 'Targets: Countryside < 15 seconds · Airport < 20 seconds · Cliffside < 20 seconds · Harbor < 30 seconds · Midnight City < 70 seconds · Mountain < 70 seconds'
    });
  }
  if (achievement.category !== base.CATEGORY.TIME_TRIALS) return achievement;
  return Object.freeze({
    ...achievement,
    trophies: achievement.id === 'faster-than-the-dev' ? 300 : 100,
    ...(achievement.id === 'faster-than-the-dev'
      ? { recommendation: 'A variety of cars were used to set the target times. Choosing the right car for each track matters.' }
      : {})
  });
});

const firstNonOnboardingIndex = rebalancedBaseAchievements.findIndex(
  (achievement) => achievement.category !== base.CATEGORY.ONBOARDING
);
const onboardingInsertionIndex = firstNonOnboardingIndex >= 0
  ? firstNonOnboardingIndex
  : rebalancedBaseAchievements.length;
const withGotStarted = [
  ...rebalancedBaseAchievements.slice(0, onboardingInsertionIndex),
  CATCH_THE_CHARGE_ACHIEVEMENT,
  HEAD_START_ACHIEVEMENT,
  GOT_STARTED_ACHIEVEMENT,
  LEARN_TO_PLAY_ACHIEVEMENT,
  DRIVE_BY_EAR_ACHIEVEMENT,
  ...rebalancedBaseAchievements.slice(onboardingInsertionIndex)
];

const expandedBaseAchievements = withGotStarted.flatMap((achievement) => {
  if (achievement.id === 'an-army-of-me') {
    return [...TRACK_WINNER_ACHIEVEMENTS, achievement];
  }
  if (achievement.id === 'on-course-of-course') {
    return [...TRACK_SAFETY_ACHIEVEMENTS, achievement];
  }
  return [achievement];
});

const firstTimeTrialIndex = expandedBaseAchievements.findIndex(
  (achievement) => achievement.category === base.CATEGORY.TIME_TRIALS
);
const insertionIndex = firstTimeTrialIndex >= 0
  ? firstTimeTrialIndex
  : expandedBaseAchievements.length;

export const ACHIEVEMENTS = Object.freeze([
  ...expandedBaseAchievements.slice(0, insertionIndex),
  MAYDAY,
  CHROMATIC_CAMOUFLAGE,
  ...TRACK_SCORING_ACHIEVEMENTS,
  SCORING_MASTER_ACHIEVEMENT,
  ...expandedBaseAchievements.slice(insertionIndex)
]);

export {
  SCORING_MASTER_ACHIEVEMENT,
  SCORING_MASTER_ACHIEVEMENT_ID,
  TRACK_SCORING_ACHIEVEMENTS,
  TRACK_SCORING_ACHIEVEMENT_IDS,
  completedAllScoringAchievements,
  qualifyingScoringAchievement
} from './scoring-achievements.js?revision=r3-trophy-balance';

export const VEHICLE_NAMES = Object.freeze({
  ...base.VEHICLE_NAMES,
  'toy-racer': 'Rally Racer'
});

const ACHIEVEMENT_BY_ID = new Map(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement])
);

export function getAchievement(id) {
  return ACHIEVEMENT_BY_ID.get(id) || null;
}

export * from './catalog-base.js?revision=r241-trophy-balance';