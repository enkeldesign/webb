import {
  LEVEL_LABELS,
  SHIFT_CATALOG,
  ShiftSimulation,
  formatClock,
  formatSeconds,
  getShiftDefinition
} from './sim.mjs';
import { PostalWorld } from './world.mjs';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ui = {
  gameShell: $('#gameShell'),
  welcome: $('#welcomeScreen'),
  start: $('#startButton'),
  deckStart: $('#deckStartButton'),
  campaign: $('#campaignScreen'),
  campaignProgress: $('#campaignProgress'),
  campaignStamp: $('#campaignStamp'),
  shiftList: $('#shiftList'),
  result: $('#resultScreen'),
  replay: $('#replayButton'),
  nextShift: $('#nextShiftButton'),
  resultDetails: $('#resultDetailsButton'),
  pause: $('#pauseButton'),
  speed: $('#speedButton'),
  sound: $('#soundButton'),
  details: $('#detailsButton'),
  detailsDialog: $('#detailsDialog'),
  detailsClose: $('#detailsCloseButton'),
  shiftPlace: $('#shiftPlace'),
  clock: $('#clock'),
  shiftState: $('#shiftState'),
  serviceValue: $('#serviceValue'),
  backlogValue: $('#backlogValue'),
  riskValue: $('#riskValue'),
  serviceMetric: $('#serviceMetric'),
  riskMetric: $('#riskMetric'),
  missionPill: $('#missionPill'),
  missionLabel: $('#missionLabel'),
  missionTime: $('#missionTime'),
  sceneEyebrow: $('#sceneEyebrow'),
  sceneTitle: $('#sceneTitle'),
  sceneSummary: $('#sceneSummary'),
  commandDeck: $('#commandDeck'),
  commandContent: $('#commandContent'),
  loading: $('#loadingCard'),
  hotspotLayer: $('#hotspotLayer'),
  worldCanvas: $('#worldCanvas'),
  operationLayer: $('#operationLayer'),
  operationLevel: $('#operationLevel'),
  parcelRack: $('#parcelRack'),
  fallbackTargets: $('#fallbackTargets'),
  operationEmpty: $('#operationEmpty'),
  resourceChip: $('#resourceChip'),
  terminalAlert: $('#terminalAlert'),
  networkAlert: $('#networkAlert'),
  swedenAlert: $('#swedenAlert'),
  toast: $('#toast'),
  politeLive: $('#politeLive'),
  live: $('#assertiveLive'),
  detailMetrics: $('#detailMetrics'),
  detailScenario: $('#detailScenario')
};

const TARGET_LABELS = Object.freeze({
  'express-lane': 'Express A',
  'standard-lane': 'Standard B',
  'network-sundsvall': 'National gate',
  'network-harnosand': 'Härnösand',
  'network-timra': 'Timrå',
  'network-matfors': 'Matfors',
  'sweden-sundsvall': 'Sundsvall hub',
  'sweden-stockholm': 'Stockholm hub',
  'sweden-gothenburg': 'Gothenburg hub'
});

const SCENE_PRESENTATION = Object.freeze({
  terminal: { eyebrow: 'LIVE TOWN', title: 'Sundsvall', operation: 'TOWN FLOOR', resource: 'sort teams' },
  network: { eyebrow: 'REGIONAL ROUTES', title: 'Mid Sweden', operation: 'REGIONAL DEPOTS', resource: 'trucks' },
  sweden: { eyebrow: 'NATIONAL NETWORK', title: 'Sweden', operation: 'NATIONAL HUBS', resource: 'linehauls' }
});

class GameAudio {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.master = null;
  }

  unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }

  play(name) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.context || !this.master) return;
    const patterns = {
      click: [[220, 0, 0.065, 0.012]],
      select: [[277, 0, 0.08, 0.014]],
      work: [[247, 0, 0.075, 0.013], [311, 0.05, 0.09, 0.011]],
      arrival: [[262, 0, 0.07, 0.01]],
      handoff: [[277, 0, 0.08, 0.011], [349, 0.055, 0.095, 0.01]],
      delivered: [[294, 0, 0.09, 0.013], [370, 0.065, 0.11, 0.012]],
      warning: [[196, 0, 0.1, 0.014]],
      repair: [[247, 0, 0.085, 0.013], [330, 0.06, 0.11, 0.012]],
      complete: [[247, 0, 0.1, 0.014], [330, 0.075, 0.13, 0.013], [392, 0.15, 0.16, 0.012]]
    };
    const now = this.context.currentTime;
    for (const [frequency, delay, duration, level] of patterns[name] || patterns.click) {
      this.tone(frequency, now + delay, duration, level);
    }
  }

  tone(frequency, start, duration, level) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune.setValueAtTime(-5, start);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(860, start);
    filter.Q.value = 0.4;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

