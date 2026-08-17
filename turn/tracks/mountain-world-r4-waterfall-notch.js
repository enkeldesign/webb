export function installMountainR4WaterfallNotch(world) {
  if (!world) return world;

  const natureRemovals = [];
  const upperGraniteRemovals = [];
  const snowCapRemovals = [];

  world.traverse((object) => {
    if (!object?.name) return;

    if (object.name === 'Mountain Kenney Nature cliff module r3 2'
        || object.name === 'Mountain Kenney Nature cliff module r3 5') {
      natureRemovals.push(object);
      return;
    }

    if (object.name === 'Mountain structural waterfall granite r3'
        && Number(object.position?.y) > 8) {
      upperGraniteRemovals.push(object);
      return;
    }

    if (object.name === 'Mountain structural waterfall snow cap r3') {
      snowCapRemovals.push(object);
    }
  });

  const removals = [...natureRemovals, ...upperGraniteRemovals, ...snowCapRemovals];
  for (const object of removals) object.parent?.remove(object);

  world.userData.turnMountainR4WaterfallNotch = Object.freeze({
    removedInnerNatureCliffs: natureRemovals.length,
    removedUpperGraniteMasses: upperGraniteRemovals.length,
    removedUpperSnowCaps: snowCapRemovals.length,
    retainedLowerGraniteBase: true,
    retainedOuterNatureCliffShoulders: true,
    purpose: 'open-driver-sightline-through-rock-cleft-to-waterfall'
  });
  return world;
}
