// Player-facing milestones, not a deployment diary.
// Keep a feature once, dated to its settled form. Fold testing, tuning, previews,
// rollbacks and implementation-only work into that milestone or omit them.
// History may briefly explain why development mattered; it is not a second log.

export const DEVELOPMENT_HISTORY = Object.freeze([
  {
    "period": "18–25 July 2026",
    "title": "A steering wheel in your hands",
    "paragraphs": [
      "TURN began with a simple idea: rotate a phone or tablet like a steering wheel. Within a week, that experiment had lap timing, saved rivals, a garage and four distinct tracks.",
      "The early work established the game’s character: cars with different strengths, a continuous touch surface for driving, and the freedom to keep circling a track."
    ],
    "milestones": []
  },
  {
    "period": "26 July–9 August",
    "title": "Driving through sound",
    "paragraphs": [
      "Drive By Ear added a guiding ribbon, warnings and spoken feedback, making non-visual racing possible alongside screen-reader support. Blank-screen play, keyboard controls and optional Color Cues followed.",
      "Real-device and VoiceOver testing mattered here: a cue could sound clear in isolation yet be confusing at speed, and a control could appear accessible without being usable. Those tests shaped both the audio and the menus."
    ],
    "milestones": []
  },
  {
    "period": "3–11 August",
    "title": "Reasons to take another lap",
    "paragraphs": [
      "Achievements and Trophy Road gave practice a lasting reward: new cars, paint, tracks and abilities. Emergency vehicles brought sirens and their own challenges; hidden discoveries added reasons to explore.",
      "YOUR TURN let players send a best lap to someone else and build a challenge with up to four rivals. Short links made those growing challenges practical to share."
    ],
    "milestones": []
  },
  {
    "period": "17–31 August",
    "title": "Bigger worlds, better driving feel",
    "paragraphs": [
      "MOUNTAIN became a moonlit alpine journey, later extended through a lake crossing, valley and village tunnel. It joined MIDNIGHT CITY as a longer challenge, with four named difficulty tiers to guide track choice.",
      "Playtesting also shaped the optional Drift Camera, speed-responsive view, DRIFT LOCK and Boost. The aim was to make speed and grip easier to read while preserving the pleasure of simply driving."
    ],
    "milestones": []
  },
  {
    "period": "2–15 September",
    "title": "More ways to master a familiar car",
    "paragraphs": [
      "SHIFT added a second setup to switch to during a race. Vehicle perks gave familiar cars new possibilities, while DRIFT and FLOW made technique worth pursuing alongside lap times.",
      "Trophy Road became a visible route through those rewards. Support challenges helped when progress stalled, and HEAD START taught how to prepare a flying lap. Repeated tuning brought the rewards, explanations and driving actions into agreement."
    ],
    "milestones": []
  },
  {
    "period": "13–22 September",
    "title": "Keeping the world on older devices",
    "paragraphs": [
      "LOW GRAPHICS settled on reducing rendering cost while keeping the same scenery. Softer car shadows, clearer road edges and shared night skies helped the world read at speed.",
      "Device testing changed the early trade-offs: removing scenery or smooth edges cost too much of TURN’s character. The finished approach kept the places intact and made them cheaper to draw."
    ],
    "milestones": []
  },
  {
    "period": "16–17 September",
    "title": "Room to learn by ear",
    "paragraphs": [
      "TRACTOR introduced deliberately slower practice through its SMV perk. DRIVE BY EAR 101 adopted it so players could hear a cue, understand it and reach the bend without rushing.",
      "Its pace and training mix were tuned together. Learning the sound language needed space, not just more instructions."
    ],
    "milestones": []
  },
  {
    "period": "26 September–1 October",
    "title": "ROADBOOK and GARAGE",
    "paragraphs": [
      "Portrait support and an eight-track lineup called for a clearer way to choose a race. ROADBOOK brought real route maps, track records and achievements together; GARAGE focused on one car, with ALL CARS for browsing.",
      "Phone, iPad and enlarged-text testing shaped the layout. The Compact then joined Trophy Road as an early reward, with CLEAN EXIT briefly improving control after a clean drift."
    ],
    "milestones": []
  },
  {
    "period": "29 September–3 October",
    "title": "A game that fits around a day",
    "paragraphs": [
      "Offline play made TURN available after its first download. App-style navigation and PAUSE made interruptions easier to handle, including leaving the app or rotating the screen.",
      "THIS VISIT gave each outing a natural ending: a summary of laps, records and rewards when the player chooses to leave. Background updates wait for a restart so a race can finish on the version it started with."
    ],
    "milestones": []
  },
  {
    "period": "1–3 October",
    "title": "Hearing the shape of a bend",
    "paragraphs": [
      "SWOOSH replaced the old beeps with a ringing chime that travels toward the bend’s side. Pitch conveys tightness; duration conveys length. Track geometry supplies the cues.",
      "Listening tests and driving tests explored how clearly direction, length and linked bends could be distinguished. They led to the sustained chime, then a lighter sound without an echo effect to avoid stutters on older devices."
    ],
    "milestones": []
  },
  {
    "period": "2–4 October",
    "title": "Clearer at a glance",
    "paragraphs": [
      "Dark mode carried TURN’s colours into a quieter setting, with System, Light and Dark choices. Testing across menus, controls and loading screens was needed to keep text and state changes readable.",
      "The Track sheet also gained a rival overview: cars, colours and lap times together before entering the track. The growing game became easier to inspect without starting a race."
    ],
    "milestones": []
  },
  {
    "period": "9 October",
    "title": "A taste of the next reward",
    "paragraphs": [
      "PATROL follows the HOW TO PLAY challenge with a temporary drive through MIDNIGHT CITY in the POLICE CAR. One valid lap completes it, with an optional second lap before returning Home. Unfinished attempts can be retried while normal Trophy Road unlocks stay in charge."
    ],
    "milestones": []
  }
]);
// Oldest first; the reader shows recent dates first and folds earlier milestones.
// Use the actual completion date, including the year, rather than the append date.
export const CHANGELOG = Object.freeze([
  {
    "date": "25 July 2026",
    "entries": [
      [
        "The first full racer",
        "Tilt steering, touch driving, lap timing, saved rivals and a fifteen-car garage. COUNTRYSIDE, AIRPORT, CLIFFSIDE and HARBOR each have their own records."
      ]
    ]
  },
  {
    "date": "1 August 2026",
    "entries": [
      [
        "MIDNIGHT CITY",
        "A long night course through city districts, parks and a neon skyline."
      ]
    ]
  },
  {
    "date": "6 August 2026",
    "entries": [
      [
        "Achievements and Trophy Road",
        "Permanent trophies unlock cars, tracks, paint and abilities. Emergency vehicles bring lights, sirens and special challenges; hidden discoveries reward exploration."
      ]
    ]
  },
  {
    "date": "8 August 2026",
    "entries": [
      [
        "YOUR TURN",
        "Share a best lap through a short challenge link. Friends can race it, add their own lap and pass on a field of up to four rivals."
      ]
    ]
  },
  {
    "date": "9 August 2026",
    "entries": [
      [
        "More ways to play",
        "Drive By Ear, blank-screen racing, screen-reader and keyboard support, plus optional Color Cues for track and paint colours."
      ]
    ]
  },
  {
    "date": "26 August 2026",
    "entries": [
      [
        "Driving feel",
        "Optional Drift Camera, a speed-responsive view, DRIFT LOCK, longer Boost and front wheels that visibly steer."
      ]
    ]
  },
  {
    "date": "31 August 2026",
    "entries": [
      [
        "Long MOUNTAIN",
        "A moonlit alpine course with a lake bridge, valley and village tunnel. Track difficulty uses EASY, MEDIUM, ADVANCED and EXPERT."
      ]
    ]
  },
  {
    "date": "1 September 2026",
    "entries": [
      [
        "Left-handed controls",
        "Mirror the drive pad and on-screen steering in TURN and YOUR TURN."
      ]
    ]
  },
  {
    "date": "3 September 2026",
    "entries": [
      [
        "SHIFT and vehicle perks",
        "Save an alternate car setup and switch during a race. Earn perks that give familiar cars distinctive ways to drive."
      ]
    ]
  },
  {
    "date": "5 September 2026",
    "entries": [
      [
        "DRIFT and FLOW",
        "Score driving technique alongside lap times, with separate track records and achievement targets."
      ],
      [
        "A new Trophy Road",
        "Follow a visible road of rewards, see what comes next and inspect each unlock. Existing players keep earned rewards."
      ]
    ]
  },
  {
    "date": "6 September 2026",
    "entries": [
      [
        "Deliberate reverse",
        "BRAKE stops the car; a separate R control selects reverse."
      ]
    ]
  },
  {
    "date": "8 September 2026",
    "entries": [
      [
        "SUPERCAR and FLOW SHIFT",
        "A new reward car and an advanced SHIFT ability extend the later stages of progression."
      ]
    ]
  },
  {
    "date": "11 September 2026",
    "entries": [
      [
        "Track soundtracks",
        "Distinct music gives each course its own atmosphere, with a saved volume setting and an OFF option."
      ]
    ]
  },
  {
    "date": "14 September 2026",
    "entries": [
      [
        "Support challenges",
        "Optional challenges offer a way forward when trophy progress stalls, with a suggested track and car."
      ],
      [
        "HEAD START",
        "A flying-lap lesson: carry OVERCHARGE over the line, spend it on the next lap and beat the setup time."
      ]
    ]
  },
  {
    "date": "17 September 2026",
    "entries": [
      [
        "TRACTOR and audio practice",
        "The slow-moving TRACTOR joins the garage and DRIVE BY EAR 101, giving non-visual practice a gentler pace."
      ]
    ]
  },
  {
    "date": "20 September 2026",
    "entries": [
      [
        "Lighter graphics",
        "LOW GRAPHICS keeps the full scenery while reducing rendering cost. Soft car shadows follow the road in both graphics modes."
      ]
    ]
  },
  {
    "date": "22 September 2026",
    "entries": [
      [
        "Night scenery",
        "MOUNTAIN and MIDNIGHT CITY gain shared stars and moonlight; MIDNIGHT CITY adds a fuller streetscape."
      ]
    ]
  },
  {
    "date": "27 September 2026",
    "entries": [
      [
        "Eight tracks",
        "BEACHFRONT and DEAD CANYON join the lineup. Trophy Road unlocks track difficulty tiers, with separate records, rivals and achievements for every course."
      ]
    ]
  },
  {
    "date": "29 September 2026",
    "entries": [
      [
        "Offline play",
        "Download TURN once, then choose a car and track and race without a connection."
      ]
    ]
  },
  {
    "date": "30 September 2026",
    "entries": [
      [
        "ROADBOOK and GARAGE",
        "Route maps and track records lead into a focused car view with ALL CARS browsing. Layouts support portrait, landscape, iPad and enlarged text."
      ],
      [
        "Track achievements",
        "See each track’s earned and available achievements, progress and next suggested goal directly on its Track sheet."
      ]
    ]
  },
  {
    "date": "1 October 2026",
    "entries": [
      [
        "Compact",
        "An early car reward at 300 trophies. CLEAN EXIT briefly adds control after a clean drift."
      ],
      [
        "FULL TANK",
        "The SUV’s clean-driving perk refills Boost as its tank capacity grows."
      ]
    ]
  },
  {
    "date": "3 October 2026",
    "entries": [
      [
        "SWOOSH pace notes",
        "Ringing directional chimes describe upcoming bends through pitch and length, including linked turns. DRIVE BY EAR 101 teaches the new cues."
      ],
      [
        "Dark mode",
        "Choose System, Light or Dark. Menus, garage, race controls and loading screens share the theme."
      ],
      [
        "PAUSE and navigation",
        "Pause and resume the same lap. App interruptions and screen rotation are handled safely; Back and swipe gestures move through screens and sheets."
      ],
      [
        "THIS VISIT",
        "See your laps, records and rewards while paused and after leaving a race, with a suggestion for what to try next."
      ],
      [
        "Steering centred",
        "Visual, spoken and audio feedback confirms when device steering has centred, including after recalibration."
      ]
    ]
  },
  {
    "date": "4 October 2026",
    "entries": [
      [
        "Rival overview",
        "Inspect a track’s saved rival cars, paint and lap times on the Track sheet, and reset that track’s rivals there."
      ]
    ]
  },
  {
    "date": "9 October 2026",
    "entries": [
      [
        "PATROL reward preview",
        "Try MIDNIGHT CITY and the POLICE CAR before unlocking them. Complete one valid lap to clear PATROL, with up to two completed laps per preview and retries for unfinished attempts."
      ]
    ]
  }
]);
