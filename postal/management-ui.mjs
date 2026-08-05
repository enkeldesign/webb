import './management-sim.mjs';
import { PostalWorld } from './world.mjs';

const WORLD_PATCH = Symbol.for('postal.resourceWorldPatch');

function dispatchResource(resourceId) {
  document.dispatchEvent(new CustomEvent('postal-resource-activate', { detail: { resourceId } }));
}

function wrapWorldHotspotCallback(world) {
  if (world.__postalResourceCallbackWrapped) return;
  world.__postalResourceCallbackWrapped = true;
  const original = world.callbacks.onHotspot;
  world.callbacks.onHotspot = (id) => {
    if (String(id).startsWith('resource-')) {
      dispatchResource(String(id).replace('resource-', ''));
      return;
    }
    original?.(id);
  };
}

function ensureTruckHotspots(world, level, trucks, prefix, group, label) {
  if (!trucks?.length || !group) return;
  wrapWorldHotspotCallback(world);
  const resourceCount = (world.state.resources || []).filter((resource) => resource.level === level).length;
  trucks.slice(0, resourceCount).forEach((truck, index) => {
    const shortId = `${prefix}${index + 1}`;
    const hotspotId = `resource-${shortId}`;
    if (!truck.userData.postalResourceHotspot) {
      truck.userData.postalResourceHotspot = hotspotId;
      world.markInteractive(truck, hotspotId);
      world.registerHotspot(hotspotId, `${label} ${shortId}`, '▰', 'good', group, truck.position.clone());
      world.hotspotStateKey = '';
      world.updateHotspotVisibility();
    }
    const hotspot = world.hotspots.get(hotspotId);
    if (hotspot) {
      hotspot.anchor.position.copy(truck.position);
      hotspot.anchor.position.y += 1.05;
    }
    truck.visible = world.state.started && !world.state.completed && world.state.shiftId !== 'first-rounds';
  });
}

function patchWorld() {
  const prototype = PostalWorld.prototype;
  if (prototype[WORLD_PATCH]) return;
  Object.defineProperty(prototype, WORLD_PATCH, { value: true });
  const originalNetwork = prototype.updateNetwork;
  const originalSweden = prototype.updateSweden;

  prototype.updateNetwork = function updateNetworkWithInteractiveTrucks(delta) {
    originalNetwork.call(this, delta);
    ensureTruckHotspots(this, 'network', this.networkTrucks, 'R', this.networkGroup, 'Regional truck');
  };

  prototype.updateSweden = function updateSwedenWithInteractiveLinehauls(delta) {
    originalSweden.call(this, delta);
    ensureTruckHotspots(this, 'sweden', this.swedenTrucks, 'S', this.swedenGroup, 'Linehaul');
  };
}

patchWorld();

const $ = (selector) => document.querySelector(selector);
let plannerOpen = false;
let plannerKey = '';
let investigationJobId = null;
let investigationPreviousLevel = 'terminal';
let investigationWasRunning = false;

function announce(message) {
  const live = $('#politeLive');
  if (!live) return;
  live.textContent = '';
  window.setTimeout(() => { live.textContent = message; }, 20);
}

function currentLevel() {
  return $('.scene-tab[aria-current="page"]')?.dataset.scene || 'terminal';
}

function planLabel(level) {
  if (level === 'terminal') return 'Plan teams';
  if (level === 'network') return 'Plan trucks';
  return 'Plan linehauls';
}

function resourceIcon(resource) {
  return resource.level === 'terminal' ? '●' : '▰';
}

function suspiciousJob(state) {
  return state.jobs
    .filter((job) => ['waiting', 'queued'].includes(job.status))
    .sort((a, b) => (a.deadline - state.elapsed) - (b.deadline - state.elapsed))[0] || null;
}

