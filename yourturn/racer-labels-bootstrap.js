import { installRacerLabels } from '/yourturn/racer-labels.js?revision=r1';

const FRAME_LIMIT = 240;

function bootstrap(attempt = 0) {
  const runtime = globalThis.__turnRuntime;
  const session = globalThis.__yourTurnSession;
  if (runtime && session) {
    installRacerLabels(runtime, () => session.getState());
    syncChallengeCarIdentity(runtime, session);
    return;
  }
  if (attempt < FRAME_LIMIT) requestAnimationFrame(() => bootstrap(attempt + 1));
}

function syncChallengeCarIdentity(runtime, session, attempt = 0) {
  const state = session.getState();
  if (!state.challenge || !state.challengeLaps?.length) {
    if (attempt < FRAME_LIMIT) requestAnimationFrame(() => syncChallengeCarIdentity(runtime, session, attempt + 1));
    return;
  }

  for (const lap of state.challengeLaps) {
    lap.carId = state.challenge.carId;
    lap.carColor = state.challenge.carColor;
    lap.carSecondaryColor = state.challenge.carSecondaryColor;
  }
  runtime.state.competitorLaps = state.challengeLaps;
  runtime.syncCompetitorVisuals?.();
}

bootstrap();
