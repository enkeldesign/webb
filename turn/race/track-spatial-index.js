const DEFAULT_CELL_SIZE = 32;
const MAX_GRID_RADIUS_BEFORE_HIERARCHY = 2;
const HIERARCHY_LEAF_SIZE = 8;

export function createTrackSpatialIndex(initialSamples, { cellSize = DEFAULT_CELL_SIZE } = {}) {
  const size = positiveNumber(cellSize, DEFAULT_CELL_SIZE);
  let samples = null;
  let columns = null;
  let minCellX = Infinity;
  let maxCellX = -Infinity;
  let minCellZ = Infinity;
  let maxCellZ = -Infinity;
  let hierarchy = null;
  let queryCount = 0;
  let totalChecks = 0;
  let maxChecks = 0;
  let lastChecks = 0;

  rebuild(initialSamples);

  function rebuild(nextSamples) {
    validateSamples(nextSamples);
    samples = nextSamples;
    columns = new Map();
    minCellX = Infinity;
    maxCellX = -Infinity;
    minCellZ = Infinity;
    maxCellZ = -Infinity;

    for (let index = 0; index < samples.length; index += 1) {
      const point = samples[index].point;
      const cellX = Math.floor(point.x / size);
      const cellZ = Math.floor(point.z / size);
      let column = columns.get(cellX);
      if (!column) {
        column = new Map();
        columns.set(cellX, column);
      }
      let bucket = column.get(cellZ);
      if (!bucket) {
        bucket = [];
        column.set(cellZ, bucket);
      }
      bucket.push(index);
      minCellX = Math.min(minCellX, cellX);
      maxCellX = Math.max(maxCellX, cellX);
      minCellZ = Math.min(minCellZ, cellZ);
      maxCellZ = Math.max(maxCellZ, cellZ);
    }

    hierarchy = buildTrackHierarchy(samples, 0, samples.length);
    queryCount = 0;
    totalChecks = 0;
    maxChecks = 0;
    lastChecks = 0;
    return samples;
  }

  function find(position) {
    const x = Number(position?.x);
    const z = Number(position?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return recordResult(findNearestTrackBruteForce(samples, position));
    }

    const centerCellX = Math.floor(x / size);
    const centerCellZ = Math.floor(z / size);

    // Positions beyond the indexed grid used to trigger a full 720-sample scan. The exact
    // hierarchy keeps those teleports and wide off-road excursions cheap without changing
    // the nearest-sample result.
    if (
      centerCellX < minCellX ||
      centerCellX > maxCellX ||
      centerCellZ < minCellZ ||
      centerCellZ > maxCellZ
    ) {
      return recordResult(findNearestTrackHierarchy(samples, hierarchy, position));
    }

    let bestIndex = -1;
    let bestDistanceSq = Infinity;
    let checks = 0;

    function inspectCell(cellX, cellZ) {
      const bucket = columns.get(cellX)?.get(cellZ);
      if (!bucket) return;
      for (const index of bucket) {
        const point = samples[index].point;
        const dx = x - point.x;
        const dz = z - point.z;
        const distanceSq = dx * dx + dz * dz;
        checks += 1;
        if (
          distanceSq < bestDistanceSq ||
          (distanceSq === bestDistanceSq && (bestIndex < 0 || index < bestIndex))
        ) {
          bestDistanceSq = distanceSq;
          bestIndex = index;
        }
      }
    }

    const maxRadius = Math.max(
      centerCellX - minCellX,
      maxCellX - centerCellX,
      centerCellZ - minCellZ,
      maxCellZ - centerCellZ
    );

    for (let radius = 0; radius <= maxRadius; radius += 1) {
      const minX = centerCellX - radius;
      const maxX = centerCellX + radius;
      const minZ = centerCellZ - radius;
      const maxZ = centerCellZ + radius;

      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        inspectCell(cellX, minZ);
        if (radius > 0) inspectCell(cellX, maxZ);
      }
      for (let cellZ = minZ + 1; cellZ < maxZ; cellZ += 1) {
        inspectCell(minX, cellZ);
        if (radius > 0) inspectCell(maxX, cellZ);
      }

      if (bestIndex >= 0) {
        const boundaryDistance = Math.min(
          x - minX * size,
          (maxX + 1) * size - x,
          z - minZ * size,
          (maxZ + 1) * size - z
        );

        // Every unsearched cell lies beyond this square. A strict comparison preserves
        // the brute-force tie rule as well as the exact nearest sample.
        if (bestDistanceSq < boundaryDistance * boundaryDistance) break;
      }

      // The uniform grid is excellent near the road but can balloon into hundreds of
      // checks in the lake or far across the scenery. Switch to the exact bounds hierarchy
      // before that pathological expansion begins.
      if (radius >= MAX_GRID_RADIUS_BEFORE_HIERARCHY) {
        const hierarchyResult = findNearestTrackHierarchy(samples, hierarchy, position);
        hierarchyResult.checks += checks;
        return recordResult(hierarchyResult);
      }
    }

    if (bestIndex < 0) return recordResult(findNearestTrackHierarchy(samples, hierarchy, position));
    return recordResult({
      index: bestIndex,
      sample: samples[bestIndex],
      distance: Math.sqrt(bestDistanceSq),
      checks
    });
  }

  function recordResult(result) {
    lastChecks = result.checks;
    queryCount += 1;
    totalChecks += result.checks;
    maxChecks = Math.max(maxChecks, result.checks);
    return result;
  }

  return Object.freeze({
    cellSize: size,
    find,
    replaceSamples(nextSamples) {
      return rebuild(nextSamples);
    },
    getStats() {
      return Object.freeze({ queryCount, totalChecks, maxChecks, lastChecks });
    }
  });
}

