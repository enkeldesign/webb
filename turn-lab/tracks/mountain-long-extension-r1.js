import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  MOUNTAIN_BRIDGE_CENTERS,
  MOUNTAIN_LOWER_TERRAIN_BOUNDS,
  MOUNTAIN_LOWER_VILLAGE_SITES,
  MOUNTAIN_REMOVED_EAST_PEAK,
  MOUNTAIN_TUNNEL_SPECS,
  MOUNTAIN_VIEW_SCREEN_SPECS
} from './mountain-layout.js';

const REVISION = 'mountain-long-course-r5-grounded-tunnel-collar';
const CITY_ROAD_URL = '/postal/assets/kenney/roads/road-straight.glb';
const FANTASY_FENCE_URL = '/turn/assets/scenery/mountain/fantasy/fence.glb';
const NATURE_ROCK_URL = '/turn/assets/scenery/mountain/nature/cliff-waterfall-rock.glb';
const HOUSE_PREFIX = 'Mountain Kenney Suburban house r5';
const STREETLIGHT_PREFIX = 'Mountain Kenney Holiday lit streetlight r4';
const BRIDGE_MODULE_LENGTH = 33.4;
const BRIDGE_ENTRY_RAIL_LENGTH = 20.5;
const BRIDGE_TARGET_WIDTH = 30.4;
const BRIDGE_DECK_THICKNESS = 0.08;
const BRIDGE_RAIL_HEIGHT = 2.05;
const TUNNEL_PORTAL_MARGIN = 5;
const TUNNEL_PORTAL_DEPTH = 4.8;
const TUNNEL_PORTAL_RING = 6;
const TUNNEL_PORTAL_APERTURE_MARGIN = 1.5;
const TUNNEL_PORTAL_ARC_SEGMENTS = 12;
const TUNNEL_PEAK_RADIAL_SEGMENTS = 144;
const TUNNEL_PEAK_HEIGHT_SEGMENTS = 72;
const WARM_LIGHT = 0xffc766;
const WARM_POOL = 0xffb000;
const INK = 0x17191d;
const SNOW = 0xeaf1f4;
const SNOW_SHADOW = 0xd5e1e7;
const GRANITE = 0x626b72;
const GRANITE_DARK = 0x4d565d;

function nearestSampleIndex(samples, x, z) {
  let nearest = 0;
  let distanceSq = Infinity;
  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index].point;
    const dx = point.x - x;
    const dz = point.z - z;
    const next = dx * dx + dz * dz;
    if (next < distanceSq) {
      nearest = index;
      distanceSq = next;
    }
  }
  return nearest;
}

function nearestNonLocalDistance(point, samples, ownIndex, exclusion = Math.round(samples.length * 0.03)) {
  let nearest = Infinity;
  for (let index = 0; index < samples.length; index += 3) {
    const raw = Math.abs(index - ownIndex);
    if (Math.min(raw, samples.length - raw) <= exclusion) continue;
    const sample = samples[index].point;
    nearest = Math.min(nearest, Math.hypot(point.x - sample.x, point.z - sample.z));
  }
  return nearest;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function collectNamed(world, prefix) {
  const result = [];
  world.traverse((object) => {
    if (object.name?.startsWith(prefix)) result.push(object);
  });
  return result;
}

function cloneMaterials(material, overrideColor = null) {
  const cloneOne = (source) => {
    const next = source.clone();
    if (overrideColor != null && next.color) next.color.setHex(overrideColor);
    if ('roughness' in next) next.roughness = 0.96;
    if ('metalness' in next) next.metalness = 0;
    next.transparent = false;
    next.opacity = 1;
    next.depthWrite = true;
    next.needsUpdate = true;
    return next;
  };
  return Array.isArray(material) ? material.map(cloneOne) : cloneOne(material);
}

function prepareMeshSource(scene, { overrideColor = null } = {}) {
  scene.updateWorldMatrix(true, true);
  let sourceMesh = null;
  scene.traverse((object) => {
    if (!sourceMesh && object?.isMesh && object.geometry) sourceMesh = object;
  });
  if (!sourceMesh) return null;

  const geometry = sourceMesh.geometry.clone();
  geometry.applyMatrix4(sourceMesh.matrixWorld);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds || bounds.isEmpty()) return null;
  const center = bounds.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -bounds.min.y, -center.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return Object.freeze({
    geometry,
    material: cloneMaterials(sourceMesh.material, overrideColor),
    size: geometry.boundingBox.getSize(new THREE.Vector3())
  });
}

async function loadBridgeSources() {
  const loader = new GLTFLoader();
  const requests = [
    ['road', CITY_ROAD_URL, null],
    ['fence', FANTASY_FENCE_URL, null],
    ['rock', NATURE_ROCK_URL, GRANITE]
  ];
  const settled = await Promise.allSettled(requests.map(async ([key, url, overrideColor]) => {
    const gltf = await loader.loadAsync(url);
    const source = prepareMeshSource(gltf.scene, { overrideColor });
    if (!source) throw new Error(`${key} has no usable mesh`);
    return [key, source];
  }));

  const sources = {};
  const errors = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') sources[result.value[0]] = result.value[1];
    else errors.push(`${requests[index][0]}: ${String(result.reason?.message || result.reason)}`);
  });
  return { sources, errors };
}

function makeAssetInstances(source, count, name) {
  if (!source || count <= 0) return null;
  const mesh = new THREE.InstancedMesh(source.geometry, source.material, count);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.turnOutlined = true;
  return mesh;
}

function bridgeSamples(samples) {
  return MOUNTAIN_BRIDGE_CENTERS.map(({ x, z }) => samples[nearestSampleIndex(samples, x, z)]);
}

function setAssetMatrix(mesh, index, source, sample, {
  width,
  height,
  length,
  sideOffset = 0,
  tangentOffset = 0,
  yOffset = 0
}) {
  const marker = new THREE.Object3D();
  marker.position.copy(sample.point)
    .addScaledVector(sample.normal, sideOffset)
    .addScaledVector(sample.tangent, tangentOffset);
  marker.position.y += yOffset;
  marker.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
  marker.scale.set(
    width / Math.max(0.001, source.size.x),
    height / Math.max(0.001, source.size.y),
    length / Math.max(0.001, source.size.z)
  );
  marker.updateMatrix();
  mesh.setMatrixAt(index, marker.matrix);
}

