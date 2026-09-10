import * as base from '/turn/vehicle/emergency-livery-models.js?revision=r223-training-car-taxi';

export * from '/turn/vehicle/emergency-livery-models.js?revision=r223-training-car-taxi';

function colorHex(value) {
  if (!value) return null;
  if (typeof value.getHexString === 'function') return `#${value.getHexString()}`;
  return String(value);
}

function semanticRecords(visual) {
  return (visual?.userData?.turnSemanticPaintRecords || []).map((record) => ({
    nodeName: record.nodeName || '',
    profileId: record.profileId || '',
    primary: colorHex(record.primaryUniform?.value),
    secondary: colorHex(record.secondaryUniform?.value),
    hasPrimary: Boolean(record.primaryUniform),
    hasSecondary: Boolean(record.secondaryUniform)
  }));
}

export async function createCarVisual(options = {}) {
  const visual = await base.createCarVisual(options);
  const call = Object.freeze({
    carId: options.carId,
    color: options.color,
    secondaryColor: options.secondaryColor,
    ghost: options.ghost === true,
    targetLength: options.targetLength,
    visualColor: visual?.userData?.turnCarColor,
    visualSecondaryColor: visual?.userData?.turnCarSecondaryColor,
    visualGhost: visual?.userData?.turnGhost === true,
    semanticRecords: semanticRecords(visual)
  });
  const calls = Array.isArray(globalThis.__rivalPaintCreateCalls)
    ? globalThis.__rivalPaintCreateCalls
    : [];
  globalThis.__rivalPaintCreateCalls = [...calls, call];
  return visual;
}
