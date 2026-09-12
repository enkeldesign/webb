import * as THREE from 'three';

const OVERPASS_ENDPOINTS = Object.freeze([
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
]);
const TERRAIN_TILE_ROOT = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const TERRAIN_ZOOM = 12;
const TERRAIN_EXAGGERATION = 1.12;
const METERS_PER_DEGREE_LATITUDE = 111_320;
const ROAD_SAMPLE_SPACING = 12;
const TERRAIN_SEGMENTS = 48;
const MAX_BUILDINGS = 260;
const MAX_LAND_POLYGONS = 140;
const MAX_TREES = 180;
const MAX_COLLIDERS = 180;
const MAX_ROAD_SAMPLES = 4_500;
const MAP_CACHE = new Map();
const TERRAIN_TILE_CACHE = new Map();

const ROAD_CLASSES = new Set([
  'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
  'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified',
  'residential', 'living_street', 'service', 'track'
]);
const LAND_TAGS = new Set([
  'forest', 'farmland', 'meadow', 'grass', 'residential', 'commercial',
  'industrial', 'recreation_ground', 'cemetery'
]);
const BUILDING_PALETTE = Object.freeze([
  0xd6c1a0, 0xcaa37f, 0xb58c72, 0xe1d0b7, 0xa9937e, 0xc6b9a8
]);

export async function loadSemanticWorld({
  latitude,
  longitude,
  radiusMeters = 900,
  signal,
  onStatus = () => {}
} = {}) {
  const center = normalizeCenter(latitude, longitude);
  const radius = clamp(Number(radiusMeters) || 900, 450, 1_250);
  const bounds = boundsAround(center, radius * 1.08);

  onStatus('Loading roads and map semantics…');
  const mapPromise = loadOpenStreetMap(bounds, signal);
  onStatus('Loading terrain elevation…');
  const terrainPromise = loadTerrain(center, bounds, signal).catch((error) => {
    console.warn('TURN NEXT WORLD: terrain tiles unavailable; using flat relief.', error);
    return createFlatTerrain(center);
  });

  const [map, terrain] = await Promise.all([mapPromise, terrainPromise]);
  onStatus('Building low-poly world…');
  const built = buildWorld({ map, terrain, center, radius });
  if (built.samples.length < 2) {
    disposeSemanticWorld(built.world);
    throw new Error('No drivable OpenStreetMap roads were found in this area. Try a nearby place or a larger radius.');
  }

  return Object.freeze({
    ...built,
    center,
    radius,
    bounds,
    terrain,
    mapElementCount: map.elements.length,
    toGeo(x, z) {
      return Object.freeze({
        lat: center.lat - Number(z || 0) / METERS_PER_DEGREE_LATITUDE,
        lon: center.lon + Number(x || 0) / longitudeMetersPerDegree(center.lat)
      });
    }
  });
}

export function disposeSemanticWorld(world) {
  if (!world) return;
  world.traverse((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((material) => material?.dispose?.());
    else node.material?.dispose?.();
  });
  world.removeFromParent?.();
}

async function loadOpenStreetMap(bounds, signal) {
  const key = [bounds.south, bounds.west, bounds.north, bounds.east]
    .map((value) => value.toFixed(4)).join(':');
  if (MAP_CACHE.has(key)) return MAP_CACHE.get(key);

  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query = `[out:json][timeout:22];\n(\n`
    + `way[\"highway\"~\"motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|track\"](${bbox});\n`
    + `way[\"aeroway\"~\"runway|taxiway\"](${bbox});\n`
    + `way[\"building\"](${bbox});\n`
    + `way[\"natural\"~\"water|wood\"](${bbox});\n`
    + `way[\"water\"](${bbox});\n`
    + `way[\"landuse\"](${bbox});\n`
    + `way[\"leisure\"~\"park|pitch|recreation_ground\"](${bbox});\n`
    + `way[\"waterway\"=\"riverbank\"](${bbox});\n`
    + `);\nout tags geom;`;

  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await globalThis.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
        signal
      });
      if (!response.ok) throw new Error(`OpenStreetMap query failed with HTTP ${response.status}.`);
      const data = await response.json();
      if (!Array.isArray(data?.elements)) throw new Error('OpenStreetMap returned an unexpected response.');
      MAP_CACHE.set(key, data);
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('OpenStreetMap data could not be loaded.');
}

