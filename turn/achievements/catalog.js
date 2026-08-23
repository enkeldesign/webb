import {
  TIME_TRIALS,
  TIME_TRIAL_ACHIEVEMENT_IDS
} from './time-trials.js?revision=r166-bella-records';
import { SECRET_ACHIEVEMENTS } from './secret-catalog.js?revision=r181-hatchback-rally';

export const TRACK_IDS = Object.freeze([
  'countryside',
  'airport',
  'cliffside',
  'harbor',
  'midnight-city',
  'mountain'
]);

export const TRAINING_CAR_ID = 'classic';
export const POLICE_CAR_ID = 'police';
export const MIDNIGHT_CITY_ID = 'midnight-city';

export const CATEGORY = Object.freeze({
  ONBOARDING: 'onboarding',
  WAYS_TO_PLAY: 'ways-to-play',
  EXPLORATION: 'exploration',
  RACING: 'racing',
  TIME_TRIALS: 'time-trials'
});

export const CATEGORY_LABELS = Object.freeze({
  [CATEGORY.ONBOARDING]: 'Getting started',
  [CATEGORY.WAYS_TO_PLAY]: 'Ways to play',
  [CATEGORY.EXPLORATION]: 'Exploration',
  [CATEGORY.RACING]: 'Racing',
  [CATEGORY.TIME_TRIALS]: 'Time trials'
});

export const TRACK_NAMES = Object.freeze({
  countryside: 'Countryside',
  airport: 'Airport',
  cliffside: 'Cliffside',
  harbor: 'Harbor',
  'midnight-city': 'Midnight City',
  mountain: 'Mountain'
});

export const VEHICLE_NAMES = Object.freeze({
  convertible: 'Convertible',
  classic: 'Training Car',
  'vintage-racer': 'Vintage Racer',
  'toy-racer': 'Rally Racer',
  'monster-truck': 'Monster Truck',
  'race-future': 'Future Racer',
  race: 'Race Car',
  'sedan-sports': 'Hatchback',
  sedan: 'Sedan',
  suv: 'SUV',
  firetruck: 'Fire Truck',
  police: 'Police Car',
  ambulance: 'Ambulance',
  truck: 'Truck',
  van: 'Van'
});

