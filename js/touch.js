// Tidewood Isle — touch controls for phones and tablets.
//
//   left thumb      a walking stick that appears wherever the thumb lands (push far to run)
//   tap             use, open, talk, pick up, cast — or place the block being held
//   hold            dig, chop, mine and gather (keeps hitting until the finger lifts)
//   drag            turn and tilt the camera;  two fingers pinch to zoom
//   buttons         jump, use the nearest thing, wave / wish, rotate, eat
//
// Nothing here runs until a finger touches the screen (or the device reports a coarse pointer),
// so mouse-and-keyboard play is untouched.
'use strict';
(function () {
  const T = G.touch = { on: false };
  const input = G.input;
  const joy = input.joy = { x: 0, y: 0, mag: 0, active: false };
  const pts = new Map();          // fingers on the game view: id -> { role, x0, y0, x, y, t0 }
  let canvas, joyEl, knobEl, pad, btn = {};
  let aimT = 0, farToastT = 0, ctxT = 0, pinchD = 0;
  const HOLD_MS = 380, TAP_SLOP = 10, JOY_R = 54;

  // ---------- wording: the same messages, minus the keyboard ----------
  const WORDS = [
    [/<kbd>Shift<\/kbd> \+ click to pick the boat up/g, '<kbd>Hold</kbd> to pick the boat up'],
    [/Steer with <kbd>W<\/kbd><kbd>A<\/kbd><kbd>S<\/kbd><kbd>D<\/kbd>/g, 'Steer with the stick'],
    [/<kbd>F<\/kbd> or <kbd>Space<\/kbd> to hop out/g, 'tap <kbd>⤒</kbd> to hop out'],
    [/Steer with WASD · hop out with F or Space/g, 'Steer with the stick · tap ⤒ to hop out'],
    [/<kbd>Right-click<\/kbd> or <kbd>F<\/kbd> /g, '<kbd>Tap</kbd> to '],
    [/<kbd>Right-click<\/kbd> to eat/g, 'Tap <kbd>🍴</kbd> to eat'],
    [/&nbsp;·&nbsp; <kbd>Right-click<\/kbd> reel in/g, ''],
    [/<kbd>Right-click<\/kbd> place/g, '<kbd>Tap</kbd> to place'],
    [/<kbd>Right-click<\/kbd>/g, '<kbd>Tap</kbd>'],
    [/<kbd>Hold click<\/kbd>/g, '<kbd>Hold</kbd>'],
    [/<kbd>Click<\/kbd>/g, '<kbd>Tap</kbd>'],
    [/ · <kbd>R<\/kbd> rotate/g, ' · <kbd>↻</kbd> rotate'],
    [/press <kbd>G<\/kbd> to make a wish/g, 'tap <kbd>🌠</kbd> to make a wish'],
    [/Press <kbd>G<\/kbd> to wave/g, 'Tap <kbd>👋</kbd> to wave'],
    [/Press G when a shooting star/g, 'Tap 🌠 when a shooting star'],
    [/Wave \(press G\)/g, 'Wave (tap 👋)'],
    [/press <kbd>O<\/kbd> any time/g, 'tap <kbd>👕</kbd> any time'],
    [/Press <kbd>H<\/kbd> any time for help/g, 'Tap <kbd>❔</kbd> any time for help'],
    [/Press <kbd>H<\/kbd> and choose/g, 'Tap <kbd>❔</kbd> and choose'],
    [/ · press <kbd>V<\/kbd> to keep roofs visible/g, ''],
    [/ — press <kbd>V<\/kbd> to lift them away indoors again/g, ' — the same button lifts them away again'],
    [/press <kbd>P<\/kbd> again to bring everything back/g, 'tap anywhere to bring everything back'],
    [/Tip: <kbd>Q<\/kbd> and <kbd>E<\/kbd> turn the camera, <kbd>Z<\/kbd> and <kbd>C<\/kbd> tilt[^<]*/g, 'Tip: drag across the island to look around, and pinch to zoom'],
    [/Click an item to pick it up, click a slot to put it down · Shift-click to quick-move/g, 'Tap an item, then tap a slot to move it · tap it twice to send it across'],
    [/Shift-click to move things quickly/g, 'Tap an item twice to move it across'],
    [/\(Tab → /g, '(🎒 → '],
    [/\(Tab\)/g, '(🎒)'],
    [/\(right-click it\)/g, '(tap it)'],
    [/Click when the marker/g, 'Tap when the marker'],
    [/click it to hop in/g, 'tap it to hop in'],
  ];
  // Every message shown on screen passes through here; without touch it comes back unchanged.
  G.tx = function (s) {
    if (!T.on || !s) return s;
    for (const w of WORDS) s = s.replace(w[0], w[1]);
    return s;
  };

  // ---------- aiming ----------
  function setAim(cx, cy) {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = cx - r.left; input.mouse.y = cy - r.top; input.mouse.inside = true;
    input.ndc.set((input.mouse.x / r.width) * 2 - 1, -(input.mouse.y / r.height) * 2 + 1);
    aimT = 3.5;
  }

  T.aim = setAim;

  // A tap does the natural thing for whatever is under the finger.
  function smartTap() {
    if (G.ui.blocking()) return;
    G.refreshTarget();
    const t = G.target, held = G.heldItem();
    if (G.fishing && G.fishing.state !== 'idle') { G.emit('primary'); return; }
    if (!t) { if (held && held.key === 'rowboat') G.launchBoat(); return; }
    if (t.type !== 'block') { G.emit('primary'); return; }           // animals, neighbours, bugs, water
    if (!t.near) {
      if (farToastT <= 0) { farToastT = 3; G.ui.toast('A little too far — walk closer'); }
      return;
    }
    const def = t.def;
    if (def.use) { G.useBlock(t.x, t.y, t.z, def); return; }
    if (def.cat === 'find') { G.emit('primary'); return; }           // shells, fruit, driftwood
    if (held && held.kind === 'seed') { if (G.plantSeed) G.plantSeed(t, held); return; }
    if (held && held.key === 'rowboat') { G.launchBoat(); return; }
    if (held && held.kind === 'block') { G.tryPlace(); return; }
    G.emit('primary');                                               // a tool or an empty hand: one hit
  }

  function stopHold() {
    input.leftDown = false;
    input.mouseShift = false;
  }
  function releaseAll() {
    pts.clear();
    joy.x = joy.y = joy.mag = 0; joy.active = false;
    if (joyEl) joyEl.classList.remove('show');
    input.dragging = false;
    stopHold();
    input.keys.Space = false;
  }
  T.releaseAll = releaseAll;

  function inJoyZone(x, y) {
    const w = window.innerWidth, h = window.innerHeight;
    return w > h ? (x < w * 0.4 && y > h * 0.28) : (x < w * 0.5 && y > h * 0.52);
  }
  function looks() { const a = []; for (const p of pts.values()) if (p.role !== 'joy') a.push(p); return a; }

  function onStart(e) {
    e.preventDefault();                       // no scrolling, zooming or stand-in mouse events
    T.last = performance.now();
    if (!T.on) enable();
    if (document.body.classList.contains('photo')) { document.body.classList.remove('photo'); return; }
    if (G.ui.blocking()) return;
    for (const t of e.changedTouches) {
      const p = { id: t.identifier, role: 'look', x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now() };
      let hasJoy = false;
      for (const q of pts.values()) if (q.role === 'joy') hasJoy = true;
      if (!hasJoy && inJoyZone(p.x, p.y) && !(G.fishing && G.fishing.state !== 'idle')) {
        p.role = 'joy';
        joy.active = true; joy.x = joy.y = joy.mag = 0;
        joyEl.style.left = p.x + 'px'; joyEl.style.top = p.y + 'px';
        knobEl.style.transform = 'translate(-50%, -50%)';
        joyEl.classList.add('show');
      } else if (G.fishing && G.fishing.state !== 'idle') {
        // fishing is all about timing: act the moment the finger lands
        setAim(p.x, p.y); G.emit('primary'); p.role = 'used';
      } else if (looks().length >= 1) {
        // a second finger: pinch to zoom
        for (const q of looks()) { if (q.role === 'hold') stopHold(); q.role = 'pinch'; }
        p.role = 'pinch'; pinchD = 0;
        input.dragging = true;
      }
      pts.set(p.id, p);
    }
  }

  function onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const p = pts.get(t.identifier);
      if (!p) continue;
      const dx = t.clientX - p.x, dy = t.clientY - p.y;
      p.x = t.clientX; p.y = t.clientY;
      if (p.role === 'joy') {
        let jx = (p.x - p.x0) / JOY_R, jy = (p.y - p.y0) / JOY_R;
        const m = Math.hypot(jx, jy);
        if (m > 1) { jx /= m; jy /= m; }
        joy.mag = Math.min(1, m);
        joy.x = joy.mag > 0.2 ? jx : 0; joy.y = joy.mag > 0.2 ? jy : 0;
        knobEl.style.transform = 'translate(calc(-50% + ' + (jx * JOY_R) + 'px), calc(-50% + ' + (jy * JOY_R) + 'px))';
      } else if (p.role === 'look') {
        if (Math.hypot(p.x - p.x0, p.y - p.y0) > TAP_SLOP) { p.role = 'drag'; input.dragging = true; }
      } else if (p.role === 'drag') {
        G.cam.yaw -= dx * 0.0075;
        G.cam.pitch = G.clamp(G.cam.pitch + dy * 0.006, 0.12, 1.45);
      } else if (p.role === 'hold') {
        setAim(p.x, p.y);                     // slide the finger to keep digging along a row
      }
    }
    const pin = looks().filter((p) => p.role === 'pinch');
    if (pin.length >= 2) {
      const d = Math.hypot(pin[0].x - pin[1].x, pin[0].y - pin[1].y);
      if (pinchD > 0 && d > 0) G.cam.wantDist = G.clamp(G.cam.wantDist * (pinchD / d), 3.2, 28);
      pinchD = d;
    }
  }

  function onEnd(e) {
    e.preventDefault();
    const cancelled = e.type === 'touchcancel';
    for (const t of e.changedTouches) {
      const p = pts.get(t.identifier);
      if (!p) continue;
      pts.delete(p.id);
      const quick = performance.now() - p.t0 < HOLD_MS, still = Math.hypot(p.x - p.x0, p.y - p.y0) <= TAP_SLOP;
      if (p.role === 'joy') {
        joy.x = joy.y = joy.mag = 0; joy.active = false;
        joyEl.classList.remove('show');
        if (!cancelled && quick && still) { setAim(p.x, p.y); smartTap(); }       // a tap, not a push
      } else if (p.role === 'look') {
        if (!cancelled && still) { setAim(p.x, p.y); smartTap(); }
      } else if (p.role === 'hold') {
        stopHold();
      } else if (p.role === 'pinch') {
        // the finger left behind carries on as a camera drag
        for (const q of looks()) if (q.role === 'pinch') q.role = 'drag';
        pinchD = 0;
      }
    }
    if (!looks().some((p) => p.role === 'drag' || p.role === 'pinch')) input.dragging = false;
  }

  // ---------- per-frame ----------
  G.updateTouch = function (dt) {
    if (!T.on) return;
    if (farToastT > 0) farToastT -= dt;
    if (G.ui.blocking()) { if (pts.size || joy.active || input.leftDown) releaseAll(); return; }
    // a finger resting in one place becomes a long press: start hitting what is under it
    const now = performance.now();
    let holding = false;
    for (const p of pts.values()) {
      if (p.role === 'look' && now - p.t0 >= HOLD_MS) {
        p.role = 'hold';
        setAim(p.x, p.y);
        input.mouseShift = true;              // a long press stands in for Shift + click (picking the boat up)
        input.leftDown = true;
        G.emit('primary', true);
      }
      if (p.role === 'hold') { holding = true; aimT = 3.5; }
    }
    if (!holding && input.mouse.inside) { aimT -= dt; if (aimT <= 0) input.mouse.inside = false; }
    // context buttons
    ctxT -= dt;
    if (ctxT <= 0) {
      ctxT = 0.15;
      const held = G.heldItem();
      const hb = held && held.kind === 'block' ? G.BLOCKS[held.block] : null;
      btn.rot.hidden = !(hb && hb.rot && !hb.wall);
      btn.eat.hidden = !(held && (held.food || held.kind === 'food'));
      const wish = G.wishWindow > 0 && ((G.flags && G.flags.wishes) || 0) < 3;
      if (btn.wave._wish !== wish) { btn.wave._wish = wish; btn.wave.textContent = wish ? '🌠' : '👋'; btn.wave.classList.toggle('glow', wish); }
    }
  };

  // ---------- on-screen buttons ----------
  function press(el, down, up) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      el.classList.add('down');
      if (!G.ui.blocking()) down();
    });
    const end = () => { el.classList.remove('down'); if (up) up(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function build() {
    const ui = document.getElementById('ui');
    joyEl = document.createElement('div'); joyEl.id = 'joy';
    knobEl = document.createElement('i'); joyEl.appendChild(knobEl);
    pad = document.createElement('div'); pad.id = 'pad';
    pad.innerHTML = '<button id="tb-eat" class="tb small" hidden aria-label="Eat">🍴</button>' +
      '<button id="tb-rot" class="tb small" hidden aria-label="Rotate">↻</button>' +
      '<button id="tb-wave" class="tb small" aria-label="Wave">👋</button>' +
      '<button id="tb-use" class="tb" aria-label="Use the nearest thing">✋</button>' +
      '<button id="tb-jump" class="tb big" aria-label="Jump">⤒</button>';
    const before = document.getElementById('modal-back');
    ui.insertBefore(joyEl, before); ui.insertBefore(pad, before);
    btn = { eat: document.getElementById('tb-eat'), rot: document.getElementById('tb-rot'), wave: document.getElementById('tb-wave'), use: document.getElementById('tb-use'), jump: document.getElementById('tb-jump') };
    press(btn.jump, () => { input.keys.Space = true; }, () => { input.keys.Space = false; });
    press(btn.use, () => { input.mouse.inside = false; G.refreshTarget(); G.useAction(); });
    press(btn.wave, () => G.emit('keydown', 'KeyG'));
    press(btn.rot, () => G.emit('keydown', 'KeyR'));
    press(btn.eat, () => G.eatHeld());
  }

  function enable() {
    if (T.on) return;
    T.on = true;
    document.body.classList.add('touch');
    if (!pad) build();
    // the soft-focus blur is costly over a 3D view on phones: off unless full graphics was chosen by hand
    let chosen = null;
    try { chosen = localStorage.getItem('tidewood-simple'); } catch (e) { /* private mode */ }
    if (chosen === null) document.body.classList.add('nolens');
    G.emit('touchmode');
  }
  T.enable = enable;

  G.initTouch = function () {
    canvas = G.renderer.domElement;
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });
    canvas.addEventListener('touchcancel', onEnd, { passive: false });
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
    // Safari's own pinch-to-zoom of the whole page
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    // photo mode hides every button, so any tap brings them back
    document.addEventListener('pointerdown', (e) => {
      if (T.on && e.pointerType === 'touch' && document.body.classList.contains('photo')) document.body.classList.remove('photo');
    }, true);
    const coarse = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (coarse) enable();
    else window.addEventListener('touchstart', () => enable(), { passive: true, once: true });
  };
})();
