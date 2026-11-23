// Tidewood Isle — island animals: wandering, befriending with snacks, adopting, following, napping.
'use strict';
(function () {
  G.pets = [];
  const B = G.B;

  // ---------- blocky models ----------
  function buildModel(kind) {
    const K = G.PET_KINDS[kind];
    const g = new THREE.Group();
    const parts = { legs: [] };
    const body = K.body, belly = K.belly, dark = 0x3a2e2a;
    const leg = (x, z, h, w, color) => {
      const pivot = new THREE.Group(); pivot.position.set(x, h, z);
      pivot.add(G.box(w, h, w, color, 0, -h, 0));
      g.add(pivot); parts.legs.push(pivot);
    };
    if (kind === 'crab') {
      g.add(G.box(0.5, 0.2, 0.36, body, 0, 0.1, 0));
      g.add(G.box(0.42, 0.04, 0.3, belly, 0, 0.3, 0));
      for (const s of [-1, 1]) {
        g.add(G.box(0.05, 0.14, 0.05, body, s * 0.1, 0.3, 0.14));
        g.add(G.box(0.07, 0.07, 0.07, dark, s * 0.1, 0.42, 0.14));
        const claw = new THREE.Group(); claw.position.set(s * 0.34, 0.2, 0.16);
        claw.add(G.box(0.16, 0.14, 0.16, body, 0, 0, 0.04));
        g.add(claw); parts[s < 0 ? 'clawL' : 'clawR'] = claw;
        for (const z of [-0.1, 0.02, 0.14]) leg(s * 0.3, z, 0.1, 0.05, body);
      }
      parts.sideways = true;
    } else if (kind === 'duck') {
      g.add(G.box(0.3, 0.26, 0.4, body, 0, 0.1, 0));
      g.add(G.box(0.2, 0.06, 0.12, belly, 0, 0.3, -0.2));          // tail
      const head = new THREE.Group(); head.position.set(0, 0.36, 0.16);
      head.add(G.box(0.24, 0.22, 0.22, body));
      head.add(G.box(0.14, 0.05, 0.12, 0xf59a3c, 0, 0.06, 0.16));
      head.add(G.box(0.04, 0.05, 0.02, dark, -0.07, 0.13, 0.115));
      head.add(G.box(0.04, 0.05, 0.02, dark, 0.07, 0.13, 0.115));
      g.add(head); parts.head = head;
      leg(-0.08, 0, 0.1, 0.06, 0xf59a3c); leg(0.08, 0, 0.1, 0.06, 0xf59a3c);
    } else {
      // four-legged friends: cat, dog, bunny, fox
      const long = kind === 'bunny' ? 0.38 : 0.52, tall = 0.26, wide = 0.28, lh = kind === 'bunny' ? 0.1 : 0.16;
      g.add(G.box(wide, tall, long, body, 0, lh, 0));
      g.add(G.box(wide - 0.08, 0.05, long - 0.1, belly, 0, lh - 0.02, 0));
      const head = new THREE.Group(); head.position.set(0, lh + 0.16, long / 2 + 0.02);
      head.add(G.box(0.32, 0.28, 0.26, body));
      head.add(G.box(0.16, 0.12, 0.08, belly, 0, 0.02, 0.15));
      head.add(G.box(0.06, 0.04, 0.03, kind === 'bunny' ? 0xf7a3b8 : dark, 0, 0.1, 0.19));
      head.add(G.box(0.05, 0.07, 0.02, dark, -0.09, 0.15, 0.135));
      head.add(G.box(0.05, 0.07, 0.02, dark, 0.09, 0.15, 0.135));
      head.add(G.box(0.022, 0.026, 0.02, 0xffffff, -0.078, 0.195, 0.141)); head.add(G.box(0.022, 0.026, 0.02, 0xffffff, 0.102, 0.195, 0.141));   // eye sparkle
      head.add(G.box(0.06, 0.035, 0.02, 0xffb0a8, -0.13, 0.08, 0.135)); head.add(G.box(0.06, 0.035, 0.02, 0xffb0a8, 0.13, 0.08, 0.135));       // blush
      if (kind === 'bunny') { head.add(G.box(0.08, 0.3, 0.05, body, -0.08, 0.26, -0.04)); head.add(G.box(0.08, 0.3, 0.05, body, 0.08, 0.26, -0.04)); head.add(G.box(0.04, 0.2, 0.02, 0xf7b8c8, -0.08, 0.3, -0.012)); head.add(G.box(0.04, 0.2, 0.02, 0xf7b8c8, 0.08, 0.3, -0.012)); }
      else if (kind === 'dog') { head.add(G.box(0.08, 0.2, 0.14, 0xa8734a, -0.19, 0.06, 0)); head.add(G.box(0.08, 0.2, 0.14, 0xa8734a, 0.19, 0.06, 0)); }
      else { head.add(G.box(0.1, 0.12, 0.06, body, -0.1, 0.27, 0)); head.add(G.box(0.1, 0.12, 0.06, body, 0.1, 0.27, 0)); }
      g.add(head); parts.head = head;
      for (const [x, z] of [[-0.09, long / 2 - 0.08], [0.09, long / 2 - 0.08], [-0.09, -long / 2 + 0.08], [0.09, -long / 2 + 0.08]]) leg(x, z, lh, 0.08, kind === 'fox' ? 0x4a3a34 : body);
      const tail = new THREE.Group(); tail.position.set(0, lh + 0.2, -long / 2);
      if (kind === 'bunny') tail.add(G.box(0.12, 0.12, 0.1, 0xffffff, 0, -0.1, -0.04));
      else if (kind === 'fox') { tail.add(G.box(0.14, 0.14, 0.32, body, 0, -0.06, -0.18)); tail.add(G.box(0.14, 0.14, 0.12, 0xffffff, 0, -0.06, -0.4)); }
      else tail.add(G.box(0.07, 0.07, kind === 'cat' ? 0.36 : 0.24, body, 0, 0, -0.14));
      g.add(tail); parts.tail = tail;
    }
    g.scale.setScalar(K.size * 1.15);
    g.userData.parts = parts;
    return g;
  }

  function isLand(x, z) {
    const y = G.groundY(Math.floor(x), Math.floor(z));
    return y >= G.SEA - 1;
  }

  function findHome(kind, rnd) {
    const K = G.PET_KINDS[kind], sp = G.world.spawn;
    for (let i = 0; i < 400; i++) {
      let x, z;
      if (K.home === 'camp') { x = sp.x + (rnd() - 0.5) * 22; z = sp.z - 4 + (rnd() - 0.5) * 16; }
      else if (K.home === 'lagoon') { const l = G.world.lagoon; const a = rnd() * 6.28, r = 8 + rnd() * 6; x = l.x + Math.cos(a) * r; z = l.z + Math.sin(a) * r; }
      else if (K.home === 'hill') { x = G.W / 2 - 20 + (rnd() - 0.5) * 30; z = G.D / 2 - 18 + (rnd() - 0.5) * 30; }
      else { x = 20 + rnd() * (G.W - 40); z = 20 + rnd() * (G.D - 40); }
      const fx = Math.floor(x), fz = Math.floor(z);
      if (fx < 3 || fz < 3 || fx > G.W - 4 || fz > G.D - 4) continue;
      const gy = G.groundY(fx, fz);
      if (gy < G.SEA - 1) continue;
      const top = G.getBlock(fx, gy, fz);
      if (K.home === 'beach' && top !== B.sand) continue;
      if ((K.home === 'grass' || K.home === 'hill') && top !== B.grass) continue;
      if (G.getBlock(fx, gy + 1, fz) !== 0 && G.SOLID[G.getBlock(fx, gy + 1, fz)]) continue;
      return { x: fx + 0.5, y: gy + 1, z: fz + 0.5 };
    }
    return { x: sp.x, y: sp.y, z: sp.z };
  }

  function makePet(data) {
    const K = G.PET_KINDS[data.kind];
    const pet = {
      kind: data.kind, name: data.name || '', adopted: !!data.adopted, trust: data.trust || 0, stay: !!data.stay,
      pos: new THREE.Vector3(data.x, data.y, data.z), vel: new THREE.Vector3(), yaw: Math.random() * 6,
      home: data.home || { x: data.x, y: data.y, z: data.z },
      model: buildModel(data.kind), pickRadius: 0.5, pickY: 0.3,
      goal: null, think: Math.random() * 3, onGround: false, phase: Math.random() * 6, mood: 0, nap: false,
    };
    pet.hint = () => {
      if (pet.adopted) return '<kbd>Click</kbd> to say hello to ' + pet.name;
      const held = G.heldItem();
      if (held && likes(pet, held)) return '<kbd>Click</kbd> to offer the ' + held.label + ' to the ' + K.label;
      return K.label + ' — it might like ' + likeList(K);
    };
    pet.interact = () => interact(pet);
    pet.update = (dt, t) => updatePet(pet, dt, t);
    G.scene.add(pet.model);
    const tag = document.createElement('div');
    tag.className = 'nametag'; tag.style.display = 'none';
    document.getElementById('ui').appendChild(tag);
    pet.tag = tag;
    G.pets.push(pet);
    G.entities.push(pet);
    return pet;
  }

  const likeNames = { fish: 'fresh fish', pet_treat: 'pet treats', cooked_fish: 'grilled fish', carrot: 'carrots', berry: 'berries', coconut: 'coconuts', corn: 'corn' };
  const likeList = (K) => K.likes.map((l) => likeNames[l] || l).join(' or ');
  const likes = (pet, item) => G.PET_KINDS[pet.kind].likes.some((l) => l === item.key || (l === 'fish' && item.fish));

  function hearts(pet, n) {
    G.burst(pet.pos.x, pet.pos.y + 0.7, pet.pos.z, { n: n || 5, colors: [0xff8fa3, 0xffb3c1, 0xff6b8a], speed: 0.8, up: 1.8, grav: -0.5, life: 1.0, size: 0.1, glow: true });
    G.floatText(pet.pos.x, pet.pos.y + 1.0, pet.pos.z, '❤️', 'heart');
  }

  function interact(pet) {
    const K = G.PET_KINDS[pet.kind];
    G.facePlayerTo(pet.pos.x, pet.pos.z);
    pet.yaw = Math.atan2(G.player.pos.x - pet.pos.x, G.player.pos.z - pet.pos.z);
    pet.goal = null; pet.think = 2.5;
    if (pet.adopted) {
      const held = G.heldItem();
      if (held && likes(pet, held)) { G.consumeHeld(1); hearts(pet, 8); pet.mood = 3; G.emit('sfx', K.sound); G.ui.toast(pet.name + ' gobbles up the ' + held.label + ' happily'); return; }
      G.ui.dialog({
        title: K.icon + ' ' + pet.name,
        html: pet.name + ' the ' + K.label + ' looks up at you.<br><small>Currently ' + (pet.stay ? 'staying around this spot' : 'following you everywhere') + '.</small>',
        buttons: [
          { label: 'Pet ❤️', primary: true, fn: () => { hearts(pet, 7); pet.mood = 3; G.emit('sfx', K.sound); } },
          { label: pet.stay ? 'Follow me' : 'Stay here', fn: () => { pet.stay = !pet.stay; pet.home = { x: pet.pos.x, y: pet.pos.y, z: pet.pos.z }; G.ui.toast(pet.name + (pet.stay ? ' will wait around here' : ' is following you')); G.emit('sfx', K.sound); } },
          { label: 'Rename', fn: () => askName(pet, true) },
        ],
      });
      return;
    }
    const held = G.heldItem();
    if (held && likes(pet, held)) {
      G.consumeHeld(1);
      pet.trust++;
      hearts(pet, 5); pet.mood = 3;
      G.emit('sfx', K.sound);
      if (pet.trust >= 3) { askName(pet, false); return; }
      G.ui.toast('The ' + K.label + ' loved that! ' + '❤️'.repeat(pet.trust) + '🤍'.repeat(3 - pet.trust), 'good');
    } else {
      G.emit('sfx', K.sound);
      G.ui.toast('The ' + K.label + ' sniffs your hand. It might like ' + likeList(K) + '.');
    }
  }

  function askName(pet, rename) {
    const K = G.PET_KINDS[pet.kind];
    G.ui.dialog({
      title: rename ? 'Rename ' + pet.name : K.icon + ' A new friend!',
      html: rename ? 'What should ' + pet.name + ' be called now?' : 'The ' + K.label + ' trusts you now and wants to come along. What will you name it?',
      input: { value: rename ? pet.name : G.pick(G.PET_NAMES) },
      locked: !rename,
      buttons: [{
        label: rename ? 'Rename' : 'Welcome home!', primary: true, fn: (val) => {
          pet.name = (val || '').replace(/[<>&"]/g, '').trim().slice(0, 16) || G.pick(G.PET_NAMES);
          if (!rename) {
            pet.adopted = true; pet.stay = false;
            hearts(pet, 12);
            G.emit('adopted', pet.kind);
            G.emit('sfx', 'fanfare');
            G.ui.toast(pet.name + ' the ' + K.label + ' joined your island family! 🎉', 'big');
            // another wild one wanders in the next morning (remembered across saves)
            (G.flags.petRespawn = G.flags.petRespawn || []).push(pet.kind);
          }
          if (G.requestSave) G.requestSave();
        },
      }],
    });
  }

  G.spawnWildPet = (kind) => spawnWild(kind);
  function spawnWild(kind) {
    const h = findHome(kind, Math.random);
    return makePet({ kind, x: h.x, y: h.y, z: h.z });
  }

  // nearest pet bed to a point (for naps)
  function findPetBed(x, y, z) {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    let best = null, bd = 99999;
    for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) for (let dy = -2; dy <= 2; dy++) {
      if (G.getBlock(fx + dx, fy + dy, fz + dz) === B.pet_bed) { const d = dx * dx + dz * dz + dy * dy; if (d < bd) { bd = d; best = { x: fx + dx + 0.5, y: fy + dy, z: fz + dz + 0.5 }; } }
    }
    return best;
  }

  function updatePet(pet, dt, t) {
    const K = G.PET_KINDS[pet.kind], P = G.player.pos, parts = pet.model.userData.parts;
    const dxp = P.x - pet.pos.x, dzp = P.z - pet.pos.z, dp = Math.hypot(dxp, dzp);
    // far-away wild animals idle cheaply
    if (dp > 70 && !pet.adopted) { pet.model.visible = false; pet.tag.style.display = 'none'; return; }
    pet.model.visible = true;
    pet.think -= dt; pet.mood = Math.max(0, pet.mood - dt);
    let speed = 0;
    const inWater = pet.pos.y < G.WATER_Y - 0.15 && G.getBlock(Math.floor(pet.pos.x), Math.max(0, Math.floor(pet.pos.y + 0.05)), Math.floor(pet.pos.z)) === 0 && pet.pos.y < G.SEA;

    const following = pet.adopted && !pet.stay;
    pet.nap = false;
    if (following) {
      if (dp > 26 || Math.abs(P.y - pet.pos.y) > 9) {
        // catch up with a little hop of magic
        pet.pos.set(P.x - Math.sin(G.player.yaw) * 1.2, P.y + 0.3, P.z - Math.cos(G.player.yaw) * 1.2);
        pet.vel.set(0, 0, 0);
      } else if (dp > 2.4) { pet.goal = { x: P.x, z: P.z }; speed = K.speed * (dp > 6 ? 1.9 : 1.15); }
      else { pet.goal = null; if (G.player.sitting && pet.think < 0) pet.nap = true; }
    } else {
      const night = G.nightAmount > 0.7;
      if (pet.adopted && night) {
        pet.bedT = (pet.bedT || 0) - dt;
        if (pet.bedT <= 0) { pet.bedT = 5; pet.bed = findPetBed(pet.pos.x, pet.pos.y, pet.pos.z); }
        const bed = pet.bed;
        if (bed) {
          const db = Math.hypot(bed.x - pet.pos.x, bed.z - pet.pos.z);
          if (db > 0.35) { pet.goal = { x: bed.x, z: bed.z }; speed = K.speed; } else { pet.goal = null; pet.nap = true; }
        }
      }
      if (!pet.nap && !pet.goal && pet.think <= 0) {
        pet.think = 2 + Math.random() * 5;
        if (Math.random() < 0.7) {
          const a = Math.random() * 6.28, r = 1.5 + Math.random() * 5;
          const gx = pet.home.x + Math.cos(a) * r, gz = pet.home.z + Math.sin(a) * r;
          if (isLand(gx, gz) || pet.kind === 'duck') pet.goal = { x: gx, z: gz };
        }
      }
      if (pet.goal && speed === 0) speed = K.speed * 0.6;
      // wild animals shyly keep an eye on you, friends trot over
      if (!pet.adopted && dp < 3 && !pet.goal) pet.yaw = Math.atan2(dxp, dzp);
    }

    let moving = false;
    if (pet.goal) {
      const gx = pet.goal.x - pet.pos.x, gz = pet.goal.z - pet.pos.z, gd = Math.hypot(gx, gz);
      if (gd < 0.4) pet.goal = null;
      else {
        const want = Math.atan2(gx, gz);
        let diff = G.mod(want - pet.yaw + Math.PI, Math.PI * 2) - Math.PI;
        pet.yaw += diff * Math.min(1, dt * 8);
        pet.vel.x = Math.sin(pet.yaw) * speed; pet.vel.z = Math.cos(pet.yaw) * speed;
        moving = true;
      }
    }
    if (!moving) { pet.vel.x *= 0.7; pet.vel.z *= 0.7; }

    if (inWater) {
      const floatY = G.WATER_Y - (pet.kind === 'duck' ? 0.18 : 0.3);
      pet.vel.y += ((floatY - pet.pos.y) * 10 - pet.vel.y * 4) * dt;
    } else pet.vel.y -= 24 * dt;
    const res = G.moveBody(pet.pos, pet.vel, 0.2, 0.45, dt, true, pet.onGround && pet.vel.y <= 0);
    pet.onGround = res.ground;
    if ((res.hitX || res.hitZ) && moving && (pet.onGround || inWater)) {
      if (G.aabbFree(pet.pos.x + Math.sin(pet.yaw) * 0.5, pet.pos.y + 1.05, pet.pos.z + Math.cos(pet.yaw) * 0.5, 0.2, 0.45)) pet.vel.y = 7.4;
      else if (!following) { pet.goal = null; pet.think = 1; }
    }
    if (pet.pos.y < -4) { pet.pos.set(pet.home.x, pet.home.y + 1, pet.home.z); pet.vel.set(0, 0, 0); }
    pet.pos.x = G.clamp(pet.pos.x, 1.5, G.W - 1.5); pet.pos.z = G.clamp(pet.pos.z, 1.5, G.D - 1.5);

    // ---- animation ----
    const m = pet.model;
    const hs = Math.hypot(pet.vel.x, pet.vel.z);
    pet.phase += dt * (4 + hs * 4);
    if (!inWater) G.trackPrints(pet, dt, hs, 0.5);
    let bob = 0;
    if (pet.kind === 'bunny' && hs > 0.3) bob = Math.abs(Math.sin(pet.phase * 0.9)) * 0.22;
    else if (pet.mood > 0) bob = Math.abs(Math.sin(t * 10)) * 0.12;
    const gy = inWater ? pet.pos.y : G.visualGroundY(pet.pos.x, pet.pos.y, pet.pos.z, pet.onGround);
    pet.visY = pet.visY === undefined || Math.abs(gy - pet.visY) > 1.6 ? gy : pet.visY + (gy - pet.visY) * Math.min(1, dt * 20);
    m.position.set(pet.pos.x, pet.visY + bob - (pet.nap ? 0.04 : 0), pet.pos.z);
    m.rotation.y = pet.yaw + (parts.sideways && hs > 0.3 ? Math.PI / 2 : 0);
    const swing = hs > 0.3 ? Math.sin(pet.phase) * 0.7 : 0;
    parts.legs.forEach((l, i) => { l.rotation.x = pet.nap ? 1.2 : swing * (i % 2 ? 1 : -1); });
    if (parts.tail) parts.tail.rotation.y = Math.sin(t * (pet.mood > 0 || (pet.adopted && dp < 4) ? 14 : 3)) * 0.5;
    if (parts.head) parts.head.rotation.z = pet.nap ? 0.3 : Math.sin(t * 1.3 + pet.phase * 0.01) * 0.06;
    if (parts.clawL) { parts.clawL.rotation.z = Math.sin(t * 5) * 0.4 + 0.3; parts.clawR.rotation.z = -Math.sin(t * 5 + 1) * 0.4 - 0.3; }
    m.scale.y = K.size * 1.15 * (pet.nap ? 0.8 : 1);
    if (pet.nap && Math.random() < dt * 0.6) G.floatText(pet.pos.x, pet.pos.y + 0.7, pet.pos.z, '💤');
    if (hs > 1 && pet.onGround && Math.random() < dt * 0.4 && dp < 12) G.emit('sfx', 'patter');

    // ---- name tag ----
    const showTag = pet.adopted ? dp < 14 : dp < 5 && pet.trust > 0;
    if (showTag && !G.ui.blocking()) {
      const s = G.toScreen(pet.pos.x, pet.pos.y + 0.95 * K.size + 0.25, pet.pos.z);
      if (s) {
        pet.tag.style.display = '';
        pet.tag.style.left = s.x + 'px'; pet.tag.style.top = s.y + 'px';
        const txt = pet.adopted ? pet.name : K.label + '<span class="hearts">' + '❤️'.repeat(pet.trust) + '</span>';
        if (pet.tag._t !== txt) { pet.tag._t = txt; pet.tag.innerHTML = txt; }
      } else pet.tag.style.display = 'none';
    } else pet.tag.style.display = 'none';
  }

  G.initPets = function (save) {
    if (save && save.pets) {
      for (const d of save.pets) if (G.PET_KINDS[d.kind]) makePet(d);
      return;
    }
    const rnd = G.makeRng(G.world.seed + 5);
    for (const kind of ['cat', 'dog', 'bunny', 'bunny', 'crab', 'crab', 'crab', 'duck', 'duck', 'fox']) {
      const h = findHome(kind, rnd);
      makePet({ kind, x: h.x, y: h.y, z: h.z });
    }
  };

  G.serializePets = function () {
    return G.pets.map((p) => ({ kind: p.kind, name: p.name, adopted: p.adopted, trust: p.trust, stay: p.stay, x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), home: p.home }));
  };
})();
