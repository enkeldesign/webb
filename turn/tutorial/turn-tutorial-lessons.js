// TURN TUTORIAL teaching lap (#1132): the lessons, as semantic beats placed on
// production COUNTRYSIDE (1,135 m, every bend to the right): the opening bend (4–16% of
// the lap), a short straight (16–24%), one long curve (24–79%) and the bend through the
// line. A lesson is the thing to experience; the prompt, speech and pause are how
// it is presented. DRIFT comes where the long curve begins, BOOST after it (#1166).
//
// from/to: lap progress where the lesson is taught. The first target is the action
// that releases the teaching hold; all practice runs at ordinary gameplay speed.
// doneText: said when it is done. keyboardPrompt: the prompt for players driving by
// keyboard, where it differs. needs: 'routeCues' for a lesson that needs DRIVE BY
// EAR's pace notes; with them off it is skipped. Placement is a first pass for device
// tuning.
export const TURN_TUTORIAL_LESSONS = Object.freeze([
  Object.freeze({
    id: 'drive',
    title: 'DRIVE',
    prompt: 'Hold GAS to drive off, then steer into the bend.',
    // With Tutorial steering help on (steering-help.js).
    assistedPrompt: 'Steering help is on: TURN steers. Hold GAS to drive off.',
    from: 0,
    to: 0.14,
    targets: ['.drive-gas-zone'],
    // About a second and a half of GAS is enough to have felt the car respond.
    done: (progress) => progress.gasSeconds >= 1.5
  }),
  Object.freeze({
    // Pause at the long curve's entry (~24.3%), so the same DRIFT press starts
    // practice in the bend rather than on the preceding straight (#1204).
    id: 'drift',
    title: 'DRIFT',
    // LOCK is on the drive pad from the first lap, so it is named here, where DRIFT is.
    // It is offered, not required: the slide is the lesson.
    prompt: 'Hold DRIFT through the turn. Slide outward into LOCK for a stronger slide.',
    // LOCK has no key (input/qe-drive-controls.js): keyboard players are told only DRIFT.
    keyboardPrompt: 'Hold DRIFT through the turn.',
    from: 0.245,
    to: 0.53,
    targets: ['.drive-drift-zone'],
    // Time to feel a sustained slide, with more of the bend free before BOOST.
    done: (progress) => progress.driftSeconds >= 4
  }),
  Object.freeze({
    // The real burst, without a teaching speed cap. Course rescue remains available.
    id: 'boost',
    title: 'BOOST',
    prompt: 'Hold BOOST. Feel the acceleration and watch the meter drop.',
    // BOOST starts the lap full, so the refill is said once it has been spent: still in
    // the long curve, where the next slide shows it.
    doneText: 'Drifting refills BOOST.',
    // At maximum LEARNER CAR BOOST speed the next chime can start near 65%.
    // A visible burst fits here; emptying the 5.61 s tank would miss that cue.
    from: 0.53,
    to: 0.63,
    boostPracticeSeconds: 1,
    targets: ['.drive-boost-zone'],
    done: (progress) => progress.boostSpent
  }),
  Object.freeze({
    // READ THE ROAD: the pace note for the second bend, which starts at 78% of the lap.
    // It is taught by hearing it, not by a recognition test: the lesson is done when
    // the cue plays, and the text says what it meant at that moment.
    id: 'read',
    title: 'READ THE ROAD',
    // Explain pitch during the teaching hold, before the chime's short steering lead.
    prompt: 'Listen. A chime sweeps toward the next bend. Higher means tighter.',
    doneText: 'That chime was the bend ahead.',
    from: 0.63,
    to: 0.8,
    needs: 'routeCues',
    done: (progress) => progress.cueHeard
  })
]);

// GRADUATED replays can reach 129.888 m/s under BOOST (90.9216 without the perk).
// Their following chime is due near 59%, so reserve an earlier listening window.
// Select once for the run: a perk building/resetting mid-lesson must not move a hold.
// DRIFT still gets more of the curve and two seconds of practice at that higher speed.
const GRADUATED_LESSONS = Object.freeze(TURN_TUTORIAL_LESSONS.map((lesson) => {
  if (lesson.id === 'drift') return Object.freeze({ ...lesson, to: 0.445, done: (progress) => progress.driftSeconds >= 2 });
  if (lesson.id === 'boost') return Object.freeze({ ...lesson, from: 0.445, to: 0.575 });
  if (lesson.id === 'read') return Object.freeze({ ...lesson, from: 0.575 });
  return lesson;
}));

export function turnTutorialLessons(state) {
  return state?.vehicleId === 'classic' && state.vehiclePerkUnlocked === true
    ? GRADUATED_LESSONS : TURN_TUTORIAL_LESSONS;
}

export const TUTORIAL_GRADUATION_MESSAGE = 'Tutorial complete! The ghost of your last lap is now your rival. Can you beat it?';
// Help never pretends to be the player's own steering: it ends at the line, and says so.
export const TUTORIAL_GRADUATION_WITH_HELP_MESSAGE = 'Tutorial complete! Steering help ends here. The ghost of your last lap is now your rival. Can you beat it?';
// After repeated rescues with help off: where the stronger help is.
export const STEERING_HELP_HINT = Object.freeze({
  title: 'STEERING HELP',
  text: 'Want TURN to steer? Pause, open SETTINGS and turn on Tutorial steering help.'
});
