import { model, C } from './tracker-core.js?revision=r187-music-tracker';
import { auditionRow, startPlayback } from './tracker-audio.js?revision=r208-row-playhead';

const grid = document.getElementById('trackerGrid');
const partTabs = [...document.querySelectorAll('.part-tab[data-part]')];
const partPlayButtons = [...document.querySelectorAll('.part-play[data-part]')];
let armedStart = null;

if (!document.querySelector('link[data-tracker-playhead]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './tracker-playhead-r208.css?revision=r208-row-playhead';
  link.dataset.trackerPlayhead = '';
  document.head.append(link);
}

function clearPlayingRow() {
  grid?.querySelectorAll('.tracker-row.playing').forEach((row) => row.classList.remove('playing'));
  grid?.querySelectorAll('.row-number.playing').forEach((button) => button.classList.remove('playing'));
}

function clearArmedStart() {
  armedStart = null;
  grid?.querySelectorAll('.row-number.start-armed').forEach((button) => {
    button.classList.remove('start-armed');
    button.setAttribute('aria-pressed', 'false');
  });
}

function currentBar() {
  return Number(model.state.bar) || 0;
}

function currentPart() {
  return model.state.part;
}

function rowButtonLabel(step) {
  const hex = step.toString(16).toUpperCase().padStart(2, '0');
  return `Preview row ${hex} and use it once as the next ${C[currentPart()]} playback start`;
}

function armRow(button, step) {
  clearArmedStart();
  armedStart = {
    part: currentPart(),
    bar: Math.floor(step / 16),
    row: step % 16,
    step
  };
  button.classList.add('start-armed');
  button.setAttribute('aria-pressed', 'true');
}

function installRowButtons() {
  if (!grid) return;
  grid.querySelectorAll('.row-number').forEach((node) => {
    if (node.matches('button[data-play-row]')) return;
    const step = Number.parseInt(node.textContent || '', 16);
    if (!Number.isFinite(step)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = node.className;
    button.dataset.playRow = String(step);
    button.textContent = node.textContent;
    button.setAttribute('aria-pressed', String(armedStart?.part === currentPart() && armedStart.step === step));
    button.setAttribute('aria-label', rowButtonLabel(step));
    if (armedStart?.part === currentPart() && armedStart.step === step) button.classList.add('start-armed');
    node.replaceWith(button);
  });
}

async function previewAndArm(button) {
  const step = Number(button.dataset.playRow);
  if (!Number.isFinite(step)) return;
  armRow(button, step);
  try {
    await auditionRow(currentPart(), step);
  } catch (error) {
    clearArmedStart();
    const status = document.getElementById('draftStatus');
    if (status) {
      status.textContent = error.message;
      status.className = 'status-pill bad';
    }
  }
}

function consumeArmedStart(button, event) {
  if (!armedStart || button.dataset.part !== armedStart.part) return false;
  if (currentPart() !== armedStart.part || currentBar() !== armedStart.bar) {
    clearArmedStart();
    return false;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  const start = armedStart;
  clearArmedStart();
  startPlayback('part', start.part, start.bar, start.row).catch((error) => {
    const status = document.getElementById('draftStatus');
    if (status) {
      status.textContent = error.message;
      status.className = 'status-pill bad';
    }
  });
  return true;
}

function renderPlayingRow(detail) {
  clearPlayingRow();
  if (!grid || detail.part !== currentPart() || detail.bar !== currentBar()) return;
  const rowButton = grid.querySelector(`.row-number[data-play-row="${detail.step}"]`);
  const row = rowButton?.closest('.tracker-row');
  row?.classList.add('playing');
  rowButton?.classList.add('playing');
}

grid?.addEventListener('click', (event) => {
  const button = event.target.closest('.row-number[data-play-row]');
  if (button) previewAndArm(button);
});

const gridObserver = grid ? new MutationObserver(() => installRowButtons()) : null;
gridObserver?.observe(grid, { childList: true, subtree: true });
installRowButtons();

document.addEventListener('turn-tracker-play-row', (event) => renderPlayingRow(event.detail));
document.addEventListener('turn-tracker-playback-stop', clearPlayingRow);

document.querySelector('.transport')?.addEventListener('click', (event) => {
  const button = event.target.closest('.part-play[data-part]');
  if (button) consumeArmedStart(button, event);
}, true);

for (const button of partTabs) {
  button.addEventListener('click', () => clearArmedStart(), true);
}
for (const id of ['prevBarButton', 'nextBarButton', 'addBarButton', 'removeBarButton']) {
  document.getElementById(id)?.addEventListener('click', () => clearArmedStart(), true);
}

partPlayButtons.forEach((button) => {
  button.setAttribute('aria-describedby', 'trackerInstruction');
});
