const DEFAULT_CELL_SIZE = 32;

export function createTrackSpatialIndex(samples, { cellSize = DEFAULT_CELL_SIZE } = {}) {
  if (!Array.isArray(samples) || !samples.length) {
    throw new TypeError('TURN track index needs at least one sample');
  }

  const size = positiveNumber(cellSize, DEFAULT_CELL_SIZE);
  const columns = new Map();
  let minCellX = Infinity;
  let maxCellX = -Infinity;
  let minCellZ = Infinity;
  let maxCellZ = -Infinity;
  let queryCount = 0;
  let totalChecks = 0;
  let maxChecks = 0;
  let lastChecks = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index]?.point;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) {
      throw new TypeError(`TURN track sample ${index} has no finite point`);
    }

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

  function find(position) {
    const x = Number(position?.x);
    const z = Number(position?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return recordResult(findNearestTrackBruteForce(samples, position));
    }

    const centerCellX = Math.floor(x / size);
    const centerCellZ = Math.floor(z / size);

    // Teleports or corrupt replay points outside the indexed world are rare. A full scan
    // keeps those cases exact without making the common on-track query more complicated.
    if (
      centerCellX < minCellX ||
      centerCellX > maxCellX ||
      centerCellZ < minCellZ ||
      centerCellZ > maxCellZ
    ) {
      return recordResult(findNearestTrackBruteForce(samples, position));
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
    }

    if (bestIndex < 0) return recordResult(findNearestTrackBruteForce(samples, position));
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

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