async function loadTerrain(center, bounds, signal) {
  const corners = [
    [bounds.west, bounds.north], [bounds.east, bounds.north],
    [bounds.west, bounds.south], [bounds.east, bounds.south]
  ].map(([lon, lat]) => lonLatToTile(lon, lat, TERRAIN_ZOOM));
  const minX = Math.floor(Math.min(...corners.map((tile) => tile.x)));
  const maxX = Math.floor(Math.max(...corners.map((tile) => tile.x)));
  const minY = Math.floor(Math.min(...corners.map((tile) => tile.y)));
  const maxY = Math.floor(Math.max(...corners.map((tile) => tile.y)));
  const tiles = new Map();
  const tasks = [];

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      tasks.push(loadTerrainTile(TERRAIN_ZOOM, x, y, signal).then((tile) => {
        tiles.set(`${x}:${y}`, tile);
      }));
    }
  }
  await Promise.all(tasks);

  const rawAt = (lat, lon) => sampleTerrainTileSet(tiles, lat, lon, TERRAIN_ZOOM);
  const centerRaw = rawAt(center.lat, center.lon);
  const longitudeMeters = longitudeMetersPerDegree(center.lat);
  const heightAtLatLon = (lat, lon) => (rawAt(lat, lon) - centerRaw) * TERRAIN_EXAGGERATION;
  const heightAtWorld = (x, z) => {
    const lat = center.lat - z / METERS_PER_DEGREE_LATITUDE;
    const lon = center.lon + x / longitudeMeters;
    return heightAtLatLon(lat, lon);
  };

  return Object.freeze({
    available: true,
    zoom: TERRAIN_ZOOM,
    source: 'Mapzen Terrain Tiles',
    centerElevation: centerRaw,
    heightAtLatLon,
    heightAtWorld
  });
}

function createFlatTerrain(center) {
  return Object.freeze({
    available: false,
    zoom: null,
    source: 'flat fallback',
    centerElevation: 0,
    heightAtLatLon: () => 0,
    heightAtWorld: () => 0,
    center
  });
}

async function loadTerrainTile(zoom, x, y, signal) {
  const key = `${zoom}:${x}:${y}`;
  if (TERRAIN_TILE_CACHE.has(key)) return TERRAIN_TILE_CACHE.get(key);
  const promise = (async () => {
    const response = await globalThis.fetch(`${TERRAIN_TILE_ROOT}/${zoom}/${x}/${y}.png`, { signal });
    if (!response.ok) throw new Error(`Terrain tile failed with HTTP ${response.status}.`);
    const blob = await response.blob();
    const source = typeof globalThis.createImageBitmap === 'function'
      ? await globalThis.createImageBitmap(blob)
      : await imageFromBlob(blob);
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Terrain canvas could not be created.');
    context.drawImage(source, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    source.close?.();
    return Object.freeze({ width: canvas.width, height: canvas.height, data });
  })();
  TERRAIN_TILE_CACHE.set(key, promise);
  try {
    return await promise;
  } catch (error) {
    TERRAIN_TILE_CACHE.delete(key);
    throw error;
  }
}

function imageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new globalThis.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Terrain image could not be decoded.'));
    };
    image.src = url;
  });
}

function sampleTerrainTileSet(tiles, lat, lon, zoom) {
  const tilePosition = lonLatToTile(lon, lat, zoom);
  const x = Math.floor(tilePosition.x);
  const y = Math.floor(tilePosition.y);
  const tile = tiles.get(`${x}:${y}`);
  if (!tile) return 0;
  const pixelX = clamp(Math.floor((tilePosition.x - x) * tile.width), 0, tile.width - 1);
  const pixelY = clamp(Math.floor((tilePosition.y - y) * tile.height), 0, tile.height - 1);
  const offset = (pixelY * tile.width + pixelX) * 4;
  const red = tile.data[offset];
  const green = tile.data[offset + 1];
  const blue = tile.data[offset + 2];
  return (red * 256 + green + blue / 256) - 32768;
}

