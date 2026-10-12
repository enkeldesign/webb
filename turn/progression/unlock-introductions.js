import { getTrophyRoadReward } from './trophy-road.js';
import { garageOpenedForCar, pointOutInGarage, suggestInGarage, viewCarWhenGarageOpens } from '../garage/garage-focus.js';

// Unlock introductions (#1149, #1150): when DRIFT ATTACK, SHIFT or FLOW unlocks, Home
// explains it in a bottom sheet that stays until the player closes it, instead of
// leaving them to find HOW TO PLAY. DRIFT ATTACK and FLOW offer their tutorials; SHIFT points
// GARAGE at ACTIVATE SHIFT the next time it opens, then the drive pad's SHIFT in the
// next races (ui/shift-race-callout.js). PAINTJOB needs no sheet: its reward toast says
// it, and GARAGE points out PAINT. Only unlocks that happen from now on are introduced:
// players who already have these keep their HOW TO PLAY guide.
export const UNLOCK_INTRODUCTIONS_KEY = 'turn-unlock-introductions-v1';
const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
// As with TURN TUTORIAL's launch card (tutorial-entry.js), introductions open by
// themselves for players, not in automated or local runs, where test suites earn rewards
// all the time. A test of the introductions opts in with this key; admin replays always show.
export const INTRODUCTIONS_UNDER_TEST_KEY = 'turn-unlock-introductions-under-test';
const STYLE_ID = 'turn-unlock-introduction-styles';
const SHOW_DELAY_MS = 900;

// Unlocks explained by their reward toast alone, then pointed out the next time GARAGE
// shows them.
export const UNLOCK_HINTS = Object.freeze({
  paintjob: Object.freeze({ title: 'PAINTJOB', hint: 'garage-paint' })
});
// What each GARAGE hint scrolls to and pulses, and what it says. ownVisit: only on a
// GARAGE visit the player opened themselves, with nothing else to point out (#1168).
// untilUsed: after that, a calm pulse on every visit until the player uses it, which
// clicking anything matching untilUsed counts as (#1189).
const GARAGE_HINT_TARGETS = Object.freeze({
  'garage-shift': Object.freeze({ selector: '.garage-shift', say: 'New in GARAGE: ACTIVATE SHIFT, below the car’s name.' }),
  'garage-paint': Object.freeze({ selector: '.garage-paint-toggle', say: 'New in GARAGE: PAINT, below the car’s name.' }),
  // The button on phones; the inline catalog's heading where GARAGE shows ALL CARS
  // beside or below the car (tablets), and hides the button.
  'garage-all-cars': Object.freeze({
    selector: '.garage-all-cars-button, #garageCatalogTitle',
    say: 'New in GARAGE: ALL CARS, every car and what unlocks it.',
    ownVisit: true,
    // Opening the sheet on a phone, or choosing a car from it or from the catalog
    // shown inline on iPad.
    untilUsed: '.garage-all-cars-button, .garage-car-card'
  })
});
// Armed once for every player, the first time TURN runs with this release. Players who
// saw the r435 hint, which ended after one showing, are armed once more (#1189).
export const ALL_CARS_HINT = 'garage-all-cars';
export const ALL_CARS_UNTIL_USED = 'garage-all-cars-until-used';

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
  // SHIFT is learnt by doing, in GARAGE's SHIFT box: no preset. The SEDAN (3 in every
  // attribute) can make any trade; the LEARNER CAR has only one legal SHIFT setup.
  shift: Object.freeze({
    title: 'SHIFT',
    copy: Object.freeze([
      'Every car can now SHIFT: move attribute points into an alternate setup in GARAGE.',
      'While racing, slide from GAS into SHIFT to switch between STANDARD and SHIFT.',
      'The SEDAN has 3 in every attribute, so it can make any trade: a good car to try it in.'
    ]),
    action: Object.freeze({ id: 'shift-sedan', label: 'TRY SHIFT IN THE SEDAN' }),
    note: 'GARAGE highlights ACTIVATE SHIFT for you.',
    hints: Object.freeze(['garage-shift', 'race-shift'])
  }),
  flow: Object.freeze({
    title: 'FLOW',
    copy: Object.freeze([
      'FLOW scores how you mix techniques: SHIFT, BOOST, DRIFT, LOCK, catching OVERCHARGE and clean exits.',
      'Vary them at the right moment to build COMBO. Repeating the same idea adds less.'
    ]),
    action: Object.freeze({ id: 'flow-tutorial', label: 'START FLOW TUTORIAL' }),
    note: 'You can play FLOW TUTORIAL any time from HOW TO PLAY.'
  })
});

