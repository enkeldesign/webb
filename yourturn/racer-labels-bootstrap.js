import { installRacerLabels } from '/yourturn/racer-labels.js?revision=r3';

let installed = false;

function bootstrap() {
  if (installed) return;
  const runtime = globalThis.__turnRuntime;
  const session = globalThis.__yourTurnSession;
  if (runtime && session) {
    installRacerLabels(runtime, () => session.getState());
    installed = true;
    return;
  }
  requestAnimationFrame(bootstrap);
}

window.addEventListener('turn:runtime-ready', bootstrap);
window.addEventListener('pageshow', bootstrap);
bootstrap();