function buildWorld({ map, terrain, center, radius }) {
  const world = new THREE.Group();
  world.name = 'TURN NEXT semantic real world';
  world.userData.turnNextWorld = true;

  const terrainMesh = makeTerrainMesh(terrain, radius);
  world.add(terrainMesh);

  const semanticWays = map.elements.filter((element) => element.type === 'way' && element.geometry?.length >= 2);
  const landWays = semanticWays.filter((way) => isLandPolygon(way));
  const buildingWays = semanticWays.filter((way) => Boolean(way.tags?.building));
  const roadWays = semanticWays.filter((way) => isDrivableWay(way));

  const landStats = installLandPolygons(world, landWays, terrain, center);
  const roadResult = installRoadNetwork(world, roadWays, terrain, center);
  const buildingResult = installBuildings(world, buildingWays, terrain, center);
  const trees = installForestTrees(world, landWays, terrain, center);

  const samples = capSamples(roadResult.samples, MAX_ROAD_SAMPLES);
  const startIndex = closestSampleIndex(samples, 0, 0);
  const collisionProfile = Object.freeze({
    freeRoamDistance: radius * 3,
    colliders: Object.freeze(buildingResult.colliders.slice(0, MAX_COLLIDERS))
  });

  return {
    world,
    samples,
    startIndex,
    collisionProfile,
    stats: Object.freeze({
      roads: roadResult.roadCount,
      buildings: buildingResult.count,
      semanticAreas: landStats.count,
      trees,
      terrain: terrain.available
    })
  };
}

function makeTerrainMesh(terrain, radius) {
  const size = radius * 2.35;
  const geometry = new THREE.PlaneGeometry(size, size, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  const position = geometry.attributes.position;
  const colors = [];
  const low = new THREE.Color(0x6f9f67);
  const high = new THREE.Color(0x827d73);

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = -position.getY(index);
    const height = terrain.heightAtWorld(x, z);
    position.setZ(index, height);
    const slopeTint = clamp((height + 20) / 180, 0, 1);
    const color = low.clone().lerp(high, slopeTint);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      flatShading: true
    })
  );
  mesh.name = 'DEM terrain';
  mesh.receiveShadow = true;
  return mesh;
}

function installRoadNetwork(world, ways, terrain, center) {
  const positions = [];
  const colors = [];
  const indices = [];
  const samples = [];
  const dashTransforms = [];
  let vertexOffset = 0;
  let cumulativeDistance = 0;
  let roadCount = 0;

  for (const way of ways) {
    const points = densifyGeometry(way.geometry, center, terrain, ROAD_SAMPLE_SPACING, roadVerticalOffset(way));
    if (points.length < 2) continue;
    roadCount += 1;
    const width = roadWidth(way.tags || {});
    const color = roadColor(way.tags || {});
    const roadSamples = pointsToSamples(points, cumulativeDistance);
    if (roadSamples.length) cumulativeDistance = roadSamples.at(-1).distance + ROAD_SAMPLE_SPACING;
    samples.push(...roadSamples);

    for (let index = 0; index < roadSamples.length; index += 1) {
      const sample = roadSamples[index];
      const left = sample.point.clone().addScaledVector(sample.normal, width / 2);
      const right = sample.point.clone().addScaledVector(sample.normal, -width / 2);
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      if (index < roadSamples.length - 1) {
        const offset = vertexOffset + index * 2;
        indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
      }
    }

    if (shouldMarkCenter(way.tags || {})) {
      let distance = 10;
      for (let index = 1; index < roadSamples.length && dashTransforms.length < 700; index += 1) {
        const previous = roadSamples[index - 1];
        const current = roadSamples[index];
        const segment = current.point.distanceTo(previous.point);
        distance += segment;
        if (distance < 18) continue;
        distance = 0;
        dashTransforms.push(current);
      }
    }
    vertexOffset += roadSamples.length * 2;
  }

  if (positions.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const roads = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, side: THREE.DoubleSide })
    );
    roads.name = 'OpenStreetMap roads';
    roads.receiveShadow = true;
    world.add(roads);
  }

  if (dashTransforms.length) {
    const dash = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.22, 0.045, 4.2),
      new THREE.MeshStandardMaterial({ color: 0xf8f3df, roughness: 0.9 }),
      dashTransforms.length
    );
    const marker = new THREE.Object3D();
    dashTransforms.forEach((sample, index) => {
      marker.position.copy(sample.point);
      marker.position.y += 0.07;
      marker.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
      marker.updateMatrix();
      dash.setMatrixAt(index, marker.matrix);
    });
    dash.instanceMatrix.needsUpdate = true;
    dash.name = 'Semantic road markings';
    world.add(dash);
  }

  return { samples, roadCount };
}

