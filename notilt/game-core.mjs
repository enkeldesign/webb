const HALF_PI = Math.PI / 2;

export const FLOW_STAGES = Object.freeze([
  Object.freeze({ level: 1, name: 'STEADY', threshold: 0, multiplier: 1 }),
  Object.freeze({ level: 2, name: 'LOCKED IN', threshold: 7, multiplier: 2 }),
  Object.freeze({ level: 3, name: 'FLOW STATE', threshold: 17, multiplier: 3 }),
  Object.freeze({ level: 4, name: 'ELECTRIC', threshold: 30, multiplier: 4 }),
  Object.freeze({ level: 5, name: 'NO TILT', threshold: 46, multiplier: 5 })
]);

export const MODE_CONFIGS = Object.freeze({
  easy: Object.freeze({
    id: 'easy',
    name: 'EASY',
    objectName: 'THE BROOM',
    failAngle: 0.94,
    gravity: 2.35,
    control: 6.8,
    damping: 1.32,
    maxAngularSpeed: 2.8,
    windStrength: 0.17,
    windMinSeconds: 2.4,
    windMaxSeconds: 4.4,
    initialLean: 0.025,
    scoreRate: 92,
    projectiles: false
  }),
  medium: Object.freeze({
    id: 'medium',
    name: 'MEDIUM',
    objectName: 'MARKER ON MARKER',
    failAngle: 0.76,
    gravity: 3.05,
    control: 7.25,
    damping: 1.16,
    maxAngularSpeed: 3.25,
    windStrength: 0.3,
    windMinSeconds: 1.8,
    windMaxSeconds: 3.5,
    initialLean: 0.034,
    scoreRate: 112,
    projectiles: false
  }),
  hard: Object.freeze({
    id: 'hard',
    name: 'HARD',
    objectName: 'THE SIGNAL',
    failAngle: 0.8,
    gravity: 3.45,
    control: 7.65,
    damping: 1.08,
    maxAngularSpeed: 3.6,
    windStrength: 0.38,
    windMinSeconds: 1.55,
    windMaxSeconds: 3.1,
    initialLean: 0.036,
    scoreRate: 132,
    projectiles: true
  })
});

export function createRunState(modeId = 'easy', seed = randomSeed()) {
  const config = getModeConfig(modeId);
  const normalizedSeed = normalizeSeed(seed);
  const state = {
    modeId: config.id,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    time: 0,
    score: 0,
    flow: 0,
    stage: 0,
    stability: 1,
    danger: 0,
    angleX: 0,
    angleY: 0,
    angularVelocityX: 0,
    angularVelocityY: 0,
    windX: 0,
    windY: 0,
    windTargetX: 0,
    windTargetY: 0,
    windTimer: 0.9,
    nearSaveArmed: false,
    lastNearSaveAt: -99,
    jumpY: 0,
    jumpVelocity: 0,
    jumpCooldown: 0,
    projectileTimer: config.projectiles ? 4.2 : Infinity,
    projectiles: [],
    projectileSequence: 0,
    failed: false,
    failureReason: '',
    lastInputX: 0,
    lastInputY: 0
  };

  const direction = nextRandom(state) < 0.5 ? -1 : 1;
  state.angleX = direction * config.initialLean * (0.72 + nextRandom(state) * 0.56);
  state.angleY = (nextRandom(state) - 0.5) * config.initialLean * 0.7;
  state.angularVelocityX = direction * 0.015;
  return state;
}

