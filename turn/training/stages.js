export const TRAINING_BALANCE = 1;
export const BALANCE_SUGGESTION_THRESHOLD = 75;
export const TRAINING_VEHICLE_ID = 'tractor';
export const SAMPLE_COUNT = 720;
export const FINISH_PROGRESS = 0.94;
export const ROAD_HALF_WIDTH = 13.5;
// The visible tube begins just outside the asphalt. Starting assistance inside the
// road made the car react before touching anything and felt arbitrary on device.
export const RAIL_ASSIST_START = ROAD_HALF_WIDTH + 0.35;
export const RECOVERY_LIMIT = ROAD_HALF_WIDTH + 10;
export const SAFETY_ASSIST_START = RECOVERY_LIMIT - 4;

// Pace notes are SWOOSH swipes generated from each course's centreline, exactly as on
// every track (#909). The texts below name the sides the geometry gives: in TURN's world,
// a road heading +z that bends toward +x is a LEFT bend.
const stage = (definition) => Object.freeze({
  ...definition,
  points: Object.freeze(definition.points.map((point) => Object.freeze(point)))
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
    points: [[0, 0], [0, 70], [0, 140], [0, 210], [0, 280], [0, 350], [0, 420]]
  }),
  stage({
    id: 'dbe-training-2',
    title: 'Listen ahead',
    menuSummary: 'Hear a left and then a right swipe before each bend begins.',
    lead: 'Pace notes are swipes. Each swipe travels out to the ear on the side of the coming bend and ends before the bend begins. Higher pitch means tighter; a slower swipe means a longer bend. A bend of more than 120° is told as linked swipes. This course has a left, then later a right.',
    visualHint: 'The swipes play on the approach to each bend. The guide rails remain so you can focus on matching sound to road.',
    guideRails: true,
    startOffset: 0,
    outerLimit: RECOVERY_LIMIT,
    points: [
      [0, 0], [0, 60], [0, 120], [0, 180], [5, 220], [20, 255],
      [50, 282], [90, 298], [140, 300], [200, 300], [250, 310],
      [290, 335], [315, 370], [325, 415], [325, 470], [325, 530]
    ]
  }),
  stage({
    id: 'dbe-training-3',
    title: 'Leave and return',
    menuSummary: 'Use gravel and recovery guidance to rejoin, then hear one left.',
    lead: 'You begin just off the right side of the road. Centred gravel confirms the surface; the warm recovery hum points toward a useful place to rejoin. Pace notes wait while you are off the road. After the long straight, a slow swipe in the left ear announces the long left.',
    visualHint: 'There are no visible rails along the road. A wider invisible safety zone only intervenes if you travel far away.',
    guideRails: false,
    startOffset: -(ROAD_HALF_WIDTH + 4),
    outerLimit: RECOVERY_LIMIT,
    points: [
      [0, 0], [0, 60], [0, 120], [0, 180], [5, 225], [20, 265],
      [48, 295], [88, 312], [138, 316], [198, 316], [260, 316]
    ]
  }),
  stage({
    id: 'dbe-training-4',
    title: 'Trust the sequence',
    menuSummary: 'Recognise two linked right swipes before one long right.',
    lead: 'Two linked swipes in the right ear describe one long right that turns almost all the way round: each swipe is one half of the same bend. Hear the complete phrase before the bend begins.',
    visualHint: 'This spacious course contains one uninterrupted curve and no road overlap. Try Blank screen mode when the phrase feels clear.',
    guideRails: false,
    startOffset: 0,
    outerLimit: RECOVERY_LIMIT,
    points: [
      [0, 0], [0, 60], [0, 120], [0, 180], [0, 210], [-6, 239],
      [-22, 263], [-46, 280], [-75, 285], [-104, 280], [-128, 263],
      [-144, 239], [-150, 210], [-150, 160], [-150, 100], [-150, 35]
    ]
  }),
  stage({
    id: 'dbe-training-5',
    title: 'Drive by ear',
    menuSummary: 'Combine the ribbon with a linked left–right swipe sequence.',
    lead: 'Put it together on a spacious course. After the first left, listen for a linked sequence: a swipe in the left ear, then a swipe in the right ear for the bend immediately after it. Use gravel plus recovery guidance if you leave the road.',
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
    ]
  })
]);