export function findNearestTrackBruteForce(samples, position) {
  let bestIndex = 0;
  let bestDistanceSq = Infinity;
  const x = Number(position?.x);
  const z = Number(position?.z);

  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index].point;
    const dx = x - point.x;
    const dz = z - point.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestIndex = index;
    }
  }

  return {
    index: bestIndex,
    sample: samples[bestIndex],
    distance: Math.sqrt(bestDistanceSq),
    checks: samples.length
  };
}

function validateSamples(samples) {
  if (!Array.isArray(samples) || !samples.length) {
    throw new TypeError('TURN track index needs at least one sample');
  }

  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index]?.point;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) {
      throw new TypeError(`TURN track sample ${index} has no finite point`);
    }
  }
}

function buildTrackHierarchy(samples, start, end) {
  const node = {
    start,
    end,
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
    left: null,
    right: null
  };

  for (let index = start; index < end; index += 1) {
    const point = samples[index].point;
    node.minX = Math.min(node.minX, point.x);
    node.maxX = Math.max(node.maxX, point.x);
    node.minZ = Math.min(node.minZ, point.z);
    node.maxZ = Math.max(node.maxZ, point.z);
  }

  if (end - start > HIERARCHY_LEAF_SIZE) {
    const middle = start + Math.floor((end - start) / 2);
    node.left = buildTrackHierarchy(samples, start, middle);
    node.right = buildTrackHierarchy(samples, middle, end);
  }

  return node;
}

function findNearestTrackHierarchy(samples, hierarchy, position) {
  const x = Number(position?.x);
  const z = Number(position?.z);
  let bestIndex = -1;
  let bestDistanceSq = Infinity;
  let checks = 0;

  function visit(node) {
    if (!node || distanceSqToBounds(node, x, z) > bestDistanceSq) return;

    if (!node.left && !node.right) {
      for (let index = node.start; index < node.end; index += 1) {
        const point = samples[index].point;
        const dx = x - point.x;
        const dz = z - point.z;
        const distanceSq = dx * dx + dz * dz;
        checks += 1;
        if (
          distanceSq < bestDistanceSq ||
          (distanceSq === bestDistanceSq && (bestIndex < 0 || index < bestIndex))
        ) {
          bestDistanceSq = distanceSq;
          bestIndex = index;
        }
      }
      return;
    }

    const leftDistance = node.left ? distanceSqToBounds(node.left, x, z) : Infinity;
    const rightDistance = node.right ? distanceSqToBounds(node.right, x, z) : Infinity;
    const first = leftDistance <= rightDistance ? node.left : node.right;
    const second = first === node.left ? node.right : node.left;

    visit(first);
    visit(second);
  }

  visit(hierarchy);

  if (bestIndex < 0) return findNearestTrackBruteForce(samples, position);
  return {
    index: bestIndex,
    sample: samples[bestIndex],
    distance: Math.sqrt(bestDistanceSq),
    checks
  };
}

function distanceSqToBounds(node, x, z) {
  const dx = x < node.minX ? node.minX - x : x > node.maxX ? x - node.maxX : 0;
  const dz = z < node.minZ ? node.minZ - z : z > node.maxZ ? z - node.maxZ : 0;
  return dx * dx + dz * dz;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}