function installBridgeDeck(world, source, samples) {
  const modules = bridgeSamples(samples);
  const mesh = makeAssetInstances(source, modules.length, 'Mountain Kenney City Roads bridge deck LAB');
  if (!mesh) return 0;
  modules.forEach((sample, index) => {
    setAssetMatrix(mesh, index, source, sample, {
      width: BRIDGE_TARGET_WIDTH,
      height: BRIDGE_DECK_THICKNESS,
      length: BRIDGE_MODULE_LENGTH,
      yOffset: 0.055
    });
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  world.add(mesh);
  return modules.length;
}

function installBridgeRails(world, source, samples, trackWidth) {
  const modules = bridgeSamples(samples);
  const mesh = makeAssetInstances(source, modules.length * 2 - 1, 'Mountain Kenney Fantasy bridge rails LAB');
  if (!mesh) return 0;
  let cursor = 0;
  modules.forEach((sample, moduleIndex) => {
    const entryRail = moduleIndex === 0;
    const length = entryRail ? BRIDGE_ENTRY_RAIL_LENGTH : BRIDGE_MODULE_LENGTH;
    const tangentOffset = entryRail ? (BRIDGE_MODULE_LENGTH - length) / 2 : 0;
    for (const side of [-1, 1]) {
      // Travelling east, +normal is the left/north edge. Its first rail is
      // omitted to match the collision opening and give the turning approach
      // a full car-width of visual and physical forgiveness.
      if (moduleIndex === 0 && side === 1) continue;
      setAssetMatrix(mesh, cursor, source, sample, {
        width: 0.46,
        height: BRIDGE_RAIL_HEIGHT,
        length,
        sideOffset: side * (trackWidth / 2 + 0.42),
        tangentOffset,
        yOffset: 0.14
      });
      cursor += 1;
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = cursor;
  mesh.computeBoundingSphere();
  world.add(mesh);
  return cursor;
}

function setRockSupportMatrix(mesh, cursor, source, sample, terrainHeightAt, sideOffset, width) {
  const point = sample.point.clone().addScaledVector(sample.normal, sideOffset);
  const groundY = terrainHeightAt(point.x, point.z);
  const deckBottom = sample.point.y - 0.38;
  const marker = new THREE.Object3D();
  marker.position.set(point.x, groundY, point.z);
  marker.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
  marker.scale.set(
    width / Math.max(0.001, source.size.x),
    Math.max(2.2, deckBottom - groundY) / Math.max(0.001, source.size.y),
    width / Math.max(0.001, source.size.z)
  );
  marker.updateMatrix();
  mesh.setMatrixAt(cursor, marker.matrix);
}

function installBridgeSupports(world, source, samples, terrainHeightAt) {
  if (!source) return { pillars: 0, abutments: 0 };
  const modules = bridgeSamples(samples);
  const supportSamples = [modules[1], modules[3], modules[5]];
  const mesh = makeAssetInstances(source, 10, 'Mountain Kenney Nature rock bridge supports LAB');
  if (!mesh) return { pillars: 0, abutments: 0 };
  let cursor = 0;
  for (const sample of supportSamples) {
    for (const side of [-1, 1]) {
      setRockSupportMatrix(mesh, cursor, source, sample, terrainHeightAt, side * 5.8, 4.8);
      cursor += 1;
    }
  }
  for (const sample of [modules[0], modules.at(-1)]) {
    for (const side of [-1, 1]) {
      setRockSupportMatrix(mesh, cursor, source, sample, terrainHeightAt, side * 10.0, 7.2);
      cursor += 1;
    }
  }
  mesh.count = cursor;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  world.add(mesh);
  return { pillars: supportSamples.length * 2, abutments: 4 };
}

function installKenneyBridge(world, sources, errors, samples, trackWidth, terrainHeightAt) {
  const deckModules = installBridgeDeck(world, sources.road, samples);
  const railModules = installBridgeRails(world, sources.fence, samples, trackWidth);
  const supports = installBridgeSupports(world, sources.rock, samples, terrainHeightAt);
  return {
    deckModules,
    railModules,
    pillars: supports.pillars,
    abutments: supports.abutments,
    entryRailLength: BRIDGE_ENTRY_RAIL_LENGTH,
    openLeftEntry: true,
    assetErrors: errors,
    drawCalls: Number(Boolean(deckModules)) + Number(Boolean(railModules)) + Number(Boolean(supports.pillars))
  };
}

function outsidePeak(point, spec) {
  return Math.hypot(point.x - spec.peak.x, point.z - spec.peak.z)
    >= spec.peak.radius + TUNNEL_PORTAL_MARGIN;
}

function forwardSampleRange(samples, startIndex, endIndex) {
  const range = [];
  let index = startIndex;
  for (let step = 0; step <= samples.length; step += 1) {
    range.push(samples[index]);
    if (index === endIndex) break;
    index = (index + 1) % samples.length;
  }
  return range;
}

function tunnelSampleRange(samples, spec) {
  return forwardSampleRange(
    samples,
    nearestSampleIndex(samples, spec.start.x, spec.start.z),
    nearestSampleIndex(samples, spec.end.x, spec.end.z)
  );
}

function visibleTunnelSampleRange(samples, spec) {
  const authored = tunnelSampleRange(samples, spec);
  const inside = authored.reduce((range, sample, index) => {
    const radius = Math.hypot(sample.point.x - spec.peak.x, sample.point.z - spec.peak.z);
    if (radius <= spec.portalRadius) {
      if (range.start < 0) range.start = index;
      range.end = index;
    }
    return range;
  }, { start: -1, end: -1 });
  if (inside.start < 0 || inside.end <= inside.start) return authored;
  return authored.slice(inside.start, inside.end + 1);
}

function expandedTunnelSampleRange(samples, spec) {
  let startIndex = nearestSampleIndex(samples, spec.start.x, spec.start.z);
  let endIndex = nearestSampleIndex(samples, spec.end.x, spec.end.z);
  for (let step = 0; step < samples.length && !outsidePeak(samples[startIndex].point, spec); step += 1) {
    startIndex = (startIndex - 1 + samples.length) % samples.length;
  }
  for (let step = 0; step < samples.length && !outsidePeak(samples[endIndex].point, spec); step += 1) {
    endIndex = (endIndex + 1) % samples.length;
  }
  return forwardSampleRange(samples, startIndex, endIndex);
}

function decimateTunnelPath(samples, spacing = 11) {
  if (samples.length <= 2) return [...samples];
  const path = [samples[0]];
  let anchor = samples[0].point;
  for (let index = 1; index < samples.length - 1; index += 1) {
    if (samples[index].point.distanceTo(anchor) < spacing) continue;
    path.push(samples[index]);
    anchor = samples[index].point;
  }
  if (path.at(-1) !== samples.at(-1)) path.push(samples.at(-1));
  return path;
}

function tunnelPaths(samples) {
  return MOUNTAIN_TUNNEL_SPECS.map((spec) => Object.freeze({
    spec,
    // Sink the visible lining and portal into rock tall enough to surround the
    // complete arch. A separate, wider hidden carve still reaches past the
    // exterior shell so the chase camera never crosses an uncut cone face.
    path: Object.freeze(decimateTunnelPath(visibleTunnelSampleRange(samples, spec))),
    carvePath: Object.freeze(decimateTunnelPath(expandedTunnelSampleRange(samples, spec)))
  }));
}

function installTunnelLining(world, tunnels) {
  const positions = [];
  const indices = [];
  const ringOffsets = [-1, -1, -0.56, 0.56, 1, 1];
  const ringHeights = [-0.8, 0.58, 1, 1, 0.58, -0.8];

  for (const { spec, path } of tunnels) {
    const base = positions.length / 3;
    path.forEach((sample) => {
      ringOffsets.forEach((offset, vertex) => {
        const point = sample.point.clone().addScaledVector(sample.normal, offset * spec.halfWidth);
        point.y = sample.point.y + (ringHeights[vertex] < 0
          ? ringHeights[vertex]
          : ringHeights[vertex] * spec.clearHeight);
        positions.push(point.x, point.y, point.z);
      });
    });

    for (let section = 0; section < path.length - 1; section += 1) {
      for (let face = 0; face < ringOffsets.length - 1; face += 1) {
        const a = base + section * ringOffsets.length + face;
        const b = a + 1;
        const c = a + ringOffsets.length;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x465057,
      emissive: 0x15202a,
      emissiveIntensity: 0.3,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      flatShading: true
    })
  );
  mesh.name = 'Mountain carved tunnel continuous rock lining LAB';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  world.add(mesh);
  return { triangles: indices.length / 3, drawCalls: 1 };
}

function tunnelPortals(tunnels) {
  return tunnels.flatMap(({ spec, path }) => [
    Object.freeze({ spec, sample: path[0], direction: -1 }),
    Object.freeze({ spec, sample: path.at(-1), direction: 1 })
  ]);
}

function tunnelPortalProfile(spec, outer = false) {
  const radiusX = spec.halfWidth + (outer ? TUNNEL_PORTAL_RING : 0);
  const springHeight = spec.clearHeight * 0.36;
  const archRise = spec.clearHeight - springHeight + (outer ? TUNNEL_PORTAL_RING : 0);
  const profile = [{ lateral: -radiusX, height: outer ? -0.95 : -0.7 }];
  for (let segment = 0; segment <= TUNNEL_PORTAL_ARC_SEGMENTS; segment += 1) {
    const angle = Math.PI - segment / TUNNEL_PORTAL_ARC_SEGMENTS * Math.PI;
    profile.push({
      lateral: Math.cos(angle) * radiusX,
      height: springHeight + Math.sin(angle) * archRise
    });
  }
  profile.push({ lateral: radiusX, height: outer ? -0.95 : -0.7 });
  return profile;
}

function tunnelPortalWorldPoint(portal, profilePoint, depthOffset) {
  // direction points out of the tunnel. Centre the extrusion one half-depth
  // inward so the visible front face is flush with the authored mountain mouth.
  const inwardCentre = -portal.direction * TUNNEL_PORTAL_DEPTH / 2;
  const point = portal.sample.point.clone()
    .addScaledVector(portal.sample.normal, profilePoint.lateral)
    .addScaledVector(portal.sample.tangent, inwardCentre + depthOffset);
  point.y = portal.sample.point.y + profilePoint.height;
  return point;
}

function appendPortalQuad(positions, indices, a, b, c, d) {
  const base = positions.length / 3;
  for (const point of [a, b, c, d]) positions.push(point.x, point.y, point.z);
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function installTunnelPortalArches(world, portals) {
  if (!portals.length) return { arches: 0, triangles: 0, drawCalls: 0 };
  const positions = [];
  const indices = [];
  const halfDepth = TUNNEL_PORTAL_DEPTH / 2;
  for (const portal of portals) {
    const inner = tunnelPortalProfile(portal.spec);
    const outer = tunnelPortalProfile(portal.spec, true);
    for (let segment = 0; segment < inner.length - 1; segment += 1) {
      const innerFront = tunnelPortalWorldPoint(portal, inner[segment], -halfDepth);
      const innerFrontNext = tunnelPortalWorldPoint(portal, inner[segment + 1], -halfDepth);
      const outerFront = tunnelPortalWorldPoint(portal, outer[segment], -halfDepth);
      const outerFrontNext = tunnelPortalWorldPoint(portal, outer[segment + 1], -halfDepth);
      const innerBack = tunnelPortalWorldPoint(portal, inner[segment], halfDepth);
      const innerBackNext = tunnelPortalWorldPoint(portal, inner[segment + 1], halfDepth);
      const outerBack = tunnelPortalWorldPoint(portal, outer[segment], halfDepth);
      const outerBackNext = tunnelPortalWorldPoint(portal, outer[segment + 1], halfDepth);

      appendPortalQuad(positions, indices, innerFront, innerFrontNext, outerFrontNext, outerFront);
      appendPortalQuad(positions, indices, outerBack, outerBackNext, innerBackNext, innerBack);
      appendPortalQuad(positions, indices, outerFront, outerFrontNext, outerBackNext, outerBack);
      appendPortalQuad(positions, indices, innerBack, innerBackNext, innerFrontNext, innerFront);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x879399,
      emissive: 0x26333b,
      emissiveIntensity: 0.32,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      flatShading: true
    })
  );
  mesh.name = 'Mountain tunnel batched mountain-aligned granite arches LAB';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.turnOutlined = true;
  world.add(mesh);
  return { arches: portals.length, triangles: indices.length / 3, drawCalls: 1 };
}

function setTunnelPortalRockMatrix(mesh, index, source, portal, terrainHeightAt, side, layer) {
  const { spec, sample, direction } = portal;
  const marker = new THREE.Object3D();
  const shoulder = layer === 1;
  const sideOffset = spec.halfWidth + (shoulder ? 1.8 : 4.6);
  const tangentOffset = -direction * (shoulder ? 2.1 : 1.0);
  const point = sample.point.clone()
    .addScaledVector(sample.normal, side * sideOffset)
    .addScaledVector(sample.tangent, tangentOffset);
  const baseY = shoulder
    ? sample.point.y + spec.clearHeight * 0.38
    : terrainHeightAt(point.x, point.z) - 0.3;
  marker.position.set(point.x, baseY, point.z);
  marker.rotation.set(
    shoulder ? side * 0.08 : 0,
    Math.atan2(sample.tangent.x, sample.tangent.z) + side * (shoulder ? 0.34 : 0.18),
    shoulder ? -side * 0.12 : 0
  );
  marker.scale.set(
    (shoulder ? 5.6 : 8.2) / Math.max(0.001, source.size.x),
    (shoulder ? 5.2 : 6.6) / Math.max(0.001, source.size.y),
    (shoulder ? 5.0 : 7.2) / Math.max(0.001, source.size.z)
  );
  marker.updateMatrix();
  mesh.setMatrixAt(index, marker.matrix);
}

function installTunnelPortalRocks(world, source, portals, terrainHeightAt) {
  if (!source || !portals.length) return { rocks: 0, drawCalls: 0 };
  const count = portals.length * 4;
  const mesh = makeAssetInstances(source, count, 'Mountain Kenney Nature tunnel portal rocks LAB');
  if (!mesh) return { rocks: 0, drawCalls: 0 };
  let cursor = 0;
  for (const portal of portals) {
    for (const side of [-1, 1]) {
      for (const layer of [0, 1]) {
        setTunnelPortalRockMatrix(mesh, cursor++, source, portal, terrainHeightAt, side, layer);
      }
    }
  }
  mesh.count = cursor;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  world.add(mesh);
  return { rocks: cursor, drawCalls: cursor ? 1 : 0 };
}

function installTunnelReflectors(world, tunnels) {
  const placements = [];
  for (const { spec, path } of tunnels) {
    for (let index = 1; index < path.length - 1; index += 2) {
      for (const side of [-1, 1]) placements.push({ spec, sample: path[index], side });
    }
  }
  if (!placements.length) return { reflectors: 0, drawCalls: 0 };
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.46, 0.66, 1.05),
    new THREE.MeshBasicMaterial({ color: WARM_LIGHT, toneMapped: false }),
    placements.length
  );
  mesh.name = 'Mountain tunnel instanced warm wall lamps LAB';
  const marker = new THREE.Object3D();
  placements.forEach(({ spec, sample, side }, index) => {
    marker.position.copy(sample.point).addScaledVector(sample.normal, side * (spec.halfWidth - 0.35));
    marker.position.y += 3.0;
    marker.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.scale.set(1, 1, 1);
    marker.updateMatrix();
    mesh.setMatrixAt(index, marker.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.computeBoundingSphere();
  world.add(mesh);
  return { reflectors: placements.length, drawCalls: 1 };
}

function tunnelContainsWorldPoint(point, path, spec) {
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index].point;
    const end = path[index + 1].point;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const denominator = Math.max(0.0001, dx * dx + dz * dz);
    const along = THREE.MathUtils.clamp(
      ((point.x - start.x) * dx + (point.z - start.z) * dz) / denominator,
      0,
      1
    );
    const nearestX = start.x + dx * along;
    const nearestZ = start.z + dz * along;
    const floorY = THREE.MathUtils.lerp(start.y, end.y, along);
    const centreRadius = Math.hypot(nearestX - spec.peak.x, nearestZ - spec.peak.z);
    const cameraExpansion = THREE.MathUtils.smoothstep(spec.portalRadius - centreRadius, 0, 28);
    // Keep the exterior aperture smaller than the broad stone collar so the
    // one-time triangle cut cannot leave a visible saw-tooth gap around it.
    // The full chase-camera clearance still blends in behind the portal.
    const portalCarveHalfWidth = spec.halfWidth + TUNNEL_PORTAL_APERTURE_MARGIN;
    const portalCarveClearHeight = spec.clearHeight + TUNNEL_PORTAL_APERTURE_MARGIN;
    const carveHalfWidth = THREE.MathUtils.lerp(
      portalCarveHalfWidth,
      spec.carveHalfWidth,
      cameraExpansion
    );
    const carveClearHeight = THREE.MathUtils.lerp(
      portalCarveClearHeight,
      spec.carveClearHeight,
      cameraExpansion
    );
    if (
      Math.hypot(point.x - nearestX, point.z - nearestZ) < carveHalfWidth
      && point.y > floorY - 2
      && point.y < floorY + carveClearHeight
    ) return true;
  }
  return false;
}

function mountainVertexColors(geometry, spec) {
  const positions = geometry.getAttribute('position');
  const colors = [];
  const styleIndex = spec.id === 'lower-village' ? 5 : 6;
  const rock = new THREE.Color(styleIndex % 2 ? 0x7d878d : 0x69747b);
  const snow = new THREE.Color(SNOW);
  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    const x = positions.getX(vertex);
    const y = positions.getY(vertex);
    const z = positions.getZ(vertex);
    const normalizedHeight = (y + spec.peak.height / 2) / spec.peak.height;
    const angle = Math.atan2(z, x);
    const snowLine = 0.64
      + Math.sin(angle * 3 + styleIndex * 0.9) * 0.045
      + Math.sin(angle * 7) * 0.018;
    const color = normalizedHeight >= snowLine ? snow : rock;
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function cpuCarvedMountainGeometry(peak, path, spec) {
  // This is the only higher-detail peak mesh in the LAB. The extra
  // tessellation makes the baked portal cut clean while staying far cheaper
  // than a per-fragment carve on the large occluders every frame.
  const geometry = new THREE.ConeGeometry(
    spec.peak.radius,
    spec.peak.height,
    TUNNEL_PEAK_RADIAL_SEGMENTS,
    TUNNEL_PEAK_HEIGHT_SEGMENTS
  );
  mountainVertexColors(geometry, spec);
  peak.updateWorldMatrix(true, false);
  const positions = geometry.getAttribute('position');
  const sourceIndex = geometry.getIndex();
  const kept = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const edge = new THREE.Vector3();
  for (let offset = 0; offset < sourceIndex.count; offset += 3) {
    a.fromBufferAttribute(positions, sourceIndex.getX(offset)).applyMatrix4(peak.matrixWorld);
    b.fromBufferAttribute(positions, sourceIndex.getX(offset + 1)).applyMatrix4(peak.matrixWorld);
    c.fromBufferAttribute(positions, sourceIndex.getX(offset + 2)).applyMatrix4(peak.matrixWorld);
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    const intersectsTunnel = tunnelContainsWorldPoint(centroid, path, spec)
      || tunnelContainsWorldPoint(edge.copy(a).add(b).multiplyScalar(0.5), path, spec)
      || tunnelContainsWorldPoint(edge.copy(b).add(c).multiplyScalar(0.5), path, spec)
      || tunnelContainsWorldPoint(edge.copy(c).add(a).multiplyScalar(0.5), path, spec);
    if (intersectsTunnel) continue;
    kept.push(sourceIndex.getX(offset), sourceIndex.getX(offset + 1), sourceIndex.getX(offset + 2));
  }
  geometry.setIndex(kept);
  geometry.clearGroups();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return {
    geometry,
    removedTriangles: (sourceIndex.count - kept.length) / 3
  };
}

function findIntegratedPeak(world, spec) {
  let peak = null;
  world.traverse((object) => {
    if (peak || object.name !== 'Mountain integrated snowy ridge r3') return;
    if (Math.hypot(object.position.x - spec.x, object.position.z - spec.z) <= 2) peak = object;
  });
  return peak;
}

function disposeObjectMesh(object) {
  object?.geometry?.dispose?.();
  const materials = Array.isArray(object?.material) ? object.material : [object?.material];
  for (const material of materials) material?.dispose?.();
}

function removeRetiredEastTunnelMountain(world) {
  const peak = findIntegratedPeak(world, MOUNTAIN_REMOVED_EAST_PEAK);
  if (!peak?.isMesh || !peak.parent) return 0;
  peak.parent.remove(peak);
  disposeObjectMesh(peak);
  return 1;
}

function installTunnelMountainCarves(world, tunnels) {
  let carved = 0;
  let removedTriangles = 0;
  for (const { spec, carvePath } of tunnels) {
    const peak = findIntegratedPeak(world, spec.peak);
    if (!peak?.isMesh || !peak.material) continue;
    const previousGeometry = peak.geometry;
    const carve = cpuCarvedMountainGeometry(peak, carvePath, spec);
    peak.geometry = carve.geometry;
    previousGeometry?.dispose?.();
    peak.userData.turnMountainTunnelCarve = spec.id;
    removedTriangles += carve.removedTriangles;
    carved += 1;
  }
  return { carved, removedTriangles };
}

function pointInsideTunnelSceneryClearance(point, tunnels) {
  for (const { spec, path } of tunnels) {
    if (Math.hypot(point.x - spec.peak.x, point.z - spec.peak.z) > spec.peak.radius + 3) continue;
    for (let index = 0; index < path.length - 1; index += 1) {
      const start = path[index].point;
      const end = path[index + 1].point;
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const denominator = Math.max(0.0001, dx * dx + dz * dz);
      const along = THREE.MathUtils.clamp(
        ((point.x - start.x) * dx + (point.z - start.z) * dz) / denominator,
        0,
        1
      );
      const nearestX = start.x + dx * along;
      const nearestZ = start.z + dz * along;
      if (Math.hypot(point.x - nearestX, point.z - nearestZ) <= spec.halfWidth + 6) return true;
    }
  }
  return false;
}

function clearTunnelSpruceInstances(world, tunnels) {
  const crowns = world.getObjectByName('Mountain terrain-grounded spruce crowns r3');
  const snowCaps = world.getObjectByName('Mountain terrain-grounded spruce snow caps r3');
  const siblings = crowns?.parent?.children;
  const crownIndex = siblings?.indexOf(crowns) ?? -1;
  const meshes = crownIndex > 0
    ? [siblings[crownIndex - 1], crowns, siblings[crownIndex + 1], snowCaps]
    : [];
  if (
    meshes.length !== 4
    || new Set(meshes).size !== 4
    || meshes.some((mesh) => !mesh?.isInstancedMesh || mesh.count !== crowns.count)
  ) return 0;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const keep = [];
  for (let index = 0; index < crowns.count; index += 1) {
    crowns.getMatrixAt(index, matrix);
    position.setFromMatrixPosition(matrix);
    if (!pointInsideTunnelSceneryClearance(position, tunnels)) keep.push(index);
  }
  const removed = crowns.count - keep.length;
  if (!removed) return 0;

  for (const mesh of meshes) {
    keep.forEach((sourceIndex, targetIndex) => {
      mesh.getMatrixAt(sourceIndex, matrix);
      mesh.setMatrixAt(targetIndex, matrix);
    });
    mesh.count = keep.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  return removed;
}

function installMountainTunnels(world, samples, rockSource, terrainHeightAt) {
  const removedMountainMeshes = removeRetiredEastTunnelMountain(world);
  const tunnels = tunnelPaths(samples);
  const removedSceneryTrees = clearTunnelSpruceInstances(world, tunnels);
  const portals = tunnelPortals(tunnels);
  const carves = installTunnelMountainCarves(world, tunnels);
  const lining = installTunnelLining(world, tunnels);
  const arches = installTunnelPortalArches(world, portals);
  const rocks = installTunnelPortalRocks(world, rockSource, portals, terrainHeightAt);
  const reflectors = installTunnelReflectors(world, tunnels);
  return {
    tunnels: tunnels.length,
    portals: portals.length,
    removedMountainMeshes,
    removedSceneryTrees,
    carvedMountainMeshes: carves.carved,
    carvedMountainTriangles: carves.removedTriangles,
    liningTriangles: lining.triangles,
    portalArches: arches.arches,
    portalTriangles: arches.triangles,
    portalRocks: rocks.rocks,
    reflectors: reflectors.reflectors,
    drawCalls: lining.drawCalls + arches.drawCalls + rocks.drawCalls + reflectors.drawCalls
  };
}

function installLowerTerrain(world, terrainHeightAt) {
  const { minX, maxX, minZ, maxZ, segmentsX, segmentsZ } = MOUNTAIN_LOWER_TERRAIN_BOUNDS;
  const positions = [];
  const colors = [];
  const indices = [];
  const snow = new THREE.Color(SNOW);
  const shadow = new THREE.Color(SNOW_SHADOW);
  const granite = new THREE.Color(GRANITE);

  for (let zi = 0; zi <= segmentsZ; zi += 1) {
    const z = THREE.MathUtils.lerp(minZ, maxZ, zi / segmentsZ);
    for (let xi = 0; xi <= segmentsX; xi += 1) {
      const x = THREE.MathUtils.lerp(minX, maxX, xi / segmentsX);
      const overlapSink = THREE.MathUtils.clamp((z + 325) / 33, 0, 1) * 0.16;
      const y = terrainHeightAt(x, z) - overlapSink;
      positions.push(x, y, z);
      const rocky = Math.sin(x * 0.031 + z * 0.019) + Math.sin(z * 0.047 - x * 0.013) > 1.35;
      const color = rocky
        ? granite.clone().lerp(shadow, 0.18)
        : snow.clone().lerp(shadow, THREE.MathUtils.clamp((5 - y) / 28, 0, 0.28));
      colors.push(color.r, color.g, color.b);
    }
  }

  const row = segmentsX + 1;
  for (let zi = 0; zi < segmentsZ; zi += 1) {
    for (let xi = 0; xi < segmentsX; xi += 1) {
      const a = zi * row + xi;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
  );
  mesh.name = 'Mountain lower valley continuous terrain LAB';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  world.add(mesh);
  return Object.freeze({ vertices: positions.length / 3, triangles: indices.length / 3, drawCalls: 1 });
}

function safeHousePoint(samples, ownIndex, side, trackWidth) {
  const sample = samples[ownIndex];
  for (const offset of [31, 36, 41, 46, 51]) {
    const point = sample.point.clone().addScaledVector(sample.normal, side * offset);
    if (nearestNonLocalDistance(point, samples, ownIndex) >= trackWidth + 10) return point;
  }
  return null;
}

function installLowerVillage(world, samples, trackWidth, terrainHeightAt) {
  const sources = collectNamed(world, HOUSE_PREFIX);
  if (!sources.length) return { houses: 0, maximumGroundDelta: Infinity, drawCalls: 0 };
  const selectedSources = sources.slice(0, Math.min(4, sources.length));
  const placementsBySource = new Map(selectedSources.map((source) => [source, []]));
  let maximumGroundDelta = 0;
  MOUNTAIN_LOWER_VILLAGE_SITES.forEach((site, index) => {
    const sampleIndex = nearestSampleIndex(samples, site.x, site.z);
    const sample = samples[sampleIndex];
    const point = safeHousePoint(samples, sampleIndex, site.side, trackWidth);
    if (!point) return;
    const source = selectedSources[index % selectedSources.length];
    source.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(source, true);
    if (bounds.isEmpty()) return;
    const localFloor = bounds.min.y - source.position.y;
    const groundY = terrainHeightAt(point.x, point.z);
    point.y = groundY - localFloor - 0.04;
    placementsBySource.get(source).push({
      point,
      yaw: Math.atan2(sample.tangent.x, sample.tangent.z) + Math.PI
    });
    maximumGroundDelta = Math.max(maximumGroundDelta, 0.04);
  });
  let drawCalls = 0;
  let houses = 0;
  let sourceIndex = 0;
  for (const [source, placements] of placementsBySource) {
    if (!placements.length) continue;
    sourceIndex += 1;
    houses += placements.length;
    drawCalls += installInstancedObject(
      world,
      source,
      placements,
      `Mountain lower village instanced brown snow houses LAB type ${sourceIndex}`
    );
  }
  return {
    houses,
    maximumGroundDelta,
    drawCalls
  };
}

function objectMeshDescriptors(source) {
  source.updateWorldMatrix(true, true);
  const inverseRoot = source.matrixWorld.clone().invert();
  const descriptors = [];
  source.traverse((object) => {
    if (!object?.isMesh || !object.geometry || !object.material) return;
    descriptors.push({
      geometry: object.geometry,
      material: object.material,
      relativeMatrix: inverseRoot.clone().multiply(object.matrixWorld)
    });
  });
  return descriptors;
}

function installInstancedObject(world, source, placements, name) {
  if (!source || !placements.length) return 0;
  const descriptors = objectMeshDescriptors(source);
  const marker = new THREE.Object3D();
  const composed = new THREE.Matrix4();
  descriptors.forEach((descriptor, meshIndex) => {
    const instances = new THREE.InstancedMesh(descriptor.geometry, descriptor.material, placements.length);
    instances.name = `${name} mesh ${meshIndex + 1}`;
    placements.forEach((placement, index) => {
      marker.position.copy(placement.point);
      marker.rotation.set(0, placement.yaw, 0);
      marker.scale.copy(source.scale);
      marker.updateMatrix();
      composed.multiplyMatrices(marker.matrix, descriptor.relativeMatrix);
      instances.setMatrixAt(index, composed);
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = false;
    instances.receiveShadow = true;
    instances.userData.turnOutlined = true;
    instances.computeBoundingSphere();
    world.add(instances);
  });
  return descriptors.length;
}

function installCheapVillageLights(world, samples, trackWidth, terrainHeightAt) {
  const placements = MOUNTAIN_LOWER_VILLAGE_SITES.map((site) => {
    const index = nearestSampleIndex(samples, site.x, site.z);
    const sample = samples[index];
    const point = sample.point.clone().addScaledVector(
      sample.normal,
      site.side * (trackWidth / 2 + 5.0)
    );
    point.y = terrainHeightAt(point.x, point.z);
    return { point, yaw: Math.atan2(sample.tangent.x, sample.tangent.z) };
  });
  const lanternSource = collectNamed(world, STREETLIGHT_PREFIX)[0] || null;
  const sourceBounds = lanternSource ? new THREE.Box3().setFromObject(lanternSource, true) : null;
  const lampHeight = sourceBounds?.isEmpty() === false
    ? sourceBounds.getSize(new THREE.Vector3()).y
    : 5.2;
  const assetDrawCalls = installInstancedObject(
    world,
    lanternSource,
    placements,
    'Mountain lower village Kenney lanterns LAB'
  );

  const core = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshBasicMaterial({ color: WARM_LIGHT, toneMapped: false }),
    placements.length
  );
  core.name = 'Mountain lower village emissive lamp cores LAB';
  const halo = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshBasicMaterial({
      color: WARM_LIGHT,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    }),
    placements.length
  );
  halo.name = 'Mountain lower village emissive lamp halos LAB';
  const pool = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 18),
    new THREE.MeshBasicMaterial({
      color: WARM_POOL,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false
    }),
    placements.length
  );
  pool.name = 'Mountain lower village cheap light pools LAB';

  const marker = new THREE.Object3D();
  const coreRadius = THREE.MathUtils.clamp(lampHeight * 0.065, 0.34, 0.72);
  placements.forEach((entry, index) => {
    marker.position.set(entry.point.x, entry.point.y + lampHeight * 0.80, entry.point.z);
    marker.rotation.set(0, 0, 0);
    marker.scale.setScalar(coreRadius);
    marker.updateMatrix();
    core.setMatrixAt(index, marker.matrix);

    marker.scale.setScalar(coreRadius * 2.2);
    marker.updateMatrix();
    halo.setMatrixAt(index, marker.matrix);

    marker.position.set(entry.point.x, entry.point.y + 0.12, entry.point.z);
    marker.rotation.set(-Math.PI / 2, 0, 0);
    marker.scale.set(8.5, 8.5, 1);
    marker.updateMatrix();
    pool.setMatrixAt(index, marker.matrix);
  });
  for (const mesh of [core, halo, pool]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.computeBoundingSphere();
    world.add(mesh);
  }
  return { lights: placements.length, assetDrawCalls, glowDrawCalls: 3 };
}

function forestRouteIndices(samples) {
  const start = nearestSampleIndex(samples, -240, -255);
  const end = nearestSampleIndex(samples, 115, -278);
  return start <= end ? [start, end] : [end, start];
}

function installForestReturn(world, samples, trackWidth, terrainHeightAt) {
  const crownSource = world.getObjectByName('Mountain terrain-grounded spruce crowns r3');
  const capSource = world.getObjectByName('Mountain terrain-grounded spruce snow caps r3');
  if (!crownSource?.geometry || !capSource?.geometry) return { trees: 0, drawCalls: 0 };

  const random = seededRandom(0x4c414246);
  const [start, end] = forestRouteIndices(samples);
  const placements = [];
  for (let index = start; index <= end; index += 8) {
    const sample = samples[index];
    const sides = index % 24 === 0 ? [-1, 1] : [random() > 0.5 ? -1 : 1];
    for (const side of sides) {
      const offset = trackWidth / 2 + 12 + random() * 14;
      const point = sample.point.clone().addScaledVector(sample.normal, side * offset);
      if (nearestNonLocalDistance(point, samples, index) < trackWidth + 7) continue;
      point.y = terrainHeightAt(point.x, point.z);
      placements.push({ point, yaw: random() * Math.PI * 2, scale: 0.62 + random() * 0.54 });
    }
  }
  if (!placements.length) return { trees: 0, drawCalls: 0 };

  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.3, 0.42, 4.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x60472f, roughness: 1 }),
    placements.length
  );
  const lowers = new THREE.InstancedMesh(crownSource.geometry, crownSource.material, placements.length);
  const crowns = new THREE.InstancedMesh(crownSource.geometry, crownSource.material, placements.length);
  const caps = new THREE.InstancedMesh(capSource.geometry, capSource.material, placements.length);
  trunks.name = 'Mountain lower forest instanced trunks LAB';
  lowers.name = 'Mountain lower forest instanced lower crowns LAB';
  crowns.name = 'Mountain lower forest instanced upper crowns LAB';
  caps.name = 'Mountain lower forest instanced snow caps LAB';

  const marker = new THREE.Object3D();
  placements.forEach((entry, index) => {
    marker.rotation.set(0, entry.yaw, 0);
    marker.scale.setScalar(entry.scale);
    marker.position.copy(entry.point);
    marker.position.y += 2.3 * entry.scale;
    marker.updateMatrix();
    trunks.setMatrixAt(index, marker.matrix);

    marker.position.copy(entry.point);
    marker.position.y += 5.4 * entry.scale;
    marker.scale.set(entry.scale * 1.18, entry.scale * 0.78, entry.scale * 1.18);
    marker.updateMatrix();
    lowers.setMatrixAt(index, marker.matrix);

    marker.position.copy(entry.point);
    marker.position.y += 8.0 * entry.scale;
    marker.rotation.y = entry.yaw + 0.14;
    marker.scale.setScalar(entry.scale);
    marker.updateMatrix();
    crowns.setMatrixAt(index, marker.matrix);

    marker.position.copy(entry.point);
    marker.position.y += 9.2 * entry.scale;
    marker.rotation.y = entry.yaw - 0.10;
    marker.scale.setScalar(entry.scale);
    marker.updateMatrix();
    caps.setMatrixAt(index, marker.matrix);
  });

  for (const mesh of [trunks, lowers, crowns, caps]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.turnOutlined = true;
    mesh.computeBoundingSphere();
    world.add(mesh);
  }
  return { trees: placements.length, drawCalls: 4 };
}

function installInstancedViewScreens(world, terrainHeightAt) {
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: GRANITE_DARK, roughness: 1, flatShading: true }),
    MOUNTAIN_VIEW_SCREEN_SPECS.length
  );
  const caps = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: SNOW, roughness: 1, flatShading: true }),
    MOUNTAIN_VIEW_SCREEN_SPECS.length
  );
  rocks.name = 'Mountain lower valley instanced sightline granite LAB';
  caps.name = 'Mountain lower valley instanced sightline snow caps LAB';
  const marker = new THREE.Object3D();
  MOUNTAIN_VIEW_SCREEN_SPECS.forEach((spec, index) => {
    const ground = terrainHeightAt(spec.x, spec.z);
    marker.position.set(spec.x, ground + spec.sy * 0.68, spec.z);
    marker.rotation.set(0.05, spec.yaw, 0.03);
    marker.scale.set(spec.sx, spec.sy, spec.sz);
    marker.updateMatrix();
    rocks.setMatrixAt(index, marker.matrix);

    marker.position.set(spec.x, ground + spec.sy * 1.42, spec.z);
    marker.scale.set(spec.sx * 0.82, spec.sy * 0.20, spec.sz * 0.80);
    marker.updateMatrix();
    caps.setMatrixAt(index, marker.matrix);
  });
  for (const mesh of [rocks, caps]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    world.add(mesh);
  }
  return { screens: MOUNTAIN_VIEW_SCREEN_SPECS.length, drawCalls: 2 };
}

