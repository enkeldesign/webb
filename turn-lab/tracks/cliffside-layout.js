// TURN LAB BEACHFRONT island experiment.
// Production CLIFFSIDE is reused only as the internal LAB slot so TURN keeps the
// mature race, replay, scoring and accessibility runtime while LAB supplies the
// existing BEACHFRONT course as a compact summer island.
export const CLIFFSIDE_CONTROL_POINTS = Object.freeze([
  [0, 0, -250],
  [-70, 0, -258],
  [-140, 0, -252],
  [-205, 0, -225],
  [-245, 0, -175],
  [-260, 0, -110],
  [-252, 0, -40],
  [-225, 0, 18],
  [-248, 0, 78],
  [-238, 0, 140],
  [-205, 0, 195],
  [-150, 0, 228],
  [-85, 0, 238],
  [-25, 0, 225],
  [25, 0, 195],
  [75, 0, 170],
  [125, 0, 185],
  [175, 0, 215],
  [220, 0, 210],
  [252, 0, 180],
  [267, 0, 135],
  [255, 0, 88],
  [225, 0, 48],
  [246, 0, 15],
  [286, 0, -2],
  [310, 0, -35],
  [315, 0, -73],
  [300, 0, -108],
  [267, 0, -135],
  [235, 0, -128],
  [227, 0, -170],
  [210, 0, -210],
  [165, 0, -240],
  [110, 0, -255],
  [55, 0, -250]
].map((point) => Object.freeze(point)));

export const SUBURBS_LAYOUT_RULES = Object.freeze({
  identity: 'suburbs',
  targetLengthMeters: 1900,
  sampleCount: 1440,
  flatCourse: true,
  unlockedInLab: true,
  easyTrack: false,
  islandCourse: true,
  routeNarrative: Object.freeze([
    'start-street',
    'west-neighbourhood',
    'park-s-bend',
    'north-gardens',
    'lakeside-sweeper',
    'cul-de-sac',
    'backyard-run',
    'home-straight'
  ])
});
