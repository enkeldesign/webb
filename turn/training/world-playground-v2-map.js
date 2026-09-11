export const WORLD_PLAYGROUND_V2_TRACK_ID = 'world-playground-v2';
export const WORLD_PLAYGROUND_V2_ROAD_WIDTH = 27;
export const WORLD_PLAYGROUND_V2_SAMPLE_COUNT = 1440;
export const WORLD_PLAYGROUND_V2_SEA_LEVEL = -18;

export const WORLD_PLAYGROUND_V2_BOUNDS = Object.freeze({
  minX: -1260,
  maxX: 1460,
  minZ: -1140,
  maxZ: 920
});

// North is negative Z. This is deliberately much larger than the first prototype:
// about 5.8 km around the authored control polygon before curve smoothing.
// The order follows the illustrated TURN world: HARBOR -> CLIFFSIDE -> MOUNTAIN ->
// AIRPORT -> COUNTRYSIDE -> MIDNIGHT CITY -> HARBOR.
export const WORLD_PLAYGROUND_V2_ROUTE = Object.freeze([
  point(-650, 5, 420, 'harbor'),
  point(-820, 8, 360, 'harbor'),
  point(-900, 16, 250, 'harbor'),
  point(-960, 30, 120, 'cliffside'),
  point(-1010, 52, -40, 'cliffside'),
  point(-1020, 72, -220, 'cliffside'),
  point(-980, 96, -390, 'cliffside'),
  point(-900, 122, -540, 'cliffside'),
  point(-760, 148, -700, 'cliffside'),
  point(-580, 174, -835, 'mountain'),
  point(-360, 205, -920, 'mountain'),
  point(-120, 220, -915, 'mountain'),
  point(110, 188, -835, 'mountain'),
  point(330, 132, -710, 'mountain'),
  point(550, 82, -575, 'airport'),
  point(760, 44, -430, 'airport'),
  point(950, 22, -285, 'airport'),
  point(1080, 15, -100, 'airport'),
  point(1070, 14, 95, 'airport'),
  point(940, 17, 250, 'countryside'),
  point(760, 22, 340, 'countryside'),
  point(565, 26, 350, 'countryside'),
  point(390, 20, 310, 'countryside'),
  point(235, 14, 275, 'countryside'),
  point(120, 10, 330, 'midnight-city'),
  point(75, 8, 455, 'midnight-city'),
  point(-30, 7, 565, 'midnight-city'),
  point(-180, 7, 625, 'midnight-city'),
  point(-350, 7, 615, 'midnight-city'),
  point(-505, 6, 555, 'harbor'),
  point(-610, 5, 490, 'harbor')
]);

export const WORLD_PLAYGROUND_V2_DISTRICTS = Object.freeze({
  harbor: Object.freeze({ center: Object.freeze([-650, 390]), radius: 300 }),
  cliffside: Object.freeze({ center: Object.freeze([-900, -260]), radius: 430 }),
  mountain: Object.freeze({ center: Object.freeze([-280, -850]), radius: 520 }),
  airport: Object.freeze({ center: Object.freeze([930, -70]), radius: 390 }),
  countryside: Object.freeze({ center: Object.freeze([590, 300]), radius: 470 }),
  'midnight-city': Object.freeze({ center: Object.freeze([-90, 500]), radius: 430 })
});

// The eastern mountain wall starts at MOUNTAIN, stays outside AIRPORT and bends
// around the city before meeting the sea south of HARBOR. It is terrain, not a
// decorative backdrop, and doubles as the eventual physical world boundary.
export const WORLD_PLAYGROUND_V2_RIDGE = Object.freeze([
  Object.freeze([-520, -1040]),
  Object.freeze([-160, -1080]),
  Object.freeze([220, -1030]),
  Object.freeze([600, -920]),
  Object.freeze([940, -750]),
  Object.freeze([1220, -500]),
  Object.freeze([1390, -180]),
  Object.freeze([1400, 160]),
  Object.freeze([1240, 470]),
  Object.freeze([970, 690]),
  Object.freeze([640, 820]),
  Object.freeze([260, 860]),
  Object.freeze([-120, 830]),
  Object.freeze([-460, 770]),
  Object.freeze([-760, 690]),
  Object.freeze([-930, 610])
]);