export async function installMountainLongExtension(world, samples, trackWidth = 27) {
  if (!world || !Array.isArray(samples) || samples.length < 3) return world;
  const terrainHeightAt = world.userData.turnMountainTerrainHeightAt;
  if (typeof terrainHeightAt !== 'function') return world;

  const structuresPromise = loadBridgeSources().then(({ sources, errors }) => ({
    bridge: installKenneyBridge(world, sources, errors, samples, trackWidth, terrainHeightAt),
    tunnels: installMountainTunnels(world, samples, sources.rock, terrainHeightAt)
  }));
  const terrain = installLowerTerrain(world, terrainHeightAt);
  const village = installLowerVillage(world, samples, trackWidth, terrainHeightAt);
  const streetlights = installCheapVillageLights(world, samples, trackWidth, terrainHeightAt);
  const forest = installForestReturn(world, samples, trackWidth, terrainHeightAt);
  const viewScreens = installInstancedViewScreens(world, terrainHeightAt);
  const { bridge, tunnels } = await structuresPromise;

  world.userData.turnMountainLongExtension = Object.freeze({
    revision: REVISION,
    bridgeDeckModules: bridge.deckModules,
    bridgeRailModules: bridge.railModules,
    bridgePillars: bridge.pillars,
    bridgeAbutments: bridge.abutments,
    bridgeEntryRailLength: bridge.entryRailLength,
    bridgeOpenLeftEntry: bridge.openLeftEntry,
    bridgeAssetErrors: Object.freeze([...bridge.assetErrors]),
    tunnels: tunnels.tunnels,
    tunnelPortals: tunnels.portals,
    removedMountainMeshes: tunnels.removedMountainMeshes,
    tunnelSceneryTreesRemoved: tunnels.removedSceneryTrees,
    carvedMountainMeshes: tunnels.carvedMountainMeshes,
    carvedMountainTriangles: tunnels.carvedMountainTriangles,
    tunnelLiningTriangles: tunnels.liningTriangles,
    tunnelPortalArches: tunnels.portalArches,
    tunnelPortalTriangles: tunnels.portalTriangles,
    tunnelPortalRocks: tunnels.portalRocks,
    tunnelReflectors: tunnels.reflectors,
    tunnelPortalRadius: Math.max(...MOUNTAIN_TUNNEL_SPECS.map((spec) => spec.portalRadius)),
    tunnelCarveHalfWidth: Math.max(...MOUNTAIN_TUNNEL_SPECS.map((spec) => spec.carveHalfWidth)),
    tunnelCarveClearHeight: Math.max(...MOUNTAIN_TUNNEL_SPECS.map((spec) => spec.carveClearHeight)),
    lowerTerrainVertices: terrain.vertices,
    lowerTerrainTriangles: terrain.triangles,
    lowerVillageHouses: village.houses,
    maximumHouseGroundDelta: village.maximumGroundDelta,
    cheapStreetlights: streetlights.lights,
    forestTrees: forest.trees,
    viewScreens: viewScreens.screens,
    addedDrawCalls: terrain.drawCalls
      + bridge.drawCalls
      + tunnels.drawCalls
      + village.drawCalls
      + streetlights.assetDrawCalls
      + streetlights.glowDrawCalls
      + forest.drawCalls
      + viewScreens.drawCalls,
    dynamicPointLightsAdded: 0,
    addedShadowCasters: 0,
    noDropEnvelope: true,
    performanceStrategy: 'production-world-1080; runtime-2160; removed-east-peak; one-cpu-carved-camera-safe-peak; batched-arch-and-lining; instanced-bridge-rocks-lamps-forest-lights-screens; no-new-dynamic-lights-or-shadow-casters'
  });
  return world;
}
