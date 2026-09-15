const MIRROR_COMMIT = '45df48c4d45f8716216b1a9e22df0b69cd9f5932';
const MIRROR_ROOT = `https://raw.githubusercontent.com/ETdoFresh/kenney.nl/${MIRROR_COMMIT}/kenney_3droadpack_updated/Models/gLTF`;

export const KENNEY_ROAD_TILE_IDS = Object.freeze([
  25,30,31,33,38,40,41,43,44,46,48,50,52,53,55,57,
  59,60,61,63,66,68,71,72,73,74,75,76,79,82,83,84,
  141,143,147,154,161,165,187,188,197,207,218,223,233,274,289,296,298
]);

export const GREEN_TILE_IDS = Object.freeze([25,30,31,33,38,40,41,43,44,46,48,50,52,53,55,57,141,143,147,154,161,165]);
export const WATER_TILE_IDS = Object.freeze([141,143,147,154,161,165,187,188,197,207,218,223,233]);
export const BEIGE_TILE_IDS = Object.freeze([59,60,61,63,66,68,71,72,73,74,75,76,79,82,83,84,218,223,233,274,289,296,298]);

// Runtime delivery uses a commit-pinned public mirror of the same Kenney CC0 pack
// supplied for this experiment. Keeping the meshes external avoids committing a
// large duplicated asset payload while making every model URL immutable.
export const KENNEY_ROAD_TILE_URLS = Object.freeze(Object.fromEntries(
  KENNEY_ROAD_TILE_IDS.map((id) => [
    id,
    `${MIRROR_ROOT}/roadTile_${String(id).padStart(3, '0')}.gltf`
  ])
));

export const KENNEY_ROAD_TILE_SOURCE = Object.freeze({
  title: 'Kenney 3D Road Tiles',
  license: 'CC0',
  mirrorCommit: MIRROR_COMMIT,
  source: 'https://kenney.nl/assets/3d-road-tiles'
});
