// DRIFT and BOOST effects (#1209): what the car leaves behind while it slides or burns
// BOOST, drawn in two draw calls in all. Everything is allocated once and reused: no
// object is created per frame, and nothing runs outside the race frame (main.js calls
// update() from updateScene, so a paused race freezes the effects with it).
//
// - BOOST: two tapered wakes on the road behind the car, one per rear corner, built
//   from where the car has just been. Faster leaves a longer wake. A new burst flares
//   wider at once and kicks the camera a little (render/camera.js applies the kick).
// - OVERCHARGE (BOOST spending charge beyond full): the wakes take the OVERCHARGE
//   colours from the design tokens, run wider and longer, and pulse backwards; the
//   kick is stronger. Colour is never the only difference.
// - DRIFT: faceted smoke puffs from the rear tyres that rise, swell and fade, more of
//   them the harder the car slides. The dark skid marks stay as they are (main.js).
//
// Low Graphics keeps the wakes (one draw call) and thins the smoke.

const WAKE_SECTIONS = 16;
const WAKE_VERTICES_PER_SECTION = 3;
const WAKE_SAMPLE_SECONDS = 1 / 60;
const WAKE_SECONDS = 0.17;
const OVERCHARGE_WAKE_SECONDS = 0.26;
const WAKE_HALF_WIDTH = 0.56;
const OVERCHARGE_WIDTH = 1.35;
const WAKE_SIDE_OFFSET = 0.78;
const WAKE_REAR_OFFSET = 2.6;
// Above the car's resting height on the road at that point (tracks/elevation.js). That
// height is at or above every track's road deck to within 0.15 m (MOUNTAIN's steepest
// descent), so the wake clears the asphalt everywhere.
const WAKE_LIFT = 0.2;
const PUFF_LIFT = 0.3;
const FLARE_SECONDS = 0.28;
const FLARE_WIDTH = 0.45;

// Degrees of extra field of view at the start of a burst (render/camera.js).
export const BOOST_CAMERA_KICK_DEGREES = 2.5;
export const OVERCHARGE_CAMERA_KICK_DEGREES = 5;
const KICK_ATTACK_SECONDS = 0.08;
const KICK_DECAY_SECONDS = 0.32;
// Letting go of BOOST, or running dry, eases the kick away rather than snapping the
// view back: from wherever it was, gently at first, gone after this long.
const KICK_RELEASE_SECONDS = 0.25;

const PUFFS = 40;
const LOW_GRAPHICS_PUFFS = 20;
const PUFF_INTERVAL = 0.05;
const LOW_GRAPHICS_PUFF_INTERVAL = 0.1;
const PUFF_LIFE = 0.85;
const PUFF_START_ALPHA = 0.34;
const OVERCHARGE_SPARK_PUFFS = 6;

// Only for a page without the design tokens (tests, tools): the tokens' sRGB values.
const TOKEN_FALLBACKS = Object.freeze({
  '--turn-effect-boost': '#ffd43b',
  '--turn-effect-boost-tail': '#ff922b',
  '--turn-effect-turbo': '#ff6b6b',
  '--turn-effect-turbo-tail': '#ff7b54',
  '--turn-effect-drift-smoke': '#d9d4cc',
  '--turn-control-overcharge': '#8b5cf6',
  '--turn-control-overcharge-light': '#d0bfff',
  '--turn-control-overcharge-deep': '#5f3dc4'
});

// The effect roles and the OVERCHARGE palette from the design tokens (design-tokens.css).
// The effect roles are not dimmed by dark mode: the road keeps its daylight colours.
export function readEffectColours(documentRef = globalThis.document) {
  const style = documentRef?.documentElement && globalThis.getComputedStyle?.(documentRef.documentElement);
  const read = (name) => style?.getPropertyValue(name)?.trim() || TOKEN_FALLBACKS[name];
  return Object.freeze({
    boost: read('--turn-effect-boost'),
    boostTail: read('--turn-effect-boost-tail'),
    turbo: read('--turn-effect-turbo'),
    turboTail: read('--turn-effect-turbo-tail'),
    overcharge: read('--turn-control-overcharge'),
    overchargeLight: read('--turn-control-overcharge-light'),
    overchargeDeep: read('--turn-control-overcharge-deep'),
    smoke: read('--turn-effect-drift-smoke')
  });
}

