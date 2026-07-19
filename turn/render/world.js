import * as THREE from 'three';

const buildId = new URL(import.meta.url).searchParams.get('build');

function moduleUrl(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  if (buildId) url.searchParams.set('build', buildId);
  return url.href;
}

async function loadWorldModules() {
  const [beauty, art, identity, intensity] = await Promise.all([
    import(moduleUrl('../world-beauty.js')),
    import(moduleUrl('../world-art-pass.js')),
    import(moduleUrl('../track-identity.js')),
    import(moduleUrl('../section-intensity.js'))
  ]);

  return {
    installWorldBeauty: beauty.installWorldBeauty,
    installArtPass: art.installArtPass,
    installTrackIdentity: identity.installTrackIdentity,
    installSectionIntensity: intensity.installSectionIntensity
  };
}

function waitForRuntime() {
  if (globalThis.__turnRuntime) {
    install(globalThis.__turnRuntime);
    return;
  }

  window.addEventListener('turn:runtime-ready', (event) => {
    install(event.detail || globalThis.__turnRuntime);
  }, { once: true });
}

async function install(runtime) {
  if (!runtime || runtime.__worldModulesInstalled) return;
  runtime.__worldModulesInstalled = true;

  const {
    world,
    scene,
    samples,
    trackWidth,
    sun,
    hemi
  } = runtime;

  if (!world || !scene || !samples || !Number.isFinite(trackWidth)) {
    console.warn('TURN: world runtime bridge was incomplete; keeping the base world.');
    return;
  }

  try {
    const {
      installWorldBeauty,
      installArtPass,
      installTrackIdentity,
      installSectionIntensity
    } = await loadWorldModules();

    // Compatibility helper retained from the previous world tuning layer.
    if (!THREE.Object3D.prototype.addScaledVector) {
      THREE.Object3D.prototype.addScaledVector = function addScaledVector(vector, scalar) {
        this.position.addScaledVector(vector, scalar);
        return this;
      };
    }

    // Preserve the verified installation order from the generated legacy source.
    installArtPass({ world, scene, samples, trackWidth }).catch((error) => {
      console.warn('TURN: bold surroundings art pass failed, keeping base world.', error);
    });

    installTrackIdentity({ world, samples, trackWidth });
    installSectionIntensity({ world, samples, trackWidth });

    installWorldBeauty({ world, scene, samples, trackWidth, sun, hemi }).catch((error) => {
      console.warn('TURN: world beauty pass failed, keeping base world.', error);
    });
  } catch (error) {
    console.warn('TURN: standalone world bootstrap failed, keeping base world.', error);
  }
}

waitForRuntime();
