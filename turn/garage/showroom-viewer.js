// The one live 3D view of a car: the featured car in GARAGE. Drag, or the rotate
// buttons, turn it; with reduced motion it never spins by itself. It renders at most
// 30 frames a second, never while the page is hidden or while it is paused (a sheet
// covering it, a race starting), and releases its WebGL context on dispose.

import * as THREE from 'three';
import {
  DEFAULT_VEHICLE_COLOR,
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  normalizeVehicleColor,
  normalizeVehicleSecondaryColor
} from '../vehicle/catalog.js?revision=r250-supercar-finish';
import { createCarVisual, disposeCarVisual, recolorCarVisual } from '../vehicle/car-models.js?revision=r252-supercar-outward-rims';
import { recordPerformanceFrame } from '../performance-monitor.js?build=20260720-r20';

const FRAME_INTERVAL_MS = 1000 / 30;
// Every car starts 20° off head-on, the view the car cards use too.
export const SHOWROOM_INITIAL_YAW = THREE.MathUtils.degToRad(200);
const IDLE_SPIN = 0.0022;
const DRAG_RATE = 0.012;

function rendererPixelRatio(fallbackCap) {
  const deviceRatio = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
  const profileCap = Number(globalThis.__turnPerformanceProfile?.dprCap);
  const cap = Number.isFinite(profileCap) ? profileCap : fallbackCap;
  return Math.min(deviceRatio, cap);
}

export function createShowroomViewer(host) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(rendererPixelRatio(1.5));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 70);
  camera.position.set(8.6, 4.9, 9.7);
  camera.lookAt(0, 1.05, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x43556c, 3.4));
  const key = new THREE.DirectionalLight(0xfff2c9, 4.4);
  key.position.set(-7, 11, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8ed8ff, 2.2);
  rim.position.set(8, 5, -7);
  scene.add(rim);

  const platformResources = [];
  const platform = new THREE.Group();
  scene.add(platform);
  const addPlatformMesh = (geometry, material, configure) => {
    const mesh = new THREE.Mesh(geometry, material);
    configure(mesh);
    platform.add(mesh);
    platformResources.push(geometry, material);
  };
  addPlatformMesh(
    new THREE.CylinderGeometry(4.25, 4.45, 0.42, 48),
    new THREE.MeshStandardMaterial({ color: 0x252a31, roughness: 0.72 }),
    (mesh) => { mesh.position.y = -0.12; }
  );
  addPlatformMesh(
    new THREE.CylinderGeometry(3.85, 3.85, 0.12, 48),
    new THREE.MeshStandardMaterial({ color: 0x606c78, roughness: 0.38, metalness: 0.25 }),
    (mesh) => { mesh.position.y = 0.14; }
  );
  addPlatformMesh(
    new THREE.TorusGeometry(3.62, 0.045, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xffd43b }),
    (mesh) => {
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = 0.22;
    }
  );

  const stage = new THREE.Group();
  stage.position.y = 0.26;
  scene.add(stage);

  let visual = null;
  let generation = 0;
  let currentColor = DEFAULT_VEHICLE_COLOR;
  let currentSecondaryColor = DEFAULT_VEHICLE_SECONDARY_COLOR;
  let yaw = SHOWROOM_INITIAL_YAW;
  let dragging = false;
  let pointerId = null;
  let lastX = 0;
  let paused = false;
  let stopped = false;
  let disposed = false;
  let lastRenderAt = -Infinity;
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  const clock = new THREE.Clock();

  const startDrag = (event) => {
    event.preventDefault();
    dragging = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    host.setPointerCapture?.(event.pointerId);
  };
  const moveDrag = (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    yaw += (event.clientX - lastX) * DRAG_RATE;
    lastX = event.clientX;
  };
  const stopDrag = (event) => {
    if (pointerId !== null && event?.pointerId != null && event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
  };
  host.addEventListener('pointerdown', startDrag);
  host.addEventListener('pointermove', moveDrag);
  host.addEventListener('pointerup', stopDrag);
  host.addEventListener('pointercancel', stopDrag);
  host.addEventListener('lostpointercapture', stopDrag);

  renderer.setAnimationLoop((now) => {
    if (stopped || paused || document.hidden || now - lastRenderAt < FRAME_INTERVAL_MS) return;
    lastRenderAt = now;
    const elapsed = clock.getElapsedTime();
    if (!dragging && !reducedMotion) yaw += IDLE_SPIN;
    stage.rotation.set(0, yaw, 0);
    if (visual) visual.position.y = reducedMotion ? 0 : Math.sin(elapsed * 2.1) * 0.035;
    renderer.render(scene, camera);
    recordPerformanceFrame('lot', renderer, now);
  });

  function renderOnce() {
    if (stopped) return;
    stage.rotation.set(0, yaw, 0);
    renderer.render(scene, camera);
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    generation += 1;
    renderer.setAnimationLoop(null);
    host.removeEventListener('pointerdown', startDrag);
    host.removeEventListener('pointermove', moveDrag);
    host.removeEventListener('pointerup', stopDrag);
    host.removeEventListener('pointercancel', stopDrag);
    host.removeEventListener('lostpointercapture', stopDrag);
    if (pointerId !== null && host.hasPointerCapture?.(pointerId)) host.releasePointerCapture(pointerId);
    stopDrag();
  }

  function dispose() {
    if (disposed) return;
    stop();
    disposed = true;
    if (visual) {
      stage.remove(visual);
      disposeCarVisual(visual);
      visual = null;
    }
    for (const resource of platformResources) resource.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer.domElement.remove();
  }

  return {
    // Resolves true once the car is on the platform, false if it could not load.
    async show(carId, color, secondaryColor) {
      if (stopped) return false;
      const request = ++generation;
      currentColor = normalizeVehicleColor(color);
      currentSecondaryColor = normalizeVehicleSecondaryColor(secondaryColor);
      try {
        const next = await createCarVisual({
          carId,
          color: currentColor,
          secondaryColor: currentSecondaryColor,
          targetLength: 6.5,
          outline: true
        });
        if (request !== generation || stopped) {
          disposeCarVisual(next);
          return false;
        }
        if (visual) {
          stage.remove(visual);
          disposeCarVisual(visual);
        }
        visual = next;
        stage.add(visual);
        recolorCarVisual(visual, currentColor, currentSecondaryColor);
        yaw = SHOWROOM_INITIAL_YAW;
        renderOnce();
        return true;
      } catch (error) {
        console.warn('TURN: the car could not load in the showroom.', error);
        return false;
      }
    },
    recolor(color, secondaryColor) {
      currentColor = normalizeVehicleColor(color);
      currentSecondaryColor = normalizeVehicleSecondaryColor(secondaryColor);
      if (visual) recolorCarVisual(visual, currentColor, currentSecondaryColor);
      renderOnce();
    },
    rotateBy(degrees) {
      yaw += THREE.MathUtils.degToRad(degrees);
      renderOnce();
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    resize() {
      if (stopped) return;
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(Math.round(rect.width), Math.round(rect.height), false);
      const compact = rect.height < 250;
      camera.position.set(compact ? 9.6 : 8.6, compact ? 5.2 : 4.9, compact ? 10.6 : 9.7);
      camera.lookAt(0, 1.05, 0);
      renderOnce();
    },
    stop,
    dispose
  };
}
