export const TRAINING_BALANCE = 0.95;
export const BALANCE_SUGGESTION_THRESHOLD = 75;
export const TRAINING_CAR_ID = 'classic';
export const SAMPLE_COUNT = 720;
export const FINISH_PROGRESS = 0.94;
export const ROAD_HALF_WIDTH = 13.5;
export const RAIL_LIMIT = ROAD_HALF_WIDTH - 1.2;
export const RECOVERY_LIMIT = ROAD_HALF_WIDTH + 10;

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
  points: Object.freeze(definition.points),
  notes: Object.freeze(definition.notes)
});

export const TRAINING_STAGES = Object.freeze([
  stage({
    id: 'dbe-training-1',
    title: 'Find the ribbon',
    lead: 'The warm hum points toward the best route. You begin to the right of it. Steer toward the hum until it settles in the centre, then follow it to the finish.',
    visualHint: 'Watch how the sound moves as you steer. The rails make this first straight forgiving.',
    guideRails: true,
    startOffset: -6,
    outerLimit: RAIL_LIMIT,
    points: [[0, 0], [0, 38], [0, 78], [0, 120], [0, 164], [0, 205]],
    notes: []
  }),
  stage({
    id: 'dbe-training-2',
    title: 'Listen ahead',
    lead: 'Turn sounds play before the curve. The ear gives the direction. One beep means gentle, two means tighter, and a held final beep means the curve lasts longer.',
    visualHint: 'The rails remain for this part so you can focus on matching each sound to the road ahead.',
    guideRails: true,
    startOffset: 0,
    outerLimit: RAIL_LIMIT,
    points: [
      [0, 0], [0, 38], [6, 72], [24, 98], [50, 112], [86, 116],
      [122, 116], [148, 106], [160, 82], [153, 57], [130, 42], [96, 38],
      [62, 38], [34, 27], [20, 4], [23, -24], [43, -47], [74, -60], [112, -61]
    ],
    notes: [note(0.08, RIGHT, 1), note(0.34, LEFT, 2), note(0.62, LEFT, 2, true)]
  }),
  stage({
    id: 'dbe-training-3',
    title: 'Leave and return',
    lead: 'You begin just off the road. Gravel confirms that you are off road, and recovery guidance points toward a useful place to rejoin. Slow down, steer toward the hum and listen for normal guidance to return.',
    visualHint: 'There are no rails along the road now. A nearby invisible safety boundary prevents you from getting lost.',
    guideRails: false,
    startOffset: -(ROAD_HALF_WIDTH + 4),
    outerLimit: RECOVERY_LIMIT,
    points: [[0, 0], [0, 42], [3, 80], [18, 112], [44, 134], [80, 142], [122, 142], [164, 142]],
    notes: [note(0.32, RIGHT, 1)]
  }),
  stage({
    id: 'dbe-training-4',
    title: 'Trust the sequence',
    lead: 'Listen for three beeps before the tight curve. Use the ribbon to settle after it, then follow the next turn without rails along the road.',
    visualHint: 'Ready to rely on the sound? Try Blank screen mode for this part.',
    guideRails: false,
    startOffset: 0,
    outerLimit: RECOVERY_LIMIT,
    points: [
      [0, 0], [0, 42], [-4, 76], [-20, 102], [-48, 116], [-78, 108],
      [-98, 84], [-101, 52], [-88, 24], [-62, 7], [-28, 3], [8, 10], [38, 30], [54, 60]
    ],
    notes: [note(0.22, LEFT, 3), note(0.70, RIGHT, 1)]
  }),
  stage({
    id: 'dbe-training-5',
    title: 'Drive by ear',
    lead: 'Put it together. Follow the ribbon, listen ahead for the turns, and use recovery guidance if you leave the road. Smooth corrections are more useful than chasing every small movement.',
    visualHint: 'Try the graduation run with Blank screen mode, or keep the course visible and train at your own pace.',
    guideRails: false,
    startOffset: 0,
    outerLimit: RECOVERY_LIMIT,
    points: [
      [0, 0], [0, 38], [10, 72], [34, 94], [68, 100], [102, 92],
      [126, 70], [132, 40], [120, 12], [94, -5], [62, -10], [30, -4],
      [5, -18], [-9, -43], [-5, -72], [17, -95], [50, -105], [84, -99],
      [112, -80], [126, -50], [122, -18], [104, 10], [78, 28]
    ],
    notes: [note(0.08, RIGHT, 1), note(0.32, LEFT, 2), note(0.58, RIGHT, 2, true), note(0.79, LEFT, 3)]
  })
]);
