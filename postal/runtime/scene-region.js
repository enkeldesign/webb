'use strict';
const regionBuildingSets = {
  sundsvall: ['suburbanA', 'suburbanH', 'suburbanL', 'suburbanA'],
  stockholm: ['commercialA', 'commercialH', 'skyscraper', 'commercialA'],
  goteborg: ['industrialB', 'industrialS', 'industrialT', 'industrialS']
};

function buildRegionScene(cityId) {
  scene.background.set(cityId === 'stockholm' ? 0xd9e8ec : 0xddebe3);
  addGround(22, cityId === 'goteborg' ? 0xaecab5 : 0xb9d5b5);
  const city = CITIES[cityId];
  const layout = regionTownLayouts[cityId];

  const district = new THREE.Mesh(new THREE.CylinderGeometry(8.15, 8.35, .16, 48), material(cityId === 'stockholm' ? 0xcbd8d7 : 0xc7d8be));
  district.position.y = .01;
  district.receiveShadow = true;
  world.add(district);

  addRoadTile('roadCross', [0, .13, 0], 3.05, 0);
  addRoadTile('roadCrossing', [3.02, .13, 0], 3.05, 0);
  addRoadTile('roadStraight', [-3.02, .13, 0], 3.05, 0);
  addRoadTile('roadStraight', [0, .13, 3.02], 3.05, Math.PI / 2);
  addRoadTile('roadStraight', [0, .13, -3.02], 3.05, Math.PI / 2);
  addRoadTile('roadEnd', [5.68, .13, 0], 3.05, Math.PI);
  addRoadTile('roadEnd', [-5.68, .13, 0], 3.05, 0);
  addRoadTile('roadEnd', [0, .13, 5.68], 3.05, -Math.PI / 2);
  addRoadTile('roadEnd', [0, .13, -5.68], 3.05, Math.PI / 2);

  const localCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.2, .16, .2), new THREE.Vector3(1.8, .16, 1.7),
    new THREE.Vector3(2.35, .16, 3.0), new THREE.Vector3(.2, .16, .2)
  ], true, 'catmullrom', .2);
  viewState.routeCurves.set(`${cityId}:${city.name}`, localCurve);

  city.towns.forEach((town, index) => {
    const [x, z] = layout[town];
    if (town !== city.name) {
      const curve = new THREE.LineCurve3(new THREE.Vector3(0, .16, 0), new THREE.Vector3(x, .16, z));
      viewState.routeCurves.set(`${cityId}:${town}`, curve);
      buildTownDiorama(cityId, town, index - 1, x, z);
    }
  });

  // The regional hub sits beside the crossroad so traffic remains visible.
  const hubKey = cityId === 'goteborg' ? 'industrialT' : cityId === 'stockholm' ? 'commercialH' : 'industrialS';
  const hub = cloneAsset(hubKey, { target: cityId === 'stockholm' ? 2.45 : 2.25, position: [-1.75, .15, 1.72], rotation: [0, -.18, 0] });
  if (hub) {
    addUserData(hub, { entityType: 'city', cityId });
    world.add(hub);
  }
  const hubLabel = makeLabel(`${city.name} hub`, { fg: '#fff', bg: 'rgba(16,42,41,.94)', scale: .61 });
  hubLabel.position.set(-1.78, 2.28, 1.72);
  addUserData(hubLabel, { entityType: 'city', cityId });
  world.add(hubLabel);

  const handoffPos = [-5.55, 0, -5.35];
  const handoffPad = boxMesh([2.2, .12, 1.7], 0xf2c94c, [handoffPos[0], .11, handoffPos[2]]);
  addUserData(handoffPad, { entityType: 'handoff', cityId });
  world.add(handoffPad);
  const handoffArrow = cloneAsset('handoffArrow', { target: .72, position: [handoffPos[0], .18, handoffPos[2]], rotation: [0, -Math.PI / 4, 0] });
  if (handoffArrow) {
    addUserData(handoffArrow, { entityType: 'handoff', cityId });
    world.add(handoffArrow);
  }
  const handoffLabel = makeLabel('NATIONAL HANDOFF', { fg: '#102a29', bg: 'rgba(242,201,76,.97)', scale: .45 });
  handoffLabel.position.set(handoffPos[0], .94, handoffPos[2]);
  addUserData(handoffLabel, { entityType: 'handoff', cityId });
  world.add(handoffLabel);
  const handoffCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.15, .16, -.15),
    new THREE.Vector3(-2.9, .16, -2.0),
    new THREE.Vector3(handoffPos[0], .16, handoffPos[2])
  ]);
  viewState.routeCurves.set(`${cityId}:national`, handoffCurve);
  const handoffLane = new THREE.Mesh(new THREE.TubeGeometry(handoffCurve, 26, .16, 8, false), material(0x526a69));
  handoffLane.receiveShadow = true;
  world.add(handoffLane);

  addRegionDetails(cityId);

  simulation.cities[cityId].regionalTrucks.forEach((truck, i) => {
    const curve = viewState.routeCurves.get(`${cityId}:${truck.to}`);
    if (!curve) return;
    let mesh = cloneAsset('truck', { target: truck.to === city.name ? .95 : 1.05, position: curve.getPoint(0).toArray() });
    if (!mesh) mesh = boxMesh([.9, .48, .42], 0xf2c94c, [0, .36, 0]);
    addUserData(mesh, { entityType: 'truck', truckId: truck.id });
    world.add(mesh);
    viewState.regionalTrucks.set(truck.id, { mesh, curve, offset: i * .035 });
  });
}

