export const TRAINING_BALANCE = 0.95;
export const BALANCE_SUGGESTION_THRESHOLD = 75;
export const TRAINING_CAR_ID = 'classic';
export const SAMPLE_COUNT = 720;
export const FINISH_PROGRESS = 0.94;
export const ROAD_HALF_WIDTH = 13.5;
// The visible tube begins just outside the asphalt. Starting assistance inside the
// road made the car react before touching anything and felt arbitrary on device.
export const RAIL_ASSIST_START = ROAD_HALF_WIDTH + 0.35;
export const RECOVERY_LIMIT = ROAD_HALF_WIDTH + 10;
export const SAFETY_ASSIST_START = RECOVERY_LIMIT - 4;

// Every stage now stores semantic road direction. The shared priority-audio
// calibration owns the physical ear mapping, so tutorials and tracks cannot drift.
const LEFT = -1;
const RIGHT = 1;
const note = (progress, direction, severity, long = false) => Object.freeze({
  progress,
  direction,
  severity,
  long
});
const stage = (definition) => Object.freeze({
  ...definition,
  points: Object.freeze(definition.points.map((point) => Object.freeze(point))),
  notes: Object.freeze(definition.notes)
});

export const TRAINING_STAGES = Object.freeze([
  stage({
    id: 'dbe-training-1',
    title: 'Find the ribbon',
    menuSummary: 'Centre the warm guiding hum on a long straight.',
    lead: 'The warm continuous hum is steering guidance. You begin to the right of the best route. Steer toward the hum until it settles in the centre, then keep it there to the finish.',
    visualHint: 'The yellow guide rails behave like slippery ice rails: they gently guide the car back without stopping it.',
    guideRails: true,
    startOffset: -6,
    outerLimit: RECOVERY_LIMIT,
    points: [[0, 0], [0, 70], [0, 140], [0, 210], [0, 280], [0, 350], [0, 420]],
    notes: []
  }),
  stage({
    id: 'dbe-training-2',
    title: 'Listen ahead',
    menuSummary: 'Hear one gentle right and one broader left before they begin.',
    lead: 'The sharp directional BIPs are pace notes. The ear gives the turn side and the count gives its severity. This course has one gentle right followed later by one broader two-BIP left.',
    visualHint: 'Both cues play on the long approach before their curve. The guide rails remain so you can focus on matching sound to road.',
    guideRails: true,
    startOffset: 0,
    outerLimit: RECOVERY_LIMIT,
    points: [
      [0, 0], [0, 60], [0, 120], [0, 180], [5, 220], [20, 255],
      [50, 282], [90, 298], [140, 300], [200, 300], [250, 310],
      [290, 335], [315, 370], [325, 415], [325, 470], [325, 530]
    ],
    notes: [note(0.10, RIGHT, 1), note(0.49, LEFT, 2)]
  }),
  stage({
    id: 'dbe-training-3',
    title: 'Leave and return',
    menuSummary: 'Use gravel and recovery guidance to rejoin, then hear one right.',
    lead: 'You begin just off the right side of the road. Centred gravel confirms the surface; the warm recovery hum points toward a useful place to rejoin. After the long straight, one BIP in the right ear announces the gentle right.',
    visualHint: 'There are no visible rails along the road. A wider invisible safety zone only intervenes if you travel far away.',
    guideRails: false,
    startOffset: -(ROAD_HALF_WIDTH + 4),
    outerLimit: RECOVERY_LIMIT,
    points: [
      [0, 0], [0, 60], [0, 120], [0, 180], [5, 225], [20, 265],
      [48, 295], [88, 312], [138, 316], [198, 316], [260, 316]
    ],
    notes: [note(0.17, RIGHT, 1)]
  }),
  stage({
    id: 'dbe-training-4',
    title: 'Trust the sequence',
    menuSummary: 'Recognise BIP BIP BEEP before one long tight left.',
    lead: 'BIP BIP BEEP describes one long tight curve: three sounds mean tight, and the held final BEEP means the same curve continues. Hear the complete phrase in the left ear before the single long left begins.',
    visualHint: 'This spacious course contains one uninterrupted curve and no road overlap. Try Blank screen mode when the phrase feels clear.',
    guideRails: false,
    startOffset: 0,
    outerLimit: RECOVERY_LIMIT,
    points: [
      [0, 0], [0, 60], [0, 120], [0, 180], [0, 210], [-6, 239],
      [-22, 263], [-46, 280], [-75, 285], [-104, 280], [-128, 263],
      [-144, 239], [-150, 210], [-150, 160], [-150, 100], [-150, 35]
    ],
    notes: [note(0.16, LEFT, 3, true)]
  }),
  stage({
    id: 'dbe-training-5',
    title: 'Drive by ear',
    menuSummary: 'Combine the ribbon with a linked right–left pace-note sequence.',
    lead: 'Put it together on a spacious course. After the first gentle right, listen for a linked sequence: BIP BIP in the right ear, then BIP BEEP in the left for the long curve immediately after it. Use gravel plus recovery guidance if you leave the road.',
    visualHint: 'The final two curves follow closely without crossing the route. Try Blank screen mode, or keep the course visible and repeat any part from the navigation controls.',
    guideRails: false,
    startOffset: 0,
    outerLimit: RECOVERY_LIMIT,
    points: [
      [0, 0], [0, 70], [0, 140], [0, 210], [5, 250], [20, 285],
      [50, 310], [90, 325], [140, 330], [200, 330], [260, 330],
      [305, 325], [340, 305], [360, 275], [368, 235], [368, 195],
      [375, 160], [395, 130], [425, 108], [465, 95], [510, 94],
      [560, 102], [615, 110], [680, 110]
    ],
    // The matching progress values intentionally enqueue one linked phrase:
    // BIP BIP right, followed by BIP BEEP left.
    notes: [note(0.08, RIGHT, 1), note(0.43, RIGHT, 2), note(0.43, LEFT, 2, true)]
  })
]);
