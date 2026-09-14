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

const VISUAL_HISTORY = Object.freeze({
  period: '13 September',
  title: 'Car previews clean up after themselves',
  paragraphs: Object.freeze([
    'TURN 1.19.6 releases discarded car models and previews when you change selection or leave a preview. Shared resources stay available to cars still in use, including prepared rivals.',
    'Quick car changes keep the latest selection even when an older model finishes loading later. Preview cleanup also covers interrupted loading in CHASE YOUR BEST, Home, The Lot and Trophy Road.'
  ]),
  milestones: Object.freeze([
    'Cleanup for discarded cars and closed previews',
    'Latest car selection wins during overlapping loads',
    'TURN 1.19.6 · 2026.09.13-r220'
  ])
});

const LOW_GRAPHICS_HISTORY = Object.freeze({
  period: '13 September',
  title: 'LOW GRAPHICS for older devices',
  paragraphs: Object.freeze([
    'TURN 1.19.7 adds a saved LOW GRAPHICS option in Settings. After restart it caps rendering at DPR 1.0, disables antialiasing and shadow rendering, removes real point-light contribution and suppresses outline draw calls across the race and secondary 3D previews.',
    'Countryside also skips its deferred world-beauty and art passes in LOW GRAPHICS while retaining track identity, Drive By Ear discovery content and gameplay-critical world structure. Visible lamps, emissive surfaces and the shared shadowless night headlight remain available as cues.'
  ]),
  milestones: Object.freeze([
    'One LOW GRAPHICS profile across race, The Lot, Home previews, Trophy Road and rival previews',
    'DPR 1.0, no antialiasing or shadows, fewer real lights and outline draw calls',
    'TURN 1.19.7 · 2026.09.13-r221'
  ])
});

const LOW_GRAPHICS_TUNING_HISTORY = Object.freeze({
  period: '13 September',
  title: 'LOW GRAPHICS keeps the smooth edges and full countryside',
  paragraphs: Object.freeze([
    'TURN 1.19.8 tunes LOW GRAPHICS after device testing. Antialiasing stays enabled, and Countryside once again loads its deferred world-beauty, art and extra scenery passes while the mode keeps its DPR 1.0 cap, disabled shadows, reduced real lights and suppressed outline draw calls.',
    'This keeps the strongest visual-quality wins that proved worthwhile in testing without giving up the lower-resolution, shadowless rendering profile aimed at older devices.'
  ]),
  milestones: Object.freeze([
    'Antialiasing remains enabled in LOW GRAPHICS',
    'Full Countryside world-beauty, art and extra scenery restored',
    'TURN 1.19.8 · 2026.09.13-r222'
  ])
});

const LOW_GRAPHICS_RENDER_ONLY_HISTORY = Object.freeze({
  period: '13 September',
  title: 'LOW GRAPHICS changes rendering, not the world',
  paragraphs: Object.freeze([
    'TURN 1.19.9 makes LOW GRAPHICS a rendering-cost profile only. The same track scenery, world-beauty and art passes run in both graphics modes; antialiasing also remains enabled.',
    'The low profile keeps DPR capped at 1.0, disables shadow rendering, avoids constructing TURN contour meshes at their producers, and reduces real point-light illumination while leaving visible lamps, emissive surfaces and halos intact.'
  ]),
  milestones: Object.freeze([
    'World content identical between normal and LOW GRAPHICS',
    'Contours skipped before mesh construction instead of hidden afterwards',
    'TURN 1.19.9 · 2026.09.13-r223'
  ])
});


