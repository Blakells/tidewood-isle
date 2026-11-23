// Tidewood Isle — voxel storage and island generation.
'use strict';
(function () {
  const W = G.W, D = G.D, H = G.H, SEA = G.SEA;
  const B = G.B;

  const world = G.world = {
    seed: 1337,
    blocks: new Uint8Array(W * H * D),
    meta: new Uint8Array(W * H * D),
    orig: null, origMeta: null,     // pristine generated copy (for diff saves)
    dirty: new Set(),               // chunk keys needing a re-mesh
    spawn: { x: W / 2, y: 14, z: D / 2 },
    shop: null,
  };

  const idx = G.idx = (x, y, z) => (y * D + z) * W + x;
  G.inWorld = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;

  G.getBlock = function (x, y, z) {
    if (x < 0 || z < 0 || x >= W || z >= D || y >= H) return 0;
    if (y < 0) return B.stone;
    return world.blocks[(y * D + z) * W + x];
  };
  G.getMeta = function (x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) return 0;
    return world.meta[(y * D + z) * W + x];
  };
  G.getDef = (x, y, z) => G.BLOCKS[G.getBlock(x, y, z)];

  function markDirty(x, z) {
    const cx = x >> 4, cz = z >> 4;
    world.dirty.add(cx + ',' + cz);
    // smooth ground and tree canopies reach a little past a block, so chunks within two cells
    // of the edit are refreshed as well
    const lx = x & 15, lz = z & 15;
    const mx = lx <= 2 ? -1 : lx >= 13 ? 1 : 0, mz = lz <= 2 ? -1 : lz >= 13 ? 1 : 0;
    if (mx) world.dirty.add((cx + mx) + ',' + cz);
    if (mz) world.dirty.add(cx + ',' + (cz + mz));
    if (mx && mz) world.dirty.add((cx + mx) + ',' + (cz + mz));
  }
  G.markDirty = markDirty;

  // Raw write (no multi-cell bookkeeping)
  // ---- smooth terrain helpers ----
  // surf[x,z] = y of the column's topmost natural ground block if its top is open, else -1.
  const surf = G.surfCache = new Int16Array(W * D).fill(-2);
  G.surfAt = function (x, z) {
    if (x < 0 || z < 0 || x >= W || z >= D) return -1;
    const k = z * W + x;
    let v = surf[k];
    if (v !== -2) return v;
    v = -1;
    for (let y = H - 2; y >= 0; y--) {
      const id = world.blocks[(y * D + z) * W + x];
      if (!id || !G.NATURAL[id]) continue;
      if (!G.OPAQUE[world.blocks[((y + 1) * D + z) * W + x]]) v = y;
      break;
    }
    return (surf[k] = v);
  };
  // Height of the terrain corner at integer (cx, cz) as seen from a column whose flat top is S.
  // Columns of similar height around the corner share one averaged height, which is what turns
  // stair-steps into slopes; anything built nearby keeps the corner level.
  const _t = [0, 0, 0, 0];
  G.cornerHeight = function (cx, cz, S) {
    let n = 0, lo = 99, hi = -99;
    for (let k = 0; k < 4; k++) {
      const s = G.surfAt(cx - 1 + (k & 1), cz - 1 + (k >> 1));
      if (s >= 0) { const t = s + 1; _t[n++] = t; if (t < lo) lo = t; if (t > hi) hi = t; }
    }
    if (n < 2) return S;
    for (let k = 0; k < 4; k++) {
      const x = cx - 1 + (k & 1), z = cz - 1 + (k >> 1);
      if (x < 0 || z < 0 || x >= W || z >= D) continue;
      for (let y = lo - 1; y <= hi; y++) {
        if (!G.FLATTENS[world.blocks[(y * D + z) * W + x]]) continue;
        // Something is built here.  The ground around it forms a level pad at the height the
        // building stands on (or at its floor, if the floor is set into the ground), and nearby
        // ground slopes to meet that pad.
        const pad = Math.abs(S - y) <= Math.abs(S - (y + 1)) ? y : y + 1;
        return Math.abs(S - pad) <= 1 ? pad : S;
      }
    }
    // sort the (at most four) tops, then average the run of similar heights that contains S
    for (let a = 1; a < n; a++) { const v = _t[a]; let b = a - 1; while (b >= 0 && _t[b] > v) { _t[b + 1] = _t[b]; b--; } _t[b + 1] = v; }
    let start = 0, sum = 0, cnt = 0, mine = false;
    for (let a = 0; a <= n; a++) {
      if (a === n || (a > start && (_t[a] - _t[a - 1] > 1 || _t[a] - _t[start] > 2))) {
        if (mine) return sum / cnt;
        start = a; sum = 0; cnt = 0;
        if (a === n) break;
      }
      sum += _t[a]; cnt++;
      if (_t[a] === S) mine = true;
    }
    return S;
  };
  // Where a character standing at (px, py, pz) should be drawn so its feet sit on the smooth ground.
  G.visualGroundY = function (px, py, pz, onGround) {
    if (!onGround) return py;
    const fx = Math.floor(px), fz = Math.floor(pz);
    const s = G.surfAt(fx, fz);
    if (s < 0) return py;
    const S = s + 1;
    if (py < S - 0.15) return py;
    if (py > S + 0.15) {
      // higher than this column's ground: either standing on something here, or resting on the
      // edge of the next column up the slope
      if (py > S + 1.1 || G.getBlock(fx, Math.floor(py - 0.05), fz) !== 0) return py;
    }
    const lowest = s + 0.02;
    const h00 = Math.max(lowest, G.cornerHeight(fx, fz, S)), h10 = Math.max(lowest, G.cornerHeight(fx + 1, fz, S));
    const h01 = Math.max(lowest, G.cornerHeight(fx, fz + 1, S)), h11 = Math.max(lowest, G.cornerHeight(fx + 1, fz + 1, S));
    const u = px - fx, v = pz - fz;
    return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
  };

  // How far the drawn ground sits above/below the flat block top at a point (for things standing on it)
  G.groundOffsetAt = function (px, py, pz) {
    const fx = Math.floor(px), fz = Math.floor(pz);
    const s = G.surfAt(fx, fz);
    if (s < 0) return 0;
    const S = s + 1;
    if (Math.abs(py - S) > 0.4) return 0;
    const lowest = s + 0.02;
    const h00 = Math.max(lowest, G.cornerHeight(fx, fz, S)), h10 = Math.max(lowest, G.cornerHeight(fx + 1, fz, S));
    const h01 = Math.max(lowest, G.cornerHeight(fx, fz + 1, S)), h11 = Math.max(lowest, G.cornerHeight(fx + 1, fz + 1, S));
    const u = px - fx, v = pz - fz;
    return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v - S;
  };

  G.setBlock = function (x, y, z, id, meta) {
    if (!G.inWorld(x, y, z)) return false;
    surf[z * W + x] = -2;
    const i = idx(x, y, z);
    world.blocks[i] = id;
    world.meta[i] = meta || 0;
    markDirty(x, z);
    return true;
  };
  G.setMeta = function (x, y, z, meta) {
    if (!G.inWorld(x, y, z)) return;
    world.meta[idx(x, y, z)] = meta;
    markDirty(x, z);
  };

  G.isWater = (x, y, z) => y < SEA && y >= 0 && G.getBlock(x, y, z) === 0 && x >= -200 && z >= -200;
  G.isSolidAt = (x, y, z) => G.SOLID[G.getBlock(x, y, z)] === 1;

  // Highest non-air, collidable cell in a column (-1 if none)
  G.topSolid = function (x, z) {
    for (let y = H - 1; y >= 0; y--) if (G.SOLID[G.getBlock(x, y, z)]) return y;
    return -1;
  };
  // Highest cell that is ground-like (ignores leaves/logs so things spawn on the floor)
  G.groundY = function (x, z) {
    for (let y = H - 1; y >= 0; y--) {
      const id = G.getBlock(x, y, z);
      if (id === B.sand || id === B.grass || id === B.dirt || id === B.stone || id === B.sandstone || id === B.clay || id === B.path || id === B.farmland) return y;
    }
    return -1;
  };

  const ISLET = { x: 23, z: 23 };

  // ---------------- Terrain shape ----------------
  function terrainHeight(x, z, seed) {
    const cx = W / 2, cz = D / 2;
    const dx = (x - cx) / (W / 2), dz = (z - cz) / (D / 2);
    const d = Math.sqrt(dx * dx + dz * dz);
    const coast = 0.68 + (G.fbm(x * 0.022, z * 0.022, seed, 3) - 0.5) * 0.36;
    const r = coast - d;                       // > 0 means land
    let h;
    if (r < 0) {
      h = SEA - 1.2 + r * 42 + (G.fbm(x * 0.08, z * 0.08, seed + 9, 2) - 0.5) * 1.5;
    } else if (r < 0.13) {
      h = SEA - 1 + (r / 0.13) * 1.7;          // gentle beach
    } else {
      const inland = r - 0.13;
      const hills = G.fbm(x * 0.035, z * 0.035, seed + 21, 4);
      h = SEA + 0.7 + (1 - Math.exp(-inland * 6)) * 7 * (0.55 + hills) + (hills - 0.5) * 3;
      // the hill in the north-west
      const mx = x - (cx - 20), mz = z - (cz - 18);
      h += 13 * Math.exp(-(mx * mx + mz * mz) / (2 * 10 * 10));
    }
    // a lagoon to the east
    const lx = x - (cx + 24), lz = z - (cz + 4);
    const lag = Math.exp(-(lx * lx + lz * lz) / (2 * 6.5 * 6.5));
    if (r > 0) h -= lag * 9;
    // a tiny islet far out in the north-west corner, for the lighthouse
    const ix = x - ISLET.x, iz = z - ISLET.z;
    const isl = SEA + 1.6 - ((ix * ix + iz * iz) / 120) * 6;
    if (isl > h) h = isl;
    return Math.max(2, Math.min(H - 12, h));
  }

  function fillColumn(x, z, top, seed) {
    const blocks = world.blocks;
    const sandy = top <= SEA || (top === SEA + 1 && G.hash2(x, z, seed + 3) < 0.55);
    const rocky = top >= 27;
    for (let y = 0; y <= top; y++) {
      const depth = top - y;
      let id;
      if (rocky) id = depth < 1 && top < 29 && G.hash2(x, z, seed + 5) < 0.3 ? B.grass : B.stone;
      else if (sandy) id = depth < 3 ? B.sand : depth < 6 ? B.sandstone : B.stone;
      else id = depth === 0 ? B.grass : depth < 4 ? B.dirt : B.stone;
      blocks[idx(x, y, z)] = id;
    }
    // clay patches in the shallows
    if (top >= 6 && top <= 10 && G.fbm(x * 0.12, z * 0.12, seed + 44, 2) > 0.68) {
      blocks[idx(x, top, z)] = B.clay;
      blocks[idx(x, top - 1, z)] = B.clay;
    }
  }

  const put = (x, y, z, id, meta) => {
    if (!G.inWorld(x, y, z)) return;
    const i = idx(x, y, z);
    world.blocks[i] = id; world.meta[i] = meta || 0;
  };
  const putIfAir = (x, y, z, id, meta) => { if (G.inWorld(x, y, z) && world.blocks[idx(x, y, z)] === 0) put(x, y, z, id, meta); };

  // Tree builders (also used when saplings grow).  `set` lets callers choose raw puts vs. setBlock.
  G.buildTree = function (x, y, z, kind, rnd, set) {
    set = set || putIfAir;
    if (kind === 'palm') {
      const h = 5 + ((rnd() * 3) | 0);
      for (let i = 0; i < h; i++) set(x, y + i, z, B.palm_log, 0, true);
      const t = y + h;
      set(x, t, z, B.palm_leaves);
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        set(x + ax, t, z + az, B.palm_leaves);
        set(x + ax * 2, t, z + az * 2, B.palm_leaves);
        set(x + ax * 3, t - 1, z + az * 3, B.palm_leaves);
      }
      for (const [ax, az] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        set(x + ax, t, z + az, B.palm_leaves);
        if (rnd() < 0.6) set(x + ax * 2, t - 1, z + az * 2, B.palm_leaves);
      }
      return;
    }
    const leaf = kind === 'blossom' ? B.blossom_leaves : B.leaves;
    const h = 4 + ((rnd() * 2) | 0);
    for (let i = 0; i < h; i++) set(x, y + i, z, B.log, 0, true);
    const t = y + h;
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy <= -1 ? 2 : 1;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && (rad === 1 ? dy === 1 : rnd() < 0.6)) continue;
        if (dx === 0 && dz === 0 && dy < 0) continue;
        set(x + dx, t + dy, z + dz, leaf);
      }
    }
  };

  // ---------------- Generation ----------------
  G.generateWorld = function (seed) {
    world.seed = seed;
    world.blocks.fill(0);
    world.meta.fill(0);
    const rnd = G.makeRng(seed * 7919 + 17);
    const isletRnd = G.makeRng(seed * 31 + 5);
    const hgt = new Int16Array(W * D);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const top = Math.floor(terrainHeight(x, z, seed));
      hgt[z * W + x] = top;
      fillColumn(x, z, top, seed);
    }
    world.hgt = hgt;
    world.lagoon = { x: W / 2 + 24, z: D / 2 + 4 };
    const topAt = (x, z) => hgt[z * W + x];
    const surface = (x, z) => world.blocks[idx(x, topAt(x, z), z)];

    // --- spawn: southern beach, straight down from the centre ---
    let sx = (W / 2) | 0, sz = D - 1;
    while (sz > D / 2 && topAt(sx, sz) < SEA - 1) sz--;
    sz -= 5;
    world.spawn = { x: sx + 0.5, y: topAt(sx, sz) + 1, z: sz + 0.5 };
    const nearSpawn = (x, z, r) => Math.abs(x - sx) < r && Math.abs(z - sz) < r;

    // --- neighbours' huts (placed first so trees and flowers keep clear) ---
    const taken = new Uint8Array(W * D);
    const noDecor = new Uint8Array(W * D);
    buildHuts(sx, sz, hgt, taken, noDecor, seed);

    // --- trees ---
    const claim = (x, z, r) => { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const xx = x + a, zz = z + b; if (xx >= 0 && zz >= 0 && xx < W && zz < D) taken[zz * W + xx] = 1; } };
    for (let z = 4; z < D - 4; z++) for (let x = 4; x < W - 4; x++) {
      const top = topAt(x, z), s = surface(x, z);
      if (taken[z * W + x] || nearSpawn(x, z, 7) || Math.hypot(x - ISLET.x, z - ISLET.z) < 6) continue;
      const r = G.hash2(x, z, seed + 60);
      if (s === B.sand && top >= SEA - 1 && top <= SEA + 1) {
        // islet palms use their own random stream so the main island's trees never shift
        if (r < 0.014) { G.buildTree(x, top + 1, z, 'palm', Math.hypot(x - ISLET.x, z - ISLET.z) < 16 ? isletRnd : rnd); claim(x, z, 3); }
      } else if (s === B.grass && top < 27) {
        const forest = G.fbm(x * 0.05, z * 0.05, seed + 70, 2);
        if (r < (forest > 0.55 ? 0.035 : 0.008)) {
          G.buildTree(x, top + 1, z, G.hash2(x, z, seed + 61) < 0.18 ? 'blossom' : 'tree', rnd); claim(x, z, 2);
        }
      }
    }

    // --- ground cover, finds, underwater life ---
    const flowers = [B.flower_red, B.flower_yellow, B.flower_blue, B.flower_white, B.flower_pink, B.flower_purple];
    const shells = G.SHELL_TABLE;
    for (let z = 2; z < D - 2; z++) for (let x = 2; x < W - 2; x++) {
      const top = topAt(x, z), s = surface(x, z), y = top + 1;
      if (world.blocks[idx(x, y, z)] !== 0 || noDecor[z * W + x]) continue;
      const r = G.hash2(x, z, seed + 80), r2 = G.hash2(x, z, seed + 81);
      if (nearSpawn(x, z, 4)) continue;
      if (s === B.grass) {
        if (r < 0.10) put(x, y, z, B.tall_grass);
        else if (r < 0.135) put(x, y, z, flowers[(G.fbm(x * 0.07, z * 0.07, seed + 90, 2) * 11 + r2 * 2) % 6 | 0]);
        else if (r < 0.15) put(x, y, z, B.fern);
        else if (r < 0.156) put(x, y, z, B.berry_bush, 4);
        else if (r < 0.160) put(x, y, z, B.mushroom);
        else if (r < 0.165) put(x, y, z, B.pebble, (r2 * 4) | 0);
        else if (r < 0.1665 && top < 26) { put(x, y, z, B.stone); if (r2 < 0.5) put(x, y + 1, z, B.stone); if (r2 < 0.3) put(x + 1, y, z, B.stone); }
      } else if (s === B.stone && top >= 27) {
        if (r < 0.03) put(x, y, z, B.pebble, (r2 * 4) | 0);
      } else if (s === B.sand && top >= SEA - 1) {
        if (r < 0.022) put(x, y, z, B[G.pickWeighted(shells, () => r2).id], (r2 * 97) & 3);
        else if (r < 0.027) put(x, y, z, B.driftwood, (r2 * 4) | 0);
        else if (r < 0.031) put(x, y, z, B.pebble, (r2 * 4) | 0);
        else if (r < 0.033) put(x, y, z, B.coconut);
      } else if (top < SEA - 2 && top > 3) {
        if (r < 0.035) put(x, y, z, B.seaweed);
        else if (r < 0.05) put(x, y, z, [B.coral_pink, B.coral_orange, B.coral_purple][(r2 * 3) | 0]);
        else if (r < 0.053) put(x, y, z, B.starfish, (r2 * 4) | 0);
      }
    }

    buildStarterCamp(sx, sz, topAt);
    buildLighthouse();

    surf.fill(-2);
    world.orig = world.blocks.slice();
    world.origMeta = world.meta.slice();
    world.dirty.clear();
  };

  // Three small huts for the island's neighbours.  Each needs a flat-ish patch of land.
  const HUTS = [
    { id: 'juniper', wall: 'paint_green', roof: 'roof_red', ax: 0.08, az: -0.42 },
    { id: 'otis', wall: 'paint_blue', roof: 'roof_blue', ax: 0.44, az: 0.22 },
    { id: 'clementine', wall: 'paint_yellow', roof: 'roof_green', ax: -0.42, az: 0.16 },
  ];
  function buildHuts(sx, sz, hgt, taken, noDecor, seed) {
    world.huts = [];
    const topAt = (x, z) => hgt[z * W + x];
    const lag = { x: W / 2 + 24, z: D / 2 + 4 };
    for (const h of HUTS) {
      const cx0 = Math.round(W / 2 + h.ax * W / 2), cz0 = Math.round(D / 2 + h.az * D / 2);
      let site = null;
      // Spiral outwards from the preferred spot until a flat patch turns up.  If the island has no
      // perfectly level spot nearby, accept rougher ground (the footprint gets levelled anyway) so
      // every island ends up with all three neighbours.
      for (const tol of [1, 2, 4, 9]) {
        search: for (let r = 0; r < (tol === 1 ? 26 : 34); r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const ox = cx0 + dx, oz = cz0 + dz;
          if (ox < 8 || oz < 8 || ox > W - 16 || oz > D - 18) continue;
          if (Math.abs(ox + 2 - sx) < 16 && Math.abs(oz + 2 - sz) < 16) continue;
          if (Math.hypot(ox + 2 - lag.x, oz + 2 - lag.z) < 14) continue;
          let lo = 99, hi = -99, ok = true;
          for (let a = -1; a <= 5 && ok; a++) for (let b = -1; b <= 7; b++) {
            const t = topAt(ox + a, oz + b);
            if (t < SEA || t > SEA + (tol === 1 ? 9 : 14) || taken[(oz + b) * W + ox + a]) { ok = false; break; }
            if (t < lo) lo = t; if (t > hi) hi = t;
          }
          if (ok && hi - lo <= tol) { site = { ox, oz, base: hi }; break search; }
        }
        if (site) break;
      }
      if (!site) continue;
      const { ox, oz, base } = site;
      const wall = B[h.wall], roofSlab = B[h.roof + '_slab'] || B.thatch_slab, roofFull = B[h.roof];
      for (let a = -1; a <= 5; a++) for (let b = -1; b <= 7; b++) {
        const x = ox + a, z = oz + b, t = topAt(x, z);
        const under = world.blocks[idx(x, t, z)] === B.sand ? B.sand : B.dirt;
        for (let y = t; y < base; y++) put(x, y, z, under);
        for (let y = base + 1; y < base + 8; y++) put(x, y, z, 0);
        if (world.blocks[idx(x, base, z)] === 0 || t < base) put(x, base, z, under === B.sand ? B.sand : B.grass);
        hgt[z * W + x] = base;
        noDecor[z * W + x] = 1;
      }
      for (let a = -3; a <= 7; a++) for (let b = -3; b <= 9; b++) { const x = ox + a, z = oz + b; if (x >= 0 && z >= 0 && x < W && z < D) taken[z * W + x] = 1; }
      for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) {
        const x = ox + a, z = oz + b;
        put(x, base, z, B.planks);
        if (a === 0 || b === 0 || a === 4 || b === 4) for (let y = 1; y <= 3; y++) put(x, base + y, z, wall);
      }
      for (let a = -1; a <= 5; a++) for (let b = -1; b <= 5; b++) put(ox + a, base + 4, oz + b, (a >= 1 && a <= 3 && b >= 1 && b <= 3) ? roofFull : roofSlab);
      // door (south), windows
      put(ox + 2, base + 1, oz + 4, B.door, 0); put(ox + 2, base + 2, oz + 4, B.filler, 0);
      put(ox + 2, base + 2, oz, B.window, 0);
      put(ox, base + 2, oz + 2, B.window, 1); put(ox + 4, base + 2, oz + 2, B.window, 1);
      // a few comforts inside
      put(ox + 1, base + 1, oz + 2, B.bed, 0); put(ox + 1, base + 1, oz + 1, B.filler, 4);
      put(ox + 3, base + 1, oz + 1, B.lantern, 0);
      put(ox + 2, base + 1, oz + 2, h.id === 'otis' ? B.rug_sea : B.rug_weave, 0);
      put(ox + 3, base + 1, oz + 3, h.id === 'juniper' ? B.flower_pot : h.id === 'otis' ? B.fish_tank : B.crate, 0);
      // doorstep details
      put(ox + 4, base + 1, oz + 5, h.id === 'juniper' ? B.planter : h.id === 'otis' ? B.crate : B.sandcastle, 0);
      put(ox, base + 1, oz + 5, B.tiki_torch, 0);
      world.huts.push({ id: h.id, door: { x: ox + 2.5, y: base + 1, z: oz + 6.2 }, inside: { x: ox + 2.6, y: base + 1, z: oz + 3.2 }, ox, oz, base });
    }
  }

  // A striped lighthouse on the islet: hollow tower, door, treasure chest inside, lamp room on top.
  function buildLighthouse() {
    const cx = ISLET.x, cz = ISLET.z;
    let base = 0;
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) base = Math.max(base, G.groundY(cx + a, cz + b));
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const d = Math.hypot(a, b);
      if (d > 3.3) continue;
      for (let y = base - 3; y <= base; y++) if (!G.OPAQUE[world.blocks[idx(cx + a, y, cz + b)]]) put(cx + a, y, cz + b, B.sand);
      for (let y = base + 1; y < base + 18; y++) put(cx + a, y, cz + b, 0);          // clear palms out of the way
      put(cx + a, base, cz + b, d <= 2.3 ? B.stone_bricks : B.sand);
    }
    const H_T = 9;
    for (let y = 1; y <= H_T; y++) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const d = Math.round(Math.hypot(a, b));
      if (d !== 2) continue;
      put(cx + a, base + y, cz + b, Math.floor((y - 1) / 3) % 2 ? B.paint_red : B.plaster);
    }
    // door facing south, a window half-way up
    put(cx, base + 1, cz + 2, B.door, 0); put(cx, base + 2, cz + 2, B.filler, 0);
    put(cx, base + 6, cz + 2, B.window, 0); put(cx + 2, base + 5, cz, B.window, 1);
    // gallery and lamp room
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (Math.hypot(a, b) <= 3.3) put(cx + a, base + H_T + 1, cz + b, B.stone_slab);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      put(cx + a, base + H_T + 1, cz + b, B.stone_bricks);
      if (a || b) { put(cx + a, base + H_T + 2, cz + b, B.glass); put(cx + a, base + H_T + 3, cz + b, B.glass); }
      put(cx + a, base + H_T + 4, cz + b, B.roof_red);
    }
    put(cx, base + H_T + 2, cz, B.lamp_post, 0);
    put(cx, base + H_T + 5, cz, B.roof_red_slab);
    // inside: the keeper's chest, a lantern and a rug
    put(cx, base + 1, cz - 1, B.chest, 0);
    put(cx + 1, base + 1, cz, B.lantern, 0);
    put(cx, base + 1, cz, B.rug_sea, 0);
    // a sandy ramp down from the door, in case the tower stands higher than the shore in front of it
    for (let k = 3; k <= 9; k++) for (let a = -1; a <= 1; a++) {
      const x = cx + a, z = cz + k, want = base - Math.max(0, k - 4);
      if (!G.inWorld(x, 0, z)) continue;
      for (let y = G.groundY(x, z) + 1; y <= want; y++) put(x, y, z, B.sand);
    }
    world.lighthouse = { x: cx, z: cz, chest: cx + ',' + (base + 1) + ',' + (cz - 1) };
  }

  // A little pier, an unlit campfire and the trading post near where the player wakes up.
  function buildStarterCamp(sx, sz, topAt) {
    // pier heading south into the sea
    const px = sx + 6;
    let z = sz + 2;
    while (z < D - 3 && topAt(px, z) >= SEA - 1) z++;
    const pierStart = z - 2;
    for (let i = 0; i < 14 && pierStart + i < D - 2; i++) {
      const zz = pierStart + i;
      for (let w = 0; w < 2; w++) {
        const top = topAt(px + w, zz);
        if (top >= SEA) continue;
        if (i % 4 === 3) for (let y = top + 1; y < SEA; y++) put(px + w, y, zz, B.palm_log);
        else for (let y = top + 1; y < SEA; y++) put(px + w, y, zz, 0);
        put(px + w, SEA, zz, B.drift_slab);
      }
    }
    world.pier = { x: px + 1, z: pierStart + 11 };

    // campfire with two log seats
    const cy = topAt(sx - 3, sz - 1) + 1;
    put(sx - 3, cy, sz - 1, B.campfire, 0);
    put(sx - 5, topAt(sx - 5, sz - 1) + 1, sz - 1, B.log_seat, 3);
    put(sx - 3, topAt(sx - 3, sz - 3) + 1, sz - 3, B.log_seat, 0);

    // trading post: a small open stall
    const tx = sx + 5, tz = sz - 5;
    let base = 0;
    for (let a = -1; a <= 2; a++) for (let b = -1; b <= 1; b++) base = Math.max(base, topAt(tx + a, tz + b));
    for (let a = -1; a <= 2; a++) for (let b = -1; b <= 1; b++) {
      for (let y = topAt(tx + a, tz + b) + 1; y <= base; y++) put(tx + a, y, tz + b, B.sand);
      for (let y = base + 1; y < base + 6; y++) put(tx + a, y, tz + b, 0);
      put(tx + a, base, tz + b, B.drift_planks);
    }
    for (const [a, b] of [[-1, -1], [2, -1], [-1, 1], [2, 1]]) for (let y = 1; y <= 3; y++) put(tx + a, base + y, tz + b, B.palm_log);
    for (let a = -2; a <= 3; a++) for (let b = -2; b <= 2; b++) put(tx + a, base + 4, tz + b, (a + 20) % 2 ? B.roof_red_slab : B.thatch_slab);
    put(tx, base + 1, tz + 1, B.shop_stall); put(tx + 1, base + 1, tz + 1, B.shop_stall);
    put(tx - 1, base + 1, tz, B.crate); put(tx + 2, base + 1, tz, B.lantern);
    world.shop = { x: tx + 0.5 + 0.5, y: base + 1, z: tz - 0.5 + 0.5, stallX: tx, stallZ: tz + 1 };
  }
})();
