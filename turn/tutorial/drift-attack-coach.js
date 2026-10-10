import {
  DRIFT_ATTACK_GRADUATION_MESSAGE,
  DRIFT_ATTACK_LESSONS,
  DRIFT_ATTACK_PRACTICE_MESSAGE,
  DRIFT_ATTACK_RETRY_PROMPT
} from './drift-attack-lessons.js';
import { createTutorialPrompt } from './tutorial-prompt.js';

// The DRIFT ATTACK TUTORIAL coach (#1150), on top of an ordinary teaching lap. Like the
// TURN TUTORIAL coach it only reads the game, writes nothing but state.sessionSpeedCap,
// and presents through the one polite live region (tutorial-prompt.js).
const CAP_EASE_PER_SECOND = 12;
const DONE_TEXT_SECONDS = 3;
const GRADUATION_SECONDS = 4;
// OVERCHARGE burned by BOOST before SPEND counts as done.
const SPENT_AMOUNT = 0.1;

// What the lessons are judged on: OVERCHARGE as the BOOST controls publish it
// (ui/gameplay-controls.js), and the banks and links DRIFT ATTACK has announced.
export function readDriftAttackSignals(counters, state = globalThis.__turnRuntime?.state) {
  return {
    speed: Math.max(0, Number(state?.speed) || 0),
    overcharge: Math.max(0, Number(globalThis.__turnBoostOvercharge) || 0),
    caught: globalThis.__turnBoostOverchargeCaught === true,
    boosting: globalThis.__turnBoostActive === true,
    banks: Number(counters?.banks) || 0,
    links: Number(counters?.links) || 0
  };
}

