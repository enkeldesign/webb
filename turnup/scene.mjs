import * as maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const INK = 0x08090a;
const PAPER = 0xfff8e8;
const CYAN = 0x38d9ff;
const PINK = 0xff4fa3;
const YELLOW = 0xffd43b;
const AMVLAB_COMMIT = '91d835e8e851b2317fe79af291c9fed6153fd525';
const AIRCRAFT_URL = `https://raw.githubusercontent.com/amvlab/aircraft-models/${AMVLAB_COMMIT}/models/B737_nologo.glb`;
const B737_LENGTH_TO_SPAN = 39.5 / 35.8;

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const TERRAIN_TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const AIRPORT_ORIGIN = Object.freeze({
  lng: 17.443,
  lat: 62.5285,
  elevation: 5
});

const originMercator = maplibregl.MercatorCoordinate.fromLngLat(AIRPORT_ORIGIN, 0);
const metresToMercator = originMercator.meterInMercatorCoordinateUnits();

const COURSE_GEO = Object.freeze([
  Object.freeze({ lng: 17.4498, lat: 62.5198, altitude: 92, label: 'RUNWAY 16' }),
  Object.freeze({ lng: 17.483, lat: 62.509, altitude: 145, label: 'SÖRÅKER APPROACH' }),
  Object.freeze({ lng: 17.526, lat: 62.506, altitude: 205, label: 'SÖRÅKER' }),
  Object.freeze({ lng: 17.592, lat: 62.522, altitude: 265, label: 'STRIND AREA' }),
  Object.freeze({ lng: 17.66, lat: 62.542, altitude: 325, label: 'EASTERN TURN' }),
  Object.freeze({ lng: 17.61, lat: 62.576, altitude: 275, label: 'COASTAL RETURN' }),
  Object.freeze({ lng: 17.52, lat: 62.57, altitude: 190, label: 'INDALSÄLVEN' }),
  Object.freeze({ lng: 17.447, lat: 62.541, altitude: 112, label: 'MIDLANDA RETURN' })
]);

export const COURSE_POINTS = Object.freeze(COURSE_GEO.map((waypoint) => Object.freeze({
  ...geographicToLocal(waypoint),
  label: waypoint.label,
  lng: waypoint.lng,
  lat: waypoint.lat
})));

const startLocation = geographicToLocal({ lng: 17.4362, lat: 62.5362, altitude: 78 });
const firstGate = COURSE_POINTS[0];
const START_HEADING = Math.atan2(
  firstGate.x - startLocation.x,
  startLocation.z - firstGate.z
);

export const MAP_START_POSE = Object.freeze({
  ...startLocation,
  heading: START_HEADING,
  pitch: degreesToRadians(2.5),
  bank: 0,
  speed: 91,
  throttle: 0.7
});

