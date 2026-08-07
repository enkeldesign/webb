import { installRacerLabels } from '/yourturn/racer-labels.js?revision=r2';

const FRAME_LIMIT = 240;

function bootstrap(attempt = 0) {
  const runtime = globalThis.__turnRuntime;
  const session = globalThis.__yourTurnSession;
  if (runtime && session) {
    installRacerLabels(runtime, () => session.getState());
    routeMultiCarStaging(session);
    return;
  }
  if (attempt < FRAME_LIMIT) requestAnimationFrame(() => bootstrap(attempt + 1));
}

function routeMultiCarStaging(session, attempt = 0) {
  const state = session.getState();
  if (!state.challenge || !state.challengeLaps?.length) {
    if (attempt < FRAME_LIMIT) requestAnimationFrame(() => routeMultiCarStaging(session, attempt + 1));
    return;
  }

  // app.js has a carefully tuned, exact start-line adapter for one rival. With two
  // or more rivals scene.js owns the whole side-by-side row instead, so this legacy
  // single-rival alias is intentionally cleared while challengeLaps stays canonical.
  if (state.challengeLaps.length > 1) state.challengeLap = null;
}

bootstrap();