function installBuildings(world, ways, terrain, center) {
  const group = new THREE.Group();
  group.name = 'OpenStreetMap buildings';
  const colliders = [];
  let count = 0;

  for (const way of ways) {
    if (count >= MAX_BUILDINGS) break;
    const polygon = geometryToWorldPolygon(way.geometry, center);
    if (polygon.length < 3 || polygonArea(polygon) < 10) continue;
    const centroid = polygonCentroid(polygon);
    const height = buildingHeight(way.tags || {}, way.id);
    const baseY = terrain.heightAtWorld(centroid.x, centroid.z) + 0.08;
    const geometry = extrudePolygon(polygon, centroid, height);
    if (!geometry) continue;
    const color = BUILDING_PALETTE[Math.abs(Number(way.id) || count) % BUILDING_PALETTE.length];
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color, roughness: 0.91, metalness: 0, flatShading: true })
    );
    mesh.position.set(centroid.x, baseY, centroid.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const bounds = polygonBounds(polygon);
    if (colliders.length < MAX_COLLIDERS && bounds.width > 2.5 && bounds.depth > 2.5) {
      colliders.push(Object.freeze({
        type: 'box',
        minX: bounds.minX,
        maxX: bounds.maxX,
        minZ: bounds.minZ,
        maxZ: bounds.maxZ
      }));
    }
    count += 1;
  }
  world.add(group);
  return { count, colliders };
}

function installLandPolygons(world, ways, terrain, center) {
  const group = new THREE.Group();
  group.name = 'OpenStreetMap land semantics';
  let count = 0;
  for (const way of ways) {
    if (count >= MAX_LAND_POLYGONS) break;
    const polygon = geometryToWorldPolygon(way.geometry, center);
    if (polygon.length < 3 || polygonArea(polygon) < 30) continue;
    const centroid = polygonCentroid(polygon);
    const shape = polygonShape(polygon, centroid);
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: semanticAreaColor(way.tags || {}), roughness: 1, metalness: 0, side: THREE.DoubleSide })
    );
    mesh.position.set(centroid.x, terrain.heightAtWorld(centroid.x, centroid.z) + 0.045, centroid.z);
    mesh.receiveShadow = true;
    mesh.name = semanticAreaName(way.tags || {});
    group.add(mesh);
    count += 1;
  }
  world.add(group);
  return { count };
}

function installForestTrees(world, ways, terrain, center) {
  const forests = ways.filter((way) => way.tags?.natural === 'wood' || way.tags?.landuse === 'forest');
  const placements = [];
  for (const way of forests) {
    if (placements.length >= MAX_TREES) break;
    const polygon = geometryToWorldPolygon(way.geometry, center);
    if (polygon.length < 3) continue;
    const bounds = polygonBounds(polygon);
    const area = Math.max(0, polygonArea(polygon));
    const target = clamp(Math.round(area / 5_000), 3, 18);
    const random = seededRandom(Number(way.id) || 1);
    let attempts = 0;
    while (placements.length < MAX_TREES && attempts < target * 14) {
      attempts += 1;
      const x = bounds.minX + random() * bounds.width;
      const z = bounds.minZ + random() * bounds.depth;
      if (!pointInsidePolygon(x, z, polygon)) continue;
      placements.push({ x, z, scale: 0.75 + random() * 0.7, rotation: random() * Math.PI * 2 });
      if (placements.length % target === 0 && attempts >= target) break;
    }
  }
  if (!placements.length) return 0;

  const trees = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.7, 8.5, 5),
    new THREE.MeshStandardMaterial({ color: 0x35683f, roughness: 1, flatShading: true }),
    placements.length
  );
  const marker = new THREE.Object3D();
  placements.forEach((placement, index) => {
    marker.position.set(
      placement.x,
      terrain.heightAtWorld(placement.x, placement.z) + 4.1 * placement.scale,
      placement.z
    );
    marker.rotation.set(0, placement.rotation, 0);
    marker.scale.setScalar(placement.scale);
    marker.updateMatrix();
    trees.setMatrixAt(index, marker.matrix);
  });
  trees.instanceMatrix.needsUpdate = true;
  trees.castShadow = true;
  trees.name = 'Semantic forest';
  world.add(trees);
  return placements.length;
}