export async function createFlightScene(container, {
  reducedMotion = false,
  onModelStatus = () => {}
} = {}) {
  if (!container) throw new Error('TURN UP needs a map container.');
  if (!supportsWebGl2()) {
    throw new Error('TURN UP needs WebGL2 for its 3D terrain and aircraft.');
  }

  const map = new maplibregl.Map({
    container,
    style: MAP_STYLE_URL,
    center: [AIRPORT_ORIGIN.lng, AIRPORT_ORIGIN.lat],
    zoom: 14.3,
    pitch: 72,
    bearing: radiansToDegrees(MAP_START_POSE.heading),
    maxPitch: 85,
    minZoom: 10.5,
    maxZoom: 17.5,
    maxBounds: [[17.22, 62.39], [17.84, 62.67]],
    interactive: false,
    renderWorldCopies: false,
    attributionControl: false,
    fadeDuration: reducedMotion ? 0 : 180,
    canvasContextAttributes: { antialias: true }
  });

  map.addControl(new maplibregl.AttributionControl({
    compact: true,
    customAttribution: 'TURN UP · AMV Lab aircraft'
  }), 'bottom-left');

  map.on('error', (event) => {
    const message = String(event?.error?.message || '');
    if (/terrain|elevation|raster-dem/i.test(message)) {
      console.info('TURN UP: terrain tile unavailable; continuing with the vector map.', event.error);
      return;
    }
    console.info('TURN UP map resource warning.', event.error || event);
  });

  const threeScene = new THREE.Scene();
  const threeCamera = new THREE.Camera();
  addLighting(threeScene);
  const aircraftRig = createAircraftRig();
  threeScene.add(aircraftRig.root);
  const gateObjects = buildCourse(threeScene);
  let terrainAtOrigin = AIRPORT_ORIGIN.elevation;
  let renderer = null;
  let aircraftSource = 'TURN UP local fallback aircraft';
  let activeGateIndex = 0;

  onModelStatus('Loading the B737 and the Midlanda map…');
  const aircraftPromise = loadAircraft().then((model) => {
    aircraftRig.modelContainer.clear();
    aircraftRig.modelContainer.add(model);
    aircraftSource = 'AMV Lab B737_nologo.glb, CC BY 4.0';
    onModelStatus('Midlanda map and B737 ready.');
  }).catch((error) => {
    console.info('TURN UP: B737 unavailable; using the lightweight fallback aircraft.', error);
    onModelStatus('Map ready. The lightweight backup aircraft is in use.');
  });

  await new Promise((resolve) => map.once('load', resolve));
  installTerrain(map, reducedMotion);
  installThreeDimensionalBuildings(map);
  installRouteLine(map);
  setSkyAndFog(map, reducedMotion);

  const customLayer = {
    id: 'turn-up-flight-objects',
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true
      });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    },
    render(_gl, args) {
      terrainAtOrigin = map.queryTerrainElevation([
        AIRPORT_ORIGIN.lng,
        AIRPORT_ORIGIN.lat
      ]) ?? terrainAtOrigin;
      const mapOrigin = maplibregl.MercatorCoordinate.fromLngLat(
        AIRPORT_ORIGIN,
        terrainAtOrigin
      );
      const projection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const localTransform = new THREE.Matrix4()
        .makeTranslation(mapOrigin.x, mapOrigin.y, mapOrigin.z)
        .scale(new THREE.Vector3(metresToMercator, -metresToMercator, metresToMercator));
      threeCamera.projectionMatrix = projection.multiply(localTransform);
      renderer.resetState();
      renderer.render(threeScene, threeCamera);
    }
  };

  map.addLayer(customLayer);
  await aircraftPromise;
  setGateState(gateObjects, activeGateIndex);

  function resize() {
    map.resize();
  }

  function render(flightState, elapsedSeconds = 0) {
    const mapPosition = flightToMapPosition(flightState.position);
    aircraftRig.root.position.copy(mapPosition);
    aircraftRig.root.rotation.z = -flightState.heading;
    aircraftRig.pitch.rotation.x = flightState.pitch;
    aircraftRig.bank.rotation.y = -flightState.bank;

    if (!reducedMotion) {
      const activeGate = gateObjects[activeGateIndex];
      if (activeGate) {
        const pulse = 1 + Math.sin(elapsedSeconds * 4.2) * 0.035;
        activeGate.scale.setScalar(pulse);
        activeGate.userData.marker.rotation.z += 0.008;
      }
    }

    const ahead = localToLngLat(
      flightState.position.x + Math.sin(flightState.heading) * 310,
      flightState.position.z - Math.cos(flightState.heading) * 310
    );
    const altitudeZoom = clamp((flightState.position.y - 80) / 720, 0, 1);
    map.jumpTo({
      center: ahead,
      bearing: radiansToDegrees(flightState.heading),
      pitch: reducedMotion ? 68 : 73,
      roll: reducedMotion ? 0 : radiansToDegrees(flightState.bank) * 0.12,
      zoom: 15.45 - altitudeZoom * 1.55
    });
    map.triggerRepaint();
  }

  function setActiveGate(index) {
    activeGateIndex = Math.max(0, Math.min(index, gateObjects.length));
    setGateState(gateObjects, activeGateIndex);
  }

  function getGate(index) {
    return COURSE_POINTS[index] || null;
  }

  function getRespawnPose(index) {
    const previous = index > 0 ? COURSE_POINTS[index - 1] : MAP_START_POSE;
    const target = COURSE_POINTS[index] || COURSE_POINTS[0];
    const dx = target.x - previous.x;
    const dz = target.z - previous.z;
    const horizontalDistance = Math.max(1, Math.hypot(dx, dz));
    return {
      x: previous.x - dx / horizontalDistance * 90,
      y: Math.max(65, previous.y + 14),
      z: previous.z - dz / horizontalDistance * 90,
      heading: Math.atan2(dx, -dz),
      pitch: Math.atan2(target.y - previous.y, horizontalDistance)
    };
  }

  function groundElevationAt(position) {
    const location = localToLngLat(position.x, position.z);
    const elevation = map.queryTerrainElevation(location);
    if (!Number.isFinite(elevation)) return 0;
    return elevation - terrainAtOrigin;
  }

  function dispose() {
    renderer?.dispose();
    threeScene.traverse((node) => {
      node.geometry?.dispose?.();
      if (Array.isArray(node.material)) node.material.forEach((entry) => entry.dispose?.());
      else node.material?.dispose?.();
    });
    map.remove();
  }

  return Object.freeze({
    map,
    startPose: MAP_START_POSE,
    gates: COURSE_POINTS,
    gateRadius: 88,
    get aircraftSource() {
      return aircraftSource;
    },
    resize,
    render,
    setActiveGate,
    getGate,
    getRespawnPose,
    groundElevationAt,
    dispose
  });
}

