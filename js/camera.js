// Tidewood Isle — input state, orbit camera with roof cut-away, voxel ray picking.
'use strict';
(function () {
  const input = G.input = {
    keys: {}, mouse: { x: 0, y: 0, inside: false },
    ndc: new THREE.Vector2(),
    leftDown: false, rightDown: false, dragging: false, dragDist: 0,
  };
  const cam = G.cam = {
    yaw: 0.0, pitch: 0.66, dist: 12, wantDist: 12,
    target: new THREE.Vector3(),
    cutActive: false, cutY: 0, cutRadius: 9,
  };

  G.initInput = function () {
    const el = G.renderer.domElement;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!input.keys[e.code]) G.emit('keydown', e.code, e);
      input.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
    window.addEventListener('blur', () => { input.keys = {}; input.leftDown = input.rightDown = input.midDown = input.dragging = false; });
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      input.mouse.x = e.clientX - r.left; input.mouse.y = e.clientY - r.top; input.mouse.inside = true;
      input.ndc.set((input.mouse.x / r.width) * 2 - 1, -(input.mouse.y / r.height) * 2 + 1);
      if (input.rightDown || input.midDown) {
        input.dragDist += Math.abs(e.movementX) + Math.abs(e.movementY);
        if (input.dragDist > 6) {
          input.dragging = true;
          cam.yaw -= e.movementX * 0.006;
          cam.pitch = G.clamp(cam.pitch + e.movementY * 0.005, 0.12, 1.45);
        }
      }
    });
    el.addEventListener('mouseleave', () => { input.mouse.inside = false; });
    // Shift counts whether it came from the keyboard state or from the mouse event itself
    G.shiftHeld = () => !!(input.keys.ShiftLeft || input.keys.ShiftRight || input.mouseShift);
    window.addEventListener('mousemove', (e) => { input.mouseShift = e.shiftKey; });
    el.addEventListener('mousedown', (e) => {
      input.mouseShift = e.shiftKey;
      const r = el.getBoundingClientRect();
      input.mouse.x = e.clientX - r.left; input.mouse.y = e.clientY - r.top; input.mouse.inside = true;
      input.ndc.set((input.mouse.x / r.width) * 2 - 1, -(input.mouse.y / r.height) * 2 + 1);
      if (e.button === 0 && e.ctrlKey) { G.emit('secondary'); }        // ctrl-click = right-click on a Mac trackpad
      else if (e.button === 0) { input.leftDown = true; G.emit('primary', true); }
      else if (e.button === 2) { input.rightDown = true; input.dragDist = 0; input.dragging = false; }
      else if (e.button === 1) { input.midDown = true; input.dragDist = 0; input.dragging = false; e.preventDefault(); }
    });
    window.addEventListener('mouseup', (e) => {
      input.mouseShift = e.shiftKey;
      if (e.button === 0) input.leftDown = false;
      else if (e.button === 2) {
        if (input.rightDown && !input.dragging && !e.ctrlKey) G.emit('secondary');
        input.rightDown = false; input.dragging = false;
      } else if (e.button === 1) { if (input.midDown && !input.dragging) G.emit('pickblock'); input.midDown = false; input.dragging = false; }
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      // trackpads send many small deltas, mouse wheels a few big ones — scale smoothly for both
      cam.wantDist = G.clamp(cam.wantDist * Math.exp(G.clamp(e.deltaY, -80, 80) * 0.0018), 3.2, 28);
    }, { passive: false });
  };

  // Is there a roof over the player?  (leaves and tree trunks don't count)
  let canopy = false;      // true when the thing overhead is tree leaves rather than a built roof
  function findRoof() {
    canopy = false;
    const p = G.player.pos;
    const x = Math.floor(p.x), z = Math.floor(p.z), y0 = Math.floor(p.y + 1.6);
    const B = G.B;
    for (let y = y0; y < y0 + 7 && y < G.H; y++) {
      const id = G.getBlock(x, y, z);
      if (!id) continue;
      if (id === B.leaves || id === B.palm_leaves || id === B.blossom_leaves) { canopy = true; return y; }
      if (id === B.log || id === B.palm_log) continue;
      const def = G.BLOCKS[id];
      if (def.shape === 'cube' || def.col) return y;
    }
    return -1;
  }

  const tmp = new THREE.Vector3();
  G.updateCamera = function (dt) {
    const P = G.player, keys = input.keys;
    const blocked = G.ui && G.ui.blocking();
    if (!blocked) {
      if (keys.KeyQ) cam.yaw += 1.9 * dt;
      if (keys.KeyE) cam.yaw -= 1.9 * dt;
      // tilt and zoom from the keyboard, for trackpads without a right-drag
      if (keys.KeyC) cam.pitch = Math.min(1.45, cam.pitch + 0.9 * dt);
      if (keys.KeyZ) cam.pitch = Math.max(0.12, cam.pitch - 0.9 * dt);
      if (keys.Equal) cam.wantDist = Math.max(3.2, cam.wantDist * (1 - 1.2 * dt));
      if (keys.Minus) cam.wantDist = Math.min(28, cam.wantDist * (1 + 1.2 * dt));
    }
    // roof cut-away
    const roof = cam.showRoofs ? -1 : findRoof();      // V toggles the cut-away off for ceiling work
    cam.cutActive = roof >= 0;
    // indoors the walls are sliced two blocks up so the camera can always see over them
    if (cam.cutActive) {
      cam.cutY = Math.min(roof, Math.floor(P.pos.y + 0.1) + (canopy ? 3 : 2));
      cam.cutRadius = canopy ? 4 : 9;       // under a tree only the leaves right overhead fade away
    }
    const u = G.cutUniform.value;
    u.set(P.pos.x, P.pos.z, cam.cutY, cam.cutActive ? cam.cutRadius : 0);

    // Indoors the view tilts up to look over the walls.  This only affects the pitch in use right
    // now (effPitch) — the player's chosen pitch is untouched, so it comes back on the way out.
    const basePitch = Math.max(cam.pitch, cam.cutActive && !canopy ? 1.05 : 0.12);

    tmp.set(P.pos.x, P.pos.y + 1.05, P.pos.z);
    cam.target.lerp(tmp, Math.min(1, dt * 9));
    if (cam.target.distanceToSquared(tmp) > 400) cam.target.copy(tmp);

    // If terrain blocks the view, first try lifting the camera higher; only then move it closer.
    const clearDist = (pitch) => {
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const dx = Math.sin(cam.yaw) * cp, dy = sp, dz = Math.cos(cam.yaw) * cp;
      for (let d = 0.8; d < cam.wantDist; d += 0.25) {
        const x = cam.target.x + dx * d, y = cam.target.y + dy * d, z = cam.target.z + dz * d;
        const by = Math.floor(y);
        // sliced-away blocks never block the camera; inside a building nothing near the player does
        if (cam.cutActive && (x - P.pos.x) ** 2 + (z - P.pos.z) ** 2 < cam.cutRadius * cam.cutRadius && (by >= cam.cutY || !canopy)) continue;
        if (G.OPAQUE[G.getBlock(Math.floor(x), by, Math.floor(z))]) return Math.max(1.2, d - 0.35);
        // smooth ground is drawn up to half a block above its blocks, so keep the view line clear of it too
        const sg = G.surfAt(Math.floor(x), Math.floor(z));
        if (sg >= 0 && y < sg + 1.6 && y > sg) return Math.max(1.2, d - 0.35);
      }
      return cam.wantDist;
    };
    let bestP = basePitch, best = -1;
    for (let k = 0; k < 8; k++) {
      const p = Math.min(1.42, basePitch + k * 0.14);
      const d = clearDist(p);
      if (d > best + 0.3) { best = d; bestP = p; }
      if (d >= cam.wantDist * 0.9 || p >= 1.42) break;
    }
    if (cam.effPitch === undefined) cam.effPitch = cam.pitch;
    cam.effPitch += (bestP - cam.effPitch) * Math.min(1, dt * (bestP > cam.effPitch ? 7 : 3));
    const maxD = clearDist(cam.effPitch);
    const cp = Math.cos(cam.effPitch), sp = Math.sin(cam.effPitch);
    const dx = Math.sin(cam.yaw) * cp, dy = sp, dz = Math.cos(cam.yaw) * cp;
    cam.dist += (maxD - cam.dist) * Math.min(1, dt * (maxD < cam.dist ? 20 : 5));
    const c = G.camera;
    c.position.set(cam.target.x + dx * cam.dist, cam.target.y + dy * cam.dist, cam.target.z + dz * cam.dist);
    if (c.position.y < G.WATER_Y + 0.4) c.position.y = G.WATER_Y + 0.4;
    c.lookAt(cam.target);
    if (G.headUniform) G.headUniform.value.set(P.pos.x, P.pos.y + 1.0, P.pos.z);
  };

  // ---------- voxel ray casting ----------
  function rayBox(ox, oy, oz, dx, dy, dz, b) {
    // returns [tNear, axis, sign] or null
    let tmin = -Infinity, tmax = Infinity, axis = -1, sign = 0;
    const o = [ox, oy, oz], d = [dx, dy, dz];
    for (let a = 0; a < 3; a++) {
      const lo = b[a], hi = b[a + 3];
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo || o[a] > hi) return null; continue; }
      let t1 = (lo - o[a]) / d[a], t2 = (hi - o[a]) / d[a], s = -1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (tmax < 0) return null;
    return [Math.max(tmin, 0), axis, sign];
  }

  // Same test as the shader's peephole: is this point above head height and close to the line from
  // the ray origin (the camera) to the player's head?
  function inPeephole(px, py, pz, ox, oy, oz) {
    const P = G.player.pos, hx = P.x, hy = P.y + 1.0, hz = P.z;
    const bx = hx - ox, by = hy - oy, bz = hz - oz, ax = px - ox, ay = py - oy, az = pz - oz;
    const t = G.clamp((ax * bx + ay * by + az * bz) / (bx * bx + by * by + bz * bz), 0, 1);
    if (t >= 0.995) return false;
    return Math.hypot(ax - bx * t, ay - by * t, az - bz * t) < 3.0;
  }

  // Cast through the grid.  Returns {x,y,z (block to act on), ax,ay,az (cell actually hit), face:[..], t, id, def} or null.
  G.raycast = function (ox, oy, oz, dx, dy, dz, maxDist, opts) {
    opts = opts || {};
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / (dx || 1e-9)), tdy = Math.abs(1 / (dy || 1e-9)), tdz = Math.abs(1 / (dz || 1e-9));
    let tmx = (dx > 0 ? x + 1 - ox : ox - x) * tdx;
    let tmy = (dy > 0 ? y + 1 - oy : oy - y) * tdy;
    let tmz = (dz > 0 ? z + 1 - oz : oz - z) * tdz;
    let face = [0, 0, 0], t = 0;
    // A tree's leaf blocks are hidden inside its round canopy.  They only count as the target if the
    // ray finds no fruit just behind them, so fruit under the leaves can always be clicked.
    let leafHit = null, leafT = 0;
    const cutOn = cam.cutActive && !opts.noCut, P = G.player.pos;
    for (let n = 0; n < 400; n++) {
      if (y >= 0 && y < G.H && x >= 0 && z >= 0 && x < G.W && z < G.D) {
        const id = G.world.blocks[(y * G.D + z) * G.W + x];
        if (id && !(cutOn && y >= cam.cutY && (x + 0.5 - P.x) ** 2 + (z + 0.5 - P.z) ** 2 < cam.cutRadius * cam.cutRadius)) {
          const def = G.BLOCKS[id];
          if (def.tree === 'leaf' && inPeephole(x + 0.5, y + 0.5, z + 0.5, ox, oy, oz)) { /* see-through here: let the click pass */ }
          else if (def.tree === 'leaf' && !opts.cubesOnly && !(G.world.meta[(y * G.D + z) * G.W + x] & 4)) { if (!leafHit) { leafHit = { x, y, z, ax: x, ay: y, az: z, face, t, id, def }; leafT = t; } }
          else if (def.shape === 'cube') return leafHit || { x, y, z, ax: x, ay: y, az: z, face, t, id, def };
          if (!opts.cubesOnly) {
            let tx = x, ty = y, tz = z, tdef = def, pick = def.pick;
            if (id === G.B.filler) {
              const dir = G.FILLER_DIRS[G.getMeta(x, y, z) & 7];
              tx += dir[0]; ty += dir[1]; tz += dir[2];
              tdef = G.getDef(tx, ty, tz);
              pick = [0, 0, 0, 16, 16, 16];
            }
            if (tdef && pick) {
              const rot = tdef.rot && id !== G.B.filler ? G.getMeta(x, y, z) & 3 : 0;
              const pb = rot ? G.rotBox(pick, rot) : pick;
              // things resting on a slope are drawn a little higher or lower: accept a click on either spot
              const yo = (tdef.shape === 'cross' || tdef.rides) ? G.groundOffsetAt(x + 0.5, y, z + 0.5) : 0;
              const hit = rayBox(ox, oy, oz, dx, dy, dz, [x + pb[0] / 16, y + pb[1] / 16 + Math.min(yo, 0), z + pb[2] / 16, x + pb[3] / 16, y + pb[4] / 16 + Math.max(yo, 0), z + pb[5] / 16]);
              if (hit) {
                const f = [0, 0, 0];
                if (hit[1] >= 0) f[hit[1]] = hit[2]; else f[1] = 1;
                const found = { x: tx, y: ty, z: tz, ax: x, ay: y, az: z, face: f, t: hit[0], id: tdef.id, def: tdef, small: true };
                return leafHit && !tdef.fruit ? leafHit : found;
              }
            }
          }
        }
      }
      if (leafHit && t > leafT + 4.5) return leafHit;        // nothing worth picking close behind the leaves
      // an empty cell may still show the top of a flower or shell that the slope has lifted from below
      if (!opts.cubesOnly && y > 0 && y < G.H && x >= 0 && z >= 0 && x < G.W && z < G.D && !G.world.blocks[(y * G.D + z) * G.W + x]) {
        const bid = G.world.blocks[((y - 1) * G.D + z) * G.W + x];
        const bdef = bid ? G.BLOCKS[bid] : null;
        if (bdef && bdef.pick && (bdef.shape === 'cross' || bdef.rides)) {
          const yo = G.groundOffsetAt(x + 0.5, y - 1, z + 0.5);
          if (yo > 0.05) {
            const rot = bdef.rot ? G.getMeta(x, y - 1, z) & 3 : 0;
            const pb = rot ? G.rotBox(bdef.pick, rot) : bdef.pick;
            const hit = rayBox(ox, oy, oz, dx, dy, dz, [x + pb[0] / 16, y - 1 + pb[1] / 16, z + pb[2] / 16, x + pb[3] / 16, y - 1 + pb[4] / 16 + yo, z + pb[5] / 16]);
            if (hit) { const f = [0, 0, 0]; if (hit[1] >= 0) f[hit[1]] = hit[2]; else f[1] = 1; return leafHit || { x, y: y - 1, z, ax: x, ay: y - 1, az: z, face: f, t: hit[0], id: bid, def: bdef, small: true }; }
          }
        }
      }
      if (tmx < tmy && tmx < tmz) { x += stepX; t = tmx; tmx += tdx; face = [-stepX, 0, 0]; }
      else if (tmy < tmz) { y += stepY; t = tmy; tmy += tdy; face = [0, -stepY, 0]; }
      else { z += stepZ; t = tmz; tmz += tdz; face = [0, 0, -stepZ]; }
      if (t > maxDist) return leafHit;
      if (y < -1 && dy < 0) return leafHit;
    }
    return leafHit;
  };

  const raycaster = new THREE.Raycaster();
  // Ray from the mouse cursor into the world
  G.mouseRay = function () {
    raycaster.setFromCamera(input.ndc, G.camera);
    return raycaster.ray;
  };
})();
