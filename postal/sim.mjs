export const INITIAL_TIME = 17 * 60 + 42;

export const LEVELS = Object.freeze(['terminal', 'network', 'sweden']);

export const LEVEL_LABELS = Object.freeze({
  terminal: 'Town',
  network: 'Region',
  sweden: 'Sweden'
});

export const CARRIERS = Object.freeze({
  nordpost: {
    id: 'nordpost',
    name: 'NordPost',
    code: 'NP',
    tone: 'yellow',
    defaultService: 'standard',
    units: [3, 4, 2, 5],
    promiseAdjust: 5
  },
  dlh: {
    id: 'dlh',
    name: 'DLH',
    code: 'DLH',
    tone: 'red',
    defaultService: 'express',
    units: [1, 2, 1, 3],
    promiseAdjust: -6
  },
  brang: {
    id: 'brang',
    name: 'Brang',
    code: 'B',
    tone: 'green',
    defaultService: 'standard',
    units: [1, 2, 2, 1],
    promiseAdjust: -2
  },
  usp: {
    id: 'usp',
    name: 'USP',
    code: 'USP',
    tone: 'blue',
    defaultService: 'express',
    units: [4, 3, 5, 3],
    promiseAdjust: 7
  }
});

const DESTINATIONS = Object.freeze({
  north: { id: 'north', code: 'NORTH', name: 'Sundsvall north', path: ['terminal'] },
  centre: { id: 'centre', code: 'CENTRE', name: 'Sundsvall centre', path: ['terminal'] },
  harbour: { id: 'harbour', code: 'HARBOUR', name: 'Sundsvall harbour', path: ['terminal'] },
  harnosand: { id: 'harnosand', code: 'HND', name: 'Härnösand', path: ['terminal', 'network'] },
  timra: { id: 'timra', code: 'TMR', name: 'Timrå', path: ['terminal', 'network'] },
  matfors: { id: 'matfors', code: 'MTF', name: 'Matfors', path: ['terminal', 'network'] },
  stockholm: { id: 'stockholm', code: 'STH', name: 'Stockholm', path: ['terminal', 'network', 'sweden'] },
  gothenburg: { id: 'gothenburg', code: 'GBG', name: 'Gothenburg', path: ['terminal', 'network', 'sweden'] }
});

