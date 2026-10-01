// Admin SWOOSH LISTENING TEST (#909, #928), round 2. Round 1 settled tightness on pitch
// (results in #928); Erik then defined the arrow: the sound travels from the centre out
// to the full side, its speed the curve's length and its pitch the tightness. Round 2
// compares that arrow with round 1's static pitch sound: labelled examples, 24 blind
// swooshes per version (2 sides × 3 tightness anchors × 2 lengths × 2), 8 linked pairs
// (does R → R stay two swooshes, does R → L keep both sides?) and a comfort rating.
// Results stay on this device and can be copied as JSON for #928.
// Admin-unlocked profiles only; ordinary buttons throughout, so it works with VoiceOver.
import { SWOOSH_LENGTHS, SWOOSH_TIGHTNESS, playSwoosh, playSwooshPhrase } from '../audio/swoosh-sound.js';

const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
const RESULTS_KEY = 'turn-swoosh-listening-v1';
const ROUND = 2;
const ROUND_VARIANTS = Object.freeze(['arrow', 'pitch']);
const KEPT_SESSIONS = 10;
const REPEATS = 2;
const PAIR_REPEATS = 2;
const PLAY_DELAY_MS = 700;
const SIDES = Object.freeze([-1, 1]);
const LENGTHS = Object.freeze(Object.keys(SWOOSH_LENGTHS));
const VERSION_NAMES = Object.freeze(['VERSION 1', 'VERSION 2', 'VERSION 3']);
// Pairs use the shortest swooshes at medium tightness: the hardest case to keep apart.
const PAIR_SWOOSH = Object.freeze({ tightness: 'medium', length: 'short' });

function shuffle(items, random) {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [list[index], list[other]] = [list[other], list[index]];
  }
  return list;
}

/** 24 swooshes for one version: every side × anchor × length, twice, shuffled. */
export function createTrials(random = Math.random) {
  const trials = [];
  for (let repeat = 0; repeat < REPEATS; repeat += 1) {
    for (const side of SIDES) {
      for (const tightness of SWOOSH_TIGHTNESS) for (const length of LENGTHS) trials.push({ side, tightness, length });
    }
  }
  return shuffle(trials, random).map((trial, index) => ({
    ...trial, index, answerSide: null, answerTightness: null, answerLength: null, replays: 0
  }));
}

/** 8 linked pairs: R → R, R → L, L → R and L → L, twice, shuffled. */
export function createPairs(random = Math.random) {
  const pairs = [];
  for (let repeat = 0; repeat < PAIR_REPEATS; repeat += 1) {
    for (const first of SIDES) for (const second of SIDES) pairs.push({ first, second });
  }
  return shuffle(pairs, random).map((pair, index) => ({ ...pair, index, answerFirst: null, answerSecond: null, replays: 0 }));
}

/** Both versions in random order, blind-labelled. */
export function createSession(random = Math.random) {
  return {
    round: ROUND,
    startedAt: new Date().toISOString(),
    blocks: shuffle(ROUND_VARIANTS, random).map((variant, index) => ({
      variant,
      label: VERSION_NAMES[index],
      trials: createTrials(random),
      pairs: createPairs(random),
      comfort: null
    }))
  };
}

const rank = (tightness) => SWOOSH_TIGHTNESS.indexOf(tightness);

/**
 * Side, tightness and length accuracy; whether length pulls tightness (short heard
 * tighter, long heard gentler); pair accuracy; the tightness confusion matrix.
 */
