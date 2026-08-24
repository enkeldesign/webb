import * as THREE from 'three';

const BASE_Y = -1.82;
const STAGE_COLORS = [0x38d9ff, 0x8ce99a, 0xffd43b, 0xff8caf, 0xff4fa3];

export class NoTiltView {
  constructor(container, { reducedMotion = false } = {}) {
    if (!container) throw new Error('NO TILT needs a scene container.');
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.elapsed = 0;
    this.modeId = '';
    this.stage = 0;
    this.flash = 0;
    this.projectileMeshes = new Map();
    this.stageMaterials = [];

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x38d9ff, 0.052);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);
    this.camera.position.set(0, 1.35, 10.2);
    this.camera.lookAt(0, 0.55, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.7));
    this.renderer.setSize(
      container.clientWidth || globalThis.innerWidth || 1,
      container.clientHeight || globalThis.innerHeight || 1,
      false
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.append(this.renderer.domElement);

    this.buildLighting();
    this.buildWorld();
    this.setMode('easy');

    this.resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this.resize())
      : null;
    this.resizeObserver?.observe(container);
    this.boundResize = () => this.resize();
    globalThis.addEventListener?.('resize', this.boundResize, { passive: true });
    this.resize();
  }

  setMode(modeId) {
    if (this.modeId === modeId && this.objectPivot) return;
    this.modeId = modeId;
    this.stageMaterials.length = 0;
    if (this.modeRoot) {
      this.balanceRoot.remove(this.modeRoot);
      disposeGroup(this.modeRoot);
    }
    this.modeRoot = new THREE.Group();
    this.baseTilt = new THREE.Group();
    this.objectPivot = new THREE.Group();
    this.modeRoot.add(this.baseTilt, this.objectPivot);
    this.balanceRoot.add(this.modeRoot);

    if (modeId === 'medium') this.buildMarkerMode();
    else if (modeId === 'hard') this.buildHardMode();
    else this.buildBroomMode();
  }

  render({ state, input = { x: 0, y: 0 }, deltaSeconds = 1 / 60, phase = 'home' } = {}) {
    const dt = Math.min(0.05, Math.max(0, Number(deltaSeconds) || 0));
    this.elapsed += dt;
    const idle = !state;
    const angleX = idle ? Math.sin(this.elapsed * 0.72) * 0.045 : state.angleX;
    const angleY = idle ? Math.cos(this.elapsed * 0.53) * 0.025 : state.angleY;
    const jumpY = state?.jumpY || 0;
    const stage = state?.stage || 0;
    const danger = state?.danger || 0;

    if (stage !== this.stage) this.applyStage(stage);
    this.balanceRoot.position.y = BASE_Y + jumpY;
    this.objectPivot.rotation.z = -angleX;
    this.objectPivot.rotation.x = angleY;
    this.baseTilt.rotation.z += (-input.x * 0.065 - this.baseTilt.rotation.z) * Math.min(1, dt * 9);
    this.baseTilt.rotation.x += (input.y * 0.055 - this.baseTilt.rotation.x) * Math.min(1, dt * 9);

    const shadowScale = 1 + jumpY * 0.28;
    this.balanceShadow.scale.setScalar(shadowScale);
    this.balanceShadow.material.opacity = Math.max(0.08, 0.32 - jumpY * 0.12);
    this.syncProjectiles(state?.projectiles || []);

    const decorativeSpeed = this.reducedMotion ? 0 : 0.12 + stage * 0.055;
    this.flowRings.rotation.z += dt * decorativeSpeed;
    this.flowRings.rotation.y = Math.sin(this.elapsed * 0.17) * 0.12;
    this.starField.rotation.z += dt * decorativeSpeed * 0.07;
    if (!this.reducedMotion) {
      const targetCameraX = input.x * 0.24 + Math.sin(this.elapsed * 0.22) * 0.035 * stage;
      const targetCameraY = 1.35 - input.y * 0.12 + Math.cos(this.elapsed * 0.19) * 0.025 * stage;
      this.camera.position.x += (targetCameraX - this.camera.position.x) * Math.min(1, dt * 3.8);
      this.camera.position.y += (targetCameraY - this.camera.position.y) * Math.min(1, dt * 3.8);
      this.camera.lookAt(0, 0.48 + jumpY * 0.12, 0);
    }

    const dangerPulse = 1 + danger * (0.13 + Math.sin(this.elapsed * 18) * 0.06);
    this.objectPivot.scale.setScalar(dangerPulse);
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this.keyLight.intensity = 3.2 + stage * 0.34 + this.flash * 3.2;
    this.rimLight.intensity = 6 + stage * 0.85 + danger * 2.6;
    this.renderer.toneMappingExposure = 1.05 + stage * 0.045 + this.flash * 0.12;

    if (phase === 'paused') this.renderer.toneMappingExposure *= 0.72;
    this.renderer.render(this.scene, this.camera);
  }

  pulse(kind = 'flow') {
    this.flash = kind === 'hit' ? 1.25 : 0.78;
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth || globalThis.innerWidth || 1);
    const height = Math.max(1, this.container.clientHeight || globalThis.innerHeight || 1);
    this.camera.aspect = width / height;
    this.camera.fov = width / height < 0.62 ? 50 : 45;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  destroy() {
    this.resizeObserver?.disconnect();
    globalThis.removeEventListener?.('resize', this.boundResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  buildLighting() {
    const hemisphere = new THREE.HemisphereLight(0xdff8ff, 0x2b1557, 2.2);
    this.scene.add(hemisphere);

    this.keyLight = new THREE.DirectionalLight(0xfff3c4, 3.2);
    this.keyLight.position.set(-4.5, 8, 6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = -7;
    this.keyLight.shadow.camera.right = 7;
    this.keyLight.shadow.camera.top = 9;
    this.keyLight.shadow.camera.bottom = -4;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.PointLight(0xff4fa3, 6, 18, 1.8);
    this.rimLight.position.set(4.5, 3.8, 3.2);
    this.scene.add(this.rimLight);
  }

  buildWorld() {
    this.balanceRoot = new THREE.Group();
    this.scene.add(this.balanceRoot);

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x20252b,
      roughness: 0.78,
      metalness: 0.14
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(8.5, 64), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = BASE_Y - 0.12;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const floorRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd43b,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide
    });
    for (const radius of [2.4, 4.1, 6.2]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.055, 80), floorRingMaterial.clone());
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = BASE_Y - 0.105;
      this.scene.add(ring);
    }

    this.balanceShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.36, 48),
      new THREE.MeshBasicMaterial({ color: 0x08090a, transparent: true, opacity: 0.32, depthWrite: false })
    );
    this.balanceShadow.rotation.x = -Math.PI / 2;
    this.balanceShadow.position.set(0, BASE_Y - 0.09, 0.08);
    this.scene.add(this.balanceShadow);

    this.flowRings = new THREE.Group();
    const ringColors = [0xff4fa3, 0xffd43b, 0x8ce99a];
    ringColors.forEach((color, index) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.14,
        depthWrite: false
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7 + index * 0.8, 0.025 + index * 0.008, 8, 96), material);
      ring.position.set(0, 1.05 + index * 0.1, -3.5 - index * 0.22);
      ring.rotation.x = 0.12 + index * 0.09;
      ring.rotation.z = index * 0.8;
      this.flowRings.add(ring);
    });
    this.scene.add(this.flowRings);

    const starPositions = new Float32Array(180 * 3);
    for (let index = 0; index < starPositions.length; index += 3) {
      starPositions[index] = (Math.random() - 0.5) * 15;
      starPositions[index + 1] = Math.random() * 11 - 3;
      starPositions[index + 2] = -3 - Math.random() * 7;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starField = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0xfff8e8, size: 0.055, transparent: true, opacity: 0.68 })
    );
    this.scene.add(this.starField);
  }

  buildBroomMode() {
    const dishMaterial = stageMaterial(0x35b8e7, 0x0b5f7e, 0.18, 0.72);
    this.stageMaterials.push(dishMaterial);
    const profile = [
      new THREE.Vector2(0.02, 0.03),
      new THREE.Vector2(0.38, 0.055),
      new THREE.Vector2(0.82, 0.16),
      new THREE.Vector2(1.26, 0.4),
      new THREE.Vector2(1.52, 0.68)
    ];
    const dish = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), dishMaterial);
    dish.receiveShadow = true;
    this.baseTilt.add(dish);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.51, 0.105, 12, 64),
      outlinedMaterial(0xfff8e8, 0x08090a)
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.68;
    rim.castShadow = true;
    this.baseTilt.add(rim);

    this.objectPivot.position.y = 0.075;
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.14, 3.42, 14),
      outlinedMaterial(0xffd43b, 0x5a3000)
    );
    handle.position.y = 1.71;
    handle.castShadow = true;
    this.objectPivot.add(handle);

    const brushMaterial = stageMaterial(0xff4fa3, 0x741444, 0.2, 0.58);
    this.stageMaterials.push(brushMaterial);
    const brush = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.52, 0.52), brushMaterial);
    brush.position.y = 3.55;
    brush.castShadow = true;
    this.objectPivot.add(brush);
    for (let index = -3; index <= 3; index += 1) {
      const bristle = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.48, 0.12),
        new THREE.MeshStandardMaterial({ color: index % 2 ? 0xffd43b : 0xfff8e8, roughness: 0.72 })
      );
      bristle.position.set(index * 0.18, 3.98, 0);
      bristle.rotation.z = index * 0.025;
      bristle.castShadow = true;
      this.objectPivot.add(bristle);
    }
  }

  buildMarkerMode() {
    const cradle = new THREE.Mesh(
      new THREE.CylinderGeometry(1.24, 1.44, 0.28, 48),
      stageMaterial(0x8ce99a, 0x1b6b46, 0.14, 0.7)
    );
    cradle.position.y = 0.06;
    cradle.receiveShadow = true;
    this.baseTilt.add(cradle);

    const lower = marker(2.72, 0.31, 0x35b8e7, 0x08090a);
    lower.rotation.z = Math.PI / 2;
    lower.position.y = 0.54;
    lower.castShadow = true;
    this.baseTilt.add(lower);

    this.objectPivot.position.y = 0.88;
    const upper = marker(3.35, 0.27, 0xff4fa3, 0xffd43b);
    upper.position.y = 1.7;
    this.objectPivot.add(upper);
    upper.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
      if (child.material?.emissive) this.stageMaterials.push(child.material);
    });
  }

  buildHardMode() {
    const platformMaterial = stageMaterial(0x292b59, 0x171735, 0.5, 0.36);
    this.stageMaterials.push(platformMaterial);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.42, 0.32, 8), platformMaterial);
    platform.position.y = 0.12;
    platform.receiveShadow = true;
    this.baseTilt.add(platform);
    const padRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.09, 10, 48),
      new THREE.MeshStandardMaterial({ color: 0xffd43b, emissive: 0xff8c00, emissiveIntensity: 0.52 })
    );
    padRing.rotation.x = Math.PI / 2;
    padRing.position.y = 0.36;
    this.baseTilt.add(padRing);

    this.objectPivot.position.y = 0.36;
    const stemMaterial = stageMaterial(0xfff8e8, 0x35b8e7, 0.38, 0.4);
    this.stageMaterials.push(stemMaterial);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.23, 3.1, 10), stemMaterial);
    stem.position.y = 1.55;
    stem.castShadow = true;
    this.objectPivot.add(stem);

    const coreMaterial = stageMaterial(0xff4fa3, 0xff195f, 0.58, 0.24);
    this.stageMaterials.push(coreMaterial);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.78, 0), coreMaterial);
    core.position.y = 3.32;
    core.rotation.y = Math.PI / 4;
    core.castShadow = true;
    this.objectPivot.add(core);
    [2.25, 3.32, 4.02].forEach((height, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.54 - index * 0.08, 0.055, 8, 40),
        new THREE.MeshStandardMaterial({
          color: index === 1 ? 0x8ce99a : 0xffd43b,
          emissive: index === 1 ? 0x22aa66 : 0xd88900,
          emissiveIntensity: 0.72
        })
      );
      ring.position.y = height;
      ring.rotation.x = Math.PI / 2;
      this.objectPivot.add(ring);
    });
  }

  syncProjectiles(projectiles) {
    const activeIds = new Set();
    for (const projectile of projectiles) {
      activeIds.add(projectile.id);
      let mesh = this.projectileMeshes.get(projectile.id);
      if (!mesh) {
        mesh = createProjectile(projectile.side);
        this.projectileMeshes.set(projectile.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(projectile.x, BASE_Y + 0.74, 0.12);
      mesh.rotation.z += 0.18 * Math.sign(projectile.velocity);
      if (projectile.hit) mesh.scale.setScalar(1.18);
    }

    for (const [id, mesh] of this.projectileMeshes) {
      if (activeIds.has(id)) continue;
      this.scene.remove(mesh);
      disposeGroup(mesh);
      this.projectileMeshes.delete(id);
    }
  }

  applyStage(stage) {
    this.stage = Math.max(0, Math.min(4, Number(stage) || 0));
    const color = new THREE.Color(STAGE_COLORS[this.stage]);
    this.scene.fog.color.copy(color).multiplyScalar(0.72);
    this.rimLight.color.copy(color);
    this.flowRings.children.forEach((ring, index) => {
      ring.material.opacity = 0.12 + this.stage * 0.035 + index * 0.012;
    });
    for (const material of this.stageMaterials) {
      if (!material?.emissive) continue;
      material.emissive.copy(color).multiplyScalar(0.46);
      material.emissiveIntensity = 0.2 + this.stage * 0.15;
    }
  }
}

function marker(length, radius, bodyColor, capColor) {
  const group = new THREE.Group();
  const bodyMaterial = stageMaterial(bodyColor, bodyColor, 0.18, 0.48);
  const capMaterial = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.52, metalness: 0.08 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 20), bodyMaterial);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 10), capMaterial);
  const capBottom = capTop.clone();
  capTop.position.y = length / 2;
  capBottom.position.y = -length / 2;
  group.add(body, capTop, capBottom);
  return group;
}

function createProjectile(side) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: side < 0 ? 0xffd43b : 0xff4fa3,
    emissive: side < 0 ? 0xd88700 : 0xd41462,
    emissiveIntensity: 0.72,
    roughness: 0.3,
    metalness: 0.22
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), material);
  core.castShadow = true;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.47, 0.055, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff8e8 })
  );
  ring.rotation.y = Math.PI / 2;
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.9, 8),
    new THREE.MeshBasicMaterial({ color: material.color, transparent: true, opacity: 0.42 })
  );
  tail.rotation.z = side < 0 ? -Math.PI / 2 : Math.PI / 2;
  tail.position.x = side * 0.65;
  group.add(core, ring, tail);
  return group;
}

function stageMaterial(color, emissive, emissiveIntensity, roughness) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness,
    metalness: 0.12
  });
}

function outlinedMaterial(color, emissive) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.12,
    roughness: 0.56,
    metalness: 0.08
  });
}

function disposeGroup(group) {
  group.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}
