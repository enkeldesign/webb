'use strict';
function cityWorldPosition(cityId) {
  const [x, y] = projectSweden(CITIES[cityId].coord);
  return new THREE.Vector3(x, 0.55, -y);
}

function buildSwedenScene() {
  scene.background.set(0xd9e8eb);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(12.5, 64), material(0xb9dbe0, .9, 0));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.2; sea.receiveShadow = true; world.add(sea);
  const mainland = makeSwedenExtrusion(SWEDEN_MAIN, 0xd4dfb7, .38);
  mainland.position.y = 0; world.add(mainland);
  const routePairs = [['sundsvall','stockholm'],['stockholm','goteborg'],['sundsvall','goteborg']];
  for (const [from, to] of routePairs) {
    const curve = arcCurve(cityWorldPosition(from).toArray(), cityWorldPosition(to).toArray(), from === 'sundsvall' && to === 'goteborg' ? 1.1 : .75);
    routeTube(curve, 0x3f6c6b, .055);
    viewState.routeCurves.set(`${from}:${to}`, curve);
    viewState.routeCurves.set(`${to}:${from}`, new THREE.CatmullRomCurve3(curve.getPoints(40).reverse()));
  }

  for (const cityId of CITY_IDS) {
    const pos = cityWorldPosition(cityId);
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(.28, .35, .36, 24), material(cityId === currentCityId ? 0xf2c94c : 0x1b4644, .55, .08));
    marker.position.copy(pos); marker.position.y = .54; marker.castShadow = true;
    addUserData(marker, { entityType: 'city', cityId });
    world.add(marker); viewState.cityMarkers.set(cityId, marker);
    const label = makeLabel(CITIES[cityId].name, { fg: cityId === currentCityId ? '#102423' : '#fff', bg: cityId === currentCityId ? 'rgba(242,201,76,.96)' : 'rgba(27,70,68,.94)', scale: .58 });
    label.position.copy(pos); label.position.y = 1.12; world.add(label);
  }

  const internationalPoints = {
    Denmark: new THREE.Vector3(-4.6, .45, 5.5),
    Germany: new THREE.Vector3(-2.6, .45, 7.3),
    USA: new THREE.Vector3(-7.0, .45, -1.6),
    Finland: new THREE.Vector3(6.1, .45, -4.6)
  };
  for (const [country, pos] of Object.entries(internationalPoints)) {
    const gateway = country === 'USA' || country === 'Finland' ? 'stockholm' : 'goteborg';
    const curve = arcCurve(cityWorldPosition(gateway).toArray(), pos.toArray(), 1.35);
    routeTube(curve, country === 'USA' ? 0x8a79a8 : 0x6b8d8c, .045);
    viewState.routeCurves.set(`${gateway}:${country}`, curve);
    viewState.routeCurves.set(`${country}:${gateway}`, new THREE.CatmullRomCurve3(curve.getPoints(40).reverse()));
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.16,20), material(0xffffff));
    dot.position.copy(pos); world.add(dot);
    const label = makeLabel(country, { scale: .48, bold: true }); label.position.copy(pos); label.position.y = .9; world.add(label);
  }

  simulation.nationalTrucks.forEach(truck => {
    const curve = viewState.routeCurves.get(`${truck.from}:${truck.to}`);
    if (!curve) return;
    let mesh = cloneAsset('truck', { target: .68, position: curve.getPoint(0).toArray(), rotation: [0,0,0], shadow: true });
    if (!mesh) mesh = boxMesh([.55,.28,.25], 0xf2c94c, curve.getPoint(0).toArray());
    addUserData(mesh, { entityType: 'truck', truckId: truck.id }); world.add(mesh);
    viewState.nationalTrucks.set(truck.id, { mesh, curve });
  });

  simulation.internationalTransports.forEach(transport => {
    const curve = viewState.routeCurves.get(`${transport.from}:${transport.to}`);
    if (!curve) return;
    const mesh = createTransportMarker(transport.from === 'USA' || transport.to === 'USA' ? 'air' : 'sea');
    addUserData(mesh, { entityType: 'transport', transportId: transport.id });
    world.add(mesh); viewState.international.set(transport.id, { mesh, curve });
  });

  const title = makeLabel('SWEDEN NETWORK', { fg: '#fff', bg: 'rgba(16,36,35,.94)', scale: .68 });
  title.position.set(-2.7, 1.25, -5.35); world.add(title);
}

function createTransportMarker(kind) {
  const group = new THREE.Group();
  if (kind === 'air') {
    const body = new THREE.Mesh(new THREE.ConeGeometry(.16,.72,4), material(0x7b6aa2,.4,.2));
    body.rotation.z = -Math.PI/2; body.rotation.y = Math.PI/4; group.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(.14,.04,.62), material(0x7b6aa2,.4,.2)); group.add(wing);
  } else {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(.5,.18,.25), material(0x2d6967,.5,.1)); hull.position.y=.05; group.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(.18,.2,.18), material(0xffffff)); cabin.position.set(-.08,.18,0); group.add(cabin);
  }
  group.scale.setScalar(.95); return group;
}

function updateSceneVisuals() {
  if (currentLevel === 'depot') updateDepotVisuals();
  if (currentLevel === 'region') updateRegionVisuals();
  if (currentLevel === 'sweden') updateSwedenVisuals();
}

let depotPackageSyncAt = -1;
