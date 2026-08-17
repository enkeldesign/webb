import * as THREE from 'three';

const buildId = new URL(import.meta.url).searchParams.get('build');
const TREE_CLUSTER_SINK_RATIO = 0.07;
const TURN_INK = 0x08090a;

// Historical regression marker: the r524 directional wrapper delegates to the verified
// on-demand Bella rescue/audio lifecycle underneath it.
// countryside-bella-rescue-r173.js?revision=r164-long-session-robustness

function moduleUrl(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  if (buildId) url.searchParams.set('build', buildId);
  return url.href;
}

async function loadWorldModules() {
  const [beauty, art, identity, intensity, scenery, bella, bellaFinal, bellaRescue] = await Promise.all([
    import(moduleUrl('../world-beauty.js')),
    import(moduleUrl('../world-art-pass.js?revision=r514-road-contour')),
    import(moduleUrl('../track-identity.js?revision=r515-road-edge-cleanup')),
    import(moduleUrl('../section-intensity.js')),
    import(moduleUrl('../tracks/countryside-scenery-r177.js?revision=r177-lake-cleanup-traffic')),
    import(moduleUrl('../tracks/countryside-bella-r166.js?revision=r168-bella-markings-eyes-foliage-r169-facing-palette-r170-eye-placement-r171-cute-eyes-r172-final-tune-r173-rescue-r174-siren-zone-r175-broad-rear-zone-r176-road-derived-zone')),
    import(moduleUrl('../tracks/countryside-bella-final-r172.js?revision=r172-final-tune-r173-rescue-r174-siren-zone-r175-broad-rear-zone-r176-road-derived-zone')),
    import(moduleUrl('../tracks/countryside-bella-rescue-r524.js?revision=r524-camera-relative-meow'))
  ]);

  return {
    installWorldBeauty: beauty.installWorldBeauty,
    installArtPass: art.installArtPass,
    installTrackIdentity: identity.installTrackIdentity,
    installSectionIntensity: intensity.installSectionIntensity,
    installCountrysideSceneryCleanup: scenery.installCountrysideSceneryCleanup,
    installCountrysideBella: bella.installCountrysideBella,
    applyBellaFinalVisuals: bellaFinal.applyBellaFinalVisuals,
    installBellaRescueBehavior: bellaRescue.installBellaRescueBehavior
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

function isContourShell(node) {
  if (!node?.isMesh || !node.material) return false;
  if (node.userData?.turnOutline) return true;
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  return materials.some((material) => (
    material?.side === THREE.BackSide
    && material?.color?.getHex?.() === TURN_INK
  ));
}

function suppressTreeClusterContours(root) {
  const contourShells = [];
  root.traverse((node) => {
    if (!node?.isMesh) return;
    if (isContourShell(node)) {
      contourShells.push(node);
      return;
    }
    // world-art-pass.js checks this marker before creating an enlarged
    // back-face contour shell. Leave it set even after stripping an already
    // created shell so the later compatibility sweeps cannot recreate it.
    node.userData.turnOutlined = true;
  });

  for (const shell of contourShells) shell.parent?.remove(shell);
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
    suppressTreeClusterContours(child);
    child.position.y -= size.y * TREE_CLUSTER_SINK_RATIO;
    groundedCount += 1;
  }

  if (groundedCount) console.info(`TURN: grounded ${groundedCount} late tree clusters without contour shells.`);
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

  // Track selection can replace the shared runtime sample array while these art modules
  // are still loading. Give Countryside scenery an immutable sample snapshot so a quick
  // switch to Airport can never redirect late trees, buildings or flags onto Track 2.
  const worldSamples = samples.slice();

  try {
    const {
      installWorldBeauty,
      installArtPass,
      installTrackIdentity,
      installSectionIntensity,
      installCountrysideSceneryCleanup,
      installCountrysideBella,
      applyBellaFinalVisuals,
      installBellaRescueBehavior
    } = await loadWorldModules();

    // Compatibility helper retained from the previous world tuning layer.
    if (!THREE.Object3D.prototype.addScaledVector) {
      THREE.Object3D.prototype.addScaledVector = function addScaledVector(vector, scalar) {
        this.position.addScaledVector(vector, scalar);
        return this;
      };
    }

    // Preserve the verified installation order from the generated legacy source.
    const artPassPromise = installArtPass({ world, scene, samples: worldSamples, trackWidth })
      .catch((error) => {
        console.warn('TURN: bold surroundings art pass failed, keeping base world.', error);
      });

    installTrackIdentity({ world, samples: worldSamples, trackWidth });
    installSectionIntensity({ world, samples: worldSamples, trackWidth });
    installCountrysideBella({ world, samples: worldSamples, trackWidth, runtime })
      .then((bellaRoot) => {
        applyBellaFinalVisuals(bellaRoot);
        installBellaRescueBehavior({ root: bellaRoot, runtime });
      })
      .catch((error) => {
        console.warn('TURN: Bella discovery failed, keeping the rest of Countryside.', error);
      });

    const beautyBaselineChildren = new Set(world.children);
    installWorldBeauty({ world, scene, samples: worldSamples, trackWidth, sun, hemi })
      .then(() => groundLateTreeClusters(world, beautyBaselineChildren))
      .catch((error) => {
        console.warn('TURN: world beauty pass failed, keeping base world.', error);
      });

    artPassPromise
      .then(() => installCountrysideSceneryCleanup({
        world,
        samples: worldSamples,
        trackWidth
      }))
      .catch((error) => {
        console.warn('TURN: Countryside lake/traffic cleanup failed, keeping base scenery.', error);
      });
  } catch (error) {
    console.warn('TURN: standalone world bootstrap failed, keeping base world.', error);
  }
}

waitForRuntime();
