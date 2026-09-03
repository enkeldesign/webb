const STATS_ENDPOINT = 'https://turn-challenges.erik-jansson-ux.workers.dev/v1/stats';
const DEVELOPER_STORAGE_KEY = 'turn.telemetry.developer.v1';

const TRACKS = Object.freeze([
  ['countryside', 'Countryside'],
  ['airport', 'Airport'],
  ['cliffside', 'Cliffside'],
  ['harbor', 'Harbor'],
  ['midnight-city', 'Midnight City']
]);

const CARS = Object.freeze([
  ['convertible', 'AWD'],
  ['classic', 'Learner Car'],
  ['vintage-racer', 'Vintage Racer'],
  ['toy-racer', 'Rally Racer'],
  ['monster-truck', 'Monster Truck'],
  ['race-future', 'Future Racer'],
  ['race', 'Race Car'],
  ['sedan-sports', 'Sports Car'],
  ['sedan', 'Sedan'],
  ['suv', 'SUV'],
  ['firetruck', 'Fire Truck'],
  ['police', 'Police Car'],
  ['ambulance', 'Ambulance'],
  ['truck', 'Truck'],
  ['van', 'Van']
]);

const access = document.querySelector('#statsAccess');
const dashboard = document.querySelector('#statsDashboard');
const keyForm = document.querySelector('#statsKeyForm');
const keyInput = document.querySelector('#statsKey');
const accessStatus = document.querySelector('#statsAccessStatus');
const rangeTabs = document.querySelector('#rangeTabs');
const audienceTabs = document.querySelector('#audienceTabs');
const updated = document.querySelector('#statsUpdated');
const forgetKey = document.querySelector('#forgetKey');
const cohortNote = document.querySelector('#statsCohortNote');
const developerDeviceState = document.querySelector('#developerDeviceState');
const developerDeviceDescription = document.querySelector('#developerDeviceDescription');
const developerDeviceStatus = document.querySelector('#developerDeviceStatus');
const toggleDeveloperDevice = document.querySelector('#toggleDeveloperDevice');

let statsKey = keyFromFragment();
let activeDays = 30;
let activeAudience = 'players';
let requestSequence = 0;

keyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const key = keyInput.value.trim();
  if (!key) return;
  setKey(key);
  void loadStats(activeDays, activeAudience);
});

rangeTabs.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-days]');
  if (!button) return;
  const days = Number(button.dataset.days) || 30;
  activeDays = days;
  setPressedButton(rangeTabs, button);
  void loadStats(days, activeAudience);
});

audienceTabs.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-audience]');
  if (!button) return;
  const audience = String(button.dataset.audience || 'players');
  activeAudience = ['players', 'all', 'developer'].includes(audience) ? audience : 'players';
  setPressedButton(audienceTabs, button);
  void loadStats(activeDays, activeAudience);
});

toggleDeveloperDevice.addEventListener('click', () => {
  const nextValue = !isDeveloperDevice();
  if (!setDeveloperDevice(nextValue)) {
    developerDeviceStatus.textContent = 'This browser did not allow the developer marker to be saved.';
    return;
  }
  renderDeveloperDevice();
  developerDeviceStatus.textContent = nextValue
    ? 'Marked as developer. Future TURN telemetry from this browser will be excluded from PLAYERS.'
    : 'Developer marker removed. Future TURN telemetry from this browser will be included in PLAYERS.';
});

forgetKey.addEventListener('click', () => {
  statsKey = '';
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  dashboard.hidden = true;
  access.hidden = false;
  keyInput.value = '';
  accessStatus.textContent = 'Dashboard key removed from this page.';
  keyInput.focus();
});

renderDeveloperDevice();
if (statsKey) void loadStats(activeDays, activeAudience);
else keyInput.focus();

