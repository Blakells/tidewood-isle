// Tidewood Isle — boot sequence and main loop.
'use strict';
(function () {
  let last = performance.now();
  let lastW = 0, lastH = 0;
  G.started = false;
  G.paused = false;
  G.fps = 60;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w === lastW && h === lastH) return;
    if (w < 2 || h < 2) return;
    lastW = w; lastH = h;
    G.renderer.setSize(w, h);
    G.camera.aspect = w / h;
    G.camera.updateProjectionMatrix();
  }

  G.boot = function () {
    G.buildAtlas();
    G.initEnv();
    G.initChunkMaterial();
    G.initInput();

    const save = G.loadSave ? G.loadSave() : null;
    const seed = save ? save.seed : ((Math.random() * 1e9) | 0);
    G.generateWorld(seed);
    if (save && G.applySave) G.applySave(save);
    G.meshAllChunks();
    G.buildWater();
    G.scanLights();
    G.buildPlayerModel();
    if (!save) {
      const s = G.world.spawn;
      G.player.pos.set(s.x, s.y + 0.1, s.z);
      G.player.yaw = 0.3;            // facing the camera, with the sea behind it
      G.cam.yaw = 0.3;
    }
    G.cam.target.set(G.player.pos.x, G.player.pos.y + 1, G.player.pos.z);
    if (G.initGame) G.initGame(save);
    G.started = true;
    resize();
    requestAnimationFrame(frame);
  };

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    G.fps = G.fps * 0.95 + (1 / dt) * 0.05;
    resize();
    if (lastW < 2) return;
    G.step(dt);
    G.renderer.render(G.scene, G.camera);
  }

  // One simulation step (also callable from tests: game.step(1/60))
  G.step = function (dt) {
    if (!G.paused) {
      const before = G.time;
      G.time += dt * G.HOURS_PER_SEC * (G.timeScale || 1);
      if (before < 6 && G.time >= 6) G.emit('morning');
      if (G.time >= 24) { G.time -= 24; G.day++; G.emit('newday'); }
      G.updatePlayer(dt, G.input);
      if (G.updateGame) G.updateGame(dt);
    }
    if (G.ui && G.ui.titleOpen) { G.cam.yaw += dt * 0.04; if (G.paused && G.updateMap) G.updateMap(dt); }
    if (G.ui && G.ui.update) G.ui.update(dt);
    G.updateCamera(dt);
    G.updateEnv(dt, G.player.pos);
    G.updateDirtyChunks(8);
    if (G.updateTargeting) G.updateTargeting(dt);
  };

  window.addEventListener('load', () => {
    try { G.boot(); } catch (e) { console.error(e); const el = document.getElementById('boot-error'); if (el) { el.style.display = 'block'; el.textContent = 'Something went wrong starting the game: ' + e.message; } }
  });
})();
