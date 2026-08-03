import * as THREE from 'three';
import { FINISH_PROGRESS, SAMPLE_COUNT } from './stages.js';

export function buildTrainingCourse(stage, trackWidth) {
  const samples = sampleStage(stage);
  const world = new THREE.Group();
  world.name = `TURN Drive By Ear Training · ${stage.title}`;
  world.add(makeGround(samples), makeRoad(samples, trackWidth), makeRoadEdges(samples, trackWidth));
  if (stage.guideRails) world.add(makeGuideRails(samples, trackWidth));
  world.add(
    makeLineMarker(samples[8], trackWidth, 0xffd43b),
    makeLineMarker(samples[Math.floor(samples.length * FINISH_PROGRESS)], trackWidth, 0xff4fa3),
    makeFinishArch(samples[Math.floor(samples.length * FINISH_PROGRESS)], trackWidth)
  );
  return Object.freeze({ samples, world });
}

export function disposeTrainingWorld(world) {
  if (!world) return;
  world.traverse((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((material) => material?.dispose?.());
    else node.material?.dispose?.();
  });
  world.removeFromParent();
}

function sampleStage(stage) {
  const points = stage.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const samples = [];
  let distance = 0;
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const progress = index / (SAMPLE_COUNT - 1);
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    if (index > 0) distance += point.distanceTo(samples[index - 1].point);
    samples.push({ point, tangent, normal, distance });
  }
  return samples;
}

function makeGround(samples) {
  const xs = samples.map((sample) => sample.point.x);
  const zs = samples.map((sample) => sample.point.z);
  const minX = Math.min(...xs) - 70;
  const maxX = Math.max(...xs) + 70;
  const minZ = Math.min(...zs) - 70;
  const maxZ = Math.max(...zs) + 70;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, maxZ - minZ),
    new THREE.MeshStandardMaterial({ color: 0x8ce99a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((minX + maxX) / 2, -0.03, (minZ + maxZ) / 2);
  ground.receiveShadow = true;
  return ground;
}

function makeRoad(samples, trackWidth) {
  const positions = [];
  const indices = [];
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const left = sample.point.clone().addScaledVector(sample.normal, trackWidth / 2);
    const right = sample.point.clone().addScaledVector(sample.normal, -trackWidth / 2);
    left.y = 0.11;
    right.y = 0.11;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    if (index >= samples.length - 1) continue;
    const offset = index * 2;
    indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x454a50, roughness: 0.92 })
  );
  road.receiveShadow = true;
  return road;
}

function makeRoadEdges(samples, trackWidth) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const positions = [];
    for (const sample of samples) {
      const point = sample.point.clone().addScaledVector(sample.normal, side * trackWidth / 2);
      positions.push(point.x, 0.19, point.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xfff8e8 })));
  }
  return group;
}

function makeGuideRails(samples, trackWidth) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const points = samples
      .filter((_, index) => index % 12 === 0 || index === samples.length - 1)
      .map((sample) => {
        const point = sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + 0.45));
        point.y = 1.15;
        return point;
      });
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 90, 0.72, 6, false),
        new THREE.MeshBasicMaterial({ color: 0x08090a })
      ),
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 90, 0.43, 6, false),
        new THREE.MeshStandardMaterial({ color: 0xffd43b, roughness: 0.72 })
      )
    );
  }
  return group;
}

function makeLineMarker(sample, trackWidth, color) {
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(trackWidth + 0.4, 0.12, 1.8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.78 })
  );
  marker.position.copy(sample.point);
  marker.position.y = 0.2;
  marker.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
  return marker;
}

function makeFinishArch(sample, trackWidth) {
  const arch = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(trackWidth + 5, 2, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: 0.7 })
  );
  beam.position.y = 8.5;
  arch.add(beam);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 8.5, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xffd43b, roughness: 0.75 })
    );
    post.position.set(side * (trackWidth / 2 + 1.4), 4.25, 0);
    arch.add(post);
  }
  arch.position.copy(sample.point);
  arch.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
  return arch;
}
