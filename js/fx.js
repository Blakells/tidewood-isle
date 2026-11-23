// Tidewood Isle — particles and floating text.
'use strict';
(function () {
  const POOL = 220;
  const parts = [];
  let geo;

  G.initFx = function () {
    geo = new THREE.IcosahedronGeometry(0.6, 1);       // soft round puffs and sparks rather than little cubes
    for (let i = 0; i < POOL; i++) {
      const m = new THREE.Mesh(geo, G.flatMat(0xffffff));
      m.visible = false;
      G.scene.add(m);
      parts.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grav: 0, size: 0.1, shrink: true, spin: 0 });
    }
    const pg = new THREE.CircleGeometry(0.5, 12);
    pg.rotateX(-Math.PI / 2);
    for (let i = 0; i < PRINTS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x33241a, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const m = new THREE.Mesh(pg, mat);
      m.visible = false; m.rotation.order = 'YXZ'; m.renderOrder = 1;
      G.scene.add(m);
      prints.push({ m, life: 0 });
    }
  };

  // Anyone walking on dry sand leaves a trail: call every frame with their horizontal speed.
  G.trackPrints = function (e, dt, hs, size) {
    if (hs < 0.4 || !e.onGround) return;
    const k = size || 1;
    e.printT = (e.printT || 0) + dt * hs;
    if (e.printT < (k < 0.8 ? 0.75 : 0.6)) return;
    e.printT = 0; e.printSide = -(e.printSide || 1);
    const P = G.player.pos;
    if (Math.abs(e.pos.x - P.x) > 28 || Math.abs(e.pos.z - P.z) > 28) return;
    if (G.getBlock(Math.floor(e.pos.x), Math.floor(e.pos.y - 0.5), Math.floor(e.pos.z)) !== G.B.sand) return;
    G.footprint(e.pos.x, e.pos.y, e.pos.z, e.yaw, e.printSide, k);
  };

  // Footprints pressed into the sand; they fade away after a few seconds.
  const PRINTS = 140, PRINT_LIFE = 10, prints = [];
  let printCur = 0;
  G.footprint = function (x, y, z, yaw, side, size) {
    if (!prints.length) return;
    const k = size || 1;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const px = x + rx * 0.13 * side * k, pz = z + rz * 0.13 * side * k;
    const h = (ax, az) => G.visualGroundY(px + ax, y, pz + az, true);
    const h0 = h(0, 0);
    if (h0 < G.WATER_Y + 0.04) return;                 // the tide keeps the wet sand smooth
    const p = prints[printCur]; printCur = (printCur + 1) % PRINTS;
    p.m.position.set(px, h0 + 0.025, pz);
    p.m.rotation.set(-Math.atan2(h(fx * 0.2, fz * 0.2) - h(-fx * 0.2, -fz * 0.2), 0.4), yaw, Math.atan2(h(rx * 0.12, rz * 0.12) - h(-rx * 0.12, -rz * 0.12), 0.24));
    p.m.scale.set(0.15 * k, 1, 0.25 * k);
    p.life = PRINT_LIFE; p.m.visible = true;
  };

  const glowCache = {};
  function glowMat(color) {
    return glowCache[color] || (glowCache[color] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  }

  let cursor = 0;
  // opts: { n, color | colors[], speed, up, grav, life, size, glow, spread }
  G.burst = function (x, y, z, opts) {
    const n = opts.n || 6;
    for (let i = 0; i < n; i++) {
      const p = parts[cursor]; cursor = (cursor + 1) % POOL;
      const color = opts.colors ? opts.colors[(Math.random() * opts.colors.length) | 0] : opts.color;
      p.m.material = opts.glow ? glowMat(color) : G.flatMat(color);
      const sp = opts.spread === undefined ? 0.3 : opts.spread;
      p.m.position.set(x + (Math.random() - 0.5) * sp * 2, y + (Math.random() - 0.5) * sp, z + (Math.random() - 0.5) * sp * 2);
      const s = opts.speed === undefined ? 2 : opts.speed;
      const a = Math.random() * Math.PI * 2;
      p.vx = Math.cos(a) * s * Math.random(); p.vz = Math.sin(a) * s * Math.random();
      p.vy = (opts.up === undefined ? 2.5 : opts.up) * (0.5 + Math.random() * 0.7);
      p.grav = opts.grav === undefined ? 12 : opts.grav;
      p.max = p.life = (opts.life || 0.6) * (0.7 + Math.random() * 0.6);
      p.size = (opts.size || 0.12) * (0.7 + Math.random() * 0.6);
      p.m.scale.setScalar(p.size);
      p.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      p.m.visible = true;
      p.m.castShadow = false;
    }
  };

  G.updateFx = function (dt) {
    for (const p of parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.vy -= p.grav * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      p.m.scale.setScalar(p.size * Math.min(1, p.life / p.max * 2));
    }
    for (const p of prints) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.m.material.opacity = 0.17 * Math.min(1, p.life / (PRINT_LIFE * 0.6));
    }
    // floating labels follow their world anchor
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.t += dt;
      if (f.t > f.life) { f.el.remove(); floats.splice(i, 1); continue; }
      v.set(f.x, f.y + f.t * 0.9, f.z).project(G.camera);
      if (v.z > 1) { f.el.style.display = 'none'; continue; }
      f.el.style.display = '';
      f.el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      f.el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
      f.el.style.opacity = String(Math.min(1, (f.life - f.t) * 2.5));
    }
  };

  const floats = [];
  const v = new THREE.Vector3();
  G.floatText = function (x, y, z, html, cls) {
    const el = document.createElement('div');
    el.className = 'float-text ' + (cls || '');
    el.innerHTML = html;
    document.getElementById('ui').appendChild(el);
    floats.push({ el, x, y, z, t: 0, life: 1.5 });
    if (floats.length > 14) { const f = floats.shift(); f.el.remove(); }
  };

  // world position -> screen px (or null when behind the camera)
  G.toScreen = function (x, y, z) {
    v.set(x, y, z).project(G.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  };
})();
