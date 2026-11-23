// Tidewood Isle — minimap and the home "coziness" rating.
'use strict';
(function () {
  const W = G.W, D = G.D;
  let base, baseCtx, view, viewCtx, wrap;
  G.mapDirty = true;
  G.mapVisible = true;

  function cssToRgb(css) { const m = css.match(/\d+/g); return [Number(m[0]), Number(m[1]), Number(m[2])]; }
  const colorCache = {};
  function blockColor(def) {
    if (colorCache[def.id]) return colorCache[def.id];
    let tile = null;
    if (def.shape === 'cube') tile = def.iconTiles.top;
    else if (def.shape === 'boxes') tile = Object.keys(G.TILES).find((k) => G.TILES[k] === def.boxes[def.boxes.length > 1 ? 1 : 0].top);
    const c = tile && G.TILE_COLORS[tile] ? cssToRgb(G.TILE_COLORS[tile]) : null;
    return (colorCache[def.id] = c);
  }

  function redrawBase() {
    const img = baseCtx.createImageData(W, D);
    const d = img.data;
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      let c = null, y = G.H - 1, topY = -1;
      for (; y >= 0; y--) {
        const id = G.world.blocks[(y * D + z) * W + x];
        if (!id) continue;
        const def = G.BLOCKS[id];
        if (def.shape === 'cross' || def.shape === 'none' || def.cat === 'find') continue;
        c = blockColor(def);
        if (c) { topY = y; break; }
      }
      const i = (z * W + x) * 4;
      if (topY < G.SEA - 1) {
        const depth = G.clamp((G.SEA - 1 - topY) / 8, 0, 1);
        d[i] = G.lerp(150, 84, depth); d[i + 1] = G.lerp(226, 170, depth); d[i + 2] = G.lerp(226, 222, depth);
      } else {
        const shade = 0.86 + G.clamp((topY - G.SEA) / 28, 0, 1) * 0.22;
        d[i] = Math.min(255, c[0] * shade); d[i + 1] = Math.min(255, c[1] * shade); d[i + 2] = Math.min(255, c[2] * shade);
      }
      d[i + 3] = 255;
    }
    baseCtx.putImageData(img, 0, 0);
  }

  G.initMap = function () {
    wrap = document.createElement('div');
    wrap.id = 'minimap';
    wrap.title = 'Island map (N to hide)';
    view = document.createElement('canvas');
    view.width = W * 2; view.height = D * 2;
    wrap.appendChild(view);
    document.getElementById('ui').appendChild(wrap);
    viewCtx = view.getContext('2d');
    base = document.createElement('canvas'); base.width = W; base.height = D;
    baseCtx = base.getContext('2d');
    // the last bed or tent you set down (or slept in) is "home", marked with a little house
    G.on('placed', (key, x, y, z) => {
      G.mapDirty = true;
      const d = G.BLOCK_BY_KEY[key];
      if (d && d.use === 'bed' && G.flags) G.flags.home = { x, y, z };
    });
    G.on('broke', () => { G.mapDirty = true; });
    G.on('keydown', (code) => {
      if (code === 'KeyN' && !G.ui.blocking()) { G.mapVisible = !G.mapVisible; wrap.style.display = G.mapVisible ? '' : 'none'; }
    });
  };

  let baseT = 0, drawT = 0;
  G.updateMap = function (dt) {
    if (!G.mapVisible || !wrap) return;
    baseT -= dt; drawT -= dt;
    if (G.mapDirty && baseT <= 0) { G.mapDirty = false; baseT = 3; redrawBase(); }
    if (drawT > 0) return;
    drawT = 0.2;
    const c = viewCtx, s = 2;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(base, 0, 0, W * s, D * s);
    const dot = (x, z, r, fill, stroke) => { c.beginPath(); c.arc(x * s, z * s, r, 0, 6.3); c.fillStyle = fill; c.fill(); if (stroke) { c.lineWidth = 2; c.strokeStyle = stroke; c.stroke(); } };
    if (G.world.shop) dot(G.world.shop.x, G.world.shop.z, 6, '#f7cf6b', '#5b4636');
    if (G.world.lighthouse) dot(G.world.lighthouse.x + 0.5, G.world.lighthouse.z + 0.5, 5, '#e0705e', '#ffffff');
    for (const v of G.villagers || []) if (v.met) dot(v.pos.x, v.pos.z, 5, '#8fe0a8', '#5b4636'); else dot(v.hut.door.x, v.hut.door.z - 3, 5, '#fff8ea', '#8a715c');
    if (G.visitor) dot(G.visitor.pos.x, G.visitor.pos.z, 5, '#f7a35c', '#5b4636');
    const home = G.flags && G.flags.home;
    if (home) {
      const hd = G.getDef(home.x, home.y, home.z);
      if (hd && hd.use === 'bed') {
        const hx = (home.x + 0.5) * s, hz = (home.z + 0.5) * s;
        c.beginPath();
        c.moveTo(hx, hz - 10); c.lineTo(hx + 9, hz - 2); c.lineTo(hx + 6, hz - 2); c.lineTo(hx + 6, hz + 7);
        c.lineTo(hx - 6, hz + 7); c.lineTo(hx - 6, hz - 2); c.lineTo(hx - 9, hz - 2); c.closePath();
        c.fillStyle = '#ffd98a'; c.fill(); c.lineWidth = 2; c.lineJoin = 'round'; c.strokeStyle = '#5b4636'; c.stroke();
      }
    }
    for (const p of G.pets || []) if (p.adopted) dot(p.pos.x, p.pos.z, 4, '#f7a3c8', '#5b4636');
    // you, with a little wedge showing which way the camera looks
    const P = G.player.pos, a = G.cam.yaw;
    c.beginPath();
    c.moveTo(P.x * s, P.z * s);
    c.arc(P.x * s, P.z * s, 22, -a - Math.PI / 2 - 0.45, -a - Math.PI / 2 + 0.45);
    c.closePath(); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
    dot(P.x, P.z, 6, '#f58f7c', '#ffffff');
  };

  // ---------------- coziness ----------------
  // Looks at the room around a spot and scores how homely it feels.
  G.cozyScore = function (cx, cy, cz) {
    const B = G.B, kinds = {}, out = { score: 0, furniture: 0, lights: 0, decor: 0, roof: false, door: false, pets: 0 };
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) for (let dy = -1; dy <= 3; dy++) {
      const def = G.getDef(cx + dx, cy + dy, cz + dz);
      if (!def || def.key === 'filler') continue;
      if (def.cat === 'furniture') {
        kinds[def.key] = (kinds[def.key] || 0) + 1;
        if (def.light || def.lightOn) out.lights++;
        if (def.wall || def.key.startsWith('rug') || def.key === 'flower_pot' || def.key === 'potted_palm' || def.key === 'planter') out.decor++;
        if (def.use === 'door') out.door = true;
      }
    }
    for (const k in kinds) { out.furniture++; out.score += 3 + Math.min(2, kinds[k] - 1); }
    out.score += Math.min(3, out.lights) * 2 + Math.min(4, out.decor);
    for (let y = cy + 1; y < cy + 7; y++) { const d = G.getDef(cx, y, cz); if (d && (d.shape === 'cube' || d.col) && d.key !== 'leaves' && d.key !== 'palm_leaves' && d.key !== 'blossom_leaves') { out.roof = true; break; } }
    if (out.roof) out.score += 5;
    if (out.door) out.score += 2;
    for (const p of G.pets || []) if (p.adopted && Math.abs(p.pos.x - cx) < 8 && Math.abs(p.pos.z - cz) < 8) out.pets++;
    out.score += Math.min(3, out.pets) * 2;
    out.stars = out.score >= 62 ? 5 : out.score >= 46 ? 4 : out.score >= 30 ? 3 : out.score >= 16 ? 2 : out.score >= 5 ? 1 : 0;
    out.tip = !out.roof ? 'A roof overhead would help.' : !out.door ? 'A door would make it feel like home.' : out.lights < 2 ? 'A lamp or two would warm it up.' : out.decor < 3 ? 'Rugs, plants and wall art add charm.' : out.furniture < 8 ? 'More different kinds of furniture add up.' : 'It is wonderfully snug in here.';
    return out;
  };

  G.on('slept', () => {
    const P = G.player.pos;
    const c = G.cozyScore(Math.floor(P.x), Math.floor(P.y), Math.floor(P.z));
    G.stats.cozy = Math.max(G.stats.cozy || 0, c.stars);
    setTimeout(() => {
      G.ui.toast('Your home feels ' + '★'.repeat(c.stars) + '☆'.repeat(5 - c.stars) + ' cozy. ' + c.tip);
      if (c.stars >= 3) G.emit('cozy3');
    }, 4200);
  });
})();
