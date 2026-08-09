(() => {
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;

  document.documentElement.classList.toggle('turn-standalone', isStandalone);
  document.documentElement.classList.toggle('turn-browser', !isStandalone);
  document.documentElement.dataset.turnLab = 'viewport-flight-recorder-r1';

  globalThis.__turnLaunchReady = Promise.resolve({
    mode: isStandalone ? 'standalone' : 'browser',
    lab: true
  });
})();
