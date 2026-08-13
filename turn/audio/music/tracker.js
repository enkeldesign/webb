import { model, save, restore, fromSong, fromParsed, parseSource, rawURL, errors, source, validToken, SONGBOOK, LEAD_VOICES, BASS_VOICES, ARP_VOICES, DRUM_KITS, N, C, L, P, HITS } from './tracker-core.js?revision=r187-music-tracker';
import { startPlayback, stopPlayback, isPlaying, renderDemos } from './tracker-audio.js?revision=r187-music-tracker';

const $ = (id) => document.getElementById(id);
const PAD = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let clip = null;

const s = () => model.state;
const status = (message, kind = '') => {
  $('draftStatus').textContent = message;
  $('draftStatus').className = `status-pill${kind ? ` ${kind}` : ''}`;
};

function changed(doSave = true) {
  const currentErrors = errors();
  $('validationOutput').textContent = currentErrors.length ? currentErrors.join('\n') : 'Ready.';
  $('exportPreview').value = source();
  if (currentErrors.length) status(`${currentErrors.length} validation issue${currentErrors.length === 1 ? '' : 's'}`, 'bad');
  else if (doSave) status('Ready', 'good');
  if (doSave) save();
}

function renderMeta() {
  for (const [id, key] of [['metaId', 'id'], ['metaName', 'name'], ['metaBpm', 'bpm'], ['metaKey', 'key'], ['metaStyle', 'style'], ['metaSwing', 'swing']]) {
    $(id).value = s().meta[key];
  }
  $('filenameInput').value = s().filename;
}

