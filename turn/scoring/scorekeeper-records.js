import { getBestDriftRecord } from './drift-records.js';
import { getBestFlowRecord } from './flow-records.js';

const SCOREKEEPER_STYLE_ID = 'turn-scorekeeper-history-style';
const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

function storageOrDefault(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

function defaultTrackId() {
  try {
    return String(
      globalThis.__turnRuntime?.state?.trackId
      || globalThis.__turnGetTrackId?.()
      || ''
    );
  } catch (_) {
    return '';
  }
}

function formatScore(value, { emptyWhenMissing = false, emptyWhenZero = false } = {}) {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) {
    return emptyWhenMissing ? '—' : '0';
  }
  const score = Math.max(0, Math.round(Number(value)));
  if (emptyWhenZero && score <= 0) return '—';
  return numberFormatter.format(score);
}

function ensureScorekeeperStyle(documentRef) {
  if (!documentRef?.createElement) return false;
  if (documentRef.getElementById?.(SCOREKEEPER_STYLE_ID)) return true;

  const style = documentRef.createElement('style');
  style.id = SCOREKEEPER_STYLE_ID;
  style.textContent = `
.score-feedback {
  --score-feedback-paper-width: clamp(111px, 18.5vw, 148.5px);
  --score-feedback-paper-height: 84px;
  --score-feedback-gauge-width: clamp(33px, 5.5vw, 43.5px);
}

.score-feedback-state {
  grid-template-rows: auto 1fr auto auto;
  padding: 6px 7.5px 6.75px;
  border-width: var(--turn-border-default, 4px);
}

.score-feedback-values strong {
  font-size: max(var(--turn-text-floor, 11px), clamp(0.915rem, 3vw, 1.335rem));
}

.score-feedback-footer {
  justify-content: flex-start;
}

.score-feedback-footer .score-feedback-lap {
  font-size: max(var(--turn-text-floor, 11px), clamp(0.45rem, 1.35vw, 0.57rem));
  letter-spacing: .04em;
}

.score-feedback-history {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5px;
  margin-top: 2.25px;
}

/* LAST and BEST take a line each, so a five-digit record never runs out of the paper. */
.score-feedback-history .score-feedback-lap {
  font-size: max(var(--turn-text-floor, 11px), clamp(0.36rem, 1.05vw, 0.4575rem));
  letter-spacing: .055em;
  white-space: nowrap;
}

@media (max-height: 322.5px) {
  .score-feedback {
    --score-feedback-paper-width: 103.5px;
    --score-feedback-paper-height: 72px;
    --score-feedback-gauge-width: 31.5px;
  }

  .score-feedback-state {
    padding: 4.5px 6px 5.25px;
  }

  .score-feedback-values strong {
    font-size: max(var(--turn-text-floor, 11px), 0.885rem);
  }

  .score-feedback-footer .score-feedback-lap {
    font-size: max(var(--turn-text-floor, 11px), 0.42rem);
  }

  .score-feedback-history {
    margin-top: 1.5px;
  }

  .score-feedback-heading {
    letter-spacing: .03em;
  }

  /* Too short for two lines: BEST stays, LAST is the lap banner's score anyway. */
  .score-feedback-history .score-feedback-last {
    display: none;
  }

  .score-feedback-history .score-feedback-lap {
    font-size: max(var(--turn-text-floor, 11px), 0.345rem);
  }
}
`;

  const target = documentRef.head || documentRef.documentElement;
  target?.append?.(style);
  return true;
}

function makeReadout(documentRef, channel, kind, label) {
  const readout = documentRef.createElement('div');
  readout.className = `score-feedback-lap score-feedback-${kind}`;
  readout.setAttribute(`data-score-feedback-${channel}-${kind}`, '');

  const labelNode = documentRef.createElement('span');
  labelNode.textContent = label;
  const value = documentRef.createElement('b');
  value.textContent = '—';
  readout.append(labelNode, value);
  return { readout, value };
}

function scoreState(root, channel) {
  return root.querySelector(
    channel === 'flow'
      ? '[data-score-feedback-flow-state]'
      : '[data-score-feedback-state]'
  );
}