function densifyGeometry(geometry, center, terrain, spacing, verticalOffset) {
  const result = [];
  for (let index = 1; index < geometry.length; index += 1) {
    const a = geometry[index - 1];
    const b = geometry[index];
    const start = geoToWorld(a.lat, a.lon, center);
    const end = geoToWorld(b.lat, b.lon, center);
    const distance = Math.hypot(end.x - start.x, end.z - start.z);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let step = index === 1 ? 0 : 1; step <= steps; step += 1) {
      const amount = step / steps;
      const lat = lerp(a.lat, b.lat, amount);
      const lon = lerp(a.lon, b.lon, amount);
      const point = geoToWorld(lat, lon, center);
      point.y = terrain.heightAtLatLon(lat, lon) + 0.14 + verticalOffset;
      result.push(point);
    }
  }
  return result;
}

function pointsToSamples(points, distanceStart) {
  const samples = [];
  let distance = distanceStart;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const tangent = next.clone().sub(previous).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    if (index) distance += point.distanceTo(points[index - 1]);
    samples.push({ point, tangent, normal, distance });
  }
  return samples;
}

function capSamples(samples, limit) {
  if (samples.length <= limit) return samples;
  const stride = samples.length / limit;
  return Array.from({ length: limit }, (_, index) => samples[Math.floor(index * stride)]);
}

function isDrivableWay(way) {
  const highway = way.tags?.highway;
  const aeroway = way.tags?.aeroway;
  return ROAD_CLASSES.has(highway) || aeroway === 'runway' || aeroway === 'taxiway';
}

function roadWidth(tags) {
  if (tags.aeroway === 'runway') return 46;
  if (tags.aeroway === 'taxiway') return 18;
  const defaults = {
    motorway: 13, motorway_link: 8, trunk: 12, trunk_link: 8,
    primary: 10.5, primary_link: 7.5, secondary: 9.5, secondary_link: 7,
    tertiary: 8.5, tertiary_link: 6.5, residential: 7, unclassified: 6.5,
    living_street: 6, service: 5, track: 4
  };
  const lanes = parseInt(tags.lanes, 10);
  const laneWidth = Number.isFinite(lanes) && lanes > 0 ? lanes * 3.15 + 1.2 : 0;
  return Math.max(defaults[tags.highway] || 6, laneWidth);
}

function roadColor(tags) {
  if (tags.aeroway) return new THREE.Color(0x4a4d52);
  const surface = String(tags.surface || '').toLowerCase();
  if (/gravel|dirt|ground|unpaved|fine_gravel|compacted/.test(surface) || tags.highway === 'track') {
    return new THREE.Color(0x8b7d69);
  }
  if (/motorway|trunk|primary/.test(tags.highway || '')) return new THREE.Color(0x353a40);
  return new THREE.Color(0x464b50);
}

function shouldMarkCenter(tags) {
  if (tags.aeroway) return false;
  if (['track', 'service', 'living_street'].includes(tags.highway)) return false;
  const surface = String(tags.surface || '').toLowerCase();
  return !/gravel|dirt|ground|unpaved/.test(surface);
}

function roadVerticalOffset(way) {
  if (way.tags?.bridge === 'yes' || way.tags?.bridge === 'viaduct') return 1.35;
  if (way.tags?.tunnel === 'yes') return -0.2;
  const layer = Number.parseInt(way.tags?.layer, 10);
  return Number.isFinite(layer) ? clamp(layer, -2, 3) * 0.45 : 0;
}

function buildingHeight(tags, seed) {
  const explicit = Number.parseFloat(tags.height);
  if (Number.isFinite(explicit) && explicit > 2) return clamp(explicit, 3, 80);
  const levels = Number.parseFloat(tags['building:levels']);
  if (Number.isFinite(levels) && levels > 0) return clamp(levels * 3.1, 3, 80);
  return 6.5 + (Math.abs(Number(seed) || 0) % 5) * 1.5;
}

