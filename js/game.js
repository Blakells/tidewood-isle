// Tidewood Isle — game rules: held items, sleeping, daily beach finds, growth, quests, journal, the trader.
'use strict';
(function () {
  const B = G.B;
  G.entities = [];
  G.journal = { fish: {}, shells: {}, bugs: {} };
  G.chests = {};
  G.flags = {};
  G.stats = { placed: 0, furniture: 0, planted: 0 };

  // ---------------- held item model ----------------
  const emojiTex = {};
  function emojiSprite(ch) {
    if (!emojiTex[ch]) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const ctx = c.getContext('2d');
      ctx.font = '50px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, 32, 36);
      emojiTex[ch] = new THREE.CanvasTexture(c);
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex[ch], transparent: true }));
    s.scale.set(0.42, 0.42, 0.42);
    return s;
  }
  G.emojiSprite = emojiSprite;

  function toolModel(kind) {
    const g = new THREE.Group();
    const wood = 0x9a6f4a, metal = 0xb9c0c8;
    if (kind === 'axe') { g.add(G.box(0.05, 0.5, 0.05, wood)); g.add(G.box(0.07, 0.16, 0.2, metal, 0, 0.34, 0.1)); }
    else if (kind === 'pick') { g.add(G.box(0.05, 0.5, 0.05, wood)); g.add(G.box(0.07, 0.07, 0.44, metal, 0, 0.43, 0)); }
    else if (kind === 'shovel') { g.add(G.box(0.05, 0.42, 0.05, wood)); g.add(G.box(0.16, 0.2, 0.04, metal, 0, 0.42, 0)); }
    else if (kind === 'net') { g.add(G.box(0.04, 0.7, 0.04, 0xd9b27c)); g.add(G.box(0.3, 0.04, 0.3, 0xffffff, 0, 0.7, 0)); g.add(G.box(0.24, 0.16, 0.24, 0xe8f4f8, 0, 0.54, 0)); }
    else if (kind === 'rod') { g.add(G.box(0.04, 1.2, 0.04, 0xd9b27c)); g.add(G.box(0.07, 0.07, 0.1, 0xe0766a, 0, 0.16, 0.05)); }
    g.rotation.x = Math.PI / 2 - 0.5;
    return g;
  }

  G.updateHeldModel = function (id) {
    const hand = G.player.hand;
    if (!hand) return;
    while (hand.children.length) hand.remove(hand.children[0]);
    G.heldItemId = id;
    if (!id) return;
    const item = G.ITEMS[id];
    if (!item) return;
    if (item.tool) { hand.add(toolModel(item.tool)); return; }
    if (item.block && (!item.icon || G.BLOCKS[item.block].shape === 'cube')) {
      const def = G.BLOCKS[item.block];
      const m = new THREE.Mesh(G.buildBlockGeometry(def, 0), G.chunkMaterial);
      m.scale.setScalar(0.26); m.position.set(-0.13, -0.02, 0.0);
      hand.add(m);
      return;
    }
    const s = emojiSprite(item.icon || '📦');
    s.position.set(0, 0, 0.12);
    hand.add(s);
  };

  // ---------------- Marlow the trader ----------------
  function buildOtter() {
    const g = new THREE.Group();
    const fur = 0x9c6b4a, cream = 0xf3dcc0;
    g.add(G.box(0.5, 0.62, 0.4, fur, 0, 0.12, 0));
    g.add(G.box(0.34, 0.44, 0.06, cream, 0, 0.18, 0.2));
    const head = new THREE.Group(); head.position.set(0, 0.74, 0.02);
    head.add(G.box(0.52, 0.42, 0.44, fur));
    head.add(G.box(0.3, 0.2, 0.1, cream, 0, 0.02, 0.22));
    head.add(G.box(0.1, 0.07, 0.04, 0x3a2e2a, 0, 0.14, 0.28));
    head.add(G.box(0.06, 0.08, 0.02, 0x2a2220, -0.14, 0.24, 0.225));
    head.add(G.box(0.06, 0.08, 0.02, 0x2a2220, 0.14, 0.24, 0.225));
    head.add(G.box(0.12, 0.1, 0.06, fur, -0.22, 0.4, 0));
    head.add(G.box(0.12, 0.1, 0.06, fur, 0.22, 0.4, 0));
    head.add(G.box(0.62, 0.05, 0.56, 0x5f93c9, 0, 0.42, 0.02));      // little cap
    head.add(G.box(0.4, 0.14, 0.4, 0x5f93c9, 0, 0.46, -0.02));
    g.add(head);
    g.add(G.box(0.14, 0.12, 0.2, fur, -0.14, 0, 0.02));
    g.add(G.box(0.14, 0.12, 0.2, fur, 0.14, 0, 0.02));
    const armL = G.box(0.12, 0.34, 0.14, fur, -0.31, 0.36, 0.02), armR = G.box(0.12, 0.34, 0.14, fur, 0.31, 0.36, 0.02);
    g.add(armL, armR);
    const tail = G.box(0.16, 0.14, 0.5, fur, 0, 0.1, -0.4);
    g.add(tail);
    g.userData = { head, armR, tail };
    return g;
  }

  function spawnTrader() {
    const s = G.world.shop;
    if (!s) return;
    const model = buildOtter();
    const ent = {
      kind: 'trader', name: 'Marlow', model,
      pos: new THREE.Vector3(s.stallX + 1, s.y, s.stallZ - 1 + 0.5),
      pickRadius: 0.6, pickY: 0.6,
      hint: () => '<kbd>Click</kbd> to trade with Marlow',
      interact: () => { G.facePlayerTo(ent.pos.x, ent.pos.z); G.ui.openShop(); if (G.audio) G.audio.speak(410, 8); },
      update(dt, t) {
        const p = G.player.pos;
        const dx = p.x - ent.pos.x, dz = p.z - ent.pos.z;
        const near = dx * dx + dz * dz < 64;
        const want = near ? Math.atan2(dx, dz) : 0;
        let diff = G.mod(want - model.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
        model.rotation.y += diff * Math.min(1, dt * 4);
        model.position.set(ent.pos.x, ent.pos.y + Math.abs(Math.sin(t * 2.2)) * 0.03, ent.pos.z);
        model.userData.armR.rotation.z = near && dx * dx + dz * dz < 20 ? Math.sin(t * 9) * 0.5 + 0.9 : 0;
        model.userData.tail.rotation.y = Math.sin(t * 3) * 0.4;
      },
    };
    G.scene.add(model);
    G.entities.push(ent);
    G.trader = ent;
  }

  // ---------------- sleeping ----------------
  G.tryToSleep = function (x, y, z, def) {
    if (!(G.time >= 19 || G.time < 6)) { G.ui.toast('Too bright to sleep — come back after sunset (7 PM) 🌙'); return; }
    const P = G.player;
    if (P.riding && G.dismountBoat) G.dismountBoat();
    P.sitting = null; P.lying = false;
    if (G.fishing) G.fishing.cancel(true);
    const f = G.FRONT[G.getMeta(x, y, z) & 3];
    G.flags.home = { x, y, z };                        // wherever you sleep is home on the map
    P.sleeping = true;
    P.pos.set(x + 0.5 - f[0] * 0.5, y + 0.55, z + 0.5 - f[1] * 0.5);
    P.yaw = Math.atan2(f[0], f[1]);
    P.vel.set(0, 0, 0);
    G.emit('sfx', 'lullaby');
    G.ui.fade('Sweet dreams…', () => {
      if (G.time >= 19) G.day++;
      G.time = 6.6;
      G.emit('newday', true);
      G.emit('slept');
      G.emit('morning', true);
    }, () => {
      P.sleeping = false;
      P.pos.set(x + 0.5 + f[0] * 1.0, y + 0.05, z + 0.5 + f[1] * 1.0);
      if (!G.aabbFree(P.pos.x, P.pos.y, P.pos.z, P.hw, P.height)) P.pos.set(x + 0.5, y + 0.6, z + 0.5);
      if (G.saveGame) G.saveGame();
    });
  };

  // ---------------- message in a bottle ----------------
  const NOTES = [
    ['“If you find this, the tide carried it far. I hope your island is as kind as mine.”', 40],
    ['“Grandpa says the big fish only bite when the moon is up. I never stay awake long enough.”', 30],
    ['“Planted a blossom tree for every friend I made this year. The hill is very pink now.”', 35],
    ['“To whoever reads this: go sit by a fire tonight. That is all.”', 25],
    ['“I buried nothing and drew no map. But here are some pearls for your trouble.”', 70],
    ['“The crabs here dance when nobody is looking. I am almost sure of it.”', 30],
    ['“I wished on a shooting star and the sea sent me stars back. Try it.”', 45],
    ['“Day 40. The pelican has learned my name. I have not learned his.”', 30],
    ['“Whoever finds this: you look lovely today. Yes, you.”', 35],
    ['“My sandcastle lasted three whole tides. I am very proud.”', 25],
    ['“If the rain catches you out, wait for it. The rainbow is worth getting wet for.”', 40],
    ['“I have counted every shell on my beach twice. There are more each morning.”', 30],
  ];
  G.openBottle = function () {
    const n = G.pick(NOTES);
    G.addPearls(n[1]);
    G.emit('bottle');
    G.ui.dialog({ title: '🍾 A note in a bottle', html: '<i>' + n[0] + '</i><br><br>Tucked inside: <b><i class="pearl"></i>' + n[1] + ' pearls</b>', buttons: [{ label: 'How lovely', primary: true }] });
  };

  // ---------------- daily beach finds & regrowth ----------------
  function beachCells() {
    if (G._beach) return G._beach;
    const list = [];
    for (let z = 2; z < G.D - 2; z++) for (let x = 2; x < G.W - 2; x++) {
      const y = G.world.hgt[z * G.W + x];
      if (y >= G.SEA - 1 && y <= G.SEA + 1) list.push([x, z]);
    }
    return (G._beach = list);
  }
  function countFinds() {
    let n = 0;
    for (const [x, z] of beachCells()) { const y = G.groundY(x, z); const d = G.getDef(x, y + 1, z); if (d && d.cat === 'find') n++; }
    return n;
  }
  const FIND_TABLE = [{ id: 'shell', w: 78 }, { id: 'driftwood', w: 10 }, { id: 'coconut', w: 7 }, { id: 'pebble', w: 4 }, { id: 'bottle', w: 1.6 }];
  function spawnFind() {
    const cells = beachCells();
    for (let tries = 0; tries < 30; tries++) {
      const [x, z] = cells[(Math.random() * cells.length) | 0];
      const y = G.groundY(x, z);
      if (y < G.SEA - 1 || G.getBlock(x, y, z) !== B.sand || G.getBlock(x, y + 1, z) !== 0) continue;
      if (Math.abs(x - G.player.pos.x) < 3 && Math.abs(z - G.player.pos.z) < 3) continue;
      let above = false;
      for (let k = 2; k < 8; k++) if (G.getBlock(x, y + k, z)) { above = true; break; }
      if (above && Math.random() < 0.8) continue;
      let pick = G.pickWeighted(FIND_TABLE).id;
      if (pick === 'shell') pick = G.pickWeighted(G.SHELL_TABLE).id;
      G.setBlock(x, y + 1, z, B[pick], (Math.random() * 4) | 0);
      return true;
    }
    return false;
  }
  // ---------------- wishing on shooting stars ----------------
  G.makeWish = function () {
    const P = G.player;
    G.flags.wishes = Math.min(3, (G.flags.wishes || 0) + 1);
    G.burst(P.pos.x, P.pos.y + 1.9, P.pos.z, { n: 14, colors: [0xfff3a0, 0xffffff, 0xffd9f0], speed: 1.6, up: 2.4, grav: 2, life: 1.1, size: 0.09, glow: true });
    G.emit('sfx', 'tickUp'); G.emit('wished');
    G.ui.toast('🌠 You wish on the shooting star… something may wash ashore by morning', 'good');
  };
  function spawnStars(n) {
    const cells = beachCells();
    let made = 0;
    for (let tries = 0; tries < 200 && made < n; tries++) {
      const [x, z] = cells[(Math.random() * cells.length) | 0];
      const y = G.groundY(x, z);
      if (y < G.SEA - 1 || G.getBlock(x, y, z) !== B.sand || G.getBlock(x, y + 1, z) !== 0) continue;
      let above = false;
      for (let k = 2; k < 8; k++) if (G.getBlock(x, y + k, z)) { above = true; break; }
      if (above) continue;
      G.setBlock(x, y + 1, z, B.star_fragment, (Math.random() * 4) | 0);
      made++;
    }
    return made;
  }
  function refreshBeach(target) {
    let n = countFinds();
    let guard = 0;
    while (n < target && guard++ < 200) if (spawnFind()) n++;
  }

  // ---------------- fruit trees ----------------
  // Some trees bear fruit under their leaves.  Which fruit is fixed per tree by its position.
  const FRUITS = ['fruit_apple', 'fruit_orange', 'fruit_peach'];
  function fruitTrees() {
    const out = [], blocks = G.world.blocks, W = G.W, D = G.D, H = G.H;
    for (let z = 3; z < D - 3; z++) for (let x = 3; x < W - 3; x++) {
      for (let y = H - 2; y > G.SEA; y--) {
        const i = (y * D + z) * W + x;
        if (blocks[i] !== B.log) continue;
        if (G.world.meta[i] & 4) break;                              // player-placed log
        const above = blocks[i + D * W];
        if (above !== B.leaves && above !== B.blossom_leaves) break;
        let kind;
        if (above === B.blossom_leaves) kind = 'fruit_cherry';
        else { const h = G.hash2(x, z, G.world.seed + 5); if (h > 0.62) break; kind = FRUITS[(h / 0.62 * 3) | 0]; }
        out.push({ x, y, z, kind });
        break;
      }
    }
    return out;
  }
  const FRUIT_SPOTS = [[1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2], [1, 0], [0, 1], [-1, 0], [0, -1]];
  G.growFruit = function (chance) {
    for (const t of fruitTrees()) {
      const y = t.y - 2;                                             // the row just under the lowest leaves
      let have = 0; const free = [];
      for (const [dx, dz] of FRUIT_SPOTS) {
        const def = G.getDef(t.x + dx, y, t.z + dz), up = G.getBlock(t.x + dx, y + 1, t.z + dz);
        if (def && def.fruit) have++;
        else if (!def && (up === B.leaves || up === B.blossom_leaves)) free.push([dx, dz]);
      }
      while (have < 3 && free.length && Math.random() < chance) {
        const [dx, dz] = free.splice((Math.random() * free.length) | 0, 1)[0];
        G.setBlock(t.x + dx, y, t.z + dz, B[t.kind], 0);
        have++;
      }
    }
  };

  // growables: crops & saplings & berry bushes we keep an eye on
  const growables = new Map();
  function trackGrowable(x, y, z) {
    const def = G.getDef(x, y, z);
    const k = x + ',' + y + ',' + z;
    if (def && (def.crop || def.grows || def.key === 'berry_bush')) growables.set(k, [x, y, z]); else growables.delete(k);
  }
  G.scanGrowables = function () {
    growables.clear();
    const blocks = G.world.blocks;
    for (let i = 0; i < blocks.length; i++) {
      const def = G.BLOCKS[blocks[i]];
      if (def && (def.crop || def.grows || def.key === 'berry_bush')) {
        const x = i % G.W, z = ((i / G.W) | 0) % G.D, y = (i / (G.W * G.D)) | 0;
        growables.set(x + ',' + y + ',' + z, [x, y, z]);
      }
    }
  };
  function growTick(boost) {
    for (const [k, c] of growables) {
      const [x, y, z] = c;
      const def = G.getDef(x, y, z);
      if (!def) { growables.delete(k); continue; }
      const meta = G.getMeta(x, y, z);
      if (def.crop) {
        const stage = (meta >> 3) & 3;
        if (stage < 3 && Math.random() < (boost ? 0.95 : 0.03)) G.setMeta(x, y, z, (meta & ~24) | (Math.min(3, stage + (boost ? 2 : 1)) << 3));
      } else if (def.grows) {
        if (Math.random() < (boost ? 0.8 : 0.008)) {
          // need headroom
          let clear = true;
          for (let i = 1; i < 6; i++) if (G.getBlock(x, y + i, z)) clear = false;
          if (!clear) continue;
          if (Math.abs(G.player.pos.x - x - 0.5) < 3.5 && Math.abs(G.player.pos.z - z - 0.5) < 3.5 && !boost) continue;   // wait until nobody is standing here
          G.setBlock(x, y, z, 0, 0);
          G.buildTree(x, y, z, def.grows, Math.random, (bx, by, bz, id, m) => { if (G.inWorld(bx, by, bz) && G.getBlock(bx, by, bz) === 0) G.setBlock(bx, by, bz, id, m || 0); });
          growables.delete(k);
          if (!boost) G.burst(x + 0.5, y + 1, z + 0.5, { n: 10, colors: [0x8ed07a, 0xfff2b0], speed: 2, up: 3, size: 0.1 });
        }
      } else if (def.key === 'berry_bush') {
        if (!(meta & 4) && Math.random() < (boost ? 0.9 : 0.004)) G.setMeta(x, y, z, meta | 4);
      }
    }
  }

  G.plantSeed = function (t, item) {
    const h = t.hit;
    const ground = G.getDef(h.ax, h.ay, h.az);
    if (!ground || h.face[1] !== 1 || !(ground.key === 'grass' || ground.key === 'dirt' || ground.key === 'farmland')) { G.ui.toast('Seeds need grass, dirt or garden soil'); return; }
    if (G.getBlock(h.ax, h.ay + 1, h.az) !== 0) { G.ui.toast('Something is in the way'); return; }
    if (ground.key !== 'farmland') G.setBlock(h.ax, h.ay, h.az, B.farmland, 0);
    G.setBlock(h.ax, h.ay + 1, h.az, B[item.plants], 0);
    trackGrowable(h.ax, h.ay + 1, h.az);
    G.consumeHeld(1);
    G.player.swing = 0.28;
    G.emit('sfx', 'place'); G.emit('planted', item.plants);
    G.burst(h.ax + 0.5, h.ay + 1.1, h.az + 0.5, { n: 5, color: 0x8a6243, speed: 1.4, up: 1.6, size: 0.08 });
  };

  // ---------------- quests ----------------
  const Q = G.quests = {
    done: {}, progress: {},
    list: [
      { id: 'tent', title: 'Pitch your tent', desc: 'Pick a nice spot and place the tent from your backpack (Tab)', goal: 1, reward: 20, on: 'placed', test: (k) => k === 'tent' },
      { id: 'shells', title: 'Beachcomber', desc: 'Pick up 5 shells along the shore', goal: 5, reward: 30, on: 'collect', test: (id, n, def) => def && def.shell },
      { id: 'timber', title: 'Timber!', desc: 'Chop down a tree with your axe', goal: 1, reward: 20, on: 'felled' },
      { id: 'bench', title: 'Handy', desc: 'Make a workbench (Tab → Basics) and place it', goal: 1, reward: 25, on: 'placed', test: (k) => k === 'workbench' },
      { id: 'walls', title: 'Four walls', desc: 'Place 20 building blocks to start a home', goal: 20, reward: 40, on: 'placed', test: (k) => G.BLOCK_BY_KEY[k].cat === 'build' },
      { id: 'door', title: 'Come on in', desc: 'Craft a door at the workbench and place it', goal: 1, reward: 30, on: 'placed', test: (k) => k === 'door' },
      { id: 'fire', title: 'Fireside', desc: 'Light a campfire (right-click it)', goal: 1, reward: 20, on: 'campfireLit' },
      { id: 'fish', title: 'First catch', desc: 'Catch something with the fishing rod', goal: 1, reward: 30, on: 'caught' },
      { id: 'sell', title: 'Open for business', desc: 'Sell something to Marlow at the trading post', goal: 1, reward: 20, on: 'sold' },
      { id: 'cook', title: 'Beach barbecue', desc: 'Grill a fish over a lit campfire', goal: 1, reward: 30, on: 'cooked' },
      { id: 'bed', title: 'Sweet dreams', desc: 'Build a bed and sleep through the night', goal: 1, reward: 50, on: 'slept' },
      { id: 'pet', title: 'Best friends', desc: 'Befriend and adopt an island animal', goal: 1, reward: 80, on: 'adopted' },
      { id: 'decor', title: 'Interior designer', desc: 'Place 6 pieces of furniture', goal: 6, reward: 60, on: 'placed', test: (k) => G.BLOCK_BY_KEY[k].cat === 'furniture' },
      { id: 'garden', title: 'Green thumb', desc: 'Plant 3 seeds (tall grass sometimes hides them)', goal: 3, reward: 40, on: 'planted' },
      { id: 'bottle', title: 'Message from afar', desc: 'Find a message in a bottle on the beach', goal: 1, reward: 30, on: 'bottle' },
      { id: 'angler', title: 'Seasoned angler', desc: 'Catch 5 different kinds of fish', goal: 5, reward: 100, on: 'newfish' },
      { id: 'collector', title: 'Shell collector', desc: 'Find 6 different kinds of beach treasure', goal: 6, reward: 120, on: 'newshell' },
      { id: 'hello', title: 'Howdy, neighbours', desc: 'Find and greet all three islanders in their huts', goal: 3, reward: 30, on: 'metVillager' },
      { id: 'favour', title: 'Good neighbour', desc: 'Bring an islander the thing they asked for', goal: 1, reward: 50, on: 'favour' },
      { id: 'treasure', title: 'X marks the spot', desc: 'Dig up a sparkling patch of sand with your shovel', goal: 1, reward: 30, on: 'treasure' },
      { id: 'cozy', title: 'Home sweet home', desc: 'Sleep in a home that rates ★★★ cozy or better', goal: 1, reward: 80, on: 'cozy3' },
      { id: 'bug', title: 'Flutter by', desc: 'Make a bug net (Tab → Basics) and catch a butterfly', goal: 1, reward: 30, on: 'caughtBug' },
      { id: 'sail', title: 'Set sail', desc: 'Build a rowboat at the workbench, launch it and hop in', goal: 1, reward: 60, on: 'boarded' },
      { id: 'lighthouse', title: 'The old lighthouse', desc: 'Row out to the islet in the north-west and open the keeper\'s chest', goal: 1, reward: 100, on: 'lighthouse' },
      { id: 'fruit', title: 'Orchard stroll', desc: 'Pick 6 fruits hanging under the trees', goal: 6, reward: 30, on: 'collect', test: (id, n, def) => def && def.fruit },
      { id: 'museum', title: 'Curator\'s helper', desc: 'Show Clementine 10 different fish, shells or bugs', goal: 10, reward: 100, on: 'donated' },
      { id: 'balloon', title: 'Up, up and away', desc: 'Pop a balloon drifting over the island and catch its present', goal: 1, reward: 30, on: 'balloon' },
      { id: 'wave', title: 'Friendly face', desc: 'Wave (press G) near one of your neighbours', goal: 1, reward: 15, on: 'wavedAt' },
      { id: 'visitor', title: 'Passing through', desc: 'Meet the travelling tinker when he visits the beach', goal: 1, reward: 20, on: 'metVisitor' },
      { id: 'stargaze', title: 'Stargazer', desc: 'Sit beside a lit campfire after dark', goal: 1, reward: 40, on: 'stargaze' },
      { id: 'wish', title: 'Wish upon a star', desc: 'Press G when a shooting star streaks across the night sky', goal: 1, reward: 40, on: 'wished' },
      { id: 'shopper', title: 'Treat yourself', desc: 'Buy something from Marlow\'s trading post', goal: 1, reward: 20, on: 'bought' },
      { id: 'harvest', title: 'Harvest basket', desc: 'Pick 5 home-grown vegetables', goal: 5, reward: 60, on: 'collect', test: (id) => id === 'carrot' || id === 'corn' || id === 'melon' },
      { id: 'chef', title: 'Island chef', desc: 'Cook 3 dishes at a campfire or stove (Tab → Cooking)', goal: 3, reward: 60, on: 'cooked' },
      { id: 'bugs4', title: 'Bug watcher', desc: 'Catch 4 different kinds of bugs', goal: 4, reward: 80, on: 'newbug' },
      { id: 'rainbow', title: 'After the rain', desc: 'Be outside when a shower ends in daylight', goal: 1, reward: 30, on: 'rainbow' },
      { id: 'friend3', title: 'Close friends', desc: 'Reach three hearts with a neighbour', goal: 1, reward: 100, on: 'friendUp', test: (id, level) => level >= 3 },
      { id: 'petpals', title: 'Animal house', desc: 'Adopt three island animals', goal: 3, reward: 120, on: 'adopted' },
      { id: 'builder', title: 'Master builder', desc: 'Place 100 building blocks', goal: 100, reward: 100, on: 'placed', test: (k) => G.BLOCK_BY_KEY[k].cat === 'build' },
      { id: 'allfish', title: 'Old salt', desc: 'Catch 10 different kinds of fish', goal: 10, reward: 200, on: 'newfish' },
    ],
    active() { return this.list.filter((q) => !this.done[q.id]).slice(0, 3); },
  };
  for (const q of Q.list) {
    G.on(q.on, (a, b, c) => {
      if (Q.done[q.id]) return;
      // only the visible three (plus anything already started) make progress, so the list reads like a gentle guide
      const inc = q.test ? (q.test(a, b, c) ? (q.on === 'collect' ? b : 1) : 0) : 1;
      if (!inc) return;
      Q.progress[q.id] = (Q.progress[q.id] || 0) + inc;
      if (Q.progress[q.id] >= q.goal) {
        Q.done[q.id] = true;
        G.addPearls(q.reward);
        G.ui.toast('✅ ' + q.title + ' &nbsp;+<i class="pearl"></i>' + q.reward, 'big');
        G.emit('sfx', 'fanfare');
      }
      G.ui.renderTasks();
    });
  }

  // ---------------- the island collection (shown to Clementine) ----------------
  const allFinds = () => G.FISH.filter((f) => !f.junk).map((f) => f.id).concat(G.SHELL_TABLE.map((s) => s.id), G.BUGS.map((b) => b.id));
  G.newFinds = function () {
    const done = G.flags.donated || {}, j = G.journal;
    return allFinds().filter((id) => !done[id] && ((j.fish && j.fish[id]) || (j.shells && j.shells[id]) || (j.bugs && j.bugs[id])));
  };
  // milestone presents for the collection; anything that did not fit is offered again next time
  G.claimMuseumGifts = function () {
    const total = Object.keys(G.flags.donated || {}).length, all = allFinds().length;
    const given = (G.flags.museumGifts = G.flags.museumGifts || {}), out = [];
    for (const [n, item] of [[5, 'fish_tank'], [10, 'telescope'], [18, 'globe'], [all, 'record_player']]) {
      if (total >= n && !given[n] && G.hasRoom(item, 1)) { given[n] = true; G.addItem(item, 1, true); out.push(G.itemLabel(item)); }
    }
    return out;
  };
  G.donateFinds = function () {
    const fresh = G.newFinds(), done = (G.flags.donated = G.flags.donated || {});
    const before = Object.keys(done).length;
    for (const id of fresh) done[id] = true;
    const total = Object.keys(done).length, all = allFinds().length;
    const pearls = fresh.length * 15;
    G.addPearls(pearls);
    const gift = G.claimMuseumGifts().join(', ') || null;
    for (let k = 0; k < fresh.length; k++) G.emit('donated');
    return { count: fresh.length, names: fresh.map((id) => G.itemLabel(id)), pearls, total, all, gift };
  };

  // journal bookkeeping
  G.on('collect', (id, n, def) => {
    if (def && def.shell) {
      if (!G.journal.shells[id]) { G.ui.toast('I found a <b>' + G.itemLabel(id) + '</b>!' + G.quip(id) + ' <b>New for your journal!</b>', 'good'); G.journal.shells[id] = 0; G.emit('newshell', id); }
      G.journal.shells[id] += n;
    }
  });
  G.on('caught', (id) => {
    if (!G.ITEMS[id] || !G.ITEMS[id].fish) return;
    if (!G.journal.fish[id]) { G.journal.fish[id] = 0; G.emit('newfish', id); }
    G.journal.fish[id]++;
  });
  G.on('placed', (k, x, y, z) => { trackGrowable(x, y, z); });
  G.on('broke', (k, x, y, z) => { growables.delete(x + ',' + y + ',' + z); if (G.requestSave) G.requestSave(); });
  // a little morning announcement, the way a good island should start its day
  const MORNING = [
    'Marlow has fresh specials at the trading post.',
    'New shells have washed up along the shore.',
    'The fruit trees look heavy this morning.',
    'A good day to visit the neighbours.',
    'The fish are jumping off the pier.',
    'Keep an eye on the sky for balloons.',
  ];
  G.on('morning', (afterSleep) => {
    if (G.flags.wishes > 0) {
      const got = spawnStars(G.flags.wishes + 1);
      G.flags.wishes = 0;
      if (got) setTimeout(() => { if (!G.ui.titleOpen) G.ui.toast('✨ Your wish came true — star fragments are glittering on the beach', 'good'); }, afterSleep ? 7000 : 3600);
    }
    setTimeout(() => {
      if (G.ui.titleOpen) return;
      const who = G.flags.playerName ? ', ' + G.flags.playerName : '';
      const isle = (G.flags.islandName || 'Tidewood') + ' Isle';
      G.ui.toast('☀️ Good morning' + who + '! Day ' + G.day + ' on ' + isle + '. ' + G.pick(MORNING), 'big');
    }, afterSleep ? 3600 : 400);
  });
  G.on('newday', (slept) => {
    G.growFruit(0.55);
    if (G.flags.petRespawn && G.flags.petRespawn.length && G.spawnWildPet) { for (const k of G.flags.petRespawn) G.spawnWildPet(k); G.flags.petRespawn = []; }
    refreshBeach(46);
    if (slept) growTick(true);
    G._beachTimer = 0;
  });

  // ---------------- init & per-frame ----------------
  G.initGame = function (save) {
    G.initFx();
    if (G.initAmbient) { G.initAmbient(); G.spawnGlimmers(5); }
    G.initInteract();
    G.ui.init();
    spawnTrader();
    if (G.initPets) G.initPets(save);
    if (G.initVillagers) G.initVillagers(save);
    { const q = Q.list.find((x) => x.id === 'hello'); if (q) q.goal = Math.max(1, (G.villagers || []).length); }
    if (G.initMap) G.initMap();
    if (G.initBoats) G.initBoats(save);
    if (G.initFishing) G.initFishing();
    if (G.initAudio) G.initAudio();
    G.scanGrowables();
    if (G.world.lighthouse && G.flags.lighthouseChest !== G.world.lighthouse.chest) {
      G.flags.lighthouseChest = G.world.lighthouse.chest;
      // the old keeper left a few things behind
      const c = new Array(18).fill(null);
      [['pearl_oyster', 1], ['shell_nautilus', 1], ['string_lights', 3], ['lamp_post', 1], ['sapling_pink', 2], ['seed_melon', 4], ['ship_wheel', 1], ['fish_trophy', 1]].forEach((it, i) => { c[i] = { id: it[0], n: it[1] }; });
      G.chests[G.world.lighthouse.chest] = c;
    }
    if (!save || !G.flags.fruitSeeded) { G.flags.fruitSeeded = true; G.growFruit(0.8); }
    if (!save) {
      G.addItem('axe', 1, true); G.addItem('pickaxe', 1, true); G.addItem('shovel', 1, true); G.addItem('fishing_rod', 1, true);
      G.addItem('planks', 24, true); G.addItem('torch', 4, true); G.addItem('pet_treat', 3, true); G.addItem('berry', 4, true);
      G.inv.pearls = 20;
      G.inv.sel = 8;
    }
    // the tent and lantern arrive once per island, including islands started before they existed
    if (!G.flags.starterTent) { G.flags.starterTent = true; G.addItem('tent', 1, true); G.addItem('lantern', 1, true); }
    // a bug net too, so the butterflies can be chased from the very first morning
    if (!G.flags.starterNet) { G.flags.starterNet = true; if (!G.countItem('net')) G.addItem('net', 1, true); }
    if (save) {
      const P = G.player;
      if (!G.aabbFree(P.pos.x, P.pos.y + 0.01, P.pos.z, P.hw, P.height)) {
        let done = false;
        for (let r = 0; r <= 4 && !done; r++) for (let dy = 0; dy <= 3 && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) for (let dz = -r; dz <= r && !done; dz++) {
          const x = Math.floor(P.pos.x) + dx + 0.5, y = Math.floor(P.pos.y) + dy + 0.02, z = Math.floor(P.pos.z) + dz + 0.5;
          if (G.aabbFree(x, y, z, P.hw, P.height)) { P.pos.set(x, y, z); done = true; }
        }
      }
    }
    G.ui.renderTasks();
    G.invDirty = true;
    G.paused = true;
    G.on('gamestart', () => {
      G.paused = false;
      if (!G.flags.welcomed || !G.flags.playerName) {
        const clean = (v, d) => (v || '').replace(/[<>&"]/g, '').trim().slice(0, 16) || d;
        const pickLook = () => { G.ui.openWardrobe(); G.ui.toast('Choose your look — press <kbd>O</kbd> any time to change it', 'good'); };
        const askIsland = () => G.ui.dialog({
          title: 'Name your island', html: 'Every island needs a name. What shall this one be called?', locked: true,
          input: { value: 'Tidewood' },
          buttons: [{ label: 'That\'s the one', primary: true, fn: (v) => { G.flags.islandName = clean(v, 'Tidewood'); G.flags.welcomed = true; G.ui.refreshNames(); pickLook(); if (G.requestSave) G.requestSave(); } }],
        });
        const askName = () => G.ui.dialog({
          title: 'What should we call you?', html: 'The neighbours will want to know your name.', locked: true,
          input: { value: '', placeholder: 'Your name' },
          buttons: [{ label: 'Nice to meet you', primary: true, fn: (v) => { G.flags.playerName = clean(v, 'Islander'); askIsland(); } }],
        });
        setTimeout(() => G.ui.dialog({
          title: 'Welcome ashore 🏝️',
          html: 'The tide set you down on a quiet beach with a backpack, a few tools and all the time in the world.<br><br>Comb the shore for <b>shells</b>, pick <b>fruit</b>, chop wood to <b>build a home</b>, cast a line off the <b>pier</b>, and say hello to <b>Marlow</b> at the trading post.<br><br>Your to-do list (top right) has ideas. Press <kbd>H</kbd> any time for help.',
          locked: true,
          buttons: [{ label: "Let's begin", primary: true, fn: askName }],
        }), 500);
      }
    });
  };

  let slowT = 0, fireT = 0, saveT = 0, waterT = 0, tipT = 0, tipYaw = 0.3, slowT2 = 0, slowHinted = false;
  G.updateGame = function (dt) {
    const t = performance.now() * 0.001;
    for (const e of G.entities) e.update && e.update(dt, t);
    if (G.updatePets) G.updatePets(dt, t);
    if (G.fishing) G.fishing.update(dt, t);
    G.updateFx(dt);
    if (G.updateAmbient) G.updateAmbient(dt, t);
    if (G.updateAudio) G.updateAudio(dt);
    if (G.updateMap) G.updateMap(dt);

    // flames & smoke for lit fires near the player
    fireT -= dt;
    if (fireT <= 0) {
      fireT = 0.09;
      const p = G.player.pos;
      for (const s of G.lightSources.values()) {
        if (!s.flicker) continue;
        if ((s.x - p.x) ** 2 + (s.z - p.z) ** 2 > 28 * 28) continue;
        const big = s.power > 1;
        const go = G.groundOffsetAt(s.x + 0.5, s.y, s.z + 0.5);
        G.burst(s.x + 0.5, s.y + go + (big ? 0.35 : s.h), s.z + 0.5, { n: big ? 2 : 1, colors: [0xffd27a, 0xff9a4a, 0xff7a3c], speed: 0.25, up: big ? 1.7 : 0.8, grav: -1.2, life: big ? 0.6 : 0.35, size: big ? 0.16 : 0.07, glow: true, spread: big ? 0.22 : 0.04 });
        if (big && Math.random() < 0.25) G.burst(s.x + 0.5, s.y + 1.1, s.z + 0.5, { n: 1, color: 0xd9d4cc, speed: 0.2, up: 1.1, grav: -0.6, life: 1.6, size: 0.14, spread: 0.15 });
      }
    }

    slowT -= dt;
    if (slowT <= 0) {
      slowT = 4;
      growTick(false);
      if (G.weather && G.weather.raining) growTick(false);   // rain helps the garden along
      // a new shell washes up now and then
      G._beachTimer = (G._beachTimer || 0) + 4;
      if (G._beachTimer > 75) { G._beachTimer = 0; if (countFinds() < 40) spawnFind(); }
      // cozy moment: sitting by a fire at night
      if (G.player.sitting && G.nightAmount > 0.6) {
        const p = G.player.pos;
        for (const s of G.lightSources.values()) if (s.power > 1 && (s.x - p.x) ** 2 + (s.z - p.z) ** 2 < 16) { G.emit('stargaze'); break; }
      }
    }
    if (G.waterDirty) { waterT += dt; if (waterT > 0.6) { waterT = 0; G.waterDirty = false; G.buildWater(); } }

    // if it is running slowly, point out the simpler graphics switch once
    if (!G.simple && !slowHinted && G.fps < 26) { slowT2 += dt; if (slowT2 > 12) { slowHinted = true; G.ui.toast('Running a little slowly? Press <kbd>H</kbd> and choose <b>Simpler graphics</b>.'); } } else slowT2 = 0;
    // one-time tips, shown when they first become relevant
    if (G.cam.cutActive && G.cam.cutRadius > 5 && !G.flags.tipRoof) { G.flags.tipRoof = true; G.ui.toast('The roof lifts away while you are indoors · press <kbd>V</kbd> to keep roofs visible'); }
    if (!G.flags.tipCam) {
      tipT += dt;
      if (Math.abs(G.cam.yaw - tipYaw) > 0.5) G.flags.tipCam = true;
      else if (tipT > 35) { G.flags.tipCam = true; G.ui.toast('Tip: <kbd>Q</kbd> and <kbd>E</kbd> turn the camera, <kbd>Z</kbd> and <kbd>C</kbd> tilt it'); }
    }

    saveT += dt;
    if (saveT > 25 || (G._saveWanted && saveT > 3)) { saveT = 0; G._saveWanted = false; if (G.saveGame) G.saveGame(); }
  };
  G.requestSave = () => { G._saveWanted = true; };

  // ---------------- debug / test helpers (window.game.debug) ----------------
  G.debug = {
    give: (id, n) => G.addItem(id, n || 1, true),
    tp: (x, z) => { const y = G.topSolid(Math.floor(x), Math.floor(z)); G.player.pos.set(x + 0.5, y + 1.05, z + 0.5); G.player.vel.set(0, 0, 0); G.cam.target.copy(G.player.pos); },
    time: (h) => { G.time = h; },
    start: () => { G.flags.welcomed = true; if (!G.flags.playerName) G.flags.playerName = 'Islander'; if (!G.flags.islandName) G.flags.islandName = 'Tidewood'; const b = document.getElementById('btn-play'); if (b) b.click(); if (G.ui.panel === 'dialog') { G.ui.dialogLocked = false; G.ui.close(); } },
    screenOf: (x, y, z) => G.toScreen(x, y, z),
  };
})();