const CAMPAIGN_KEY = 'postal-campaign-v4';
const LEGACY_CAMPAIGN_KEY = 'postal-campaign-v3';

function emptyCampaign() {
  return { version: 4, completed: {}, plays: {}, bestScores: {} };
}

function loadCampaign() {
  try {
    const saved = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || 'null');
    if (saved?.version === 4) {
      return {
        version: 4,
        completed: saved.completed || {},
        plays: saved.plays || {},
        bestScores: saved.bestScores || {}
      };
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CAMPAIGN_KEY) || 'null');
    if (legacy?.completed?.['first-rounds']) {
      const migrated = emptyCampaign();
      migrated.completed['first-rounds'] = legacy.completed['first-rounds'];
      migrated.plays['first-rounds'] = legacy.plays?.['first-rounds'] || 1;
      migrated.bestScores['first-rounds'] = legacy.bestScores?.['first-rounds'] || 300;
      return migrated;
    }
  } catch {}
  return emptyCampaign();
}

function saveCampaign() {
  try {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaign));
  } catch {}
}

const audio = new GameAudio();
const campaign = loadCampaign();
let activeShift = getShiftDefinition('first-rounds');
let simulation = new ShiftSimulation(handleSimulationChange, activeShift.id);
let currentScene = activeShift.startScene;
let commandRenderKey = '';
let operationRenderKey = '';
let toastTimer = 0;
let wasRunningBeforeDialog = false;
let resultTimer = 0;
let shiftResultRecorded = false;
let worldUnavailable = false;

const world = new PostalWorld(ui.worldCanvas, ui.hotspotLayer, {
  onReady: () => {
    ui.loading.hidden = true;
    world.setState(simulation.snapshot());
    world.setMode(currentScene, true);
  },
  onHotspot: handleHotspot,
  onError: () => {
    worldUnavailable = true;
    ui.gameShell.dataset.worldUnavailable = 'true';
    ui.loading.innerHTML = '<span aria-hidden="true">!</span><span>3D view unavailable. All live batches and destinations remain usable in the controls.</span>';
    ui.loading.setAttribute('role', 'alert');
  }
});

function announce(message, assertive = false, duration = 2100) {
  window.clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  if (assertive) {
    ui.live.textContent = '';
    window.setTimeout(() => { ui.live.textContent = message; }, 20);
  }
  toastTimer = window.setTimeout(() => { ui.toast.hidden = true; }, duration);
}

function handleSimulationChange(state, event) {
  renderShift(state);
  world?.setState(state);
  if (!event || event.type === 'tick' || event.type === 'reset') return;

  const soundByEvent = {
    start: 'select',
    pause: 'click',
    resume: 'click',
    speed: 'click',
    select: 'select',
    deselect: 'click',
    work: 'work',
    queue: 'click',
    arrival: 'arrival',
    handoff: 'handoff',
    delivered: 'delivered',
    repair: 'repair',
    coach: 'handoff',
    incident: 'warning',
    warning: 'warning',
    missed: 'warning',
    mistake: 'warning',
    late: 'warning',
    complete: 'complete'
  };
  audio.play(soundByEvent[event.type] || 'click');

  if (['select', 'deselect', 'work', 'queue', 'arrival', 'handoff', 'delivered'].includes(event.type)) {
    ui.politeLive.textContent = '';
    window.setTimeout(() => { ui.politeLive.textContent = event.message; }, 20);
  }

  if (['incident', 'missed', 'mistake'].includes(event.type)) announce(event.message, true, 2500);
  else if (['coach', 'repair', 'late'].includes(event.type)) announce(event.message, false, 2200);

  if (event.type === 'complete') {
    ui.toast.hidden = true;
    ui.live.textContent = '';
    window.setTimeout(() => { ui.live.textContent = event.message; }, 20);
    window.clearTimeout(resultTimer);
    resultTimer = window.setTimeout(() => showResult(state.outcome, state), 850);
  }
}

