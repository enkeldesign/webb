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

function installUi() {
  const game = window.__POSTAL_GAME__;
  if (!game) {
    window.setTimeout(installUi, 40);
    return;
  }

  const operationLayer = $('#operationLayer');
  const operationHead = operationLayer?.querySelector('.operation-head');
  const parcelRack = $('#parcelRack');
  const result = $('#resultScreen');
  const nextShift = $('#nextShiftButton');
  const hudControls = $('.hud-controls');
  if (!operationLayer || !operationHead || !parcelRack || !result || !nextShift || !hudControls) return;

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
  parcelRack.before(planner);

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

  function syncResultActions() {
    if (result.hidden) return;
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
    if (!available) plannerOpen = false;
    planToggle.textContent = planLabel(level);
    planToggle.setAttribute('aria-expanded', String(plannerOpen && available));
    planner.hidden = !plannerOpen || !available;

    const key = JSON.stringify([level, plannerOpen, resources]);
    if (!force && key === plannerKey) return;
    plannerKey = key;
    if (planner.hidden) {
      planner.innerHTML = '';
      return;
    }

    planner.innerHTML = `<div class="resource-planner-head"><div><span>LIVE RESOURCE PLAN</span><strong>${planLabel(level).replace('Plan ', '')}</strong></div><p>Tap a resource to move it to the next lane or route. Matching work runs faster.</p></div><div class="resource-roster">${resources.map((resource) => {
      const status = resource.busy ? `${resource.busyCarrierCode} moving` : 'Ready';
      const aria = `${resource.name}. Assigned to ${resource.assignmentLabel}. ${status}. Tap to change assignment.`;
      return `<button class="resource-card" type="button" data-resource-id="${resource.id}" data-busy="${resource.busy}" aria-label="${aria}">
        <span class="resource-card-icon" aria-hidden="true">${resourceIcon(resource)}</span>
        <span class="resource-card-copy"><strong>${resource.id}</strong><span>${resource.assignmentLabel}</span><small>${status}</small></span>
        <span class="resource-card-cycle" aria-hidden="true">↻</span>
      </button>`;
    }).join('')}</div>`;

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

  planToggle.addEventListener('click', () => {
    plannerOpen = !plannerOpen;
    renderPlanner(true);
    if (plannerOpen) planner.querySelector('button')?.focus({ preventScroll: true });
  });

  boardButton.addEventListener('click', () => {
    const state = game.getState();
    if (state.canRun && !state.paused && !state.completed) $('#pauseButton')?.click();
    nextShift.click();
  });

  continueButton.addEventListener('click', () => {
    if (!game.act('continue-operations')) return;
    result.hidden = true;
    $('#gameShell').inert = false;
    plannerOpen = true;
    renderPlanner(true);
    announce('Shift report closed. The network is still live and a new wave is arriving.');
    window.setTimeout(() => planToggle.focus({ preventScroll: true }), 40);
  });

  document.addEventListener('postal-resource-activate', (event) => {
    const resourceId = event.detail?.resourceId;
    if (!resourceId || !game.act('cycle-resource', resourceId)) return;
    plannerOpen = true;
    renderPlanner(true);
    const resource = game.getState().resources.find((item) => item.id === resourceId);
    announce(`${resource.name} assigned to ${resource.assignmentLabel}.`);
  });

  const resultObserver = new MutationObserver(syncResultActions);
  resultObserver.observe(result, { attributes: true, attributeFilter: ['hidden'] });
  document.querySelectorAll('.scene-tab').forEach((button) => button.addEventListener('click', () => renderPlanner(true)));
  window.setInterval(() => {
    renderPlanner();
    syncResultActions();
  }, 200);
  renderPlanner(true);
}

installUi();
