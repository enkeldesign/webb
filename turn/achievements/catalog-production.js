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

const AUTHORED_DRIFT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" aria-hidden="true">
  <path
    d="M 222 195 C 132 286, 63 409, 53 605"
    fill="none"
    stroke="currentColor"
    stroke-width="49"
    stroke-linecap="round"
  />

  <path
    d="M 398 266 C 326 346, 268 454, 258 598"
    fill="none"
    stroke="currentColor"
    stroke-width="49"
    stroke-linecap="round"
  />

  <path
    d="M 467 596
       C 475 504, 509 401, 571 321
       C 626 251, 700 198, 790 148"
    fill="none"
    stroke="currentColor"
    stroke-width="49"
    stroke-linecap="butt"
    stroke-dasharray="54 51"
  />

  <g transform="rotate(-15 371 169)">
    <rect
      x="183"
      y="62"
      width="384"
      height="215"
      rx="31"
      fill="currentColor"
    />

    <rect x="232" y="103" width="59" height="122" fill="transparent" />
    <rect x="464" y="103" width="44" height="122" fill="transparent" />
  </g>
</svg>`;

const AUTHORED_SAFETY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" aria-hidden="true">

  <!-- Left broken road edge -->
  <path
    d="
      M 142 150
      C 205 220, 225 318, 198 410
      C 166 518, 130 610, 122 714
    "
    fill="none"
    stroke="currentColor"
    stroke-width="58"
    stroke-linecap="butt"
    stroke-dasharray="78 62"
  />

  <!-- Right broken road edge -->
  <path
    d="
      M 605 104
      C 681 194, 708 301, 688 397
      C 663 505, 632 608, 636 710
    "
    fill="none"
    stroke="currentColor"
    stroke-width="58"
    stroke-linecap="butt"
    stroke-dasharray="78 62"
  />

  <!-- Left tyre trail -->
  <path
    d="
      M 365 368
      C 405 443, 412 512, 365 570
      C 310 637, 286 678, 282 724
    "
    fill="none"
    stroke="currentColor"
    stroke-width="58"
    stroke-linecap="round"
  />

  <!-- Right tyre trail -->
  <path
    d="
      M 455 348
      C 520 421, 540 504, 505 574
      C 469 645, 454 686, 453 722
    "
    fill="none"
    stroke="currentColor"
    stroke-width="58"
    stroke-linecap="round"
  />

<!-- Car -->
<g transform="rotate(-20 400 300)">

  <!-- Main body, with windows cut out -->
  <path
    d="
      M 335 155
      H 465
      Q 500 155 500 190
      V 405
      Q 500 440 465 440
      H 335
      Q 300 440 300 405
      V 190
      Q 300 155 335 155
      Z

      M 337 210
      H 463
      V 239
      H 337
      Z

      M 337 294
      H 463
      V 323
      H 337
      Z
    "
    fill="currentColor"
    fill-rule="evenodd"
    clip-rule="evenodd"
  />

</g>

</svg>`;

export const ICONS = Object.freeze({
  ...base.ICONS,
  drift: AUTHORED_DRIFT_ICON,
  safety: AUTHORED_SAFETY_ICON
});

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
  icon: 'listen',
  progressMax: DRIVE_BY_EAR_PART_IDS.length
});

export const ONBOARDING_ACHIEVEMENT_IDS = Object.freeze([
  ...base.ONBOARDING_ACHIEVEMENT_IDS,
  CATCH_THE_CHARGE_ACHIEVEMENT.id
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
  if (achievement.id === 'around-the-turn') {
    return Object.freeze({
      ...achievement,
      icon: 'safety'
    });
  }
  if (achievement.id === 'on-course-of-course') {
    return Object.freeze({
      ...achievement,
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