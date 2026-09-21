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

const SUPPORT_CHALLENGE_FEEDBACK_HISTORY = Object.freeze({
  period: '14 September',
  title: 'Support challenges hand off cleanly',
  paragraphs: Object.freeze([
    'TURN 1.20.1 makes START CHALLENGE carry both parts of the recommendation into play: it selects the challenge track and preselects the recommended owned car in The Lot.',
    'Challenge completion now uses the compact pill cue in-race and replays it on CHOOSE TRACK while the trophy notification pulses away. When the same lap also unlocks an achievement and Trophy Road reward, challenge and achievement feedback share the first beat and the reward waits for the next one.'
  ]),
  milestones: Object.freeze([
    'Recommended challenge car preselected in The Lot',
    'Compact challenge pill and ordered challenge, achievement and reward feedback',
    'TURN 1.20.1 · 2026.09.14-r233'
  ])
});

const SUPPORT_CHALLENGE_LIFECYCLE_HISTORY = Object.freeze({
  period: '14 September',
  title: 'Support feedback has one owner',
  paragraphs: Object.freeze([
    'TURN 1.20.2 keeps challenge bonuses valid when the same lap also earns a normal achievement or reaches the end of Trophy Road. The compact challenge pill appears together with any achievement from that lap, followed by the unlocked rewards.',
    'CHOOSE TRACK replays the completion pill and temporary trophy check before its rewards. Interrupted feedback survives leaving Home or reopening the app. Explicit lifecycle events replace toast observers, and one reward queue retains every reward through the handoff.'
  ]),
  milestones: Object.freeze([
    'Reliable in-race support completion pill for SAFETY and other race challenges',
    'Explicit CHOOSE TRACK replay lifecycle with ordered Trophy Road rewards',
    'TURN 1.20.2 · 2026.09.14-r234'
  ])
});

const PERK_FEEDBACK_OVERDRIVE_HISTORY = Object.freeze({
  period: '15 September',
  title: 'Perk feedback gets lighter and OVERDRIVE keeps climbing',
  paragraphs: Object.freeze([
    'TURN 1.20.3 gives LEARNER CAR’s GRADUATED changes the same thin pill language as challenge completion while keeping them yellow. SUPERCAR now announces FLOW SHIFT ACTIVE and FLOW SHIFT LOST in blue compact pills, using the shared cue lane so race feedback staggers instead of overlapping.',
    'FUTURE RACER’s OVERDRIVE no longer stops at +6%. The existing +6% per five clean seconds curve continues for as long as the car stays on-track without a collision; leaving the road or hitting something still resets it.'
  ]),
  milestones: Object.freeze([
    'Thin yellow GRADUATED pills and blue FLOW SHIFT ACTIVE / LOST pills',
    'Uncapped OVERDRIVE at +6% speed ceiling per five clean seconds',
    'TURN 1.20.3 · 2026.09.15-r239'
  ])
});

const FLOW_SHIFT_X3_HISTORY = Object.freeze({
  period: '15 September',
  title: 'FLOW SHIFT asks for deeper FLOW',
  paragraphs: Object.freeze([
    'TURN 1.20.4 moves SUPERCAR’s FLOW SHIFT activation from FLOW ×2 to FLOW ×3. Ordinary SHIFT remains in effect at ×1 and ×2; reaching ×3 or higher removes SHIFT’s three reductions while the perk is active.',
    'The blue FLOW SHIFT ACTIVE / LOST pills continue to follow the same threshold transition. FUTURE RACER OVERDRIVE is retuned to +5% speed cap per five clean seconds, announces every 10% milestone in a thin blue pill, and shows OVERDRIVE LOST when leaving the track or colliding.'
  ]),
  milestones: Object.freeze([
    'FLOW SHIFT activates at FLOW ×3 instead of ×2',
    '×2 keeps ordinary SHIFT balance',
    'OVERDRIVE +5% per five seconds with blue 10% milestone / LOST pills',
    'TURN 1.20.4 · 2026.09.15-r240'
  ])
});

const OVERDRIVE_FAST_CLEAN_HISTORY = Object.freeze({
  period: '15 September',
  title: 'OVERDRIVE rewards fast clean driving',
  paragraphs: Object.freeze([
    'TURN 1.20.5 makes OVERDRIVE build only while FUTURE RACER is travelling at 200 km/h or faster. Slowing below 200 km/h pauses the build without losing it; leaving the track or colliding still resets all accumulated OVERDRIVE.',
    'OVERDRIVE LOST now appears only after at least one 10% milestone pill has been shown. HOW TO PLAY also defines clean driving consistently across TURN as staying on the track, while speed and time requirements remain separate challenge conditions.'
  ]),
  milestones: Object.freeze([
    'OVERDRIVE build requires 200 km/h or more and pauses below the threshold',
    'OVERDRIVE LOST only after visible milestone feedback',
    'HOW TO PLAY defines clean driving as staying on track',
    'TURN 1.20.5 · 2026.09.15-r241'
  ])
});

const HOME_TAGLINE_FLOW_HISTORY = Object.freeze({
  period: '16 September',
  title: 'FLOW joins the home promise',
  paragraphs: Object.freeze([
    'TURN 1.20.5 build r242 updates the Home tagline to TILT. DRIFT. FLOW., bringing the scoring mechanic into the game’s short top-level promise without changing gameplay.',
    'The build increment keeps the Home copy change cache-safe while the semantic release version remains 1.20.5.'
  ]),
  milestones: Object.freeze([
    'Home tagline: TILT. DRIFT. FLOW.',
    'TURN 1.20.5 · 2026.09.16-r242'
  ])
});

const TRACTOR_SMV_HISTORY = Object.freeze({
  period: '16 September',
  title: 'TRACTOR slows things down for non-visual practice',
  paragraphs: Object.freeze([
    'TURN 1.21.0 adds TRACTOR as a start-available Kenney Car Kit vehicle with the SMV perk. Its 1 / 1 / 5 / 1 / 5 / 5 attributes keep the normal 18-point vehicle budget while its green body and yellow secondary paint give it a distinct factory identity.',
    'The first SMV build limits added propulsion to 50 km/h on DRIFT, 75 km/h on GAS and 100 km/h on BOOST without forcibly removing existing momentum. The standard SHIFT profile can change its attributes to 2 / 2 / 4 / 2 / 4 / 4, while these initial SMV ceilings themselves remain fixed.'
  ]),
  milestones: Object.freeze([
    'Start-available TRACTOR with SMV perk',
    'Initial 50 / 75 / 100 km/h DRIFT, GAS and BOOST propulsion ceilings',
    'Standard SHIFT attribute profile: 2 / 2 / 4 / 2 / 4 / 4',
    'TURN 1.21.0 · 2026.09.16-r243'
  ])
});

