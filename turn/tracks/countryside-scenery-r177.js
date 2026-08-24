import * as THREE from 'three';

const REVISION = 'r531-countryside-world-redesign';
const INK = 0x08090a;

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function isInkMaterial(material) {
  return materialList(material).some((entry) => entry?.color?.getHex?.() === INK);
}

function neutralizeBeachContours(world) {
  const bounds = new THREE.Box3();
  let changed = 0;

  for (const child of world.children) {
    if (!child?.isMesh || !child.userData?.turnNoAutoOutline || !isInkMaterial(child.material)) continue;
    bounds.setFromObject(child);
    // Lake shore ribbons and the island base sit almost flush with the ground.
    // The intentional road-edge contour is higher (around y=.158), so leave it alone.
    if (bounds.max.y >= 0.11) continue;

    const isIslandBase = child.geometry?.type === 'ShapeGeometry';
    const useWater = !isIslandBase && bounds.max.y > 0.044;
    child.material = new THREE.MeshStandardMaterial({
      color: useWater ? 0x39ccef : 0xf2cf83,
      roughness: useWater ? 0.4 : 1,
      metalness: 0,
      side: THREE.DoubleSide
    });
    child.userData.turnBeachContourNeutralized = true;
    changed += 1;
  }
  return changed;
}

export async function installCountrysideSceneryCleanup({ world, samples, trackWidth }) {
  if (!world || !samples?.length || !Number.isFinite(trackWidth)) return null;

  const neutralized = neutralizeBeachContours(world);
  world.userData.turnCountrysideSceneryCleanup = Object.freeze({
    revision: REVISION,
    neutralizedBeachContours: neutralized,
    scatteredRoadsideVehicles: 0,
    scatteredTownBuildings: 0,
    lakeRelocationHacks: 0,
    gameplayGeometryUnchanged: true
  });
  if (neutralized) console.info(`TURN: neutralized ${neutralized} Countryside beach contour meshes.`);
  return world.userData.turnCountrysideSceneryCleanup;
}