function configureHud(shift) {
  ui.shiftPlace.textContent = shift.shiftLabel;
  ui.gameShell.dataset.shift = shift.id;
  ui.gameShell.dataset.playMode = shift.id === 'first-rounds' ? 'guided' : 'live';
}

function renderShift(state) {
  ui.clock.textContent = formatClock(state.time);
  ui.serviceValue.textContent = `${Math.round(state.onTime)}%`;
  ui.backlogValue.textContent = Math.round(state.backlog);
  ui.riskValue.textContent = `${state.combo}×`;
  ui.shiftState.textContent = !state.started ? 'READY' : state.completed ? 'COMPLETE' : state.paused ? 'PAUSED' : `${state.speed}× LIVE`;
  ui.shiftState.dataset.paused = String(state.paused);
  ui.pause.setAttribute('aria-pressed', String(state.started && state.paused));
  ui.pause.setAttribute('aria-label', state.paused ? 'Resume shift' : 'Pause shift');
  ui.pause.firstElementChild.textContent = state.paused ? '▶' : 'Ⅱ';
  ui.speed.textContent = `${state.speed}×`;
  ui.speed.setAttribute('aria-label', `Simulation speed, ${state.speed === 1 ? 'normal' : 'double'}`);
  ui.pause.disabled = !state.canRun || state.completed;
  ui.speed.disabled = !state.canRun || state.completed;
  ui.serviceMetric.dataset.level = state.onTime >= 90 ? 'good' : state.onTime >= 75 ? 'warning' : 'danger';
  ui.riskMetric.dataset.level = state.combo >= 5 ? 'good' : state.risk ? 'warning' : 'good';

  const mission = missionFor(state);
  ui.missionLabel.textContent = mission.label;
  ui.missionTime.textContent = mission.value;
  ui.missionPill.dataset.state = mission.state;

  for (const button of $$('.scene-tab')) {
    button.disabled = !state.started || state.completed || !state.availableScenes.includes(button.dataset.scene);
    button.setAttribute('aria-current', button.dataset.scene === currentScene ? 'page' : 'false');
  }
  renderLevelBadges(state);

  ui.operationLayer.hidden = !state.started || state.completed;
  if (!ui.operationLayer.hidden) renderOperations(state);
  if (ui.detailsDialog.open) updateStructuredDetails(state);
  updateSceneSummary(state);

  const commandKey = [
    state.shiftId,
    state.stage,
    state.selectedJobId,
    currentScene,
    state.resourceStatus[currentScene]?.busy,
    state.resourceStatus[currentScene]?.waiting,
    state.incidents.filter((incident) => incident.active).map((incident) => incident.id).join(',')
  ].join(':');
  if (commandKey !== commandRenderKey) {
    commandRenderKey = commandKey;
    renderCommand(state);
  }
}

function missionFor(state) {
  if (state.shiftId === 'first-rounds') {
    const missions = {
      brief: ['FIRST ROUNDS', 'NO PRESSURE', 'warning'],
      'coach-select': ['STEP 1', 'SELECT THE DLH BATCH', 'warning'],
      'coach-town-target': ['STEP 2', 'TAP EXPRESS A', 'warning'],
      'coach-town-run': ['TOWN SORT', 'MOVING', 'good'],
      'coach-open-region': ['STEP 3', 'OPEN REGION', 'warning'],
      'coach-region-select': ['STEP 4', 'SELECT THE BATCH', 'warning'],
      'coach-region-target': ['STEP 5', 'TAP HÄRNÖSAND', 'warning'],
      'coach-region-run': ['REGIONAL RUN', 'MOVING', 'good'],
      complete: ['FIRST SHIFT', 'COMPLETE', 'good']
    };
    const [label, value, missionState] = missions[state.stage] || missions.brief;
    return { label, value, state: missionState };
  }

  if (state.arrivalsComplete) {
    return {
      label: state.backlog ? 'CLEAR THE NETWORK' : 'SHIFT CLEAR',
      value: state.backlog ? `${state.backlog} BATCH${state.backlog === 1 ? '' : 'ES'} LEFT` : 'ALL PROMISES RESOLVED',
      state: state.risk ? 'danger' : 'good'
    };
  }
  return {
    label: 'LIVE ARRIVALS',
    value: `${formatSeconds(state.remainingSeconds)} · ${state.delivered} DELIVERED`,
    state: state.risk >= 4 ? 'danger' : state.risk ? 'warning' : 'good'
  };
}

