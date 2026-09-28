#!/usr/bin/env node
// Renders GARAGE's car card artwork from every catalog car's real 3D model, with the
// production renderer and the showroom's own 20° view (garage/car-still.js,
// garage/car-view.js):
//
//   turn/assets/cars/stills/<car>.webp          the car in its factory colours
//   turn/assets/cars/stills/<car>-outline.webp  the same car as an Ink line drawing,
//                                               for a locked card
//   turn/assets/cars/stills/manifest.json       the shared frame and each car's source
//                                               hashes; GARAGE renders a repainted car
//                                               into the same frame at runtime
//
// Every car shares one frame, so cars keep their relative size and stand on one line.
// Run it after a car model changes; garage-car-stills-production checks the hashes.
//
//   node turn/scripts/render-car-stills.mjs          render every car
//   node turn/scripts/render-car-stills.mjs --check  verify the manifest only

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CAR_VIEW } from '../garage/car-view.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const turnRoot = path.join(repoRoot, 'turn');
export const STILLS_DIRECTORY = path.join(turnRoot, 'assets/cars/stills');
export const STILLS_MANIFEST = path.join(STILLS_DIRECTORY, 'manifest.json');
export const STILL_WIDTH = CAR_VIEW.still.width;
export const STILL_HEIGHT = CAR_VIEW.still.height;

const SUPERCAR_SOURCES = [
  'assets/cars/supercar-model-data.js',
  'assets/cars/supercar-data-1.js',
  'assets/cars/supercar-data-2.js',
  'assets/cars/supercar-data-3.js',
  'assets/cars/supercar-data-4.js',
  'assets/cars/supercar-data-5.js',
  // The Supercar borrows the Learner Car's wheels.
  'assets/cars/training-car.glb'
];

