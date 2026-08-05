import { ShiftSimulation, VERIFY_TARGET, formatClock } from './sim.mjs';
import { PostalWorld } from './world.mjs';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ui = {
  gameShell: $('#gameShell'),
  welcome: $('#welcomeScreen'),
  start: $('#startButton'),
  deckStart: $('#deckStartButton'),
  result: $('#resultScreen'),
  replay: $('#replayButton'),
  resultDetails: $('#resultDetailsButton'),
  pause: $('#pauseButton'),
  speed: $('#speedButton'),
  sound: $('#soundButton'),
  details: $('#detailsButton'),
  detailsDialog: $('#detailsDialog'),
  detailsClose: $('#detailsCloseButton'),
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
  toast: $('#toast'),
  live: $('#assertiveLive'),
  caseAlert: $('#caseAlert')
};

class GameAudio {
  constructor() {
    this.enabled = true;
    this.unlocked = false;
    this.sounds = {
      click: new Audio('./assets/audio/click1.ogg'),
      select: new Audio('./assets/audio/click3.ogg'),
      staff: new Audio('./assets/audio/switch7.ogg'),
      reveal: new Audio('./assets/audio/switch19.ogg'),
      success: new Audio('./assets/audio/switch28.ogg'),
      dispatch: new Audio('./assets/audio/switch3.ogg')
    };
    Object.values(this.sounds).forEach((audio) => {
      audio.preload = 'auto';
      audio.volume = 0.42;
    });
    this.sounds.success.volume = 0.6;
  }

  unlock() {
    this.unlocked = true;
    const click = this.sounds.click;
    click.volume = 0;
    click.play().then(() => {
      click.pause();
      click.currentTime = 0;
      click.volume = 0.42;
    }).catch(() => {});
  }

