import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FACTORY = './assets/factory/';
const CITY = './assets/city/';
const VEHICLES = './assets/vehicles/';

const ASSETS = Object.freeze({
  arrow: `${FACTORY}arrow-basic-rounded.glb`,
  boxLarge: `${FACTORY}box-large.glb`,
  boxLong: `${FACTORY}box-long.glb`,
  boxSmall: `${FACTORY}box-small.glb`,
  boxWide: `${FACTORY}box-wide.glb`,
  conveyor: `${FACTORY}conveyor-long-stripe-sides.glb`,
  conveyorCorner: `${FACTORY}conveyor-stripe-corner.glb`,
  conveyorJunction: `${FACTORY}conveyor-stripe-sides-junction-t.glb`,
  conveyorShort: `${FACTORY}conveyor-stripe-sides.glb`,
  hopper: `${FACTORY}hopper-square.glb`,
  indicatorArrow: `${FACTORY}indicator-special-arrow.glb`,
  indicatorCross: `${FACTORY}indicator-special-cross.glb`,
  machine: `${FACTORY}machine-window.glb`,
  operator: `${FACTORY}oopi.glb`,
  robotArm: `${FACTORY}robot-arm-a.glb`,
  scanner: `${FACTORY}scanner-high.glb`,
  screen: `${FACTORY}screen-panel-wide.glb`,
  wall: `${FACTORY}structure-wall.glb`,
  wallCorner: `${FACTORY}structure-corner-outer.glb`,
  wallDoor: `${FACTORY}structure-doorway-wide.glb`,
  wallMedium: `${FACTORY}structure-medium.glb`,
  wallWindow: `${FACTORY}structure-window-wide.glb`,
  warning: `${FACTORY}warning-orange.glb`,
  warningTraffic: `${FACTORY}warning-traffic.glb`,
  garage: `${CITY}building-garage.glb`,
  buildingA: `${CITY}building-small-a.glb`,
  buildingB: `${CITY}building-small-b.glb`,
  buildingC: `${CITY}building-small-c.glb`,
  buildingD: `${CITY}building-small-d.glb`,
  trees: `${CITY}grass-trees.glb`,
  tallTrees: `${CITY}grass-trees-tall.glb`,
  roadCorner: `${CITY}road-corner.glb`,
  roadIntersection: `${CITY}road-intersection.glb`,
  roadSplit: `${CITY}road-split.glb`,
  roadStraight: `${CITY}road-straight.glb`,
  roadLights: `${CITY}road-straight-lightposts.glb`,
  truck: `${VEHICLES}post-truck.glb`
});

const CAMERA_PRESETS = Object.freeze({
  terminal: {
    position: new THREE.Vector3(11.5, 12.5, 15.5),
    target: new THREE.Vector3(0, 0.35, 0.25),
    fov: 42
  },
  network: {
    position: new THREE.Vector3(10.5, 15.5, 13.5),
    target: new THREE.Vector3(0, 0, 0),
    fov: 39
  },
  case: {
    position: new THREE.Vector3(7.5, 7.4, 10.5),
    target: new THREE.Vector3(0, 1.15, 0),
    fov: 38
  }
});

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
const inkMaterial = new THREE.MeshBasicMaterial({ color: 0x10131a, side: THREE.BackSide });

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.84,
    metalness: options.metalness ?? 0,
    transparent: options.opacity != null && options.opacity < 1,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function addEdges(mesh, color = 0x10131a, opacity = 0.58) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 30),
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })
  );
  mesh.add(edges);
  return mesh;
}

function addPrimitiveBox(parent, size, position, color, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addEdges(mesh);
  parent.add(mesh);
  return mesh;
}

function curve(points) {
  return new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
    0.35
  );
}

function seeded(index) {
  const value = Math.sin(index * 93.737 + 17.11) * 45821.337;
  return value - Math.floor(value);
}

export class PostalWorld {
  constructor(canvas, hotspotLayer, callbacks = {}) {
    this.canvas = canvas;
    this.hotspotLayer = hotspotLayer;
    this.callbacks = callbacks;
    this.loader = new GLTFLoader();
    this.assetCache = new Map();
    this.mode = 'terminal';
    this.elapsed = 0;
    this.runningVisualTime = 0;
    this.cameraBlend = 1;
    this.state = {
      shiftId: 'first-rounds',
      started: false,
      paused: true,
      stage: 'brief',
      staffMoved: false,
      signatureFound: false,
      ruleFixed: false,
      verified: 0,
      completed: false,
      speed: 1,
      activeHotspots: [],
      hotspotLabels: {},
      hotspotTones: {},
      hotspotIcons: {}
    };
    this.interactiveRoots = [];
    this.hotspots = new Map();
    this.hotspotStateKey = '';
    this.packages = [];
    this.operators = [];
    this.networkTrucks = [];
    this.caseBoxes = [];
    this.matchRevealStartedAt = null;
    this.lastFrameTime = performance.now();
    this.cameraDesiredPosition = CAMERA_PRESETS.terminal.position.clone();
    this.cameraDesiredTarget = CAMERA_PRESETS.terminal.target.clone();
    this.cameraLookTarget = CAMERA_PRESETS.terminal.target.clone();

    try {
      this.setupRenderer();
      this.setupScene();
      this.setupInteraction();
      this.loadAndBuild();
      this.animate();
    } catch (error) {
      callbacks.onError?.(error);
    }
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x34325e, 0.016);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    this.camera.position.copy(CAMERA_PRESETS.terminal.position);
    this.camera.lookAt(CAMERA_PRESETS.terminal.target);

