// TURN race pause (#985): the one owner of a paused race.
//
// Only an active lap pauses: there is a lap to protect. Staged at the start line,
// spectating, at Home or in GARAGE there is nothing to hold.
//
// - Pause freezes the race clock (race-clock.js), so no race time passes, and stops
//   the frame loop through the covered-rendering contract (turn-runtime-paused): no
//   physics, lap timer, rivals, scoring, BOOST or perk step runs. Race audio goes
//   quiet at once. Held controls let go: their owners release on 'race-paused'.
// - Resume thaws the clock. The next frame continues from the paused moment, so the
//   pause never becomes one long physics step or lap time.
// - A race that ends while paused (RESTART LAP, LEAVE RACE, Home) ends the pause.
// - A screen rotation the OS completes mid-lap (#1080) pauses too: a phone tipped over
//   while steering must not cost the lap. Only the finished rotation counts (the
//   screen's orientation type changes), never a tilt angle. Turning back to the
//   orientation the race was driven in announces 'race-rotation' { rotatedBack: true }.
//   Every resume adopts the screen's orientation as the race's own, so racing on
//   in the new orientation is simply resuming.
//
// Every change goes out as turn:ui-state-change { reason: 'race-paused' |
// 'race-resumed', paused, pauseReason }, so HUD, scoring, audio and tests follow it
// without reading the page.

import { freezeRaceClock, thawRaceClock } from './race-clock.js';

const INSTALL_KEY = '__turnRacePause';
const RACING = 'racing';

export const PAUSE_REASON = Object.freeze({
  PLAYER: 'player',
  BACKGROUND: 'background',
  ROTATION: 'rotation'
});

export function installRacePause({ windowRef = window, documentRef = document } = {}) {
  if (windowRef[INSTALL_KEY]) return windowRef[INSTALL_KEY];
  const body = documentRef.body;
  let reason = null;
  let pausedAt = 0;
  // The screen orientation the race is driven in; it follows every rotation outside a lap.
  const orientationNow = () => windowRef.screen?.orientation?.type || String(windowRef.orientation ?? '');
  let raceOrientation = orientationNow();

  const runtime = () => windowRef.__turnRuntime;
  const racing = () => {
    const state = runtime()?.state;
    return state?.running === true && state.mode === RACING;
  };

  function publish(change) {
    const state = runtime()?.state;
    windowRef.dispatchEvent(new CustomEvent('turn:ui-state-change', {
      detail: {
        reason: change,
        mode: state?.mode,
        running: state?.running === true,
        paused: reason !== null,
        pauseReason: reason,
        rotatedBack: reason === PAUSE_REASON.ROTATION ? orientationNow() === raceOrientation : undefined
      }
    }));
  }

  function pause(nextReason = PAUSE_REASON.PLAYER) {
    if (reason !== null) {
      // Already paused: a player pause over a background one is the same pause.
      return true;
    }
    if (!racing()) return false;
    reason = nextReason;
    pausedAt = windowRef.performance.now();
    freezeRaceClock();
    body.classList.add('turn-runtime-paused', 'turn-race-paused');
    windowRef.__turnAudio?.silence?.();
    windowRef.dispatchEvent(new CustomEvent('turn:pace-note-silence'));
    publish('race-paused');
    return true;
  }

  // Resume the race, or with { ending: true } only lift the pause because the race is
  // about to end (RESTART LAP, LEAVE RACE); the caller then takes that path.
  function resume({ ending = false } = {}) {
    if (reason === null) return false;
    // The frame loop measures from its last frame, the paused moment in race time.
    thawRaceClock();
    body.classList.remove('turn-runtime-paused', 'turn-race-paused');
    reason = null;
    raceOrientation = orientationNow();
    pausedAt = 0;
    publish(ending ? 'race-pause-ended' : 'race-resumed');
    return true;
  }

  // A race that stops being a race while paused ends the pause with it.
  windowRef.addEventListener('turn:ui-state-change', (event) => {
    const change = event.detail?.reason;
    if (reason === null || change === 'race-paused' || change === 'race-resumed' || change === 'race-pause-ended' || change === 'race-rotation') return;
    if (!racing()) resume({ ending: true });
  });

  // Leaving the app mid-lap (hidden, or another window taking focus) pauses the race;
  // coming back finds it paused. main.js asks too, before it would reset the perk.
  documentRef.addEventListener('visibilitychange', () => {
    if (documentRef.hidden) pause(PAUSE_REASON.BACKGROUND);
  });
  windowRef.addEventListener('pagehide', () => pause(PAUSE_REASON.BACKGROUND));
  windowRef.addEventListener('blur', () => pause(PAUSE_REASON.BACKGROUND));

  // Both events can report one rotation; only a changed orientation type counts.
  let lastOrientation = raceOrientation;
  function orientationChanged() {
    const next = orientationNow();
    if (next === lastOrientation) return;
    lastOrientation = next;
    if (reason === PAUSE_REASON.ROTATION) {
      publish('race-rotation');
      return;
    }
    if (reason === null && racing() && next !== raceOrientation) {
      pause(PAUSE_REASON.ROTATION);
      return;
    }
    if (reason === null) raceOrientation = next;
  }
  windowRef.addEventListener('orientationchange', orientationChanged);
  windowRef.screen?.orientation?.addEventListener?.('change', orientationChanged);

  const api = Object.freeze({
    pause,
    resume,
    get paused() {
      return reason !== null;
    },
    get reason() {
      return reason;
    },
    // How long the current pause has lasted, in milliseconds (0 when not paused).
    get pausedFor() {
      return reason === null ? 0 : windowRef.performance.now() - pausedAt;
    },
    get canPause() {
      return reason === null && racing();
    },
    // A rotation pause: whether the screen is back in the race's orientation.
    get rotatedBack() {
      return reason === PAUSE_REASON.ROTATION && orientationNow() === raceOrientation;
    }
  });
  windowRef[INSTALL_KEY] = api;
  return api;
}
