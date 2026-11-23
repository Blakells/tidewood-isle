// Tidewood Isle — player character: blocky model, voxel collision, walking / swimming.
'use strict';
(function () {
  const matCache = {};
  G.flatMat = function (color) {
    return matCache[color] || (matCache[color] = new THREE.MeshLambertMaterial({ color }));
  };
  // box helper: centred on x/z, sitting on y = 0 unless offsets are given
  // Characters are built from soft "pillow" shapes: a box whose corners are pulled in toward an
  // ellipsoid and shaded smoothly, so nothing on them has a hard cubic edge.
  const pillowCache = {};
  function pillow(w, h, d) {
    const key = w.toFixed(3) + '|' + h.toFixed(3) + '|' + d.toFixed(3);
    if (pillowCache[key]) return pillowCache[key];
    const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3);
    const p = g.attributes.position, nrm = g.attributes.normal;
    const hx = w / 2, hy = h / 2, hz = d / 2, k = 0.42;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / hx, y = p.getY(i) / hy, z = p.getZ(i) / hz;
      const l = Math.hypot(x, y, z) || 1;
      // blend the box corner toward the matching point on the ellipsoid
      const sx = x / l, sy = y / l, sz = z / l;
      const m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
      const rx = x + (sx * m * 1.18 - x) * k, ry = y + (sy * m * 1.18 - y) * k, rz = z + (sz * m * 1.18 - z) * k;
      p.setXYZ(i, rx * hx, ry * hy, rz * hz);
      const nl = Math.hypot(rx / hx, ry / hy, rz / hz) || 1;
      nrm.setXYZ(i, rx / hx / nl, ry / hy / nl, rz / hz / nl);
    }
    return (pillowCache[key] = g);
  }
  G.box = function (w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(pillow(w, h, d), G.flatMat(color));
    m.position.set(x || 0, (y || 0) + h / 2, z || 0);
    m.castShadow = true;
    return m;
  };

  const P = G.player = {
    pos: new THREE.Vector3(80, 20, 80),
    vel: new THREE.Vector3(),
    yaw: 0,              // facing angle (radians), 0 = +z
    onGround: false,
    swimming: false,
    sitting: null,       // {x,y,z} when seated
    sleeping: false,
    hw: 0.24, height: 1.45,
    walkPhase: 0,
    swing: 0,            // tool swing animation timer
    pep: 0,              // seconds of speed boost from snacks
    look: { skin: 0xffd9b8, hair: 0x7a4a2a, shirt: 0xff8f7a, shorts: 0x5f93c9, hat: 0xf2d88a, hairStyle: 'short', hatStyle: 'straw', outfit: 'tee' },
  };

  G.buildPlayerModel = function () {
    if (P.model) G.scene.remove(P.model);
    const L = P.look;
    const root = new THREE.Group();
    const body = new THREE.Group();          // everything that bobs
    root.add(body);
    const mkLimb = (w, h, d, color, x, y) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      pivot.add(G.box(w, h, d, color, 0, -h, 0));
      return pivot;
    };
    const outfit = L.outfit || 'tee';
    const legColor = outfit === 'dress' ? L.skin : L.shorts;
    // legs (pivot at hip) with little shoes
    P.legL = mkLimb(0.17, 0.32, 0.2, legColor, -0.11, 0.32);
    P.legR = mkLimb(0.17, 0.32, 0.2, legColor, 0.11, 0.32);
    P.legL.add(G.box(0.18, 0.09, 0.26, 0xfaf7f0, 0, -0.32, 0.03));
    P.legR.add(G.box(0.18, 0.09, 0.26, 0xfaf7f0, 0, -0.32, 0.03));
    body.add(P.legL, P.legR);
    // torso
    body.add(G.box(0.42, 0.4, 0.27, L.shirt, 0, 0.32, 0));
    if (outfit === 'dress') {
      body.add(G.box(0.54, 0.2, 0.38, L.shirt, 0, 0.24, 0));           // skirt flare
      body.add(G.box(0.44, 0.05, 0.29, 0xfaf7f0, 0, 0.42, 0));         // waist ribbon
    } else if (outfit === 'overalls') {
      body.add(G.box(0.3, 0.26, 0.03, L.shorts, 0, 0.32, 0.135));      // bib
      body.add(G.box(0.07, 0.4, 0.28, L.shorts, -0.13, 0.33, 0));      // straps
      body.add(G.box(0.07, 0.4, 0.28, L.shorts, 0.13, 0.33, 0));
      body.add(G.box(0.05, 0.05, 0.02, 0xf7cf6b, -0.09, 0.5, 0.15)); body.add(G.box(0.05, 0.05, 0.02, 0xf7cf6b, 0.09, 0.5, 0.15));
    } else {
      body.add(G.box(0.44, 0.06, 0.29, legColor, 0, 0.3, 0));          // waistband
    }
    // arms (pivot at shoulder)
    P.armL = mkLimb(0.13, 0.36, 0.16, L.shirt, -0.28, 0.7);
    P.armR = mkLimb(0.13, 0.36, 0.16, L.shirt, 0.28, 0.7);
    P.armL.add(G.box(0.13, 0.12, 0.16, L.skin, 0, -0.38, 0));
    P.armR.add(G.box(0.13, 0.12, 0.16, L.skin, 0, -0.38, 0));
    body.add(P.armL, P.armR);

    // big friendly head
    const head = new THREE.Group();
    head.position.set(0, 0.73, 0);
    head.add(G.box(0.62, 0.54, 0.54, L.skin, 0, 0, 0));
    const fz = 0.286;
    P.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = G.box(0.1, 0.15, 0.02, 0x3a2e2a, sx * 0.145, 0.19, fz);              // eye
      head.add(eye); P.eyes.push(eye);
      head.add(G.box(0.04, 0.05, 0.02, 0xffffff, sx * 0.145 + 0.025, 0.285, fz + 0.006)); // sparkle
      head.add(G.box(0.12, 0.06, 0.02, 0xffb0a8, sx * 0.235, 0.105, fz));           // blush
    }
    head.add(G.box(0.1, 0.035, 0.02, 0xd9756a, 0, 0.1, fz));                          // smile
    head.add(G.box(0.03, 0.035, 0.02, 0xd9756a, -0.06, 0.125, fz)); head.add(G.box(0.03, 0.035, 0.02, 0xd9756a, 0.06, 0.125, fz));

    // hair
    const hs = L.hairStyle || 'short';
    head.add(G.box(0.66, 0.16, 0.58, L.hair, 0, 0.42, 0));                             // top
    head.add(G.box(0.66, 0.42, 0.14, L.hair, 0, 0.14, -0.24));                         // back
    head.add(G.box(0.66, 0.1, 0.1, L.hair, 0, 0.38, 0.25));                            // fringe
    head.add(G.box(0.08, 0.3, 0.3, L.hair, -0.31, 0.2, -0.06)); head.add(G.box(0.08, 0.3, 0.3, L.hair, 0.31, 0.2, -0.06));
    if (hs === 'long') {
      head.add(G.box(0.66, 0.5, 0.12, L.hair, 0, -0.3, -0.25));
      head.add(G.box(0.09, 0.42, 0.16, L.hair, -0.31, -0.18, -0.1)); head.add(G.box(0.09, 0.42, 0.16, L.hair, 0.31, -0.18, -0.1));
    } else if (hs === 'buns') {
      head.add(G.box(0.2, 0.2, 0.2, L.hair, -0.26, 0.5, -0.06)); head.add(G.box(0.2, 0.2, 0.2, L.hair, 0.26, 0.5, -0.06));
    } else if (hs === 'pony') {
      head.add(G.box(0.16, 0.16, 0.16, L.hair, 0, 0.36, -0.36));
      head.add(G.box(0.14, 0.4, 0.14, L.hair, 0, -0.04, -0.4));
    } else if (hs === 'bob') {
      head.add(G.box(0.7, 0.3, 0.6, L.hair, 0, 0.02, -0.03));
      head.add(G.box(0.5, 0.32, 0.06, L.skin, 0, 0.02, 0.272));                        // keep the face clear
    }
    // hat
    const hat = L.hatStyle || 'straw';
    if (hat === 'straw') {
      head.add(G.box(0.92, 0.05, 0.92, L.hat, 0, 0.56, 0));
      head.add(G.box(0.52, 0.18, 0.52, L.hat, 0, 0.61, 0));
      head.add(G.box(0.54, 0.06, 0.54, L.shirt, 0, 0.61, 0));
    } else if (hat === 'bow') {
      head.add(G.box(0.2, 0.16, 0.08, L.hat, -0.14, 0.58, 0.08)); head.add(G.box(0.2, 0.16, 0.08, L.hat, 0.14, 0.58, 0.08));
      head.add(G.box(0.1, 0.1, 0.1, 0xffffff, 0, 0.61, 0.08));
    } else if (hat === 'flower') {
      head.add(G.box(0.7, 0.06, 0.62, 0x6fbf62, 0, 0.56, 0));
      const cols = [L.hat, 0xffffff, 0xffd84a, L.hat, 0xf7a3c8];
      [[-0.26, 0.24], [0, 0.3], [0.26, 0.24], [-0.3, -0.05], [0.3, -0.05]].forEach((q, k) => head.add(G.box(0.14, 0.12, 0.14, cols[k], q[0], 0.58, q[1])));
    } else if (hat === 'cap') {
      head.add(G.box(0.64, 0.16, 0.6, L.hat, 0, 0.56, 0));
      head.add(G.box(0.5, 0.05, 0.26, L.hat, 0, 0.56, 0.38));
      head.add(G.box(0.12, 0.08, 0.02, 0xffffff, 0, 0.6, 0.305));
    }
    P.head = head;
    body.add(head);
    // held item anchor (right hand)
    P.hand = new THREE.Group();
    P.hand.position.set(0, -0.4, 0.12);
    P.armR.add(P.hand);
    P.body = body;
    P.model = root;
    G.scene.add(root);
  };

  // ---------- collision ----------
  const tmpBoxes = [];
  // Collect world-space collision boxes overlapping a region
  G.collectBoxes = function (minX, minY, minZ, maxX, maxY, maxZ, out) {
    out.length = 0;
    const x0 = Math.floor(minX) - 1, x1 = Math.floor(maxX) + 1;
    const y0 = Math.floor(minY) - 2, y1 = Math.floor(maxY) + 1;
    const z0 = Math.floor(minZ) - 1, z1 = Math.floor(maxZ) + 1;
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const id = G.getBlock(x, y, z);
      if (!id) continue;
      if (x < 0 || z < 0 || x >= G.W || z >= G.D) continue;
      const def = G.BLOCKS[id];
      let col = def.col;
      if (!col && def.colOn === undefined) continue;
      const meta = y >= 0 ? G.getMeta(x, y, z) : 0;
      if ((meta & 4) && def.colOn !== undefined) col = def.colOn;
      if (!col) continue;
      const rot = def.rot ? meta & 3 : 0;
      if (def.connect) {
        // rails toward neighbouring fences and walls are solid too
        const link = (ax, az) => { const nd = G.getDef(ax, y, az); return nd && (nd.connect || (nd.shape === 'cube' && nd.col)); };
        const arms = [[0.375, 0.375, 0.625, 0.625]];
        if (link(x + 1, z)) arms.push([0.625, 0.4, 1, 0.6]);
        if (link(x - 1, z)) arms.push([0, 0.4, 0.375, 0.6]);
        if (link(x, z + 1)) arms.push([0.4, 0.625, 0.6, 1]);
        if (link(x, z - 1)) arms.push([0.4, 0, 0.6, 0.375]);
        for (const a of arms) {
          const b = [x + a[0], y, z + a[1], x + a[2], y + 1.6, z + a[3]];
          if (b[3] > minX && b[0] < maxX && b[4] > minY && b[1] < maxY && b[5] > minZ && b[2] < maxZ) out.push(b);
        }
        continue;
      }
      for (const c of col) {
        let bx0 = c[0], bz0 = c[2], bx1 = c[3], bz1 = c[5];
        for (let r = 0; r < rot; r++) { const nx0 = 1 - bz1, nx1 = 1 - bz0, nz0 = bx0, nz1 = bx1; bx0 = nx0; bx1 = nx1; bz0 = nz0; bz1 = nz1; }
        const b = [x + bx0, y + c[1], z + bz0, x + bx1, y + c[4], z + bz1];
        if (b[3] > minX && b[0] < maxX && b[4] > minY && b[1] < maxY && b[5] > minZ && b[2] < maxZ) out.push(b);
      }
    }
    return out;
  };

  function collides(px, py, pz, hw, h) {
    return G.collectBoxes(px - hw, py, pz - hw, px + hw, py + h, pz + hw, tmpBoxes).length > 0;
  }
  G.aabbFree = (px, py, pz, hw, h) => !collides(px, py, pz, hw, h);

  // Move an AABB (feet-centred) through the voxel world.  Returns flags.
  G.moveBody = function (pos, vel, hw, h, dt, canStep, stick) {
    const res = { hitX: false, hitZ: false, ground: false, ceil: false };
    const eps = 0.001;
    // --- horizontal, one axis at a time ---
    for (const axis of ['x', 'z']) {
      const d = vel[axis] * dt;
      if (d === 0) continue;
      const old = pos[axis];
      pos[axis] += d;
      if (collides(pos.x, pos.y + eps, pos.z, hw, h - eps)) {
        // step up small ledges (slabs, stairs) and single blocks, so slopes are simply walked up
        const sh = !canStep ? 0 : !collides(pos.x, pos.y + 0.56, pos.z, hw, h) ? 0.56 : !collides(pos.x, pos.y + 1.03, pos.z, hw, h) ? 1.03 : 0;
        if (sh) {
          pos.y += sh;
          // settle back down onto the step
          let drop = 0;
          while (drop < sh && !collides(pos.x, pos.y - 0.04, pos.z, hw, h)) { pos.y -= 0.04; drop += 0.04; }
        } else {
          pos[axis] = old;
          if (axis === 'x') res.hitX = true; else res.hitZ = true;
          vel[axis] = 0;
        }
      }
    }
    // --- vertical ---
    const dy = vel.y * dt;
    pos.y += dy;
    const boxes = G.collectBoxes(pos.x - hw, pos.y, pos.z - hw, pos.x + hw, pos.y + h, pos.z + hw, tmpBoxes);
    if (boxes.length) {
      if (dy <= 0) {
        let top = -Infinity;
        for (const b of boxes) if (b[4] > top) top = b[4];
        pos.y = top + eps * 0.5;
        res.ground = true;
      } else {
        let bottom = Infinity;
        for (const b of boxes) if (b[1] < bottom) bottom = b[1];
        pos.y = bottom - h - eps;
        res.ceil = true;
      }
      vel.y = 0;
    } else if (stick && dy <= 0 && vel.y > -6) {
      // walking off a one-block ledge: stay glued to the ground instead of hopping down
      const below = G.collectBoxes(pos.x - hw, pos.y - 1.08, pos.z - hw, pos.x + hw, pos.y, pos.z + hw, tmpBoxes);
      if (below.length) {
        let top = -Infinity;
        for (const b of below) if (b[4] > top) top = b[4];
        if (top <= pos.y + 0.001) { pos.y = top + eps * 0.5; vel.y = 0; res.ground = true; }
      }
    }
    return res;
  };

  const WALK = 4.3, RUN = 6.4, SWIM = 2.6, GRAV = 26, JUMP = 8.0;

  G.updatePlayer = function (dt, input) {
    if (P.sleeping) { animate(dt, 0); return; }
    // wish direction, relative to the camera
    let mx = 0, mz = 0;
    if (!G.ui || !G.ui.blocking()) {
      if (input.keys.KeyW || input.keys.ArrowUp) mz -= 1;
      if (input.keys.KeyS || input.keys.ArrowDown) mz += 1;
      if (input.keys.KeyA || input.keys.ArrowLeft) mx -= 1;
      if (input.keys.KeyD || input.keys.ArrowRight) mx += 1;
    }
    if (G.autoMove) { mx = G.autoMove.x; mz = G.autoMove.z; }
    const moving = mx !== 0 || mz !== 0;
    if (moving && P.sitting) G.standUp();
    if (P.sitting && !P.riding) { animate(dt, 0); return; }

    const cy = G.cam.yaw;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    // camera looks along (-sin yaw, -cos yaw); "forward" on screen is away from the camera
    const fx = -Math.sin(cy), fz = -Math.cos(cy);
    const rx = -fz, rz = fx;
    const wx = rx * mx - fx * mz, wz = rz * mx - fz * mz;

    // paddling the rowboat replaces walking entirely
    if (P.riding) { G.driveBoat(P.riding, dt, moving ? wx : 0, moving ? wz : 0, input); animate(dt, 0); return; }

    // water check
    const feetCell = Math.floor(P.pos.y + 0.05);
    const inWater = P.pos.y < G.WATER_Y - 0.2 && G.getBlock(Math.floor(P.pos.x), Math.max(0, feetCell), Math.floor(P.pos.z)) === 0 && P.pos.y < G.SEA;
    const deep = inWater && P.pos.y < G.WATER_Y - 0.95;
    const wasSwimming = P.swimming;
    P.swimming = deep || (wasSwimming && inWater && P.pos.y < G.WATER_Y - 0.55 && !P.onGround);

    const run = input.keys.ShiftLeft || input.keys.ShiftRight;
    let speed = P.swimming ? SWIM : inWater ? WALK * 0.75 : run ? RUN : WALK;
    if (P.pep > 0) { speed *= 1.25; P.pep -= dt; }
    const accel = P.onGround || P.swimming ? 14 : 6;
    const tx = moving ? wx * speed : 0, tz = moving ? wz * speed : 0;
    const k = Math.min(1, accel * dt);
    P.vel.x += (tx - P.vel.x) * k;
    P.vel.z += (tz - P.vel.z) * k;

    if (moving) {
      const target = Math.atan2(wx, wz);
      let diff = G.mod(target - P.yaw + Math.PI, Math.PI * 2) - Math.PI;
      P.yaw += diff * Math.min(1, 12 * dt);
    }

    const wantJump = input.keys.Space && (!G.ui || !G.ui.blocking());
    if (P.swimming) {
      // float so the head stays above the surface
      const floatY = G.WATER_Y - 0.8;        // head and shoulders above the surface
      P.vel.y += ((floatY - P.pos.y) * 9 - P.vel.y * 4) * dt;
      if (wantJump) P.vel.y = Math.max(P.vel.y, 2.4);
    } else {
      P.vel.y -= GRAV * dt;
      if (P.vel.y < -30) P.vel.y = -30;
      if (wantJump && P.onGround) { P.vel.y = JUMP; P.onGround = false; G.emit('sfx', 'jump'); }
    }

    const res = G.moveBody(P.pos, P.vel, P.hw, P.height, dt, P.onGround || P.swimming, P.onGround && !wantJump);
    P.onGround = res.ground;

    // cozy auto-hop: walking into a one-block ledge hops up it
    if ((res.hitX || res.hitZ) && moving && (P.onGround || P.swimming || inWater)) {
      const ax = P.pos.x + wx * 0.45, az = P.pos.z + wz * 0.45;
      const up = P.swimming ? 1.5 : 1.05;
      if (G.aabbFree(ax, P.pos.y + up, az, P.hw, P.height) && G.aabbFree(P.pos.x, P.pos.y + up, P.pos.z, P.hw, P.height)) {
        P.vel.y = P.swimming ? 7.6 : JUMP;
        P.onGround = false;
      }
    }

    // keep inside the world, and never fall out of it
    P.pos.x = G.clamp(P.pos.x, 1.5, G.W - 1.5);
    P.pos.z = G.clamp(P.pos.z, 1.5, G.D - 1.5);
    if (P.pos.y < -5) { P.pos.set(G.world.spawn.x, G.world.spawn.y + 1, G.world.spawn.z); P.vel.set(0, 0, 0); }

    const hs = Math.hypot(P.vel.x, P.vel.z);
    if (inWater && hs > 0.8) {
      P.rippleT = (P.rippleT || 0) - dt;
      if (P.rippleT <= 0) { P.rippleT = 0.16; G.burst(P.pos.x, G.WATER_Y + 0.04, P.pos.z, { n: 2, colors: [0xffffff, 0xdff5fb], speed: 1.1, up: 0.7, grav: 4, life: 0.5, size: 0.07, spread: 0.3 }); }
    }
    if (hs > 0.5 && P.onGround) {
      P.stepTimer = (P.stepTimer || 0) + dt * hs;
      if (P.stepTimer > 2.1) {
        P.stepTimer = 0; G.emit('sfx', 'step');
        const under = G.getBlock(Math.floor(P.pos.x), Math.floor(P.pos.y - 0.5), Math.floor(P.pos.z));
        const puff = under === G.B.sand ? 0xf3e2b8 : under === G.B.grass ? 0xa6e082 : 0;
        if (puff) G.burst(P.pos.x, (P.visY || P.pos.y) + 0.06, P.pos.z, { n: 2, color: puff, speed: 0.7, up: 0.8, grav: 3, life: 0.4, size: 0.07, spread: 0.12 });
      }
      // a trail of footprints across the beach
      if (!inWater && !P.swimming) G.trackPrints(P, dt, hs, 1);
    }
    animate(dt, hs);
  };

  function animate(dt, hs) {
    const m = P.model;
    if (!m) return;
    m.position.copy(P.pos);
    if (!P.swimming && !P.riding && !P.sitting && !P.sleeping) {
      // ease toward the drawn ground height so walking over slopes is smooth
      const want = G.visualGroundY(P.pos.x, P.pos.y, P.pos.z, P.onGround);
      P.visY = P.visY === undefined || Math.abs(want - P.visY) > 1.6 ? want : P.visY + (want - P.visY) * Math.min(1, dt * 22);
      m.position.y = P.visY;
    } else P.visY = undefined;
    m.rotation.y = P.yaw;
    const t = performance.now() * 0.001;
    let legSwing = 0, armSwing = 0, bob = 0, lean = 0;
    if (P.sleeping || P.lying) {
      m.rotation.x = -Math.PI / 2;
      m.position.y += 0.3;
    } else {
      m.rotation.x = 0;
    }
    if (P.sitting || P.riding) {
      P.legL.rotation.x = P.legR.rotation.x = -Math.PI / 2;
      P.armL.rotation.x = P.armR.rotation.x = -0.3;
      P.body.position.y = Math.sin(t * 2) * 0.01;
      P.body.rotation.x = 0;
    } else {
      if (hs > 0.4) {
        P.walkPhase += dt * (P.swimming ? 6 : 2.6 + hs * 1.9);
        legSwing = Math.sin(P.walkPhase) * Math.min(0.9, hs * 0.22);
        armSwing = -legSwing * 0.9;
        bob = Math.abs(Math.sin(P.walkPhase)) * 0.05;
      } else {
        bob = Math.sin(t * 2.2) * 0.012;
      }
      if (P.swimming) { lean = 0.5; bob = Math.sin(t * 3) * 0.04; legSwing = Math.sin(t * 7) * 0.5; armSwing = Math.sin(t * 4) * 1.1 - 1.4; }
      P.legL.rotation.x = legSwing; P.legR.rotation.x = -legSwing;
      P.armL.rotation.x = armSwing;
      P.armR.rotation.x = -armSwing;
      P.body.position.y = bob;
      P.body.rotation.x += (lean - P.body.rotation.x) * Math.min(1, dt * 8);
      if (!P.onGround && !P.swimming) { P.armL.rotation.x = -2.6; P.armR.rotation.x = -2.6; P.legL.rotation.x = 0.3; P.legR.rotation.x = -0.3; }
    }
    // blink now and then
    P.blink = (P.blink || 3) - dt;
    if (P.blink < -0.12) P.blink = 2.5 + Math.random() * 3.5;
    if (P.eyes) for (const e of P.eyes) e.scale.y = P.blink < 0 || P.sleeping ? 0.12 : 1;
    if (P.wave > 0) {
      P.wave -= dt;
      P.armL.rotation.x = 0; P.armL.rotation.z = -2.5 + Math.sin(performance.now() * 0.02) * 0.45;
    } else P.armL.rotation.z = 0;
    if (P.swing > 0) {
      P.swing -= dt;
      const s = 1 - Math.max(0, P.swing) / 0.28;
      P.armR.rotation.x = -2.2 + Math.sin(s * Math.PI) * 1.6;
    } else if (G.heldItemId && !P.swimming && !P.sitting) {
      P.armR.rotation.x = Math.min(P.armR.rotation.x, 0) - 0.5;
    }
    if (G.fishing && G.fishing.state !== 'idle') P.armR.rotation.x = -1.3 + Math.sin(t * 2) * 0.04;
  }

  G.sitOn = function (x, y, z, def) {
    const meta = G.getMeta(x, y, z);
    if (P.riding && G.dismountBoat) G.dismountBoat();
    P.sitting = { x, y, z };
    P.lying = !!def.lie;
    const rest = def.rides ? G.groundOffsetAt(x + 0.5, y, z + 0.5) : 0;      // seats resting on a slope sit a little lower or higher
    P.pos.set(x + 0.5, y + rest + (def.sitY || 0.5) - (def.lie ? 0.1 : 0.36), z + 0.5);
    P.vel.set(0, 0, 0);
    if (def.rot) { const f = G.FRONT[meta & 3]; P.yaw = Math.atan2(f[0], f[1]); }
    G.emit('sit', def.key);
  };
  G.standUp = function () {
    if (!P.sitting) return;
    const s = P.sitting;
    P.sitting = null; P.lying = false;
    // hop to a free neighbouring spot
    for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0], [0, -1], [0, 0]]) {
      if (G.aabbFree(s.x + 0.5 + dx, s.y + 0.02, s.z + 0.5 + dz, P.hw, P.height)) { P.pos.set(s.x + 0.5 + dx, s.y + 0.02, s.z + 0.5 + dz); return; }
    }
    P.pos.set(s.x + 0.5, s.y + 1.05, s.z + 0.5);
  };
})();