function installTerrain(map, reducedMotion) {
  if (!map.getSource('turn-up-terrain')) {
    map.addSource('turn-up-terrain', {
      type: 'raster-dem',
      tiles: [TERRAIN_TILE_URL],
      tileSize: 256,
      maxzoom: 15,
      encoding: 'terrarium',
      attribution: 'Terrain © Mapzen/AWS Open Data'
    });
  }

  const firstLabelId = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id;
  if (!map.getLayer('turn-up-hillshade')) {
    map.addLayer({
      id: 'turn-up-hillshade',
      type: 'hillshade',
      source: 'turn-up-terrain',
      paint: {
        'hillshade-shadow-color': '#143642',
        'hillshade-highlight-color': '#fff0a8',
        'hillshade-accent-color': '#2389b8',
        'hillshade-exaggeration': reducedMotion ? 0.24 : 0.36
      }
    }, firstLabelId);
  }
  map.setTerrain({ source: 'turn-up-terrain', exaggeration: 1.18 });
}

function installThreeDimensionalBuildings(map) {
  const styleLayers = map.getStyle().layers || [];
  const sourceLayer = styleLayers.find((layer) => layer['source-layer'] === 'building');
  if (!sourceLayer || map.getLayer('turn-up-buildings')) return;

  const firstLabelId = styleLayers.find((layer) => layer.type === 'symbol')?.id;
  map.addLayer({
    id: 'turn-up-buildings',
    source: sourceLayer.source,
    'source-layer': 'building',
    type: 'fill-extrusion',
    minzoom: 13,
    paint: {
      'fill-extrusion-color': [
        'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], ['get', 'height'], 6],
        0, '#fff8e8',
        30, '#ffe087',
        90, '#ff8caf'
      ],
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 6],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
      'fill-extrusion-opacity': 0.84
    }
  }, firstLabelId);
}

function installRouteLine(map) {
  const coordinates = [
    [17.4362, 62.5362],
    ...COURSE_GEO.map((point) => [point.lng, point.lat])
  ];
  map.addSource('turn-up-route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates }
    }
  });

  const firstLabelId = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id;
  map.addLayer({
    id: 'turn-up-route-outline',
    type: 'line',
    source: 'turn-up-route',
    paint: {
      'line-color': '#08090a',
      'line-width': 7,
      'line-opacity': 0.5
    }
  }, firstLabelId);
  map.addLayer({
    id: 'turn-up-route-line',
    type: 'line',
    source: 'turn-up-route',
    paint: {
      'line-color': '#ffd43b',
      'line-width': 3,
      'line-dasharray': [2, 2],
      'line-opacity': 0.85
    }
  }, firstLabelId);
}

function setSkyAndFog(map, reducedMotion) {
  try {
    map.setSky?.({
      'sky-color': '#68c8f2',
      'horizon-color': '#fff8e8',
      'fog-color': '#bdeeff',
      'sky-horizon-blend': reducedMotion ? 0.25 : 0.42,
      'horizon-fog-blend': 0.72,
      'fog-ground-blend': 0.35
    });
  } catch (error) {
    console.info('TURN UP: this MapLibre build does not expose sky styling.', error);
  }
}

function createAircraftRig() {
  const root = new THREE.Group();
  const pitch = new THREE.Group();
  const bank = new THREE.Group();
  const modelContainer = new THREE.Group();
  root.add(pitch);
  pitch.add(bank);
  bank.add(modelContainer);
  // Aircraft assets use Three.js' Y-up / -Z-forward convention. The geospatial
  // custom layer is X-east / Y-north / Z-up, so rotate the visual once at its root.
  modelContainer.rotation.x = Math.PI / 2;
  modelContainer.add(createFallbackAircraft());
  return { root, pitch, bank, modelContainer };
}

async function loadAircraft() {
  const gltf = await new GLTFLoader().loadAsync(AIRCRAFT_URL);
  return prepareAircraftAsset(gltf.scene, {
    targetLength: 34,
    lengthToSpanRatio: B737_LENGTH_TO_SPAN
  });
}

