// TURN Home app bar: one slim bar in every orientation (logo, ACHIEVEMENTS, ☰) and a
// menu sheet that holds everything else. Other Home modules keep building the same
// elements they always have (the .m8-home-menu buttons, the music toggle, the
// build/ABOUT meta); this module only moves each one into its slot, whenever it
// appears, so installation order never decides the layout.

const INSTALL_KEY = '__turnHomeAppBar';
const SHEET_ID = 'turnHomeMenuSheet';

function relocate(node, parent, before = null) {
  if (!node || !parent) return;
  if (before === node) before = node.nextElementSibling;
  if (node.parentElement === parent && (!before || node.nextElementSibling === before)) return;
  if (before && before.parentElement === parent) parent.insertBefore(node, before);
  else parent.appendChild(node);
}

export function installHomeAppBar({ documentRef = document } = {}) {
  if (globalThis[INSTALL_KEY]) return globalThis[INSTALL_KEY];
  const home = documentRef.querySelector('.m8-home');
  const header = home?.querySelector('.m8-home-head');
  const main = home?.querySelector('.roadbook');
  const menu = home?.querySelector('.m8-home-menu');
  if (!home || !header || !main || !menu) return null;

  // The bar's right-hand actions.
  const actions = documentRef.createElement('div');
  actions.className = 'turn-app-bar-actions';
  const menuButton = documentRef.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'turn-home-menu-button';
  menuButton.setAttribute('aria-haspopup', 'dialog');
  menuButton.setAttribute('aria-controls', SHEET_ID);
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Menu');
  menuButton.innerHTML = '<span class="turn-home-menu-icon" aria-hidden="true"><i></i><i></i><i></i></span>';
  actions.appendChild(menuButton);
  header.appendChild(actions);

  // The sheet wraps the existing menu element, so every module that looks for
  // .m8-home-menu (achievements, Drive By Ear, feedback, the tester sequence) still
  // finds it.
  const sheet = documentRef.createElement('dialog');
  sheet.id = SHEET_ID;
  sheet.className = 'turn-home-sheet';
  sheet.setAttribute('aria-labelledby', 'm8MenuTitle');
  const sheetHead = documentRef.createElement('div');
  sheetHead.className = 'turn-home-sheet-head';
  const closeButton = documentRef.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'turn-home-sheet-close';
  closeButton.setAttribute('aria-label', 'Close menu');
  closeButton.innerHTML = '<span aria-hidden="true">×</span>';
  const footer = documentRef.createElement('div');
  footer.className = 'turn-home-sheet-footer';
  home.appendChild(sheet);
  sheet.append(sheetHead, menu, footer);
  const title = menu.querySelector('#m8MenuTitle');
  sheetHead.append(title || documentRef.createTextNode('MENU'), closeButton);

  // COLOR THEME (#1067): System, Light or Dark, through the one resolver in index.html. A
  // radio group, so it reads as one choice of three.
  const themeApi = globalThis.__turnTheme;
  const themeSetting = themeApi ? documentRef.createElement('fieldset') : null;
  if (themeSetting) {
    themeSetting.className = 'turn-theme-setting';
    themeSetting.innerHTML = '<legend>COLOR THEME</legend><div class="turn-theme-options">' + [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]
      .map(([value, label]) => `<label><input type="radio" name="turn-theme" value="${value}"><span>${label}</span></label>`).join('') + '</div>';
    const sync = () => {
      for (const input of themeSetting.querySelectorAll('input')) input.checked = input.value === themeApi.choice;
    };
    themeSetting.addEventListener('change', (event) => {
      if (event.target instanceof HTMLInputElement) themeApi.set(event.target.value);
    });
    sheet.addEventListener('toggle', sync);
    sync();
  }

  function place() {
    // The status line stays on the page, where ROADBOOK's busy and error states read.
    relocate(home.querySelector('.m8-home-status'), main);
    // ACHIEVEMENTS carries a badge, so it stays one tap away in the bar.
    const achievements = home.querySelector('.m8-achievements-button');
    relocate(achievements, actions, menuButton);
    // MUSIC, build and ABOUT TURN live in the sheet footer.
    const music = home.querySelector('.turn-music-home-toggle');
    if (music && footer.firstElementChild !== music) footer.prepend(music);
    if (themeSetting) {
      const before = music && music.parentElement === footer ? music.nextElementSibling : footer.firstElementChild;
      if (before !== themeSetting) footer.insertBefore(themeSetting, before);
    }
    relocate(home.querySelector('.m8-home-meta'), footer);
  }

  function open() {
    if (sheet.open) return;
    place();
    sheet.showModal();
    menuButton.setAttribute('aria-expanded', 'true');
    home.classList.add('is-menu-open');
    (menu.querySelector('button:not([hidden])') || closeButton).focus();
  }

  function close() {
    if (sheet.open) sheet.close();
  }

  menuButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  sheet.addEventListener('close', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    home.classList.remove('is-menu-open');
    if (!documentRef.querySelector('dialog[open]')) menuButton.focus({ preventScroll: true });
  });
  // A tap on the backdrop (the dialog box itself, outside the panel) closes it.
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) close();
  });
  // Menu entries open their own dialogs; close the sheet first so only one modal is
  // ever open. MUSIC toggles in place, so it keeps the sheet open.
  // Closing in the capture phase, before the entry's own handler runs, moves focus
  // back to ☰ first; that dialog then records ☰ as the control to return focus to.
  menu.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('button')) close();
  }, { capture: true });

  const observer = new MutationObserver(place);
  observer.observe(home, { childList: true, subtree: true });
  place();
  home.classList.add('turn-app-bar-layout');

  const api = Object.freeze({ open, close, sheet, menuButton });
  globalThis[INSTALL_KEY] = api;
  return api;
}
