import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const TARGET = process.env.TURN_LOW_GRAPHICS_URL || 'http://127.0.0.1:8000/turn/';

for (const browserType of [chromium, webkit]) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('turn-low-graphics-v1', '1');
  });
  const page = await context.newPage();
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    const THREE = await import('three');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(2);

    const light = new THREE.PointLight(0xffffff, 4, 20, 2);

    const output = {
      lowGraphics: globalThis.__turnGraphicsProfile?.lowGraphics,
      antialias: renderer.getContext().getContextAttributes()?.antialias,
      pixelRatio: renderer.getPixelRatio(),
      shadows: renderer.shadowMap.enabled,
      pointLightVisible: light.visible,
      pointLightIntensity: light.intensity
    };

    renderer.dispose();
    renderer.forceContextLoss?.();
    return output;
  });

  assert.equal(result.lowGraphics, true, `${browserType.name()} loaded the saved LOW GRAPHICS profile.`);
  assert.equal(result.antialias, true, `${browserType.name()} keeps WebGL antialiasing enabled.`);
  assert.ok(result.pixelRatio <= 1, `${browserType.name()} caps renderer DPR at 1.0.`);
  assert.equal(result.shadows, false, `${browserType.name()} keeps shadow rendering disabled.`);
  assert.equal(result.pointLightVisible, false, `${browserType.name()} removes real PointLights from rendering.`);
  assert.equal(result.pointLightIntensity, 0, `${browserType.name()} removes PointLight illumination.`);

  await context.close();
  await browser.close();
}

console.log('LOW GRAPHICS browser WebGL smoke passed in Chromium and WebKit.');