// A token value as a three.js colour. Wide-gamut screens get the palette as
// color(display-p3 r g b), which three.js cannot parse: its channels are close enough
// to sRGB for an effect on the road.
export function effectColour(THREE, value) {
  const colour = new THREE.Color();
  const p3 = /^color\(display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(String(value || '').trim());
  if (p3) return colour.setRGB(Number(p3[1]), Number(p3[2]), Number(p3[3]), THREE.SRGBColorSpace);
  return colour.setStyle(String(value || '#ffffff'));
}

// Per-instance opacity for the puffs: MeshBasicMaterial with one extra attribute.
function withInstanceAlpha(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceAlpha;\nvarying float vInstanceAlpha;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceAlpha = instanceAlpha;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstanceAlpha;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vInstanceAlpha;');
  };
  material.customProgramCacheKey = () => 'turn-instance-alpha';
  return material;
}

// surfaceY(x, z): the car's resting height on the road at a point near it (main.js
// reads it from the track), so the wake and smoke start on the road on climbs and
// descents rather than at the car's own height.
export function createDriveEffects({
  THREE, parent, lowGraphics = false, colours = readEffectColours(), surfaceY = null
}) {
  const group = new THREE.Group();
  group.name = 'turn-drive-effects';
  // Moved with the cars and skid marks into the shared race layer, so it shows on
  // every track, not only the one whose world it was created in (tracks/track-manager.js).
  group.userData.turnRaceLayer = true;
  parent.add(group);

  const colour = (value) => effectColour(THREE, value);
  const palette = {
    boost: colour(colours.boost),
    boostTail: colour(colours.boostTail),
    turbo: colour(colours.turbo || colours.boost),
    turboTail: colour(colours.turboTail || colours.boostTail),
    overcharge: colour(colours.overcharge),
    overchargeLight: colour(colours.overchargeLight),
    overchargeDeep: colour(colours.overchargeDeep),
    smoke: colour(colours.smoke)
  };

  // --- BOOST wakes: one mesh, two strips of edge–centre–edge sections ---------------
  const wakeVertexCount = 2 * WAKE_SECTIONS * WAKE_VERTICES_PER_SECTION;
  const wakePositions = new Float32Array(wakeVertexCount * 3);
  const wakeColours = new Float32Array(wakeVertexCount * 4);
  const wakeIndex = [];
  for (let side = 0; side < 2; side += 1) {
    const base = side * WAKE_SECTIONS * WAKE_VERTICES_PER_SECTION;
    for (let section = 0; section < WAKE_SECTIONS - 1; section += 1) {
      const a = base + section * 3;
      const b = a + 3;
      // Two quads per section pair: left edge–centre and centre–right edge.
      wakeIndex.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const wakeGeometry = new THREE.BufferGeometry();
  wakeGeometry.setAttribute('position', new THREE.BufferAttribute(wakePositions, 3).setUsage(THREE.DynamicDrawUsage));
  wakeGeometry.setAttribute('color', new THREE.BufferAttribute(wakeColours, 4).setUsage(THREE.DynamicDrawUsage));
  wakeGeometry.setIndex(wakeIndex);
  const wakeMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // Transparent and double-sided would otherwise draw twice; the wake is flat.
    forceSinglePass: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const wake = new THREE.Mesh(wakeGeometry, wakeMaterial);
  wake.name = 'turn-boost-wake';
  wake.frustumCulled = false;
  wake.visible = false;
  group.add(wake);

  // Where each rear corner has been, newest first: x, y, z, right.x, right.z.
  const historyLength = Math.ceil(OVERCHARGE_WAKE_SECONDS / WAKE_SAMPLE_SECONDS) + 2;
  const history = [new Float32Array(historyLength * 5), new Float32Array(historyLength * 5)];
  let historyCount = 0;
  let sampleClock = 0;

  // --- DRIFT smoke and OVERCHARGE sparks: one instanced mesh ---------------------------
  const puffCount = lowGraphics ? LOW_GRAPHICS_PUFFS : PUFFS;
  const puffInterval = lowGraphics ? LOW_GRAPHICS_PUFF_INTERVAL : PUFF_INTERVAL;
  const puffGeometry = new THREE.IcosahedronGeometry(1, 0);
  const puffAlpha = new Float32Array(puffCount);
  puffGeometry.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(puffAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  const puffMaterial = withInstanceAlpha(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  const puffs = new THREE.InstancedMesh(puffGeometry, puffMaterial, puffCount);
  puffs.name = 'turn-drive-puffs';
  puffs.frustumCulled = false;
  puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Created now, so the first puff does not change (and recompile) the program.
  for (let index = 0; index < puffCount; index += 1) puffs.setColorAt(index, palette.smoke);
  puffs.instanceColor.setUsage(THREE.DynamicDrawUsage);
  puffs.count = 0;
  puffs.visible = false;
  group.add(puffs);

  const puffState = Array.from({ length: puffCount }, () => ({
    life: 0, maxLife: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, grow: 0, alpha: 0, spin: 0, turn: 0, shown: false
  }));
  let puffCursor = 0;
  // False once every slot has been written out: an idle pool costs nothing per frame.
  let puffsAwake = false;
  let puffCooldown = 0;
  const puffMatrix = new THREE.Matrix4();
  const puffQuaternion = new THREE.Quaternion();
  const puffEuler = new THREE.Euler();
  const puffPosition = new THREE.Vector3();
  const puffScale = new THREE.Vector3();

  // --- Burst state -------------------------------------------------------------------
  let boosting = false;
  let burstAge = 0;
  let burstPeak = 0;
  let overchargeMix = 0;
  let turboBurn = false;
  let pulsePhase = 0;
  let kick = 0;
  let kickNow = 0;
  let releasedKick = 0;
  let releaseAge = 0;
  // The car at the previous update, so a slow frame's wake samples follow its path.
  let lastX = 0;
  let lastZ = 0;
  let lastForwardX = 0;
  let lastForwardZ = 1;
  let lastRightX = 1;
  let lastRightZ = 0;

  // The road at a point, or the car's own level where no reading is given.
  const groundAt = (state, x, z) => {
    const y = surfaceY ? Number(surfaceY(x, z)) : NaN;
    return Number.isFinite(y) ? y : Number(state.position.y) || 0;
  };

  // The next slot in the pool, recoloured; the caller sets where it goes and how it moves.
  function nextPuff(tint, life) {
    const puff = puffState[puffCursor];
    puff.life = life;
    puff.maxLife = life;
    puff.spin = Math.random() * Math.PI * 2;
    puff.turn = (Math.random() - 0.5) * 3;
    puffs.setColorAt(puffCursor, tint);
    puffs.instanceColor.needsUpdate = true;
    puffCursor = (puffCursor + 1) % puffCount;
    puffsAwake = true;
    return puff;
  }

  function rememberPose(state, forward, right) {
    lastX = state.position.x;
    lastZ = state.position.z;
    lastForwardX = forward.x;
    lastForwardZ = forward.z;
    lastRightX = right.x;
    lastRightZ = right.z;
  }

  // t: how far between the previous update (0) and this one (1) the sample fell due.
  function pushHistory(state, forward, right, t) {
    const x = lastX + (state.position.x - lastX) * t;
    const z = lastZ + (state.position.z - lastZ) * t;
    let forwardX = lastForwardX + (forward.x - lastForwardX) * t;
    let forwardZ = lastForwardZ + (forward.z - lastForwardZ) * t;
    const forwardLength = Math.hypot(forwardX, forwardZ) || 1;
    forwardX /= forwardLength;
    forwardZ /= forwardLength;
    let rightX = lastRightX + (right.x - lastRightX) * t;
    let rightZ = lastRightZ + (right.z - lastRightZ) * t;
    const rightLength = Math.hypot(rightX, rightZ) || 1;
    rightX /= rightLength;
    rightZ /= rightLength;
    for (let side = 0; side < 2; side += 1) {
      const sign = side === 0 ? -1 : 1;
      const samples = history[side];
      samples.copyWithin(5, 0, (historyLength - 1) * 5);
      samples[0] = x - forwardX * WAKE_REAR_OFFSET + rightX * sign * WAKE_SIDE_OFFSET;
      samples[2] = z - forwardZ * WAKE_REAR_OFFSET + rightZ * sign * WAKE_SIDE_OFFSET;
      samples[1] = groundAt(state, samples[0], samples[2]) + WAKE_LIFT;
      samples[3] = rightX;
      samples[4] = rightZ;
    }
    historyCount = Math.min(historyLength, historyCount + 1);
  }

  const headColour = new THREE.Color();
  const bodyColour = new THREE.Color();
  const tailColour = new THREE.Color();
  const mixed = new THREE.Color();

  function writeWake(state, forward, right) {
    const wakeSeconds = WAKE_SECONDS + (OVERCHARGE_WAKE_SECONDS - WAKE_SECONDS) * overchargeMix;
    const sections = Math.max(2, Math.min(WAKE_SECTIONS, Math.round(wakeSeconds / WAKE_SAMPLE_SECONDS)));
    const flare = burstAge < FLARE_SECONDS ? FLARE_WIDTH * (1 - burstAge / FLARE_SECONDS) * burstPeak : 0;
    const halfWidth = WAKE_HALF_WIDTH * (1 + (OVERCHARGE_WIDTH - 1) * overchargeMix) * (1 + flare);
    // BOOST runs yellow to orange; OVERCHARGE light to violet to deep violet.
    const normalHead = turboBurn ? palette.turbo : palette.boost;
    const normalTail = turboBurn ? palette.turboTail : palette.boostTail;
    headColour.copy(normalHead).lerp(palette.overchargeLight, overchargeMix);
    bodyColour.copy(normalHead).lerp(normalTail, 0.5).lerp(palette.overcharge, overchargeMix);
    tailColour.copy(normalTail).lerp(palette.overchargeDeep, overchargeMix);
    for (let side = 0; side < 2; side += 1) {
      const sign = side === 0 ? -1 : 1;
      const samples = history[side];
      const base = side * WAKE_SECTIONS * WAKE_VERTICES_PER_SECTION;
      for (let section = 0; section < WAKE_SECTIONS; section += 1) {
        // The newest point is the car's rear corner now, so the wake stays attached.
        const sample = Math.min(section, Math.max(0, historyCount - 1), sections - 1);
        const offset = sample * 5;
        const x = section === 0
          ? state.position.x - forward.x * WAKE_REAR_OFFSET + right.x * sign * WAKE_SIDE_OFFSET
          : samples[offset];
        const z = section === 0
          ? state.position.z - forward.z * WAKE_REAR_OFFSET + right.z * sign * WAKE_SIDE_OFFSET
          : samples[offset + 2];
        const y = section === 0 ? groundAt(state, x, z) + WAKE_LIFT : samples[offset + 1];
        const rx = section === 0 ? right.x : samples[offset + 3];
        const rz = section === 0 ? right.z : samples[offset + 4];
        const u = Math.min(1, section / (sections - 1));
        const width = section < sections ? halfWidth * Math.pow(1 - u, 0.8) : 0;
        // OVERCHARGE pulses run backwards along the wake.
        const pulse = 1 - overchargeMix * 0.5 * (0.5 + 0.5 * Math.sin((u * 3 - pulsePhase) * Math.PI * 2));
        const alpha = section < sections ? Math.pow(1 - u, 1.1) * pulse : 0;
        if (u < 0.3) mixed.copy(headColour).lerp(bodyColour, u / 0.3);
        else mixed.copy(bodyColour).lerp(tailColour, (u - 0.3) / 0.7);
        for (let edge = 0; edge < 3; edge += 1) {
          const lateral = (edge - 1) * width;
          const vertex = base + section * 3 + edge;
          wakePositions[vertex * 3] = x + rx * lateral;
          wakePositions[vertex * 3 + 1] = y;
          wakePositions[vertex * 3 + 2] = z + rz * lateral;
          wakeColours[vertex * 4] = mixed.r;
          wakeColours[vertex * 4 + 1] = mixed.g;
          wakeColours[vertex * 4 + 2] = mixed.b;
          // Soft edges without a texture: only the centre line is opaque.
          wakeColours[vertex * 4 + 3] = edge === 1 ? alpha : 0;
        }
      }
    }
    wakeGeometry.attributes.position.needsUpdate = true;
    wakeGeometry.attributes.color.needsUpdate = true;
  }

  function updatePuffs(dt) {
    if (!puffsAwake) return;
    let alive = 0;
    let written = false;
    for (let index = 0; index < puffCount; index += 1) {
      const puff = puffState[index];
      if (puff.life > 0) {
        puff.life = Math.max(0, puff.life - dt);
        puff.x += puff.vx * dt;
        puff.y += puff.vy * dt;
        puff.z += puff.vz * dt;
        puff.vy *= 1 - Math.min(0.9, dt * 1.6);
        puff.spin += puff.turn * dt;
      }
      const visible = puff.life > 0;
      // A spent slot is written out once, then left alone until it is reused.
      if (!visible && !puff.shown) continue;
      puff.shown = visible;
      written = true;
      if (visible) alive += 1;
      const ratio = puff.life / puff.maxLife;
      const size = visible ? puff.size * (1 + (1 - ratio) * puff.grow) : 0;
      puffAlpha[index] = visible ? puff.alpha * ratio * ratio : 0;
      puffPosition.set(puff.x, puff.y, puff.z);
      puffEuler.set(puff.spin * 0.6, puff.spin, 0);
      puffQuaternion.setFromEuler(puffEuler);
      puffScale.set(size, size * 0.8, size);
      puffMatrix.compose(puffPosition, puffQuaternion, puffScale);
      puffs.setMatrixAt(index, puffMatrix);
    }
    puffsAwake = alive > 0;
    puffs.count = alive ? puffCount : 0;
    puffs.visible = alive > 0;
    puffs.instanceMatrix.needsUpdate = written;
    puffGeometry.attributes.instanceAlpha.needsUpdate = written;
  }

  // dt is race time. Inputs are read by main.js from the live race.
  function update({ dt, state, forward, right, boostActive, overcharge, driftHeld, slip = 0 }) {
    const step = Math.max(0, Math.min(0.1, Number(dt) || 0));
    const speed = Math.max(0, Number(state.speed) || 0);
    const burning = boostActive === true && speed > 4;
    const spendingOvercharge = burning && Number(overcharge) > 0;
    turboBurn = state.vehiclePerkIds?.includes('turbo') === true;

    if (burning && !boosting) {
      // A new burst: start the wake from the car, flare it and kick the camera.
      historyCount = 0;
      sampleClock = 0;
      burstAge = 0;
      burstPeak = spendingOvercharge ? 1.6 : 1;
      overchargeMix = spendingOvercharge ? 1 : 0;
      kick = spendingOvercharge ? OVERCHARGE_CAMERA_KICK_DEGREES : BOOST_CAMERA_KICK_DEGREES;
      if (spendingOvercharge) {
        for (let index = 0; index < OVERCHARGE_SPARK_PUFFS; index += 1) {
          const sign = index % 2 ? 1 : -1;
          const spread = (Math.random() - 0.5) * 2;
          const sparkX = state.position.x - forward.x * WAKE_REAR_OFFSET + right.x * sign * WAKE_SIDE_OFFSET;
          const sparkZ = state.position.z - forward.z * WAKE_REAR_OFFSET + right.z * sign * WAKE_SIDE_OFFSET;
          const spark = nextPuff(index % 2 ? palette.overchargeLight : palette.overcharge, 0.45);
          spark.x = sparkX;
          spark.y = groundAt(state, sparkX, sparkZ) + 0.45;
          spark.z = sparkZ;
          spark.vx = -forward.x * (6 + Math.random() * 4) + right.x * sign * 3 + spread;
          spark.vy = 2.4 + Math.random() * 1.2;
          spark.vz = -forward.z * (6 + Math.random() * 4) + right.z * sign * 3 + spread;
          spark.size = 0.32;
          spark.grow = 0.8;
          spark.alpha = 0.95;
        }
      }
    }
    if (boosting && !burning) {
      releasedKick = kickNow;
      releaseAge = 0;
    }
    boosting = burning;

    if (burning) {
      burstAge += step;
      // Resource identity is immediate: even a short OC burst must be purple.
      overchargeMix = spendingOvercharge ? 1 : 0;
      pulsePhase = (pulsePhase + step * 4) % 1;
      if (historyCount === 0) {
        rememberPose(state, forward, right);
        pushHistory(state, forward, right, 1);
      }
      // A slow frame owes several samples: each goes where the car was when it fell
      // due, so the wake keeps the path's shape rather than repeating one point.
      const clockBefore = sampleClock;
      sampleClock += step;
      let due = 0;
      while (sampleClock >= WAKE_SAMPLE_SECONDS) {
        sampleClock -= WAKE_SAMPLE_SECONDS;
        due += 1;
        pushHistory(state, forward, right, step > 0 ? Math.min(1, (due * WAKE_SAMPLE_SECONDS - clockBefore) / step) : 1);
      }
      writeWake(state, forward, right);
    }
    wake.visible = burning;
    rememberPose(state, forward, right);

    // Camera kick: a quick rise, then it eases away while the burst goes on. The end of
    // a burst eases out from where the kick was; a new burst rises from there too.
    const burstKick = burning
      ? kick * Math.min(1, burstAge / KICK_ATTACK_SECONDS)
        * Math.exp(-Math.max(0, burstAge - KICK_ATTACK_SECONDS) / KICK_DECAY_SECONDS)
      : 0;
    releaseAge += step;
    const easing = Math.min(1, releaseAge / KICK_RELEASE_SECONDS);
    const releaseKick = releasedKick * (1 - easing * easing * (3 - 2 * easing));
    kickNow = Math.max(burstKick, releaseKick);
    state.cameraKickFov = kickNow;

    puffCooldown -= step;
    if (driftHeld === true && speed > 13 && puffCooldown <= 0) {
      const strength = Math.max(0.35, Math.min(1, Math.abs(Number(slip) || 0) / 0.45));
      for (let sign = -1; sign <= 1; sign += 2) {
        const lateral = (Math.random() - 0.5) * 0.4;
        const tyreX = state.position.x - forward.x * (WAKE_REAR_OFFSET - 0.4) + right.x * (sign * 1.05 + lateral);
        const tyreZ = state.position.z - forward.z * (WAKE_REAR_OFFSET - 0.4) + right.z * (sign * 1.05 + lateral);
        const smoke = nextPuff(palette.smoke, PUFF_LIFE * (0.8 + Math.random() * 0.4));
        smoke.x = tyreX;
        smoke.y = groundAt(state, tyreX, tyreZ) + PUFF_LIFT;
        smoke.z = tyreZ;
        // Kicked out sideways, against the slide, and left behind as the car goes on.
        smoke.vx = right.x * sign * (1 + Math.random()) + (Number(state.velocity?.x) || 0) * 0.25;
        smoke.vy = 1.6 + Math.random() * 0.9;
        smoke.vz = right.z * sign * (1 + Math.random()) + (Number(state.velocity?.z) || 0) * 0.25;
        smoke.size = 0.3 + strength * 0.2;
        smoke.grow = 2.4;
        smoke.alpha = PUFF_START_ALPHA * strength;
      }
      puffCooldown = puffInterval / strength;
    }
    updatePuffs(step);
  }

  // A new race, restart, LEAVE RACE or GARAGE: nothing carries over.
  function clear(state) {
    boosting = false;
    burstAge = 0;
    historyCount = 0;
    kick = 0;
    kickNow = 0;
    releasedKick = 0;
    overchargeMix = 0;
    wake.visible = false;
    for (const puff of puffState) puff.life = 0;
    // The next update writes out whatever was showing.
    puffsAwake = true;
    puffs.count = 0;
    puffs.visible = false;
    if (state) state.cameraKickFov = 0;
  }

  // Compile both programs before the first DRIFT or BOOST, against the race scene so
  // fog and colour space match: no hitch the first time an effect appears.
  function warm(renderer, camera, scene) {
    const wasVisible = [wake.visible, puffs.visible];
    wake.visible = true;
    puffs.visible = true;
    try {
      renderer?.compile?.(group, camera, scene);
    } catch (_) {
      // A failed warm-up only means the first effect compiles late.
    }
    [wake.visible, puffs.visible] = wasVisible;
  }

  return Object.freeze({ group, update, clear, warm, get puffCapacity() { return puffCount; } });
}
