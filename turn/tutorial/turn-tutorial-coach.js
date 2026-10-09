import { TURN_TUTORIAL_LESSONS, TUTORIAL_GRADUATION_MESSAGE } from './turn-tutorial-lessons.js';

// The TURN TUTORIAL coach (#1132): runs the teaching lap's lessons on top of an
// ordinary race. A lesson starts when the car reaches its stretch of COUNTRYSIDE, waits
// for its action (no failure state: a missed lesson simply gives way to the next), and
// eases the car's speed down while it waits. The coach only reads game state; the
// lesson speed cap is the one value it writes, as state.sessionSpeedCap.
const CAP_EASE_PER_SECOND = 12;
const DONE_MESSAGE_SECONDS = 1.4;
// Long enough to read, or hear, a lesson's doneText.
const DONE_TEXT_SECONDS = 4;

// Pace notes play only with sound and DRIVE BY EAR on, through a route channel that is
// ready to play (swoosh-pace-notes.js).
function routeCuesOn() {
  const settings = globalThis.__turnAudioPreferences?.getSettings?.();
  const routeAudio = globalThis.__turnRouteAudio;
  return Boolean(globalThis.__turnSwooshPaceNotes)
    && Boolean(routeAudio?.ready && routeAudio.destination)
    && globalThis.__turnDriveByEarEnabled !== false
    && settings?.audioEnabled !== false
    && settings?.dbeEnabled !== false;
}

// Inputs the lessons are judged on, read from the live game.
export function readTutorialSignals(state = globalThis.__turnRuntime?.state) {
  return {
    progress: Number(state?.progress) || 0,
    speed: Math.max(0, Number(state?.speed) || 0),
    gas: Number(state?.throttle) > 0.2,
    drift: globalThis.__turnDriftHeld === true,
    boostActive: globalThis.__turnBoostActive === true,
    boostCharge: Number.isFinite(globalThis.__turnBoostCharge) ? globalThis.__turnBoostCharge : 1,
    routeCues: routeCuesOn(),
    paceNotes: Number(globalThis.__turnSwooshPaceNotes?.counts?.fired) || 0
  };
}

function lessonAt(lessons, progress) {
  return lessons.find((lesson) => progress >= lesson.from && progress < lesson.to) || null;
}

export function createTurnTutorialCoach({
  state,
  maxSpeed,
  lessons = TURN_TUTORIAL_LESSONS,
  signals = () => readTutorialSignals(state),
  present = () => {}
}) {
  const outcome = new Map(lessons.map((lesson) => [lesson.id, 'pending']));
  const progress = { gasSeconds: 0, driftSeconds: 0, boostSpent: false, boostSeen: false, cueHeard: false, cuesBefore: 0 };
  let current = null;
  let doneFor = 0;
  let finished = false;

  function show(view) {
    present(view);
  }

  function resetProgress() {
    progress.gasSeconds = 0;
    progress.driftSeconds = 0;
    progress.boostSpent = false;
    progress.boostSeen = false;
    progress.cueHeard = false;
  }

  function begin(lesson, input) {
    current = lesson;
    resetProgress();
    progress.cuesBefore = input.paceNotes || 0;
    show({ kind: 'lesson', id: lesson.id, title: lesson.title, prompt: lesson.prompt });
  }

  // A lesson it cannot teach right now, such as READ THE ROAD with DRIVE BY EAR off.
  function skip(lesson) {
    // An unfinished lesson's prompt is still up; a finished one's ✓ times out as usual.
    const showing = current && outcome.get(current.id) !== 'done';
    outcome.set(lesson.id, 'skipped');
    current = null;
    release();
    if (showing) show({ kind: 'idle' });
  }

  function release() {
    state.sessionSpeedCap = null;
  }

  function update(dt) {
    if (finished) return;
    const input = signals();
    const zoned = lessonAt(lessons, input.progress);

    // A new lesson's stretch begins: any earlier lesson still waiting gives way.
    if (zoned && zoned !== current && outcome.get(zoned.id) === 'pending') {
      if (current && outcome.get(current.id) === 'pending') outcome.set(current.id, 'missed');
      if (zoned.needs === 'routeCues' && !input.routeCues) skip(zoned);
      else begin(zoned, input);
    }
    // Cues can stop mid-lesson (SETTINGS during a pause): nothing is left to listen for.
    if (current?.needs === 'routeCues' && outcome.get(current.id) === 'pending' && !input.routeCues) skip(current);

    if (current && outcome.get(current.id) === 'pending') {
      if (input.gas) progress.gasSeconds += dt;
      if (input.drift) progress.driftSeconds += dt;
      if (input.boostActive) progress.boostSeen = true;
      if (progress.boostSeen && input.boostCharge <= 0.2) progress.boostSpent = true;
      if ((input.paceNotes || 0) > progress.cuesBefore) progress.cueHeard = true;

      if (current.done(progress)) {
        outcome.set(current.id, 'done');
        doneFor = current.doneText ? DONE_TEXT_SECONDS : DONE_MESSAGE_SECONDS;
        release();
        show({ kind: 'done', id: current.id, title: current.title, text: current.doneText });
      } else if (current.speedCap && zoned === current) {
        // Ease toward the cap rather than braking the car at the zone edge.
        const target = current.speedCap * maxSpeed;
        const from = Number.isFinite(state.sessionSpeedCap) ? state.sessionSpeedCap : Math.max(target, input.speed);
        state.sessionSpeedCap = Math.max(target, from - CAP_EASE_PER_SECOND * dt);
      } else {
        release();
      }
    } else if (doneFor > 0) {
      doneFor -= dt;
      if (doneFor <= 0) show({ kind: 'idle' });
    }
  }

  // The line: the teaching lap is over and ordinary TURN begins.
  function graduate() {
    if (finished) return;
    if (current && outcome.get(current.id) === 'pending') outcome.set(current.id, 'missed');
    finished = true;
    release();
    show({ kind: 'graduated', message: TUTORIAL_GRADUATION_MESSAGE });
  }

  function stop() {
    finished = true;
    release();
    show({ kind: 'idle' });
  }

  return Object.freeze({
    update,
    graduate,
    stop,
    outcome: () => Object.fromEntries(outcome),
    get finished() { return finished; }
  });
}
