export function updateRaceCameraState({
  state,
  camera,
  cameraPosition,
  cameraTarget,
  getForward,
  getRight,
  maxSpeed,
  dt
}) {
  const forward = getForward().clone();
  const right = getRight().clone();
  const speedRatio = clamp(state.speed / maxSpeed, 0, 1);
  const lateralVelocity = state.velocity.dot(right);

  const desiredCamera = state.position
    .clone()
    .addScaledVector(forward, -(14 + speedRatio * 7))
    .addScaledVector(right, -lateralVelocity * 0.11);
  desiredCamera.y = 7.7 + speedRatio * 2.5;
  cameraPosition.lerp(desiredCamera, 1 - Math.exp(-dt * 6.2));
  camera.position.copy(cameraPosition);

  const desiredTarget = state.position.clone().addScaledVector(forward, 15 + speedRatio * 12);
  desiredTarget.y = 2.0;
  cameraTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 8.5));
  camera.up.set(0, 1, 0);
  camera.lookAt(cameraTarget);

  if (state.sensorMode) camera.rotateZ(-state.roll);

  camera.fov = lerp(camera.fov, 68 + speedRatio * 14, Math.min(1, dt * 4.5));
  camera.updateProjectionMatrix();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
