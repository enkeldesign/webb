// Race ☰: the race row (.utility-group) is always one row of natural-width buttons.
// When it does not fit beside the drive pad, buttons move into a menu sheet behind ☰,
// lowest priority first, until the rest fits. Where everything fits, nothing changes.
// The buttons themselves move, so every module keeps its own listeners and state.

const INSTALL_KEY = '__turnRaceMenu';
const SHEET_ID = 'turnRaceMenuSheet';
// Highest priority first; the last entries move into ☰ first. RESTART LAP (racing)
// and LEAVE RACE (start) are the one action that is always in the row.
const PRIORITY = Object.freeze([
  '.back-to-start-button',
  '.back-to-lot-button',
  '.turn-screen-blank-control',
  '.recalibrate-button',
  '.turn-race-achievements-button',
  '.spectate-button',
  '.m8-race-settings-button',
  '.audio-settings-button',
  '.reset-rivals-button'
]);
const ALWAYS_IN_ROW = '.back-to-start-button, .back-to-lot-button';

function priorityOf(node) {
  const index = PRIORITY.findIndex((selector) => node.matches?.(selector));
  return index === -1 ? PRIORITY.length : index;
}

export function installRaceMenu({ documentRef = document, windowRef = window } = {}) {
  if (globalThis[INSTALL_KEY]) return globalThis[INSTALL_KEY];
  const group = documentRef.querySelector('.utility-group');
  if (!group) return null;

  const menuButton = documentRef.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'utility turn-race-menu-button';
  menuButton.hidden = true;
  menuButton.setAttribute('aria-haspopup', 'dialog');
  menuButton.setAttribute('aria-controls', SHEET_ID);
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'More race actions');
  menuButton.innerHTML = '<span class="turn-race-menu-icon" aria-hidden="true"><i></i><i></i><i></i></span>';

  const sheet = documentRef.createElement('dialog');
  sheet.id = SHEET_ID;
  sheet.className = 'turn-home-sheet turn-race-sheet';
  sheet.setAttribute('aria-labelledby', 'turnRaceMenuTitle');
  sheet.innerHTML = `
    <div class="turn-home-sheet-head">
      <h2 id="turnRaceMenuTitle">MENU</h2>
      <button class="turn-home-sheet-close" type="button" aria-label="Close menu"><span aria-hidden="true">×</span></button>
    </div>
    <div class="turn-race-menu"></div>`;
  const list = sheet.querySelector('.turn-race-menu');
  const closeButton = sheet.querySelector('.turn-home-sheet-close');
  documentRef.body.appendChild(sheet);

  // Every button that ever lived in the row, in row order.
  let order = [];
  let syncing = false;
  let frame = 0;
  const observer = new MutationObserver(schedule);

  function rememberOrder() {
    const current = [...group.children, ...list.children].filter((node) => node !== menuButton);
    order = [...order.filter((node) => current.includes(node)), ...current.filter((node) => !order.includes(node))];
  }

  function restoreRow() {
    for (const node of order) group.appendChild(node);
    group.appendChild(menuButton);
  }

  const shown = (node) => !node.hidden && node.getClientRects().length > 0;

  // One row that fits its box: no overflow and no wrapped second line.
  function fits() {
    if (group.scrollWidth > group.clientWidth + 1) return false;
    const tops = [...group.children].filter(shown).map((node) => node.offsetTop);
    return tops.every((top) => Math.abs(top - tops[0]) < 2);
  }

  function sync() {
    frame = 0;
    if (syncing) return;
    syncing = true;
    const focused = documentRef.activeElement;
    try {
      rememberOrder();
      restoreRow();
      menuButton.hidden = true;
      let collapsed = false;
      if (group.clientWidth > 0 && !fits()) {
        collapsed = true;
        menuButton.hidden = false;
        const movable = order
          .filter((node) => !node.matches?.(ALWAYS_IN_ROW))
          .sort((a, b) => priorityOf(b) - priorityOf(a));
        for (const node of movable) {
          if (fits()) break;
          list.appendChild(node);
        }
        // Keep the sheet in row order.
        for (const node of order) if (node.parentElement === list) list.appendChild(node);
      }
      // Icon-only buttons need a visible name as a menu entry.
      for (const node of list.children) {
        if (!node.textContent.trim() && node.getAttribute('aria-label')) {
          node.dataset.raceMenuLabel = node.getAttribute('aria-label');
        }
      }
      group.classList.toggle('is-race-menu-collapsed', collapsed);
      if (!collapsed && sheet.open) sheet.close();
    } finally {
      // Moving a node blurs it; keep focus where the player left it.
      if (focused && focused !== documentRef.activeElement && focused.isConnected && !focused.hidden) {
        focused.focus({ preventScroll: true });
      }
      // Discard the records of this module's own moves.
      observer.takeRecords();
      syncing = false;
    }
  }

  function schedule() {
    if (syncing || frame) return;
    frame = windowRef.requestAnimationFrame(sync);
  }

  function open() {
    if (sheet.open) return;
    sheet.showModal();
    menuButton.setAttribute('aria-expanded', 'true');
    ([...list.children].find((node) => !node.hidden && node.getClientRects().length) || closeButton).focus();
  }

  function close() {
    if (sheet.open) sheet.close();
  }

  menuButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  sheet.addEventListener('close', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    if (!documentRef.querySelector('dialog[open]') && !menuButton.hidden) menuButton.focus({ preventScroll: true });
  });
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) close();
  });
  // Entries open their own dialogs or change the race; close the sheet first.
  let returnToMenu = false;
  list.addEventListener('click', (event) => {
    if (!(event.target instanceof Element && event.target.closest('button'))) return;
    returnToMenu = true;
    close();
  }, { capture: true });
  // An entry's dialog returns focus to the entry itself, which now sits in the closed
  // sheet; once that dialog has closed, focus goes to ☰ instead.
  documentRef.addEventListener('close', (event) => {
    if (!returnToMenu || event.target === sheet) return;
    returnToMenu = false;
    queueMicrotask(() => {
      const active = documentRef.activeElement;
      if (!active || active === documentRef.body || sheet.contains(active)) {
        if (!menuButton.hidden) menuButton.focus({ preventScroll: true });
      }
    });
  }, true);

  // Buttons are added and shown or hidden as the race state changes.
  observer.observe(group, { childList: true, attributes: true, subtree: true, attributeFilter: ['hidden', 'data-menu-state'] });
  observer.observe(list, { childList: true, attributes: true, subtree: true, attributeFilter: ['hidden', 'aria-label'] });
  new ResizeObserver(schedule).observe(group);
  windowRef.addEventListener('resize', schedule, { passive: true });
  windowRef.addEventListener('orientationchange', schedule, { passive: true });
  windowRef.addEventListener('turn:ui-state-change', () => {
    close();
    schedule();
  });
  sync();

  const api = Object.freeze({ open, close, sync, sheet, menuButton });
  globalThis[INSTALL_KEY] = api;
  return api;
}
