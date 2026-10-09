// TURN TUTORIAL teaching lap (#1132): the lessons, as semantic beats placed on
// production COUNTRYSIDE (1,135 m, all left-handers). A lesson is the thing to
// experience; the prompt, speech and speed cap are how it is presented.
//
// from/to: lap progress where the lesson is taught. speedCap: share of the car's top
// speed while the lesson waits for its action (null: no cap, e.g. BOOST must be felt).
// Placement is a first pass for device tuning.
export const TURN_TUTORIAL_LESSONS = Object.freeze([
  Object.freeze({
    id: 'drive',
    title: 'DRIVE',
    prompt: 'Steer into the bend and hold GAS.',
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
    prompt: 'Hold DRIFT through the bend. Drifting refills BOOST.',
    from: 0.47,
    to: 0.58,
    speedCap: 0.4,
    done: (progress) => progress.driftSeconds >= 1.5
  })
]);

export const TUTORIAL_GRADUATION_MESSAGE = 'Tutorial complete. Your lap is now the rival ahead. Catch it!';
