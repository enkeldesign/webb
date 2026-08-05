import {
  SHIFT_CATALOG,
  ShiftSimulation,
  VERIFY_TARGET,
  formatClock,
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
  serviceLabel: $('#serviceLabel'),
  serviceIcon: $('#serviceIcon'),
  serviceValue: $('#serviceValue'),
  backlogLabel: $('#backlogLabel'),
  backlogIcon: $('#backlogIcon'),
  backlogValue: $('#backlogValue'),
  riskLabel: $('#riskLabel'),
  riskIcon: $('#riskIcon'),
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
  toast: $('#toast'),
  live: $('#assertiveLive'),
  caseAlert: $('#caseAlert'),
  detailMetrics: $('#detailMetrics'),
  detailScenario: $('#detailScenario')
};

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
      this.master.gain.value = 0.72;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }

  play(name) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.context || !this.master) return;

    const patterns = {
      click: [[232, 0, 0.075, 0.014]],
      select: [[294, 0, 0.095, 0.018]],
      inspect: [[262, 0, 0.09, 0.017], [330, 0.055, 0.11, 0.014]],
      staff: [[247, 0, 0.1, 0.018], [311, 0.065, 0.12, 0.016]],
      reveal: [[294, 0, 0.11, 0.018], [370, 0.075, 0.13, 0.016]],
      repair: [[277, 0, 0.1, 0.017], [349, 0.07, 0.13, 0.017]],
      success: [[330, 0, 0.11, 0.019], [415, 0.085, 0.14, 0.017]],
      dispatch: [[247, 0, 0.11, 0.018], [330, 0.075, 0.13, 0.018], [392, 0.15, 0.16, 0.016]]
    };
    const pattern = patterns[name] || patterns.click;
    const now = this.context.currentTime;
    pattern.forEach(([frequency, delay, duration, level]) => this.tone(frequency, now + delay, duration, level));
  }

  tone(frequency, start, duration, level) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune.setValueAtTime(-5, start);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(920, start);
    filter.Q.value = 0.45;
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

const CAMPAIGN_KEY = 'postal-campaign-v3';

function loadCampaign() {
  try {
    const saved = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || 'null');
    if (saved?.version === 3) {
      return {
        version: 3,
        completed: saved.completed || {},
        plays: saved.plays || {},
        bestScores: saved.bestScores || {}
      };
    }
  } catch {}
  return { version: 3, completed: {}, plays: {}, bestScores: {} };
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
let toastTimer = 0;
let wasRunningBeforeDialog = false;
let resultTimer = 0;
let shiftResultRecorded = false;

const world = new PostalWorld(ui.worldCanvas, ui.hotspotLayer, {
  onReady: () => {
    ui.loading.hidden = true;
    world.setState(simulation.snapshot());
    world.setMode(currentScene, true);
  },
  onHotspot: handleHotspot,
  onError: () => {
    ui.loading.innerHTML = '<span aria-hidden="true">!</span><span>3D view unavailable. Every shift remains playable with the controls below.</span>';
    ui.loading.setAttribute('role', 'alert');
  }
});

function announce(message, assertive = false) {
  window.clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  if (assertive) {
    ui.live.textContent = '';
    window.setTimeout(() => { ui.live.textContent = message; }, 20);
  }
  toastTimer = window.setTimeout(() => { ui.toast.hidden = true; }, 2600);
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
    inspect: 'inspect',
    staff: 'staff',
    hold: 'select',
    package: 'inspect',
    signature: 'reveal',
    triage: 'select',
    allocate: 'staff',
    route: 'reveal',
    deduce: 'reveal',
    repair: 'repair',
    rule: 'success',
    verified: 'success',
    complete: 'dispatch'
  };
  audio.play(soundByEvent[event.type] || 'click');

  const assertive = ['staff', 'package', 'signature', 'allocate', 'deduce', 'repair', 'rule', 'verified', 'complete'].includes(event.type);
  if (event.message && event.type !== 'complete') announce(event.message, assertive);

  if (state.shiftId === 'northbound' && event.type === 'package') switchScene('case', true);
  if (state.shiftId === 'priority-parcel' && event.type === 'deduce') switchScene('network', true);
  if (event.type === 'signature') ui.caseAlert.hidden = true;
  if (event.type === 'complete') {
    ui.toast.hidden = true;
    ui.live.textContent = '';
    window.setTimeout(() => { ui.live.textContent = event.message; }, 20);
    window.clearTimeout(resultTimer);
    resultTimer = window.setTimeout(() => showResult(state.outcome, state), 900);
  }
}

function configureHud(shift) {
  ui.shiftPlace.textContent = shift.shiftLabel;
  [ui.serviceLabel.textContent, ui.backlogLabel.textContent, ui.riskLabel.textContent] = shift.metricLabels;
  [ui.serviceIcon.textContent, ui.backlogIcon.textContent, ui.riskIcon.textContent] = shift.metricIcons;
  ui.gameShell.dataset.shift = shift.id;
}

