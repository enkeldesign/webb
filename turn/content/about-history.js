export const DEVELOPMENT_HISTORY = Object.freeze([
  {
    period: '18–19 July 2026',
    title: 'From sensor experiment to modular racer',
    paragraphs: [
      'TURN began as a mobile prototype built around one unusual idea: hold a phone or tablet in landscape and rotate it like a steering wheel.',
      'The first day established the Three.js road, motion steering, touch driving, drift-oriented physics, lap timing, saved rivals and PWA installation. TURN LAB then split the fast prototype into explicit race, input, physics, rendering, replay, track and interface modules before the verified R7 runtime replaced production.'
    ],
    milestones: [
      'Sensor-steered prototype and Three.js world',
      'Mobile HUD, touch controls and personal rival recordings',
      'Protected TURN LAB refactor and R7 production baseline'
    ]
  },
  {
    period: '19–22 July',
    title: 'The Lot and dependable racing',
    paragraphs: [
      'TURN became a small racing game rather than a single-car experiment. The Lot introduced fifteen vehicles, a rotating 3D viewer, paint and an eighteen-point stat budget built around trade-offs.',
      'The same period made racing trustworthy: ordered swept checkpoints, a physical start and finish line, brake-before-reverse behaviour, clearer lap results, restart handling and systematic model-orientation corrections.'
    ],
    milestones: [
      'Fifteen-car garage with balanced attributes',
      'Unified thumb-operated drive surface',
      'Reliable checkpoints, lap validity and result presentation'
    ]
  },
  {
    period: '22–25 July',
    title: 'One course becomes a track platform',
    paragraphs: [
      'Countryside gained Airport, then Cliffside and Harbor. Each track exposed another hard-coded assumption and pushed the runtime toward a generic registry for identity, storage, atmosphere, collision, elevation and activation.',
      'Track cards evolved into postcards with best times and the actual record-setting car. World containment, scenery colliders, elevation-aware presentation and event-driven rendering work prepared the game for continued expansion.'
    ],
    milestones: [
      'Airport, elevated Cliffside and Harbor',
      'Track-scoped records and generic runtime registry',
      'World collision, elevation and performance architecture'
    ]
  },
  {
    period: '26–28 July',
    title: 'Drive By Ear becomes a driving language',
    paragraphs: [
      'Engine and tyre feedback expanded into Drive By Ear: spatial guidance designed to help every player and, together with a screen reader, support complete non-visual play.',
      'Early separate cues were consolidated into a layered hierarchy with an organic steering ribbon, off-road recovery, wrong-way priority, directional rivals and hand-authored pace notes. Device recordings repeatedly corrected channel direction, recovery meaning, speech priority and rare note loss.'
    ],
    milestones: [
      'All-track pace notes and central audio mixer',
      'One consistent steer-toward-the-sound rule',
      'Delivery-critical route guidance and screen-reader race speech'
    ]
  },
  {
    period: '28–31 July',
    title: 'TURN NEXT validates the platform refactor',
    paragraphs: [
      'TURN NEXT was created as an isolated PWA with separate storage, then used to stage motion, display and race-session architecture without putting production records at risk.',
      'A whole-screen orientation-freeze experiment was rejected after physical iOS testing. The accepted web solution became a truthful ±24° operating envelope with directional, non-flashing visual feedback plus audio, haptics and first-per-side screen-reader announcements.',
      'The M5–M8 programme also replaced the old startup loop with Home → track → The Lot → introduction → race.'
    ],
    milestones: [
      'Platform-owned motion and display lifecycle',
      'Validated 24° steering and horizon safe zone',
      'Home, consolidated Settings and central session orchestration'
    ]
  },
  {
    period: '29 July–2 August',
    title: 'Accessibility becomes structural',
    paragraphs: [
      'Accessibility work changed information architecture and interaction rather than merely adding labels. The Lot became a keyboard-friendly radio group with complete car descriptions, human-readable paint colours and deliberate heading navigation.',
      'VoiceOver testing invalidated two plausible ARIA techniques, so TURN replaced them with real hidden summary text and selected-first DOM ordering. Dialog focus return, installation guidance, motion-denial recovery, external-keyboard controls and non-visual instructions were hardened in the same period.'
    ],
    milestones: [
      'Complete keyboard and assistive-technology car selection',
      'Composed lap speech and managed position announcements',
      'Browser-aware installation and truthful device support'
    ]
  },
  {
    period: '31 July–2 August',
    title: 'Midnight City and a living design system',
    paragraphs: [
      'Midnight City became TURN’s fifth and longest track. Its first boulevard layout was rebuilt into distinct districts with parks, skyline, neon lore, a cinematic introduction and a deliberately hidden LILYA portrait.',
      'The longer 1,080-sample route exposed a progress-normalisation defect that moved pace notes to two-thirds of their intended positions. Geometry-backed direction tests and sample-aware timing now protect the track.',
      'A living design-system reference and shared semantic tokens established stable colour, control, form, disclosure, radius, border and shadow rules without flattening track personality.'
    ],
    milestones: [
      'Five-track game with a long night-city course',
      'Geometry-backed Midnight City pace-note validation',
      'Production semantic tokens and design reference'
    ]
  },
  {
    period: '3 August',
    title: 'Emergency vehicles and blank-screen play',
    paragraphs: [
      'Fire Truck, Police Car and Ambulance replaced three garage vehicles. Fixed service liveries, large Boost tanks, flashing lights and vehicle-specific procedural sirens made Boost part of each vehicle’s identity.',
      'Blank-screen mode then covered the visual game with true black while retaining controls, tilt steering, audio and assistive-technology access. Drive By Ear can be enabled temporarily for that session without overwriting the player’s preference.'
    ],
    milestones: [
      'Three fixed-livery emergency vehicles',
      'Boost-controlled lights and sirens',
      'Audio-only play with temporary Drive By Ear activation'
    ]
  },
  {
    period: '3–5 August',
    title: 'Achievements become Trophy Road',
    paragraphs: [
      'An offline-first achievement collection grew from onboarding challenges into non-visual play, developer time trials, emergency-vehicle challenges, all-track rival and clean-driving goals, and hidden discoveries including Bella in Countryside.',
      'Points became permanent trophies. Trophy Road now unlocks Midnight City, Future Racer, Paintjob, the Emergency Pack and Monster Truck while grandfathering existing profiles.',
      'A serious Home-to-Lot freeze was eventually traced to a Paintjob MutationObserver that repeatedly changed the subtree it watched. The fix narrowed ownership and added a regression for the self-triggering pattern.'
    ],
    milestones: [
      '28 achievements and 1,700 available trophies',
      'Persistent content rewards and legacy-player migration',
      'Critical observer-loop diagnosis and prevention'
    ]
  },
  {
    period: '4–6 August',
    title: 'Stabilization and progression',
    paragraphs: [
      'TURN 1.5.0 added a branded loading cover, stable iOS Home sizing, compact Paintjob locking and new-achievement markers.',
      'TURN 1.5.1 corrected Trophy Road’s initial reward card, transitions between 3D and line-art previews and the Paintjob lower rail. TURN 1.5.2 consolidated the later interface, progression, achievement and accessibility work together with the corrected usable iOS standalone viewport.',
      'The game entered a refinement and hardening phase with five tracks, fifteen garage slots, local rivals, a mature non-visual audio system, assistive-technology navigation and persistent progression.'
    ],
    milestones: [
      'TURN 1.5.2 · 2026.08.06-r161 stabilization baseline',
      'Post-r160 interface, progression, achievement and viewport stabilization',
      'Sixty-plus production regression gates plus DBE training tests'
    ]
  },
  {
    period: '6–8 August',
    title: 'YOUR TURN makes personal rivals social',
    paragraphs: [
      'YOUR TURN grew from a focused recipient prototype into a browser-first social challenge flow that reuses TURN’s canonical track, vehicle, replay, audio and accessibility systems. TURN can now share the selected track’s stored best lap from Home and offer sharing directly from a new-personal-best lap result.',
      'Recipients can race the challenge repeatedly, add their own named car and pass the challenge on. Growing chains preserve stable racer identities, keep up to four rival replays, stage the field together at the start and use player name plates and deliberate social colours instead of anonymous ghost language.',
      'The first self-contained links proved too large for dependable social previews as a chain grew. A lightweight Cloudflare Worker and D1 snapshot store now turns the same immutable challenge payload into a short enkel.design link, while the complete self-contained link remains an automatic fallback. TURN and YOUR TURN also share one About presentation and credit Kenney Game Assets.'
    ],
    milestones: [
      'TURN → YOUR TURN sharing from Home and personal-best results',
      'Growing named multi-racer challenge chains with stable identities',
      'Canonical release: TURN 1.6.0 · 2026.08.08-r162'
    ]
  },
  {
    period: '8–9 August',
    title: 'A color-based achievement triggers an accessibility patch',
    paragraphs: [
      'CHROMATIC CAMOUFLAGE added a hidden 50-trophy challenge built around the five production track colours. It checks the current personal best on every track and deliberately accepts broad hue families rather than exact paint values, bringing the collection to 29 achievements and 1,750 available trophies. Device testing widened Countryside’s accepted pink family so canonical #FF00FF Magenta is not rejected on a five-degree technicality.',
      'The new color-based achievement exposed an accessibility gap: common colour-vision simulations collapse several track colours toward similar greys, olives and violets. TURN 1.7.0 is therefore an accessibility patch, adding optional Color Cues, off by default, with compact text and pattern labels for track colours and selected vehicle paint without recolouring the game or creating a separate visual mode.',
      'VoiceOver testing then showed TURN’s paint control behaving differently from a plain HTML color input in the same browser session. The response was to remove the workaround stack rather than add another bridge: the Lot now creates the real input in its final semantic location, leaves the native control appearance and accessible value untouched, stops globally disabling selection and touch behaviour, and progressively adds only TURN’s label and optional Color Cue.'
    ],
    milestones: [
      'CHROMATIC CAMOUFLAGE · 50 trophies with generous pink-family matching',
      'Optional Color Cues with text and pattern redundancy',
      'TURN 1.7.0 · 2026.08.09-r163 accessibility patch returning paint to native HTML first'
    ]
  },
  {
    period: '9–11 August',
    title: 'Music, resilience and vehicle character',
    paragraphs: [
      'Real-device investigation of an intermittent short iOS standalone viewport moved from observation to measurement in TURN LAB, where the failing 393/462-pixel state could be captured and repaired reproducibly. Production TURN now protects the primary RACE action in the short viewport and can perform the narrow, proven viewport-meta repair after Home has settled. YOUR TURN also gained canonical track maps and a clearer challenge-specific control set; a later cyan-screen failure was traced to another self-triggering MutationObserver loop and fixed at its source.',
      'TURN gained its first continuous generated Web Audio soundtrack across Home, The Lot and racing. Reusable tune, bridge and chorus sections were repeatedly tuned by listening on real devices, while persistent Music controls provide an explicit OFF state that shuts down the music scheduler and AudioContext rather than merely muting it. The default volume is now 50%, and desktop players can hold Q for Drift and E for Boost through the same canonical drive-pad path as touch controls.',
      'The Monster Truck became the first Trophy Road vehicle whose reward changes the rules rather than only unlocking a model: it treats off-road ground like track for acceleration, grip, drag, Boost and speed limits while still colliding normally with railings, walls and other world geometry. The perk establishes a new direction for achievement rewards built around distinctive ways to drive rather than simple stat inflation.'
    ],
    milestones: [
      'Real-device iOS viewport repair and YOUR TURN control-loop hardening',
      'Generated racing soundtrack with persistent 0–100% Music control and true OFF shutdown',
      'TURN 1.8.0 · 2026.08.11-r164 with the Monster Truck all-terrain perk'
    ]
  },
  {
    period: '17 August',
    title: 'MOUNTAIN turns Track 6 into an alpine journey',
    paragraphs: [
      'TURN’s sixth production track replaces the old Track 6 placeholder with MOUNTAIN: a 49-metre alpine route that begins in a warm snowy village, climbs in long flowing curves around the hidden backside, reaches a river at the snow line and then changes character into an exposed front-face hairpin descent beside a waterfall.',
      'The world combines a procedural alpine ground treatment, batched spruce forests and Cliffside-style granite with a cozy chalet village, chapel, inn, lanterns, Kenney Fantasy Town landmarks, a lake, summit river, waterfall mist and a layered mountain backdrop. Snow is deliberately visual rather than an ice-grip gimmick, while guardrail-aligned containment keeps the descent difficult without letting cars pass through scenery.',
      'MOUNTAIN also joins TURN’s non-visual and progression systems as a first-class track: Drive By Ear changes from long flowing climb notes to alternating severity-three slalom calls, Color Cues adds a distinct blue family, every-track achievements now include six tracks, and Trophy Road unlocks MOUNTAIN at 700 trophies.'
    ],
    milestones: [
      'Sixth production track with a 49 m summit and cinematic village-to-peak intro',
      'Snowy village, summit river, front-face slalom, waterfall and alpine backdrop',
      'TURN 1.9.0 · 2026.08.17-r173 with MOUNTAIN at 700 trophies'
    ]
  },
  {
    period: '18 August',
    title: 'MOUNTAIN becomes a moonlit night race',
    paragraphs: [
      'MOUNTAIN’s daytime alpine world was retreated as a night track with a compact star field, full moon, moonlit snow and water, warm street-lamp pools and lit chalet windows. The celestial layer follows the world horizon with restrained parallax rather than the physical screen, and loading-camera cuts now snap the sky immediately instead of visibly rolling it into place.',
      'Reduced-motion players get the same deep-blue night atmosphere and moon without the moving star field or parallax. Window glow was snapped to real house facades, benches were oriented toward the road and the night treatment deliberately avoids expensive shadow maps.',
      'A real shadowless Three.js spotlight replaced the earlier projected headlight wedges. MOUNTAIN and MIDNIGHT CITY now share one performance-conscious headlight rig; device testing then tuned its reach, intensity and emitter position without adding a second light, beam geometry, raycasts or a separate animation loop.',
      'A side-by-side device comparison then exposed a cache-order bug in that shared rig: an older module could create the named light first and later installers would reuse it without reapplying the current configuration. Build r175 makes every night-track activation reconcile the live light to the canonical settings and explicitly removes any surviving MIDNIGHT CITY projected-headlight nodes.'
    ],
    milestones: [
      'Moon, star field, moonlit terrain, warm village lamps and lit windows',
      'Reduced-motion night treatment with a static solid-colour sky and retained moon',
      'TURN 1.9.1 · 2026.08.18-r174 with shared night-track headlights and MOUNTAIN night polish',
      'TURN 1.9.1 · 2026.08.18-r175 with cache-order-independent night-headlight reconciliation'
    ]
  },
  {
    period: '23 August',
    title: 'RALLY RACER becomes a true final reward',
    paragraphs: [
      'The final 1,000-trophy car now has a reward-grade visual identity rather than reading as an almost monochrome toy racer. Its black factory body is paired with a paintable trophy-gold competition kit: four auxiliary rally lamps, twin bonnet stripes, rim accents, body-integrated rocker steps and a high rear wing all remain visible in The Lot, Trophy Road, the race camera, saved rivals and ghosts. A compact dark rollover structure adds depth around the cabin without competing with those gold focal points.',
      'The upgrade is generated after every source model is normalized, so its proportions stay consistent across TURN’s differently sized rendering surfaces. The many individual-looking parts are also merged into three material batches, preserving the richer silhouette without multiplying real-time lights or adding a draw call for every lamp, bar and rim.',
      'RALLY RACER is the first vehicle to use a reusable catalog-selected visual-upgrade pipeline. Future reward cars can opt into another bounded procedural kit while continuing to share the canonical paint, ghost, thumbnail, outline and disposal paths.'
    ],
    milestones: [
      'Black-and-gold four-lamp rally identity with bonnet stripes, rim accents, integrated steps and competition wing',
      'Reusable batched visual-upgrade pipeline across every canonical car rendering surface',
      'TURN 1.9.2 · 2026.08.23-r176 with the upgraded 1,000-trophy RALLY RACER',
      'TURN 1.9.3 · 2026.08.23-r177 with integrated rocker steps and a subtler dark roll hoop'
    ]
  },
  {
    period: '23 August',
    title: 'The cars recover their authored detail',
    paragraphs: [
      'A source-model audit found that the Kenney cars already carried semantic UV regions for body panels, windows, lamps, trim and wheel parts. Their shared palette image had never been routed into TURN, so earlier paint logic flattened each model into one material colour and made the cars look unfinished.',
      'TURN now loads the correct palette for each Kenney kit and recolours selected palette cells in the existing shader. The upgrade adds no window, lamp, panel, rim or rally-kit meshes. It preserves the low-poly panel shading while giving every repaintable car primary body/rim paint and a model-specific secondary trim region; emergency vehicles retain their authored fixed service liveries.',
      'The current Toy Kit RALLY RACER keeps its distinctive integrated wing and receives black-and-gold paint through its own surfaces. MONSTER TRUCK is the one selected model replacement: the reviewed RGSDev truck returns as a standalone GLB with named body, trim, glass, lamp, suspension, tyre and rim materials rather than the former twelve-car replacement bundle.'
    ],
    milestones: [
      'Correct Car Kit and Toy/Prototype palette routing across all Kenney vehicles',
      'Runtime semantic paint on existing UV surfaces with no generated presentation geometry',
      'Selective CC0 RGSDev Monster Truck with preserved named materials',
      'TURN 1.10.0 · 2026.08.23-r179 native car surfaces release'
    ]
  },
  {
    period: '24–26 August',
    title: 'Playtesting reshapes the driving feel',
    paragraphs: [
      'After hands-on playtesting, TURN’s chase camera was reshaped around a clearer sense of speed without letting the car drift away on screen. The optional Drift Camera now follows the car’s actual direction of travel, while speed-responsive field of view reaches both Classic and Zoom profiles; reduced-motion players keep the stable original field of view.',
      'The same testing made the cars’ front wheels part of the feedback loop. Existing model pivots are now bridged into the race-car host so the visible wheels turn with steering input instead of remaining fixed while the car changes direction.',
      'A progressive DRIFT LOCK experiment was rolled back after it proved too crowded for useful analog thumb movement. The standard control now uses a binary LOCK target with a short smooth transition, a connected LOCK bubble and purple-to-green Boost feedback. Boost recharges only while drifting and rewards locked drifting at the former full drift rate.'
    ],
    milestones: [
      'Playtest-driven Drift Camera, speed-responsive field of view and a clearer Zoom choice',
      'Visible front-wheel steering tied to player input',
      'Standard binary DRIFT LOCK with quick smoothing, LOCK bubble and state-aware Boost',
      'TURN 1.11.0 · 2026.08.26-r184 driving-feel release'
    ]
  },
{
  period: '29–31 August',
  title: 'Long MOUNTAIN reaches production and difficulty gets clearer',
  paragraphs: [
    'The long MOUNTAIN course moved from TURN LAB into production without replacing the production runtime around it. The original alpine climb now continues across the lake bridge into an open lower valley, a village tunnel and forest return before reconnecting with the snowy start.',
    'Playtesting then exposed a small start/finish S-kink and steep landing in the rebuilt return. The final approach was smoothed while the start line stayed fixed, and MOUNTAIN records were given a fresh geometry-safe namespace rather than reinterpreting older replay coordinates.',
    'TURN’s track language now uses four explicit difficulty tiers: EASY, MEDIUM, ADVANCED and EXPERT. Green, yellow, orange and red reinforce those text labels, while track-card ARIA names the same difficulty. MIDNIGHT CITY and MOUNTAIN unlock information now also states their rounded lap length and challenge tier.'
  ],
  milestones: [
    'Long MOUNTAIN production route with lake bridge, lower valley, village tunnel and forest return',
    'Smoothed MOUNTAIN start/finish approach with geometry-safe record isolation',
    'Accessible EASY / MEDIUM / ADVANCED / EXPERT hierarchy across all six tracks',
    'TURN 1.12.0 · 2026.08.31-r185 difficulty and long-MOUNTAIN release'
  ]
},
{
  period: '2–3 September',
  title: 'SHIFT turns the garage into two-mode machines',
  paragraphs: [
    'SHIFT becomes TURN’s 1,500-trophy reward and adds a saved alternate setup to every standard eighteen-point car. A six-lever gearbox shows the standard attributes in blue, gains in green and reductions in red. Players move exactly three attributes up one point; the remaining three move down automatically, keeping the total and each one-to-five boundary intact.',
    'During a race, holding GAS slides out a connected SHIFT control. Every crossing from GAS into SHIFT toggles the alternate setup, so returning to GAS and crossing again switches back without lifting the thumb. A green button darkens and gains a visible dot when active, while the same real toggle remains operable by keyboard and assistive technology.',
    'The change preserves each car’s named perk and the current percentage of Boost charge. Attribute effects swap live, while a lower top-speed cap eases down instead of abruptly snapping a moving car to the new limit.',
    'Follow-up playtesting gave every fixed gearbox lever an explanation and a brief visual response. Each race shift now rolls the three attributes that just gained a point beneath the Boost bar. The roll lingers twice as long under one consistent SHIFT heading, while the complete non-visual attribute summary plays only on the first shift of each race and later toggles announce just the state. SHIFT and LOCK were also fitted to their exact GAS and DRIFT rows so their shared seams meet cleanly without overlapping, and interrupted screenshot or app-focus transitions now restore the connected control state.',
    'The SHIFT roll now temporarily rises above the pre-race action bar and carries its own subtle translucent backing. It remains readable across bright and dark tracks without permanently moving the rest of the HUD above the driving controls.'
  ],
  milestones: [
    'Per-car six-lever gearbox with an invariant eighteen-point budget',
    'Persistent GAS-to-SHIFT slide toggle with visible and non-visual state feedback',
    'Fixed-lever explanations, longer rolling feedback and exact LOCK / SHIFT row alignment',
    'Universally readable SHIFT roll above the pre-race action bar',
    'TURN 1.14.5 · 2026.09.03-r196 SHIFT feedback layering refinement'
  ]
}
]);