const TRACTOR_SMV_TUNING_HISTORY = Object.freeze({
  period: '16 September',
  title: 'TRACTOR practice speeds become progressive',
  paragraphs: Object.freeze([
    'TURN 1.21.0 build r245 retunes SMV to 40 / 60 / 80 km/h on DRIFT, GAS and BOOST, then raises those ceilings to 50 / 70 / 90 km/h while SHIFT is active. The live SHIFT state now changes both the ordinary attribute profile and the SMV propulsion ceiling, making SHIFT a real step up in blank screen practice speed.',
    'The same build keeps LEARNER CAR as the canonical default and first Lot car with TRACTOR second. Build r246 fixes the enhanced Trophy Road ordering layer too, so the visible rail, previous/next controls and keyboard cycling all preserve LEARNER CAR → TRACTOR → TRUCK.'
  ]),
  milestones: Object.freeze([
    '40 / 60 / 80 km/h base SMV ceilings and 50 / 70 / 90 km/h with SHIFT',
    'LEARNER CAR remains the default and first Lot car; TRACTOR is second',
    'Enhanced Lot cycling aligned in r246',
    'TURN 1.21.0 · 2026.09.16-r245–r246'
  ])
});

const TRACTOR_RELEASE_CLEANUP_HISTORY = Object.freeze({
  period: '16 September',
  title: 'TRACTOR release records and regressions align',
  paragraphs: Object.freeze([
    'TURN 1.21.0 build r248 reconciles the r243, r245 and r246 release record with the behavior that actually shipped, and updates the semantic native-finish regression to TRACTOR’s current #666000 factory secondary paint.',
    'The dedicated TRACTOR regression now exercises the live SMV speed-limit resolver directly for normal and SHIFT inputs, while retaining the contract that SMV limits newly added propulsion instead of forcibly clamping existing momentum. Gameplay tuning is unchanged.'
  ]),
  milestones: Object.freeze([
    'Release history matches the shipped SMV progression',
    'Semantic paint regression follows #666000 factory secondary paint',
    'Direct normal and SHIFT SMV resolver coverage',
    'TURN 1.21.0 · 2026.09.16-r248'
  ])
});

const DBE_SMV_TRAINING_HISTORY = Object.freeze({
  period: '16 September',
  title: 'DRIVE BY EAR 101 adopts the slow-moving vehicle',
  paragraphs: Object.freeze([
    'TURN 1.21.0 build r249 now temporarily uses the slow-moving vehicle throughout DRIVE BY EAR 101. Its SMV propulsion ceilings give new non-visual drivers more time to hear the ribbon, pace notes, surface feedback and recovery guidance before the speed builds.',
    'The training still restores the player’s chosen car and audio settings on exit, and now uses the slow-moving vehicle’s own factory paint instead of inheriting Learner Car colours.'
  ]),
  milestones: Object.freeze([
    'Slow-moving vehicle in all five DRIVE BY EAR 101 parts',
    'Factory paint follows the temporary training vehicle',
    'Legacy DBE module identity routes through the current build',
    'TURN 1.21.0 · 2026.09.16-r249'
  ])
});

const DBE_SMV_PACE_TIMING_HISTORY = Object.freeze({
  period: '16 September',
  title: 'DRIVE BY EAR 101 brings pace notes closer',
  paragraphs: Object.freeze([
    'TURN 1.21.0 build r250 moves the authored DRIVE BY EAR 101 pace notes closer to their curve entries for the slow-moving vehicle’s lower practice speeds. The cue still arrives before the steering action, but the learner no longer waits through a long straight after hearing it.',
    'The final linked right–left phrase remains one sequence, preserving BIP BIP right followed by BIP BEEP left while bringing the whole phrase closer to the paired curves.'
  ]),
  milestones: Object.freeze([
    'Later cues in all four pace-note training parts',
    'Linked right–left phrase remains one sequence',
    'TURN 1.21.0 · 2026.09.16-r250'
  ])
});


const DBE_FULL_MIX_HISTORY = Object.freeze({
  period: '17 September',
  title: 'DRIVE BY EAR 101 turns the training mix fully toward DBE',
  paragraphs: Object.freeze([
    'TURN 1.21.0 build r251 sets the DRIVE BY EAR 101 sound balance to 100% Drive By Ear so the guided training foregrounds the ribbon, pace notes, surface feedback and recovery guidance without the normal music/engine mix competing for attention.',
    'Build r252 updates the training copy to describe that 100% DBE balance accurately. The gameplay and training sequence are otherwise unchanged.'
  ]),
  milestones: Object.freeze([
    '100% Drive By Ear balance throughout DRIVE BY EAR 101',
    'Training copy synchronized with the full DBE mix',
    'TURN 1.21.0 · 2026.09.17-r251 / r252'
  ])
});

const TRACTOR_SMV_SIGN_HISTORY = Object.freeze({
  period: '17 September',
  title: 'TRACTOR gets its slow-moving-vehicle sign',
  paragraphs: Object.freeze([
    'TURN 1.21.0 build r253 adds the fluorescent orange/red slow-moving-vehicle plaque to the rear of TRACTOR, mounted close to the authored rear chassis between the back wheels.',
    'The sign is presentation only: TRACTOR keeps the same SMV propulsion limits, SHIFT progression, handling and factory paint.'
  ]),
  milestones: Object.freeze([
    'Rear fluorescent-orange/red SMV plaque on TRACTOR',
    'No change to TRACTOR gameplay tuning',
    'TURN 1.21.0 · 2026.09.17-r253'
  ])
});

