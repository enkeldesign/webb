// TURN LAB MOUNTAIN long-course experiment.
// Production MOUNTAIN remains untouched. The first summit/cliff sequence is retained,
// then the former short return opens into a lake bridge and a broad lower-valley loop.
// The lower course deliberately alternates fast open runs and readable bends rather
// than adding another uninterrupted wall of hairpins.
export const MOUNTAIN_CONTROL_POINTS = Object.freeze([
  Object.freeze([0, 0, -220]),
  Object.freeze([-42, 1, -212]),
  Object.freeze([-95, 3, -190]),
  Object.freeze([-150, 6, -155]),
  Object.freeze([-198, 10, -110]),
  Object.freeze([-228, 14, -55]),
  Object.freeze([-240, 18, 10]),
  Object.freeze([-226, 22, 75]),
  Object.freeze([-198, 26, 125]),
  Object.freeze([-158, 30, 158]),
  Object.freeze([-105, 34, 178]),
  Object.freeze([-45, 38, 190]),
  Object.freeze([20, 42, 194]),
  Object.freeze([84, 45, 187]),
  Object.freeze([138, 47, 168]),
  Object.freeze([176, 49, 138]),
  Object.freeze([191, 49, 105]),

  // Existing summit river and breathing-space bend.
  Object.freeze([178, 48, 82]),
  Object.freeze([150, 46, 68]),
  Object.freeze([95, 43, 62]),

  // Existing front-face slalom and waterfall descent.
  Object.freeze([32, 41, 62]),
  Object.freeze([2, 38, 42]),
  Object.freeze([8, 35, 20]),
  Object.freeze([58, 32, 12]),
  Object.freeze([122, 29, 15]),
  Object.freeze([151, 26, -2]),
  Object.freeze([145, 23, -24]),
  Object.freeze([102, 20, -39]),
  Object.freeze([42, 17, -43]),
  Object.freeze([2, 14, -57]),
  Object.freeze([-8, 11, -78]),
  Object.freeze([22, 8, -94]),
  Object.freeze([80, 6, -99]),
  Object.freeze([125, 4.5, -114]),
  Object.freeze([137, 3.2, -137]),

  // New lake approach. The straight section from x=160..350 crosses the existing
  // waterfall lake and is dressed as a real Kenney City Kit Roads bridge.
  Object.freeze([145, 3.0, -155]),
  Object.freeze([145, 3.0, -178]),
  Object.freeze([160, 3.0, -200]),
  Object.freeze([205, 3.0, -205]),
  Object.freeze([255, 3.0, -205]),
  Object.freeze([305, 3.0, -205]),
  Object.freeze([350, 3.0, -210]),

  // East-valley descent and the long southern release section. Moving the lower
  // run beyond the production terrain edge creates real separation from the
  // forest return instead of two overlapping track envelopes.
  Object.freeze([400, 2.8, -245]),
  Object.freeze([410, 2.4, -300]),
  Object.freeze([390, 2.0, -350]),
  Object.freeze([330, 1.7, -370]),
  Object.freeze([240, 1.4, -372]),
  Object.freeze([140, 1.1, -374]),
  Object.freeze([40, 0.9, -375]),
  Object.freeze([-60, 0.8, -374]),
  Object.freeze([-160, 0.9, -370]),
  Object.freeze([-250, 1.0, -360]),
  Object.freeze([-330, 1.2, -335]),

  // Lower village: one broad, readable sweep instead of another hairpin wall.
  Object.freeze([-385, 1.5, -300]),
  Object.freeze([-405, 1.8, -245]),
  Object.freeze([-395, 2.1, -190]),
  Object.freeze([-365, 2.4, -145]),
  Object.freeze([-325, 2.7, -120]),
  Object.freeze([-285, 3.0, -135]),
  Object.freeze([-260, 3.3, -170]),
  Object.freeze([-250, 3.6, -215]),

  // Forest return and final climb. This parallel leg stays roughly 80 metres
  // from the southern run, then makes one deliberate climbing hairpin before
  // reconnecting with the original village start.
  Object.freeze([-240, 3.0, -255]),
  Object.freeze([-190, 2.7, -282]),
  Object.freeze([-120, 2.4, -286]),
  Object.freeze([-40, 2.1, -288]),
  Object.freeze([40, 1.8, -286]),
  Object.freeze([95, 1.6, -282]),
  Object.freeze([125, 2.4, -262]),
  Object.freeze([125, 4.0, -240]),
  Object.freeze([100, 6.0, -218]),
  Object.freeze([65, 4.2, -207]),
  Object.freeze([30, 1.7, -214])
]);

