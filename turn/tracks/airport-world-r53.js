import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installAirportWorld as installAirportWorldR52 } from './airport-world-r52.js?build=20260722-r52';

const INK = 0x08090a;
const AMVLAB_COMMIT = '91d835e8e851b2317fe79af291c9fed6153fd525';
const AMVLAB_BASE = `https://raw.githubusercontent.com/amvlab/aircraft-models/${AMVLAB_COMMIT}/models/`;

// AMV Lab aircraft-models, CC BY 4.0. Logo-free variants are used so Airport gets
// recognisable real aircraft geometry without importing airline branding.
const AIRCRAFT_MODELS = Object.freeze({
  a320: Object.freeze({ url: `${AMVLAB_BASE}A320_nologo.glb`, lengthToSpanRatio: 37.57 / 35.8 }),
  b737: Object.freeze({ url: `${AMVLAB_BASE}B737_nologo.glb`, lengthToSpanRatio: 39.5 / 35.8 }),
  a380: Object.freeze({ url: `${AMVLAB_BASE}A380_nologo.glb`, lengthToSpanRatio: 72.72 / 79.75 }),
  b787: Object.freeze({ url: `${AMVLAB_BASE}B787_nologo.glb`, lengthToSpanRatio: 62.81 / 60.12 })
});

const PARKED_AIRCRAFT = Object.freeze([
  Object.freeze({
    name: 'Airport A320',
    model: 'a320',
    targetLength: 37,
    // The source model's lowest geometry is not its intended wheel contact plane.
    // Give it explicit apron clearance so the fuselage/engines do not sink into the ground.
    position: [-145, 2.4, -22],
    rotation: 0.1,
    clearance: 30
  }),
  Object.freeze({
    name: 'Airport B737',
    model: 'b737',
    targetLength: 36,
    position: [78, 4.1, -8],
    rotation: -0.2,
    clearance: 30
  })
]);

const EXTRA_AIRCRAFT = Object.freeze([
  Object.freeze({
    name: 'Airport A380 Runway',
    model: 'a380',
    targetLength: 66,
    position: [35, 4.2, -228],
    rotation: Math.PI / 2,
    clearance: 44
  }),
  Object.freeze({
    name: 'Airport B787 Overflight',
    model: 'b787',
    targetLength: 22,
    // The minimap maps +X to the right and +Z downward. Put the static overflight deep in
    // the lower-right world quadrant, high and small enough to read like distant traffic.
    position: [620, 190, 560],
    rotation: -0.72,
    bank: -0.08,
    airborne: true
  })
]);

const loader = new GLTFLoader();
const modelCache = new Map();

export function installAirportWorld(options) {
  const world = installAirportWorldR52(options);
  const samples = options?.samples || [];

  void installParkedAircraft(world, samples).catch((error) => {
    // Keep r50's local jets as a robust fallback if both real replacements cannot load.
    console.info('TURN: real Airport gate aircraft unavailable; keeping local fallback jets.', error);
  });

  for (const slot of EXTRA_AIRCRAFT) {
    void installAircraft(world, samples, slot).catch((error) => {
      console.info(`TURN: ${slot.name} unavailable.`, error);
    });
  }

  world.name = 'TURN Airport r53';
  world.userData.turnAirportArtDirection = Object.freeze({
    ...(world.userData.turnAirportArtDirection || {}),
    version: 'r53',
    realAircraftModels: true,
    amvLabAircraftModels: true,
    runwayHeavy: true,
    highAltitudeOverflight: true,
    correctedAircraftGroundClearance: true,
    distantStaticOverflight: true
  });

  return world;
}

async function installParkedAircraft(world, samples) {
  const replacements = await Promise.all(
    PARKED_AIRCRAFT.map((slot) => buildAircraft(slot))
  );

  for (let index = 0; index < replacements.length; index += 1) {
    const aircraft = replacements[index];
    const slot = PARKED_AIRCRAFT[index];
    if (!canPlaceAircraft(samples, slot)) {
      throw new Error(`${slot.name} failed scenery clearance.`);
    }
    placeAircraft(world, aircraft, slot);
  }

  removeProceduralJets(world);
}

async function installAircraft(world, samples, slot) {
  if (!slot.airborne && !canPlaceAircraft(samples, slot)) {
    console.warn(`TURN: skipped ${slot.name}; scenery clearance is too small.`);
    return;
  }

  const aircraft = await buildAircraft(slot);
  placeAircraft(world, aircraft, slot);
}