export const WORLD_PLAYGROUND_V2_BOUNDARY = Object.freeze([
  Object.freeze([-970, 565]),
  Object.freeze([-1110, 260]),
  Object.freeze([-1130, -120]),
  Object.freeze([-1080, -430]),
  Object.freeze([-900, -720]),
  Object.freeze([-650, -945]),
  Object.freeze([-320, -1035]),
  Object.freeze([80, -1010]),
  Object.freeze([470, -900]),
  Object.freeze([835, -740]),
  Object.freeze([1125, -520]),
  Object.freeze([1290, -230]),
  Object.freeze([1310, 125]),
  Object.freeze([1160, 430]),
  Object.freeze([900, 620]),
  Object.freeze([560, 735]),
  Object.freeze([180, 760]),
  Object.freeze([-210, 735]),
  Object.freeze([-545, 670]),
  Object.freeze([-810, 620])
]);

export const WORLD_PLAYGROUND_V2_RIVER = Object.freeze([
  Object.freeze([-250, 208, -880]),
  Object.freeze([-185, 184, -790]),
  Object.freeze([-95, 150, -700]),
  Object.freeze([5, 112, -610]),
  Object.freeze([105, 76, -515]),
  Object.freeze([165, 48, -430])
]);

export function worldPlaygroundV2CoastX(z) {
  const northernCliffPush = 285 * Math.exp(-((z + 315) / 430) ** 2);
  const harborBay = 78 * Math.exp(-((z - 405) / 210) ** 2);
  return -785 - northernCliffPush + harborBay;
}

export function worldPlaygroundV2BaseHeight(x, z) {
  const coast = worldPlaygroundV2CoastX(z);
  const shoreDistance = x - coast;
  if (shoreDistance < -70) {
    return WORLD_PLAYGROUND_V2_SEA_LEVEL - 14
      + Math.sin(x * 0.011 + z * 0.007) * 2.2;
  }

  let height = 7.5
    + Math.sin(x * 0.0062 + z * 0.0048) * 2.8
    + Math.sin(x * 0.0127 - z * 0.0091) * 1.35;

  const cliffFactor = smoothBand(z, -760, 110) * smoothStep(-55, 120, shoreDistance);
  height += cliffFactor * (24 + smoothStep(-25, 115, shoreDistance) * 64);

  const mountain = gaussian(x, z, -280, -845, 500, 330);
  height += mountain * (122 + 18 * Math.sin(x * 0.021) + 13 * Math.sin(z * 0.024));

  const ridgeDistance = distanceToPolyline(x, z, WORLD_PLAYGROUND_V2_RIDGE);
  const ridge = Math.exp(-(ridgeDistance * ridgeDistance) / (2 * 135 * 135));
  height += ridge * (118 + 24 * Math.sin((x + z) * 0.012) + 15 * Math.sin(x * 0.025 - z * 0.018));

  const countryside = gaussian(x, z, 590, 290, 570, 440);
  height += countryside * (6 + Math.sin(x * 0.017) * 4 + Math.sin(z * 0.015) * 3);

  height = flattenEllipse(height, x, z, 930, -55, 365, 300, 14.5, 0.86);
  height = flattenEllipse(height, x, z, -90, 495, 455, 300, 7.5, 0.84);
  height = flattenEllipse(height, x, z, -650, 405, 300, 245, 5.2, 0.82);

  if (shoreDistance < 65) {
    const coastBlend = smoothStep(-70, 65, shoreDistance);
    const shoreTarget = z < 120 ? 3 + cliffFactor * 24 : 2.5;
    height = mix(WORLD_PLAYGROUND_V2_SEA_LEVEL - 6, Math.max(height, shoreTarget), coastBlend);
  }
  return height;
}

function point(x, y, z, district) {
  return Object.freeze({ x, y, z, district });
}

function gaussian(x, z, cx, cz, rx, rz) {
  const nx = (x - cx) / rx;
  const nz = (z - cz) / rz;
  return Math.exp(-(nx * nx + nz * nz) * 2.25);
}

function flattenEllipse(value, x, z, cx, cz, rx, rz, target, strength) {
  const nx = (x - cx) / rx;
  const nz = (z - cz) / rz;
  const d = Math.sqrt(nx * nx + nz * nz);
  const influence = (1 - smoothStep(0.55, 1, d)) * strength;
  return mix(value, target, influence);
}

function distanceToPolyline(x, z, line) {
  let best = Infinity;
  for (let index = 0; index < line.length - 1; index += 1) {
    const [ax, az] = line[index];
    const [bx, bz] = line[index + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t;
    const pz = az + dz * t;
    best = Math.min(best, Math.hypot(x - px, z - pz));
  }
  return best;
}

function smoothBand(value, min, max) {
  return smoothStep(min - 120, min + 80, value) * (1 - smoothStep(max - 80, max + 120, value));
}

function smoothStep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}
