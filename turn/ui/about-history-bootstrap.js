import {
  CHANGELOG,
  CURRENT_RELEASE,
  DEVELOPMENT_HISTORY
} from '../content/about-history.js?revision=r163-modal-system';

const REVISION = 'r163-modal-system';
let installed = false;

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

function openDialog(dialog, trigger) {
  dialog.__turnReturnFocus = trigger;
  const card = dialog.querySelector('.m8-dialog-card');
  if (card) card.scrollTop = 0;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  try {
    dialog.querySelector('[data-dialog-close]')?.focus({ preventScroll: true });
  } catch (_) {
    dialog.querySelector('[data-dialog-close]')?.focus?.();
  }
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
  return CHANGELOG.map((release) => `
    <article class="turn-changelog-release">
      <time>${escapeMarkup(release.date)}</time>
      <h3>${escapeMarkup(release.entries[0]?.[0] || release.date)}</h3>
      <ul>${release.entries.map(([version, description]) => `
        <li><strong>${escapeMarkup(version)}:</strong> ${escapeMarkup(description)}</li>`).join('')}
      </ul>
    </article>`).join('');
}

function createHistoryDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog turn-dialog turn-dialog--reader turn-history-dialog';
  dialog.setAttribute('aria-labelledby', 'turnHistoryTitle');
  dialog.innerHTML = `
    <article class="m8-dialog-card turn-dialog__surface turn-history-card">
      <header class="m8-dialog-head turn-dialog__header turn-history-head">
        <div>
          <span>FROM FIRST PROTOTYPE TO TODAY</span>
          <h2 id="turnHistoryTitle">TURN HISTORY</h2>
          <p class="turn-history-release">V${escapeMarkup(CURRENT_RELEASE.version)} · BUILD ${escapeMarkup(CURRENT_RELEASE.build.toUpperCase())}</p>
        </div>
        <button type="button" data-dialog-close aria-label="Close TURN history">×</button>
      </header>

      <div class="turn-history-shell">
        <div class="turn-history-tabs" role="tablist" aria-label="TURN history sections">
          <button
            id="turnHistoryDevelopmentTab"
            type="button"
            role="tab"
            aria-selected="true"
            aria-controls="turnHistoryDevelopmentPanel"
            tabindex="0"
            data-history-tab="development"
          >DEVELOPMENT HISTORY</button>
          <button
            id="turnHistoryChangelogTab"
            type="button"
            role="tab"
            aria-selected="false"
            aria-controls="turnHistoryChangelogPanel"
            tabindex="-1"
            data-history-tab="changelog"
          >CHANGELOG</button>
        </div>

        <div class="turn-history-panels turn-dialog__body">
          <section
            id="turnHistoryDevelopmentPanel"
            class="turn-history-panel"
            role="tabpanel"
            aria-labelledby="turnHistoryDevelopmentTab"
            tabindex="0"
            data-history-panel="development"
          >
            <p class="turn-history-intro">TURN grew from a one-day sensor experiment into a five-track racing PWA with personal rivals, a fifteen-car garage, Drive By Ear, assistive-technology support and Trophy Road progression. This is the development story rather than a raw list of commits.</p>
            ${historyMarkup()}
          </section>

          <section
            id="turnHistoryChangelogPanel"
            class="turn-history-panel"
            role="tabpanel"
            aria-labelledby="turnHistoryChangelogTab"
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

  return Object.freeze({ select: (name) => {
    const tab = tabs.find((candidate) => candidate.dataset.historyTab === name) || tabs[0];
    selectTab(tab);
  }});
}

function compactAboutDialog(aboutDialog, historyDialog, tabs) {
  aboutDialog.classList.add('turn-dialog', 'turn-dialog--compact');
  aboutDialog.querySelector('.m8-about-card')?.classList.add('turn-dialog__surface');
  aboutDialog.querySelector('.m8-dialog-head')?.classList.add('turn-dialog__header');

  const content = aboutDialog.querySelector('.m8-about-content');
  if (!content) throw new Error('TURN history could not find the About content.');

  content.classList.add('turn-dialog__body');
  content.innerHTML = `
    <p class="m8-about-lead">TURN is a racing game about tilt steering, personal rivals and learning to drive by ear.</p>
    <p class="m8-about-summary">Built through inclusive and universal design so players can use sight, sound, touch, motion, a keyboard or assistive technology.</p>
    <p class="m8-about-credits">© 2026 <a href="https://enkel.design/" target="_blank" rel="noreferrer">enkel.design</a>. Created by Erik Jansson, aided by OpenAI Codex. Drive By Ear™ is inspired by <a href="https://ceal.cs.columbia.edu/rad/" target="_blank" rel="noreferrer">RAD – Racing Auditory Display</a>.</p>
    <div class="m8-about-actions turn-dialog__actions">
      <button class="m8-about-history" type="button" aria-haspopup="dialog">HISTORY &amp; CHANGELOG</button>
      <a class="m8-about-design-system" href="/turn/design.html" target="_blank" rel="noreferrer">DESIGN SYSTEM</a>
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

    // Home readiness is the stable lifecycle boundary. The one animation-frame
    // check closes the tiny race where About was installed between the initial
    // lookup and this listener being registered. No polling runs while a player
    // remains on installation onboarding.
    document.addEventListener('turn:home-ready', check, { once: true });
    requestAnimationFrame(check);
  });
}

export async function installAboutHistory() {
  if (installed) return globalThis.__turnAboutHistory;

  installStylesheet('../dialog-system-r163.css?revision=r163-modal-pattern', 'data-turn-dialog-system');
  installStylesheet('../about-history-r163.css?revision=r163-history-reader', 'data-turn-about-history');

  const about = await waitForAbout();
  const historyDialog = createHistoryDialog();
  const tabs = installTabs(historyDialog);
  const trigger = compactAboutDialog(about.dialog, historyDialog, tabs);

  installed = true;
  globalThis.__turnAboutHistory = Object.freeze({
    version: REVISION,
    dialog: historyDialog,
    trigger,
    open: (section = 'development') => {
      tabs.select(section);
      trigger.click();
    },
    close: () => closeDialog(historyDialog)
  });
  document.documentElement.dataset.turnDialogSystem = REVISION;
  return globalThis.__turnAboutHistory;
}

installAboutHistory().catch((error) => {
  console.error('TURN: About history enhancement failed.', error);
});