const RELEASE_BASELINE_HISTORY = Object.freeze({
  period: '17 September',
  title: 'Release surfaces return to one verified build',
  paragraphs: Object.freeze([
    'TURN 1.21.0 build r254 restores the generated release surfaces after the r251–r253 production changes. TURN, TURN NEXT, TURN LAB, YOUR TURN, About/history, design references and release-bound module identities once again describe the same current build.',
    'This repair does not change gameplay. It restores the release source-of-truth contract so the full regression suite can verify the current production state before the responsive work begins.'
  ]),
  milestones: Object.freeze([
    'Generated release surfaces synchronized to r254',
    'r251–r253 recorded in changelog and development history',
    'TURN 1.21.0 · 2026.09.17-r254'
  ])
});

const PROJECTED_SHADOW_HISTORY = Object.freeze({
  period: '19 September',
  title: 'Car shadows stay attached to the road',
  paragraphs: Object.freeze([
    'TURN 1.21.1 replaces real-time shadow maps with small, soft car shadows projected onto the road. A tight contact layer anchors each car, while a lighter directional layer follows the sun across slopes and curves.',
    'Player and rivals share the same rendering resources. LOW GRAPHICS also keeps these inexpensive car shadows; scenery no longer casts dynamic shadows.'
  ]),
  milestones: Object.freeze([
    'Road-following contact and directional shadows for player and rivals',
    'One shared shadow draw call with no shadow-map texture or extra render pass',
    'TURN 1.21.1 · 2026.09.19-r256'
  ])
});

const DIRECTIONAL_SHADOW_HISTORY = Object.freeze({
  period: '19 September',
  title: 'Car shadows cast away from the light',
  paragraphs: Object.freeze([
    'TURN 1.21.2 tucks the narrow origin of the directional car shadow beneath the chassis and lets it widen softly away from the sun. This removes the opposite-side lobe while keeping the tight contact shadow and road-following projection.'
  ]),
  milestones: Object.freeze([
    'Directional shadows begin beneath the car and extend away from the light',
    'The same shared instanced shadow resources and draw call',
    'TURN 1.21.2 · 2026.09.19-r257'
  ])
});

const SOFT_SHADOW_HISTORY = Object.freeze({
  period: '19 September',
  title: 'One soft cast shadow beneath each car',
  paragraphs: Object.freeze([
    'TURN 1.21.3 rounds and softens the directional car shadow into one continuous tapered shape. It keeps its length and hidden attachment beneath the chassis, with a gradual fade toward the far end.'
  ]),
  milestones: Object.freeze([
    'A continuous soft directional silhouette without a squared-off outer edge',
    'Tight contact shadows and shared road-following rendering retained',
    'TURN 1.21.3 · 2026.09.19-r258'
  ])
});

const WHEEL_CONTACT_HISTORY = Object.freeze({
  period: '20 September',
  title: 'Lighter shadows and tire marks that meet the wheels',
  paragraphs: Object.freeze([
    'TURN 1.21.4 lightens the tight shadow beneath each car. Skid marks now start at the actual rear tires for each vehicle and update in the same rendered frame, keeping the tracks attached while drifting at speed.'
  ]),
  milestones: Object.freeze([
    'Lighter contact shadows with the soft directional shape preserved',
    'Skid marks follow each car’s rear axle and the current road slope',
    'TURN 1.21.4 · 2026.09.20-r259'
  ])
});

const TYRE_CENTRE_HISTORY = Object.freeze({
  period: '20 September',
  title: 'Tire marks align with the wheel centres',
  paragraphs: Object.freeze([
    'TURN 1.21.5 moves skid marks from the inner wheel origins to the centres of the rear tires. Spacing follows each car’s wheel geometry, while Monster Truck and Supercar retain their existing alignment.'
  ]),
  milestones: Object.freeze([
    'Model-specific skid spacing with stable wheel attachment while drifting',
    'TURN 1.21.5 · 2026.09.20-r260'
  ])
});

const RACE_CONTOUR_HISTORY = Object.freeze({
  period: '20 September',
  title: 'Cleaner racing scenery, with contours kept in The Lot',
  paragraphs: Object.freeze([
    'TURN 1.21.6 removes contour shells from racing cars and scenery. The race image uses the models, lighting and projected shadows consistently, while The Lot keeps its existing outlined car previews.',
    'The Lot releases its preview renderers before returning control to racing. Removing race contours also removes their extra drawing work and the delayed scenery passes that used to add them.'
  ]),
  milestones: Object.freeze([
    'Consistent racing scenery without contour shells',
    'The Lot keeps its contours and releases its GPU contexts before racing',
    'TURN 1.21.6 · 2026.09.20-r261'
  ])
});

const ROAD_EDGE_AND_CLIFFSIDE_RESTORE_HISTORY = Object.freeze({
  period: '20 September',
  title: 'Track edges and CLIFFSIDE ground return',
  paragraphs: Object.freeze([
    'TURN 1.21.7 restores the narrow asphalt-coloured strip outside the painted track edges on Countryside, Airport, Cliffside and Harbor. It is ordinary road-edge geometry, not a contour shell, so the racing contour removal remains in place.',
    'CLIFFSIDE now loads its r76 scenery wrapper directly from the track registry, restoring the filled inner highlands and grounded forest without changing collision, road geometry, records or vehicle behaviour.'
  ]),
  milestones: Object.freeze([
    'Asphalt-coloured outer road trim restored on four tracks',
    'CLIFFSIDE inner highlands restored through the intended r76 scenery wrapper',
    'TURN 1.21.7 · 2026.09.20-r262'
  ])
});

const MOUNTAIN_ROAD_EDGE_RESTORE_HISTORY = Object.freeze({
  period: '20 September',
  title: 'MOUNTAIN gets its road-edge trim back',
  paragraphs: Object.freeze([
    'TURN 1.21.8 restores the narrow asphalt-coloured strip immediately outside MOUNTAIN’s white road-edge markings. The strip is ordinary road geometry, not a contour shell, so the cleaner contour-free racing treatment remains unchanged.',
    'The restored trim follows the full long-course road and keeps MOUNTAIN’s collision, terrain, handling and records unchanged.'
  ]),
  milestones: Object.freeze([
    'Asphalt-coloured outer road trim restored on MOUNTAIN',
    'No racing contour shells reintroduced',
    'TURN 1.21.8 · 2026.09.20-r263'
  ])
});

