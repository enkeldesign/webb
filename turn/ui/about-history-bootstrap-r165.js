import {
  CHANGELOG,
  CURRENT_RELEASE,
  DEVELOPMENT_HISTORY
} from '../content/about-history-current.js?build=20261026-r511';
import { aboutTurnHtml } from '../content/about-turn.js?revision=r1';
import { createFeedbackContent } from './feedback-content.js';

const REVISION = 'r165-browser-about';
const INSTALL_NOTE =
  'Install TURN as a home screen web app for the best fullscreen experience. You can also play here, but it is not recommended.';
const INSTALL_PITCH = 'TURN is an accessible motion-controlled arcade drift racer.';
// Unmodified Wikimedia Accessibility.svg, shipped locally with its existing About credit.
const ACCESSIBILITY_SYMBOL_URL = new URL('../assets/icons/accessibility.svg', import.meta.url).href;
const ACCESSIBILITY_FEATURES = Object.freeze([
  'Fun and inclusive racing game – play your way!',
  'Non-visual access with Drive By Ear',
  'Enhanced screen reader experience design',
  'Supports one-handed play and assistive tech'
]);

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
      ${entry.milestones.length ? `<ul>${entry.milestones.map((milestone) => `<li>${escapeMarkup(milestone)}</li>`).join('')}</ul>` : ''}
    </article>`).join('');
}

function changelogReleasesMarkup(releases) {
  return releases.map((release) => `
    <article class="turn-changelog-release">
      <h3><time>${escapeMarkup(release.date)}</time></h3>
      <ul>${release.entries.map(([feature, description]) => `
        <li><strong>${escapeMarkup(feature)}:</strong> ${escapeMarkup(description)}</li>`).join('')}
      </ul>
    </article>`).join('');
}

function changelogMarkup() {
  const releases = [...CHANGELOG].reverse();
  const recent = changelogReleasesMarkup(releases.slice(0, 6));
  const earlier = releases.slice(6);
  if (!earlier.length) return recent;
  return `${recent}
    <details class="turn-changelog-archive">
      <summary>Earlier milestones</summary>
      ${changelogReleasesMarkup(earlier)}
    </details>`;
}

// ACCESSIBILITY is its own reader, opened from ABOUT TURN as HISTORY AND CHANGELOG is
// and directly from the footers (#1119). The statement sits beside the shared
// feedback content, so a barrier can be reported from where it is described.
function createAccessibilityDialog(scope = 'game') {
  const prefix = scope === 'website' ? 'turnWebsiteAccessibility' : 'turnAccessibility';
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog turn-dialog turn-dialog--reader turn-history-dialog turn-accessibility-dialog';
  dialog.setAttribute('aria-labelledby', `${prefix}Title`);
  dialog.innerHTML = `
    <article class="m8-dialog-card turn-dialog__surface turn-history-card">
      <header class="m8-dialog-head turn-dialog__header turn-history-head">
        <div>
          <span>PLAY YOUR WAY</span>
          <h2 id="${prefix}Title">ACCESSIBILITY</h2>
        </div>
        <button type="button" data-dialog-close aria-label="Close Accessibility">×</button>
      </header>

      <div class="turn-history-shell">
        <div class="turn-history-panels turn-dialog__body">
          <section class="turn-history-panel turn-accessibility-panel" aria-labelledby="${prefix}Title" tabindex="0">
            <div class="turn-accessibility-statement">
              <p>TURN is designed so more people can play in more ways. Accessibility is part of the game design, not a separate mode, and TURN aims to meet WCAG 2.2 AA where those guidelines apply.</p>
              <p>Current support includes non-visual racing with Drive By Ear, screen-reader support, device or on-screen steering, and controls designed for one-handed play and assistive technology.</p>
              <p><strong>Still being validated:</strong> accessibility is an ongoing part of TURN. In particular, the complete end-to-end screen-reader experience has not yet been tested with experienced screen-reader players, so we do not claim that every path is complete.</p>
            </div>
            <h3 class="turn-accessibility-feedback-heading">Tell us what gets in the way</h3>
          </section>
        </div>
      </div>
    </article>`;
  const feedback = createFeedbackContent({ className: 'turn-accessibility-feedback' });
  dialog.querySelector('.turn-accessibility-panel').append(feedback.element);
  dialog.addEventListener('close', () => feedback.clearStatus());
  dialog.addEventListener('turn-dialog-fallback-close', () => feedback.clearStatus());
  document.body.appendChild(dialog);
  return dialog;
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
            <p class="turn-history-intro">From a steering experiment to a game about tilt, drift and flow. The milestones and decisions that shaped TURN.</p>
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
            <p class="turn-history-intro">The features that became part of TURN. Dates mark their settled form, with related changes grouped together.</p>
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

// ABOUT TURN hands over to a reader: it closes, the reader opens, and closing the reader
// brings ABOUT back with focus on the action that opened it. Opened directly from a
// footer, the reader returns focus to that footer control instead.
function linkReader(aboutDialog, readerDialog, aboutButton, prepare = () => {}) {
  let reopenAbout = false;
  // The control that opened ABOUT itself, kept while ABOUT is away so closing ABOUT
  // after a reader still returns there.
  let aboutReturnFocus = null;

  function open(sourceTrigger = aboutButton) {
    prepare();
    reopenAbout = aboutDialog.open || aboutDialog.hasAttribute('open');
    if (reopenAbout) {
      aboutReturnFocus = aboutDialog.__turnReturnFocus;
      aboutDialog.__turnReturnFocus = null;
      if (typeof aboutDialog.close === 'function' && aboutDialog.open) aboutDialog.close();
      else aboutDialog.removeAttribute('open');
    }
    openDialog(readerDialog, reopenAbout ? aboutButton : sourceTrigger);
  }

  function restore() {
    if (!reopenAbout) {
      readerDialog.__turnReturnFocus?.focus?.();
      return;
    }
    reopenAbout = false;
    aboutDialog.__turnReturnFocus = aboutReturnFocus;
    aboutReturnFocus = null;
    // Returning, not opening: focus goes back to the action that opened the reader, so
    // the heading-first focus every opening dialog gets is skipped this once
    // (startup-screen-reader-handoff). Cleared once those microtasks have run.
    aboutDialog.dataset.turnReturningFocus = 'true';
    if (typeof aboutDialog.showModal === 'function') aboutDialog.showModal();
    else aboutDialog.setAttribute('open', '');
    try {
      aboutButton.focus({ preventScroll: true });
    } catch (_) {
      aboutButton.focus();
    }
    globalThis.setTimeout(() => {
      delete aboutDialog.dataset.turnReturningFocus;
    }, 0);
  }

  aboutButton.addEventListener('click', () => open(aboutButton));
  readerDialog.querySelector('[data-dialog-close]')?.addEventListener('click', () => closeDialog(readerDialog));
  readerDialog.addEventListener('click', (event) => {
    if (event.target === readerDialog) closeDialog(readerDialog);
  });
  readerDialog.addEventListener('close', restore);
  readerDialog.addEventListener('turn-dialog-fallback-close', restore);
  return open;
}

function compactAboutDialog(aboutDialog, historyDialog, accessibilityDialog, tabs) {
  aboutDialog.classList.add('turn-dialog', 'turn-dialog--compact');
  aboutDialog.querySelector('.m8-about-card')?.classList.add('turn-dialog__surface');
  aboutDialog.querySelector('.m8-dialog-head')?.classList.add('turn-dialog__header');

  const content = aboutDialog.querySelector('.m8-about-content');
  if (!content) throw new Error('TURN history could not find the About content.');

  content.classList.add('turn-dialog__body');
  content.innerHTML = `
    ${aboutTurnHtml()}
    <div class="m8-about-actions turn-dialog__actions">
      <button class="m8-about-history" type="button" aria-haspopup="dialog"><span>HISTORY AND <br>CHANGELOG</span></button>
      <button class="m8-about-accessibility" type="button" aria-haspopup="dialog"><span>ACCESSIBILITY</span></button>
    </div>`;

  const historyButton = content.querySelector('.m8-about-history');
  const accessibilityButton = content.querySelector('.m8-about-accessibility');
  let historySection = 'development';
  const openHistoryReader = linkReader(aboutDialog, historyDialog, historyButton, () => {
    tabs.select(historySection);
    historySection = 'development';
  });
  const openAccessibility = linkReader(aboutDialog, accessibilityDialog, accessibilityButton);

  return Object.freeze({
    button: historyButton,
    accessibilityButton,
    open(section = 'development', sourceTrigger = historyButton) {
      historySection = section;
      openHistoryReader(sourceTrigger);
    },
    openAccessibility
  });
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

function ensureAccessibilitySummary(gate, actions) {
  let summary = gate.querySelector('.install-accessibility');
  if (summary) return summary;

  summary = document.createElement('section');
  summary.className = 'install-accessibility';
  summary.setAttribute('aria-labelledby', 'installAccessibilityTitle');

  const symbol = document.createElement('img');
  symbol.className = 'install-accessibility-symbol';
  symbol.src = ACCESSIBILITY_SYMBOL_URL;
  symbol.alt = '';
  symbol.width = 512;
  symbol.height = 512;
  symbol.decoding = 'async';
  symbol.referrerPolicy = 'no-referrer';

  const title = document.createElement('h2');
  title.id = 'installAccessibilityTitle';
  title.className = 'install-accessibility-title';
  title.textContent = 'Accessibility in TURN';

  const list = document.createElement('ul');
  list.className = 'install-accessibility-list';
  for (const feature of ACCESSIBILITY_FEATURES) {
    const item = document.createElement('li');
    item.textContent = feature;
    list.append(item);
  }

  summary.append(symbol, title, list);
  actions.before(summary);
  return summary;
}

function syncInstallGatePresentation() {
  const gate = document.querySelector('#installGate');
  const kicker = gate?.querySelector('.install-kicker');
  const actions = gate?.querySelector('.install-actions');
  const installButton = gate?.querySelector('#installTurnButton');
  const browserButton = gate?.querySelector('#playBrowserButton');
  const note = gate?.querySelector('#installNote');
  const copy = gate?.querySelector('.install-copy');
  if (!gate || !kicker || !actions || !installButton || !browserButton || !note || !copy) return null;

  copy.textContent = INSTALL_PITCH;
  ensureAccessibilitySummary(gate, actions);

  note.textContent = INSTALL_NOTE;
  note.setAttribute('role', 'status');
  note.setAttribute('aria-live', 'polite');
  note.setAttribute('aria-atomic', 'true');

  installButton.textContent = 'INSTALL TURN';
  browserButton.replaceChildren();
  const browserLabel = document.createElement('span');
  browserLabel.className = 'install-browser-label';
  browserLabel.textContent = 'PLAY IN BROWSER';
  const recommendation = document.createElement('small');
  recommendation.className = 'install-browser-recommendation';
  recommendation.textContent = '(NOT RECOMMENDED)';
  browserButton.append(browserLabel, recommendation);

  actions.append(installButton, note, browserButton);
  // The build/About footer belongs to the full composition, including the logo column.
  gate.querySelector('.install-shell')?.append(kicker);
  return { gate, kicker, note };
}

function createInstallAccessibilityTrigger(gate, kicker) {
  let trigger = gate.querySelector('#installAccessibilityButton');
  if (trigger) return trigger;

  trigger = document.createElement('button');
  trigger.id = 'installAccessibilityButton';
  trigger.className = 'install-about-trigger install-accessibility-trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.textContent = 'ACCESSIBILITY';

  const links = kicker.querySelector('.install-kicker-links');
  const wiki = links?.querySelector('.install-wiki-link');
  const separator = document.createElement('span');
  separator.className = 'install-kicker-separator';
  separator.setAttribute('aria-hidden', 'true');
  separator.textContent = '·';

  if (wiki) {
    const existingSeparator = wiki.previousElementSibling?.classList.contains('install-kicker-separator')
      ? wiki.previousElementSibling
      : null;
    if (existingSeparator) existingSeparator.after(trigger, separator);
    else wiki.before(trigger, separator);
  } else if (links) {
    links.append(trigger);
  } else {
    kicker.append(trigger);
  }

  return trigger;
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

  const accessibilityTrigger = createInstallAccessibilityTrigger(gate, kicker);
  const aboutDialog = createWebsiteAboutDialog();
  const historyDialog = createHistoryDialog('website');
  const accessibilityDialog = createAccessibilityDialog('website');
  const tabs = installTabs(historyDialog);
  const aboutContent = compactAboutDialog(aboutDialog, historyDialog, accessibilityDialog, tabs);

  const closeAbout = () => closeDialog(aboutDialog);
  aboutDialog.querySelector('[data-dialog-close]')?.addEventListener('click', closeAbout);
  aboutDialog.addEventListener('click', (event) => {
    if (event.target === aboutDialog) closeAbout();
  });
  const restoreTrigger = () => aboutDialog.__turnReturnFocus?.focus?.();
  aboutDialog.addEventListener('close', restoreTrigger);
  aboutDialog.addEventListener('turn-dialog-fallback-close', restoreTrigger);
  trigger.addEventListener('click', () => openDialog(aboutDialog, trigger));
  accessibilityTrigger.addEventListener('click', () => {
    aboutContent.openAccessibility(accessibilityTrigger);
  });

  document.addEventListener('turn-install-ready', () => {
    queueMicrotask(() => {
      note.textContent = INSTALL_NOTE;
    });
  });

  websiteInstalled = true;
  globalThis.__turnWebsiteAbout = Object.freeze({
    version: REVISION,
    dialog: aboutDialog,
    accessibilityDialog,
    trigger,
    accessibilityTrigger,
    open: () => openDialog(aboutDialog, trigger),
    openAccessibility: () => aboutContent.openAccessibility(accessibilityTrigger),
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
  installStylesheet('../home-feedback-r135.css?revision=r224-modal-headings', 'data-turn-home-feedback');
  installStylesheet('../dialog-system-r163.css?revision=r165-browser-about', 'data-turn-dialog-system');
  installStylesheet('../about-history-r163.css?revision=r165-browser-about', 'data-turn-about-history');
  installStylesheet('../browser-install-r165.css?revision=r165-browser-about', 'data-turn-browser-install');

  installWebsiteAbout();

  if (gameInstalled) return globalThis.__turnAboutHistory;

  const about = await waitForAbout();
  const historyDialog = createHistoryDialog('game');
  const accessibilityDialog = createAccessibilityDialog('game');
  const tabs = installTabs(historyDialog);
  const aboutContent = compactAboutDialog(about.dialog, historyDialog, accessibilityDialog, tabs);
  about.accessibilityTrigger.addEventListener('click', () => {
    aboutContent.openAccessibility(about.accessibilityTrigger);
  });

  gameInstalled = true;
  globalThis.__turnAboutHistory = Object.freeze({
    version: REVISION,
    dialog: historyDialog,
    accessibilityDialog,
    trigger: aboutContent.button,
    accessibilityTrigger: about.accessibilityTrigger,
    open(section = 'development') {
      if (section === 'accessibility') {
        aboutContent.openAccessibility(about.accessibilityTrigger);
        return;
      }
      aboutContent.open(section, about.trigger);
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
