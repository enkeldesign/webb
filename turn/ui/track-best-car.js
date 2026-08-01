import * as THREE from 'three';
import { createCarVisual } from '../vehicle/car-models.js?build=20260720-r22';
import {
  getCarDefinition,
  normalizeVehicleColor,
  normalizeVehicleSecondaryColor
} from '../vehicle/catalog.js?build=20260724-r59';

const THUMBNAIL_WIDTH = 240;
const THUMBNAIL_HEIGHT = 140;
const THUMBNAIL_ALPHA_THRESHOLD = 8;
const THUMBNAIL_CROP_PADDING = 5;
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
    return croppedThumbnailDataUrl(renderer.domElement);
  } finally {
    if (visual) disposeVisualMaterials(visual);
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
}

function croppedThumbnailDataUrl(sourceCanvas) {
  const samplingCanvas = document.createElement('canvas');
  samplingCanvas.width = sourceCanvas.width;
  samplingCanvas.height = sourceCanvas.height;
  const samplingContext = samplingCanvas.getContext('2d', { willReadFrequently: true });
  samplingContext.drawImage(sourceCanvas, 0, 0);

  const pixels = samplingContext.getImageData(
    0,
    0,
    samplingCanvas.width,
    samplingCanvas.height
  ).data;
  let minX = samplingCanvas.width;
  let minY = samplingCanvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < samplingCanvas.height; y += 1) {
    for (let x = 0; x < samplingCanvas.width; x += 1) {
      const alpha = pixels[(y * samplingCanvas.width + x) * 4 + 3];
      if (alpha <= THUMBNAIL_ALPHA_THRESHOLD) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return sourceCanvas.toDataURL('image/png');

  const cropX = Math.max(0, minX - THUMBNAIL_CROP_PADDING);
  const cropY = Math.max(0, minY - THUMBNAIL_CROP_PADDING);
  const cropRight = Math.min(samplingCanvas.width - 1, maxX + THUMBNAIL_CROP_PADDING);
  const cropBottom = Math.min(samplingCanvas.height - 1, maxY + THUMBNAIL_CROP_PADDING);
  const cropWidth = cropRight - cropX + 1;
  const cropHeight = cropBottom - cropY + 1;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  croppedCanvas.getContext('2d').drawImage(
    sourceCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );
  return croppedCanvas.toDataURL('image/png');
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
