// Tidewood Isle — core namespace, constants, math helpers, seeded noise.
'use strict';
const G = window.G = window.game = {};

G.SAVE_VERSION = 2;
G.SAVE_KEY = 'tidewood-isle-save';

// World dimensions (in blocks)
G.W = 160;           // x size
G.D = 160;           // z size
G.H = 48;            // y size
G.CHUNK = 16;
G.SEA = 12;          // cells with y < SEA and no block are water
G.WATER_Y = 11.8;    // world-space height of the water surface

G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
G.lerp = (a, b, t) => a + (b - a) * t;
G.smooth = (a, b, v) => { const t = G.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
G.mod = (a, n) => ((a % n) + n) % n;

// Mulberry32 seeded RNG
G.makeRng = function (seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Integer hash -> [0,1)
G.hash2 = function (x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + (seed | 0) * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

// Smooth value noise in [0,1]
G.vnoise = function (x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = G.hash2(xi, yi, seed), b = G.hash2(xi + 1, yi, seed);
  const c = G.hash2(xi, yi + 1, seed), d = G.hash2(xi + 1, yi + 1, seed);
  return G.lerp(G.lerp(a, b, u), G.lerp(c, d, u), v);
};

// Fractal noise in [0,1]
G.fbm = function (x, y, seed, oct) {
  let amp = 0.5, sum = 0, norm = 0;
  for (let i = 0; i < (oct || 4); i++) {
    sum += amp * G.vnoise(x, y, seed + i * 101);
    norm += amp; amp *= 0.5; x *= 2; y *= 2;
  }
  return sum / norm;
};

G.pick = (arr, rnd) => arr[Math.floor((rnd || Math.random)() * arr.length)];

// Weighted pick from [{w:..}, ...]
G.pickWeighted = function (list, rnd) {
  let total = 0;
  for (const it of list) total += it.w;
  let r = (rnd || Math.random)() * total;
  for (const it of list) { r -= it.w; if (r <= 0) return it; }
  return list[list.length - 1];
};

// Tiny event bus so systems (quests, journal, audio) can react without tight coupling.
G.listeners = {};
G.on = function (name, fn) { (G.listeners[name] = G.listeners[name] || []).push(fn); };
G.emit = function (name, ...args) {
  const l = G.listeners[name];
  if (l) for (const fn of l) { try { fn(...args); } catch (e) { console.error('listener ' + name, e); } }
};
