import * as THREE from 'three';

const buildId = new URL(import.meta.url).searchParams.get('build');
const TREE_CLUSTER_SINK_RATIO = 0.07;

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

function groundLateTreeClusters(world, baselineChildren) {
  const bounds = new THREE.Box3();
  const size = new THREE.Vector3();
  let groundedCount = 0;

  for (const child of world.children) {
    if (baselineChildren.has(child) || !child?.isGroup) continue;

    bounds.setFromObject(child);
    bounds.getSize(size);

    // The late Kenney forest clusters are broad, ground-level groups between 8 and 16 m
    // tall. Flags are narrow and clouds are elevated, so this keeps the grounding fix
    // isolated to the slab-backed tree groups added by the beauty pass.
    const treeCluster = bounds.min.y > -1.5
      && bounds.min.y < 2.5
      && size.y >= 6
      && size.y <= 18
      && size.x >= 5
      && size.z >= 5;

    if (!treeCluster) continue;
    child.position.y -= size.y * TREE_CLUSTER_SINK_RATIO;
    groundedCount += 1;
  }

  if (groundedCount) console.info(`TURN: grounded ${groundedCount} late tree clusters.`);
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

    const beautyBaselineChildren = new Set(world.children);
    installWorldBeauty({ world, scene, samples, trackWidth, sun, hemi })
      .then(() => groundLateTreeClusters(world, beautyBaselineChildren))
      .catch((error) => {
        console.warn('TURN: world beauty pass failed, keeping base world.', error);
      });
  } catch (error) {
    console.warn('TURN: standalone world bootstrap failed, keeping base world.', error);
  }
}

waitForRuntime();