function addLighting(scene) {
  scene.add(new THREE.HemisphereLight(0xbdeeff, 0x3b6b49, 2.1));
  const sun = new THREE.DirectionalLight(PAPER, 3.2);
  sun.position.set(-500, 300, 900);
  scene.add(sun);
}

function buildCourse(scene) {
  const gates = [];
  let previous = MAP_START_POSE;
  for (let index = 0; index < COURSE_POINTS.length; index += 1) {
    const point = COURSE_POINTS[index];
    const gate = createGate(index);
    gate.position.copy(flightToMapPosition(point));
    const direction = new THREE.Vector3(
      point.x - previous.x,
      previous.z - point.z,
      point.y - previous.y
    ).normalize();
    gate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    scene.add(gate);
    gates.push(gate);
    previous = point;
  }
  return gates;
}

function createGate(index) {
  const group = new THREE.Group();
  group.name = `Flight gate ${index + 1}`;
  const outline = new THREE.Mesh(
    new THREE.TorusGeometry(88, 11, 8, 48),
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide })
  );
  const color = new THREE.Mesh(
    new THREE.TorusGeometry(88, 6.8, 8, 48),
    new THREE.MeshBasicMaterial({
      color: YELLOW,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    })
  );
  group.add(outline, color);

  const marker = new THREE.Group();
  for (let side = 0; side < 4; side += 1) {
    const tab = new THREE.Mesh(
      new THREE.BoxGeometry(25, 10, 3),
      new THREE.MeshBasicMaterial({ color: side % 2 ? PINK : CYAN })
    );
    tab.position.y = 110;
    tab.rotation.z = side * Math.PI / 2;
    marker.add(tab);
  }
  group.add(marker);
  group.userData = { color, marker };
  return group;
}

function setGateState(gates, activeIndex) {
  for (let index = 0; index < gates.length; index += 1) {
    const gate = gates[index];
    const active = index === activeIndex;
    gate.visible = index >= activeIndex;
    gate.scale.setScalar(1);
    gate.userData.color.material.color.setHex(active ? PINK : YELLOW);
    gate.userData.color.material.opacity = active ? 1 : 0.38;
    gate.userData.marker.visible = active;
  }
}

function prepareAircraftAsset(source, { targetLength, lengthToSpanRatio }) {
  const model = source.clone(true);
  const meshes = [];
  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    meshes.push(node);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const clones = materials.map((entry) => {
      const clone = entry.clone();
      if ('roughness' in clone) clone.roughness = Math.max(clone.roughness ?? 0.72, 0.62);
      return clone;
    });
    node.material = Array.isArray(node.material) ? clones : clones[0];
  });

  alignAndScaleAircraft(model, targetLength, lengthToSpanRatio);
  for (const mesh of meshes) {
    const outline = new THREE.Mesh(
      mesh.geometry,
      new THREE.MeshBasicMaterial({
        color: INK,
        side: THREE.BackSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      })
    );
    outline.scale.setScalar(1.012);
    mesh.add(outline);
  }
  return model;
}

function alignAndScaleAircraft(model, targetLength, lengthToSpanRatio) {
  model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model);
  let size = bounds.getSize(new THREE.Vector3());
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
  model.position.sub(center);
}

function createFallbackAircraft() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.7 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: PINK, roughness: 0.76 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3, 21, 10), bodyMaterial);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.42, 6.4, 10), accentMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -13.7;
  group.add(nose);
  const wings = new THREE.Mesh(new THREE.BoxGeometry(27, 0.8, 5.4), bodyMaterial);
  wings.position.z = 1.5;
  group.add(wings);
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.62, 2.8), accentMaterial);
  tailWing.position.z = 9;
  group.add(tailWing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.4, 4.5), accentMaterial);
  tail.position.set(0, 3, 8.8);
  group.add(tail);
  return group;
}

function geographicToLocal({ lng, lat, altitude = 0 }) {
  const coordinate = maplibregl.MercatorCoordinate.fromLngLat({ lng, lat }, 0);
  return {
    x: (coordinate.x - originMercator.x) / metresToMercator,
    y: altitude,
    z: (coordinate.y - originMercator.y) / metresToMercator
  };
}

function localToLngLat(x, z) {
  return new maplibregl.MercatorCoordinate(
    originMercator.x + x * metresToMercator,
    originMercator.y + z * metresToMercator,
    0
  ).toLngLat();
}

function flightToMapPosition(position) {
  return new THREE.Vector3(position.x, -position.z, position.y);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function radiansToDegrees(value) {
  return value * 180 / Math.PI;
}

function supportsWebGl2() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2');
  if (!context) return false;
  context.getExtension('WEBGL_lose_context')?.loseContext();
  return true;
}
