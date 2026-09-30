// Compact: a low-poly city hatch built from primitives at runtime (no model file).
// car-models.js builds it once as the car's source model and then treats it like the
// GLB cars: it clones it per visual, scales it to the stage, paints it, outlines it and
// rigs its wheels. So this module only shapes the car and says which parts are what:
//
// - Paint: painted materials carry userData.turnPaintRole: 'primary' for the body, and
//   'secondary' for the dark trim (grille, intake, pillars, arch liners). The rim, wheel
//   dish and hub cap follow the body paint, the dish darker and the hub lighter
//   (userData.turnPaintShade), so a repaint in GARAGE recolours the wheels too.
// - Outline: an inverted hull (vertices pushed along their averaged face normals, so
//   every flat face moves the same distance) in the shared car outline material, marked
//   userData.turnOutline like the outlines car-models.js adds to the GLB cars. A uniform
//   scale outline would drift off the parts that are not built around the car's centre.
// - Wheels: named like the authored GLB wheels (wheel-front-left …) so TURN's wheel rig
//   steers the fronts and rolls all four. The rig rolls a wheel by decreasing its
//   rotation about the wheel's authored X axis, which on this car (+Z forward) would
//   roll it backwards; so each wheel is authored half a turn round, with its parts
//   turned back, and the rig's roll carries it forwards.
//
// Axes: +Z forward, +Y up, +X = the car's left. Origin on the ground at the centre of
// the wheelbase. Units are the design's own; car-models.js scales the car to the stage
// and turns it half a turn to face -Z, like every TURN car visual.

export const COMPACT_DEFAULT_BODY_COLOR = 0xa2c14f;