export const SHIFT_CATALOG = Object.freeze([
  {
    id: 'first-rounds',
    number: 1,
    title: 'First rounds',
    place: 'Sundsvall terminal',
    shiftLabel: 'SUNDSVALL · FIRST SHIFT',
    kind: 'Guided shift',
    duration: '2 min',
    mechanic: 'Select · Sort · Route',
    description: 'Learn the live controls without a deadline.',
    startScene: 'terminal',
    tone: 'yellow',
    startTime: 8 * 60 + 5,
    activeLevels: ['terminal', 'network'],
    capacity: { terminal: 1, network: 1, sweden: 0 },
    durationSeconds: 999,
    promiseSeconds: 999,
    jobs: 1,
    spawnEvery: 999,
    carriers: ['dlh'],
    destinations: ['harnosand'],
    incidents: []
  },
  {
    id: 'town-rush',
    number: 2,
    title: 'After-work rush',
    place: 'Sundsvall',
    shiftLabel: 'SUNDSVALL · SHIFT 2',
    kind: 'Town rush',
    duration: '2–3 min',
    mechanic: 'Two lanes · Four carriers',
    description: 'Keep both sorting lanes moving as partner vans arrive.',
    startScene: 'terminal',
    tone: 'blue',
    startTime: INITIAL_TIME,
    activeLevels: ['terminal'],
    capacity: { terminal: 2, network: 0, sweden: 0 },
    durationSeconds: 78,
    promiseSeconds: 30,
    jobs: 15,
    spawnEvery: 5,
    carriers: ['nordpost', 'dlh', 'brang', 'usp'],
    destinations: ['north', 'centre', 'harbour'],
    incidents: [{ id: 'scanner-1', type: 'scanner-jam', level: 'terminal', target: 'scanner', at: 38 }]
  },
  {
    id: 'region-pulse',
    number: 3,
    title: 'Region pulse',
    place: 'Mid Sweden',
    shiftLabel: 'MID SWEDEN · SHIFT 3',
    kind: 'Town + region',
    duration: '3 min',
    mechanic: 'Sort teams · Route trucks',
    description: 'Sort in Sundsvall while three regional depots call for trucks.',
    startScene: 'terminal',
    tone: 'purple',
    startTime: 5 * 60 + 48,
    activeLevels: ['terminal', 'network'],
    capacity: { terminal: 2, network: 2, sweden: 0 },
    durationSeconds: 108,
    promiseSeconds: 50,
    jobs: 20,
    spawnEvery: 5.1,
    carriers: ['nordpost', 'dlh', 'brang', 'usp'],
    destinations: ['harnosand', 'timra', 'matfors', 'harnosand', 'timra'],
    directHigherEvery: 5,
    incidents: [{ id: 'snow-1', type: 'snow-route', level: 'network', target: 'network-detour', at: 52 }]
  },
  {
    id: 'sweden-night',
    number: 4,
    title: 'Sweden by night',
    place: 'National network',
    shiftLabel: 'SWEDEN · SHIFT 4',
    kind: 'National shift',
    duration: '3–4 min',
    mechanic: 'Town · Region · Sweden',
    description: 'Feed Stockholm and Gothenburg while local work keeps arriving.',
    startScene: 'sweden',
    tone: 'orange',
    startTime: 21 * 60 + 5,
    activeLevels: ['terminal', 'network', 'sweden'],
    capacity: { terminal: 2, network: 2, sweden: 2 },
    durationSeconds: 138,
    promiseSeconds: 68,
    jobs: 25,
    spawnEvery: 5.15,
    carriers: ['usp', 'nordpost', 'dlh', 'brang'],
    destinations: ['stockholm', 'gothenburg', 'timra', 'stockholm', 'harnosand', 'gothenburg'],
    directHigherEvery: 4,
    incidents: [
      { id: 'scanner-2', type: 'scanner-jam', level: 'terminal', target: 'scanner', at: 47 },
      { id: 'dock-1', type: 'hub-gridlock', level: 'sweden', target: 'sweden-relief', at: 82 }
    ]
  },
  {
    id: 'friday-surge',
    number: 5,
    title: 'Friday surge',
    place: 'National network',
    shiftLabel: 'SWEDEN · FRIDAY SURGE',
    kind: 'Peak shift',
    duration: '4 min',
    mechanic: 'All levels · Live disruptions',
    description: 'Everything is open, everything is arriving, and every second matters.',
    startScene: 'terminal',
    tone: 'pink',
    startTime: 16 * 60 + 12,
    activeLevels: ['terminal', 'network', 'sweden'],
    capacity: { terminal: 2, network: 2, sweden: 2 },
    durationSeconds: 168,
    promiseSeconds: 62,
    jobs: 32,
    spawnEvery: 4.75,
    carriers: ['nordpost', 'dlh', 'brang', 'usp'],
    destinations: ['stockholm', 'harnosand', 'gothenburg', 'timra', 'centre', 'stockholm', 'matfors', 'gothenburg'],
    directHigherEvery: 3,
    incidents: [
      { id: 'scanner-3', type: 'scanner-jam', level: 'terminal', target: 'scanner', at: 34 },
      { id: 'snow-2', type: 'snow-route', level: 'network', target: 'network-detour', at: 73 },
      { id: 'dock-2', type: 'hub-gridlock', level: 'sweden', target: 'sweden-relief', at: 112 }
    ]
  }
]);

const SHIFT_BY_ID = new Map(SHIFT_CATALOG.map((shift) => [shift.id, shift]));
const TARGET_LABELS = Object.freeze({
  'express-lane': 'Express A',
  'standard-lane': 'Standard B',
  'network-sundsvall': 'National gate',
  'network-harnosand': 'Härnösand',
  'network-timra': 'Timrå',
  'network-matfors': 'Matfors',
  'sweden-sundsvall': 'Sundsvall',
  'sweden-stockholm': 'Stockholm',
  'sweden-gothenburg': 'Gothenburg',
  scanner: 'Scanner 2',
  'network-detour': 'Inland road',
  'sweden-relief': 'Relief dock'
});