function renderShift(state) {
  const shiftIsPaused = state.started && state.paused;
  ui.clock.textContent = formatClock(state.time);
  ui.serviceValue.textContent = `${Math.round(state.onTime)}%`;
  ui.backlogValue.textContent = Math.round(state.backlog);
  ui.riskValue.textContent = Math.round(state.risk);
  ui.shiftState.textContent = !state.started ? 'READY' : state.completed ? 'COMPLETE' : state.paused ? 'PAUSED' : `${state.speed}× LIVE`;
  ui.shiftState.dataset.paused = String(state.paused);
  ui.pause.setAttribute('aria-pressed', String(shiftIsPaused));
  ui.pause.setAttribute('aria-label', shiftIsPaused ? 'Resume shift' : 'Pause shift');
  ui.pause.firstElementChild.textContent = shiftIsPaused ? '▶' : 'Ⅱ';
  ui.speed.textContent = `${state.speed}×`;
  ui.speed.setAttribute('aria-label', `Simulation speed, ${state.speed === 1 ? 'normal' : 'double'}`);
  ui.pause.disabled = !state.canRun || state.completed;
  ui.speed.disabled = !state.canRun || state.completed;

  const mission = missionFor(state);
  ui.missionLabel.textContent = mission.label;
  ui.missionTime.textContent = mission.value;
  ui.missionPill.dataset.state = mission.state;

  ui.riskMetric.dataset.level = state.risk <= 2 ? 'good' : state.risk >= 18 ? 'danger' : 'warning';
  ui.serviceMetric.dataset.level = state.onTime >= 96 ? 'good' : 'warning';

  $$('.scene-tab').forEach((button) => {
    button.disabled = !state.started || state.completed || !state.availableScenes.includes(button.dataset.scene);
  });
  ui.caseAlert.hidden = !(state.shiftId === 'northbound' && !state.packageSelected && state.stage === 'investigate');

  if (ui.detailsDialog.open) updateStructuredDetails(state);
  updateSceneSummary(state);

  const nextKey = [
    state.shiftId,
    state.stage,
    state.paused,
    state.verified,
    state.staffMoved,
    state.truckHeld,
    state.ruleFixed,
    state.inspectedDepots.join(','),
    state.allocation,
    state.routeChoice,
    state.delivered,
    state.triageOrder.join(','),
    state.scannerFixed,
    state.scannerBypassed,
    state.processed,
    state.clueChoice,
    state.recoveryChoice,
    Math.floor(state.deliveryProgress / 5)
  ].join(':');
  if (nextKey !== commandRenderKey) {
    commandRenderKey = nextKey;
    renderCommand(state);
  }
}

function missionFor(state) {
  if (state.shiftId === 'first-rounds') {
    const missions = {
      brief: ['FIRST ROUNDS', '4 SHORT TASKS · NO PRESSURE', 'warning'],
      tour: ['STEP 1 OF 4', 'READ EXPRESS A', 'warning'],
      'coach-move': ['STEP 2 OF 4', 'MOVE THE SPARE CREW', 'warning'],
      'coach-scan': ['STEP 3 OF 4', 'CHECK THE SCANNER', 'warning'],
      'coach-run': ['STEP 4 OF 4', 'START THE FLOW', 'warning'],
      'coach-watch': ['PROMISES MOVING', `${state.verified} / 6 CORRECT`, 'good'],
      dispatch: ['MORNING VAN', 'READY TO SEND', 'good'],
      complete: ['FIRST SHIFT', 'COMPLETE', 'good']
    };
    const [label, value, missionState] = missions[state.stage] || missions.brief;
    return { label, value, state: missionState };
  }

  if (state.shiftId === 'northbound') {
    const minutesLeft = Math.max(0, Math.ceil(state.departure - state.time));
    return {
      label: state.ruleFixed ? 'NORTHBOUND · FLOW CORRECTED' : 'NORTHBOUND EXPRESS',
      value: state.completed
        ? `DEPARTED ${formatClock(state.departure)}`
        : state.time < state.departure
          ? `DEPARTS ${formatClock(state.departure)} · ${minutesLeft} MIN`
          : `${Math.floor(state.time - state.departure) + 1} MIN LATE`,
      state: state.ruleFixed ? 'good' : state.risk >= 20 || state.time >= state.departure ? 'danger' : 'warning'
    };
  }

  if (state.shiftId === 'snow-window') {
    const missions = {
      brief: ['WEATHER WINDOW', 'SNOW ARRIVES 06:30'],
      'weather-scan': ['READ THE NETWORK', `${state.inspectedDepots.length} / 3 DEPOTS CHECKED`],
      'weather-allocate': ['ONE SPARE TRUCK', 'CHOOSE THE PROMISES'],
      'weather-route': ['E4 RESTRICTED', 'CHOOSE THE ROAD'],
      'weather-run': [`${String(state.allocation || '').toUpperCase()} RUN`, `${state.delivered} / ${state.deliveryTarget} DELIVERED`],
      dispatch: ['WEATHER RUN', 'ARRIVED'],
      complete: ['WEATHER WINDOW', 'CLOSED']
    };
    const [label, value] = missions[state.stage] || missions.brief;
    return { label, value, state: state.stage === 'dispatch' || state.completed ? 'good' : 'warning' };
  }

  if (state.shiftId === 'scanner-fever') {
    const missions = {
      brief: ['SCANNER 2', 'QUEUE BUILDING'],
      'jam-diagnose': ['SCANNER STOPPED', 'FIND THE BLOCKAGE'],
      'jam-triage': ['MANUAL RELEASE', `${state.triageOrder.length} / 3 GROUPS ORDERED`],
      'jam-repair': ['QUEUE ORDERED', 'CHOOSE RECOVERY'],
      'jam-run': [state.scannerFixed ? 'SCANNER RESTORED' : 'MANUAL BYPASS', `${state.processed} / 31 PROCESSED`],
      dispatch: ['OUTBOUND FLOW', 'CLEAR'],
      complete: ['SCANNER SHIFT', 'COMPLETE']
    };
    const [label, value] = missions[state.stage] || missions.brief;
    return { label, value, state: state.stage === 'dispatch' || state.completed ? 'good' : 'danger' };
  }

  const missions = {
    brief: ['PRIORITY PARCEL', 'DELIVER BY 21:10'],
    'case-inspect': ['COLD CHAIN', 'OPEN THE SCAN TRAIL'],
    'case-clue': ['THREE EVENTS', 'FIND THE PARCEL'],
    'case-plan': ['PARCEL SECURED', 'CHOOSE RECOVERY'],
    'case-run': ['RECOVERY LIVE', `${Math.round(state.deliveryProgress)}% TO RECIPIENT`],
    dispatch: ['DELIVERY', 'CONFIRM RECEIPT'],
    complete: ['COLD CHAIN', 'INTACT']
  };
  const [label, value] = missions[state.stage] || missions.brief;
  return { label, value, state: state.stage === 'dispatch' || state.completed ? 'good' : 'warning' };
}