function ensureHistoryReadouts(documentRef, root, channel) {
  const row = scoreState(root, channel);
  if (!row) return { last: null, best: null };

  const selector = `[data-score-feedback-${channel}-history]`;
  let history = row.querySelector?.(selector);
  if (!history) {
    history = documentRef.createElement('div');
    history.className = 'score-feedback-history';
    history.setAttribute(`data-score-feedback-${channel}-history`, '');
    row.append?.(history);
  }

  let last = history.querySelector?.(`[data-score-feedback-${channel}-last] b`);
  if (!last) {
    const created = makeReadout(documentRef, channel, 'last', 'LAST');
    history.append?.(created.readout);
    last = created.value;
  }

  let best = history.querySelector?.(`[data-score-feedback-${channel}-best] b`);
  if (!best) {
    const created = makeReadout(documentRef, channel, 'best', 'BEST');
    history.append?.(created.readout);
    best = created.value;
  }

  return { last, best };
}

function setBest(valueNode, score) {
  if (!valueNode) return;
  const next = formatScore(score, { emptyWhenMissing: true, emptyWhenZero: true });
  if (valueNode.textContent !== next) valueNode.textContent = next;
}

function setLast(valueNode, score) {
  if (!valueNode) return;
  const next = formatScore(score, { emptyWhenMissing: true });
  if (valueNode.textContent !== next) valueNode.textContent = next;
}

function clearLast(valueNode) {
  if (valueNode && valueNode.textContent !== '—') valueNode.textContent = '—';
}

export function installScorekeeperRecords({
  documentRef = globalThis.document,
  eventTarget = globalThis,
  storage,
  getTrackId = defaultTrackId
} = {}) {
  if (!documentRef?.querySelector || !documentRef?.createElement) return null;
  const root = documentRef.querySelector('#scoreFeedback') || documentRef.querySelector('.score-feedback');
  if (!root) return null;

  // The rolling FLOW token strip proved unreadable at race speed. Remove it
  // before ScoreFeedback is created so the renderer never retains or updates
  // those five DOM nodes. FLOW still keeps its short internal token history
  // because repetition/variety is part of the scoring model itself.
  root.querySelector?.('[data-score-feedback-flow-techniques]')?.remove?.();

  ensureScorekeeperStyle(documentRef);
  const drift = ensureHistoryReadouts(documentRef, root, 'drift');
  const flow = ensureHistoryReadouts(documentRef, root, 'flow');
  const targetStorage = storageOrDefault(storage);

  function refreshBest(trackId = getTrackId()) {
    const id = String(trackId || '');
    if (!id) {
      setBest(drift.best, 0);
      setBest(flow.best, 0);
      return false;
    }
    setBest(drift.best, getBestDriftRecord(id, targetStorage)?.score);
    setBest(flow.best, getBestFlowRecord(id, targetStorage)?.score);
    return true;
  }

  function clearLastLap() {
    clearLast(drift.last);
    clearLast(flow.last);
  }

  function onUiState(event) {
    const reason = event?.detail?.reason;
    if (reason !== 'race-started'
      && reason !== 'race-reset'
      && reason !== 'track-changed'
      && reason !== 'home-open') return;
    clearLastLap();
    refreshBest();
  }

  function onDriftResult(event) {
    setLast(drift.last, event?.detail?.score);
    const bestScore = Number(event?.detail?.bestScore) || 0;
    if (bestScore > 0) setBest(drift.best, bestScore);
    else refreshBest();
  }

  function onFlowResult(event) {
    setLast(flow.last, event?.detail?.score);
    const bestScore = Number(event?.detail?.bestScore) || 0;
    if (bestScore > 0) setBest(flow.best, bestScore);
    else refreshBest();
  }

  eventTarget?.addEventListener?.('turn:ui-state-change', onUiState);
  eventTarget?.addEventListener?.('turn:drift-lap-result', onDriftResult);
  eventTarget?.addEventListener?.('turn:flow-lap-result', onFlowResult);
  refreshBest();
  clearLastLap();

  return Object.freeze({
    refresh: refreshBest,
    clearLastLap,
    disconnect() {
      eventTarget?.removeEventListener?.('turn:ui-state-change', onUiState);
      eventTarget?.removeEventListener?.('turn:drift-lap-result', onDriftResult);
      eventTarget?.removeEventListener?.('turn:flow-lap-result', onFlowResult);
    }
  });
}