function addRoadTile(key, position, target, rotation) {
  const road = cloneAsset(key, { target, position, rotation: [0, rotation, 0], shadow: false });
  if (road) world.add(road);
  else {
    const fallback = boxMesh([target, .06, target], 0x687674, [position[0], position[1], position[2]]);
    fallback.receiveShadow = true;
    world.add(fallback);
  }
}

function buildTownDiorama(cityId, town, index, x, z) {
  const buildingKeys = regionBuildingSets[cityId];
  const verticalRoute = Math.abs(z) > Math.abs(x);
  const side = index % 2 ? -1 : 1;
  const offset = verticalRoute ? [1.55 * side, 0] : [0, 1.55 * side];
  const bx = x + offset[0];
  const bz = z + offset[1];
  const key = buildingKeys[index % buildingKeys.length];
  const target = key === 'skyscraper' ? 2.35 : cityId === 'goteborg' ? 1.85 : 1.65;
  const building = cloneAsset(key, { target, position: [bx, .15, bz], rotation: [0, index * .48, 0] });
  if (building) {
    addUserData(building, { entityType: 'town', town, cityId });
    world.add(building);
  } else {
    const fallback = boxMesh([1.0, .85, .82], cityId === 'stockholm' ? 0xd9e2e8 : 0xe4d6b7, [bx, .58, bz]);
    addUserData(fallback, { entityType: 'town', town, cityId });
    world.add(fallback);
  }

  const label = makeLabel(town, { scale: .48, fg: '#102a29', bg: 'rgba(255,255,255,.94)' });
  label.position.set(x, 1.18, z);
  addUserData(label, { entityType: 'town', town, cityId });
  world.add(label);

  if (cityId !== 'stockholm') {
    for (let i = 0; i < 2; i++) {
      const tx = verticalRoute ? x - 1.25 + i * 2.5 : x + .85 * side;
      const tz = verticalRoute ? z + .85 * side : z - 1.25 + i * 2.5;
      const tree = cloneAsset(i ? 'treeSmall' : 'treeLarge', { target: .76 + i * .09, position: [tx, .14, tz] });
      if (tree) world.add(tree);
    }
  }
}

function addRegionDetails(cityId) {
  const detailPoints = [[2.0, 2.25], [-2.35, -2.1], [2.25, -2.15], [-2.15, 2.35]];
  detailPoints.forEach(([x, z], i) => {
    if (i < 2) {
      const light = cloneAsset('roadLight', { target: 1.05, position: [x, .14, z], rotation: [0, i ? Math.PI / 2 : 0, 0] });
      if (light) {
        world.add(light);
        viewState.roadLights.push(light);
      }
    } else if (cityId === 'goteborg') {
      const cone = cloneAsset('roadCone', { target: .38, position: [x, .14, z] });
      if (cone) world.add(cone);
    } else {
      const tree = cloneAsset(i % 2 ? 'treeSmall' : 'treeLarge', { target: .72, position: [x, .14, z] });
      if (tree) world.add(tree);
    }
  });
}

// Country outline: Natural Earth 1:110m Admin 0 (public domain).
const SWEDEN_MAIN = [
  [22.183173,65.723741],[21.213517,65.026005],[21.369631,64.413588],[19.778876,63.609554],
  [17.847779,62.7494],[17.119555,61.341166],[17.831346,60.636583],[18.787722,60.081914],
  [17.869225,58.953766],[16.829185,58.719827],[16.44771,57.041118],[15.879786,56.104302],
  [14.666681,56.200885],[14.100721,55.407781],[12.942911,55.361737],[12.625101,56.30708],
  [11.787942,57.441817],[11.027369,58.856149],[11.468272,59.432393],[12.300366,60.117933],
  [12.631147,61.293572],[11.992064,61.800362],[11.930569,63.128318],[12.579935,64.066219],
  [13.571916,64.049114],[13.919905,64.445421],[13.55569,64.787028],[15.108411,66.193867],
  [16.108712,67.302456],[16.768879,68.013937],[17.729182,68.010552],[17.993868,68.567391],
  [19.87856,68.407194],[20.025269,69.065139],[20.645593,69.106247],[21.978535,68.616846],
  [23.539473,67.936009],[23.56588,66.396051],[23.903379,66.006927],[22.183173,65.723741]
];

function projectSweden([lon, lat]) {
  return [(lon - 17.2) * .72, (lat - 62.2) * .82];
}

function makeSwedenExtrusion(coords, color, depth = .34) {
  const shape = new THREE.Shape();
  coords.forEach((coord, i) => {
    const [x, y] = projectSweden(coord);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .08, bevelSize: .07, bevelSegments: 2, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material(color, .78));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
