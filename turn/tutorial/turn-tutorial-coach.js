import { turnTutorialLessons, TUTORIAL_GRADUATION_MESSAGE } from './turn-tutorial-lessons.js';

// The TURN TUTORIAL coach (#1132): runs the teaching lap's lessons on top of an
// ordinary race. A lesson starts when the car reaches its stretch of COUNTRYSIDE, waits
// for its action (no failure state: a missed lesson simply gives way to the next), and
// presents a card before practice. Lessons never impose a driving speed cap.
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
    boostOvercharge: Number(globalThis.__turnBoostOvercharge) || 0,
    routeCues: routeCuesOn(),
    paceNotes: Number(globalThis.__turnSwooshPaceNotes?.counts?.fired) || 0
  };
}

function lessonAt(lessons, progress) {
  return lessons.find((lesson) => progress >= lesson.from && progress < lesson.to) || null;
}

function boostResource(input) {
  return Math.max(0, Number(input.boostCharge) || 0) + Math.max(0, Number(input.boostOvercharge) || 0);
}

export function createTurnTutorialCoach({
  state,
  lessons = turnTutorialLessons(state),
  signals = () => readTutorialSignals(state),
  present = () => {},
  isHeld = () => false
}) {
  const outcome = new Map(lessons.map((lesson) => [lesson.id, 'pending']));
  const progress = { gasSeconds: 0, driftSeconds: 0, boostSpent: false, boostSeconds: 0, boostPeak: 0, cueHeard: false, cuesBefore: 0 };
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
    progress.boostSeconds = 0;
    progress.cueHeard = false;
  }

  function begin(lesson, input) {
    current = lesson;
    resetProgress();
    progress.boostPeak = boostResource(input);
    progress.cuesBefore = input.paceNotes || 0;
    show({ kind: 'lesson', id: lesson.id, title: lesson.title, prompt: lesson.prompt, targets: lesson.targets });
  }

  // A lesson it cannot teach right now, such as READ THE ROAD with DRIVE BY EAR off.
  function skip(lesson) {
    // An unfinished lesson's prompt is still up; a finished one's ✓ times out as usual.
    const showing = current && outcome.get(current.id) !== 'done';
    outcome.set(lesson.id, 'skipped');
    current = null;
    if (showing) show({ kind: 'idle' });
  }

  function update(dt) {
    if (finished || isHeld()) return;
    const input = signals();
    const zoned = lessonAt(lessons, input.progress);

    // A new lesson's stretch begins: any earlier lesson still waiting gives way.
    if (zoned && zoned !== current && outcome.get(zoned.id) === 'pending') {
      if (current && outcome.get(current.id) === 'pending') outcome.set(current.id, 'missed');
      if (zoned.needs === 'routeCues' && !input.routeCues) skip(zoned);
      else begin(zoned, input);
      if (isHeld()) return;
    }
    // Cues can stop mid-lesson (SETTINGS during a pause): nothing is left to listen for.
    if (current?.needs === 'routeCues' && outcome.get(current.id) === 'pending' && !input.routeCues) skip(current);

    if (current && outcome.get(current.id) === 'pending') {
      if (input.gas) progress.gasSeconds += dt;
      if (input.drift) progress.driftSeconds += dt;
      if (input.boostActive) progress.boostSeconds += dt;
      const boostLeft = boostResource(input);
      // An empty/partial tank may refill during practice. Measure use from the
      // fullest level seen in this lesson, rather than its possibly empty entry.
      progress.boostPeak = Math.max(progress.boostPeak, boostLeft);
      // A real burst, including OVERCHARGE on replays; a tiny remaining tank may
      // empty sooner. Never count a press that did not consume any resource.
      if (progress.boostSeconds > 0 && boostLeft < progress.boostPeak
        && (progress.boostSeconds >= current.boostPracticeSeconds || boostLeft === 0)) progress.boostSpent = true;
      if ((input.paceNotes || 0) > progress.cuesBefore) progress.cueHeard = true;

      if (current.done(progress)) {
        outcome.set(current.id, 'done');
        doneFor = current.doneText ? DONE_TEXT_SECONDS : DONE_MESSAGE_SECONDS;
        show({ kind: 'done', id: current.id, title: current.title, text: current.doneText });
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
    show({ kind: 'graduated', message: TUTORIAL_GRADUATION_MESSAGE });
  }

  function stop() {
    finished = true;
    show({ kind: 'idle' });
  }

  return Object.freeze({
    start() { if (!current && !finished && lessons.length) begin(lessons[0], signals()); },
    update,
    graduate,
    stop,
    outcome: () => Object.fromEntries(outcome),
    get finished() { return finished; }
  });
}