function renderLevelBadges(state) {
  const badgeByLevel = {
    terminal: ui.terminalAlert,
    network: ui.networkAlert,
    sweden: ui.swedenAlert
  };
  for (const [level, badge] of Object.entries(badgeByLevel)) {
    const incidentCount = state.incidents.filter((incident) => incident.active && incident.level === level).length;
    const count = (state.levelCounts[level] || 0) + incidentCount;
    badge.hidden = count === 0;
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.dataset.danger = String(incidentCount > 0);
    badge.setAttribute('aria-label', count
      ? `${count} ${LEVEL_LABELS[level].toLowerCase()} items need attention${incidentCount ? ', including a disruption' : ''}`
      : `No ${LEVEL_LABELS[level].toLowerCase()} items need attention`);
  }
}

function renderOperations(state) {
  const presentation = SCENE_PRESENTATION[currentScene];
  const resource = state.resourceStatus[currentScene] || { busy: 0, capacity: 0 };
  ui.operationLevel.textContent = presentation.operation;
  ui.resourceChip.textContent = `${resource.busy} / ${resource.capacity} ${presentation.resource}`;

  const visibleJobs = state.jobs
    .filter((job) => job.stage === currentScene && ['waiting', 'queued', 'processing'].includes(job.status))
    .sort((a, b) => {
      const order = { waiting: 0, queued: 1, processing: 2 };
      return order[a.status] - order[b.status] || a.deadline - b.deadline;
    });
  const key = visibleJobs.map((job) => `${job.id}:${job.status}:${job.target}`).join('|') + `:${state.selectedJobId}`;
  if (key !== operationRenderKey) {
    operationRenderKey = key;
    ui.parcelRack.innerHTML = visibleJobs.map((job) => parcelButton(job, state)).join('');
    ui.parcelRack.querySelectorAll('[data-job-id]').forEach((button) => {
      button.addEventListener('click', () => simulation.perform('select-job', button.dataset.jobId));
    });
  }
  ui.operationEmpty.hidden = visibleJobs.length > 0;
  ui.parcelRack.hidden = visibleJobs.length === 0;
  updateOperationTimes(state);
  renderFallbackTargets(state);
}

function renderFallbackTargets(state) {
  if (!worldUnavailable) {
    ui.fallbackTargets.hidden = true;
    ui.fallbackTargets.innerHTML = '';
    return;
  }
  const belongsHere = (id) => currentScene === 'network'
    ? id.startsWith('network-')
    : currentScene === 'sweden'
      ? id.startsWith('sweden-')
      : !id.startsWith('network-') && !id.startsWith('sweden-');
  const targets = state.activeHotspots.filter(belongsHere);
  ui.fallbackTargets.hidden = targets.length === 0;
  ui.fallbackTargets.innerHTML = targets.map((id) => `<button type="button" data-fallback-target="${id}" data-tone="${state.hotspotTones[id] || 'yellow'}">${state.hotspotLabels[id] || TARGET_LABELS[id] || id}</button>`).join('');
  ui.fallbackTargets.querySelectorAll('[data-fallback-target]').forEach((button) => {
    button.addEventListener('click', () => handleHotspot(button.dataset.fallbackTarget));
  });
}

function parcelButton(job, state) {
  const selected = state.selectedJobId === job.id;
  const routeMark = job.stage === 'terminal'
    ? job.service === 'express' ? 'A ↗' : 'B ■'
    : job.target === 'network-sundsvall' ? 'NAT' : job.destinationCode;
  const statusLabel = job.status === 'processing' ? 'MOVING' : job.status === 'queued' ? 'QUEUED' : routeMark;
  const noDeadline = state.shiftId === 'first-rounds';
  const timeLeft = noDeadline ? 'NO LIMIT' : formatSeconds(job.deadline - state.elapsed);
  const disabled = job.status !== 'waiting';
  const aria = `${job.carrierName}, ${job.units} parcels for ${job.destinationName}. ${TARGET_LABELS[job.target] || routeMark}. ${noDeadline ? 'No deadline' : `${timeLeft} remaining`}. ${job.status}.`;
  return `<button class="parcel-batch" type="button" data-job-id="${job.id}" data-tone="${job.carrierTone}" data-status="${job.status}" aria-pressed="${selected}" aria-label="${aria}" ${disabled ? 'disabled' : ''}>
    <span class="carrier-code">${job.carrierCode}</span>
    <span class="parcel-cube" data-service="${job.service}" aria-hidden="true"><i></i></span>
    <span class="parcel-route"><strong>${statusLabel}</strong><small>${job.destinationCode}</small></span>
    <span class="parcel-deadline" data-late="${job.deadline <= state.elapsed}">${timeLeft}</span>
    <span class="parcel-progress" aria-hidden="true"><i></i></span>
  </button>`;
}

