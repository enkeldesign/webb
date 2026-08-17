export function installMountainR4WaterfallNotch(world) {
  if (!world) return world;

  const removals = [];
  world.traverse((object) => {
    if (!object?.name) return;
    if (object.name === 'Mountain Kenney Nature cliff module r3 2'
        || object.name === 'Mountain Kenney Nature cliff module r3 5') {
      removals.push(object);
    }
  });

  for (const object of removals) object.parent?.remove(object);

  world.userData.turnMountainR4WaterfallNotch = Object.freeze({
    removedInnerNatureCliffs: removals.length,
    purpose: 'open-driver-sightline-between-rock-shoulders'
  });
  return world;
}
