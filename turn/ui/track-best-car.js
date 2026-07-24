import * as THREE from 'three';
import { createCarVisual } from '../vehicle/car-models.js?build=20260720-r22';
import {
  getCarDefinition,
  normalizeVehicleColor,
  normalizeVehicleSecondaryColor
} from '../vehicle/catalog.js?build=20260724-r59';

const THUMBNAIL_WIDTH = 240;
const THUMBNAIL_HEIGHT = 140;
const thumbnailCache = new Map();
let renderQueue = Promise.resolve();

export function renderBestCarThumbnail(bestLap) {
  const car = getCarDefinition(bestLap?.carId);
  const color = normalizeVehicleColor(bestLap?.carColor);
  const secondaryColor = normalizeVehicleSecondaryColor(bestLap?.carSecondaryColor);
  const cacheKey = `${car.id}:${color}:${secondaryColor}`;

  if (!thumbnailCache.has(cacheKey)) {
    const task = renderQueue.then(() => renderThumbnail({
      carId: car.id,
      color,
      secondaryColor
    }));
    renderQueue = task.catch(() => {});
    thumbnailCache.set(cacheKey, task);
    task.catch(() => thumbnailCache.delete(cacheKey));
  }

  return thumbnailCache.get(cacheKey);
}

async function renderThumbnail({ carId, color, secondaryColor }) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x56616a, 3.35));

  const keyLight = new THREE.DirectionalLight(0xfff2c9, 4.25);
  keyLight.position.set(-6, 10, 7);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8ed8ff, 1.45);
  fillLight.position.set(7, 4, -6);
  scene.add(fillLight);

  const camera = new THREE.PerspectiveCamera(
    34,
    THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT,
    0.1,
    60
  );
  camera.position.set(7.8, 4.8, 8.8);
  camera.lookAt(0, 1.1, 0);

  let visual = null;
  try {
    visual = await createCarVisual({
      carId,
      color,
      secondaryColor,
      targetLength: 6.4,
      outline: true
    });
    visual.rotation.y = Math.PI - 0.55;
    scene.add(visual);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    if (visual) disposeVisualMaterials(visual);
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
}

function disposeVisualMaterials(root) {
  const materials = new Set();
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of nodeMaterials) materials.add(material);
  });
  for (const material of materials) material.dispose?.();
}
