const ORDER_COLORS = Object.freeze([
  '#ffd1e6',
  '#bdeeff',
  '#c8f5d0',
  '#fff0a8',
  '#ffd0ae'
]);
const FRAME_LIMIT = 240;

function colorForOrder(order) {
  const index = Math.min(ORDER_COLORS.length, Math.max(1, Math.round(Number(order) || 1))) - 1;
  return ORDER_COLORS[index];
}

function racerOrder(state, racerId, fallback = 1) {
  return state?.challenge?.racers?.find((racer) => racer.id === racerId)?.order || fallback;
}

function playerOrder(state) {
  const ownRacer = state?.challenge?.racers?.find((racer) => racer.id === state?.racerId);
  return ownRacer?.order || state?.challenge?.nextOrder || 1;
}

async function applyChallengeColors(runtime, raceSession, session) {
  const state = session.getState();
  if (!state.challenge || !state.challengeLaps?.length) return false;

  state.challengeLaps.forEach((lap, index) => {
    lap.carColor = colorForOrder(racerOrder(state, lap.racerId, index + 1));
  });
  runtime.state.competitorLaps = state.challengeLaps.map((lap) => ({
    ...lap,
    frames: lap.frames.map((frame) => ({ ...frame }))
  }));
  runtime.syncCompetitorVisuals?.();

  await raceSession.selectVehicle?.({
    carId: state.challenge.carId,
    color: colorForOrder(playerOrder(state)),
    secondaryColor: state.challenge.carSecondaryColor
  });
  return true;
}

function bootstrap(attempt = 0) {
  const runtime = globalThis.__turnRuntime;
  const raceSession = globalThis.__turnRaceSession || globalThis.__turnNextRaceSession;
  const session = globalThis.__yourTurnSession;
  if (runtime && raceSession && session) {
    const state = session.getState();
    if (state.challenge?.racers?.length) {
      void applyChallengeColors(runtime, raceSession, session);
      return;
    }
  }
  if (attempt < FRAME_LIMIT) requestAnimationFrame(() => bootstrap(attempt + 1));
}

bootstrap();

export { ORDER_COLORS, colorForOrder };