async function buildAircraft(slot) {
  const definition = AIRCRAFT_MODELS[slot.model];
  if (!definition) throw new Error(`Unknown Airport aircraft model: ${slot.model}`);

  const source = await loadAircraftModel(slot.model, definition.url);
  const aircraft = prepareAircraftAsset(source, {
    targetLength: slot.targetLength,
    lengthToSpanRatio: definition.lengthToSpanRatio,
    outline: true,
    airborne: Boolean(slot.airborne)
  });
  aircraft.name = slot.name;
  return aircraft;
}

function loadAircraftModel(key, url) {
  if (!modelCache.has(key)) {
    modelCache.set(key, loader.loadAsync(url).then((gltf) => gltf.scene));
  }
  return modelCache.get(key);
}

function prepareAircraftAsset(source, {
  targetLength,
  lengthToSpanRatio,
  outline = true,
  airborne = false
}) {
  const model = source.clone(true);
  const meshes = [];

  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    meshes.push(node);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const clones = materials.map((entry) => {
      const clone = entry.clone();
      if ('roughness' in clone) clone.roughness = Math.max(clone.roughness ?? 0.72, 0.62);
      // The distant airborne aircraft intentionally sits beyond the scene's normal fog range.
      // Keep it visible as a tiny silhouette rather than letting linear fog erase it completely.
      if (airborne) clone.fog = false;
      return clone;
    });
    node.material = Array.isArray(node.material) ? clones : clones[0];
    node.castShadow = false;
    node.receiveShadow = !airborne;
  });

  alignAndScaleAircraft(model, targetLength, lengthToSpanRatio, airborne);

  if (outline) {
    for (const mesh of meshes) {
      const outlineNode = new THREE.Mesh(
        mesh.geometry,
        new THREE.MeshBasicMaterial({
          color: INK,
          side: THREE.BackSide,
          depthTest: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
          fog: !airborne
        })
      );
      outlineNode.scale.setScalar(airborne ? 1.012 : 1.018);
      outlineNode.castShadow = false;
      outlineNode.receiveShadow = false;
      mesh.add(outlineNode);
    }
  }

  return model;
}

function alignAndScaleAircraft(model, targetLength, lengthToSpanRatio, airborne) {
  model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model);
  let size = bounds.getSize(new THREE.Vector3());

  // Most aviation assets use the aircraft body axis as X or Z. Infer which horizontal
  // axis is the fuselage from the real aircraft length/span ratio, then align the nose-tail
  // axis with TURN's local Z convention used by the old procedural jets.
  const zAsLengthError = Math.abs((size.z / Math.max(size.x, 0.001)) - lengthToSpanRatio);
  const xAsLengthError = Math.abs((size.x / Math.max(size.z, 0.001)) - lengthToSpanRatio);
  if (xAsLengthError < zAsLengthError) {
    model.rotation.y += Math.PI / 2;
    model.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(model);
    size = bounds.getSize(new THREE.Vector3());
  }

  model.scale.multiplyScalar(targetLength / Math.max(size.z, 0.001));
  model.updateMatrixWorld(true);

  bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= airborne ? center.y : bounds.min.y;
}

function placeAircraft(world, aircraft, slot) {
  aircraft.position.set(...slot.position);
  aircraft.rotation.y += slot.rotation || 0;
  aircraft.rotation.z += slot.bank || 0;
  world.add(aircraft);
}

function removeProceduralJets(world) {
  const oldJets = [];
  world.traverse((node) => {
    if (node.name === 'Parked Airport Jet') oldJets.push(node);
  });
  for (const jet of oldJets) jet.parent?.remove(jet);
}

function canPlaceAircraft(samples, slot) {
  if (!samples.length) return true;
  const [x, , z] = slot.position;
  return minimumTrackDistance(samples, x, z) >= (slot.clearance || 28);
}

function minimumTrackDistance(samples, x, z) {
  let bestDistanceSq = Infinity;
  for (const sample of samples) {
    const dx = x - sample.point.x;
    const dz = z - sample.point.z;
    bestDistanceSq = Math.min(bestDistanceSq, dx * dx + dz * dz);
  }
  return Math.sqrt(bestDistanceSq);
}
