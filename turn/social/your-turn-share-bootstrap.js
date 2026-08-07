import { installYourTurnShare } from './your-turn-share.js?revision=r1';

let started = false;

function start() {
  if (started) return;
  const home = globalThis.__turnHomeLayout?.home;
  if (!home) return;
  started = true;
  installYourTurnShare({ home }).catch((error) => {
    started = false;
    console.error('TURN: YOUR TURN sharing could not start.', error);
  });
}

if (globalThis.__turnHomeLayout?.home) start();
else document.addEventListener('turn:home-ready', start, { once: true });
