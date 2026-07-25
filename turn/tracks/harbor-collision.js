const CONTAINER_YARDS = Object.freeze([
  Object.freeze({ z: -90, rows: 2, columns: 9, startX: -118, spacingX: 29, spacingZ: 19 }),
  Object.freeze({ z: 16, rows: 2, columns: 8, startX: -104, spacingX: 30, spacingZ: 18 }),
  Object.freeze({ z: 108, rows: 2, columns: 7, startX: -92, spacingX: 31, spacingZ: 18 })
]);

const CONTAINER_HALF_WIDTH = 10.4;
const CONTAINER_HALF_DEPTH = 4.2;

function makeBox(id, minX, maxX, minZ, maxZ, category) {
  return Object.freeze({
    id,
    type: 'box',
    category,
    minX,
    maxX,
    minZ,
    maxZ
  });
}

function makeContainerColliders() {
  const colliders = [];

  for (let zoneIndex = 0; zoneIndex < CONTAINER_YARDS.length; zoneIndex += 1) {
    const zone = CONTAINER_YARDS[zoneIndex];

    for (let row = 0; row < zone.rows; row += 1) {
      for (let column = 0; column < zone.columns; column += 1) {
        if ((column + row + zoneIndex) % 5 === 0) continue;

        const x = zone.startX + column * zone.spacingX;
        const z = zone.z + row * zone.spacingZ;
        colliders.push(makeBox(
          `harbor-container-${zoneIndex}-${row}-${column}`,
          x - CONTAINER_HALF_WIDTH,
          x + CONTAINER_HALF_WIDTH,
          z - CONTAINER_HALF_DEPTH,
          z + CONTAINER_HALF_DEPTH,
          'container'
        ));
      }
    }
  }

  return colliders;
}

export const HARBOR_COLLISION_RULES = Object.freeze({
  freeRoamDistance: 170,
  containerColliderCount: 41,
  quayEdgeZ: -188,
  mapBounds: Object.freeze({
    minX: -315,
    maxX: 305,
    minZ: -188,
    maxZ: 235
  })
});

export const HARBOR_CONTAINER_COLLIDERS = Object.freeze(makeContainerColliders());

export const HARBOR_BOUNDARY_COLLIDERS = Object.freeze([
  makeBox('harbor-quay-edge', -325, 325, -205, -188, 'quay'),
  makeBox('harbor-map-west', -360, -315, -215, 285, 'boundary'),
  makeBox('harbor-map-east', 305, 360, -215, 285, 'boundary'),
  makeBox('harbor-map-north', -360, 360, 235, 285, 'boundary'),
  makeBox('harbor-warehouse-west', -174, -86, 182, 226, 'building'),
  makeBox('harbor-warehouse-centre-west', -72, 22, 184, 232, 'building'),
  makeBox('harbor-warehouse-centre-east', 40, 140, 182, 228, 'building'),
  makeBox('harbor-warehouse-east', 163, 241, 176, 216, 'building')
]);

export const HARBOR_COLLIDERS = Object.freeze([
  ...HARBOR_CONTAINER_COLLIDERS,
  ...HARBOR_BOUNDARY_COLLIDERS
]);