function isLandPolygon(way) {
  if (!isClosedWay(way)) return false;
  const tags = way.tags || {};
  if (tags.natural === 'water' || tags.natural === 'wood') return true;
  if (tags.water || tags.waterway === 'riverbank') return true;
  if (LAND_TAGS.has(tags.landuse)) return true;
  return ['park', 'pitch', 'recreation_ground'].includes(tags.leisure);
}

function semanticAreaColor(tags) {
  if (tags.natural === 'water' || tags.water || tags.waterway === 'riverbank') return 0x3b98b5;
  if (tags.natural === 'wood' || tags.landuse === 'forest') return 0x4c7a4e;
  if (tags.landuse === 'farmland') return 0xc5b36d;
  if (tags.landuse === 'industrial') return 0x98958e;
  if (tags.landuse === 'commercial') return 0xb6a69a;
  if (tags.landuse === 'residential') return 0xb9b49d;
  if (tags.leisure === 'pitch') return 0x70a766;
  return 0x7fb36f;
}

function semanticAreaName(tags) {
  if (tags.natural === 'water' || tags.water || tags.waterway === 'riverbank') return 'Semantic water';
  if (tags.natural === 'wood' || tags.landuse === 'forest') return 'Semantic woodland';
  return `Semantic ${tags.landuse || tags.leisure || 'land'}`;
}

function extrudePolygon(polygon, centroid, height) {
  try {
    const shape = polygonShape(polygon, centroid);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    return geometry;
  } catch (_) {
    return null;
  }
}

function polygonShape(polygon, centroid) {
  const shape = new THREE.Shape();
  polygon.forEach((point, index) => {
    const x = point.x - centroid.x;
    const y = -(point.z - centroid.z);
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function geometryToWorldPolygon(geometry, center) {
  const points = geometry.map((point) => geoToWorld(point.lat, point.lon, center));
  if (points.length > 2 && points[0].distanceToSquared(points.at(-1)) < 0.01) points.pop();
  return points;
}

function isClosedWay(way) {
  const geometry = way.geometry;
  if (!Array.isArray(geometry) || geometry.length < 4) return false;
  const first = geometry[0];
  const last = geometry.at(-1);
  return Math.abs(first.lat - last.lat) < 1e-7 && Math.abs(first.lon - last.lon) < 1e-7;
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.z - next.x * current.z;
  }
  return Math.abs(area) / 2;
}

function polygonCentroid(points) {
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }), { x: 0, z: 0 });
  return { x: total.x / points.length, z: total.z / points.length };
}

function polygonBounds(points) {
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
}

function pointInsidePolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = ((a.z > z) !== (b.z > z))
      && (x < (b.x - a.x) * (z - a.z) / ((b.z - a.z) || 1e-9) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
}

function seededRandom(seed) {
  let value = (seed >>> 0) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4_294_967_296;
  };
}

function closestSampleIndex(samples, x, z) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  samples.forEach((sample, index) => {
    const dx = sample.point.x - x;
    const dz = sample.point.z - z;
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function normalizeCenter(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || lat < -85 || lat > 85) throw new Error('Latitude must be between -85 and 85.');
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error('Longitude must be between -180 and 180.');
  return Object.freeze({ lat, lon });
}

function boundsAround(center, radius) {
  const latDelta = radius / METERS_PER_DEGREE_LATITUDE;
  const lonDelta = radius / longitudeMetersPerDegree(center.lat);
  return Object.freeze({
    south: center.lat - latDelta,
    west: center.lon - lonDelta,
    north: center.lat + latDelta,
    east: center.lon + lonDelta
  });
}

function geoToWorld(lat, lon, center) {
  return new THREE.Vector3(
    (lon - center.lon) * longitudeMetersPerDegree(center.lat),
    0,
    -(lat - center.lat) * METERS_PER_DEGREE_LATITUDE
  );
}

function longitudeMetersPerDegree(latitude) {
  return Math.max(1, METERS_PER_DEGREE_LATITUDE * Math.cos(THREE.MathUtils.degToRad(latitude)));
}

function lonLatToTile(lon, lat, zoom) {
  const scale = 2 ** zoom;
  const x = (lon + 180) / 360 * scale;
  const latitudeRadians = THREE.MathUtils.degToRad(clamp(lat, -85.05112878, 85.05112878));
  const y = (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * scale;
  return { x, y };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
