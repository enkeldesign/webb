'use strict';
const depotPalettes = {
  sundsvall: { ground: 0xb9cdbf, floor: 0xede7d9, accent: 0xf2c94c, lane: 0x486b69 },
  stockholm: { ground: 0xbacbd0, floor: 0xe9e7df, accent: 0x69a5c4, lane: 0x435f70 },
  goteborg: { ground: 0xb8c9b5, floor: 0xebe4d6, accent: 0xe37a47, lane: 0x4b6660 }
};

function buildDepotScene(cityId) {
  const palette = depotPalettes[cityId] || depotPalettes.sundsvall;
  scene.background.set(cityId === 'stockholm' ? 0xd8e7ec : 0xdde8e2);
  addGround(21, palette.ground);

  const slab = boxMesh([13.4, 0.2, 8.8], palette.floor, [0, 0.04, 0]);
  slab.receiveShadow = true;
  world.add(slab);

  // A real road and loading apron make the depot read as a place, not a stage.
  const roadA = cloneAsset('roadStraight', { target: 3.45, position: [4.95, 0.12, 2.0], rotation: [0, 0, 0] });
  const roadB = cloneAsset('roadStraight', { target: 3.45, position: [4.95, 0.12, 5.35], rotation: [0, 0, 0] });
  if (roadA) world.add(roadA);
  if (roadB) world.add(roadB);
  const apron = boxMesh([4.0, 0.09, 2.85], 0x77827f, [3.95, 0.16, 2.25]);
  apron.receiveShadow = true;
  world.add(apron);
  for (let i = 0; i < 3; i++) {
    const line = boxMesh([0.055, 0.025, 2.25], i === 0 ? palette.accent : 0xd4d8d5, [2.58 + i * 1.35, 0.225, 2.2]);
    world.add(line);
  }

  // Kenney Factory Kit modules form a legible cutaway wall around the active floor.
  const wallParts = [
    ['depotWindow', -4.85, 2.8], ['depotWindow', -2.15, 2.8],
    ['depotDoor', .75, 2.85], ['depotWindow', 3.55, 2.8]
  ];
  wallParts.forEach(([key, x, target]) => {
    const part = cloneAsset(key, { target, position: [x, 0.12, -4.18], rotation: [0, 0, 0] });
    if (part) world.add(part);
  });
  const sideWall = boxMesh([0.18, 2.25, 4.35], 0xd9ded9, [-6.62, 1.18, -2.02]);
  world.add(sideWall);

  const exterior = cloneAsset(cityId === 'goteborg' ? 'industrialB' : 'industrialS', {
    target: 3.5,
    position: [-5.0, 0.08, -5.1],
    rotation: [0, .2, 0]
  });
  if (exterior) world.add(exterior);

  addDepotZone('INBOUND', [-4.65, 0.17, -2.55], [2.2, .035, 1.25], 0xd7ded9, '#102a29');
  addDepotZone('SORT', [-.7, 0.17, -2.55], [4.9, .035, 1.25], palette.accent, '#102a29');
  addDepotZone('REGIONAL', [1.05, 0.17, 1.52], [2.1, .035, 1.1], 0xb9d7cc, '#102a29');
  addDepotZone('NATIONAL', [3.45, 0.17, 1.52], [2.1, .035, 1.1], 0x315f5c, '#ffffff');

  const conveyors = [
    ['conveyor', [-3.65, .24, -.8], 2.7],
    ['conveyor', [-1.1, .24, -.8], 2.7],
    ['conveyor', [1.45, .24, -.8], 2.7],
    ['conveyorJunction', [3.55, .24, -.8], 1.85]
  ];
  conveyors.forEach(([key, position, target]) => {
    const conveyor = cloneAsset(key, { target, position });
    if (conveyor) world.add(conveyor);
    else world.add(boxMesh([target * .9, .34, .72], 0x5a6769, [position[0], .36, position[2]]));
  });

  const scanner = cloneAsset('scanner', { target: 1.42, position: [-5.2, .19, -.78], rotation: [0, Math.PI / 2, 0] });
  if (scanner) world.add(scanner);
  const screen = cloneAsset('screen', { target: 1.2, position: [2.65, .18, -3.46], rotation: [0, Math.PI, 0] });
  if (screen) world.add(screen);
  const lever = cloneAsset('lever', { target: .72, position: [4.15, .18, -.35] });
  if (lever) world.add(lever);

  for (let i = 0; i < 3; i++) {
    const cone = cloneAsset('roadCone', { target: .44, position: [2.7 + i * .55, .18, 3.26] });
    if (cone) world.add(cone);
  }
  const barrier = cloneAsset('roadBarrier', { target: 1.25, position: [5.82, .18, .5], rotation: [0, Math.PI / 2, 0] });
  if (barrier) world.add(barrier);

  const truckState = simulation.cities[cityId].regionalTrucks[0];
  let truck = cloneAsset('truck', { target: 3.25, position: [4.25, .2, 3.25], rotation: [0, -Math.PI / 2, 0] });
  if (!truck) truck = boxMesh([2.7, 1.2, 1.1], palette.accent, [4.25, .72, 3.25]);
  addUserData(truck, { entityType: 'truck', truckId: truckState.id });
  world.add(truck);
  viewState.decorative.push({ kind: 'dockTruck', mesh: truck, baseY: truck.position.y });

  const workerKeys = ['workerA', 'workerB', 'workerC'];
  const workerBases = [[-3.55, .18, .45], [-.8, .18, .45], [1.8, .18, .45]];
  simulation.cities[cityId].workers.forEach((worker, i) => {
    let mesh = cloneAsset(workerKeys[i], { target: 1.15, position: workerBases[i], rotation: [0, Math.PI, 0] });
    if (!mesh) mesh = createWorkerFallback(workerBases[i], i);
    addUserData(mesh, { entityType: 'worker', workerId: worker.id });
    world.add(mesh);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(.3, .38, 28),
      new THREE.MeshBasicMaterial({ color: i === 0 ? 0xf2c94c : i === 1 ? 0x63b8a9 : 0xe37a47, transparent: true, opacity: .7, depthWrite: false })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(workerBases[i][0], .19, workerBases[i][2]);
    world.add(halo);

    const badge = makeLabel(worker.name, { scale: .42, fg: '#fff', bg: 'rgba(16,42,41,.88)' });
    badge.position.set(workerBases[i][0], 1.48, workerBases[i][2]);
    addUserData(badge, { entityType: 'worker', workerId: worker.id });
    world.add(badge);
    viewState.workerBadges.set(worker.id, badge);
    viewState.workers.set(worker.id, { mesh, halo, base: new THREE.Vector3(...workerBases[i]) });
  });

  const depotLabel = makeLabel(`${CITIES[cityId].name} · morning sort`, { fg: '#fff', bg: 'rgba(16,42,41,.94)', scale: .64 });
  depotLabel.position.set(-2.4, 3.05, -4.05);
  world.add(depotLabel);

  syncDepotPackages(cityId);
}

