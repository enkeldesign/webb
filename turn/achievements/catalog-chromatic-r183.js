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

const firstTimeTrialIndex = base.ACHIEVEMENTS.findIndex(
  (achievement) => achievement.category === base.CATEGORY.TIME_TRIALS
);
const insertionIndex = firstTimeTrialIndex >= 0 ? firstTimeTrialIndex : base.ACHIEVEMENTS.length;

export const ACHIEVEMENTS = Object.freeze([
  ...base.ACHIEVEMENTS.slice(0, insertionIndex),
  GOLDEN_HOUR,
  CHROMATIC_CAMOUFLAGE,
  ...base.ACHIEVEMENTS.slice(insertionIndex)
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