function updateOperationTimes(state) {
  ui.parcelRack.querySelectorAll('[data-job-id]').forEach((button) => {
    const job = state.jobs.find((item) => item.id === button.dataset.jobId);
    if (!job) return;
    const noDeadline = state.shiftId === 'first-rounds';
    const remaining = job.deadline - state.elapsed;
    const deadline = button.querySelector('.parcel-deadline');
    deadline.textContent = noDeadline ? 'NO LIMIT' : formatSeconds(remaining);
    deadline.dataset.late = String(!noDeadline && remaining <= 0);
    button.setAttribute('aria-label', `${job.carrierName}, ${job.units} parcels for ${job.destinationName}. ${TARGET_LABELS[job.target] || job.destinationCode}. ${noDeadline ? 'No deadline' : `${formatSeconds(remaining)} remaining`}. ${job.status}.`);
    const progress = button.querySelector('.parcel-progress i');
    if (job.status === 'processing' && job.completesAt > job.startedAt) {
      const value = ((state.elapsed - job.startedAt) / (job.completesAt - job.startedAt)) * 100;
      progress.style.width = `${Math.max(0, Math.min(100, value))}%`;
    } else {
      progress.style.width = job.status === 'queued' ? '12%' : '0%';
    }
  });
}

function renderCommand(state) {
  const command = commandFor(state);
  ui.commandContent.dataset.layout = command.layout || 'standard';
  ui.commandContent.innerHTML = command.html;
  ui.commandContent.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.value || null));
  });
}

function shell(kicker, title, body, actions = '', layout = 'standard') {
  return {
    layout,
    html: `<div class="command-copy"><span class="command-kicker">${kicker}</span><h1 id="commandTitle">${title}</h1>${body ? `<p>${body}</p>` : ''}</div>${actions ? `<div class="command-actions">${actions}</div>` : ''}`
  };
}

function commandFor(state) {
  if (state.shiftId === 'first-rounds') return onboardingCommand(state);
  const selected = state.selectedJob;
  const currentIncident = state.incidents.find((incident) => incident.active && incident.level === currentScene);
  if (selected) {
    return shell(
      `${selected.carrierName.toUpperCase()} · ${selected.units} PARCEL${selected.units === 1 ? '' : 'S'} · ${selected.stage === 'terminal' ? (selected.service === 'express' ? 'EXPRESS ↗' : 'STANDARD ■') : LEVEL_LABELS[selected.stage].toUpperCase()}`,
      `${selected.destinationName} · ${formatSeconds(selected.deadline - state.elapsed)}`,
      `Route mark: ${TARGET_LABELS[selected.target] || selected.destinationCode}.`,
      '',
      'live'
    );
  }
  const resource = state.resourceStatus[currentScene] || { busy: 0, capacity: 0, waiting: 0 };
  const incident = currentIncident ? `<span class="live-alert"><span aria-hidden="true">!</span>${currentIncident.label}</span>` : '';
  return shell(
    `${SCENE_PRESENTATION[currentScene].operation} · LIVE`,
    `${resource.waiting} waiting · ${resource.busy}/${resource.capacity} busy`,
    '',
    `${incident}<div class="carrier-legend" aria-label="Active partner carriers"><span data-tone="yellow">NP</span><span data-tone="red">DLH</span><span data-tone="green">B</span><span data-tone="blue">USP</span></div>`,
    'live'
  );
}

