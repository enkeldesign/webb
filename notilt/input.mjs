const DEG = Math.PI / 180;
const MOTION_SAMPLE_STALE_MS = 320;

export class NoTiltInput {
  constructor({ onModeChange, onJumpSignal } = {}) {
    this.onModeChange = onModeChange;
    this.onJumpSignal = onJumpSignal;
    this.mode = 'idle';
    this.pose = null;
    this.neutral = null;
    this.manual = { x: 0, y: 0 };
    this.smoothed = { x: 0, y: 0 };
    this.jumpQueued = false;
    this.lastJumpAt = -Infinity;
    this.lastMotionAt = 0;
    this.lastLinearY = 0;
    this.gravityBaselineY = null;
    this.motionPermission = 'unknown';
    this.boundMotion = (event) => this.handleMotion(event);
    this.boundOrientation = (event) => this.handleOrientation(event);
  }

  static supportsMotion(environment = globalThis) {
    return Boolean(environment?.DeviceMotionEvent || environment?.DeviceOrientationEvent);
  }

  async enableMotion() {
    const environment = globalThis;
    if (!NoTiltInput.supportsMotion(environment)) {
      this.enableManual();
      return { granted: false, reason: 'unsupported' };
    }

    try {
      const MotionEvent = environment.DeviceMotionEvent;
      const OrientationEvent = environment.DeviceOrientationEvent;
      let result = 'granted';

      if (typeof MotionEvent?.requestPermission === 'function') {
        result = await MotionEvent.requestPermission();
      } else if (typeof OrientationEvent?.requestPermission === 'function') {
        result = await OrientationEvent.requestPermission();
      }

      if (result !== 'granted') {
        this.motionPermission = 'denied';
        this.enableManual();
        return { granted: false, reason: 'denied' };
      }
    } catch (error) {
      this.motionPermission = 'denied';
      this.enableManual();
      return { granted: false, reason: 'error', error };
    }

    this.detachListeners();
    environment.addEventListener?.('devicemotion', this.boundMotion, { passive: true });
    environment.addEventListener?.('deviceorientation', this.boundOrientation, { passive: true });
    this.motionPermission = 'granted';
    this.setMode('motion');
    return { granted: true, reason: 'granted' };
  }

  enableManual() {
    this.setMode('manual');
    this.neutral = null;
    this.smoothed.x = 0;
    this.smoothed.y = 0;
    return { granted: true, reason: 'manual' };
  }

  calibrate() {
    if (this.mode !== 'motion' || !this.pose) return false;
    this.neutral = { roll: this.pose.roll, pitch: this.pose.pitch };
    this.smoothed.x = 0;
    this.smoothed.y = 0;
    return true;
  }

  getVector(deltaSeconds = 1 / 60) {
    const dt = Math.min(0.05, Math.max(0, Number(deltaSeconds) || 0));
    let targetX = 0;
    let targetY = 0;

    if (this.mode === 'manual') {
      targetX = this.manual.x;
      targetY = this.manual.y;
    } else if (this.mode === 'motion' && this.pose && this.neutral) {
      targetX = shapeAxis(shortestAngle(this.neutral.roll, this.pose.roll) / (17 * DEG));
      targetY = shapeAxis(shortestAngle(this.neutral.pitch, this.pose.pitch) / (13 * DEG));
    }

    const response = 1 - Math.exp(-dt * (this.mode === 'manual' ? 14 : 10));
    this.smoothed.x += (targetX - this.smoothed.x) * response;
    this.smoothed.y += (targetY - this.smoothed.y) * response;
    return { x: this.smoothed.x, y: this.smoothed.y };
  }

  setManualVector(x, y) {
    this.manual.x = clamp(Number(x) || 0, -1, 1);
    this.manual.y = clamp(Number(y) || 0, -1, 1);
  }

  queueJump(source = 'button') {
    const now = performance.now();
    if (now - this.lastJumpAt < 360) return false;
    this.lastJumpAt = now;
    this.jumpQueued = true;
    this.onJumpSignal?.(source);
    return true;
  }

