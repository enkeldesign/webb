import { model, save, errors, source, P, C } from './tracker-core.js?revision=r187-music-tracker';

const NOTE = /^([A-G](?:#|b)?)(-?\d+)$/;
const MIN_OCTAVE = 0;
const MAX_OCTAVE = 8;
let selectedColumn = null;

const $ = (id) => document.getElementById(id);
const state = () => model.state;

function noteParts(value) {
  if (typeof value !== 'string') return null;
  const match = NOTE.exec(value);
  return match ? { pitch: match[1], octave: Number(match[2]) } : null;
}

export function canShiftOctave(sequence, delta) {
  let hasNote = false;
  for (const value of sequence) {
    const note = noteParts(value);
    if (!note) continue;
    hasNote = true;
    const octave = note.octave + delta;
    if (octave < MIN_OCTAVE || octave > MAX_OCTAVE) return false;
  }
  return hasNote;
}

export function shiftOctave(sequence, delta) {
  if (!canShiftOctave(sequence, delta)) return null;
  return sequence.map((value) => {
    const note = noteParts(value);
    return note ? `${note.pitch}${note.octave + delta}` : value;
  });
}

function setStatus(message, kind = '') {
  const status = $('draftStatus');
  status.textContent = message;
  status.className = `status-pill${kind ? ` ${kind}` : ''}`;
}

function commitState(message) {
  const currentErrors = errors();
  $('validationOutput').textContent = currentErrors.length ? currentErrors.join('\n') : 'Ready.';
  $('exportPreview').value = source();
  save();
  if (currentErrors.length) setStatus(`${currentErrors.length} validation issue${currentErrors.length === 1 ? '' : 's'}`, 'bad');
  else setStatus(message, 'good');
}

function currentLaneSequence() {
  if (!selectedColumn) return null;
  return state().parts[state().part][selectedColumn];
}

function updateVisibleColumn() {
  if (!selectedColumn) return;
  const part = state().parts[state().part];
  const offset = state().bar * 16;
  document.querySelectorAll(`.step-cell[data-lane="${selectedColumn}"]`).forEach((cell) => {
    const row = Number(cell.dataset.row);
    const value = part[selectedColumn][offset + row];
    cell.textContent = value ?? '-';
    cell.setAttribute('aria-label', `${state().part} bar ${state().bar + 1} row ${(offset + row).toString(16).toUpperCase().padStart(2, '0')} ${selectedColumn}: ${value ?? 'rest'}`);
  });
}

function renderColumnSelection() {
  document.querySelectorAll('[data-column-select]').forEach((button) => {
    const active = button.dataset.columnSelect === selectedColumn;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('.step-cell').forEach((cell) => {
    cell.classList.toggle('column-selected', cell.dataset.lane === selectedColumn);
  });

  const columnMode = P.includes(selectedColumn);
  $('columnOctaveControls').hidden = !columnMode;
  $('octaveControl').hidden = columnMode || !P.includes(state().sel.lane);
  $('noteButtons').hidden = columnMode || !P.includes(state().sel.lane);
  $('drumButtons').hidden = columnMode || P.includes(state().sel.lane);
  $('entryNavigation').hidden = columnMode;

  if (!columnMode) {
    $('noteEntryHeading').textContent = 'Note entry';
    return;
  }

  const sequence = currentLaneSequence();
  const bars = model.barsIn(state().parts[state().part]);
  const laneLabel = selectedColumn.toUpperCase();
  $('noteEntryHeading').textContent = 'Column octave';
  $('selectedCellLabel').textContent = `${C[state().part]} · ${laneLabel} · whole ${bars}-bar part`;
  $('columnOctaveHint').textContent = `Moves every note in ${C[state().part]} ${laneLabel} across all ${bars} bars. Rests and ties stay put.`;
  $('octaveDownButton').disabled = !canShiftOctave(sequence, -1);
  $('octaveUpButton').disabled = !canShiftOctave(sequence, 1);
  $('octaveDownButton').setAttribute('aria-label', `Move ${C[state().part]} ${laneLabel} down one octave`);
  $('octaveUpButton').setAttribute('aria-label', `Move ${C[state().part]} ${laneLabel} up one octave`);
}

function clearColumnSelection() {
  if (!selectedColumn) return;
  selectedColumn = null;
  requestAnimationFrame(renderColumnSelection);
}

function selectColumn(lane) {
  if (!P.includes(lane)) return;
  selectedColumn = selectedColumn === lane ? null : lane;
  if (selectedColumn) state().sel.lane = selectedColumn;
  renderColumnSelection();
}

function transposeSelectedColumn(delta) {
  if (!selectedColumn) return;
  const part = state().parts[state().part];
  const shifted = shiftOctave(part[selectedColumn], delta);
  if (!shifted) {
    setStatus(delta > 0 ? 'That column cannot move any higher.' : 'That column cannot move any lower.', 'bad');
    return;
  }
  part[selectedColumn].splice(0, part[selectedColumn].length, ...shifted);
  updateVisibleColumn();
  renderColumnSelection();
  commitState(`${C[state().part]} ${selectedColumn.toUpperCase()} moved ${delta > 0 ? 'up' : 'down'} one octave`);
}

function wireColumnSelection() {
  document.querySelectorAll('[data-column-select]').forEach((button) => {
    button.addEventListener('click', () => selectColumn(button.dataset.columnSelect));
  });

  $('octaveDownButton').addEventListener('click', () => transposeSelectedColumn(-1));
  $('octaveUpButton').addEventListener('click', () => transposeSelectedColumn(1));

  $('trackerGrid').addEventListener('click', (event) => {
    if (event.target.closest('.step-cell')) clearColumnSelection();
  });

  document.querySelectorAll('.part-tab').forEach((button) => button.addEventListener('click', clearColumnSelection));
  for (const id of ['loadSongButton', 'loadUrlButton', 'readClipboardButton', 'loadPasteButton', 'newSongButton']) {
    $(id).addEventListener('click', clearColumnSelection);
  }

  for (const id of ['prevBarButton', 'nextBarButton', 'addBarButton', 'removeBarButton', 'pasteBarButton', 'clearBarButton']) {
    $(id).addEventListener('click', () => requestAnimationFrame(renderColumnSelection));
  }
}

wireColumnSelection();
renderColumnSelection();
