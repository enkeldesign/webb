(() => {
  const SAFE_ZONE_DEGREES = 24;

  globalThis.__TURN_MOTION_SAFE_ZONE__ = Object.freeze({
    degrees: SAFE_ZONE_DEGREES,
    steeringDegrees: SAFE_ZONE_DEGREES,
    horizonDegrees: SAFE_ZONE_DEGREES,
    feedbackNearDegrees: 19,
    feedbackHardDegrees: SAFE_ZONE_DEGREES,
    feedbackHardRearmDegrees: 22,
    feedbackClearDegrees: 17.5,
    directionalFeedback: true
  });

  document.documentElement.dataset.turnMotionSafeZone = String(SAFE_ZONE_DEGREES);
  console.info(`TURN NEXT: motion safe zone configured at ±${SAFE_ZONE_DEGREES}°.`);
})();
