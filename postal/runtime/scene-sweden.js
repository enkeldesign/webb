'use strict';
function cityWorldPosition(cityId) {
  const [x, y] = projectSweden(CITIES[cityId].coord);
  return new THREE.Vector3(x, .55, -y);
}

function buildSwedenScene() {
  scene.background.set(0xc9e1e5);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(13.2, 72), material(0xa8d2db, .92, 0));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -.22;
  sea.receiveShadow = true;
  world.add(sea);

  const seaRing = new THREE.Mesh(
    new THREE.RingGeometry(9.2, 10.7, 64),
    new THREE.MeshBasicMaterial({ color: 0xdaf0f1, transparent: true, opacity: .24, depthWrite: false })
  );
  seaRing.rotation.x = -Math.PI / 2;
  seaRing.position.y = -.19;
  world.add(seaRing);

  const mainland = makeSwedenExtrusion(SWEDEN_MAIN, 0xcdddac, .4);
  mainland.position.y = 0;
  world.add(mainland);

  const routePairs = [['sundsvall','stockholm'], ['stockholm','goteborg'], ['sundsvall','goteborg']];
  routePairs.forEach(([from, to], index) => {
    const curve = arcCurve(cityWorldPosition(from).toArray(), cityWorldPosition(to).toArray(), index === 2 ? 1.2 : .82);
    routeTube(curve, index === 2 ? 0x4e7f79 : 0x2e6865, .075);
    viewState.routeCurves.set(`${from}:${to}`, curve);
    viewState.routeCurves.set(`${to}:${from}`, new THREE.CatmullRomCurve3(curve.getPoints(40).reverse()));
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(.105, 14, 10), new THREE.MeshBasicMaterial({ color: 0xf2c94c }));
    pulse.position.copy(curve.getPoint(.2));
    world.add(pulse);
    viewState.decorative.push({ kind: 'routePulse', mesh: pulse, curve, offset: index * .29 });
  });

  const hubAssets = { sundsvall: 'industrialS', stockholm: 'commercialH', goteborg: 'industrialT' };
  for (const cityId of CITY_IDS) {
    const pos = cityWorldPosition(cityId);
    const selected = cityId === currentCityId;
    const halo = new THREE.Mesh(
      new THREE.CylinderGeometry(selected ? .48 : .4, selected ? .48 : .4, .09, 32),
      material(selected ? 0xf2c94c : 0x2b5f5c, .55, .06)
    );
    halo.position.copy(pos);
    halo.position.y = .43;
    addUserData(halo, { entityType: 'city', cityId });
    world.add(halo);

    const hub = cloneAsset(hubAssets[cityId], { target: selected ? .9 : .76, position: [pos.x, .52, pos.z], rotation: [0, cityId === 'stockholm' ? -.35 : .2, 0] });
    if (hub) {
      addUserData(hub, { entityType: 'city', cityId });
      world.add(hub);
      viewState.cityMarkers.set(cityId, hub);
    } else {
      viewState.cityMarkers.set(cityId, halo);
    }

    const label = makeLabel(CITIES[cityId].name, {
      fg: selected ? '#102a29' : '#fff',
      bg: selected ? 'rgba(242,201,76,.97)' : 'rgba(16,42,41,.93)',
      scale: selected ? .56 : .49
    });
    label.position.copy(pos);
    label.position.y = 1.35;
    addUserData(label, { entityType: 'city', cityId });
    world.add(label);
  }

  const internationalPoints = {
    Denmark: new THREE.Vector3(-4.6, .45, 5.5),
    Germany: new THREE.Vector3(-2.6, .45, 7.3),
    USA: new THREE.Vector3(-7.0, .45, -1.6),
    Finland: new THREE.Vector3(6.1, .45, -4.6)
  };
  Object.entries(internationalPoints).forEach(([country, pos], index) => {
    const gateway = country === 'USA' || country === 'Finland' ? 'stockholm' : 'goteborg';
    const curve = arcCurve(cityWorldPosition(gateway).toArray(), pos.toArray(), 1.28);
    routeTube(curve, country === 'USA' ? 0x776797 : 0x668e8b, .052);
    viewState.routeCurves.set(`${gateway}:${country}`, curve);
    viewState.routeCurves.set(`${country}:${gateway}`, new THREE.CatmullRomCurve3(curve.getPoints(40).reverse()));

    const dot = new THREE.Mesh(new THREE.CylinderGeometry(.2, .23, .14, 20), material(country === 'USA' ? 0x776797 : 0xffffff));
    dot.position.copy(pos);
    world.add(dot);
    const label = makeLabel(country, { scale: .44, bold: true });
    label.position.copy(pos);
    label.position.y = .92;
    world.add(label);

    const pulse = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    pulse.position.copy(curve.getPoint(.15));
    world.add(pulse);
    viewState.decorative.push({ kind: 'routePulse', mesh: pulse, curve, offset: .15 + index * .18, speed: .025 });
  });

  addSelectedSwedenRoute();

  simulation.nationalTrucks.forEach(truck => {
    const curve = viewState.routeCurves.get(`${truck.from}:${truck.to}`);
    if (!curve) return;
    let mesh = cloneAsset('truck', { target: .65, position: curve.getPoint(0).toArray(), shadow: true });
    if (!mesh) mesh = boxMesh([.53, .27, .24], 0xf2c94c, curve.getPoint(0).toArray());
    addUserData(mesh, { entityType: 'truck', truckId: truck.id });
    world.add(mesh);
    viewState.nationalTrucks.set(truck.id, { mesh, curve });
  });

  simulation.internationalTransports.forEach(transport => {
    const curve = viewState.routeCurves.get(`${transport.from}:${transport.to}`);
    if (!curve) return;
    const mesh = createTransportMarker(transport.from === 'USA' || transport.to === 'USA' ? 'air' : 'sea');
    addUserData(mesh, { entityType: 'transport', transportId: transport.id });
    world.add(mesh);
    viewState.international.set(transport.id, { mesh, curve });
  });

  const inFlow = simulation.getMetrics().active;
  const title = makeLabel(`SWEDEN · ${inFlow} PACKAGES IN FLOW`, { fg: '#fff', bg: 'rgba(16,42,41,.94)', scale: .57 });
  title.position.set(-2.4, 1.22, -5.5);
  world.add(title);
}