const LOW_GRAPHICS_LOT_OUTLINES_HISTORY = Object.freeze({
  period: '20 September',
  title: 'LOW GRAPHICS keeps The Lot’s outlines',
  paragraphs: Object.freeze([
    'TURN 1.21.9 keeps the deliberate black car contours in The Lot when LOW GRAPHICS is enabled. LOW remains a performance mode rather than a different art direction.',
    'Racing stays contour-free in both graphics modes because race car visuals explicitly opt out of outline geometry; LOW still keeps its DPR 1.0 cap and reduced real point-light illumination.'
  ]),
  milestones: Object.freeze([
    'The Lot car outlines preserved in LOW GRAPHICS',
    'Racing remains contour-free in both modes',
    'TURN 1.21.9 · 2026.09.20-r264'
  ])
});

const SETTINGS_FINAL_COPY_HISTORY = Object.freeze({
  period: '20 September',
  title: 'Settings reflect the finished TURN',
  paragraphs: Object.freeze([
    'TURN 1.21.10 updates Settings to describe the game as it now ships. Drift Camera is no longer labelled experimental, and LOW GRAPHICS copy now reflects its final behaviour: lower resolution and simpler lighting without implying that authored Lot outlines disappear.',
    'Player marker, Color cues and live DRIFT / FLOW display controls now share one Interface card. The controls keep their existing preferences and behaviour; this is an information-architecture and copy cleanup rather than a gameplay change.'
  ]),
  milestones: Object.freeze([
    'Final Camera and LOW GRAPHICS copy',
    'Player marker, Color cues and scoring visibility grouped under Interface',
    'TURN 1.21.10 · 2026.09.20-r265'
  ])
});

const SHARED_NIGHT_SKY_HISTORY = Object.freeze({
  period: '20 September',
  title: 'MOUNTAIN and MIDNIGHT CITY share one night sky',
  paragraphs: Object.freeze([
    'TURN 1.21.11 replaces MOUNTAIN’s scaled raster star field with a crisp procedural gradient-and-star shader while keeping the existing moon image on the same world-locked southern celestial layer.',
    'MIDNIGHT CITY reuses that sky and moon with a restrained purple horizon glow. World-up roll coherence, camera-cut snapping, phone/tablet aspect normalization and reduced-motion no-drag behaviour are shared without adding dynamic lights or changing gameplay.'
  ]),
  milestones: Object.freeze([
    'One procedural night sky shared by MOUNTAIN and MIDNIGHT CITY',
    'Canonical moon image shared at the same southern celestial anchor',
    'TURN 1.21.11 · 2026.09.20-r266'
  ])
});

const STABLE_NIGHT_SKY_HISTORY = Object.freeze({
  period: '20 September',
  title: 'The night sky holds still and the horizon opens up',
  paragraphs: Object.freeze([
    'TURN 1.21.12 removes the deliberate yaw easing and small camera-position/pitch drift from the shared celestial layer. The procedural stars now lock directly to heading, and the moon is rendered as its own camera-facing world billboard so it stays circular instead of inheriting the sky plane’s non-uniform scale.',
    'MOUNTAIN now grades more clearly toward lighter blue at the horizon, while MIDNIGHT CITY grades toward lighter violet. The change keeps the same procedural shader, canonical moon image, roll-safe coverage and gameplay lighting.'
  ]),
  milestones: Object.freeze([
    'Direct-lock procedural sky with no deliberate celestial wobble',
    'World-root billboard moon with stable circular presentation',
    'Clearer blue and violet horizon gradients',
    'TURN 1.21.12 · 2026.09.20-r267'
  ])
});

const NIGHT_SKY_FINISH_HISTORY = Object.freeze({
  period: '20 September',
  title: 'Night gradients move into the driving sky',
  paragraphs: Object.freeze([
    'TURN 1.21.13 lifts the shared night gradients into the part of the sky actually visible while racing. MOUNTAIN now grades clearly toward lighter blue above the terrain, and MIDNIGHT CITY carries a visible lighter-violet glow above the skyline instead of hiding most of it below the horizon.',
    'The procedural stars are also made slightly larger, softer and sparser. They remain static in the same world-locked shader, but their less binary footprint reduces the subpixel flicker seen on physical devices without adding another render pass or animation loop.'
  ]),
  milestones: Object.freeze([
    'Visible blue and violet gradients during normal driving',
    'Larger, softer and sparser procedural stars',
    'No extra draw call, light or animation loop',
    'TURN 1.21.13 · 2026.09.20-r268'
  ])
});

const WORLD_HORIZON_NIGHT_SKY_HISTORY = Object.freeze({
  period: '20 September',
  title: 'Night gradients follow the real horizon',
  paragraphs: Object.freeze([
    'TURN 1.21.14 anchors the MOUNTAIN and MIDNIGHT CITY color gradients to the projected world horizon instead of the bottom of the current camera view. When the race camera pitches down on descents or from the summit, the lighter blue or violet band now rises with the actual horizon rather than disappearing behind terrain and buildings.',
    'Stars and moon keep the stable direct-lock treatment from the previous release. The change adds only one scalar horizon uniform update to the existing sky draw and does not add a render pass, light, texture or animation loop.'
  ]),
  milestones: Object.freeze([
    'Projected world-horizon gradient anchor',
    'Blue and violet remain visible with pitched race cameras',
    'Stable moon and softened star treatment retained',
    'TURN 1.21.14 · 2026.09.20-r269'
  ])
});

const LOWER_NIGHT_GRADIENT_HISTORY = Object.freeze({
  period: '20 September',
  title: 'Night color settles back onto the horizon',
  paragraphs: Object.freeze([
    'TURN 1.21.15 keeps the world-horizon anchoring from the previous release but halves the vertical reach of both night gradients. MOUNTAIN now keeps its lighter blue close to the horizon, while MIDNIGHT CITY keeps its violet glow low behind the skyline.',
    'The goal is a darker night overall: the gradient remains clearly visible as atmosphere near the horizon, while most of the sky returns to the deep zenith colors. Moon, stars, camera lock and rendering cost are unchanged.'
  ]),
  milestones: Object.freeze([
    'MOUNTAIN gradient reach: 0.23 above the projected horizon',
    'MIDNIGHT CITY gradient reach: 0.26 above the projected horizon',
    'TURN 1.21.15 · 2026.09.20-r270'
  ])
});

