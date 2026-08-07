import { installRacerLabels } from '/yourturn/racer-labels.js?revision=r1';

const FRAME_LIMIT = 240;

function bootstrap(attempt = 0) {
  const runtime = globalThis.__turnRuntime;
  const session = globalThis.__yourTurnSession;
  if (runtime && session) {
    // Labels are a presentation layer only. Session owns the canonical challenge
    // replay field and its vehicle identity; this bootstrap never mutates race state.
    installRacerLabels(runtime, () => session.getState());
    return;
  }
  if (attempt < FRAME_LIMIT) requestAnimationFrame(() => bootstrap(attempt + 1));
}

bootstrap();
