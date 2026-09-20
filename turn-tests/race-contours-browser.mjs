import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

export async function inspectRaceContours(page, outputDir, browser, expectClean = false) {
  const reports = await page.evaluate(async () => {
    const THREE = await import('three');
    const { activateTrack } = await import('/turn/tracks/track-manager.js');
    const runtime = globalThis.__turnRuntime;
    const { renderer, camera, scene, playerCar: car, state, carShadows } = runtime;
    const results = [];
    function isContour(node) {
      if (!node.isMesh) return false;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      return node.userData.turnOutline || node.userData.turnContextualRoadContour
        || materials.some((m) => m?.side === THREE.BackSide);
    }
    for (const trackId of ['countryside', 'airport', 'cliffside', 'harbor', 'midnight-city', 'mountain']) {
      await activateTrack(trackId, runtime);
      await new Promise((resolve) => setTimeout(resolve, 4000));
      state.running = false;
      const shells = [];
      scene.traverse((node) => { if (isContour(node)) shells.push(node); });
      const frames = [];
      for (const fraction of [0, 0.25, 0.5, 0.75]) {
        const sample = runtime.samples[Math.floor(runtime.samples.length * fraction)];
        car.position.copy(sample.point); car.position.y += 0.18;
        state.position.copy(car.position);
        car.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z) + Math.PI, 0);
        camera.position.copy(car.position).addScaledVector(sample.tangent, -18); camera.position.y += 9;
        camera.lookAt(car.position.x + sample.tangent.x * 8, car.position.y + 1, car.position.z + sample.tangent.z * 8);
        carShadows.beginFrame(trackId); carShadows.addCar(car, sample); carShadows.endFrame();
        renderer.render(scene, camera);
        const withContours = { ...renderer.info.render };
        const visible = shells.map((node) => node.visible);
        shells.forEach((node) => { node.visible = false; });
        renderer.render(scene, camera);
        const withoutContours = { ...renderer.info.render };
        shells.forEach((node, i) => { node.visible = visible[i]; });
        frames.push({ fraction, withContours, withoutContours });
      }
      renderer.render(scene, camera);
      results.push({ trackId, contourMeshes: shells.length,
        names: shells.slice(0, 10).map((node) => node.name || node.parent?.name || node.type),
        frames, image: renderer.domElement.toDataURL() });
    }
    await activateTrack('countryside', runtime);
    return results;
  });
  for (const report of reports) {
    await fs.writeFile(`${outputDir}/contours-${browser}-${report.trackId}.png`, Buffer.from(report.image.split(',')[1], 'base64'));
    delete report.image;
    if (expectClean) assert.equal(report.contourMeshes, 0, `${report.trackId}: racing must not allocate contour shells`);
  }
  await fs.writeFile(`${outputDir}/contours-${browser}.json`, JSON.stringify(reports, null, 2));
  console.log(JSON.stringify({ browser, contours: reports }));
}
