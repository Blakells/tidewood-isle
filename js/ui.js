// Tidewood Isle — HUD and menus (all plain DOM).
'use strict';
(function () {
  const ui = G.ui = { panel: null, cursor: null, titleOpen: true, chestKey: null, craftTab: 'basics', shopTab: 'buy', journalTab: 'fish' };
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  ui.blocking = () => !!ui.panel || ui.titleOpen || ui.fading;

  // ---------------- icons ----------------
  const iconCache = {};
  function tileToCanvas(ctx, tileName, a, b, c, d, e, f, shade) {
    const t = G.TILES[tileName] || 0;
    const sx = (t % G.ATLAS_PER_ROW) * 16, sy = ((t / G.ATLAS_PER_ROW) | 0) * 16;
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(G.atlasCanvasHi || G.atlasCanvas, G.atlasCanvasHi ? sx * 4 : sx, G.atlasCanvasHi ? sy * 4 : sy, G.atlasCanvasHi ? 64 : 16, G.atlasCanvasHi ? 64 : 16, 0, 0, 16, 16);
    if (shade) { ctx.fillStyle = 'rgba(40,20,10,' + shade + ')'; ctx.fillRect(0, 0, 16, 16); }
  }
  function cubeIcon(top, side) {
    const c = document.createElement('canvas'); c.width = 48; c.height = 48;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = true;
    tileToCanvas(ctx, top, 1.5, 0.75, -1.5, 0.75, 24, 0, 0);
    tileToCanvas(ctx, side, 1.5, 0.75, 0, 1.5, 0, 12, 0.16);
    tileToCanvas(ctx, side, 1.5, -0.75, 0, 1.5, 24, 24, 0.3);
    return c.toDataURL();
  }
  function flatIcon(tile) {
    const c = document.createElement('canvas'); c.width = 48; c.height = 48;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = true;
    tileToCanvas(ctx, tile, 3, 0, 0, 3, 0, 0, 0);
    return c.toDataURL();
  }
  G.iconHTML = function (id) {
    if (iconCache[id]) return iconCache[id];
    const item = G.ITEMS[id];
    let html = '<span class="emo">❔</span>';
    if (item) {
      const def = item.block ? G.BLOCKS[item.block] : null;
      if (item.icon) html = '<span class="emo">' + item.icon + '</span>';
      else if (def && def.shape === 'cube') html = '<img class="ico" src="' + cubeIcon(def.iconTiles.top, def.iconTiles.side) + '">';
      else if (def && def.shape === 'cross') html = '<img class="ico" src="' + flatIcon(def.iconTile) + '">';
      else if (def && def.iconCube) html = '<img class="ico' + (def.key.endsWith('_slab') ? ' slab' : '') + '" src="' + cubeIcon(def.iconCube, def.iconCube) + '">';
      else html = '<span class="emo">📦</span>';
    }
    return (iconCache[id] = html);
  };

  // ---------------- skeleton ----------------
  ui.init = function () {
    const root = $('ui');
    root.innerHTML = `
      <div id="lens"><i class="ts top"></i><i class="ts bottom"></i></div>
      <div id="topleft">
        <div id="clock" class="chip"><span id="clock-icon">☀️</span><div><b id="clock-time">8:00 AM</b><small id="clock-day">Day 1</small></div></div>
        <div id="pearls" class="chip" title="Pearls"><i class="pearl"></i><b id="pearl-count">0</b></div>
      </div>
      <div id="topright">
        <button class="round" id="btn-bag" title="Backpack &amp; crafting (Tab)">🎒</button>
        <button class="round" id="btn-journal" title="Island journal (J)">📖</button>
        <button class="round" id="btn-outfit" title="Change your outfit (O)">👕</button>
        <button class="round" id="btn-help" title="How to play (H)">❔</button>
        <button class="round" id="btn-sound" title="Sound on/off (M)">🔊</button>
      </div>
      <div id="tasks"></div>
      <div id="toasts"></div>
      <div id="fish-ui"></div>
      <div id="hint"></div>
      <div id="held-name"></div>
      <div id="hotbar"></div>
      <div id="modal-back"><div id="modal"></div></div>
      <div id="cursor-stack"></div>
      <div id="fade"></div>
      <div id="title"></div>`;
    const hb = $('hotbar');
    for (let i = 0; i < 9; i++) {
      const s = el('div', 'slot');
      s.dataset.i = i;
      s.addEventListener('pointerdown', (e) => { e.stopPropagation(); G.inv.sel = i; G.invDirty = true; G.emit('sfx', 'tick'); });
      hb.appendChild(s);
    }
    $('tasks').onclick = () => { if (!ui.blocking()) { ui.journalTab = 'tasks'; ui.toggle('journal'); } };      // (only tappable in touch mode)
    $('btn-bag').onclick = () => ui.toggle('backpack');
    $('btn-journal').onclick = () => ui.toggle('journal');
    $('btn-outfit').onclick = () => { if (ui.panel === 'wardrobe') ui.close(); else ui.openWardrobe(); };
    $('btn-help').onclick = () => ui.toggle('help');
    $('btn-sound').onclick = () => { if (G.audio) { G.audio.toggleMute(); $('btn-sound').textContent = G.audio.muted ? '🔇' : '🔊'; } };
    $('modal-back').addEventListener('pointerdown', (e) => { if (e.target === $('modal-back')) ui.close(); });
    const followCursor = (e) => {
      const c = $('cursor-stack');
      c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
    };
    window.addEventListener('pointermove', followCursor);
    window.addEventListener('pointerdown', followCursor, true);
    G.on('keydown', (code, e) => {
      if (ui.titleOpen) return;
      if (code === 'Escape') { if (ui.panel) ui.close(); return; }
      if (ui.panel === 'dialog') {
        if (code === 'Enter' || code === 'NumpadEnter') { const b = document.querySelector('#modal .dbtns .primary') || document.querySelector('#modal .dbtns button'); if (b) b.click(); }
        return;
      }
      if (code === 'Tab' || code === 'KeyI') ui.toggle('backpack');
      else if (code === 'KeyJ') ui.toggle('journal');
      else if (code === 'KeyH') ui.toggle('help');
      else if (code === 'KeyO') { if (ui.panel === 'wardrobe') ui.close(); else ui.openWardrobe(); }
      else if (code === 'KeyV' && !ui.panel) {
        G.cam.showRoofs = !G.cam.showRoofs;
        ui.toast(G.cam.showRoofs ? 'Roofs stay visible — press <kbd>V</kbd> to lift them away indoors again' : 'Roofs lift away when you step inside');
      }
      else if (code === 'KeyP' && !ui.panel) {
        if (document.body.classList.contains('photo')) document.body.classList.remove('photo');
        else { ui.toast('Photo mode — press <kbd>P</kbd> again to bring everything back'); setTimeout(() => document.body.classList.add('photo'), 1600); }
      }
      else if (code === 'KeyM') $('btn-sound').click();
      else if (!ui.panel && code.startsWith('Digit')) {
        const n = Number(code.slice(5));
        if (n >= 1 && n <= 9) { G.inv.sel = n - 1; G.invDirty = true; G.emit('sfx', 'tick'); }
      }
    });
    ui.showTitle();
  };

  // ---------------- toasts ----------------
  let lastToast = '', lastToastT = 0;
  ui.toast = function (msg, cls) {
    const now = performance.now();
    if (msg === lastToast && now - lastToastT < 1800) return;
    lastToast = msg; lastToastT = now;
    msg = G.tx ? G.tx(msg) : msg;
    const t = el('div', 'toast ' + (cls || ''), msg);
    const box = $('toasts');
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    const life = Math.min(6500, 2600 + Math.max(0, t.textContent.length - 40) * 45);   // longer notes linger
    setTimeout(() => t.classList.add('out'), life);
    setTimeout(() => t.remove(), life + 500);
  };

  // ---------------- HUD refresh ----------------
  let lastSel = -1, lastHeld = null, heldNameT = 0, hintT = 0;
  function slotHTML(s) {
    if (!s) return '';
    return G.iconHTML(s.id) + (s.n > 1 ? '<b class="count">' + s.n + '</b>' : '');
  }
  function refreshHotbar() {
    const hb = $('hotbar').children;
    for (let i = 0; i < 9; i++) {
      hb[i].innerHTML = '<i class="num">' + (i + 1) + '</i>' + slotHTML(G.inv.slots[i]);
      hb[i].classList.toggle('sel', i === G.inv.sel);
    }
    $('pearl-count').textContent = G.inv.pearls;
    const s = G.inv.slots[G.inv.sel];
    const id = s ? s.id : null;
    if (G.inv.sel !== lastSel || id !== lastHeld) {
      lastSel = G.inv.sel; lastHeld = id;
      const hn = $('held-name');
      hn.textContent = s ? G.itemLabel(s.id) : '';
      hn.classList.add('show'); heldNameT = 1.8;
      if (G.updateHeldModel) G.updateHeldModel(id);
    }
  }

  function fmtTime(h) {
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
    const ap = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return h12 + ':' + String(mm).padStart(2, '0') + ' ' + ap;
  }

  function hintText() {
    const t = G.target, held = G.heldItem();
    if (G.fishing && G.fishing.state !== 'idle') return G.fishing.hint();
    if (G.player.riding) return 'Steer with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> &nbsp;·&nbsp; <kbd>F</kbd> or <kbd>Space</kbd> to hop out';
    if (G.player.sitting) return 'Move to stand up';
    if (!t) {
      if (held && held.tool === 'rod') return '<kbd>Click</kbd> on water to cast your line';
      if (held && held.key === 'rowboat') return '<kbd>Right-click</kbd> at the water\'s edge to launch the boat';
      if (held && (held.food || held.kind === 'food')) return '<kbd>Right-click</kbd> to eat';
      return '';
    }
    if (t.type === 'entity') return t.ent.hint ? t.ent.hint() : '';
    if (t.type === 'water') return t.near ? '<kbd>Click</kbd> to cast here' : 'Too far — aim closer to shore';
    if (!t.near) return '';
    const def = t.def;
    const parts = [];
    if (def.use) {
      const verb = { door: 'open / close', campfire: (G.getMeta(t.x, t.y, t.z) & 4) ? 'cook' : 'light the fire', bush: 'pick berries', sit: 'sit down', bed: 'sleep', chest: 'open', workbench: 'craft', shop: 'trade', stove: 'cook', wardrobe: 'change your outfit', music: 'play or stop the music', telescope: 'look at the stars' }[def.use];
      parts.push('<kbd>Right-click</kbd> or <kbd>F</kbd> ' + verb);
    }
    if (def.instant) parts.push('<kbd>Click</kbd> to pick up ' + esc(def.label));
    else if (def.hp < 9999) {
      const tool = held && held.tool;
      if (def.tree === 'trunk' && !(G.getMeta(t.x, t.y, t.z) & 4) && !(held && held.tool === 'axe')) { parts.push('<kbd>Click</kbd> to shake the tree <i>(hold the axe to chop it)</i>'); return parts.join(' &nbsp;·&nbsp; '); }
      const verb = def.tool === 'axe' ? 'chop' : def.tool === 'pick' ? 'mine' : def.tool === 'shovel' ? 'dig' : 'gather';
      const tip = def.tool && tool !== def.tool ? ' <i>(faster with the ' + { axe: 'axe', pick: 'pick', shovel: 'shovel' }[def.tool] + ')</i>' : '';
      parts.push('<kbd>Hold click</kbd> to ' + verb + ' ' + esc(def.label) + tip);
    }
    if (held && held.kind === 'block' && def.use && !(G.touch && G.touch.on)) parts.push('<kbd>Shift</kbd> + <kbd>Right-click</kbd> place against it');
    if (held && held.kind === 'block' && !(def.use)) parts.push('<kbd>Right-click</kbd> place' + (G.BLOCKS[held.block].rot && !G.BLOCKS[held.block].wall ? ' · <kbd>R</kbd> rotate' : ''));
    if (held && held.kind === 'seed') parts.push('<kbd>Right-click</kbd> soil to plant');
    return parts.join(' &nbsp;·&nbsp; ');
  }

  ui.update = function (dt) {
    if (G.invDirty) {
      G.invDirty = false;
      refreshHotbar();
      if (ui.panel === 'backpack' || ui.panel === 'chest' || ui.panel === 'shop') ui.render();
    }
    if (heldNameT > 0) { heldNameT -= dt; if (heldNameT <= 0) $('held-name').classList.remove('show'); }
    hintT -= dt;
    if (hintT <= 0) {
      hintT = 0.12;
      const h = ui.blocking() ? '' : (G.tx ? G.tx(hintText()) : hintText());
      const he = $('hint');
      if (he._last !== h) { he._last = h; he.innerHTML = h; he.classList.toggle('show', !!h); }
      $('clock-time').textContent = fmtTime(G.time);
      $('clock-day').textContent = 'Day ' + G.day + (G.flags && G.flags.islandName ? ' · ' + G.flags.islandName + ' Isle' : '');
      $('clock-icon').textContent = G.time >= 5.5 && G.time < 7.5 ? '🌅' : G.time >= 7.5 && G.time < 17.5 ? '☀️' : G.time >= 17.5 && G.time < 19.5 ? '🌇' : '🌙';
    }
  };

  // ---------------- modal plumbing ----------------
  ui.open = function (name) {
    if (ui.titleOpen) return;
    ui.panel = name;
    $('modal-back').classList.add('show');
    G.input.keys = {};
    if (G.inv.held && (name === 'backpack' || name === 'chest')) { ui.cursor = G.inv.held; G.inv.held = null; drawCursor(); }
    G.emit('sfx', 'open');
    ui.render();
  };
  ui.close = function () {
    if (!ui.panel) return;
    if (ui.panel === 'dialog' && ui.dialogLocked) return;
    if (ui.cursor) {
      let left = G.addItem(ui.cursor.id, ui.cursor.n, true);
      const chestArr = ui.chestKey && G.chests ? G.chests[ui.chestKey] : null;
      if (left > 0 && chestArr) { const st = { id: ui.cursor.id, n: left }; left = moveInto(chestArr, 0, chestArr.length, st); }
      // no room anywhere: keep it safely "in hand" (it is saved too) and give it back next time
      G.inv.held = left > 0 ? { id: ui.cursor.id, n: left } : null;
      if (G.inv.held) ui.toast('Your backpack is full — you are still holding ' + G.inv.held.n + ' × ' + G.itemLabel(G.inv.held.id) + '. Open the backpack to put it down.');
      ui.cursor = null;
      drawCursor();
    }
    if (ui.panel === 'wardrobe' && camBefore) { G.cam.yaw = camBefore.yaw; G.cam.pitch = camBefore.pitch; G.cam.wantDist = camBefore.dist; camBefore = ui.camBefore = null; G.camera.clearViewOffset(); G.camera.updateProjectionMatrix(); }
    ui.panel = null; ui.chestKey = null;
    $('modal-back').classList.remove('show'); $('modal-back').classList.remove('aside'); $('modal-back').classList.remove('typing');
    $('modal').innerHTML = '';
    G.emit('sfx', 'close');
    if (G.requestSave) G.requestSave();
    // a dialog that had to wait for a locked one now gets its turn (once nothing else is open)
    if (dialogQueue.length) setTimeout(() => { if (!ui.panel && dialogQueue.length) ui.dialog(dialogQueue.shift()); }, 120);
  };
  ui.toggle = function (name) { if (ui.panel === name) ui.close(); else { if (ui.panel) ui.close(); ui.open(name); } };
  ui.openBackpack = function (tab) { if (tab) ui.craftTab = ui.craftTab === 'basics' ? 'furniture' : ui.craftTab; if (ui.panel) ui.close(); ui.open('backpack'); };
  ui.openChest = function (x, y, z) {
    ui.chestKey = x + ',' + y + ',' + z;
    G.chests = G.chests || {};
    if (!G.chests[ui.chestKey]) G.chests[ui.chestKey] = new Array(18).fill(null);
    if (ui.panel) { const k = ui.chestKey; ui.close(); ui.chestKey = k; }
    ui.open('chest');
    G.emit('sfx', 'doorOpen');
    if (G.world.lighthouse && ui.chestKey === G.world.lighthouse.chest) G.emit('lighthouse');
  };
  ui.openShop = function () { if (ui.panel) ui.close(); ui.open('shop'); };

  ui.render = function () {
    const m = $('modal');
    const scroll = m.querySelector('.scroll');
    const st = scroll ? scroll.scrollTop : 0;
    m.className = 'panel-' + ui.panel;
    if (ui.panel === 'backpack') renderBackpack(m);
    else if (ui.panel === 'chest') renderChest(m);
    else if (ui.panel === 'shop') renderShop(m);
    else if (ui.panel === 'journal') renderJournal(m);
    else if (ui.panel === 'help') renderHelp(m);
    else if (ui.panel === 'wardrobe') renderWardrobe(m);
    const sc2 = m.querySelector('.scroll');
    if (sc2) sc2.scrollTop = st;
  };

  function header(title, sub) {
    return '<div class="phead"><h2>' + title + '</h2>' + (sub ? '<span class="sub">' + (G.tx ? G.tx(sub) : sub) + '</span>' : '') + '<button class="x" data-close="1">✕</button></div>';
  }
  function wireClose(m) { m.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => ui.close())); }

  // ---------------- slots (click to pick up / put down) ----------------
  function drawCursor() {
    const c = $('cursor-stack');
    c.innerHTML = ui.cursor ? slotHTML(ui.cursor) : '';
    c.style.display = ui.cursor ? 'block' : 'none';
  }
  function slotGrid(arr, from, to, cls, otherArr) {
    const g = el('div', 'grid ' + (cls || ''));
    for (let i = from; i < to; i++) {
      const s = el('div', 'slot' + (arr === G.inv.slots && i === G.inv.sel ? ' sel' : ''), slotHTML(arr[i]));
      if (arr[i]) s.title = G.itemLabel(arr[i].id);
      s.addEventListener('pointerdown', (e) => { e.preventDefault(); slotTap(arr, i, e, otherArr); });
      s.addEventListener('contextmenu', (e) => e.preventDefault());
      g.appendChild(s);
    }
    return g;
  }
  function moveInto(arr, from, to, stack) {
    const max = (G.ITEMS[stack.id].stack) || 99;
    for (let i = from; i < to && stack.n > 0; i++) if (arr[i] && arr[i].id === stack.id && arr[i].n < max) { const a = Math.min(stack.n, max - arr[i].n); arr[i].n += a; stack.n -= a; }
    for (let i = from; i < to && stack.n > 0; i++) if (!arr[i]) { const a = Math.min(stack.n, max); arr[i] = { id: stack.id, n: a }; stack.n -= a; }
    return stack.n;
  }
  // Touch has no Shift key: tapping the same slot twice quickly sends the stack across instead.
  let lastTap = null;
  function slotTap(arr, i, e, otherArr) {
    if (e.pointerType === 'touch') {
      const now = performance.now();
      if (lastTap && lastTap.arr === arr && lastTap.i === i && now - lastTap.t < 400 && ui.cursor && !arr[i]) {
        arr[i] = ui.cursor; ui.cursor = null; lastTap = null;
        slotClick(arr, i, { shiftKey: true, button: 0 }, otherArr);
        return;
      }
      lastTap = { arr, i, t: now };
    }
    slotClick(arr, i, e, otherArr);
  }
  function slotClick(arr, i, e, otherArr) {
    const s = arr[i], c = ui.cursor;
    const max = (id) => (G.ITEMS[id].stack) || 99;
    if (e.shiftKey && s && !c) {
      // quick-move
      let left;
      if (otherArr) left = moveInto(otherArr, 0, otherArr.length, s);
      else if (arr === G.inv.slots) left = i < 9 ? moveInto(arr, 9, 36, s) : moveInto(arr, 0, 9, s);
      if (left !== undefined && left <= 0) arr[i] = null;
    } else if (e.button === 2) {
      if (!c && s) { const take = Math.ceil(s.n / 2); ui.cursor = { id: s.id, n: take }; s.n -= take; if (s.n <= 0) arr[i] = null; }
      else if (c && !s) { arr[i] = { id: c.id, n: 1 }; c.n--; if (c.n <= 0) ui.cursor = null; }
      else if (c && s && s.id === c.id && s.n < max(s.id)) { s.n++; c.n--; if (c.n <= 0) ui.cursor = null; }
    } else {
      if (!c && s) { ui.cursor = s; arr[i] = null; }
      else if (c && !s) { arr[i] = c; ui.cursor = null; }
      else if (c && s) {
        if (c.id === s.id && s.n < max(s.id)) { const a = Math.min(c.n, max(s.id) - s.n); s.n += a; c.n -= a; if (c.n <= 0) ui.cursor = null; }
        else { arr[i] = c; ui.cursor = s; }
      }
    }
    G.emit('sfx', 'tick');
    drawCursor();
    G.invDirty = true;
  }

  // ---------------- backpack + crafting ----------------
  const TABS = [['basics', '🌴 Basics'], ['building', '🧱 Building'], ['colors', '🎨 Colors'], ['furniture', '🪑 Furniture'], ['cooking', '🍳 Cooking']];
  function canCraft(r, bench, fire) {
    if (r.bench && !bench) return false;
    if (r.fire && !fire) return false;
    for (const k in r.ins) if (G.countItem(k) < r.ins[k]) return false;
    return true;
  }
  G.craft = function (r) {
    const bench = G.nearWorkbench(), fire = G.nearFire();
    if (!canCraft(r, bench, fire)) return false;
    if (!G.hasRoom(r.out, r.n)) { ui.toast('Your backpack is too full for that'); return false; }
    for (const k in r.ins) G.removeItem(k, r.ins[k]);
    G.addItem(r.out, r.n, true);
    G.emit('sfx', 'craft');
    G.emit('crafted', r.out, r.n);
    if (r.fire) G.emit('cooked', r.out);
    return true;
  };
  function renderBackpack(m) {
    const bench = G.nearWorkbench(), fire = G.nearFire();
    m.innerHTML = header('Backpack', 'Click an item to pick it up, click a slot to put it down · Shift-click to quick-move') +
      '<div class="cols"><div class="col inv"><h3>Pockets</h3><div id="g-main"></div><h3>Hotbar</h3><div id="g-hot"></div></div>' +
      '<div class="col craft"><h3>Make things ' + (bench ? '<span class="tag ok">🛠️ Workbench nearby</span>' : '<span class="tag">No workbench nearby</span>') + '</h3><div class="tabs" id="ctabs"></div><div class="scroll" id="recipes"></div></div></div>';
    $('g-main').appendChild(slotGrid(G.inv.slots, 9, 36));
    $('g-hot').appendChild(slotGrid(G.inv.slots, 0, 9, 'hot'));
    const tabs = $('ctabs');
    for (const [key, label] of TABS) {
      const b = el('button', 'tab' + (ui.craftTab === key ? ' on' : ''), label);
      b.onclick = () => { ui.craftTab = key; G.emit('sfx', 'tick'); ui.render(); };
      tabs.appendChild(b);
    }
    const list = $('recipes');
    const recs = G.RECIPES.filter((r) => r.cat === ui.craftTab);
    recs.sort((a, b) => (canCraft(b, bench, fire) ? 1 : 0) - (canCraft(a, bench, fire) ? 1 : 0));
    if (ui.craftTab === 'cooking') { if (!fire) list.appendChild(el('div', 'note', 'Cooking needs a <b>lit campfire</b> or a <b>stove</b> close by.')); }
    else if (ui.craftTab !== 'basics' && !bench) list.appendChild(el('div', 'note', 'These need a <b>workbench</b> nearby. Make one from 4 planks in <b>Basics</b>, then place it.'));
    for (const r of recs) {
      const ok = canCraft(r, bench, fire);
      const row = el('div', 'recipe' + (ok ? '' : ' no'));
      let ins = '';
      for (const k in r.ins) {
        const have = G.countItem(k);
        ins += '<span class="ing' + (have >= r.ins[k] ? '' : ' lack') + '" title="' + esc(G.itemLabel(k)) + '">' + G.iconHTML(k) + '<b>' + have + '/' + r.ins[k] + '</b></span>';
      }
      row.innerHTML = '<div class="rout">' + G.iconHTML(r.out) + (r.n > 1 ? '<b class="count">' + r.n + '</b>' : '') + '</div><div class="rname">' + esc(G.itemLabel(r.out)) + '</div><div class="rins">' + ins + '</div>';
      const b = el('button', 'make', 'Make');
      b.disabled = !ok;
      b.onclick = () => { G.craft(r); };
      row.appendChild(b);
      list.appendChild(row);
    }
    wireClose(m);
  }

  function renderChest(m) {
    const arr = G.chests[ui.chestKey];
    m.innerHTML = header('Storage Chest', 'Shift-click to move things quickly') + '<div class="cols"><div class="col"><h3>Chest</h3><div id="g-chest"></div></div><div class="col inv"><h3>Pockets</h3><div id="g-main"></div><h3>Hotbar</h3><div id="g-hot"></div></div></div>';
    $('g-chest').appendChild(slotGrid(arr, 0, arr.length, 'chest', G.inv.slots));
    $('g-main').appendChild(slotGrid(G.inv.slots, 9, 36, '', arr));
    $('g-hot').appendChild(slotGrid(G.inv.slots, 0, 9, 'hot', arr));
    wireClose(m);
  }

  // ---------------- shop ----------------
  function renderShop(m) {
    m.innerHTML = header('Marlow\'s Trading Post', '<i class="pearl"></i> ' + G.inv.pearls + ' pearls') +
      '<div class="shopkeep">🦦 <span>' + (ui.shopTab === 'buy' ? '"Fresh off the boat! Have a look."' : '"Shells, fish, veggies — I\'ll take the lot."') + '</span></div>' +
      '<div class="tabs" id="stabs"></div><div class="scroll" id="shoplist"></div>';
    const tabs = $('stabs');
    for (const [key, label] of [['buy', '🛍️ Buy'], ['sell', '💰 Sell']]) {
      const b = el('button', 'tab' + (ui.shopTab === key ? ' on' : ''), label);
      b.onclick = () => { ui.shopTab = key; ui.render(); };
      tabs.appendChild(b);
    }
    const list = $('shoplist');
    if (ui.shopTab === 'buy') {
      const stock = G.shopStock();
      list.appendChild(el('div', 'note', '⭐ <b>Today\'s specials</b> change every morning. Everything else is always in stock.'));
      for (const it of stock) {
        const row = el('div', 'recipe' + (it.special ? ' special' : ''));
        row.innerHTML = '<div class="rout">' + G.iconHTML(it.id) + '</div><div class="rname">' + (it.special ? '⭐ ' : '') + esc(G.itemLabel(it.id)) + '</div><div class="rins"><span class="price"><i class="pearl"></i>' + it.price + '</span></div>';
        const b = el('button', 'make', 'Buy');
        b.disabled = G.inv.pearls < it.price;
        b.onclick = () => {
          if (G.inv.pearls < it.price) return;
          if (!G.hasRoom(it.id)) { ui.toast('Your backpack is full'); return; }
          G.addPearls(-it.price); G.addItem(it.id, 1, true); G.emit('sfx', 'coin'); G.emit('bought', it.id);
        };
        row.appendChild(b);
        list.appendChild(row);
      }
    } else {
      const seen = {};
      let any = false;
      for (const s of G.inv.slots) {
        if (!s || seen[s.id]) continue;
        const item = G.ITEMS[s.id];
        if (!item.value) continue;
        seen[s.id] = true; any = true;
        const n = G.countItem(s.id);
        const row = el('div', 'recipe');
        row.innerHTML = '<div class="rout">' + G.iconHTML(s.id) + '<b class="count">' + n + '</b></div><div class="rname">' + esc(item.label) + '</div><div class="rins"><span class="price"><i class="pearl"></i>' + item.value + ' each</span></div>';
        const sell = (k) => { if (G.removeItem(s.id, k)) { G.addPearls(item.value * k); G.emit('sfx', 'coin'); G.emit('sold', s.id, k); } };
        const b1 = el('button', 'make', 'Sell 1'); b1.onclick = () => sell(1);
        const b2 = el('button', 'make', 'Sell all'); b2.onclick = () => sell(G.countItem(s.id));
        row.appendChild(b1); row.appendChild(b2);
        list.appendChild(row);
      }
      if (!any) list.appendChild(el('div', 'note', 'Nothing to sell right now. Marlow buys shells, fish, crops, flowers and spare materials.'));
    }
    wireClose(m);
  }

  // ---------------- journal ----------------
  function renderJournal(m) {
    const j = G.journal || { fish: {}, shells: {}, bugs: {} };
    m.innerHTML = header('Island Journal', 'Everything you have discovered so far') + '<div class="tabs" id="jtabs"></div><div class="scroll" id="jbody"></div>';
    const tabs = $('jtabs');
    for (const [key, label] of [['fish', '🎣 Fish'], ['shells', '🐚 Beach finds'], ['bugs', '🦋 Bugs'], ['pets', '🐾 Friends'], ['tasks', '✅ To-do list']]) {
      const b = el('button', 'tab' + (ui.journalTab === key ? ' on' : ''), label);
      b.onclick = () => { ui.journalTab = key; ui.render(); };
      tabs.appendChild(b);
    }
    const body = $('jbody');
    if (ui.journalTab === 'fish' || ui.journalTab === 'shells' || ui.journalTab === 'bugs') {
      const list = ui.journalTab === 'fish' ? G.FISH.filter((f) => !f.junk).map((f) => ({ id: f.id, label: f.label, info: (f.where === 'lagoon' ? 'Lagoon' : f.where === 'sea' ? 'Sea' : 'Anywhere') + (f.time === 'night' ? ' · night' : f.time === 'day' ? ' · day' : '') }))
        : ui.journalTab === 'bugs' ? G.BUGS.map((b) => ({ id: b.id, label: b.label, info: b.id === 'bug_glow' ? 'Night · grass' : 'Day · near flowers' }))
        : G.SHELL_TABLE.map((s) => ({ id: s.id, label: G.itemLabel(s.id), info: s.w >= 20 ? 'Common' : s.w >= 8 ? 'Uncommon' : 'Rare' }));
      const book = ui.journalTab === 'fish' ? j.fish : ui.journalTab === 'bugs' ? (j.bugs || {}) : j.shells;
      const found = list.filter((x) => book[x.id]).length;
      const shown = list.filter((x) => G.flags.donated && G.flags.donated[x.id]).length;
      body.appendChild(el('div', 'note', 'Found <b>' + found + '</b> of <b>' + list.length + '</b> · shown to Clementine for the island collection: <b>' + shown + '</b>'));
      const grid = el('div', 'jgrid');
      for (const x of list) {
        const n = book[x.id] || 0;
        grid.appendChild(el('div', 'jcard' + (n ? '' : ' unknown'), '<div class="jicon">' + (n ? G.iconHTML(x.id) : '<span class="emo">❔</span>') + '</div><b>' + (n ? esc(x.label) : '???') + '</b><small>' + (n ? x.info + ' · ×' + n : x.info) + '</small>'));
      }
      body.appendChild(grid);
    } else if (ui.journalTab === 'pets') {
      const vg = el('div', 'jgrid');
      for (const v of G.villagers || []) {
        const D = G.VILLAGER_DEFS[v.id];
        const h = Math.min(5, Math.floor(v.friend / 20));
        vg.appendChild(el('div', 'jcard' + (v.met ? '' : ' unknown'), '<div class="jicon"><span class="emo">' + (v.met ? D.icon : '❔') + '</span></div><b>' + (v.met ? D.name : '???') + '</b><small>' + (v.met ? D.title + '<br>' + '❤️'.repeat(h) + '🤍'.repeat(5 - h) + (v.request ? '<br>wants ' + v.request.n + ' × ' + esc(G.itemLabel(v.request.id)) : '') : 'An islander you have not met') + '</small>'));
      }
      body.appendChild(el('div', 'note', '<b>Neighbours</b> — chat every day, do favours and give gifts to grow closer. Each new heart earns a present.'));
      body.appendChild(vg);
      body.appendChild(el('div', 'note', '<b>Animal friends</b>'));
      const pets = (G.pets || []).filter((p) => p.adopted);
      if (!pets.length) body.appendChild(el('div', 'note', 'No animal friends yet. Offer a wandering animal its favourite snack — a <b>Pet Treat</b> always works — until it trusts you.'));
      const grid = el('div', 'jgrid');
      for (const p of pets) grid.appendChild(el('div', 'jcard', '<div class="jicon"><span class="emo">' + G.PET_KINDS[p.kind].icon + '</span></div><b>' + esc(p.name) + '</b><small>' + G.PET_KINDS[p.kind].label + ' · ' + (p.stay ? 'staying home' : 'following you') + '</small>'));
      body.appendChild(grid);
    } else {
      const qs = G.quests ? G.quests.list : [];
      for (const q of qs) {
        const done = G.quests.done[q.id];
        body.appendChild(el('div', 'qrow' + (done ? ' done' : ''), '<span>' + (done ? '✅' : '⬜') + '</span><div><b>' + esc(q.title) + '</b><small>' + esc(q.desc) + '</small></div><span class="price"><i class="pearl"></i>' + q.reward + '</span>'));
      }
    }
    wireClose(m);
  }

  // ---------------- outfit ----------------
  const LOOKS = {
    hat: ['Hat colour', [0xf2d88a, 0xf58f7c, 0x5cc4b8, 0xfaf7f0, 0x4a5f8a, 0xf5b5ca, 0x8a6a4a]],
    hair: ['Hair', [0x7a4a2a, 0x2e2a2a, 0xe8c66a, 0xb5562e, 0xb9b9c2, 0xf08fb0, 0x3fa79b]],
    shirt: ['Shirt', [0xff8f7a, 0xf7cf6b, 0x5cc4b8, 0x79aede, 0xfaf7f0, 0xb394d6, 0x86c996]],
    shorts: ['Shorts', [0x5f93c9, 0xc9b27a, 0xd9695a, 0x3f4f7a, 0xf4f1ea, 0x5fa878, 0x8a6a8a]],
    skin: ['Skin', [0xffd9b8, 0xf5c39b, 0xd9a273, 0xb07a4f, 0x8a5a3a, 0x6b4028, 0xffe6d2]],
  };
  // The wardrobe slides to one side and the camera swings round to face you, so every change
  // can be seen as you make it.
  let camBefore = null;
  ui.openWardrobe = function () {
    if (ui.panel) ui.close();
    const c = G.cam, P = G.player;
    camBefore = ui.camBefore = { yaw: c.yaw, pitch: c.pitch, dist: c.wantDist };
    if (P.sitting) G.standUp();
    c.yaw = P.yaw + 0.25; c.pitch = 0.2; c.wantDist = 4.6;
    ui.open('wardrobe');
    $('modal-back').classList.add('aside');
    // nudge the view so you stand in the clear part of the screen, beside the panel
    const w = window.innerWidth, h = window.innerHeight;
    if (w > 760) { G.camera.setViewOffset(w, h, w * 0.2, 0, w, h); G.camera.updateProjectionMatrix(); }
  };
  function renderWardrobe(m) {
    const L = G.player.look;
    m.innerHTML = header('Wardrobe', 'Pick the colours you like — change them any time') + '<div id="looks"></div>';
    const box = $('looks');
    for (const key in LOOKS) {
      const row = el('div', 'lookrow', '<b>' + LOOKS[key][0] + '</b>');
      for (const c of LOOKS[key][1]) {
        const sw = el('button', 'swatch' + (L[key] === c ? ' on' : ''));
        sw.style.background = '#' + c.toString(16).padStart(6, '0');
        sw.onclick = () => { L[key] = c; G.buildPlayerModel(); G.updateHeldModel(G.heldItemId); G.emit('sfx', 'tick'); G.emit('outfit'); ui.render(); };
        row.appendChild(sw);
      }
      box.appendChild(row);
    }
    const STYLES = {
      hairStyle: ['Hair style', [['short', 'Short'], ['bob', 'Bob'], ['long', 'Long'], ['pony', 'Ponytail'], ['buns', 'Buns']]],
      hatStyle: ['Headwear', [['straw', 'Sun hat'], ['bow', 'Bow'], ['flower', 'Flower crown'], ['cap', 'Cap'], ['none', 'None']]],
      outfit: ['Outfit', [['tee', 'Tee & shorts'], ['dress', 'Dress'], ['overalls', 'Overalls']]],
    };
    for (const key in STYLES) {
      const row = el('div', 'lookrow', '<b>' + STYLES[key][0] + '</b>');
      for (const [val, label] of STYLES[key][1]) {
        const b = el('button', 'tab' + ((L[key] || STYLES[key][1][0][0]) === val ? ' on' : ''), label);
        b.onclick = () => { L[key] = val; G.buildPlayerModel(); G.updateHeldModel(G.heldItemId); G.emit('sfx', 'tick'); G.emit('outfit'); ui.render(); };
        row.appendChild(b);
      }
      box.appendChild(row);
    }
    wireClose(m);
  }

  function renderHelp(m) {
    m.innerHTML = header('How to play', 'Take it slow — there is no way to lose') + `<div class="scroll help">
      <div class="hrow"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>Walk · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump / swim up</span></div>
      <div class="hrow"><kbd>Q</kbd><kbd>E</kbd><span>Turn the camera · <kbd>Z</kbd> <kbd>C</kbd> tilt · <kbd>-</kbd> <kbd>=</kbd> zoom<br><small>Or drag with the right mouse button and scroll to zoom.</small></span></div>
      <div class="hrow"><kbd>Click</kbd><span>Use your tool: dig, chop, mine, pick up shells, cast the fishing rod, greet animals</span></div>
      <div class="hrow"><kbd>Right-click</kbd><span>Place the block you are holding · open doors · light fires · sit · eat<br><small>No right button? Use <kbd>X</kbd> or <kbd>Ctrl</kbd>+click instead.</small></span></div>
      <div class="hrow"><kbd>R</kbd><span>Rotate furniture before placing it · <kbd>V</kbd> keep roofs visible indoors · <b>middle-click</b> picks a block</span></div>
      <div class="hrow"><kbd>F</kbd><span>Use the nearest thing (door, chair, bed, trader, pet)</span></div>
      <div class="hrow"><kbd>1</kbd>–<kbd>9</kbd><span>Pick a hotbar slot</span></div>
      <div class="hrow"><kbd>Tab</kbd><span>Backpack &amp; crafting · <kbd>J</kbd> journal · <kbd>O</kbd> outfit · <kbd>N</kbd> map · <kbd>P</kbd> photo mode · <kbd>M</kbd> sound · <kbd>Esc</kbd> close</span></div>
      <h3>Island tips</h3>
      <ul>
        <li>🐚 New shells wash up every morning. Marlow at the trading post buys them for pearls.</li>
        <li>🏠 Step under a roof and it lifts away so you can decorate inside.</li>
        <li>🎣 Cast from the pier, then click the moment the bobber splashes.</li>
        <li>🔥 Light a campfire and use it while holding a fish to grill it.</li>
        <li>🐾 Feed a wandering animal its favourite snack a few times to adopt it.</li>
        <li>🛏️ Sleep in a bed at night to wake up at sunrise.</li>
        <li>🍎 Shake a tree (click it without the axe) and its fruit drops. Fruit grows back.</li>
        <li>🎈 Balloons drift over now and then. Click one to pop it and catch the present.</li>
        <li>🐢 Show Clementine every new fish, shell and bug for the island collection.</li>
        <li>👋 Press <kbd>G</kbd> to wave at your neighbours.</li>
        <li>🌠 When a shooting star crosses the night sky, press <kbd>G</kbd> to make a wish.</li>
        <li>🌱 Plant seeds on grass or dirt and come back in a day or two.</li>
        <li>🛶 Build a rowboat at the workbench and paddle around the island.</li>
        <li>🦋 The bug net in your backpack catches butterflies by day and glowbugs by night.</li>
        <li>🦌 Three neighbours live in huts around the island — the map shows where.</li>
      </ul>
      <div class="hrow"><span id="fps-line" style="margin-left:0">Running at ${Math.round(G.fps)} frames per second.</span><button class="make" id="btn-simple">${G.simple ? 'Full graphics' : 'Simpler graphics'}</button></div>
      <div class="hrow"><button class="make" id="btn-save">Save now</button><button class="make danger" id="btn-reset">Start a new island…</button></div>
    </div>`;
    if (G.touch && G.touch.on) {
      // the same panel for fingers: touch gestures instead of keys, plus buttons for the keyboard-only extras
      const rows = m.querySelectorAll('.help > .hrow');
      for (let i = 0; i < 8 && i < rows.length; i++) rows[i].remove();
      const box = m.querySelector('.help');
      box.insertAdjacentHTML('afterbegin', `
        <div class="hrow"><kbd>Left thumb</kbd><span>Walk — a stick appears wherever your thumb lands. Push it all the way to run.</span></div>
        <div class="hrow"><kbd>Tap</kbd><span>Open doors, sit, light fires, talk, pick up shells, cast the rod — or place the block you are holding</span></div>
        <div class="hrow"><kbd>Hold</kbd><span>Dig, chop, mine and gather. Keep your finger down until it breaks.</span></div>
        <div class="hrow"><kbd>Drag</kbd><span>Look around · <kbd>Pinch</kbd> zoom in and out</span></div>
        <div class="hrow"><kbd>⤒</kbd><span>Jump / swim up · <kbd>✋</kbd> use the nearest thing · <kbd>👋</kbd> wave · <kbd>↻</kbd> rotate furniture · <kbd>🍴</kbd> eat</span></div>
        <div class="hrow"><kbd>🎒</kbd><span>Backpack &amp; crafting. Tap an item, then tap a slot to move it; tap an item twice to send it across.</span></div>
        <div class="hrow tools"><button class="make" id="tb-roofs">${G.cam.showRoofs ? 'Lift roofs indoors' : 'Keep roofs visible'}</button><button class="make" id="tb-map">${G.mapVisible === false ? 'Show the map' : 'Hide the map'}</button><button class="make" id="tb-photo">Photo mode</button></div>`);
      const ul = m.querySelector('.help ul');
      ul.innerHTML = G.tx(ul.innerHTML).replace(/\bclick/g, 'tap').replace(/\bClick/g, 'Tap');
      const key = (code) => () => { ui.close(); G.emit('keydown', code); };
      $('tb-roofs').onclick = key('KeyV'); $('tb-map').onclick = key('KeyN'); $('tb-photo').onclick = key('KeyP');
    }
    $('btn-save').onclick = () => { if (G.saveGame) { G.saveGame(); ui.toast('Island saved 💾'); } };
    $('btn-simple').onclick = () => { G.setSimple(!G.simple); ui.toast(G.simple ? 'Simpler graphics on: no shadows or soft focus' : 'Full graphics back on'); ui.render(); };
    $('btn-reset').onclick = () => {
      ui.dialog({ title: 'Start a new island?', html: 'This erases your current island, buildings, pets and backpack.', buttons: [{ label: 'Keep my island', primary: true }, { label: 'Erase and start over', danger: true, fn: () => { G.resetGame(); } }] });
    };
    wireClose(m);
  }

  // ---------------- dialogs ----------------
  // opts: { title, html, buttons:[{label, fn, primary, danger}], input:{value,placeholder}, locked }
  const dialogQueue = [];
  ui.dialog = function (opts) {
    if (ui.panel === 'dialog' && ui.dialogLocked) { dialogQueue.push(opts); return; }
    if (ui.panel) { ui.dialogLocked = false; ui.close(); }
    ui.panel = 'dialog'; ui.dialogLocked = !!opts.locked;
    const m = $('modal');
    m.className = 'panel-dialog';
    $('modal-back').classList.add('show');
    G.input.keys = {};
    $('modal-back').classList.toggle('typing', !!opts.input);
    m.innerHTML = '<div class="dialog"><h2>' + opts.title + '</h2><div class="dbody">' + (G.tx ? G.tx(opts.html || '') : (opts.html || '')) + '</div>' + (opts.input ? '<input id="dlg-input" maxlength="16" value="' + esc(opts.input.value || '') + '" placeholder="' + esc(opts.input.placeholder || '') + '">' : '') + '<div class="dbtns"></div></div>';
    const btns = m.querySelector('.dbtns');
    for (const b of opts.buttons || [{ label: 'Okay', primary: true }]) {
      const be = el('button', 'make' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), b.label);
      be.onclick = () => {
        const val = opts.input ? $('dlg-input').value.trim() : undefined;
        ui.dialogLocked = false;
        ui.close();
        if (b.fn) b.fn(val);
      };
      btns.appendChild(be);
    }
    if (opts.input) { const i = $('dlg-input'); setTimeout(() => { i.focus(); i.select(); }, 30); i.addEventListener('blur', () => window.scrollTo(0, 0)); i.addEventListener('keydown', (e) => { if (e.key === 'Enter') btns.querySelector('.primary, .make').click(); e.stopPropagation(); }); }
  };

  // ---------------- fade (sleeping) ----------------
  ui.fade = function (text, midFn, doneFn) {
    const f = $('fade');
    ui.fading = true;
    f.innerHTML = '<div>' + text + '</div>';
    f.classList.add('show');
    setTimeout(() => { midFn && midFn(); }, 1300);
    setTimeout(() => { f.classList.remove('show'); }, 2600);
    setTimeout(() => { ui.fading = false; doneFn && doneFn(); }, 3300);
  };

  // ---------------- tasks tracker ----------------
  ui.renderTasks = function () {
    const box = $('tasks');
    if (!G.quests) { box.innerHTML = ''; return; }
    const active = G.quests.active();
    let html = active.length ? '<h4>Island to-do</h4>' : '';
    for (const q of active) {
      const prog = q.goal > 1 ? ' <i>' + Math.min(q.goal, G.quests.progress[q.id] || 0) + '/' + q.goal + '</i>' : '';
      html += '<div class="task"><span>⬜</span><div><b>' + esc(q.title) + prog + '</b><small>' + esc(G.tx ? G.tx(q.desc) : q.desc) + '</small></div></div>';
    }
    box.innerHTML = html;
  };

  // island / player names shown around the interface
  ui.refreshNames = function () {
    const h = document.querySelector('#title h1');
    if (h && G.flags && G.flags.islandName) h.textContent = G.flags.islandName + ' Isle';
  };

  // ---------------- title screen ----------------
  const TOUCH_LINE = 'Left thumb to walk · tap to use, place and pick up · hold to dig and chop';
  // On a phone the game only goes full screen when launched from the Home Screen, so say so up front.
  function homeScreenTip() {
    const a = $('title-a2hs');
    if (!a) return;
    const standalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    const show = !!(G.touch && G.touch.on) && !standalone;
    a.style.display = show ? '' : 'none';
    if (show) a.innerHTML = '📲 For full screen, add this page to your Home Screen first<br>(Share → Add to Home Screen). That copy keeps its own island.';
  }
  G.on('touchmode', () => {
    homeScreenTip();
    const k = $('title-keys'); if (k) k.textContent = TOUCH_LINE;
    if (ui.renderTasks) ui.renderTasks();
    if (ui.panel === 'help') ui.render();
  });
  ui.showTitle = function () {
    ui.titleOpen = true;
    const t = $('title');
    const hasSave = G.hasSave && G.hasSave();
    t.innerHTML = `<div class="tcard">
      <div class="tlogo">🏝️</div>
      <h1>Tidewood Isle</h1>
      <p>A cozy little island to build, fish, collect and befriend.</p>
      <button class="make primary big" id="btn-play">${hasSave ? 'Continue your island' : 'Wash ashore'}</button>
      ${hasSave ? '<button class="make" id="btn-new">Start a new island</button>' : ''}
      <small id="title-keys">${G.touch && G.touch.on ? TOUCH_LINE : 'WASD to walk · click to gather · right-click to place · <b>H</b> for help'}</small>
      <small id="title-a2hs" style="display:none"></small>
    </div>`;
    t.classList.add('show');
    homeScreenTip();
    ui.refreshNames();
    $('btn-play').onclick = () => {
      ui.titleOpen = false; t.classList.remove('show');
      if (G.audio) G.audio.start();
      G.emit('gamestart');
    };
    const bn = $('btn-new');
    if (bn) bn.onclick = () => { if (bn.dataset.sure) G.resetGame(); else { bn.dataset.sure = '1'; bn.textContent = 'Really erase the old island?'; } };
  };
})();
