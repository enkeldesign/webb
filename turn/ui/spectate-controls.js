import { REPLAY_CONTROL, readableReplayInputs, replayControlsAt } from '../race/replay-inputs.js';
import { createDrivePadDemo, createManualSteerDemo, createTiltDemo } from './how-to-play-demos.js';

// SPECTATE's controls (#1217): the lap SPECTATE follows, played back on HOW TO PLAY's
// drive pad, with the phone it was tilted on or the steering box it was steered on above
// it, on the side the player held them. Like the demos it is a picture, hidden from
// assistive technology and built from the demos' own classes, so it never touches the
// real controls. A lap recorded before input tracks shows none.
const PAD_STATES = Object.freeze([
  ['is-gas-ready', REPLAY_CONTROL.GAS],
  ['is-drift-ready', REPLAY_CONTROL.DRIFT],
  ['is-drift-locking', REPLAY_CONTROL.LOCK],
  ['is-boost-ready', REPLAY_CONTROL.BOOST],
  ['is-brake-ready', REPLAY_CONTROL.BRAKE],
  ['is-reversing', REPLAY_CONTROL.REVERSE],
  ['is-shift-available', REPLAY_CONTROL.SHIFT_READY],
  ['is-shift-active', REPLAY_CONTROL.SHIFT],
  ['is-shift-pressing', REPLAY_CONTROL.SHIFT_PRESS]
]);

// Where the thumb is: the bubble it slid out into, else the zone it holds.
function thumbFor(mask) {
  if (mask & REPLAY_CONTROL.REVERSE) return 'reverse';
  if (mask & REPLAY_CONTROL.LOCK) return 'lock';
  if (mask & REPLAY_CONTROL.SHIFT_PRESS) return 'shift';
  if (mask & REPLAY_CONTROL.BRAKE) return 'brake';
  if (mask & REPLAY_CONTROL.DRIFT) return 'drift';
  if (mask & REPLAY_CONTROL.BOOST) return 'boost';
  if (mask & REPLAY_CONTROL.GAS) return 'gas';
  return '';
}

export function createSpectateControls(documentRef = globalThis.document) {
  const root = documentRef.createElement('div');
  root.className = 'spectate-controls';
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  const tilt = createTiltDemo(documentRef);
  const touch = createManualSteerDemo(documentRef, { replay: true });
  const pad = createDrivePadDemo('replay', documentRef);
  tilt.classList.add('spectate-controls-tilt');
  touch.classList.add('spectate-controls-touch');
  const stack = pad.querySelector('.turn-demo-stack');
  stack.dataset.thumb = '';
  root.append(tilt, touch, pad);
  documentRef.body.append(root);

  let shownMask = -1;
  let shownSteering = NaN;

  function showControls(mask) {
    for (const [className, bit] of PAD_STATES) stack.classList.toggle(className, (mask & bit) !== 0);
    stack.dataset.thumb = thumbFor(mask);
    root.dataset.steer = mask & REPLAY_CONTROL.TILT ? 'tilt' : 'touch';
    root.dataset.hand = mask & REPLAY_CONTROL.LEFT_HANDED ? 'left' : 'right';
  }

  function hide() {
    root.hidden = true;
    shownMask = -1;
    shownSteering = NaN;
  }

  // Each frame of SPECTATE: the followed lap, its replay frame and SPECTATE's clock. Only
  // a change of controls, or of steering by a visible step, touches the page.
  function update(lap, frame, seconds) {
    const changes = readableReplayInputs(lap);
    if (!changes || !frame) {
      if (!root.hidden) hide();
      return;
    }
    const time = Number.isFinite(lap.time) && lap.time > 0 ? seconds % lap.time : seconds;
    const mask = replayControlsAt(changes, time);
    if (mask !== shownMask) {
      shownMask = mask;
      showControls(mask);
    }
    const steering = Math.round(Math.max(-1, Math.min(1, Number(frame.s) || 0)) * 100) / 100;
    if (steering !== shownSteering) {
      shownSteering = steering;
      root.style.setProperty('--turn-demo-steer', String(steering));
    }
    if (root.hidden) root.hidden = false;
  }

  return Object.freeze({ element: root, update, hide });
}