// The same production shadow module is rendered on touch-sized WebKit/Chromium
// surfaces. These are software-browser comparisons, not physical device timings.
const fixtureImportMap = (await fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'))
  .match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const outputDir = 'supercar-lot-visual-artifact';
await fs.mkdir(outputDir, { recursive: true });
for (const browserType of [chromium, webkit]) {
  const browser = await browserType.launch({ headless: true,
    ...(browserType === chromium ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] } : {}) });
  for (const device of [
    { name: 'iphone', width: 852, height: 393, dpr: 3, low: false },
    { name: 'ipad', width: 1080, height: 810, dpr: 2, low: false },
    { name: 'ipad-low', width: 1080, height: 810, dpr: 2, low: true }
  ]) {
    const context = await browser.newContext({ viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.dpr, hasTouch: true });
    await context.addInitScript((low) => localStorage.setItem('turn-low-graphics-v1', low ? '1' : '0'), device.low);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/shadow-validation.html', (route) => route.fulfill({ contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8">${fixtureImportMap}<style>body{margin:0;background:#eee}canvas{display:block}</style>` }));
    await page.goto(new URL('shadow-validation.html', TARGET).href);
    for (const terrain of ['flat', 'steep', 'banked-crest']) {
      const report = await page.evaluate(async ({ terrain, width, height, low }) => {
        const THREE = await import('three');
        const { createCarShadows } = await import('/turn/render/car-shadows.js');
        const { createCarVisual, disposeCarVisual } = await import('/turn/vehicle/car-models.js');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xdce8ed);
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        // Three resets info after the shadow pass by default; count the whole frame.
        renderer.info.autoReset = false;
        renderer.setSize(width, height);
        renderer.setPixelRatio(low ? 1 : 1.25);
        document.body.replaceChildren(renderer.domElement);
        const sun = new THREE.DirectionalLight(0xfff1c1, 4.3);
        sun.position.set(-90, 150, 70);
        scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x5b3a29, 2.7));
        const samples = Array.from({ length: 120 }, (_, i) => {
          const z = i - 60;
          const y = terrain === 'flat' ? 0 : terrain === 'steep' ? z * 0.55 : 6 * Math.cos(z * 0.07);
          const slope = terrain === 'flat' ? 0 : terrain === 'steep' ? 0.55 : -0.42 * Math.sin(z * 0.07);
          const bank = terrain === 'banked-crest' ? 0.25 * Math.sin(z * 0.05 + 1) : 0;
          return { point: new THREE.Vector3(terrain === 'banked-crest' ? 4 * Math.sin(z * 0.04) : 0, y, z),
            tangent: new THREE.Vector3(terrain === 'banked-crest' ? 0.16 * Math.cos(z * 0.04) : 0, slope, 1).normalize(),
            normal: new THREE.Vector3(-1, -bank, 0) };
        });
        const positions = [], indices = [];
        for (const sample of samples) {
          for (const side of [1, -1]) {
            const point = sample.point.clone().addScaledVector(sample.normal, side * 13.5);
            positions.push(point.x, point.y + 0.13, point.z);
          }
        }
        for (let i = 0; i < samples.length - 1; i++) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        const roadGeometry = new THREE.BufferGeometry();
        roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        roadGeometry.setIndex(indices);
        roadGeometry.computeVertexNormals();
        const road = new THREE.Mesh(roadGeometry, new THREE.MeshStandardMaterial({ color: 0x777777, side: THREE.DoubleSide }));
        scene.add(road);
        const shadows = createCarShadows({ scene, sun, samples, trackWidth: 27 });
        function placeCar(car, sample, side, heading) {
          car.position.copy(sample.point).addScaledVector(sample.normal, side * 3);
          car.position.y += 0.18;
          const up = new THREE.Vector3().crossVectors(sample.normal, sample.tangent).normalize();
          if (up.y < 0) up.negate();
          const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)).projectOnPlane(up).normalize();
          const right = new THREE.Vector3().crossVectors(up, forward).normalize();
          car.rotation.order = 'YXZ';
          car.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward));
        }
        const cars = [];
        for (let i = 0; i < 5; i++) {
          const car = new THREE.Group();
          const visual = await createCarVisual({ carId: 'sedan', color: i ? '#38d9ff' : '#ffd43b', ghost: i > 0, targetLength: 5.5 });
          shadows.setCarSize(car, visual); // Match production: measure before parenting/posing.
          const size = new THREE.Box3().setFromObject(visual).getSize(new THREE.Vector3());
          car.add(visual);
          const sample = samples[48 + i * 6];
          const heading = terrain === 'flat' ? [Math.PI, Math.PI / 2, 0, -Math.PI / 2, Math.PI / 4][i]
            : Math.PI + (terrain === 'banked-crest' ? 0.45 : 0);
          placeCar(car, sample, i % 2 ? -1 : 1, heading);
          scene.add(car);
          cars.push({ car, visual, sample, size });
        }
        const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 900);
        const centerY = terrain === 'banked-crest' ? 6 : 0;
        camera.position.set(18, centerY + 22, 31);
        camera.lookAt(0, centerY, 0);
        // Reproduce the former 512px touch path in the fixture only.
        renderer.shadowMap.enabled = !low;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        sun.castShadow = !low;
        sun.shadow.mapSize.set(512, 512);
        Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100 });
        road.receiveShadow = true;
        cars[0].car.traverse((node) => { if (node.isMesh) node.castShadow = true; });
        renderer.info.reset();
        renderer.render(scene, camera);
        const legacy = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures };
        renderer.shadowMap.enabled = false;
        sun.castShadow = false;
        road.receiveShadow = false;
        cars[0].car.traverse((node) => { if (node.isMesh) node.castShadow = false; });
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        shadows.beginFrame('countryside');
        for (const { car, sample } of cars) shadows.addCar(car, sample);
        shadows.endFrame();
        renderer.info.reset();
        renderer.render(scene, camera);
        const current = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures };
        const geometryCount = renderer.info.memory.geometries;
        const batch = shadows.mesh;
        for (let restart = 0; restart < 5; restart++) {
          shadows.beginFrame('countryside');
          shadows.endFrame();
          if (batch.count !== 0) throw new Error('Stale shadows after restart');
          shadows.beginFrame('countryside');
          for (const { car, sample } of cars) shadows.addCar(car, sample);
          shadows.endFrame();
          renderer.render(scene, camera);
          if (shadows.mesh !== batch || renderer.info.memory.geometries !== geometryCount) throw new Error('Restart allocated shadow resources');
        }
        const gl = renderer.getContext();
        const pixels = new Uint8Array(renderer.domElement.width * renderer.domElement.height * 4);
        const without = new Uint8Array(pixels.length);
        function visibleShadowPixels(view = camera) {
          batch.visible = true;
          renderer.render(scene, view);
          gl.readPixels(0, 0, renderer.domElement.width, renderer.domElement.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          batch.visible = false;
          renderer.info.reset();
          renderer.render(scene, view);
          gl.readPixels(0, 0, renderer.domElement.width, renderer.domElement.height, gl.RGBA, gl.UNSIGNED_BYTE, without);
          let darkened = 0;
          for (let i = 0; i < pixels.length; i += 4) if (without[i] - pixels[i] > 4) darkened++;
          batch.visible = true;
          return darkened;
        }
        const darkenedPixels = visibleShadowPixels();
        const shadowDrawCalls = current.calls - renderer.info.render.calls;
        const cameraStart = camera.position.clone();
        const poses = cars.map(({ car }) => ({ position: car.position.clone(), rotation: car.rotation.clone() }));
        let minimumMovingShadowPixels = Infinity;
        for (let frame = 0; frame < 12; frame++) {
          // Large progress jumps and alternating drift heading while the camera orbits.
          const first = 20 + (frame * 13) % 65;
          shadows.beginFrame('countryside');
          for (let i = 0; i < cars.length; i++) {
            const sample = samples[first + i * 6];
            const car = cars[i].car;
            placeCar(car, sample, i % 2 ? -1 : 1, Math.PI + Math.sin(frame) * 1.2);
            shadows.addCar(car, sample);
          }
          shadows.endFrame();
          const target = samples[first + 12].point;
          camera.position.set(target.x + 18 + Math.sin(frame) * 8, target.y + 22, target.z + 31);
          camera.lookAt(target);
          minimumMovingShadowPixels = Math.min(minimumMovingShadowPixels, visibleShadowPixels());
          if (shadows.mesh !== batch || renderer.info.memory.geometries !== geometryCount) throw new Error('Movement allocated shadow resources');
        }
        const directionalFootprints = [];
        if (terrain === 'flat') {
          const cast = sun.target.position.clone().sub(sun.position).setY(0).normalize();
          const screenRight = new THREE.Vector3().crossVectors(cast, new THREE.Vector3(0, 1, 0));
          const extent = 8, aspect = width / height;
          const topView = new THREE.OrthographicCamera(-extent * aspect, extent * aspect, extent, -extent, 0.1, 100);
          topView.up.copy(cast);
          topView.position.set(0, 30, 0);
          topView.lookAt(0, 0.13, 0);
          const { car, size } = cars[0];
          for (const heading of [0, Math.PI / 4, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            placeCar(car, samples[60], 0, heading);
            car.visible = true;
            shadows.beginFrame('countryside');
            shadows.addCar(car, samples[60]);
            shadows.endFrame();
            // Isolate the directional mask, using the actual shader and geometry.
            const origin = batch.geometry.getAttribute('shadowOrigin');
            for (let i = 0; i < batch.count; i++) if (origin.getW(i) === 1) origin.setZ(i, 0);
            origin.needsUpdate = true;
            for (const entry of cars) entry.car.visible = false;
            visibleShadowPixels(topView);
            let total = 0, castPixels = 0, sunFacingOutsidePixels = 0, rootSpan = 0, farSpan = 0;
            const pixelWidth = renderer.domElement.width, pixelHeight = renderer.domElement.height;
            for (let y = 0; y < pixelHeight; y++) {
              const along = ((y + 0.5) / pixelHeight * 2 - 1) * extent;
              let rowPixels = 0;
              for (let x = 0; x < pixelWidth; x++) {
                const pixel = (y * pixelWidth + x) * 4;
                if (without[pixel] - pixels[pixel] <= 4) continue;
                total++; rowPixels++;
                if (along >= 0) castPixels++;
                const across = ((x + 0.5) / pixelWidth * 2 - 1) * extent * aspect;
                const dx = cast.x * along + screenRight.x * across;
                const dz = cast.z * along + screenRight.z * across;
                const carX = Math.cos(heading) * dx - Math.sin(heading) * dz;
                const carZ = Math.sin(heading) * dx + Math.cos(heading) * dz;
                if (along < 0 && (Math.abs(carX) > size.x / 2 || Math.abs(carZ) > size.z / 2)) sunFacingOutsidePixels++;
              }
              if (Math.abs(along) < 0.2) rootSpan = Math.max(rootSpan, rowPixels);
              if (along > 1 && along < 2.5) farSpan = Math.max(farSpan, rowPixels);
            }
            directionalFootprints.push({ heading, sunFacingOutsidePixels, castAreaFraction: castPixels / total, rootSpan, farSpan });
          }
          for (const entry of cars) entry.car.visible = true;
        }
        shadows.beginFrame('countryside');
        for (let i = 0; i < cars.length; i++) {
          cars[i].car.position.copy(poses[i].position);
          cars[i].car.rotation.copy(poses[i].rotation);
          shadows.addCar(cars[i].car, cars[i].sample);
        }
        shadows.endFrame();
        camera.position.copy(cameraStart);
        camera.lookAt(0, centerY, 0);
        renderer.render(scene, camera);
        // Canvas retains the final inspection frame after resource cleanup.
        shadows.dispose(); shadows.dispose();
        renderer.renderLists.dispose();
        const shadowGeometriesDisposed = renderer.info.memory.geometries === geometryCount - 1;
        for (const { visual } of cars) disposeCarVisual(visual);
        roadGeometry.dispose(); road.material.dispose(); renderer.dispose();
        return { terrain, legacy, current, darkenedPixels, shadowGeometriesDisposed, shadowDrawCalls, minimumMovingShadowPixels, directionalFootprints };
      }, { terrain, ...device });
      await page.screenshot({ path: `${outputDir}/shadows-${browserType.name()}-${device.name}-${terrain}.png` });
      console.log(JSON.stringify({ browser: browserType.name(), device: device.name, ...report }));
      await fs.writeFile(`${outputDir}/shadows-${browserType.name()}-${device.name}-${terrain}.json`, JSON.stringify(report, null, 2));
      assert.ok(report.darkenedPixels > 80, `${browserType.name()} ${device.name} ${terrain}: visible road shadows`);
      if (device.low) {
        assert.equal(report.current.calls, report.legacy.calls + 1, 'LOW gains grounding at one shared draw call');
        assert.equal(report.current.textures, report.legacy.textures, 'Projected shadows allocate no textures');
      } else {
        assert.ok(report.current.calls < report.legacy.calls, 'Projected shadows remove legacy shadow-pass draw calls');
        assert.ok(report.current.textures < report.legacy.textures, 'No shadow-map texture remains');
      }
      assert.ok(report.minimumMovingShadowPixels > 80, 'Shadows stay visible during high speed, drifting and camera movement');
      assert.equal(report.shadowDrawCalls, 1, 'All five cars and both layers share one draw call');
      for (const footprint of report.directionalFootprints) {
        assert.equal(footprint.sunFacingOutsidePixels, 0, 'The cast shadow starts inside the chassis on the sun-facing side');
        assert.ok(footprint.castAreaFraction > 0.95, 'Almost all directional area extends away from the light');
        assert.ok(footprint.farSpan > footprint.rootSpan * 1.7, 'The cast footprint widens from a narrow root');
      }
      assert.equal(report.shadowGeometriesDisposed, true);
      assert.deepEqual(errors, [], 'No shader, WebGL or model errors');
    }
    await context.close();
  }
  await browser.close();
}
