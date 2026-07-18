(() => {
  const upstreamFetch = window.fetch.bind(window);
  const beautyModuleUrl = new URL('./world-beauty.js', location.href).href;

  window.fetch = async (input, init) => {
    const response = await upstreamFetch(input, init);

    try {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(rawUrl, location.href);
      if (!url.pathname.endsWith('/turn/game.js')) return response;

      let source = await response.text();

      const importLine = "import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';";
      const importReplacement = `${importLine}\nimport { installWorldBeauty } from '${beautyModuleUrl}';`;
      source = source.replace(importLine, importReplacement);

      const setupCall = `makeRoad();\nmakeScenery();`;
      const setupReplacement = `makeRoad();\nmakeScenery();\n\n// Small compatibility helper used by the decorative world pass.\nif (!THREE.Object3D.prototype.addScaledVector) {\n  THREE.Object3D.prototype.addScaledVector = function addScaledVector(vector, scalar) {\n    this.position.addScaledVector(vector, scalar);\n    return this;\n  };\n}\n\ninstallWorldBeauty({\n  world,\n  scene,\n  samples,\n  trackWidth: TRACK_WIDTH,\n  sun,\n  hemi\n}).catch((error) => {\n  console.warn('TURN: world beauty pass failed, keeping base world.', error);\n});`;
      source = source.replace(setupCall, setupReplacement);

      return new Response(source, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      console.warn('TURN world tuning failed, using upstream game source.', error);
      return response;
    }
  };
})();
