import * as THREE from "three";
import { clamp, randomInt } from "./data.js";

function createLabelTexture(text, color = "#f5d889") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(12, 8, 4, .82)";
  context.strokeStyle = "rgba(209, 164, 77, .8)";
  context.lineWidth = 5;
  context.beginPath();
  context.roundRect(12, 12, 488, 104, 22);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.font = "700 38px Georgia";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 65);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class TravelScene {
  constructor(canvas, onComplete) {
    this.canvas = canvas;
    this.onComplete = onComplete;
    this.active = true;
    this.progress = 0;
    this.branch = null;
    this.completed = false;
    this.dragging = false;
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.markerScreen = new THREE.Vector3();
    this.clock = new THREE.Clock();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101722);
    this.scene.fog = new THREE.FogExp2(0x101722, 0.035);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 15.5, 15.8);
    this.camera.lookAt(0, 0, 2.6);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const hemisphere = new THREE.HemisphereLight(0x7ca7c8, 0x2a170b, 1.55);
    this.scene.add(hemisphere);

    const moon = new THREE.DirectionalLight(0xffd89c, 2.2);
    moon.position.set(-6, 12, 7);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    this.scene.add(moon);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.buildWorld();
    this.bindEvents();
    this.resize();
    this.animate();
  }

  buildWorld() {
    const groundGeometry = new THREE.PlaneGeometry(20, 32, 32, 48);
    const positions = groundGeometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const ridge = Math.sin(x * 0.7) * 0.22 + Math.cos(y * 0.42) * 0.34;
      positions.setZ(index, ridge + (Math.random() - 0.5) * 0.22);
    }
    groundGeometry.computeVertexNormals();

    const ground = new THREE.Mesh(
      groundGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x263328,
        roughness: 1,
        metalness: 0
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = 2;
    ground.receiveShadow = true;
    this.world.add(ground);

    this.paths = {
      moonwell: new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.18, 11),
        new THREE.Vector3(0.2, 0.18, 8.5),
        new THREE.Vector3(-0.4, 0.18, 6),
        new THREE.Vector3(-2.6, 0.18, 3.4),
        new THREE.Vector3(-3.4, 0.18, 0.5),
        new THREE.Vector3(-2.1, 0.18, -2.4),
        new THREE.Vector3(0, 0.18, -5.7)
      ]),
      warcamp: new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.18, 11),
        new THREE.Vector3(-0.15, 0.18, 8.5),
        new THREE.Vector3(0.4, 0.18, 6),
        new THREE.Vector3(2.8, 0.18, 3.5),
        new THREE.Vector3(3.4, 0.18, 0.2),
        new THREE.Vector3(2, 0.18, -2.5),
        new THREE.Vector3(0, 0.18, -5.7)
      ])
    };

    Object.entries(this.paths).forEach(([key, curve]) => {
      const path = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 72, key === "moonwell" ? 0.19 : 0.17, 7, false),
        new THREE.MeshStandardMaterial({
          color: key === "moonwell" ? 0x66a7a2 : 0x9b6934,
          emissive: key === "moonwell" ? 0x193638 : 0x2d1607,
          emissiveIntensity: 0.55,
          roughness: 0.82
        })
      );
      path.receiveShadow = true;
      this.world.add(path);
    });

    this.makeMoonwell();
    this.makeWarCamp();
    this.makePortal();
    this.makeScenery();
    this.makeMarker();
  }

  makeMoonwell() {
    const group = new THREE.Group();
    group.position.set(-3.5, 0.1, 0.4);

    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.25, 0.45, 10),
      new THREE.MeshStandardMaterial({ color: 0x4c5c5f, roughness: 0.88 })
    );
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.82, 0.12, 32),
      new THREE.MeshStandardMaterial({
        color: 0x75dbdd,
        emissive: 0x2e8f9b,
        emissiveIntensity: 1.4,
        roughness: 0.2
      })
    );
    water.position.y = 0.27;
    group.add(water);
    this.moonwellWater = water;

    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: createLabelTexture("Moonwell") }));
    label.position.set(0, 2.05, 0);
    label.scale.set(3.2, 0.8, 1);
    group.add(label);
    this.world.add(group);
  }

  makeWarCamp() {
    const group = new THREE.Group();
    group.position.set(3.4, 0.1, 0.2);

    const tentMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4c2f, roughness: 0.9 });
    [-0.65, 0.65].forEach(x => {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.6, 4), tentMaterial);
      tent.position.set(x, 0.8, 0);
      tent.rotation.y = Math.PI / 4;
      tent.castShadow = true;
      group.add(tent);
    });

    const fire = new THREE.PointLight(0xff8a3b, 3.6, 6, 2);
    fire.position.set(0, 1.15, 0.8);
    group.add(fire);
    this.campFire = fire;

    const ember = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.25, 0),
      new THREE.MeshStandardMaterial({ color: 0xffad4a, emissive: 0xff5010, emissiveIntensity: 2 })
    );
    ember.position.set(0, 0.42, 0.8);
    group.add(ember);

    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: createLabelTexture("War Camp") }));
    label.position.set(0, 2.2, 0);
    label.scale.set(3.2, 0.8, 1);
    group.add(label);
    this.world.add(group);
  }

  makePortal() {
    const group = new THREE.Group();
    group.position.set(0, 0.25, -5.9);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.18, 12, 32),
      new THREE.MeshStandardMaterial({
        color: 0xcaa75b,
        emissive: 0x7d4a13,
        emissiveIntensity: 1.1,
        metalness: 0.68,
        roughness: 0.28
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.4;
    ring.castShadow = true;
    group.add(ring);

    const core = new THREE.Mesh(
      new THREE.CircleGeometry(1.16, 32),
      new THREE.MeshBasicMaterial({ color: 0x6a45a8, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    core.rotation.x = Math.PI / 2;
    core.position.y = 1.4;
    core.position.z = 0.02;
    group.add(core);
    this.portalCore = core;
    this.world.add(group);
  }

  makeScenery() {
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x442b16, roughness: 1 });
    const leafMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x213c2b, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x315038, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x1b3025, roughness: 1 })
    ];

    for (let index = 0; index < 38; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * randomInt(46, 86) / 10;
      const z = randomInt(-70, 130) / 10;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 1.25, 6), trunkMaterial);
      trunk.position.y = 0.62;
      tree.add(trunk);
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(0.75 + Math.random() * 0.32, 2.2 + Math.random() * 0.7, 7),
        leafMaterials[index % leafMaterials.length]
      );
      leaves.position.y = 1.85;
      leaves.castShadow = true;
      tree.add(leaves);
      tree.position.set(x, 0, z);
      tree.rotation.y = Math.random() * Math.PI;
      this.world.add(tree);
    }

    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x4b4d46, roughness: 1 });
    for (let index = 0; index < 24; index += 1) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + Math.random() * 0.42, 0), rockMaterial);
      rock.scale.y = 0.6 + Math.random() * 0.7;
      rock.position.set((Math.random() - 0.5) * 17, 0.15, (Math.random() - 0.5) * 27 + 2);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      this.world.add(rock);
    }
  }

  makeMarker() {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0x5b4522, metalness: 0.45, roughness: 0.48 })
    );
    base.castShadow = true;
    group.add(base);

    const colors = [0x4ea8ff, 0x7fe39a, 0xe76363];
    [-0.32, 0, 0.32].forEach((x, index) => {
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12, 0.38, 4, 8),
        new THREE.MeshStandardMaterial({ color: colors[index], roughness: 0.45, metalness: 0.18 })
      );
      body.position.set(x, 0.55, 0.06 * index);
      body.castShadow = true;
      group.add(body);
    });

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 1.7, 6),
      new THREE.MeshStandardMaterial({ color: 0xc7a15d, metalness: 0.6, roughness: 0.35 })
    );
    pole.position.set(0, 1.03, 0);
    group.add(pole);

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 0.52),
      new THREE.MeshStandardMaterial({ color: 0x6e2942, side: THREE.DoubleSide, roughness: 0.65 })
    );
    flag.position.set(0.42, 1.52, 0);
    group.add(flag);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 0.98, 32),
      new THREE.MeshBasicMaterial({ color: 0xf2ca71, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.03;
    group.add(halo);
    this.markerHalo = halo;

    this.marker = group;
    this.world.add(group);
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", event => {
      if (!this.active || this.completed) return;
      const rect = this.canvas.getBoundingClientRect();
      this.marker.position.clone().project(this.camera);
      this.markerScreen.copy(this.marker.position).project(this.camera);
      const markerX = rect.left + (this.markerScreen.x * 0.5 + 0.5) * rect.width;
      const markerY = rect.top + (-this.markerScreen.y * 0.5 + 0.5) * rect.height;
      if (Math.hypot(event.clientX - markerX, event.clientY - markerY) <= 62) {
        this.dragging = true;
        this.canvas.setPointerCapture(event.pointerId);
      }
    });

    this.canvas.addEventListener("pointermove", event => {
      if (!this.dragging || !this.active || this.completed) return;
      this.moveFromPointer(event);
    });

    const endDrag = event => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    };

    this.canvas.addEventListener("pointerup", endDrag);
    this.canvas.addEventListener("pointercancel", endDrag);
    window.addEventListener("resize", () => this.resize());
  }

  moveFromPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, point)) return;

    if (!this.branch && this.progress < 0.38) {
      const moonResult = this.nearestPointOnCurve(this.paths.moonwell, point);
      const campResult = this.nearestPointOnCurve(this.paths.warcamp, point);
      const chosen = moonResult.distance <= campResult.distance ? moonResult : campResult;
      this.progress = clamp(Math.max(this.progress - 0.025, chosen.t), 0, 0.38);
      if (this.progress >= 0.31) {
        this.branch = moonResult.distance <= campResult.distance ? "moonwell" : "warcamp";
      }
    } else {
      const curve = this.paths[this.branch || "moonwell"];
      const result = this.nearestPointOnCurve(curve, point);
      if (result.distance < 3.2) {
        this.progress = clamp(Math.max(this.progress - 0.02, result.t), 0, 1);
      }
    }

    this.updateMarker();
  }

  nearestPointOnCurve(curve, point) {
    let best = { t: this.progress, distance: Infinity };
    for (let index = 0; index <= 100; index += 1) {
      const t = index / 100;
      if (t < this.progress - 0.055) continue;
      const sample = curve.getPointAt(t);
      const currentDistance = sample.distanceToSquared(point);
      if (currentDistance < best.distance) {
        best = { t, distance: currentDistance };
      }
    }
    best.distance = Math.sqrt(best.distance);
    return best;
  }

  advance(amount = 0.085) {
    if (!this.active || this.completed) return;
    if (!this.branch && this.progress + amount >= 0.31) {
      this.branch = "moonwell";
    }
    this.progress = clamp(this.progress + amount, 0, 1);
    this.updateMarker();
  }

  updateMarker() {
    const curve = this.paths[this.branch || "moonwell"];
    const point = curve.getPointAt(this.progress);
    this.marker.position.copy(point);
    const tangent = curve.getTangentAt(Math.min(1, this.progress + 0.01));
    this.marker.rotation.y = Math.atan2(tangent.x, tangent.z);

    if (this.progress >= 0.995 && !this.completed) {
      this.completed = true;
      this.onComplete(this.branch || "moonwell");
    }
  }

  reset(wave) {
    this.progress = 0;
    this.branch = null;
    this.completed = false;
    this.active = true;
    this.updateMarker();
    const tint = (wave - 1) % 4;
    const backgrounds = [0x101722, 0x15121d, 0x111a17, 0x1a1110];
    this.scene.background.setHex(backgrounds[tint]);
    this.scene.fog.color.setHex(backgrounds[tint]);
  }

  setActive(active) {
    this.active = active;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    const elapsed = this.clock.getElapsedTime();
    if (this.marker) {
      this.marker.position.y = 0.18 + Math.sin(elapsed * 2.7) * 0.055;
      this.markerHalo.material.opacity = 0.48 + Math.sin(elapsed * 3.1) * 0.16;
      this.markerHalo.rotation.z = elapsed * 0.25;
    }
    if (this.moonwellWater) {
      this.moonwellWater.scale.setScalar(1 + Math.sin(elapsed * 2.1) * 0.05);
    }
    if (this.campFire) {
      this.campFire.intensity = 3.2 + Math.sin(elapsed * 8.4) * 0.55;
    }
    if (this.portalCore) {
      this.portalCore.material.opacity = 0.58 + Math.sin(elapsed * 2.4) * 0.16;
      this.portalCore.rotation.z = elapsed * 0.2;
    }

    if (this.active) this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }
}