export function stepBalance(state, input = {}, deltaSeconds = 1 / 60) {
  if (!state || state.failed) return [];
  const config = getModeConfig(state.modeId);
  const dt = clamp(Number(deltaSeconds) || 0, 0, 1 / 20);
  if (dt <= 0) return [];
  const events = [];

  state.time += dt;
  state.jumpCooldown = Math.max(0, state.jumpCooldown - dt);
  state.lastInputX = clamp(Number(input.x) || 0, -1, 1);
  state.lastInputY = clamp(Number(input.y) || 0, -1, 1);

  updateWind(state, config, dt);
  updateJump(state, config, Boolean(input.jump), dt, events);

  const intensity = 1 + Math.min(0.48, state.time * 0.0035 + state.stage * 0.035);
  const accelerationX = config.gravity * Math.sin(state.angleX) * intensity
    + state.lastInputX * config.control
    + state.windX;
  const accelerationY = config.gravity * Math.sin(state.angleY) * intensity
    + state.lastInputY * config.control
    + state.windY;

  state.angularVelocityX += accelerationX * dt;
  state.angularVelocityY += accelerationY * dt;
  const damping = Math.exp(-config.damping * dt);
  state.angularVelocityX *= damping;
  state.angularVelocityY *= damping;
  state.angularVelocityX = clamp(
    state.angularVelocityX,
    -config.maxAngularSpeed,
    config.maxAngularSpeed
  );
  state.angularVelocityY = clamp(
    state.angularVelocityY,
    -config.maxAngularSpeed,
    config.maxAngularSpeed
  );
  state.angleX = clamp(state.angleX + state.angularVelocityX * dt, -HALF_PI, HALF_PI);
  state.angleY = clamp(state.angleY + state.angularVelocityY * dt, -HALF_PI, HALF_PI);

  if (config.projectiles) updateProjectiles(state, config, dt, events);
  updateFlow(state, config, dt, events);

  const lean = Math.hypot(state.angleX, state.angleY);
  if (lean >= config.failAngle) {
    state.failed = true;
    state.failureReason = 'tilt';
    events.push({ type: 'fall', reason: 'tilt' });
  }
  return events;
}

export function applyImpact(state, direction = 1, strength = 1) {
  if (!state || state.failed) return;
  const side = Math.sign(Number(direction) || 1);
  const amount = clamp(Number(strength) || 1, 0.2, 2.5);
  state.angularVelocityX += side * 1.06 * amount;
  state.angularVelocityY += (nextRandom(state) - 0.5) * 0.72 * amount;
  state.flow = Math.max(0, state.flow - 10 * amount);
  state.nearSaveArmed = true;
}

export function awardDodge(state) {
  if (!state || state.failed) return;
  const stage = FLOW_STAGES[state.stage] || FLOW_STAGES[0];
  state.flow = Math.min(64, state.flow + 5.5);
  state.score += 180 * stage.multiplier;
}

export function stageForFlow(flow) {
  const value = Math.max(0, Number(flow) || 0);
  let stage = 0;
  for (let index = 1; index < FLOW_STAGES.length; index += 1) {
    if (value >= FLOW_STAGES[index].threshold) stage = index;
  }
  return stage;
}

export function getModeConfig(modeId) {
  return MODE_CONFIGS[modeId] || MODE_CONFIGS.easy;
}

export function formatRunTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return minutes > 0
    ? `${minutes}:${remainder.toFixed(1).padStart(4, '0')}`
    : `${remainder.toFixed(1)}s`;
}

export function createRunSnapshot(state, frames = []) {
  const config = getModeConfig(state?.modeId);
  return Object.freeze({
    version: 1,
    mode: config.id,
    seed: normalizeSeed(state?.seed),
    time: round(Number(state?.time) || 0, 3),
    score: Math.max(0, Math.round(Number(state?.score) || 0)),
    maxCombo: Math.max(1, Number(state?.maxStageReached || state?.stage || 0) + 1),
    recordedAt: new Date().toISOString(),
    frames: Array.isArray(frames) ? frames.slice(0, 4800) : []
  });
}

function updateWind(state, config, dt) {
  state.windTimer -= dt;
  if (state.windTimer <= 0) {
    const stageIntensity = 1 + state.stage * 0.13 + Math.min(0.5, state.time / 120);
    const angle = nextRandom(state) * Math.PI * 2;
    const magnitude = config.windStrength * stageIntensity * (0.45 + nextRandom(state) * 0.55);
    state.windTargetX = Math.cos(angle) * magnitude;
    state.windTargetY = Math.sin(angle) * magnitude;
    state.windTimer = mix(config.windMinSeconds, config.windMaxSeconds, nextRandom(state));
  }
  const follow = 1 - Math.exp(-dt * 1.45);
  state.windX += (state.windTargetX - state.windX) * follow;
  state.windY += (state.windTargetY - state.windY) * follow;
}