function renderArr() {
  const root = $('arrangementControls');
  root.replaceChildren();
  s().arrangement.forEach((value, index) => {
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Arrangement part ${index + 1}`);
    N.forEach((name) => select.add(new Option(C[name], name, false, name === value)));
    select.onchange = () => {
      s().arrangement[index] = select.value;
      renderArr();
      changed();
    };
    root.append(select);
  });
  $('arrangementText').value = s().arrangement.map((name) => C[name]).join('');
}

function renderPart() {
  document.querySelectorAll('.part-tab').forEach((button) => {
    const active = button.dataset.part === s().part;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const part = s().parts[s().part];
  $('leadVoice').value = part.leadVoice;
  $('bassVoice').value = part.bassVoice;
  $('arpVoice').value = part.arpVoice;
  $('drumKit').value = part.drumKit;
  s().bar = Math.min(s().bar, model.barsIn(part) - 1);
  $('barPosition').textContent = `Bar ${s().bar + 1} / ${model.barsIn(part)}`;
  $('barHarmony').value = part.harmony[s().bar] || '';
  $('removeBarButton').disabled = model.barsIn(part) <= 1;
}

function selectedCellSelector() {
  return `.step-cell[data-lane="${s().sel.lane}"][data-row="${s().sel.row}"]`;
}

function focusSelectedCell() {
  requestAnimationFrame(() => document.querySelector(selectedCellSelector())?.focus());
}

function selectCell(lane, row) {
  s().sel = { lane, row };
  renderGrid();
  focusSelectedCell();
}

function renderGrid() {
  const root = $('trackerGrid');
  const part = s().parts[s().part];
  root.replaceChildren();

  for (let row = 0; row < 16; row += 1) {
    const index = s().bar * 16 + row;
    const line = document.createElement('div');
    line.className = `tracker-row${row % 4 === 0 ? ' beat' : ''}`;

    const rowNumber = document.createElement('div');
    rowNumber.className = 'row-number';
    rowNumber.textContent = index.toString(16).toUpperCase().padStart(2, '0');
    line.append(rowNumber);

    for (const lane of L) {
      const value = part[lane][index];
      const selected = s().sel.lane === lane && s().sel.row === row;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `step-cell${selected ? ' selected' : ''}${validToken(lane, value, index, part) ? '' : ' invalid'}`;
      cell.dataset.lane = lane;
      cell.dataset.row = String(row);
      cell.textContent = value ?? '-';
      cell.setAttribute('aria-pressed', String(selected));
      cell.setAttribute('aria-label', `${s().part} bar ${s().bar + 1} row ${rowNumber.textContent} ${lane}: ${value ?? 'rest'}`);
      cell.onclick = () => selectCell(lane, row);
      line.append(cell);
    }
    root.append(line);
  }

  renderPad();
}

function renderPad() {
  const pitched = P.includes(s().sel.lane);
  const index = model.step();
  const part = s().parts[s().part];
  $('selectedCellLabel').textContent = `${C[s().part]} · ${s().sel.lane} · row ${index.toString(16).toUpperCase().padStart(2, '0')}`;
  $('octaveControl').hidden = !pitched;
  $('noteButtons').hidden = !pitched;
  $('drumButtons').hidden = pitched;
  if (pitched) $('entryOctave').value = s().oct[s().sel.lane];

  const tieButton = document.querySelector('[data-entry="tie"]');
  if (tieButton) tieButton.disabled = !pitched || !validToken(s().sel.lane, '=', index, part);
}

function render() {
  renderMeta();
  renderArr();
  renderPart();
  renderGrid();
  document.querySelectorAll('[data-channel]').forEach((control) => {
    control.checked = s().channels[control.dataset.channel] !== false;
  });
  $('loopPlayback').checked = s().loop !== false;
  changed(false);
}

function moveSelection(delta) {
  const part = s().parts[s().part];
  let row = s().sel.row + delta;
  let bar = s().bar;
  if (row < 0 && bar > 0) {
    bar -= 1;
    row = 15;
  } else if (row > 15 && bar < model.barsIn(part) - 1) {
    bar += 1;
    row = 0;
  }
  row = Math.max(0, Math.min(15, row));
  s().bar = bar;
  s().sel.row = row;
  renderPart();
  renderGrid();
  save();
  focusSelectedCell();
}

function setSelectedValue(value, { advance = true } = {}) {
  const lane = s().sel.lane;
  const part = s().parts[s().part];
  const index = model.step();
  if (!validToken(lane, value, index, part)) {
    status(value === '=' ? 'A tie must immediately follow a note or another tie.' : 'That value is not valid here.', 'bad');
    return;
  }
  part[lane][index] = value;
  changed();
  if (advance) moveSelection(1);
  else renderGrid();
}

function toggleDrumHit(hit) {
  const part = s().parts[s().part];
  const index = model.step();
  const set = new Set((part.drums[index] || '').split(''));
  if (set.has(hit)) set.delete(hit);
  else set.add(hit);
  part.drums[index] = HITS.filter((item) => set.has(item)).join('') || null;
  renderGrid();
  changed();
}

function padButtons() {
  const noteRoot = $('noteButtons');
  PAD.forEach((note) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `note-button${note.includes('#') ? ' accidental' : ''}`;
    button.textContent = note;
    button.onclick = () => setSelectedValue(`${note}${s().oct[s().sel.lane]}`);
    noteRoot.append(button);
  });

  const rest = document.createElement('button');
  rest.type = 'button';
  rest.className = 'note-button special';
  rest.textContent = 'REST −';
  rest.onclick = () => setSelectedValue(null);
  noteRoot.append(rest);

  const tie = document.createElement('button');
  tie.type = 'button';
  tie.className = 'note-button special';
  tie.dataset.entry = 'tie';
  tie.textContent = 'TIE =';
  tie.onclick = () => setSelectedValue('=');
  noteRoot.append(tie);

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'note-button special';
  clear.textContent = 'CLEAR';
  clear.onclick = () => setSelectedValue(null, { advance: false });
  noteRoot.append(clear);

  const drumRoot = $('drumButtons');
  HITS.forEach((hit) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'note-button';
    button.textContent = hit;
    button.onclick = () => toggleDrumHit(hit);
    drumRoot.append(button);
  });

  const drumRest = document.createElement('button');
  drumRest.type = 'button';
  drumRest.className = 'note-button special';
  drumRest.textContent = 'REST − ↓';
  drumRest.onclick = () => setSelectedValue(null);
  drumRoot.append(drumRest);

  const drumClear = document.createElement('button');
  drumClear.type = 'button';
  drumClear.className = 'note-button special';
  drumClear.textContent = 'CLEAR';
  drumClear.onclick = () => setSelectedValue(null, { advance: false });
  drumRoot.append(drumClear);
}

function addBar() {
  const part = s().parts[s().part];
  if (model.barsIn(part) >= 16) return status('Editor limit: 16 bars per part', 'bad');
  L.forEach((lane) => part[lane].push(...Array(16).fill(null)));
  part.harmony.push('');
  s().bar = model.barsIn(part) - 1;
  renderPart();
  renderGrid();
  changed();
}

function removeBar() {
  const part = s().parts[s().part];
  if (model.barsIn(part) <= 1) return;
  const index = s().bar * 16;
  L.forEach((lane) => part[lane].splice(index, 16));
  part.harmony.splice(s().bar, 1);
  s().bar = Math.min(s().bar, model.barsIn(part) - 1);
  renderPart();
  renderGrid();
  changed();
}

function copyBar() {
  const part = s().parts[s().part];
  const index = s().bar * 16;
  clip = {
    harmony: part.harmony[s().bar],
    ...Object.fromEntries(L.map((lane) => [lane, part[lane].slice(index, index + 16)]))
  };
  status('Bar copied', 'good');
}

function pasteBar() {
  if (!clip) return status('Copy a bar first', 'bad');
  const part = s().parts[s().part];
  const index = s().bar * 16;
  L.forEach((lane) => part[lane].splice(index, 16, ...clip[lane]));
  part.harmony[s().bar] = clip.harmony;
  renderPart();
  renderGrid();
  changed();
}

function clearBar() {
  const part = s().parts[s().part];
  const index = s().bar * 16;
  L.forEach((lane) => part[lane].fill(null, index, index + 16));
  part.harmony[s().bar] = '';
  renderPart();
  renderGrid();
  changed();
}

function changeBar(delta) {
  s().bar = Math.max(0, Math.min(model.barsIn() - 1, s().bar + delta));
  s().sel.row = 0;
  renderPart();
  renderGrid();
  save();
  if (isPlaying()) startPlayback('part', s().part, s().bar).catch((error) => status(error.message, 'bad'));
}

function voiceOptions() {
  for (const [id, library] of [['leadVoice', LEAD_VOICES], ['bassVoice', BASS_VOICES], ['arpVoice', ARP_VOICES], ['drumKit', DRUM_KITS]]) {
    Object.keys(library).forEach((name) => $(id).add(new Option(name, name)));
  }
}

function download() {
  if (errors().length) return status(errors()[0], 'bad');
  const blob = new Blob([source()], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = s().filename || `${model.slug(s().meta.id)}.js`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wire() {
  const songSelect = $('songSelect');
  SONGBOOK.forEach((song) => songSelect.add(new Option(`${song.name} · ${song.id}`, song.id)));

  $('loadSongButton').onclick = () => {
    fromSong(SONGBOOK.find((song) => song.id === songSelect.value));
    render();
    save();
    status('Song loaded', 'good');
  };

  $('loadUrlButton').onclick = async () => {
    try {
      status('Fetching…');
      const response = await fetch(rawURL($('songUrl').value), { credentials: 'omit' });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      fromParsed(parseSource(await response.text()));
      render();
      save();
      status('URL imported', 'good');
    } catch (error) {
      status(`Import failed: ${error.message}`, 'bad');
    }
  };

  $('readClipboardButton').onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      $('pasteSource').value = text;
      fromParsed(parseSource(text));
      render();
      save();
      status('Clipboard imported', 'good');
    } catch (_) {
      status('Clipboard read blocked; paste into the box instead.', 'bad');
    }
  };

  $('loadPasteButton').onclick = () => {
    try {
      fromParsed(parseSource($('pasteSource').value));
      render();
      save();
      status('Pasted source imported', 'good');
    } catch (error) {
      status(`Import failed: ${error.message}`, 'bad');
    }
  };

  $('newSongButton').onclick = () => {
    stopPlayback();
    model.fresh();
    render();
    save();
  };

  $('copySourceButton').onclick = async () => {
    try {
      if (errors().length) throw Error(errors()[0]);
      await navigator.clipboard.writeText(source());
      status('Copied .js', 'good');
    } catch (error) {
      status(error.message, 'bad');
    }
  };

  $('downloadSourceButton').onclick = download;
  $('filenameInput').oninput = (event) => {
    s().filename = event.target.value;
    save();
  };

  for (const [id, key, cast] of [['metaId', 'id', String], ['metaName', 'name', String], ['metaBpm', 'bpm', Number], ['metaKey', 'key', String], ['metaStyle', 'style', String], ['metaSwing', 'swing', Number]]) {
    $(id).oninput = (event) => {
      s().meta[key] = cast(event.target.value);
      changed();
    };
  }

  document.querySelectorAll('.part-tab').forEach((button) => {
    button.onclick = () => {
      s().part = button.dataset.part;
      s().bar = 0;
      s().sel.row = 0;
      renderPart();
      renderGrid();
      save();
    };
  });

  for (const [id, key] of [['leadVoice', 'leadVoice'], ['bassVoice', 'bassVoice'], ['arpVoice', 'arpVoice'], ['drumKit', 'drumKit']]) {
    $(id).onchange = (event) => {
      s().parts[s().part][key] = event.target.value;
      changed();
    };
  }

  $('barHarmony').oninput = (event) => {
    s().parts[s().part].harmony[s().bar] = event.target.value;
    changed();
  };
  $('prevBarButton').onclick = () => changeBar(-1);
  $('nextBarButton').onclick = () => changeBar(1);
  $('addBarButton').onclick = addBar;
  $('removeBarButton').onclick = removeBar;
  $('copyBarButton').onclick = copyBar;
  $('pasteBarButton').onclick = pasteBar;
  $('clearBarButton').onclick = clearBar;
  $('entryPrevButton').onclick = () => moveSelection(-1);
  $('entryNextButton').onclick = () => moveSelection(1);
  $('entryOctave').oninput = (event) => {
    if (P.includes(s().sel.lane)) s().oct[s().sel.lane] = Number(event.target.value);
  };
  $('playSongButton').onclick = () => startPlayback('song').catch((error) => status(error.message, 'bad'));
  document.querySelectorAll('.part-play').forEach((button) => {
    button.onclick = () => startPlayback('part', button.dataset.part, button.dataset.part === s().part ? s().bar : 0).catch((error) => status(error.message, 'bad'));
  });
  $('stopButton').onclick = stopPlayback;
  $('loopPlayback').onchange = (event) => {
    s().loop = event.target.checked;
    save();
  };
  document.querySelectorAll('[data-channel]').forEach((control) => {
    control.onchange = () => {
      s().channels[control.dataset.channel] = control.checked;
      save();
    };
  });
}

voiceOptions();
padButtons();
renderDemos();
restore();
render();
wire();
