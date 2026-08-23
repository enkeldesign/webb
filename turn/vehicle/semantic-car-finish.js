import * as THREE from 'three';
import { setThreeColor } from './wide-gamut.js?revision=r157-display-p3';

const KENNEY_PALETTE_BY_PACK = Object.freeze({
  car: './assets/cars/palettes/car-kit.png',
  prototype: './assets/cars/palettes/toy-prototype.png',
  toy: './assets/cars/palettes/toy-prototype.png'
});

const KENNEY_PROFILE_BY_ID = Object.freeze({
  classic: profile({ primary: [[4, 4], [4, 5]], secondary: [[1, 6], [1, 7]], rims: [[4, 6], [4, 7]] }),
  truck: profile({ primary: [[3, 2], [3, 3]], secondary: [[3, 4], [3, 5]], rims: [[5, 4], [5, 5]] }),
  sedan: profile({ primary: [[6, 2], [6, 3]], secondary: [[3, 4], [3, 5]], rims: [[5, 4], [5, 5]] }),
  van: profile({ primary: [[7, 2], [7, 3]], secondary: [[3, 4], [3, 5]], rims: [[5, 4], [5, 5]] }),
  suv: profile({ primary: [[3, 2], [3, 3]], secondary: [[3, 4], [3, 5]], rims: [[5, 4], [5, 5]] }),
  convertible: profile({ primary: [[2, 4], [2, 5]], secondary: [[1, 6], [1, 7]], rims: [[4, 6], [4, 7]] }),
  'hatchback-sports': profile({
    primary: [[3, 2], [3, 3]],
    secondary: [[3, 4], [3, 5]],
    rims: [[5, 4], [5, 5]]
  }),
  'sedan-sports': profile({
    primary: [[6, 2], [6, 3]],
    secondary: [[3, 4], [3, 5]],
    rims: [[5, 4], [5, 5]],
    secondaryPrimaryNodes: ['spoiler']
  }),
  'sedan-sports-rally': profile({
    primary: [[6, 2], [6, 3]],
    secondary: [[3, 4], [3, 5]],
    rims: [[5, 4], [5, 5]],
    rimRole: 'secondary',
    secondaryPrimaryNodes: ['spoiler']
  }),
  race: profile({ primary: [[6, 2], [6, 3]], secondary: [[3, 4], [3, 5]], rims: [[4, 2], [4, 3]] }),
  'vintage-racer': profile({
    primary: [[7, 4], [7, 5]],
    secondary: [[1, 6], [1, 7]],
    rims: [[4, 6], [4, 7]]
  }),
  'race-future': profile({
    primary: [[7, 2], [7, 3]],
    secondary: [[3, 4], [3, 5]],
    secondaryNodes: ['body'],
    rims: [[4, 2], [4, 3]]
  }),
  'toy-racer': profile({
    primary: [[1, 4], [1, 5]],
    secondary: [[1, 6], [1, 7]],
    secondaryNodes: ['vehicle-racer'],
    rims: [[4, 6], [4, 7]],
    rimRole: 'secondary'
  })
});

const RGSDEV_PRIMARY_MATERIALS = new Set(['body light blue', 'wheels']);
const RGSDEV_SECONDARY_MATERIALS = new Set(['body grey']);
const RGSDEV_TIRE_MATERIALS = new Set(['tires']);
const TIRE_COLOR = 0x17191c;

export function getKenneyPaletteAsset(pack) {
  return KENNEY_PALETTE_BY_PACK[String(pack || '')] || null;
}

