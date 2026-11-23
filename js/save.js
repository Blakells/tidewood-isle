// Tidewood Isle — saving to localStorage.  The world is stored as a diff against the generated island.
'use strict';
(function () {
  G.hasSave = function () {
    try {
      const raw = localStorage.getItem(G.SAVE_KEY);
      return !!raw && JSON.parse(raw).v === G.SAVE_VERSION;
    } catch (e) { return false; }
  };

  G.loadSave = function () {
    try {
      const raw = localStorage.getItem(G.SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.v !== G.SAVE_VERSION) { console.warn('Old save version — starting fresh'); return null; }
      return s;
    } catch (e) { console.warn('Could not read save', e); return null; }
  };

  // Apply a loaded save on top of the freshly generated world (before meshing).
  G.applySave = function (s) {
    const w = G.world;
    const pal = s.palette.map((k) => (k === 'air' ? 0 : G.B[k]));
    const c = s.cells;
    for (let i = 0; i < c.length; i += 3) {
      const id = pal[c[i + 1]];
      if (id === undefined) continue;          // block no longer exists in this version
      w.blocks[c[i]] = id; w.meta[c[i]] = c[i + 2];
    }
    G.time = s.time; G.day = s.day;
    const P = G.player;
    P.pos.set(s.player.x, s.player.y, s.player.z); P.yaw = s.player.yaw || 0;
    if (s.look) Object.assign(P.look, s.look);
    if (s.cam) { G.cam.yaw = s.cam.yaw; G.cam.pitch = s.cam.pitch; G.cam.wantDist = G.cam.dist = s.cam.dist; }
    G.inv.slots = s.inv.slots.map((x) => (x && G.ITEMS[x.id] ? { id: x.id, n: x.n } : null));
    while (G.inv.slots.length < 36) G.inv.slots.push(null);
    G.inv.sel = s.inv.sel || 0; G.inv.pearls = s.inv.pearls || 0;
    G.inv.held = s.inv.held && G.ITEMS[s.inv.held.id] ? { id: s.inv.held.id, n: s.inv.held.n } : null;
    G.chests = {};
    for (const k in s.chests || {}) G.chests[k] = s.chests[k].map((x) => (x && G.ITEMS[x.id] ? { id: x.id, n: x.n } : null));
    G.journal = s.journal || { fish: {}, shells: {} };
    if (!G.journal.bugs) G.journal.bugs = {};
    if (s.quests) { G.quests.done = s.quests.done || {}; G.quests.progress = s.quests.progress || {}; }
    G.flags = s.flags || {};
    G.stats = s.stats || G.stats;
  };

  G.saveGame = function () {
    if (!G.started || G.resetting) return false;
    try {
      const w = G.world, blocks = w.blocks, meta = w.meta, orig = w.orig, om = w.origMeta;
      const palette = [], palIdx = {}, cells = [];
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i] !== orig[i] || meta[i] !== om[i]) {
          const key = blocks[i] ? G.BLOCKS[blocks[i]].key : 'air';
          let p = palIdx[key];
          if (p === undefined) { p = palIdx[key] = palette.length; palette.push(key); }
          cells.push(i, p, meta[i]);
        }
      }
      const P = G.player;
      const data = {
        v: G.SAVE_VERSION, seed: w.seed, time: +G.time.toFixed(3), day: G.day,
        player: { x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yaw: +P.yaw.toFixed(2) },
        look: P.look,
        cam: G.ui.camBefore ? { yaw: +G.ui.camBefore.yaw.toFixed(2), pitch: +G.ui.camBefore.pitch.toFixed(2), dist: +G.ui.camBefore.dist.toFixed(1) } : { yaw: +G.cam.yaw.toFixed(2), pitch: +G.cam.pitch.toFixed(2), dist: +G.cam.wantDist.toFixed(1) },
        inv: { slots: G.inv.slots, sel: G.inv.sel, pearls: G.inv.pearls, held: G.ui.cursor || G.inv.held || null },
        palette, cells, chests: G.chests, journal: G.journal,
        quests: { done: G.quests.done, progress: G.quests.progress },
        flags: G.flags, stats: G.stats,
        pets: G.serializePets ? G.serializePets() : [],
        villagers: G.serializeVillagers ? G.serializeVillagers() : {},
        boats: G.serializeBoats ? G.serializeBoats() : [],
        savedAt: Date.now(),
      };
      localStorage.setItem(G.SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) { console.warn('Save failed', e); return false; }
  };

  G.resetGame = function () {
    G.resetting = true;
    try { localStorage.removeItem(G.SAVE_KEY); } catch (e) { /* ignore */ }
    location.reload();
  };

  window.addEventListener('beforeunload', () => { if (G.started && !G.ui.titleOpen) G.saveGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.started && !G.ui.titleOpen) G.saveGame(); });
})();
