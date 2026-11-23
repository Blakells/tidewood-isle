// Tidewood Isle — all sound is synthesised with WebAudio: waves, a gentle generative tune, and little effects.
'use strict';
(function () {
  const A = G.audio = { ctx: null, muted: false, started: false };
  let master, sfxBus, musicBus, ambBus, noiseBuf;

  A.start = function () {
    if (A.started) { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      A.ctx = new Ctx();
    } catch (e) { return; }
    const ctx = A.ctx;
    master = ctx.createGain(); master.gain.value = A.muted ? 0 : 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.22; ambBus.connect(master);
    // shared noise
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // ocean: looping noise through a slowly breathing low-pass
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const swell = ctx.createGain(); swell.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain); lfoGain.connect(swell.gain);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.07;
    const lfo2Gain = ctx.createGain(); lfo2Gain.gain.value = 240;
    lfo2.connect(lfo2Gain); lfo2Gain.connect(lp.frequency);
    src.connect(lp); lp.connect(swell); swell.connect(ambBus);
    src.start(); lfo.start(); lfo2.start();
    // rain: bright hiss whose volume follows the weather
    const rsrc = ctx.createBufferSource(); rsrc.buffer = noiseBuf; rsrc.loop = true;
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 1800;
    A.rainGain = ctx.createGain(); A.rainGain.gain.value = 0;
    rsrc.connect(rhp); rhp.connect(A.rainGain); A.rainGain.connect(ambBus);
    rsrc.start();
    A.started = true;
    scheduleMusic();
  };

  A.musicOff = false;
  A.toggleMusic = function () { A.musicOff = !A.musicOff; };

  A.toggleMute = function () {
    A.muted = !A.muted;
    if (master) master.gain.value = A.muted ? 0 : 0.9;
  };

  function tone(freq, dur, opts) {
    if (!A.started || A.muted) return;
    opts = opts || {};
    const ctx = A.ctx, t0 = ctx.currentTime + (opts.delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const v = opts.vol === undefined ? 0.3 : opts.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(opts.bus || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, opts) {
    if (!A.started || A.muted) return;
    opts = opts || {};
    const ctx = A.ctx, t0 = ctx.currentTime + (opts.delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = opts.type || 'lowpass';
    f.frequency.setValueAtTime(opts.freq || 1200, t0);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const g = ctx.createGain();
    const v = opts.vol === undefined ? 0.3 : opts.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(opts.bus || sfxBus);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
  }
  A.tone = tone; A.noise = noise;
  // a burble of quick little notes when someone talks, each character with their own pitch
  A.speak = function (pitch, len) {
    for (let i = 0; i < (len || 9); i++) tone(pitch * (0.84 + Math.random() * 0.38), 0.065, { type: 'triangle', vol: 0.11, delay: i * 0.07 });
  };

  const N = { C4: 261.6, D4: 293.7, E4: 329.6, G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };
  const SFX = {
    step: () => noise(0.07, { freq: 700, vol: 0.07 }),
    jump: () => tone(320, 0.14, { to: 520, vol: 0.12, type: 'triangle' }),
    place: () => { tone(190, 0.09, { to: 120, vol: 0.3, type: 'triangle' }); noise(0.05, { freq: 900, vol: 0.12 }); },
    break: () => { noise(0.16, { freq: 1400, to: 300, vol: 0.3 }); tone(140, 0.12, { to: 70, vol: 0.25, type: 'triangle' }); },
    hitWood: () => { tone(210, 0.08, { to: 150, vol: 0.28, type: 'triangle' }); noise(0.04, { freq: 1800, vol: 0.1 }); },
    hitStone: () => { tone(620, 0.05, { to: 420, vol: 0.14, type: 'square' }); noise(0.05, { freq: 3200, vol: 0.14, type: 'highpass' }); },
    hitSoft: () => noise(0.09, { freq: 900, to: 400, vol: 0.22 }),
    pickup: () => { tone(N.E6, 0.09, { vol: 0.16 }); tone(N.G6, 0.14, { vol: 0.16, delay: 0.07 }); },
    coin: () => { tone(N.C6, 0.08, { vol: 0.16, type: 'triangle' }); tone(N.E6, 0.2, { vol: 0.16, type: 'triangle', delay: 0.07 }); },
    craft: () => { tone(180, 0.07, { vol: 0.25, type: 'triangle' }); tone(240, 0.07, { vol: 0.22, type: 'triangle', delay: 0.09 }); tone(N.G5, 0.2, { vol: 0.14, delay: 0.18 }); },
    open: () => tone(440, 0.08, { to: 620, vol: 0.1 }),
    close: () => tone(520, 0.08, { to: 360, vol: 0.1 }),
    tick: () => tone(880, 0.03, { vol: 0.08, type: 'triangle' }),
    tickUp: () => { tone(N.A5, 0.07, { vol: 0.16 }); tone(N.E6, 0.12, { vol: 0.16, delay: 0.06 }); },
    nope: () => tone(160, 0.16, { to: 110, vol: 0.16, type: 'square' }),
    fanfare: () => [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, 0.28, { vol: 0.18, type: 'triangle', delay: i * 0.11 })),
    catch: () => [N.G5, N.C6, N.E6].forEach((f, i) => tone(f, 0.22, { vol: 0.17, type: 'triangle', delay: i * 0.09 })),
    cast: () => noise(0.3, { freq: 600, to: 3000, vol: 0.14, type: 'bandpass' }),
    plop: () => { tone(420, 0.14, { to: 140, vol: 0.2 }); noise(0.12, { freq: 1600, vol: 0.1 }); },
    bite: () => { noise(0.25, { freq: 2600, to: 700, vol: 0.3 }); tone(N.E6, 0.1, { vol: 0.14 }); tone(N.E6, 0.1, { vol: 0.14, delay: 0.12 }); },
    hook: () => tone(300, 0.2, { to: 700, vol: 0.18, type: 'triangle' }),
    reel: () => noise(0.18, { freq: 2000, to: 800, vol: 0.1, type: 'bandpass' }),
    ignite: () => { noise(0.4, { freq: 500, to: 2600, vol: 0.2 }); },
    sizzle: () => noise(0.7, { freq: 5200, vol: 0.14, type: 'highpass' }),
    douse: () => noise(0.5, { freq: 3000, to: 300, vol: 0.2 }),
    doorOpen: () => { tone(170, 0.08, { vol: 0.22, type: 'triangle' }); tone(260, 0.1, { vol: 0.12, type: 'triangle', delay: 0.07 }); },
    doorClose: () => { tone(230, 0.07, { vol: 0.14, type: 'triangle' }); tone(130, 0.12, { vol: 0.26, type: 'triangle', delay: 0.06 }); },
    sit: () => tone(240, 0.12, { to: 170, vol: 0.12 }),
    eat: () => { tone(300, 0.07, { to: 220, vol: 0.18, type: 'triangle' }); tone(280, 0.07, { to: 200, vol: 0.18, type: 'triangle', delay: 0.14 }); },
    timber: () => { noise(0.5, { freq: 2400, to: 300, vol: 0.28 }); tone(90, 0.3, { to: 50, vol: 0.35, type: 'triangle', delay: 0.25 }); },
    lullaby: () => [N.E5, N.D5, N.C5, N.G4].forEach((f, i) => tone(f, 0.6, { vol: 0.14, delay: i * 0.4, attack: 0.05 })),
    chirp: () => { tone(900, 0.07, { to: 1300, vol: 0.12 }); tone(1100, 0.09, { to: 1500, vol: 0.12, delay: 0.1 }); },
    meow: () => tone(620, 0.32, { to: 880, vol: 0.14, type: 'triangle', attack: 0.04 }),
    woof: () => { tone(260, 0.1, { to: 180, vol: 0.22, type: 'sawtooth' }); tone(250, 0.12, { to: 170, vol: 0.2, type: 'sawtooth', delay: 0.16 }); },
    squeak: () => tone(1500, 0.09, { to: 2100, vol: 0.1 }),
    click: () => { tone(1200, 0.03, { vol: 0.12, type: 'square' }); tone(1400, 0.03, { vol: 0.12, type: 'square', delay: 0.07 }); },
    quack: () => { tone(520, 0.1, { to: 380, vol: 0.14, type: 'sawtooth' }); tone(500, 0.1, { to: 360, vol: 0.14, type: 'sawtooth', delay: 0.13 }); },
    yip: () => tone(700, 0.12, { to: 1100, vol: 0.14, type: 'triangle' }),
    patter: () => noise(0.04, { freq: 1000, vol: 0.04 }),
  };
  G.on('sfx', (name) => { const f = SFX[name]; if (f) { try { f(); } catch (e) { /* audio hiccup */ } } });

  // ---- a sparse, sleepy pentatonic tune ----
  const DAY = [N.C4, N.D4, N.E4, N.G4, N.A4, N.C5, N.D5, N.E5, N.G5];
  const NIGHT = [N.C4, N.E4, N.G4, N.A4, N.C5, N.E5];
  let last = 4;
  function scheduleMusic() {
    if (!A.started) return;
    const scale = G.isNight() ? NIGHT : DAY;
    if (!A.muted && !A.musicOff && !document.hidden) {
      last = G.clamp(last + ((Math.random() * 5) | 0) - 2, 0, scale.length - 1);
      const f = scale[last];
      tone(f, 2.4, { vol: 0.5, bus: musicBus, attack: 0.06, type: 'sine' });
      tone(f * 2, 1.6, { vol: 0.12, bus: musicBus, attack: 0.04, type: 'triangle' });
      if (Math.random() < 0.3) tone(scale[Math.max(0, last - 2)] / 2, 3.2, { vol: 0.4, bus: musicBus, attack: 0.3 });
      if (Math.random() < 0.25) tone(scale[Math.min(scale.length - 1, last + 2)], 1.8, { vol: 0.3, bus: musicBus, attack: 0.05, delay: 0.3 });
    }
    setTimeout(scheduleMusic, (G.isNight() ? 1500 : 900) + Math.random() * 2200);
  }

  // crackle when a lit campfire is close
  let crackT = 0, cricketT = 2;
  G.updateAudio = function (dt) {
    if (!A.started || A.muted) return;
    if (A.rainGain && G.weather) A.rainGain.gain.value = G.weather.amount * 0.5;
    // crickets on dry nights
    cricketT -= dt;
    if (cricketT <= 0) {
      cricketT = 0.5 + Math.random() * 1.4;
      if ((G.nightAmount || 0) > 0.7 && !(G.weather && G.weather.raining) && G.player.pos.y > G.SEA) {
        const f = 3900 + Math.random() * 700;
        for (let i = 0; i < 3; i++) tone(f, 0.04, { vol: 0.02, delay: i * 0.07, bus: ambBus });
      }
    }
    crackT -= dt;
    if (crackT > 0) return;
    crackT = 0.12 + Math.random() * 0.3;
    const p = G.player.pos;
    for (const s of G.lightSources.values()) {
      if (s.power > 1) {
        const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
        if (d < 100) { noise(0.03, { freq: 2500 + Math.random() * 3000, vol: 0.12 * (1 - d / 100), type: 'bandpass' }); break; }
      }
    }
  };
})();