// Kenney packs colour their models from a palette texture. The table is read from the
// source text: the finish module imports Three, and this check runs without packages.
async function kenneyPalettes() {
  const source = await fs.readFile(path.join(turnRoot, 'vehicle/semantic-car-finish.js'), 'utf8');
  const table = source.match(/const KENNEY_PALETTE_BY_PACK = Object\.freeze\(\{([\s\S]*?)\}\);/)?.[1];
  if (!table) throw new Error('render-car-stills: KENNEY_PALETTE_BY_PACK not found in semantic-car-finish.js');
  return Object.fromEntries([...table.matchAll(/([\w-]+):\s*'([^']+)'/g)].map(([, pack, file]) => [pack, file]));
}

// The files that decide how a car looks: its model and, for Kenney packs, the palette.
export async function carStillSources(car, palettes = null) {
  const files = car.id === 'supercar' ? [...SUPERCAR_SOURCES] : [car.asset.replace(/^\.\//, '')];
  const palette = (palettes || await kenneyPalettes())[car.pack];
  if (palette) files.push(palette.replace(/^\.\//, ''));
  const hashes = {};
  for (const file of files) {
    const bytes = await fs.readFile(path.join(turnRoot, file));
    hashes[file] = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  }
  return hashes;
}

// The code and data every still depends on: car-still.js and everything it imports
// from TURN (the renderer, catalog colours and scale, finishes, liveries, wheels,
// procedural parts), found by following static imports. Any change means re-rendering.
export async function rendererSources() {
  const hashes = {};
  const pending = ['garage/car-still.js'];
  while (pending.length) {
    const file = pending.shift();
    if (hashes[file]) continue;
    const bytes = await fs.readFile(path.join(turnRoot, file));
    hashes[file] = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const source = bytes.toString('utf8');
    for (const [, specifier] of source.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+'([^']+)'/g)) {
      let resolved = null;
      if (specifier.startsWith('/turn/')) resolved = specifier.slice('/turn/'.length);
      else if (specifier.startsWith('.')) resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      if (resolved) pending.push(resolved.replace(/[?#].*$/, ''));
    }
  }
  return Object.fromEntries(Object.entries(hashes).sort(([left], [right]) => left.localeCompare(right)));
}

export async function expectedManifestCars() {
  const { CAR_CATALOG } = await import(pathToFileURL(path.join(turnRoot, 'vehicle/catalog.js')).href);
  const palettes = await kenneyPalettes();
  const cars = {};
  for (const car of CAR_CATALOG) cars[car.id] = { sources: await carStillSources(car, palettes) };
  return cars;
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary'
};

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8">
<script type="importmap">{"imports":{
  "three-native":"/node_modules/three/build/three.module.js",
  "three":"/turn/three-runtime.js",
  "three/addons/":"/node_modules/three/examples/jsm/"
}}</script></head><body></body></html>`;

// Runs in the browser: every car through the production renderer.
async function renderInPage({ carIds }) {
  const THREE = await import('three');
  const { getVehicleDefaultColor, getVehicleDefaultSecondaryColor } = await import('/turn/vehicle/catalog.js');
  const {
    createStillCamera,
    createStillScene,
    downscaleStill,
    frameStill,
    stillVisual
  } = await import('/turn/garage/car-still.js');
  const { CAR_VIEW } = await import('/turn/garage/car-view.js');
  const { disposeCarVisual } = await import('/turn/vehicle/car-models.js?revision=r252-supercar-outward-rims');

  const INK = [8, 9, 10];
  const hiWidth = CAR_VIEW.still.width * CAR_VIEW.still.supersample;
  const hiHeight = CAR_VIEW.still.height * CAR_VIEW.still.supersample;
  // The reference frame the shared crop is measured in.
  const FULL_WIDTH = 1600;
  const FULL_HEIGHT = 1200;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const { scene, stage } = createStillScene();
  const camera = createStillCamera(FULL_WIDTH, FULL_HEIGHT);
  const factory = (carId, outline) => stillVisual(
    carId,
    getVehicleDefaultColor(carId),
    getVehicleDefaultSecondaryColor(carId),
    { outline }
  );

  function alphaBounds(canvas) {
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    context.canvas.width = canvas.width;
    context.canvas.height = canvas.height;
    context.drawImage(canvas, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let minX = Infinity; let minY = Infinity; let maxX = -1; let maxY = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (data[(y * canvas.width + x) * 4 + 3] <= 8) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return { minX, minY, maxX, maxY };
  }

  // 1. One crop for every car: the union of their silhouettes, padded, at 5:3.
  renderer.setSize(FULL_WIDTH, FULL_HEIGHT, false);
  const union = { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1 };
  for (const carId of carIds) {
    const visual = await factory(carId, true);
    stage.add(visual);
    renderer.render(scene, camera);
    const bounds = alphaBounds(renderer.domElement);
    stage.remove(visual);
    disposeCarVisual(visual);
    union.minX = Math.min(union.minX, bounds.minX);
    union.minY = Math.min(union.minY, bounds.minY);
    union.maxX = Math.max(union.maxX, bounds.maxX);
    union.maxY = Math.max(union.maxY, bounds.maxY);
  }
  const pad = FULL_WIDTH * 0.02;
  let cropWidth = union.maxX - union.minX + 1 + (2 * pad);
  let cropHeight = union.maxY - union.minY + 1 + (2 * pad);
  const aspect = CAR_VIEW.still.width / CAR_VIEW.still.height;
  if (cropWidth / cropHeight < aspect) cropWidth = cropHeight * aspect;
  else cropHeight = cropWidth / aspect;
  const frame = {
    fullWidth: FULL_WIDTH,
    fullHeight: FULL_HEIGHT,
    x: Math.round((((union.minX + union.maxX) / 2) - (cropWidth / 2)) * 100) / 100,
    y: Math.round((((union.minY + union.maxY) / 2) - (cropHeight / 2)) * 100) / 100,
    width: Math.round(cropWidth * 100) / 100,
    height: Math.round(cropHeight * 100) / 100
  };
  frameStill(camera, frame, hiWidth, hiHeight);
  renderer.setSize(hiWidth, hiHeight, false);

  // 2. The line drawing: data passes into linear render targets, then edges.
  const target = new THREE.WebGLRenderTarget(hiWidth, hiHeight, { type: THREE.UnsignedByteType });
  const normalMaterial = new THREE.MeshNormalMaterial();
  const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });

  function readPass(material) {
    scene.overrideMaterial = material;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    const pixels = new Uint8Array(hiWidth * hiHeight * 4);
    renderer.readRenderTargetPixels(target, 0, 0, hiWidth, hiHeight, pixels);
    renderer.setRenderTarget(null);
    scene.overrideMaterial = null;
    return pixels;
  }

  function lineDrawing(normals, depths) {
    const count = hiWidth * hiHeight;
    // Render targets read bottom-up; row 0 here is the top of the picture.
    const at = (x, y) => ((hiHeight - 1 - y) * hiWidth) + x;
    const inside = new Uint8Array(count);
    const normal = new Float32Array(count * 3);
    const depth = new Float32Array(count);
    const near = camera.near;
    const far = camera.far;
    for (let y = 0; y < hiHeight; y += 1) {
      for (let x = 0; x < hiWidth; x += 1) {
        const source = at(x, y) * 4;
        const index = (y * hiWidth) + x;
        inside[index] = normals[source + 3] > 127 ? 1 : 0;
        normal[index * 3] = (normals[source] / 127.5) - 1;
        normal[(index * 3) + 1] = (normals[source + 1] / 127.5) - 1;
        normal[(index * 3) + 2] = (normals[source + 2] / 127.5) - 1;
        const packed = (depths[source] / 255 / (256 * 256 * 256))
          + (depths[source + 1] / 255 / (256 * 256))
          + (depths[source + 2] / 255 / 256)
          + (depths[source + 3] / 255);
        // Perspective depth back to distance from the camera.
        depth[index] = (near * far) / (far - (packed * (far - near)));
      }
    }
    const contour = new Uint8Array(count);
    const crease = new Uint8Array(count);
    const CREASE_DOT = Math.cos(THREE.MathUtils.degToRad(32));
    const DEPTH_STEP = 0.18;
    for (let y = 0; y < hiHeight; y += 1) {
      for (let x = 0; x < hiWidth; x += 1) {
        const index = (y * hiWidth) + x;
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          if (x + dx >= hiWidth || y + dy >= hiHeight) continue;
          const other = index + dx + (dy * hiWidth);
          if (inside[index] !== inside[other]) {
            contour[inside[index] ? index : other] = 1;
          } else if (inside[index]) {
            const dot = (normal[index * 3] * normal[other * 3])
              + (normal[(index * 3) + 1] * normal[(other * 3) + 1])
              + (normal[(index * 3) + 2] * normal[(other * 3) + 2]);
            if (dot < CREASE_DOT || Math.abs(depth[index] - depth[other]) > DEPTH_STEP) {
              crease[depth[index] > depth[other] ? index : other] = 1;
            }
          }
        }
      }
    }
    // Thicken: a bold contour and finer inner lines, as round pens.
    const ink = new Uint8Array(count);
    const stamp = (mask, radius) => {
      const offsets = [];
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if ((dx * dx) + (dy * dy) <= radius * radius) offsets.push([dx, dy]);
        }
      }
      for (let y = 0; y < hiHeight; y += 1) {
        for (let x = 0; x < hiWidth; x += 1) {
          if (!mask[(y * hiWidth) + x]) continue;
          for (const [dx, dy] of offsets) {
            const px = x + dx;
            const py = y + dy;
            if (px >= 0 && py >= 0 && px < hiWidth && py < hiHeight) ink[(py * hiWidth) + px] = 1;
          }
        }
      }
    };
    stamp(contour, 5);
    stamp(crease, 2);
    const canvas = document.createElement('canvas');
    canvas.width = hiWidth;
    canvas.height = hiHeight;
    const context = canvas.getContext('2d');
    const image = context.createImageData(hiWidth, hiHeight);
    for (let index = 0; index < count; index += 1) {
      if (!ink[index]) continue;
      image.data[index * 4] = INK[0];
      image.data[(index * 4) + 1] = INK[1];
      image.data[(index * 4) + 2] = INK[2];
      image.data[(index * 4) + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  const results = {};
  for (const carId of carIds) {
    const colour = await factory(carId, true);
    stage.add(colour);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    const still = downscaleStill(renderer.domElement).toDataURL('image/webp', 0.9);
    stage.remove(colour);
    disposeCarVisual(colour);

    const bare = await factory(carId, false);
    stage.add(bare);
    const normals = readPass(normalMaterial);
    const depths = readPass(depthMaterial);
    stage.remove(bare);
    disposeCarVisual(bare);
    const outline = downscaleStill(lineDrawing(normals, depths)).toDataURL('image/webp', 0.9);
    results[carId] = { still, outline };
  }
  target.dispose();
  renderer.dispose();
  return { results, frame };
}

async function renderAll() {
  const { chromium } = await import('playwright');
  const { CAR_CATALOG } = await import(pathToFileURL(path.join(turnRoot, 'vehicle/catalog.js')).href);
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/__car-stills__.html') {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end(PAGE);
        return;
      }
      const filename = path.resolve(repoRoot, `.${pathname}`);
      if (!filename.startsWith(repoRoot)) throw new Error('Outside the repository');
      const body = await fs.readFile(filename);
      response.writeHead(200, { 'content-type': TYPES[path.extname(filename)] || 'application/octet-stream' });
      response.end(body);
    } catch (_) {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (error) => console.error('render-car-stills:', error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/__car-stills__.html`);
    const carIds = CAR_CATALOG.map((car) => car.id);
    const { results, frame } = await page.evaluate(renderInPage, { carIds });
    await fs.mkdir(STILLS_DIRECTORY, { recursive: true });
    for (const carId of carIds) {
      for (const [kind, suffix] of [['still', ''], ['outline', '-outline']]) {
        const data = results[carId][kind].replace(/^data:image\/webp;base64,/, '');
        await fs.writeFile(path.join(STILLS_DIRECTORY, `${carId}${suffix}.webp`), Buffer.from(data, 'base64'));
      }
    }
    const manifest = {
      width: STILL_WIDTH,
      height: STILL_HEIGHT,
      view: 'garage/car-view.js',
      frame,
      renderer: await rendererSources(),
      cars: await expectedManifestCars()
    };
    await fs.writeFile(STILLS_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Rendered ${carIds.length} cars into ${path.relative(repoRoot, STILLS_DIRECTORY)}.`);
  } finally {
    await browser.close();
    server.close();
  }
}

export async function checkStills() {
  const manifest = JSON.parse(await fs.readFile(STILLS_MANIFEST, 'utf8'));
  const expected = await expectedManifestCars();
  const problems = [];
  const frame = manifest.frame;
  if (!frame || !['fullWidth', 'fullHeight', 'x', 'y', 'width', 'height'].every((key) => Number.isFinite(frame[key]))) {
    problems.push('manifest.json: no shared frame for runtime repaints');
  } else if (Math.abs((frame.width / frame.height) - (STILL_WIDTH / STILL_HEIGHT)) > 0.01) {
    problems.push('manifest.json: the frame does not match the card shape');
  }
  if (manifest.width !== STILL_WIDTH || manifest.height !== STILL_HEIGHT) problems.push('manifest.json: not the card size');
  const renderer = await rendererSources();
  for (const [file, hash] of Object.entries(renderer)) {
    if (manifest.renderer?.[file] !== hash) problems.push(`${file}: changed since the stills were rendered`);
  }
  for (const file of Object.keys(manifest.renderer || {})) {
    if (!renderer[file]) problems.push(`${file}: no longer renders the stills`);
  }
  for (const [carId, { sources }] of Object.entries(expected)) {
    const recorded = manifest.cars?.[carId]?.sources;
    if (!recorded) problems.push(`${carId}: no still`);
    else if (JSON.stringify(recorded) !== JSON.stringify(sources)) problems.push(`${carId}: its model changed since the still was rendered`);
    for (const suffix of ['', '-outline']) {
      try {
        await fs.access(path.join(STILLS_DIRECTORY, `${carId}${suffix}.webp`));
      } catch (_) {
        problems.push(`${carId}: missing ${carId}${suffix}.webp`);
      }
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (process.argv.includes('--check')) {
    const problems = await checkStills();
    if (problems.length) {
      console.error(`Car stills are out of date; run node turn/scripts/render-car-stills.mjs\n${problems.join('\n')}`);
      process.exitCode = 1;
    } else {
      console.log('Car stills match every catalog car.');
    }
  } else {
    await renderAll();
  }
}
