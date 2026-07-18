(() => {
  const upstreamFetch = window.fetch.bind(window);
  const artModuleUrl = new URL('./world-art-pass.js', location.href).href;

  window.fetch = async (input, init) => {
    const response = await upstreamFetch(input, init);

    try {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(rawUrl, location.href);
      if (!url.pathname.endsWith('/turn/game.js')) return response;

      let source = await response.text();
      const importLine = "import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';";
      source = source.replace(
        importLine,
        `${importLine}\nimport { installArtPass } from '${artModuleUrl}';`
      );

      const setupCall = `makeRoad();\nmakeScenery();`;
      source = source.replace(
        setupCall,
        `${setupCall}\n\ninstallArtPass({\n  world,\n  scene,\n  samples,\n  trackWidth: TRACK_WIDTH\n}).catch((error) => {\n  console.warn('TURN: bold surroundings art pass failed, keeping base world.', error);\n});`
      );

      return new Response(source, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      console.warn('TURN world art tuning failed, using upstream game source.', error);
      return response;
    }
  };
})();