function installUi() {
  const game = window.__POSTAL_GAME__;
  if (!game) {
    window.setTimeout(installUi, 40);
    return;
  }

  const operationLayer = $('#operationLayer');
  const operationHead = operationLayer?.querySelector('.operation-head');
  const result = $('#resultScreen');
  const nextShift = $('#nextShiftButton');
  const hudControls = $('.hud-controls');
  const gameShell = $('#gameShell');
  if (!operationLayer || !operationHead || !result || !nextShift || !hudControls || !gameShell) return;

  const planToggle = document.createElement('button');
  planToggle.type = 'button';
  planToggle.className = 'resource-plan-toggle';
  planToggle.id = 'resourcePlanToggle';
  planToggle.setAttribute('aria-expanded', 'false');
  planToggle.setAttribute('aria-controls', 'resourcePlanner');
  planToggle.textContent = 'Plan resources';
  operationHead.append(planToggle);

  const planner = document.createElement('section');
  planner.className = 'resource-planner';
  planner.id = 'resourcePlanner';
  planner.setAttribute('aria-label', 'Resource assignments');
  planner.hidden = true;
  document.body.append(planner);

  const communicationRail = document.createElement('section');
  communicationRail.className = 'communication-rail';
  communicationRail.id = 'communicationRail';
  communicationRail.setAttribute('aria-label', 'Operations communication');
  communicationRail.innerHTML = '<span class="communication-rail-label">OPERATIONS</span><strong id="communicationRailText">Select a package batch to begin.</strong>';
  gameShell.append(communicationRail);

  const investigateButton = document.createElement('button');
  investigateButton.type = 'button';
  investigateButton.className = 'investigate-button';
  investigateButton.id = 'investigatePackageButton';
  investigateButton.textContent = 'Inspect package';
  communicationRail.append(investigateButton);

  const investigation = document.createElement('section');
  investigation.className = 'package-investigation';
  investigation.id = 'packageInvestigation';
  investigation.hidden = true;
  investigation.setAttribute('aria-labelledby', 'investigationTitle');
  investigation.innerHTML = '<div class="investigation-head"><div><span>PACKAGE INVESTIGATION</span><strong id="investigationTitle">Trace package</strong></div><button type="button" class="investigation-close" id="investigationClose" aria-label="Close package investigation">×</button></div><div class="investigation-body" id="investigationBody"></div>';
  document.body.append(investigation);

  const boardButton = document.createElement('button');
  boardButton.type = 'button';
  boardButton.className = 'icon-button management-board-button';
  boardButton.id = 'shiftBoardButton';
  boardButton.setAttribute('aria-label', 'Open shift board');
  boardButton.innerHTML = '<span aria-hidden="true">↩</span>';
  hudControls.insertBefore(boardButton, $('#detailsButton'));

  const continueButton = document.createElement('button');
  continueButton.type = 'button';
  continueButton.className = 'game-button game-button--primary';
  continueButton.id = 'continueOperationsButton';
  continueButton.textContent = 'Keep operating';
  nextShift.before(continueButton);

  function closePlanner({ restoreFocus = false } = {}) {
    plannerOpen = false;
    planner.hidden = true;
    planner.innerHTML = '';
    planToggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) planToggle.focus({ preventScroll: true });
  }

  function syncResultActions() {
    if (result.hidden) return;
    closePlanner();
    closeInvestigation();
    const state = game.getState();
    const liveShift = state.shiftId !== 'first-rounds';
    continueButton.hidden = !liveShift;
    nextShift.textContent = state.shiftId === 'first-rounds' ? 'Open shift board' : 'Choose another shift';
    nextShift.classList.toggle('game-button--primary', !liveShift);
    nextShift.classList.toggle('game-button--quiet', liveShift);
  }

  function renderPlanner(force = false) {
    const state = game.getState();
    const level = currentLevel();
    const resources = (state.resources || []).filter((resource) => resource.level === level);
    const available = state.started && !state.completed && state.shiftId !== 'first-rounds' && resources.length > 0;
    planToggle.hidden = !available;
    boardButton.hidden = !state.started;
    if (!available) closePlanner();
    planToggle.textContent = planLabel(level);
    planToggle.setAttribute('aria-expanded', String(plannerOpen && available));
    planner.hidden = !plannerOpen || !available;

    const key = JSON.stringify([level, plannerOpen, resources]);
    if (!force && key === plannerKey) return;
    plannerKey = key;
    if (planner.hidden) return;

    planner.innerHTML = `<div class="resource-planner-head"><div><span>LIVE RESOURCE PLAN</span><strong>${planLabel(level).replace('Plan ', '')}</strong></div><button type="button" class="planner-close" aria-label="Close resource planner">×</button></div><p class="resource-planner-help">Tap a resource to move it to the next lane or route. Matching work runs faster.</p><div class="resource-roster">${resources.map((resource) => {
      const status = resource.busy ? `${resource.busyCarrierCode} moving` : 'Ready';
      const aria = `${resource.name}. Assigned to ${resource.assignmentLabel}. ${status}. Tap to change assignment.`;
      return `<button class="resource-card" type="button" data-resource-id="${resource.id}" data-busy="${resource.busy}" aria-label="${aria}"><span class="resource-card-icon" aria-hidden="true">${resourceIcon(resource)}</span><span class="resource-card-copy"><strong>${resource.id}</strong><span>${resource.assignmentLabel}</span><small>${status}</small></span><span class="resource-card-cycle" aria-hidden="true">↻</span></button>`;
    }).join('')}</div>`;

    planner.querySelector('.planner-close')?.addEventListener('click', () => closePlanner({ restoreFocus: true }));
    planner.querySelectorAll('[data-resource-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const before = game.getState().resources.find((resource) => resource.id === button.dataset.resourceId);
        if (!game.act('cycle-resource', button.dataset.resourceId)) return;
        const after = game.getState().resources.find((resource) => resource.id === button.dataset.resourceId);
        announce(`${after.name} moved from ${before.assignmentLabel} to ${after.assignmentLabel}.`);
        renderPlanner(true);
      });
    });
  }

  function renderCommunication() {
    const state = game.getState();
    const selected = state.selectedJob;
    const incident = state.incidents.find((item) => item.active);
    const atRisk = state.jobs.filter((job) => ['waiting', 'queued'].includes(job.status) && job.deadline - state.elapsed <= 14).length;
    const text = selected
      ? `${selected.carrierCode} package batch selected for ${selected.destinationName}.`
      : incident
        ? `${incident.label} needs attention in ${incident.level === 'terminal' ? 'Depot' : incident.level === 'network' ? 'Region' : 'Sweden'}.`
        : atRisk
          ? `${atRisk} package batch${atRisk === 1 ? '' : 'es'} close to deadline.`
          : state.overtime
            ? `Overtime wave ${state.overtimeWave}. ${state.backlog} package batches active.`
            : `${state.backlog} package batches active across the network.`;
    $('#communicationRailText').textContent = text;
    const suspect = suspiciousJob(state);
    investigateButton.hidden = !suspect || state.shiftId === 'first-rounds' || state.completed;
    investigateButton.dataset.jobId = suspect?.id || '';
  }

  function renderInvestigation() {
    const state = game.getState();
    const job = state.jobs.find((item) => item.id === investigationJobId);
    if (!job) {
      closeInvestigation();
      return;
    }
    const history = job.history.length ? job.history : [`${job.carrierCode} package entered ${job.stage}.`];
    const issue = job.deadline - state.elapsed <= 10
      ? 'The package is close to its deadline.'
      : job.status === 'queued'
        ? 'The package is waiting behind other work.'
        : 'The route history needs verification.';
    $('#investigationTitle').textContent = `${job.id} · ${job.destinationCode}`;
    $('#investigationBody').innerHTML = `<div class="investigation-summary"><span class="investigation-package" aria-hidden="true">□</span><div><strong>${job.carrierName} package</strong><span>${job.units} parcels · ${job.destinationName}</span><small>${issue}</small></div></div><ol class="investigation-history">${history.map((entry) => `<li>${entry}</li>`).join('')}</ol><div class="investigation-evidence"><span>Evidence</span><ul><li>Carrier label: ${job.carrierCode}</li><li>Destination code: ${job.destinationCode}</li><li>Current route mark: ${job.target || 'not assigned'}</li></ul></div><button type="button" class="game-button game-button--primary" id="investigationCorrect">Prioritise correct route</button>`;
    $('#investigationCorrect')?.addEventListener('click', () => {
      closeInvestigation();
      if (job.status === 'waiting') game.act('select-job', job.id);
      announce(`${job.id} selected. Send it to ${job.target || job.destinationName}.`);
    });
  }

  function openInvestigation(jobId) {
    const state = game.getState();
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job) return;
    closePlanner();
    investigationJobId = job.id;
    investigationPreviousLevel = currentLevel();
    investigationWasRunning = state.canRun && !state.paused && !state.completed;
    if (investigationWasRunning) $('#pauseButton')?.click();
    investigation.hidden = false;
    gameShell.dataset.investigating = 'true';
    document.querySelectorAll('.scene-tab').forEach((button) => { button.disabled = true; });
    const world = window.__POSTAL_WORLD__;
    world?.setMode?.('case');
    renderInvestigation();
    $('#investigationClose')?.focus({ preventScroll: true });
  }

  function closeInvestigation() {
    if (investigation.hidden) return;
    investigation.hidden = true;
    investigationJobId = null;
    delete gameShell.dataset.investigating;
    const world = window.__POSTAL_WORLD__;
    world?.setMode?.(investigationPreviousLevel);
    const state = game.getState();
    document.querySelectorAll('.scene-tab').forEach((button) => {
      button.disabled = !state.started || state.completed || !state.availableScenes.includes(button.dataset.scene);
    });
    if (investigationWasRunning && state.paused && !state.completed) $('#pauseButton')?.click();
    investigationWasRunning = false;
  }

  planToggle.addEventListener('click', () => {
    plannerOpen = !plannerOpen;
    renderPlanner(true);
    if (plannerOpen) planner.querySelector('button')?.focus({ preventScroll: true });
  });

  boardButton.addEventListener('click', () => {
    closePlanner();
    closeInvestigation();
    const state = game.getState();
    if (state.canRun && !state.paused && !state.completed) $('#pauseButton')?.click();
    nextShift.click();
  });

  continueButton.addEventListener('click', () => {
    if (!game.act('continue-operations')) return;
    result.hidden = true;
    gameShell.inert = false;
    closePlanner();
    announce('Shift report closed. The network is still live and a new package wave is arriving.');
    window.setTimeout(() => planToggle.focus({ preventScroll: true }), 40);
  });

  investigateButton.addEventListener('click', () => openInvestigation(investigateButton.dataset.jobId));
  $('#investigationClose')?.addEventListener('click', closeInvestigation);

  document.addEventListener('postal-resource-activate', (event) => {
    const resourceId = event.detail?.resourceId;
    if (!resourceId || !game.act('cycle-resource', resourceId)) return;
    closePlanner();
    const resource = game.getState().resources.find((item) => item.id === resourceId);
    announce(`${resource.name} assigned to ${resource.assignmentLabel}.`);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!investigation.hidden) closeInvestigation();
    else if (plannerOpen) closePlanner({ restoreFocus: true });
  });

  const resultObserver = new MutationObserver(syncResultActions);
  resultObserver.observe(result, { attributes: true, attributeFilter: ['hidden'] });
  document.querySelectorAll('.scene-tab').forEach((button) => button.addEventListener('click', () => {
    closePlanner();
    renderPlanner(true);
  }));
  window.setInterval(() => {
    renderPlanner();
    renderCommunication();
    if (!investigation.hidden) renderInvestigation();
    syncResultActions();
  }, 200);
  renderPlanner(true);
  renderCommunication();
}

installUi();
