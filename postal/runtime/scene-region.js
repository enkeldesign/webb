'use strict';
function buildRegionScene(cityId) {
  scene.background.set(0xdce9df);
  addGround(20, 0xb7d6af);
  const city = CITIES[cityId];
  const layout = regionTownLayouts[cityId];

  const centerPad = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.14, 48), material(0xded8c8));
  centerPad.position.y = 0.02;
  centerPad.receiveShadow = true;
  world.add(centerPad);

  const centerDepot = cloneAsset('industrialH', { target: 3.2, position: [0, 0.12, 0], rotation: [0, Math.PI * 0.12, 0] });
  if (centerDepot) world.add(centerDepot);
  else world.add(boxMesh([2.2, 1.2, 1.6], 0x53746e, [0, 0.7, 0]));

  // Give each region a recognisable skyline without adding controls or UI noise.
  if (cityId === 'stockholm') {
    const office = cloneAsset('commercialA', { target: 2.15, position: [-1.75, 0.08, 1.45], rotation: [0, -0.38, 0] });
    const tower = cloneAsset('skyscraper', { target: 3.25, position: [1.8, 0.08, 1.45], rotation: [0, 0.24, 0] });
    if (office) world.add(office);
    if (tower) world.add(tower);
  } else if (cityId === 'goteborg') {
    const industry = cloneAsset('industrialC', { target: 2.5, position: [-1.8, 0.08, 1.55], rotation: [0, -0.25, 0] });
    if (industry) world.add(industry);
  } else {
    const office = cloneAsset('suburbanF', { target: 1.8, position: [-1.65, 0.08, 1.45], rotation: [0, 0.28, 0] });
    if (office) world.add(office);
  }

  city.towns.forEach((town, i) => {
    const [x, z] = layout[town];
    if (town !== city.name) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.05, 0),
        new THREE.Vector3(x * 0.45 + z * 0.07, 0.05, z * 0.45),
        new THREE.Vector3(x, 0.05, z)
      ]);
      const road = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.22, 8, false), material(0x70817d));
      road.receiveShadow = true;
      world.add(road);
      viewState.routeCurves.set(`${cityId}:${town}`, curve);
    }

    if (town !== city.name) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.09, 32), material(0xdad5c8));
      pad.position.set(x, 0.03, z); pad.receiveShadow = true; world.add(pad);
      const buildingKey = i % 2 ? 'suburbanA' : 'suburbanF';
      const building = cloneAsset(buildingKey, { target: 1.45, position: [x, 0.1, z], rotation: [0, i * 0.6, 0] });
      if (building) world.add(building);
      else world.add(boxMesh([0.85, 0.8, 0.75], 0xd9b275, [x, 0.5, z]));
      for (let t = 0; t < 2; t++) {
        const tree = cloneAsset(t ? 'treeSmall' : 'treeLarge', { target: 0.75 + t * 0.12, position: [x - 0.8 + t * 1.5, 0.08, z + 0.55] });
        if (tree) world.add(tree);
      }
    }

    const label = makeLabel(town, { scale: town === city.name ? 0.78 : 0.58, fg: town === city.name ? '#fff' : '#102423', bg: town === city.name ? 'rgba(27,70,68,.94)' : 'rgba(255,255,255,.92)' });
    label.position.set(x, town === city.name ? 2.3 : 1.45, z);
    addUserData(label, { entityType: 'town', town, cityId });
    world.add(label);
  });

  const gatePos = [-5.4, 0, -4.7];
  const gate = boxMesh([1.8, 0.12, 1.5], 0xf2c94c, [gatePos[0], 0.06, gatePos[2]]);
  addUserData(gate, { entityType: 'handoff', cityId }); world.add(gate);
  const gateLabel = makeLabel('TO SWEDEN', { fg: '#102423', bg: 'rgba(242,201,76,.96)', scale: 0.55 });
  gateLabel.position.set(gatePos[0], 0.95, gatePos[2]); world.add(gateLabel);

  const handoffCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .05, 0), new THREE.Vector3(-2.6, .05, -2.4), new THREE.Vector3(gatePos[0], .05, gatePos[2])]);
  world.add(new THREE.Mesh(new THREE.TubeGeometry(handoffCurve, 30, .24, 8, false), material(0x70817d)));
  viewState.routeCurves.set(`${cityId}:national`, handoffCurve);

  simulation.cities[cityId].regionalTrucks.forEach((truck, i) => {
    const curve = viewState.routeCurves.get(`${cityId}:${truck.to}`);
    if (!curve) return;
    let mesh = cloneAsset('truck', { target: 1.2, position: [0, 0.18, 0], rotation: [0, 0, 0] });
    if (!mesh) mesh = boxMesh([0.95, .5, .45], 0xf2c94c, [0, .35, 0]);
    addUserData(mesh, { entityType: 'truck', truckId: truck.id });
    world.add(mesh);
    viewState.regionalTrucks.set(truck.id, { mesh, curve, offset: i * 0.04 });
  });

  const centerLabel = makeLabel(`${city.name} regional hub`, { fg: '#fff', bg: 'rgba(27,70,68,.94)', scale: 0.72 });
  centerLabel.position.set(0, 2.8, 0); world.add(centerLabel);
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
  return [(lon - 17.2) * 0.72, (lat - 62.2) * 0.82];
}

function makeSwedenExtrusion(coords, color, depth = 0.34) {
  const shape = new THREE.Shape();
  coords.forEach((coord, i) => {
    const [x, y] = projectSweden(coord);
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .08, bevelSize: .07, bevelSegments: 2, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material(color, 0.78));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
