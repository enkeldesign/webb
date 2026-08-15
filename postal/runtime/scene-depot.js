'use strict';
function buildDepotScene(cityId) {
  scene.background.set(0xe7edeb);
  addGround(18, 0xc7d4cc);

  const slab = boxMesh([12.8, 0.2, 8.5], 0xece7db, [0, 0.04, 0]);
  slab.receiveShadow = true;
  world.add(slab);

  const backWall = boxMesh([12.8, 2.5, 0.22], 0xf7f3e9, [0, 1.25, -4.15]);
  world.add(backWall);
  const sideWall = boxMesh([0.22, 2.5, 8.5], 0xf7f3e9, [-6.3, 1.25, 0]);
  world.add(sideWall);

  const depot = cloneAsset('industrialC', { target: 4.8, position: [-4.9, 0.12, -3.2], rotation: [0, Math.PI * 0.2, 0] });
  if (depot) { depot.scale.multiplyScalar(0.75); world.add(depot); }

  const conveyorPositions = [[-2.8, 0.23, -0.8], [-0.3, 0.23, -0.8], [2.2, 0.23, -0.8]];
  for (const pos of conveyorPositions) {
    const conv = cloneAsset('conveyor', { target: 2.9, position: pos });
    if (conv) world.add(conv);
    else world.add(boxMesh([2.4, 0.38, 0.8], 0x5a6467, [pos[0], 0.35, pos[2]]));
  }

  for (let i = 0; i < 4; i++) {
    const dock = boxMesh([1.15, 0.08, 1.7], i === 0 ? 0xf2c94c : 0xa7b2b1, [3.1 + i * 0.95, 0.13, 2.6]);
    dock.material.transparent = true;
    dock.material.opacity = i === 0 ? 0.95 : 0.5;
    world.add(dock);
  }

  const truck = cloneAsset('truck', { target: 3.5, position: [4.5, 0.16, 3.35], rotation: [0, -Math.PI / 2, 0] });
  if (truck) {
    addUserData(truck, { entityType: 'truck', truckId: `${cityId}-r0` });
    world.add(truck);
  } else {
    const fallback = boxMesh([2.7, 1.2, 1.1], 0xf2c94c, [4.5, 0.7, 3.35]);
    addUserData(fallback, { entityType: 'truck', truckId: `${cityId}-r0` }); world.add(fallback);
  }

  const workerKeys = ['workerA', 'workerB', 'workerC'];
  const workerBases = [[-3.5, 0.13, 0.5], [-0.4, 0.13, 0.5], [2.55, 0.13, 0.5]];
  simulation.cities[cityId].workers.forEach((worker, i) => {
    let mesh = cloneAsset(workerKeys[i], { target: 1.35, position: workerBases[i], rotation: [0, Math.PI, 0] });
    if (!mesh) mesh = createWorkerFallback(workerBases[i], i);
    addUserData(mesh, { entityType: 'worker', workerId: worker.id });
    world.add(mesh);
    viewState.workers.set(worker.id, { mesh, base: new THREE.Vector3(...workerBases[i]) });
  });

  const label = makeLabel(`${CITIES[cityId].name} depot`, { scale: 0.85 });
  label.position.set(-2.1, 2.65, -3.95);
  world.add(label);

  const handoff = makeLabel('NATIONAL HANDOFF', { fg: '#fff', bg: 'rgba(27,70,68,.94)', scale: 0.7 });
  handoff.position.set(4.1, 1.4, 1.55);
  world.add(handoff);
  const handoffArrow = cloneAsset('handoffArrow', { target: 0.8, position: [4.1, 0.16, 1.45], rotation: [0, -Math.PI / 2, 0] });
  if (handoffArrow) world.add(handoffArrow);

  syncDepotPackages(cityId);
}

function createWorkerFallback(pos, i) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 5, 10), material([0x2f746f, 0xe57a44, 0x5968a8][i % 3]));
  body.position.y = 0.6;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), material(0xe6b58d));
  head.position.y = 1.18;
  head.castShadow = true;
  group.add(body, head);
  group.position.set(...pos);
  return group;
}

function syncDepotPackages(cityId) {
  for (const { mesh } of viewState.packages.values()) world.remove(mesh);
  viewState.packages.clear();
  const pkgs = [...simulation.packages.values()]
    .filter(p => p.cityId === cityId && !p.status.startsWith('transit') && p.status !== 'delivered')
    .sort((a, b) => packageScore(b, simulation.focus, simulation.clock) - packageScore(a, simulation.focus, simulation.clock))
    .slice(0, 14);

  pkgs.forEach((pkg, i) => {
    let p;
    const held = Boolean(pkg.issue);
    const lane = pkg.status === 'ready-national' ? 2 : pkg.status === 'ready-local' ? 1 : 0;
    const x = -4.2 + (i % 5) * 1.25;
    const z = held ? -2.7 : lane === 2 ? 2.25 : lane === 1 ? 1.45 : -1.15;
    p = cloneAsset(i % 3 === 0 ? 'boxLarge' : 'boxSmall', { target: i % 3 === 0 ? 0.58 : 0.46, position: [x, 0.14, z] });
    if (!p) p = boxMesh([0.48, 0.38, 0.42], held ? 0xc74e45 : pkg.service === 'express' ? 0xf2c94c : 0xb98b5c, [x, 0.35, z]);
    if (held) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 24), new THREE.MeshBasicMaterial({ color: 0xc53e36 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.06;
      p.add(ring);
    }
    addUserData(p, { entityType: 'package', packageId: pkg.id });
    world.add(p);
    viewState.packages.set(pkg.id, { mesh: p, baseY: p.position.y, offset: i * 0.4 });
  });
}

const regionTownLayouts = {
  sundsvall: { Sundsvall: [0, 0], Timrå: [3.5, -2.2], Söråker: [4.6, 0.4], Härnösand: [1.8, -4.4], Ånge: [-4.5, 1.6] },
  stockholm: { Stockholm: [0, 0], Solna: [-2.4, -1.8], Nacka: [3.7, 0.6], Södertälje: [-3.3, 3.4], Uppsala: [1.2, -4.7] },
  goteborg: { Göteborg: [0, 0], Mölndal: [1.7, 3.3], Kungälv: [-2.6, -3.4], Kungsbacka: [3.8, 3.8], Borås: [4.7, -1.0] }
};