export const CHANGELOG = Object.freeze([
  {
    date: '18 July 2026',
    entries: [
      ['Prototype', 'Sensor steering, Three.js road and world, touch driving, lap timing, saved rivals and first PWA work.']
    ]
  },
  {
    date: '19 July',
    entries: [
      ['R7', 'Verified modular TURN LAB runtime promoted to production.'],
      ['1.0.1 r8', 'Correct manual steering and visible on-screen steering.'],
      ['1.1.0–1.1.3 r9–r12', 'The Lot, fifteen cars, viewer, balanced stats and ordered checkpoints.'],
      ['1.2.0–1.2.1 r13–r14', 'Continuous Gas/Drift/Boost pad, Brake · Reverse and Boost rearming.']
    ]
  },
  {
    date: '20 July',
    entries: [
      ['1.3.0 r15', 'State-aware race menu.'],
      ['1.4.0 r16 — reverted', 'Ability Zones and nitrous removed after device testing.'],
      ['1.3.1–1.3.9 r17–r25', 'Performance, orientation, paint, outlines and repeated Lot simplification.']
    ]
  },
  {
    date: '21 July',
    entries: [
      ['1.3.10–1.3.15 r26–r31', 'Procedural audio, vehicle sound identity and stronger landscape handling.'],
      ['1.3.16–1.3.21 r32–r38', 'Lap-result toast, swept gates, invalid-lap state and physical start/finish ownership.'],
      ['1.4.0 r37 — reverted', 'Audio redesign rolled back after real-device regressions.']
    ]
  },
  {
    date: '22 July',
    entries: [
      ['1.3.22–1.3.29 r39–r46', 'Rival onboarding, immediate invalid-lap feedback, mobile performance and new icon package.'],
      ['1.5.0–1.6.2 r47–r52', 'Airport, track selection, track-scoped records and forgiving hairpin run-off.']
    ]
  },
  {
    date: '23–24 July',
    entries: [
      ['1.7.0 r53', 'World containment and reusable scenery collision.'],
      ['1.7.1–1.7.6 r62–r67', 'Release source of truth, generic track registry, covered-render pause, event-driven rivals, skid ring buffer and elevation foundation.']
    ]
  },
  {
    date: '25 July',
    entries: [
      ['1.8.0–1.8.6 r68–r74', 'Cliffside, forgiving shoulders and iOS/iPad viewport coverage.'],
      ['1.9.0–1.9.4 r75–r79', 'Track introductions, Cliffside highlands and track postcard identities.'],
      ['1.10.0–1.10.5 r80–r85', 'Harbor, free roaming, top-HUD position and LAP VOID wording.']
    ]
  },
  {
    date: '26 July',
    entries: [
      ['1.11.0–1.11.3 r86–r89', 'Super Sedan secret and hidden Harbor face.'],
      ['1.12.0 r90', 'Brake/Reverse joins the continuous four-zone drive surface.'],
      ['1.13.0–1.15.0 r91–r95', 'Universal soundscape, Sound Guide, race speech and first Airport pace notes.']
    ]
  },
  {
    date: '27 July',
    entries: [
      ['1.16.0–1.17.0 r96–r97', 'Pace notes on every track and a true Drive By Ear off path.'],
      ['1.18.0–1.22.0 r98–r103', 'RAD prototype, Training Car, unified Trajectory Slider, pure-pursuit recovery and organic hum.'],
      ['r104', 'Audio controls, sound balance, Spectate rank and race-UI polish.']
    ]
  },
  {
    date: '28 July',
    entries: [
      ['1.23.1–1.23.6 r105–r110', 'Recovery direction, speech priority, exact lap wording and delivery-critical pace notes.'],
      ['TURN NEXT M1–M4.2', 'Isolated staging, platform contract, rejected orientation freeze, accepted 24° safe zone and non-flashing inertial warning.']
    ]
  },
  {
    date: '29 July',
    entries: [
      ['1.24.0 r111', 'Validated 24° steering/horizon envelope promoted to production.'],
      ['1.24.1–1.24.2 r112–r113', 'Expanded Drive By Ear guide and screen-reader compatibility explanation.'],
      ['1.24.3–1.24.7 r114–r118', 'Accessible Lot navigation, unified 3D/paint panel and VoiceOver-correct selected-car structure.']
    ]
  },
  {
    date: '30 July',
    entries: [
      ['1.24.8 r119 — reverted', 'Generated icon suite rolled back after visual review.'],
      ['TURN NEXT M5–M7', 'Platform motion/display lifecycle and central race-session orchestration.']
    ]
  },
  {
    date: '31 July',
    entries: [
      ['TURN NEXT M8', 'Track chooser becomes Home; native iOS scrolling, fixed layout and retired legacy startup screen.'],
      ['1.25.0 r120', 'M5–M8 promoted to production; Home → track → The Lot → race.'],
      ['Post-r120 fixes', 'Restore enhanced Lot, keep race action visible and make installation guidance browser-aware.'],
      ['Midnight City', 'First long night-track implementation.']
    ]
  },
  {
    date: '1 August',
    entries: [
      ['Midnight City rebuild', 'District route, parks, skyline, cinematic intro and deliberate hidden LILYA discovery.'],
      ['Pace-note corrections', 'Mirrored directions fixed and 1,080/720 progress distortion removed.'],
      ['1.3.0 r121', 'Human-facing version line reset from 1.25.0 for clearer reading.'],
      ['r122 and hotfixes', 'Record-car thumbnails, canonical player marker, expanded help and contextual rival reset.'],
      ['Accessibility', 'External-keyboard route, desktop support gate and motion-denial recovery.']
    ]
  },
  {
    date: '2 August',
    entries: [
      ['1.3.1–1.3.2 r123–r124', 'Semantic difficulty, form-control and disclosure design system.'],
      ['Design/brand fixes', 'Profile-aligned icon, complete palette reference and vehicle-size balancing.']
    ]
  },
  {
    date: '3 August',
    entries: [
      ['1.4.0 r125 and r126', 'Emergency vehicles, fixed liveries, lights and sirens.'],
      ['Blank screen', 'True-black audio-only play with temporary Drive By Ear activation.'],
      ['Achievements', 'Onboarding, non-visual, Police and developer time-trial challenges.'],
      ['Trophy Road', 'Permanent trophies, reward gates, hidden achievements and existing-player migration.'],
      ['Critical hotfixes', 'Race-freeze investigation and actual Paintjob observer-loop correction.']
    ]
  },
  {
    date: '4 August',
    entries: [
      ['1.5.0 r159', 'Branded loading cover, stable iOS Home surface, compact Paintjob lock and unread achievement dots.']
    ]
  },
  {
    date: '5 August',
    entries: [
      ['1.5.1 r160', 'Trophy Road initial-card and preview-transition fixes; Paintjob lower rail.'],
      ['Post-r160 interface work', 'Car-coloured Paintjob lock, stale lock-toast dismissal, “one oh one” pronunciation, in-game history, normative dialogs, unified design-system navigation and website About.'],
      ['Achievement expansion', 'Harder developer records, FIND LILYA!, FIND DARVID!, Fire Truck-only SAVE BELLA!, AN ARMY OF ME and ON COURSE, OF COURSE.']
    ]
  },
  {
    date: '6 August',
    entries: [
      ['1.5.2 r161', 'Consolidates post-r160 interface, progression, achievement and accessibility work; corrects the usable iOS standalone viewport and refreshes release caches.']
    ]
  },
  {
    date: '7 August',
    entries: [
      ['YOUR TURN recipient', 'Browser-first challenge flow reusing TURN’s canonical race runtime, with motion steering, Drive By Ear support, real pause, repeat attempts and named rival cars.'],
      ['Growing challenges', 'Challenges can accumulate up to four rival replays, preserve stable racer identity, replace a returning racer’s slower car and stage the field together at the start.'],
      ['TURN sharing', 'Selected-track records and new personal-best lap results can launch the SHARE YOUR TURN composer without changing core race behaviour.']
    ]
  },
  {
    date: '8 August',
    entries: [
      ['1.6.0 r162', 'Promotes YOUR TURN sharing into the release: social challenge creation from TURN, growing named challenge chains and refreshed release caches.'],
      ['Short challenge links', 'Cloudflare Worker and D1 snapshots replace growing replay URLs with compact enkel.design links; self-contained links remain the automatic fallback.'],
      ['Shared product language', 'TURN and YOUR TURN share the About presentation and Kenney Game Assets attribution, while the design system now documents social sharing and racer identity colours.']
    ]
  },
  {
    date: '9 August',
    entries: [
      ['1.7.0 r163', 'Accessibility patch prompted by the new color-based CHROMATIC CAMOUFLAGE achievement: adds optional Color Cues while keeping vehicle paint on the native HTML color input.'],
      ['CHROMATIC CAMOUFLAGE', 'Hidden 50-trophy achievement for setting a matching-colour personal best on all five production tracks; broad hue ranges now include canonical #FF00FF Magenta for Countryside’s pink family.'],
      ['Color accessibility', 'Device comparison against a plain HTML color input led to removing activation bridges, named-color fallbacks, post-render paint relocation and broad interaction-suppressing CSS. TURN now starts with the native input and progressively adds only layout and optional Color Cues.']
    ]
  },
  {
    date: '10–11 August',
    entries: [
      ['1.8.0 r164', 'Minor release combining post-r163 reliability, social-racing, control, music and vehicle-identity work with refreshed release caches.'],
      ['iOS/PWA resilience', 'A real-device-proven repair handles the known short standalone viewport after Home settles, while the primary RACE action remains reachable in the reduced web layer.'],
      ['YOUR TURN', 'Adds canonical track maps, challenge-specific Settings and Spectate controls, aligns race controls with TURN and removes a self-triggering control-row observer loop that could leave iOS on a cyan screen.'],
      ['Generated racing music', 'Continuous Web Audio music spans Home, The Lot and racing with reusable tune, bridge and chorus material, persisted OFF–100% volume, a 50% default and true engine shutdown at OFF.'],
      ['Desktop controls and vehicle identity', 'Q = Drift and E = Boost join the existing keyboard route; the Monster Truck becomes the first perk vehicle by taking no off-road terrain speed or handling penalty while preserving world collisions.'],
      ['Interface/accessibility polish', 'Adds a non-colour edge to the Boost meter, fixes the Home header boundary and music-control alignment, and refreshes the startup loading copy.']
    ]
  },
  {
    date: '17 August',
    entries: [
      ['1.9.0 r173', 'Adds MOUNTAIN as TURN’s sixth production track and 1,000-trophy reward: snowy village, long alpine climb, summit river, technical slalom descent, waterfall and cinematic mountain backdrop.'],
      ['MOUNTAIN world', 'Adds procedural alpine ground texture, snow line, batched spruce forest and granite, cozy chalets/inn/chapel/lanterns, Kenney Fantasy Town landmarks, lake, river, waterfall mist and guardrail-aligned containment.'],
      ['MOUNTAIN accessibility', 'Adds a distinct blue Color Cue and Chromatic Camouflage family, six-track achievement semantics and a Drive By Ear map that deliberately changes from flowing climb calls to alternating tight descent calls.']
    ]
  },
  {
    date: '18 August',
    entries: [
      ['1.9.1 r174', 'Turns MOUNTAIN into a moonlit night track and refreshes the release identity after the final alpine art and lighting pass.'],
      ['1.9.1 r175', 'Fixes shared night-headlight activation so MIDNIGHT CITY and MOUNTAIN always reconcile the live named spotlight to the current 2600-intensity, 220 m configuration regardless of module-cache or track activation order.'],
      ['Night MOUNTAIN', 'Adds a horizon-locked star field and moon, moonlit snow and waterfall, warm street-light pools, lit chalet windows and reduced-motion behaviour that keeps the moon while replacing moving stars with a solid night sky.'],
      ['Night-track headlights', 'MOUNTAIN and MIDNIGHT CITY share one shadowless physical spotlight with no projected beam geometry; r174 increases its reach and intensity and moves the emitter closer to the car, while r175 makes those settings authoritative on every install and removes surviving legacy MIDNIGHT CITY projected-headlight nodes.']
    ]
  },
  {
    date: '23 August',
    entries: [
      ['1.9.2 r176', 'Makes the 1,000-trophy RALLY RACER a black-and-gold competition special with four rally lamps, bonnet stripes, rim accents, side rails, a roll hoop and a high rear wing.'],
      ['1.9.3 r177', 'Integrates RALLY RACER’s shorter gold steps into the rocker panels and replaces the conspicuous full-height gold hoop with a compact dark rollover structure.'],
      ['Reusable visual upgrades', 'Adds catalog-selected, bounds-derived vehicle kits that share TURN’s paint and ghost paths while merging their geometry into three low-cost material batches.'],
      ['1.10.0 r179', 'Replaces generated presentation layers with authored Kenney palette detail, semantic body/accent/rim paint and the selected standalone RGSDev Monster Truck.'],
      ['Native surfaces', 'Restores windows, lamps, trim and wheel detail from the source UVs; keeps emergency liveries fixed and removes the procedural RALLY RACER kit.'],
      ['1.10.1 r180', 'Corrects semantic palette UV orientation so factory colors and PAINTJOB affect the authored body, trim and rim cells.'],
      ['1.10.2 r181', 'Renames Sport Sedan to Hatchback, gives it the authored Sport Hatchback model and promotes the former Sport Sedan body to Rally Racer while preserving both cars’ stable gameplay IDs.'],
      ['1.10.3 r182', 'Fixes Vintage Racer secondary PAINTJOB targeting and changes Rally Racer factory paint to #ccc body with #fc0 trim.'],
      ['1.10.4 r183', 'Performance and loading pass: primary-only Color Cues, cheaper achievement updates, batched persistence, filtered DOM observation, earlier background module warmup and deferred rival replay storage.']
    ]
  },
  {
    date: '25–26 August',
    entries: [
      ['1.11.0 r184', 'Playtest-driven driving-feel release combining the new camera behaviour, standard binary DRIFT LOCK, rebalanced Boost and visible front-wheel steering.'],
      ['Camera', 'Adds the optional Drift Camera, gives Classic a 68–78° speed FOV with a 14–18 follow range, lets Zoom reach 88° and keeps reduced-motion play at a stable 68°.'],
      ['DRIFT LOCK and Boost', 'Replaces the progressive experiment with a binary left-pull LOCK using a short smooth transition, connected LOCK bubble and purple-to-green charge feedback; Boost lasts 50% longer and recharges only through Drift.'],
      ['Visible wheel steering', 'Connects the authored front-wheel pivots to steering input so production cars visibly turn their wheels while driving.']
    ]
  },
  {
    date: '29–31 August',
    entries: [
      ['1.12.0 r185', 'Promotes the tested long MOUNTAIN course and introduces the four-tier EASY, MEDIUM, ADVANCED and EXPERT difficulty language.'],
      ['Long MOUNTAIN', 'Adds the lake bridge, lower valley, village tunnel and forest return to production, then smooths the start/finish approach after device playtesting.'],
      ['Difficulty and accessibility', 'Uses green EASY, yellow MEDIUM, orange ADVANCED and red EXPERT badges while keeping the same textual difficulty in track-card ARIA.'],
      ['Unlock information', 'MIDNIGHT CITY now identifies its ADVANCED ≈4.7 km lap; MOUNTAIN identifies its EXPERT ≈3.8 km lap.']
    ]
  },
  {
    date: '1 September',
    entries: [
      ['1.13.2 r190', 'Reflows Settings into a balanced two-column layout, placing Player marker and Color beside Audio while retaining a logical single-column flow on narrow portrait screens.'],
      ['Clearer visual preferences', 'Renames the broad Accessibility heading to Color and gives On, Auto and Off readable full-width rows inside the compact Player marker card.'],
      ['1.13.1 r189', 'Moves the left-handed race-action bar to the bottom-right slot, beside the drive pad and beneath on-screen steering.'],
      ['1.13.0 r188', 'Adds a persistent Left-handed controls setting that applies immediately in TURN and YOUR TURN.'],
      ['Left-handed drive layout', 'Moves only the drive pad to the left, moves on-screen steering to the right when enabled and mirrors BOOST, DRIFT and the outward LOCK gesture without changing their values or touch behaviour.'],
      ['Focused accessibility', 'Keeps HUD and minimap fixed while matching keyboard focus order to the visible BOOST and DRIFT order and exposing explicit on/off descriptions.'],
      ['1.12.2 r187', 'Improves MOUNTAIN performance on the 10.2-inch legacy iPad class by disabling only its global dynamic shadows.'],
      ['Legacy-tablet MOUNTAIN shadows', 'Keeps every streetlight, window glow and player spotlight, leaves DPR unchanged and automatically restores track shadows on every other course.'],
      ['1.12.1 r186', 'Optimizes track loading, first-rival creation and the finished MOUNTAIN village while preserving its complete night-lighting treatment.'],
      ['First-rival finish line', 'Transfers the completed replay buffer without cloning every frame and prepares an empty roster’s hidden rival car before racing starts.'],
      ['Track and MOUNTAIN loading', 'Loads substantial world modules only when selected and skips two retired Holiday-cabin layers instead of constructing and removing them.'],
      ['MOUNTAIN SAFETY', 'Uses a physics-step clean-lap latch at the visible road edge, independent of vehicle off-road perks and containment correction.']
    ]
  },
  {
    date: '2 September',
    entries: [
      ['1.14.4 r195', 'Keeps the SHIFT attribute roll on screen twice as long, with one consistent SHIFT heading.'],
      ['Quieter, resilient SHIFT', 'Announces the complete attribute list only on the first shift of each race, then uses concise state speech. Screenshot, focus and page-resume interruptions now clear stale touch state and restore the SHIFT control.'],
      ['1.14.3 r194', 'Adds clear fixed-lever responses, a rolling three-attribute race summary and exact row-aligned SHIFT / LOCK controls.'],
      ['SHIFT feedback', 'Tapping an automatic 1→2 or 5→4 lever now explains its constraint. Every shift names the three attributes that gain a point beneath Boost and in the live-region announcement.'],
      ['1.14.2 r193', 'Rebuilds SHIFT setup as a six-lever gearbox with clear neutral, gain and reduction positions.'],
      ['SHIFT gearbox', 'Attributes already at one or five begin in their required direction; the third upward choice moves every undetermined lever down and enables Save. Reverting a chosen upward lever returns only automatic reductions to neutral.'],
      ['1.14.1 r192', 'Refines SHIFT after first-device testing with direct +1 attribute buttons, a centered green control and repeat switching without lifting the thumb.'],
      ['SHIFT crossing', 'Every new move from GAS into SHIFT switches on or off; returning to GAS rearms the same held gesture immediately.'],
      ['1.14.0 r191', 'Adds SHIFT as the 1,500-trophy reward: a saved alternate eighteen-point setup for every standard car and a persistent GAS-slide toggle during races.'],
      ['SHIFT setup', 'Choose three attributes to lose one point; the complementary three gain one automatically, with one-to-five limits enforced and each car’s perk retained.'],
      ['Live switching', 'A connected SHIFT button slides out from GAS, latches violet with a visible dot, preserves normalized Boost charge and lowers a reduced top-speed cap smoothly.'],
      ['Accessible control', 'SHIFT is a real pressed-state button with explicit state announcements, keyboard activation and mirrored left-handed placement.']
    ]
  },
  {
    date: '3 September',
    entries: [
      ['1.14.5 r196', 'Keeps the SHIFT attribute roll above the pre-race action bar and gives it a subtle translucent dark backing for consistent readability.'],
      ['Temporary HUD layer', 'Raises the HUD only while SHIFT feedback is visible, then restores the normal controls-over-HUD stacking order.']
    ]
  }
]);

export const CURRENT_RELEASE = Object.freeze({
  version: '1.14.5',
  build: '2026.09.03-r196',
  note: 'TURN 1.14.5 keeps SHIFT feedback readable above the race menu on every track.'
});