function renderCommand(state) {
  const command = commandFor(state);
  ui.commandContent.dataset.layout = command.layout || 'standard';
  ui.commandContent.innerHTML = command.html;
  ui.commandContent.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.value || null));
  });
}

function commandFor(state) {
  if (state.shiftId === 'first-rounds') return onboardingCommand(state);
  if (state.shiftId === 'northbound') return northboundCommand(state);
  if (state.shiftId === 'snow-window') return snowCommand(state);
  if (state.shiftId === 'scanner-fever') return scannerCommand(state);
  return priorityCommand(state);
}

function shell(kicker, title, body, actions, layout = 'standard') {
  return {
    layout,
    html: `
      <div class="command-copy">
        <span class="command-kicker">${kicker}</span>
        <h1 id="commandTitle">${title}</h1>
        ${body ? `<p>${body}</p>` : ''}
      </div>
      <div class="command-actions">${actions}</div>`
  };
}

function onboardingCommand(state) {
  const commands = {
    brief: () => shell('FIRST SHIFT · GUIDED', 'Meet the parcel flow.', 'Four small actions introduce the terminal. Nothing moves until you are ready.', '<button class="game-button game-button--primary" type="button" data-action="start">Start first shift</button>'),
    tour: () => shell('STEP 1 · READ', 'Blue leaves first.', 'Express parcels use blue rings and carry the shortest promises. Tap the glowing blue lane.', '<button class="game-button game-button--blue" type="button" data-action="inspect-express">Inspect Express A</button>'),
    'coach-move': () => shell('STEP 2 · BALANCE', 'Move help where it matters.', 'The yellow lane has spare operators. Move two of them to the blue lane.', '<button class="game-button game-button--blue" type="button" data-action="move-staff">Move 2 crew</button>'),
    'coach-scan': () => shell('STEP 3 · FOLLOW', 'Find the promise reader.', 'The scanner reads the label before the belts divide. Tap the highlighted machine.', '<button class="game-button game-button--orange" type="button" data-action="inspect-scanner">Inspect scanner</button>'),
    'coach-run': () => shell('STEP 4 · WATCH', 'Let six parcels through.', 'Start the belt and watch the rings: blue to Express, yellow to Standard.', '<button class="game-button game-button--green" type="button" data-action="resume">Start parcel flow</button>'),
    'coach-watch': () => shell('FLOW LIVE', 'Watch the promises move.', 'The belts will pause when six parcels have reached the correct lane.', progressAction(state.verified, 6, 'CORRECT')),
    dispatch: () => shell('MORNING VAN READY', 'Send your first departure.', 'The flow is balanced and every parcel is aboard.', '<button class="game-button game-button--green" type="button" data-action="dispatch">Send morning van</button>'),
    complete: () => shell('FIRST SHIFT COMPLETE', 'The shift board is open.', 'Four different kinds of work are ready.', '<button class="game-button game-button--green" type="button" disabled>On the roster</button>')
  };
  return (commands[state.stage] || commands.brief)();
}

