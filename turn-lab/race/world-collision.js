import {
  WORLD_FREE_ROAM_DISTANCE,
  resolveWorldCollisionState as resolveProductionWorldCollisionState
} from '../../turn/race/world-collision.js?lab-base=mountain-slip-bridge-r15';
import {
  resolveMountainBridgeGuideState
} from './mountain-bridge-guide.js?revision=mountain-slip-bridge-r15';

const DEFAULT_CAR_RADIUS = 2.6;
const INACTIVE_BRIDGE_GUIDE = Object.freeze({
  active: false,
  assisted: false,
  contained: false,
  limit: Infinity
});

export { WORLD_FREE_ROAM_DISTANCE };

export function resolveWorldCollisionState(options = {}) {
  const {
    state,
    trackId = 'countryside',
    nearestTrack = null,
    collisionProfile = null,
    carRadius = DEFAULT_CAR_RADIUS,
    dt = 1 / 60
  } = options;

  const freeRoamDistance = positiveNumber(
    collisionProfile?.freeRoamDistance,
    WORLD_FREE_ROAM_DISTANCE[trackId]
  );
  const baselineLimit = Math.max(
    1,
    freeRoamDistance - Math.max(0, Number(carRadius) || 0)
  );
  const bridgeGuide = trackId === 'mountain'
    ? resolveMountainBridgeGuideState({
      state,
      nearestTrack,
      guide: collisionProfile?.bridgeGuide,
      baselineLimit,
      dt
    })
    : INACTIVE_BRIDGE_GUIDE;

  // The LAB guide owns the route-normal bridge boundary while active. Feed its
  // smoothly tapered limit to production so the wider global envelope cannot
  // apply a second response; production still resolves every ordinary collider.
  const productionNearestTrack = bridgeGuide.active && nearestTrack
    ? {
      ...nearestTrack,
      distance: Math.min(Number(nearestTrack.distance) || 0, bridgeGuide.limit)
    }
    : nearestTrack;
  const collision = bridgeGuide.active
    ? resolveProductionWorldCollisionState({
      ...options,
      nearestTrack: productionNearestTrack
    })
    : resolveProductionWorldCollisionState(options);

  if ((bridgeGuide.assisted || bridgeGuide.contained) && state?.velocity) {
    state.speed = vectorLength(state.velocity);
  }
  collision.collided = collision.collided || bridgeGuide.contained;
  collision.boundary = collision.boundary || bridgeGuide.contained;
  collision.shoulder = collision.shoulder || bridgeGuide.assisted;
  collision.bridgeGuide = bridgeGuide.active;
  collision.bridgeRailAssist = bridgeGuide.assisted;
  collision.bridgeRailContainment = bridgeGuide.contained;
  return collision;
}

function vectorLength(vector) {
  if (typeof vector?.length === 'function') return vector.length();
  return Math.hypot(Number(vector?.x) || 0, Number(vector?.y) || 0, Number(vector?.z) || 0);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
