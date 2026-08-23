import * as base from './catalog.js?revision=r166-chromatic-base';

const CHROMATIC_CAMOUFLAGE = Object.freeze({
  id: 'chromatic-camouflage',
  category: base.CATEGORY.EXPLORATION,
  trophies: 50,
  hidden: true,
  title: 'CHROMATIC CAMOUFLAGE',
  description: 'Set your personal best on every track in a car painted to match that track.',
  icon: 'secret'
});

const GOLDEN_HOUR = Object.freeze({
  id: 'golden-hour',
  category: base.CATEGORY.RACING,
  trophies: 100,
  hidden: true,
  lockedDescription: '',
  title: 'MAYDAY!',
  description: 'In the Ambulance, answer the Airport MAYDAY with sirens and deliver the patient to the terminal medical bay within 30 seconds.',
  icon: 'siren'
});

export const GOT_STARTED_ACHIEVEMENT = Object.freeze({
  id: 'got-started',
  category: base.CATEGORY.ONBOARDING,
  trophies: 75,
  title: 'GOT STARTED',
  description: 'Finish all Getting Started achievements.',
  icon: 'trophy'
});

const SAFETY_TARGET_LABELS = Object.freeze({
  countryside: '0:30',
  airport: '0:30',
  cliffside: '0:30',
  harbor: '1:00',
  'midnight-city': '2:00',
  mountain: '1:50'
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
  if (achievement.category !== base.CATEGORY.TIME_TRIALS) return achievement;
  return Object.freeze({
    ...achievement,
    trophies: achievement.id === 'faster-than-the-dev' ? 300 : 75
  });
});

const firstNonOnboardingIndex = rebalancedBaseAchievements.findIndex(
  (achievement) => achievement.category !== base.CATEGORY.ONBOARDING
);
const gotStartedInsertionIndex = firstNonOnboardingIndex >= 0
  ? firstNonOnboardingIndex
  : rebalancedBaseAchievements.length;
const withGotStarted = [
  ...rebalancedBaseAchievements.slice(0, gotStartedInsertionIndex),
  GOT_STARTED_ACHIEVEMENT,
  ...rebalancedBaseAchievements.slice(gotStartedInsertionIndex)
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
  GOLDEN_HOUR,
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

export * from './catalog.js?revision=r166-chromatic-base';
