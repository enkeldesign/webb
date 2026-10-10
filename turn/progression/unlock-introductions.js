import { getTrophyRoadReward } from './trophy-road.js';

// Unlock introductions (#1149, #1150): when DRIFT ATTACK, SHIFT or FLOW unlocks, Home
// explains it in a bottom sheet that stays until the player closes it, instead of
// leaving them to find HOW TO PLAY. DRIFT ATTACK offers its tutorial; SHIFT points
// GARAGE at ACTIVATE SHIFT the next time it opens, then the drive pad's SHIFT in the
// next races (ui/shift-race-callout.js). Only unlocks that happen from now on
// are introduced: players who already have these keep their HOW TO PLAY guide.
export const UNLOCK_INTRODUCTIONS_KEY = 'turn-unlock-introductions-v1';
const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
// As with TURN TUTORIAL's launch card (tutorial-entry.js), introductions open by
// themselves for players, not in automated or local runs, where test suites earn rewards
// all the time. A test of the introductions opts in with this key; admin replays always show.
export const INTRODUCTIONS_UNDER_TEST_KEY = 'turn-unlock-introductions-under-test';
const STYLE_ID = 'turn-unlock-introduction-styles';
const SHOW_DELAY_MS = 900;
const HINT_SECONDS = 4.5;

export const UNLOCK_INTRODUCTIONS = Object.freeze({
  'drift-attack': Object.freeze({
    title: 'DRIFT ATTACK',
    copy: Object.freeze([
      'Every slide now scores DRIFT points: hold a drift, then straighten out to BANK them.',
      'OVERCHARGE comes with it. With BOOST full, keep drifting to build a stronger burst, catch it on GAS, then spend it with BOOST.'
    ]),
    action: Object.freeze({ id: 'drift-attack-tutorial', label: 'START DRIFT ATTACK TUTORIAL' }),
    note: 'You can play DRIFT ATTACK TUTORIAL any time from HOW TO PLAY.'
  }),
  shift: Object.freeze({
    title: 'SHIFT',
    copy: Object.freeze([
      'Every car can now SHIFT: move attribute points into an alternate setup in GARAGE.',
      'While racing, slide from GAS into SHIFT to switch between STANDARD and SHIFT.'
    ]),
    note: 'Next time you open GARAGE, ACTIVATE SHIFT is highlighted for you.',
    hints: Object.freeze(['garage-shift', 'race-shift'])
  }),
  flow: Object.freeze({
    title: 'FLOW',
    copy: Object.freeze([
      'FLOW scores how you mix techniques: SHIFT, BOOST, DRIFT, LOCK, catching OVERCHARGE and clean exits.',
      'Vary them at the right moment to build COMBO. Repeating the same idea adds less.'
    ]),
    note: 'More about FLOW in HOW TO PLAY.'
  })
});

function readState(storage) {
  try {
    const raw = JSON.parse(storage?.getItem?.(UNLOCK_INTRODUCTIONS_KEY) || 'null');
    const ids = (value) => (Array.isArray(value) ? value.filter((id) => UNLOCK_INTRODUCTIONS[id]) : []);
    const views = raw?.views && typeof raw.views === 'object' ? raw.views : {};
    const state = { pending: ids(raw?.pending), shown: ids(raw?.shown), hints: Array.isArray(raw?.hints) ? raw.hints : [], views };
    // Saved before r428, which added views and the race hint: a SHIFT introduced then
    // arms the race hint once. Every later save carries views, so it is never re-armed.
    if (raw && !raw.views && state.shown.includes('shift') && !state.hints.includes('race-shift')) {
      state.hints.push('race-shift');
    }
    return state;
  } catch (_) {
    return { pending: [], shown: [], hints: [], views: {} };
  }
}

// The queue, without the page: what is waiting to be introduced, and what has been.
export function createUnlockIntroductionQueue(storage = globalThis.localStorage) {
  const state = readState(storage);
  const save = () => {
    try {
      storage?.setItem?.(UNLOCK_INTRODUCTIONS_KEY, JSON.stringify(state));
    } catch (_) {}
  };
  return Object.freeze({
    // A reward unlocked just now; replay (admin) introduces it again.
    unlocked(ids, { replay = false } = {}) {
      let changed = false;
      for (const id of ids || []) {
        if (!UNLOCK_INTRODUCTIONS[id]) continue;
        if (replay) state.shown = state.shown.filter((shown) => shown !== id);
        if (state.shown.includes(id) || state.pending.includes(id)) continue;
        state.pending.push(id);
        changed = true;
      }
      if (changed) save();
      return changed;
    },
    next: () => state.pending[0] || null,
    // Closed by the player: introduced, and its follow-up hints armed.
    introduced(id) {
      state.pending = state.pending.filter((pending) => pending !== id);
      if (!state.shown.includes(id)) state.shown.push(id);
      for (const hint of UNLOCK_INTRODUCTIONS[id]?.hints || []) {
        if (!state.hints.includes(hint)) state.hints.push(hint);
        delete state.views[hint];
      }
      save();
    },
    hasHint: (hint) => state.hints.includes(hint),
    consumeHint(hint) {
      state.hints = state.hints.filter((pending) => pending !== hint);
      delete state.views[hint];
      save();
    },
    // A hint shown once more; after `limit` showings it has had its chance.
    viewHint(hint, limit = 1) {
      const views = (Number(state.views[hint]) || 0) + 1;
      if (views >= limit) {
        state.hints = state.hints.filter((pending) => pending !== hint);
        delete state.views[hint];
      } else {
        state.views[hint] = views;
      }
      save();
      return views;
    },
    snapshot: () => JSON.parse(JSON.stringify(state))
  });
}

function installStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .m8-dialog.m8-unlock-sheet {
      width: min(570px, calc(100vw - 24px));
      margin: auto auto calc(env(safe-area-inset-bottom) + var(--turn-space-3));
    }
    .m8-unlock-sheet .m8-dialog-card { display: grid; gap: var(--turn-space-3); }
    .m8-unlock-sheet .m8-dialog-head { margin-bottom: 0; }
    .m8-unlock-copy p { margin: 0; font-size: var(--turn-type-body); line-height: var(--turn-leading-body); }
    .m8-unlock-copy p + p { margin-top: var(--turn-space-2); }
    .m8-unlock-note { margin: 0; font-size: var(--turn-type-small); line-height: var(--turn-leading-body); }
    .m8-unlock-actions { display: grid; gap: var(--turn-space-3); }
    .m8-unlock-actions button,
    .roadbook-admin button {
      min-height: var(--turn-target-min);
      padding: var(--turn-space-3) var(--turn-space-4);
      border: var(--turn-border-control) solid var(--turn-outline);
      border-radius: var(--turn-radius-control);
      background: var(--turn-action-utility);
      color: var(--turn-text);
      font: inherit;
      font-size: var(--turn-type-body);
      font-weight: var(--turn-weight-display);
      cursor: pointer;
    }
    .m8-unlock-actions [data-unlock-action] { background: var(--turn-action-primary); color: var(--turn-ink); }
    .roadbook-admin { display: grid; gap: var(--turn-space-2); margin-top: var(--turn-space-4); }
    .roadbook-admin h2 { margin: 0; font-size: var(--turn-type-small); letter-spacing: 0.16em; }
    .roadbook-admin div { display: flex; flex-wrap: wrap; gap: var(--turn-space-2); }
    .garage-shift.is-introduced { animation: turn-unlock-pulse 1.5s ease-in-out 3; }
    @keyframes turn-unlock-pulse {
      50% { box-shadow: 0 0 0 var(--turn-space-2) var(--turn-action-primary); }
    }
    @media (prefers-reduced-motion: reduce) {
      .garage-shift.is-introduced {
        animation: none;
        outline: var(--turn-border-control) solid var(--turn-action-primary);
        outline-offset: var(--turn-space-1);
      }
    }
  `;
  documentRef.head.appendChild(style);
}

function createSheet(documentRef) {
  const dialog = documentRef.createElement('dialog');
  dialog.className = 'm8-dialog m8-unlock-sheet';
  dialog.setAttribute('aria-labelledby', 'turnUnlockTitle');
  dialog.setAttribute('aria-describedby', 'turnUnlockCopy');
  dialog.innerHTML = `
    <article class="m8-dialog-card">
      <header class="m8-dialog-head">
        <div><span>UNLOCKED</span><h2 id="turnUnlockTitle" tabindex="-1"></h2></div>
      </header>
      <div class="m8-unlock-copy" id="turnUnlockCopy"></div>
      <div class="m8-unlock-actions">
        <button type="button" data-unlock-action hidden></button>
        <button type="button" data-unlock-close>GOT IT</button>
      </div>
      <p class="m8-unlock-note"></p>
    </article>`;
  documentRef.body.appendChild(dialog);
  return dialog;
}

function homeIsReady(documentRef) {
  return documentRef.visibilityState !== 'hidden'
    && documentRef.documentElement.classList.contains('turn-home-ready')
    && documentRef.body.classList.contains('turn-home-open')
    && Boolean(documentRef.querySelector('.m8-home:not([hidden])'))
    && !documentRef.querySelector('dialog[open]');
}

export function introducesOnUnlock(windowRef = globalThis, storage = globalThis.localStorage) {
  const local = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(windowRef.location?.hostname || '');
  if (!windowRef.navigator?.webdriver && !local) return true;
  try {
    return storage?.getItem?.(INTRODUCTIONS_UNDER_TEST_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function isAdminProfile(storage) {
  try {
    return Boolean(storage?.getItem?.(ADMIN_UNLOCK_MARKER));
  } catch (_) {
    return false;
  }
}

export function installUnlockIntroductions({
  startTutorial,
  storage = globalThis.localStorage,
  documentRef = globalThis.document,
  windowRef = globalThis
} = {}) {
  installStyles(documentRef);
  const queue = createUnlockIntroductionQueue(storage);
  const dialog = createSheet(documentRef);
  const title = dialog.querySelector('h2');
  const copy = dialog.querySelector('.m8-unlock-copy');
  const note = dialog.querySelector('.m8-unlock-note');
  const actionButton = dialog.querySelector('[data-unlock-action]');
  const closeButton = dialog.querySelector('[data-unlock-close]');
  let showing = null;
  let timer = 0;
  let hintObserver = null;
  let replayed = false;

  function show(id) {
    const introduction = UNLOCK_INTRODUCTIONS[id];
    if (!introduction) return false;
    showing = id;
    title.textContent = introduction.title;
    copy.replaceChildren(...introduction.copy.map((text) => {
      const paragraph = documentRef.createElement('p');
      paragraph.textContent = text;
      return paragraph;
    }));
    note.textContent = introduction.note || '';
    actionButton.hidden = !introduction.action;
    actionButton.textContent = introduction.action?.label || '';
    closeButton.textContent = introduction.action ? 'LATER' : 'GOT IT';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    title.focus();
    return true;
  }

  function schedule(delay = SHOW_DELAY_MS) {
    windowRef.clearTimeout?.(timer);
    if (!queue.next() || (!replayed && !introducesOnUnlock(windowRef, storage))) return;
    timer = windowRef.setTimeout?.(() => {
      if (showing) return;
      if (!homeIsReady(documentRef)) {
        // On Home behind another dialog: try again. Racing: home-shown brings it back.
        if (documentRef.querySelector('.m8-home:not([hidden])')) schedule(1500);
        return;
      }
      const id = queue.next();
      if (id) show(id);
    }, delay) || 0;
  }

  function finish() {
    const id = showing;
    showing = null;
    if (!id) return;
    queue.introduced(id);
    watchHints();
    schedule();
  }

  closeButton.addEventListener('click', () => dialog.close?.());
  actionButton.addEventListener('click', () => {
    const action = UNLOCK_INTRODUCTIONS[showing]?.action?.id;
    dialog.close?.();
    if (action === 'drift-attack-tutorial') void startTutorial?.('drift-attack');
  });
  dialog.addEventListener('close', finish);

  // ACTIVATE SHIFT, the next time GARAGE shows it: brought into view and pulsed.
  function watchHints() {
    if (hintObserver || !queue.hasHint('garage-shift') || typeof MutationObserver !== 'function') return;
    const reveal = () => {
      const target = documentRef.querySelector('.garage-shift');
      if (!target || target.hidden || !target.offsetParent) return;
      hintObserver?.disconnect();
      hintObserver = null;
      queue.consumeHint('garage-shift');
      const reduced = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      target.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      target.classList.add('is-introduced');
      windowRef.setTimeout?.(() => target.classList.remove('is-introduced'), HINT_SECONDS * 1000);
    };
    hintObserver = new MutationObserver(reveal);
    hintObserver.observe(documentRef.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    reveal();
  }

  windowRef.addEventListener?.('turn:trophy-road-updated', (event) => {
    if (queue.unlocked(event.detail?.unlocked)) schedule();
  });
  windowRef.addEventListener?.('turn:home-shown', () => schedule());
  windowRef.addEventListener?.('turn:trophy-road-toast-shown', () => schedule());
  documentRef.addEventListener?.('turn:home-ready', () => schedule());
  watchHints();
  schedule();

  // Admin profiles have every reward already: these replay an unlock to test it.
  function installAdminRow() {
    if (!isAdminProfile(storage)) return null;
    const list = documentRef.querySelector('.roadbook-tracks .roadbook-list');
    if (!list) return null;
    const row = documentRef.createElement('section');
    row.className = 'roadbook-admin';
    row.setAttribute('aria-labelledby', 'roadbookAdminTitle');
    row.innerHTML = `<h2 id="roadbookAdminTitle">ADMIN</h2><div>${Object.keys(UNLOCK_INTRODUCTIONS)
      .map((id) => `<button type="button" data-admin-unlock="${id}">UNLOCK ${UNLOCK_INTRODUCTIONS[id].title}</button>`)
      .join('')}</div>`;
    list.after(row);
    row.addEventListener('click', (event) => {
      const id = event.target.closest?.('[data-admin-unlock]')?.dataset.adminUnlock;
      if (!id) return;
      replay(id);
    });
    return row;
  }

  function replay(id) {
    const reward = getTrophyRoadReward(id);
    if (reward) globalThis.__turnAchievements?.showRewardToastBatch?.([reward]);
    queue.unlocked([id], { replay: true });
    replayed = true;
    schedule(250);
  }

  const adminRow = installAdminRow();
  return Object.freeze({ dialog, queue, adminRow, replay, schedule });
}
