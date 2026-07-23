const DEFAULT_CAR_RADIUS = 2.6;
const COLLISION_BOUNCE = 0.16;
const COLLISION_TANGENT_RETENTION = 0.78;
const MAX_COLLIDER_RESOLVES = 4;
const EPSILON = 1e-6;

export const WORLD_FREE_ROAM_DISTANCE = Object.freeze({
  countryside: 170,
  airport: 95
});

export function resolveWorldCollisionState({
  state,
  trackId = 'countryside',
  nearestTrack = null,
  collisionProfile = null,
  carRadius = DEFAULT_CAR_RADIUS
}) {
  if (!state?.position || !state?.velocity) {
    return { collided: false, boundary: false, obstacles: 0 };
  }

  let boundary = false;
  let obstacles = 0;
  const freeRoamDistance = positiveNumber(
    collisionProfile?.freeRoamDistance,
    WORLD_FREE_ROAM_DISTANCE[trackId] || WORLD_FREE_ROAM_DISTANCE.countryside
  );

  if (nearestTrack?.sample?.point && Number.isFinite(nearestTrack.distance)) {
    boundary = resolveTrackEnvelopeBoundary({
      state,
      nearestTrack,
      limit: Math.max(1, freeRoamDistance - Math.max(0, Number(carRadius) || 0))
    });
  }

  for (const collider of collisionProfile?.colliders || []) {
    if (obstacles >= MAX_COLLIDER_RESOLVES) break;
    if (resolveStaticCollider(state, collider, carRadius)) obstacles += 1;
  }

  if (boundary || obstacles) {
    state.position.y = 0.18;
    state.speed = vectorLength(state.velocity);
  }

  return {
    collided: boundary || obstacles > 0,
    boundary,
    obstacles
  };
}

function resolveTrackEnvelopeBoundary({ state, nearestTrack, limit }) {
  if (nearestTrack.distance <= limit) return false;

  const anchor = nearestTrack.sample.point;
  let dx = state.position.x - anchor.x;
  let dz = state.position.z - anchor.z;
  let length = Math.hypot(dx, dz);

  if (length < EPSILON) {
    dx = -(Number(state.velocity.x) || 0);
    dz = -(Number(state.velocity.z) || 0);
    length = Math.hypot(dx, dz) || 1;
  }

  const outwardX = dx / length;
  const outwardZ = dz / length;
  state.position.x = anchor.x + outwardX * limit;
  state.position.z = anchor.z + outwardZ * limit;

  // The collision normal points back into the playable world.
  applyCollisionResponse(state.velocity, -outwardX, -outwardZ);
  return true;
}

function resolveStaticCollider(state, collider, carRadius) {
  if (!collider || collider.enabled === false) return false;
  if (collider.type === 'circle') return resolveCircleCollider(state, collider, carRadius);
  if (collider.type === 'box') return resolveBoxCollider(state, collider, carRadius);
  return false;
}

function resolveCircleCollider(state, collider, carRadius) {
  const centerX = Number(collider.x) || 0;
  const centerZ = Number(collider.z) || 0;
  const radius = Math.max(0, Number(collider.radius) || 0) + Math.max(0, Number(carRadius) || 0);
  let dx = state.position.x - centerX;
  let dz = state.position.z - centerZ;
  const distance = Math.hypot(dx, dz);
  if (distance >= radius) return false;

  let length = distance;
  if (length < EPSILON) {
    dx = -(Number(state.velocity.x) || 0) || 1;
    dz = -(Number(state.velocity.z) || 0);
    length = Math.hypot(dx, dz) || 1;
  }

  const normalX = dx / length;
  const normalZ = dz / length;
  state.position.x = centerX + normalX * radius;
  state.position.z = centerZ + normalZ * radius;
  applyCollisionResponse(state.velocity, normalX, normalZ);
  return true;
}

function resolveBoxCollider(state, collider, carRadius) {
  const padding = Math.max(0, Number(carRadius) || 0);
  const minX = Number(collider.minX) - padding;
  const maxX = Number(collider.maxX) + padding;
  const minZ = Number(collider.minZ) - padding;
  const maxZ = Number(collider.maxZ) + padding;

  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return false;
  if (
    state.position.x <= minX || state.position.x >= maxX
    || state.position.z <= minZ || state.position.z >= maxZ
  ) return false;

  const candidates = [
    { penetration: state.position.x - minX, x: minX, z: state.position.z, nx: -1, nz: 0 },
    { penetration: maxX - state.position.x, x: maxX, z: state.position.z, nx: 1, nz: 0 },
    { penetration: state.position.z - minZ, x: state.position.x, z: minZ, nx: 0, nz: -1 },
    { penetration: maxZ - state.position.z, x: state.position.x, z: maxZ, nx: 0, nz: 1 }
  ];
  candidates.sort((a, b) => a.penetration - b.penetration);
  const escape = candidates[0];

  state.position.x = escape.x;
  state.position.z = escape.z;
  applyCollisionResponse(state.velocity, escape.nx, escape.nz);
  return true;
}

function applyCollisionResponse(velocity, normalX, normalZ) {
  const vx = Number(velocity.x) || 0;
  const vz = Number(velocity.z) || 0;
  const normalSpeed = vx * normalX + vz * normalZ;
  if (normalSpeed >= 0) return;

  const tangentX = -normalZ;
  const tangentZ = normalX;
  const tangentSpeed = vx * tangentX + vz * tangentZ;
  const bouncedNormalSpeed = -normalSpeed * COLLISION_BOUNCE;
  const retainedTangentSpeed = tangentSpeed * COLLISION_TANGENT_RETENTION;

  velocity.x = normalX * bouncedNormalSpeed + tangentX * retainedTangentSpeed;
  velocity.z = normalZ * bouncedNormalSpeed + tangentZ * retainedTangentSpeed;
}

function vectorLength(vector) {
  if (typeof vector?.length === 'function') return vector.length();
  return Math.hypot(Number(vector?.x) || 0, Number(vector?.y) || 0, Number(vector?.z) || 0);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
