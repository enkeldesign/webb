(() => {
  const STATUS_ID = 'turn-startup-handoff-status';

  function viewportIsPortrait() {
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth || document.documentElement.clientWidth;
    const height = viewport?.height || window.innerHeight || document.documentElement.clientHeight;
    return height > width;
  }

  function ensureStatusRegion() {
    let status = document.getElementById(STATUS_ID);
    if (status) return status;

    status = document.createElement('div');
    status.id = STATUS_ID;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.style.cssText = [
      'position:fixed',
      'width:1px',
      'height:1px',
      'padding:0',
      'margin:-1px',
      'overflow:hidden',
      'clip-path:inset(50%)',
      'white-space:nowrap',
      'border:0'
    ].join(';');
    document.body.appendChild(status);
    return status;
  }

  const status = ensureStatusRegion();

  document.addEventListener('turn:home-ready', () => {
    // The loading surface is hidden synchronously when Home becomes ready. Announce
    // completion from a persistent live region outside that surface, then include the
    // next required action only when the player is actually holding the device upright.
    status.textContent = '';
    requestAnimationFrame(() => {
      status.textContent = viewportIsPortrait()
        ? 'TURN is ready. Rotate your device to landscape.'
        : 'TURN is ready.';
    });
  }, { once: true });
})();