const MATCHED_NIGHT_GRADIENT_HISTORY = Object.freeze({
  period: '21 September',
  title: 'Both night gradients settle at the same height',
  paragraphs: Object.freeze([
    'TURN 1.21.16 makes the final MIDNIGHT CITY art-direction adjustment after physical production testing: its violet world-horizon gradient now uses the same 0.23 reach as MOUNTAIN.',
    'Only the CITY gradient reach changes. The projected world-horizon anchor, deep zenith colors, moon, stars, camera lock and rendering architecture remain unchanged.'
  ]),
  milestones: Object.freeze([
    'MOUNTAIN gradient reach: 0.23 above the projected horizon',
    'MIDNIGHT CITY gradient reach: 0.23 above the projected horizon',
    'TURN 1.21.16 · 2026.09.21-r271'
  ])
});

const MIDNIGHT_GROUND_CONTRAST_HISTORY = Object.freeze({
  period: '21 September',
  title: 'MIDNIGHT CITY separates road from ground',
  paragraphs: Object.freeze([
    'TURN 1.21.17 keeps the established MIDNIGHT CITY asphalt color but darkens the large surrounding base ground plane from #0e1420 to #080d16. The road, road edges, sidewalks, parks and lighting are unchanged.',
    'Because this is only a material color adjustment on existing geometry, it adds no draw calls, lights, textures or per-frame work.'
  ]),
  milestones: Object.freeze([
    'Race road unchanged: #20242d',
    'Off-road base ground: #080d16',
    'TURN 1.21.17 · 2026.09.21-r272'
  ])
});

const MIDNIGHT_SINGLE_GROUND_HISTORY = Object.freeze({
  period: '21 September',
  title: 'MIDNIGHT CITY keeps one canonical ground layer',
  paragraphs: Object.freeze([
    'TURN 1.21.18 removes the old translucent downtown ground-glow disc that sat only 0.03 units above the main MIDNIGHT CITY ground plane. That overlay used a different color and could produce visible triangular/radial depth interference in wide camera views.',
    'The race road remains #20242d and the surrounding off-road base remains #080d16. Parks and other intentional local surfaces stay distinct; only the redundant city-wide non-road overlay is removed.'
  ]),
  milestones: Object.freeze([
    'Single city-wide off-road ground plane: #080d16',
    'Race road unchanged: #20242d',
    'One fewer transparent ground mesh',
    'TURN 1.21.18 · 2026.09.21-r273'
  ])
});

const MIDNIGHT_LOW_CITY_HISTORY = Object.freeze({
  period: '21 September',
  title: 'MIDNIGHT CITY grows a low-rise street layer',
  paragraphs: Object.freeze([
    'TURN 1.21.19 fills selected empty trackside areas with a new low-city layer: short dark buildings aligned to the road, bright shopfront strips, thin neon rooflines and rooftop service units. Placement is derived from the race geometry and rejected when it would crowd the road, overlap a park or collide visually with the existing district towers.',
    'The procedural infill is three instanced draw calls and adds no real lights. Up to three small pinned Kenney City Builder models — two low buildings and a garage — can load as extra foreground landmarks using the same CC0 pack already used by TURN Commons.'
  ]),
  milestones: Object.freeze([
    'Track-aware low-rise urban infill',
    'Shopfront and roofline neon without dynamic lights',
    'Three instanced procedural draw calls',
    'Up to three pinned Kenney low-city landmarks',
    'TURN 1.21.19 · 2026.09.21-r274'
  ])
});

const MIDNIGHT_PURPLE_LOW_CITY_HISTORY = Object.freeze({
  period: '21 September',
  title: 'MIDNIGHT CITY leans into purple low-rises',
  paragraphs: Object.freeze([
    'TURN 1.21.20 removes the visually dominant Kenney garage from the low-city layer, keeps only two smaller pinned Kenney building landmarks at reduced scale, and increases the density of procedural low-rise candidates.',
    'Three of the four low-rise body palette entries are now purple-family colors, so the foreground city reads more like a coherent extension of MIDNIGHT CITY’s neon art direction while keeping the same three instanced procedural draw calls and no new real lights.'
  ]),
  milestones: Object.freeze([
    'Kenney garage removed',
    'Two smaller Kenney low-city landmarks maximum',
    'Purple-family low-rise palette weighted 3 of 4',
    'Denser procedural candidate coverage with unchanged draw-call count',
    'TURN 1.21.20 · 2026.09.21-r275'
  ])
});

const AIRPORT_HAIRPIN_SEAM_HISTORY = Object.freeze({
  period: '21 September',
  title: 'AIRPORT hairpin loses its flickering road seams',
  paragraphs: Object.freeze([
    'TURN 1.21.21 fixes a long-standing AIRPORT rendering artifact at the tight centre hairpin. The centreline itself was valid, but the road’s inner offset is tighter than half the road width and briefly folds back across itself, causing several coplanar road triangles to overlap and flicker as the camera moves.',
    'The fix is topology-only: TURN keeps the same control points, sampled centreline, road width, curb positions and collision. Only the overlapping local triangle strip beneath the inner curb is replaced by one clean triangulation using the existing road vertices and outer boundary.'
  ]),
  milestones: Object.freeze([
    'AIRPORT control points and hairpin shape unchanged',
    'Road width, curbs and collision unchanged',
    'Overlapping inner hairpin triangles removed',
    'TURN 1.21.21 · 2026.09.21-r276'
  ])
});

const AIRPORT_HAIRPIN_SEAM_SHADING_HISTORY = Object.freeze({
  period: '21 September',
  title: 'AIRPORT hairpin repair blends back into the road',
  paragraphs: Object.freeze([
    'TURN 1.21.22 removes the two stable dark join lines left by the r276 hairpin topology repair. The repaired polygon is unchanged; only its triangle winding is normalized so its computed normals face the same direction as the surrounding asphalt.',
    'That makes both patch boundaries shade with the road instead of as dark seams, while preserving the r276 fix for the original flicker and leaving route shape, width, curbs, collision and road vertices untouched.'
  ]),
  milestones: Object.freeze([
    'r276 anti-flicker topology retained',
    'Hairpin patch triangle winding normalized upward',
    'Two dark patch-boundary seams removed',
    'TURN 1.21.22 · 2026.09.21-r277'
  ])
});