  consumeJump() {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  hasFreshPose(maxAgeMs = 1000) {
    return Boolean(this.pose && performance.now() - this.pose.at <= maxAgeMs);
  }

  getMode() {
    return this.mode;
  }

  destroy() {
    this.detachListeners();
    this.mode = 'idle';
  }

  handleMotion(event) {
    const pose = poseFromGravity(event?.accelerationIncludingGravity);
    if (pose) {
      this.pose = { ...pose, at: performance.now(), source: 'gravity' };
      this.lastMotionAt = this.pose.at;
      if (!this.neutral && this.mode === 'motion') this.calibrate();
    }

    const screenAcceleration = screenSpaceVector(event?.acceleration);
    const gravityAcceleration = screenSpaceVector(event?.accelerationIncludingGravity);
    const linearY = Number(screenAcceleration?.y);
    let verticalImpulse = Number.isFinite(linearY) ? Math.abs(linearY) : 0;

    if (gravityAcceleration && Number.isFinite(gravityAcceleration.y)) {
      if (!Number.isFinite(this.gravityBaselineY)) this.gravityBaselineY = gravityAcceleration.y;
      this.gravityBaselineY += (gravityAcceleration.y - this.gravityBaselineY) * 0.08;
      verticalImpulse = Math.max(verticalImpulse, Math.abs(gravityAcceleration.y - this.gravityBaselineY));
    }

    const jerk = Math.abs((Number.isFinite(linearY) ? linearY : 0) - this.lastLinearY);
    this.lastLinearY = Number.isFinite(linearY) ? linearY : this.lastLinearY * 0.8;
    if (verticalImpulse >= 2.85 && (jerk >= 0.65 || verticalImpulse >= 4.4)) {
      this.queueJump('lift');
    }
  }

  handleOrientation(event) {
    if (performance.now() - this.lastMotionAt < MOTION_SAMPLE_STALE_MS) return;
    const gamma = Number(event?.gamma);
    const beta = Number(event?.beta);
    if (!Number.isFinite(gamma) || !Number.isFinite(beta)) return;

    const screenAngle = getScreenOrientationAngle();
    const portraitSign = Math.cos(screenAngle) < 0 ? -1 : 1;
    this.pose = {
      roll: gamma * DEG * portraitSign,
      pitch: beta * DEG * portraitSign,
      at: performance.now(),
      source: 'orientation'
    };
    if (!this.neutral && this.mode === 'motion') this.calibrate();
  }

  setMode(nextMode) {
    if (this.mode === nextMode) return;
    this.mode = nextMode;
    this.onModeChange?.(nextMode);
  }

  detachListeners() {
    globalThis.removeEventListener?.('devicemotion', this.boundMotion);
    globalThis.removeEventListener?.('deviceorientation', this.boundOrientation);
  }
}

function poseFromGravity(gravity) {
  const vector = screenSpaceVector(gravity);
  if (!vector) return null;
  const planarGravity = Math.hypot(vector.x, vector.y);
  const totalGravity = Math.hypot(planarGravity, vector.z);
  if (totalGravity < 1.4 || planarGravity < 0.8) return null;

  let roll = normalizeAngle(Math.atan2(vector.x, -vector.y));
  if (roll > Math.PI / 2) roll -= Math.PI;
  if (roll < -Math.PI / 2) roll += Math.PI;
  return {
    roll,
    pitch: Math.atan2(vector.z, planarGravity)
  };
}

function screenSpaceVector(vector) {
  if (!vector) return null;
  const x = Number(vector.x);
  const y = Number(vector.y);
  const z = Number(vector.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  const angle = getScreenOrientationAngle();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos + y * sin,
    y: -x * sin + y * cos,
    z
  };
}

function getScreenOrientationAngle() {
  const degrees = Number.isFinite(globalThis.screen?.orientation?.angle)
    ? globalThis.screen.orientation.angle
    : Number(globalThis.orientation || 0);
  return (Number.isFinite(degrees) ? degrees : 0) * DEG;
}

function shapeAxis(value) {
  const clamped = clamp(Number(value) || 0, -1, 1);
  const magnitude = Math.abs(clamped);
  if (magnitude < 0.035) return 0;
  const normalized = (magnitude - 0.035) / 0.965;
  const eased = normalized * normalized * (3 - 2 * normalized);
  return Math.sign(clamped) * eased;
}

function shortestAngle(from, to) {
  return normalizeAngle(to - from);
}

function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