function selectedNetworkLeg(pkg) {
  if (!pkg) return null;
  if (pkg.status === 'ready-national') {
    const leg = nextLegForPackage(pkg);
    return leg?.to ? [pkg.cityId, leg.to] : null;
  }
  if (pkg.status === 'transit-national') {
    const truck = simulation.nationalTrucks.find(item => item.load.includes(pkg.id));
    return truck ? [truck.from, truck.to] : null;
  }
  if (pkg.status === 'ready-international') return [pkg.cityId, pkg.destination.country];
  if (pkg.status === 'ready-inbound') return [pkg.origin.country, gatewayForCountry(pkg.origin.country)];
  if (pkg.status === 'transit-international') {
    const transport = simulation.internationalTransports.find(item => item.load.includes(pkg.id));
    return transport ? [transport.from, transport.to] : null;
  }
  return null;
}

function addSelectedSwedenRoute() {
  const pkg = selectedPackageId ? simulation.packages.get(selectedPackageId) : null;
  const leg = selectedNetworkLeg(pkg);
  if (!pkg || !leg) return;
  const curve = viewState.routeCurves.get(`${leg[0]}:${leg[1]}`);
  if (!curve) return;
  const highlightMaterial = new THREE.MeshStandardMaterial({ color: 0xf2c94c, emissive: 0x5c4300, emissiveIntensity: .72, roughness: .48 });
  const highlight = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, .14, 10, false), highlightMaterial);
  world.add(highlight);
  const pulse = new THREE.Mesh(
    new THREE.SphereGeometry(.15, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .96, depthWrite: false })
  );
  pulse.position.copy(curve.getPoint(.08));
  world.add(pulse);
  viewState.decorative.push({ kind: 'routePulse', mesh: pulse, curve, offset: .08, speed: .12 });
  const label = makeLabel(`SELECTED · ${shortPlace(pkg.origin.place)} → ${shortPlace(pkg.destination.place)}`, {
    fg: '#102a29', bg: 'rgba(242,201,76,.98)', scale: .43
  });
  label.position.copy(curve.getPoint(.52));
  label.position.y += .48;
  world.add(label);
}

function createTransportMarker(kind) {
  const group = new THREE.Group();
  if (kind === 'air') {
    const body = new THREE.Mesh(new THREE.ConeGeometry(.16, .72, 4), material(0x725f91, .4, .2));
    body.rotation.z = -Math.PI / 2;
    body.rotation.y = Math.PI / 4;
    group.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(.14, .04, .62), material(0x725f91, .4, .2));
    group.add(wing);
  } else {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(.5, .18, .25), material(0x2d6967, .5, .1));
    hull.position.y = .05;
    group.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(.18, .2, .18), material(0xffffff));
    cabin.position.set(-.08, .18, 0);
    group.add(cabin);
  }
  group.scale.setScalar(.95);
  return group;
}

function updateSceneVisuals() {
  if (currentLevel === 'depot') updateDepotVisuals();
  if (currentLevel === 'region') updateRegionVisuals();
  if (currentLevel === 'sweden') updateSwedenVisuals();
}

let depotPackageSyncAt = -1;