const INCIDENT_LABELS = Object.freeze({
  'scanner-jam': 'Scanner jam',
  'snow-route': 'Snow on E4',
  'hub-gridlock': 'National dock blocked'
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function getShiftDefinition(id = 'first-rounds') {
  return SHIFT_BY_ID.get(id) || SHIFT_BY_ID.get('first-rounds');
}

export function formatClock(totalMinutes) {
  const rounded = Math.floor(totalMinutes);
  const hours = Math.floor(rounded / 60) % 24;
  const minutes = rounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function getStage(state) {
  if (state.completed) return 'complete';
  if (!state.started) return 'brief';
  return state.stage;
}

function destinationFor(id) {
  return DESTINATIONS[id] || DESTINATIONS.centre;
}

function targetForJob(job, level = job.stage) {
  if (level === 'terminal') return job.service === 'express' ? 'express-lane' : 'standard-lane';
  if (level === 'network') {
    return ['harnosand', 'timra', 'matfors'].includes(job.destinationId)
      ? `network-${job.destinationId}`
      : 'network-sundsvall';
  }
  if (level === 'sweden') return `sweden-${job.destinationId}`;
  return '';
}

function buildJobs(shift, variant) {
  const jobs = [];
  for (let index = 0; index < shift.jobs; index += 1) {
    const carrierId = shift.carriers[(index + variant) % shift.carriers.length];
    const carrier = CARRIERS[carrierId];
    const destinationStep = shift.destinations.length % 2 === 0 ? shift.destinations.length - 1 : 2;
    const destinationId = shift.destinations[(index * destinationStep + variant) % shift.destinations.length];
    const destination = destinationFor(destinationId);
    let path = destination.path.filter((level) => shift.activeLevels.includes(level));
    let directLevel = 0;
    if (shift.directHigherEvery && index > 1 && (index + variant + 1) % shift.directHigherEvery === 0) {
      directLevel = Math.min(path.length - 1, 1 + ((index + variant) % Math.max(1, path.length - 1)));
    }
    path = path.slice(directLevel);
    const units = carrier.units[(index + variant * 2) % carrier.units.length];
    const jitter = ((index * 17 + variant * 11) % 7) * 0.16;
    const at = shift.id === 'first-rounds' ? 0 : 1.25 + index * shift.spawnEvery + jitter;
    const service = index % 7 === 5
      ? (carrier.defaultService === 'express' ? 'standard' : 'express')
      : carrier.defaultService;
    const promise = shift.promiseSeconds + carrier.promiseAdjust + path.length * 10 - units * 0.6;

    jobs.push({
      id: shift.id === 'first-rounds' ? 'TRAINING-01' : `${carrier.code}-${String(index + 1).padStart(2, '0')}`,
      carrierId,
      carrierName: carrier.name,
      carrierCode: carrier.code,
      carrierTone: carrier.tone,
      destinationId,
      destinationName: destination.name,
      destinationCode: destination.code,
      service,
      units,
      path,
      pathIndex: 0,
      stage: path[0],
      target: '',
      scheduledAt: at,
      arrivedAt: null,
      deadline: at + promise,
      status: 'scheduled',
      startedAt: null,
      completesAt: null,
      queueOrder: null,
      deliveredAt: null,
      late: false,
      missed: false,
      history: []
    });
  }
  return jobs;
}

function buildIncidents(shift) {
  return shift.incidents.map((incident) => ({
    ...incident,
    label: INCIDENT_LABELS[incident.type],
    active: false,
    resolved: false,
    triggeredAt: null,
    resolvedAt: null
  }));
}

export function createInitialState(shiftId = 'first-rounds', variant = 0) {
  const shift = getShiftDefinition(shiftId);
  const normalizedVariant = Math.max(0, Math.floor(variant || 0));
  return {
    shiftId: shift.id,
    variant: normalizedVariant,
    started: false,
    completed: false,
    paused: true,
    speed: 1,
    stage: 'brief',
    elapsed: 0,
    time: shift.startTime,
    durationSeconds: shift.durationSeconds,
    selectedJobId: null,
    jobs: buildJobs(shift, normalizedVariant),
    incidents: buildIncidents(shift),
    capacity: { ...shift.capacity },
    queueSequence: 0,
    delivered: 0,
    onTimeDelivered: 0,
    missed: 0,
    mistakes: 0,
    combo: 0,
    bestCombo: 0,
    score: shift.id === 'first-rounds' ? 300 : 0,
    onTime: 100,
    backlog: 0,
    risk: 0,
    outcome: null,
    events: []
  };
}

function cloneJob(job) {
  return { ...job, path: [...job.path], history: [...job.history] };
}

function activeJobs(state) {
  return state.jobs.filter((job) => !['scheduled', 'delivered', 'missed'].includes(job.status));
}

function busyAtLevel(state, level) {
  return state.jobs.filter((job) => job.stage === level && job.status === 'processing').length;
}

function waitingAtLevel(state, level) {
  return state.jobs.filter((job) => job.stage === level && ['waiting', 'queued'].includes(job.status)).length;
}

function canControlTime(state) {
  if (!state.started || state.completed) return false;
  if (state.shiftId !== 'first-rounds') return true;
  return ['coach-town-run', 'coach-region-run'].includes(state.stage);
}

function availableScenes(state) {
  const shift = getShiftDefinition(state.shiftId);
  if (state.shiftId !== 'first-rounds') return [...shift.activeLevels];
  if (['coach-open-region', 'coach-region-select', 'coach-region-target', 'coach-region-run', 'complete'].includes(getStage(state))) {
    return ['terminal', 'network'];
  }
  return ['terminal'];
}

function liveTargetIds(state) {
  const ids = [];
  const scenes = availableScenes(state);
  if (scenes.includes('terminal')) ids.push('express-lane', 'standard-lane');
  if (scenes.includes('network')) ids.push('network-sundsvall', 'network-harnosand', 'network-timra', 'network-matfors');
  if (scenes.includes('sweden')) ids.push('sweden-sundsvall', 'sweden-stockholm', 'sweden-gothenburg');
  return ids;
}

function activeHotspots(state) {
  if (!state.started || state.completed) return [];
  if (state.shiftId === 'first-rounds') {
    if (state.stage === 'coach-town-target') return ['express-lane'];
    if (state.stage === 'coach-region-target') return ['network-harnosand'];
    return [];
  }
  return [
    ...liveTargetIds(state),
    ...state.incidents.filter((incident) => incident.active).map((incident) => incident.target)
  ];
}

function hotspotPresentation(state) {
  const labels = {};
  const tones = {
    'express-lane': 'blue',
    'standard-lane': 'yellow',
    'network-sundsvall': 'purple',
    'network-harnosand': 'blue',
    'network-timra': 'yellow',
    'network-matfors': 'green',
    'sweden-sundsvall': 'yellow',
    'sweden-stockholm': 'blue',
    'sweden-gothenburg': 'green'
  };
  const icons = {};
  const targetStatus = {};

  for (const id of liveTargetIds(state)) {
    const level = id.startsWith('network-') ? 'network' : id.startsWith('sweden-') ? 'sweden' : 'terminal';
    const processing = state.jobs.filter((job) => job.target === id && job.status === 'processing').length;
    const queued = state.jobs.filter((job) => job.target === id && job.status === 'queued').length;
    const load = processing + queued;
    labels[id] = load ? `${TARGET_LABELS[id]} · ${load}` : TARGET_LABELS[id];
    icons[id] = processing ? '●' : queued ? '◷' : id.includes('lane') ? (id.startsWith('express') ? '↗' : '■') : '○';
    targetStatus[id] = { level, processing, queued, label: TARGET_LABELS[id] };
  }

  for (const incident of state.incidents.filter((item) => item.active)) {
    labels[incident.target] = incident.type === 'scanner-jam'
      ? 'Clear scanner jam'
      : incident.type === 'snow-route'
        ? 'Open inland detour'
        : 'Open relief dock';
    tones[incident.target] = 'danger';
    icons[incident.target] = '!';
  }

  return { labels, tones, icons, targetStatus };
}

function recalculate(state) {
  const active = activeJobs(state);
  state.delivered = state.jobs.filter((job) => job.status === 'delivered').length;
  state.onTimeDelivered = state.jobs.filter((job) => job.status === 'delivered' && !job.late).length;
  state.missed = state.jobs.filter((job) => job.status === 'missed').length;
  state.backlog = active.length;
  const resolved = state.delivered + state.missed;
  state.onTime = resolved ? Math.round((state.onTimeDelivered / resolved) * 100) : 100;
  const dueSoon = active.filter((job) => job.deadline - state.elapsed <= 12).length;
  const activeIncidents = state.incidents.filter((incident) => incident.active).length;
  state.risk = dueSoon + state.missed + activeIncidents * 2;
}

export class ShiftSimulation {
  constructor(onChange = () => {}, shiftId = 'first-rounds', options = {}) {
    this.shift = getShiftDefinition(shiftId);
    this.shiftId = this.shift.id;
    this.variant = Math.max(0, Math.floor(options.variant || 0));
    this.state = createInitialState(this.shiftId, this.variant);
    this.onChange = onChange;
  }

  emit(type, message = '', data = {}) {
    recalculate(this.state);
    const event = { type, message, data, at: formatClock(this.state.time) };
    this.state.events = [...this.state.events.slice(-20), event];
    this.onChange(this.snapshot(), event);
    return event;
  }

  snapshot() {
    recalculate(this.state);
    const presentation = hotspotPresentation(this.state);
    const levelCounts = Object.fromEntries(LEVELS.map((level) => [level, waitingAtLevel(this.state, level)]));
    const resourceStatus = Object.fromEntries(LEVELS.map((level) => [level, {
      capacity: this.state.capacity[level] || 0,
      busy: busyAtLevel(this.state, level),
      waiting: waitingAtLevel(this.state, level)
    }]));
    const selectedJob = this.state.jobs.find((job) => job.id === this.state.selectedJobId) || null;
    return {
      ...this.state,
      jobs: this.state.jobs.map(cloneJob),
      incidents: this.state.incidents.map((incident) => ({ ...incident })),
      capacity: { ...this.state.capacity },
      events: [...this.state.events],
      stage: getStage(this.state),
      canRun: canControlTime(this.state),
      activeHotspots: activeHotspots(this.state),
      availableScenes: availableScenes(this.state),
      hotspotLabels: presentation.labels,
      hotspotTones: presentation.tones,
      hotspotIcons: presentation.icons,
      targetStatus: presentation.targetStatus,
      levelCounts,
      resourceStatus,
      selectedJob: selectedJob ? cloneJob(selectedJob) : null,
      remainingSeconds: Math.max(0, this.shift.durationSeconds - this.state.elapsed),
      arrivalsComplete: this.state.jobs.every((job) => job.status !== 'scheduled')
    };
  }

  start() {
    if (this.state.started) return false;
    this.state.started = true;
    this.spawnArrivals();
    if (this.shiftId === 'first-rounds') {
      this.state.stage = 'coach-select';
      this.state.paused = true;
      this.emit('start', 'First shift started. Select the waiting DLH parcel.');
    } else {
      this.state.stage = 'live';
      this.state.paused = false;
      this.emit('start', `${this.shift.title} is live.`);
    }
    return true;
  }

  setPaused(paused) {
    if (!canControlTime(this.state)) return false;
    this.state.paused = Boolean(paused);
    this.emit(paused ? 'pause' : 'resume', paused ? 'Shift paused.' : `Live at ${this.state.speed} times speed.`);
    return true;
  }

  togglePaused() {
    return this.setPaused(!this.state.paused);
  }

  setSpeed(speed) {
    if (!canControlTime(this.state)) return false;
    this.state.speed = speed === 2 ? 2 : 1;
    this.state.paused = false;
    this.emit('speed', `Live at ${this.state.speed} times speed.`);
    return true;
  }

  perform(action, value = null) {
    if (!this.state.started || this.state.completed) return false;
    if (action === 'select-job') return this.selectJob(value);
    if (action === 'route-selected') return this.routeSelected(value);
    if (action === 'resolve-incident') return this.resolveIncident(value);
    if (action === 'visit-level') return this.visitLevel(value);
    return false;
  }

  selectJob(jobId) {
    const job = this.state.jobs.find((item) => item.id === jobId);
    if (!job || job.status !== 'waiting') return false;
    this.state.selectedJobId = job.id;
    if (this.shiftId === 'first-rounds') {
      if (this.state.stage === 'coach-select' && job.stage === 'terminal') this.state.stage = 'coach-town-target';
      else if (this.state.stage === 'coach-region-select' && job.stage === 'network') this.state.stage = 'coach-region-target';
      else return false;
    }
    this.emit('select', `${job.carrierName} batch selected: ${job.destinationName}, ${job.units} parcels.`, { jobId });
    return true;
  }

  routeSelected(target) {
    const job = this.state.jobs.find((item) => item.id === this.state.selectedJobId);
    if (!job || job.status !== 'waiting') return false;
    const expected = targetForJob(job);
    if (target !== expected) {
      if (this.shiftId === 'first-rounds') return false;
      this.state.mistakes += 1;
      this.state.combo = 0;
      this.state.score = Math.max(0, this.state.score - 35);
      job.deadline -= 2;
      this.emit('mistake', `${job.carrierCode} is marked for ${TARGET_LABELS[expected]}.`, { jobId: job.id, expected });
      return true;
    }

    this.state.selectedJobId = null;
    job.target = target;
    job.queueOrder = ++this.state.queueSequence;
    if (busyAtLevel(this.state, job.stage) < (this.state.capacity[job.stage] || 0)) {
      this.startProcessing(job);
    } else {
      job.status = 'queued';
      job.history.push(`${formatClock(this.state.time)} · queued for ${TARGET_LABELS[target]}`);
      this.emit('queue', `${job.carrierCode} queued for ${TARGET_LABELS[target]}.`, { jobId: job.id, level: job.stage });
    }

    if (this.shiftId === 'first-rounds') {
      this.state.stage = job.stage === 'terminal' ? 'coach-town-run' : 'coach-region-run';
      this.state.paused = false;
    }
    return true;
  }

  startProcessing(job) {
    job.status = 'processing';
    job.startedAt = this.state.elapsed;
    job.completesAt = this.state.elapsed + this.processingDuration(job);
    job.history.push(`${formatClock(this.state.time)} · ${TARGET_LABELS[job.target]} started`);
    this.emit('work', `${TARGET_LABELS[job.target]} started ${job.carrierCode}.`, { jobId: job.id, level: job.stage });
  }

  processingDuration(job) {
    const base = { terminal: 5.2, network: 8.4, sweden: 10.8 }[job.stage] || 6;
    const unitFactor = 1 + Math.max(0, job.units - 1) * 0.12;
    const incident = this.state.incidents.find((item) => item.active && item.level === job.stage);
    const incidentFactor = incident
      ? incident.type === 'scanner-jam' ? 1.75 : incident.type === 'snow-route' ? 1.55 : 1.65
      : 1;
    return base * unitFactor * incidentFactor;
  }

  resolveIncident(target) {
    const incident = this.state.incidents.find((item) => item.active && item.target === target);
    if (!incident) return false;
    incident.active = false;
    incident.resolved = true;
    incident.resolvedAt = this.state.elapsed;
    this.state.score += 90;
    for (const job of this.state.jobs.filter((item) => item.status === 'processing' && item.stage === incident.level)) {
      const remaining = Math.max(0.5, job.completesAt - this.state.elapsed);
      job.completesAt = this.state.elapsed + remaining * 0.72;
    }
    this.emit('repair', `${incident.label} cleared.`, { incidentId: incident.id, level: incident.level });
    return true;
  }

  visitLevel(level) {
    if (!availableScenes(this.state).includes(level)) return false;
    const selected = this.state.jobs.find((job) => job.id === this.state.selectedJobId);
    if (selected && selected.stage !== level) {
      this.state.selectedJobId = null;
      this.emit('deselect', `Selection cleared. ${selected.carrierCode} remains in ${LEVEL_LABELS[selected.stage]}.`);
    }
    if (this.shiftId === 'first-rounds' && this.state.stage === 'coach-open-region' && level === 'network') {
      this.state.stage = 'coach-region-select';
      this.emit('coach', 'Regional view open. Select the DLH batch waiting for Härnösand.');
    }
    return true;
  }

  spawnArrivals() {
    let spawned = 0;
    for (const job of this.state.jobs) {
      if (job.status !== 'scheduled' || job.scheduledAt > this.state.elapsed) continue;
      job.status = 'waiting';
      job.arrivedAt = this.state.elapsed;
      job.target = targetForJob(job);
      job.history.push(`${formatClock(this.state.time)} · arrived at ${LEVEL_LABELS[job.stage]}`);
      spawned += 1;
    }
    if (spawned && this.shiftId !== 'first-rounds') {
      this.emit('arrival', `${spawned} new ${spawned === 1 ? 'batch' : 'batches'} arrived.`, { count: spawned });
    }
  }

  triggerIncidents() {
    for (const incident of this.state.incidents) {
      if (incident.resolved || incident.active || incident.at > this.state.elapsed) continue;
      incident.active = true;
      incident.triggeredAt = this.state.elapsed;
      this.emit('incident', `${incident.label} needs attention in ${LEVEL_LABELS[incident.level]}.`, {
        incidentId: incident.id,
        level: incident.level
      });
    }
  }

  completeProcessing() {
    const completed = this.state.jobs
      .filter((job) => job.status === 'processing' && job.completesAt <= this.state.elapsed)
      .sort((a, b) => a.completesAt - b.completesAt);
    for (const job of completed) this.advanceJob(job);
    for (const level of LEVELS) this.startQueued(level);
  }

  advanceJob(job) {
    job.pathIndex += 1;
    job.startedAt = null;
    job.completesAt = null;
    job.queueOrder = null;
    job.target = '';

    if (job.pathIndex < job.path.length) {
      job.stage = job.path[job.pathIndex];
      job.status = 'waiting';
      job.arrivedAt = this.state.elapsed;
      job.target = targetForJob(job);
      job.history.push(`${formatClock(this.state.time)} · ready in ${LEVEL_LABELS[job.stage]}`);
      if (this.shiftId === 'first-rounds') {
        this.state.stage = 'coach-open-region';
        this.state.paused = true;
        this.emit('coach', 'The town sort is complete. Open Region to finish the route.');
      } else {
        this.emit('handoff', `${job.carrierCode} reached ${LEVEL_LABELS[job.stage]}.`, { jobId: job.id, level: job.stage });
      }
      return;
    }

    job.status = 'delivered';
    job.deliveredAt = this.state.elapsed;
    job.late = job.deliveredAt > job.deadline;
    job.history.push(`${formatClock(this.state.time)} · delivered${job.late ? ' late' : ' on time'}`);
    if (job.late) {
      this.state.combo = 0;
      this.state.score = Math.max(0, this.state.score - 20);
    } else {
      this.state.combo += 1;
      this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);
      const margin = Math.max(0, job.deadline - job.deliveredAt);
      this.state.score += Math.round(90 + margin * 3 + Math.min(this.state.combo, 8) * 14);
    }

    if (this.shiftId === 'first-rounds') {
      this.finishShift(true);
    } else {
      this.emit(job.late ? 'late' : 'delivered', `${job.carrierCode} reached ${job.destinationName}${job.late ? ' late' : ' on time'}.`, { jobId: job.id });
    }
  }

  startQueued(level) {
    const capacity = this.state.capacity[level] || 0;
    while (busyAtLevel(this.state, level) < capacity) {
      const next = this.state.jobs
        .filter((job) => job.stage === level && job.status === 'queued')
        .sort((a, b) => a.queueOrder - b.queueOrder)[0];
      if (!next) break;
      this.startProcessing(next);
    }
  }

  expirePromises() {
    for (const job of activeJobs(this.state)) {
      if (!job.late && this.state.elapsed > job.deadline) {
        job.late = true;
        this.state.combo = 0;
        this.emit('warning', `${job.carrierCode} to ${job.destinationCode} is now late.`, { jobId: job.id, level: job.stage });
      }
      if (job.status === 'waiting' && this.state.elapsed > job.deadline + 28) {
        job.status = 'missed';
        job.missed = true;
        if (this.state.selectedJobId === job.id) this.state.selectedJobId = null;
        this.state.score = Math.max(0, this.state.score - 70);
        this.emit('missed', `${job.carrierCode} collection left without its batch.`, { jobId: job.id, level: job.stage });
      }
    }
  }

  shouldFinish() {
    if (this.shiftId === 'first-rounds') return false;
    const noFuture = this.state.jobs.every((job) => job.status !== 'scheduled');
    const noActive = this.state.jobs.every((job) => ['delivered', 'missed'].includes(job.status));
    return noFuture && noActive;
  }

  enforceHardStop() {
    if (this.state.elapsed < this.shift.durationSeconds + 48) return;
    for (const job of activeJobs(this.state)) {
      job.status = 'missed';
      job.missed = true;
    }
  }

  tick(realSeconds) {
    if (!this.state.started || this.state.paused || this.state.completed || !canControlTime(this.state)) return;
    let remaining = Math.max(0, realSeconds) * this.state.speed;
    while (remaining > 0 && !this.state.completed && !this.state.paused) {
      const step = Math.min(0.25, remaining);
      remaining -= step;
      this.state.elapsed += step;
      this.state.time = this.shift.startTime + this.state.elapsed * 0.42;
      this.spawnArrivals();
      this.triggerIncidents();
      this.completeProcessing();
      this.expirePromises();
      this.enforceHardStop();
      if (this.shouldFinish()) this.finishShift(true);
    }
    if (!this.state.completed) this.onChange(this.snapshot(), { type: 'tick' });
  }

  finishShift(force = false) {
    if (this.state.completed || (!force && !this.shouldFinish())) return false;
    this.state.completed = true;
    this.state.paused = true;
    this.state.stage = 'complete';
    recalculate(this.state);
    this.state.outcome = createOutcome(this.state);
    this.emit('complete', this.state.outcome.summary);
    return true;
  }

  reset() {
    this.state = createInitialState(this.shiftId, this.variant);
    this.emit('reset');
  }
}

export function createOutcome(state) {
  if (state.shiftId === 'first-rounds') {
    return {
      kicker: 'FIRST SHIFT COMPLETE',
      grade: '✓',
      gradeLabel: 'Training complete',
      title: 'You have the route.',
      summary: 'Select the batch, tap its marked destination, and keep an eye on every level. The live shifts are open.',
      score: state.score,
      stats: [
        { label: 'Town sort', value: 'Done' },
        { label: 'Regional route', value: 'Done' },
        { label: 'Pressure', value: 'None' }
      ],
      medals: [{ icon: '↗', label: 'Ready for live work' }]
    };
  }

  recalculate(state);
  const totalResolved = state.delivered + state.missed;
  const service = totalResolved ? Math.round((state.onTimeDelivered / totalResolved) * 100) : 0;
  const grade = service >= 94 && state.missed === 0 && state.mistakes <= 1
    ? 'A+'
    : service >= 86 && state.missed <= 1
      ? 'A'
      : service >= 74
        ? 'B'
        : service >= 60
          ? 'C'
          : 'D';
  const title = grade === 'A+' ? 'The network sang.' : grade === 'A' ? 'Promises kept.' : grade === 'B' ? 'A solid recovery.' : 'The backlog bit back.';
  const summary = `${state.onTimeDelivered} of ${totalResolved} batches made their promise across the live network.`;
  const medals = [];
  if (state.missed === 0) medals.push({ icon: '✓', label: 'Nothing left behind' });
  if (state.mistakes === 0 && state.delivered > 0 && state.missed === 0) medals.push({ icon: '◆', label: 'Perfect sorting' });
  if (state.bestCombo >= 6) medals.push({ icon: '×', label: `${state.bestCombo} flow combo` });
  if (state.incidents.length && state.incidents.every((incident) => incident.resolved)) medals.push({ icon: '!', label: 'Every disruption cleared' });

  return {
    kicker: 'SHIFT COMPLETE',
    grade,
    gradeLabel: `Grade ${grade}`,
    title,
    summary,
    score: Math.round(state.score),
    stats: [
      { label: 'On time', value: `${service}%` },
      { label: 'Delivered', value: state.delivered },
      { label: 'Best combo', value: `${state.bestCombo}×` }
    ],
    medals: medals.length ? medals : [{ icon: '↗', label: 'Shift completed' }]
  };
}
