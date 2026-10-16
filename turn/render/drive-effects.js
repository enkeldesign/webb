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
const WAKE_LIFT = 0.12;
const FLARE_SECONDS = 0.28;
const FLARE_WIDTH = 0.45;
const COLOUR_BLEND_PER_SECOND = 6;

// Degrees of extra field of view at the start of a burst (render/camera.js).
export const BOOST_CAMERA_KICK_DEGREES = 2.5;
export const OVERCHARGE_CAMERA_KICK_DEGREES = 5;
const KICK_ATTACK_SECONDS = 0.08;
const KICK_DECAY_SECONDS = 0.32;

const PUFFS = 40;
const LOW_GRAPHICS_PUFFS = 20;
const PUFF_INTERVAL = 0.05;
const LOW_GRAPHICS_PUFF_INTERVAL = 0.1;
const PUFF_LIFE = 0.85;
const PUFF_START_ALPHA = 0.34;
const OVERCHARGE_SPARK_PUFFS = 6;

// The wake's warm tail and the smoke are render colours with no UI counterpart; the
// tail is the orange BOOST's flames have always used.
const BOOST_TAIL_COLOUR = '#ff922b';
const SMOKE_COLOUR = '#d9d4cc';
// Only for a page without the design tokens (tests, tools): the tokens' sRGB values.
const TOKEN_FALLBACKS = Object.freeze({
  '--turn-yellow-400': '#ffd43b',
  '--turn-control-overcharge': '#8b5cf6',
  '--turn-control-overcharge-light': '#d0bfff',
  '--turn-control-overcharge-deep': '#5f3dc4'
});

