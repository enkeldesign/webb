import { installYourTurnShare } from './your-turn-share.js?revision=r1';

function waitForHome() {
  const existing = document.querySelector('.m8-home-fixed-layout');
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const home = document.querySelector('.m8-home-fixed-layout');
      if (!home) return;
      observer.disconnect();
      resolve(home);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}

waitForHome()
  .then((home) => installYourTurnShare({ home }))
  .catch((error) => {
    console.error('TURN: YOUR TURN sharing could not start.', error);
  });
