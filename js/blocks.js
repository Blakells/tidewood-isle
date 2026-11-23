// Tidewood Isle — block definitions (cubes, cross plants, and box-model furniture).
'use strict';
(function () {
  G.BLOCKS = [null];   // id -> def (0 = air)
  G.B = { air: 0 };    // key -> id
  G.BLOCK_BY_KEY = {};

  // Direction the "front" of a box model faces for each rotation value.
  G.FRONT = [[0, 1], [-1, 0], [0, -1], [1, 0]];

  const tileOf = (name) => {
    const t = G.TILES[name];
    if (t === undefined) { console.warn('Missing tile', name); return 0; }
    return t;
  };

  function normBoxes(list) {
    if (!list) return null;
    return list.map((b) => {
      const t = b[6];
      const tiles = typeof t === 'string' ? { side: t } : t;
      return {
        b: b.slice(0, 6),
        side: tileOf(tiles.side),
        top: tileOf(tiles.top || tiles.side),
        bottom: tileOf(tiles.bottom || tiles.top || tiles.side),
        front: tileOf(tiles.front || tiles.side),
      };
    });
  }

  // o: { label, shape, tiles, boxes, boxesOn, col, hp, tool, drops, light, icon, use, place, extra, pick, ... }
  function B(key, o) {
    const def = Object.assign({
      key, id: G.BLOCKS.length, label: key, shape: 'cube', hp: 2, tool: null,
      solid: true, opaque: true, item: true, stack: 99,
    }, o);
    if (def.shape === 'cube') {
      const t = typeof def.tiles === 'string' ? { side: def.tiles } : def.tiles;
      const side = tileOf(t.side), top = tileOf(t.top || t.side), bottom = tileOf(t.bottom || t.top || t.side);
      def.faces = [side, side, top, bottom, side, side];
      def.iconTiles = { top: t.top || t.side, side: t.side };
      if (def.transparent) def.opaque = false;
      if (def.col === undefined) def.col = def.solid ? [[0, 0, 0, 1, 1, 1]] : null;
    } else if (def.shape === 'cross') {
      def.opaque = false;
      def.solid = false;
      def.col = null;
      def.tile = tileOf(def.tiles);
      if (def.stageTiles) def.stageTileIds = def.stageTiles.map(tileOf);
      if (!def.pick) def.pick = [3, 0, 3, 13, 13, 13];
      def.iconTile = def.stageTiles ? def.stageTiles[def.stageTiles.length - 1] : def.tiles;
    } else if (def.shape === 'boxes') {
      def.opaque = false;
      def.boxes = normBoxes(def.boxes);
      def.boxesOn = normBoxes(def.boxesOn);
      if (def.col === undefined) {
        // default collision: bounding box of the model clipped to something sensible
        if (def.solid) {
          let x0 = 16, y0 = 16, z0 = 16, x1 = 0, y1 = 0, z1 = 0;
          for (const bx of def.boxes) {
            x0 = Math.min(x0, bx.b[0]); y0 = Math.min(y0, bx.b[1]); z0 = Math.min(z0, bx.b[2]);
            x1 = Math.max(x1, bx.b[3]); y1 = Math.max(y1, bx.b[4]); z1 = Math.max(z1, bx.b[5]);
          }
          def.col = [[x0 / 16, y0 / 16, z0 / 16, x1 / 16, y1 / 16, z1 / 16]];
        } else def.col = null;
      }
      if (!def.pick) {
        let x0 = 16, y0 = 16, z0 = 16, x1 = 0, y1 = 0, z1 = 0;
        for (const bx of def.boxes) {
          x0 = Math.min(x0, bx.b[0]); y0 = Math.min(y0, bx.b[1]); z0 = Math.min(z0, bx.b[2]);
          x1 = Math.max(x1, bx.b[3]); y1 = Math.max(y1, bx.b[4]); z1 = Math.max(z1, bx.b[5]);
        }
        // keep tiny things easy to click
        const grow = (a, b2) => { const m = 5 - (b2 - a) / 2; return m > 0 ? m : 0; };
        const gx = grow(x0, x1), gz = grow(z0, z1), gy = Math.max(0, 5 - (y1 - y0));
        def.pick = [x0 - gx, y0, z0 - gz, x1 + gx, y1 + gy, z1 + gz];
      }
    } else if (def.shape === 'none') {
      def.opaque = false; def.solid = false; def.col = null; def.item = false;
    }
    G.BLOCKS.push(def);
    G.B[key] = def.id;
    G.BLOCK_BY_KEY[key] = def;
    return def;
  }

  // =============== Terrain ===============
  B('sand', { label: 'Sand', tiles: 'sand', hp: 2, tool: 'shovel', cat: 'nature' });
  B('grass', { label: 'Grass', tiles: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, hp: 2, tool: 'shovel', drops: [{ id: 'dirt', n: 1 }], cat: 'nature' });
  B('dirt', { label: 'Dirt', tiles: 'dirt', hp: 2, tool: 'shovel', cat: 'nature' });
  B('stone', { label: 'Stone', tiles: 'stone', hp: 6, tool: 'pick', cat: 'nature' });
  B('sandstone', { label: 'Sandstone', tiles: 'sandstone', hp: 5, tool: 'pick', cat: 'nature' });
  B('clay', { label: 'Clay', tiles: 'clay', hp: 3, tool: 'shovel', cat: 'nature' });
  B('log', { label: 'Tidewood Log', tiles: { top: 'log_top', side: 'log_side' }, hp: 5, tool: 'axe', cat: 'nature', transparent: true, tree: 'trunk' });
  B('leaves', { label: 'Leaves', tiles: 'leaves', hp: 1, transparent: true, tree: 'leaf', drops: [{ id: 'sapling', n: 1, chance: 0.12 }, { id: 'stick', n: 1, chance: 0.2 }], cat: 'nature' });
  B('palm_log', { label: 'Palm Log', tiles: { top: 'palm_top', side: 'palm_side' }, hp: 5, tool: 'axe', cat: 'nature', transparent: true, tree: 'trunk' });
  B('palm_leaves', { label: 'Palm Fronds', tiles: 'palm_leaves', hp: 1, transparent: true, tree: 'leaf', drops: [{ id: 'fiber', n: 1, chance: 0.6 }, { id: 'palm_sapling', n: 1, chance: 0.1 }], cat: 'nature' });
  B('blossom_leaves', { label: 'Blossom Leaves', tiles: 'leaves_pink', hp: 1, transparent: true, tree: 'leaf', drops: [{ id: 'sapling_pink', n: 1, chance: 0.14 }, { id: 'stick', n: 1, chance: 0.2 }], cat: 'nature' });
  B('path', { label: 'Sandy Path', tiles: { top: 'path', side: 'dirt', bottom: 'dirt' }, hp: 2, tool: 'shovel', cat: 'build' });
  B('farmland', { label: 'Garden Soil', tiles: { top: 'farmland', side: 'dirt', bottom: 'dirt' }, hp: 2, tool: 'shovel', drops: [{ id: 'dirt', n: 1 }], cat: 'nature' });

  // =============== Building blocks ===============
  const build = (key, label, tiles, extra) => B(key, Object.assign({ label, tiles, hp: 3, cat: 'build' }, extra));
  build('planks', 'Planks', 'planks', { tool: 'axe' });
  build('drift_planks', 'Driftwood Planks', 'drift_planks', { tool: 'axe' });
  build('dark_planks', 'Dark Planks', 'dark_planks', { tool: 'axe' });
  build('paint_white', 'White Boards', 'paint_white', { tool: 'axe' });
  build('paint_red', 'Coral Boards', 'paint_red', { tool: 'axe' });
  build('paint_blue', 'Sky Boards', 'paint_blue', { tool: 'axe' });
  build('paint_yellow', 'Sunny Boards', 'paint_yellow', { tool: 'axe' });
  build('paint_green', 'Mint Boards', 'paint_green', { tool: 'axe' });
  build('paint_pink', 'Blossom Boards', 'paint_pink', { tool: 'axe' });
  build('paint_teal', 'Lagoon Boards', 'paint_teal', { tool: 'axe' });
  build('stone_bricks', 'Stone Bricks', 'stone_bricks', { tool: 'pick', hp: 5 });
  build('cobble', 'Cobblestone', 'cobble', { tool: 'pick', hp: 5 });
  build('bricks', 'Clay Bricks', 'bricks', { tool: 'pick', hp: 5 });
  build('sand_bricks', 'Sand Bricks', 'sand_bricks', { tool: 'pick', hp: 4 });
  build('thatch', 'Thatch', 'thatch', { hp: 2 });
  build('plaster', 'Plaster', 'plaster', { tool: 'pick' });
  build('roof_red', 'Red Shingles', 'roof_red', { tool: 'pick' });
  build('roof_blue', 'Blue Shingles', 'roof_blue', { tool: 'pick' });
  build('roof_green', 'Green Shingles', 'roof_green', { tool: 'pick' });
  build('glass', 'Glass Block', 'glass', { transparent: true, hp: 1 });
  build('bookshelf', 'Bookshelf', { side: 'bookshelf', top: 'planks' }, { tool: 'axe', cat: 'furniture' });
  build('crate', 'Crate', 'crate', { tool: 'axe', cat: 'furniture' });
  B('workbench', { label: 'Workbench', tiles: { top: 'workbench_top', side: 'workbench_side', bottom: 'planks' }, hp: 3, tool: 'axe', use: 'workbench', cat: 'furniture' });

  // Slabs & stairs for a handful of materials
  function slabAndStairs(base, label, tile, tool) {
    B(base + '_slab', { label: label + ' Slab', shape: 'boxes', boxes: [[0, 0, 0, 16, 8, 16, tile]], hp: 2, tool, cat: 'build', iconCube: tile });
    B(base + '_stairs', {
      label: label + ' Stairs', shape: 'boxes', hp: 2, tool, cat: 'build', rot: true, rotFlip: true, iconCube: tile,
      boxes: [[0, 0, 0, 16, 8, 16, tile], [0, 8, 0, 16, 16, 8, tile]],
      col: [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 1, 1, 0.5]],
    });
  }
  slabAndStairs('planks', 'Plank', 'planks', 'axe');
  slabAndStairs('drift', 'Driftwood', 'drift_planks', 'axe');
  slabAndStairs('thatch', 'Thatch', 'thatch', null);
  slabAndStairs('stone', 'Stone Brick', 'stone_bricks', 'pick');
  slabAndStairs('roof_red', 'Red Shingle', 'roof_red', 'pick');
  slabAndStairs('roof_blue', 'Blue Shingle', 'roof_blue', 'pick');

  // =============== Plants ===============
  const plant = (key, label, tile, extra) => B(key, Object.assign({ label, shape: 'cross', tiles: tile, hp: 1, cat: 'nature', place: 'soil' }, extra));
  plant('flower_red', 'Red Poppy', 'flower_red');
  plant('flower_yellow', 'Sunbloom', 'flower_yellow');
  plant('flower_blue', 'Bluebell', 'flower_blue');
  plant('flower_white', 'Daisy', 'flower_white');
  plant('flower_pink', 'Pink Cosmos', 'flower_pink');
  plant('flower_purple', 'Sea Lavender', 'flower_purple');
  plant('tall_grass', 'Tall Grass', 'tall_grass', { drops: [{ id: 'fiber', n: 1, chance: 0.7 }, { id: 'seed_carrot', n: 1, chance: 0.06 }, { id: 'seed_corn', n: 1, chance: 0.05 }, { id: 'seed_melon', n: 1, chance: 0.04 }], item: false });
  plant('fern', 'Fern', 'fern', { drops: [{ id: 'fiber', n: 1, chance: 0.8 }] });
  plant('mushroom', 'Mushroom', 'mushroom', { pick: [3, 0, 3, 13, 11, 13] });
  plant('sapling', 'Tidewood Sapling', 'sapling', { grows: 'tree' });
  plant('sapling_pink', 'Blossom Sapling', 'sapling_pink', { grows: 'blossom' });
  plant('palm_sapling', 'Palm Sprout', 'palm_sapling', { grows: 'palm', place: 'sand' });
  plant('seaweed', 'Seaweed', 'seaweed', { place: 'any', drops: [{ id: 'fiber', n: 1 }] });
  plant('coral_pink', 'Pink Coral', 'coral_pink', { place: 'any' });
  plant('coral_orange', 'Sunset Coral', 'coral_orange', { place: 'any' });
  plant('coral_purple', 'Violet Coral', 'coral_purple', { place: 'any' });
  // crops: growth stage lives in meta bits 3-4
  const crop = (key, label, produce, seed) => B(key, {
    label, shape: 'cross', tiles: key + '_0', stageTiles: [0, 1, 2, 3].map((s) => key + '_' + s),
    hp: 1, item: false, crop: { produce, seed }, place: 'farmland', pick: [1, 0, 1, 15, 12, 15],
  });
  crop('crop_carrot', 'Carrots', 'carrot', 'seed_carrot');
  crop('crop_corn', 'Corn', 'corn', 'seed_corn');
  crop('crop_melon', 'Melon', 'melon', 'seed_melon');

  B('berry_bush', {
    label: 'Berry Bush', shape: 'boxes', hp: 2, solid: false, use: 'bush', cat: 'nature', place: 'soil',
    boxes: [[1, 0, 1, 15, 12, 15, 'bush']], boxesOn: [[1, 0, 1, 15, 12, 15, 'bush_berries']], icon: '🫐',
  });

  // =============== Beach finds (small box models, picked up with a click) ===============
  const find = (key, label, boxes, extra) => B(key, Object.assign({
    label, shape: 'boxes', boxes, hp: 1, solid: false, instant: true, cat: 'find', pick: [2, 0, 2, 14, 8, 14],
  }, extra));
  find('shell_cockle', 'Rosy Cockle', [[5, 0, 5, 11, 2, 11, 'shell_pink'], [6, 2, 6, 10, 3, 10, 'shell_pink'], [7, 0, 11, 9, 1, 12, 'shell_white']], { icon: '🐚', shell: true, value: 8 });
  find('shell_scallop', 'Sunrise Scallop', [[4, 0, 5, 12, 2, 11, 'shell_orange'], [5, 2, 6, 11, 3, 10, 'shell_white'], [7, 0, 11, 9, 2, 13, 'shell_orange']], { icon: '🦪', shell: true, value: 12 });
  find('shell_conch', 'Pearly Conch', [[5, 0, 4, 11, 4, 10, 'shell_white'], [6, 4, 5, 10, 6, 9, 'shell_pink'], [7, 6, 6, 9, 7, 8, 'shell_pink'], [7, 0, 10, 9, 2, 13, 'shell_pink']], { icon: '🐚', shell: true, value: 25 });
  find('shell_whelk', 'Violet Whelk', [[6, 0, 3, 10, 3, 9, 'shell_purple'], [6.5, 3, 4, 9.5, 5, 8, 'shell_purple'], [7, 0, 9, 9, 2, 13, 'shell_white']], { icon: '🐚', shell: true, value: 35 });
  find('starfish', 'Starfish', [[6, 0, 1, 10, 1.5, 15, 'starfish'], [1, 0, 6, 15, 1.5, 10, 'starfish'], [5, 0, 5, 11, 2.5, 11, 'starfish']], { icon: '⭐', shell: true, value: 18 });
  find('sand_dollar', 'Sand Dollar', [[4, 0, 4, 12, 1, 12, 'shell_white'], [5, 0, 3, 11, 1, 13, 'shell_white'], [3, 0, 5, 13, 1, 11, 'shell_white']], { icon: '⚪', shell: true, value: 20 });
  find('shell_nautilus', 'Moonlit Nautilus', [[4, 0, 4, 12, 6, 10, 'shell_blue'], [5, 6, 5, 11, 8, 9, 'shell_white'], [6, 0, 10, 10, 3, 13, 'shell_white']], { icon: '🐚', shell: true, value: 80 });
  find('pearl_oyster', 'Pearl Oyster', [[4, 0, 4, 12, 2, 12, 'shell_purple'], [4, 2, 4, 12, 3, 6, 'shell_purple'], [7, 2, 7, 9, 4, 9, 'pearl']], { icon: '🦪', shell: true, value: 120 });
  find('bottle', 'Message in a Bottle', [[6, 0, 4, 10, 4, 11, 'bottle'], [7, 1, 11, 9, 3, 13, 'bottle'], [7.3, 1.3, 13, 8.7, 2.7, 14, 'rope']], { icon: '🍾', drops: [] });
  find('driftwood', 'Driftwood', [[1, 0, 6, 15, 3, 10, 'wood_light'], [9, 0, 3, 11, 2, 6, 'wood_light']], { icon: '🪵', rot: true });
  find('coconut', 'Coconut', [[5, 0, 5, 11, 6, 11, 'coconut']], { icon: '🥥', food: 1 });
  find('pebble', 'Pebble', [[4, 0, 5, 11, 4, 11, 'stone'], [9, 0, 8, 13, 3, 12, 'stone']], { icon: '🪨', drops: [{ id: 'stone', n: 1 }], item: false });

  // =============== Furniture & fixtures ===============
  const furn = (key, label, icon, boxes, extra) => B(key, Object.assign({
    label, icon, shape: 'boxes', boxes, hp: 2, rot: true, cat: 'furniture', tool: 'axe',
  }, extra));

  furn('door', 'Wooden Door', '🚪', [[0, 0, 6.5, 16, 16, 9.5, 'door'], [0, 16, 6.5, 16, 32, 9.5, 'door_window']], {
    boxesOn: [[0, 0, 0, 3, 16, 16, 'door'], [0, 16, 0, 3, 32, 16, 'door_window']],
    col: [[0, 0, 6.5 / 16, 1, 2, 9.5 / 16]], colOn: null, use: 'door', extra: [[0, 1, 0]],
    pick: [0, 0, 5, 16, 16, 11],
  });
  furn('window', 'Window', '🪟', [[0, 0, 7, 16, 16, 9, 'glass']], { hp: 1, tool: null });
  furn('fence', 'Fence', '🚧', [[6, 0, 6, 10, 14, 10, 'wood']], { connect: true, rot: false, col: [[0.375, 0, 0.375, 0.625, 1.4, 0.625]] });
  furn('chair', 'Wooden Chair', '🪑', [
    [3, 6, 3, 13, 8, 13, 'wood'], [3, 0, 3, 5, 6, 5, 'wood_dark'], [11, 0, 3, 13, 6, 5, 'wood_dark'],
    [3, 0, 11, 5, 6, 13, 'wood_dark'], [11, 0, 11, 13, 6, 13, 'wood_dark'], [3, 8, 3, 13, 17, 5, 'wood'],
  ], { use: 'sit', sitY: 0.5, col: [[0.19, 0, 0.19, 0.81, 0.5, 0.81]] });
  furn('stool', 'Stool', '🪑', [
    [4, 7, 4, 12, 9, 12, 'wood_light'], [4, 0, 4, 6, 7, 6, 'wood'], [10, 0, 4, 12, 7, 6, 'wood'], [4, 0, 10, 6, 7, 12, 'wood'], [10, 0, 10, 12, 7, 12, 'wood'],
  ], { use: 'sit', sitY: 0.56, rot: false });
  furn('table', 'Wooden Table', '🍽️', [
    [0, 12, 0, 16, 14, 16, 'wood'], [1, 0, 1, 3, 12, 3, 'wood_dark'], [13, 0, 1, 15, 12, 3, 'wood_dark'], [1, 0, 13, 3, 12, 15, 'wood_dark'], [13, 0, 13, 15, 12, 15, 'wood_dark'],
  ], { rot: false, col: [[0, 0, 0, 1, 0.875, 1]] });
  furn('bed', 'Cozy Bed', '🛏️', [
    [0, 0, -16, 16, 5, 16, 'wood'], [1, 5, -15, 15, 8, 15, 'cloth_white'], [0.5, 5, -3, 15.5, 8.6, 15.5, 'cloth_red'],
    [3, 8, -14, 13, 10, -9, 'cloth_white'], [0, 0, -16, 16, 14, -14, 'wood'],
  ], { use: 'bed', extra: [[0, 0, -1]], col: [[0, 0, -1, 1, 0.5, 1]], pick: [0, 0, 0, 16, 9, 16] });
  furn('bed_blue', 'Seaside Bed', '🛏️', [
    [0, 0, -16, 16, 5, 16, 'wood_white'], [1, 5, -15, 15, 8, 15, 'cloth_white'], [0.5, 5, -3, 15.5, 8.6, 15.5, 'cloth_blue'],
    [3, 8, -14, 13, 10, -9, 'cloth_white'], [0, 0, -16, 16, 14, -14, 'wood_white'],
  ], { use: 'bed', extra: [[0, 0, -1]], col: [[0, 0, -1, 1, 0.5, 1]], pick: [0, 0, 0, 16, 9, 16] });
  furn('sofa', 'Lagoon Sofa', '🛋️', [
    [0, 0, 2, 16, 7, 16, 'cloth_teal'], [0, 7, 0, 16, 15, 4, 'cloth_teal'], [0, 7, 4, 3, 11, 16, 'cloth_teal'], [13, 7, 4, 16, 11, 16, 'cloth_teal'], [3, 7, 4, 13, 8, 15, 'cloth_white'],
  ], { use: 'sit', sitY: 0.5, col: [[0, 0, 0, 1, 0.5, 1]] });
  furn('sofa_pink', 'Blossom Sofa', '🛋️', [
    [0, 0, 2, 16, 7, 16, 'cloth_pink'], [0, 7, 0, 16, 15, 4, 'cloth_pink'], [0, 7, 4, 3, 11, 16, 'cloth_pink'], [13, 7, 4, 16, 11, 16, 'cloth_pink'], [3, 7, 4, 13, 8, 15, 'cloth_white'],
  ], { use: 'sit', sitY: 0.5, col: [[0, 0, 0, 1, 0.5, 1]] });
  furn('lamp', 'Floor Lamp', '💡', [[6, 0, 6, 10, 1, 10, 'iron'], [7.5, 1, 7.5, 8.5, 11, 8.5, 'iron'], [4, 10, 4, 12, 16, 12, 'lamp_glow']],
    { light: 0xffd9a0, rot: false, solid: false, tool: null });
  furn('lantern', 'Lantern', '🏮', [[5, 0, 5, 11, 1, 11, 'iron'], [5.5, 1, 5.5, 10.5, 8, 10.5, 'lamp_glow'], [5, 8, 5, 11, 9.5, 11, 'iron'], [7, 9.5, 7, 9, 11, 9, 'iron']],
    { light: 0xffc87a, rot: false, solid: false, tool: null });
  furn('torch', 'Torch', '🔥', [[7, 0, 7, 9, 10, 9, 'wood_dark'], [6.5, 10, 6.5, 9.5, 13, 9.5, 'ember']],
    { light: 0xffb060, rot: false, solid: false, tool: null, flame: 0.85, hp: 1 });
  furn('tiki_torch', 'Tiki Torch', '🔥', [[7, 0, 7, 9, 20, 9, 'wood'], [5.5, 20, 5.5, 10.5, 24, 10.5, 'rope'], [6.5, 24, 6.5, 9.5, 27, 9.5, 'ember']],
    { light: 0xffb060, rot: false, solid: false, tool: null, flame: 1.75, hp: 1 });
  furn('campfire', 'Campfire', '🔥', [
    [1, 0, 6, 15, 3, 10, 'log_side'], [6, 0, 1, 10, 3.2, 15, 'log_side'],
    [0, 0, 0, 3, 2, 3, 'stone'], [13, 0, 0, 16, 2, 3, 'stone'], [0, 0, 13, 3, 2, 16, 'stone'], [13, 0, 13, 16, 2, 16, 'stone'], [5, 3, 5, 11, 4, 11, 'ash'],
  ], {
    boxesOn: [
      [1, 0, 6, 15, 3, 10, 'log_side'], [6, 0, 1, 10, 3.2, 15, 'log_side'],
      [0, 0, 0, 3, 2, 3, 'stone'], [13, 0, 0, 16, 2, 3, 'stone'], [0, 0, 13, 3, 2, 16, 'stone'], [13, 0, 13, 16, 2, 16, 'stone'], [5, 3, 5, 11, 5, 11, 'ember'],
    ],
    use: 'campfire', lightOn: 0xff9a4a, rot: false, solid: false, tool: null, pick: [0, 0, 0, 16, 8, 16],
  });
  const rug = (key, label, tile) => furn(key, label, '🧶', [[0, 0, 0, 16, 1, 16, tile]], { solid: false, rot: false, tool: null, hp: 1, iconCube: tile, pick: [0, 0, 0, 16, 3, 16] });
  rug('rug_weave', 'Woven Rug', 'rug_weave');
  rug('rug_sea', 'Seafoam Rug', 'rug_sea');
  rug('rug_white', 'Cream Rug', 'cloth_white');
  rug('rug_pink', 'Blossom Rug', 'cloth_pink');
  rug('rug_blue', 'Sky Rug', 'cloth_blue');
  rug('towel', 'Beach Towel', 'cloth_stripe');
  furn('flower_pot', 'Potted Bloom', '🪴', [[5, 0, 5, 11, 6, 11, 'terracotta'], [7, 6, 7, 9, 11, 9, 'leaf'], [5, 10, 5, 11, 14, 11, 'cloth_pink'], [7, 14, 7, 9, 15, 9, 'cloth_yellow']],
    { rot: false, solid: false, tool: null });
  furn('potted_palm', 'Potted Palm', '🌴', [[4, 0, 4, 12, 7, 12, 'terracotta'], [7, 7, 7, 9, 18, 9, 'palm_side'], [1, 17, 6, 15, 19, 10, 'leaf'], [6, 17, 1, 10, 19, 15, 'leaf'], [5, 19, 5, 11, 21, 11, 'leaf']],
    { rot: false, solid: false, tool: null });
  furn('shelf', 'Wall Shelf', '📚', [[0, 8, 0, 16, 10, 6, 'wood'], [2, 10, 1, 5, 15, 5, 'cloth_blue'], [5, 10, 1, 7, 14, 5, 'cloth_red'], [10, 10, 1, 14, 13, 5, 'terracotta'], [11, 13, 2, 13, 16, 4, 'leaf']],
    { solid: false, wall: true, tool: null });
  furn('painting_sea', 'Seascape Painting', '🖼️', [[1, 2, 0, 15, 14, 1, { side: 'wood_dark', front: 'painting_sea' }]], { solid: false, wall: true, tool: null, hp: 1 });
  furn('painting_palm', 'Palm Painting', '🖼️', [[1, 2, 0, 15, 14, 1, { side: 'wood_white', front: 'painting_palm' }]], { solid: false, wall: true, tool: null, hp: 1 });
  furn('clock', 'Driftwood Clock', '🕰️', [[2, 2, 0, 14, 14, 1.5, { side: 'wood_dark', front: 'clock_face' }]], { solid: false, wall: true, tool: null, hp: 1 });
  furn('chest', 'Storage Chest', '🧰', [[1, 0, 1, 15, 14, 15, { side: 'chest_side', top: 'chest_top', front: 'chest_front' }]], { use: 'chest' });
  furn('pet_bed', 'Pet Bed', '🐾', [[1, 0, 1, 15, 3, 15, 'wood_light'], [2, 3, 2, 14, 5, 14, 'cloth_pink'], [1, 3, 1, 15, 6, 2, 'wood_light'], [1, 3, 14, 15, 6, 15, 'wood_light'], [1, 3, 2, 2, 6, 14, 'wood_light'], [14, 3, 2, 15, 6, 14, 'wood_light']],
    { rot: false, solid: false, tool: null, petBed: true });
  furn('fish_tank', 'Fish Tank', '🐠', [[1, 0, 3, 15, 2, 13, 'sand'], [1, 2, 3, 15, 11, 13, 'aqua'], [1, 11, 3, 15, 12, 13, 'iron'], [5, 5, 7, 8, 7, 9, 'ember'], [10, 7, 8, 12, 8.5, 10, 'cloth_yellow']], { tool: null });
  furn('beach_umbrella', 'Beach Umbrella', '⛱️', [[7.5, 0, 7.5, 8.5, 28, 8.5, 'wood_white'], [-8, 26, -8, 24, 28.5, 24, 'cloth_stripe'], [-2, 28.5, -2, 18, 30.5, 18, 'cloth_stripe'], [5, 30.5, 5, 11, 32, 11, 'cloth_red']],
    { rot: false, solid: false, tool: null, pick: [5, 0, 5, 11, 16, 11] });
  furn('beach_chair', 'Beach Lounger', '🏖️', [[1, 3, 0, 15, 5, 16, 'cloth_stripe_blue'], [1, 5, 0, 15, 12, 3, 'cloth_stripe_blue'], [1, 0, 1, 3, 3, 3, 'wood_white'], [13, 0, 1, 15, 3, 3, 'wood_white'], [1, 0, 13, 3, 3, 15, 'wood_white'], [13, 0, 13, 15, 3, 15, 'wood_white']],
    { use: 'sit', sitY: 0.32, tool: null, col: [[0, 0, 0, 1, 0.31, 1]] });
  furn('sandcastle', 'Sandcastle', '🏰', [[2, 0, 2, 14, 5, 14, 'sand'], [1, 0, 1, 5, 9, 5, 'sand'], [11, 0, 1, 15, 9, 5, 'sand'], [1, 0, 11, 5, 9, 15, 'sand'], [11, 0, 11, 15, 9, 15, 'sand'], [5, 5, 5, 11, 10, 11, 'sand'], [7.5, 10, 7.5, 8.5, 15, 8.5, 'wood_dark'], [8.5, 12, 7.5, 12, 15, 8.5, 'cloth_red']],
    { rot: false, solid: false, tool: null, hp: 1 });
  furn('log_seat', 'Log Bench', '🪵', [[0, 0, 4, 16, 7, 12, 'log_side']], { use: 'sit', sitY: 0.44, col: [[0, 0, 0.25, 1, 0.44, 0.75]] });
  furn('sign', 'Signpost', '🪧', [[7, 0, 7, 9, 8, 9, 'wood_dark'], [1, 8, 7, 15, 15, 9, { side: 'wood', front: 'sign_face' }]], { solid: false, tool: null });
  furn('shop_stall', 'Trading Post', '🏪', [[0, 0, 0, 16, 10, 16, 'crate']], { item: false, use: 'shop', hp: 9999 });

  // ---- more decor ----
  furn('kitchen_counter', 'Kitchen Counter', '🧺', [[0, 0, 0, 16, 14, 16, { side: 'paint_white', top: 'wood' }]], { rot: false, iconCube: 'paint_white' });
  furn('stove', 'Beach Stove', '🍳', [[0, 0, 0, 16, 14, 16, { side: 'iron', top: 'iron' }], [2, 14, 2, 7, 14.6, 7, 'ember'], [9, 14, 9, 14, 14.6, 14, 'ember'], [9, 14, 2, 14, 14.6, 7, 'ash'], [2, 14, 9, 7, 14.6, 14, 'ash']],
    { rot: false, use: 'stove', tool: 'pick' });
  furn('dresser', 'Dresser', '🗄️', [[1, 0, 2, 15, 12, 14, 'wood'], [1, 12, 2, 15, 13, 14, 'wood_dark'], [4, 3, 14, 6, 4.5, 14.6, 'gold'], [10, 3, 14, 12, 4.5, 14.6, 'gold'], [4, 8, 14, 6, 9.5, 14.6, 'gold'], [10, 8, 14, 12, 9.5, 14.6, 'gold']], {});
  furn('wardrobe', 'Wardrobe', '👕', [[1, 0, 2, 15, 30, 14, 'wood_dark'], [7.6, 2, 14, 8.4, 28, 14.4, 'wood'], [5.5, 13, 14, 6.8, 17, 14.8, 'gold'], [9.2, 13, 14, 10.5, 17, 14.8, 'gold']],
    { use: 'wardrobe', extra: [[0, 1, 0]], col: [[1 / 16, 0, 2 / 16, 15 / 16, 1.875, 14 / 16]], pick: [1, 0, 2, 15, 16, 14] });
  furn('mirror', 'Seashell Mirror', '🪞', [[3, 1, 0, 13, 15, 1, { side: 'shell_pink', front: 'aqua' }], [2, 0, 0, 14, 1, 1.4, 'shell_pink'], [2, 15, 0, 14, 16, 1.4, 'shell_pink']], { solid: false, wall: true, tool: null, hp: 1, use: 'wardrobe' });
  furn('string_lights', 'String Lights', '✨', [[0, 13, 0, 16, 13.6, 0.8, 'rope'], [2, 10.6, 0, 4, 13, 1.6, 'lamp_glow'], [7, 10.6, 0, 9, 13, 1.6, 'cloth_pink'], [12, 10.6, 0, 14, 13, 1.6, 'lamp_glow']],
    { solid: false, wall: true, tool: null, hp: 1, light: 0xffe2b0, lightPower: 0.6 });
  furn('hammock', 'Hammock', '🌴', [[7, 0, -14, 9, 15, -12, 'wood'], [7, 0, 12, 9, 15, 14, 'wood'], [2, 8, -12, 14, 9, 12, 'cloth_stripe'], [1, 9, -11, 2, 10.5, 11, 'cloth_stripe'], [14, 9, -11, 15, 10.5, 11, 'cloth_stripe']],
    { use: 'sit', sitY: 0.6, lie: true, extra: [[0, 0, -1]], solid: false, tool: null, pick: [1, 0, 0, 15, 11, 16] });
  furn('bedroll', 'Bedroll', '🛌', [[1, 0, -15, 15, 2, 15, 'cloth_green'], [3, 2, -14, 13, 4, -9, 'cloth_white'], [1, 2, -4, 15, 3, 15, 'cloth_yellow']],
    { use: 'bed', extra: [[0, 0, -1]], solid: false, tool: null, hp: 1, pick: [1, 0, 0, 15, 5, 16] });
  furn('surfboard', 'Surfboard', '🏄', [[5, 0, 0, 11, 30, 1.6, 'cloth_stripe_blue'], [6, 30, 0, 10, 32, 1.6, 'cloth_stripe_blue']], { solid: false, wall: true, tool: null, hp: 1, pick: [5, 0, 0, 11, 16, 3] });
  furn('life_ring', 'Life Ring', '🛟', [[3, 3, 0, 13, 6, 2, 'cloth_white'], [3, 10, 0, 13, 13, 2, 'cloth_white'], [3, 6, 0, 6, 10, 2, 'cloth_red'], [10, 6, 0, 13, 10, 2, 'cloth_red']], { solid: false, wall: true, tool: null, hp: 1 });
  furn('ship_wheel', "Ship's Wheel", '☸️', [[7, 1, 0, 9, 15, 1.5, 'wood_dark'], [1, 7, 0, 15, 9, 1.5, 'wood_dark'], [4, 4, 0, 12, 12, 1, 'wood'], [6.5, 6.5, 0, 9.5, 9.5, 2.2, 'gold']], { solid: false, wall: true, tool: null, hp: 1 });
  furn('fish_trophy', 'Fish Trophy', '🐟', [[1, 4, 0, 15, 12, 1, 'wood'], [4, 6, 1, 11, 10, 2.2, 'cloth_blue'], [11, 5, 1, 13, 11, 2.2, 'cloth_blue'], [5, 8.5, 2.2, 6, 9.5, 2.6, 'wood_dark']], { solid: false, wall: true, tool: null, hp: 1 });
  furn('bunting', 'Bunting', '🎏', [[0, 13, 0, 16, 13.6, 0.8, 'rope'], [1, 9, 0, 4, 13, 0.8, 'cloth_red'], [6, 9, 0, 9, 13, 0.8, 'cloth_yellow'], [11, 9, 0, 14, 13, 0.8, 'cloth_teal']], { solid: false, wall: true, tool: null, hp: 1 });
  furn('picnic_basket', 'Picnic Basket', '🧺', [[3, 0, 4, 13, 7, 12, 'rope'], [3, 7, 4, 13, 8, 12, 'cloth_stripe'], [7, 8, 4.5, 9, 12, 5.5, 'rope'], [7, 8, 10.5, 9, 12, 11.5, 'rope'], [7, 11, 5.5, 9, 12, 10.5, 'rope']], { solid: false, tool: null, hp: 1 });
  furn('beach_ball', 'Beach Ball', '🏐', [[4, 0, 4, 12, 8, 12, 'cloth_stripe'], [5, 8, 5, 11, 9, 11, 'cloth_white'], [3, 1, 5, 4, 7, 11, 'cloth_stripe_blue'], [12, 1, 5, 13, 7, 11, 'cloth_stripe_blue']], { solid: false, rot: false, tool: null, hp: 1 });
  furn('lamp_post', 'Lamp Post', '🏮', [[6, 0, 6, 10, 2, 10, 'iron'], [7, 2, 7, 9, 26, 9, 'iron'], [5, 26, 5, 11, 31, 11, 'lamp_glow'], [4, 31, 4, 12, 32.5, 12, 'iron']],
    { rot: false, tool: 'pick', light: 0xffd9a0, flameH: 1.8, col: [[0.42, 0, 0.42, 0.58, 2, 0.58]], pick: [5, 0, 5, 11, 16, 11] });
  furn('planter', 'Flower Planter', '🌷', [[0, 0, 3, 16, 6, 13, 'wood'], [1, 5, 4, 15, 6.5, 12, 'dirt'], [2, 6, 6, 4, 11, 8, 'leaf'], [1.5, 10, 5.5, 4.5, 13, 8.5, 'cloth_pink'], [7, 6, 7, 9, 12, 9, 'leaf'], [6.5, 11, 6.5, 9.5, 14, 9.5, 'cloth_yellow'], [12, 6, 6, 14, 10, 8, 'leaf'], [11.5, 9, 5.5, 14.5, 12, 8.5, 'cloth_purple']],
    { solid: false, tool: null });
  furn('bookshelf_tall', 'Tall Bookcase', '📚', [[0, 0, 4, 16, 16, 16, { side: 'planks', front: 'bookshelf', top: 'planks' }]], { iconCube: 'bookshelf' });

  furn('tent', 'Beach Tent', '⛺', [
    // candy-striped canvas in eight shallow tiers, a ridge pole, door flaps, a pennant and a welcome mat
    [-8, 0, -16, 24, 2.5, 16, 'cloth_teal'], [-6, 2.5, -16, 22, 5, 16, 'cloth_teal'], [-4, 5, -16, 20, 7.5, 16, 'cloth_white'], [-2, 7.5, -16, 18, 10, 16, 'cloth_white'],
    [0, 10, -16, 16, 12.5, 16, 'cloth_teal'], [2, 12.5, -16, 14, 15, 16, 'cloth_teal'], [4, 15, -16, 12, 17.5, 16, 'cloth_white'], [6, 17.5, -16, 10, 20, 16, 'cloth_white'],
    [6.5, 20, -17, 9.5, 22, 17, 'wood'], [2, 0, 16, 14, 11, 16.4, 'wood_dark'], [1, 0, 16.4, 4, 12, 16.8, 'cloth_white'], [12, 0, 16.4, 15, 12, 16.8, 'cloth_white'],
    [7.5, 22, 15.5, 8.5, 29, 16.5, 'wood'], [8.5, 25.5, 15.8, 13.5, 28.5, 16.2, 'cloth_yellow'], [3, 0, 17, 13, 0.7, 21.5, 'cloth_yellow'],
  ], { use: 'bed', extra: [[0, 0, -1]], solid: false, tool: null, hp: 2, pick: [0, 0, 0, 16, 16, 16] });

  // ---- later additions: floors, coloured walls and more furniture ----
  build('plaster_pink', 'Blossom Plaster', 'plaster_pink', { tool: 'pick' });
  build('plaster_blue', 'Sky Plaster', 'plaster_blue', { tool: 'pick' });
  build('plaster_yellow', 'Sunny Plaster', 'plaster_yellow', { tool: 'pick' });
  build('plaster_mint', 'Mint Plaster', 'plaster_mint', { tool: 'pick' });
  build('tile_white', 'White Tiles', 'tile_white', { tool: 'pick' });
  build('tile_checker', 'Checker Tiles', 'tile_checker', { tool: 'pick' });
  build('tile_terracotta', 'Terracotta Tiles', 'tile_terracotta', { tool: 'pick' });
  build('bamboo', 'Bamboo Wall', 'bamboo', { tool: 'axe' });
  furn('bathtub', 'Bathtub', '🛁', [[0, 2, 0, 16, 9, 16, 'porcelain'], [2, 9, 2, 14, 9.4, 14, 'water_tile'], [1, 0, 1, 4, 2, 4, 'gold'], [12, 0, 1, 15, 2, 4, 'gold'], [1, 0, 12, 4, 2, 15, 'gold'], [12, 0, 12, 15, 2, 15, 'gold'], [7, 9, 0.5, 9, 13, 2, 'iron']],
    { use: 'sit', sitY: 0.3, tool: 'pick', col: [[0, 0, 0, 1, 0.56, 1]] });
  furn('sink', 'Washstand', '🚰', [[1, 0, 2, 15, 11, 14, 'paint_white'], [1, 11, 2, 15, 13, 14, 'porcelain'], [4, 13, 4, 12, 13.4, 12, 'water_tile'], [7, 13, 2.5, 9, 17, 4, 'iron']], { tool: 'pick' });
  furn('fridge', 'Icebox', '🧊', [[1, 0, 2, 15, 28, 14, 'porcelain'], [1, 17, 14, 15, 17.6, 14.3, 'iron'], [12, 20, 14, 13.2, 25, 15, 'iron'], [12, 8, 14, 13.2, 14, 15, 'iron']],
    { tool: 'pick', extra: [[0, 1, 0]], col: [[1 / 16, 0, 2 / 16, 15 / 16, 1.75, 14 / 16]], pick: [1, 0, 2, 15, 16, 14] });
  furn('barrel', 'Barrel', '🛢️', [[2, 0, 2, 14, 15, 14, 'wood'], [1.5, 2, 1.5, 14.5, 4, 14.5, 'iron'], [1.5, 11, 1.5, 14.5, 13, 14.5, 'iron'], [3, 15, 3, 13, 15.5, 13, 'wood_dark']], { rot: false });
  furn('anchor', 'Anchor', '⚓', [[7, 2, 0, 9, 14, 1.4, 'iron'], [3, 2, 0, 13, 4, 1.4, 'iron'], [3, 4, 0, 5, 7, 1.4, 'iron'], [11, 4, 0, 13, 7, 1.4, 'iron'], [5, 11, 0, 11, 12.5, 1.4, 'iron'], [6.5, 13.5, 0, 9.5, 15.5, 1.4, 'gold']], { solid: false, wall: true, tool: null, hp: 1 });
  furn('tiki_statue', 'Tiki Statue', '🗿', [[4, 0, 4, 12, 22, 12, 'wood_dark'], [3, 16, 3.5, 13, 18, 12.5, 'wood'], [5, 12, 12, 7, 15, 12.6, 'ember'], [9, 12, 12, 11, 15, 12.6, 'ember'], [5.5, 6, 12, 10.5, 9, 12.6, 'wood_light'], [3, 22, 3, 13, 24, 13, 'leaf']],
    { tool: 'axe', col: [[0.25, 0, 0.25, 0.75, 1.4, 0.75]], pick: [4, 0, 4, 12, 16, 12] });
  furn('telescope', 'Telescope', '🔭', [[7.5, 0, 7.5, 8.5, 11, 8.5, 'wood_dark'], [3, 0, 7.5, 13, 1, 8.5, 'wood_dark'], [7.5, 0, 3, 8.5, 1, 13, 'wood_dark'], [6, 11, 2, 10, 14, 15, 'gold'], [6.5, 11.5, 15, 9.5, 13.5, 17, 'black']],
    { use: 'telescope', solid: false, tool: null });
  furn('birdbath', 'Birdbath', '🕊️', [[6, 0, 6, 10, 9, 10, 'stone'], [4, 0, 4, 12, 2, 12, 'stone'], [2, 9, 2, 14, 11, 14, 'stone'], [3.5, 11, 3.5, 12.5, 11.4, 12.5, 'water_tile']], { rot: false, tool: 'pick' });
  furn('mailbox', 'Mailbox', '📮', [[7, 0, 7, 9, 10, 9, 'wood'], [4, 10, 4, 12, 16, 12, 'cloth_red'], [4, 10, 12, 12, 16, 12.5, 'cloth_white'], [12, 12, 6, 13, 16, 7, 'gold']], { solid: false, tool: null });
  furn('picnic_table', 'Picnic Table', '🧺', [[0, 10, 2, 16, 12, 14, 'wood'], [1, 0, 3, 3, 10, 5, 'wood_dark'], [13, 0, 3, 15, 10, 5, 'wood_dark'], [1, 0, 11, 3, 10, 13, 'wood_dark'], [13, 0, 11, 15, 10, 13, 'wood_dark'], [3, 12, 4, 13, 12.4, 12, 'cloth_stripe']],
    { rot: true, col: [[0, 0, 0.125, 1, 0.75, 0.875]] });
  furn('bench', 'Garden Bench', '🪑', [[0, 6, 3, 16, 8, 13, 'wood_light'], [0, 8, 3, 16, 15, 5, 'wood_light'], [1, 0, 4, 3, 6, 12, 'iron'], [13, 0, 4, 15, 6, 12, 'iron']], { use: 'sit', sitY: 0.5, col: [[0, 0, 0.19, 1, 0.5, 0.81]] });
  furn('record_player', 'Music Box', '🎶', [[2, 0, 3, 14, 6, 13, 'wood_dark'], [4, 6, 5, 12, 6.6, 11, 'black'], [7, 6.6, 7, 9, 7.2, 9, 'gold'], [11, 6, 4, 12.5, 12, 5.5, 'gold'], [9, 11, 2, 14, 15, 7, 'gold']], { use: 'music', solid: false, tool: null });
  furn('globe', 'Island Globe', '🌍', [[5, 0, 5, 11, 1.5, 11, 'wood_dark'], [7.5, 1.5, 7.5, 8.5, 5, 8.5, 'gold'], [4, 5, 4, 12, 13, 12, 'water_tile'], [5, 8, 3.8, 9, 11, 4.2, 'leaf'], [8, 6, 11.8, 11, 9, 12.2, 'leaf'], [3.8, 9, 7, 4.2, 11, 10, 'leaf']], { rot: false, solid: false, tool: null });

  // ---- fruit that hangs under the leaves of some trees (picked with a click, grows back) ----
  const fruit = (key, label, icon, tile, value) => find(key, label, [[5, 7, 5, 11, 13, 11, tile], [7.5, 13, 7.5, 8.5, 16, 8.5, 'wood_dark'], [8.5, 13.5, 7, 11.5, 14.5, 9, 'leaf']],
    { icon, food: 1, value, fruit: true, pick: [3, 5, 3, 13, 16, 13] });
  fruit('fruit_apple', 'Apple', '🍎', 'fruit_apple', 10);
  fruit('fruit_orange', 'Orange', '🍊', 'fruit_orange', 10);
  fruit('fruit_peach', 'Peach', '🍑', 'fruit_peach', 12);
  find('fruit_cherry', 'Cherries', [[4, 8, 6, 8, 12, 10, 'fruit_cherry'], [9, 7, 6, 13, 11, 10, 'fruit_cherry'], [6, 12, 7.5, 7, 16, 8.5, 'wood_dark'], [10, 11, 7.5, 11, 16, 8.5, 'wood_dark']],
    { icon: '🍒', food: 1, value: 14, fruit: true, pick: [3, 5, 3, 13, 16, 13] });

  // Invisible helper cell used by two-cell objects (doors, beds).  meta: bits 0-2 = direction to parent.
  B('filler', { label: '', shape: 'none' });
  G.FILLER_DIRS = [[0, -1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0]];

  // Wished-for treasure: star fragments wash up the morning after you wish on a shooting star.
  find('star_fragment', 'Star Fragment', [[6.5, 0, 2, 9.5, 3, 14, 'star_gold'], [2, 0, 6.5, 14, 3, 9.5, 'star_gold'], [5, 0, 5, 11, 4.5, 11, 'star_gold']], { icon: '🌟', value: 90 });
  furn('star_lamp', 'Star Lamp', '💫', [[5.5, 0, 5.5, 10.5, 1, 10.5, 'iron'], [7.4, 1, 7.4, 8.6, 6, 8.6, 'iron'], [6.5, 5, 6.8, 9.5, 15, 9.2, 'star_gold'], [3, 8.5, 6.8, 13, 11.5, 9.2, 'star_gold'], [5, 7, 6.4, 11, 13, 9.6, 'star_gold'], [6.8, 8.5, 3, 9.2, 11.5, 13, 'star_gold'], [6.4, 7, 5, 9.6, 13, 11, 'star_gold']],
    { light: 0xfff0a8, solid: false, tool: null });

  // A few soft little keepsakes (drawn rounded; the boxes are only their outline for picking)
  furn('teddy', 'Teddy Bear', '🧸', [[4, 0, 4, 12, 11, 12, 'wood_light']], { solid: false, tool: null, hp: 1 });
  furn('gnome', 'Garden Gnome', '🧝', [[4, 0, 4, 12, 14, 12, 'cloth_blue']], { solid: false, tool: null, hp: 1 });
  furn('mush_lamp', 'Mushroom Lamp', '🍄', [[3, 0, 3, 13, 10, 13, 'cloth_pink']], { light: 0xffc8dc, rot: false, solid: false, tool: null, hp: 1 });
  furn('sand_buddy', 'Sand Buddy', '⛄', [[4, 0, 4, 12, 14, 12, 'sand']], { solid: false, tool: null, hp: 1 });

  // Quick lookup tables for the mesher / physics
  const n = G.BLOCKS.length;
  G.OPAQUE = new Uint8Array(n);
  G.SOLID = new Uint8Array(n);
  // NATURAL: ground that is drawn as smooth rolling terrain.  FLATTENS: anything built that keeps
  // the ground beside it level (walls, floors, furniture), so houses always sit on flat land.
  // base colour of each kind of natural ground, blended across the smooth terrain
  G.GROUND_RGB = {};
  const groundHex = { sand: 0xf8e6ba, grass: 0x93d873, dirt: 0xb88d66, stone: 0xb9bec8, sandstone: 0xe8cc98, clay: 0xcfa9a0, path: 0xe2cfa2, farmland: 0x93694a };
  G.NATURAL = new Uint8Array(n);
  G.FLATTENS = new Uint8Array(n);
  const natural = ['sand', 'grass', 'dirt', 'stone', 'sandstone', 'clay', 'path', 'farmland'];
  for (let i = 1; i < n; i++) {
    const d = G.BLOCKS[i];
    G.OPAQUE[i] = d.opaque ? 1 : 0;
    G.SOLID[i] = d.col ? 1 : 0;
    G.NATURAL[i] = natural.includes(d.key) ? 1 : 0;
    if (G.NATURAL[i]) { const h = groundHex[d.key]; G.GROUND_RGB[i] = [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
    // solid things level the ground; small walk-through decor (campfires, torches, pots) just rests on the slope
    G.FLATTENS[i] = ((d.shape === 'cube' && !G.NATURAL[i] && !d.tree) || (d.shape === 'boxes' && (d.cat === 'furniture' || d.cat === 'build') && (d.col || d.extra) && d.key !== 'log_seat')) ? 1 : 0;   // a log just rests on the slope
    d.rides = d.shape === 'boxes' && !d.fruit && !d.wall && !G.FLATTENS[i] && (d.cat === 'find' || d.cat === 'nature' || d.cat === 'furniture');
  }
})();