function addDepotZone(labelText, position, size, color, fg) {
  const zone = boxMesh(size, color, position);
  zone.material.transparent = true;
  zone.material.opacity = .9;
  world.add(zone);
  const label = makeLabel(labelText, { fg, bg: 'rgba(255,255,255,.9)', scale: .34 });
  label.position.set(position[0], .38, position[2]);
  world.add(label);
}

function createWorkerFallback(pos, i) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.18, .55, 5, 10), material([0x2f746f, 0xe57a44, 0x5968a8][i % 3]));
  body.position.y = .6;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 12), material(0xe6b58d));
  head.position.y = 1.18;
  head.castShadow = true;
  group.add(body, head);
  group.position.set(...pos);
  return group;
}

function syncDepotPackages(cityId) {
  for (const { mesh, issueRing } of viewState.packages.values()) {
    world.remove(mesh);
    if (issueRing) world.remove(issueRing);
  }
  viewState.packages.clear();
  const pkgs = [...simulation.packages.values()]
    .filter(pkg => pkg.cityId === cityId && !pkg.status.startsWith('transit') && pkg.status !== 'delivered')
    .sort((a, b) => packageScore(b, simulation.focus, simulation.clock) - packageScore(a, simulation.focus, simulation.clock))
    .slice(0, 16);

  pkgs.forEach((pkg, i) => {
    const held = Boolean(pkg.issue);
    const readyNational = pkg.status === 'ready-national';
    const readyLocal = pkg.status === 'ready-local';
    const lane = held ? 'held' : readyNational ? 'national' : readyLocal ? 'regional' : 'sort';
    let x;
    let z;
    if (lane === 'held') {
      x = -5.35 + (i % 2) * .7;
      z = -2.58 + Math.floor(i / 2) * .5;
    } else if (lane === 'national') {
      x = 2.85 + (i % 3) * .58;
      z = 1.5 + Math.floor(i / 3) * .48;
    } else if (lane === 'regional') {
      x = .4 + (i % 3) * .58;
      z = 1.5 + Math.floor(i / 3) * .48;
    } else {
      x = -4.25 + (i % 7) * 1.03;
      z = -.78 + Math.floor(i / 7) * .52;
    }

    let mesh = cloneAsset(i % 3 === 0 ? 'boxLarge' : 'boxSmall', { target: i % 3 === 0 ? .5 : .42, position: [x, .26, z] });
    if (!mesh) mesh = boxMesh([.44, .34, .38], pkg.service === 'express' ? 0xf2c94c : 0xb98b5c, [x, .37, z]);
    addUserData(mesh, { entityType: 'package', packageId: pkg.id });
    world.add(mesh);

    let issueRing = null;
    if (held) {
      issueRing = new THREE.Mesh(new THREE.RingGeometry(.37, .46, 28), new THREE.MeshBasicMaterial({ color: 0xc53e36, transparent: true, opacity: .92, depthWrite: false }));
      issueRing.rotation.x = -Math.PI / 2;
      issueRing.position.set(x, .205, z);
      addUserData(issueRing, { entityType: 'package', packageId: pkg.id });
      world.add(issueRing);
    }
    viewState.packages.set(pkg.id, { mesh, issueRing, lane, base: new THREE.Vector3(x, mesh.position.y, z), baseY: mesh.position.y, offset: i * .47 });
  });
}

const regionTownLayouts = {
  sundsvall: { Sundsvall: [0, 0], Timrå: [0, -5.2], Söråker: [5.2, 0], Härnösand: [0, 5.2], Ånge: [-5.2, 0] },
  stockholm: { Stockholm: [0, 0], Solna: [0, -5.2], Nacka: [5.2, 0], Södertälje: [0, 5.2], Uppsala: [-5.2, 0] },
  goteborg: { Göteborg: [0, 0], Mölndal: [0, -5.2], Kungälv: [5.2, 0], Kungsbacka: [0, 5.2], Borås: [-5.2, 0] }
};
