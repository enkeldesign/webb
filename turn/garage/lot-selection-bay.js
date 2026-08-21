import * as THREE from 'three';

const EXPECTED_PAD_COUNT = 15;
const BAY_WIDTH = 8.1;
const BAY_DEPTH = 5.8;
const FILL_WIDTH = 7.92;
const FILL_DEPTH = 5.58;
const CONNECTOR_THICKNESS = 0.14;
const PARKING_WHITE = 0xfff8e8;
const SELECTED_ASPHALT = 0x62676b;

function replacePlaneGeometry(mesh, width, depth) {
  if (!mesh?.isMesh) return;
  mesh.geometry?.dispose?.();
  mesh.geometry = new THREE.PlaneGeometry(width, depth);
}

function polishParkingPad(pad) {
  const fill = pad?.userData?.turnLotPadFill;
  const border = pad?.userData?.turnLotPadBorder;
  const pointerOutline = pad?.userData?.turnLotPadPointerOutline;
  const pointer = pad?.userData?.turnLotPadPointer;
  if (!fill?.isMesh || !border?.isGroup) return false;

  // The ordinary parking stripes already provide the left and right edges. Keep the
  // selection physically part of that parking-space language: a subtle lighter patch
  // of asphalt, then only the two missing white cross-lines that close the bay.
  replacePlaneGeometry(fill, FILL_WIDTH, FILL_DEPTH);
  fill.material?.color?.setHex?.(SELECTED_ASPHALT);
  if (fill.material) {
    fill.material.transparent = true;
    fill.material.opacity = 0.55;
    fill.material.depthWrite = false;
    fill.material.needsUpdate = true;
  }

  const edges = [...border.children];
  const [nearConnector, farConnector, leftLegacyEdge, rightLegacyEdge] = edges;
  for (const connector of [nearConnector, farConnector]) {
    replacePlaneGeometry(connector, BAY_WIDTH, CONNECTOR_THICKNESS);
    connector.material?.color?.setHex?.(PARKING_WHITE);
    if (connector.material) connector.material.needsUpdate = true;
  }

  // The persistent Lot ground already draws these two side stripes at exactly the
  // bay boundaries. Hiding the duplicate selector edges lets those lines simply join
  // the new cross-lines instead of drawing a second boxed frame over them.
  if (leftLegacyEdge) leftLegacyEdge.visible = false;
  if (rightLegacyEdge) rightLegacyEdge.visible = false;

  // Selection is the connected parking bay itself. Do not retain the old floating
  // yellow pointer; setParkingPadSelected() may toggle the mesh, so suppress its
  // material rather than relying on mesh.visible.
  if (pointerOutline?.material) pointerOutline.material.visible = false;
  if (pointer?.material) pointer.material.visible = false;

  return true;
}

export function installLotSelectionBayPolish() {
  const prototype = THREE.Object3D.prototype;
  const originalAdd = prototype.add;
  let polished = 0;
  let restored = false;

  function restore() {
    if (restored) return;
    restored = true;
    if (prototype.add === patchedAdd) prototype.add = originalAdd;
  }

  function patchedAdd(...objects) {
    const result = originalAdd.apply(this, objects);
    for (const object of objects) {
      if (!object?.userData?.turnLotPadFill) continue;
      if (!polishParkingPad(object)) continue;
      polished += 1;
      if (polished >= EXPECTED_PAD_COUNT) restore();
    }
    return result;
  }

  prototype.add = patchedAdd;
  return restore;
}
