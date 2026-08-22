const STYLE_ID = 'turn-lot-card-scroll-boundary-r208-style';
const activeBoundaries = new WeakMap();

function findLotScreen(root) {
  if (root?.matches?.('.lot-screen')) return root;
  return root?.querySelector?.('.lot-screen') || null;
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* The screen-reader pass places COLOR inside .lot-card for semantic order.
       Do not make that same ancestor the scrolling box: standalone iOS can clip
       fixed-position descendants of an actively scrolling overflow container. */
    .lot-showroom.lot-card-scroll-boundary .lot-card {
      overflow: visible;
      overscroll-behavior: auto;
    }

    .lot-showroom .lot-card-info-scroll {
      min-width: 0;
      min-height: 0;
      flex: 1 1 auto;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }
  `;
  document.head.appendChild(style);
}

export function installLotCardScrollBoundary(root = document.body) {
  const screen = findLotScreen(root);
  const card = screen?.querySelector('.lot-card');
  if (!screen?.classList.contains('lot-showroom') || !card) return () => {};

  const existing = activeBoundaries.get(screen);
  if (existing) return existing.release;

  const title = card.querySelector('.lot-car-title');
  const description = card.querySelector('.lot-car-description');
  const perk = card.querySelector('.lot-perk-disclosure');
  const attributes = card.querySelector('.lot-attributes-row');
  const stats = card.querySelector('.lot-stats');
  const statsHelp = card.querySelector('.lot-stats-help');
  if (!title || !description || !stats) return () => {};

  installStyle();

  const scroll = document.createElement('div');
  scroll.className = 'lot-card-info-scroll';
  card.insertBefore(scroll, title);
  for (const node of [title, description, perk, attributes, stats, statsHelp]) {
    if (node?.parentElement === card) scroll.appendChild(node);
  }

  screen.classList.add('lot-card-scroll-boundary');

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    while (scroll.firstChild) card.insertBefore(scroll.firstChild, scroll);
    scroll.remove();
    screen.classList.remove('lot-card-scroll-boundary');
    activeBoundaries.delete(screen);
  };

  activeBoundaries.set(screen, { release });
  return release;
}
