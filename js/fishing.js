// Tidewood Isle — fishing: cast, wait for the splash, then a small timing game to reel in.
'use strict';
(function () {
  const F = G.fishing = { state: 'idle', t: 0 };
  let bobber, line, aim, shadow, uiEl;
  let target = { x: 0, z: 0 }, start = new THREE.Vector3(), fish = null;
  let wait = 0, pips = 0, need = 0, misses = 0, mark = 0, markDir = 1, zone = 0.4, zoneW = 0.3, speed = 1;

  G.initFishing = function () {
    bobber = new THREE.Group();
    bobber.add(G.box(0.16, 0.1, 0.16, 0xffffff, 0, -0.05, 0));
    bobber.add(G.box(0.16, 0.1, 0.16, 0xe0625a, 0, 0.05, 0));
    bobber.add(G.box(0.04, 0.12, 0.04, 0xffffff, 0, 0.15, 0));
    bobber.visible = false;
    G.scene.add(bobber);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(new Array(3 * 12).fill(0), 3));
    line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    line.visible = false; line.frustumCulled = false;
    G.scene.add(line);
    aim = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    aim.rotation.x = -Math.PI / 2; aim.visible = false; aim.renderOrder = 7;
    G.scene.add(aim);
    shadow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.26), new THREE.MeshBasicMaterial({ color: 0x1d4a66, transparent: true, opacity: 0.55, depthWrite: false }));
    shadow.visible = false; shadow.renderOrder = 1;
    G.scene.add(shadow);
    uiEl = document.getElementById('fish-ui');
  };

  F.showAim = function (t) {
    if (!aim) return;
    if (!t || F.state !== 'idle') { aim.visible = false; return; }
    aim.visible = true;
    aim.position.set(t.x, G.WATER_Y + 0.06, t.z);
    aim.material.opacity = t.near ? 0.85 : 0.25;
    const s = 1 + Math.sin(performance.now() * 0.006) * 0.08;
    aim.scale.set(s, s, s);
  };

  function rodTip(out) {
    const P = G.player;
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    return out.set(P.pos.x + fx * 0.75 + fz * 0.22, P.pos.y + 1.55, P.pos.z + fz * 0.75 - fx * 0.22);
  }

  F.cast = function (x, z) {
    if (F.state !== 'idle') return;
    target.x = x; target.z = z;
    G.facePlayerTo(x, z);
    G.player.swing = 0.28;
    rodTip(start);
    F.state = 'casting'; F.t = 0;
    bobber.visible = true; line.visible = true;
    G.emit('sfx', 'cast');
  };

  F.cancel = function (quiet) {
    if (F.state === 'idle') return;
    F.state = 'idle';
    bobber.visible = false; line.visible = false; shadow.visible = false;
    uiEl.classList.remove('show'); uiEl.innerHTML = '';
    if (!quiet) G.emit('sfx', 'reel');
  };

  function pickFish() {
    const lag = G.world.lagoon || { x: G.W / 2 + 24, z: G.D / 2 + 4 };
    const where = Math.hypot(target.x - lag.x, target.z - lag.z) < 15 ? 'lagoon' : 'sea';
    const night = G.isNight();
    const pool = G.FISH.filter((f) => (f.where === 'any' || f.where === where) && (f.time === 'any' || (f.time === 'night') === night));
    return G.pickWeighted(pool);
  }

  function splash(n) {
    G.burst(target.x, G.WATER_Y + 0.1, target.z, { n: n || 8, colors: [0xffffff, 0xcfeffa], speed: 1.8, up: 3, size: 0.09, life: 0.5 });
  }

  function startReel() {
    F.state = 'reel'; F.t = 0;
    pips = 0; misses = 0; need = fish.diff + 1;
    speed = 0.75 + fish.diff * 0.28;
    zoneW = [0.34, 0.27, 0.2][fish.diff - 1] || 0.25;
    zone = 0.1 + Math.random() * (0.8 - zoneW);
    mark = 0; markDir = 1;
    drawReel();
    G.emit('sfx', 'hook');
  }
  function drawReel() {
    let p = '';
    for (let i = 0; i < need; i++) p += '<i class="' + (i < pips ? 'on' : '') + '"></i>';
    uiEl.innerHTML = '<div class="fish-msg">Something\'s on the line! Click when the marker is in the green</div><div class="fish-bar"><div class="fish-zone" style="left:' + (zone * 100) + '%;width:' + (zoneW * 100) + '%"></div><div class="fish-mark" id="fish-mark"></div></div><div class="fish-pips">' + p + '</div>';
    uiEl.classList.add('show');
  }

  function land() {
    const P = G.player.pos;
    F.cancel(true);
    if (!G.hasRoom(fish.id)) { G.ui.toast('Your backpack is full — the ' + fish.label + ' wriggles free'); return; }
    G.addItem(fish.id, 1, true);
    const first = G.ITEMS[fish.id].fish && !G.journal.fish[fish.id];
    G.emit('caught', fish.id);
    G.emit('sfx', fish.junk ? 'nope' : 'catch');
    if (!fish.junk) G.player.wave = 1.3;                 // a proud little ta-da
    G.floatText(P.x, P.y + 2.1, P.z, '<span>' + fish.icon + ' ' + fish.label + '!</span>');
    G.ui.toast(fish.junk ? 'You reeled in a ' + fish.label + '. Well… it\'s something.' : 'I caught a <b>' + fish.label + '</b> ' + fish.icon + '!' + G.quip(fish.id) + (first ? ' <b>New for your journal!</b>' : ''), first ? 'big' : 'good');
    G.burst(P.x, P.y + 1.6, P.z, { n: 10, colors: [0xffffff, 0xcfeffa, 0xfff2b0], speed: 2, up: 3, size: 0.08, glow: true });
  }

  // returns true when the click was used by fishing
  F.onClick = function () {
    if (F.state === 'idle') return false;
    G.input.leftDown = false;
    if (F.state === 'casting') return true;
    if (F.state === 'waiting') { F.cancel(); return true; }
    if (F.state === 'bite') { startReel(); return true; }
    if (F.state === 'reel') {
      if (F.t < 0.25) return true;                    // ignore the click that hooked the fish
      if (mark >= zone && mark <= zone + zoneW) {
        pips++;
        G.emit('sfx', 'tickUp');
        splash(4);
        if (pips >= need) { land(); return true; }
        zone = 0.06 + Math.random() * (0.88 - zoneW);
        drawReel();
      } else {
        misses++;
        G.emit('sfx', 'nope');
        if (misses >= 2) { G.ui.toast('It slipped the hook… next time!'); F.cancel(); return true; }
        G.ui.toast('Careful — one more slip and it gets away');
      }
      return true;
    }
    return true;
  };

  F.hint = function () {
    if (F.state === 'waiting') return 'Waiting for a bite… <kbd>Click</kbd> the moment it splashes &nbsp;·&nbsp; <kbd>Right-click</kbd> reel in';
    if (F.state === 'bite') return '<b>Now!</b> <kbd>Click</kbd> to hook it';
    if (F.state === 'reel') return '<kbd>Click</kbd> when the marker crosses the green zone';
    return '';
  };

  const tip = new THREE.Vector3();
  F.update = function (dt, t) {
    if (F.state === 'idle') return;
    F.t += dt;
    const P = G.player;
    // walking away or swapping tools reels the line in
    const held = G.heldItem();
    if (!held || held.tool !== 'rod' || Math.hypot(P.vel.x, P.vel.z) > 1.2 || G.ui.panel) { F.cancel(); return; }

    let by = G.WATER_Y + 0.02 + Math.sin(t * 2.4) * 0.03;
    if (F.state === 'casting') {
      const k = Math.min(1, F.t / 0.55);
      bobber.position.set(G.lerp(start.x, target.x, k), G.lerp(start.y, G.WATER_Y, k) + Math.sin(k * Math.PI) * 2.2, G.lerp(start.z, target.z, k));
      if (k >= 1) {
        F.state = 'waiting'; F.t = 0;
        wait = 2.2 + Math.random() * 5;
        fish = pickFish();
        splash(6); G.emit('sfx', 'plop');
      }
    } else {
      if (F.state === 'waiting') {
        // a shadow drifts in just before the bite
        const left = wait - F.t;
        if (left < 1.8) {
          shadow.visible = true;
          const k = G.clamp(left / 1.8, 0, 1);
          const a = (target.x * 13.7) % 6.28;
          shadow.position.set(target.x + Math.cos(a) * k * 3.2, G.WATER_Y - 0.25, target.z + Math.sin(a) * k * 3.2);
          shadow.rotation.y = -a;
        }
        if (Math.random() < dt * 0.25) by -= 0.05;
        if (F.t >= wait) {
          F.state = 'bite'; F.t = 0;
          splash(12); G.emit('sfx', 'bite');
          uiEl.innerHTML = '<div class="bang">!</div>'; uiEl.classList.add('show');
        }
      } else if (F.state === 'bite') {
        by -= 0.22 + Math.sin(t * 30) * 0.03;
        if (F.t > 1.25) {
          G.ui.toast('Too slow — it nibbled the bait and left');
          uiEl.classList.remove('show'); uiEl.innerHTML = '';
          shadow.visible = false;
          F.state = 'waiting'; F.t = 0; wait = 2 + Math.random() * 4; fish = pickFish();
        }
      } else if (F.state === 'reel') {
        mark += markDir * speed * dt;
        if (mark > 1) { mark = 1; markDir = -1; } else if (mark < 0) { mark = 0; markDir = 1; }
        const me = document.getElementById('fish-mark');
        if (me) me.style.left = (mark * 100) + '%';
        by -= 0.15 + Math.sin(t * 22) * 0.06;
        if (Math.random() < dt * 5) splash(1);
        shadow.visible = true;
        shadow.position.set(target.x + Math.sin(t * 5) * 0.4, G.WATER_Y - 0.2, target.z + Math.cos(t * 4) * 0.4);
        shadow.rotation.y = t * 3;
      }
      bobber.position.set(target.x, by, target.z);
    }
    // the line sags a little between rod tip and bobber
    rodTip(tip);
    const arr = line.geometry.attributes.position.array;
    for (let i = 0; i < 12; i++) {
      const k = i / 11;
      arr[i * 3] = G.lerp(tip.x, bobber.position.x, k);
      arr[i * 3 + 1] = G.lerp(tip.y, bobber.position.y + 0.1, k) - Math.sin(k * Math.PI) * (F.state === 'reel' ? 0.05 : 0.5);
      arr[i * 3 + 2] = G.lerp(tip.z, bobber.position.z, k);
    }
    line.geometry.attributes.position.needsUpdate = true;
  };
})();
