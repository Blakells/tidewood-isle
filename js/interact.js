// Tidewood Isle — inventory, targeting, breaking / placing blocks and using things.
'use strict';
(function () {
  const B = G.B;
  const REACH = 7;

  // ---------------- inventory ----------------
  const inv = G.inv = { slots: new Array(36).fill(null), sel: 0, pearls: 0 };
  G.invDirty = true;

  G.addItem = function (id, n, quiet) {
    n = n === undefined ? 1 : n;
    const item = G.ITEMS[id];
    if (!item) { console.warn('unknown item', id); return n; }
    const max = item.stack || 99;
    for (const s of inv.slots) {
      if (n <= 0) break;
      if (s && s.id === id && s.n < max) { const add = Math.min(n, max - s.n); s.n += add; n -= add; }
    }
    for (let i = 0; i < inv.slots.length && n > 0; i++) {
      if (!inv.slots[i]) { const add = Math.min(n, max); inv.slots[i] = { id, n: add }; n -= add; }
    }
    G.invDirty = true;
    if (!quiet) G.emit('gain', id);
    return n;   // leftover that did not fit
  };
  G.countItem = function (id) { let c = 0; for (const s of inv.slots) if (s && s.id === id) c += s.n; return c; };
  G.removeItem = function (id, n) {
    n = n === undefined ? 1 : n;
    if (G.countItem(id) < n) return false;
    for (let i = inv.slots.length - 1; i >= 0 && n > 0; i--) {
      const s = inv.slots[i];
      if (s && s.id === id) { const take = Math.min(n, s.n); s.n -= take; n -= take; if (s.n <= 0) inv.slots[i] = null; }
    }
    G.invDirty = true;
    return true;
  };
  // Would every item in `list` ([{id, n}, ...]) fit?  Simulated on a copy so partial stacks count.
  G.canFit = function (list) {
    const sim = inv.slots.map((s) => (s ? { id: s.id, n: s.n } : null));
    for (const it of list) {
      const max = (G.ITEMS[it.id] && G.ITEMS[it.id].stack) || 99;
      let n = it.n === undefined ? 1 : it.n;
      for (const s of sim) { if (n <= 0) break; if (s && s.id === it.id && s.n < max) { const a = Math.min(n, max - s.n); s.n += a; n -= a; } }
      for (let i = 0; i < sim.length && n > 0; i++) if (!sim[i]) { const a = Math.min(n, max); sim[i] = { id: it.id, n: a }; n -= a; }
      if (n > 0) return false;
    }
    return true;
  };
  G.hasRoom = (id, n) => G.canFit([{ id, n: n === undefined ? 1 : n }]);
  G.heldSlot = () => inv.slots[inv.sel];
  G.heldItem = () => { const s = inv.slots[inv.sel]; return s ? G.ITEMS[s.id] : null; };
  G.consumeHeld = function (n) {
    const s = inv.slots[inv.sel];
    if (!s) return;
    s.n -= n || 1;
    if (s.n <= 0) inv.slots[inv.sel] = null;
    G.invDirty = true;
  };
  G.addPearls = function (n) { inv.pearls = Math.max(0, inv.pearls + n); G.invDirty = true; if (n > 0) G.emit('pearls', n); };

  // ---------------- targeting ----------------
  G.target = null;
  G.placeRot = 0;
  let highlight, hlFill, ghost, ghostKey = '';
  const breaking = { key: '', dmg: 0, t: 0 };
  let hitCooldown = 0, pendingHit = false, pendingTarget = null;

  G.initInteract = function () {
    const g = new THREE.BoxGeometry(1, 1, 1);
    highlight = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
    hlFill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
    highlight.visible = hlFill.visible = false;
    highlight.renderOrder = 5; hlFill.renderOrder = 4;
    G.scene.add(highlight, hlFill);
    G.ghostMat = new THREE.MeshLambertMaterial({ map: G.atlasTexture, vertexColors: true, alphaTest: 0.3, transparent: true, opacity: 0.6, depthWrite: false });
    G.ghostBadMat = new THREE.MeshBasicMaterial({ map: G.atlasTexture, alphaTest: 0.3, transparent: true, opacity: 0.45, color: 0xff7a7a, depthWrite: false });

    // remember exactly where a tap landed, so the hit goes there even if the cursor moves on
    G.on('primary', () => { pendingHit = true; refreshTarget(); pendingTarget = G.target; });
    G.on('secondary', () => { if (!G.ui.blocking()) { refreshTarget(); G.secondaryAction(); } });
    G.on('keydown', (code) => {
      if (G.ui.blocking()) return;
      if (code === 'KeyR') { G.placeRot = (G.placeRot + 1) & 3; G.emit('sfx', 'tick'); }
      if (code === 'KeyG') {
        const P = G.player;
        P.wave = 1.4; G.emit('sfx', 'chirp');
        if (G.wishWindow > 0 && (G.flags.wishes || 0) < 3) { G.wishWindow = 0; G.makeWish(); }
        G.floatText(P.pos.x, P.pos.y + 2.0, P.pos.z, '👋');
        for (const v of G.villagers || []) if (!v.inside && Math.hypot(v.pos.x - P.pos.x, v.pos.z - P.pos.z) < 7) { v.waveBack = 1.6; v.pause = Math.max(v.pause, 2); v.goal = null; G.emit('wavedAt', v.id); G.floatText(v.pos.x, v.pos.y + 2.1, v.pos.z, '👋'); }
        for (const p of G.pets || []) if (p.adopted && Math.hypot(p.pos.x - P.pos.x, p.pos.z - P.pos.z) < 6) { p.mood = 2; G.floatText(p.pos.x, p.pos.y + 1, p.pos.z, '❤️', 'heart'); }
      }
      if (code === 'KeyF') { refreshTarget(); G.useAction(); }
      if (code === 'KeyX') { refreshTarget(); G.secondaryAction(); }          // keyboard stand-in for right-click
    });
  };

  const chest = new THREE.Vector3();
  function withinReach(x, y, z) {
    chest.copy(G.player.pos); chest.y += 0.8;
    return (x + 0.5 - chest.x) ** 2 + (y + 0.5 - chest.y) ** 2 + (z + 0.5 - chest.z) ** 2 < REACH * REACH;
  }

  // Work out what the cursor is pointing at right now.  Called every frame, and again at the
  // moment of a click so a fast move-and-click never acts on last frame's target.
  function refreshTarget() {
    let target = null;
    const blocked = G.ui.blocking() || !G.input.mouse.inside || G.input.dragging;
    if (!blocked) {
      const ray = G.mouseRay();
      const o = ray.origin, d = ray.direction;
      const hit = G.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 80);
      // creatures & villagers
      let ent = null, entT = Infinity;
      if (G.entities) for (const e of G.entities) {
        if (!e.pickRadius) continue;
        const cx = e.pos.x - o.x, cy = (e.visY !== undefined ? e.visY : e.pos.y) + (e.pickY || 0.4) - o.y, cz = e.pos.z - o.z;
        const tca = cx * d.x + cy * d.y + cz * d.z;
        if (tca < 0) continue;
        const d2 = cx * cx + cy * cy + cz * cz - tca * tca;
        if (d2 < e.pickRadius * e.pickRadius && tca < entT) { entT = tca; ent = e; }
      }
      // water surface
      let waterT = Infinity, water = null;
      if (d.y < -0.01) {
        const t = (G.WATER_Y - o.y) / d.y;
        const wx = o.x + d.x * t, wz = o.z + d.z * t;
        if (t > 0 && G.isWaterSurface(Math.floor(wx), Math.floor(wz))) { waterT = t; water = { type: 'water', x: wx, y: G.WATER_Y, z: wz }; }
      }
      const hitT = hit ? hit.t : Infinity;
      // creatures stand on the drawn ground, which can sit a little below its blocks, so they win close calls
      if (ent && entT < hitT + 1.3) {
        const dist = Math.hypot(ent.pos.x - G.player.pos.x, ent.pos.z - G.player.pos.z);
        target = { type: 'entity', ent, near: dist < (ent.reach || 4.5) };
      } else if (water && waterT < hitT && G.heldItem() && G.heldItem().tool === 'rod') {
        const dist = Math.hypot(water.x - G.player.pos.x, water.z - G.player.pos.z);
        water.near = dist < 11 && dist > 1.2;
        target = water;
      } else if (hit) {
        target = { type: 'block', hit, x: hit.x, y: hit.y, z: hit.z, def: hit.def, near: withinReach(hit.x, hit.y, hit.z) };
      }
    }
    G.target = target;
    updateHighlight(target);
    updateGhost(target);
    return blocked;
  }
  G.refreshTarget = refreshTarget;

  G.updateTargeting = function (dt) {
    hitCooldown -= dt;
    const blocked = refreshTarget();

    // a quick tap always lands one hit; holding repeats
    if (blocked) pendingHit = false;
    else if (pendingHit || (G.input.leftDown && hitCooldown <= 0)) {
      if (pendingHit && pendingTarget) G.target = pendingTarget;
      pendingHit = false; pendingTarget = null;
      hitCooldown = 0.22;
      G.primaryAction();
    }
    if (breaking.key) {
      breaking.t += dt;
      if (breaking.t > 1.4) { breaking.key = ''; breaking.dmg = 0; }
    }
  };

  G.isWaterSurface = function (x, z) {
    if (x < 0 || z < 0 || x >= G.W || z >= G.D) return true;
    return G.getBlock(x, G.SEA - 1, z) === 0 && G.getBlock(x, G.SEA, z) === 0;
  };

  function pickBounds(t) {
    const def = t.def, h = t.hit;
    if (def.shape === 'cube') return [0, 0, 0, 16, 16, 16];
    let pb = def.pick || [0, 0, 0, 16, 16, 16];
    const meta = G.getMeta(t.x, t.y, t.z);
    if (def.rot) pb = G.rotBox(pb, meta & 3);
    return pb;
  }

  function updateHighlight(t) {
    if (!t || t.type !== 'block') {
      highlight.visible = hlFill.visible = false;
      if (t && t.type === 'water' && G.fishing) G.fishing.showAim(t);
      else if (G.fishing) G.fishing.showAim(null);
      return;
    }
    if (G.fishing) G.fishing.showAim(null);
    const pb = pickBounds(t);
    const sx = (pb[3] - pb[0]) / 16 + 0.02, sy = (pb[4] - pb[1]) / 16 + 0.02, sz = (pb[5] - pb[2]) / 16 + 0.02;
    const cx = t.x + (pb[0] + pb[3]) / 32, cy = t.y + (pb[1] + pb[4]) / 32, cz = t.z + (pb[2] + pb[5]) / 32;
    const key = t.x + ',' + t.y + ',' + t.z;
    let cyy = cy, syy = sy;
    // smooth ground is marked with a low tile resting on the slope, not a buried cube outline
    if (G.NATURAL[t.def.id] && G.surfAt(t.x, t.z) === t.y) { syy = 0.14; cyy = t.y + 1 + G.groundOffsetAt(t.x + 0.5, t.y + 1, t.z + 0.5) + 0.02; }
    const prog = breaking.key === key ? breaking.dmg / (t.def.hp || 1) : 0;
    const wob = prog > 0 ? 1 - prog * 0.1 : 1;
    for (const m of [highlight, hlFill]) { m.position.set(cx, cyy, cz); m.scale.set(sx * wob, syy * wob, sz * wob); m.visible = true; }
    highlight.material.opacity = t.near ? 0.95 : 0.25;
    hlFill.material.opacity = t.near ? 0.1 + prog * 0.45 : 0.03;
  }

  // ---------------- placement ----------------
  const REPLACEABLE = new Set(['tall_grass', 'fern']);
  function rotOffset(o, r) {
    let dx = o[0], dz = o[2];
    for (let i = 0; i < r; i++) { const nx = -dz, nz = dx; dx = nx; dz = nz; }
    return [dx, o[1], dz];
  }
  G.rotOffset = rotOffset;

  function facingRot(x, z) {
    const vx = G.player.pos.x - (x + 0.5), vz = G.player.pos.z - (z + 0.5);
    let best = 0, bd = -Infinity;
    for (let r = 0; r < 4; r++) { const d = G.FRONT[r][0] * vx + G.FRONT[r][1] * vz; if (d > bd) { bd = d; best = r; } }
    return best;
  }

  // any full cube counts as a wall for hanging things (including log walls)
  const isWallAt = (x, y, z) => { const d = G.getDef(x, y, z); return !!(d && d.shape === 'cube' && d.col); };

  // Work out where the held block would go.  Returns {x,y,z,meta,def,ok,why} or null.
  G.computePlacement = function (t, item) {
    if (!t || t.type !== 'block' || !item || item.kind !== 'block') return null;
    const def = G.BLOCKS[item.block];
    const h = t.hit;
    let x, y, z;
    const hitDef = G.getDef(h.ax, h.ay, h.az);
    if (hitDef && REPLACEABLE.has(hitDef.key)) { x = h.ax; y = h.ay; z = h.az; }
    else { x = h.ax + h.face[0]; y = h.ay + h.face[1]; z = h.az + h.face[2]; }
    const res = { x, y, z, meta: 0, def, ok: true, why: '' };
    if (!G.inWorld(x, y, z) || y >= G.H - 1) { res.ok = false; res.why = 'Too far out'; return res; }
    const cur = G.getDef(x, y, z);
    if (cur && !REPLACEABLE.has(cur.key)) { res.ok = false; res.why = 'Something is in the way'; return res; }
    if (!withinReach(x, y, z)) { res.ok = false; res.why = 'Too far away'; return res; }
    // rotation
    let rot = 0;
    if (def.rot) {
      if (def.wall) {
        rot = -1;
        if (h.face[1] === 0) { for (let r = 0; r < 4; r++) if (G.FRONT[r][0] === h.face[0] && G.FRONT[r][1] === h.face[2]) rot = r; }
        else {
          const pref = facingRot(x, z);
          for (let k = 0; k < 4; k++) { const r = (pref + k) & 3; if (isWallAt(x - G.FRONT[r][0], y, z - G.FRONT[r][1])) { rot = r; break; } }
        }
        if (rot < 0 || !isWallAt(x - G.FRONT[rot][0], y, z - G.FRONT[rot][1])) { res.ok = false; res.why = 'Needs a wall behind it'; rot = Math.max(0, rot); }
      } else {
        rot = (facingRot(x, z) + G.placeRot) & 3;
      }
    }
    res.meta = rot;
    if (def.tree || def.fruit) res.meta = 4;        // player-placed logs, leaves and fruit are decor, not part of a tree
    // support rules
    const below = G.getDef(x, y - 1, z);
    if (def.place === 'soil' || def.place === 'sand') {
      if (!below || !below.opaque) { res.ok = false; res.why = 'Needs ground underneath'; }
    }
    // extra cells (doors, beds)
    if (def.extra) {
      for (const e of def.extra) {
        const o = rotOffset(e, rot);
        const c = G.getDef(x + o[0], y + o[1], z + o[2]);
        if (!G.inWorld(x + o[0], y + o[1], z + o[2]) || (c && !REPLACEABLE.has(c.key))) { res.ok = false; res.why = 'Not enough room'; }
      }
    }
    // don't trap the player or a pet inside a solid block
    if (def.col && res.ok) {
      const p = G.player.pos, hw = G.player.hw;
      if (p.x + hw > x && p.x - hw < x + 1 && p.z + hw > z && p.z - hw < z + 1 && p.y + G.player.height > y && p.y < y + 1) { res.ok = false; res.why = 'You are standing there'; }
    }
    return res;
  };

  function updateGhost(t) {
    const item = G.heldItem();
    const pl = t && t.near !== undefined ? G.computePlacement(t, item) : null;
    G.placement = pl;
    if (!pl || (t.def && t.def.use && !G.shiftHeld())) { if (ghost) ghost.visible = false; return; }
    const key = pl.def.id + ':' + pl.meta;
    if (key !== ghostKey) {
      if (ghost) { G.scene.remove(ghost); ghost.geometry.dispose(); }
      ghost = new THREE.Mesh(G.buildBlockGeometry(pl.def, pl.meta & 3), G.ghostMat);
      ghost.renderOrder = 6;
      G.scene.add(ghost);
      ghostKey = key;
    }
    ghost.material = pl.ok ? G.ghostMat : G.ghostBadMat;
    ghost.position.set(pl.x, pl.y, pl.z);
    ghost.visible = true;
  }

  G.placeBlockAt = function (x, y, z, def, meta) {
    G.setBlock(x, y, z, def.id, meta);
    if (def.extra) {
      for (const e of def.extra) {
        const o = rotOffset(e, meta & 3);
        let dirIdx = 0;
        for (let i = 0; i < G.FILLER_DIRS.length; i++) { const d = G.FILLER_DIRS[i]; if (d[0] === -o[0] && d[1] === -o[1] && d[2] === -o[2]) dirIdx = i; }
        G.setBlock(x + o[0], y + o[1], z + o[2], B.filler, dirIdx);
      }
    }
    G.refreshLightAt(x, y, z);
    if (y < G.SEA) G.waterDirty = true;
  };

  function tryPlace() {
    const pl = G.placement, slot = G.heldSlot();
    if (!pl || !slot) return false;
    if (!pl.ok) { G.ui.toast(pl.why || "Can't place that here"); G.emit('sfx', 'nope'); return true; }
    G.placeBlockAt(pl.x, pl.y, pl.z, pl.def, pl.meta);
    G.consumeHeld(1);
    G.player.swing = 0.28;
    G.emit('sfx', 'place');
    G.emit('placed', pl.def.key, pl.x, pl.y, pl.z);
    G.burst(pl.x + 0.5, pl.y + 0.3, pl.z + 0.5, { n: 4, color: 0xfff6e0, speed: 1.5, up: 1.2, size: 0.07, life: 0.35 });
    return true;
  }

  // ---------------- breaking ----------------
  function dropsFor(def, meta) {
    if (def.crop) {
      const stage = (meta >> 3) & 3;
      if (stage >= 3) return [{ id: def.crop.produce, n: 1 + ((Math.random() * 2) | 0) }, { id: def.crop.seed, n: 1 + ((Math.random() * 2) | 0) }];
      return [{ id: def.crop.seed, n: 1 }];
    }
    if (def.drops) {
      const out = [];
      for (const d of def.drops) if (d.chance === undefined || Math.random() < d.chance) out.push({ id: d.id, n: d.n || 1 });
      return out;
    }
    return def.item ? [{ id: def.key, n: 1 }] : [];
  }

  function particleColor(def) {
    let tile = null;
    if (def.shape === 'cube') tile = def.iconTiles.side;
    else if (def.shape === 'cross') tile = def.iconTile;
    const css = tile && G.TILE_COLORS[tile];
    if (!css) return 0xe8d8b8;
    const m = css.match(/\d+/g);
    return (Number(m[0]) << 16) | (Number(m[1]) << 8) | Number(m[2]);
  }

  // Remove a block and hand out its drops.  Returns true if removed.
  G.breakBlock = function (x, y, z, opts) {
    opts = opts || {};
    const id = G.getBlock(x, y, z);
    if (!id) return false;
    const def = G.BLOCKS[id];
    const meta = G.getMeta(x, y, z);
    if (def.key === 'filler') {
      const d = G.FILLER_DIRS[meta & 7];
      return G.breakBlock(x + d[0], y + d[1], z + d[2], opts);
    }
    if (def.hp >= 9999) return false;
    if (def.use === 'chest' && G.chests && G.chests[x + ',' + y + ',' + z] && G.chests[x + ',' + y + ',' + z].some((s) => s)) {
      if (!opts.silent) G.ui.toast('Empty the chest first');
      return false;
    }
    const drops = opts.noDrops ? [] : dropsFor(def, meta);
    if (drops.length && !G.canFit(drops)) { if (!opts.silent) G.ui.toast('Your backpack is too full for that'); return false; }
    G.setBlock(x, y, z, 0, 0);
    if (def.extra) for (const e of def.extra) { const o = rotOffset(e, meta & 3); if (G.getBlock(x + o[0], y + o[1], z + o[2]) === B.filler) G.setBlock(x + o[0], y + o[1], z + o[2], 0, 0); }
    G.refreshLightAt(x, y, z);
    if (y < G.SEA) G.waterDirty = true;
    let label = '';
    for (const d of drops) {
      G.addItem(d.id, d.n, true);
      const it = G.ITEMS[d.id];
      label += '<span>+' + d.n + ' ' + G.iconHTML(d.id) + '</span>';
      G.emit('collect', d.id, d.n, def);
    }
    if (label && !opts.quietText) G.floatText(x + 0.5, y + 0.8, z + 0.5, label);
    if (!opts.noFx) G.burst(x + 0.5, y + 0.5, z + 0.5, { n: def.shape === 'cube' ? 9 : 5, color: particleColor(def), speed: 2.2, up: 2.6, size: 0.13 });
    G.emit('broke', def.key, x, y, z);
    // anything resting on top that needs support comes away too
    const above = G.getDef(x, y + 1, z);
    if (above && def.opaque && (above.shape === 'cross' || above.cat === 'find' || above.place === 'soil')) G.breakBlock(x, y + 1, z, { silent: true });
    return true;
  };

  // Chop the whole tree when a natural trunk is cut.
  function fellTree(x, y, z, logId) {
    const stack = [[x, y, z]], seen = new Set(), logs = [];
    const leafIds = [B.leaves, B.palm_leaves, B.blossom_leaves];
    while (stack.length && logs.length < 40) {
      const [cx, cy, cz] = stack.pop();
      const k = cx + ',' + cy + ',' + cz;
      if (seen.has(k)) continue;
      seen.add(k);
      if (G.getBlock(cx, cy, cz) !== logId || (G.getMeta(cx, cy, cz) & 4)) continue;
      logs.push([cx, cy, cz]);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) if (dx || dy || dz) stack.push([cx + dx, cy + dy, cz + dz]);
    }
    let n = 0, extra = {};
    for (const [lx, ly, lz] of logs) { if (G.breakBlock(lx, ly, lz, { quietText: true, silent: true })) n++; }
    // loose leaves flutter away
    for (const [lx, ly, lz] of logs) {
      for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -3; dz <= 3; dz++) {
        const bx = lx + dx, by = ly + dy, bz = lz + dz;
        const bid = G.getBlock(bx, by, bz);
        if (bid && (G.getMeta(bx, by, bz) & 4)) continue;   // something the player placed: leave it be
        if (bid && G.BLOCKS[bid].fruit) {                 // fruit comes down with the tree
          const fk = G.BLOCKS[bid].key;
          G.setBlock(bx, by, bz, 0, 0);
          if (G.hasRoom(fk, 1)) { G.addItem(fk, 1, true); extra[fk] = (extra[fk] || 0) + 1; G.emit('collect', fk, 1, G.BLOCKS[bid]); }
          continue;
        }
        if (!leafIds.includes(bid)) continue;
        // keep leaves that still touch another trunk
        let held = false;
        for (let ax = -2; ax <= 2 && !held; ax++) for (let ay = -2; ay <= 1 && !held; ay++) for (let az = -2; az <= 2 && !held; az++) {
          const o = G.getBlock(bx + ax, by + ay, bz + az);
          if ((o === B.log || o === B.palm_log) && !(G.getMeta(bx + ax, by + ay, bz + az) & 4)) held = true;
        }
        if (!held) {
          const def = G.BLOCKS[bid];
          G.setBlock(bx, by, bz, 0, 0);
          for (const d of dropsFor(def, 0)) { if (G.hasRoom(d.id, d.n)) { G.addItem(d.id, d.n, true); extra[d.id] = (extra[d.id] || 0) + d.n; G.emit('collect', d.id, d.n, def); } }
          if (Math.random() < 0.35) G.burst(bx + 0.5, by + 0.5, bz + 0.5, { n: 2, color: particleColor(def), speed: 1.5, up: 0.5, grav: 3, life: 1.1, size: 0.12 });
        }
      }
    }
    const logKey = G.BLOCKS[logId].key;
    let label = '<span>+' + n + ' ' + G.iconHTML(logKey) + '</span>';
    for (const k in extra) label += '<span>+' + extra[k] + ' ' + G.iconHTML(k) + '</span>';
    G.floatText(x + 0.5, y + 1.6, z + 0.5, label);
    G.emit('sfx', 'timber');
    G.emit('felled', logKey);
  }

  // Give a tree a good shake: ripe fruit drops into your arms, and now and then something else does.
  function shakeTree(x, y, z, logId) {
    let top = y;
    while (G.getBlock(x, top + 1, z) === logId) top++;
    let base = y;
    while (G.getBlock(x, base - 1, z) === logId) base--;
    G.emit('sfx', 'hitSoft');
    const leaf = G.getBlock(x, top + 1, z);
    G.burst(x + 0.5, top + 0.6, z + 0.5, { n: 12, colors: leaf === B.blossom_leaves ? [0xffc4d8, 0xffe0ea] : [0x92dc76, 0xb2ea8c, 0x70c25e], speed: 2.2, up: 0.6, grav: 2.4, life: 1.6, size: 0.09, spread: 1.6 });
    const got = {};
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -3; dy <= 0; dy++) {
      const d = G.getDef(x + dx, top + dy, z + dz);
      if (!d || !d.fruit || (G.getMeta(x + dx, top + dy, z + dz) & 4)) continue;
      if (!G.hasRoom(d.key, 1)) { G.ui.toast('Your backpack is full'); continue; }
      G.setBlock(x + dx, top + dy, z + dz, 0, 0);
      G.addItem(d.key, 1, true); got[d.key] = (got[d.key] || 0) + 1;
      G.emit('collect', d.key, 1, d);
    }
    const key = x + ',' + base + ',' + z;
    if (!G.flags.shaken || G.flags.shaken.day !== G.day) G.flags.shaken = { day: G.day, trees: {} };
    const shaken = G.flags.shaken.trees;      // remembered in the save, so reloading gives no extra rolls
    let label = '';
    for (const k in got) label += '<span>+' + got[k] + ' ' + G.iconHTML(k) + '</span>';
    if (!shaken[key]) {
      shaken[key] = true;
      const r = Math.random();
      if (r < 0.1) { const n = 10 + ((Math.random() * 20) | 0); G.addPearls(n); label += '<span>+' + n + ' <i class="pearl"></i></span>'; G.emit('sfx', 'coin'); }
      else if (r < 0.25 && G.hasRoom('stick', 1)) { G.addItem('stick', 1, true); label += '<span>+1 ' + G.iconHTML('stick') + '</span>'; }
      else if (r < 0.3 && leaf === B.palm_leaves && G.hasRoom('coconut', 1)) { G.addItem('coconut', 1, true); label += '<span>+1 ' + G.iconHTML('coconut') + '</span>'; }
    }
    if (label) { G.floatText(x + 0.5, y + 1.6, z + 0.5, label); G.emit('sfx', 'pickup'); }
    G.emit('shook');
  }

  function hitBlock(t) {
    const def = t.def, x = t.x, y = t.y, z = t.z;
    const held = G.heldItem();
    const tool = held && held.tool;
    G.player.swing = 0.28;
    facePlayerTo(x + 0.5, z + 0.5);
    if (def.hp >= 9999) { G.emit('sfx', 'nope'); return; }
    // without the axe in hand, a tree is shaken rather than chopped
    if (def.tree === 'trunk' && !(G.getMeta(x, y, z) & 4) && tool !== 'axe') { shakeTree(x, y, z, def.id); G.input.leftDown = false; return; }
    if (def.key === 'berry_bush' && (G.getMeta(x, y, z) & 4) && !tool) { G.useBlock(x, y, z, def); return; }
    if (def.instant) {
      // beach finds: one tap to pick up
      if (G.breakBlock(x, y, z, { noFx: true })) {
        G.burst(x + 0.5, y + 0.3, z + 0.5, { n: 6, colors: [0xffffff, 0xfff2b0, 0xffd6e6], speed: 1.6, up: 2.4, size: 0.07, life: 0.5, glow: true });
        G.emit('sfx', 'pickup');
        if (def.key === 'bottle') G.openBottle();
      }
      return;
    }
    const key = x + ',' + y + ',' + z;
    if (breaking.key !== key) { breaking.key = key; breaking.dmg = 0; }
    breaking.t = 0;
    const power = def.tool && tool === def.tool ? 3 : 1;
    breaking.dmg += power;
    G.emit('sfx', def.tool === 'pick' ? 'hitStone' : def.tool === 'axe' ? 'hitWood' : 'hitSoft');
    G.burst(x + 0.5 + t.hit.face[0] * 0.5, y + 0.5 + t.hit.face[1] * 0.5, z + 0.5 + t.hit.face[2] * 0.5, { n: 3, color: particleColor(def), speed: 1.6, up: 1.6, size: 0.09, life: 0.4 });
    if (breaking.dmg >= def.hp) {
      breaking.key = ''; breaking.dmg = 0;
      const meta = G.getMeta(x, y, z);
      if ((def.key === 'log' || def.key === 'palm_log') && !(meta & 4)) { fellTree(x, y, z, def.id); return; }
      if (G.breakBlock(x, y, z)) G.emit('sfx', 'break');
    }
  }

  function facePlayerTo(x, z) {
    const p = G.player;
    if (p.sitting) return;
    p.yaw = Math.atan2(x - p.pos.x, z - p.pos.z);
  }
  G.facePlayerTo = facePlayerTo;

  // ---------------- actions ----------------
  G.primaryAction = function () {
    if (G.fishing && G.fishing.onClick()) return;
    const t = G.target;
    if (!t) return;
    if (t.type === 'entity') {
      if (!t.near) { G.ui.toast('Get a little closer'); return; }
      t.ent.interact && t.ent.interact();
      G.input.leftDown = false;
      return;
    }
    if (t.type === 'water') {
      if (!t.near) { G.ui.toast('Aim for water a bit closer to you'); G.input.leftDown = false; return; }
      G.fishing.cast(t.x, t.z);
      G.input.leftDown = false;
      return;
    }
    if (!t.near) return;
    hitBlock(t);
  };

  G.useAction = function () {
    const t = G.target;
    if (t && t.type === 'entity' && t.near && t.ent.interact) { t.ent.interact(); return true; }
    if (t && t.type === 'block' && t.near && t.def.use) { G.useBlock(t.x, t.y, t.z, t.def); return true; }
    // otherwise use whatever interactive thing is closest
    const p = G.player.pos;
    let best = null, bd = 2.6 * 2.6;
    if (G.entities) for (const e of G.entities) {
      if (!e.interact || !e.pickRadius || e.species) continue;       // bugs must be clicked, never auto-picked
      if (Math.abs(e.pos.y - p.y) > 2.5) continue;
      const d = (e.pos.x - p.x) ** 2 + (e.pos.z - p.z) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { best.interact(); return true; }
    const px = Math.floor(p.x), py = Math.floor(p.y + 0.5), pz = Math.floor(p.z);
    let bb = null; bd = 99;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) {
      const def = G.getDef(px + dx, py + dy, pz + dz);
      if (def && def.use) { const d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bb = [px + dx, py + dy, pz + dz, def]; } }
    }
    if (bb) { G.useBlock(bb[0], bb[1], bb[2], bb[3]); return true; }
    return false;
  };

  G.secondaryAction = function () {
    if (G.fishing && G.fishing.state !== 'idle') { G.fishing.cancel(); return; }
    const t = G.target;
    const held = G.heldItem();
    const shift = G.shiftHeld();
    if (t && t.type === 'entity') { if (t.near && t.ent.interact) t.ent.interact(); return; }
    if (t && t.type === 'block' && t.near) {
      if (t.def.use && !shift) { G.useBlock(t.x, t.y, t.z, t.def); return; }
      if (held && held.kind === 'seed') { if (G.plantSeed) G.plantSeed(t, held); return; }
    }
    if (held && held.key === 'rowboat') { G.launchBoat(); return; }
    if (held && held.kind === 'block' && t && t.type === 'block') { if (tryPlace()) return; }
    if (held && (held.food || held.kind === 'food')) { G.eatHeld(); return; }
  };

  G.eatHeld = function () {
    const held = G.heldItem();
    if (!held) return;
    G.consumeHeld(1);
    G.player.pep = Math.max(G.player.pep, 30 + (held.food || 1) * 25);
    G.emit('sfx', 'eat');
    G.emit('ate', held.key);
    const p = G.player.pos;
    G.floatText(p.x, p.y + 1.9, p.z, 'Yum! <span>💨 pep in your step</span>');
    G.burst(p.x, p.y + 1.3, p.z, { n: 6, colors: [0xffd6e6, 0xfff2b0], speed: 1.2, up: 2, size: 0.07, glow: true });
  };

  // Grill the held fish or corn.  The raw item is only used up once the cooked one has somewhere to go.
  function cookHeld(held, x, y, z) {
    const out = held.fish ? 'cooked_fish' : 'roast_corn';
    const slot = G.heldSlot();
    if (!(slot && slot.n === 1) && !G.hasRoom(out, 1)) { G.ui.toast('Your backpack is full'); return; }
    G.consumeHeld(1);
    G.addItem(out, 1, true);
    G.floatText(x + 0.5, y, z + 0.5, '<span>+1 ' + G.iconHTML(out) + '</span>');
    G.emit('sfx', 'sizzle'); G.emit('cooked', out);
  }

  // Right-click / F on an interactive block
  G.useBlock = function (x, y, z, def) {
    const meta = G.getMeta(x, y, z);
    const held = G.heldItem();
    switch (def.use) {
      case 'door': {
        if (meta & 4) {
          // closing: make sure nobody would end up inside the shut door (exact collider overlap)
          const rot = meta & 3;
          const inWay = (e, hw, h) => def.col.some((c) => {
            let bx0 = c[0], bz0 = c[2], bx1 = c[3], bz1 = c[5];
            for (let r = 0; r < rot; r++) { const nx0 = 1 - bz1, nx1 = 1 - bz0, nz0 = bx0, nz1 = bx1; bx0 = nx0; bx1 = nx1; bz0 = nz0; bz1 = nz1; }
            const m = 0.04;
            return e.x + hw + m > x + bx0 && e.x - hw - m < x + bx1 && e.z + hw + m > z + bz0 && e.z - hw - m < z + bz1 && e.y + h > y + c[1] && e.y < y + c[4];
          });
          if (inWay(G.player.pos, G.player.hw, G.player.height) || (G.entities || []).some((e) => e.pos && e.pickRadius && !e.species && e.kind !== 'boat' && inWay(e.pos, 0.25, 1))) { G.ui.toast('Something is standing in the doorway'); break; }
        }
        G.setMeta(x, y, z, meta ^ 4);
        G.emit('sfx', (meta & 4) ? 'doorClose' : 'doorOpen');
        break;
      }
      case 'campfire':
        if (!(meta & 4)) {
          G.setMeta(x, y, z, meta | 4); G.refreshLightAt(x, y, z);
          G.emit('sfx', 'ignite'); G.emit('campfireLit', x, y, z);
          G.ui.toast('The campfire crackles to life 🔥');
        } else if (held && (held.fish || held.key === 'corn')) {
          cookHeld(held, x, y + 1, z);
        } else if (held && held.tool === 'shovel') {
          G.setMeta(x, y, z, meta & ~4); G.refreshLightAt(x, y, z);
          G.emit('sfx', 'douse');
          G.ui.toast('You smother the fire with a little sand');
        } else {
          G.ui.toast('Hold a fish or corn to grill it · use your shovel to put the fire out');
        }
        break;
      case 'bush':
        if (meta & 4) {
          const n = 2 + ((Math.random() * 2) | 0);
          if (!G.hasRoom('berry', n)) { G.ui.toast('Your backpack is full'); break; }
          G.setMeta(x, y, z, meta & ~4);
          G.addItem('berry', n, true);
          G.floatText(x + 0.5, y + 1, z + 0.5, '<span>+' + n + ' ' + G.iconHTML('berry') + '</span>');
          G.emit('sfx', 'pickup'); G.emit('collect', 'berry', n, def);
        } else G.ui.toast('No berries yet — they grow back in a day or so');
        break;
      case 'sit':
        if (G.player.sitting) G.standUp(); else { G.sitOn(x, y, z, def); G.emit('sfx', 'sit'); }
        break;
      case 'bed': G.tryToSleep(x, y, z, def); break;
      case 'chest': G.ui.openChest(x, y, z); break;
      case 'workbench': G.ui.openBackpack('craft'); break;
      case 'shop': G.ui.openShop(); break;
      case 'wardrobe': G.ui.openWardrobe(); break;
      case 'music':
        if (G.audio) { G.audio.toggleMusic(); G.ui.toast(G.audio.musicOff ? 'The music box winds down' : 'The music box plays a gentle island tune 🎶'); }
        break;
      case 'telescope':
        if (G.nightAmount > 0.6 && !(G.weather && G.weather.raining)) {
          if (G.flags.starDay !== G.day) { G.flags.starDay = G.day; G.addPearls(20); G.ui.toast('You trace a new constellation across the sky ✨ +<i class="pearl"></i>20', 'good'); G.emit('sfx', 'tickUp'); }
          else G.ui.toast('The stars wheel slowly overhead. Lovely.');
        } else G.ui.toast(G.nightAmount > 0.6 ? 'Too cloudy tonight — try again when the rain stops' : 'Nothing but blue sky. Come back after dark to stargaze.');
        break;
      case 'stove':
        if (held && (held.fish || held.key === 'corn')) cookHeld(held, x, y + 1.3, z);
        else G.ui.toast('Hold a fish or corn, then use the stove to cook it');
        break;
    }
  };

  // Is there a stove or a lit campfire close by?  (needed for the Cooking tab)
  G.nearFire = function () {
    const p = G.player.pos, px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    for (let dx = -4; dx <= 4; dx++) for (let dy = -2; dy <= 3; dy++) for (let dz = -4; dz <= 4; dz++) {
      const id = G.getBlock(px + dx, py + dy, pz + dz);
      if (id === B.stove || (id === B.campfire && (G.getMeta(px + dx, py + dy, pz + dz) & 4))) return true;
    }
    return false;
  };

  // Middle-click a block to grab the matching item from your backpack.
  G.on('pickblock', () => {
    refreshTarget();
    const t = G.target;
    if (!t || t.type !== 'block' || !G.ITEMS[t.def.key]) return;
    const key = t.def.key, slots = G.inv.slots;
    let i = slots.findIndex((s2, k) => k < 9 && s2 && s2.id === key);
    if (i < 0) {
      const j = slots.findIndex((s2) => s2 && s2.id === key);
      if (j < 0) { G.ui.toast('No ' + t.def.label + ' in your backpack'); return; }
      const tmp = slots[G.inv.sel]; slots[G.inv.sel] = slots[j]; slots[j] = tmp; i = G.inv.sel;
    }
    G.inv.sel = i; G.invDirty = true; G.emit('sfx', 'tick');
  });

  // Is the player close to a workbench?
  G.nearWorkbench = function () {
    const p = G.player.pos, px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    for (let dx = -4; dx <= 4; dx++) for (let dy = -2; dy <= 3; dy++) for (let dz = -4; dz <= 4; dz++) if (G.getBlock(px + dx, py + dy, pz + dz) === B.workbench) return true;
    return false;
  };
})();
