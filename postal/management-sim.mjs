import { ShiftSimulation } from './sim.mjs';

const PATCH_FLAG = Symbol.for('postal.resourceManagementPatch');

export const RESOURCE_TARGETS = Object.freeze({
  terminal: Object.freeze([
    ['any', 'Flexible'],
    ['express-lane', 'Express A'],
    ['standard-lane', 'Standard B']
  ]),
  network: Object.freeze([
    ['any', 'Any regional route'],
    ['network-harnosand', 'Härnösand'],
    ['network-timra', 'Timrå'],
    ['network-matfors', 'Matfors'],
    ['network-sundsvall', 'National gate']
  ]),
  sweden: Object.freeze([
    ['any', 'Any national route'],
    ['sweden-stockholm', 'Stockholm'],
    ['sweden-gothenburg', 'Gothenburg']
  ])
});

const RESOURCE_PREFIX = Object.freeze({ terminal: 'T', network: 'R', sweden: 'S' });
const RESOURCE_KIND = Object.freeze({ terminal: 'team', network: 'truck', sweden: 'linehaul' });
const RESOURCE_NAME = Object.freeze({ terminal: 'Sort team', network: 'Regional truck', sweden: 'Linehaul' });

function assignmentLabel(level, assignment) {
  return RESOURCE_TARGETS[level]?.find(([id]) => id === assignment)?.[1] || 'Flexible';
}

function ensureResources(simulation) {
  if (Array.isArray(simulation.state.resources)) return simulation.state.resources;
  const resources = [];
  for (const level of ['terminal', 'network', 'sweden']) {
    const count = simulation.state.capacity[level] || 0;
    for (let index = 0; index < count; index += 1) {
      const shortId = `${RESOURCE_PREFIX[level]}${index + 1}`;
      resources.push({
        id: shortId,
        hotspotId: `resource-${shortId}`,
        level,
        kind: RESOURCE_KIND[level],
        name: `${RESOURCE_NAME[level]} ${index + 1}`,
        assignment: 'any'
      });
    }
  }
  simulation.state.resources = resources;
  simulation.state.overtime = false;
  simulation.state.overtimeWave = 0;
  simulation.state.nextOvertimeWaveAt = null;
  simulation.state.lastOutcome = null;
  return resources;
}

function resourceBusyJob(simulation, resourceId) {
  return simulation.state.jobs.find((job) => job.status === 'processing' && job.resourceId === resourceId) || null;
}

function chooseResource(simulation, job) {
  const busy = new Set(simulation.state.jobs
    .filter((item) => item.status === 'processing' && item.resourceId)
    .map((item) => item.resourceId));
  const available = ensureResources(simulation)
    .filter((resource) => resource.level === job.stage && !busy.has(resource.id));
  return available.find((resource) => resource.assignment === job.target)
    || available.find((resource) => resource.assignment === 'any')
    || available[0]
    || null;
}

function buildOvertimeJob(simulation, template, index, scheduledAt) {
  const wave = simulation.state.overtimeWave;
  const path = [...template.path];
  const originalPromise = Math.max(
    32,
    Math.min(110, Number(template.deadline - template.scheduledAt) || simulation.shift.promiseSeconds || 60)
  );
  const pressure = Math.min(12, wave * 1.5);
  const deadline = scheduledAt + Math.max(28, originalPromise - pressure);
  const serial = String(simulation.state.jobs.length + index + 1).padStart(3, '0');
  return {
    ...template,
    id: `${template.carrierCode}-OT${wave}-${serial}`,
    path,
    pathIndex: 0,
    stage: path[0],
    target: '',
    scheduledAt,
    arrivedAt: null,
    deadline,
    status: 'scheduled',
    startedAt: null,
    completesAt: null,
    queueOrder: null,
    deliveredAt: null,
    late: false,
    missed: false,
    resourceId: null,
    history: []
  };
}

function addOvertimeWave(simulation, count = 0) {
  const baseCount = Math.max(1, simulation.shift.jobs || simulation.state.jobs.length);
  const templates = simulation.state.jobs.slice(0, baseCount);
  if (!templates.length) return 0;
  simulation.state.overtimeWave += 1;
  const totalResources = Object.values(simulation.state.capacity).reduce((sum, value) => sum + value, 0);
  const waveSize = count || Math.max(6, Math.min(12, totalResources * 2));
  const spacing = Math.max(3.2, (simulation.shift.spawnEvery || 5) * 0.82);
  const firstArrival = simulation.state.elapsed + 1.25;
  const jobs = Array.from({ length: waveSize }, (_, index) => {
    const templateIndex = (index + simulation.state.overtimeWave * 3 + simulation.variant) % templates.length;
    return buildOvertimeJob(simulation, templates[templateIndex], index, firstArrival + index * spacing);
  });
  simulation.state.jobs.push(...jobs);
  simulation.state.nextOvertimeWaveAt = jobs.at(-1).scheduledAt + Math.max(7, spacing * 1.5);
  return jobs.length;
}

function continueOperations(simulation) {
  ensureResources(simulation);
  if (!simulation.state.completed || simulation.shiftId === 'first-rounds') return false;
  simulation.state.lastOutcome = simulation.state.outcome;
  simulation.state.outcome = null;
  simulation.state.completed = false;
  simulation.state.paused = false;
  simulation.state.stage = 'overtime';
  simulation.state.overtime = true;
  simulation.state.selectedJobId = null;
  addOvertimeWave(simulation);
  simulation.emit('resume', 'Shift report closed. Live overtime continues.');
  return true;
}

