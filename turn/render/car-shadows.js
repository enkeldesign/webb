import * as THREE from 'three';

// Match the authored road decks, not the vehicle's suspension/body height.
const ROAD_HEIGHT = Object.freeze({ countryside: 0.13, airport: 0.17, cliffside: 0.12,
  harbor: 0.18, 'midnight-city': 0.16, mountain: 0.14 });
const SURFACE_LIFT = 0.018;
const PATCH_REACH = 12;

// Both layers share one triangle, material and instance buffer. Each footprint is
// projected across the road's own triangles: a flat quad would cut into crests
// and bank transitions. The tiny analytic mask needs no texture or extra pass.
export function createCarShadows({ scene, sun, samples, trackWidth, capacity = 5 }) {
  const material = new THREE.ShaderMaterial({
    name: 'TURN projected car shadow',
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: `
      attribute vec4 shadowOrigin;
      attribute vec4 shadowAxes;
      varying vec2 footprint;
      varying float strength;
      varying float rootWidth;
      #include <fog_pars_vertex>
      void main() {
        footprint = shadowOrigin.xy + mat2(shadowAxes) * position.xy;
        strength = shadowOrigin.z;
        rootWidth = shadowOrigin.w;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      varying vec2 footprint;
      varying float strength;
      varying float rootWidth;
      #include <fog_pars_fragment>
      void main() {
        float coverage;
        if (rootWidth == 1.0) {
          // Preserve the tight, dark chassis contact exactly.
          vec2 q = footprint * footprint;
          coverage = 1.0 - smoothstep(0.2, 1.0, dot(q, q));
        } else {
          // One continuous rounded field, shared across every road triangle.
          // A narrow root stays under the chassis; the widening body has no
          // flat opacity plateau or squared-off end to reveal a polygon.
          float along = clamp(footprint.y * 0.5 + 0.5, 0.0, 1.0);
          vec2 mask = vec2(footprint.x / mix(rootWidth, 1.0, along), footprint.y);
          coverage = (1.0 - smoothstep(0.0, 1.0, dot(mask, mask))) * (1.0 - 0.45 * along);
        }
        if (coverage <= 0.0) discard;
        gl_FragColor = vec4(0.0, 0.0, 0.0, strength * coverage);
        #include <fog_fragment>
      }`
  });
  const sizes = new WeakMap();
  const sampleIndices = new WeakMap();
  const bounds = new THREE.Box3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), normal = new THREE.Vector3();
  const center = new THREE.Vector3(), up = new THREE.Vector3(), edgeUp = new THREE.Vector3();
  const forward = new THREE.Vector3(), right = new THREE.Vector3(), lightDirection = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  let mesh = null, origins = null, axes = null;
  let firstSample = null, roadHeight = 0, span = 0, cursor = 0, carCount = 0;
  let disposed = false;

  function beginFrame(trackId) {
    cursor = 0;
    carCount = 0;
    if (disposed || !samples.length) return;
    const nextHeight = ROAD_HEIGHT[trackId] ?? (trackId ? 0.11 : 0.13); // DRIVE BY EAR practice decks
    if (firstSample === samples[0] && nextHeight === roadHeight) return;
    firstSample = samples[0];
    roadHeight = nextHeight;
    let shortestStep = Infinity;
    for (let i = 0; i < samples.length; i += 1) {
      sampleIndices.set(samples[i], i);
      const p = samples[i].point, q = samples[(i + 1) % samples.length].point;
      const step = Math.hypot(p.x - q.x, p.z - q.z);
      if (step > 0.001) shortestStep = Math.min(shortestStep, step);
    }
    span = Math.min(Math.floor((samples.length - 1) / 2), Math.ceil(PATCH_REACH / shortestStep) + 2);
    const required = capacity * (span * 2 + 1) * 4;
    if (mesh && mesh.instanceMatrix.count >= required) return;
    if (mesh) {
      mesh.removeFromParent();
      mesh.dispose();
      mesh.geometry.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    origins = new THREE.InstancedBufferAttribute(new Float32Array(required * 4), 4).setUsage(THREE.DynamicDrawUsage);
    axes = new THREE.InstancedBufferAttribute(new Float32Array(required * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('shadowOrigin', origins);
    geometry.setAttribute('shadowAxes', axes);
    mesh = new THREE.InstancedMesh(geometry, material, required);
    mesh.name = 'TURN contact + directional car shadows';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    // Moving instances must not inherit a stale bounding sphere after a restart.
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
  }

  function setCarSize(car, visual) {
    bounds.setFromObject(visual);
    sizes.set(car, { width: bounds.max.x - bounds.min.x, length: bounds.max.z - bounds.min.z });
  }

  function edge(target, sample, side) {
    target.copy(sample.point).addScaledVector(sample.normal, side * trackWidth / 2);
    target.y += roadHeight;
    // Adjacent triangles must share exactly the same lifted road vertices.
    // Separate face-normal offsets open subpixel cracks at bank/crest changes.
    edgeUp.crossVectors(sample.tangent, sample.normal).normalize();
    if (edgeUp.y < 0) edgeUp.negate();
    target.addScaledVector(edgeUp, SURFACE_LIFT);
  }

  function triangle(opacity, halfWidth, halfLength, rootWidth) {
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    normal.crossVectors(ab, ac).normalize();
    if (normal.y < 0) normal.negate();
    matrix.makeBasis(ab, ac, normal);
    matrix.setPosition(a);
    mesh.setMatrixAt(cursor, matrix);
    // UVs are continuous across triangle boundaries; body roll never affects them.
    const dx = a.x - center.x, dy = a.y - center.y, dz = a.z - center.z;
    origins.setXYZW(cursor, (dx * right.x + dy * right.y + dz * right.z) / halfWidth,
      (dx * forward.x + dy * forward.y + dz * forward.z) / halfLength, opacity, rootWidth);
    axes.setXYZW(cursor, ab.dot(right) / halfWidth, ab.dot(forward) / halfLength,
      ac.dot(right) / halfWidth, ac.dot(forward) / halfLength);
    cursor += 1;
  }

  function addCar(car, sample) {
    if (disposed || !mesh || !car.visible || !sample || carCount >= capacity) return;
    const index = sampleIndices.get(sample);
    if (index === undefined) return;
    carCount += 1;
    const size = sizes.get(car);
    const width = size?.width || 4.2, length = size?.length || 6.5;
    up.crossVectors(sample.tangent, sample.normal).normalize();
    if (up.y < 0) up.negate();
    if (up.lengthSq() < 0.5) up.set(0, 1, 0);
    // The footprint origin lies on the local contact plane at the car's X/Z.
    const groundY = sample.point.y + roadHeight
      - (up.x * (car.position.x - sample.point.x) + up.z * (car.position.z - sample.point.z)) / Math.max(0.1, up.y);
    lightDirection.subVectors(sun.target.position, sun.position).projectOnPlane(up);
    if (lightDirection.lengthSq() < 0.0001) lightDirection.copy(sample.tangent);
    lightDirection.normalize();

    for (let layer = 0; layer < 2; layer += 1) {
      const halfWidth = layer === 0 ? width * 0.57 : length * 0.56;
      const halfLength = layer === 0 ? length * 0.52 : length * 0.45;
      const rootWidth = layer === 0 ? 1 : Math.min(width, length) * 0.18 / halfWidth;
      center.set(car.position.x, groundY, car.position.z);
      if (layer === 0) {
        forward.set(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y)).projectOnPlane(up).normalize();
      } else {
        forward.copy(lightDirection);
        // Only a small, narrow overlap reaches toward the sun, inside the chassis.
        center.addScaledVector(lightDirection, halfLength - Math.min(width, length) * 0.2);
      }
      right.crossVectors(up, forward).normalize();
      const reach = Math.hypot(halfWidth, halfLength);
      for (let offset = -span; offset <= span; offset += 1) {
        const i = (index + offset + samples.length) % samples.length;
        const current = samples[i], next = samples[(i + 1) % samples.length];
        edge(a, current, 1);
        edge(b, next, 1);
        edge(c, current, -1);
        // Reject distant ribbon segments before uploading/drawing either triangle.
        const nextRightX = next.point.x - next.normal.x * trackWidth / 2;
        const nextRightZ = next.point.z - next.normal.z * trackWidth / 2;
        if (Math.max(a.x, b.x, c.x, nextRightX) < center.x - reach
          || Math.min(a.x, b.x, c.x, nextRightX) > center.x + reach
          || Math.max(a.z, b.z, c.z, nextRightZ) < center.z - reach
          || Math.min(a.z, b.z, c.z, nextRightZ) > center.z + reach) continue;
        triangle(layer === 0 ? 0.58 : 0.18, halfWidth, halfLength, rootWidth);
        a.copy(c);
        edge(c, next, -1);
        triangle(layer === 0 ? 0.58 : 0.18, halfWidth, halfLength, rootWidth);
      }
    }
  }

  function endFrame() {
    if (disposed || !mesh) return;
    mesh.count = cursor;
    mesh.visible = cursor > 0;
    mesh.instanceMatrix.needsUpdate = true;
    origins.needsUpdate = true;
    axes.needsUpdate = true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (mesh) {
      mesh.removeFromParent();
      mesh.dispose();
      mesh.geometry.dispose();
    }
    material.dispose();
  }

  return { beginFrame, addCar, endFrame, setCarSize, dispose, get mesh() { return mesh; } };
}