function onboardingCommand(state) {
  const commands = {
    brief: () => shell('FIRST SHIFT · GUIDED', 'Learn the live route.', 'Select a parcel batch, then tap its marked destination in the miniature world.', '<button class="game-button game-button--primary" type="button" data-action="start">Start first shift</button>'),
    'coach-select': () => shell('STEP 1 · SELECT', 'Take the waiting DLH batch.', 'Tap the parcel card on the town floor. Its blue arrow is the route mark.'),
    'coach-town-target': () => shell('STEP 2 · SORT', 'Blue arrow means Express A.', 'Tap Express A in the miniature terminal. The action happens there, not in this box.'),
    'coach-town-run': () => shell('TOWN SORT · LIVE', 'The sort team is occupied.', 'When the batch reaches the regional gate, the Region badge will light up.'),
    'coach-open-region': () => shell('STEP 3 · FOLLOW', 'Work is waiting in Region.', 'Open the level with the red badge.'),
    'coach-region-select': () => shell('STEP 4 · SELECT', 'Take the DLH batch again.', 'It is now waiting for a regional truck.'),
    'coach-region-target': () => shell('STEP 5 · ROUTE', 'The label says Härnösand.', 'Tap Härnösand in the miniature region.'),
    'coach-region-run': () => shell('REGIONAL RUN · LIVE', 'The truck is on the road.', 'The first promise completes on arrival.'),
    complete: () => shell('FIRST SHIFT COMPLETE', 'You are in charge now.', 'Live operations continue without prompts.')
  };
  return (commands[state.stage] || commands.brief)();
}

function handleAction(action, value = null) {
  audio.unlock();
  if (action === 'start') {
    beginShift();
    return;
  }
  simulation.perform(action, value);
}

function prepareShift(shiftId) {
  activeShift = getShiftDefinition(shiftId);
  const variant = campaign.plays[activeShift.id] || 0;
  simulation = new ShiftSimulation(handleSimulationChange, activeShift.id, { variant });
  currentScene = activeShift.startScene;
  commandRenderKey = '';
  operationRenderKey = '';
  shiftResultRecorded = false;
  configureHud(activeShift);
  renderShift(simulation.snapshot());
  switchScene(currentScene, false, true);
}

function beginShift() {
  audio.unlock();
  ui.welcome.hidden = true;
  ui.campaign.hidden = true;
  ui.result.hidden = true;
  ui.gameShell.inert = false;
  if (!simulation.state.started) simulation.start();
  ui.operationLayer.hidden = false;
  window.setTimeout(() => {
    const firstBatch = ui.parcelRack.querySelector('button:not([disabled])');
    (firstBatch || ui.commandDeck).focus({ preventScroll: true });
  }, 80);
}

function handleHotspot(id) {
  const state = simulation.snapshot();
  const incident = state.incidents.find((item) => item.active && item.target === id);
  if (incident) {
    simulation.perform('resolve-incident', id);
    return;
  }
  if (state.selectedJobId) {
    simulation.perform('route-selected', id);
    return;
  }
  const status = state.targetStatus[id];
  if (status) announce(`${status.label}: ${status.processing} moving, ${status.queued} queued.`);
}

function switchScene(scene, focusDeck = false, force = false) {
  const state = simulation.snapshot();
  if (!force && !state.availableScenes.includes(scene)) return;
  currentScene = scene;
  simulation.perform('visit-level', scene);
  world.setMode(scene, force);
  const presentation = SCENE_PRESENTATION[scene];
  ui.sceneEyebrow.textContent = presentation.eyebrow;
  ui.sceneTitle.textContent = presentation.title;
  $$('.scene-tab').forEach((button) => button.setAttribute('aria-current', button.dataset.scene === scene ? 'page' : 'false'));
  operationRenderKey = '';
  commandRenderKey = '';
  renderShift(simulation.snapshot());
  if (focusDeck) window.setTimeout(() => ui.commandDeck.focus({ preventScroll: true }), 80);
}

function updateSceneSummary(state) {
  const jobs = state.jobs.filter((job) => job.stage === currentScene && ['waiting', 'queued', 'processing'].includes(job.status));
  const waiting = jobs.filter((job) => job.status === 'waiting').length;
  const moving = jobs.filter((job) => job.status === 'processing').length;
  const incidents = state.incidents.filter((incident) => incident.active && incident.level === currentScene).map((incident) => incident.label);
  ui.sceneSummary.textContent = `${SCENE_PRESENTATION[currentScene].title}. ${waiting} batches waiting and ${moving} moving.${incidents.length ? ` Attention: ${incidents.join(', ')}.` : ''}`;
}

