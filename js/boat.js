// Tidewood Isle — a little rowboat: craft it, launch it at the shore, hop in and paddle around the island.
'use strict';
(function () {
  G.boats = [];

  function buildModel() {
    const g = new THREE.Group();
    const wood = 0xc99a62, dark = 0x8a6038, trim = 0xf4f1ea;
    g.add(G.box(1.0, 0.14, 2.3, dark, 0, 0, 0));                 // floor
    g.add(G.box(0.12, 0.4, 2.3, wood, -0.5, 0.08, 0));           // sides
    g.add(G.box(0.12, 0.4, 2.3, wood, 0.5, 0.08, 0));
    g.add(G.box(1.0, 0.4, 0.12, wood, 0, 0.08, -1.15));          // stern
    g.add(G.box(0.7, 0.4, 0.3, wood, 0, 0.08, 1.25));            // bow
    g.add(G.box(0.36, 0.36, 0.3, wood, 0, 0.1, 1.5));
    g.add(G.box(0.16, 0.06, 2.34, trim, -0.5, 0.48, 0));         // painted rim along each edge
    g.add(G.box(0.16, 0.06, 2.34, trim, 0.5, 0.48, 0));
    g.add(G.box(1.0, 0.06, 0.16, trim, 0, 0.48, -1.15));
    g.add(G.box(0.9, 0.08, 0.3, 0xe6cfa6, 0, 0.24, -0.35));      // bench
    const oarL = G.box(0.06, 0.06, 1.3, 0xe6cfa6, -0.72, 0.42, 0), oarR = G.box(0.06, 0.06, 1.3, 0xe6cfa6, 0.72, 0.42, 0);
    g.add(oarL, oarR);
    g.userData = { oarL, oarR };
    return g;
  }

  // Can the boat float at this spot?
  function floats(x, z) {
    const fx = Math.floor(x), fz = Math.floor(z);
    if (fx < 2 || fz < 2 || fx > G.W - 3 || fz > G.D - 3) return false;
    return G.getBlock(fx, G.SEA - 1, fz) === 0 && G.getBlock(fx, G.SEA, fz) === 0 && G.getBlock(fx, G.SEA + 1, fz) === 0;
  }

  G.spawnBoat = function (x, z, yaw) {
    const boat = {
      kind: 'boat', pos: new THREE.Vector3(x, G.WATER_Y - 0.12, z), yaw: yaw || 0, speed: 0,
      model: buildModel(), pickRadius: 1.0, pickY: 0.3, wake: 0,
    };
    boat.hint = () => (G.player.riding === boat ? '<kbd>F</kbd> or <kbd>Space</kbd> to hop out' : '<kbd>Click</kbd> to hop in &nbsp;·&nbsp; <kbd>Shift</kbd> + click to pick the boat up');
    boat.interact = () => {
      const P = G.player;
      if (G.boats.indexOf(boat) < 0) return;                 // already picked up
      if (P.riding === boat) { dismount(); return; }
      if (G.shiftHeld()) {
        if (!G.hasRoom('rowboat')) { G.ui.toast('Your backpack is full'); return; }
        G.addItem('rowboat', 1, true);
        G.scene.remove(boat.model);
        G.boats.splice(G.boats.indexOf(boat), 1);
        G.entities.splice(G.entities.indexOf(boat), 1);
        G.emit('sfx', 'pickup');
        return;
      }
      if (G.fishing) G.fishing.cancel(true);
      if (P.sitting) G.standUp();
      P.riding = boat; P.vel.set(0, 0, 0);
      G.emit('sfx', 'plop'); G.emit('boarded');
      G.ui.toast('All aboard! Steer with WASD · hop out with F or Space');
    };
    boat.update = (dt, t) => {
      const m = boat.model;
      m.position.set(boat.pos.x, boat.pos.y + Math.sin(t * 1.6 + boat.pos.x) * 0.04, boat.pos.z);
      m.rotation.set(Math.sin(t * 1.3) * 0.03, boat.yaw, Math.sin(t * 1.1 + 1) * 0.04);
      const row = Math.abs(boat.speed) > 0.5 ? Math.sin(t * 5) * 0.5 : 0;
      m.userData.oarL.rotation.y = row; m.userData.oarR.rotation.y = -row;
      if (G.player.riding !== boat) boat.speed *= 0.9;
    };
    G.scene.add(boat.model);
    G.boats.push(boat);
    G.entities.push(boat);
    return boat;
  };

  // Use the rowboat item: set it on the nearest open water.
  G.launchBoat = function () {
    const P = G.player.pos;
    let best = null, bd = 1e9;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
      const x = Math.floor(P.x) + dx + 0.5, z = Math.floor(P.z) + dz + 0.5;
      const d = dx * dx + dz * dz;
      if (d < 2 || d > 30 || d >= bd) continue;
      if (floats(x, z) && floats(x + 1, z) && floats(x - 1, z) && floats(x, z + 1) && floats(x, z - 1)) { bd = d; best = [x, z]; }
    }
    if (!best) { G.ui.toast('Stand at the water\'s edge to launch your boat'); G.emit('sfx', 'nope'); return false; }
    G.consumeHeld(1);
    G.spawnBoat(best[0], best[1], Math.atan2(best[0] - P.x, best[1] - P.z));
    G.burst(best[0], G.WATER_Y + 0.1, best[1], { n: 12, colors: [0xffffff, 0xcfeffa], speed: 2, up: 3, size: 0.09, life: 0.5 });
    G.emit('sfx', 'plop'); G.emit('launched');
    G.ui.toast('Your rowboat bobs on the water — click it to hop in', 'good');
    return true;
  };

  function dismount() {
    const P = G.player, boat = P.riding;
    if (!boat) return;
    P.riding = null;
    boat.speed = 0;
    // step onto the closest dry spot, otherwise slip into the water beside the boat
    let best = null, bd = 1e9;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const x = Math.floor(boat.pos.x) + dx, z = Math.floor(boat.pos.z) + dz;
      const y = G.topSolid(x, z);
      if (y < G.SEA - 1 || y > G.SEA + 3) continue;
      const d = dx * dx + dz * dz;
      if (d < bd && G.aabbFree(x + 0.5, y + 1.02, z + 0.5, P.hw, P.height)) { bd = d; best = [x + 0.5, y + 1.02, z + 0.5]; }
    }
    if (best) P.pos.set(best[0], best[1], best[2]);
    else P.pos.set(boat.pos.x + Math.cos(boat.yaw) * 1.1, G.WATER_Y - 1, boat.pos.z - Math.sin(boat.yaw) * 1.1);
    P.vel.set(0, 0, 0);
    G.emit('sfx', 'jump');
  }
  G.dismountBoat = dismount;

  // Called from the player update while riding.  wx/wz is the wish direction (zero when idle).
  G.driveBoat = function (boat, dt, wx, wz, input) {
    const P = G.player;
    if (input.keys.Space && !G.ui.blocking()) { dismount(); return; }
    const moving = wx !== 0 || wz !== 0;
    if (moving) {
      const want = Math.atan2(wx, wz);
      const diff = G.mod(want - boat.yaw + Math.PI, Math.PI * 2) - Math.PI;
      boat.yaw += G.clamp(diff, -2.4 * dt, 2.4 * dt);
      const facing = Math.max(0, Math.cos(diff));
      boat.speed += (5.6 * facing - boat.speed) * Math.min(1, dt * 1.6);
    } else boat.speed *= Math.max(0, 1 - dt * 1.2);
    const dx = Math.sin(boat.yaw), dz = Math.cos(boat.yaw);
    const nx = boat.pos.x + dx * boat.speed * dt, nz = boat.pos.z + dz * boat.speed * dt;
    if (floats(nx + dx * 1.2, nz + dz * 1.2) && floats(nx, nz)) { boat.pos.x = nx; boat.pos.z = nz; }
    else boat.speed *= 0.5;                       // nudge the sand and stop
    P.pos.set(boat.pos.x - dx * 0.35, boat.pos.y + 0.02, boat.pos.z - dz * 0.35);
    P.yaw = boat.yaw; P.vel.set(0, 0, 0); P.onGround = true; P.swimming = false;
    if (boat.speed > 1.2) {
      if (G.fishing && G.fishing.state !== 'idle') G.fishing.cancel();
      boat.wake -= dt;
      if (boat.wake <= 0) { boat.wake = 0.12; G.burst(boat.pos.x - dx * 1.2, G.WATER_Y + 0.05, boat.pos.z - dz * 1.2, { n: 2, colors: [0xffffff, 0xdff3fb], speed: 0.8, up: 0.9, size: 0.08, life: 0.5, spread: 0.4 }); }
    }
  };

  G.serializeBoats = () => G.boats.map((b) => ({ x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), yaw: +b.yaw.toFixed(2) }));
  G.initBoats = function (save) {
    for (const b of (save && save.boats) || []) G.spawnBoat(b.x, b.z, b.yaw);
  };
})();