export function scoreBlock(block) {
  const answered = block.trials.filter((trial) => trial.answerSide !== null && trial.answerTightness !== null && trial.answerLength !== null);
  const confusion = Object.fromEntries(SWOOSH_TIGHTNESS.map((played) => [played, Object.fromEntries(SWOOSH_TIGHTNESS.map((heard) => [heard, 0]))]));
  const pull = Object.fromEntries(LENGTHS.map((length) => [length, { tighter: 0, gentler: 0 }]));
  let sides = 0;
  let tightness = 0;
  let lengths = 0;
  for (const trial of answered) {
    if (trial.answerSide === trial.side) sides += 1;
    if (trial.answerTightness === trial.tightness) tightness += 1;
    if (trial.answerLength === trial.length) lengths += 1;
    confusion[trial.tightness][trial.answerTightness] += 1;
    const shift = rank(trial.answerTightness) - rank(trial.tightness);
    if (shift > 0) pull[trial.length].tighter += 1;
    if (shift < 0) pull[trial.length].gentler += 1;
  }
  const pairs = (block.pairs || []).filter((pair) => pair.answerFirst !== null && pair.answerSecond !== null);
  const pairsRight = pairs.filter((pair) => pair.answerFirst === pair.first && pair.answerSecond === pair.second).length;
  const share = (count, total) => (total ? Math.round((count / total) * 1000) / 10 : 0);
  return {
    variant: block.variant,
    label: block.label,
    answered: answered.length,
    directionPercent: share(sides, answered.length),
    tightnessPercent: share(tightness, answered.length),
    lengthPercent: share(lengths, answered.length),
    tightHeardAsGentle: confusion.tight.gentle,
    gentleHeardAsTight: confusion.gentle.tight,
    shortHeardTighter: pull.short.tighter,
    longHeardGentler: pull.long.gentler,
    confusion,
    pairsAnswered: pairs.length,
    pairsPercent: share(pairsRight, pairs.length),
    replays: block.trials.reduce((sum, trial) => sum + trial.replays, 0) + (block.pairs || []).reduce((sum, pair) => sum + pair.replays, 0),
    comfort: block.comfort
  };
}

const sideWord = (side) => (side < 0 ? 'left' : 'right');

export function summarizeSession(session, { build = '', device = '' } = {}) {
  return {
    test: 'TURN SWOOSH listening test (#909, #928)',
    round: session.round ?? ROUND,
    build,
    device,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt || null,
    scores: session.blocks.map(scoreBlock),
    trials: session.blocks.map((block) => ({
      variant: block.variant,
      trials: block.trials.map(({ side, tightness, length, answerSide, answerTightness, answerLength, replays }) => ({
        played: `${sideWord(side)} ${tightness} ${length}`,
        heard: answerSide === null ? null : `${sideWord(answerSide)} ${answerTightness} ${answerLength}`,
        replays
      })),
      pairs: (block.pairs || []).map(({ first, second, answerFirst, answerSecond, replays }) => ({
        played: `${sideWord(first)} → ${sideWord(second)}`,
        heard: answerFirst === null ? null : `${sideWord(answerFirst)} → ${sideWord(answerSecond)}`,
        replays
      }))
    }))
  };
}

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch (_) {
    return null;
  }
}

function isAdminProfile() {
  try {
    return Boolean(storage()?.getItem(ADMIN_UNLOCK_MARKER));
  } catch (_) {
    return false;
  }
}

