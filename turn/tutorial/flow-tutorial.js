import { createTutorialPrompt } from './tutorial-prompt.js';

// FLOW TUTORIAL (#1149): one teaching lap that points out what earns FLOW, as the FLOW
// meter scores it (scoring/flow-runtime.js), then has the player chain techniques into
// COMBO. Lessons follow each other. There is no failure state: a chain that runs out
// is said, and the next one counts.
//
// Lesson cards hold the race while teaching; practice keeps ordinary driving speed.
export const FLOW_LESSONS = Object.freeze([
  Object.freeze({
    id: 'slide',
    targets: ['.drive-drift-zone'],
    title: 'DRIFT AND EXIT',
    prompt: 'Hold DRIFT through the bend, then straighten out. FLOW scores both: DRIFT, then a clean EXIT.',
    done: (progress) => progress.techniques.has('drift')
  }),
  Object.freeze({
    id: 'combo',
    targets: ['.drive-drift-zone', '.drive-boost-zone'],
    title: 'COMBO',
    prompt: 'Now all three in a row, each within 5 seconds: DRIFT, a clean EXIT, then BOOST.',
    doneText: 'That is a COMBO. Each different technique in a row raises it.',
    // BOOST, the move it asks for, at COMBO ×2 or more: one slide with LOCK scores LOCK,
    // DRIFT and EXIT, already ×2, and is not yet the chain the lesson is about.
    done: (progress) => progress.last === 'boost' && progress.multiplier >= 2
  })
]);

export const FLOW_CHAIN_ENDED_PROMPT = 'The chain ran out. Start again: DRIFT, a clean EXIT, then BOOST within 5 seconds.';
export const FLOW_GRADUATION_MESSAGE = 'Tutorial complete. LOCK, CATCH and SHIFT count too: mix them to climb higher.';
export const FLOW_PRACTICE_MESSAGE = 'Tutorial complete. Keep chaining: DRIFT, a clean EXIT, then BOOST.';

const DONE_TEXT_SECONDS = 3;
const GRADUATION_SECONDS = 4;

// The coach reads FLOW's own announcements: each technique it scores, with the COMBO
// it reached, and the chain running out. It writes nothing to the game.
export function createFlowCoach({ lessons = FLOW_LESSONS, present = () => {}, isHeld = () => false }) {
  const outcome = new Map(lessons.map((lesson) => [lesson.id, 'pending']));
  const progress = { techniques: new Set(), last: '', multiplier: 1 };
  let current = null;
  let nextIndex = 0;
  let doneLeft = 0;
  let finished = false;

  function begin(index, prompt = null) {
    current = lessons[index];
    nextIndex = index + 1;
    present({ kind: 'lesson', id: current.id, title: current.title, prompt: prompt || current.prompt, targets: current.targets });
  }

  function complete() {
    const lesson = current;
    outcome.set(lesson.id, 'done');
    current = null;
    if (lesson.doneText) {
      present({ kind: 'done', id: lesson.id, title: lesson.title, text: lesson.doneText });
      doneLeft = DONE_TEXT_SECONDS;
    } else if (nextIndex < lessons.length) {
      // Straight on: the chain is already running.
      begin(nextIndex);
    }
  }

  function technique(detail) {
    if (finished || isHeld()) return;
    if (detail?.technique) progress.techniques.add(detail.technique);
    progress.last = detail?.technique || '';
    progress.multiplier = Math.max(1, Number(detail?.multiplier) || 1);
    if (current?.done(progress)) complete();
  }

  function chainEnded() {
    if (finished || isHeld()) return;
    progress.techniques.clear();
    progress.last = '';
    progress.multiplier = 1;
    if (current?.id === 'combo') present({ kind: 'lesson', id: current.id, title: current.title, prompt: FLOW_CHAIN_ENDED_PROMPT, hold: false });
  }

  function update(dt) {
    if (finished || isHeld()) return;
    if (doneLeft > 0) {
      doneLeft -= dt;
      if (doneLeft <= 0) present({ kind: 'idle' });
      return;
    }
    if (!current) {
      if (nextIndex >= lessons.length) return;
      begin(nextIndex);
    }
  }

  function graduate() {
    if (finished) return;
    finished = true;
    for (const [id, status] of outcome) if (status === 'pending') outcome.set(id, 'missed');
    const message = [...outcome.values()].every((status) => status === 'done')
      ? FLOW_GRADUATION_MESSAGE
      : FLOW_PRACTICE_MESSAGE;
    present({ kind: 'graduated', message });
  }

  function stop() {
    finished = true;
  }

  return Object.freeze({
    update,
    technique,
    chainEnded,
    graduate,
    stop,
    outcome: () => Object.fromEntries(outcome),
    get lesson() { return current?.id || null; }
  });
}

// One run of the FLOW TUTORIAL coach. Paused races do not advance it.
export function startFlowCoach({ runtime, events = globalThis }) {
  const { state } = runtime;
  const prompt = createTutorialPrompt();
  const coach = createFlowCoach({ present: prompt.present, isHeld: () => prompt.holding });
  coach.update(0);
  const onFlow = (event) => {
    if (event.detail?.type === 'technique') coach.technique(event.detail);
    else if (event.detail?.type === 'chain-expired') coach.chainEnded();
  };
  let frame = 0;
  let last = 0;
  let stopped = false;
  let graduationLeft = 0;

  const tick = (now) => {
    if (stopped) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (state.running && !prompt.holding && globalThis.__turnRacePause?.paused !== true) {
      coach.update(dt);
      if (graduationLeft > 0) {
        graduationLeft -= dt;
        if (graduationLeft <= 0) {
          void prompt.finish().then(stop);
          return;
        }
      }
    }
    frame = requestAnimationFrame(tick);
  };

  function onGraduated() {
    coach.graduate();
    graduationLeft = GRADUATION_SECONDS;
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    events.removeEventListener?.('turn:session-graduated', onGraduated);
    events.removeEventListener?.('turn:flow-score-event', onFlow);
    coach.stop();
    prompt.remove();
  }

  events.addEventListener?.('turn:session-graduated', onGraduated);
  events.addEventListener?.('turn:flow-score-event', onFlow);
  frame = requestAnimationFrame(tick);
  return Object.freeze({ coach, stop });
}
