const STYLE_ATTRIBUTE = 'data-turn-m8-fixed-home-styles';
const LAYOUT_ID = 'fixed-grid-v6';

function installStylesheet() {
  if (document.querySelector(`link[${STYLE_ATTRIBUTE}]`)) return;
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `/turn/m8-home-fixed-layout.css?build=${buildKey}-m8.6-logo`;
  stylesheet.setAttribute(STYLE_ATTRIBUTE, '');
  document.head.appendChild(stylesheet);
}

function waitForHome() {
  const existing = document.querySelector('.m8-home');
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const home = document.querySelector('.m8-home');
      if (!home) return;
      observer.disconnect();
      resolve(home);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function spokenTrackName(rawName) {
  return rawName
    .toLocaleLowerCase('en')
    .replace(/(^|\s)\p{L}/gu, (character) => character.toLocaleUpperCase('en'));
}

export async function installM8HomeFixedLayout() {
  installStylesheet();
  const home = await waitForHome();
  if (home.dataset.m8HomeLayout === LAYOUT_ID) return globalThis.__turnHomeLayout;

  const header = home.querySelector('.m8-home-head');
  const main = home.querySelector('.m8-home-main');
  const headingRow = home.querySelector('.m8-track-heading-row');
  const rail = home.querySelector('.m8-track-rail');
  const howButton = home.querySelector('.m8-how-button');
  const settingsButton = home.querySelector('.m8-home-settings');
  const raceButton = home.querySelector('.m8-track-continue');
  const status = home.querySelector('.m8-home-status');
  const oldScrollButtons = home.querySelector('.m8-track-scroll-buttons');

  if (!header || !main || !headingRow || !rail || !howButton || !settingsButton || !raceButton || !status) {
    throw new Error('TURN M8 fixed Home layout could not find the complete Home interface.');
  }

  const trackBrowser = document.createElement('section');
  trackBrowser.className = 'm8-home-tracks';
  trackBrowser.setAttribute('aria-labelledby', 'm8HomeTitle');
  main.insertBefore(trackBrowser, headingRow);
  trackBrowser.append(headingRow, rail);

  const menu = document.createElement('aside');
  menu.className = 'm8-home-menu';
  menu.setAttribute('aria-labelledby', 'm8MenuTitle');
  menu.innerHTML = '<h2 id="m8MenuTitle">MENU</h2>';
  main.appendChild(menu);

  settingsButton.querySelector('[aria-hidden="true"]')?.remove();
  settingsButton.textContent = 'SETTINGS';
  howButton.textContent = 'HOW TO PLAY';
  raceButton.classList.add('m8-race-button');

  menu.append(settingsButton, howButton, status, raceButton);

  if (oldScrollButtons) {
    oldScrollButtons.hidden = true;
    oldScrollButtons.setAttribute('aria-hidden', 'true');
  }

  let selectedTrackName = '';
  const syncRaceLabel = () => {
    const visibleLabel = raceButton.textContent.trim();
    const trackMatch = visibleLabel.match(/^CONTINUE(?: TO)?\s+(.+)$/i);
    if (trackMatch) selectedTrackName = trackMatch[1].trim();
    if (raceButton.textContent !== 'RACE') raceButton.textContent = 'RACE';
    raceButton.setAttribute(
      'aria-label',
      selectedTrackName ? `Race on ${spokenTrackName(selectedTrackName)}` : 'Race on the selected track'
    );
  };

  const raceLabelObserver = new MutationObserver(syncRaceLabel);
  raceLabelObserver.observe(raceButton, { childList: true, characterData: true, subtree: true });
  syncRaceLabel();

  home.classList.add('m8-home-fixed-layout');
  home.dataset.m8HomeLayout = LAYOUT_ID;
  document.documentElement.dataset.turnHomeLayout = LAYOUT_ID;

  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  const { installM8HomeCardScrollFixes } = await import(
    `/turn/m8-home-card-scroll-fixes.js?build=${buildKey}-m8.4`
  );
  const cardScrollFixes = await installM8HomeCardScrollFixes();

  globalThis.__turnHomeLayout = Object.freeze({
    id: LAYOUT_ID,
    home,
    trackBrowser,
    menu,
    raceButton,
    cardScrollFixes
  });
  return globalThis.__turnHomeLayout;
}
