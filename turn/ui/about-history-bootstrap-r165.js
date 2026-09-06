import {
  CHANGELOG,
  CURRENT_RELEASE,
  DEVELOPMENT_HISTORY
} from '../content/about-history.js?build=20260906-r207';
import { aboutTurnHtml } from '../content/about-turn.js?revision=r1';

const REVISION = 'r165-browser-about';
const INSTALL_NOTE =
  'Install TURN as a home screen web app for the best fullscreen experience. You can also play here, but it is not recommended.';

let gameInstalled = false;
let websiteInstalled = false;

function withBuild(path) {
  const url = new URL(path, import.meta.url);
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  if (buildKey) url.searchParams.set('build', `${buildKey}-${REVISION}`);
  return url.href;
}

function installStylesheet(path, dataAttribute) {
  if (document.querySelector(`link[${dataAttribute}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = withBuild(path);
  link.setAttribute(dataAttribute, '');
  document.head.appendChild(link);
}

function focusDialogHeading(dialog) {
  const labelledBy = String(dialog.getAttribute('aria-labelledby') || '').trim().split(/\s+/)[0];
  const heading = (labelledBy && document.getElementById(labelledBy))
    || dialog.querySelector('h1, h2, h3, [role="heading"]');
  if (!heading || !dialog.contains(heading)) return;
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  try {
    heading.focus({ preventScroll: true });
  } catch (_) {
    heading.focus?.();
  }
}

function openDialog(dialog, trigger) {
  dialog.__turnReturnFocus = trigger;
  const card = dialog.querySelector('.m8-dialog-card');
  if (card) card.scrollTop = 0;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  focusDialogHeading(dialog);
}

function closeDialog(dialog) {
  if (typeof dialog.close === 'function' && dialog.open) {
    dialog.close();
    return;
  }
  dialog.removeAttribute('open');
  dialog.dispatchEvent(new Event('turn-dialog-fallback-close'));
}

function escapeMarkup(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function historyMarkup() {
  return DEVELOPMENT_HISTORY.map((entry) => `
    <article class="turn-history-entry">
      <span>${escapeMarkup(entry.period)}</span>
      <h3>${escapeMarkup(entry.title)}</h3>
      ${entry.paragraphs.map((paragraph) => `<p>${escapeMarkup(paragraph)}</p>`).join('')}
      <ul>${entry.milestones.map((milestone) => `<li>${escapeMarkup(milestone)}</li>`).join('')}</ul>
    </article>`).join('');
}

function changelogMarkup() {
  return [...CHANGELOG].reverse().map((release) => `
    <article class="turn-changelog-release">
      <time>${escapeMarkup(release.date)}</time>
      <h3>${escapeMarkup(release.entries[0]?.[0] || release.date)}</h3>
      <ul>${release.entries.map(([version, description]) => `
        <li><strong>${escapeMarkup(version)}:</strong> ${escapeMarkup(description)}</li>`).join('')}
      </ul>
    </article>`).join('');
}

function createHistoryDialog(scope = 'game') {
  const prefix = scope === 'website' ? 'turnWebsiteHistory' : 'turnHistory';
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog turn-dialog turn-dialog--reader turn-history-dialog';
  dialog.setAttribute('aria-labelledby', `${prefix}Title`);
  dialog.innerHTML = `
    <article class="m8-dialog-card turn-dialog__surface turn-history-card">
      <header class="m8-dialog-head turn-dialog__header turn-history-head">
        <div>
          <span>FROM FIRST PROTOTYPE TO TODAY</span>
          <h2 id="${prefix}Title">TURN HISTORY</h2>
          <p class="turn-history-release">V${escapeMarkup(CURRENT_RELEASE.version)} · BUILD ${escapeMarkup(CURRENT_RELEASE.build.toUpperCase())}</p>
        </div>
        <button type="button" data-dialog-close aria-label="Close TURN history">×</button>
      </header>

      <div class="turn-history-shell">
        <div class="turn-history-tabs" role="tablist" aria-label="TURN history sections">
          <button
            id="${prefix}DevelopmentTab"
            type="button"
            role="tab"
            aria-selected="true"
            aria-controls="${prefix}DevelopmentPanel"
            tabindex="0"
            data-history-tab="development"
          >DEVELOPMENT HISTORY</button>
          <button
            id="${prefix}ChangelogTab"
            type="button"
            role="tab"
            aria-selected="false"
            aria-controls="${prefix}ChangelogPanel"
            tabindex="-1"
            data-history-tab="changelog"
          >CHANGELOG</button>
        </div>

        <div class="turn-history-panels turn-dialog__body">
          <section
            id="${prefix}DevelopmentPanel"
            class="turn-history-panel"
            role="tabpanel"
            aria-labelledby="${prefix}DevelopmentTab"
            tabindex="0"
            data-history-panel="development"
          >
            <p class="turn-history-intro">TURN grew from a one-day sensor experiment into a six-track racing PWA with personal rivals, a fifteen-car garage, Drive By Ear, assistive-technology support and Trophy Road progression. This is the development story rather than a raw list of commits.</p>
            ${historyMarkup()}
          </section>

          <section
            id="${prefix}ChangelogPanel"
            class="turn-history-panel"
            role="tabpanel"
            aria-labelledby="${prefix}ChangelogTab"
            tabindex="0"
            data-history-panel="changelog"
            hidden
          >
            <p class="turn-history-intro">Meaningful player-facing, accessibility, architecture, performance and content changes are consolidated by date. Reverted experiments remain visible because they explain the product decisions that followed.</p>
            ${changelogMarkup()}
          </section>
        </div>
      </div>
    </article>`;
  document.body.appendChild(dialog);
  return dialog;
}

function installTabs(dialog) {
  const tabs = [...dialog.querySelectorAll('[role="tab"]')];
  const panels = [...dialog.querySelectorAll('[role="tabpanel"]')];

  function selectTab(tab, { focus = false } = {}) {
    const selected = tab?.dataset.historyTab;
    if (!selected) return;
    for (const candidate of tabs) {
      const active = candidate === tab;
      candidate.setAttribute('aria-selected', String(active));
      candidate.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.historyPanel !== selected;
    }
    if (focus) tab.focus();
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      const currentIndex = tabs.indexOf(tab);
      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[nextIndex], { focus: true });
    });
  }

  return Object.freeze({
    select(name) {
      const tab = tabs.find((candidate) => candidate.dataset.historyTab === name) || tabs[0];
      selectTab(tab);
    }
  });
}

function compactAboutDialog(aboutDialog, historyDialog, tabs) {
  aboutDialog.classList.add('turn-dialog', 'turn-dialog--compact');
  aboutDialog.querySelector('.m8-about-card')?.classList.add('turn-dialog__surface');
  aboutDialog.querySelector('.m8-dialog-head')?.classList.add('turn-dialog__header');

  const content = aboutDialog.querySelector('.m8-about-content');
  if (!content) throw new Error('TURN history could not find the About content.');

  content.classList.add('turn-dialog__body');
  content.innerHTML = `
    ${aboutTurnHtml()}
    <div class="m8-about-actions turn-dialog__actions">
      <button class="m8-about-history" type="button" aria-haspopup="dialog"><span>HISTORY AND<br>CHANGELOG</span></button>
    </div>`;

  const historyButton = content.querySelector('.m8-about-history');
  let reopenAbout = false;

  function showHistory() {
    tabs.select('development');
    reopenAbout = aboutDialog.open || aboutDialog.hasAttribute('open');
    if (reopenAbout) {
      aboutDialog.__turnReturnFocus = null;
      if (typeof aboutDialog.close === 'function' && aboutDialog.open) aboutDialog.close();
      else aboutDialog.removeAttribute('open');
    }
    openDialog(historyDialog, historyButton);
  }

  function restoreAbout() {
    if (!reopenAbout) {
      historyDialog.__turnReturnFocus?.focus?.();
      return;
    }
    reopenAbout = false;
    if (typeof aboutDialog.showModal === 'function') aboutDialog.showModal();
    else aboutDialog.setAttribute('open', '');
    try {
      historyButton.focus({ preventScroll: true });
    } catch (_) {
      historyButton.focus();
    }
  }

  historyButton.addEventListener('click', showHistory);
  historyDialog.querySelector('[data-dialog-close]')?.addEventListener('click', () => closeDialog(historyDialog));
  historyDialog.addEventListener('click', (event) => {
    if (event.target === historyDialog) closeDialog(historyDialog);
  });
  historyDialog.addEventListener('close', restoreAbout);
  historyDialog.addEventListener('turn-dialog-fallback-close', restoreAbout);

  return historyButton;
}

function createWebsiteAboutDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog m8-about-dialog install-about-dialog';
  dialog.setAttribute('aria-labelledby', 'turnWebsiteAboutTitle');
  dialog.innerHTML = `
    <article class="m8-dialog-card m8-about-card">
      <header class="m8-dialog-head">
        <div><span>THE GAME</span><h2 id="turnWebsiteAboutTitle">ABOUT TURN</h2></div>
        <button type="button" data-dialog-close aria-label="Close About TURN">×</button>
      </header>
      <div class="m8-about-content"></div>
    </article>`;
  document.body.appendChild(dialog);
  return dialog;
}

function syncInstallGatePresentation() {
  const gate = document.querySelector('#installGate');
  const kicker = gate?.querySelector('.install-kicker');
  const actions = gate?.querySelector('.install-actions');
  const installButton = gate?.querySelector('#installTurnButton');
  const browserButton = gate?.querySelector('#playBrowserButton');
  const note = gate?.querySelector('#installNote');
  if (!gate || !kicker || !actions || !installButton || !browserButton || !note) return null;

  note.textContent = INSTALL_NOTE;
  actions.append(installButton, note, browserButton);
  return { gate, kicker, note };
}

function installWebsiteAbout() {
  if (document.documentElement.classList.contains('turn-standalone')) return null;

  const presentation = syncInstallGatePresentation();
  if (!presentation) return null;
  if (websiteInstalled) return globalThis.__turnWebsiteAbout;

  const { gate, kicker, note } = presentation;
  let trigger = gate.querySelector('#installAboutButton');
  if (!trigger) {
    const separator = document.createElement('span');
    separator.className = 'install-kicker-separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '·';

    trigger = document.createElement('button');
    trigger.id = 'installAboutButton';
    trigger.className = 'install-about-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.textContent = 'ABOUT TURN';
    kicker.append(separator, trigger);
  }

  const aboutDialog = createWebsiteAboutDialog();
  const historyDialog = createHistoryDialog('website');
  const tabs = installTabs(historyDialog);
  compactAboutDialog(aboutDialog, historyDialog, tabs);

  const closeAbout = () => closeDialog(aboutDialog);
  aboutDialog.querySelector('[data-dialog-close]')?.addEventListener('click', closeAbout);
  aboutDialog.addEventListener('click', (event) => {
    if (event.target === aboutDialog) closeAbout();
  });
  const restoreTrigger = () => trigger.focus?.();
  aboutDialog.addEventListener('close', restoreTrigger);
  aboutDialog.addEventListener('turn-dialog-fallback-close', restoreTrigger);
  trigger.addEventListener('click', () => openDialog(aboutDialog, trigger));

  document.addEventListener('turn-install-ready', () => {
    queueMicrotask(() => {
      note.textContent = INSTALL_NOTE;
    });
  });

  websiteInstalled = true;
  globalThis.__turnWebsiteAbout = Object.freeze({
    version: REVISION,
    dialog: aboutDialog,
    trigger,
    open: () => openDialog(aboutDialog, trigger),
    close: closeAbout
  });
  return globalThis.__turnWebsiteAbout;
}

function findAboutApi() {
  const about = globalThis.__turnHomeFeedback?.about;
  return about?.dialog?.isConnected ? about : null;
}

function waitForAbout() {
  const existing = findAboutApi();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const check = () => {
      if (settled) return;
      const about = findAboutApi();
      if (!about) return;
      settled = true;
      resolve(about);
    };

    document.addEventListener('turn:home-ready', check, { once: true });
    requestAnimationFrame(check);
  });
}

export async function installAboutHistory() {
  installStylesheet('../m8-home.css?revision=r224-modal-headings', 'data-turn-home-dialog-foundation');
  installStylesheet('../dialog-system-r163.css?revision=r165-browser-about', 'data-turn-dialog-system');
  installStylesheet('../about-history-r163.css?revision=r165-browser-about', 'data-turn-about-history');
  installStylesheet('../browser-install-r165.css?revision=r165-browser-about', 'data-turn-browser-install');

  installWebsiteAbout();

  if (gameInstalled) return globalThis.__turnAboutHistory;

  const about = await waitForAbout();
  const historyDialog = createHistoryDialog('game');
  const tabs = installTabs(historyDialog);
  const trigger = compactAboutDialog(about.dialog, historyDialog, tabs);

  gameInstalled = true;
  globalThis.__turnAboutHistory = Object.freeze({
    version: REVISION,
    dialog: historyDialog,
    trigger,
    open(section = 'development') {
      tabs.select(section);
      trigger.click();
    },
    close: () => closeDialog(historyDialog)
  });
  document.documentElement.dataset.turnDialogSystem = REVISION;
  return globalThis.__turnAboutHistory;
}

function start() {
  installAboutHistory().catch((error) => {
    console.error('TURN: About history enhancement failed.', error);
  });
}

start();

if (document.readyState !== 'complete') {
  document.addEventListener('DOMContentLoaded', () => {
    installWebsiteAbout();
  }, { once: true });
}
