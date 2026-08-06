(() => {
  const PWA_SHELL_REVISION = '20260806-r179';
  const PWA_REDIRECT_GUARD = `turn-pwa-shell-${PWA_SHELL_REVISION}`;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    globalThis.navigator.standalone === true;
  const isNextDeployment = document.documentElement.dataset.turnDeployment === 'next';
  const manifestPath = isNextDeployment
    ? '/turn-next/site.webmanifest'
    : '/turn/site.webmanifest';

  // This synchronous script runs before orientation and game startup. Keep the PWA
  // document-shell recovery above the normal motion safe-zone configuration.
  // PR #351's document shell can remain in iOS's installed-web-app cache even after
  // Safari has fetched the reverted production page. Remove its inline containment
  // rule immediately if an older standalone shell executes this refreshed bootstrap.
  document.querySelector('#turn-landscape-launch-containment-r178')?.remove();

  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) {
    manifest.href = `${manifestPath}?shell=${PWA_SHELL_REVISION}`;
  }

  if (isStandalone) {
    const launchUrl = new URL(window.location.href);
    const currentRevision = launchUrl.searchParams.get('shell');
    let alreadyRedirected = false;
    try {
      alreadyRedirected = globalThis.sessionStorage.getItem(PWA_REDIRECT_GUARD) === '1';
    } catch (_) {}

    if (currentRevision !== PWA_SHELL_REVISION && !alreadyRedirected) {
      try {
        globalThis.sessionStorage.setItem(PWA_REDIRECT_GUARD, '1');
      } catch (_) {}
      launchUrl.searchParams.set('shell', PWA_SHELL_REVISION);
      globalThis.__turnPwaShellRecovery = Object.freeze({
        revision: PWA_SHELL_REVISION,
        from: window.location.href,
        to: launchUrl.href
      });
      window.location.replace(launchUrl.href);
      return;
    }
  }

  const SAFE_ZONE_DEGREES = 24;

  globalThis.__TURN_MOTION_SAFE_ZONE__ = Object.freeze({
    degrees: SAFE_ZONE_DEGREES,
    steeringDegrees: SAFE_ZONE_DEGREES,
    horizonDegrees: SAFE_ZONE_DEGREES,
    feedbackNearDegrees: 19,
    feedbackHardDegrees: SAFE_ZONE_DEGREES,
    feedbackHardRearmDegrees: 22,
    feedbackClearDegrees: 17.5,
    directionalFeedback: true
  });

  document.documentElement.dataset.turnMotionSafeZone = String(SAFE_ZONE_DEGREES);
  document.documentElement.dataset.turnPwaShell = PWA_SHELL_REVISION;
  console.info(`TURN: motion safe zone configured at ±${SAFE_ZONE_DEGREES}°.`);
})();