function detailMetric(label, value) {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function updateStructuredDetails(state) {
  ui.detailMetrics.innerHTML = [
    detailMetric('On time', `${state.onTime}%`),
    detailMetric('Waiting or moving', state.backlog),
    detailMetric('Current combo', `${state.combo}×`),
    detailMetric('Score', Math.round(state.score))
  ].join('');
  $('#detailsIntro').textContent = state.completed
    ? state.outcome.summary
    : `${activeShift.title}: ${state.delivered} batches delivered, ${state.risk} items currently at risk.`;

  const unresolved = state.jobs
    .filter((job) => !['scheduled', 'delivered', 'missed'].includes(job.status))
    .sort((a, b) => a.deadline - b.deadline);
  const jobRows = unresolved.length
    ? unresolved.map((job) => `<tr><th scope="row">${job.carrierCode} ${job.id.split('-').at(-1)}</th><td>${LEVEL_LABELS[job.stage]}</td><td>${job.destinationCode}</td><td>${formatSeconds(job.deadline - state.elapsed)}</td><td>${job.status}</td></tr>`).join('')
    : '<tr><td colspan="5">No active batches.</td></tr>';
  const incidents = state.incidents.length
    ? `<section class="dialog-section"><h3>Disruptions</h3><ul class="detail-checklist">${state.incidents.map((incident) => `<li data-done="${incident.resolved}">${incident.label} · ${incident.resolved ? 'cleared' : incident.active ? 'active' : 'not yet active'}</li>`).join('')}</ul></section>`
    : '';

  ui.detailScenario.innerHTML = `<section class="dialog-section"><h3>Live batches</h3><div class="table-wrap"><table>
    <thead><tr><th scope="col">Batch</th><th scope="col">Level</th><th scope="col">To</th><th scope="col">Promise</th><th scope="col">State</th></tr></thead>
    <tbody>${jobRows}</tbody></table></div></section>${incidents}`;
}

function openDetails() {
  const state = simulation.snapshot();
  wasRunningBeforeDialog = state.canRun && !state.paused && !state.completed;
  if (wasRunningBeforeDialog) simulation.setPaused(true);
  updateStructuredDetails(simulation.snapshot());
  ui.detailsDialog.showModal();
}

function closeDetails() {
  ui.detailsDialog.close();
  if (wasRunningBeforeDialog && !simulation.state.completed) simulation.setPaused(false);
  wasRunningBeforeDialog = false;
}

function recordResult(outcome, state) {
  if (shiftResultRecorded) return;
  shiftResultRecorded = true;
  campaign.completed[state.shiftId] = { grade: outcome.grade, score: outcome.score };
  campaign.plays[state.shiftId] = (campaign.plays[state.shiftId] || 0) + 1;
  campaign.bestScores[state.shiftId] = Math.max(campaign.bestScores[state.shiftId] || 0, outcome.score || 0);
  saveCampaign();
}

function showResult(outcome, state) {
  if (!outcome) return;
  recordResult(outcome, state);
  $('#resultKicker').textContent = outcome.kicker;
  $('#resultGrade').textContent = outcome.grade;
  $('#resultGrade').setAttribute('aria-label', outcome.gradeLabel);
  $('#resultTitle').textContent = outcome.title;
  $('#resultSummary').textContent = outcome.summary;
  $('#resultStats').innerHTML = outcome.stats.map((stat) => `<div><span>${stat.label}</span><strong>${stat.value}</strong></div>`).join('');
  $('#resultMedals').innerHTML = outcome.medals.map((medal) => `<span class="result-medal"><span aria-hidden="true">${medal.icon}</span>${medal.label}</span>`).join('');
  ui.nextShift.textContent = state.shiftId === 'first-rounds' ? 'Open shift board' : 'Back to shift board';
  ui.result.hidden = false;
  ui.gameShell.inert = true;
  ui.nextShift.focus({ preventScroll: true });
}

function shiftUnlocked(index) {
  return index === 0 || Boolean(campaign.completed[SHIFT_CATALOG[index - 1].id]);
}

function renderCampaign() {
  const completedCount = SHIFT_CATALOG.filter((shift) => campaign.completed[shift.id]).length;
  const nextIndex = SHIFT_CATALOG.findIndex((shift) => !campaign.completed[shift.id]);
  ui.campaignProgress.textContent = completedCount === SHIFT_CATALOG.length
    ? 'Every shift cleared. Peak conditions vary on replay.'
    : `${completedCount} cleared · shift ${nextIndex + 1} is next`;
  ui.campaignStamp.textContent = `${completedCount}/${SHIFT_CATALOG.length}`;
  ui.shiftList.innerHTML = SHIFT_CATALOG.map((shift, index) => {
    const completion = campaign.completed[shift.id];
    const plays = campaign.plays[shift.id] || 0;
    const unlocked = shiftUnlocked(index);
    return `<button class="shift-card" data-shift-id="${shift.id}" data-tone="${shift.tone}" type="button" ${unlocked ? '' : 'disabled'}>
      <span class="shift-card-number" aria-hidden="true">${shift.number}</span>
      <span class="shift-card-copy"><span class="shift-card-kind">${shift.kind} · ${shift.duration}</span><strong>${shift.title}</strong><span>${shift.description}</span><small>${shift.mechanic}${plays > 1 ? ` · ${plays} runs` : ''}</small></span>
      <span class="shift-card-state">${completion ? `<strong>${completion.grade}</strong><span>Replay</span>` : unlocked ? '<strong>→</strong><span>Play</span>' : '<strong>×</strong><span>Locked</span>'}</span>
    </button>`;
  }).join('');
  ui.shiftList.querySelectorAll('[data-shift-id]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      prepareShift(button.dataset.shiftId);
      beginShift();
    });
  });
}

