// Reward previews borrow content for one race session; they never grant access
// or save the borrowed car/track as the player's normal selection.
export const PATROL_CHALLENGE = Object.freeze({
  key: 'patrol:midnight-city',
  type: 'patrol',
  trackId: 'midnight-city',
  vehicleId: 'police',
  sourceAchievementId: '',
  maxCompletedLaps: 2
});

export const EXCURSION_CHALLENGE = Object.freeze({
  key: 'excursion:mountain',
  type: 'excursion',
  trackId: 'mountain',
  vehicleId: 'monster-truck',
  sourceAchievementId: '',
  maxCompletedLaps: 2
});

export function getRewardPreviewChallenge(active) {
  return [PATROL_CHALLENGE, EXCURSION_CHALLENGE].find(
    (challenge) => challenge.key === active?.key && challenge.type === active?.type
  );
}

export function createRewardPreviewSession({
  state, raceSession, activateTrack, prepareAccess, showTrackIntro, hideHome, showHome
}) {
  let snapshot = null;
  let starting = false;
  let restoring = null;

  async function restore() {
    raceSession.leaveRace();
    if (restoring) return restoring;
    if (!snapshot) return;
    restoring = (async () => {
      await activateTrack(snapshot.trackId, { persist: false });
      await raceSession.selectVehicle(snapshot.vehicle, { persist: false });
      state.rewardPreview = null;
      snapshot = null;
    })();
    try {
      await restoring;
    } finally {
      restoring = null;
    }
  }

  async function start(challenge = PATROL_CHALLENGE) {
    const preview = getRewardPreviewChallenge(challenge);
    if (!preview || starting || snapshot || state.running) return false;
    starting = true;
    try {
      // Request iOS motion access in the START tap, before loading any content.
      const access = await prepareAccess();
      snapshot = {
        trackId: state.trackId,
        vehicle: {
          carId: state.vehicleId,
          color: state.vehicleColor,
          secondaryColor: state.vehicleSecondaryColor
        }
      };
      state.rewardPreview = { ...preview, completedLaps: 0 };
      hideHome();
      await activateTrack(preview.trackId, { persist: false });
      await raceSession.selectVehicle({ carId: preview.vehicleId }, { persist: false });
      await showTrackIntro(preview.trackId);
      await raceSession.startGame(access.fullscreenPromise);
      return true;
    } catch (error) {
      await restore();
      showHome({ focus: true });
      throw error;
    } finally {
      starting = false;
    }
  }

  return Object.freeze({ start, restore, get active() { return snapshot !== null; } });
}
