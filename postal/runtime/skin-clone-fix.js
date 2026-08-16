'use strict';

// Three.js Object3D.clone() does not rebind SkinnedMesh skeletons to the cloned
// bone hierarchy. Kenney Mini Characters are skinned rigs, so ordinary cloning
// makes their body parts collapse around the root. Keep the fast existing path
// for static scenery and use SkeletonUtils.clone() only when a GLB is skinned.
const cloneStaticAsset = cloneAsset;

cloneAsset = function cloneAssetWithSkinning(key, { target = 1, position = [0, 0, 0], rotation = [0, 0, 0], shadow = true } = {}) {
  const src = assets.get(key);
  if (!src) return null;

  let hasSkinnedMesh = false;
  src.traverse(obj => {
    if (obj.isSkinnedMesh) hasSkinnedMesh = true;
  });
  if (!hasSkinnedMesh) return cloneStaticAsset(key, { target, position, rotation, shadow });

  const clone = cloneSkeleton(src);
  clone.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = shadow;
      obj.receiveShadow = shadow;
      obj.userData.keepGeometry = true;
      obj.userData.keepMaterial = true;
    }
  });

  // Measure after the skeleton has been rebound, otherwise the bounding box is
  // based on the broken shared rig and character placement/scaling is wrong too.
  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const max = Math.max(size.x, size.y, size.z) || 1;
  clone.scale.setScalar(target / max);
  clone.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(clone);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  clone.position.set(-center.x, -scaledBox.min.y, -center.z);

  const root = new THREE.Group();
  root.position.set(...position);
  root.rotation.set(...rotation);
  root.add(clone);
  return root;
};