export function installSemanticCarFinish({
  node,
  material,
  car,
  primaryColor,
  secondaryColor,
  primaryPaintMaterials,
  secondaryPaintMaterials,
  semanticPaintRecords
}) {
  if (!material?.color || !car) return false;
  if (car.pack === 'rgsdev') {
    return installRgsdevMaterial({
      material,
      primaryColor,
      secondaryColor,
      primaryPaintMaterials,
      secondaryPaintMaterials
    });
  }

  const paletteAsset = getKenneyPaletteAsset(car.pack);
  if (!paletteAsset) return false;

  material.color.set(0xffffff);
  if ('roughness' in material) material.roughness = Math.max(Number(material.roughness) || 0, 0.76);
  if (car.fixedLivery) return true;

  const profileId = String(car.surfaceProfileId || car.id || '');
  const masks = semanticMasksForNode(profileId, node?.name);
  if (!masks.primary.length && !masks.secondary.length) return true;

  const uniforms = {
    turnPrimaryColor: { value: colorFrom(primaryColor) },
    turnSecondaryColor: { value: colorFrom(secondaryColor) }
  };
  const primaryExpression = cellMaskExpression(masks.primary);
  const secondaryExpression = cellMaskExpression(masks.secondary);
  const cacheKey = `${profileId}:${String(node?.name || '').toLowerCase()}:${primaryExpression}:${secondaryExpression}`;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.turnPrimaryColor = uniforms.turnPrimaryColor;
    shader.uniforms.turnSecondaryColor = uniforms.turnSecondaryColor;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <map_pars_fragment>',
        `#include <map_pars_fragment>\nuniform vec3 turnPrimaryColor;\nuniform vec3 turnSecondaryColor;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>\n#ifdef USE_MAP\n  ivec2 turnPaletteCell = ivec2(floor(vMapUv * 8.0));\n  float turnPrimaryMask = clamp(${primaryExpression}, 0.0, 1.0);\n  float turnSecondaryMask = clamp(${secondaryExpression}, 0.0, 1.0);\n  float turnPanelShade = mod(float(turnPaletteCell.y), 2.0) < 0.5 ? 1.08 : 0.82;\n  diffuseColor.rgb = mix(diffuseColor.rgb, turnPrimaryColor * turnPanelShade, turnPrimaryMask);\n  diffuseColor.rgb = mix(diffuseColor.rgb, turnSecondaryColor * turnPanelShade, turnSecondaryMask);\n#endif`
      );
  };
  material.customProgramCacheKey = () => `turn-semantic-palette:${cacheKey}`;
  material.userData.turnSemanticPaint = { uniforms, primary: masks.primary.length > 0, secondary: masks.secondary.length > 0 };
  material.needsUpdate = true;

  if (masks.primary.length) primaryPaintMaterials.push(material);
  if (masks.secondary.length) secondaryPaintMaterials.push(material);
  semanticPaintRecords.push(material.userData.turnSemanticPaint);
  return true;
}

export function recolorSemanticCarFinish(root, primaryColor, secondaryColor) {
  for (const record of root?.userData?.turnSemanticPaintRecords || []) {
    setThreeColor(record.uniforms.turnPrimaryColor.value, primaryColor);
    setThreeColor(record.uniforms.turnSecondaryColor.value, secondaryColor);
  }
}

function installRgsdevMaterial({
  material,
  primaryColor,
  secondaryColor,
  primaryPaintMaterials,
  secondaryPaintMaterials
}) {
  const name = String(material.name || '').toLowerCase();
  material.map = null;
  if (RGSDEV_PRIMARY_MATERIALS.has(name)) {
    setThreeColor(material.color, primaryColor);
    primaryPaintMaterials.push(material);
  } else if (RGSDEV_SECONDARY_MATERIALS.has(name)) {
    setThreeColor(material.color, secondaryColor);
    secondaryPaintMaterials.push(material);
  } else if (RGSDEV_TIRE_MATERIALS.has(name)) {
    material.color.setHex(TIRE_COLOR);
    if ('roughness' in material) material.roughness = 0.92;
  }
  material.needsUpdate = true;
  return true;
}

function semanticMasksForNode(profileId, nodeName) {
  const profile = KENNEY_PROFILE_BY_ID[profileId];
  if (!profile) return { primary: [], secondary: [] };
  const name = String(nodeName || '').toLowerCase();
  const wheel = /wheel/.test(name);
  if (wheel) {
    return profile.rimRole === 'secondary'
      ? { primary: [], secondary: profile.rims }
      : { primary: profile.rims, secondary: [] };
  }
  if (profile.secondaryPrimaryNodes.includes(name)) {
    return { primary: [], secondary: profile.primary };
  }
  const secondary = profile.secondaryNodes.length === 0 || profile.secondaryNodes.includes(name)
    ? profile.secondary
    : [];
  return { primary: profile.primary, secondary };
}

function profile({
  primary,
  secondary = [],
  secondaryNodes = [],
  rims,
  rimRole = 'primary',
  secondaryPrimaryNodes = []
}) {
  return Object.freeze({
    primary: freezeCells(primary),
    secondary: freezeCells(secondary),
    secondaryNodes: Object.freeze(secondaryNodes.map((name) => String(name).toLowerCase())),
    rims: freezeCells(rims),
    rimRole,
    secondaryPrimaryNodes: Object.freeze(secondaryPrimaryNodes.map((name) => String(name).toLowerCase()))
  });
}

function freezeCells(cells) {
  return Object.freeze(cells.map(([x, y]) => Object.freeze([x, y])));
}

function cellMaskExpression(cells) {
  if (!cells.length) return '0.0';
  return cells
    .map(([x, y]) => `(all(equal(turnPaletteCell, ivec2(${x}, ${y}))) ? 1.0 : 0.0)`)
    .join(' + ');
}

function colorFrom(value) {
  return setThreeColor(new THREE.Color(), value);
}