const MOUNTAIN_WARNING_HISTORY = Object.freeze({
  period: '13 September',
  title: 'A warning before the MOUNTAIN plunge',
  paragraphs: Object.freeze([
    'TURN 1.19.10 restores a strong visual timing landmark before MOUNTAIN’s technical downhill slalom. A large yellow triangular warning sign now stands on the north/outside shoulder where the earlier tree used to help drivers judge the plunge.',
    'The sign is authored from lightweight TURN geometry with its own black border and exclamation mark, faces the approaching driver, has no collision role and does not require another downloaded scenery asset.'
  ]),
  milestones: Object.freeze([
    'Readable warning landmark before the downhill slalom',
    'Authored low-poly sign with no extra asset download or collision',
    'TURN 1.19.10 · 2026.09.13-r224'
  ])
});

const MOUNTAIN_WARNING_PLACEMENT_HISTORY = Object.freeze({
  period: '13 September',
  title: 'The MOUNTAIN warning returns to the old sightline',
  paragraphs: Object.freeze([
    'TURN 1.19.11 moves the MOUNTAIN warning landmark up to the broad summit bend where the old tree was actually used as a planning cue. Drivers can now see it before committing to the plunge rather than only after reaching the slalom entry.',
    'This is a world-placement correction only: the minimap is unchanged, the sign remains visual-only, and the lightweight authored sign geometry is otherwise unchanged.'
  ]),
  milestones: Object.freeze([
    'Warning landmark moved to the broad summit bend before the plunge',
    'No minimap marker or gameplay collision added',
    'TURN 1.19.11 · 2026.09.13-r225'
  ])
});

const MOUNTAIN_WARNING_READABILITY_HISTORY = Object.freeze({
  period: '14 September',
  title: 'The MOUNTAIN warning reads clearly',
  paragraphs: Object.freeze([
    'TURN 1.19.12 raises the summit warning plate slightly while keeping its road position exactly where drivers tested it.',
    'The support now stays behind the plate, and the front graphic uses a tapered bar with a separate round dot so the symbol reads unmistakably as an exclamation mark.'
  ]),
  milestones: Object.freeze([
    'Slightly higher warning plate at the same summit landmark',
    'Clear exclamation mark separated from the support post',
    'TURN 1.19.12 · 2026.09.14-r226'
  ])
});

const HEAD_START_HISTORY = Object.freeze({
  period: '14 September',
  title: 'HEAD START teaches the flying lap',
  paragraphs: Object.freeze([
    'TURN 1.19.13 adds HEAD START to Getting Started. It awards 50 trophies for beating the previous valid lap while crossing the line with OVERCHARGE built up.',
    'The lesson encourages drivers to keep racing through start/finish and prepare the next lap with momentum and charge before taking on Time Trial targets set for flying starts.'
  ]),
  milestones: Object.freeze([
    '50-trophy HEAD START lesson in Getting Started',
    'Faster consecutive valid lap with OVERCHARGE at the line',
    'TURN 1.19.13 · 2026.09.14-r228'
  ])
});

const HEAD_START_FLYING_LAP_HISTORY = Object.freeze({
  period: '14 September',
  title: 'HEAD START rewards the flying lap',
  paragraphs: Object.freeze([
    'TURN 1.19.14 corrects HEAD START so its setup and payoff happen on consecutive laps. The first valid lap must cross with OVERCHARGE remaining; the next valid lap must actually spend carried OVERCHARGE with BOOST and beat the setup time.',
    'An invalid next lap breaks the attempt. The lesson now directly teaches the build-up lap and flying-start technique used to reach Time Trial targets.'
  ]),
  milestones: Object.freeze([
    'Setup lap crosses with OVERCHARGE greater than zero',
    'Next lap spends carried OVERCHARGE with BOOST and beats the setup lap',
    'TURN 1.19.14 · 2026.09.14-r229'
  ])
});


const HEAD_START_ICON_HISTORY = Object.freeze({
  period: '14 September',
  title: 'HEAD START gets its own flying-start symbol',
  paragraphs: Object.freeze([
    'TURN 1.19.14 gives HEAD START a dedicated monochrome icon based on the supplied sketch: a tilted top-down car launching over a checkered finish line.',
    'Only the pictogram changes. The existing achievement icon box, locked/unlocked styling and surrounding card design remain owned by TURN.'
  ]),
  milestones: Object.freeze([
    'Tilted top-down car with two launch streaks',
    'Two-row checkered finish motif inside the existing achievement icon box',
    'TURN 1.19.14 · 2026.09.14-r230'
  ])
});


