export const INITIAL_TIME = 17 * 60 + 42;
export const BASE_DEPARTURE = 18 * 60 + 20;
export const VERIFY_TARGET = 12;

const ONBOARDING_VERIFY_TARGET = 6;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const SHIFT_CATALOG = Object.freeze([
  {
    id: 'first-rounds',
    number: 1,
    title: 'First rounds',
    place: 'Sundsvall terminal',
    shiftLabel: 'SUNDSVALL · FIRST SHIFT',
    kind: 'Guided shift',
    duration: '2 min',
    mechanic: 'Watch · Move · Scan · Send',
    description: 'Meet the parcel flow one action at a time. There is no clock pressure.',
    startScene: 'terminal',
    tone: 'yellow',
    startTime: 8 * 60 + 5,
    departure: 8 * 60 + 20,
    metricLabels: ['On time', 'In flow', 'At risk'],
    metricIcons: ['✓', '▦', '!']
  },
  {
    id: 'northbound',
    number: 2,
    title: 'Northbound promises',
    place: 'Sundsvall → Härnösand',
    shiftLabel: 'SUNDSVALL · SHIFT 2',
    kind: 'Systems shift',
    duration: '5 min',
    mechanic: 'Capacity · Investigation · Rules',
    description: 'Protect a departure, trace a wrong turn and repair the system behind it.',
    startScene: 'terminal',
    tone: 'blue',
    startTime: INITIAL_TIME,
    departure: BASE_DEPARTURE,
    metricLabels: ['On time', 'In flow', 'At risk'],
    metricIcons: ['✓', '▦', '!']
  },
  {
    id: 'snow-window',
    number: 3,
    title: 'Snow over E4',
    place: 'Mid Sweden network',
    shiftLabel: 'REGION MID · SHIFT 3',
    kind: 'Network shift',
    duration: '4 min',
    mechanic: 'Read demand · Allocate · Reroute',
    description: 'One spare truck, three depots and a closing weather window. Choose what moves.',
    startScene: 'network',
    tone: 'purple',
    startTime: 5 * 60 + 48,
    departure: 6 * 60 + 30,
    metricLabels: ['Coverage', 'Waiting', 'At risk'],
    metricIcons: ['⌁', '▰', '!']
  },
  {
    id: 'scanner-fever',
    number: 4,
    title: 'Scanner fever',
    place: 'Sundsvall terminal',
    shiftLabel: 'SUNDSVALL · SHIFT 4',
    kind: 'Triage shift',
    duration: '4 min',
    mechanic: 'Diagnose · Prioritise · Recover',
    description: 'A scanner has stopped. Order the waiting promises, then choose how to recover.',
    startScene: 'terminal',
    tone: 'orange',
    startTime: 14 * 60 + 6,
    departure: 14 * 60 + 40,
    metricLabels: ['Accuracy', 'Queue', 'At risk'],
    metricIcons: ['◆', '▦', '!']
  },
  {
    id: 'priority-parcel',
    number: 5,
    title: 'Priority parcel',
    place: 'Regional recovery',
    shiftLabel: 'REGION MID · SHIFT 5',
    kind: 'Investigation shift',
    duration: '4 min',
    mechanic: 'Trace · Deduce · Recover',
    description: 'Find a temperature-controlled parcel from its scan trail and get it moving.',
    startScene: 'case',
    tone: 'pink',
    startTime: 20 * 60 + 32,
    departure: 21 * 60 + 10,
    metricLabels: ['Cold chain', 'Min left', 'At risk'],
    metricIcons: ['◇', '◷', '!']
  }
]);

const SHIFT_BY_ID = new Map(SHIFT_CATALOG.map((shift) => [shift.id, shift]));

const TRIAGE_VARIANTS = Object.freeze([
  [
    { id: 'medicine', label: 'Chilled medicine', promise: '28 min', priority: 1, tone: 'pink' },
    { id: 'express', label: 'Express documents', promise: '51 min', priority: 2, tone: 'blue' },
    { id: 'economy', label: 'Economy returns', promise: 'Tomorrow', priority: 3, tone: 'yellow' }
  ],
  [
    { id: 'flight', label: 'Airport connection', promise: '19 min', priority: 1, tone: 'blue' },
    { id: 'sample', label: 'Laboratory sample', promise: '44 min', priority: 2, tone: 'pink' },
    { id: 'returns', label: 'Shop returns', promise: 'Tomorrow', priority: 3, tone: 'yellow' }
  ],
  [
    { id: 'parts', label: 'Repair parts', promise: '24 min', priority: 1, tone: 'orange' },
    { id: 'signed', label: 'Signed delivery', promise: '63 min', priority: 2, tone: 'blue' },
    { id: 'catalogue', label: 'Catalogues', promise: '2 days', priority: 3, tone: 'yellow' }
  ]
]);