function northboundCommand(state) {
  const commands = {
    brief: () => shell('SHIFT BRIEF', 'The northbound run needs you.', 'Protect the departure, then find why blue Express parcels reach the yellow lane.', '<button class="game-button game-button--primary" type="button" data-action="start">Start shift</button>'),
    protect: () => shell('LIVE · EXPRESS A', 'The blue lane is filling fast.', 'Standard B has spare crew. Rebalance now, or buy three minutes by holding the truck and spend transfer margin.', `
      <button class="game-button game-button--blue" type="button" data-action="move-staff">Move 2 crew</button>
      <button class="game-button game-button--quiet" type="button" data-action="hold-truck">Hold truck · 3 min</button>`),
    investigate: () => shell('ANOMALY · STANDARD B', 'A blue parcel is in the yellow lane.', 'The queue is recovering, but this Express parcel took the same wrong turn as eleven earlier parcels.', `
      <button class="game-button game-button--orange" type="button" data-action="trace-package">Trace flashing parcel</button>
      ${state.staffMoved ? '' : '<button class="game-button game-button--quiet" type="button" data-action="move-staff">Also move 2 crew</button>'}`),
    compare: () => ({
      layout: 'standard',
      html: `<div class="command-copy">
        <span class="command-kicker">PARCEL · SE-0428-771</span>
        <h1 id="commandTitle">Where did its journey diverge?</h1>
        <div class="route-comparison" aria-label="Planned and actual route">
          <div class="route-row"><strong>Planned</strong> Scan → <span>Express A</span> → 18:20</div>
          <div class="route-row route-row--wrong"><strong>Actual</strong> Scan → <span>Standard B</span> → correction</div>
        </div></div>
        <div class="command-actions"><button class="game-button game-button--blue" type="button" data-action="find-similar">Light up matching parcels</button></div>`
    }),
    rule: () => ({
      layout: 'standard',
      html: `<div class="command-copy"><span class="command-kicker">ROOT CAUSE · 12 MATCHES</span><h1 id="commandTitle">The fallback rule runs first.</h1><p>All matches are north-zone Express parcels scanned after 17:30.</p></div>
        <div class="command-actions rule-stack" aria-label="Current routing rule order">
          <div class="rule-card"><span class="rule-order">1</span><span>North zone after 17:30</span></div>
          <button class="rule-card" type="button" data-action="fix-rule"><span class="rule-order">↑</span><span>Move <strong>Express service</strong> first</span></button>
        </div>`
    }),
    verify: () => shell('VERIFY THE FIX', 'Watch the next twelve parcels.', state.paused ? 'Resume the flow and make sure new parcels take the blue lane.' : 'No wrong turns so far.', `
      ${progressAction(state.verified, VERIFY_TARGET, 'CORRECT')}
      ${state.paused
        ? '<button class="game-button game-button--green" type="button" data-action="resume">Resume flow</button>'
        : '<button class="game-button game-button--blue" type="button" data-action="speed-up">Run at 2×</button>'}`),
    dispatch: () => shell('DEPARTURE READY', 'The flow is clean.', 'Twelve later parcels followed the corrected rule. Send the northbound truck.', '<button class="game-button game-button--green" type="button" data-action="dispatch">Send northbound</button>'),
    complete: () => shell('SHIFT COMPLETE', 'Northbound is on its way.', 'The shift report is ready.', '<button class="game-button game-button--green" type="button" disabled>Promises kept</button>')
  };
  return (commands[state.stage] || commands.brief)();
}

function snowCommand(state) {
  if (state.stage === 'brief') return shell('NETWORK SHIFT', 'Snow is closing the coast road.', 'One spare truck must protect the most important promises before 06:30.', '<button class="game-button game-button--primary" type="button" data-action="start">Open network</button>');
  if (state.stage === 'weather-scan') {
    const depots = ['harnosand', 'timra', 'matfors'];
    const next = depots.find((depot) => !state.inspectedDepots.includes(depot));
    const labels = { harnosand: 'Härnösand', timra: 'Timrå', matfors: 'Matfors' };
    return shell('READ THE NETWORK', 'Check all three depots.', 'Tap the places in the miniature network. The large button provides the same inspection.', `<button class="game-button game-button--blue" type="button" data-action="inspect-depot" data-value="${next}">Check ${labels[next]}</button>`);
  }
  if (state.stage === 'weather-allocate') {
    return shell('ONE SPARE TRUCK', 'Which promises move first?', 'Härnösand has 14 urgent parcels. Timrå has 26 standard; Matfors has 9 next-day.', `
      <div class="choice-grid choice-grid--three">
        <button class="choice-card" type="button" data-action="allocate-truck" data-value="harnosand"><strong>Härnösand</strong><span>14 · urgent</span></button>
        <button class="choice-card" type="button" data-action="allocate-truck" data-value="timra"><strong>Timrå</strong><span>26 · standard</span></button>
        <button class="choice-card" type="button" data-action="allocate-truck" data-value="matfors"><strong>Matfors</strong><span>9 · next day</span></button>
      </div>`, 'wide');
  }
  if (state.stage === 'weather-route') {
    return shell('ROAD DECISION', 'Choose the road north.', 'The coast road is shorter but restricted. The inland road via Matfors is longer and open.', `
      <div class="choice-grid">
        <button class="choice-card" type="button" data-action="choose-route" data-value="coast"><strong>Coast road</strong><span>Fast · snow risk</span></button>
        <button class="choice-card choice-card--blue" type="button" data-action="choose-route" data-value="inland"><strong>Via Matfors</strong><span>Longer · open</span></button>
      </div>`, 'wide');
  }
  if (state.stage === 'weather-run') return shell('CONVOY READY', 'Run through the weather window.', state.paused ? 'Start the truck. Its route is visible across the miniature network.' : 'The assigned load is moving.', `
    ${progressAction(state.delivered, state.deliveryTarget, 'DELIVERED')}
    ${state.paused ? '<button class="game-button game-button--green" type="button" data-action="resume">Start convoy</button>' : '<button class="game-button game-button--blue" type="button" data-action="speed-up">Run at 2×</button>'}`);
  if (state.stage === 'dispatch') return shell('ARRIVAL CONFIRMED', 'Close the weather run.', 'The assigned parcels are inside the depot before the road closes.', '<button class="game-button game-button--green" type="button" data-action="dispatch">Close weather shift</button>');
  return shell('WEATHER SHIFT COMPLETE', 'The network adapted.', 'The shift report is ready.', '<button class="game-button game-button--green" type="button" disabled>Route complete</button>');
}