const LOT_TABLET_LAYOUT_HISTORY = Object.freeze({
  period: '21 September',
  title: 'The Lot gives tablets more room to browse',
  paragraphs: Object.freeze([
    'TURN 1.21.23 build r278 gives THE LOT a taller title band and car carousel when there is tablet-height vertical room, letting the 3D preview and attribute panel become shorter instead of compressing navigation. TURN 1.21.24 build r279 scopes those larger proportions to viewports at least 600px tall so iPhone landscape keeps the established compact header and carousel.',
    'TURN 1.21.25 build r280 adds deliberate horizontal breathing room between BACK and THE LOT on both compact phone and larger tablet headers, without changing the responsive height split.',
    'The showroom content still reaches the bottom of TURN’s usable web layer instead of reserving an extra cyan gutter. iPadOS may draw its own system-owned strip outside that usable web layer, so TURN keeps interactive content inside the viewport WebKit actually exposes.'
  ]),
  milestones: Object.freeze([
    'Taller Lot header and car carousel',
    'Shorter 3D and attribute region on tablet landscape',
    'No extra Lot-owned bottom gutter',
    'Phone landscape keeps 76px / 122px header and carousel',
    'Tablet-height viewports use 104px / 150px from 600px upward',
    'BACK and THE LOT keep a clear horizontal gap at every header size',
    'TURN 1.21.25 · 2026.09.21-r280'
  ])
});

const KEYBOARD_OWNERSHIP_HISTORY = Object.freeze({
  period: '18 September',
  title: 'Keyboard driving stays on the race surface',
  paragraphs: Object.freeze([
    'TURN 1.21.0 build r255 gives the global driving shortcuts one explicit ownership rule. Arrow keys, W/A/S/D, Space and R now affect the car only while an active race owns keyboard input; menus, dialogs and native form controls keep their normal keyboard behaviour.',
    'Held keyboard driving input is cleared when ownership is lost through Home, The Lot, Spectate, dialogs, focus changes, page visibility or window blur. Q/E Drift and Boost use the same ownership contract, and modified browser shortcuts such as Ctrl+R remain untouched.'
  ]),
  milestones: Object.freeze([
    'Race-only ownership for Arrow/WASD/Space/R driving shortcuts',
    'Shared ownership and release handling for Q/E Drift and Boost',
    'Held input cleared on UI, focus, visibility and route transitions',
    'TURN 1.21.0 · 2026.09.18-r255'
  ])
});

const FACTORY_SECONDARY_PAINT_HISTORY = Object.freeze({
  period: '16 September',
  title: 'Factory secondary paint gets tuned',
  paragraphs: Object.freeze([
    'TURN 1.21.0 build r247 retunes two factory secondary colours without changing body paint or vehicle behaviour. TRACTOR keeps its green body and changes its secondary paint to #666000; AWD keeps its brown body and changes its secondary paint to #aa9988.',
    'Existing factory-painted vehicle selections and saved rivals migrate to the new pairs. Custom PAINTJOB combinations remain untouched.'
  ]),
  milestones: Object.freeze([
    'TRACTOR factory secondary: #666000',
    'AWD factory secondary: #aa9988',
    'TURN 1.21.0 · 2026.09.16-r247'
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
  SUPPORT_CHALLENGE_HISTORY,
  SUPPORT_CHALLENGE_FEEDBACK_HISTORY,
  SUPPORT_CHALLENGE_LIFECYCLE_HISTORY,
  PERK_FEEDBACK_OVERDRIVE_HISTORY,
  FLOW_SHIFT_X3_HISTORY,
  OVERDRIVE_FAST_CLEAN_HISTORY,
  HOME_TAGLINE_FLOW_HISTORY,
  TRACTOR_SMV_HISTORY,
  TRACTOR_SMV_TUNING_HISTORY,
  FACTORY_SECONDARY_PAINT_HISTORY,
  TRACTOR_RELEASE_CLEANUP_HISTORY,
  DBE_SMV_TRAINING_HISTORY,
  DBE_SMV_PACE_TIMING_HISTORY,
  DBE_FULL_MIX_HISTORY,
  TRACTOR_SMV_SIGN_HISTORY,
  RELEASE_BASELINE_HISTORY,
  KEYBOARD_OWNERSHIP_HISTORY,
  PROJECTED_SHADOW_HISTORY,
  DIRECTIONAL_SHADOW_HISTORY,
  SOFT_SHADOW_HISTORY,
  WHEEL_CONTACT_HISTORY,
  TYRE_CENTRE_HISTORY,
  RACE_CONTOUR_HISTORY,
  ROAD_EDGE_AND_CLIFFSIDE_RESTORE_HISTORY,
  MOUNTAIN_ROAD_EDGE_RESTORE_HISTORY,
  LOW_GRAPHICS_LOT_OUTLINES_HISTORY,
  SETTINGS_FINAL_COPY_HISTORY,
  SHARED_NIGHT_SKY_HISTORY,
  STABLE_NIGHT_SKY_HISTORY,
  NIGHT_SKY_FINISH_HISTORY,
  WORLD_HORIZON_NIGHT_SKY_HISTORY,
  LOWER_NIGHT_GRADIENT_HISTORY,
  MATCHED_NIGHT_GRADIENT_HISTORY,
  MIDNIGHT_GROUND_CONTRAST_HISTORY,
  MIDNIGHT_SINGLE_GROUND_HISTORY,
  MIDNIGHT_LOW_CITY_HISTORY,
  MIDNIGHT_PURPLE_LOW_CITY_HISTORY,
  AIRPORT_HAIRPIN_SEAM_HISTORY,
  AIRPORT_HAIRPIN_SEAM_SHADING_HISTORY,
  LOT_TABLET_LAYOUT_HISTORY
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
      Object.freeze(['Progress without guesswork', 'Recommends an owned car, explains that a clean lap stays on-road from start to finish, awards 5 trophies for each previously unread HOW TO PLAY part, and offers a reroll after continued attempts.']),
      Object.freeze(['1.20.1 r233', 'Makes START CHALLENGE preselect both the recommended track and owned car, and replaces the large challenge completion block with the compact pill cue.']),
      Object.freeze(['Ordered support feedback', 'Shows challenge and same-lap achievement feedback together, then gives Trophy Road rewards their own turn; CHOOSE TRACK replays the challenge cue while its trophy notification pulses away.']),
      Object.freeze(['1.20.2 r234', 'Fixes same-lap challenge bonuses and ordered completion feedback, preserves interrupted Home replays, and keeps live challenge rules working when offline caching fails.']),
      Object.freeze(['One feedback queue', 'Lets support feedback temporarily hold Trophy Road reward presentation, then returns control to the normal achievement reward queue after the pill and trophy check finish.'])
    ])
  }),
  Object.freeze({
    date: '15 September',
    entries: Object.freeze([
      Object.freeze(['1.20.3 r239', 'Uses the thin challenge-style pill for LEARNER CAR GRADUATED feedback, adds blue FLOW SHIFT ACTIVE / LOST pills, and lets FUTURE RACER OVERDRIVE keep raising its speed ceiling.']),
      Object.freeze(['Uncapped OVERDRIVE', 'Keeps the existing +6% per five clean seconds rate indefinitely until the car leaves the road or collides.']),
      Object.freeze(['1.20.4 r240', 'Raises SUPERCAR FLOW SHIFT activation from FLOW ×2 to FLOW ×3 and retunes FUTURE RACER OVERDRIVE to +5% per five clean seconds with blue 10% milestone and LOST pills.']),
      Object.freeze(['1.20.5 r241', 'Builds FUTURE RACER OVERDRIVE only at 200 km/h or faster, pauses progress below that speed, and only shows OVERDRIVE LOST after visible milestone feedback.']),
      Object.freeze(['Clean driving', 'Defines clean driving in HOW TO PLAY as staying on the track; speed and time targets remain separate requirements.'])
    ])
  }),