  play(name) {
    if (!this.enabled || !this.unlocked || !this.sounds[name]) return;
    const audio = this.sounds[name];
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

const audio = new GameAudio();
let currentScene = 'terminal';
let worldReady = false;
let commandRenderKey = '';
let toastTimer = 0;
let wasRunningBeforeDialog = false;
let resultTimer = 0;

const simulation = new ShiftSimulation(handleSimulationChange);
const world = new PostalWorld(ui.worldCanvas, ui.hotspotLayer, {
  onReady: () => {
    worldReady = true;
    ui.loading.hidden = true;
  },
  onHotspot: handleHotspot,
  onError: () => {
    ui.loading.innerHTML = '<span aria-hidden="true">!</span><span>3D view unavailable. The complete shift remains playable below.</span>';
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
  toastTimer = window.setTimeout(() => { ui.toast.hidden = true; }, 3000);
}

function handleSimulationChange(state, event) {
  renderShift(state);
  world.setState(state);
  if (!event || event.type === 'tick' || event.type === 'reset') return;

  const soundByEvent = {
    start: 'select',
    pause: 'click',
    resume: 'click',
    speed: 'click',
    staff: 'staff',
    hold: 'select',
    package: 'select',
    signature: 'reveal',
    rule: 'success',
    verified: 'success',
    complete: 'dispatch'
  };
  audio.play(soundByEvent[event.type]);

  const assertive = ['staff', 'package', 'signature', 'rule', 'verified', 'complete'].includes(event.type);
  if (event.message && event.type !== 'complete') announce(event.message, assertive);

  if (event.type === 'package') switchScene('case', true);
  if (event.type === 'signature') ui.caseAlert.hidden = true;
  if (event.type === 'complete') {
    ui.toast.hidden = true;
    ui.live.textContent = '';
    window.setTimeout(() => { ui.live.textContent = event.message; }, 20);
    window.clearTimeout(resultTimer);
    resultTimer = window.setTimeout(() => showResult(state.outcome), 1250);
  }
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

  const minutesLeft = Math.max(0, Math.ceil(state.departure - state.time));
  ui.missionTime.textContent = state.completed
    ? `DEPARTED ${formatClock(state.departure)}`
    : state.time < state.departure
      ? `DEPARTS ${formatClock(state.departure)} · ${minutesLeft} MIN`
      : `${Math.floor(state.time - state.departure) + 1} MIN LATE`;
  ui.missionLabel.textContent = state.ruleFixed ? 'NORTHBOUND · FLOW CORRECTED' : 'NORTHBOUND EXPRESS';
  ui.missionPill.dataset.state = state.ruleFixed ? 'good' : state.risk >= 20 || state.time >= state.departure ? 'danger' : 'warning';

  ui.riskMetric.dataset.level = state.risk <= 4 ? 'good' : state.risk >= 20 ? 'danger' : 'warning';
  ui.serviceMetric.dataset.level = state.onTime >= 96 ? 'good' : 'warning';

  ui.pause.disabled = !state.started || state.completed;
  ui.speed.disabled = !state.started || state.completed;
  $$('.scene-tab').forEach((button) => {
    if (!state.started || state.completed) {
      button.disabled = true;
    } else if (button.dataset.scene === 'case') {
      button.disabled = !state.packageSelected;
    } else {
      button.disabled = false;
    }
  });

  ui.caseAlert.hidden = state.packageSelected || state.stage !== 'investigate';
  updateStructuredDetails(state);
  updateSceneSummary(state);

  const nextKey = [state.stage, state.paused, state.verified, state.staffMoved, state.truckHeld, state.ruleFixed].join(':');
  if (nextKey !== commandRenderKey) {
    commandRenderKey = nextKey;
    renderCommand(state);
  }
}

function renderCommand(state) {
  const templates = {
    brief: () => `
      <div class="command-copy">
        <span class="command-kicker">SHIFT BRIEF</span>
        <h1 id="commandTitle">The northbound run needs you.</h1>
        <p>Watch the parcel flow, protect the departure and find out why blue Express parcels keep reaching the yellow lane.</p>
      </div>
      <div class="command-actions">
        <button class="game-button game-button--primary" type="button" data-action="start">Start shift</button>
      </div>`,
    protect: () => `
      <div class="command-copy">
        <span class="command-kicker">LIVE · EXPRESS A</span>
        <h1 id="commandTitle">The blue lane is filling fast.</h1>
        <p>Standard B has spare crew. Rebalance now, or buy three minutes by holding the truck and reduce the next transfer margin.</p>
      </div>
      <div class="command-actions">
        <button class="game-button game-button--blue" type="button" data-action="move-staff">Move 2 crew</button>
        <button class="game-button game-button--quiet" type="button" data-action="hold-truck">Hold truck · 3 min</button>
      </div>`,
    investigate: () => `
      <div class="command-copy">
        <span class="command-kicker">ANOMALY · STANDARD B</span>
        <h1 id="commandTitle">A blue parcel is in the yellow lane.</h1>
        <p>The queue is recovering, but this Express parcel took the same wrong turn as eleven earlier parcels.</p>
      </div>
      <div class="command-actions">
        <button class="game-button game-button--orange" type="button" data-action="trace-package">Trace the flashing parcel</button>
        ${state.staffMoved ? '' : '<button class="game-button game-button--quiet" type="button" data-action="move-staff">Also move 2 crew</button>'}
      </div>`,
    compare: () => `
      <div class="command-copy">
        <span class="command-kicker">PARCEL · SE-0428-771</span>
        <h1 id="commandTitle">Where did its journey diverge?</h1>
        <div class="route-comparison" aria-label="Planned and actual route">
          <div class="route-row"><strong>Planned</strong> Scan → <span>Express A</span> → 18:20</div>
          <div class="route-row route-row--wrong"><strong>Actual</strong> Scan → <span>Standard B</span> → correction</div>
        </div>
      </div>
      <div class="command-actions">
        <button class="game-button game-button--blue" type="button" data-action="find-similar">Light up matching parcels</button>
      </div>`,
    rule: () => `
      <div class="command-copy">
        <span class="command-kicker">ROOT CAUSE · 12 MATCHES</span>
        <h1 id="commandTitle">The fallback rule runs first.</h1>
        <p>All matches are north-zone Express parcels scanned after 17:30. Put the service promise ahead of the fallback.</p>
      </div>
      <div class="command-actions rule-stack" aria-label="Current routing rule order">
        <div class="rule-card"><span class="rule-order">1</span><span>North zone after 17:30</span></div>
        <button class="rule-card" type="button" data-action="fix-rule"><span class="rule-order">↑</span><span>Move <strong>Express service</strong> to first</span></button>
      </div>`,
    verify: () => `
      <div class="command-copy">
        <span class="command-kicker">VERIFY THE FIX</span>
        <h1 id="commandTitle">Watch the next twelve parcels.</h1>
        <p>${state.paused ? 'The shift paused after the rule change. Resume and make sure new parcels take the blue lane.' : 'New matching parcels are entering the scanner. No wrong turns so far.'}</p>
      </div>
      <div class="command-actions">
        <div class="mini-progress" aria-label="${state.verified} of ${VERIFY_TARGET} parcels verified">
          <div class="mini-progress-track"><span style="width:${(state.verified / VERIFY_TARGET) * 100}%"></span></div>
          <span class="mini-progress-label">${state.verified} / ${VERIFY_TARGET} CORRECT</span>
        </div>
        ${state.paused
          ? '<button class="game-button game-button--green" type="button" data-action="resume">Resume flow</button>'
          : '<button class="game-button game-button--blue" type="button" data-action="speed-up">Run at 2×</button>'}
      </div>`,
    dispatch: () => `
      <div class="command-copy">
        <span class="command-kicker">DEPARTURE READY</span>
        <h1 id="commandTitle">The flow is clean.</h1>
        <p>Twelve new parcels followed the corrected rule. Send the northbound truck and close the shift.</p>
      </div>
      <div class="command-actions">
        <button class="game-button game-button--green" type="button" data-action="dispatch">Send northbound</button>
      </div>`,
    complete: () => `
      <div class="command-copy">
        <span class="command-kicker">SHIFT COMPLETE</span>
        <h1 id="commandTitle">Northbound is on its way.</h1>
        <p>The shift report is ready.</p>
      </div>
      <div class="command-actions"><button class="game-button game-button--green" type="button" disabled>Promises kept</button></div>`
  };

  ui.commandContent.innerHTML = (templates[state.stage] || templates.brief)();
  ui.commandContent.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleAction(button.dataset.action));
  });
}

function handleAction(action) {
  audio.play('click');
  switch (action) {
    case 'start':
      beginShift();
      break;
    case 'move-staff':
      simulation.moveStaff();
      break;
    case 'hold-truck':
      simulation.holdTruck();
      break;
    case 'trace-package':
      simulation.selectPackage();
      break;
    case 'find-similar':
      simulation.findSimilar();
      break;
    case 'fix-rule':
      simulation.fixRule();
      break;
    case 'resume':
      simulation.setPaused(false);
      break;
    case 'speed-up':
      simulation.setSpeed(2);
      break;
    case 'dispatch':
      simulation.completeShift();
      break;
  }
}

function beginShift() {
  if (simulation.state.started) return;
  audio.unlock();
  audio.play('select');
  ui.welcome.hidden = true;
  ui.gameShell.inert = false;
  simulation.start();
  switchScene('terminal', false);
  ui.commandDeck.focus({ preventScroll: true });
}

function handleHotspot(id) {
  audio.play('select');
  const state = simulation.snapshot();
  switch (id) {
    case 'parcel':
      simulation.selectPackage();
      break;
    case 'case-package':
      if (!state.signatureFound) announce('The label says Express to Härnösand. Its event history shows a turn into Standard B at 17:32.');
      break;
    case 'case-similar':
      announce('Twelve matching parcels: Express, north zone, scanned after 17:30.');
      break;
    case 'express-lane':
      announce(`Express A: ${Math.round(state.expressLoad)} percent load with ${state.expressCrew} crew. ${state.ruleFixed ? 'Flow is correct.' : 'Blue service markers belong here.'}`);
      break;
    case 'standard-lane':
      announce(`Standard B: ${Math.round(state.standardLoad)} percent load with ${state.standardCrew} crew. ${state.packageSelected ? 'The selected Express parcel should not be here.' : 'Spare capacity is available.'}`);
      break;
    case 'truck':
      announce(`Northbound truck departs ${formatClock(state.departure)}. ${Math.max(0, Math.ceil(state.departure - state.time))} minutes remain.`);
      break;
    case 'network-sundsvall':
      switchScene('terminal', false);
      announce('Sundsvall terminal selected. This is the source of the northbound pressure.');
      break;
    case 'network-harnosand':
      announce('Härnösand is waiting for the northbound Express connection. Eighteen parcel promises depend on it.');
      break;
    case 'network-timra':
      announce('Timrå depot is stable.');
      break;
    case 'network-matfors':
      announce('Matfors depot is stable.');
      break;
  }
}

function switchScene(scene, focusDeck = false) {
  currentScene = scene;
  world.setMode(scene);
  const labels = {
    terminal: ['LIVE TERMINAL', 'Sundsvall'],
    network: ['REGIONAL NETWORK', 'Mid Sweden'],
    case: ['PARCEL TRACE', 'SE-0428-771']
  };
  [ui.sceneEyebrow.textContent, ui.sceneTitle.textContent] = labels[scene];
  $$('.scene-tab').forEach((button) => {
    if (button.dataset.scene === scene) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  updateSceneSummary(simulation.snapshot());
  if (focusDeck) window.setTimeout(() => ui.commandDeck.focus({ preventScroll: true }), 80);
}

function updateSceneSummary(state) {
  const summaries = {
    terminal: `Sundsvall terminal. Express lane A is at ${Math.round(state.expressLoad)} percent load with ${state.expressCrew} crew. Standard lane B is at ${Math.round(state.standardLoad)} percent with ${state.standardCrew} crew. ${state.ruleFixed ? 'The routing rule has been corrected.' : 'Express parcels scanned after 17:30 can be misrouted to Standard B.'}`,
    network: `Regional network. Sundsvall to Härnösand is the highest-consequence route, with ${Math.round(state.risk)} parcels at risk. Timrå and Matfors are stable.`,
    case: state.packageSelected
      ? `Parcel SE-0428-771. Planned route: inbound scan, Express A, 18:20 northbound. Actual route: inbound scan, Standard B, manual correction, Express A. ${state.signatureFound ? 'Twelve similar parcels share the same rule signature.' : ''}`
      : 'No parcel is selected.'
  };
  ui.sceneSummary.textContent = summaries[currentScene];
}

function updateStructuredDetails(state) {
  $('#detailTime').textContent = formatClock(state.time);
  $('#detailService').textContent = `${Math.round(state.onTime)}%`;
  $('#detailRisk').textContent = `${Math.round(state.risk)} parcels`;
  $('#detailDeparture').textContent = formatClock(state.departure);
  $('#detailExpressLoad').textContent = `${Math.round(state.expressLoad)}%`;
  $('#detailExpressCrew').textContent = state.expressCrew;
  $('#detailExpressState').textContent = state.ruleFixed ? 'Recovering · correct flow' : state.staffMoved ? 'Recovering · routing fault remains' : 'Overloaded';
  $('#detailStandardLoad').textContent = `${Math.round(state.standardLoad)}%`;
  $('#detailStandardCrew').textContent = state.standardCrew;
  $('#detailStandardState').textContent = state.staffMoved ? 'Adequate' : 'Spare capacity';
  $('#detailsIntro').textContent = state.completed
    ? state.outcome.summary
    : state.ruleFixed
      ? `The Express rule is corrected. ${state.verified} of ${VERIFY_TARGET} new matching parcels have been verified.`
      : 'The Sundsvall to Härnösand Express connection is the highest-consequence issue in the network.';
  $('#detailCase').textContent = !state.packageSelected
    ? 'No parcel selected. Blue floor markers identify Express service; yellow markers identify Standard service.'
    : state.signatureFound
      ? 'SE-0428-771 is one of twelve Express parcels for the north zone scanned after 17:30. The fallback rule was evaluated before the Express service rule.'
      : 'SE-0428-771 was planned for Express A and the 18:20 northbound departure. At 17:32 it entered Standard B, then required a six-minute manual correction.';
}

function openDetails() {
  const state = simulation.snapshot();
  wasRunningBeforeDialog = state.started && !state.paused && !state.completed;
  if (wasRunningBeforeDialog) simulation.setPaused(true);
  ui.detailsDialog.showModal();
}

function closeDetails() {
  ui.detailsDialog.close();
  if (wasRunningBeforeDialog && !simulation.state.completed) simulation.setPaused(false);
  wasRunningBeforeDialog = false;
}

function showResult(outcome) {
  if (!outcome) return;
  $('#resultGrade').textContent = outcome.grade;
  $('#resultGrade').setAttribute('aria-label', `Grade ${outcome.grade}`);
  $('#resultSummary').textContent = outcome.summary;
  $('#resultSaved').textContent = outcome.saved;
  $('#resultOnTime').textContent = `${outcome.onTime}%`;
  $('#resultScore').textContent = outcome.score.toLocaleString('en-SE');
  $('#resultMedals').innerHTML = outcome.medals
    .map((medal) => `<span class="result-medal"><span aria-hidden="true">${medal.icon}</span>${medal.label}</span>`)
    .join('');
  ui.result.hidden = false;
  ui.gameShell.inert = true;
  ui.replay.focus({ preventScroll: true });
}

ui.start.addEventListener('click', beginShift);
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
ui.replay.addEventListener('click', () => location.reload());

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
  if (event.key === '3' && simulation.state.packageSelected) switchScene('case');
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && simulation.state.started && !simulation.state.paused && !simulation.state.completed) {
    simulation.setPaused(true);
  }
});

window.setInterval(() => simulation.tick(0.1), 100);
ui.gameShell.inert = true;
renderShift(simulation.snapshot());
switchScene('terminal', false);
window.setTimeout(() => ui.start.focus({ preventScroll: true }), 120);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
