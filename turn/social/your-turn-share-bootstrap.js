import { installYourTurnShare } from './your-turn-share.js?revision=r1';

function waitForHomeLayout() {
  if (globalThis.__turnHomeLayout?.home) return Promise.resolve(globalThis.__turnHomeLayout.home);

  return new Promise((resolve) => {
    const check = () => {
      const home = globalThis.__turnHomeLayout?.home;
      if (home) {
        resolve(home);
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

waitForHomeLayout()
  .then((home) => installYourTurnShare({ home }))
  .catch((error) => {
    console.error('TURN: YOUR TURN sharing could not start.', error);
  });