async function loadStats(days, audience) {
  if (!statsKey) return;
  const sequence = ++requestSequence;
  accessStatus.textContent = 'Loading private statistics…';
  updated.textContent = 'Loading…';

  try {
    const query = new URLSearchParams({
      days: String(days),
      audience
    });
    const response = await fetch(`${STATS_ENDPOINT}?${query}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${statsKey}`
      }
    });
    const body = await response.json().catch(() => null);
    if (sequence !== requestSequence) return;

    if (response.status === 401) {
      throw new Error('That dashboard key is not valid.');
    }
    if (!response.ok || !body) {
      throw new Error(body?.message || `Statistics service returned ${response.status}.`);
    }

    accessStatus.textContent = '';
    access.hidden = true;
    dashboard.hidden = false;
    renderStats(body);
  } catch (error) {
    if (sequence !== requestSequence) return;
    dashboard.hidden = true;
    access.hidden = false;
    updated.textContent = '';
    accessStatus.textContent = error instanceof Error ? error.message : 'TURN statistics could not be loaded.';
    keyInput.value = statsKey;
    keyInput.focus();
  }
}

function renderStats(stats) {
  const totals = stats.totals || {};
  const sessions = Number(totals.playSessions) || 0;
  const races = Number(totals.races) || 0;
  const laps = Number(totals.laps) || 0;
  const voidLaps = Number(totals.voidLaps) || 0;
  const lapAttempts = laps + voidLaps;

  text('#metricSessions', formatCount(sessions));
  text('#metricRaces', formatCount(races));
  text('#metricLaps', formatCount(laps));
  text('#metricVoid', formatCount(voidLaps));
  text('#metricVoidRate', lapAttempts ? `${formatPercent(voidLaps / lapAttempts)} of resolved laps` : 'No resolved laps yet');

  const tracks = completeCounts(TRACKS, stats.tracks);
  const cars = completeCounts(CARS, stats.cars);
  renderFavourite('Track', tracks, races);
  renderFavourite('Car', cars, races);
  renderRanking(document.querySelector('#trackRanking'), tracks);
  renderRanking(document.querySelector('#carRanking'), cars);

  renderModes(stats);
  renderLapTimes(stats.lapTimes || []);

  const generatedAt = Number(stats.generatedAt) || Date.now();
  const range = Number(stats.rangeDays) === 3650 ? 'all recorded time' : `${Number(stats.rangeDays) || 30} days`;
  const audience = statsAudienceLabel(stats.audience);
  updated.textContent = `${audience} · ${range} · refreshed ${formatDateTime(generatedAt)}`;

  cohortNote.innerHTML = stats.audience === 'all'
    ? '<strong>ALL</strong> combines the original unseparated history with new player and developer aggregates. Old activity cannot be retrospectively assigned to either cohort.'
    : `<strong>${escapeHtml(audience)}</strong> contains only activity recorded after developer separation shipped. It does not guess who generated older aggregate statistics.`;

  const lastAt = Number(stats.lastActivityAt) || 0;
  text('#lastActivity', lastAt
    ? `Last recorded ${audience.toLowerCase()} gameplay: ${formatDateTime(lastAt)}`
    : `No recorded ${audience.toLowerCase()} gameplay in this period yet.`);
}

function renderDeveloperDevice() {
  const developer = isDeveloperDevice();
  developerDeviceState.textContent = developer ? 'DEVELOPER' : 'PLAYER';
  developerDeviceDescription.textContent = developer
    ? 'Future TURN activity from this browser is excluded from PLAYERS and appears under DEVELOPER.'
    : 'Future TURN activity from this browser is included in PLAYERS.';
  toggleDeveloperDevice.textContent = developer ? 'REMOVE DEVELOPER MARKER' : 'MARK AS DEVELOPER';
  toggleDeveloperDevice.setAttribute('aria-pressed', String(developer));
}

function renderFavourite(kind, rows, raceCount) {
  const most = rows[0] || null;
  const least = [...rows].sort((a, b) => a.count - b.count || a.name.localeCompare(b.name))[0] || null;
  const lower = kind.toLowerCase();

  if (!raceCount || !most) {
    text(`#most${kind}`, 'No races yet');
    text(`#least${kind}`, 'No races yet');
    text(`#most${kind}Count`, '');
    text(`#least${kind}Count`, '');
    return;
  }

  text(`#most${kind}`, most.name);
  text(`#most${kind}Count`, `${formatCount(most.count)} race${most.count === 1 ? '' : 's'}`);
  text(`#least${kind}`, least.name);
  text(`#least${kind}Count`, least.count
    ? `${formatCount(least.count)} race${least.count === 1 ? '' : 's'}`
    : `No ${lower} race starts in this period`);
}

