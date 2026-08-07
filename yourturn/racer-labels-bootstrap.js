import { installRacerLabels } from '/yourturn/racer-labels.js?revision=r1';

const FRAME_LIMIT = 240;

function bootstrap(attempt = 0) {
  const runtime = globalThis.__turnRuntime;
  const session = globalThis.__yourTurnSession;
  if (runtime && session) {
    installRacerLabels(runtime, () => session.getState());
    return;
  }
  if (attempt < FRAME_LIMIT) requestAnimationFrame(() => bootstrap(attempt + 1));
}

bootstrap();
