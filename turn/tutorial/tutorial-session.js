import { tutorialLapPolicy } from '../race/session-policy.js';
import { TURN_TUTORIAL, TUTORIAL_STATUS } from './tutorial-progress.js';

// One tutorial run (#1131). It borrows the tutorial's track and car without saving
// them, races the teaching lap with no rival ahead, and switches to ordinary play at
// the line. Leaving restores the player's own track, car and stored rivals. The
// lessons themselves (#1132) run on top of an entered session.
export function createTutorialSession({
  state,
  raceSession,
  activateTrack,
  progress,
  syncRivals = () => {},
  events = globalThis,
  module = TURN_TUTORIAL
}) {
  let snapshot = null;
  let restoring = null;
  let graduated = false;
  let firstCompletion = false;

  const onGraduated = () => {
    if (!snapshot || graduated) return;
    graduated = true;
    firstCompletion = progress.complete(module.id, module.revision);
  };

  function clearRivals() {
    // The teaching lap is the player's own run. The stored rivals stay in storage and
    // come back when the session ends.
    state.competitorLaps = [];
    state.bestTime = Infinity;
    state.ghostFrames = [];
    state.ghostVisible = false;
    syncRivals();
  }

  async function enter() {
    if (snapshot || restoring || state.running) return false;
    // A replay graduates into a sandbox, so its laps never overwrite the stored
    // rivals of the borrowed track.
    const replay = progress.status(module.id) === TUTORIAL_STATUS.COMPLETED;
    snapshot = {
      trackId: state.trackId,
      vehicle: {
        carId: state.vehicleId,
        color: state.vehicleColor,
        secondaryColor: state.vehicleSecondaryColor
      }
    };
    graduated = false;
    firstCompletion = false;
    progress.begin(module.id);
    try {
      await activateTrack(module.trackId, { persist: false });
      await raceSession.selectVehicle({ carId: module.vehicleId }, { persist: false });
      clearRivals();
      state.sessionPolicy = tutorialLapPolicy({ replay });
      events.addEventListener?.('turn:session-graduated', onGraduated);
      return true;
    } catch (error) {
      await exit();
      throw error;
    }
  }

  async function exit() {
    if (restoring) return restoring;
    if (!snapshot) return false;
    const saved = snapshot;
    restoring = (async () => {
      events.removeEventListener?.('turn:session-graduated', onGraduated);
      raceSession.leaveRace();
      // Cleared first, so a failed restore can never leave progression suspended.
      state.sessionPolicy = null;
      // Re-activating the track reloads its stored rivals over the session's ghosts.
      await activateTrack(saved.trackId, { persist: false });
      await raceSession.selectVehicle(saved.vehicle, { persist: false });
      // Kept until both succeed, so a failed restore can be retried.
      snapshot = null;
      return true;
    })();
    try {
      return await restoring;
    } finally {
      restoring = null;
    }
  }

  return Object.freeze({
    enter,
    exit,
    // STOP TUTORIAL: leave, and do not start automatically again.
    async stop() {
      if (!graduated) progress.stop(module.id);
      return exit();
    },
    get active() { return snapshot !== null; },
    get graduated() { return graduated; },
    // True once, for the run that completed the tutorial for the first time.
    get firstCompletion() { return firstCompletion; }
  });
}
