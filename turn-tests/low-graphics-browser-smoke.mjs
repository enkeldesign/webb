import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const TARGET = process.env.TURN_LOW_GRAPHICS_URL || 'http://127.0.0.1:8000/turn/';

// Inspect rendered coverage, not the shader formula. A row of overlapping blobs
// can look connected at its faint edge but split into islands at higher opacity.
function inspectShadowCoverage(pixels, without, width, height, thresholds = [4, 10]) {
  const count = width * height, queue = new Int32Array(count);
  return thresholds.map((threshold) => {
    const mask = new Uint8Array(count);
    let total = 0, largest = 0, components = 0, interiorGaps = 0;
    for (let i = 0; i < count; i++) if (without[i * 4] - pixels[i * 4] > threshold) { mask[i] = 1; total++; }
    for (let y = 0; y < height; y++) {
      let first = -1, last = -1, filled = 0;
      for (let x = 0; x < width; x++) if (mask[y * width + x]) {
        if (first < 0) first = x;
        last = x; filled++;
      }
      if (first >= 0) interiorGaps += last - first + 1 - filled;
    }
    for (let start = 0; start < count; start++) {
      if (!mask[start]) continue;
      let head = 0, tail = 1;
      queue[0] = start; mask[start] = 0;
      while (head < tail) {
        const i = queue[head++], x = i % width;
        for (const next of [x ? i - 1 : -1, x + 1 < width ? i + 1 : -1, i - width, i + width]) {
          if (next >= 0 && next < count && mask[next]) { mask[next] = 0; queue[tail++] = next; }
        }
      }
      if (tail > 3) components++;
      largest = Math.max(largest, tail);
    }
    return { threshold, components, pixels: total, connectedFraction: total ? largest / total : 0,
      interiorGapFraction: total ? interiorGaps / total : 0 };
  });
}

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
    await page.addScriptTag({ content: `window.inspectShadowCoverage = ${inspectShadowCoverage};` });
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
        const directionalFootprints = [], inspectionFrames = [], contactCoverage = [];
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
            let widestRow = -1, tipAlong = 0;
            const pixelWidth = renderer.domElement.width, pixelHeight = renderer.domElement.height;
            for (let y = 0; y < pixelHeight; y++) {
              const along = ((y + 0.5) / pixelHeight * 2 - 1) * extent;
              let rowPixels = 0;
              for (let x = 0; x < pixelWidth; x++) {
                const pixel = (y * pixelWidth + x) * 4;
                if (without[pixel] - pixels[pixel] <= 4) continue;
                total++; rowPixels++;
                if (along >= 0) { castPixels++; tipAlong = Math.max(tipAlong, along); }
                const across = ((x + 0.5) / pixelWidth * 2 - 1) * extent * aspect;
                const dx = cast.x * along + screenRight.x * across;
                const dz = cast.z * along + screenRight.z * across;
                const carX = Math.cos(heading) * dx - Math.sin(heading) * dz;
                const carZ = Math.sin(heading) * dx + Math.cos(heading) * dz;
                if (along < 0 && (Math.abs(carX) > size.x / 2 || Math.abs(carZ) > size.z / 2)) sunFacingOutsidePixels++;
              }
              if (Math.abs(along) < 0.2) rootSpan = Math.max(rootSpan, rowPixels);
              if (along > 1 && along < 2.5 && rowPixels > farSpan) { farSpan = rowPixels; widestRow = y; }
            }
            let peak = 0, softWidth = 0, coreWidth = 0;
            for (let x = 0; x < pixelWidth; x++) {
              const pixel = (widestRow * pixelWidth + x) * 4;
              peak = Math.max(peak, without[pixel] - pixels[pixel]);
            }
            for (let x = 0; x < pixelWidth; x++) {
              const pixel = (widestRow * pixelWidth + x) * 4;
              const darkness = without[pixel] - pixels[pixel];
              if (darkness > peak * 0.25) softWidth++;
              if (darkness > peak * 0.75) coreWidth++;
            }
            directionalFootprints.push({ heading, sunFacingOutsidePixels, castAreaFraction: castPixels / total,
              rootSpan, farSpan, visibleLength: tipAlong, carLength: size.z,
              edgeFadeFraction: (softWidth - coreWidth) / softWidth,
              coverage: window.inspectShadowCoverage(pixels, without, pixelWidth, pixelHeight) });
            if (heading === 0 && width === 1080 && !low) {
              renderer.render(scene, topView);
              inspectionFrames.push({ name: 'directional-mask', data: renderer.domElement.toDataURL() });
            }
          }
          for (const entry of cars) entry.car.visible = true;
          // A close, unobstructed contact mask must have no internal stripes or
          // holes, including at darker thresholds where precision cracks show.
          const sample = samples[60];
          placeCar(car, sample, 0, 0);
          shadows.beginFrame('countryside'); shadows.addCar(car, sample); shadows.endFrame();
          const origin = batch.geometry.getAttribute('shadowOrigin');
          for (let i = 0; i < batch.count; i++) if (origin.getW(i) < 0.5) origin.setZ(i, 0);
          origin.needsUpdate = true;
          for (const entry of cars) entry.car.visible = false;
          camera.position.set(4, 4, 8);
          camera.lookAt(0, 0.13, -2);
          visibleShadowPixels();
          let peak = 0;
          for (let i = 0; i < pixels.length; i += 4) peak = Math.max(peak, without[i] - pixels[i]);
          contactCoverage.push(...window.inspectShadowCoverage(pixels, without,
            renderer.domElement.width, renderer.domElement.height, [peak * 0.4, peak * 0.7]));
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
        if (width === 1080 && !low) {
          const target = cars[0].car.position;
          camera.position.set(target.x + 4, target.y + 4, target.z + 8);
          camera.lookAt(target.x, target.y, target.z - 2);
          renderer.render(scene, camera);
          inspectionFrames.push({ name: 'close', data: renderer.domElement.toDataURL() });
          camera.position.copy(cameraStart);
          camera.lookAt(0, centerY, 0);
          renderer.render(scene, camera);
        }
        // Canvas retains the final inspection frame after resource cleanup.
        shadows.dispose(); shadows.dispose();
        renderer.renderLists.dispose();
        const shadowGeometriesDisposed = renderer.info.memory.geometries === geometryCount - 1;
        for (const { visual } of cars) disposeCarVisual(visual);
        roadGeometry.dispose(); road.material.dispose(); renderer.dispose();
        return { terrain, legacy, current, darkenedPixels, shadowGeometriesDisposed, shadowDrawCalls, minimumMovingShadowPixels,
          directionalFootprints, contactCoverage, inspectionFrames };
      }, { terrain, ...device });
      for (const frame of report.inspectionFrames) {
        await fs.writeFile(`${outputDir}/shadows-${browserType.name()}-${device.name}-${terrain}-${frame.name}.png`,
          Buffer.from(frame.data.split(',')[1], 'base64'));
      }
      delete report.inspectionFrames;
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
        assert.ok(footprint.visibleLength > footprint.carLength * 0.6, 'Softening retains useful cast length');
        assert.ok(footprint.edgeFadeFraction > 0.22, 'The directional body has a broad soft edge, not a hard plateau');
        for (const coverage of footprint.coverage) {
          assert.equal(coverage.components, 1, 'Directional coverage stays a single connected shape at faint and darker levels');
          assert.ok(coverage.connectedFraction > 0.995, 'No separate visible shadow blobs');
        }
      }
      for (const coverage of report.contactCoverage) {
        assert.ok(coverage.pixels > 80, 'The tight dark contact shadow remains visible');
        assert.ok(coverage.interiorGapFraction < 0.001, 'The close contact shadow has no internal stripes or pinholes');
      }
      assert.equal(report.shadowGeometriesDisposed, true);
      assert.deepEqual(errors, [], 'No shader, WebGL or model errors');
    }
    await context.close();
  }
  // Inspect the real Countryside road, overlays, car and race camera as well as
  // the isolated surfaces above. Keep paired frames so authored road patches
  // cannot be mistaken for projected-shadow geometry during visual review.
  const liveContext = await browser.newContext({ viewport: { width: 1080, height: 810 }, hasTouch: true });
  const livePage = await liveContext.newPage();
  await livePage.goto(TARGET, { waitUntil: 'domcontentloaded' });
  await livePage.locator('#playBrowserButton').click();
  await livePage.waitForFunction(() => {
    const runtime = globalThis.__turnRuntime;
    return runtime?.playerCar.userData.turnVisualKey
      && runtime.world.children.some((node) => node.geometry?.parameters?.height === 0.018 && node.position.y === 0.174);
  }, null, { timeout: 90000 });
  await livePage.addScriptTag({ content: `window.inspectShadowCoverage = ${inspectShadowCoverage};` });
  const liveReport = await livePage.evaluate(async () => {
    const { updateRaceCameraState } = await import('/turn/render/camera.js');
    const runtime = globalThis.__turnRuntime;
    const { renderer, scene, camera, state, samples, playerCar: car, carShadows: shadows } = runtime;
    renderer.setAnimationLoop(null);
    renderer.setPixelRatio(1);
    renderer.setSize(1080, 810);
    camera.aspect = 1080 / 810;
    camera.updateProjectionMatrix();
    const gl = renderer.getContext(), width = renderer.domElement.width, height = renderer.domElement.height;
    const pixels = new Uint8Array(width * height * 4), without = new Uint8Array(pixels.length);
    const frames = [];
    const cases = [
      { name: 'road-wear', index: 38, speed: 0 },
      { name: 'close', index: 38, speed: 0, close: true },
      { name: 'drift', index: 160, speed: 65, drift: 0.6 },
      { name: 'lap-end', index: samples.length - 4, speed: 65 },
      { name: 'lap-start', index: 4, speed: 65 }
    ];
    for (const pose of cases) {
      const sample = samples[pose.index];
      car.visible = true;
      car.position.copy(sample.point).addScaledVector(sample.normal, 3);
      car.position.y += 0.18;
      state.heading = Math.atan2(sample.tangent.x, sample.tangent.z) + (pose.drift || 0);
      car.rotation.set(0, state.heading + Math.PI, 0);
      state.position.copy(car.position);
      state.speed = pose.speed;
      state.velocity.copy(sample.tangent).multiplyScalar(pose.speed);
      state.nearestTrackIndex = pose.index;
      for (let i = 0; i < 90; i++) updateRaceCameraState({ ...runtime, dt: 1 / 60 });
      if (pose.close) {
        camera.position.copy(car.position).addScaledVector(sample.tangent, -8);
        camera.position.y += 4;
        camera.lookAt(car.position.x + sample.tangent.x * 2, car.position.y, car.position.z + sample.tangent.z * 2);
      }
      shadows.beginFrame('countryside'); shadows.addCar(car, sample); shadows.endFrame();
      renderer.render(scene, camera);
      const withShadow = renderer.domElement.toDataURL();
      shadows.mesh.visible = false;
      renderer.render(scene, camera);
      const withoutShadow = renderer.domElement.toDataURL();
      shadows.mesh.visible = true;
      car.visible = false;
      const origins = shadows.mesh.geometry.getAttribute('shadowOrigin');
      for (let i = 0; i < shadows.mesh.count; i++) if (origins.getW(i) === 1) origins.setZ(i, 0);
      origins.needsUpdate = true;
      renderer.render(scene, camera);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      shadows.mesh.visible = false;
      renderer.render(scene, camera);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, without);
      frames.push({ name: pose.name, withShadow, withoutShadow,
        coverage: window.inspectShadowCoverage(pixels, without, width, height) });
    }
    return frames;
  });
  for (const frame of liveReport) {
    for (const key of ['withShadow', 'withoutShadow']) {
      await fs.writeFile(`${outputDir}/shadows-${browserType.name()}-production-${frame.name}-${key}.png`,
        Buffer.from(frame[key].split(',')[1], 'base64'));
      delete frame[key];
    }
    assert.ok(frame.coverage[0].pixels > 40, `Production ${frame.name} retains a visible directional shadow`);
  }
  await fs.writeFile(`${outputDir}/shadows-${browserType.name()}-production.json`, JSON.stringify(liveReport, null, 2));
  console.log(JSON.stringify({ browser: browserType.name(), production: liveReport }));
  const skidReport = await livePage.evaluate(async () => {
    const THREE = await import('three');
    const { createCarVisual, disposeCarVisual } = await import('/turn/vehicle/car-models.js');
    const { CAR_CATALOG } = await import('/turn/vehicle/catalog.js');
    const runtime = globalThis.__turnRuntime;
    const { scene, renderer, camera, playerCar: car, state, samples, carShadows: shadows } = runtime;
    const skids = globalThis.__turnSkidContinuity;
    if (!skids) throw new Error('The production skid renderer must be installed');
    const gl = renderer.getContext(), uploaded = new Float32Array(12), wheel = new THREE.Vector3();
    const sample = samples[160];
    let gpuError = 0, wheelGap = 0, wheelShift = 0, uploads = 0;
    let rearCentres = [];
    const previousAfterRender = skids.line.onAfterRender;
    skids.line.onAfterRender = () => {
      if (skids.line.geometry.drawRange.count < 4) return;
      // Read the buffer actually consumed by this draw, not just its CPU array.
      const program = gl.getParameter(gl.CURRENT_PROGRAM);
      const location = gl.getAttribLocation(program, 'position');
      const buffer = gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
      const previousBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.getBufferSubData(gl.ARRAY_BUFFER, 0, uploaded);
      gl.bindBuffer(gl.ARRAY_BUFFER, previousBuffer);
      const cpu = skids.line.geometry.attributes.position.array;
      for (let i = 0; i < uploaded.length; i++) gpuError = Math.max(gpuError, Math.abs(uploaded[i] - cpu[i]));
      for (const offset of [0, 6]) {
        let gap = Infinity, originGap = Infinity;
        for (const { node, centre, spinner } of rearCentres) {
          wheel.copy(centre).applyMatrix4(node.matrixWorld);
          gap = Math.min(gap, Math.hypot(uploaded[offset] - wheel.x, uploaded[offset + 2] - wheel.z));
          wheel.setFromMatrixPosition(spinner.matrixWorld);
          originGap = Math.min(originGap, Math.hypot(uploaded[offset] - wheel.x, uploaded[offset + 2] - wheel.z));
        }
        wheelGap = Math.max(wheelGap, gap);
        wheelShift = Math.max(wheelShift, originGap);
      }
      uploads++;
    };
    for (const child of car.children) child.visible = false;
    state.running = true; state.driftAmount = 0.8; state.speed = 70; state.nearestTrackIndex = 160;
    const results = [];
    for (const [carId, offRoad] of [...CAR_CATALOG.map(({ id }) => [id, false]), ['monster-truck', true]]) {
      const visual = await createCarVisual({ carId, color: '#d9ae38', targetLength: 5.5, outline: true });
      shadows.setCarSize(car, visual);
      car.add(visual);
      car.visible = true;
      rearCentres = visual.userData.wheelSpinners.filter((spinner) => {
        for (let parent = spinner.parent; parent && parent !== visual; parent = parent.parent) {
          if (visual.userData.frontWheelPivots.includes(parent)) return false;
        }
        return true;
      }).map((spinner) => {
        if (carId === 'monster-truck' || carId === 'supercar') {
          return { node: spinner, centre: new THREE.Vector3(), spinner };
        }
        // Independently measure the authored wheel mesh, not its mount or the
        // renderer's cached offset. Contour children are deliberately excluded.
        const node = spinner.children[0];
        node.geometry.computeBoundingBox();
        return { node, centre: node.geometry.boundingBox.getCenter(new THREE.Vector3()), spinner };
      });
      if (rearCentres.length !== 2) throw new Error(`${carId} must expose both rear tyres`);
      skids.clear();
      gpuError = 0; wheelGap = 0; wheelShift = 0; uploads = 0;
      for (let frame = 0; frame < 8; frame++) {
        car.position.copy(sample.point).addScaledVector(sample.normal, offRoad ? runtime.trackWidth * 0.68 : 3)
          .addScaledVector(sample.tangent, frame * 4);
        car.position.y = sample.point.y + 0.18;
        state.position.copy(car.position);
        state.heading = Math.atan2(sample.tangent.x, sample.tangent.z) + 0.4;
        car.rotation.set(0, state.heading + Math.PI, 0.04);
        runtime.animateWheels(car, 0.5, 70, 1 / 20);
        camera.position.copy(car.position).addScaledVector(sample.tangent, -14);
        camera.position.y += 8;
        camera.lookAt(car.position.x + sample.tangent.x * 5, car.position.y, car.position.z + sample.tangent.z * 5);
        shadows.beginFrame('countryside'); shadows.addCar(car, sample); shadows.endFrame();
        renderer.render(scene, camera);
      }
      results.push({ carId, offRoad, gpuError, wheelGap, wheelShift, uploads, image: renderer.domElement.toDataURL() });
      disposeCarVisual(visual);
    }
    skids.line.onAfterRender = previousAfterRender;
    state.running = false;
    renderer.render(scene, camera);
    if (skids.line.geometry.drawRange.count !== 0) throw new Error('Returning Home must clear skid geometry');
    return results;
  });
  for (const result of skidReport) {
    await fs.writeFile(`${outputDir}/skids-${browserType.name()}-${result.carId}-${result.offRoad ? 'grass' : 'road'}.png`,
      Buffer.from(result.image.split(',')[1], 'base64'));
    delete result.image;
    assert.equal(result.uploads, 7, 'Every moving frame after the first produces a connected skid');
    assert.equal(result.gpuError, 0, 'The GPU uses the current frame wheel positions, without a one-frame delay');
    assert.ok(result.wheelGap < 0.001, `${result.carId}: rendered skids meet the rear tyre centres`);
    if (['monster-truck', 'supercar', 'vintage-racer'].includes(result.carId)) {
      assert.ok(result.wheelShift < 0.001, `${result.carId}: already centred tracks keep their spacing`);
    } else {
      assert.ok(result.wheelShift > 0.1, `${result.carId}: tracks move out from the inner wheel origins`);
    }
  }
  await fs.writeFile(`${outputDir}/skids-${browserType.name()}.json`, JSON.stringify(skidReport, null, 2));
  console.log(JSON.stringify({ browser: browserType.name(), skids: skidReport }));
  await liveContext.close();
  await browser.close();
}
