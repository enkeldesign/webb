import { getBestDriftRecord } from './drift-records.js';
import { getBestFlowRecord } from './flow-records.js';

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

function formatBestScore(value) {
  const score = Math.round(Number(value) || 0);
  return score > 0 ? numberFormatter.format(score) : '—';
}

function ensureBestReadout(documentRef, root, channel) {
  const row = root.querySelector(
    channel === 'flow'
      ? '[data-score-feedback-flow-state]'
      : '[data-score-feedback-state]'
  );
  const footer = row?.querySelector?.('.score-feedback-footer');
  if (!footer) return null;

  const selector = `[data-score-feedback-${channel}-best]`;
  const existing = footer.querySelector?.(selector);
  if (existing) return existing.querySelector?.('b') || null;

  const readout = documentRef.createElement('div');
  readout.className = 'score-feedback-lap score-feedback-best';
  readout.setAttribute(`data-score-feedback-${channel}-best`, '');

  const label = documentRef.createElement('span');
  label.textContent = 'BEST';
  const value = documentRef.createElement('b');
  value.textContent = '—';
  readout.append(label, value);
  footer.append(readout);
  return value;
}

function setBest(valueNode, score) {
  if (!valueNode) return;
  const next = formatBestScore(score);
  if (valueNode.textContent !== next) valueNode.textContent = next;
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

  const driftBest = ensureBestReadout(documentRef, root, 'drift');
  const flowBest = ensureBestReadout(documentRef, root, 'flow');
  const targetStorage = storageOrDefault(storage);

  function refresh(trackId = getTrackId()) {
    const id = String(trackId || '');
    if (!id) {
      setBest(driftBest, 0);
      setBest(flowBest, 0);
      return false;
    }
    setBest(driftBest, getBestDriftRecord(id, targetStorage)?.score);
    setBest(flowBest, getBestFlowRecord(id, targetStorage)?.score);
    return true;
  }

  function onUiState(event) {
    const reason = event?.detail?.reason;
    if (reason !== 'race-started'
      && reason !== 'race-reset'
      && reason !== 'track-changed'
      && reason !== 'home-open') return;
    refresh();
  }

  function onDriftResult(event) {
    const bestScore = Number(event?.detail?.bestScore) || 0;
    if (bestScore > 0) setBest(driftBest, bestScore);
    else refresh();
  }

  function onFlowResult(event) {
    const bestScore = Number(event?.detail?.bestScore) || 0;
    if (bestScore > 0) setBest(flowBest, bestScore);
    else refresh();
  }

  eventTarget?.addEventListener?.('turn:ui-state-change', onUiState);
  eventTarget?.addEventListener?.('turn:drift-lap-result', onDriftResult);
  eventTarget?.addEventListener?.('turn:flow-lap-result', onFlowResult);
  refresh();

  return Object.freeze({
    refresh,
    disconnect() {
      eventTarget?.removeEventListener?.('turn:ui-state-change', onUiState);
      eventTarget?.removeEventListener?.('turn:drift-lap-result', onDriftResult);
      eventTarget?.removeEventListener?.('turn:flow-lap-result', onFlowResult);
    }
  });
}

installScorekeeperRecords();
