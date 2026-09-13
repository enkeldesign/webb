// Source geometry/textures, the outline material and the learner-sign atlas are
// borrowed. Register only resources created for a visual. Fast rival clones and
// their bounded template cache retain the same resource set until its last owner
// releases it. Keep ownership outside userData, which Three copies when cloning.
const owners = new WeakMap();

export function createCarVisualResourceOwner(root) {
  const resources = new Set();
  owners.set(root, { shared: { resources, references: 1 }, disposed: false });
  return Object.freeze({
    own(resource) {
      resources.add(resource);
      return resource;
    },
    has: (resource) => resources.has(resource)
  });
}

export function retainCarVisualResources(source, clone) {
  const owner = owners.get(source);
  if (!owner?.shared.references || owners.has(clone)) throw new Error('TURN: invalid car visual ownership transfer.');
  owner.shared.references += 1;
  owners.set(clone, { shared: owner.shared, disposed: false });
}

export function disposeCarVisual(root) {
  const owner = owners.get(root);
  if (!owner) {
    // Some viewers own a container of visuals, not a single factory result.
    for (const child of [...(root?.children || [])]) disposeCarVisual(child);
    return;
  }
  if (owner.disposed) return;
  owner.disposed = true;
  root.parent?.remove(root);
  // A cache lease may still need this prepared graph for fast clones. Detached
  // nodes are collected naturally once their visual/cache owners release them.
  owner.shared.references -= 1;
  if (owner.shared.references) return;
  for (const resource of owner.shared.resources) resource.dispose?.();
  owner.shared.resources.clear();
}
