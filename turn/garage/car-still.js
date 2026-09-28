// How a car card's picture is made: the car's real model through the production
// renderer, at GARAGE's one view (car-view.js), without the platform, on a
// transparent background, cropped to the frame every card shares.
//
// scripts/render-car-stills.mjs uses this to render every car's factory-colour still
// and line drawing ahead of time (assets/cars/stills, with the shared frame in
// manifest.json). At runtime it renders only a car the player has repainted and
// saved, so that car's card wears the saved colours too. One small renderer does that
// one car at a time and is released as soon as nothing is waiting.

import * as THREE from 'three';
import { createCarVisual, disposeCarVisual } from '../vehicle/car-models.js?revision=r252-supercar-outward-rims';
import { CAR_VIEW } from './car-view.js';

const RELEASE_AFTER_MS = 1500;

export function stillUrl(file) {
  const url = new URL(`../assets/cars/stills/${file}`, import.meta.url);
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey;
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}

// The scene every card is rendered in: the showroom's light and stage, no platform.
export function createStillScene() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(CAR_VIEW.hemisphere.sky, CAR_VIEW.hemisphere.ground, CAR_VIEW.hemisphere.intensity));
  const key = new THREE.DirectionalLight(CAR_VIEW.key.color, CAR_VIEW.key.intensity);
  key.position.set(...CAR_VIEW.key.position);
  scene.add(key);
  const rim = new THREE.DirectionalLight(CAR_VIEW.rim.color, CAR_VIEW.rim.intensity);
  rim.position.set(...CAR_VIEW.rim.position);
  scene.add(rim);
  const stage = new THREE.Group();
  stage.position.y = CAR_VIEW.stageHeight;
  stage.rotation.y = THREE.MathUtils.degToRad(CAR_VIEW.yawDegrees);
  scene.add(stage);
  return { scene, stage };
}

// The showroom's camera over a full frame of fullWidth × fullHeight; frameStill then
// narrows it to the shared crop.
export function createStillCamera(fullWidth, fullHeight) {
  const camera = new THREE.PerspectiveCamera(CAR_VIEW.fov, fullWidth / fullHeight, 0.1, 70);
  camera.position.set(...CAR_VIEW.camera);
  camera.lookAt(...CAR_VIEW.target);
  return camera;
}

// Render only the crop, at the size the renderer draws (renderWidth × renderHeight).
export function frameStill(camera, frame, renderWidth, renderHeight) {
  const zoom = renderWidth / frame.width;
  camera.setViewOffset(
    frame.fullWidth * zoom,
    frame.fullHeight * zoom,
    frame.x * zoom,
    frame.y * zoom,
    renderWidth,
    renderHeight
  );
}

export function stillVisual(carId, color, secondaryColor, { outline = true } = {}) {
  return createCarVisual({ carId, color, secondaryColor, targetLength: CAR_VIEW.targetLength, outline });
}

// Scale a rendered picture down to the card size, for clean edges.
export function downscaleStill(source, documentRef = document) {
  const canvas = documentRef.createElement('canvas');
  canvas.width = CAR_VIEW.still.width;
  canvas.height = CAR_VIEW.still.height;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// ---------- Repainted cards at runtime ----------

let framePromise = null;
let queue = Promise.resolve();
let pending = 0;
let releaseTimer = 0;
let studio = null;
// carId → { key, promise }: the latest saved colours rendered for each car.
const painted = new Map();

function loadFrame() {
  if (!framePromise) {
    framePromise = fetch(stillUrl('manifest.json'))
      .then((response) => {
        if (!response.ok) throw new Error(`TURN: car stills manifest ${response.status}`);
        return response.json();
      })
      .then((manifest) => {
        if (!manifest?.frame) throw new Error('TURN: car stills manifest has no frame');
        return manifest.frame;
      })
      .catch((error) => {
        framePromise = null;
        throw error;
      });
  }
  return framePromise;
}

function openStudio(frame) {
  if (studio) return studio;
  const width = CAR_VIEW.still.width * CAR_VIEW.still.supersample;
  const height = CAR_VIEW.still.height * CAR_VIEW.still.supersample;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  const { scene, stage } = createStillScene();
  const camera = createStillCamera(frame.fullWidth, frame.fullHeight);
  frameStill(camera, frame, width, height);
  studio = { renderer, scene, stage, camera };
  return studio;
}

function releaseStudio() {
  if (!studio || pending) return;
  studio.renderer.dispose();
  studio.renderer.forceContextLoss?.();
  studio = null;
}

async function renderPainted({ carId, color, secondaryColor }) {
  const frame = await loadFrame();
  const { renderer, scene, stage, camera } = openStudio(frame);
  const visual = await stillVisual(carId, color, secondaryColor);
  try {
    stage.add(visual);
    renderer.render(scene, camera);
    const canvas = downscaleStill(renderer.domElement);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('TURN: the car card could not be encoded'))), 'image/png');
    });
    return URL.createObjectURL(blob);
  } finally {
    stage.remove(visual);
    disposeCarVisual(visual);
  }
}

// Resolves to an image URL of the car in these colours, rendered once per colour
// pair. A newer pair for the same car replaces (and frees) the older picture.
export function paintedStillUrl({ carId, color, secondaryColor }) {
  const key = `${color}|${secondaryColor}`.toLowerCase();
  const current = painted.get(carId);
  if (current?.key === key) return current.promise;
  pending += 1;
  globalThis.clearTimeout(releaseTimer);
  const promise = queue.then(() => renderPainted({ carId, color, secondaryColor }));
  queue = promise.catch(() => {}).finally(() => {
    pending -= 1;
    if (!pending) releaseTimer = globalThis.setTimeout(releaseStudio, RELEASE_AFTER_MS);
  });
  painted.set(carId, { key, promise });
  promise.catch(() => {
    if (painted.get(carId)?.promise === promise) painted.delete(carId);
  });
  current?.promise.then((url) => URL.revokeObjectURL(url), () => {});
  return promise;
}
