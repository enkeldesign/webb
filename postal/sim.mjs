export const INITIAL_TIME = 17 * 60 + 42;
export const BASE_DEPARTURE = 18 * 60 + 20;
export const VERIFY_TARGET = 12;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function formatClock(totalMinutes) {
  const rounded = Math.floor(totalMinutes);
  const hours = Math.floor(rounded / 60) % 24;
  const minutes = rounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getStage(state) {
  if (state.completed) return 'complete';
  if (!state.started) return 'brief';
  if (!state.staffMoved && !state.truckHeld) return 'protect';
  if (!state.packageSelected) return 'investigate';
  if (!state.signatureFound) return 'compare';
  if (!state.ruleFixed) return 'rule';
  if (state.verified < VERIFY_TARGET) return 'verify';
  return 'dispatch';
}

export function createInitialState() {
  return {
    started: false,
    completed: false,
    paused: true,
    speed: 1,
    time: INITIAL_TIME,
    departure: BASE_DEPARTURE,
    staffMoved: false,
    truckHeld: false,
    packageSelected: false,
    signatureFound: false,
    ruleFixed: false,
    verified: 0,
    expressCrew: 4,
    standardCrew: 6,
    expressLoad: 92,
    standardLoad: 43,
    backlog: 84,
    risk: 18,
    onTime: 91,
    downstreamMargin: 10,
    lateMinutes: 0,
    saved: 0,
    score: 600,
    lastMinute: Math.floor(INITIAL_TIME),
    outcome: null,
    events: []
  };
}

export class ShiftSimulation {
  constructor(onChange = () => {}) {
    this.state = createInitialState();
    this.onChange = onChange;
    this.verificationAccumulator = 0;
  }

  emit(type, message = '') {
    const event = { type, message, at: formatClock(this.state.time) };
    this.state.events = [...this.state.events.slice(-11), event];
    this.onChange(this.snapshot(), event);
    return event;
  }

  snapshot() {
    return { ...this.state, events: [...this.state.events], stage: getStage(this.state) };
  }

  start() {
    if (this.state.started) return;
    this.state.started = true;
    this.state.paused = false;
    this.state.score += 40;
    this.emit('start', 'Shift started. Northbound Express departs at 18:20.');
  }

  setPaused(paused) {
    if (!this.state.started || this.state.completed) return;
    this.state.paused = Boolean(paused);
    this.emit(paused ? 'pause' : 'resume', paused ? 'Shift paused.' : `Shift running at ${this.state.speed} times speed.`);
  }

  togglePaused() {
    this.setPaused(!this.state.paused);
  }

  setSpeed(speed) {
    if (!this.state.started || this.state.completed) return;
    this.state.speed = speed === 2 ? 2 : 1;
    this.state.paused = false;
    this.emit('speed', `Shift running at ${this.state.speed} times speed.`);
  }

  moveStaff() {
    if (this.state.staffMoved || this.state.completed) return false;
    this.state.staffMoved = true;
    this.state.expressCrew = 6;
    this.state.standardCrew = 4;
    this.state.expressLoad = 68;
    this.state.standardLoad = 57;
    this.state.risk = Math.max(9, this.state.risk - 9);
    this.state.backlog = Math.max(70, this.state.backlog - 13);
    this.state.onTime = Math.max(this.state.onTime, 94);
    this.state.score += 180;
    this.emit('staff', 'Two operators moved to Express A. The immediate departure risk is falling.');
    return true;
  }

  holdTruck() {
    if (this.state.truckHeld || this.state.completed) return false;
    this.state.truckHeld = true;
    this.state.departure += 3;
    this.state.downstreamMargin -= 3;
    this.state.risk = Math.max(12, this.state.risk - 4);
    this.state.score -= 60;
    this.emit('hold', 'Northbound truck held for three minutes. Current parcels gain time; the Härnösand transfer loses margin.');
    return true;
  }

  selectPackage() {
    if (!this.state.started || this.state.completed) return false;
    this.state.packageSelected = true;
    this.state.paused = true;
    this.state.score += 70;
    this.emit('package', 'Parcel SE-0428-771 selected. The shift paused for inspection.');
    return true;
  }

  findSimilar() {
    if (!this.state.packageSelected || this.state.signatureFound || this.state.completed) return false;
    this.state.signatureFound = true;
    this.state.score += 120;
    this.emit('signature', 'Twelve matching Express parcels share the same after-17:30 fallback rule.');
    return true;
  }

  fixRule() {
    if (!this.state.signatureFound || this.state.ruleFixed || this.state.completed) return false;
    this.state.ruleFixed = true;
    this.state.paused = true;
    this.state.score += 300;
    this.state.onTime = Math.max(this.state.onTime, 96);
    this.emit('rule', 'Express service now takes priority over the north-zone fallback. Run the flow to verify the change.');
    return true;
  }

  tick(realSeconds) {
    if (!this.state.started || this.state.paused || this.state.completed) return;
    const gameMinutes = Math.max(0, realSeconds) * this.state.speed * 0.24;
    this.state.time += gameMinutes;

    if (this.state.ruleFixed) {
      this.verificationAccumulator += gameMinutes;
      while (this.verificationAccumulator >= 0.72 && this.state.verified < VERIFY_TARGET) {
        this.verificationAccumulator -= 0.72;
        this.state.verified += 1;
        this.state.risk = Math.max(2, this.state.risk - (this.state.verified % 3 === 0 ? 1 : 0));
        this.state.backlog = Math.max(52, this.state.backlog - 1);
        this.state.score += 8;
        if (this.state.verified === VERIFY_TARGET) {
          this.state.onTime = Math.max(this.state.onTime, this.state.staffMoved ? 98 : 95);
          this.emit('verified', 'Twelve new matching parcels reached Express A correctly. The recurring failure has stopped.');
        }
      }
    }

    const minute = Math.floor(this.state.time);
    while (this.state.lastMinute < minute) {
      this.state.lastMinute += 1;
      this.stepMinute();
    }

    if (this.state.time >= this.state.departure && this.state.verified < VERIFY_TARGET) {
      this.state.lateMinutes = Math.floor(this.state.time - this.state.departure) + 1;
      this.state.onTime = clamp(this.state.onTime - 0.18 * gameMinutes, 72, 100);
    }

    this.onChange(this.snapshot(), { type: 'tick' });
  }

  stepMinute() {
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

  completeShift() {
    if (this.state.completed || this.state.verified < VERIFY_TARGET) return false;
    this.state.completed = true;
    this.state.paused = true;
    this.state.time = Math.max(this.state.time, this.state.departure);
    this.state.lateMinutes = Math.max(0, Math.floor(this.state.time - this.state.departure));
    this.state.saved = Math.max(12, 18 - this.state.lateMinutes * 2);
    this.state.risk = Math.max(0, 18 - this.state.saved);
    this.state.backlog = Math.max(48, this.state.backlog - 8);
    this.state.onTime = clamp(this.state.onTime - this.state.lateMinutes * 2, 0, 99);
    if (!this.state.truckHeld) this.state.score += 120;
    if (this.state.lateMinutes === 0) this.state.score += 140;
    this.state.score = Math.max(0, Math.round(this.state.score));
    this.state.outcome = createOutcome(this.state);
    this.emit('complete', this.state.outcome.summary);
    return true;
  }

  reset() {
    this.state = createInitialState();
    this.verificationAccumulator = 0;
    this.emit('reset', 'Shift reset.');
  }
}

export function createOutcome(state) {
  const cleanFix = state.ruleFixed && state.staffMoved;
  const onTime = state.lateMinutes === 0;
  const grade = cleanFix && onTime && !state.truckHeld ? 'A+' : cleanFix && onTime ? 'A' : onTime ? 'B' : 'C';
  const medals = [];
  if (state.staffMoved) medals.push({ icon: '↔', label: 'Crew whisperer' });
  if (state.ruleFixed) medals.push({ icon: '◆', label: 'Root cause found' });
  if (!state.truckHeld) medals.push({ icon: '↗', label: 'Clean departure' });
  return {
    grade,
    medals,
    summary: onTime
      ? 'The northbound truck left on time and the recurring routing error is gone.'
      : `The routing error is gone. The truck left ${state.lateMinutes} minutes late, with the next shift set up to recover.`,
    saved: state.saved,
    onTime: Math.round(state.onTime),
    score: state.score
  };
}