export const ICONS = Object.freeze({
  flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4"></path><path d="M6 5h11l-2.5 3L17 11H6"></path><path d="M3 21h6"></path></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M4 9V4l4 3"></path><path d="M5 7a8 8 0 1 1-1 8"></path><path d="M12 8v5l3 2"></path></svg>',
  charge: '<svg viewBox="0 0 24 24"><path d="M7 4h8v16H7Z"></path><path d="M9 2h4"></path><path d="m13 7-3 5h3l-2 5"></path><path d="M18 9c2 1 3 3 3 5"></path></svg>',
  wind: '<svg viewBox="0 0 24 24"><path d="M4 8h10c3 0 3-4 0-4-2 0-2 2-2 2"></path><path d="M3 12h14c4 0 4 6 0 6-2 0-3-2-2-3"></path><path d="M5 16h6"></path></svg>',
  flow: '<svg viewBox="0 0 24 24"><path d="M3 12c3-6 6-6 9 0s6 6 9 0c-3-6-6-6-9 0s-6 6-9 0Z"></path></svg>',
  spectate: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"></path><circle cx="12" cy="12" r="2.5"></circle><path d="m17 17 4 4"></path></svg>',
  rival: '<svg viewBox="0 0 24 24"><path d="M3 15h8l2-5h5l3 5v4h-2"></path><path d="M5 19H3v-4"></path><circle cx="7" cy="19" r="2"></circle><circle cx="17" cy="19" r="2"></circle><path d="M4 10h6l1-3h4"></path></svg>',
  level: '<svg viewBox="0 0 24 24"><path d="M3 8h18v8H3Z"></path><circle cx="12" cy="12" r="2"></circle><path d="M6 12h2M16 12h2"></path></svg>',
  wheel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3"></circle><path d="M12 3v6M4.2 8.2l5.2 3M19.8 8.2l-5.2 3M7 19l3-5.2M17 19l-3-5.2"></path></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"></path><path d="M9 3v15M15 6v15"></path></svg>',
  blind: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"></path><circle cx="12" cy="12" r="2.5"></circle><path d="M4 4l16 16"></path></svg>',
  listen: '<svg viewBox="0 0 24 24"><path d="M15.5 16.5c0 3-1.7 5-4.5 5-2.4 0-4-1.6-4-4V9a5 5 0 0 1 10 0c0 2.4-1.2 3.8-3.3 5.1-1.1.7-1.7 1.5-1.7 2.9"></path><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.2-.6 1.9-1.8 2.7"></path><path d="M19 7c1 1.3 1.5 2.7 1.5 4.5"></path></svg>',
  blindRoute: '<svg viewBox="0 0 24 24"><circle cx="5" cy="18" r="2"></circle><circle cx="19" cy="6" r="2"></circle><path d="M7 18h3c3 0 3-5 6-5h1M17 6h-3c-3 0-3 4-6 4H5"></path><path d="M4 4l16 16"></path></svg>',
  route: '<svg viewBox="0 0 24 24"><circle cx="5" cy="18" r="2"></circle><circle cx="19" cy="6" r="2"></circle><path d="M7 18h3c3 0 3-5 6-5h1M17 6h-3c-3 0-3 4-6 4H5"></path></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M7 4h10v4c0 4-2 7-5 8-3-1-5-4-5-8V4Z"></path><path d="M7 6H4v2c0 2 1 3 4 4M17 6h3v2c0 2-1 3-4 4M9 20h6M12 16v4"></path></svg>',
  siren: '<svg viewBox="0 0 24 24"><path d="M7 16v-5a5 5 0 0 1 10 0v5"></path><path d="M5 16h14v4H5Z"></path><path d="M12 2v3M4.5 5.5l2 2M19.5 5.5l-2 2M2 12h3M19 12h3"></path></svg>',
  stopwatch: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"></circle><path d="M9 2h6M12 5V2M18 7l2-2M12 13l3-3"></path></svg>',
  cat: '<svg viewBox="0 0 24 24"><path d="M7 8 5 3l5 3h4l5-3-2 5c1.3 1.2 2 2.8 2 4.8A7 7 0 0 1 12 20a7 7 0 0 1-7-7.2C5 10.8 5.7 9.2 7 8Z"></path><path d="M9 12h.01M15 12h.01M10 15c1.3 1 2.7 1 4 0M4 17c-1 0-2 .5-2 1.5M20 17c1 0 2 .5 2 1.5"></path></svg>',
  secret: '<svg viewBox="0 0 24 24"><path d="M9.2 9a3 3 0 1 1 4.9 2.3c-1.4 1-2.1 1.7-2.1 3.2"></path><path d="M12 18h.01"></path><circle cx="12" cy="12" r="9"></circle></svg>'
});

