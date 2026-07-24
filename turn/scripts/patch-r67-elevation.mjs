import fs from 'node:fs/promises';

const changes = new Map();

await patch('turn/vehicle/physics.js', [
  [
    "import { resolveWorldCollisionState } from '../race/world-collision.js?build=20260723-r53';\n",
    "import { resolveWorldCollisionState } from '../race/world-collision.js?build=20260723-r53';\nimport { trackPitch, trackSurfaceY } from '../tracks/elevation.js?build=20260725-r67';\n"
  ],
  [
    `  state.position.addScaledVector(state.velocity, dt);\n  state.position.y = 0.18;\n  state.speed = state.velocity.length();\n\n  let nearestAfter = findNearestTrack(state.position);\n  const collision = resolveWorldCollisionState({\n    state,\n    trackId: state.trackId,\n    nearestTrack: nearestAfter,\n    collisionProfile: currentCollisionProfile()\n  });\n  if (collision.collided) nearestAfter = findNearestTrack(state.position);\n\n  state.trackDistance = nearestAfter.distance;`,
    `  state.position.addScaledVector(state.velocity, dt);\n  state.speed = state.velocity.length();\n\n  let nearestAfter = findNearestTrack(state.position);\n  const collision = resolveWorldCollisionState({\n    state,\n    trackId: state.trackId,\n    nearestTrack: nearestAfter,\n    collisionProfile: currentCollisionProfile()\n  });\n  if (collision.collided) nearestAfter = findNearestTrack(state.position);\n\n  state.position.y = trackSurfaceY(nearestAfter.sample);\n  state.surfacePitch = trackPitch(nearestAfter.sample);\n  state.trackDistance = nearestAfter.distance;`
  ]
]);

await patch('turn/render/camera.js', [
  [
    `  getForward,\n  getRight,\n  maxSpeed,`,
    `  getForward,\n  getRight,\n  samples,\n  maxSpeed,`
  ],
  [
    `  const speedRatio = clamp(state.speed / maxSpeed, 0, 1);\n  const lateralVelocity = state.velocity.dot(right);`,
    `  const speedRatio = clamp(state.speed / maxSpeed, 0, 1);\n  const lateralVelocity = state.velocity.dot(right);\n  const roadY = finiteNumber(state.position?.y, 0);\n  const lookAheadCount = 18 + Math.round(speedRatio * 12);\n  const lookAheadIndex = Array.isArray(samples) && samples.length && Number.isFinite(state.nearestTrackIndex)\n    ? (state.nearestTrackIndex + lookAheadCount) % samples.length\n    : -1;\n  const lookAheadRoadY = lookAheadIndex >= 0\n    ? finiteNumber(samples[lookAheadIndex]?.point?.y, roadY)\n    : roadY;`
  ],
  [
    `  cameraPosition.y = lerp(cameraPosition.y, 7.7 + speedRatio * 2.5, cameraResponse);`,
    `  cameraPosition.y = lerp(cameraPosition.y, roadY + 7.7 + speedRatio * 2.5, cameraResponse);`
  ],
  [
    `  cameraTarget.y = lerp(cameraTarget.y, 2, targetResponse);`,
    `  const anticipatedRoadY = roadY + (lookAheadRoadY - roadY) * 0.35;\n  cameraTarget.y = lerp(cameraTarget.y, anticipatedRoadY + 2, targetResponse);`
  ],
  [
    `function clamp(value, min, max) {\n  return Math.min(max, Math.max(min, value));\n}`,
    `function clamp(value, min, max) {\n  return Math.min(max, Math.max(min, value));\n}\n\nfunction finiteNumber(value, fallback) {\n  const number = Number(value);\n  return Number.isFinite(number) ? number : fallback;\n}`
  ]
]);

