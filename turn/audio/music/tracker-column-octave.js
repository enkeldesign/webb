import { model, save, errors, source, validToken, P, C, L } from './tracker-core.js?revision=r187-music-tracker';

const NOTE = /^([A-G](?:#|b)?)(-?\d+)$/;
const MIN_OCTAVE = 0;
const MAX_OCTAVE = 8;
let selectedColumn = null;
let columnClip = null;

const $ = (id) => document.getElementById(id);
const state = () => model.state;
const laneKind = (lane) => P.includes(lane) ? 'pitched' : 'drums';
const laneLabel = (lane) => lane === 'arp' ? 'ARP' : lane.toUpperCase();

function installUI() {
  if (!document.querySelector('link[data-tracker-column-octave]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './tracker-column-octave.css?revision=r206-column-tools';
    link.dataset.trackerColumnOctave = '';
    document.head.append(link);
  }

  const instruction = $('trackerInstruction');
  instruction.textContent = 'Select a tracker cell, then enter its value with NOTE ENTRY below. Tap any column heading for copy, paste and clear tools; LEAD, BASS and ARP can also move by octaves.';

  const header = document.querySelector('.tracker-grid-head');
  header.removeAttribute('aria-hidden');
  header.replaceChildren();
  const row = document.createElement('div');
  row.textContent = 'ROW';
  header.append(row);

  for (const lane of L) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'column-select-button';
    button.dataset.columnSelect = lane;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `Select the whole ${lane} column in the current part for column tools`);
    const label = document.createElement('span');
    label.textContent = laneLabel(lane);
    button.append(label);
    if (P.includes(lane)) {
      const badge = document.createElement('small');
      badge.textContent = 'O±';
      button.append(badge);
    }
    header.append(button);
  }

  const navigation = document.querySelector('.entry-navigation');
  navigation.id = 'entryNavigation';
  const controls = document.createElement('div');
  controls.id = 'columnOctaveControls';
  controls.className = 'column-octave-controls column-tools-controls';
  controls.hidden = true;
  controls.innerHTML = `
    <div id="columnOctaveGroup" class="column-tools-group column-octave-group">
      <strong>Whole-part octave</strong>
      <div class="column-tools-actions">
        <button id="octaveDownButton" class="button octave-shift" type="button">O−</button>
        <button id="octaveUpButton" class="button octave-shift" type="button">O+</button>
      </div>
    </div>
    <div class="column-tools-group">
      <strong>Current bar</strong>
      <div class="column-tools-actions column-tools-actions-three">
        <button id="copyColumnBarButton" class="button ghost" type="button">Copy</button>
        <button id="pasteColumnBarButton" class="button ghost" type="button">Paste</button>
        <button id="clearColumnBarButton" class="button danger" type="button">Clear</button>
      </div>
    </div>
    <div class="column-tools-group">
      <strong>Full part</strong>
      <div class="column-tools-actions column-tools-actions-three">
        <button id="copyColumnPartButton" class="button ghost" type="button">Copy</button>
        <button id="pasteColumnPartButton" class="button ghost" type="button">Paste</button>
        <button id="clearColumnPartButton" class="button danger" type="button">Clear</button>
      </div>
    </div>
    <p id="columnToolsHint" class="column-octave-hint column-tools-hint"></p>
    <p id="columnClipboardStatus" class="column-clipboard-status" aria-live="polite">Column clipboard: empty</p>`;
  navigation.before(controls);
}

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

function currentPart() {
  return state().parts[state().part];
}

function currentLaneSequence() {
  if (!selectedColumn) return null;
  return currentPart()[selectedColumn];
}

function currentBarSequence() {
  const sequence = currentLaneSequence();
  if (!sequence) return null;
  const offset = state().bar * 16;
  return sequence.slice(offset, offset + 16);
}

function sequenceIsValid(lane, sequence) {
  const part = { [lane]: sequence };
  return sequence.every((value, index) => validToken(lane, value, index, part));
}

function clipboardSummary() {
  if (!columnClip) return 'Column clipboard: empty';
  const sourcePart = C[columnClip.part] || columnClip.part;
  const scope = columnClip.scope === 'bar'
    ? `bar ${columnClip.bar + 1}`
    : `${columnClip.data.length / 16}-bar part`;
  return `Column clipboard: ${sourcePart} · ${laneLabel(columnClip.lane)} · ${scope}`;
}

function clipboardCompatibility(scope) {
  if (!selectedColumn) return { ok: false, reason: 'Select a column first.' };
  if (!columnClip || columnClip.scope !== scope) {
    return { ok: false, reason: `Copy a ${scope === 'bar' ? 'bar' : 'full part'} column first.` };
  }
  if (columnClip.kind !== laneKind(selectedColumn)) {
    return { ok: false, reason: 'Pitched columns can paste into LEAD, BASS or ARP; drum columns can only paste into DRUMS.' };
  }
  if (scope === 'part' && columnClip.data.length !== currentLaneSequence().length) {
    return {
      ok: false,
      reason: `Full-part paste needs the same bar count (${columnClip.data.length / 16} copied, ${currentLaneSequence().length / 16} here).`
    };
  }
  return { ok: true, reason: '' };
}

function copySelectedColumn(scope) {
  if (!selectedColumn) return;
  const data = scope === 'bar' ? currentBarSequence() : [...currentLaneSequence()];
  columnClip = {
    scope,
    lane: selectedColumn,
    kind: laneKind(selectedColumn),
    part: state().part,
    bar: state().bar,
    data: [...data]
  };
  const what = scope === 'bar' ? `bar ${state().bar + 1}` : 'full part';
  setStatus(`${C[state().part]} ${laneLabel(selectedColumn)} ${what} copied`, 'good');
  renderColumnSelection();
}

function candidateFor(scope, values) {
  if (scope === 'part') return [...values];
  const candidate = [...currentLaneSequence()];
  candidate.splice(state().bar * 16, 16, ...values);
  return candidate;
}

function applySelectedColumn(scope, values, actionLabel) {
  if (!selectedColumn) return false;
  const candidate = candidateFor(scope, values);
  if (!sequenceIsValid(selectedColumn, candidate)) {
    setStatus('That edit would leave an orphaned note tie at a bar boundary.', 'bad');
    return false;
  }
  const sequence = currentLaneSequence();
  sequence.splice(0, sequence.length, ...candidate);
  updateVisibleColumn();
  renderColumnSelection();
  commitState(actionLabel);
  return true;
}

function pasteSelectedColumn(scope) {
  const compatibility = clipboardCompatibility(scope);
  if (!compatibility.ok) {
    setStatus(compatibility.reason, 'bad');
    return;
  }
  const what = scope === 'bar' ? `bar ${state().bar + 1}` : 'full part';
  applySelectedColumn(scope, columnClip.data, `${C[state().part]} ${laneLabel(selectedColumn)} ${what} pasted`);
}

function clearSelectedColumn(scope) {
  if (!selectedColumn) return;
  const length = scope === 'bar' ? 16 : currentLaneSequence().length;
  const what = scope === 'bar' ? `bar ${state().bar + 1}` : 'full part';
  applySelectedColumn(scope, Array(length).fill(null), `${C[state().part]} ${laneLabel(selectedColumn)} ${what} cleared`);
}

function updateVisibleColumn() {
  if (!selectedColumn) return;
  const part = currentPart();
  const offset = state().bar * 16;
  document.querySelectorAll(`.step-cell[data-lane="${selectedColumn}"]`).forEach((cell) => {
    const row = Number(cell.dataset.row);
    const value = part[selectedColumn][offset + row];
    cell.textContent = value ?? '-';
    cell.setAttribute('aria-label', `${state().part} bar ${state().bar + 1} row ${(offset + row).toString(16).toUpperCase().padStart(2, '0')} ${selectedColumn}: ${value ?? 'rest'}`);
  });
}

function renderCellMode() {
  const pitched = P.includes(state().sel.lane);
  const index = model.step();
  const part = currentPart();
  $('noteEntryHeading').textContent = 'Note entry';
  $('selectedCellLabel').textContent = `${C[state().part]} · ${state().sel.lane} · row ${index.toString(16).toUpperCase().padStart(2, '0')}`;
  $('octaveControl').hidden = !pitched;
  $('noteButtons').hidden = !pitched;
  $('drumButtons').hidden = pitched;
  $('entryNavigation').hidden = false;
  if (pitched) $('entryOctave').value = state().oct[state().sel.lane];
  const tieButton = document.querySelector('[data-entry="tie"]');
  if (tieButton) tieButton.disabled = !pitched || !validToken(state().sel.lane, '=', index, part);
}

function setToolLabels() {
  const partCode = C[state().part];
  const label = laneLabel(selectedColumn);
  const barNumber = state().bar + 1;
  $('copyColumnBarButton').setAttribute('aria-label', `Copy ${partCode} ${label} from bar ${barNumber}`);
  $('pasteColumnBarButton').setAttribute('aria-label', `Paste column clipboard into ${partCode} ${label} bar ${barNumber}`);
  $('clearColumnBarButton').setAttribute('aria-label', `Clear ${partCode} ${label} bar ${barNumber}`);
  $('copyColumnPartButton').setAttribute('aria-label', `Copy ${partCode} ${label} full part`);
  $('pasteColumnPartButton').setAttribute('aria-label', `Paste column clipboard into ${partCode} ${label} full part`);
  $('clearColumnPartButton').setAttribute('aria-label', `Clear ${partCode} ${label} full part`);
}

function renderColumnSelection() {
  const columnMode = L.includes(selectedColumn);
  document.querySelectorAll('[data-column-select]').forEach((button) => {
    const active = button.dataset.columnSelect === selectedColumn;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('.step-cell').forEach((cell) => {
    const lane = cell.dataset.lane;
    const row = Number(cell.dataset.row);
    const cellSelected = !columnMode && lane === state().sel.lane && row === state().sel.row;
    cell.classList.toggle('column-selected', columnMode && lane === selectedColumn);
    cell.classList.toggle('selected', cellSelected);
    cell.setAttribute('aria-pressed', String(cellSelected));
  });

  $('columnOctaveControls').hidden = !columnMode;
  if (!columnMode) {
    renderCellMode();
    return;
  }

  const sequence = currentLaneSequence();
  const barSequence = currentBarSequence();
  const bars = model.barsIn(currentPart());
  const label = laneLabel(selectedColumn);
  const pitched = P.includes(selectedColumn);

  $('octaveControl').hidden = true;
  $('noteButtons').hidden = true;
  $('drumButtons').hidden = true;
  $('entryNavigation').hidden = true;
  $('columnOctaveGroup').hidden = !pitched;

  $('noteEntryHeading').textContent = 'Column tools';
  $('selectedCellLabel').textContent = `${C[state().part]} · ${label} · bar ${state().bar + 1}/${bars}`;
  $('columnToolsHint').textContent = pitched
    ? `Copy, paste or clear ${label} for this bar or the full part. O± moves every note in the full part; rests and ties stay put.`
    : `Copy, paste or clear DRUMS for this bar or the full part.`;
  $('columnClipboardStatus').textContent = clipboardSummary();

  if (pitched) {
    $('octaveDownButton').disabled = !canShiftOctave(sequence, -1);
    $('octaveUpButton').disabled = !canShiftOctave(sequence, 1);
    $('octaveDownButton').setAttribute('aria-label', `Move ${C[state().part]} ${label} down one octave`);
    $('octaveUpButton').setAttribute('aria-label', `Move ${C[state().part]} ${label} up one octave`);
  }

  $('pasteColumnBarButton').disabled = !clipboardCompatibility('bar').ok;
  $('pasteColumnPartButton').disabled = !clipboardCompatibility('part').ok;
  $('clearColumnBarButton').disabled = !barSequence.some((value) => value != null);
  $('clearColumnPartButton').disabled = !sequence.some((value) => value != null);
  setToolLabels();
}

function clearColumnSelection() {
  if (!selectedColumn) return;
  selectedColumn = null;
  requestAnimationFrame(renderColumnSelection);
}

function selectColumn(lane) {
  if (!L.includes(lane)) return;
  selectedColumn = selectedColumn === lane ? null : lane;
  if (selectedColumn) state().sel.lane = selectedColumn;
  renderColumnSelection();
}

function transposeSelectedColumn(delta) {
  if (!selectedColumn || !P.includes(selectedColumn)) return;
  const part = currentPart();
  const shifted = shiftOctave(part[selectedColumn], delta);
  if (!shifted) {
    setStatus(delta > 0 ? 'That column cannot move any higher.' : 'That column cannot move any lower.', 'bad');
    return;
  }
  part[selectedColumn].splice(0, part[selectedColumn].length, ...shifted);
  updateVisibleColumn();
  renderColumnSelection();
  commitState(`${C[state().part]} ${laneLabel(selectedColumn)} moved ${delta > 0 ? 'up' : 'down'} one octave`);
}

function wireColumnSelection() {
  document.querySelectorAll('[data-column-select]').forEach((button) => {
    button.addEventListener('click', () => selectColumn(button.dataset.columnSelect));
  });

  $('octaveDownButton').addEventListener('click', () => transposeSelectedColumn(-1));
  $('octaveUpButton').addEventListener('click', () => transposeSelectedColumn(1));
  $('copyColumnBarButton').addEventListener('click', () => copySelectedColumn('bar'));
  $('pasteColumnBarButton').addEventListener('click', () => pasteSelectedColumn('bar'));
  $('clearColumnBarButton').addEventListener('click', () => clearSelectedColumn('bar'));
  $('copyColumnPartButton').addEventListener('click', () => copySelectedColumn('part'));
  $('pasteColumnPartButton').addEventListener('click', () => pasteSelectedColumn('part'));
  $('clearColumnPartButton').addEventListener('click', () => clearSelectedColumn('part'));

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

installUI();
wireColumnSelection();
renderColumnSelection();