Object.freeze({
  date: '16 September',
  entries: Object.freeze([
    Object.freeze(['1.20.5 r242', 'Updates the Home tagline to TILT. DRIFT. FLOW. and advances the build identity for the copy change.']),
    Object.freeze(['1.21.0 r243', 'Adds the start-available TRACTOR with the SMV perk for slower blank screen and non-visual driving practice.']),
    Object.freeze(['SMV practice speeds', 'Limits added propulsion to 50 km/h on DRIFT, 75 km/h on GAS and 100 km/h on BOOST while preserving existing momentum.']),
    Object.freeze(['TRACTOR SHIFT step', 'Uses the normal SHIFT system to move from 1 / 1 / 5 / 1 / 5 / 5 to 2 / 2 / 4 / 2 / 4 / 4.']),
    Object.freeze(['1.21.0 r245', 'Retunes TRACTOR SMV to 40 / 60 / 80 km/h and 50 / 70 / 90 with SHIFT, while keeping LEARNER CAR as the default and first Lot car.']),
    Object.freeze(['SMV SHIFT progression', 'Lets live SHIFT state raise the TRACTOR propulsion ceilings as well as applying its 2 / 2 / 4 / 2 / 4 / 4 attribute profile.']),
    Object.freeze(['1.21.0 r246', 'Keeps TRACTOR immediately after LEARNER CAR in the enhanced Lot order, including previous/next and keyboard cycling.']),
    Object.freeze(['1.21.0 r247', 'Retunes factory secondary paint: TRACTOR to #666000 and AWD to #aa9988 while keeping their body colours unchanged.']),
    Object.freeze(['Factory paint migration', 'Moves existing factory-painted selections and saved rivals to the new secondary colours without changing custom PAINTJOB combinations.']),
    Object.freeze(['1.21.0 r248', 'Aligns TRACTOR release history and regression coverage with the shipped SMV tuning and #666000 secondary paint; gameplay is unchanged.']),
    Object.freeze(['TRACTOR regression coverage', 'Exercises the normal and SHIFT SMV speed resolver directly while retaining the no-forced-clamp propulsion contract.']),
    Object.freeze(['1.21.0 r249', 'Uses the slow-moving vehicle throughout DRIVE BY EAR 101 so blank-screen and non-visual practice starts at the deliberately governed SMV speeds.']),
    Object.freeze(['DBE 101 vehicle', 'Uses the temporary vehicle’s factory paint, restores the player’s selection on exit, and routes legacy training imports to the current build.']),
    Object.freeze(['1.21.0 r250', 'Moves DRIVE BY EAR 101 pace notes closer to their curves for the slow-moving vehicle’s lower practice speeds.']),
    Object.freeze(['Closer pace-note timing', 'Keeps each cue on the approach while reducing the wait between hearing the BIPs and reaching the turn.'])
  ])
}),
Object.freeze({
  date: '17 September',
  entries: Object.freeze([
    Object.freeze(['1.21.0 r251', 'Sets DRIVE BY EAR 101 to a 100% Drive By Ear training balance so the guided audio layer is foregrounded throughout practice.']),
    Object.freeze(['1.21.0 r252', 'Updates DRIVE BY EAR 101 copy to describe the 100% DBE training balance accurately.']),
    Object.freeze(['1.21.0 r253', 'Adds the fluorescent-orange/red slow-moving-vehicle plaque to the rear of TRACTOR without changing its gameplay tuning.']),
    Object.freeze(['1.21.0 r254', 'Restores generated release parity after r251–r253 and records those production changes in the release-facing history.']),
    Object.freeze(['Verified baseline', 'Synchronizes TURN, TURN NEXT, TURN LAB, YOUR TURN, About/history and release-bound module identities so the full regression suite can validate one current build.'])
  ])
}),
Object.freeze({
  date: '18 September',
  entries: Object.freeze([
    Object.freeze(['1.21.0 r255', 'Limits global Arrow/WASD/Space/R driving shortcuts to the active race surface so menus, dialogs and native controls keep keyboard ownership.']),
    Object.freeze(['Keyboard input ownership', 'Clears held driving input when ownership is lost and applies the same rule to Q/E Drift and Boost without intercepting modified browser shortcuts.'])
  ])
}),
Object.freeze({
  date: '19 September',
  entries: Object.freeze([
    Object.freeze(['1.21.1 r256', 'Replaces dynamic shadow maps with stable, soft contact and directional car shadows that follow the road.']),
    Object.freeze(['Cheaper grounding', 'Player and rivals share one shadow draw call, including in LOW GRAPHICS, without a shadow-map texture or scenery shadow pass.']),
    Object.freeze(['1.21.2 r257', 'Tucks directional shadows beneath the chassis on the sun-facing side, with a narrow origin that widens away from the light.']),
    Object.freeze(['1.21.3 r258', 'Softens the directional car shadow into one continuous rounded shape, preserving its length and tight attachment beneath the chassis.'])
  ])
}),
Object.freeze({
  date: '20 September',
  entries: Object.freeze([
    Object.freeze(['1.21.4 r259', 'Lightens the shadow beneath each car and attaches skid marks to its actual rear wheels without a frame of delay.']),
    Object.freeze(['1.21.5 r260', 'Aligns skid marks with the centres of the rear tires, preserving Monster Truck and Supercar spacing.']),
    Object.freeze(['1.21.6 r261', 'Removes race contours and their extra drawing work, keeps The Lot’s outlined previews, and releases Lot renderers before racing resumes.']),
    Object.freeze(['1.21.7 r262', 'Restores the asphalt-coloured strip outside track markings and CLIFFSIDE’s filled inner highlands while keeping racing contour shells removed.']),
    Object.freeze(['1.21.8 r263', 'Restores MOUNTAIN’s asphalt-coloured strip outside the white road-edge markings without reintroducing racing contour shells.']),
    Object.freeze(['1.21.9 r264', 'Keeps The Lot’s black car contours in LOW GRAPHICS while racing remains contour-free in both graphics modes.']),
    Object.freeze(['1.21.10 r265', 'Finalizes Settings copy and groups Player marker, Color cues and DRIFT / FLOW visibility controls into one Interface section.']),
    Object.freeze(['1.21.11 r266', 'Replaces MOUNTAIN’s raster star field with one shared procedural night sky, reused by MIDNIGHT CITY with a restrained purple horizon glow and the same canonical moon.']),
    Object.freeze(['1.21.12 r267', 'Locks the procedural night sky and moon directly to the camera/world relationship, keeps the moon circular, and strengthens MOUNTAIN’s blue and MIDNIGHT CITY’s violet horizon gradients.']),
    Object.freeze(['1.21.13 r268', 'Raises the night gradients into the normal driving view and softens the procedural star treatment to reduce subpixel flicker.']),
    Object.freeze(['1.21.14 r269', 'Anchors MOUNTAIN’s blue and MIDNIGHT CITY’s violet gradients to the projected world horizon so pitched race cameras no longer hide them below terrain or skyline.']),
    Object.freeze(['1.21.15 r270', 'Halves both world-horizon gradient reaches so the blue/violet atmosphere stays low and most of the night sky remains dark.'])
  ])
}),
Object.freeze({
  date: '21 September',
  entries: Object.freeze([
    Object.freeze(['1.21.16 r271', 'Matches MIDNIGHT CITY’s violet world-horizon gradient reach to MOUNTAIN at 0.23 after final physical production tuning.']),
    Object.freeze(['1.21.17 r272', 'Darkens MIDNIGHT CITY’s surrounding base ground while keeping the race asphalt unchanged, making the street read more clearly at night.']),
    Object.freeze(['1.21.18 r273', 'Removes the redundant translucent downtown ground overlay so MIDNIGHT CITY uses one uniform city-wide off-road ground surface and avoids depth interference.']),
    Object.freeze(['1.21.19 r274', 'Adds track-aware low-rise urban infill, neon shopfronts and a few pinned Kenney foreground landmarks to fill MIDNIGHT CITY’s large empty areas without adding real lights.']),
    Object.freeze(['1.21.20 r275', 'Removes the oversized Kenney garage, reduces the remaining asset landmarks and adds more purple-weighted procedural low-rises around the course.']),
    Object.freeze(['1.21.21 r276', 'Removes AIRPORT’s flickering centre-hairpin seams by replacing only the self-overlapping local road triangles while preserving the route, width, curbs and collision.']),
    Object.freeze(['1.21.22 r277', 'Blends the AIRPORT hairpin repair into the surrounding asphalt by matching the repaired triangles’ winding and normals to the road, removing the two remaining dark join lines.']),
    Object.freeze(['1.21.23 r278', 'Rebalances THE LOT for tablet landscape with a taller header and car carousel, a shorter 3D/attribute region, and no extra Lot-owned cyan gutter below the showroom.']),
    Object.freeze(['1.21.24 r279', 'Keeps the r278 tablet proportions only on viewports at least 600px tall, restoring the compact Lot header and carousel on iPhone landscape.']),
    Object.freeze(['1.21.25 r280', 'Adds more horizontal space between BACK and THE LOT on every responsive Lot header size.']),
    Object.freeze(['1.21.26 r281', 'Adds compact blue race-status cues when SUV reaches or loses FULL TANK, Truck reaches BOOST TANK 5/5, and Sports Car reaches DRIFT 5/5.']),
    Object.freeze(['1.21.27 r282', 'Makes Trophy Road ownership unmistakable with large green check badges on earned rewards, matching yellow lock badges on locked rewards and an explicit → NEXT label for the upcoming reward.']),
    Object.freeze(['1.21.28 r283', 'Moves the earned Trophy Road check fully inside its reward card and makes it substantially larger, while locked rewards keep the smaller outside-corner lock silhouette.']),
    Object.freeze(['1.21.29 r284', 'Makes the earned Trophy Road check ring transparent so each reward category colour continues through the badge while preserving the large inset silhouette.'])
  ])
})
]);

export const CURRENT_RELEASE = Object.freeze({
  version: '1.21.29',
  build: '2026.09.21-r284',
  note: 'TURN 1.21.29 lets each earned Trophy Road reward colour show through its large inset check ring while keeping the earned/locked silhouette distinction.'
});