const CASE_VARIANTS = Object.freeze([
  {
    parcelId: 'SE-8841-204',
    correctLocation: 'dock-3',
    evidence: ['Inbound scan · 20:11', 'No outbound confirmation', 'Handheld ping · Dock 3 · 20:18'],
    locations: [
      { id: 'dock-3', label: 'Dock 3' },
      { id: 'truck-7', label: 'Truck 7' },
      { id: 'timra', label: 'Timrå depot' }
    ]
  },
  {
    parcelId: 'SE-2930-117',
    correctLocation: 'timra',
    evidence: ['Sundsvall outbound · 20:05', 'Timrå arrival group · 20:21', 'No final cage scan'],
    locations: [
      { id: 'cage-4', label: 'Sundsvall cage 4' },
      { id: 'timra', label: 'Timrå inbound' },
      { id: 'truck-7', label: 'Truck 7' }
    ]
  },
  {
    parcelId: 'SE-7105-663',
    correctLocation: 'truck-7',
    evidence: ['Dock 3 scan · 20:09', 'Truck 7 load list · matched', 'No Härnösand arrival scan'],
    locations: [
      { id: 'truck-7', label: 'Truck 7' },
      { id: 'harnosand', label: 'Härnösand depot' },
      { id: 'dock-3', label: 'Dock 3' }
    ]
  }
]);

export function getShiftDefinition(id = 'first-rounds') {
  return SHIFT_BY_ID.get(id) || SHIFT_BY_ID.get('first-rounds');
}