    const hemisphere = new THREE.HemisphereLight(0xcbd5ff, 0x27233c, 2.25);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffe8bd, 3.4);
    sun.position.set(-9, 16, 11);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);

    const fill = new THREE.PointLight(0x67dfff, 24, 30, 2);
    fill.position.set(-6, 6, 8);
    this.scene.add(fill);

    this.terminalGroup = new THREE.Group();
    this.terminalGroup.name = 'Sundsvall terminal';
    this.networkGroup = new THREE.Group();
    this.networkGroup.name = 'Regional network';
    this.caseGroup = new THREE.Group();
    this.caseGroup.name = 'Parcel case';
    this.scene.add(this.terminalGroup, this.networkGroup, this.caseGroup);
    this.networkGroup.visible = false;
    this.caseGroup.visible = false;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement);
    this.resize();
  }

  setupInteraction() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.canvas.addEventListener('pointerup', (event) => {
      if (!this.state.started || this.state.completed) return;
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.interactiveRoots, true);
      for (const hit of hits) {
        let object = hit.object;
        while (object) {
          if (object.userData.hotspot) {
            const hotspot = this.hotspots.get(object.userData.hotspot);
            if (hotspot && !hotspot.button.hidden) {
              this.callbacks.onHotspot?.(object.userData.hotspot);
              return;
            }
          }
          object = object.parent;
        }
      }
    });
  }

  async loadAndBuild() {
    const entries = Object.entries(ASSETS);
    await Promise.all(entries.map(async ([key, url]) => {
      try {
        const gltf = await this.loader.loadAsync(url);
        this.assetCache.set(key, gltf.scene);
      } catch (error) {
        console.warn(`POSTAL asset could not load: ${key}`, error);
      }
    }));

    this.buildTerminal();
    this.buildNetwork();
    this.buildCase();
    this.setMode('terminal', true);
    this.callbacks.onReady?.();
  }

  makeAsset(key, options = {}) {
    const source = this.assetCache.get(key);
    if (!source) {
      const fallback = new THREE.Group();
      addPrimitiveBox(fallback, [0.8, 0.8, 0.8], [0, 0.4, 0], options.fallbackColor ?? 0xffd43b);
      return fallback;
    }

    const model = source.clone(true);
    model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = options.castShadow !== false;
      node.receiveShadow = options.receiveShadow !== false;
      if (options.tint != null && node.material) {
        const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
        const clones = sourceMaterials.map((sourceMaterial) => {
          const clone = sourceMaterial.clone();
          clone.color.multiply(new THREE.Color(options.tint));
          return clone;
        });
        node.material = Array.isArray(node.material) ? clones : clones[0];
      }
    });

    model.updateMatrixWorld(true);
    let bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const reference = options.targetHeight != null
      ? Math.max(size.y, 0.001)
      : Math.max(size.x, size.y, size.z, 0.001);
    const desired = options.targetHeight ?? options.targetSize ?? reference;
    model.scale.multiplyScalar(desired / reference);
    model.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -bounds.min.y, -center.z);

    const wrapper = new THREE.Group();
    wrapper.add(model);
    if (options.outline) {
      const outlineSource = model.clone(true);
      outlineSource.traverse((node) => {
        if (!node.isMesh) return;
        node.material = inkMaterial;
        node.castShadow = false;
        node.receiveShadow = false;
      });
      outlineSource.scale.multiplyScalar(1.022);
      wrapper.add(outlineSource);
    }
    return wrapper;
  }

  placeAsset(parent, key, position, options = {}) {
    const asset = this.makeAsset(key, options);
    asset.position.set(...position);
    asset.rotation.y = options.rotationY ?? 0;
    if (options.scale) asset.scale.multiplyScalar(options.scale);
    parent.add(asset);
    return asset;
  }

  buildTerminal() {
    const group = this.terminalGroup;
    const floor = addPrimitiveBox(group, [14.5, 0.45, 10.5], [0, -0.28, 0.1], 0x4b4878);
    floor.material.roughness = 0.96;

    for (let x = -6; x <= 6; x += 2) {
      for (let z = -4; z <= 4; z += 2) {
        const tile = new THREE.Mesh(
          new THREE.PlaneGeometry(1.84, 1.84),
          material((x + z) % 4 === 0 ? 0x5c578d : 0x555183, { roughness: 1 })
        );
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(x, -0.045, z);
        tile.receiveShadow = true;
        group.add(tile);
      }
    }

    this.addLaneMarker(group, -1.4, 0x38c7f3, 'express');
    this.addLaneMarker(group, 2.35, 0xffd43b, 'standard');

    for (let x = -5.7; x <= 3.8; x += 1.92) {
      this.placeAsset(group, x === -5.7 ? 'wallCorner' : (Math.round(x) % 4 === 0 ? 'wallWindow' : 'wall'), [x, 0, -4.78], {
        targetSize: 1.88,
        rotationY: 0,
        castShadow: false
      });
    }
    this.placeAsset(group, 'wallDoor', [5.55, 0, -4.78], { targetSize: 1.9 });
    this.placeAsset(group, 'screen', [-2.7, 1.38, -4.45], { targetSize: 1.15, rotationY: Math.PI });
    this.placeAsset(group, 'screen', [0.1, 1.38, -4.45], { targetSize: 1.15, rotationY: Math.PI });

    this.placeAsset(group, 'conveyor', [-4.35, 0, 0.75], { targetSize: 2.15 });
    this.placeAsset(group, 'conveyor', [-2.25, 0, 0.75], { targetSize: 2.15 });
    this.placeAsset(group, 'conveyorJunction', [-0.22, 0, 0.75], { targetSize: 1.18, rotationY: Math.PI / 2 });
    this.placeAsset(group, 'conveyorCorner', [0.1, 0, -0.45], { targetSize: 1.15, rotationY: Math.PI / 2 });
    this.placeAsset(group, 'conveyorCorner', [0.1, 0, 1.65], { targetSize: 1.15, rotationY: -Math.PI / 2 });
    for (const x of [1.25, 3.35]) {
      this.placeAsset(group, 'conveyor', [x, 0, -1.4], { targetSize: 2.15 });
      this.placeAsset(group, 'conveyor', [x, 0, 2.35], { targetSize: 2.15 });
    }

    this.placeAsset(group, 'hopper', [-5.75, 0, 0.75], { targetHeight: 1.35, rotationY: Math.PI / 2 });
    this.scanner = this.placeAsset(group, 'scanner', [-2.85, 0.15, 0.75], { targetHeight: 1.42, rotationY: Math.PI / 2 });
    this.placeAsset(group, 'robotArm', [1.55, 0.36, -2.0], { targetHeight: 1.75, rotationY: -Math.PI / 2 });
    this.placeAsset(group, 'machine', [3.45, 0, 3.25], { targetHeight: 1.35, rotationY: -Math.PI / 2 });
    this.placeAsset(group, 'warningTraffic', [4.65, 0, 3.15], { targetHeight: 0.75 });

    const dock = addPrimitiveBox(group, [3.3, 0.25, 3.25], [5.25, 0.0, -2.5], 0x77769a);
    dock.material.roughness = 1;
    this.placeAsset(group, 'garage', [5.9, 0.08, -3.78], { targetHeight: 2.15, rotationY: Math.PI / 2 });
    this.truck = this.placeAsset(group, 'truck', [5.22, 0.16, -1.72], { targetSize: 2.55, rotationY: Math.PI / 2 });
    this.addPostalFlag(this.truck);

    const warningRoot = new THREE.Group();
    warningRoot.position.set(3.75, 1.04, -1.4);
    const warningRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.075, 8, 28),
      material(0xff665e, { emissive: 0xff665e, emissiveIntensity: 1.5 })
    );
    warningRing.rotation.x = Math.PI / 2;
    warningRoot.add(warningRing);
    group.add(warningRoot);
    this.warningRoot = warningRoot;

    const scannerWarningRoot = new THREE.Group();
    scannerWarningRoot.position.set(-2.85, 1.62, 0.75);
    const scannerWarningRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.075, 8, 28),
      material(0xff9a55, { emissive: 0xff665e, emissiveIntensity: 1.25 })
    );
    scannerWarningRing.rotation.x = Math.PI / 2;
    scannerWarningRoot.add(scannerWarningRing);
    scannerWarningRoot.visible = false;
    group.add(scannerWarningRoot);
    this.scannerWarningRoot = scannerWarningRoot;

    this.createOperators(group);
    this.createPackages(group);

    const expressHit = new THREE.Mesh(
      new THREE.BoxGeometry(5.3, 0.8, 1.25),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    expressHit.position.set(2.25, 0.45, -1.4);
    group.add(expressHit);
    this.markInteractive(expressHit, 'express-lane');

    const standardHit = expressHit.clone();
    standardHit.position.z = 2.35;
    group.add(standardHit);
    this.markInteractive(standardHit, 'standard-lane');
    this.markInteractive(this.truck, 'truck');
    this.markInteractive(this.scanner, 'scanner');

    this.registerHotspot('express-lane', 'Express A', '↗', 'blue', group, new THREE.Vector3(3.1, 1.45, -1.4));
    this.registerHotspot('standard-lane', 'Standard B', '→', 'yellow', group, new THREE.Vector3(3.1, 1.3, 2.35));
    this.registerHotspot('truck', '18:20 truck', '▰', 'yellow', group, new THREE.Vector3(5.3, 1.75, -1.75));
    this.registerHotspot('parcel', 'Trace parcel', '!', 'danger', group, new THREE.Vector3(2.75, 1.3, 2.35));
    this.registerHotspot('scanner', 'Scanner 2', '◆', 'orange', group, new THREE.Vector3(-2.85, 2.05, 0.75));
  }

  addLaneMarker(parent, z, color, name) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(9.9, 1.55),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.2, roughness: 1 })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0.45, -0.015, z);
    strip.name = `${name} floor marker`;
    parent.add(strip);

    for (let x = -4.2; x <= 4.6; x += 0.75) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.025, 0.08), material(color, {
        emissive: color,
        emissiveIntensity: 0.42
      }));
      dash.position.set(x, 0.015, z + 0.67);
      parent.add(dash);
    }
  }

  addPostalFlag(root) {
    const plate = addPrimitiveBox(root, [0.12, 0.85, 1.25], [0, 0.88, 0], 0xffd43b);
    plate.name = 'POSTAL truck panel';
    const blue = addPrimitiveBox(root, [0.13, 0.16, 1.26], [0, 0.88, 0], 0x38c7f3);
    blue.name = 'POSTAL truck stripe';
  }

  createOperators(parent) {
    const positions = [
      [-0.2, -2.35], [1.1, -2.55], [2.45, -2.5], [3.65, -2.25],
      [-0.35, 3.28], [0.75, 3.45], [1.9, 3.42], [3.0, 3.32], [4.05, 3.25], [4.75, 2.8]
    ];
    positions.forEach(([x, z], index) => {
      const operator = this.placeAsset(parent, 'operator', [x, 0.02, z], {
        targetHeight: 0.92,
        rotationY: index < 4 ? 0.15 : Math.PI - 0.15
      });
      operator.userData.home = new THREE.Vector3(x, 0.02, z);
      operator.userData.expressTarget = index >= 8
        ? new THREE.Vector3(2.8 + (index - 8) * 0.85, 0.02, -2.45)
        : operator.userData.home.clone();
      operator.userData.moveToExpress = index >= 8;
      this.operators.push(operator);
    });
  }

  createPackages(parent) {
    this.inputCurve = curve([[-6.2, 0.52, 0.75], [-4.4, 0.52, 0.75], [-2.1, 0.52, 0.75], [-0.45, 0.52, 0.75]]);
    this.expressCurve = curve([[-0.45, 0.52, 0.75], [0.1, 0.52, 0.15], [0.25, 0.52, -1.4], [2.2, 0.52, -1.4], [4.7, 0.52, -1.4]]);
    this.standardCurve = curve([[-0.45, 0.52, 0.75], [0.1, 0.52, 1.35], [0.25, 0.52, 2.35], [2.2, 0.52, 2.35], [4.7, 0.52, 2.35]]);
    const types = ['boxSmall', 'boxWide', 'boxLong', 'boxLarge'];

    for (let index = 0; index < 20; index += 1) {
      const root = new THREE.Group();
      const model = this.makeAsset(types[index % types.length], { targetSize: 0.43 });
      root.add(model);
      const service = index % 3 === 0 ? 'standard' : 'express';
      const misrouted = index === 2 || index === 8 || index === 14;
      const markerColor = service === 'express' ? 0x38c7f3 : 0xffd43b;
      const markerShape = service === 'express'
        ? new THREE.RingGeometry(0.21, 0.29, 18)
        : new THREE.RingGeometry(0.19, 0.3, 4);
      const marker = new THREE.Mesh(markerShape, new THREE.MeshBasicMaterial({
        color: markerColor,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      }));
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = -0.12;
      root.add(marker);
      root.userData = {
        offset: index / 20,
        service,
        misrouted,
        marker,
        speed: 0.018 + seeded(index) * 0.006
      };
      parent.add(root);
      this.packages.push(root);
      if (misrouted) this.markInteractive(root, 'parcel');
    }
  }

  buildNetwork() {
    const group = this.networkGroup;
    const ground = addPrimitiveBox(group, [14.2, 0.55, 10.8], [0, -0.36, 0], 0x89b97c);
    ground.material.roughness = 1;

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(4.3, 10.5),
      material(0x3ba7c4, { roughness: 0.55, metalness: 0.08 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(5.05, -0.06, 0);
    group.add(water);
    for (let i = 0; i < 8; i += 1) {
      const glint = addPrimitiveBox(group, [1.2 + seeded(i) * 0.8, 0.02, 0.045], [4.15 + seeded(i + 20) * 1.6, -0.01, -4.5 + i * 1.2], 0x8de0e8);
      glint.rotation.y = (seeded(i + 40) - 0.5) * 0.16;
    }

    const roadTiles = [
      ['roadStraight', 0, -3.4, 0], ['roadLights', 0, -1.35, 0],
      ['roadIntersection', 0, 0.72, 0], ['roadStraight', 0, 2.78, 0],
      ['roadStraight', 2.05, 0.72, Math.PI / 2], ['roadCorner', 4.08, 0.72, Math.PI / 2],
      ['roadStraight', -2.05, 0.72, Math.PI / 2], ['roadCorner', -4.08, 0.72, -Math.PI / 2]
    ];
    roadTiles.forEach(([key, x, z, rotationY]) => {
      this.placeAsset(group, key, [x, -0.05, z], { targetSize: 2.08, rotationY, castShadow: false });
    });

    const sundsvall = this.placeAsset(group, 'garage', [-0.85, 0.02, 2.9], { targetHeight: 1.4, rotationY: Math.PI });
    this.placeAsset(group, 'buildingA', [0.95, 0.02, 3.1], { targetHeight: 1.55, rotationY: Math.PI });
    const harnosand = this.placeAsset(group, 'buildingC', [-0.55, 0.02, -3.5], { targetHeight: 1.75 });
    const timra = this.placeAsset(group, 'buildingB', [3.85, 0.02, 1.8], { targetHeight: 1.3, rotationY: -Math.PI / 2 });
    const matfors = this.placeAsset(group, 'buildingD', [-4.05, 0.02, 1.65], { targetHeight: 1.25, rotationY: Math.PI / 2 });

    for (let i = 0; i < 18; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (2.25 + seeded(i) * 3.7);
      const z = -4.3 + seeded(i + 30) * 8.2;
      if (Math.abs(z - 0.7) < 1.1) continue;
      this.placeAsset(group, i % 3 === 0 ? 'tallTrees' : 'trees', [x, 0, z], {
        targetHeight: 0.9 + seeded(i + 50) * 0.7,
        rotationY: seeded(i + 70) * Math.PI * 2,
        castShadow: i % 2 === 0
      });
    }

    const routePoints = [
      new THREE.Vector3(0, 0.16, 3.1),
      new THREE.Vector3(0, 0.16, 0.8),
      new THREE.Vector3(0, 0.16, -1.35),
      new THREE.Vector3(0, 0.16, -3.25)
    ];
    const routeCurve = new THREE.CatmullRomCurve3(routePoints);
    this.networkPrimaryCurve = routeCurve;
    const route = new THREE.Mesh(
      new THREE.TubeGeometry(routeCurve, 40, 0.085, 8, false),
      material(0xff665e, { emissive: 0xff4c44, emissiveIntensity: 1.2 })
    );
    group.add(route);
    this.networkRiskRoute = route;

    const altRoutePoints = [
      new THREE.Vector3(0, 0.19, 3.1),
      new THREE.Vector3(-2.2, 0.19, 2.05),
      new THREE.Vector3(-4.0, 0.19, 1.65),
      new THREE.Vector3(-2.8, 0.19, -1.2),
      new THREE.Vector3(0, 0.19, -3.25)
    ];
    const altRouteCurve = new THREE.CatmullRomCurve3(altRoutePoints, false, 'centripetal', 0.35);
    const altRoute = new THREE.Mesh(
      new THREE.TubeGeometry(altRouteCurve, 58, 0.075, 8, false),
      material(0x38c7f3, { emissive: 0x1589bb, emissiveIntensity: 0.7, opacity: 0.92 })
    );
    altRoute.visible = false;
    group.add(altRoute);
    this.networkAltCurve = altRouteCurve;
    this.networkAltRoute = altRoute;

    for (let index = 0; index < 2; index += 1) {
      const truck = this.makeAsset('truck', { targetSize: 0.72 });
      truck.rotation.y = Math.PI;
      truck.userData.offset = index * 0.47;
      truck.userData.curve = routeCurve;
      group.add(truck);
      this.networkTrucks.push(truck);
    }

    const snowGeometry = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(90 * 3);
    for (let index = 0; index < 90; index += 1) {
      snowPositions[index * 3] = -7 + seeded(index + 130) * 14;
      snowPositions[index * 3 + 1] = 0.6 + seeded(index + 170) * 8;
      snowPositions[index * 3 + 2] = -5 + seeded(index + 210) * 10;
    }
    snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snow = new THREE.Points(
      snowGeometry,
      new THREE.PointsMaterial({ color: 0xfffdf5, size: 0.095, transparent: true, opacity: 0.82, depthWrite: false })
    );
    snow.visible = false;
    group.add(snow);
    this.networkSnow = snow;

    const riskRing = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 1.04, 28),
      new THREE.MeshBasicMaterial({ color: 0xff665e, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    riskRing.rotation.x = -Math.PI / 2;
    riskRing.position.set(0, 0.08, -3.35);
    group.add(riskRing);
    this.networkRiskRing = riskRing;

    this.markInteractive(sundsvall, 'network-sundsvall');
    this.markInteractive(harnosand, 'network-harnosand');
    this.markInteractive(timra, 'network-timra');
    this.markInteractive(matfors, 'network-matfors');

    this.registerHotspot('network-sundsvall', 'Sundsvall', '▦', 'blue', group, new THREE.Vector3(0, 2.0, 3.05));
    this.registerHotspot('network-harnosand', 'Härnösand', '!', 'danger', group, new THREE.Vector3(0, 2.25, -3.45));
    this.registerHotspot('network-timra', 'Timrå', '✓', 'good', group, new THREE.Vector3(4.0, 1.75, 1.75));
    this.registerHotspot('network-matfors', 'Matfors', '✓', 'good', group, new THREE.Vector3(-4.1, 1.7, 1.65));
  }

  buildCase() {
    const group = this.caseGroup;
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(4.7, 5.1, 0.6, 32),
      material(0x4b4878)
    );
    pedestal.position.y = -0.3;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    addEdges(pedestal);
    group.add(pedestal);

    const scanPad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.78, 0.32, 24),
      material(0x38c7f3, { emissive: 0x167da6, emissiveIntensity: 0.45 })
    );
    scanPad.position.set(-1.45, 0.05, 0.45);
    addEdges(scanPad);
    group.add(scanPad);

    this.casePackage = this.placeAsset(group, 'boxLarge', [-1.45, 0.26, 0.45], { targetSize: 1.75 });
    this.placeAsset(group, 'scanner', [-1.45, 0.05, -1.55], { targetHeight: 2.35 });
    this.placeAsset(group, 'screen', [2.55, 0.8, -1.45], { targetSize: 1.65, rotationY: -0.35 });

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.35, 2.9, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x71e6ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.set(-1.45, 1.65, 0.45);
    group.add(beam);
    this.scanBeam = beam;

    const boxTypes = ['boxSmall', 'boxWide', 'boxLong'];
    for (let index = 0; index < 12; index += 1) {
      const row = Math.floor(index / 4);
      const column = index % 4;
      const box = this.placeAsset(group, boxTypes[index % boxTypes.length], [0.35 + column * 0.78, 0.13, 0.4 + row * 0.82], {
        targetSize: 0.62,
        rotationY: (seeded(index + 90) - 0.5) * 0.28
      });
      box.userData.revealDelay = index * 0.04;
      box.scale.setScalar(0.001);
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.37, 18),
        new THREE.MeshBasicMaterial({ color: 0x38c7f3, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.03;
      box.add(halo);
      this.caseBoxes.push(box);
    }

    for (let index = 0; index < 3; index += 1) {
      this.placeAsset(group, 'arrow', [-0.1 + index * 0.75, 0.04, -2.9], {
        targetSize: 0.56,
        rotationY: Math.PI / 2
      });
    }

    this.registerHotspot('case-package', 'SE-0428-771', '□', 'blue', group, new THREE.Vector3(-1.45, 2.2, 0.45));
    this.registerHotspot('case-similar', '12 matches', '◆', 'danger', group, new THREE.Vector3(1.9, 2.0, 1.4));
    this.markInteractive(this.casePackage, 'case-package');
  }

  markInteractive(root, id) {
    root.userData.hotspot = id;
    root.traverse((node) => {
      if (node.isMesh) node.userData.hotspot = id;
    });
    this.interactiveRoots.push(root);
  }

  registerHotspot(id, label, icon, tone, group, position) {
    const anchor = new THREE.Object3D();
    anchor.position.copy(position);
    group.add(anchor);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'world-hotspot';
    button.dataset.hotspot = id;
    button.dataset.tone = tone;
    button.dataset.visible = 'false';
    button.setAttribute('aria-label', label);
    button.innerHTML = `<span class="world-hotspot-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
    button.addEventListener('click', () => this.callbacks.onHotspot?.(id));
    this.hotspotLayer.append(button);
    this.hotspots.set(id, { id, anchor, button, group, tone, label, icon });
    return anchor;
  }

  setMode(mode, immediate = false) {
    if (!CAMERA_PRESETS[mode]) return;
    if (!this.camera || !this.terminalGroup || !this.networkGroup || !this.caseGroup) return;
    this.mode = mode;
    this.terminalGroup.visible = mode === 'terminal';
    this.networkGroup.visible = mode === 'network';
    this.caseGroup.visible = mode === 'case';
    const preset = CAMERA_PRESETS[mode];
    this.cameraDesiredPosition.copy(preset.position);
    this.cameraDesiredTarget.copy(preset.target);
    this.camera.fov = preset.fov;
    this.camera.updateProjectionMatrix();
    this.cameraBlend = immediate || REDUCED_MOTION ? 1 : 0;
    if (this.cameraBlend === 1) {
      this.camera.position.copy(this.cameraDesiredPosition);
      this.cameraLookTarget.copy(this.cameraDesiredTarget);
      this.camera.lookAt(this.cameraLookTarget);
    }
    this.updateHotspotVisibility();
  }

  setState(state) {
    const previous = this.state;
    this.state = { ...this.state, ...state };
    if (!previous.signatureFound && this.state.signatureFound) {
      this.matchRevealStartedAt = this.elapsed;
    }
    const nextHotspotStateKey = JSON.stringify([
      this.state.started,
      this.state.completed,
      this.state.activeHotspots,
      this.state.hotspotLabels,
      this.state.hotspotTones,
      this.state.hotspotIcons
    ]);
    if (nextHotspotStateKey !== this.hotspotStateKey) {
      this.hotspotStateKey = nextHotspotStateKey;
      this.updateHotspotVisibility();
    }
  }

  updateHotspotVisibility() {
    const activeHotspots = new Set(this.state.activeHotspots || []);
    for (const [id, hotspot] of this.hotspots) {
      const visible = hotspot.group.visible
        && this.state.started
        && !this.state.completed
        && activeHotspots.has(id);
      hotspot.button.dataset.visible = String(visible);
      hotspot.button.tabIndex = visible ? 0 : -1;
      hotspot.button.hidden = !visible;
      hotspot.button.dataset.tone = this.state.hotspotTones?.[id] || hotspot.tone;
      hotspot.button.querySelector('.world-hotspot-icon').textContent = this.state.hotspotIcons?.[id] || hotspot.icon;
      hotspot.button.querySelector('span:last-child').textContent = this.state.hotspotLabels?.[id] || hotspot.label;
      hotspot.button.setAttribute('aria-label', this.state.hotspotLabels?.[id] || hotspot.label);
    }
  }

  resize() {
    if (!this.renderer) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  animate = () => {
    if (!this.renderer) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const frameTime = performance.now();
    const delta = Math.min((frameTime - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = frameTime;
    this.elapsed += delta;
    if (!this.state.paused) this.runningVisualTime += delta * (this.state.speed || 1);

    this.updateCamera(delta);
    this.updateTerminal(delta);
    this.updateNetwork(delta);
    this.updateCase(delta);
    this.updateHotspotPositions();
    this.renderer.render(this.scene, this.camera);
  };

  updateCamera(delta) {
    if (this.cameraBlend < 1) this.cameraBlend = Math.min(1, this.cameraBlend + delta * 2.8);
    const ease = REDUCED_MOTION ? 1 : 1 - Math.pow(1 - this.cameraBlend, 3);
    this.camera.position.lerp(this.cameraDesiredPosition, Math.min(1, 0.08 + ease * 0.14));
    this.cameraLookTarget.lerp(this.cameraDesiredTarget, Math.min(1, 0.08 + ease * 0.14));
    this.camera.lookAt(this.cameraLookTarget);
  }

  updateTerminal(delta) {
    if (!this.terminalGroup) return;
    const flowTime = this.runningVisualTime;
    this.packages.forEach((parcel, index) => {
      const data = parcel.userData;
      const cycle = (flowTime * data.speed + data.offset) % 1;
      const onInput = cycle < 0.34;
      let localT = onInput ? cycle / 0.34 : (cycle - 0.34) / 0.66;
      const intendedExpress = data.service === 'express';
      const usesWrongLane = this.state.shiftId === 'northbound' && data.misrouted && !this.state.ruleFixed;
      const scannerBlocked = this.state.shiftId === 'scanner-fever'
        && !this.state.scannerFixed
        && !this.state.scannerBypassed;
      if (scannerBlocked && onInput && localT > 0.58) {
        localT = 0.58 + (localT - 0.58) * 0.035;
      }
      const route = intendedExpress && !usesWrongLane ? this.expressCurve : this.standardCurve;
      let routeT = localT;
      if (usesWrongLane && !this.state.staffMoved && routeT > 0.72) routeT = 0.72 + (routeT - 0.72) * 0.08;
      const position = (onInput ? this.inputCurve : route).getPointAt(Math.min(routeT, 0.999));
      parcel.position.copy(position);
      const tangent = (onInput ? this.inputCurve : route).getTangentAt(Math.min(routeT, 0.999));
      parcel.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI / 2;
      const bob = REDUCED_MOTION ? 0 : Math.sin(this.elapsed * 5 + index) * 0.018;
      parcel.position.y += bob;
      data.marker.material.opacity = usesWrongLane ? 1 : 0.75;
      data.marker.scale.setScalar(usesWrongLane ? 1.2 : 1);
    });

    this.operators.forEach((operator, index) => {
      const target = this.state.staffMoved && operator.userData.moveToExpress
        ? operator.userData.expressTarget
        : operator.userData.home;
      operator.position.lerp(target, REDUCED_MOTION ? 1 : Math.min(1, delta * 2.4));
      if (!REDUCED_MOTION) operator.rotation.z = Math.sin(this.elapsed * 2.2 + index) * 0.025;
    });

    if (this.warningRoot) {
      const warningVisible = this.state.shiftId === 'northbound' && !this.state.ruleFixed;
      this.warningRoot.visible = warningVisible;
      if (!REDUCED_MOTION) {
        const pulse = 1 + Math.sin(this.elapsed * 5) * 0.12;
        this.warningRoot.scale.setScalar(pulse);
        this.warningRoot.rotation.y += delta * 0.9;
      }
    }

    if (this.scannerWarningRoot) {
      const scannerWarningVisible = this.state.shiftId === 'scanner-fever'
        && !this.state.scannerFixed
        && !this.state.scannerBypassed;
      this.scannerWarningRoot.visible = scannerWarningVisible;
      if (scannerWarningVisible && !REDUCED_MOTION) {
        const pulse = 1 + Math.sin(this.elapsed * 4.2) * 0.1;
        this.scannerWarningRoot.scale.setScalar(pulse);
        this.scannerWarningRoot.rotation.y += delta * 0.65;
      }
    }

    if (this.truck && this.state.completed) {
      this.truck.position.x += delta * 3.6;
      this.truck.position.z -= delta * 0.6;
    }
  }

  updateNetwork(delta) {
    if (!this.networkGroup) return;
    const snowShift = this.state.shiftId === 'snow-window';
    const useInland = snowShift && this.state.routeChoice === 'inland';
    this.networkTrucks.forEach((truck, index) => {
      const t = (this.runningVisualTime * 0.035 + truck.userData.offset) % 1;
      const activeCurve = useInland ? this.networkAltCurve : this.networkPrimaryCurve || truck.userData.curve;
      const position = activeCurve.getPointAt(t);
      const tangent = activeCurve.getTangentAt(t);
      truck.position.copy(position);
      truck.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI;
      if (!REDUCED_MOTION) truck.position.y += Math.sin(this.elapsed * 4 + index) * 0.015;
    });
    if (this.networkRiskRoute) {
      const safe = this.state.ruleFixed || (snowShift && this.state.routeChoice === 'coast' && this.state.stage === 'dispatch');
      this.networkRiskRoute.material.color.setHex(safe ? 0x79e29f : snowShift ? 0xff9a55 : 0xff665e);
      this.networkRiskRoute.material.emissive.setHex(safe ? 0x249a60 : 0xff4c44);
      this.networkRiskRoute.material.emissiveIntensity = safe ? 0.55 : 1.2;
    }
    if (this.networkAltRoute) {
      this.networkAltRoute.visible = snowShift
        && (this.state.stage === 'weather-route' || this.state.routeChoice === 'inland' || this.state.stage === 'dispatch');
      this.networkAltRoute.material.color.setHex(useInland ? 0x79e29f : 0x38c7f3);
      this.networkAltRoute.material.emissive.setHex(useInland ? 0x249a60 : 0x1589bb);
      this.networkAltRoute.material.emissiveIntensity = useInland ? 0.9 : 0.5;
    }
    if (this.networkRiskRing) {
      const fixed = this.state.ruleFixed || (snowShift && this.state.stage === 'dispatch');
      this.networkRiskRing.material.color.setHex(fixed ? 0x79e29f : 0xff665e);
      if (!REDUCED_MOTION) {
        const pulse = 1 + Math.sin(this.elapsed * 3.8) * 0.1;
        this.networkRiskRing.scale.setScalar(pulse);
        this.networkRiskRing.rotation.z += delta * 0.25;
      }
    }
    if (this.networkSnow) {
      this.networkSnow.visible = snowShift;
      if (snowShift && !REDUCED_MOTION) {
        const positions = this.networkSnow.geometry.attributes.position;
        for (let index = 0; index < positions.count; index += 1) {
          let y = positions.getY(index) - delta * (0.85 + (index % 5) * 0.08);
          if (y < 0.25) y = 7.5 + (index % 7) * 0.15;
          positions.setY(index, y);
          positions.setX(index, positions.getX(index) + delta * 0.08);
          if (positions.getX(index) > 7.2) positions.setX(index, -7.2);
        }
        positions.needsUpdate = true;
      }
    }
  }

  updateCase(delta) {
    if (!this.caseGroup) return;
    if (this.casePackage && !REDUCED_MOTION) {
      this.casePackage.rotation.y += delta * 0.35;
      this.casePackage.position.y = 0.26 + Math.sin(this.elapsed * 1.8) * 0.06;
    }
    if (this.scanBeam && !REDUCED_MOTION) {
      this.scanBeam.material.opacity = 0.12 + (Math.sin(this.elapsed * 4.5) + 1) * 0.04;
      this.scanBeam.rotation.y += delta * 0.2;
    }
    this.caseBoxes.forEach((box) => {
      const revealElapsed = this.matchRevealStartedAt === null ? 0 : this.elapsed - this.matchRevealStartedAt;
      const revealed = this.state.signatureFound && revealElapsed >= box.userData.revealDelay;
      const target = revealed ? 1 : 0.001;
      const rate = this.state.signatureFound ? 4.2 : 8;
      const next = THREE.MathUtils.lerp(box.scale.x, target, Math.min(1, delta * rate));
      box.scale.setScalar(next);
      if (this.state.ruleFixed) {
        box.traverse((node) => {
          if (node.isMesh && node.geometry?.type === 'RingGeometry') node.material.color.setHex(0x79e29f);
        });
      }
    });
  }

  updateHotspotPositions() {
    if (!this.camera) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    for (const hotspot of this.hotspots.values()) {
      if (hotspot.button.hidden) continue;
      const point = new THREE.Vector3();
      hotspot.anchor.getWorldPosition(point);
      point.project(this.camera);
      const x = (point.x * 0.5 + 0.5) * width;
      const y = (-point.y * 0.5 + 0.5) * height;
      const inView = point.z > -1 && point.z < 1 && x > -50 && x < width + 50 && y > -30 && y < height + 30;
      hotspot.button.style.left = `${x}px`;
      hotspot.button.style.top = `${y}px`;
      hotspot.button.style.visibility = inView ? 'visible' : 'hidden';
    }
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
    for (const hotspot of this.hotspots.values()) hotspot.button.remove();
  }
}
