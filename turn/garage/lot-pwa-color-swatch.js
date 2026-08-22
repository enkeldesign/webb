const activeInstallations = new WeakMap();

function findLotScreen(root) {
  if (root?.matches?.('.lot-screen')) return root;
  return root?.querySelector?.('.lot-screen') || null;
}

function ensureSwatchFace(control) {
  const input = control?.querySelector?.('input[type="color"]');
  if (!input) return null;

  let face = control.querySelector('.lot-turn-color-swatch-face');
  if (!face) {
    face = document.createElement('label');
    face.className = 'lot-turn-color-swatch-face';
    face.setAttribute('aria-hidden', 'true');
    control.append(face);
  }

  face.htmlFor = input.id;
  face.style.setProperty('--lot-color-swatch', input.value);
  face.title = input.title || 'Choose car color';
  return face;
}

function syncSwatches(colors) {
  for (const control of colors.querySelectorAll('.lot-color-control')) {
    ensureSwatchFace(control);
  }
}

export function installLotPwaColorSwatches(root = document.body) {
  const screen = findLotScreen(root);
  if (!screen) return () => {};

  const existing = activeInstallations.get(screen);
  if (existing) return existing.release;

  const colors = screen.querySelector('.lot-colors');
  if (!colors) return () => {};

  const observer = new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => (
      [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
        node?.nodeType === 1 && node.matches?.('.lot-color-control')
      ))
    ))) return;
    syncSwatches(colors);
  });
  observer.observe(colors, { childList: true });

  const handleInput = (event) => {
    if (!event.target?.matches?.('input[type="color"]')) return;
    ensureSwatchFace(event.target.closest('.lot-color-control'));
  };
  colors.addEventListener('input', handleInput);

  syncSwatches(colors);

  const release = () => {
    observer.disconnect();
    colors.removeEventListener('input', handleInput);
    for (const face of colors.querySelectorAll('.lot-turn-color-swatch-face')) face.remove();
    activeInstallations.delete(screen);
  };

  activeInstallations.set(screen, { release });
  return release;
}
