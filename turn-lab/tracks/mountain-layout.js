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

  // East valley turn and the long southern release section.
  Object.freeze([388, 2.8, -245]),
  Object.freeze([378, 2.4, -285]),
  Object.freeze([338, 2.0, -305]),
  Object.freeze([270, 1.6, -308]),
  Object.freeze([180, 1.3, -309]),
  Object.freeze([90, 1.1, -308]),
  Object.freeze([0, 0.9, -306]),
  Object.freeze([-90, 0.8, -305]),
  Object.freeze([-180, 0.9, -305]),
  Object.freeze([-255, 1.0, -298]),

  // Lower village / forest side: a broad hooked return, intentionally well away
  // from the upper road so the track-envelope cannot become an accidental shortcut.
  Object.freeze([-315, 1.2, -280]),
  Object.freeze([-350, 1.5, -250]),
  Object.freeze([-355, 1.8, -215]),
  Object.freeze([-342, 2.1, -180]),
  Object.freeze([-315, 2.3, -153]),
  Object.freeze([-282, 2.3, -167]),
  Object.freeze([-258, 2.2, -190]),
  Object.freeze([-242, 2.0, -218]),
  Object.freeze([-218, 1.8, -242]),
  Object.freeze([-178, 1.5, -262]),
  Object.freeze([-128, 1.2, -271]),
  Object.freeze([-73, 1.0, -272]),
  Object.freeze([-18, 0.8, -270]),
  Object.freeze([30, 0.7, -266]),
  Object.freeze([68, 0.6, -254]),
  Object.freeze([92, 0.5, -240]),
  Object.freeze([98, 0.4, -228]),
  Object.freeze([85, 0.3, -219]),
  Object.freeze([62, 0.2, -214]),
  Object.freeze([35, 0.1, -216])
]);

export const MOUNTAIN_LAYOUT_RULES = Object.freeze({
  villageControlPoint: 0,
  summitStartControlPoint: 14,
  riverControlPoint: 17,
  slalomStartControlPoint: 20,
  waterfallControlPoint: 34,
  bridgeStartControlPoint: 37,
  bridgeEndControlPoint: 41,
  valleyStartControlPoint: 42,
  lowerVillageControlPoint: 52,
  snowLineElevation: 37,
  minimumElevation: 0,
  maximumElevation: 49,
  targetLength: 'long-course-about-twice-production-mountain',
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
    'east-valley',
    'southern-run',
    'lower-village',
    'forest-return',
    'village-return'
  ])
});
