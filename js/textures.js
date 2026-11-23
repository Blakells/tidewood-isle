// Tidewood Isle — procedural 16x16 pixel textures packed into one atlas.
'use strict';
(function () {
  const TS = 16;            // tile size in pixels
  const PER_ROW = 16;       // tiles per atlas row
  const ATLAS = TS * PER_ROW;
  const defs = [];
  G.TILES = {};             // name -> tile index
  G.TILE_COLORS = {};       // name -> average css colour (used for particles / icons)

  function T(name, draw) { G.TILES[name] = defs.length; defs.push({ name, draw }); }
  const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // Pixel painter for one tile
  function Painter(seed) {
    this.d = new Uint8ClampedArray(TS * TS * 4);
    this.r = G.makeRng(seed);
  }
  Painter.prototype.set = function (x, y, c, a) {
    if (x < 0 || y < 0 || x >= TS || y >= TS) return;
    const i = (y * TS + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a === undefined ? 255 : a;
  };
  Painter.prototype.speckle = function (base, vary) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) this.set(x, y, mul(base, 1 + (this.r() - 0.5) * vary));
  };
  Painter.prototype.rect = function (x0, y0, x1, y1, c, vary) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, vary ? mul(c, 1 + (this.r() - 0.5) * vary) : c);
  };
  Painter.prototype.dots = function (n, c, vary) {
    for (let i = 0; i < n; i++) this.set((this.r() * TS) | 0, (this.r() * TS) | 0, vary ? mul(c, 1 + (this.r() - 0.5) * vary) : c);
  };

  const solid = (name, color, vary) => T(name, (p) => p.speckle(hex(color), vary === undefined ? 0.08 : vary));

  function planks(name, color) {
    T(name, (p) => {
      const base = hex(color);
      for (let y = 0; y < TS; y++) {
        const row = (y / 4) | 0;
        for (let x = 0; x < TS; x++) {
          let c = mul(base, 0.94 + p.r() * 0.1 + (row % 2) * 0.04);
          if (y % 4 === 3) c = mul(base, 0.72);
          if ((x + row * 6) % 16 === 0 && y % 4 !== 3) c = mul(base, 0.78);
          p.set(x, y, c);
        }
      }
    });
  }

  function bricks(name, color, mortar, bw, bh) {
    T(name, (p) => {
      const base = hex(color), m = hex(mortar);
      for (let y = 0; y < TS; y++) {
        const row = (y / bh) | 0;
        for (let x = 0; x < TS; x++) {
          const off = (row % 2) * (bw >> 1);
          const isMortar = (y % bh === bh - 1) || ((x + off) % bw === bw - 1);
          const tint = 0.9 + G.hash2(((x + off) / bw) | 0, row, 7) * 0.2;
          p.set(x, y, isMortar ? mul(m, 0.95 + p.r() * 0.1) : mul(base, tint * (0.96 + p.r() * 0.08)));
        }
      }
    });
  }

  function shingles(name, color) {
    T(name, (p) => {
      const base = hex(color);
      for (let y = 0; y < TS; y++) {
        const row = (y / 4) | 0;
        for (let x = 0; x < TS; x++) {
          const off = (row % 2) * 4;
          let f = 1.05 - (y % 4) * 0.07;
          if ((x + off) % 8 === 7) f = 0.72;
          if (y % 4 === 3) f = 0.68;
          p.set(x, y, mul(base, f * (0.97 + p.r() * 0.06)));
        }
      }
    });
  }

  // ---------- Terrain ----------
  // Soft, low-noise surfaces with small repeating motifs (tufts, pebbles, leaf clusters) so the
  // island reads as gentle and storybook-like.  NOTE: tile order here must never change.
  const sandBase = (p) => {
    p.speckle(hex(0xf8e6ba), 0.035);
    for (const [x, y] of [[2, 3], [10, 2], [6, 8], [13, 10], [3, 13], [9, 14]]) { p.set(x, y, hex(0xfff4d8)); p.set(x + 1, y, hex(0xfff4d8)); }
    for (const [x, y] of [[12, 5], [5, 11], [14, 14]]) p.set(x, y, hex(0xecd2a0));
  };
  T('sand', sandBase);
  T('sand_shells', (p) => { sandBase(p); p.dots(4, hex(0xfffaf0)); p.dots(3, hex(0xf2c0b0)); });
  T('grass_top', (p) => {
    p.speckle(hex(0x93d873), 0.04);
    const light = hex(0xb2ea8c), dark = hex(0x7cc662);
    for (const [x, y] of [[2, 2], [9, 1], [5, 6], [13, 6], [1, 10], [8, 11], [12, 13], [4, 14]]) {
      p.set(x, y, light); p.set(x + 1, y + 1, light); p.set(x + 2, y, light);   // a little "v" tuft
      p.set(x + 1, y + 2, dark);
    }
  });
  T('grass_side', (p) => {
    p.speckle(hex(0xb88d66), 0.05);
    for (const [x, y] of [[3, 9], [11, 11], [7, 13], [13, 7]]) { p.set(x, y, hex(0xa67a55)); p.set(x + 1, y, hex(0xa67a55)); }
    for (let x = 0; x < TS; x++) {
      const h = 3 + (x % 4 < 2 ? 1 : 0) + (x % 8 === 3 ? 1 : 0);      // scalloped grass edge
      for (let y = 0; y < h; y++) p.set(x, y, y === h - 1 ? hex(0x7cc662) : mul(hex(0x93d873), 0.98 + p.r() * 0.04));
      p.set(x, 0, hex(0xb2ea8c));
    }
  });
  T('dirt', (p) => {
    p.speckle(hex(0xb88d66), 0.05);
    for (const [x, y] of [[3, 3], [11, 5], [6, 10], [13, 12], [2, 13]]) { p.set(x, y, hex(0xa67a55)); p.set(x + 1, y, hex(0xa67a55)); p.set(x, y + 1, hex(0xc79d76)); }
  });
  T('stone', (p) => {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const patch = G.hash2(((x + ((y / 5) | 0) * 2) / 5) | 0, (y / 5) | 0, 13);
      p.set(x, y, mul(hex(0xb9bec8), 0.93 + patch * 0.12 + p.r() * 0.02));
    }
    for (const [x, y] of [[4, 4], [5, 5], [11, 9], [12, 10], [7, 13]]) p.set(x, y, hex(0x9da3ae));
  });
  T('sandstone', (p) => {
    p.speckle(hex(0xe8cc98), 0.04);
    for (let y = 3; y < TS; y += 5) for (let x = 0; x < TS; x++) if ((x + y) % 7 !== 0) p.set(x, y, hex(0xd4b57e));
  });
  T('clay', (p) => { p.speckle(hex(0xcfa9a0), 0.04); for (const [x, y] of [[3, 4], [10, 7], [6, 12], [13, 13]]) { p.set(x, y, hex(0xbd958c)); p.set(x + 1, y, hex(0xbd958c)); } });
  T('path', (p) => {
    p.speckle(hex(0xe6d5ac), 0.04);
    for (const [x, y] of [[2, 2], [9, 3], [5, 8], [12, 9], [2, 12], [9, 13]]) { p.rect(x, y, x + 2, y + 1, hex(0xd2be90)); p.set(x, y, hex(0xf3e6c4)); }
  });
  T('farmland', (p) => {
    p.speckle(hex(0x93694a), 0.05);
    for (let y = 2; y < TS; y += 4) for (let x = 0; x < TS; x++) p.set(x, y, mul(hex(0x75523a), 0.97 + p.r() * 0.06));
  });
  T('farmland_wet', (p) => {
    p.speckle(hex(0x6b4a33), 0.05);
    for (let y = 2; y < TS; y += 4) for (let x = 0; x < TS; x++) p.set(x, y, mul(hex(0x533826), 0.97 + p.r() * 0.06));
  });

  // ---------- Trees ----------
  T('log_side', (p) => {
    const base = hex(0xa67b52);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) p.set(x, y, mul(base, 0.93 + (x % 4 === 0 ? -0.1 : 0) + (x % 4 === 2 ? 0.06 : 0) + p.r() * 0.03));
    for (const [x, y] of [[5, 4], [11, 10]]) { p.rect(x, y, x + 1, y + 2, hex(0x8a6340)); p.set(x, y + 1, hex(0xc09868)); }
  });
  T('log_top', (p) => {
    const bark = hex(0xa67b52), wood = hex(0xe8c692);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const dx = x - 7.5, dy = y - 7.5, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d > 6.6) p.set(x, y, mul(bark, 0.94 + p.r() * 0.06));
      else p.set(x, y, mul(wood, Math.round(Math.sqrt(dx * dx + dy * dy)) % 3 === 0 ? 0.86 : 1));
    }
  });
  // leaf textures: rounded clusters with a highlight and a soft shadow
  function leafy(name, base, light, shade, fleck) {
    T(name, (p) => {
      p.speckle(hex(base), 0.035);
      for (const [x, y] of [[1, 1], [7, 0], [12, 2], [4, 5], [10, 6], [0, 9], [6, 10], [12, 11], [3, 13], [9, 14]]) {
        p.rect(x, y, x + 2, y + 1, hex(light)); p.set(x + 1, y - 1, hex(light));
        p.set(x + 1, y + 2, hex(shade)); p.set(x + 2, y + 2, hex(shade)); p.set(x + 3, y + 1, hex(shade));
      }
      if (fleck) for (const [x, y] of [[5, 2], [13, 7], [2, 11], [9, 12]]) p.set(x, y, hex(fleck));
    });
  }
  leafy('leaves', 0x70c25e, 0x92dc76, 0x58a84e, 0);
  leafy('leaves_pink', 0xf7b4cd, 0xffd6e4, 0xe795b6, 0xffffff);
  T('palm_side', (p) => {
    const base = hex(0xb8915f);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) p.set(x, y, mul(base, y % 4 === 0 ? 0.8 : y % 4 === 1 ? 1.06 : 0.97 + p.r() * 0.04));
  });
  T('palm_top', (p) => { p.speckle(hex(0xd6b684), 0.05); p.rect(0, 0, 15, 0, hex(0xb8915f)); p.rect(0, 15, 15, 15, hex(0xb8915f)); p.rect(0, 0, 0, 15, hex(0xb8915f)); p.rect(15, 0, 15, 15, hex(0xb8915f)); });
  T('palm_leaves', (p) => {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const k = (x + y) % 4;
      p.set(x, y, mul(hex(0x78cc7c), k === 0 ? 0.84 : k === 1 ? 1.08 : 0.98 + p.r() * 0.03));
    }
  });
  solid('coconut', 0x7a5236, 0.12);

  // ---------- Building materials ----------
  planks('planks', 0xc99a62);
  planks('drift_planks', 0xd9cdb8);
  planks('dark_planks', 0x7b5a40);
  planks('paint_white', 0xf4f1ea);
  planks('paint_red', 0xe07a6e);
  planks('paint_blue', 0x7fb4dd);
  planks('paint_yellow', 0xf2d272);
  planks('paint_green', 0x8fcf9a);
  planks('paint_pink', 0xf3b3c8);
  planks('paint_teal', 0x6fc7bf);
  bricks('stone_bricks', 0xb4b8be, 0x8f949b, 8, 8);
  bricks('bricks', 0xc9705c, 0xe6d8c4, 8, 4);
  bricks('sand_bricks', 0xe9d09c, 0xc9ad78, 8, 8);
  T('cobble', (p) => {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const cx = ((x + (((y / 4) | 0) % 2) * 2) / 4) | 0, cy = (y / 4) | 0;
      const f = 0.82 + G.hash2(cx, cy, 11) * 0.3;
      const edge = (y % 4 === 3) || ((x + (cy % 2) * 2) % 4 === 3);
      p.set(x, y, mul(hex(0xa3a7ad), edge ? 0.72 : f * (0.97 + p.r() * 0.06)));
    }
  });
  T('thatch', (p) => {
    const base = hex(0xdcc078);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      let f = 0.86 + G.hash2(x, (y / 5) | 0, 5) * 0.24 + (p.r() - 0.5) * 0.06;
      if (y % 5 === 4) f *= 0.8;
      p.set(x, y, mul(base, f));
    }
  });
  T('glass', (p) => {
    const frame = hex(0xe9f4f7);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      if (x === 0 || y === 0 || x === 15 || y === 15) p.set(x, y, frame);
      else p.set(x, y, [0, 0, 0], 0);
    }
    const streak = hex(0xffffff);
    p.set(3, 4, streak); p.set(4, 3, streak); p.set(5, 2, streak); p.set(4, 6, streak); p.set(5, 5, streak); p.set(6, 4, streak);
    p.set(10, 12, streak); p.set(11, 11, streak); p.set(12, 10, streak);
  });
  solid('plaster', 0xf6efe2, 0.04);
  shingles('roof_red', 0xd9695a);
  shingles('roof_blue', 0x5f93c9);
  shingles('roof_green', 0x6fb38a);
  T('bookshelf', (p) => {
    p.speckle(hex(0xc99a62), 0.06);
    const cols = [0xd9695a, 0x5f93c9, 0x6fb38a, 0xf2d272, 0xa77bc9, 0xf4f1ea];
    for (let shelf = 0; shelf < 2; shelf++) {
      const y0 = 1 + shelf * 8;
      p.rect(1, y0, 14, y0 + 5, hex(0x5b4030));
      for (let x = 1; x <= 14; x++) {
        const c = hex(cols[(p.r() * cols.length) | 0]);
        const top = y0 + ((p.r() * 2) | 0);
        for (let y = top; y <= y0 + 5; y++) p.set(x, y, mul(c, x % 2 ? 0.9 : 1));
      }
    }
  });
  T('crate', (p) => {
    p.speckle(hex(0xc9a36a), 0.08);
    const d = hex(0x9a7646);
    p.rect(0, 0, 15, 1, d); p.rect(0, 14, 15, 15, d); p.rect(0, 0, 1, 15, d); p.rect(14, 0, 15, 15, d);
    for (let i = 2; i < 14; i++) { p.set(i, i, d); p.set(i, 15 - i, d); }
  });
  T('workbench_top', (p) => {
    p.speckle(hex(0xd6a868), 0.06);
    const d = hex(0x8c6a44);
    p.rect(0, 0, 15, 0, d); p.rect(0, 15, 15, 15, d); p.rect(0, 0, 0, 15, d); p.rect(15, 0, 15, 15, d);
    p.rect(3, 3, 7, 4, hex(0x9aa0a8)); p.rect(4, 5, 5, 9, hex(0x7b5a40));   // hammer
    p.rect(10, 6, 11, 12, hex(0xc7ccd3));                                   // saw
  });
  T('workbench_side', (p) => {
    planksRows(p, hex(0xc99a62));
    p.rect(0, 0, 15, 2, hex(0xd6a868), 0.05);
    p.rect(2, 6, 6, 12, hex(0x7b5a40)); p.rect(9, 6, 13, 12, hex(0x7b5a40));
  });
  function planksRows(p, base) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) p.set(x, y, mul(base, y % 4 === 3 ? 0.74 : 0.95 + p.r() * 0.08));
  }
  T('chest_side', (p) => {
    planksRows(p, hex(0xb9854e));
    p.rect(0, 5, 15, 6, hex(0x6a4a30));
    p.rect(0, 0, 0, 15, hex(0x8a8f96)); p.rect(15, 0, 15, 15, hex(0x8a8f96));
  });
  T('chest_front', (p) => {
    planksRows(p, hex(0xb9854e));
    p.rect(0, 5, 15, 6, hex(0x6a4a30));
    p.rect(0, 0, 0, 15, hex(0x8a8f96)); p.rect(15, 0, 15, 15, hex(0x8a8f96));
    p.rect(6, 4, 9, 8, hex(0xf2d272)); p.rect(7, 6, 8, 7, hex(0x6a4a30));
  });
  T('chest_top', (p) => {
    planksRows(p, hex(0xc4915a));
    p.rect(0, 0, 15, 0, hex(0x8a8f96)); p.rect(0, 15, 15, 15, hex(0x8a8f96)); p.rect(0, 0, 0, 15, hex(0x8a8f96)); p.rect(15, 0, 15, 15, hex(0x8a8f96));
  });
  T('door', (p) => {
    planksRows(p, hex(0xb88654));
    for (let y = 0; y < TS; y++) { p.set(0, y, hex(0x8a6038)); p.set(15, y, hex(0x8a6038)); }
    p.rect(3, 3, 12, 12, hex(0xa87747), 0.05);
  });
  T('door_window', (p) => {
    planksRows(p, hex(0xb88654));
    for (let y = 0; y < TS; y++) { p.set(0, y, hex(0x8a6038)); p.set(15, y, hex(0x8a6038)); }
    p.rect(4, 4, 11, 11, hex(0xbfe6f2)); p.rect(7, 4, 8, 11, hex(0xb88654)); p.rect(4, 7, 11, 8, hex(0xb88654));
  });

  // ---------- Plain materials for furniture ----------
  solid('wood', 0xc99a62, 0.07);
  solid('wood_dark', 0x7b5a40, 0.07);
  solid('wood_light', 0xe6cfa6, 0.06);
  solid('wood_white', 0xf4f1ea, 0.04);
  solid('iron', 0x5f6670, 0.06);
  solid('gold', 0xf2c94c, 0.06);
  solid('rope', 0xcbb489, 0.1);
  solid('cloth_white', 0xfaf7f0, 0.03);
  solid('cloth_red', 0xe0766a, 0.04);
  solid('cloth_blue', 0x79aede, 0.04);
  solid('cloth_yellow', 0xf4d674, 0.04);
  solid('cloth_green', 0x86c996, 0.04);
  solid('cloth_pink', 0xf5b5ca, 0.04);
  solid('cloth_teal', 0x6cc5bd, 0.04);
  solid('cloth_purple', 0xb394d6, 0.04);
  T('cloth_stripe', (p) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) p.set(x, y, ((x / 4) | 0) % 2 ? hex(0xfaf7f0) : hex(0xe0766a)); });
  T('cloth_stripe_blue', (p) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) p.set(x, y, ((x / 4) | 0) % 2 ? hex(0xfaf7f0) : hex(0x79aede)); });
  T('rug_weave', (p) => {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const border = x < 2 || y < 2 || x > 13 || y > 13;
      const diamond = Math.abs(x - 7.5) + Math.abs(y - 7.5) < 4;
      p.set(x, y, border ? hex(0xf4d674) : diamond ? hex(0xfaf7f0) : hex(0xe0766a));
    }
  });
  T('rug_sea', (p) => {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const border = x < 2 || y < 2 || x > 13 || y > 13;
      const wave = ((y + Math.round(Math.sin(x * 0.8) * 1.5)) % 4) === 0;
      p.set(x, y, border ? hex(0xfaf7f0) : wave ? hex(0xcfeaf6) : hex(0x6cc5bd));
    }
  });
  solid('lamp_glow', 0xfff0b8, 0.03);
  solid('ember', 0xff8a3c, 0.2);
  solid('ash', 0x5a5450, 0.12);
  solid('terracotta', 0xc9785a, 0.06);
  solid('aqua', 0x8fd8ee, 0.05);
  solid('shell_pink', 0xf9c5cf, 0.07);
  solid('shell_white', 0xfdf8ee, 0.05);
  solid('shell_orange', 0xf6b27a, 0.08);
  solid('shell_purple', 0xc7a6e2, 0.07);
  solid('shell_blue', 0x9fc6ee, 0.07);
  solid('starfish', 0xf58a6a, 0.08);
  solid('pearl', 0xfbfbff, 0.02);
  solid('bottle', 0xa6e3c9, 0.05);
  solid('leaf', 0x5fae5a, 0.12);
  T('painting_sea', (p) => {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      let c = y < 8 ? hex(0xbfe6f2) : hex(0x5fa8d6);
      if (y >= 11) c = hex(0xf3ddb0);
      p.set(x, y, c);
    }
    p.rect(11, 2, 13, 4, hex(0xffe08a)); p.rect(3, 9, 6, 9, hex(0xffffff));
    p.rect(0, 0, 15, 0, hex(0x7b5a40)); p.rect(0, 15, 15, 15, hex(0x7b5a40)); p.rect(0, 0, 0, 15, hex(0x7b5a40)); p.rect(15, 0, 15, 15, hex(0x7b5a40));
  });
  T('painting_palm', (p) => {
    p.rect(0, 0, 15, 15, hex(0xffe3c2));
    p.rect(7, 5, 8, 13, hex(0xb08a5e));
    p.rect(3, 4, 12, 5, hex(0x5fae5a)); p.rect(5, 3, 10, 3, hex(0x5fae5a)); p.rect(2, 6, 4, 6, hex(0x5fae5a)); p.rect(11, 6, 13, 6, hex(0x5fae5a));
    p.rect(1, 13, 14, 14, hex(0xf3ddb0));
    p.rect(0, 0, 15, 0, hex(0xf4f1ea)); p.rect(0, 15, 15, 15, hex(0xf4f1ea)); p.rect(0, 0, 0, 15, hex(0xf4f1ea)); p.rect(15, 0, 15, 15, hex(0xf4f1ea));
  });
  T('clock_face', (p) => {
    p.rect(0, 0, 15, 15, hex(0x7b5a40));
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) if (Math.hypot(x - 7.5, y - 7.5) < 6) p.set(x, y, hex(0xfaf7f0));
    p.rect(7, 4, 7, 8, hex(0x40362e)); p.rect(8, 8, 10, 8, hex(0x40362e));
  });
  T('sign_face', (p) => {
    planksRows(p, hex(0xd9b27c));
    p.rect(3, 4, 12, 4, hex(0x6a4a30)); p.rect(3, 7, 10, 7, hex(0x6a4a30)); p.rect(3, 10, 11, 10, hex(0x6a4a30));
  });

  // ---------- Cross-shaped plants (transparent background) ----------
  function clear(p) { for (let i = 0; i < p.d.length; i++) p.d[i] = 0; }
  function flower(name, petal, center) {
    T(name, (p) => {
      clear(p);
      const g = hex(0x4f9a4c), g2 = hex(0x6cba60);
      for (let y = 7; y < 16; y++) p.set(7 + (y > 11 ? 1 : 0), y, g);
      p.set(5, 12, g2); p.set(6, 12, g2); p.set(6, 11, g2); p.set(9, 10, g2); p.set(10, 10, g2); p.set(10, 9, g2);
      const pc = hex(petal);
      for (let y = 1; y <= 7; y++) for (let x = 4; x <= 10; x++) {
        const d = Math.abs(x - 7) + Math.abs(y - 4);
        if (d <= 3 && !(Math.abs(x - 7) === 3 || Math.abs(y - 4) === 3) || (d === 3 && (x === 7 || y === 4))) p.set(x, y, mul(pc, 0.92 + p.r() * 0.14));
      }
      p.rect(6, 3, 8, 5, hex(center));
    });
  }
  flower('flower_red', 0xf06a6a, 0xffe08a);
  flower('flower_yellow', 0xffd84a, 0xf59a3c);
  flower('flower_blue', 0x7fa8f5, 0xfff3c2);
  flower('flower_white', 0xffffff, 0xffd84a);
  flower('flower_pink', 0xf7a3c8, 0xfff3c2);
  flower('flower_purple', 0xb58be8, 0xfff3c2);
  T('tall_grass', (p) => {
    clear(p);
    for (let x = 1; x < 15; x++) {
      if (p.r() < 0.3) continue;
      const h = 4 + ((p.r() * 8) | 0);
      const c = mul(hex(0x7cc468), 0.85 + p.r() * 0.3);
      for (let y = 15; y > 15 - h; y--) p.set(x + ((15 - y) > h * 0.6 ? ((x % 2) ? 1 : -1) : 0), y, c);
    }
  });
  T('fern', (p) => {
    clear(p);
    const c = hex(0x4fa35c);
    for (let i = 0; i < 5; i++) {
      const dir = (i - 2) * 0.55;
      for (let t = 0; t < 9; t++) {
        const x = Math.round(7.5 + Math.sin(dir) * t * 0.9), y = Math.round(15 - Math.cos(dir) * t - (t * t) * 0.02);
        p.set(x, y, mul(c, 0.85 + p.r() * 0.3));
        if (t % 2 === 0 && t > 1) { p.set(x - 1, y, mul(c, 1.1)); p.set(x + 1, y, mul(c, 1.1)); }
      }
    }
  });
  function sapling(name, leaf, trunk) {
    T(name, (p) => {
      clear(p);
      p.rect(7, 8, 8, 15, hex(trunk));
      for (let y = 1; y < 10; y++) for (let x = 2; x < 14; x++) if (Math.hypot(x - 7.5, y - 5) < 4.3 + p.r() * 0.8) p.set(x, y, mul(hex(leaf), 0.85 + p.r() * 0.3));
    });
  }
  sapling('sapling', 0x5fae5a, 0x9a6f4a);
  sapling('sapling_pink', 0xf5a9c4, 0x9a6f4a);
  T('palm_sapling', (p) => {
    clear(p);
    p.rect(7, 9, 8, 15, hex(0xb08a5e));
    const c = hex(0x6cc070);
    for (let t = 0; t < 7; t++) { p.set(7 - t, 8 - Math.round(Math.sin(t * 0.5) * 3) + (t > 4 ? t - 4 : 0), c); p.set(8 + t, 8 - Math.round(Math.sin(t * 0.5) * 3) + (t > 4 ? t - 4 : 0), c); }
    p.rect(7, 3, 8, 8, c);
  });
  function bush(name, berry) {
    T(name, (p) => {
      clear(p);
      for (let y = 2; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (Math.hypot((x - 7.5) * 0.95, (y - 9.5) * 1.15) < 7 + p.r() * 0.8) p.set(x, y, mul(hex(0x4f9e58), 0.82 + p.r() * 0.34));
      }
      if (berry) for (let i = 0; i < 7; i++) {
        const x = 3 + ((p.r() * 10) | 0), y = 5 + ((p.r() * 8) | 0);
        p.set(x, y, hex(berry)); p.set(x + 1, y, mul(hex(berry), 0.85)); p.set(x, y + 1, mul(hex(berry), 0.85));
      }
    });
  }
  bush('bush', 0);
  bush('bush_berries', 0xe0507a);
  T('seaweed', (p) => {
    clear(p);
    for (const sx of [4, 8, 12]) {
      const h = 9 + ((p.r() * 6) | 0);
      for (let t = 0; t < h; t++) {
        const x = sx + Math.round(Math.sin(t * 0.9 + sx) * 1.2);
        p.set(x, 15 - t, mul(hex(0x3f9d78), 0.85 + p.r() * 0.3)); p.set(x + 1, 15 - t, mul(hex(0x58b88c), 0.9 + p.r() * 0.2));
      }
    }
  });
  function coral(name, color) {
    T(name, (p) => {
      clear(p);
      const c = hex(color);
      const branch = (x, y, dx, len) => {
        for (let t = 0; t < len; t++) {
          p.set(Math.round(x), Math.round(y), mul(c, 0.88 + p.r() * 0.24)); p.set(Math.round(x) + 1, Math.round(y), mul(c, 0.8));
          y -= 1; x += dx * (p.r() * 0.9);
          if (t > 2 && p.r() < 0.28 && len - t > 3) branch(x, y, -dx || 1, len - t - 1);
        }
      };
      branch(7, 15, -1, 11); branch(8, 15, 1, 12); branch(7, 15, 0.2, 13);
    });
  }
  coral('coral_pink', 0xf58aa8);
  coral('coral_orange', 0xf7a35c);
  coral('coral_purple', 0xb58be8);
  function crop(name, stage, fruit) {
    T(name, (p) => {
      clear(p);
      const h = 3 + stage * 3;
      for (const sx of [3, 7, 11]) {
        for (let t = 0; t < h; t++) p.set(sx + (t % 3 === 2 ? 1 : 0), 15 - t, mul(hex(0x5fb85a), 0.85 + p.r() * 0.3));
        if (stage > 0) { p.set(sx - 1, 15 - h + 2, hex(0x7cd070)); p.set(sx + 2, 15 - h + 3, hex(0x7cd070)); }
        if (stage === 3 && fruit) { p.rect(sx, 15 - h - 1, sx + 1, 15 - h, hex(fruit)); }
      }
    });
  }
  for (let s = 0; s < 4; s++) { crop('crop_melon_' + s, s, 0xf06a8a); crop('crop_corn_' + s, s, 0xffd84a); crop('crop_carrot_' + s, s, 0xf59a3c); }
  T('mushroom', (p) => {
    clear(p);
    p.rect(7, 10, 8, 15, hex(0xf4ecd8));
    for (let y = 5; y < 11; y++) for (let x = 3; x < 13; x++) if (Math.hypot(x - 7.5, (y - 10) * 1.3) < 5) p.set(x, y, hex(0xe0625a));
    p.set(5, 8, hex(0xffffff)); p.set(9, 7, hex(0xffffff)); p.set(7, 9, hex(0xffffff));
  });

  // ---------- Later additions (always append below this line) ----------
  solid('plaster_pink', 0xf7cfd8, 0.04);
  solid('plaster_blue', 0xc5dff2, 0.04);
  solid('plaster_yellow', 0xf8e7a8, 0.04);
  solid('plaster_mint', 0xc9ecd6, 0.04);
  T('tile_white', (p) => {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) p.set(x, y, mul(hex(0xf4f6f6), (x % 8 === 7 || y % 8 === 7) ? 0.84 : 0.97 + p.r() * 0.05));
  });
  T('tile_checker', (p) => {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) p.set(x, y, mul(hex((((x / 8) | 0) + ((y / 8) | 0)) % 2 ? 0xf4f6f6 : 0x7fb4dd), 0.96 + p.r() * 0.06));
  });
  T('tile_terracotta', (p) => {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) p.set(x, y, mul(hex(0xd98a66), (x % 8 === 7 || y % 8 === 7) ? 0.78 : 0.93 + G.hash2((x / 8) | 0, (y / 8) | 0, 3) * 0.14 + p.r() * 0.04));
  });
  T('bamboo', (p) => {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      let f = 0.92 + ((x % 4) === 1 ? 0.12 : 0) + p.r() * 0.05;
      if (x % 4 === 3) f = 0.7;
      if ((y + ((x / 4) | 0) * 3) % 8 === 0) f *= 0.82;
      p.set(x, y, mul(hex(0xc9d27e), f));
    }
  });
  solid('porcelain', 0xfbfcfd, 0.02);
  solid('water_tile', 0x9fdcf0, 0.05);
  solid('black', 0x3a3a40, 0.06);
  solid('fruit_apple', 0xe8544c, 0.05);
  solid('fruit_orange', 0xffa63c, 0.05);
  solid('fruit_peach', 0xffbfa6, 0.05);
  solid('fruit_cherry', 0xd9334f, 0.05);
  // neutral ground detail: the smooth terrain tints this with blended colours, so grass, sand and
  // stone melt into one another instead of meeting along square edges
  T('ground', (p) => {
    p.speckle(hex(0xf6f6f6), 0.035);
    for (const [x, y] of [[2, 2], [9, 1], [5, 6], [13, 6], [1, 10], [8, 11], [12, 13], [4, 14]]) {
      p.set(x, y, hex(0xffffff)); p.set(x + 1, y + 1, hex(0xffffff)); p.set(x + 2, y, hex(0xffffff));
      p.set(x + 1, y + 2, hex(0xe4e4e4));
    }
  });

  solid('star_gold', 0xffe27a, 0.04);

  // ---------- Build the atlas ----------
  G.buildAtlas = function () {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS; canvas.height = ATLAS;
    const ctx = canvas.getContext('2d');
    defs.forEach((def, i) => {
      const p = new Painter(1000 + i * 37);
      def.draw(p);
      const img = new ImageData(p.d, TS, TS);
      ctx.putImageData(img, (i % PER_ROW) * TS, ((i / PER_ROW) | 0) * TS);
      let r = 0, g = 0, b = 0, n = 0;
      for (let k = 0; k < p.d.length; k += 4) if (p.d[k + 3] > 0) { r += p.d[k]; g += p.d[k + 1]; b += p.d[k + 2]; n++; }
      n = n || 1;
      G.TILE_COLORS[def.name] = 'rgb(' + ((r / n) | 0) + ',' + ((g / n) | 0) + ',' + ((b / n) | 0) + ')';
    });
    G.atlasCanvas = canvas;
    // The world uses a smooth, 4x upscaled copy of the atlas: each tile is enlarged on its own (so
    // nothing bleeds between neighbours) with soft filtering, which turns the pixel art into gentle
    // painted-looking surfaces instead of hard pixels.
    const UP = 4, hi = document.createElement('canvas');
    hi.width = hi.height = ATLAS * UP;
    const hctx = hi.getContext('2d');
    hctx.imageSmoothingEnabled = true; hctx.imageSmoothingQuality = 'high';
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = TS;
    const tctx = tmp.getContext('2d');
    defs.forEach((def, i) => {
      const sx = (i % PER_ROW) * TS, sy = ((i / PER_ROW) | 0) * TS;
      tctx.clearRect(0, 0, TS, TS);
      tctx.drawImage(canvas, sx, sy, TS, TS, 0, 0, TS, TS);
      hctx.drawImage(tmp, 0, 0, TS, TS, sx * UP, sy * UP, TS * UP, TS * UP);
    });
    G.atlasCanvasHi = hi;
    const tex = new THREE.CanvasTexture(hi);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    G.atlasTexture = tex;
    return tex;
  };

  // UV rectangle of a tile sub-region (pixel coords inside the tile, y measured from the top)
  G.tileUV = function (tileIndex, px0, py0, px1, py1) {
    const tx = (tileIndex % PER_ROW) * TS, ty = ((tileIndex / PER_ROW) | 0) * TS;
    const e = 0.02;
    return {
      u0: (tx + px0 + e) / ATLAS, u1: (tx + px1 - e) / ATLAS,
      v0: 1 - (ty + py1 - e) / ATLAS, v1: 1 - (ty + py0 + e) / ATLAS,
    };
  };
  G.TILE_PX = TS;
  G.ATLAS_PER_ROW = PER_ROW;
})();
