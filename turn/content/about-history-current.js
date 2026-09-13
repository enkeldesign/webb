import {
  CHANGELOG as BASE_CHANGELOG,
  DEVELOPMENT_HISTORY as BASE_DEVELOPMENT_HISTORY
} from './about-history.js';

const PERK_HISTORY = Object.freeze({
  period: '12 September',
  title: 'PERK gets one visual language',
  paragraphs: Object.freeze([
    'TURN 1.19.3 replaces the generic lightning-bolt PERK reward symbol with one authored circuit-board icon. The same transparent vector now identifies independent vehicle perks on Trophy Road, in reward information and inside The Lot, so progression and vehicle information use one consistent visual language.',
    'The artwork is kept as one canonical currentColor SVG source and remains decorative where adjacent text already identifies the perk. Release routing gives the changed Trophy Road presentation and Lot enhancement code a fresh r217 build identity without adding another manual revision namespace.'
  ]),
  milestones: Object.freeze([
    'One authored circuit-board PERK icon across Trophy Road and reward details',
    'The same icon in The Lot perk information',
    'TURN 1.19.3 · 2026.09.12-r217'
  ])
});

const PERK_CHANGELOG_ENTRIES = Object.freeze([
  Object.freeze(['1.19.3 r217', 'Replaces the generic PERK lightning bolt with the authored circuit-board icon across Trophy Road reward surfaces and The Lot perk information.']),
  Object.freeze(['Shared PERK artwork', 'Uses one transparent currentColor SVG source for progression and vehicle information, with decorative instances hidden from accessibility APIs when adjacent text already names the perk.']),
  Object.freeze(['Release identity', 'Publishes the changed Trophy Road presentation and Lot enhancement through build 2026.09.12-r217 without introducing a new manual revision identifier.'])
]);

const RELIABILITY_HISTORY = Object.freeze({
  period: '12 September',
  title: 'Records stay put and The Lot recovers',
  paragraphs: Object.freeze([
    'TURN 1.19.4 keeps a newly earned personal best when a track is reopened quickly, and prevents a delayed save from bringing back rivals after a reset. Interrupted saves retain the latest replay and receive a limited set of retries.',
    'The Lot can retry interrupted loading when you continue from Home. Its interface finishes preparing before car selection opens, while successful preparation remains available for a quick return.'
  ]),
  milestones: Object.freeze([
    'Consistent personal bests through quick track changes and resets',
    'Recoverable interrupted saves and Lot preparation',
    'TURN 1.19.4 · 2026.09.12-r218'
  ])
});

const RELIABILITY_CHANGELOG_ENTRIES = Object.freeze([
  Object.freeze(['1.19.4 r218', 'Keeps fresh personal bests through quick track reopening, prevents delayed saves from undoing resets, and retries interrupted saves.']),
  Object.freeze(['The Lot recovery', 'Retries interrupted module and stylesheet loading without requiring a restart, while preserving the quick prepared entry path.'])
]);

const SCORE_HISTORY = Object.freeze({
  period: '13 September',
  title: 'Less saving work at the finish line',
  paragraphs: Object.freeze([
    'TURN 1.19.5 makes new DRIFT and FLOW bests available immediately to the race and Home records, then saves them after the busy finish-line work. Reading the six track cards reuses the same score records.',
    'Interrupted saves keep their latest records for a limited set of retries. Score stores reconcile updates from other tabs and respect resets while a save is pending.'
  ]),
  milestones: Object.freeze([
    'Shared DRIFT and FLOW records across Home, race feedback and achievements',
    'Deferred score saving with reset and retry protection',
    'TURN 1.19.5 · 2026.09.13-r219'
  ])
});

const previousLatest = BASE_CHANGELOG.at(-1);
const mergedLatest = previousLatest?.date === '12 September'
  ? Object.freeze({
      ...previousLatest,
      entries: Object.freeze([...previousLatest.entries, ...PERK_CHANGELOG_ENTRIES, ...RELIABILITY_CHANGELOG_ENTRIES])
    })
  : Object.freeze({
      date: '12 September',
      entries: Object.freeze([...PERK_CHANGELOG_ENTRIES, ...RELIABILITY_CHANGELOG_ENTRIES])
    });

export const DEVELOPMENT_HISTORY = Object.freeze([
  ...BASE_DEVELOPMENT_HISTORY,
  PERK_HISTORY,
  RELIABILITY_HISTORY,
  SCORE_HISTORY
]);

export const CHANGELOG = Object.freeze([
  ...(previousLatest?.date === '12 September' ? BASE_CHANGELOG.slice(0, -1) : BASE_CHANGELOG),
  mergedLatest,
  Object.freeze({
    date: '13 September',
    entries: Object.freeze([
      Object.freeze(['1.19.5 r219', 'Reduces repeated score-storage work at the finish line and on Home while keeping new DRIFT and FLOW bests immediately available.']),
      Object.freeze(['Record recovery', 'Preserves pending score records through interrupted saves and reconciles other-tab updates and resets.'])
    ])
  })
]);

export const CURRENT_RELEASE = Object.freeze({
  version: '1.19.5',
  build: '2026.09.13-r219',
  note: 'TURN 1.19.5 reduces score-saving work at the finish line and repeated record loading on Home.'
});