export const MOUNTAIN_BRIDGE_CENTERS = Object.freeze([
  Object.freeze({ x: 176, z: -202 }),
  Object.freeze({ x: 208, z: -204 }),
  Object.freeze({ x: 240, z: -205 }),
  Object.freeze({ x: 272, z: -206 }),
  Object.freeze({ x: 304, z: -208 }),
  Object.freeze({ x: 336, z: -209 })
]);

// The east-valley peak used by the first tunnel is deliberately retired: the
// lake bridge is the landmark in that section and the road now releases into
// open valley immediately afterwards. Keep the lower-village peak as the one
// authored tunnel mountain.
export const MOUNTAIN_REMOVED_EAST_PEAK = Object.freeze({
  id: 'east-valley-open-pass',
  x: 432,
  z: -266,
  radius: 148,
  height: 151
});

export const MOUNTAIN_TUNNEL_SPECS = Object.freeze([
  Object.freeze({
    id: 'lower-village',
    start: Object.freeze({ x: -330, z: -335 }),
    end: Object.freeze({ x: -325, z: -120 }),
    peak: Object.freeze({ x: -392, z: -228, radius: 132, height: 136 }),
    // The visible mouth begins only where the cone has enough rock above it
    // to read as part of the mountain. The wider hidden cut covers TURN's
    // complete no-drop envelope plus the low-speed chase-camera offset.
    portalRadius: 84,
    halfWidth: 21,
    clearHeight: 18,
    carveHalfWidth: 34,
    carveClearHeight: 23
  })
]);

export const MOUNTAIN_LOWER_VILLAGE_SITES = Object.freeze([
  Object.freeze({ x: -385, z: -300, side: 1 }),
  Object.freeze({ x: -405, z: -245, side: -1 }),
  Object.freeze({ x: -395, z: -190, side: 1 }),
  Object.freeze({ x: -365, z: -145, side: -1 }),
  Object.freeze({ x: -325, z: -120, side: 1 }),
  Object.freeze({ x: -285, z: -135, side: -1 }),
  Object.freeze({ x: -260, z: -170, side: 1 }),
  Object.freeze({ x: -250, z: -215, side: -1 })
]);

export const MOUNTAIN_VIEW_SCREEN_SPECS = Object.freeze([
  Object.freeze({ x: 250, z: -300, sx: 34, sy: 14, sz: 18, yaw: 0.18 }),
  Object.freeze({ x: 350, z: -285, sx: 22, sy: 11, sz: 16, yaw: -0.22 }),
  Object.freeze({ x: -95, z: -330, sx: 24, sy: 10, sz: 12, yaw: 0.30 })
]);

export const MOUNTAIN_LOWER_TERRAIN_BOUNDS = Object.freeze({
  minX: -480,
  maxX: 460,
  minZ: -430,
  maxZ: -292,
  segmentsX: 94,
  segmentsZ: 28
});

export const MOUNTAIN_LAYOUT_RULES = Object.freeze({
  villageControlPoint: 0,
  summitStartControlPoint: 14,
  riverControlPoint: 17,
  slalomStartControlPoint: 20,
  waterfallControlPoint: 34,
  bridgeStartControlPoint: 37,
  bridgeEndControlPoint: 41,
  valleyStartControlPoint: 42,
  lowerRunControlPoint: 44,
  lowerVillageControlPoint: 53,
  forestReturnControlPoint: 61,
  finalClimbControlPoint: 67,
  snowLineElevation: 37,
  minimumElevation: 0,
  maximumElevation: 49,
  targetLength: 'long-course-about-2.1-times-production-mountain',
  noDropCourse: true,
  routeNarrative: Object.freeze([
    'village',
    'forest-climb',
    'backside',
    'snow-summit',
    'river',
    'slalom-descent',
    'waterfall',
    'lake-bridge',
    'east-valley-descent',
    'lower-run',
    'lower-village-tunnel',
    'lower-village',
    'forest-return',
    'final-climb',
    'village-return'
  ])
});