await patch('turn/main.js', [
  [
    `import { createTrackSpatialIndex } from './race/track-spatial-index.js?build=20260720-r19';\n`,
    `import { createTrackSpatialIndex } from './race/track-spatial-index.js?build=20260720-r19';\nimport { trackPitch, trackSampleAtProgress, trackSurfaceY } from './tracks/elevation.js?build=20260725-r67';\n`
  ],
  [
    `  effectRear.copy(state.position).addScaledVector(effectForward, -3.2).setY(0.72);`,
    `  effectRear.copy(state.position).addScaledVector(effectForward, -3.2);\n  effectRear.y += 0.54;`
  ],
  [
    `      effectPosition.copy(effectRear).addScaledVector(effectRight, side * 1.28).setY(0.45);`,
    `      effectPosition.copy(effectRear).addScaledVector(effectRight, side * 1.28);\n      effectPosition.y = state.position.y + 0.27;`
  ],
  [
    `function placePlayerCar(dt) {\n  playerCar.position.copy(state.position);\n  playerCar.rotation.y = state.heading + Math.PI;\n  playerCar.rotation.z = -state.steering * 0.035 - state.velocity.dot(getRight()) * 0.0025;\n  animateWheels(playerCar, state.steering, state.speed, dt);\n}\n\nfunction placeCompetitorCars(dt) {\n  for (let i = 0; i < competitorCars.length; i += 1) {\n    const car = competitorCars[i];\n    const lap = state.competitorLaps[i];\n    if (!lap || !state.lapActive) {\n      car.visible = false;\n      continue;\n    }\n\n    const frame = lapFrameAt(lap, state.lapElapsed);\n    if (!frame) {\n      car.visible = false;\n      continue;\n    }\n\n    car.visible = true;\n    car.position.set(frame.x, 0.18, frame.z);\n    car.rotation.y = frame.h + Math.PI;\n    car.rotation.z = -frame.s * 0.03;\n    if (car === ghostCar) animateWheels(car, frame.s, 45, dt);\n  }\n}`,
    `function placePlayerCar(dt) {\n  const surfaceSample = samples[state.nearestTrackIndex] || findNearestTrack(state.position).sample;\n  playerCar.position.copy(state.position);\n  playerCar.rotation.x = trackPitch(surfaceSample);\n  playerCar.rotation.y = state.heading + Math.PI;\n  playerCar.rotation.z = -state.steering * 0.035 - state.velocity.dot(getRight()) * 0.0025;\n  animateWheels(playerCar, state.steering, state.speed, dt);\n}\n\nfunction placeCompetitorCars(dt) {\n  for (let i = 0; i < competitorCars.length; i += 1) {\n    const car = competitorCars[i];\n    const lap = state.competitorLaps[i];\n    if (!lap || !state.lapActive) {\n      car.visible = false;\n      continue;\n    }\n\n    const frame = lapFrameAt(lap, state.lapElapsed);\n    if (!frame) {\n      car.visible = false;\n      continue;\n    }\n\n    const surfaceSample = trackSampleAtProgress(samples, frame.p) || findNearestTrack(frame).sample;\n    car.visible = true;\n    car.position.set(frame.x, trackSurfaceY(surfaceSample), frame.z);\n    car.rotation.x = trackPitch(surfaceSample);\n    car.rotation.y = frame.h + Math.PI;\n    car.rotation.z = -frame.s * 0.03;\n    if (car === ghostCar) animateWheels(car, frame.s, 45, dt);\n  }\n}`
  ],
  [
    `    getForward,\n    getRight,\n    maxSpeed: MAX_SPEED,`,
    `    getForward,\n    getRight,\n    samples,\n    maxSpeed: MAX_SPEED,`
  ],
  [
    `    skidLeftWheel.copy(skidRearCenter).addScaledVector(skidLateral, -1.25).setY(0.23);\n    skidRightWheel.copy(skidRearCenter).addScaledVector(skidLateral, 1.25).setY(0.23);`,
    `    skidLeftWheel.copy(skidRearCenter).addScaledVector(skidLateral, -1.25);\n    skidRightWheel.copy(skidRearCenter).addScaledVector(skidLateral, 1.25);\n    skidLeftWheel.y = state.position.y + 0.05;\n    skidRightWheel.y = state.position.y + 0.05;`
  ],
  [
    `    playerCar.position.copy(preview.point);\n    playerCar.position.y = 0.18;\n    playerCar.rotation.y = Math.atan2(preview.tangent.x, preview.tangent.z) + Math.PI;`,
    `    playerCar.position.copy(preview.point);\n    playerCar.position.y = trackSurfaceY(preview);\n    playerCar.rotation.x = trackPitch(preview);\n    playerCar.rotation.y = Math.atan2(preview.tangent.x, preview.tangent.z) + Math.PI;`
  ]
]);

for (const [path, content] of changes) await fs.writeFile(path, content);
console.log(`TURN r67 elevation patch updated ${changes.size} files.`);

async function patch(path, replacements) {
  let source = await fs.readFile(path, 'utf8');
  for (const [before, after] of replacements) {
    const count = source.split(before).length - 1;
    if (count !== 1) throw new Error(`${path}: expected one exact match, found ${count}`);
    source = source.replace(before, after);
  }
  changes.set(path, source);
}
