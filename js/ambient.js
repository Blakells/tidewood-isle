// Tidewood Isle — ambient life and weather: butterflies, fireflies, seagulls, fish shadows, rain showers, sand glimmers.
'use strict';
(function () {
  const B = G.B;
  const butterflies = [], fireflies = [], gulls = [], fishes = [];
  let rain, rainVel, rainbow, star, starT = 0, starDir = new THREE.Vector3();
  G.weather = { raining: false, amount: 0, until: 0, next: 0 };

  const basic = {};
  const basicMat = (c, o) => basic[c + ':' + o] || (basic[c + ':' + o] = new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1 }));

  function flowerSpotNear(p, r) {
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(p.x + (Math.random() - 0.5) * r * 2), z = Math.floor(p.z + (Math.random() - 0.5) * r * 2);
      if (x < 2 || z < 2 || x > G.W - 3 || z > G.D - 3) continue;
      const y = G.groundY(x, z);
      if (y < G.SEA) continue;
      const d = G.getDef(x, y + 1, z);
      if (d && d.shape === 'cross' && d.key.startsWith('flower')) return { x: x + 0.5, y: y + 1.6, z: z + 0.5 };
    }
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(p.x + (Math.random() - 0.5) * r * 2), z = Math.floor(p.z + (Math.random() - 0.5) * r * 2);
      if (x < 2 || z < 2 || x > G.W - 3 || z > G.D - 3) continue;
      const y = G.groundY(x, z);
      if (y >= G.SEA && G.getBlock(x, y, z) === B.grass) return { x: x + 0.5, y: y + 1.8, z: z + 0.5 };
    }
    return null;
  }

  // Butterflies and glowbugs can be clicked; with a net in hand they are caught.
  function catchable(bug, vanish) {
    bug.hint = () => (G.heldItem() && G.heldItem().tool === 'net' ? '<kbd>Click</kbd> to catch the ' + bug.species.label : bug.species.label + ' — a bug net would catch it');
    bug.interact = () => {
      if (!bug.pickRadius) return;                              // already caught or flown off
      const held = G.heldItem();
      if (!held || held.tool !== 'net') { G.ui.toast('You need a Bug Net to catch that (Tab → Basics)'); return; }
      if (!G.hasRoom(bug.species.id)) { G.ui.toast('Your backpack is full'); return; }
      G.player.swing = 0.28;
      G.addItem(bug.species.id, 1, true);
      const first = !G.journal.bugs[bug.species.id];
      G.journal.bugs[bug.species.id] = (G.journal.bugs[bug.species.id] || 0) + 1;
      G.floatText(bug.pos.x, bug.pos.y + 0.4, bug.pos.z, '<span>+1 ' + bug.species.icon + '</span>');
      G.burst(bug.pos.x, bug.pos.y, bug.pos.z, { n: 8, colors: [bug.species.color, 0xffffff], speed: 1.5, up: 1.5, size: 0.06, glow: true });
      G.ui.toast('I caught a <b>' + bug.species.label + '</b>!' + G.quip(bug.species.id) + (first ? ' <b>New for your journal!</b>' : ''), first ? 'big' : 'good');
      G.emit('sfx', 'pickup'); G.emit('caughtBug', bug.species.id);
      if (first) G.emit('newbug', bug.species.id);
      bug.pickRadius = 0;
      vanish();
    };
    G.entities.push(bug);
  }

  // ---- balloon presents: now and then one drifts across the island; click it to pop it ----
  const GIFTS = ['string_lights', 'beach_ball', 'rug_pink', 'rug_blue', 'flower_pot', 'lantern', 'painting_palm', 'bunting', 'picnic_basket', 'sapling_pink', 'globe', 'lamp', 'sofa_pink', 'fruit_pie', 'coconut_cake'];
  const balloon = { kind: 'balloon', pos: new THREE.Vector3(), pickRadius: 0, pickY: 0.2, reach: 18, alive: false, wait: 150 + Math.random() * 120, vx: 0, vz: 0, t: 0 };
  balloon.hint = () => '<kbd>Click</kbd> to pop the balloon!';
  balloon.interact = () => {
    if (!balloon.alive) return;
    balloon.alive = false; balloon.model.visible = false; balloon.pickRadius = 0;
    balloon.wait = 240 + Math.random() * 240;
    const p = balloon.pos;
    G.burst(p.x, p.y + 0.5, p.z, { n: 18, colors: [balloon.color, 0xffffff, 0xfff2b0], speed: 3, up: 2, size: 0.1, life: 0.8, glow: true });
    G.emit('sfx', 'pickup'); G.emit('sfx', 'fanfare'); G.emit('balloon');
    let html;
    if (Math.random() < 0.3) { const n = 40 + ((Math.random() * 60) | 0); G.addPearls(n); html = '<b><i class="pearl"></i>' + n + ' pearls</b>'; }
    else { const id = G.pick(GIFTS); if (G.hasRoom(id, 1)) { G.addItem(id, 1, true); html = '<b>' + G.iconHTML(id) + ' ' + G.itemLabel(id) + '</b>'; } else { G.addPearls(60); html = '<b><i class="pearl"></i>60 pearls</b> (your backpack was full)'; } }
    G.ui.dialog({ title: '🎈 Pop!', html: 'The present tumbles into your arms. Inside: ' + html, buttons: [{ label: 'Lucky me', primary: true }] });
  };
  function buildBalloon() {
    const g = new THREE.Group();
    const cols = [0xf2706a, 0x6fb3f2, 0xf7cf6b, 0x8fd98a, 0xf79ac0];
    balloon.color = cols[(Math.random() * cols.length) | 0];
    g.add(G.box(0.8, 0.95, 0.8, balloon.color, 0, 0.7, 0));
    g.add(G.box(0.12, 0.1, 0.12, balloon.color, 0, 0.62, 0));
    g.add(G.box(0.02, 0.6, 0.02, 0xffffff, 0, 0.04, 0));
    g.add(G.box(0.36, 0.3, 0.36, 0xfff0d8, 0, -0.28, 0));
    g.add(G.box(0.38, 0.08, 0.1, 0xf2706a, 0, -0.17, 0)); g.add(G.box(0.1, 0.08, 0.38, 0xf2706a, 0, -0.17, 0));
    return g;
  }
  function updateBalloon(dt, t, P, night) {
    if (!balloon.alive) {
      balloon.wait -= dt;
      if (balloon.wait > 0 || night > 0.4 || G.weather.amount > 0.3 || G.ui.blocking()) return;
      if (balloon.model) G.scene.remove(balloon.model);
      balloon.model = buildBalloon(); G.scene.add(balloon.model);
      const a = Math.random() * 6.28;
      balloon.vx = Math.cos(a) * 1.5; balloon.vz = Math.sin(a) * 1.5;
      balloon.pos.set(P.x - Math.cos(a) * 26, P.y + 7, P.z - Math.sin(a) * 26);
      balloon.alive = true; balloon.t = 0; balloon.pickRadius = 0.9;
      G.ui.toast('🎈 Something is drifting over the island…');
      G.emit('sfx', 'chirp');
      return;
    }
    balloon.t += dt;
    balloon.pos.x += balloon.vx * dt; balloon.pos.z += balloon.vz * dt;
    const gx = G.clamp(Math.floor(balloon.pos.x), 0, G.W - 1), gz = G.clamp(Math.floor(balloon.pos.z), 0, G.D - 1);
    const want = Math.max(G.topSolid(gx, gz) + 1, G.SEA) + 5.5 + Math.sin(t * 0.8) * 0.5;
    balloon.pos.y += (want - balloon.pos.y) * Math.min(1, dt * 0.8);
    balloon.model.position.copy(balloon.pos);
    balloon.model.rotation.z = Math.sin(t * 1.3) * 0.08;
    if (balloon.t > 75 || balloon.pos.distanceToSquared(P) > 60 * 60) { balloon.alive = false; balloon.model.visible = false; balloon.pickRadius = 0; balloon.wait = 200 + Math.random() * 200; }
  }

  G.initAmbient = function () {
    G.entities.push(balloon);
    G.balloon = balloon;
    const flutters = G.BUGS.filter((b) => b.id !== 'bug_glow');
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const species = flutters[i < 6 ? i : (i * 2) % 4];
      const c = species.color;
      const wl = new THREE.Group(), wr = new THREE.Group();
      const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.2), G.flatMat(c)); m1.position.x = -0.08; wl.add(m1);
      const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.2), G.flatMat(c)); m2.position.x = 0.08; wr.add(m2);
      g.add(wl, wr, new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.16), G.flatMat(0x4a3a34)));
      g.visible = false;
      G.scene.add(g);
      const b = { g, wl, wr, pos: new THREE.Vector3(), goal: null, t: Math.random() * 9, alive: false, species, pickRadius: 0, pickY: 0 };
      catchable(b, () => { b.alive = false; b.g.visible = false; });
      butterflies.push(b);
    }
    const fgeo = new THREE.IcosahedronGeometry(0.045, 1);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(fgeo, basicMat(0xe9ff8a, 1));
      m.visible = false; G.scene.add(m);
      const f = { m, base: new THREE.Vector3(), pos: new THREE.Vector3(), ph: Math.random() * 9, alive: false, species: G.BUGS.find((x) => x.id === 'bug_glow'), pickRadius: 0, pickY: 0 };
      catchable(f, () => { f.alive = false; f.m.visible = false; });
      fireflies.push(f);
    }
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.6), G.flatMat(0xffffff));
      const wl = new THREE.Group(), wr = new THREE.Group();
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.26), G.flatMat(0xf2f4f7)); a.position.x = -0.45; wl.add(a);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.26), G.flatMat(0xf2f4f7)); b2.position.x = 0.45; wr.add(b2);
      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.14), G.flatMat(0xf5b041)); beak.position.z = 0.36;
      g.add(body, wl, wr, beak);
      G.scene.add(g);
      gulls.push({ g, wl, wr, cx: G.W / 2 + (Math.random() - 0.5) * 60, cz: G.D / 2 + (Math.random() - 0.5) * 60, r: 34 + Math.random() * 30, a: Math.random() * 6.28, h: 30 + Math.random() * 10, sp: 0.12 + Math.random() * 0.08 });
    }
    // a fish seen from above: a slim oval body with a little tail fin
    const fishGeo = new THREE.SphereGeometry(0.5, 10, 6);
    fishGeo.scale(0.24, 0.03, 0.56);
    const tailGeo = new THREE.SphereGeometry(0.5, 8, 4);
    tailGeo.scale(0.2, 0.025, 0.16);
    tailGeo.translate(0, 0, -0.33);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(fishGeo, basicMat(0x1f5a7a, 0.45));
      m.add(new THREE.Mesh(tailGeo, m.material));
      m.renderOrder = 1; m.visible = false; G.scene.add(m);
      fishes.push({ m, pos: new THREE.Vector3(), yaw: Math.random() * 6.28, sp: 0.6 + Math.random() * 0.7, alive: false, turn: 0 });
    }
    // rain streaks (short falling line segments around the camera)
    const N = 700, pos = new Float32Array(N * 6);
    rainVel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 44, y = Math.random() * 30, z = (Math.random() - 0.5) * 44;
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x + 0.06; pos[i * 6 + 4] = y + 0.95; pos[i * 6 + 5] = z;
      rainVel[i] = 20 + Math.random() * 10;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xc4dcf6, transparent: true, opacity: 0, depthWrite: false }));
    rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 8;
    G.scene.add(rain);
    // rainbow: a few concentric arcs that fade in after a daytime shower
    rainbow = new THREE.Group();
    [0xf28b82, 0xfbbc6a, 0xfff07a, 0x9be29b, 0x8fc7f5, 0xb9a4f0].forEach((c, i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(120 - i * 2.4, 1.2, 6, 60, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, fog: false, depthWrite: false }));
      rainbow.add(m);
    });
    rainbow.visible = false; rainbow.renderOrder = -5;
    G.scene.add(rainbow);
    // shooting star: one bright streak reused now and then at night
    star = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    star.visible = false; G.scene.add(star);
    G.weather.next = 6 + Math.random() * 10;      // hours of play until the first shower
    G.glimmers = G.glimmers || [];
  };

  function isSeaCell(x, z) {
    const fx = Math.floor(x), fz = Math.floor(z);
    if (fx < 0 || fz < 0 || fx >= G.W || fz >= G.D) return true;
    return G.getBlock(fx, G.SEA - 1, fz) === 0 && G.getBlock(fx, G.SEA - 2, fz) === 0 && G.getBlock(fx, G.SEA, fz) === 0;
  }

  // ---- sand glimmers: sparkling spots that hide a little treasure ----
  G.spawnGlimmers = function (n) {
    G.glimmers = G.glimmers.filter((g) => G.getBlock(g.x, g.y, g.z) === B.sand);
    let tries = 0;
    while (G.glimmers.length < n && tries++ < 200) {
      const x = 4 + ((Math.random() * (G.W - 8)) | 0), z = 4 + ((Math.random() * (G.D - 8)) | 0);
      const y = G.groundY(x, z);
      if (y < G.SEA - 1 || y > G.SEA + 1 || G.getBlock(x, y, z) !== B.sand || G.getBlock(x, y + 1, z) !== 0) continue;
      G.glimmers.push({ x, y, z });
    }
  };
  G.on('broke', (key, x, y, z) => {
    if (key !== 'sand' || !G.glimmers) return;
    const i = G.glimmers.findIndex((g) => g.x === x && g.y === y && g.z === z);
    if (i < 0) return;
    G.glimmers.splice(i, 1);
    const roll = Math.random();
    let html;
    if (roll < 0.5) { const p = 15 + ((Math.random() * 35) | 0); G.addPearls(p); html = '<span>+' + p + ' <i class="pearl"></i></span>'; }
    else if (roll < 0.8 && G.hasRoom('pearl_oyster', 1)) { const id = G.pickWeighted(G.SHELL_TABLE.filter((s) => s.w < 15)).id; G.addItem(id, 1, true); G.emit('collect', id, 1, G.BLOCK_BY_KEY[id]); html = '<span>+1 ' + G.iconHTML(id) + '</span>'; }
    else if (G.hasRoom('clay', 3)) { G.addItem('clay', 3, true); html = '<span>+3 ' + G.iconHTML('clay') + '</span>'; }
    else { G.addPearls(25); html = '<span>+25 <i class="pearl"></i></span>'; }
    G.floatText(x + 0.5, y + 1.4, z + 0.5, '✨ ' + html);
    G.burst(x + 0.5, y + 0.8, z + 0.5, { n: 14, colors: [0xfff2b0, 0xffffff, 0xffd6e6], speed: 2.2, up: 3.2, size: 0.08, glow: true, life: 0.8 });
    G.emit('sfx', 'coin'); G.emit('treasure');
    G.ui.toast('You dug up something buried in the sand ✨', 'good');
  });
  G.on('newday', () => G.spawnGlimmers(5));

  let glimT = 0, leafT = 0;
  G.updateAmbient = function (dt, t) {
    const P = G.player.pos, night = G.nightAmount || 0, W = G.weather;

    // ---- weather ----
    const hours = dt * G.HOURS_PER_SEC;
    if (W.raining) { W.until -= hours; if (W.until <= 0) { W.raining = false; W.next = 10 + Math.random() * 22; if (night < 0.3) { W.rainbow = 1.4; G.ui.toast('The shower passes — look, a rainbow! 🌈'); G.emit('rainbow'); } else G.ui.toast('The shower passes and the stars come back out'); } }
    else { W.next -= hours; if (W.next <= 0) { W.raining = true; W.until = 1.5 + Math.random() * 2.5; G.ui.toast('A warm island shower rolls in 🌧️'); G.emit('rain'); } }
    W.amount += ((W.raining ? 1 : 0) - W.amount) * Math.min(1, dt * 0.5);
    rain.visible = W.amount > 0.02;
    if (rain.visible) {
      rain.material.opacity = 0.9 * W.amount;
      const arr = rain.geometry.attributes.position.array, cam = G.camera.position;
      rain.position.set(cam.x, 0, cam.z);
      const top = P.y + 26, bottom = Math.min(P.y - 4, G.WATER_Y);
      for (let i = 0; i < rainVel.length; i++) {
        const k = i * 6;
        arr[k + 1] -= rainVel[i] * dt;
        if (arr[k + 1] < bottom) {
          arr[k + 1] = top - Math.random() * 4;
          arr[k] = (Math.random() - 0.5) * 44; arr[k + 2] = (Math.random() - 0.5) * 44;
          arr[k + 3] = arr[k] + 0.06; arr[k + 5] = arr[k + 2];
        }
        arr[k + 4] = arr[k + 1] + 0.95;
      }
      rain.geometry.attributes.position.needsUpdate = true;
      if (Math.random() < dt * 30 * W.amount) {
        const rx = P.x + (Math.random() - 0.5) * 16, rz = P.z + (Math.random() - 0.5) * 16;
        const gy = G.topSolid(Math.floor(rx), Math.floor(rz));
        G.burst(rx, Math.max(gy + 1.02, G.WATER_Y + 0.02), rz, { n: 1, color: 0xe6f4ff, speed: 0.5, up: 0.9, size: 0.05, life: 0.25 });
      }
    }

    updateBalloon(dt, t, P, night);

    // ---- rainbow ----
    if (W.rainbow > 0 || rainbow.visible) {
      W.rainbow = Math.max(0, (W.rainbow || 0) - hours);
      const want = W.rainbow > 0 && night < 0.4 ? 0.42 : 0;
      const cur = rainbow.children[0].material.opacity;
      const o = cur + (want - cur) * Math.min(1, dt * 0.4);
      for (const m of rainbow.children) m.material.opacity = o;
      rainbow.visible = o > 0.01;
      rainbow.position.set(P.x - 30, G.WATER_Y - 6, P.z - 170);
    }

    // ---- shooting stars ----
    if (G.wishWindow > 0) G.wishWindow -= dt;
    if (star.visible) {
      starT += dt;
      star.position.addScaledVector(starDir, dt * 160);
      star.material.opacity = Math.max(0, 1 - starT / 0.9);
      if (starT > 0.9) star.visible = false;
    } else if (night > 0.8 && W.amount < 0.2 && Math.random() < dt * 0.02) {
      const cam = G.camera.position, a = Math.random() * 6.28;
      star.position.set(cam.x + Math.cos(a) * 220, cam.y + 130 + Math.random() * 60, cam.z + Math.sin(a) * 220);
      starDir.set(-Math.sin(a) * 0.9, -0.35, Math.cos(a) * 0.9).normalize();
      star.lookAt(star.position.x + starDir.x, star.position.y + starDir.y, star.position.z + starDir.z);
      star.rotateY(Math.PI / 2);
      star.visible = true; starT = 0;
      if ((G.flags.wishes || 0) < 3 && !G.ui.blocking()) {
        G.wishWindow = 7;
        G.ui.toast('🌠 A shooting star! Quick — press <kbd>G</kbd> to make a wish', 'good');
        G.emit('sfx', 'tickUp');
      }
      if (G.player.sitting) G.addPearls(15);
    }

    // ---- butterflies (daytime, dry weather) ----
    const wantB = night < 0.3 && W.amount < 0.3;
    for (const b of butterflies) {
      if (!b.alive) {
        if (wantB && Math.random() < dt * 0.5) {
          const s = flowerSpotNear(P, 22);
          if (s) { b.alive = true; b.pos.set(s.x, s.y, s.z); b.goal = null; b.g.visible = true; }
        }
        continue;
      }
      b.t += dt;
      if (!wantB || b.pos.distanceToSquared(P) > 45 * 45) { b.alive = false; b.g.visible = false; b.pickRadius = 0; continue; }
      if (!b.goal || b.pos.distanceToSquared(b.goal) < 0.3 || Math.random() < dt * 0.1) {
        const s = flowerSpotNear(b.pos, 7);
        b.goal = s ? new THREE.Vector3(s.x, s.y, s.z) : new THREE.Vector3(b.pos.x + (Math.random() - 0.5) * 6, b.pos.y, b.pos.z + (Math.random() - 0.5) * 6);
      }
      const dx = b.goal.x - b.pos.x, dy = b.goal.y - b.pos.y, dz = b.goal.z - b.pos.z, d = Math.hypot(dx, dy, dz) || 1;
      const sp = 1.5;
      b.pos.x += (dx / d) * sp * dt + Math.sin(b.t * 5) * 0.6 * dt;
      b.pos.y += (dy / d) * sp * dt + Math.cos(b.t * 7) * 0.9 * dt;
      b.pos.z += (dz / d) * sp * dt + Math.cos(b.t * 4) * 0.6 * dt;
      b.g.position.copy(b.pos);
      b.pickRadius = 0.45;
      b.g.rotation.y = Math.atan2(dx, dz);
      const flap = Math.sin(b.t * 22) * 0.9;
      b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
    }

    // ---- fireflies (night) ----
    for (const f of fireflies) {
      if (!f.alive) {
        if (night > 0.6 && W.amount < 0.3 && Math.random() < dt * 0.8) {
          const x = P.x + (Math.random() - 0.5) * 34, z = P.z + (Math.random() - 0.5) * 34;
          const y = G.groundY(Math.floor(x), Math.floor(z));
          if (y >= G.SEA && G.getBlock(Math.floor(x), y, Math.floor(z)) === B.grass) { f.alive = true; f.base.set(x, y + 1.4 + Math.random() * 1.6, z); f.m.visible = true; }
        }
        continue;
      }
      f.ph += dt;
      if (night < 0.5 || f.base.distanceToSquared(P) > 40 * 40) { f.alive = false; f.m.visible = false; f.pickRadius = 0; continue; }
      f.m.position.set(f.base.x + Math.sin(f.ph * 0.7) * 1.2, f.base.y + Math.sin(f.ph * 1.1) * 0.5, f.base.z + Math.cos(f.ph * 0.6) * 1.2);
      f.pos.copy(f.m.position); f.pickRadius = 0.4;
      const glow = 0.5 + 0.5 * Math.sin(f.ph * 2.3);
      f.m.scale.setScalar(0.4 + glow * 1.1);
    }

    // ---- seagulls ----
    for (const s of gulls) {
      s.a += s.sp * dt;
      const x = s.cx + Math.cos(s.a) * s.r, z = s.cz + Math.sin(s.a) * s.r;
      s.g.position.set(x, s.h + Math.sin(s.a * 3) * 1.5, z);
      s.g.rotation.y = -s.a;
      const flap = Math.sin(t * 5 + s.r) * 0.5;
      s.wl.rotation.z = flap; s.wr.rotation.z = -flap;
      s.g.visible = night < 0.7;
    }

    // ---- fish shadows in the shallows ----
    for (const f of fishes) {
      if (!f.alive) {
        if (Math.random() < dt * 0.6) {
          const x = P.x + (Math.random() - 0.5) * 50, z = P.z + (Math.random() - 0.5) * 50;
          if (isSeaCell(x, z)) { f.alive = true; f.pos.set(x, G.WATER_Y - 0.3, z); f.m.visible = true; }
        }
        continue;
      }
      if (f.pos.distanceToSquared(P) > 42 * 42) { f.alive = false; f.m.visible = false; continue; }
      f.turn -= dt;
      const nx = f.pos.x + Math.sin(f.yaw) * 1.2, nz = f.pos.z + Math.cos(f.yaw) * 1.2;
      if (!isSeaCell(nx, nz) || f.turn < 0) { f.yaw += (Math.random() - 0.5) * 2.4 + (isSeaCell(nx, nz) ? 0 : 1.6); f.turn = 2 + Math.random() * 4; }
      // startled by a nearby swimmer
      const near = (f.pos.x - P.x) ** 2 + (f.pos.z - P.z) ** 2 < 6;
      const sp = f.sp * (near ? 3 : 1);
      f.pos.x += Math.sin(f.yaw) * sp * dt; f.pos.z += Math.cos(f.yaw) * sp * dt;
      f.m.position.copy(f.pos);
      f.m.rotation.y = f.yaw + Math.sin(t * 6 + f.sp * 10) * 0.25;
    }

    // ---- petals and leaves drifting down from the trees ----
    leafT -= dt;
    if (leafT <= 0 && W.amount < 0.5) {
      leafT = 0.22;
      for (let k = 0; k < 3; k++) {
        const x = Math.floor(P.x + (Math.random() - 0.5) * 26), z = Math.floor(P.z + (Math.random() - 0.5) * 26);
        for (let y = Math.floor(P.y) + 9; y > Math.floor(P.y); y--) {
          const id = G.getBlock(x, y, z);
          if (!id) continue;
          if (id === B.blossom_leaves && G.getBlock(x, y - 1, z) === 0) G.burst(x + 0.5, y - 0.1, z + 0.5, { n: 1, colors: [0xffc4d8, 0xffe0ea, 0xf7a3c8], speed: 0.5, up: -0.15, grav: 0.7, life: 3.2, size: 0.075, spread: 0.4 });
          else if (id === B.leaves && G.getBlock(x, y - 1, z) === 0 && Math.random() < 0.18) G.burst(x + 0.5, y - 0.1, z + 0.5, { n: 1, colors: [0x92dc76, 0xb2ea8c], speed: 0.5, up: -0.15, grav: 0.8, life: 2.8, size: 0.07, spread: 0.4 });
          break;
        }
      }
    }

    // ---- glimmers sparkle ----
    glimT -= dt;
    if (glimT <= 0 && G.glimmers) {
      glimT = 0.35;
      for (const g of G.glimmers) {
        if ((g.x - P.x) ** 2 + (g.z - P.z) ** 2 > 30 * 30) continue;
        G.burst(g.x + 0.5, g.y + 1.1, g.z + 0.5, { n: 1, colors: [0xfff6c2, 0xffffff], speed: 0.3, up: 0.9, grav: -0.3, life: 0.7, size: 0.06, glow: true, spread: 0.3 });
      }
    }
  };
})();