const OVERCHARGED_BOOST_HISTORY = Object.freeze({
  period: '14 September',
  title: 'OVERCHARGE hits harder',
  paragraphs: Object.freeze([
    'TURN 1.19.15 makes the OVERCHARGE portion of BOOST deliver 20% more boost thrust. The stronger acceleration lasts only while saved OVERCHARGE is being consumed; normal BOOST immediately returns to ordinary power.',
    'The boosted speed ceiling is unchanged, so OVERCHARGE improves the launch and corner-exit kick without raising normal BOOST top speed. Vehicle perks that react to OVERCHARGE continue to layer on top of the stronger shared burst.'
  ]),
  milestones: Object.freeze([
    '20% more boost thrust while OVERCHARGE is being consumed',
    'Normal BOOST power and boosted top-speed ceiling remain unchanged',
    'TURN 1.19.15 · 2026.09.14-r231'
  ])
});

const SUPPORT_CHALLENGE_HISTORY = Object.freeze({
  period: '14 September',
  title: 'Trophy Road offers a hand when progress stalls',
  paragraphs: Object.freeze([
    'TURN 1.20.0 adds support challenges after six valid laps without earning trophies. It prioritises remaining WINNER opportunities when four saved rivals are available, then HOW TO PLAY, SAFETY and—once unlocked—DRIFT.',
    'The challenge rules live in turn/support-challenges.json: thresholds, rewards, easier support targets and recommended cars can be tuned as data. Bonus trophies advance Trophy Road without creating extra achievements.'
  ]),
  milestones: Object.freeze([
    'Contextual WINNER and SAFETY challenges, plus DRIFT after DRIFT ATTACK unlocks',
    'DID YOU READ ALL OF IT? pays 5 trophies for each previously unread HOW TO PLAY part',
    'TURN 1.20.0 · 2026.09.14-r232'
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
  SCORE_HISTORY,
  VISUAL_HISTORY,
  LOW_GRAPHICS_HISTORY,
  LOW_GRAPHICS_TUNING_HISTORY,
  LOW_GRAPHICS_RENDER_ONLY_HISTORY,
  MOUNTAIN_WARNING_HISTORY,
  MOUNTAIN_WARNING_PLACEMENT_HISTORY,
  MOUNTAIN_WARNING_READABILITY_HISTORY,
  HEAD_START_HISTORY,
  HEAD_START_FLYING_LAP_HISTORY,
  HEAD_START_ICON_HISTORY,
  OVERCHARGED_BOOST_HISTORY,
  SUPPORT_CHALLENGE_HISTORY
]);

export const CHANGELOG = Object.freeze([
  ...(previousLatest?.date === '12 September' ? BASE_CHANGELOG.slice(0, -1) : BASE_CHANGELOG),
  mergedLatest,
  Object.freeze({
    date: '13 September',
    entries: Object.freeze([
      Object.freeze(['1.19.5 r219', 'Reduces repeated score-storage work at the finish line and on Home while keeping new DRIFT and FLOW bests immediately available.']),
      Object.freeze(['Record recovery', 'Preserves pending score records through interrupted saves and reconciles other-tab updates and resets.']),
      Object.freeze(['1.19.6 r220', 'Releases discarded car models and closed previews while preserving resources shared by cars still in use.']),
      Object.freeze(['Quick car changes', 'Keeps the latest car selection when earlier model loads finish late, and cleans up previews after interrupted loading.']),
      Object.freeze(['1.19.7 r221', 'Adds LOW GRAPHICS for older devices with DPR 1.0, no antialiasing or shadows, fewer real lights, suppressed outlines and reduced cosmetic scenery.']),
      Object.freeze(['One graphics profile', 'Applies the same low profile to the race renderer and TURN secondary WebGL previews after a restart.']),
      Object.freeze(['1.19.8 r222', 'Keeps antialiasing and the full Countryside world-beauty, art and extra scenery pipeline enabled in LOW GRAPHICS after device testing.']),
      Object.freeze(['Tuned low profile', 'Retains DPR 1.0, disabled shadows, fewer real lights and suppressed outline draw calls while restoring those visual-quality features.']),
      Object.freeze(['1.19.9 r223', 'Defines LOW GRAPHICS as rendering-only: identical world content, DPR 1.0, no shadows, no constructed TURN contours and cheaper real lighting.']),
      Object.freeze(['No post-hoc contour removal', 'Contour producers now skip their outline meshes before allocation; the shared Three runtime no longer traverses the scene to hide them.']),
      Object.freeze(['1.19.10 r224', 'Adds a large yellow warning sign before MOUNTAIN’s downhill slalom, restoring the visual timing landmark that the old tree provided.']),
      Object.freeze(['Slalom landmark', 'The sign is lightweight authored geometry, faces the approach and remains visual-only with no collision or extra asset download.']),
      Object.freeze(['1.19.11 r225', 'Moves the MOUNTAIN warning landmark to the broad summit bend where the old tree actually served as a planning cue before the plunge.']),
      Object.freeze(['Landmark placement correction', 'Leaves the minimap untouched and keeps the warning sign visual-only while restoring the earlier approach sightline.'])
    ])
  }),
  Object.freeze({
    date: '14 September',
    entries: Object.freeze([
      Object.freeze(['1.19.12 r226', 'Raises the MOUNTAIN summit warning plate slightly without moving its tested road position.']),
      Object.freeze(['Clear warning symbol', 'Keeps the support behind the plate and gives the front a tapered exclamation bar with a separate round dot.']),
      Object.freeze(['1.19.13 r228', 'Adds HEAD START to Getting Started for 50 trophies: beat the previous valid lap while carrying OVERCHARGE across the line.']),
      Object.freeze(['Flying-start lesson', 'Encourages continuous laps and prepares drivers for Time Trial targets set for flying starts.']),
      Object.freeze(['1.19.14 r229', 'Corrects HEAD START: cross the setup lap with OVERCHARGE, spend that carried OVERCHARGE with BOOST on the next lap, and beat the setup time.']),
      Object.freeze(['Two-lap flying-start sequence', 'An invalid next lap breaks the attempt, so the achievement now directly teaches the build-up lap used before Time Trial runs.']),
      Object.freeze(['1.19.14 r230', 'Gives HEAD START its own flying-start icon: a tilted top-down car launching over a checkered finish line.']),
      Object.freeze(['Achievement pictogram only', 'Keeps the existing achievement icon box and state styling unchanged while replacing the reused charge symbol.']),
      Object.freeze(['1.19.15 r231', 'Makes the OVERCHARGE portion of BOOST deliver 20% more boost thrust while it is being consumed.']),
      Object.freeze(['Stronger burst, same ceiling', 'Returns immediately to ordinary BOOST power after OVERCHARGE is spent and leaves the boosted top-speed ceiling unchanged.']),
      Object.freeze(['1.20.0 r232', 'Adds adaptive Trophy Road support challenges when progress stalls: WINNER, HOW TO PLAY, SAFETY and, after it unlocks, DRIFT.']),
      Object.freeze(['Progress without guesswork', 'Recommends an owned car, explains that a clean lap stays on-road from start to finish, awards 5 trophies for each previously unread HOW TO PLAY part, and offers a reroll after continued attempts.'])
    ])
  })
]);

export const CURRENT_RELEASE = Object.freeze({
  version: '1.20.0',
  build: '2026.09.14-r232',
  note: 'TURN 1.20.0 adds adaptive Trophy Road support challenges for stalled progress.'
});