function readState(storage) {
  try {
    const raw = JSON.parse(storage?.getItem?.(UNLOCK_INTRODUCTIONS_KEY) || 'null');
    const ids = (value) => (Array.isArray(value) ? value.filter((id) => UNLOCK_INTRODUCTIONS[id]) : []);
    const views = raw?.views && typeof raw.views === 'object' ? raw.views : {};
    const state = {
      pending: ids(raw?.pending),
      shown: ids(raw?.shown),
      hints: Array.isArray(raw?.hints) ? raw.hints : [],
      views,
      once: Array.isArray(raw?.once) ? raw.once : []
    };
    // Saved before r428, which added views and the race hint: a SHIFT introduced then
    // arms the race hint once. Every later save carries views, so it is never re-armed.
    if (raw && !raw.views && state.shown.includes('shift') && !state.hints.includes('race-shift')) {
      state.hints.push('race-shift');
    }
    return state;
  } catch (_) {
    return { pending: [], shown: [], hints: [], views: {}, once: [] };
  }
}

// The queue, without the page: what is waiting to be introduced, and what has been.
export function createUnlockIntroductionQueue(storage = globalThis.localStorage, { events = null, onSync = () => {} } = {}) {
  const state = readState(storage);
  const save = () => {
    try {
      storage?.setItem?.(UNLOCK_INTRODUCTIONS_KEY, JSON.stringify(state));
    } catch (_) {}
  };
  // TURN open in another tab saves the whole queue too: the page's queue (events: the
  // window) takes up what it saved, so a later save here does not write back a hint
  // that tab has used (#1192).
  events?.addEventListener?.('storage', (event) => {
    if (event.key !== UNLOCK_INTRODUCTIONS_KEY) return;
    Object.assign(state, readState(storage));
    onSync();
  });
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
    // A hint armed by an unlock with no sheet of its own (UNLOCK_HINTS).
    armHint(hint) {
      if (!state.hints.includes(hint)) state.hints.push(hint);
      delete state.views[hint];
      save();
    },
    // A hint every player gets once, whenever it was added (ALL_CARS_HINT); `key`
    // names that once, so a hint can be armed again under a new one.
    armOnce(hint, key = hint) {
      if (state.once.includes(key)) return false;
      state.once.push(key);
      if (!state.hints.includes(hint)) state.hints.push(hint);
      delete state.views[hint];
      save();
      return true;
    },
    // An untilUsed hint, pointed out (scrolled to and said) once; it stays armed.
    pointedOut: (hint) => Number(state.views[hint]) > 0,
    markPointedOut(hint) {
      state.views[hint] = 1;
      save();
    },
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
    .roadbook-admin button,
    .m8-admin-unlocks button {
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
    .roadbook-admin div,
    .m8-admin-unlocks { display: flex; flex-wrap: wrap; gap: var(--turn-space-2); }
    .m8-admin-unlocks[hidden] { display: none; }
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
  openGarage,
  storage = globalThis.localStorage,
  documentRef = globalThis.document,
  windowRef = globalThis
} = {}) {
  installStyles(documentRef);
  const queue = createUnlockIntroductionQueue(storage, { events: windowRef, onSync: syncGarageHints });
  const dialog = createSheet(documentRef);
  const title = dialog.querySelector('h2');
  const copy = dialog.querySelector('.m8-unlock-copy');
  const note = dialog.querySelector('.m8-unlock-note');
  const actionButton = dialog.querySelector('[data-unlock-action]');
  const closeButton = dialog.querySelector('[data-unlock-close]');
  let showing = null;
  let timer = 0;
  let hintObserver = null;
  let pointedGarage = null;
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
    if (action === 'flow-tutorial') void startTutorial?.('flow');
    if (action === 'shift-sedan') {
      // The same way a support challenge opens its recommended car.
      viewCarWhenGarageOpens('sedan');
      void openGarage?.();
    }
  });
  dialog.addEventListener('close', finish);

  // ACTIVATE SHIFT or PAINT, the next time GARAGE shows it: brought into view, pulsed
  // and said. Watched on Home and in GARAGE only: an armed hint waits out a race unwatched.
  const armedGarageHints = () => Object.keys(GARAGE_HINT_TARGETS).filter((hint) => queue.hasHint(hint));
  function stopWatchingHints() {
    hintObserver?.disconnect();
    hintObserver = null;
  }
  // Another tab can use a hint while this GARAGE is already open. Reconcile both
  // its visible pulse and its watcher with the queue that was just synchronized.
  function syncGarageHints() {
    for (const [hint, { selector, untilUsed }] of Object.entries(GARAGE_HINT_TARGETS)) {
      if (!untilUsed || queue.hasHint(hint)) continue;
      for (const element of documentRef.querySelectorAll(selector)) {
        element.classList.remove('is-suggested', 'is-introduced');
      }
    }
    stopWatchingHints();
    watchHints();
  }
  function watchHints() {
    if (hintObserver || windowRef.__turnRuntime?.state?.running === true) return;
    if (!armedGarageHints().length || typeof MutationObserver !== 'function') return;
    const reveal = () => {
      const points = [];
      for (const hint of armedGarageHints()) {
        const { selector, say, ownVisit, untilUsed } = GARAGE_HINT_TARGETS[hint];
        const target = [...documentRef.querySelectorAll(selector)].find((element) => !element.hidden && element.offsetParent);
        if (!target) continue;
        // Pointed out already: the calm pulse, until used. Never before that pointing-out,
        // which stays the player's first sight of it.
        if (untilUsed && queue.pointedOut(hint)) {
          suggestInGarage(target, { documentRef });
          continue;
        }
        const garage = target.closest('#turnGarage');
        // Later, on a visit the player opens themselves with nothing else to point out.
        if (ownVisit && (points.length || pointedGarage === garage || garageOpenedForCar(garage))) continue;
        if (untilUsed) {
          queue.markPointedOut(hint);
          suggestInGarage(target, { documentRef });
        } else queue.consumeHint(hint);
        pointedGarage = garage;
        points.push({ element: target, say });
      }
      pointOutInGarage(points, { documentRef, windowRef });
      if (!armedGarageHints().length) stopWatchingHints();
    };
    hintObserver = new MutationObserver(reveal);
    hintObserver.observe(documentRef.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    reveal();
  }

  function armUnlockHints(ids) {
    let armed = false;
    for (const id of ids || []) {
      if (!UNLOCK_HINTS[id]) continue;
      queue.armHint(UNLOCK_HINTS[id].hint);
      armed = true;
    }
    if (armed) watchHints();
  }

  windowRef.addEventListener?.('turn:trophy-road-updated', (event) => {
    if (queue.unlocked(event.detail?.unlocked)) schedule();
    // Like the sheets, not in automated runs, where test suites earn rewards all the time.
    if (introducesOnUnlock(windowRef, storage)) armUnlockHints(event.detail?.unlocked);
  });
  windowRef.addEventListener?.('turn:home-shown', () => {
    schedule();
    watchHints();
  });
  // Like the sheets, not in automated runs.
  if (introducesOnUnlock(windowRef, storage)) queue.armOnce(ALL_CARS_HINT, ALL_CARS_UNTIL_USED);
  // Using an untilUsed hint's control ends its pulse for good.
  documentRef.addEventListener?.('click', (event) => {
    for (const [hint, { untilUsed }] of Object.entries(GARAGE_HINT_TARGETS)) {
      if (!untilUsed || !queue.hasHint(hint) || !event.target?.closest?.(untilUsed)) continue;
      queue.consumeHint(hint);
      syncGarageHints();
    }
  }, true);
  windowRef.addEventListener?.('turn:ui-state-change', (event) => {
    if (event.detail?.running === true) stopWatchingHints();
  });
  windowRef.addEventListener?.('turn:trophy-road-toast-shown', () => schedule());
  documentRef.addEventListener?.('turn:home-ready', () => schedule());
  watchHints();
  schedule();

  // UNLOCK DRIFT ATTACK, SHIFT and FLOW (their sheets), then PAINTJOB (a GARAGE hint).
  const adminButtons = () => [...Object.keys(UNLOCK_INTRODUCTIONS), ...Object.keys(UNLOCK_HINTS)]
    .map((id) => `<button type="button" data-admin-unlock="${id}">UNLOCK ${(UNLOCK_INTRODUCTIONS[id] || UNLOCK_HINTS[id]).title}</button>`)
    .join('');

  // Admin profiles have every reward already: these replay an unlock to test it.
  function installAdminRow() {
    if (!isAdminProfile(storage)) return null;
    const list = documentRef.querySelector('.roadbook-tracks .roadbook-list');
    if (!list) return null;
    const row = documentRef.createElement('section');
    row.className = 'roadbook-admin';
    row.setAttribute('aria-labelledby', 'roadbookAdminTitle');
    row.innerHTML = `<h2 id="roadbookAdminTitle">ADMIN</h2><div>${adminButtons()}</div>`;
    list.after(row);
    row.addEventListener('click', (event) => {
      const id = event.target.closest?.('[data-admin-unlock]')?.dataset.adminUnlock;
      if (!id) return;
      replay(id);
    });
    return row;
  }

  // The same buttons in SETTINGS, on the Admin card with the other admin tools
  // (testing/route-test-hud.js builds it). SETTINGS closes so the unlock plays on Home;
  // SETTINGS opened from a race's start screen does not show them.
  function installAdminSettings() {
    if (!isAdminProfile(storage)) return;
    const add = () => {
      const card = documentRef.querySelector('[data-turn-route-test-hud-setting]');
      if (!card) return false;
      if (card.querySelector('.m8-admin-unlocks')) return true;
      const group = documentRef.createElement('div');
      group.className = 'm8-admin-unlocks';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Replay an unlock');
      group.innerHTML = adminButtons();
      group.addEventListener('click', (event) => {
        const id = event.target.closest?.('[data-admin-unlock]')?.dataset.adminUnlock;
        if (!id) return;
        group.closest('dialog')?.close?.();
        replay(id);
      });
      card.append(group);
      const settings = card.closest('dialog');
      const sync = () => {
        group.hidden = !(documentRef.body.classList.contains('turn-home-open')
          && documentRef.querySelector('.m8-home:not([hidden])'));
      };
      sync();
      if (settings && typeof MutationObserver === 'function') {
        new MutationObserver(sync).observe(settings, { attributes: true, attributeFilter: ['open'] });
      }
      return true;
    };
    if (add() || typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver(() => {
      if (add()) observer.disconnect();
    });
    observer.observe(documentRef.body, { childList: true, subtree: true });
  }

  function replay(id) {
    const reward = getTrophyRoadReward(id);
    if (reward) globalThis.__turnAchievements?.showRewardToastBatch?.([reward]);
    if (UNLOCK_HINTS[id]) {
      armUnlockHints([id]);
      return;
    }
    queue.unlocked([id], { replay: true });
    replayed = true;
    schedule(250);
  }

  const adminRow = installAdminRow();
  installAdminSettings();
  return Object.freeze({ dialog, queue, adminRow, replay, schedule });
}