function loadSavedSessions() {
  try {
    const saved = JSON.parse(storage()?.getItem(RESULTS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (_) {
    return [];
  }
}

function saveSession(summary) {
  try {
    const sessions = [...loadSavedSessions(), summary].slice(-KEPT_SESSIONS);
    storage()?.setItem(RESULTS_KEY, JSON.stringify(sessions));
    return sessions;
  } catch (_) {
    return loadSavedSessions();
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (_) {
      copied = false;
    }
    field.remove();
    return copied;
  }
}

function buildId() {
  const release = globalThis.__TURN_BUILD__;
  return release ? `${release.version} ${release.id}` : '';
}

const sideName = (side) => (side < 0 ? 'LEFT' : 'RIGHT');
const arrowName = (side) => (side < 0 ? '←' : '→');

function createDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog turn-swoosh-test-dialog';
  dialog.setAttribute('aria-labelledby', 'turnSwooshTestTitle');
  dialog.innerHTML = `
    <article class="m8-dialog-card">
      <header class="m8-dialog-head">
        <div><span>ADMIN</span><h2 id="turnSwooshTestTitle">SWOOSH LISTENING TEST</h2></div>
        <button type="button" data-dialog-close aria-label="Close listening test">×</button>
      </header>
      <div class="turn-swoosh-test-body"></div>
      <p class="turn-swoosh-test-status" role="status" aria-live="polite"></p>
    </article>`;
  document.body.append(dialog);
  return dialog;
}

function installStyles() {
  if (document.querySelector('#turnSwooshTestStyles')) return;
  const style = document.createElement('style');
  style.id = 'turnSwooshTestStyles';
  style.textContent = `
    .turn-swoosh-test-body { display: grid; gap: 14px; }
    .turn-swoosh-test-body p { margin: 0; }
    .turn-swoosh-test-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .turn-swoosh-test-row button { flex: 1 1 0; min-width: 88px; min-height: 48px; }
    .turn-swoosh-test-row button[aria-pressed="true"] { background: var(--turn-action-success, #8ce99a); }
    .turn-swoosh-test-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .turn-swoosh-test-grid button { min-height: 48px; }
    .turn-swoosh-test-results { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
    .turn-swoosh-test-results th { white-space: nowrap; }
    .turn-swoosh-test-results th, .turn-swoosh-test-results td { padding: 6px 4px; text-align: left; border-bottom: 1px solid currentColor; }
    .turn-swoosh-test-results td:not(:first-child) { white-space: nowrap; }
    .turn-swoosh-test-status:empty { display: none; }`;
  document.head.append(style);
}

function installTest() {
  installStyles();
  const dialog = createDialog();
  const body = dialog.querySelector('.turn-swoosh-test-body');
  const status = dialog.querySelector('.turn-swoosh-test-status');
  let context = null;
  let session = null;
  let blockIndex = 0;
  let trialIndex = 0;
  let playTimer = null;

  const audio = () => {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!context && AudioContextClass) {
      try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
      } catch (_) {
        // Older browsers: the ring/silent switch may still mute the test.
      }
      context = new AudioContextClass();
    }
    if (context?.state === 'suspended') void context.resume();
    return context;
  };

  const readyContext = () => {
    const ctx = audio();
    if (!ctx) status.textContent = 'This browser cannot play the test sounds.';
    return ctx;
  };

  const play = (side, tightness, length, variant) => {
    const ctx = readyContext();
    if (ctx) playSwoosh(ctx, ctx.destination, { side, tightness, variant, durationSeconds: SWOOSH_LENGTHS[length] });
  };

  const playPair = (first, second, variant) => {
    const ctx = readyContext();
    if (!ctx) return;
    const swoosh = { ...PAIR_SWOOSH, variant, durationSeconds: SWOOSH_LENGTHS[PAIR_SWOOSH.length] };
    playSwooshPhrase(ctx, ctx.destination, [{ ...swoosh, side: first }, { ...swoosh, side: second }]);
  };

  const button = (label, onClick, extra = {}) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    Object.entries(extra).forEach(([key, value]) => element.setAttribute(key, value));
    element.addEventListener('click', onClick);
    return element;
  };

  const paragraph = (text) => {
    const element = document.createElement('p');
    element.textContent = text;
    return element;
  };

  const heading = (text) => {
    const element = document.createElement('h3');
    element.textContent = text;
    element.tabIndex = -1;
    return element;
  };

  const show = (...children) => {
    clearTimeout(playTimer);
    body.replaceChildren(...children);
    body.querySelector('h3')?.focus();
  };

  const choiceRow = (label, options, onChoose) => {
    const row = document.createElement('div');
    row.className = 'turn-swoosh-test-row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    for (const [text, value] of options) {
      row.append(button(text, (event) => {
        row.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === event.currentTarget)));
        onChoose(value);
      }, { 'aria-pressed': 'false' }));
    }
    return row;
  };

  function intro() {
    const saved = loadSavedSessions();
    const row = document.createElement('div');
    row.className = 'turn-swoosh-test-row';
    show(...[
      heading('Round 2 · before you start'),
      paragraph('Use stereo headphones or earbuds. Two versions this time, both with pitch for tightness. Each version starts with labelled examples, then plays 24 swooshes and 8 linked pairs in random order.'),
      paragraph('For each swoosh, answer the side, the tightness (GENTLE, MEDIUM or TIGHT) and the length of the curve (SHORT or LONG). For each pair, answer the side of the first and the second swoosh. No answers are revealed during the test. It takes about 10 minutes.'),
      saved.length ? paragraph(`${saved.length} earlier ${saved.length === 1 ? 'session is' : 'sessions are'} saved on this device.`) : null,
      row
    ].filter(Boolean));
    row.append(button('START TEST', () => {
      audio();
      session = createSession();
      blockIndex = 0;
      examples();
    }));
    if (saved.length) row.append(button('COPY SAVED RESULTS', () => copyResults(saved)));
  }

  function examples() {
    const block = session.blocks[blockIndex];
    const grid = document.createElement('div');
    grid.className = 'turn-swoosh-test-grid';
    for (const side of SIDES) {
      for (const tightness of SWOOSH_TIGHTNESS) {
        grid.append(button(`${sideName(side)} ${tightness.toUpperCase()}`, () => play(side, tightness, 'long', block.variant)));
      }
    }
    const lengths = document.createElement('div');
    lengths.className = 'turn-swoosh-test-grid';
    for (const length of LENGTHS) {
      lengths.append(button(`${length.toUpperCase()} RIGHT MEDIUM`, () => play(1, 'medium', length, block.variant)));
    }
    lengths.append(button('PAIR RIGHT → LEFT', () => playPair(1, -1, block.variant)));
    const row = document.createElement('div');
    row.className = 'turn-swoosh-test-row';
    row.append(button('START', () => {
      trialIndex = 0;
      trial();
    }));
    show(
      heading(`${block.label} of ${session.blocks.length} · examples`),
      paragraph('Play each example as often as you like. The side tells you the direction, the pitch the tightness and the speed the length of the curve.'),
      grid,
      lengths,
      row
    );
  }

  function trial() {
    const block = session.blocks[blockIndex];
    const current = block.trials[trialIndex];
    const answer = () => {
      if (current.answerSide === null || current.answerTightness === null || current.answerLength === null) return;
      trialIndex += 1;
      if (trialIndex < block.trials.length) trial();
      else {
        trialIndex = 0;
        pairTrial();
      }
    };
    const replayRow = document.createElement('div');
    replayRow.className = 'turn-swoosh-test-row';
    replayRow.append(button('PLAY AGAIN', () => {
      // Replaces a pending autoplay, so each press is exactly one swoosh.
      clearTimeout(playTimer);
      current.replays += 1;
      play(current.side, current.tightness, current.length, block.variant);
    }));
    show(
      heading(`${block.label} · swoosh ${trialIndex + 1} of ${block.trials.length}`),
      choiceRow('Side', SIDES.map((side) => [sideName(side), side]), (value) => { current.answerSide = value; answer(); }),
      choiceRow('Tightness', SWOOSH_TIGHTNESS.map((value) => [value.toUpperCase(), value]), (value) => { current.answerTightness = value; answer(); }),
      choiceRow('Length', LENGTHS.map((value) => [value.toUpperCase(), value]), (value) => { current.answerLength = value; answer(); }),
      replayRow
    );
    playTimer = setTimeout(() => play(current.side, current.tightness, current.length, block.variant), PLAY_DELAY_MS);
  }

  function pairTrial() {
    const block = session.blocks[blockIndex];
    const current = block.pairs[trialIndex];
    const answer = () => {
      if (current.answerFirst === null || current.answerSecond === null) return;
      trialIndex += 1;
      if (trialIndex < block.pairs.length) pairTrial();
      else comfort();
    };
    const replayRow = document.createElement('div');
    replayRow.className = 'turn-swoosh-test-row';
    replayRow.append(button('PLAY AGAIN', () => {
      clearTimeout(playTimer);
      current.replays += 1;
      playPair(current.first, current.second, block.variant);
    }));
    show(
      heading(`${block.label} · pair ${trialIndex + 1} of ${block.pairs.length}`),
      paragraph('Two linked swooshes. Which side was each?'),
      choiceRow('First swoosh', SIDES.map((side) => [`FIRST ${arrowName(side)} ${sideName(side)}`, side]), (value) => { current.answerFirst = value; answer(); }),
      choiceRow('Second swoosh', SIDES.map((side) => [`SECOND ${arrowName(side)} ${sideName(side)}`, side]), (value) => { current.answerSecond = value; answer(); }),
      replayRow
    );
    playTimer = setTimeout(() => playPair(current.first, current.second, block.variant), PLAY_DELAY_MS);
  }

  function comfort() {
    const block = session.blocks[blockIndex];
    const row = document.createElement('div');
    row.className = 'turn-swoosh-test-row';
    for (let rating = 1; rating <= 5; rating += 1) {
      row.append(button(String(rating), () => {
        block.comfort = rating;
        blockIndex += 1;
        if (blockIndex < session.blocks.length) examples();
        else results();
      }, { 'aria-label': `${rating} of 5` }));
    }
    show(
      heading(`${block.label} · comfort`),
      paragraph('How comfortable would this version be to hear for a whole race? 1 is unpleasant, 5 is comfortable.'),
      row
    );
  }

  function results() {
    session.finishedAt = new Date().toISOString();
    const summary = summarizeSession(session, { build: buildId(), device: navigator.userAgent });
    const saved = saveSession(summary);
    const table = document.createElement('table');
    table.className = 'turn-swoosh-test-results';
    table.innerHTML = '<thead><tr><th scope="col">Version</th><th scope="col">Side</th><th scope="col" aria-label="Tightness">Tight</th><th scope="col" aria-label="Length">Len</th><th scope="col">Pairs</th><th scope="col" aria-label="Comfort">Comf</th></tr></thead><tbody></tbody>';
    for (const score of summary.scores) {
      const row = document.createElement('tr');
      for (const value of [`${score.label.replace('VERSION ', 'V')} ${score.variant}`, `${Math.round(score.directionPercent)}%`, `${Math.round(score.tightnessPercent)}%`, `${Math.round(score.lengthPercent)}%`, `${Math.round(score.pairsPercent)}%`, `${score.comfort ?? '–'}/5`]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      table.tBodies[0].append(row);
    }
    const row = document.createElement('div');
    row.className = 'turn-swoosh-test-row';
    row.append(button('COPY RESULTS', () => copyResults([summary])));
    if (typeof navigator.share === 'function') {
      row.append(button('SHARE', () => {
        void navigator.share({ title: 'TURN SWOOSH listening test', text: JSON.stringify(summary, null, 2) }).catch(() => {});
      }));
    }
    row.append(button('TEST AGAIN', intro));
    show(
      heading('Results'),
      paragraph('Saved on this device. COPY RESULTS puts them on the clipboard as JSON to paste into #928 or to OPUS.'),
      table,
      paragraph('Side, Tight(ness) and Len(gth): share of swooshes answered correctly. Pairs: both sides right. Comf(ort): your rating.'),
      row,
      paragraph(`${saved.length} ${saved.length === 1 ? 'session' : 'sessions'} saved.`)
    );
  }

  async function copyResults(sessions) {
    const copied = await copyText(JSON.stringify(sessions.length === 1 ? sessions[0] : sessions, null, 2));
    status.textContent = copied ? 'Results copied.' : 'Copying failed. Try SHARE instead.';
  }

  dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    clearTimeout(playTimer);
    globalThis.__turnRacingMusic?.hold?.(false);
    status.textContent = '';
    dialog.__turnReturnFocus?.focus?.();
  });

  return (trigger) => {
    dialog.__turnReturnFocus = trigger;
    status.textContent = '';
    // Menu music would mask the swooshes: hold it (unsaved) while the test is open.
    globalThis.__turnRacingMusic?.hold?.(true);
    intro();
    dialog.showModal();
  };
}

function installSetting(open) {
  const card = document.querySelector('[data-turn-route-test-hud-setting]');
  if (!card) return false;
  if (card.querySelector('.turn-swoosh-test-open')) return true;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'turn-swoosh-test-open';
  trigger.textContent = 'SWOOSH LISTENING TEST';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.addEventListener('click', () => open(trigger));
  card.append(trigger);
  return true;
}

function install() {
  if (!isAdminProfile() || !document.body) return;
  const open = installTest();
  if (installSetting(open)) return;
  const observer = new MutationObserver(() => {
    if (installSetting(open)) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}