export function createCompactCar(THREE, {
  bodyColor = COMPACT_DEFAULT_BODY_COLOR,
  outlineMaterial = null,
  outlineWidth = 0.022
} = {}) {
  const o = {
    bodyColor,
    trimColor: 0x1d2026,
    glassColor: 0xeef5ff,
    tireColor: 0x2f3137,
    lightColor: 0xffd23f,
    tailColor: 0xe8453c,
    plateColor: 0xeff1f5,
    outlineWidth
  };

  // ---- Dimensions (origin = ground, centre of wheelbase; +Z forward, +Y up, +X = car's left)
  const W = 1.12;            // lower body width
  const WC = 1.00;           // cabin width
  const WB = 1.28;           // wheelbase
  const TRACK = 0.98;        // wheel centre to wheel centre
  const WR = 0.24;           // tyre radius
  const AR = 0.31;           // arch radius (at the body side)
  const BEV = 0.04;          // chamfer on body + cabin shells
  const FLOOR = 0.16;        // underside height
  const AXLE_Z = WB / 2, WHEEL_Y = WR, WHEEL_X = TRACK / 2;
  const archA = Math.asin((WHEEL_Y - FLOOR) / AR);

  // ---- Materials. Names follow the GLB conventions car-models.js reads (glass, light,
  // wheel …); paint roles and shades are declared for its paint pass.
  const mat = (name, color, extra = {}) => {
    const material = new THREE.MeshStandardMaterial(
      Object.assign({ color, roughness: 0.75, metalness: 0, flatShading: true }, extra));
    material.name = name;
    return material;
  };
  const paint = (material, shade = null, role = 'primary') => {
    material.userData.turnPaintRole = role;
    if (shade) material.userData.turnPaintShade = shade;
    return material;
  };
  // Paint is matte like TURN's other cars (their finish keeps roughness at 0.76 and up),
  // so bright colours are not washed out under the showroom's strong light.
  const M = {
    body: paint(mat('compact-body-paint', o.bodyColor, { roughness: 0.78 })),
    trim: paint(mat('compact-trim-paint', o.trimColor, { roughness: 0.9 }), null, 'secondary'),
    glass: mat('compact-glass', o.glassColor, { roughness: 0.25, emissive: 0x9fb6d6, emissiveIntensity: 0.18 }),
    tire: mat('compact-tire', o.tireColor, { roughness: 0.95 }),
    // TURN-style wheels: rim, recessed dish and hub cap all follow the paint.
    rim: paint(mat('compact-rim-paint', o.bodyColor, { roughness: 0.76, side: THREE.DoubleSide })),
    dish: paint(mat('compact-dish-paint', o.bodyColor, { roughness: 0.8 }), { multiply: 0.58 }),
    hub: paint(mat('compact-hub-paint', o.bodyColor, { roughness: 0.76 }), { lighten: 0.22 }),
    light: mat('compact-headlight', o.lightColor, { emissive: o.lightColor, emissiveIntensity: 0.45 }),
    tail: mat('compact-taillight', o.tailColor, { emissive: o.tailColor, emissiveIntensity: 0.35 }),
    plate: mat('compact-plate', o.plateColor, { roughness: 0.6 }),
    well: mat('compact-wheel-well', 0x0c0d10, { roughness: 1 }),
    seam: new THREE.MeshBasicMaterial({ color: 0x111111, name: 'compact-seam' })
  };
  M.dish.color.multiplyScalar(0.58);
  M.hub.color.lerp(new THREE.Color(0xffffff), 0.22);

  // ---- Inverted-hull outline: vertices pushed along the averaged face normal, scaled so
  // every flat face moves exactly `t` (crisp box edges, no gaps at split normals).
  const hullCache = new Map();
  function hullGeometry(geo, t) {
    const cacheKey = geo.uuid + ':' + t.toFixed(4);
    if (hullCache.has(cacheKey)) return hullCache.get(cacheKey);
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.normal) g.deleteAttribute('normal');
    if (g.attributes.uv) g.deleteAttribute('uv');
    const p = g.attributes.position, n = p.count;
    const q = v => Math.round(v * 1e4);
    const key = i => q(p.getX(i)) + ',' + q(p.getY(i)) + ',' + q(p.getZ(i));
    const groups = new Map(), keys = new Array(n);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const cb = new THREE.Vector3(), ab = new THREE.Vector3();
    for (let i = 0; i + 2 < n; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      const fn = cb.subVectors(c, b).cross(ab.subVectors(a, b)).clone();
      for (let k = 0; k < 3; k++) keys[i + k] = key(i + k);
      if (fn.lengthSq() < 1e-14) continue;
      fn.normalize();
      for (let k = 0; k < 3; k++) {
        let list = groups.get(keys[i + k]);
        if (!list) groups.set(keys[i + k], list = []);
        if (!list.some(m => m.dot(fn) > 0.999)) list.push(fn);
      }
    }
    const disp = new Map();
    groups.forEach((list, k) => {
      const avg = new THREE.Vector3();
      list.forEach(m => avg.add(m));
      if (avg.lengthSq() < 1e-8) return;
      avg.normalize();
      let minDot = 1;
      list.forEach(m => { minDot = Math.min(minDot, avg.dot(m)); });
      disp.set(k, avg.multiplyScalar(t / Math.max(minDot, 0.35)));
    });
    for (let i = 0; i < n; i++) {
      const d = disp.get(keys[i]);
      if (d) p.setXYZ(i, p.getX(i) + d.x, p.getY(i) + d.y, p.getZ(i) + d.z);
    }
    p.needsUpdate = true;
    g.computeBoundingSphere();
    hullCache.set(cacheKey, g);
    return g;
  }

  // TURN draws its own projected car shadows, so parts cast and receive none.
  function part(parent, geo, material, { pos, rotX = 0, rotY = 0, rotZ = 0, line = 1, hullFrom, name } = {}) {
    const m = new THREE.Mesh(geo, material);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rotX, rotY, rotZ);
    if (name) m.name = name;
    if (line > 0 && outlineMaterial) {
      const hull = new THREE.Mesh(hullGeometry(hullFrom || geo, o.outlineWidth * line), outlineMaterial);
      hull.userData.turnOutline = true;
      m.add(hull);
    }
    parent.add(m);
    return m;
  }

  // Side-profile polygon [z, y][] extruded across X, centred, with a one-step chamfer.
  function profile(pts, width, bevel = BEV) {
    const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const depth = Math.max(0.002, width - 2 * bevel);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, steps: 1, curveSegments: 1,
      bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
    });
    g.rotateY(-Math.PI / 2);   // shape x -> world z, extrusion -> world -x
    g.translate(depth / 2, 0, 0);
    return g;
  }
  function arc(zc, yc, r, from, to, segs) {
    const out = [];
    for (let i = 0; i <= segs; i++) {
      const t = from + (to - from) * i / segs;
      out.push([zc + r * Math.cos(t), yc + r * Math.sin(t)]);
    }
    return out;
  }
  // Thin plate on the face of a profile segment P0->P1. poly: [x, s][] with s = 0..1 along the
  // segment. off = distance of the face from the profile line (the shell's chamfer size).
  function decal(P0, P1, poly, off, thick) {
    const dz = P1[0] - P0[0], dy = P1[1] - P0[1], len = Math.hypot(dz, dy);
    const uz = dz / len, uy = dy / len, nz = uy, ny = -uz;   // along, outward normal
    const shape = new THREE.Shape(poly.map(([x, s]) => new THREE.Vector2(x, s * len)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, steps: 1, curveSegments: 1 });
    g.applyMatrix4(new THREE.Matrix4().set(
      1, 0, 0, 0,
      0, uy, ny, P0[1] + ny * off,
      0, uz, nz, P0[0] + nz * off,
      0, 0, 0, 1));
    return g;
  }
  const rect = (x0, x1, s0, s1) => [[x0, s0], [x1, s0], [x1, s1], [x0, s1]];
  const mirrorX = poly => poly.map(([x, s]) => [-x, s]);
  function seam(z0, y0, z1, y1) {   // thin panel line on both body sides
    const len = Math.hypot(z1 - z0, y1 - y0), g = new THREE.BoxGeometry(0.008, len, 0.011);
    for (const s of [1, -1]) part(body, g, M.seam, {
      pos: [s * (W / 2 + 0.004), (y0 + y1) / 2, (z0 + z1) / 2], rotX: Math.atan2(z1 - z0, y1 - y0), line: 0,
    });
  }

  const root = new THREE.Group();
  root.name = 'compact-car';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // ---- Lower body: short nose, integrated bumpers, high flat belt line
  const F0 = [0.99, 0.22], F1 = [1.0, 0.34], F2 = [0.985, 0.47], F3 = [0.86, 0.585];
  const R0 = [-0.985, 0.64], R1 = [-1.0, 0.32];
  const lower = [
    [-0.95, FLOOR],
    ...arc(-AXLE_Z, WHEEL_Y, AR, Math.PI + archA, -archA, 8),
    ...arc(AXLE_Z, WHEEL_Y, AR, Math.PI + archA, -archA, 8),
    [0.95, FLOOR], F0, F1, F2, F3, [0.50, 0.655],
    [-0.92, 0.66], R0, R1, [-0.99, 0.22],
  ];
  part(body, profile(lower, W), M.body, { name: 'lowerBody' });

  // ---- Cabin: long raked windshield, flat roof, near-vertical hatch (no spoiler)
  const WS0 = [0.55, 0.60], WS1 = [-0.02, 1.11];
  const RW0 = [-0.86, 1.13], RW1 = [-0.96, 0.60];
  part(body, profile([[-0.96, 0.60], WS0, WS1, RW0], WC), M.body, { name: 'cabin' });

  // ---- Faceted fender haunches + dark arch liners
  const FH = 0.61;   // haunch top
  const haunches = [
    [[0.28, FLOOR], [0.30, 0.44], [0.47, FH], [0.81, FH], [0.965, 0.45], [0.975, WHEEL_Y],
      ...arc(AXLE_Z, WHEEL_Y, AR, 0, Math.PI + archA, 8)],
    [[-0.975, WHEEL_Y], [-0.965, 0.45], [-0.81, FH], [-0.47, FH], [-0.30, 0.44], [-0.28, FLOOR],
      ...arc(-AXLE_Z, WHEEL_Y, AR, -archA, Math.PI, 8)],
  ];
  const LI = 0.262, LO = 0.315;
  const liA = Math.asin((WHEEL_Y - FLOOR) / LI), loA = Math.asin((WHEEL_Y - FLOOR) / LO);
  haunches.forEach((pts, i) => {
    const zc = i === 0 ? AXLE_Z : -AXLE_Z;
    const g = profile(pts, 0.10, 0.025);
    for (const s of [1, -1]) part(body, g, M.body, { pos: [s * 0.58, 0, 0], name: 'haunch' });
    const liner = profile([
      ...arc(zc, WHEEL_Y, LO, Math.PI + loA, -loA, 10),
      ...arc(zc, WHEEL_Y, LI, -liA, Math.PI + liA, 10),
    ], 1.27, 0);
    part(body, liner, M.trim, { line: 0, name: 'archLiner' });
    part(body, new THREE.BoxGeometry(0.74, 0.34, 0.50), M.well, { pos: [0, 0.35, zc], line: 0 });
  });

  // ---- Glass (TURN-style light glass) with blacked-out B- and C-pillars
  part(body, decal(WS0, WS1, rect(-0.40, 0.40, 0.22, 0.93), BEV, 0.014), M.glass, { line: 0, name: 'windshield' });
  const rearT = [0.06, 0.68];
  part(body, decal(RW0, RW1, rect(-0.35, 0.35, rearT[0], rearT[1]), BEV, 0.014), M.glass, { line: 0, name: 'rearWindow' });
  for (const s of [1, -1]) part(body, decal(RW0, RW1, rect(s * 0.355, s * 0.445, rearT[0], rearT[1]), BEV, 0.014), M.trim, { line: 0 });
  const sidePanes = [
    { pts: [[-0.34, 0.70], [0.358, 0.70], [-0.033, 1.05], [-0.34, 1.05]], m: M.glass },    // door
    { pts: [[-0.44, 0.70], [-0.34, 0.70], [-0.34, 1.05], [-0.44, 1.05]], m: M.trim },      // B-pillar
    { pts: [[-0.851, 0.70], [-0.44, 0.70], [-0.44, 1.05], [-0.785, 1.05]], m: M.glass },   // quarter
  ];
  for (const { pts, m } of sidePanes) {
    const g = profile(pts, 0.014, 0);
    for (const s of [1, -1]) part(body, g, m, { pos: [s * (WC / 2 + 0.005), 0, 0], line: 0 });
  }

  // ---- Front: swept headlights, grille slot, lower intake
  const headlight = [[0.18, 0.45], [0.51, 0.06], [0.51, 0.92], [0.20, 0.74]];
  part(body, decal(F2, F3, headlight, BEV, 0.03), M.light, { line: 0.6, name: 'headlight_L' });
  part(body, decal(F2, F3, mirrorX(headlight), BEV, 0.03), M.light, { line: 0.6, name: 'headlight_R' });
  part(body, decal(F1, F2, [[-0.14, 0.50], [0.14, 0.50], [0.20, 0.92], [-0.20, 0.92]], BEV, 0.02), M.trim, { line: 0, name: 'grille' });
  part(body, decal(F0, F1, [[-0.36, 0.08], [0.36, 0.08], [0.32, 0.92], [-0.32, 0.92]], BEV, 0.02), M.trim, { line: 0, name: 'intake' });

  // ---- Rear: tall corner tail lights that wrap onto the sides, plate between them
  for (const s of [1, -1]) {
    part(body, decal(R0, R1, rect(s * 0.40, s * 0.515, 0.03, 0.62), BEV, 0.03), M.tail, { line: 0.6, name: 'taillight' });
    // wrap: a piece on the corner chamfer + a sliver on the body side
    const tY = 0.57, tH = 0.12, th = 0.025, k = th / 2 * Math.SQRT1_2;
    const zo = R0[0] + (R1[0] - R0[0]) * ((R0[1] - tY) / (R0[1] - R1[1]));
    part(body, new THREE.BoxGeometry(0.036, tH, th), M.tail, {
      pos: [s * (W / 2 - BEV / 2 + k), tY, zo - BEV / 2 - k], rotY: -s * Math.PI / 4, line: 0,
    });
    part(body, new THREE.BoxGeometry(0.012, tH, 0.05), M.tail, { pos: [s * (W / 2 + 0.006), tY, -0.955], line: 0 });
  }
  part(body, decal(R0, R1, rect(-0.15, 0.15, 0.36, 0.60), BEV, 0.02), M.plate, { line: 0.5, name: 'plate' });

  // ---- Door: panel lines, handle, mirrors
  seam(0.215, 0.25, 0.30, 0.655);     // front edge
  seam(-0.235, 0.25, -0.30, 0.655);   // rear edge
  seam(-0.235, 0.25, 0.215, 0.25);    // sill
  for (const s of [1, -1]) {
    part(body, new THREE.BoxGeometry(0.02, 0.025, 0.10), M.trim, { pos: [s * (W / 2 + 0.008), 0.58, -0.17], line: 0 });
    part(body, new THREE.BoxGeometry(0.08, 0.03, 0.05), M.body, { pos: [s * 0.545, 0.72, 0.31], line: 0 });
    part(body, new THREE.BoxGeometry(0.07, 0.075, 0.11), M.body, { pos: [s * 0.61, 0.75, 0.30], rotY: s * 0.3, line: 0.5, name: 'mirror' });
  }

  // ---- Wheels (TURN style): chamfered tyre, painted rim, recessed dark dish, bright hub cap.
  // wheel-… (the rig's mount; authored half a turn round) > parts (turned back) > flip
  // (mirror for the right side) > meshes.
  const lathe = pts => new THREE.LatheGeometry(pts.map(([r, a]) => new THREE.Vector2(r, a)), 18).rotateZ(-Math.PI / 2);
  const WG = {
    tire: lathe([[0, -0.10], [0.21, -0.10], [0.24, -0.07], [0.24, 0.07], [0.21, 0.10], [0.166, 0.10], [0.166, 0.06], [0, 0.06]]),
    tireHull: lathe([[0, -0.10], [0.21, -0.10], [0.24, -0.07], [0.24, 0.07], [0.21, 0.10], [0, 0.10]]),
    rim: lathe([[0.162, 0.07], [0.162, 0.108], [0.132, 0.108], [0.132, 0.088]]),
    dish: new THREE.CylinderGeometry(0.132, 0.132, 0.01, 18).rotateZ(-Math.PI / 2),
    hub: new THREE.CylinderGeometry(0.078, 0.078, 0.03, 12).rotateZ(-Math.PI / 2),
  };
  function wheel(name, side, z) {
    const mount = new THREE.Group();
    mount.name = name;
    mount.position.set(side * WHEEL_X, WHEEL_Y, z);
    mount.rotation.y = Math.PI;
    const parts = new THREE.Group();
    parts.rotation.y = Math.PI;
    const flip = new THREE.Group();
    flip.rotation.y = side > 0 ? 0 : Math.PI;
    mount.add(parts); parts.add(flip);
    part(flip, WG.tire, M.tire, { line: 0.8, hullFrom: WG.tireHull, name: 'tire' });
    part(flip, WG.rim, M.rim, { line: 0, name: 'rim' });
    part(flip, WG.dish, M.dish, { pos: [0.083, 0, 0], line: 0 });
    part(flip, WG.hub, M.hub, { pos: [0.103, 0, 0], line: 0, name: 'hub' });
    root.add(mount);
  }
  wheel('wheel-front-left', 1, AXLE_Z);
  wheel('wheel-front-right', -1, AXLE_Z);
  wheel('wheel-back-left', 1, -AXLE_Z);
  wheel('wheel-back-right', -1, -AXLE_Z);

  return root;
}
