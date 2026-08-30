import * as base from './catalog-base.js?revision=r222-awd-label';

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
  mountain: '40 seconds'
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
    trophies: 50,
    title: `${base.TRACK_NAMES[trackId].toUpperCase()} SAFETY`,
    description: `Finish ${base.TRACK_NAMES[trackId]} without going off-road in under ${SAFETY_TARGET_LABELS[trackId]}.`,
    icon: 'route'
  }))
);

const rebalancedBaseAchievements = base.ACHIEVEMENTS.map((achievement) => {
  if (achievement.id === 'on-course-of-course') {
    return Object.freeze({
      ...achievement,
      recommendation: 'Targets: Countryside < 15 seconds · Airport < 20 seconds · Cliffside < 20 seconds · Harbor < 30 seconds · Midnight City < 70 seconds · Mountain < 40 seconds'
    });
  }
  if (achievement.category !== base.CATEGORY.TIME_TRIALS) return achievement;
  return Object.freeze({
    ...achievement,
    trophies: achievement.id === 'faster-than-the-dev' ? 300 : 75,
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
  ...expandedBaseAchievements.slice(insertionIndex)
]);

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

export * from './catalog-base.js?revision=r222-awd-label';