export function createDriftAttackCoach({
  state,
  maxSpeed,
  lessons = DRIFT_ATTACK_LESSONS,
  signals,
  present = () => {}
}) {
  const outcome = new Map(lessons.map((lesson) => [lesson.id, 'pending']));
  const buildIndex = Math.max(0, lessons.findIndex((lesson) => lesson.id === 'build'));
  const spendIndex = lessons.findIndex((lesson) => lesson.id === 'spend');
  let current = null;
  let nextIndex = 0;
  let pauseLeft = 0;
  let finished = false;
  let banksAtStart = 0;
  let linksAtStart = 0;
  let lastOvercharge = 0;
  const progress = {};

  function release() {
    state.sessionSpeedCap = null;
  }

  function begin(index, input, prompt = null) {
    current = lessons[index];
    nextIndex = index + 1;
    banksAtStart = input.banks;
    linksAtStart = input.links;
    lastOvercharge = input.overcharge;
    Object.assign(progress, {
      banks: 0, links: 0, overcharge: input.overcharge, caught: false, caughtSeconds: 0, spentAmount: 0, spent: false
    });
    present({
      kind: 'lesson',
      id: current.id,
      title: current.title,
      prompt: prompt || current.prompt,
      keyboardPrompt: prompt ? null : current.keyboardPrompt
    });
  }

  // A lesson is done: say so, then move on (straight away while OVERCHARGE leaks).
  function complete(lesson, input) {
    outcome.set(lesson.id, 'done');
    current = null;
    release();
    if (lesson.doneText) {
      present({ kind: 'done', id: lesson.id, title: lesson.title, text: lesson.doneText });
      pauseLeft = lesson.pauseAfter || DONE_TEXT_SECONDS;
    } else if (nextIndex < lessons.length) {
      begin(nextIndex, input);
    }
  }

  function update(dt) {
    if (finished) return;
    const input = signals();
    if (pauseLeft > 0) {
      pauseLeft -= dt;
      if (pauseLeft > 0) return;
      if (nextIndex >= lessons.length) {
        present({ kind: 'idle' });
        return;
      }
      begin(nextIndex, input);
    }
    if (!current) {
      if (nextIndex >= lessons.length) return;
      begin(nextIndex, input);
    }

    progress.banks = input.banks - banksAtStart;
    progress.links = input.links - linksAtStart;
    progress.overcharge = input.overcharge;
    if (input.caught) {
      progress.caught = true;
      progress.caughtSeconds += dt;
    }
    if (input.boosting && input.overcharge < lastOvercharge) progress.spentAmount += lastOvercharge - input.overcharge;
    if (progress.spentAmount >= SPENT_AMOUNT || (progress.spentAmount > 0 && input.overcharge <= 0)) progress.spent = true;
    lastOvercharge = input.overcharge;

    // Spent before HOLD was over: the player has done it all.
    if (progress.spent && current.needsOvercharge && spendIndex >= 0) {
      for (let index = lessons.indexOf(current); index < spendIndex; index += 1) outcome.set(lessons[index].id, 'done');
      nextIndex = spendIndex + 1;
      complete(lessons[spendIndex], input);
      return;
    }
    if (current.done(progress)) {
      complete(current, input);
      return;
    }
    // Leaked away before it was spent: build it again.
    if (current.needsOvercharge && input.overcharge <= 0) {
      begin(buildIndex, input, DRIFT_ATTACK_RETRY_PROMPT);
      return;
    }
    if (current.speedCap) {
      // The car's own top speed (vehicle/physics.js), not the untuned base limit.
      const top = Number(state.vehicleEffectiveMaxSpeed) > 0 ? Number(state.vehicleEffectiveMaxSpeed) : maxSpeed;
      const target = current.speedCap * top;
      const from = Number.isFinite(state.sessionSpeedCap) ? state.sessionSpeedCap : Math.max(target, input.speed);
      state.sessionSpeedCap = Math.max(target, from - CAP_EASE_PER_SECOND * dt);
    } else {
      release();
    }
  }

  function graduate() {
    if (finished) return;
    finished = true;
    for (const [id, status] of outcome) if (status === 'pending') outcome.set(id, 'missed');
    release();
    const message = [...outcome.values()].every((status) => status === 'done')
      ? DRIFT_ATTACK_GRADUATION_MESSAGE
      : DRIFT_ATTACK_PRACTICE_MESSAGE;
    present({ kind: 'graduated', message });
  }

  function stop() {
    finished = true;
    release();
  }

  return Object.freeze({
    update,
    graduate,
    stop,
    outcome: () => Object.fromEntries(outcome),
    get lesson() { return current?.id || null; }
  });
}

// One run of the DRIFT ATTACK TUTORIAL coach. Paused races do not advance it.
export function startDriftAttackCoach({ runtime, events = globalThis }) {
  const { state } = runtime;
  const prompt = createTutorialPrompt();
  const counters = { banks: 0, links: 0 };
  const onScore = (event) => {
    if (event.detail?.type === 'bank') counters.banks += 1;
    // A drift linked to the last bank raises COMBO, announced as a milestone.
    if (event.detail?.type === 'milestone' && Number(event.detail.multiplier) >= 2) counters.links += 1;
  };
  const coach = createDriftAttackCoach({
    state,
    maxSpeed: runtime.maxSpeed,
    signals: () => readDriftAttackSignals(counters, state),
    present: prompt.present
  });
  let frame = 0;
  let last = 0;
  let stopped = false;
  let graduationLeft = 0;

  const tick = (now) => {
    if (stopped) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (state.running && globalThis.__turnRacePause?.paused !== true) {
      coach.update(dt);
      if (graduationLeft > 0) {
        graduationLeft -= dt;
        if (graduationLeft <= 0) {
          stop();
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
    events.removeEventListener?.('turn:drift-score-event', onScore);
    coach.stop();
    prompt.remove();
  }

  events.addEventListener?.('turn:session-graduated', onGraduated);
  events.addEventListener?.('turn:drift-score-event', onScore);
  frame = requestAnimationFrame(tick);
  return Object.freeze({ coach, stop });
}