function scannerCommand(state) {
  if (state.stage === 'brief') return shell('TERMINAL SHIFT', 'Scanner 2 has stopped.', 'Diagnose the jam, decide what moves first and recover the queue.', '<button class="game-button game-button--primary" type="button" data-action="start">Start terminal shift</button>');
  if (state.stage === 'jam-diagnose') return shell('FLOW STOPPED', 'Find the blockage.', 'Parcels are bunching before Scanner 2. Tap the highlighted scanner.', '<button class="game-button game-button--orange" type="button" data-action="inspect-scanner">Inspect Scanner 2</button>');
  if (state.stage === 'jam-triage') {
    const choices = state.triageQueue.map((parcel) => {
      const position = state.triageOrder.indexOf(parcel.id);
      return `<button class="parcel-choice" data-tone="${parcel.tone}" type="button" data-action="prioritize" data-value="${parcel.id}" ${position >= 0 ? 'disabled' : ''}>
        <span class="parcel-choice-box" aria-hidden="true">□</span><strong>${parcel.label}</strong><span>${position >= 0 ? `Released #${position + 1}` : parcel.promise}</span>
      </button>`;
    }).join('');
    return shell('MANUAL RELEASE', 'Which promise goes first?', 'Tap the three waiting groups in the order you want to release them.', `<div class="parcel-priority-grid">${choices}</div>`, 'wide');
  }
  if (state.stage === 'jam-repair') return shell('QUEUE ORDERED', 'Repair or bypass?', 'Repair restores accuracy but takes longer. Manual bypass moves now and leaves more handling risk.', `
    <div class="choice-grid">
      <button class="choice-card choice-card--blue" type="button" data-action="repair-scanner"><strong>Clear + calibrate</strong><span>Restore 98% accuracy</span></button>
      <button class="choice-card" type="button" data-action="bypass-scanner"><strong>Manual bypass</strong><span>Move now · more risk</span></button>
    </div>`, 'wide');
  if (state.stage === 'jam-run') return shell(state.scannerFixed ? 'SCANNER RESTORED' : 'MANUAL BYPASS', 'Clear the waiting queue.', state.paused ? 'Start the recovered flow and watch the parcels pass the scanner.' : 'The queue is shrinking.', `
    ${progressAction(state.processed, 31, 'PROCESSED')}
    ${state.paused ? '<button class="game-button game-button--green" type="button" data-action="resume">Start recovered flow</button>' : '<button class="game-button game-button--blue" type="button" data-action="speed-up">Run at 2×</button>'}`);
  if (state.stage === 'dispatch') return shell('OUTBOUND CLEAR', 'Release the departures.', 'Every waiting parcel has passed the recovery point.', '<button class="game-button game-button--green" type="button" data-action="dispatch">Close terminal shift</button>');
  return shell('QUEUE CLEARED', 'The line is moving.', 'The shift report is ready.', '<button class="game-button game-button--green" type="button" disabled>Flow restored</button>');
}

function priorityCommand(state) {
  if (state.stage === 'brief') return shell('INVESTIGATION SHIFT', 'One cold-chain promise is missing.', 'Use its scans to find it, then choose a recovery that can still make 21:10.', '<button class="game-button game-button--primary" type="button" data-action="start">Open parcel case</button>');
  if (state.stage === 'case-inspect') return shell(`PARCEL · ${state.caseData.parcelId}`, 'Open the scan trail.', 'The temperature is safe now, but the delivery window is shrinking.', '<button class="game-button game-button--orange" type="button" data-action="inspect-case">Inspect parcel history</button>');
  if (state.stage === 'case-clue') {
    const evidence = state.caseData.evidence.map((item) => `<li>${item}</li>`).join('');
    const locations = state.caseData.locations.map((location) => `<button class="choice-card" type="button" data-action="choose-location" data-value="${location.id}"><strong>${location.label}</strong><span>Search here</span></button>`).join('');
    return {
      layout: 'wide',
      html: `<div class="command-copy"><span class="command-kicker">SCAN TRAIL</span><h1 id="commandTitle">Where is the parcel?</h1><ol class="evidence-list">${evidence}</ol></div><div class="command-actions"><div class="choice-grid choice-grid--three">${locations}</div></div>`
    };
  }
  if (state.stage === 'case-plan') return shell('PARCEL SECURED', 'Choose the final connection.', 'Direct courier protects the cold chain. A held linehaul is efficient but tight; scheduled transfer misses the original margin.', `
    <div class="choice-grid choice-grid--three">
      <button class="choice-card choice-card--blue" type="button" data-action="choose-recovery" data-value="courier"><strong>Courier</strong><span>22 min · direct</span></button>
      <button class="choice-card" type="button" data-action="choose-recovery" data-value="linehaul"><strong>Hold linehaul</strong><span>31 min · tight</span></button>
      <button class="choice-card" type="button" data-action="choose-recovery" data-value="scheduled"><strong>Scheduled</strong><span>48 min · late risk</span></button>
    </div>`, 'wide');
  if (state.stage === 'case-run') return shell('RECOVERY READY', 'Follow it to the recipient.', state.paused ? 'Start the chosen connection. The regional view shows its progress.' : 'Temperature and route are stable.', `
    ${progressAction(Math.round(state.deliveryProgress), 100, 'TO RECIPIENT')}
    ${state.paused ? '<button class="game-button game-button--green" type="button" data-action="resume">Start recovery</button>' : '<button class="game-button game-button--blue" type="button" data-action="speed-up">Run at 2×</button>'}`);
  if (state.stage === 'dispatch') return shell('RECIPIENT CONFIRMED', 'Complete the handoff.', 'The parcel arrived with its cold chain intact.', '<button class="game-button game-button--green" type="button" data-action="dispatch">Confirm delivery</button>');
  return shell('DELIVERY COMPLETE', 'Cold chain intact.', 'The shift report is ready.', '<button class="game-button game-button--green" type="button" disabled>Promise kept</button>');
}

function progressAction(value, target, label) {
  return `<div class="mini-progress" aria-label="${value} of ${target} ${label.toLowerCase()}">
    <div class="mini-progress-track"><span style="width:${Math.min(100, (value / Math.max(1, target)) * 100)}%"></span></div>
    <span class="mini-progress-label">${value} / ${target} ${label}</span>
  </div>`;
}

function handleAction(action, value = null) {
  if (action === 'start') {
    beginShift();
    return;
  }
  const performed = simulation.perform(action, value);
  if (!performed) audio.play('click');
}

function prepareShift(shiftId) {
  activeShift = getShiftDefinition(shiftId);
  const variant = campaign.plays[activeShift.id] || 0;
  simulation = new ShiftSimulation(handleSimulationChange, activeShift.id, { variant });
  shiftResultRecorded = false;
  commandRenderKey = '';
  currentScene = activeShift.startScene;
  configureHud(activeShift);
  renderShift(simulation.snapshot());
  world.setState(simulation.snapshot());
  switchScene(activeShift.startScene, false, true);
}

function beginShift() {
  if (simulation.state.started) return;
  audio.unlock();
  ui.welcome.hidden = true;
  ui.campaign.hidden = true;
  ui.result.hidden = true;
  ui.gameShell.inert = false;
  simulation.start();
  switchScene(activeShift.startScene, false, true);
  ui.commandDeck.focus({ preventScroll: true });
}

function depotFromHotspot(id) {
  return {
    'network-harnosand': 'harnosand',
    'network-timra': 'timra',
    'network-matfors': 'matfors'
  }[id];
}

function handleHotspot(id) {
  const state = simulation.snapshot();

  if (state.shiftId === 'first-rounds') {
    if (id === 'express-lane' && state.stage === 'tour') simulation.perform('inspect-express');
    else if (id === 'scanner' && state.stage === 'coach-scan') simulation.perform('inspect-scanner');
    else if (id === 'truck' && state.stage === 'dispatch') simulation.perform('dispatch');
    else inspectTerminalHotspot(id, state);
    return;
  }

  if (state.shiftId === 'northbound') {
    if (id === 'parcel') simulation.perform('trace-package');
    else if (id === 'case-package') announce('The label says Express to Härnösand. Its history turns into Standard B at 17:32.');
    else if (id === 'case-similar') announce('Twelve matches: Express, north zone, scanned after 17:30.');
    else if (id === 'network-sundsvall') {
      switchScene('terminal');
      announce('Sundsvall is the source of the northbound pressure.');
    } else if (id === 'network-harnosand') announce('Härnösand is waiting for the Express connection.');
    else if (id === 'network-timra') announce('Timrå depot is stable.');
    else if (id === 'network-matfors') announce('Matfors depot is stable.');
    else inspectTerminalHotspot(id, state);
    return;
  }

  if (state.shiftId === 'snow-window') {
    const depot = depotFromHotspot(id);
    if (depot && state.stage === 'weather-scan') simulation.perform('inspect-depot', depot);
    else if (id === 'network-sundsvall') announce('One spare truck is ready in Sundsvall.');
    else if (id === 'network-harnosand') announce('Härnösand: 14 urgent parcels, including blood samples.');
    else if (id === 'network-timra') announce('Timrå: 26 standard parcels with later promises.');
    else if (id === 'network-matfors') announce('Matfors: 9 next-day parcels and the open inland road.');
    return;
  }

  if (state.shiftId === 'scanner-fever') {
    if (id === 'scanner' && state.stage === 'jam-diagnose') simulation.perform('inspect-scanner');
    else if (id === 'parcel') announce('Three promise groups are blocked before Scanner 2.');
    else inspectTerminalHotspot(id, state);
    return;
  }

  if (id === 'case-package' && state.stage === 'case-inspect') simulation.perform('inspect-case');
  else if (id === 'case-package') announce(`${state.caseData.parcelId}. Temperature is stable and the scan evidence is open below.`);
  else if (id.startsWith('network-')) announce('The recovery connection is visible in the regional network.');
}

function inspectTerminalHotspot(id, state) {
  audio.play('select');
  if (id === 'express-lane') announce(`Express A: ${Math.round(state.expressLoad)} percent load with ${state.expressCrew} crew.`);
  if (id === 'standard-lane') announce(`Standard B: ${Math.round(state.standardLoad)} percent load with ${state.standardCrew} crew.`);
  if (id === 'scanner') announce(state.scannerFixed ? 'Scanner 2 is calibrated and running.' : 'The scanner reads each parcel promise before the belts divide.');
  if (id === 'truck') announce(`Departure is scheduled for ${formatClock(state.departure)}.`);
}

function switchScene(scene, focusDeck = false, force = false) {
  const state = simulation.snapshot();
  if (!force && state.started && !state.availableScenes.includes(scene)) return;
  currentScene = scene;
  world.setMode(scene);
  const parcelId = state.caseData?.parcelId || 'SE-0428-771';
  const sceneLabels = {
    terminal: state.shiftId === 'scanner-fever' ? ['LIVE TERMINAL', 'Scanner hall'] : ['LIVE TERMINAL', 'Sundsvall'],
    network: state.shiftId === 'snow-window' ? ['WEATHER NETWORK', 'Mid Sweden'] : ['REGIONAL NETWORK', 'Mid Sweden'],
    case: ['PARCEL TRACE', parcelId]
  };
  [ui.sceneEyebrow.textContent, ui.sceneTitle.textContent] = sceneLabels[scene];
  $$('.scene-tab').forEach((button) => {
    if (button.dataset.scene === scene) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  updateSceneSummary(state);
  if (focusDeck) window.setTimeout(() => ui.commandDeck.focus({ preventScroll: true }), 80);
}

function updateSceneSummary(state) {
  let summary = '';
  if (currentScene === 'terminal') {
    if (state.shiftId === 'scanner-fever') {
      summary = `Sundsvall scanner hall. Scanner 2 is ${state.scannerFixed ? 'repaired' : state.scannerBypassed ? 'bypassed' : 'stopped'}. ${state.backlog} parcels remain in the queue.`;
    } else {
      summary = `Sundsvall terminal. Express A is at ${Math.round(state.expressLoad)} percent with ${state.expressCrew} crew. Standard B is at ${Math.round(state.standardLoad)} percent with ${state.standardCrew} crew.`;
    }
  } else if (currentScene === 'network') {
    summary = state.shiftId === 'snow-window'
      ? `Regional snow network. Härnösand has 14 urgent parcels, Timrå 26 standard parcels and Matfors 9 next-day parcels. ${state.routeChoice === 'inland' ? 'The selected truck is using the open inland route.' : 'The coast road is restricted.'}`
      : `Regional network. ${Math.round(state.risk)} promises are at risk. Sundsvall, Härnösand, Timrå and Matfors are available as structured locations.`;
  } else {
    summary = state.shiftId === 'priority-parcel'
      ? `Priority parcel ${state.caseData.parcelId}. ${state.caseData.evidence.join('. ')}.`
      : state.packageSelected
        ? `Parcel SE-0428-771. Planned for Express A, but routed to Standard B. ${state.signatureFound ? 'Twelve parcels share the same rule signature.' : ''}`
        : 'No parcel is selected.';
  }
  ui.sceneSummary.textContent = summary;
}

function detailMetric(label, value) {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function updateStructuredDetails(state) {
  $('#detailsTitle').textContent = `${activeShift.title} details`;
  const labels = activeShift.metricLabels;
  ui.detailMetrics.innerHTML = [
    detailMetric('Time', formatClock(state.time)),
    detailMetric(labels[0], `${Math.round(state.onTime)}%`),
    detailMetric(labels[1], Math.round(state.backlog)),
    detailMetric(labels[2], Math.round(state.risk))
  ].join('');

  if (state.shiftId === 'first-rounds') {
    $('#detailsIntro').textContent = state.completed ? state.outcome.summary : 'The guided shift introduces one consequential control at a time and does not run a deadline during instruction.';
    ui.detailScenario.innerHTML = `<section class="dialog-section"><h3>First-shift progress</h3><ol class="detail-checklist">
      <li data-done="${state.laneInspected}">Read the Express lane</li>
      <li data-done="${state.staffMoved}">Move spare crew</li>
      <li data-done="${state.scannerInspected}">Inspect the scanner</li>
      <li data-done="${state.verified >= 6}">Verify six parcels</li>
    </ol></section>`;
    return;
  }

  if (state.shiftId === 'northbound') {
    $('#detailsIntro').textContent = state.completed
      ? state.outcome.summary
      : state.ruleFixed
        ? `The Express rule is corrected. ${state.verified} of ${VERIFY_TARGET} later parcels have been verified.`
        : 'The Sundsvall to Härnösand Express connection is the highest-consequence issue.';
    ui.detailScenario.innerHTML = `<section class="dialog-section"><h3>Terminal lanes</h3><div class="table-wrap"><table>
      <thead><tr><th scope="col">Lane</th><th scope="col">Load</th><th scope="col">Crew</th><th scope="col">State</th></tr></thead>
      <tbody><tr><th scope="row">Express A</th><td>${Math.round(state.expressLoad)}%</td><td>${state.expressCrew}</td><td>${state.ruleFixed ? 'Correct flow' : state.staffMoved ? 'Recovering' : 'Overloaded'}</td></tr>
      <tr><th scope="row">Standard B</th><td>${Math.round(state.standardLoad)}%</td><td>${state.standardCrew}</td><td>${state.staffMoved ? 'Adequate' : 'Spare capacity'}</td></tr></tbody>
    </table></div></section><section class="dialog-section"><h3>Selected parcel</h3><p>${state.packageSelected ? 'SE-0428-771 was planned for Express A. At 17:32 it entered Standard B and required manual correction.' : 'No parcel selected.'}</p></section>`;
    return;
  }

  if (state.shiftId === 'snow-window') {
    $('#detailsIntro').textContent = state.completed ? state.outcome.summary : 'Snow restricts the coast road at 06:30. One spare truck can cover one departure group.';
    const checked = (id) => state.inspectedDepots.includes(id) ? 'Checked' : 'Not checked';
    ui.detailScenario.innerHTML = `<section class="dialog-section"><h3>Depot demand</h3><div class="table-wrap"><table>
      <thead><tr><th scope="col">Depot</th><th scope="col">Waiting</th><th scope="col">Promise</th><th scope="col">Read</th></tr></thead>
      <tbody><tr><th scope="row">Härnösand</th><td>14</td><td>Urgent · 07:00</td><td>${checked('harnosand')}</td></tr>
      <tr><th scope="row">Timrå</th><td>26</td><td>Standard</td><td>${checked('timra')}</td></tr>
      <tr><th scope="row">Matfors</th><td>9</td><td>Next day</td><td>${checked('matfors')}</td></tr></tbody>
    </table></div><p><strong>Allocation:</strong> ${state.allocation || 'Not chosen'}. <strong>Route:</strong> ${state.routeChoice || 'Not chosen'}.</p></section>`;
    return;
  }

  if (state.shiftId === 'scanner-fever') {
    $('#detailsIntro').textContent = state.completed ? state.outcome.summary : 'A crushed label blocks Scanner 2. Manual release order affects which promises retain their margin.';
    ui.detailScenario.innerHTML = `<section class="dialog-section"><h3>Waiting promise groups</h3><div class="table-wrap"><table>
      <thead><tr><th scope="col">Group</th><th scope="col">Promise</th><th scope="col">Release</th></tr></thead><tbody>
      ${state.triageQueue.map((parcel) => `<tr><th scope="row">${parcel.label}</th><td>${parcel.promise}</td><td>${state.triageOrder.includes(parcel.id) ? `#${state.triageOrder.indexOf(parcel.id) + 1}` : 'Waiting'}</td></tr>`).join('')}
      </tbody></table></div><p><strong>Recovery:</strong> ${state.scannerFixed ? 'Scanner repaired and calibrated' : state.scannerBypassed ? 'Manual bypass' : 'Not chosen'}.</p></section>`;
    return;
  }

  $('#detailsIntro').textContent = state.completed ? state.outcome.summary : `Temperature-controlled parcel ${state.caseData.parcelId} must arrive by ${formatClock(state.departure)}.`;
  ui.detailScenario.innerHTML = `<section class="dialog-section"><h3>Scan evidence</h3><ol class="detail-checklist">${state.caseData.evidence.map((item) => `<li>${item}</li>`).join('')}</ol>
    <p><strong>Chosen location:</strong> ${state.clueChoice || 'Not chosen'}. <strong>Recovery:</strong> ${state.recoveryChoice || 'Not chosen'}.</p></section>`;
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
  ui.nextShift.textContent = state.shiftId === 'first-rounds' ? 'Open shift board' : 'Choose next shift';
  ui.result.hidden = false;
  ui.gameShell.inert = true;
  ui.nextShift.focus({ preventScroll: true });
}

function renderCampaign() {
  const completedCount = SHIFT_CATALOG.filter((shift) => campaign.completed[shift.id]).length;
  ui.campaignProgress.textContent = completedCount === SHIFT_CATALOG.length
    ? 'All five shifts completed. Replay conditions still vary.'
    : `${SHIFT_CATALOG.length - completedCount} shifts remain · ${completedCount} completed`;
  ui.campaignStamp.textContent = `${completedCount}/${SHIFT_CATALOG.length}`;
  ui.shiftList.innerHTML = SHIFT_CATALOG.map((shift) => {
    const completion = campaign.completed[shift.id];
    const plays = campaign.plays[shift.id] || 0;
    return `<button class="shift-card" data-shift-id="${shift.id}" data-tone="${shift.tone}" type="button">
      <span class="shift-card-number" aria-hidden="true">${shift.number}</span>
      <span class="shift-card-copy"><span class="shift-card-kind">${shift.kind} · ${shift.duration}</span><strong>${shift.title}</strong><span>${shift.description}</span><small>${shift.mechanic}${plays > 1 ? ` · ${plays} runs` : ''}</small></span>
      <span class="shift-card-state">${completion ? `<strong>${completion.grade}</strong><span>Replay</span>` : '<strong>→</strong><span>Open</span>'}</span>
    </button>`;
  }).join('');
  ui.shiftList.querySelectorAll('[data-shift-id]').forEach((button) => {
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
  window.setTimeout(() => ui.shiftList.querySelector('button')?.focus({ preventScroll: true }), 80);
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
    switchScene(button.dataset.scene, false);
  });
});

document.addEventListener('keydown', (event) => {
  if (!simulation.state.started || simulation.state.completed || ui.detailsDialog.open) return;
  if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return;
  if (event.key.toLowerCase() === 'p') simulation.togglePaused();
  if (event.key === '1') switchScene('terminal');
  if (event.key === '2') switchScene('network');
  if (event.key === '3') switchScene('case');
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
  act: (action, value = null) => simulation.perform(action, value)
};

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
