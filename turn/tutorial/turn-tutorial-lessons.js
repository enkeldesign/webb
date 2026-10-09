// TURN TUTORIAL teaching lap (#1132): the lessons, as semantic beats placed on
// production COUNTRYSIDE (1,135 m: a short straight and two long bends). A lesson is
// the thing to experience; the prompt, speech and speed cap are how it is presented.
//
// from/to: lap progress where the lesson is taught. speedCap: share of the car's top
// speed while the lesson waits for its action (null: no cap, e.g. BOOST must be felt).
// doneText: said when it is done. keyboardPrompt: the prompt for players driving by
// keyboard, where it differs. needs: 'routeCues' for a lesson that needs DRIVE BY
// EAR's pace notes; with them off it is skipped. Placement is a first pass for device
// tuning.
export const TURN_TUTORIAL_LESSONS = Object.freeze([
  Object.freeze({
    id: 'drive',
    title: 'DRIVE',
    prompt: 'Steer into the bend and hold GAS.',
    // With Tutorial steering help on (steering-help.js).
    assistedPrompt: 'Steering help is on: TURN steers. Hold GAS.',
    from: 0,
    to: 0.12,
    speedCap: 0.3,
    // About a second and a half of GAS is enough to have felt the car respond.
    done: (progress) => progress.gasSeconds >= 1.5
  }),
  Object.freeze({
    id: 'boost',
    title: 'BOOST',
    prompt: 'Press BOOST and watch the meter empty.',
    from: 0.15,
    to: 0.3,
    speedCap: null,
    done: (progress) => progress.boostSpent
  }),
  Object.freeze({
    id: 'drift',
    title: 'DRIFT',
    // LOCK is on the drive pad from the first lap, so it is named here, where DRIFT is.
    // It is offered, not required: the slide is the lesson.
    prompt: 'Hold DRIFT through the bend. Slide outward into LOCK for a stronger slide.',
    // LOCK has no key (input/qe-drive-controls.js): keyboard players are told only DRIFT.
    keyboardPrompt: 'Hold DRIFT through the bend.',
    doneText: 'Drifting refills BOOST.',
    from: 0.47,
    to: 0.58,
    speedCap: 0.4,
    done: (progress) => progress.driftSeconds >= 1.5
  }),
  Object.freeze({
    // READ THE ROAD: the pace note for the second bend, which starts at 78% of the lap.
    // It is taught by hearing it, not by a recognition test: the lesson is done when
    // the cue plays, and the text says what it meant at that moment.
    id: 'read',
    title: 'READ THE ROAD',
    prompt: 'Listen. A chime sweeps toward the next bend before you reach it.',
    doneText: 'That chime was the bend ahead. Higher means tighter.',
    from: 0.6,
    to: 0.8,
    speedCap: 0.4,
    needs: 'routeCues',
    done: (progress) => progress.cueHeard
  })
]);

export const TUTORIAL_GRADUATION_MESSAGE = 'Tutorial complete. Your lap is now the rival ahead. Catch it!';
// Help never pretends to be the player's own steering: it ends at the line, and says so.
export const TUTORIAL_GRADUATION_WITH_HELP_MESSAGE = 'Tutorial complete. Steering help ends here. Your lap is now the rival ahead. Catch it!';
// After repeated rescues with help off: where the stronger help is.
export const STEERING_HELP_HINT = Object.freeze({
  title: 'STEERING HELP',
  text: 'Want TURN to steer? Pause, open SETTINGS and turn on Tutorial steering help.'
});