function updateJump(state, config, requested, dt, events) {
  if (config.projectiles && requested && state.jumpY <= 0.001 && state.jumpCooldown <= 0) {
    state.jumpVelocity = 5.35;
    state.jumpCooldown = 0.56;
    state.angularVelocityX += state.lastInputX * 0.08;
    state.angularVelocityY += state.lastInputY * 0.08;
    events.push({ type: 'jump' });
  }

  if (state.jumpY > 0 || state.jumpVelocity > 0) {
    state.jumpVelocity -= 13.8 * dt;
    state.jumpY += state.jumpVelocity * dt;
    if (state.jumpY <= 0) {
      const landedHard = state.jumpVelocity < -4.4;
      state.jumpY = 0;
      state.jumpVelocity = 0;
      if (landedHard) events.push({ type: 'land' });
    }
  }
}

function updateProjectiles(state, config, dt, events) {
  state.projectileTimer -= dt;
  if (state.projectileTimer <= 0) {
    const side = nextRandom(state) < 0.5 ? -1 : 1;
    const speed = 3.45 + Math.min(2.35, state.time * 0.018 + state.stage * 0.18);
    const projectile = {
      id: ++state.projectileSequence,
      x: side * 6.8,
      velocity: -side * speed,
      side,
      resolved: false,
      hit: false
    };
    state.projectiles.push(projectile);
    state.projectileTimer = Math.max(1.35, 3.5 - state.time * 0.015 - state.stage * 0.12)
      + nextRandom(state) * 0.72;
    events.push({ type: 'projectile', side });
  }

  for (const projectile of state.projectiles) {
    const previousX = projectile.x;
    projectile.x += projectile.velocity * dt;
    const crossedCenter = previousX === 0 || Math.sign(previousX) !== Math.sign(projectile.x);
    if (!projectile.resolved && (Math.abs(projectile.x) < 0.34 || crossedCenter)) {
      projectile.resolved = true;
      if (state.jumpY >= 0.7) {
        awardDodge(state);
        events.push({ type: 'dodge', side: projectile.side });
      } else {
        projectile.hit = true;
        applyImpact(state, -projectile.side, 1);
        events.push({ type: 'hit', side: projectile.side });
      }
    }
  }
  state.projectiles = state.projectiles.filter((projectile) => Math.abs(projectile.x) < 7.7);
}

function updateFlow(state, config, dt, events) {
  const previousStage = state.stage;
  const leanRatio = Math.hypot(state.angleX, state.angleY) / config.failAngle;
  state.stability = 1 - clamp(leanRatio, 0, 1);
  state.danger = smoothstep(0.56, 1, leanRatio);

  if (leanRatio < 0.58) {
    state.flow += dt * (0.72 + state.stability * 0.86);
  } else {
    state.flow -= dt * (leanRatio > 0.82 ? 5.2 : 1.25);
  }
  state.flow = clamp(state.flow, 0, 64);

  if (leanRatio > 0.78) state.nearSaveArmed = true;
  if (
    state.nearSaveArmed
    && leanRatio < 0.42
    && state.time - state.lastNearSaveAt > 1.2
  ) {
    state.nearSaveArmed = false;
    state.lastNearSaveAt = state.time;
    state.flow = Math.min(64, state.flow + 3.2);
    state.score += 120 * FLOW_STAGES[state.stage].multiplier;
    events.push({ type: 'save' });
  }

  state.stage = stageForFlow(state.flow);
  state.maxStageReached = Math.max(state.maxStageReached || 0, state.stage);
  if (state.stage > previousStage) {
    events.push({ type: 'stage', stage: state.stage });
  }

  const multiplier = FLOW_STAGES[state.stage].multiplier;
  const controlQuality = 0.42 + state.stability * 0.58;
  state.score += dt * config.scoreRate * multiplier * controlQuality;
}

function nextRandom(state) {
  let value = normalizeSeed(state.rngState);
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngState = value >>> 0 || 0x6d2b79f5;
  return state.rngState / 0x100000000;
}

function normalizeSeed(seed) {
  const number = Number(seed);
  if (!Number.isFinite(number)) return 0x6d2b79f5;
  return (Math.floor(number) >>> 0) || 0x6d2b79f5;
}

function randomSeed() {
  const array = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(array);
  return array[0] || ((Date.now() * 2654435761) >>> 0);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, precision) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}