export const ACHIEVEMENTS = Object.freeze([
  Object.freeze({ id: 'first-turn', category: CATEGORY.ONBOARDING, trophies: 25, title: 'FIRST TURN', description: 'Finish any valid lap.', icon: 'flag' }),
  Object.freeze({ id: 'take-it-from-the-top', category: CATEGORY.ONBOARDING, trophies: 25, title: 'TAKE IT FROM THE TOP', description: 'Use Restart Lap after the current lap becomes void.', icon: 'restart' }),
  Object.freeze({ id: 'charge-through-it', category: CATEGORY.ONBOARDING, trophies: 25, title: 'CHARGE THROUGH IT', description: 'Recharge at least 25% of the Boost meter while drifting in one lap.', icon: 'charge', progressMax: 25 }),
  Object.freeze({ id: 'second-wind', category: CATEGORY.ONBOARDING, trophies: 25, title: 'SECOND WIND', description: 'Run Boost empty, let it recharge, then activate Boost again.', icon: 'wind' }),
  Object.freeze({ id: 'flow-state', category: CATEGORY.ONBOARDING, trophies: 50, title: 'FLOW STATE', description: 'Finish a valid lap using only Drift and Boost for forward drive.', recommendation: 'Recommended: Training Car · Countryside', icon: 'flow' }),
  Object.freeze({ id: 'watch-and-learn', category: CATEGORY.ONBOARDING, trophies: 25, title: 'WATCH AND LEARN', description: 'Spectate a rival for five seconds, then return to the start.', icon: 'spectate', progressMax: 5 }),
  Object.freeze({ id: 'your-own-rival', category: CATEGORY.ONBOARDING, trophies: 25, title: 'YOUR OWN RIVAL', description: 'Finish a valid lap with one of your saved rivals on the track.', icon: 'rival' }),
  Object.freeze({ id: 'level-head', category: CATEGORY.ONBOARDING, trophies: 25, title: 'LEVEL HEAD', description: 'Recalibrate, then finish a valid lap.', icon: 'level' }),
  Object.freeze({ id: 'new-wheels', category: CATEGORY.ONBOARDING, trophies: 25, title: 'NEW WHEELS', description: 'Finish a valid lap with a vehicle other than the Training Car.', icon: 'wheel' }),
  Object.freeze({ id: 'new-ground', category: CATEGORY.ONBOARDING, trophies: 25, title: 'NEW GROUND', description: 'Finish valid laps on two different tracks.', icon: 'map', progressMax: 2 }),
  Object.freeze({ id: 'trust-your-ears', category: CATEGORY.WAYS_TO_PLAY, trophies: 200, title: 'TRUST YOUR EARS', description: 'Finish a valid lap with Blank screen mode on from start to finish.', icon: 'blind' }),
  Object.freeze({ id: 'listen-closely', category: CATEGORY.WAYS_TO_PLAY, trophies: 50, title: 'LISTEN CLOSELY', description: 'Set Sound balance to at least 75% Drive By Ear, then drive for ten seconds with Blank screen mode on.', recommendation: 'Recommended for non-visual driving: 90% Drive By Ear', icon: 'listen', progressMax: 10 }),
  Object.freeze({ id: 'beyond-sight', category: CATEGORY.WAYS_TO_PLAY, trophies: 300, title: 'BEYOND SIGHT', description: 'Finish a valid lap on every track with Blank screen mode on from start to finish.', icon: 'blindRoute', progressMax: TRACK_IDS.length }),
  Object.freeze({ id: 'around-the-turn', category: CATEGORY.EXPLORATION, trophies: 100, title: 'AROUND THE TURN', description: 'Finish a valid lap on every track.', icon: 'route', progressMax: TRACK_IDS.length }),
  Object.freeze({ id: 'ahead-of-yourself', category: CATEGORY.RACING, trophies: 50, title: 'AHEAD OF YOURSELF', description: 'Finish first in a lap with at least one saved rival.', icon: 'trophy' }),
  Object.freeze({ id: 'night-shift-sheriff', category: CATEGORY.RACING, trophies: 100, title: 'NIGHT SHIFT SHERIFF', description: 'In Midnight City, use the Police Car to beat four non-police rivals. Overtake each one while Boost is active.', icon: 'siren', progressMax: 4 }),
  Object.freeze({ id: 'an-army-of-me', category: CATEGORY.RACING, trophies: 200, title: 'AN ARMY OF ME', description: 'Finish first against four saved rivals on every track.', icon: 'rival' }),
  Object.freeze({ id: 'on-course-of-course', category: CATEGORY.RACING, trophies: 100, title: 'ON COURSE, OF COURSE', description: 'Finish every track without going off-road and within its clean-lap target.', recommendation: 'Targets: Countryside, Airport and Cliffside < 0:30 · Harbor < 1:00 · Mountain < 1:50 · Midnight City < 2:00', icon: 'route' }),
  ...SECRET_ACHIEVEMENTS,
  ...TIME_TRIALS.map((trial) => Object.freeze({
    id: trial.id,
    category: CATEGORY.TIME_TRIALS,
    trophies: 25,
    title: trial.title,
    description: trial.description,
    recommendation: 'Recommended: Future Racer',
    icon: 'stopwatch'
  })),
  Object.freeze({
    id: 'faster-than-the-dev',
    category: CATEGORY.TIME_TRIALS,
    trophies: 100,
    title: 'FASTER THAN THE DEV',
    description: 'Beat every developer target time.',
    recommendation: 'The target times were set with the Future Racer.',
    icon: 'trophy',
    progressMax: TIME_TRIAL_ACHIEVEMENT_IDS.length
  })
]);

export const ONBOARDING_ACHIEVEMENT_IDS = Object.freeze(
  ACHIEVEMENTS
    .filter((achievement) => achievement.category === CATEGORY.ONBOARDING)
    .map((achievement) => achievement.id)
);

const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));

export function getAchievement(id) {
  return ACHIEVEMENT_BY_ID.get(id) || null;
}
