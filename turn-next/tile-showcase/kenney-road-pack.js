export const KENNEY_ROAD_TILE_IDS = Object.freeze([25,30,31,33,38,40,41,43,44,46,48,50,52,53,55,57,59,60,61,63,66,68,71,72,73,74,75,76,79,82,83,84,141,143,147,154,161,165,187,188,197,207,218,223,233,274,289,296,298]);

// Asset files live under /turn-next/tile-showcase/assets/. The authored showcase uses
// a deliberately broad subset of Kenney's CC0 3D Road Tiles pack; tile identity remains
// visual/placement-only in this phase and carries no gameplay semantics.
export const KENNEY_ROAD_TILE_URLS = Object.freeze(Object.fromEntries(
  KENNEY_ROAD_TILE_IDS.map((id) => [id, `/turn-next/tile-showcase/assets/roadTile_${String(id).padStart(3, '0')}.gltf`])
));
