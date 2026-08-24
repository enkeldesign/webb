(() => {
  const root = document.documentElement;
  if (root.dataset.turnDeployment !== 'lab') return;

  const portraitMedia = window.matchMedia('(orientation: portrait)');
  const PHYSICAL_TOP_SPLIT = 0.72;
  const VIRTUAL_WIDTH_SCALE = PHYSICAL_TOP_SPLIT / 0.5;

  root.dataset.turnLabThumbArc = 'r2';
  root.dataset.turnLabThumbArcSplit = String(Math.round(PHYSICAL_TOP_SPLIT * 100));

  function virtualHitRect(rect) {
    if (!portraitMedia.matches) return rect;

    const width = Math.max(0, Number(rect.width) || 0) * VIRTUAL_WIDTH_SCALE;
    const height = Math.max(0, Number(rect.height) || 0);
    const left = Number(rect.left) || 0;
    const top = Number(rect.top) || 0;
    const result = {
      x: left,
      y: top,
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height
    };
    result.toJSON = () => ({ ...result, toJSON: undefined });
    return result;
  }

  function installArcHitGeometry(drivePad) {
    if (!drivePad || drivePad.dataset.turnPortraitArcHitGeometry === 'r2') return false;

    const nativeGetBoundingClientRect = drivePad.getBoundingClientRect.bind(drivePad);
    Object.defineProperty(drivePad, 'getBoundingClientRect', {
      configurable: true,
      value() {
        return virtualHitRect(nativeGetBoundingClientRect());
      }
    });
    drivePad.dataset.turnPortraitArcHitGeometry = 'r2';
    return true;
  }

  function start() {
    if (!document.body) return;
    if (installArcHitGeometry(document.querySelector('.drive-pad'))) return;
    if (typeof MutationObserver !== 'function') return;

    const observer = new MutationObserver(() => {
      if (!installArcHitGeometry(document.querySelector('.drive-pad'))) return;
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