function cycleResource(simulation, resourceId) {
  const resource = ensureResources(simulation).find((item) => item.id === resourceId || item.hotspotId === resourceId);
  if (!resource || simulation.shiftId === 'first-rounds' || !simulation.state.started || simulation.state.completed) return false;
  const options = RESOURCE_TARGETS[resource.level] || RESOURCE_TARGETS.terminal;
  const currentIndex = Math.max(0, options.findIndex(([id]) => id === resource.assignment));
  resource.assignment = options[(currentIndex + 1) % options.length][0];
  const busyJob = resourceBusyJob(simulation, resource.id);
  const timing = busyJob ? ' after its current run' : '';
  simulation.emit(
    'plan',
    `${resource.name} assigned to ${assignmentLabel(resource.level, resource.assignment)}${timing}.`,
    { resourceId: resource.id, level: resource.level, assignment: resource.assignment }
  );
  return true;
}

function resourceSnapshot(simulation) {
  return ensureResources(simulation).map((resource) => {
    const job = resourceBusyJob(simulation, resource.id);
    return {
      ...resource,
      assignmentLabel: assignmentLabel(resource.level, resource.assignment),
      busy: Boolean(job),
      busyJobId: job?.id || null,
      busyCarrierCode: job?.carrierCode || null,
      busyTarget: job?.target || null
    };
  });
}

function installPatch() {
  const prototype = ShiftSimulation.prototype;
  if (prototype[PATCH_FLAG]) return;
  Object.defineProperty(prototype, PATCH_FLAG, { value: true });

  const originalSnapshot = prototype.snapshot;
  const originalPerform = prototype.perform;
  const originalStartProcessing = prototype.startProcessing;
  const originalProcessingDuration = prototype.processingDuration;
  const originalShouldFinish = prototype.shouldFinish;
  const originalEnforceHardStop = prototype.enforceHardStop;
  const originalTick = prototype.tick;
  const originalReset = prototype.reset;

  prototype.snapshot = function snapshotWithResources() {
    ensureResources(this);
    const snapshot = originalSnapshot.call(this);
    const resources = resourceSnapshot(this);
    const activeResourceHotspots = snapshot.started && !snapshot.completed && snapshot.shiftId !== 'first-rounds'
      ? resources.filter((resource) => resource.level !== 'terminal').map((resource) => resource.hotspotId)
      : [];
    const hotspotLabels = { ...snapshot.hotspotLabels };
    const hotspotTones = { ...snapshot.hotspotTones };
    const hotspotIcons = { ...snapshot.hotspotIcons };
    for (const resource of resources) {
      hotspotLabels[resource.hotspotId] = `${resource.id} · ${resource.assignmentLabel}${resource.busy ? ` · ${resource.busyCarrierCode}` : ' · ready'}`;
      hotspotTones[resource.hotspotId] = resource.busy ? 'orange' : 'good';
      hotspotIcons[resource.hotspotId] = '▰';
    }
    return {
      ...snapshot,
      overtime: Boolean(this.state.overtime),
      overtimeWave: this.state.overtimeWave || 0,
      resources,
      activeHotspots: [...new Set([...snapshot.activeHotspots, ...activeResourceHotspots])],
      hotspotLabels,
      hotspotTones,
      hotspotIcons
    };
  };

  prototype.perform = function performWithManagement(action, value = null) {
    ensureResources(this);
    if (action === 'cycle-resource') return cycleResource(this, value);
    if (action === 'continue-operations') return continueOperations(this);
    return originalPerform.call(this, action, value);
  };

  prototype.startProcessing = function startProcessingWithResource(job) {
    ensureResources(this);
    const resource = chooseResource(this, job);
    job.resourceId = resource?.id || null;
    return originalStartProcessing.call(this, job);
  };

  prototype.processingDuration = function processingDurationWithPlan(job) {
    const base = originalProcessingDuration.call(this, job);
    const resource = ensureResources(this).find((item) => item.id === job.resourceId);
    if (!resource || resource.assignment === 'any') return base;
    return base * (resource.assignment === job.target ? 0.78 : 1.22);
  };

  prototype.shouldFinish = function shouldFinishWithOvertime() {
    if (this.state.overtime) return false;
    return originalShouldFinish.call(this);
  };

  prototype.enforceHardStop = function enforceHardStopWithOvertime() {
    if (this.state.overtime) return;
    return originalEnforceHardStop.call(this);
  };

  prototype.tick = function tickWithOvertime(realSeconds) {
    ensureResources(this);
    const result = originalTick.call(this, realSeconds);
    if (this.state.overtime && !this.state.completed) {
      const unresolved = this.state.jobs.filter((job) => ['scheduled', 'waiting', 'queued', 'processing'].includes(job.status)).length;
      if (unresolved <= 2 && this.state.elapsed >= (this.state.nextOvertimeWaveAt || 0)) {
        addOvertimeWave(this);
        this.onChange(this.snapshot(), { type: 'tick' });
      }
    }
    return result;
  };

  prototype.reset = function resetWithResources() {
    const result = originalReset.call(this);
    ensureResources(this);
    return result;
  };
}

installPatch();
