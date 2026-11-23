// Tidewood Isle — island neighbours: they wander near their huts, chat, ask small favours and become friends.
'use strict';
(function () {
  G.villagers = [];

  const DEFS = {
    juniper: {
      name: 'Juniper', icon: '🦌', kind: 'deer', title: 'the gardener',
      wants: [['fruit_apple', 2], ['fruit_peach', 2], ['fruit_cherry', 2], ['flower_red', 3], ['flower_yellow', 3], ['flower_blue', 3], ['flower_pink', 3], ['berry', 4], ['mushroom', 2], ['carrot', 2], ['fiber', 6], ['corn', 2]],
      loves: ['flower_red', 'flower_yellow', 'flower_blue', 'flower_white', 'flower_pink', 'flower_purple', 'carrot', 'corn', 'melon', 'berry', 'fruit_salad', 'fruit_apple', 'fruit_orange', 'fruit_peach', 'fruit_cherry', 'fruit_pie'],
      gifts: ['planter', 'sapling_pink', 'flower_pot', 'potted_palm', 'rug_pink'],
      hello: ['Oh! Hello, neighbour. Mind the seedlings.', 'Lovely day for growing things, isn\'t it?', 'You smell like sea salt. In a nice way!'],
      chat: [
        'I talk to my flowers every morning. The bluebells are the best listeners.',
        'If you plant seeds on grass they turn it into garden soil all by themselves. Clever little things.',
        'Rain is just the sky doing my watering for me.',
        'Blossom trees grow from pink saplings. Marlow sells them, the rascal.',
        'Tall grass hides seeds sometimes. Give it a swish.',
        'Berry bushes grow their berries back if you leave them a day.',
        'Some trees carry apples, oranges or peaches. Pick them and more ripen in a day or two.',
        'The pink blossom trees give cherries. Sweetest thing on the island.',
        'If you see a shooting star, wish on it. Mine came true — I wished for more flowers.',
        'I pressed a daisy in my journal today. It looked so pleased with itself.',
        'Your footprints wandered right past my garden this morning. I do like knowing you were about.',
        'A pot of flowers by the door makes any house say hello.',
        'Bees, butterflies and me — we all keep the same hours.',
      ],
      night: 'Even the daisies are asleep… I should be too.',
    },
    otis: {
      name: 'Otis', icon: '🐦', kind: 'pelican', title: 'the angler',
      wants: [['fish_sardine', 2], ['fish_shrimp', 2], ['fish_clown', 1], ['cooked_fish', 1], ['driftwood', 3], ['fish_carp', 2], ['fish_crab', 1], ['seaweed', 3]],
      loves: ['fish', 'cooked_fish'],
      gifts: ['fish_trophy', 'life_ring', 'ship_wheel', 'surfboard', 'fish_tank'],
      hello: ['Ahoy! Catch anything good?', 'Tide\'s in a fine mood today.', 'Well, if it isn\'t my favourite landlubber.'],
      chat: [
        'The moment the bobber splashes — that\'s your moment. Not before, not after.',
        'Squid and jellies only come up after dark. Worth staying awake for.',
        'The lagoon out east has koi. Proper fancy ones.',
        'A shadow in the water means something is curious about your bait.',
        'Grill your catch over a campfire. Sells better, tastes better.',
        'I once reeled in a boot. Still looking for the other one.',
        'Fish bite better when you hum. Scientific fact. Probably.',
        'Wish on a shooting star and the tide brings star fragments by morning. Saw it happen once.',
        'I follow my own footprints home across the sand. Never been lost yet!',
        'A rowboat will take you out to the old lighthouse. Mind the gulls, they gossip.',
        'The trick to a happy life? A full bucket and nowhere to be.',
      ],
      night: 'Night fishing… the best kind. Shh, you\'ll scare the squid.',
    },
    clementine: {
      name: 'Clementine', icon: '🐢', kind: 'tortoise', title: 'the collector',
      wants: [['shell_cockle', 3], ['shell_scallop', 2], ['starfish', 2], ['sand_dollar', 1], ['coconut', 2], ['coral_pink', 1], ['shell_conch', 1], ['pebble', 0]].filter((w) => w[1] > 0),
      loves: ['shell_cockle', 'shell_scallop', 'shell_conch', 'shell_whelk', 'starfish', 'sand_dollar', 'shell_nautilus', 'pearl_oyster', 'coconut'],
      gifts: ['mirror', 'beach_umbrella', 'beach_ball', 'string_lights', 'hammock'],
      hello: ['Take your time, dear. I always do.', 'Good day! I\'ve only just finished yesterday\'s walk.', 'Oh, hello. Have you seen the shells this morning?'],
      chat: [
        'New shells wash up every morning. I get to about three of them before lunch.',
        'See a sparkle in the sand? Dig there with your shovel. Trust me.',
        'A Moonlit Nautilus is the rarest thing on this beach. I have seen two in ninety years.',
        'There is no hurry on an island. The island is not going anywhere.',
        'Bottles wash ashore now and then. Somebody out there likes writing letters.',
        'A home is just a shell you build yourself. Make it a cosy one.',
        'Star fragments wash up after a wish. Two of them and a stone make a lamp, I am told.',
        'I counted the footprints on the beach today. Then the tide came in and I started over.',
        'Set down a bed or a tent and the little map marks it as home. Handy when you walk as slowly as I do.',
        'I have been meaning to finish my tea since Tuesday.',
        'Show me anything new you find, dear. My collection book has plenty of empty pages.',
      ],
      night: 'The stars are the sky\'s shell collection, you know.',
    },
  };
  G.VILLAGER_DEFS = DEFS;

  function buildModel(kind) {
    const g = new THREE.Group(), u = {};
    const dark = 0x3a2e2a;
    let fur, belly, scarf;
    if (kind === 'deer') { fur = 0xc98f5a; belly = 0xf6e3c8; scarf = 0x6fb38a; }
    else if (kind === 'hedgehog') { fur = 0xe2c29a; belly = 0xfff3e0; scarf = 0xe0625a; }
    else if (kind === 'pelican') { fur = 0xf7f7f2; belly = 0xffffff; scarf = 0x5f93c9; }
    else { fur = 0x8fbf6a; belly = 0xe9e2a8; scarf = 0xf5b041; }
    g.add(G.box(0.5, 0.6, 0.38, fur, 0, 0.14, 0));
    g.add(G.box(0.34, 0.42, 0.05, belly, 0, 0.2, 0.19));
    g.add(G.box(0.54, 0.1, 0.42, scarf, 0, 0.66, 0));                     // scarf
    const head = new THREE.Group(); head.position.set(0, 0.76, 0.02);
    head.add(G.box(0.5, 0.42, 0.42, fur));
    u.eyes = [G.box(0.06, 0.08, 0.02, dark, -0.13, 0.24, 0.215), G.box(0.06, 0.08, 0.02, dark, 0.13, 0.24, 0.215)];
    head.add(u.eyes[0], u.eyes[1]);
    head.add(G.box(0.025, 0.03, 0.02, 0xffffff, -0.115, 0.29, 0.221)); head.add(G.box(0.025, 0.03, 0.02, 0xffffff, 0.145, 0.29, 0.221));
    head.add(G.box(0.08, 0.05, 0.02, 0xffa8a0, -0.2, 0.15, 0.215));
    head.add(G.box(0.08, 0.05, 0.02, 0xffa8a0, 0.2, 0.15, 0.215));
    if (kind === 'deer') {
      head.add(G.box(0.26, 0.18, 0.12, belly, 0, 0.02, 0.22)); head.add(G.box(0.1, 0.07, 0.04, dark, 0, 0.13, 0.3));
      head.add(G.box(0.14, 0.1, 0.06, fur, -0.3, 0.3, 0)); head.add(G.box(0.14, 0.1, 0.06, fur, 0.3, 0.3, 0));
      for (const sx of [-1, 1]) { head.add(G.box(0.05, 0.22, 0.05, 0x8a6a4a, sx * 0.14, 0.42, -0.04)); head.add(G.box(0.14, 0.05, 0.05, 0x8a6a4a, sx * 0.2, 0.56, -0.04)); }
    } else if (kind === 'hedgehog') {
      head.add(G.box(0.2, 0.14, 0.14, belly, 0, 0.04, 0.24)); head.add(G.box(0.08, 0.07, 0.05, dark, 0, 0.1, 0.33));
      head.add(G.box(0.12, 0.12, 0.06, fur, -0.2, 0.38, 0.04)); head.add(G.box(0.12, 0.12, 0.06, fur, 0.2, 0.38, 0.04));
      head.add(G.box(0.52, 0.2, 0.3, 0x8a6244, 0, 0.3, -0.12));                                  // spiky fringe
      g.add(G.box(0.58, 0.6, 0.2, 0x8a6244, 0, 0.16, -0.24));                                     // prickly back
      for (const [sx, sy] of [[-0.18, 0.62], [0.02, 0.7], [0.2, 0.6], [-0.1, 0.4], [0.12, 0.36]]) g.add(G.box(0.1, 0.1, 0.12, 0x6f4c34, sx, sy, -0.36));
      g.add(G.box(0.4, 0.34, 0.24, 0xc99a62, 0, 0.2, -0.5));                                      // a pack full of wares
      g.add(G.box(0.42, 0.06, 0.26, 0xe0625a, 0, 0.46, -0.5));
    } else if (kind === 'pelican') {
      head.add(G.box(0.22, 0.12, 0.34, 0xf5b041, 0, 0.06, 0.34)); head.add(G.box(0.2, 0.1, 0.26, 0xf7cf6b, 0, -0.02, 0.3));
      head.add(G.box(0.3, 0.08, 0.3, 0x5f93c9, 0, 0.42, 0)); head.add(G.box(0.34, 0.04, 0.2, 0x5f93c9, 0, 0.42, 0.2));     // cap
    } else {
      head.add(G.box(0.24, 0.08, 0.04, 0x6a9a4a, 0, 0.06, 0.215));
      head.add(G.box(0.78, 0.05, 0.78, 0xf2d88a, 0, 0.42, 0)); head.add(G.box(0.44, 0.16, 0.44, 0xf2d88a, 0, 0.46, 0));      // straw hat
      g.add(G.box(0.62, 0.56, 0.22, 0x9a6f4a, 0, 0.16, -0.26)); g.add(G.box(0.46, 0.4, 0.06, 0xb98a5e, 0, 0.24, -0.39));     // shell
    }
    g.add(head); u.head = head;
    const limb = (x, y, w, h, color) => { const p = new THREE.Group(); p.position.set(x, y, 0); p.add(G.box(w, h, w + 0.02, color, 0, -h, 0)); g.add(p); return p; };
    const feet = kind === 'pelican' ? 0xf5b041 : fur;
    u.legL = limb(-0.13, 0.16, 0.14, 0.16, feet); u.legR = limb(0.13, 0.16, 0.14, 0.16, feet);
    u.armL = limb(-0.31, 0.62, 0.12, 0.34, fur); u.armR = limb(0.31, 0.62, 0.12, 0.34, fur);
    g.scale.setScalar(1.08);
    g.userData = u;
    return g;
  }

  const hearts = (v) => Math.min(5, Math.floor(v.friend / 20));
  const heartStr = (v) => '❤️'.repeat(hearts(v)) + '🤍'.repeat(5 - hearts(v));

  function newRequest(v) {
    const D = DEFS[v.id];
    const w = G.pick(D.wants);
    v.request = { id: w[0], n: w[1], day: G.day };
  }

  function addFriend(v, pts, quiet) {
    const D = DEFS[v.id];
    const before = hearts(v);
    v.friend = Math.min(100, v.friend + pts);
    const after = hearts(v);
    if (!quiet) G.burst(v.pos.x, v.pos.y + 1.5, v.pos.z, { n: 6, colors: [0xff8fa3, 0xffb3c1], speed: 0.8, up: 1.8, grav: -0.5, life: 1, size: 0.1, glow: true });
    if (after > before) {
      const gift = D.gifts[(after - 1) % D.gifts.length];
      setTimeout(() => {
        if (!G.hasRoom(gift, 1)) { (v.owed = v.owed || []).push(gift); G.ui.toast(D.name + ' has a present for you — make room in your backpack and say hello again', 'good'); return; }
        G.addItem(gift, 1, true);
        G.emit('sfx', 'fanfare');
        G.emit('friendUp', v.id, after);
        G.ui.dialog({
          title: D.icon + ' ' + D.name + ' ' + '❤️'.repeat(after),
          html: '“We\'re becoming real friends, you and I. I\'d like you to have this.”<br><br><b>' + G.iconHTML(gift) + ' ' + G.itemLabel(gift) + '</b> was added to your backpack.',
          buttons: [{ label: 'Thank you!', primary: true }],
        });
      }, 900);
    }
  }

  function talk(v) {
    const D = DEFS[v.id];
    G.facePlayerTo(v.pos.x, v.pos.z);
    v.yaw = Math.atan2(G.player.pos.x - v.pos.x, G.player.pos.z - v.pos.z);
    v.pause = 4; v.goal = null;
    if (G.audio) G.audio.speak(D.kind === 'deer' ? 640 : D.kind === 'pelican' ? 470 : 320, 10);
    if (!v.met) { v.met = true; G.emit('metVillager', v.id); }
    if (v.id === 'clementine') { const late = G.claimMuseumGifts(); if (late.length) G.ui.toast('Clementine saved a collection gift for you: ' + late.join(', '), 'good'); }
    if (v.owed && v.owed.length && G.hasRoom(v.owed[0], 1)) {
      const gift = v.owed.shift();
      G.addItem(gift, 1, true); G.emit('sfx', 'fanfare');
      G.ui.dialog({ title: D.icon + ' ' + D.name, html: '“There you are! I saved this for you.”<br><br><b>' + G.iconHTML(gift) + ' ' + G.itemLabel(gift) + '</b> was added to your backpack.', buttons: [{ label: 'Thank you!', primary: true }] });
      return;
    }
    const title = D.icon + ' ' + D.name + ' <small style="font-weight:600;color:#8a715c">' + D.title + '</small>';
    const buttons = [];
    let line;
    const held = G.heldItem(), slot = G.heldSlot();
    const req = v.request;
    if (req && G.countItem(req.id) >= req.n) {
      line = '“Is that… ' + req.n + ' × ' + G.itemLabel(req.id) + '? For me?”';
      buttons.push({
        label: 'Here you go! (' + req.n + ' × ' + G.itemLabel(req.id) + ')', primary: true, fn: () => {
          G.removeItem(req.id, req.n);
          const pay = Math.round(((G.ITEMS[req.id].value || 4) * req.n) * 2 + 18);
          G.addPearls(pay);
          v.request = null; v.lastRequestDay = G.day;
          G.emit('sfx', 'coin'); G.emit('favour', v.id);
          G.ui.toast(D.name + ' is delighted! +<i class="pearl"></i>' + pay, 'good');
          addFriend(v, 12);
        },
      });
      buttons.push({ label: 'Not yet' });
    } else if (req) {
      line = '“Still hoping for ' + req.n + ' × ' + G.itemLabel(req.id) + ' ' + G.iconHTML(req.id) + ' if you come across ' + (req.n > 1 ? 'them' : 'one') + '. No rush at all.”';
      buttons.push({ label: 'I\'m on it', primary: true });
    } else if (v.lastRequestDay !== G.day && v.chats >= 1) {
      newRequest(v);
      line = '“Could I ask a small favour? I\'d love <b>' + v.request.n + ' × ' + G.itemLabel(v.request.id) + '</b> ' + G.iconHTML(v.request.id) + '. I\'ll make it worth your while!”';
      buttons.push({ label: 'Happy to help', primary: true, fn: () => G.ui.toast('Favour for ' + D.name + ': ' + v.request.n + ' × ' + G.itemLabel(v.request.id)) });
      buttons.push({ label: 'Maybe later', fn: () => { v.request = null; v.lastRequestDay = G.day; } });
    } else {
      if (G.isNight()) line = '“' + D.night + '”';
      else if (G.weather && G.weather.raining && Math.random() < 0.5) line = '“A little rain never hurt anybody. Except sandcastles.”';
      else line = '“' + (v.chats === 0 || Math.random() < 0.3 ? G.pick(D.hello) : G.pick(D.chat)) + '”';
      if (G.flags.playerName && Math.random() < 0.45) line = line.replace('“', '“' + G.flags.playerName + '! ');
      buttons.push({ label: 'Nice chatting', primary: true });
    }
    // first chat of the day warms the friendship a little
    if (v.lastChatDay !== G.day) { v.lastChatDay = G.day; addFriend(v, 3, true); }
    v.chats++;
    // Clementine keeps the island collection: show her each new kind of fish, shell or bug
    if (v.id === 'clementine') {
      const fresh = G.newFinds();
      if (fresh.length) buttons.unshift({
        label: 'Show my new finds (' + fresh.length + ')', primary: !buttons.some((b) => b.fn), fn: () => {
          const got = G.donateFinds();
          G.emit('sfx', 'fanfare');
          G.ui.dialog({
            title: '🐢 The island collection',
            html: '“Oh, marvellous! ' + got.count + ' new ' + (got.count === 1 ? 'entry' : 'entries') + ' for the collection.”<br><br>' + got.names.slice(0, 8).join(', ') + (got.names.length > 8 ? '…' : '') + '<br><br><b>+<i class="pearl"></i>' + got.pearls + '</b> · collection: <b>' + got.total + ' / ' + got.all + '</b>' + (got.gift ? '<br><br>Milestone gift: <b>' + got.gift + '</b>' : ''),
            buttons: [{ label: 'Wonderful', primary: true }],
          });
          addFriend(v, Math.min(12, got.count * 2));
        },
      });
    }
    // offer whatever is in hand as a present
    if (held && slot && held.kind !== 'tool' && !(req && req.id === held.key)) {
      buttons.push({
        label: 'Give ' + held.label + ' 🎁', fn: () => {
          if (v.lastGiftDay === G.day) { G.ui.toast(D.name + ': “You already spoiled me today!”'); return; }
          const loved = D.loves.some((l) => l === held.key || (l === 'fish' && held.fish));
          G.consumeHeld(1);
          v.lastGiftDay = G.day;
          G.emit('sfx', 'pickup');
          G.ui.toast(D.name + (loved ? ' adores it! “My favourite!”' : ' smiles. “How thoughtful.”'), loved ? 'good' : '');
          addFriend(v, loved ? 10 : 4);
        },
      });
    }
    G.ui.dialog({ title, html: line + '<br><small>' + heartStr(v) + '</small>', buttons });
  }

  function makeVillager(hut, data) {
    const D = DEFS[hut.id];
    const v = {
      id: hut.id, kind: 'villager', name: D.name, hut,
      pos: new THREE.Vector3(hut.door.x, hut.door.y, hut.door.z), vel: new THREE.Vector3(), yaw: 0,
      model: buildModel(D.kind), pickRadius: 0.6, pickY: 0.7,
      friend: 0, chats: 0, request: null, met: false, inside: false, goal: null, pause: 2, phase: 0, onGround: false,
    };
    if (data) Object.assign(v, { friend: data.friend || 0, chats: data.chats || 0, request: data.request || null, met: !!data.met, lastChatDay: data.lastChatDay, lastGiftDay: data.lastGiftDay, lastRequestDay: data.lastRequestDay, owed: data.owed || (data.owedGift ? [data.owedGift] : []) });
    v.hint = () => '<kbd>Click</kbd> to chat with ' + D.name;
    v.interact = () => talk(v);
    v.update = (dt, t) => update(v, dt, t);
    const tag = document.createElement('div'); tag.className = 'nametag'; tag.style.display = 'none';
    document.getElementById('ui').appendChild(tag);
    v.tag = tag;
    G.scene.add(v.model);
    G.villagers.push(v);
    G.entities.push(v);
  }

  function update(v, dt, t) {
    const D = DEFS[v.id], P = G.player.pos, u = v.model.userData;
    const dp = Math.hypot(P.x - v.pos.x, P.z - v.pos.z);
    const bedtime = G.time >= 21.5 || G.time < 6.2;
    const slow = D.kind === 'tortoise' ? 0.6 : 1;
    v.pause -= dt;
    if (bedtime && !v.inside) {
      const dd = Math.hypot(v.hut.door.x - v.pos.x, v.hut.door.z - v.pos.z);
      if (dd < 0.7 || dp > 40) { v.inside = true; v.pos.set(v.hut.inside.x, v.hut.inside.y, v.hut.inside.z); v.vel.set(0, 0, 0); v.goal = null; v.yaw = 0; }
      else v.goal = { x: v.hut.door.x, z: v.hut.door.z };
    } else if (!bedtime && v.inside) {
      v.inside = false; v.pos.set(v.hut.door.x, v.hut.door.y + 0.1, v.hut.door.z); v.pause = 2;
    }
    if (!v.inside && !bedtime && !v.goal && v.pause <= 0) {
      v.pause = 3 + Math.random() * 6;
      const a = Math.random() * 6.28, r = 2 + Math.random() * 7;
      const gx = v.hut.door.x + Math.cos(a) * r, gz = v.hut.door.z + 2 + Math.sin(a) * r;
      const gy = G.groundY(Math.floor(gx), Math.floor(gz));
      if (gy >= G.SEA - 1 && Math.abs(gy + 1 - v.pos.y) < 3) v.goal = { x: gx, z: gz };
    }
    // stop to say hello when the player comes close
    if (dp < 2.6 && !v.inside && G.ui.panel !== 'dialog') { if (v.goal && !bedtime) v.goal = null; v.yaw += (G.mod(Math.atan2(P.x - v.pos.x, P.z - v.pos.z) - v.yaw + Math.PI, Math.PI * 2) - Math.PI) * Math.min(1, dt * 6); v.pause = Math.max(v.pause, 1.5); }
    let moving = false;
    if (v.goal && !v.inside) {
      const gx = v.goal.x - v.pos.x, gz = v.goal.z - v.pos.z, gd = Math.hypot(gx, gz);
      if (gd < 0.45) v.goal = null;
      else {
        const want = Math.atan2(gx, gz);
        v.yaw += (G.mod(want - v.yaw + Math.PI, Math.PI * 2) - Math.PI) * Math.min(1, dt * 7);
        const sp = 1.7 * slow * (bedtime ? 1.6 : 1);
        v.vel.x = Math.sin(v.yaw) * sp; v.vel.z = Math.cos(v.yaw) * sp;
        moving = true;
      }
    }
    if (!moving) { v.vel.x *= 0.6; v.vel.z *= 0.6; }
    if (!v.inside) {
      v.vel.y -= 24 * dt;
      const res = G.moveBody(v.pos, v.vel, 0.24, 1.2, dt, true, v.onGround && v.vel.y <= 0);
      v.onGround = res.ground;
      if ((res.hitX || res.hitZ) && moving && v.onGround) {
        if (G.aabbFree(v.pos.x + Math.sin(v.yaw) * 0.5, v.pos.y + 1.05, v.pos.z + Math.cos(v.yaw) * 0.5, 0.24, 1.2)) v.vel.y = 7.6;
        else if (!bedtime) { v.goal = null; v.pause = 1; }
      }
      // never wander off into the sea
      if (v.pos.y < G.WATER_Y - 0.4) { v.pos.set(v.hut.door.x, v.hut.door.y + 0.1, v.hut.door.z); v.vel.set(0, 0, 0); v.goal = null; }
    }
    const hs = Math.hypot(v.vel.x, v.vel.z);
    v.phase += dt * (3 + hs * 4);
    if (!v.inside) G.trackPrints(v, dt, hs, 0.9);
    const m = v.model;
    const gy = v.inside ? v.pos.y : G.visualGroundY(v.pos.x, v.pos.y, v.pos.z, v.onGround);
    v.visY = v.visY === undefined || Math.abs(gy - v.visY) > 1.6 ? gy : v.visY + (gy - v.visY) * Math.min(1, dt * 20);
    m.position.set(v.pos.x, v.visY + (hs > 0.2 ? Math.abs(Math.sin(v.phase)) * 0.04 : Math.sin(t * 2) * 0.01), v.pos.z);
    m.rotation.y = v.yaw;
    const sw = hs > 0.2 ? Math.sin(v.phase) * 0.6 : 0;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw; u.armR.rotation.x = sw;
    if (v.waveBack > 0) v.waveBack -= dt;
    if ((v.waveBack > 0 || dp < 4) && !v.inside && hs < 0.2 && !bedtime) u.armR.rotation.z = Math.sin(t * 8) * 0.4 + 2.4; else u.armR.rotation.z = 0;
    if (v.waveBack > 0) v.yaw += (G.mod(Math.atan2(P.x - v.pos.x, P.z - v.pos.z) - v.yaw + Math.PI, Math.PI * 2) - Math.PI) * Math.min(1, dt * 6);
    u.head.rotation.z = v.inside ? 0.25 : Math.sin(t * 1.1 + v.phase * 0.01) * 0.05;
    v.blink = (v.blink === undefined ? 2 + Math.random() * 3 : v.blink) - dt;
    if (v.blink < -0.12) v.blink = 2.5 + Math.random() * 4;
    if (u.eyes) for (const e of u.eyes) e.scale.y = v.blink < 0 || v.inside ? 0.12 : 1;
    // a passing thought floats up now and then when you are nearby
    if (!v.inside && dp < 9 && dp > 2 && !G.ui.blocking()) {
      v.muse = (v.muse === undefined ? 6 + Math.random() * 8 : v.muse) - dt;
      if (v.muse <= 0) {
        v.muse = 9 + Math.random() * 12;
        const pool = G.weather && G.weather.raining ? ['☔', '🌧️', '💧'] : G.isNight() ? ['🌙', '⭐', '😴'] : D.kind === 'deer' ? ['🌼', '🌱', '♪', '🍎'] : D.kind === 'pelican' ? ['🎣', '🐟', '♪', '🌊'] : ['🐚', '♪', '☀️', '⭐'];
        G.floatText(v.pos.x, v.pos.y + 2.0, v.pos.z, G.pick(pool));
      }
    }
    if (v.inside && dp < 12 && Math.random() < dt * 0.5) G.floatText(v.pos.x, v.pos.y + 1.5, v.pos.z, '💤');

    if (dp < 12 && !G.ui.blocking()) {
      const s = G.toScreen(v.pos.x, v.pos.y + 1.75, v.pos.z);
      if (s) {
        v.tag.style.display = ''; v.tag.style.left = s.x + 'px'; v.tag.style.top = s.y + 'px';
        const txt = D.name + (v.request && G.countItem(v.request.id) >= v.request.n ? ' 🎁' : v.request ? ' 💭' : '');
        if (v.tag._t !== txt) { v.tag._t = txt; v.tag.textContent = txt; }
      } else v.tag.style.display = 'none';
    } else v.tag.style.display = 'none';
  }

  // ---------------- a travelling visitor ----------------
  // Some mornings Bramble the tinker sets up on the beach until evening with three special offers.
  const WARES = [['telescope', 200], ['record_player', 140], ['bathtub', 170], ['fridge', 150], ['globe', 90], ['hammock', 95], ['fish_tank', 190], ['wardrobe', 120],
    ['string_lights', 28], ['lamp_post', 80], ['sofa', 160], ['bed_blue', 130], ['tiki_statue', 60], ['beach_umbrella', 110], ['rowboat', 150]];
  function visitorOffers() {
    const rnd = G.makeRng(G.world.seed + G.day * 131 + 7), pool = WARES.slice(), out = [];
    for (let i = 0; i < 3; i++) out.push(pool.splice((rnd() * pool.length) | 0, 1)[0]);
    return out;
  }
  function removeVisitor() {
    const v = G.visitor;
    if (!v) return;
    G.scene.remove(v.model); v.tag.remove();
    const i = G.entities.indexOf(v); if (i >= 0) G.entities.splice(i, 1);
    G.visitor = null;
  }
  G.spawnVisitor = function () {
    removeVisitor();
    const sp = G.world.spawn;
    let spot = null;
    for (let r = 3; r < 12 && !spot; r++) for (let a = 0; a < 12 && !spot; a++) {
      const x = Math.floor(sp.x + Math.cos(a * 0.52) * r), z = Math.floor(sp.z + 1 + Math.sin(a * 0.52) * r);
      const s = G.surfAt(x, z);
      if (s >= G.SEA - 1 && G.getBlock(x, s + 1, z) === 0 && G.getBlock(x, s + 2, z) === 0 && G.getBlock(x, s, z) === G.B.sand) spot = [x + 0.5, s + 1, z + 0.5];
    }
    if (!spot) return null;
    const model = buildModel('hedgehog');
    const tag = document.createElement('div'); tag.className = 'nametag'; tag.style.display = 'none'; tag.textContent = 'Bramble 🛍️';
    document.getElementById('ui').appendChild(tag);
    const v = G.visitor = { kind: 'visitor', name: 'Bramble', model, tag, pos: new THREE.Vector3(spot[0], spot[1], spot[2]), pickRadius: 0.6, pickY: 0.7, yaw: 0, day: G.day };
    v.hint = () => '<kbd>Click</kbd> to see what Bramble is selling';
    v.interact = () => {
      G.facePlayerTo(v.pos.x, v.pos.z);
      if (G.audio) G.audio.speak(540, 9); G.emit('metVisitor');
      const offers = visitorOffers();
      const buttons = offers.map(([id, price]) => ({
        label: G.itemLabel(id) + ' · ' + price + ' pearls', fn: () => {
          if (G.inv.pearls < price) { G.ui.toast('Bramble: “A few more pearls and it\'s yours!”'); return; }
          if (!G.hasRoom(id, 1)) { G.ui.toast('Your backpack is full'); return; }
          G.addPearls(-price); G.addItem(id, 1, true); G.emit('sfx', 'coin'); G.emit('bought', id);
          G.ui.toast('Bramble wraps up the ' + G.itemLabel(id) + ' for you', 'good');
        },
      }));
      buttons.push({ label: 'Just browsing', primary: true });
      G.ui.dialog({ title: '🦔 Bramble <small style="font-weight:600;color:#8a715c">the travelling tinker</small>', html: '“Just passing through! Three treasures from my pack, today only — cheaper than the trading post, too.”<br><small>You have <i class="pearl"></i>' + G.inv.pearls + ' pearls.</small>', buttons });
    };
    v.update = (dt, t) => {
      const P = G.player.pos, dp = Math.hypot(P.x - v.pos.x, P.z - v.pos.z);
      if (dp < 9) v.yaw += (G.mod(Math.atan2(P.x - v.pos.x, P.z - v.pos.z) - v.yaw + Math.PI, Math.PI * 2) - Math.PI) * Math.min(1, dt * 5);
      v.visY = G.visualGroundY(v.pos.x, v.pos.y, v.pos.z, true);
      model.position.set(v.pos.x, v.visY + Math.abs(Math.sin(t * 2.4)) * 0.03, v.pos.z);
      model.rotation.y = v.yaw;
      model.userData.armR.rotation.z = dp < 5 ? Math.sin(t * 8) * 0.4 + 2.4 : 0;
      if (dp < 14 && !G.ui.blocking()) { const s = G.toScreen(v.pos.x, v.pos.y + 1.8, v.pos.z); if (s) { tag.style.display = ''; tag.style.left = s.x + 'px'; tag.style.top = s.y + 'px'; } else tag.style.display = 'none'; } else tag.style.display = 'none';
      if (G.time >= 20 || G.time < 6 || G.day !== v.day) { G.flags.visitorDay = 0; removeVisitor(); }
    };
    G.scene.add(model);
    G.entities.push(v);
    G.flags.visitorDay = G.day;
    return v;
  };
  G.on('morning', () => {
    if (Math.random() < 0.5 && G.spawnVisitor()) setTimeout(() => G.ui.toast('🦔 A visitor has set up on the beach near the pier — Bramble the tinker is in town today', 'good'), 6500);
  });

  G.initVillagers = function (save) {
    if (G.flags.visitorDay === G.day && G.time >= 6 && G.time < 20) G.spawnVisitor();
    const saved = (save && save.villagers) || {};
    for (const hut of G.world.huts || []) makeVillager(hut, saved[hut.id]);
  };
  G.serializeVillagers = function () {
    const out = {};
    for (const v of G.villagers) out[v.id] = { friend: v.friend, chats: v.chats, request: v.request, met: v.met, lastChatDay: v.lastChatDay, lastGiftDay: v.lastGiftDay, lastRequestDay: v.lastRequestDay, owed: v.owed || [] };
    return out;
  };
})();