// BOOST's yellow and the OVERCHARGE pair, as the drive pad and BOOST bar show them
// (design-tokens.css). The palette yellow, not --turn-control-boost, which dark mode
// dims for the pad; the road keeps its daylight colours.
export function readEffectColours(documentRef = globalThis.document) {
  const style = documentRef?.documentElement && globalThis.getComputedStyle?.(documentRef.documentElement);
  const read = (name) => style?.getPropertyValue(name)?.trim() || TOKEN_FALLBACKS[name];
  return Object.freeze({
    boost: read('--turn-yellow-400'),
    boostTail: BOOST_TAIL_COLOUR,
    overcharge: read('--turn-control-overcharge'),
    overchargeLight: read('--turn-control-overcharge-light'),
    overchargeDeep: read('--turn-control-overcharge-deep'),
    smoke: SMOKE_COLOUR
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

export function createDriveEffects({ THREE, parent, lowGraphics = false, colours = readEffectColours() }) {
  const group = new THREE.Group();
  group.name = 'turn-drive-effects';
  parent.add(group);

  const colour = (value) => effectColour(THREE, value);
  const palette = {
    boost: colour(colours.boost),
    boostTail: colour(colours.boostTail),
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
    life: 0, maxLife: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, grow: 0, alpha: 0, spin: 0, turn: 0
  }));
  let puffCursor = 0;
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
  let pulsePhase = 0;
  let kick = 0;

  function launchPuff({ x, y, z, vx, vy, vz, size, grow, life, alpha, tint }) {
    const puff = puffState[puffCursor];
    Object.assign(puff, { life, maxLife: life, x, y, z, vx, vy, vz, size, grow, alpha });
    puff.spin = Math.random() * Math.PI * 2;
    puff.turn = (Math.random() - 0.5) * 3;
    puffs.setColorAt(puffCursor, tint);
    puffs.instanceColor.needsUpdate = true;
    puffCursor = (puffCursor + 1) % puffCount;
  }

  function pushHistory(state, forward, right) {
    for (let side = 0; side < 2; side += 1) {
      const sign = side === 0 ? -1 : 1;
      const samples = history[side];
      samples.copyWithin(5, 0, (historyLength - 1) * 5);
      samples[0] = state.position.x - forward.x * WAKE_REAR_OFFSET + right.x * sign * WAKE_SIDE_OFFSET;
      samples[1] = state.position.y + WAKE_LIFT;
      samples[2] = state.position.z - forward.z * WAKE_REAR_OFFSET + right.z * sign * WAKE_SIDE_OFFSET;
      samples[3] = right.x;
      samples[4] = right.z;
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
    headColour.copy(palette.boost).lerp(palette.overchargeLight, overchargeMix);
    bodyColour.copy(palette.boost).lerp(palette.boostTail, 0.5).lerp(palette.overcharge, overchargeMix);
    tailColour.copy(palette.boostTail).lerp(palette.overchargeDeep, overchargeMix);
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
        const y = section === 0 ? state.position.y + WAKE_LIFT : samples[offset + 1];
        const z = section === 0
          ? state.position.z - forward.z * WAKE_REAR_OFFSET + right.z * sign * WAKE_SIDE_OFFSET
          : samples[offset + 2];
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
    let alive = 0;
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
      const ratio = puff.life / puff.maxLife;
      const visible = puff.life > 0;
      if (visible) alive += 1;
      const size = visible ? puff.size * (1 + (1 - ratio) * puff.grow) : 0;
      puffAlpha[index] = visible ? puff.alpha * ratio * ratio : 0;
      puffPosition.set(puff.x, puff.y, puff.z);
      puffEuler.set(puff.spin * 0.6, puff.spin, 0);
      puffQuaternion.setFromEuler(puffEuler);
      puffScale.set(size, size * 0.8, size);
      puffMatrix.compose(puffPosition, puffQuaternion, puffScale);
      puffs.setMatrixAt(index, puffMatrix);
    }
    puffs.count = alive ? puffCount : 0;
    puffs.visible = alive > 0;
    puffs.instanceMatrix.needsUpdate = alive > 0;
    puffGeometry.attributes.instanceAlpha.needsUpdate = alive > 0;
  }

  // dt is race time. Inputs are read by main.js from the live race.
  function update({ dt, state, forward, right, boostActive, overcharge, driftHeld, slip = 0 }) {
    const step = Math.max(0, Math.min(0.1, Number(dt) || 0));
    const speed = Math.max(0, Number(state.speed) || 0);
    const burning = boostActive === true && speed > 4;
    const spendingOvercharge = burning && Number(overcharge) > 0;

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
          launchPuff({
            x: state.position.x - forward.x * WAKE_REAR_OFFSET + right.x * sign * WAKE_SIDE_OFFSET,
            y: state.position.y + 0.45,
            z: state.position.z - forward.z * WAKE_REAR_OFFSET + right.z * sign * WAKE_SIDE_OFFSET,
            vx: -forward.x * (6 + Math.random() * 4) + right.x * sign * 3 + spread,
            vy: 2.4 + Math.random() * 1.2,
            vz: -forward.z * (6 + Math.random() * 4) + right.z * sign * 3 + spread,
            size: 0.32,
            grow: 0.8,
            life: 0.45,
            alpha: 0.95,
            tint: index % 2 ? palette.overchargeLight : palette.overcharge
          });
        }
      }
    }
    boosting = burning;

    if (burning) {
      burstAge += step;
      overchargeMix += ((spendingOvercharge ? 1 : 0) - overchargeMix) * Math.min(1, step * COLOUR_BLEND_PER_SECOND);
      pulsePhase = (pulsePhase + step * 4) % 1;
      sampleClock += step;
      if (historyCount === 0) pushHistory(state, forward, right);
      while (sampleClock >= WAKE_SAMPLE_SECONDS) {
        sampleClock -= WAKE_SAMPLE_SECONDS;
        pushHistory(state, forward, right);
      }
      writeWake(state, forward, right);
    }
    wake.visible = burning;

    // Camera kick: a quick rise, then it eases away while the burst goes on.
    const envelope = burning
      ? Math.min(1, burstAge / KICK_ATTACK_SECONDS) * Math.exp(-Math.max(0, burstAge - KICK_ATTACK_SECONDS) / KICK_DECAY_SECONDS)
      : 0;
    state.cameraKickFov = kick * envelope;

    puffCooldown -= step;
    if (driftHeld === true && speed > 13 && puffCooldown <= 0) {
      const strength = Math.max(0.35, Math.min(1, Math.abs(Number(slip) || 0) / 0.45));
      for (const sign of [-1, 1]) {
        const lateral = (Math.random() - 0.5) * 0.4;
        launchPuff({
          x: state.position.x - forward.x * (WAKE_REAR_OFFSET - 0.4) + right.x * (sign * 1.05 + lateral),
          y: state.position.y + 0.3,
          z: state.position.z - forward.z * (WAKE_REAR_OFFSET - 0.4) + right.z * (sign * 1.05 + lateral),
          // Kicked out sideways, against the slide, and left behind as the car goes on.
          vx: right.x * sign * (1 + Math.random()) + (Number(state.velocity?.x) || 0) * 0.25,
          vy: 1.6 + Math.random() * 0.9,
          vz: right.z * sign * (1 + Math.random()) + (Number(state.velocity?.z) || 0) * 0.25,
          size: 0.3 + strength * 0.2,
          grow: 2.4,
          life: PUFF_LIFE * (0.8 + Math.random() * 0.4),
          alpha: PUFF_START_ALPHA * strength,
          tint: palette.smoke
        });
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
    overchargeMix = 0;
    wake.visible = false;
    for (const puff of puffState) puff.life = 0;
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
