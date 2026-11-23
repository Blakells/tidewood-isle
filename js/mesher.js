// Tidewood Isle — turns voxel chunks into merged meshes (hidden faces culled, vertex AO).
'use strict';
(function () {
  const W = G.W, D = G.D, H = G.H, CH = G.CHUNK;
  const ATLAS_PX = G.TILE_PX * G.ATLAS_PER_ROW;

  // Face table: normal n, tangents u, v with u x v = n
  const FACES = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },   // +x
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },   // -x
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },   // +y
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },   // -y
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },    // +z
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },  // -z
  ];
  const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const AO_LEVEL = [0.56, 0.74, 0.88, 1];
  // which FACES index is the model "front" for each rotation
  const FRONT_FACE = [4, 1, 5, 0];

  let pos, nrm, uvs, col, ind, vcount;
  let yShift = 0;      // vertical nudge for small things resting on sloped ground
  let swy = [];        // sparse per-vertex "sways in the breeze" amount (plants, leaves)
  let blobSway = 0;    // sway given to the blobs currently being emitted

  function pushQuad(verts, n, uvr, shades) {
    // verts: 4 x [x,y,z] CCW ; uvr: [ua, ub, va, vb] (u for -u/+u side, v for -v/+v side)
    const base = vcount;
    for (let i = 0; i < 4; i++) {
      const p = verts[i];
      pos.push(p[0], p[1], p[2]);
      nrm.push(n[0], n[1], n[2]);
      const c = CORNERS[i];
      uvs.push(c[0] < 0 ? uvr[0] : uvr[1], c[1] < 0 ? uvr[2] : uvr[3]);
      const s = shades ? shades[i] : 1;
      col.push(s, s, s);
    }
    vcount += 4;
    if (shades && shades[0] + shades[2] < shades[1] + shades[3]) ind.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  function tileRect(tile, pu0, pu1, pv0, pv1) {
    // pu*: pixels from tile left; pv*: pixels from tile bottom.  Slightly inset to avoid bleeding.
    const tx = (tile % G.ATLAS_PER_ROW) * 16, ty = ((tile / G.ATLAS_PER_ROW) | 0) * 16;
    // inset half a texel-and-a-bit so smooth filtering never samples the neighbouring tile
    const eu = Math.min(0.5, Math.abs(pu1 - pu0) * 0.25), ev = Math.min(0.5, Math.abs(pv1 - pv0) * 0.25);
    const su = pu1 >= pu0 ? eu : -eu, sv = pv1 >= pv0 ? ev : -ev;
    return [
      (tx + pu0 + su) / ATLAS_PX, (tx + pu1 - su) / ATLAS_PX,
      1 - (ty + 16 - (pv0 + sv)) / ATLAS_PX, 1 - (ty + 16 - (pv1 - sv)) / ATLAS_PX,
    ];
  }
  const fullRect = {};
  function fullTile(tile) { return fullRect[tile] || (fullRect[tile] = tileRect(tile, 0, 16, 0, 16)); }

  const opaqueAt = (x, y, z) => G.OPAQUE[G.getBlock(x, y, z)];

  function emitCube(def, x, y, z) {
    const id = def.id;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], n = F.n;
      const nb = G.getBlock(x + n[0], y + n[1], z + n[2]);
      if (y + n[1] < 0) continue;
      if (nb === id && !G.OPAQUE[id]) continue;
      if (G.OPAQUE[nb]) {
        // A side that touches smooth ground is still drawn: the ground's top may dip below the
        // block edge there, and without this face you could see through the seam.
        const keepSide = n[1] === 0 && G.NATURAL[nb] && G.surfAt(x + n[0], z + n[2]) === y;
        if (!keepSide) {
          // Hidden top faces of blocks with an exposed side are kept: they become the
          // "caps" of walls when the roof cut-away slices a building open.
          if (f !== 2 || !def.opaque) continue;
          if (opaqueAt(x + 1, y, z) && opaqueAt(x - 1, y, z) && opaqueAt(x, y, z + 1) && opaqueAt(x, y, z - 1)) continue;
        }
      }
      const u = F.u, v = F.v;
      const verts = [], shades = [];
      for (let i = 0; i < 4; i++) {
        const su = CORNERS[i][0], sv = CORNERS[i][1];
        verts.push([
          x + 0.5 + 0.5 * (n[0] + su * u[0] + sv * v[0]),
          y + 0.5 + 0.5 * (n[1] + su * u[1] + sv * v[1]),
          z + 0.5 + 0.5 * (n[2] + su * u[2] + sv * v[2]),
        ]);
        const ax = x + n[0], ay = y + n[1], az = z + n[2];
        const s1 = opaqueAt(ax + su * u[0], ay + su * u[1], az + su * u[2]);
        const s2 = opaqueAt(ax + sv * v[0], ay + sv * v[1], az + sv * v[2]);
        const c = opaqueAt(ax + su * u[0] + sv * v[0], ay + su * u[1] + sv * v[1], az + su * u[2] + sv * v[2]);
        shades.push(AO_LEVEL[s1 && s2 ? 0 : 3 - (s1 + s2 + c)]);
      }
      pushQuad(verts, n, fullTile(def.faces[f]), shades);
    }
  }

  // A natural ground block whose top is open: its top face follows the averaged corner heights,
  // so neighbouring columns join into slopes instead of steps.
  function emitSmooth(def, x, y, z) {
    const S = y + 1, low = y + 0.02;
    const hc = (cx, cz) => Math.max(low, G.cornerHeight(cx, cz, S));
    const h00 = hc(x, z), h10 = hc(x + 1, z), h01 = hc(x, z + 1), h11 = hc(x + 1, z + 1);
    const hAt = (px, pz) => (px === x ? (pz === z ? h00 : h01) : (pz === z ? h10 : h11));
    // a shared normal per corner (from the surrounding column heights) gives soft shading
    const nAt = (cx, cz) => {
      const t = (ax, az) => { const s = G.surfAt(ax, az); return s < 0 ? S : G.clamp(s + 1, S - 1.5, S + 1.5); };
      const a = t(cx - 1, cz - 1), b = t(cx, cz - 1), c = t(cx - 1, cz), d = t(cx, cz);
      let gx = ((b + d) - (a + c)) * 0.5, gz = ((c + d) - (a + b)) * 0.5;
      const l = Math.hypot(gx, 1.6, gz);
      return [-gx / l, 1.6 / l, -gz / l];
    };
    // top: neutral detail texture tinted per corner with the blend of the ground colours around it
    const r = fullTile(G.TILES.ground);
    const base = vcount;
    const order = [[x, z + 1], [x + 1, z + 1], [x + 1, z], [x, z]];
    const own = G.GROUND_RGB[def.id];
    const cAt = (cx, cz) => {
      let cr = 0, cg = 0, cb = 0, k = 0;
      for (let q = 0; q < 4; q++) {
        const ax = cx - 1 + (q & 1), az = cz - 1 + (q >> 1), s2 = G.surfAt(ax, az);
        if (s2 < 0 || Math.abs(s2 + 1 - S) > 1.5) continue;
        const c2 = G.GROUND_RGB[G.world.blocks[(s2 * D + az) * W + ax]];
        if (c2) { cr += c2[0]; cg += c2[1]; cb += c2[2]; k++; }
      }
      return k ? [cr / k, cg / k, cb / k] : own;
    };
    for (let i = 0; i < 4; i++) {
      const [px, pz] = order[i], n = nAt(px, pz), c = cAt(px, pz);
      pos.push(px, hAt(px, pz), pz); nrm.push(n[0], n[1], n[2]);
      uvs.push(CORNERS[i][0] < 0 ? r[0] : r[1], CORNERS[i][1] < 0 ? r[2] : r[3]);
      col.push(c[0], c[1], c[2]);
    }
    vcount += 4;
    if (Math.abs(h01 - h10) <= Math.abs(h11 - h00)) ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else ind.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    // sides and bottom, with the top edge following the same corner heights
    for (const f of [0, 1, 3, 4, 5]) {
      const F = FACES[f], n = F.n, u = F.u, v = F.v;
      if (y + n[1] < 0) continue;
      if (G.OPAQUE[G.getBlock(x + n[0], y + n[1], z + n[2])]) continue;
      const verts = [];
      for (let i = 0; i < 4; i++) {
        const su = CORNERS[i][0], sv = CORNERS[i][1];
        const px = x + 0.5 + 0.5 * (n[0] + su * u[0] + sv * v[0]);
        let py = y + 0.5 + 0.5 * (n[1] + su * u[1] + sv * v[1]);
        const pz = z + 0.5 + 0.5 * (n[2] + su * u[2] + sv * v[2]);
        if (f !== 3 && py > y + 0.5) py = hAt(px, pz);
        verts.push([px, py, pz]);
      }
      pushQuad(verts, n, fullTile(def.faces[f]), null);
    }
  }

  // Flowers and mushrooms are little rounded models rather than flat pictures:
  // [petal top, petal underside, centre top, centre underside]
  const FLOWERS = {
    flower_red: [0xf7766a, 0xdc4f48, 0xffe27a, 0xf4b942], flower_yellow: [0xffe27a, 0xf7c545, 0xf59a3c, 0xd9772a], flower_blue: [0x9cc8f5, 0x6a9fe0, 0xfff3b0, 0xf4d35a],
    flower_white: [0xffffff, 0xe6eaf0, 0xffe27a, 0xf4b942], flower_pink: [0xfbc0d6, 0xf08fb4, 0xfff3b0, 0xf4d35a], flower_purple: [0xcbaef2, 0x9d7ccc, 0xfff3b0, 0xf4d35a],
  };
  function emitFlower(def, x, y, z) {
    icoTris();
    const c = FLOWERS[def.key];
    const j = (G.hash2(x, z, 5) - 0.5) * 0.3, k = (G.hash2(x, z, 6) - 0.5) * 0.3, turn = G.hash2(x, z, 7) * 6.283;
    const cx = x + 0.5 + j, cz = z + 0.5 + k, by = y + G.groundOffsetAt(x + 0.5, y, z + 0.5);
    if (!c) {                                             // mushroom: a pale stalk under a spotted red cap
      emitBlob(cx, by + 0.12, cz, 0.065, 0.13, 0.065, rgb(0xfff6e6), rgb(0xe8dcc4));
      emitBlob(cx, by + 0.29, cz, 0.19, 0.11, 0.19, rgb(0xf7766a), rgb(0xd9483f));
      for (let i = 0; i < 3; i++) { const a = turn + i * 2.094; emitBlob(cx + Math.cos(a) * 0.09, by + 0.37, cz + Math.sin(a) * 0.09, 0.04, 0.025, 0.04, rgb(0xffffff), rgb(0xfff0e6)); }
      return;
    }
    const h = 0.4 + G.hash2(x, z, 8) * 0.16;
    const stem = rgb(0x86d07a), stemD = rgb(0x4f9c52);
    blobSway = 0.45; emitBlob(cx, by + h * 0.5, cz, 0.022, h * 0.5, 0.022, stem, stemD);
    blobSway = 0.3; emitBlob(cx + Math.cos(turn) * 0.07, by + h * 0.32, cz + Math.sin(turn) * 0.07, 0.07, 0.022, 0.07, stem, stemD, true);
    blobSway = 1;
    const top = rgb(c[0]), bot = rgb(c[1]);
    for (let i = 0; i < 5; i++) { const a = turn + i * 1.2566; emitBlob(cx + Math.cos(a) * 0.09, by + h, cz + Math.sin(a) * 0.09, 0.075, 0.036, 0.075, top, bot, true); }
    emitBlob(cx, by + h + 0.018, cz, 0.055, 0.042, 0.055, rgb(c[2]), rgb(c[3]), true);
    blobSway = 0;
  }

  function emitCross(def, x, y, z, meta) {
    if (FLOWERS[def.key] || def.key === 'mushroom') { emitFlower(def, x, y, z); return; }
    const tile = def.stageTileIds ? def.stageTileIds[(meta >> 3) & 3] : def.tile;
    const r = fullTile(tile);
    const j = (G.hash2(x, z, 5) - 0.5) * 0.3, k = (G.hash2(x, z, 6) - 0.5) * 0.3;
    const a = 0.12, b = 0.88;
    const yo = G.groundOffsetAt(x + 0.5, y, z + 0.5);
    y += yo;
    const quads = [
      [[x + a + j, y, z + a + k], [x + b + j, y, z + b + k], [x + b + j, y + 1, z + b + k], [x + a + j, y + 1, z + a + k]],
      [[x + a + j, y, z + b + k], [x + b + j, y, z + a + k], [x + b + j, y + 1, z + a + k], [x + a + j, y + 1, z + b + k]],
    ];
    for (const q of quads) {
      pushQuad(q, [0, 1, 0], r, null); swy[vcount - 2] = swy[vcount - 1] = 1;
      pushQuad([q[1], q[0], q[3], q[2]], [0, 1, 0], [r[1], r[0], r[2], r[3]], null); swy[vcount - 2] = swy[vcount - 1] = 1;
    }
  }

  // Rotate a box (16ths) by r quarter turns:  (x,z) -> (16-z, x)
  function rotBox(b, r) {
    let x0 = b[0], z0 = b[2], x1 = b[3], z1 = b[5];
    for (let i = 0; i < r; i++) {
      const nx0 = 16 - z1, nx1 = 16 - z0, nz0 = x0, nz1 = x1;
      x0 = nx0; x1 = nx1; z0 = nz0; z1 = nz1;
    }
    return [x0, b[1], z0, x1, b[4], z1];
  }
  G.rotBox = rotBox;

  const wrap16 = (a, base) => G.clamp(a - base, 0, 16);

  function emitBox(bx, tiles, rot, x, y, z) {
    const b = rot ? rotBox(bx, rot) : bx;
    const lo = [b[0], b[1], b[2]], hi = [b[3], b[4], b[5]];
    const frontFace = FRONT_FACE[rot];
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], n = F.n, u = F.u, v = F.v;
      const axisN = n[0] ? 0 : n[1] ? 1 : 2;
      const planeN = (n[0] + n[1] + n[2]) > 0 ? hi[axisN] : lo[axisN];
      // cull faces flush against an opaque neighbour
      if ((planeN === 0 || planeN === 16) && G.OPAQUE[G.getBlock(x + n[0], y + n[1], z + n[2])]) {
        const au = u[0] ? 0 : u[1] ? 1 : 2, av = v[0] ? 0 : v[1] ? 1 : 2;
        if (lo[au] >= 0 && hi[au] <= 16 && lo[av] >= 0 && hi[av] <= 16) continue;
      }
      const axisU = u[0] ? 0 : u[1] ? 1 : 2, axisV = v[0] ? 0 : v[1] ? 1 : 2;
      const signU = u[axisU], signV = v[axisV];
      const verts = [];
      for (let i = 0; i < 4; i++) {
        const su = CORNERS[i][0], sv = CORNERS[i][1];
        const p = [0, 0, 0];
        p[axisN] = planeN;
        p[axisU] = (su * signU) > 0 ? hi[axisU] : lo[axisU];
        p[axisV] = (sv * signV) > 0 ? hi[axisV] : lo[axisV];
        verts.push([x + p[0] / 16, y + yShift + p[1] / 16, z + p[2] / 16]);
      }
      // texture pixels follow the box extents so grain lines up
      const baseU = Math.floor(lo[axisU] / 16) * 16, baseV = Math.floor(lo[axisV] / 16) * 16;
      let ua = wrap16(lo[axisU], baseU), ub = wrap16(hi[axisU], baseU);
      let va = wrap16(lo[axisV], baseV), vb = wrap16(hi[axisV], baseV);
      if (signU < 0) { const t = 16 - ua; ua = 16 - ub; ub = t; }
      if (signV < 0) { const t = 16 - va; va = 16 - vb; vb = t; }
      const tile = f === 2 ? tiles.top : f === 3 ? tiles.bottom : f === frontFace ? tiles.front : tiles.side;
      pushQuad(verts, n, tileRect(tile, ua, ub, va, vb), null);
    }
  }

  const fenceLinks = (x, y, z) => {
    const id = G.getBlock(x, y, z);
    return id === G.B.fence || G.OPAQUE[id];
  };
  const WOOD = () => ({ side: G.TILES.wood, top: G.TILES.wood, bottom: G.TILES.wood, front: G.TILES.wood });

  function emitBush(x, y, z, meta) {
    const yo = G.groundOffsetAt(x + 0.5, y, z + 0.5);
    const cx = x + 0.5, cy = y + yo, cz = z + 0.5;
    const tint = 0.95 + G.hash2(x, z, 95) * 0.1;
    blobSway = 0.22;
    emitBlob(cx, cy + 0.42, cz, 0.52, 0.46, 0.52, rgb(0x8fd978, tint), rgb(0x4f9c52, tint));
    emitBlob(cx + 0.2, cy + 0.66, cz - 0.12, 0.34, 0.3, 0.34, rgb(0x9de284, tint), rgb(0x5fae5c, tint));
    if (meta & 4) {
      const berry = rgb(0xe8527c), dark = rgb(0xb9335c);
      for (const [dx, dy, dz] of [[0.36, 0.5, 0.26], [-0.34, 0.42, 0.3], [0.05, 0.78, 0.36], [-0.3, 0.62, -0.3], [0.4, 0.68, -0.22], [0.02, 0.36, 0.5]]) emitBlob(cx + dx, cy + dy, cz + dz, 0.09, 0.09, 0.09, berry, dark);
    }
    blobSway = 0;
  }

  // Beach finds drawn as soft rounded shapes instead of stacked boxes.
  // Each entry: [dx, y, dz, rx, ry, rz, top colour, bottom colour], in blocks from the cell centre.
  const starArms = (list, r1, r2, top, bot) => {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.2566 + 0.3;
      list.push([Math.cos(a) * 0.13, 0.05, Math.sin(a) * 0.13, r1, r1 * 0.62, r1, top, bot]);
      list.push([Math.cos(a) * 0.24, 0.04, Math.sin(a) * 0.24, r2, r2 * 0.62, r2, top, bot]);
    }
    return list;
  };
  const ROUND_FINDS = {
    shell_cockle: [[0, 0.07, 0, 0.17, 0.09, 0.15, 0xfbc4d2, 0xe895ab], [0, 0.04, 0.14, 0.07, 0.045, 0.06, 0xfff6ee, 0xf0dcd2]],
    shell_scallop: [[0, 0.08, 0, 0.2, 0.1, 0.18, 0xffbd88, 0xf08f52], [0, 0.045, 0.16, 0.08, 0.05, 0.07, 0xfff6ee, 0xf0dcd2]],
    shell_conch: [[0, 0.14, 0.03, 0.17, 0.14, 0.2, 0xfff6ee, 0xf3d6cc], [0, 0.26, -0.09, 0.1, 0.1, 0.1, 0xfbc4d2, 0xeea3b6], [0, 0.36, -0.12, 0.05, 0.06, 0.05, 0xf7aabd, 0xe895ab]],
    shell_whelk: [[0, 0.12, 0.04, 0.13, 0.12, 0.2, 0xcdb0f0, 0x9d7ccc], [0, 0.2, -0.13, 0.09, 0.09, 0.1, 0xdcc6f6, 0xb394d6], [0, 0.27, -0.2, 0.045, 0.05, 0.05, 0xfff6ee, 0xdcc6f6]],
    starfish: starArms([[0, 0.06, 0, 0.11, 0.07, 0.11, 0xff9a78, 0xe86e50]], 0.085, 0.06, 0xff9a78, 0xe86e50),
    sand_dollar: [[0, 0.04, 0, 0.2, 0.04, 0.2, 0xfdf8ee, 0xe6dcc8], [0, 0.07, 0, 0.07, 0.025, 0.07, 0xf1e8d6, 0xe6dcc8]],
    shell_nautilus: [[0, 0.19, 0, 0.2, 0.19, 0.11, 0xcfe6fa, 0x8fb6e0], [0.13, 0.12, 0, 0.12, 0.12, 0.12, 0xffffff, 0xdbe9f6], [-0.02, 0.2, 0, 0.07, 0.07, 0.125, 0xeaf4fd, 0xb9d3ec]],
    pearl_oyster: [[0, 0.06, 0, 0.2, 0.07, 0.18, 0xc2a8e2, 0x8f76b5], [0, 0.17, -0.11, 0.2, 0.07, 0.09, 0xcdb7ea, 0x9d84c4], [0, 0.15, 0.03, 0.075, 0.075, 0.075, 0xffffff, 0xe9e6f5]],
    driftwood: [[0, 0.075, 0, 0.3, 0.072, 0.085, 0xe0cba8, 0xb99d78], [0.1, 0.085, -0.1, 0.06, 0.05, 0.11, 0xd6bf9a, 0xb09470], [-0.29, 0.075, 0, 0.03, 0.06, 0.07, 0xf0e2c8, 0xd9c6a4]],
    bottle: [[0, 0.085, -0.03, 0.085, 0.085, 0.15, 0xb4e8d8, 0x74c2ac], [0, 0.085, 0.15, 0.042, 0.042, 0.08, 0xb4e8d8, 0x74c2ac], [0, 0.085, 0.235, 0.036, 0.036, 0.03, 0xcfae7c, 0xa88454], [0, 0.075, -0.03, 0.04, 0.035, 0.09, 0xfff8e6, 0xf0e4c4]],
    // a few naturally round decorations
    beach_ball: [[0, 0.27, 0, 0.27, 0.27, 0.27, 0xff8f7f, 0xfff6ea], [0, 0.52, 0, 0.1, 0.035, 0.1, 0xffffff, 0xf4efe6], [0.225, 0.27, 0, 0.06, 0.17, 0.17, 0x86b8e6, 0x5f93c9], [-0.225, 0.27, 0, 0.06, 0.17, 0.17, 0xffe08a, 0xf4c542]],
    globe: [[0, 0.04, 0, 0.19, 0.045, 0.19, 0x7a5236, 0x5a3a24], [0, 0.2, 0, 0.035, 0.13, 0.035, 0xf2c94c, 0xc99a2e], [0, 0.56, 0, 0.25, 0.25, 0.25, 0x9bdaf7, 0x5aa6e0],
      [0.02, 0.62, 0.215, 0.12, 0.1, 0.05, 0x9de284, 0x5fae5c], [0.08, 0.5, -0.215, 0.1, 0.08, 0.05, 0x9de284, 0x5fae5c], [-0.215, 0.6, 0.03, 0.05, 0.09, 0.11, 0x9de284, 0x5fae5c]],
    flower_pot: [[0, 0.17, 0, 0.19, 0.17, 0.19, 0xdf9468, 0xb5653f], [0, 0.33, 0, 0.2, 0.04, 0.2, 0xe8a47c, 0xc9774e], [0, 0.5, 0, 0.03, 0.15, 0.03, 0x7fd07a, 0x4f9c52],
      [0.08, 0.47, 0, 0.09, 0.03, 0.05, 0x7fd07a, 0x4f9c52], [0, 0.72, 0, 0.15, 0.1, 0.15, 0xfbc4d6, 0xee8fb0], [0, 0.8, 0, 0.06, 0.05, 0.06, 0xffe88a, 0xf4c542]],
    potted_palm: [[0, 0.2, 0, 0.24, 0.2, 0.24, 0xdf9468, 0xb5653f], [0, 0.39, 0, 0.25, 0.045, 0.25, 0xe8a47c, 0xc9774e], [0, 0.6, 0, 0.06, 0.16, 0.06, 0xb89466, 0x8a6a44], [0, 0.85, 0, 0.055, 0.16, 0.055, 0xb89466, 0x8a6a44],
      [0.01, 1.06, 0, 0.05, 0.12, 0.05, 0xb89466, 0x8a6a44], [0.3, 1.14, 0, 0.3, 0.04, 0.09, 0x8fd978, 0x4f9c52], [-0.3, 1.14, 0, 0.3, 0.04, 0.09, 0x8fd978, 0x4f9c52],
      [0, 1.15, 0.3, 0.09, 0.04, 0.3, 0x86d07a, 0x4f9c52], [0, 1.15, -0.3, 0.09, 0.04, 0.3, 0x86d07a, 0x4f9c52], [0, 1.2, 0, 0.14, 0.09, 0.14, 0x9de284, 0x5fae5c],
      [0.2, 1.1, 0.2, 0.17, 0.04, 0.17, 0x7fd07a, 0x4f9c52], [-0.2, 1.1, 0.2, 0.17, 0.04, 0.17, 0x7fd07a, 0x4f9c52], [0.2, 1.1, -0.2, 0.17, 0.04, 0.17, 0x7fd07a, 0x4f9c52], [-0.2, 1.1, -0.2, 0.17, 0.04, 0.17, 0x7fd07a, 0x4f9c52]],
    pet_bed: [[0, 0.1, 0, 0.46, 0.1, 0.46, 0xecd5ac, 0xc9a877], [0, 0.18, 0, 0.36, 0.09, 0.36, 0xf9c3d4, 0xe895ab]],
    log_seat: [[0, 0.235, 0, 0.5, 0.235, 0.27, 0xb07c50, 0x7a5236], [0.47, 0.235, 0, 0.035, 0.17, 0.195, 0xecd0a4, 0xcfa877], [-0.47, 0.235, 0, 0.035, 0.17, 0.195, 0xecd0a4, 0xcfa877]],
    lamp: [[0, 0.035, 0, 0.14, 0.035, 0.14, 0x727983, 0x4f555e], [0, 0.34, 0, 0.035, 0.3, 0.035, 0x727983, 0x4f555e], [0, 0.82, 0, 0.27, 0.2, 0.27, 0xfff8d6, 0xffdf9a]],
    lantern: [[0, 0.035, 0, 0.2, 0.035, 0.2, 0x727983, 0x4f555e], [0, 0.29, 0, 0.17, 0.22, 0.17, 0xfff5cc, 0xffc87a], [0, 0.53, 0, 0.2, 0.05, 0.2, 0x727983, 0x4f555e], [0, 0.63, 0, 0.05, 0.05, 0.05, 0x727983, 0x4f555e]],
    beach_umbrella: [[0, 0.85, 0, 0.035, 0.85, 0.035, 0xfaf7f0, 0xe0d9cc], [0, 1.72, 0, 0.95, 0.28, 0.95, 0xff8f7f, 0xfff6ea], [0, 2.0, 0, 0.07, 0.06, 0.07, 0xe0766a, 0xc95a50]],
    stool: [[0, 0.5, 0, 0.29, 0.075, 0.29, 0xecd0a4, 0xcfa877], [0.17, 0.22, 0.17, 0.045, 0.23, 0.045, 0xb07c50, 0x7a5236], [-0.17, 0.22, 0.17, 0.045, 0.23, 0.045, 0xb07c50, 0x7a5236],
      [0.17, 0.22, -0.17, 0.045, 0.23, 0.045, 0xb07c50, 0x7a5236], [-0.17, 0.22, -0.17, 0.045, 0.23, 0.045, 0xb07c50, 0x7a5236]],
    birdbath: [[0, 0.07, 0, 0.27, 0.07, 0.27, 0xcfd3da, 0x9aa0aa], [0, 0.33, 0, 0.11, 0.27, 0.11, 0xc8ccd4, 0x9aa0aa], [0, 0.62, 0, 0.4, 0.09, 0.4, 0xd6dae0, 0xa4aab4], [0, 0.69, 0, 0.3, 0.035, 0.3, 0xa8e4f4, 0x6fc4e2]],
    sandcastle: [[0, 0.15, 0, 0.44, 0.17, 0.44, 0xfaeac4, 0xe2c890], [0.28, 0.3, 0.28, 0.14, 0.3, 0.14, 0xf8e6ba, 0xdcc084], [-0.28, 0.3, 0.28, 0.14, 0.3, 0.14, 0xf8e6ba, 0xdcc084],
      [0.28, 0.3, -0.28, 0.14, 0.3, 0.14, 0xf8e6ba, 0xdcc084], [-0.28, 0.3, -0.28, 0.14, 0.3, 0.14, 0xf8e6ba, 0xdcc084], [0, 0.42, 0, 0.2, 0.33, 0.2, 0xfaeac4, 0xe2c890],
      [0, 0.85, 0, 0.02, 0.14, 0.02, 0x7a5236, 0x5a3a24], [0.1, 0.93, 0, 0.1, 0.055, 0.02, 0xf08a7c, 0xe0766a]],
    star_lamp: [[0, 0.035, 0, 0.16, 0.035, 0.16, 0x727983, 0x4f555e], [0, 0.22, 0, 0.035, 0.2, 0.035, 0x727983, 0x4f555e], [0, 0.64, 0, 0.17, 0.17, 0.11, 0xfff6b8, 0xffd45a],
      [0, 0.88, 0, 0.075, 0.15, 0.07, 0xfff6b8, 0xffe07a], [0, 0.42, 0, 0.07, 0.11, 0.07, 0xffe89a, 0xffcf5a], [0.24, 0.64, 0, 0.15, 0.075, 0.07, 0xfff0a0, 0xffd45a], [-0.24, 0.64, 0, 0.15, 0.075, 0.07, 0xfff0a0, 0xffd45a]],
    torch: [[0, 0.31, 0, 0.05, 0.31, 0.05, 0x8a6038, 0x5a3a24], [0, 0.71, 0, 0.1, 0.11, 0.1, 0xffc45c, 0xe8542a]],
    tiki_torch: [[0, 0.62, 0, 0.06, 0.62, 0.06, 0xb07c50, 0x7a5236], [0, 1.37, 0, 0.16, 0.13, 0.16, 0xe0cc9e, 0xb89c6c], [0, 1.6, 0, 0.1, 0.1, 0.1, 0xffc45c, 0xe8542a]],
    barrel: [[0, 0.5, 0, 0.43, 0.32, 0.43, 0xb9845a, 0x8a6038], [0, 0.22, 0, 0.37, 0.22, 0.37, 0xb07c50, 0x7a5236], [0, 0.78, 0, 0.37, 0.2, 0.37, 0xb9845a, 0x8a6038],
      [0, 0.3, 0, 0.42, 0.035, 0.42, 0x727983, 0x4f555e], [0, 0.7, 0, 0.42, 0.035, 0.42, 0x727983, 0x4f555e], [0, 0.965, 0, 0.3, 0.03, 0.3, 0x8a6038, 0x6a4428]],
    picnic_basket: [[0, 0.22, 0, 0.32, 0.22, 0.26, 0xe0cc9e, 0xb89c6c], [0, 0.43, 0, 0.3, 0.05, 0.24, 0xfaf7f0, 0xf08a7c], [0, 0.54, 0.2, 0.03, 0.1, 0.03, 0xcfb586, 0xb89c6c], [0, 0.54, -0.2, 0.03, 0.1, 0.03, 0xcfb586, 0xb89c6c],
      [0, 0.66, 0, 0.03, 0.03, 0.22, 0xcfb586, 0xb89c6c]],
    mailbox: [[0, 0.31, 0, 0.06, 0.31, 0.06, 0xb07c50, 0x7a5236], [0, 0.81, 0, 0.26, 0.2, 0.27, 0xee8f84, 0xc95a50], [0, 0.81, 0.25, 0.2, 0.15, 0.04, 0xffffff, 0xf0ebe0], [0.27, 0.88, -0.06, 0.03, 0.11, 0.05, 0xf7d466, 0xc99a2e]],
    tiki_statue: [[0, 0.25, 0, 0.27, 0.25, 0.27, 0x94683c, 0x5a3a24], [0, 0.7, 0, 0.27, 0.25, 0.27, 0x94683c, 0x5a3a24], [0, 1.15, 0, 0.27, 0.25, 0.27, 0x94683c, 0x5a3a24],
      [0, 1.06, 0, 0.31, 0.07, 0.29, 0xb9845a, 0x8a6038], [0.11, 0.78, 0.25, 0.065, 0.08, 0.06, 0xffc45c, 0xe8542a], [-0.11, 0.78, 0.25, 0.065, 0.08, 0.06, 0xffc45c, 0xe8542a],
      [0, 0.3, 0.25, 0.14, 0.07, 0.06, 0xf0d8b0, 0xcfa877], [0, 1.43, 0, 0.33, 0.08, 0.33, 0x8fd978, 0x4f9c52]],
    teddy: [[0, 0.2, 0, 0.17, 0.2, 0.15, 0xd1a474, 0xa67848], [0, 0.5, 0, 0.15, 0.14, 0.14, 0xd1a474, 0xa67848], [0.11, 0.63, 0, 0.05, 0.05, 0.03, 0xc99a6b, 0xa67848], [-0.11, 0.63, 0, 0.05, 0.05, 0.03, 0xc99a6b, 0xa67848],
      [0, 0.47, 0.12, 0.07, 0.055, 0.05, 0xf6e4c8, 0xe6cfa8], [0, 0.49, 0.17, 0.022, 0.018, 0.015, 0x4a3a34, 0x4a3a34], [0.055, 0.54, 0.125, 0.018, 0.022, 0.015, 0x4a3a34, 0x4a3a34], [-0.055, 0.54, 0.125, 0.018, 0.022, 0.015, 0x4a3a34, 0x4a3a34],
      [0.19, 0.25, 0.03, 0.06, 0.1, 0.06, 0xc99a6b, 0xa67848], [-0.19, 0.25, 0.03, 0.06, 0.1, 0.06, 0xc99a6b, 0xa67848], [0.1, 0.06, 0.1, 0.07, 0.06, 0.1, 0xc99a6b, 0xa67848], [-0.1, 0.06, 0.1, 0.07, 0.06, 0.1, 0xc99a6b, 0xa67848]],
    gnome: [[0, 0.17, 0, 0.16, 0.17, 0.14, 0x86b8ea, 0x5a8fcc], [0, 0.4, 0, 0.12, 0.1, 0.11, 0xffdcbc, 0xf2c4a0], [0, 0.32, 0.08, 0.1, 0.1, 0.06, 0xffffff, 0xe8ecf2], [0, 0.42, 0.12, 0.03, 0.03, 0.03, 0xf7bfa2, 0xeaa585],
      [0, 0.52, 0, 0.14, 0.07, 0.14, 0xee6f66, 0xc94a44], [0, 0.62, 0, 0.1, 0.08, 0.1, 0xee6f66, 0xc94a44], [0, 0.73, 0, 0.06, 0.08, 0.06, 0xee6f66, 0xc94a44], [0, 0.82, 0, 0.03, 0.05, 0.03, 0xee6f66, 0xc94a44],
      [0.07, 0.03, 0.06, 0.06, 0.035, 0.08, 0x8a6038, 0x5a3a24], [-0.07, 0.03, 0.06, 0.06, 0.035, 0.08, 0x8a6038, 0x5a3a24]],
    mush_lamp: [[0, 0.025, 0, 0.17, 0.03, 0.17, 0x8fd978, 0x5fae5c], [0, 0.18, 0, 0.09, 0.18, 0.09, 0xfff8ec, 0xf0e2cc], [0, 0.42, 0, 0.27, 0.16, 0.27, 0xffc8dc, 0xf79ac0],
      [0.1, 0.55, 0.06, 0.045, 0.03, 0.045, 0xffffff, 0xfff0f6], [-0.11, 0.53, -0.04, 0.045, 0.03, 0.045, 0xffffff, 0xfff0f6], [0.0, 0.56, -0.12, 0.04, 0.028, 0.04, 0xffffff, 0xfff0f6], [-0.03, 0.57, 0.12, 0.035, 0.025, 0.035, 0xffffff, 0xfff0f6]],
    sand_buddy: [[0, 0.2, 0, 0.24, 0.2, 0.24, 0xfaeac4, 0xe2c890], [0, 0.5, 0, 0.18, 0.16, 0.18, 0xfaeac4, 0xe2c890], [0, 0.75, 0, 0.13, 0.12, 0.13, 0xfaeac4, 0xe6cc96],
      [0.05, 0.78, 0.11, 0.02, 0.022, 0.015, 0x5a4a44, 0x5a4a44], [-0.05, 0.78, 0.11, 0.02, 0.022, 0.015, 0x5a4a44, 0x5a4a44], [0, 0.87, 0, 0.07, 0.03, 0.07, 0xff9a78, 0xe86e50],
      [0.27, 0.53, 0, 0.11, 0.02, 0.02, 0x8a6038, 0x6a4428], [-0.27, 0.53, 0, 0.11, 0.02, 0.02, 0x8a6038, 0x6a4428], [0, 0.52, 0.17, 0.025, 0.025, 0.02, 0xf79ac0, 0xe895ab], [0, 0.43, 0.17, 0.025, 0.025, 0.02, 0xf79ac0, 0xe895ab]],
    star_fragment: starArms([[0, 0.09, 0, 0.12, 0.1, 0.12, 0xfff4b0, 0xffcf5a]], 0.08, 0.05, 0xfff0a0, 0xffc94a),
  };

  // the campfire: a ring of round stones around two crossed logs, with ash or glowing embers in the middle
  (function () {
    const base = [];
    for (let i = 0; i < 8; i++) {
      const a = i * 0.7854 + 0.2, big = i % 2 ? 0.085 : 0.105;
      base.push([Math.cos(a) * 0.4, big * 0.7, Math.sin(a) * 0.4, big, big * 0.78, big, i % 3 ? 0xd3d7de : 0xc2c7d0, 0x9aa0aa]);
    }
    base.push([0, 0.1, 0, 0.36, 0.085, 0.095, 0xb07c50, 0x7a5236], [0, 0.14, 0, 0.095, 0.085, 0.36, 0xa9744a, 0x74502f]);
    ROUND_FINDS.campfire = base.concat([[0, 0.06, 0, 0.2, 0.05, 0.2, 0xa39d95, 0x77726b]]);
    ROUND_FINDS.campfire_on = base.concat([[0, 0.1, 0, 0.21, 0.09, 0.21, 0xffc45c, 0xe8542a], [0.06, 0.2, -0.04, 0.09, 0.07, 0.09, 0xffe08a, 0xff9a3c]]);
  })();

  function emitBoxes(def, x, y, z, meta) {
    if (def.key === 'berry_bush' && WU !== undefined) { icoTris(); emitBush(x, y, z, meta); return; }
    const round = ((meta & 4) && ROUND_FINDS[def.key + '_on']) || ROUND_FINDS[def.key];
    if (round) {
      icoTris();
      const turn = def.rot === false ? 0 : (meta & 3);
      const cx = x + 0.5, cz = z + 0.5, yo = def.rides ? G.groundOffsetAt(cx, y, cz) : 0, r = turn * 1.5708, co = Math.cos(r), si = Math.sin(r);
      const quarter = (turn & 1) === 1;                    // a quarter turn swaps the x and z radii
      const K = def.cat === 'find' ? 1.4 : 1;              // finds are a little larger than life so they are easy to spot
      for (const b of round) emitBlob(cx + (b[0] * co - b[2] * si) * K, y + yo + b[1] * K, cz + (b[0] * si + b[2] * co) * K, (quarter ? b[5] : b[3]) * K, b[4] * K, (quarter ? b[3] : b[5]) * K, rgb(b[6]), rgb(b[7]));
      return;
    }
    // round fruit, coconuts and pebbles instead of little boxes
    if (def.fruit || def.key === 'coconut' || def.key === 'pebble') {
      icoTris();
      const cx = x + 0.5, cz = z + 0.5;
      if (def.fruit) {
        const stem = rgb(0x7a5236), leaf = rgb(0x6fbf62);
        if (def.key === 'fruit_cherry') {
          emitBlob(cx - 0.13, y + 0.6, cz, 0.14, 0.14, 0.14, rgb(0xf0506a), rgb(0xb9243f));
          emitBlob(cx + 0.15, y + 0.54, cz + 0.04, 0.14, 0.14, 0.14, rgb(0xf0506a), rgb(0xb9243f));
          emitBlob(cx, y + 0.86, cz, 0.03, 0.16, 0.03, stem, stem);
        } else {
          const cols = { fruit_apple: [0xf26a5c, 0xc23a34], fruit_orange: [0xffb650, 0xe88a22], fruit_peach: [0xffcdb4, 0xf59a8a] }[def.key];
          emitBlob(cx, y + 0.6, cz, 0.21, 0.2, 0.21, rgb(cols[0]), rgb(cols[1]));
          emitBlob(cx, y + 0.86, cz, 0.03, 0.12, 0.03, stem, stem);
          emitBlob(cx + 0.09, y + 0.86, cz, 0.1, 0.035, 0.06, leaf, leaf);
        }
      } else {
        const yo = G.groundOffsetAt(cx, y, cz), r = (meta & 3) * 1.57;
        if (def.key === 'coconut') emitBlob(cx, y + yo + 0.17, cz, 0.19, 0.18, 0.19, rgb(0x94643e), rgb(0x6a4428));
        else {
          emitBlob(cx - 0.08 * Math.cos(r), y + yo + 0.11, cz - 0.08 * Math.sin(r), 0.24, 0.14, 0.2, rgb(0xcfd3da), rgb(0x9aa0aa));
          emitBlob(cx + 0.2 * Math.cos(r), y + yo + 0.08, cz + 0.2 * Math.sin(r), 0.13, 0.09, 0.12, rgb(0xc4c8d0), rgb(0x9298a2));
        }
      }
      return;
    }
    const rot = def.rot ? (meta & 3) : 0;
    const list = (meta & 4) && def.boxesOn ? def.boxesOn : def.boxes;
    yShift = def.rides ? G.groundOffsetAt(x + 0.5, y, z + 0.5) : 0;
    for (const bx of list) emitBox(bx.b, bx, rot, x, y, z);
    yShift = 0;
    if (def.connect) {
      const t = WOOD();
      if (fenceLinks(x + 1, y, z)) { emitBox([10, 9, 7, 16, 11, 9], t, 0, x, y, z); emitBox([10, 4, 7, 16, 6, 9], t, 0, x, y, z); }
      if (fenceLinks(x - 1, y, z)) { emitBox([0, 9, 7, 6, 11, 9], t, 0, x, y, z); emitBox([0, 4, 7, 6, 6, 9], t, 0, x, y, z); }
      if (fenceLinks(x, y, z + 1)) { emitBox([7, 9, 10, 9, 11, 16], t, 0, x, y, z); emitBox([7, 4, 10, 9, 6, 16], t, 0, x, y, z); }
      if (fenceLinks(x, y, z - 1)) { emitBox([7, 9, 0, 9, 11, 6], t, 0, x, y, z); emitBox([7, 4, 0, 9, 6, 6], t, 0, x, y, z); }
    }
  }

  // Build geometry for a list of standalone boxes (used for held items / icons / ghost previews)
  G.buildBlockGeometry = function (def, meta) {
    pos = []; nrm = []; uvs = []; col = []; ind = []; vcount = 0; swy = [];
    if (def.shape === 'cube') {
      const saveGet = G.getBlock;
      G.getBlock = () => 0;
      emitCube(def, 0, 0, 0);
      G.getBlock = saveGet;
    } else if (def.shape === 'cross') emitCross(def, 0, 0, 0, meta || 0);
    else if (def.shape === 'boxes') {
      const saveGet = G.getBlock;
      G.getBlock = () => 0;
      emitBoxes(def, 0, 0, 0, meta || 0);
      G.getBlock = saveGet;
    }
    return toGeometry();
  };

  function toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const sw = new Float32Array(vcount);
    for (const k in swy) sw[k] = swy[k];
    g.setAttribute('sway', new THREE.BufferAttribute(sw, 1));
    g.setIndex(ind);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  // ---------- round trees ----------
  // Natural trees are not drawn as cubes: each trunk cell becomes a slice of a round trunk and the
  // leaf blocks around a trunk top are replaced by soft rounded canopies.  The voxels underneath are
  // unchanged, so chopping, collisions and picking all behave exactly as before.
  let ICO = null, WU = 0, WV = 0;
  function icoTris() {
    if (!ICO) {
      const g = new THREE.IcosahedronGeometry(1, 1);
      ICO = Array.from(g.attributes.position.array);
      g.dispose();
      const r = fullTile(G.TILES.cloth_white);
      WU = (r[0] + r[1]) / 2; WV = (r[2] + r[3]) / 2;
    }
    return ICO;
  }
  function pushV(x, y, z, nx, ny, nz, c) { pos.push(x, y, z); nrm.push(nx, ny, nz); uvs.push(WU, WV); col.push(c[0], c[1], c[2]); ind.push(vcount++); }
  const rgb = (h, f) => [((h >> 16) & 255) / 255 * (f || 1), ((h >> 8) & 255) / 255 * (f || 1), (h & 255) / 255 * (f || 1)];
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  function emitBlob(cx, cy, cz, rx, ry, rz, top, bot, evenSway) {
    const t = icoTris();
    for (let i = 0; i < t.length; i += 3) {
      const vx = t[i], vy = t[i + 1], vz = t[i + 2];
      let nx = vx / rx, ny = vy / ry, nz = vz / rz;
      const l = Math.hypot(nx, ny, nz) || 1;
      pushV(cx + vx * rx, cy + vy * ry, cz + vz * rz, nx / l, ny / l, nz / l, mixc(bot, top, vy * 0.5 + 0.5));
      if (blobSway) swy[vcount - 1] = evenSway ? blobSway : blobSway * (0.12 + 0.88 * (vy * 0.5 + 0.5));      // never zero: also marks foliage for the peephole
    }
  }

  function emitTrunk(x, y, z, r0, r1, cA, cB, cap) {
    icoTris();
    const cx = x + 0.5, cz = z + 0.5, N = 8;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * 6.28318, a1 = ((k + 1) / N) * 6.28318;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const c = k % 2 ? cA : cB;
      const b0 = [cx + c0 * r0, y, cz + s0 * r0], b1 = [cx + c1 * r0, y, cz + s1 * r0];
      const t0 = [cx + c0 * r1, y + 1, cz + s0 * r1], t1 = [cx + c1 * r1, y + 1, cz + s1 * r1];
      pushV(b1[0], b1[1], b1[2], c1, 0, s1, c); pushV(b0[0], b0[1], b0[2], c0, 0, s0, c); pushV(t0[0], t0[1], t0[2], c0, 0, s0, c);
      pushV(b1[0], b1[1], b1[2], c1, 0, s1, c); pushV(t0[0], t0[1], t0[2], c0, 0, s0, c); pushV(t1[0], t1[1], t1[2], c1, 0, s1, c);
      if (cap) {
        const lc = mixc(c, [1, 0.93, 0.78], 0.55);
        pushV(cx, y + 1, cz, 0, 1, 0, lc); pushV(t1[0], t1[1], t1[2], 0, 1, 0, lc); pushV(t0[0], t0[1], t0[2], 0, 1, 0, lc);
      }
    }
  }

  function emitPalmCrown(x, top, z) {
    const cx = x + 0.5, cy = top + 1.05, cz = z + 0.5;
    const tint = 0.95 + G.hash2(x, z, 91) * 0.1;
    const mid = rgb(0x8bdc86, tint), tip = rgb(0x5fb868, tint);
    const D2 = [0.15, 1.0, 1.9, 2.7, 3.3], H2 = [0.2, 0.6, 0.5, 0.05, -0.75], W2 = [0.3, 0.46, 0.42, 0.3, 0.08];
    const off = G.hash2(x, z, 92) * 6.28;
    for (let k = 0; k < 7; k++) {
      const a = off + (k / 7) * 6.28318, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
      const droop = (k % 2) * 0.18;
      for (let i = 0; i < 4; i++) {
        const A = [cx + dx * D2[i] - px * W2[i], cy + H2[i] - droop * i * 0.3, cz + dz * D2[i] - pz * W2[i]];
        const Bq = [cx + dx * D2[i] + px * W2[i], cy + H2[i] - droop * i * 0.3, cz + dz * D2[i] + pz * W2[i]];
        const C = [cx + dx * D2[i + 1] + px * W2[i + 1], cy + H2[i + 1] - droop * (i + 1) * 0.3, cz + dz * D2[i + 1] + pz * W2[i + 1]];
        const Dq = [cx + dx * D2[i + 1] - px * W2[i + 1], cy + H2[i + 1] - droop * (i + 1) * 0.3, cz + dz * D2[i + 1] - pz * W2[i + 1]];
        const c0 = mixc(mid, tip, i / 4), c1 = mixc(mid, tip, (i + 1) / 4);
        // top side then underside, so fronds show from above and below
        for (const [p, q, r, cp, cq, cr, ny] of [[A, C, Bq, c0, c1, c0, 1], [A, Dq, C, c0, c1, c1, 1], [A, Bq, C, c0, c0, c1, -1], [A, C, Dq, c0, c1, c1, -1]]) {
          const sh = ny < 0 ? 0.78 : 1;
          pushV(p[0], p[1], p[2], 0, ny, 0, [cp[0] * sh, cp[1] * sh, cp[2] * sh]);
          pushV(q[0], q[1], q[2], 0, ny, 0, [cq[0] * sh, cq[1] * sh, cq[2] * sh]);
          pushV(r[0], r[1], r[2], 0, ny, 0, [cr[0] * sh, cr[1] * sh, cr[2] * sh]);
          for (let j = 3; j >= 1; j--) swy[vcount - j] = Math.min(1, Math.hypot(pos[(vcount - j) * 3] - cx, pos[(vcount - j) * 3 + 2] - cz) / 3.3) * 0.65 + 0.05;
        }
      }
    }
    emitBlob(cx, cy + 0.1, cz, 0.5, 0.42, 0.5, rgb(0x9ae28e, tint), rgb(0x62b866, tint));
    emitBlob(cx + 0.3, cy - 0.32, cz + 0.1, 0.2, 0.2, 0.2, rgb(0x9a6a44), rgb(0x6f4a30));
    emitBlob(cx - 0.22, cy - 0.34, cz - 0.24, 0.2, 0.2, 0.2, rgb(0x9a6a44), rgb(0x6f4a30));
  }

  const isLeafId = (id) => id === G.B.leaves || id === G.B.blossom_leaves;
  // trunk tops (with leaves above) in and around a chunk; leaves near one are covered by its canopy
  function findCanopies(x0, z0) {
    const out = [], blocks = G.world.blocks, meta = G.world.meta, B = G.B;
    for (let z = Math.max(0, z0 - 3); z < Math.min(D, z0 + CH + 3); z++) for (let x = Math.max(0, x0 - 3); x < Math.min(W, x0 + CH + 3); x++) {
      for (let y = H - 2; y > 0; y--) {
        const i = (y * D + z) * W + x, id = blocks[i];
        if ((id !== B.log && id !== B.palm_log) || (meta[i] & 4)) continue;
        const above = blocks[i + D * W];
        if (id === B.log && isLeafId(above)) out.push({ x, y, z, palm: false, pink: above === B.blossom_leaves });
        else if (id === B.palm_log && above === B.palm_leaves) out.push({ x, y, z, palm: true });
      }
    }
    return out;
  }
  function coveredByCanopy(x, y, z, palm, canopies) {
    for (const c of canopies) {
      if (c.palm !== palm) continue;
      const dy = y - c.y;
      if (Math.abs(x - c.x) <= 3 && Math.abs(z - c.z) <= 3 && dy >= -2 && dy <= (palm ? 2 : 3)) return true;
    }
    return false;
  }

  function emitTreePart(def, id, x, y, z, canopies) {
    const B = G.B;
    if (def.tree === 'leaf') {
      if (!coveredByCanopy(x, y, z, id === B.palm_leaves, canopies)) emitCube(def, x, y, z);
      return;
    }
    const palm = id === B.palm_log;
    const above = G.getBlock(x, y + 1, z), below = G.getBlock(x, y - 1, z);
    const r = palm ? 0.25 : 0.36;
    const cA = palm ? rgb(0xb58f60) : rgb(0x9c7249), cB = palm ? rgb(0xc7a172) : rgb(0xae8258);
    const crowned = palm ? above === B.palm_leaves : isLeafId(above);
    emitTrunk(x, y, z, below !== id ? r + 0.09 : r, r, cA, cB, above !== id && !crowned);
    if (below !== id) emitTrunk(x, y - 1, z, r + 0.09, r + 0.09, cA, cB, false);     // root, in case the ground dips here
    if (!crowned) return;
    if (palm) { emitPalmCrown(x, y, z); return; }
    const pink = above === B.blossom_leaves;
    const tint = 0.94 + G.hash2(x, z, 90) * 0.12;
    const top = pink ? rgb(0xffdbe7, tint) : rgb(0xa6e682, tint), bot = pink ? rgb(0xe38fb2, tint) : rgb(0x55a551, tint);
    const ox = (G.hash2(x, z, 93) - 0.5) * 0.5, oz = (G.hash2(x, z, 94) - 0.5) * 0.5;
    blobSway = 0.42;
    emitBlob(x + 0.5, y + 0.7, z + 0.5, 2.15, 1.6, 2.15, mixc(bot, top, 0.8), bot);
    emitBlob(x + 0.5 + ox, y + 1.9, z + 0.5 + oz, 1.5, 1.2, 1.5, top, mixc(bot, top, 0.55));
    emitBlob(x + 0.5 - ox * 2.2, y + 0.6, z + 0.5 - oz * 2.2, 1.3, 1.05, 1.3, mixc(bot, top, 0.75), bot);
    blobSway = 0;
  }

  G.chunks = {};   // key -> { mesh }

  G.initChunkMaterial = function () {
    if (G.renderer) G.atlasTexture.anisotropy = Math.min(8, G.renderer.capabilities.getMaxAnisotropy());
    G.chunkMaterial = new THREE.MeshLambertMaterial({
      map: G.atlasTexture, vertexColors: true, alphaTest: 0.5, side: THREE.FrontSide,
    });
    // Roof cut-away: discard fragments above a height near the player (x, z, cutY, radius)
    G.cutUniform = { value: new THREE.Vector4(0, 0, 0, 0) };
    G.headUniform = { value: new THREE.Vector3(0, -999, 0) };
    G.timeUniform = { value: 0 };
    G.chunkMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uCut = G.cutUniform;
      shader.uniforms.uHead = G.headUniform;
      shader.uniforms.uTime = G.timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying float vSway;\nattribute float sway;\nuniform float uTime;')
        // plants and leaves lean gently in the breeze
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSway = sway;\ntransformed.x += sway * sin(uTime * 1.6 + position.x * 0.8 + position.z * 0.6) * 0.07;\ntransformed.z += sway * cos(uTime * 1.25 + position.x * 0.5 - position.z * 0.7) * 0.05;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying float vSway;\nuniform vec4 uCut;\nuniform vec3 uHead;')
        // Roof cut-away only.  (An older "peephole" through foliage lived here too, but it read the
        // built-in cameraPosition, which this material type never receives, so it hid plants along
        // the wrong line.  Trees over the player are opened by the roof cut instead.)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (uCut.w > 0.0 && vWPos.y > uCut.z + 0.002 && distance(vWPos.xz, uCut.xy) < uCut.w) discard;');
    };
    G.chunkDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking, map: G.atlasTexture, alphaTest: 0.5,
    });
  };

  G.meshChunk = function (cx, cz) {
    pos = []; nrm = []; uvs = []; col = []; ind = []; vcount = 0; swy = [];
    const x0 = cx * CH, z0 = cz * CH;
    const blocks = G.world.blocks, metaArr = G.world.meta;
    const canopies = findCanopies(x0, z0);
    for (let y = 0; y < H; y++) {
      for (let z = z0; z < z0 + CH; z++) {
        let i = (y * D + z) * W + x0;
        for (let x = x0; x < x0 + CH; x++, i++) {
          const id = blocks[i];
          if (!id) continue;
          const def = G.BLOCKS[id];
          if (def.tree && !(metaArr[i] & 4)) emitTreePart(def, id, x, y, z, canopies);
          else if (G.NATURAL[id] && G.surfAt(x, z) === y) emitSmooth(def, x, y, z);
          else if (def.shape === 'cube') emitCube(def, x, y, z);
          else if (def.shape === 'cross') emitCross(def, x, y, z, metaArr[i]);
          else if (def.shape === 'boxes') emitBoxes(def, x, y, z, metaArr[i]);
        }
      }
    }
    const key = cx + ',' + cz;
    let ch = G.chunks[key];
    if (ch && ch.mesh) { G.scene.remove(ch.mesh); ch.mesh.geometry.dispose(); }
    if (!ch) ch = G.chunks[key] = {};
    if (vcount === 0) { ch.mesh = null; return; }
    const mesh = new THREE.Mesh(toGeometry(), G.chunkMaterial);
    mesh.customDepthMaterial = G.chunkDepthMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    G.scene.add(mesh);
    ch.mesh = mesh;
  };

  G.meshAllChunks = function () {
    G.surfCache.fill(-2);
    for (let cz = 0; cz < D / CH; cz++) for (let cx = 0; cx < W / CH; cx++) G.meshChunk(cx, cz);
    G.world.dirty.clear();
  };

  // Re-mesh a few dirty chunks per frame
  G.updateDirtyChunks = function (limit) {
    const dirty = G.world.dirty;
    if (!dirty.size) return;
    let n = 0;
    for (const key of dirty) {
      const parts = key.split(',');
      const cx = +parts[0], cz = +parts[1];
      dirty.delete(key);
      if (cx < 0 || cz < 0 || cx >= W / CH || cz >= D / CH) continue;
      G.meshChunk(cx, cz);
      if (++n >= (limit || 6)) break;
    }
  };
})();