function renderRanking(container, rows) {
  container.replaceChildren();
  const maximum = Math.max(1, ...rows.map((row) => row.count));
  rows.forEach((row, index) => {
    const item = document.createElement('div');
    item.className = 'rank-row';
    const width = row.count ? Math.max(3, row.count / maximum * 100) : 0;
    item.innerHTML = `
      <div class="rank-main">
        <div class="rank-label"><span>${escapeHtml(`${index + 1}. ${row.name}`)}</span></div>
        <div class="rank-bar" aria-hidden="true"><i style="--rank-width:${width.toFixed(1)}%"></i></div>
      </div>
      <strong>${formatCount(row.count)}</strong>`;
    container.appendChild(item);
  });
}

function renderModes(stats) {
  const rows = [];
  const surfaces = countMap(stats.surfaces);
  const steering = countMap(stats.steering);
  const installed = countMap(stats.installed);
  const dbe = countMap(stats.driveByEar);
  const blank = countMap(stats.blankScreen);

  rows.push(['TURN play sessions', surfaces.get('turn') || 0]);
  rows.push(['YOUR TURN play sessions', surfaces.get('yourturn') || 0]);
  rows.push(['Motion-steered races', steering.get('motion') || 0]);
  rows.push(['Manual-steered races', steering.get('manual') || 0]);
  rows.push(['Installed web-app races', installed.get('1') || 0]);
  rows.push(['Browser races', installed.get('0') || 0]);
  rows.push(['Drive By Ear races', dbe.get('1') || 0]);
  rows.push(['Blank-screen finished laps', blank.get('1') || 0]);
  renderDefinitionList(document.querySelector('#modeBreakdown'), rows, (value) => formatCount(value));
}

function renderLapTimes(sourceRows) {
  const source = new Map(sourceRows.map((row) => [String(row.id), row]));
  const rows = TRACKS.map(([id, name]) => {
    const entry = source.get(id);
    return [name, entry?.count ? Number(entry.average) || 0 : null];
  });
  renderDefinitionList(document.querySelector('#lapTimes'), rows, (value) => (
    Number.isFinite(value) ? formatLapTime(value) : '–'
  ));
}

function renderDefinitionList(list, rows, formatter) {
  list.replaceChildren();
  for (const [label, value] of rows) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = formatter(value);
    list.append(term, description);
  }
}

function completeCounts(definitions, sourceRows = []) {
  const source = countMap(sourceRows);
  return definitions.map(([id, name]) => ({
    id,
    name,
    count: source.get(id) || 0
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function countMap(rows = []) {
  return new Map(rows.map((row) => [String(row.id), Number(row.count) || 0]));
}

function setPressedButton(container, activeButton) {
  for (const candidate of container.querySelectorAll('button')) {
    candidate.setAttribute('aria-pressed', String(candidate === activeButton));
  }
}

function isDeveloperDevice() {
  try {
    return localStorage.getItem(DEVELOPER_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function setDeveloperDevice(value) {
  try {
    if (value) localStorage.setItem(DEVELOPER_STORAGE_KEY, '1');
    else localStorage.removeItem(DEVELOPER_STORAGE_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

function setKey(value) {
  statsKey = String(value || '').trim();
  if (!statsKey) return;
  history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(statsKey)}`);
}

function keyFromFragment() {
  const raw = location.hash.slice(1);
  if (!raw) return '';
  try { return decodeURIComponent(raw).trim(); } catch (_) { return raw.trim(); }
}

function statsAudienceLabel(value) {
  if (value === 'developer') return 'DEVELOPER';
  if (value === 'all') return 'ALL';
  return 'PLAYERS';
}

function text(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = String(value ?? '');
}

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function formatPercent(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1
  }).format(Number(value) || 0);
}

function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp));
}

function formatLapTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  const secs = Math.floor(value % 60).toString().padStart(2, '0');
  const ms = Math.round((value % 1) * 1000).toString().padStart(3, '0').slice(0, 3);
  return `${minutes}:${secs}.${ms}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