function openCampaign() {
  window.clearTimeout(resultTimer);
  ui.welcome.hidden = true;
  ui.result.hidden = true;
  ui.campaign.hidden = false;
  ui.gameShell.inert = true;
  renderCampaign();
  window.setTimeout(() => {
    const nextShift = SHIFT_CATALOG.find((shift, index) => shiftUnlocked(index) && !campaign.completed[shift.id]);
    const next = nextShift ? ui.shiftList.querySelector(`[data-shift-id="${nextShift.id}"]`) : null;
    (next || ui.shiftList.querySelector('button:not([disabled])'))?.focus({ preventScroll: true });
  }, 80);
}

ui.start.addEventListener('click', () => {
  prepareShift('first-rounds');
  beginShift();
});
ui.deckStart.addEventListener('click', beginShift);
ui.pause.addEventListener('click', () => simulation.togglePaused());
ui.speed.addEventListener('click', () => simulation.setSpeed(simulation.state.speed === 1 ? 2 : 1));
ui.sound.addEventListener('click', () => {
  audio.unlock();
  const enabled = audio.toggle();
  ui.sound.setAttribute('aria-pressed', String(enabled));
  ui.sound.setAttribute('aria-label', enabled ? 'Mute sound' : 'Turn sound on');
  ui.sound.firstElementChild.textContent = enabled ? '♪' : '×';
  if (enabled) audio.play('click');
  announce(enabled ? 'Sound on.' : 'Sound muted.');
});
ui.details.addEventListener('click', openDetails);
ui.resultDetails.addEventListener('click', openDetails);
ui.detailsClose.addEventListener('click', closeDetails);
ui.detailsDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeDetails();
});
ui.nextShift.addEventListener('click', openCampaign);
ui.replay.addEventListener('click', () => {
  ui.result.hidden = true;
  prepareShift(activeShift.id);
  beginShift();
});

$$('.scene-tab').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.disabled) return;
    audio.play('click');
    switchScene(button.dataset.scene);
  });
});

document.addEventListener('keydown', (event) => {
  if (!simulation.state.started || simulation.state.completed || ui.detailsDialog.open) return;
  if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return;
  if (event.key.toLowerCase() === 'p') simulation.togglePaused();
  if (event.key === '1') switchScene('terminal');
  if (event.key === '2') switchScene('network');
  if (event.key === '3') switchScene('sweden');
});

document.addEventListener('visibilitychange', () => {
  const state = simulation.snapshot();
  if (document.hidden && state.canRun && !state.paused && !state.completed) simulation.setPaused(true);
});

window.setInterval(() => simulation.tick(0.1), 100);
configureHud(activeShift);
renderShift(simulation.snapshot());
switchScene(activeShift.startScene, false, true);
ui.gameShell.inert = true;

if (campaign.completed['first-rounds']) {
  ui.welcome.hidden = true;
  openCampaign();
} else {
  ui.campaign.hidden = true;
  window.setTimeout(() => ui.start.focus({ preventScroll: true }), 120);
}

window.__POSTAL_GAME__ = {
  getState: () => simulation.snapshot(),
  getCampaign: () => JSON.parse(JSON.stringify(campaign)),
  startShift: (shiftId) => {
    prepareShift(shiftId);
    beginShift();
  },
  act: (action, value = null) => simulation.perform(action, value),
  showLevel: (level) => switchScene(level),
  tick: (seconds) => simulation.tick(seconds)
};

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