export function formatClock(totalMinutes) {
  const rounded = Math.floor(totalMinutes);
  const hours = Math.floor(rounded / 60) % 24;
  const minutes = rounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getStage(state) {
  if (state.completed) return 'complete';
  if (!state.started) return 'brief';
  return state.stage;
}

function baseState(shiftId, variant) {
  const shift = getShiftDefinition(shiftId);
  return {
    shiftId: shift.id,
    variant,
    started: false,
    completed: false,
    paused: true,
    speed: 1,
    stage: 'brief',
    time: shift.startTime,
    departure: shift.departure,
    onTime: 100,
    backlog: 0,
    risk: 0,
    score: 400,
    saved: 0,
    lateMinutes: 0,
    lastMinute: Math.floor(shift.startTime),
    outcome: null,
    events: [],
    staffMoved: false,
    truckHeld: false,
    packageSelected: false,
    signatureFound: false,
    ruleFixed: false,
    verified: 0,
    expressCrew: 4,
    standardCrew: 6,
    expressLoad: 62,
    standardLoad: 42,
    downstreamMargin: 10,
    laneInspected: false,
    scannerInspected: false,
    inspectedDepots: [],
    allocation: null,
    routeChoice: null,
    delivered: 0,
    deliveryTarget: 0,
    triageQueue: [],
    triageOrder: [],
    triageMistakes: 0,
    scannerFixed: false,
    scannerBypassed: false,
    processed: 0,
    caseData: null,
    clueChoice: null,
    locationCorrect: false,
    recoveryChoice: null,
    deliveryProgress: 0
  };
}

export function createInitialState(shiftId = 'first-rounds', variant = 0) {
  const normalizedVariant = Math.max(0, Math.floor(variant || 0));
  const state = baseState(shiftId, normalizedVariant);

  switch (state.shiftId) {
    case 'first-rounds':
      Object.assign(state, {
        onTime: 98,
        backlog: 6,
        risk: 0,
        score: 300,
        expressCrew: 2,
        standardCrew: 4,
        expressLoad: 54,
        standardLoad: 31
      });
      break;
    case 'northbound':
      Object.assign(state, {
        onTime: 91,
        backlog: 84,
        risk: 18,
        score: 600,
        expressLoad: 92,
        standardLoad: 43
      });
      break;
    case 'snow-window':
      Object.assign(state, {
        onTime: 72,
        backlog: 49,
        risk: 23,
        score: 520
      });
      break;
    case 'scanner-fever':
      Object.assign(state, {
        onTime: 96,
        backlog: 31,
        risk: 7,
        score: 500,
        expressLoad: 84,
        standardLoad: 69,
        triageQueue: TRIAGE_VARIANTS[normalizedVariant % TRIAGE_VARIANTS.length].map((parcel) => ({ ...parcel }))
      });
      break;
    case 'priority-parcel':
      Object.assign(state, {
        onTime: 100,
        backlog: 38,
        risk: 1,
        score: 480,
        packageSelected: false,
        caseData: {
          ...CASE_VARIANTS[normalizedVariant % CASE_VARIANTS.length],
          evidence: [...CASE_VARIANTS[normalizedVariant % CASE_VARIANTS.length].evidence],
          locations: CASE_VARIANTS[normalizedVariant % CASE_VARIANTS.length].locations.map((location) => ({ ...location }))
        }
      });
      break;
  }

  return state;
}

function canRun(state) {
  if (!state.started || state.completed) return false;
  if (state.shiftId === 'northbound') return !['compare', 'rule', 'dispatch'].includes(state.stage);
  return ['coach-watch', 'weather-run', 'jam-run', 'case-run'].includes(state.stage);
}

function activeHotspots(state) {
  const stage = getStage(state);
  switch (state.shiftId) {
    case 'first-rounds':
      if (stage === 'tour') return ['express-lane'];
      if (stage === 'coach-move') return ['express-lane', 'standard-lane'];
      if (stage === 'coach-scan') return ['scanner'];
      if (stage === 'coach-watch') return ['express-lane', 'truck'];
      if (stage === 'dispatch') return ['truck'];
      return [];
    case 'northbound': {
      const network = ['network-sundsvall', 'network-harnosand', 'network-timra', 'network-matfors'];
      if (stage === 'protect') return ['express-lane', 'standard-lane', 'truck', ...network];
      if (stage === 'investigate') return ['parcel', 'express-lane', 'standard-lane', 'truck', ...network];
      if (stage === 'compare') return ['case-package'];
      if (stage === 'rule') return ['case-package', 'case-similar'];
      if (stage === 'verify') return ['express-lane', 'standard-lane', 'truck', ...network];
      if (stage === 'dispatch') return ['truck', ...network];
      return [];
    }
    case 'snow-window':
      return ['network-sundsvall', 'network-harnosand', 'network-timra', 'network-matfors'];
    case 'scanner-fever':
      if (stage === 'jam-diagnose') return ['scanner', 'parcel'];
      if (stage === 'jam-triage' || stage === 'jam-repair') return ['scanner', 'parcel', 'express-lane', 'standard-lane'];
      if (stage === 'jam-run' || stage === 'dispatch') return ['scanner', 'express-lane', 'standard-lane', 'truck'];
      return [];
    case 'priority-parcel':
      if (stage === 'case-inspect' || stage === 'case-clue') return ['case-package'];
      if (stage === 'case-plan' || stage === 'case-run' || stage === 'dispatch') {
        return ['case-package', 'network-sundsvall', 'network-harnosand', 'network-timra', 'network-matfors'];
      }
      return [];
    default:
      return [];
  }
}

function availableScenes(state) {
  switch (state.shiftId) {
    case 'first-rounds':
    case 'scanner-fever':
      return ['terminal'];
    case 'snow-window':
      return ['network'];
    case 'priority-parcel':
      return state.stage === 'case-inspect' || state.stage === 'case-clue' ? ['case'] : ['case', 'network'];
    case 'northbound':
      return state.packageSelected ? ['terminal', 'network', 'case'] : ['terminal', 'network'];
    default:
      return ['terminal'];
  }
}

function hotspotPresentation(state) {
  if (state.shiftId === 'first-rounds') {
    return {
      labels: { 'express-lane': '1 · Express A', 'standard-lane': 'Standard B', scanner: '3 · Scanner', truck: '4 · Send van' },
      icons: { 'express-lane': '1', scanner: '3', truck: '4' }
    };
  }
  if (state.shiftId === 'scanner-fever') {
    return {
      labels: { scanner: state.scannerFixed ? 'Scanner restored' : 'Scanner 2 · stopped', parcel: 'Blocked parcels' },
      tones: { scanner: state.scannerFixed ? 'good' : 'danger', parcel: 'danger' },
      icons: { scanner: state.scannerFixed ? '✓' : '!', parcel: '▦' }
    };
  }
  if (state.shiftId === 'snow-window') {
    return {
      labels: {
        'network-harnosand': 'Härnösand · 14 urgent',
        'network-timra': 'Timrå · 26 waiting',
        'network-matfors': 'Matfors · 9 waiting',
        'network-sundsvall': 'Spare truck'
      },
      tones: {
        'network-harnosand': state.allocation === 'harnosand' ? 'good' : 'danger',
        'network-timra': state.allocation === 'timra' ? 'good' : 'yellow',
        'network-matfors': state.routeChoice === 'inland' ? 'blue' : 'yellow'
      }
    };
  }
  if (state.shiftId === 'priority-parcel') {
    return {
      labels: {
        'case-package': state.caseData?.parcelId || 'Priority parcel',
        'network-sundsvall': 'Sundsvall',
        'network-harnosand': 'Härnösand',
        'network-timra': 'Timrå',
        'network-matfors': 'Matfors'
      },
      tones: { 'case-package': state.locationCorrect ? 'good' : 'danger' }
    };
  }
  return {
    labels: {},
    tones: {
      parcel: state.ruleFixed ? 'good' : 'danger',
      'network-harnosand': state.ruleFixed ? 'good' : 'danger'
    },
    icons: { 'network-harnosand': state.ruleFixed ? '✓' : '!' }
  };
}

export class ShiftSimulation {
  constructor(onChange = () => {}, shiftId = 'first-rounds', options = {}) {
    this.shiftId = getShiftDefinition(shiftId).id;
    this.variant = Math.max(0, Math.floor(options.variant || 0));
    this.state = createInitialState(this.shiftId, this.variant);
    this.onChange = onChange;
    this.progressAccumulator = 0;
  }

  emit(type, message = '', data = {}) {
    const event = { type, message, data, at: formatClock(this.state.time) };
    this.state.events = [...this.state.events.slice(-15), event];
    this.onChange(this.snapshot(), event);
    return event;
  }

  snapshot() {
    const presentation = hotspotPresentation(this.state);
    return {
      ...this.state,
      events: [...this.state.events],
      inspectedDepots: [...this.state.inspectedDepots],
      triageQueue: this.state.triageQueue.map((parcel) => ({ ...parcel })),
      triageOrder: [...this.state.triageOrder],
      caseData: this.state.caseData ? {
        ...this.state.caseData,
        evidence: [...this.state.caseData.evidence],
        locations: this.state.caseData.locations.map((location) => ({ ...location }))
      } : null,
      stage: getStage(this.state),
      canRun: canRun(this.state),
      activeHotspots: activeHotspots(this.state),
      availableScenes: availableScenes(this.state),
      hotspotLabels: presentation.labels || {},
      hotspotTones: presentation.tones || {},
      hotspotIcons: presentation.icons || {}
    };
  }

  start() {
    if (this.state.started) return false;
    this.state.started = true;
    this.state.score += 40;
    const starts = {
      'first-rounds': ['tour', true, 'First shift started. Begin with the blue Express lane.'],
      northbound: ['protect', false, 'Northbound Express departs at 18:20.'],
      'snow-window': ['weather-scan', true, 'Snow shift started. Inspect all three depots before assigning the spare truck.'],
      'scanner-fever': ['jam-diagnose', true, 'Scanner 2 has stopped. Inspect the machine and the blocked flow.'],
      'priority-parcel': ['case-inspect', true, 'Priority recovery started. Inspect the temperature-controlled parcel trail.']
    };
    const [stage, paused, message] = starts[this.state.shiftId];
    this.state.stage = stage;
    this.state.paused = paused;
    this.emit('start', message);
    return true;
  }

  setPaused(paused) {
    if (!canRun(this.state)) return false;
    this.state.paused = Boolean(paused);
    this.emit(paused ? 'pause' : 'resume', paused ? 'Shift paused.' : `Shift running at ${this.state.speed} times speed.`);
    return true;
  }

  togglePaused() {
    return this.setPaused(!this.state.paused);
  }

  setSpeed(speed) {
    if (!canRun(this.state)) return false;
    this.state.speed = speed === 2 ? 2 : 1;
    this.state.paused = false;
    this.emit('speed', `Shift running at ${this.state.speed} times speed.`);
    return true;
  }

  perform(action, value = null) {
    if (!this.state.started || this.state.completed) return false;
    switch (this.state.shiftId) {
      case 'first-rounds':
        return this.performOnboarding(action);
      case 'northbound':
        return this.performNorthbound(action);
      case 'snow-window':
        return this.performSnow(action, value);
      case 'scanner-fever':
        return this.performScanner(action, value);
      case 'priority-parcel':
        return this.performPriority(action, value);
      default:
        return false;
    }
  }

  performOnboarding(action) {
    if (action === 'inspect-express' && this.state.stage === 'tour') {
      this.state.laneInspected = true;
      this.state.stage = 'coach-move';
      this.state.score += 60;
      this.emit('inspect', 'Express A carries the promises that leave first. Now give it the spare crew.');
      return true;
    }
    if (action === 'move-staff' && this.state.stage === 'coach-move') {
      this.state.staffMoved = true;
      this.state.expressCrew = 4;
      this.state.standardCrew = 2;
      this.state.expressLoad = 38;
      this.state.standardLoad = 44;
      this.state.stage = 'coach-scan';
      this.state.score += 90;
      this.emit('staff', 'Two operators moved to Express A. The blue lane is clearing.');
      return true;
    }
    if (action === 'inspect-scanner' && this.state.stage === 'coach-scan') {
      this.state.scannerInspected = true;
      this.state.stage = 'coach-run';
      this.state.score += 60;
      this.emit('inspect', 'The scanner reads each promise and sends the parcel to its lane. The flow is ready.');
      return true;
    }
    if (action === 'resume' && this.state.stage === 'coach-run') {
      this.state.stage = 'coach-watch';
      this.state.paused = false;
      this.emit('resume', 'Flow running. Watch six parcels reach the correct lane.');
      return true;
    }
    if (action === 'dispatch' && this.state.stage === 'dispatch') return this.finishShift();
    return false;
  }

  performNorthbound(action) {
    if (action === 'move-staff' && !this.state.staffMoved && ['protect', 'investigate'].includes(this.state.stage)) {
      this.state.staffMoved = true;
      this.state.expressCrew = 6;
      this.state.standardCrew = 4;
      this.state.expressLoad = 68;
      this.state.standardLoad = 57;
      this.state.risk = Math.max(9, this.state.risk - 9);
      this.state.backlog = Math.max(70, this.state.backlog - 13);
      this.state.onTime = Math.max(this.state.onTime, 94);
      this.state.stage = 'investigate';
      this.state.score += 180;
      this.emit('staff', 'Two operators moved to Express A. The immediate departure risk is falling.');
      return true;
    }
    if (action === 'hold-truck' && this.state.stage === 'protect' && !this.state.truckHeld) {
      this.state.truckHeld = true;
      this.state.departure += 3;
      this.state.downstreamMargin -= 3;
      this.state.risk = Math.max(12, this.state.risk - 4);
      this.state.score -= 60;
      this.state.stage = 'investigate';
      this.emit('hold', 'Truck held for three minutes. Current parcels gain time; the transfer loses margin.');
      return true;
    }
    if (action === 'trace-package' && this.state.stage === 'investigate' && !this.state.packageSelected) {
      this.state.packageSelected = true;
      this.state.paused = true;
      this.state.stage = 'compare';
      this.state.score += 70;
      this.emit('package', 'Parcel SE-0428-771 selected. The shift paused for inspection.');
      return true;
    }
    if (action === 'find-similar' && this.state.stage === 'compare' && !this.state.signatureFound) {
      this.state.signatureFound = true;
      this.state.stage = 'rule';
      this.state.score += 120;
      this.emit('signature', 'Twelve matching Express parcels share the same after-17:30 fallback rule.');
      return true;
    }
    if (action === 'fix-rule' && this.state.stage === 'rule' && !this.state.ruleFixed) {
      this.state.ruleFixed = true;
      this.state.paused = true;
      this.state.stage = 'verify';
      this.state.score += 300;
      this.state.onTime = Math.max(this.state.onTime, 96);
      this.emit('rule', 'Express service now takes priority over the north-zone fallback. Run the flow to verify it.');
      return true;
    }
    if (action === 'resume' && this.state.stage === 'verify') return this.setPaused(false);
    if (action === 'speed-up' && this.state.stage === 'verify') return this.setSpeed(2);
    if (action === 'dispatch' && this.state.stage === 'dispatch') return this.finishShift();
    return false;
  }

  performSnow(action, value) {
    if (action === 'inspect-depot' && this.state.stage === 'weather-scan') {
      if (!['harnosand', 'timra', 'matfors'].includes(value) || this.state.inspectedDepots.includes(value)) return false;
      this.state.inspectedDepots = [...this.state.inspectedDepots, value];
      const messages = {
        harnosand: 'Härnösand: 14 urgent parcels, including blood samples due at 07:00.',
        timra: 'Timrå: 26 standard parcels. Their promises allow a later departure.',
        matfors: 'Matfors: 9 next-day parcels and the open inland road north.'
      };
      this.state.score += 35;
      if (this.state.inspectedDepots.length === 3) this.state.stage = 'weather-allocate';
      this.emit('inspect', messages[value]);
      return true;
    }
    if (action === 'allocate-truck' && this.state.stage === 'weather-allocate') {
      if (!['harnosand', 'timra', 'matfors'].includes(value)) return false;
      this.state.allocation = value;
      this.state.deliveryTarget = { harnosand: 14, timra: 26, matfors: 9 }[value];
      this.state.risk = value === 'harnosand' ? 9 : 20;
      this.state.score += value === 'harnosand' ? 220 : 70;
      this.state.stage = 'weather-route';
      this.emit('allocate', `The spare truck is assigned to ${value === 'harnosand' ? 'Härnösand' : value === 'timra' ? 'Timrå' : 'Matfors'}. Choose its road.`);
      return true;
    }
    if (action === 'choose-route' && this.state.stage === 'weather-route') {
      if (!['coast', 'inland'].includes(value)) return false;
      this.state.routeChoice = value;
      this.state.stage = 'weather-run';
      this.state.paused = true;
      this.state.risk += value === 'coast' ? 5 : -4;
      this.state.score += value === 'inland' ? 180 : 40;
      this.emit('route', value === 'inland'
        ? 'The truck will detour inland via Matfors. Longer, but open and reliable.'
        : 'The truck will test the snowy coast road. It is shorter, but delay risk remains.');
      return true;
    }
    if (action === 'resume' && this.state.stage === 'weather-run') return this.setPaused(false);
    if (action === 'speed-up' && this.state.stage === 'weather-run') return this.setSpeed(2);
    if (action === 'dispatch' && this.state.stage === 'dispatch') return this.finishShift();
    return false;
  }

  performScanner(action, value) {
    if (action === 'inspect-scanner' && this.state.stage === 'jam-diagnose') {
      this.state.scannerInspected = true;
      this.state.stage = 'jam-triage';
      this.state.score += 75;
      this.emit('inspect', 'A crushed label is blocking Scanner 2. Three promise groups are waiting for manual release.');
      return true;
    }
    if (action === 'prioritize' && this.state.stage === 'jam-triage') {
      const parcel = this.state.triageQueue.find((item) => item.id === value);
      if (!parcel || this.state.triageOrder.includes(value)) return false;
      const expected = [...this.state.triageQueue].sort((a, b) => a.priority - b.priority)[this.state.triageOrder.length];
      this.state.triageOrder = [...this.state.triageOrder, value];
      if (expected.id === value) {
        this.state.score += 70;
      } else {
        this.state.triageMistakes += 1;
        this.state.risk += 2;
        this.state.score -= 25;
      }
      if (this.state.triageOrder.length === this.state.triageQueue.length) this.state.stage = 'jam-repair';
      this.emit('triage', `${parcel.label} released ${this.state.triageOrder.length} of ${this.state.triageQueue.length}.`);
      return true;
    }
    if (action === 'repair-scanner' && this.state.stage === 'jam-repair') {
      this.state.scannerFixed = true;
      this.state.stage = 'jam-run';
      this.state.paused = true;
      this.state.risk = Math.max(2, this.state.risk - 5);
      this.state.onTime = Math.max(97, this.state.onTime);
      this.state.score += 230;
      this.emit('repair', 'Crushed label cleared and Scanner 2 calibrated. Run the queue through it.');
      return true;
    }
    if (action === 'bypass-scanner' && this.state.stage === 'jam-repair') {
      this.state.scannerBypassed = true;
      this.state.stage = 'jam-run';
      this.state.paused = true;
      this.state.risk += 4;
      this.state.onTime = 91;
      this.state.score += 60;
      this.emit('repair', 'The queue is moving through manual scan. It is faster now, but less accurate.');
      return true;
    }
    if (action === 'resume' && this.state.stage === 'jam-run') return this.setPaused(false);
    if (action === 'speed-up' && this.state.stage === 'jam-run') return this.setSpeed(2);
    if (action === 'dispatch' && this.state.stage === 'dispatch') return this.finishShift();
    return false;
  }

  performPriority(action, value) {
    if (action === 'inspect-case' && this.state.stage === 'case-inspect' && !this.state.packageSelected) {
      this.state.packageSelected = true;
      this.state.stage = 'case-clue';
      this.state.score += 80;
      this.emit('package', `${this.state.caseData.parcelId} scan trail opened. Three events narrow down its location.`);
      return true;
    }
    if (action === 'choose-location' && this.state.stage === 'case-clue') {
      if (!this.state.caseData.locations.some((location) => location.id === value)) return false;
      this.state.clueChoice = value;
      this.state.locationCorrect = value === this.state.caseData.correctLocation;
      this.state.stage = 'case-plan';
      this.state.score += this.state.locationCorrect ? 220 : 55;
      this.state.risk += this.state.locationCorrect ? 0 : 2;
      this.emit('deduce', this.state.locationCorrect
        ? 'The scan trail fits. The parcel has been found and secured.'
        : 'The team searched there first, then followed the handheld scan to the parcel. Time was lost.');
      return true;
    }
    if (action === 'choose-recovery' && this.state.stage === 'case-plan') {
      if (!['courier', 'linehaul', 'scheduled'].includes(value)) return false;
      this.state.recoveryChoice = value;
      this.state.stage = 'case-run';
      this.state.paused = true;
      this.state.score += value === 'courier' ? 190 : value === 'linehaul' ? 90 : 20;
      if (value === 'scheduled') this.state.risk += 3;
      this.emit('route', {
        courier: 'A direct courier has the parcel and active temperature control.',
        linehaul: 'The linehaul is held for the handoff. It can make the promise with little margin.',
        scheduled: 'The parcel joins the scheduled transfer. Its delivery promise is now at risk.'
      }[value]);
      return true;
    }
    if (action === 'resume' && this.state.stage === 'case-run') return this.setPaused(false);
    if (action === 'speed-up' && this.state.stage === 'case-run') return this.setSpeed(2);
    if (action === 'dispatch' && this.state.stage === 'dispatch') return this.finishShift();
    return false;
  }

  moveStaff() {
    return this.perform('move-staff');
  }

  holdTruck() {
    return this.perform('hold-truck');
  }

  selectPackage() {
    return this.perform(this.state.shiftId === 'priority-parcel' ? 'inspect-case' : 'trace-package');
  }

  findSimilar() {
    return this.perform('find-similar');
  }

  fixRule() {
    return this.perform('fix-rule');
  }

  completeShift() {
    return this.perform('dispatch');
  }

  tick(realSeconds) {
    if (!this.state.started || this.state.paused || this.state.completed || !canRun(this.state)) return;
    const gameMinutes = Math.max(0, realSeconds) * this.state.speed * 0.24;
    this.state.time += gameMinutes;

    switch (this.state.shiftId) {
      case 'first-rounds':
        this.tickOnboarding(gameMinutes);
        break;
      case 'northbound':
        this.tickNorthbound(gameMinutes);
        break;
      case 'snow-window':
        this.tickSnow(gameMinutes);
        break;
      case 'scanner-fever':
        this.tickScanner(gameMinutes);
        break;
      case 'priority-parcel':
        this.tickPriority(gameMinutes);
        break;
    }

    this.onChange(this.snapshot(), { type: 'tick' });
  }

  tickOnboarding(gameMinutes) {
    this.progressAccumulator += gameMinutes;
    while (this.progressAccumulator >= 0.62 && this.state.verified < ONBOARDING_VERIFY_TARGET) {
      this.progressAccumulator -= 0.62;
      this.state.verified += 1;
      this.state.backlog = Math.max(0, ONBOARDING_VERIFY_TARGET - this.state.verified);
      this.state.score += 12;
    }
    if (this.state.verified === ONBOARDING_VERIFY_TARGET && this.state.stage === 'coach-watch') {
      this.state.stage = 'dispatch';
      this.state.paused = true;
      this.emit('verified', 'Six promises reached the right lane. The morning van is ready.');
    }
  }

  tickNorthbound(gameMinutes) {
    if (this.state.ruleFixed) {
      this.progressAccumulator += gameMinutes;
      while (this.progressAccumulator >= 0.72 && this.state.verified < VERIFY_TARGET) {
        this.progressAccumulator -= 0.72;
        this.state.verified += 1;
        this.state.risk = Math.max(2, this.state.risk - (this.state.verified % 3 === 0 ? 1 : 0));
        this.state.backlog = Math.max(52, this.state.backlog - 1);
        this.state.score += 8;
      }
      if (this.state.verified === VERIFY_TARGET && this.state.stage === 'verify') {
        this.state.onTime = Math.max(this.state.onTime, this.state.staffMoved ? 98 : 95);
        this.state.stage = 'dispatch';
        this.state.paused = true;
        this.emit('verified', 'Twelve later parcels reached Express A correctly. The recurring failure has stopped.');
      }
    }

    const minute = Math.floor(this.state.time);
    while (this.state.lastMinute < minute) {
      this.state.lastMinute += 1;
      this.stepNorthboundMinute();
    }

    if (this.state.time >= this.state.departure && this.state.verified < VERIFY_TARGET) {
      this.state.lateMinutes = Math.floor(this.state.time - this.state.departure) + 1;
      this.state.onTime = clamp(this.state.onTime - 0.18 * gameMinutes, 72, 100);
    }
  }

  stepNorthboundMinute() {
    if (!this.state.staffMoved) {
      this.state.expressLoad = clamp(this.state.expressLoad + 0.55, 0, 100);
      this.state.backlog = clamp(this.state.backlog + 1, 0, 999);
      if (!this.state.ruleFixed && this.state.lastMinute % 3 === 0) {
        this.state.risk = clamp(this.state.risk + 1, 0, 99);
        this.state.onTime = clamp(this.state.onTime - 0.2, 0, 100);
      }
    } else {
      this.state.expressLoad = clamp(this.state.expressLoad - 0.38, 42, 100);
      if (this.state.lastMinute % 2 === 0) this.state.backlog = Math.max(52, this.state.backlog - 1);
      if (this.state.ruleFixed && this.state.lastMinute % 2 === 0) this.state.risk = Math.max(2, this.state.risk - 1);
    }
  }

  tickSnow(gameMinutes) {
    const reliability = this.state.routeChoice === 'inland' ? 1 : 0.62;
    this.progressAccumulator += gameMinutes * reliability;
    while (this.progressAccumulator >= 0.62 && this.state.delivered < this.state.deliveryTarget) {
      this.progressAccumulator -= 0.62;
      this.state.delivered += 1;
      this.state.backlog = Math.max(0, this.state.backlog - 1);
      if (this.state.delivered % 3 === 0) this.state.risk = Math.max(this.state.allocation === 'harnosand' ? 2 : 9, this.state.risk - 1);
      this.state.score += 9;
    }
    this.state.onTime = clamp(72 + (this.state.delivered / Math.max(1, this.state.deliveryTarget)) * 26, 0, 99);
    if (this.state.delivered === this.state.deliveryTarget && this.state.stage === 'weather-run') {
      this.state.stage = 'dispatch';
      this.state.paused = true;
      this.emit('verified', 'The assigned parcels reached their depot. The weather window is closing behind the truck.');
    }
  }

  tickScanner(gameMinutes) {
    const rate = this.state.scannerFixed ? 1 : 0.72;
    this.progressAccumulator += gameMinutes * rate;
    while (this.progressAccumulator >= 0.45 && this.state.processed < 31) {
      this.progressAccumulator -= 0.45;
      this.state.processed += 1;
      this.state.backlog = Math.max(0, 31 - this.state.processed);
      if (this.state.processed % 5 === 0) this.state.risk = Math.max(this.state.scannerFixed ? 1 : 4, this.state.risk - 1);
      this.state.score += this.state.scannerFixed ? 8 : 4;
    }
    if (this.state.processed === 31 && this.state.stage === 'jam-run') {
      this.state.stage = 'dispatch';
      this.state.paused = true;
      this.emit('verified', 'The full queue has cleared. Scanner accuracy is stable.');
    }
  }

  tickPriority(gameMinutes) {
    const rate = { courier: 4.8, linehaul: 3.4, scheduled: 2.35 }[this.state.recoveryChoice] || 0;
    this.state.deliveryProgress = clamp(this.state.deliveryProgress + gameMinutes * rate, 0, 100);
    this.state.backlog = Math.max(0, Math.ceil(this.state.departure - this.state.time));
    if (this.state.time > this.state.departure) {
      this.state.risk = Math.max(2, this.state.risk + gameMinutes * 0.12);
      this.state.onTime = clamp(this.state.onTime - gameMinutes * 0.5, 70, 100);
    }
    if (this.state.deliveryProgress >= 100 && this.state.stage === 'case-run') {
      this.state.deliveryProgress = 100;
      this.state.stage = 'dispatch';
      this.state.paused = true;
      this.emit('verified', 'The recipient has the parcel. Temperature remained inside the safe range.');
    }
  }

  finishShift() {
    if (this.state.completed || this.state.stage !== 'dispatch') return false;
    this.state.completed = true;
    this.state.paused = true;
    this.state.lateMinutes = Math.max(0, Math.floor(this.state.time - this.state.departure));

    if (this.state.shiftId === 'northbound') {
      this.state.time = Math.max(this.state.time, this.state.departure);
      this.state.saved = Math.max(12, 18 - this.state.lateMinutes * 2);
      this.state.risk = Math.max(0, 18 - this.state.saved);
      this.state.backlog = Math.max(48, this.state.backlog - 8);
      this.state.onTime = clamp(this.state.onTime - this.state.lateMinutes * 2, 0, 99);
      if (!this.state.truckHeld) this.state.score += 120;
      if (this.state.lateMinutes === 0) this.state.score += 140;
    } else if (this.state.shiftId === 'first-rounds') {
      this.state.saved = ONBOARDING_VERIFY_TARGET;
      this.state.onTime = 100;
      this.state.score += 120;
    } else if (this.state.shiftId === 'snow-window') {
      this.state.saved = this.state.delivered;
      if (this.state.allocation === 'harnosand') this.state.score += 120;
    } else if (this.state.shiftId === 'scanner-fever') {
      this.state.saved = this.state.processed;
      if (this.state.scannerFixed) this.state.score += 100;
    } else if (this.state.shiftId === 'priority-parcel') {
      this.state.saved = 1;
      this.state.onTime = this.state.recoveryChoice === 'courier' ? 100 : this.state.recoveryChoice === 'linehaul' ? 96 : 86;
    }

    this.state.score = Math.max(0, Math.round(this.state.score));
    this.state.outcome = createOutcome(this.state);
    this.emit('complete', this.state.outcome.summary);
    return true;
  }

  reset() {
    this.state = createInitialState(this.shiftId, this.variant);
    this.progressAccumulator = 0;
    this.emit('reset', 'Shift reset.');
  }
}

export function createOutcome(state) {
  if (state.shiftId === 'first-rounds') {
    return {
      grade: '✓',
      gradeLabel: 'Training complete',
      kicker: 'FIRST SHIFT COMPLETE',
      title: 'You are on the roster.',
      summary: 'You read the flow, moved the team, checked the scanner and sent the van. Four very different shifts are now open.',
      medals: [
        { icon: '1', label: 'First shift' },
        { icon: '↗', label: 'Promises moving' }
      ],
      stats: [
        { label: 'Parcels', value: '6 / 6' },
        { label: 'On time', value: '100%' },
        { label: 'Score', value: state.score.toLocaleString('en-SE') }
      ],
      score: state.score
    };
  }

  if (state.shiftId === 'northbound') {
    const cleanFix = state.ruleFixed && state.staffMoved;
    const onTime = state.lateMinutes === 0;
    const grade = cleanFix && onTime && !state.truckHeld ? 'A+' : cleanFix && onTime ? 'A' : onTime ? 'B' : 'C';
    const medals = [];
    if (state.staffMoved) medals.push({ icon: '↔', label: 'Crew whisperer' });
    if (state.ruleFixed) medals.push({ icon: '◆', label: 'Root cause found' });
    if (!state.truckHeld) medals.push({ icon: '↗', label: 'Clean departure' });
    return {
      grade,
      gradeLabel: `Grade ${grade}`,
      kicker: 'SHIFT COMPLETE',
      title: 'Promises kept.',
      summary: onTime
        ? 'The northbound truck left on time and the recurring routing error is gone.'
        : `The error is gone. The truck left ${state.lateMinutes} minutes late, with recovery already under way.`,
      medals,
      stats: [
        { label: 'Saved', value: String(state.saved) },
        { label: 'On time', value: `${Math.round(state.onTime)}%` },
        { label: 'Score', value: state.score.toLocaleString('en-SE') }
      ],
      score: state.score
    };
  }

  if (state.shiftId === 'snow-window') {
    const urgentFirst = state.allocation === 'harnosand';
    const reliableRoute = state.routeChoice === 'inland';
    const grade = urgentFirst && reliableRoute ? 'A+' : urgentFirst || reliableRoute ? 'A' : 'B';
    return {
      grade,
      gradeLabel: `Grade ${grade}`,
      kicker: 'WEATHER WINDOW CLOSED',
      title: urgentFirst ? 'The urgent load got through.' : 'The network adapted.',
      summary: urgentFirst
        ? 'The spare truck protected the most time-sensitive promises before the snow closed in.'
        : 'The assigned route moved, but the urgent Härnösand promises needed a second recovery plan.',
      medals: [
        reliableRoute ? { icon: '⌁', label: 'Inland navigator' } : { icon: '❄', label: 'Snow runner' },
        urgentFirst ? { icon: '◇', label: 'Urgent first' } : { icon: '▰', label: 'Capacity moved' }
      ],
      stats: [
        { label: 'Delivered', value: String(state.delivered) },
        { label: 'Coverage', value: `${Math.round(state.onTime)}%` },
        { label: 'Score', value: state.score.toLocaleString('en-SE') }
      ],
      score: state.score
    };
  }

  if (state.shiftId === 'scanner-fever') {
    const grade = state.scannerFixed && state.triageMistakes === 0 ? 'A+' : state.scannerFixed ? 'A' : state.triageMistakes <= 1 ? 'B' : 'C';
    return {
      grade,
      gradeLabel: `Grade ${grade}`,
      kicker: 'QUEUE CLEARED',
      title: state.scannerFixed ? 'Scanner 2 is healthy.' : 'Manual flow held the line.',
      summary: state.scannerFixed
        ? 'The right promises moved first, the obstruction is gone and automated accuracy is restored.'
        : 'The queue moved, but the next shift still needs to repair and recalibrate the scanner.',
      medals: [
        state.triageMistakes === 0 ? { icon: '1', label: 'Perfect priority' } : { icon: '▦', label: 'Queue cleared' },
        state.scannerFixed ? { icon: '◆', label: 'Clean repair' } : { icon: '↔', label: 'Manual recovery' }
      ],
      stats: [
        { label: 'Processed', value: String(state.processed) },
        { label: 'Accuracy', value: `${Math.round(state.onTime)}%` },
        { label: 'Score', value: state.score.toLocaleString('en-SE') }
      ],
      score: state.score
    };
  }

  const correctFind = state.locationCorrect;
  const direct = state.recoveryChoice === 'courier';
  const grade = correctFind && direct ? 'A+' : correctFind || direct ? 'A' : state.recoveryChoice === 'linehaul' ? 'B' : 'C';
  return {
    grade,
    gradeLabel: `Grade ${grade}`,
    kicker: 'DELIVERY CONFIRMED',
    title: 'Cold chain intact.',
    summary: correctFind && direct
      ? 'The scan trail led straight to the parcel and a direct courier protected every minute of its promise.'
      : 'The parcel arrived safely. The recovery took a detour, but its temperature stayed inside range.',
    medals: [
      correctFind ? { icon: '◇', label: 'Sharp detective' } : { icon: '□', label: 'Parcel recovered' },
      direct ? { icon: '↗', label: 'Direct handoff' } : { icon: '⌁', label: 'Connection made' }
    ],
    stats: [
      { label: 'Delivered', value: '1 / 1' },
      { label: 'Cold chain', value: `${Math.round(state.onTime)}%` },
      { label: 'Score', value: state.score.toLocaleString('en-SE') }
    ],
    score: state.score
  };
}
