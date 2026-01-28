// ── Utility Functions & Seeded RNG ──

/**
 * Mulberry32 – fast 32-bit seeded PRNG.
 * Returns a function that produces [0, 1) on each call.
 */
export function createRNG(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate a random integer seed from Math.random */
export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

/** Clamp value between min and max */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Distance between two points */
export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Pick random element from array */
export function pick(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Shuffle array in-place (Fisher-Yates) */
export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Simple unique ID generator */
let _uid = 0;
export function uid() {
  return ++_uid;
}

/** Format number with commas */
export function formatNum(n) {
  return n.toLocaleString();
}

/** Deep clone a plain object (JSON-safe) */
export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
