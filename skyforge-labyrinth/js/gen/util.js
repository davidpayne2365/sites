// Deterministic helpers for world generation: hashing, seeded random numbers, value noise and a clipped voxel volume.
// Everything here is a pure function of the world seed and coordinates, so any worker can rebuild any part of
// the world and get exactly the same blocks.
import { GEN_REMAP } from '../blocks.js';

export function hash(a, b = 0, c = 0, d = 0) {
  // Each input is folded in and fully mixed before the next, so (x, y) and (-x, -y) etc. never collide.
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) ^ Math.imul(b | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) ^ Math.imul(c | 0, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) ^ Math.imul(d | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}
export const hashf = (a, b, c, d) => hash(a, b, c, d) / 4294967296;
export function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

export class RNG {
  constructor(seed) { this.s = seed >>> 0 || 1; }
  next() { // mulberry32
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  range(a, b) { return a + this.next() * (b - a); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  weighted(list) { // [[item, weight], ...]
    let tot = 0; for (const [, w] of list) tot += w;
    let r = this.next() * tot;
    for (const [it, w] of list) { if ((r -= w) < 0) return it; }
    return list[list.length - 1][0];
  }
  fork(tag) { return new RNG(hash(this.s, typeof tag === 'string' ? strHash(tag) : tag)); }
}

// Value noise in 2D and 3D (smooth, deterministic), plus fractal sums.
const fade = t => t * t * (3 - 2 * t);
export function noise2(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = fade(x - xi), zf = fade(z - zi);
  const a = hashf(xi, zi, seed), b = hashf(xi + 1, zi, seed), c = hashf(xi, zi + 1, seed), d = hashf(xi + 1, zi + 1, seed);
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}
export function noise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const h = (i, j, k) => hashf(xi + i, yi + j, zi + k, seed);
  const x00 = h(0, 0, 0) + (h(1, 0, 0) - h(0, 0, 0)) * xf, x10 = h(0, 1, 0) + (h(1, 1, 0) - h(0, 1, 0)) * xf;
  const x01 = h(0, 0, 1) + (h(1, 0, 1) - h(0, 0, 1)) * xf, x11 = h(0, 1, 1) + (h(1, 1, 1) - h(0, 1, 1)) * xf;
  const y0 = x00 + (x10 - x00) * yf, y1 = x01 + (x11 - x01) * yf;
  return y0 + (y1 - y0) * zf;
}
export function fbm2(x, z, seed, oct = 3) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, z * f, seed + i * 131); n += a; a *= 0.5; f *= 2; } return s / n; }
export function fbm3(x, y, z, seed, oct = 3) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f, seed + i * 131); n += a; a *= 0.5; f *= 2; } return s / n; }

// A material is a block id or a function (x, y, z) -> id, which lets walls mix texture variations.
export const matAt = (m, x, y, z) => (typeof m === 'number' ? m : m(x, y, z));
// Weighted per-block mix: [[id, weight], ...]. `scale` > 1 makes patches instead of speckles.
export function mix(list, seed = 0, scale = 1) {
  let tot = 0; for (const [, w] of list) tot += w;
  const ids = list.map(l => l[0]), cum = []; let c = 0; for (const [, w] of list) { c += w / tot; cum.push(c); }
  if (list.length === 1) return ids[0];
  return (x, y, z) => {
    const r = scale > 1 ? fbm3(x / scale, y / scale, z / scale, seed, 2) * 1.6 - 0.3 + hashf(x, y, z, seed) * 0.3 : hashf(x, y, z, seed);
    for (let i = 0; i < cum.length; i++) if (r < cum[i]) return ids[i];
    return ids[ids.length - 1];
  };
}

// World constants.
export const H = 256;            // world height
export const GROUND = 64;        // the y players walk on in the labyrinth (floor block at 63)
export const CHUNK = 32;         // chunk column size

// A box of voxels [x0, x0+sx) x [0, H) x [z0, z0+sz). Writes outside are silently clipped, which is what lets
// every chunk run the same generators and keep only its own part.
export class Vol {
  constructor(x0, z0, sx, sz) {
    this.x0 = x0; this.z0 = z0; this.sx = sx; this.sz = sz; this.x1 = x0 + sx - 1; this.z1 = z0 + sz - 1;
    this.ids = new Uint16Array(sx * sz * H);
    this.coins = []; this.chests = []; this.fx = []; this.marks = []; this.portals = [];
  }
  idx(x, y, z) { return (x - this.x0) + this.sx * ((z - this.z0) + this.sz * y); }
  has(x, y, z) { return x >= this.x0 && x <= this.x1 && z >= this.z0 && z <= this.z1 && y >= 0 && y < H; }
  get(x, y, z) { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); return this.has(x, y, z) ? this.ids[this.idx(x, y, z)] : 0; }
  set(x, y, z, m) { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (this.has(x, y, z)) this.ids[this.idx(x, y, z)] = GEN_REMAP[matAt(m, x, y, z)]; }
  // Set only where the cell is currently air (or, with `over`, a cell of that id).
  put(x, y, z, m) { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (this.has(x, y, z)) { const i = this.idx(x, y, z); if (!this.ids[i]) this.ids[i] = GEN_REMAP[matAt(m, x, y, z)]; } }
  overlaps(x0, z0, x1, z1) { return !(x1 < this.x0 || x0 > this.x1 || z1 < this.z0 || z0 > this.z1); }
  fill(ax, ay, az, bx, by, bz, m, onlyAir = false) {
    let x0 = Math.floor(Math.min(ax, bx)), x1 = Math.floor(Math.max(ax, bx)), y0 = Math.floor(Math.min(ay, by)), y1 = Math.floor(Math.max(ay, by)), z0 = Math.floor(Math.min(az, bz)), z1 = Math.floor(Math.max(az, bz));
    x0 = Math.max(x0, this.x0); x1 = Math.min(x1, this.x1); z0 = Math.max(z0, this.z0); z1 = Math.min(z1, this.z1);
    y0 = Math.max(y0, 0); y1 = Math.min(y1, H - 1);
    if (x0 > x1 || z0 > z1 || y0 > y1) return;
    const ids = this.ids, fn = typeof m === 'function';
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      let i = this.idx(x0, y, z);
      for (let x = x0; x <= x1; x++, i++) if (!onlyAir || !ids[i]) ids[i] = GEN_REMAP[fn ? m(x, y, z) : m];
    }
  }
  // Walls of a box (no top or bottom).
  shell(ax, ay, az, bx, by, bz, m, t = 1) {
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), z0 = Math.min(az, bz), z1 = Math.max(az, bz);
    this.fill(x0, ay, z0, x1, by, z0 + t - 1, m); this.fill(x0, ay, z1 - t + 1, x1, by, z1, m);
    this.fill(x0, ay, z0, x0 + t - 1, by, z1, m); this.fill(x1 - t + 1, ay, z0, x1, by, z1, m);
  }
  // Calls fn(x, z) for every column of the rectangle that lies inside this volume.
  each(ax, az, bx, bz, fn) {
    const x0 = Math.max(Math.floor(Math.min(ax, bx)), this.x0), x1 = Math.min(Math.floor(Math.max(ax, bx)), this.x1);
    const z0 = Math.max(Math.floor(Math.min(az, bz)), this.z0), z1 = Math.min(Math.floor(Math.max(az, bz)), this.z1);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) fn(x, z);
  }
  // Vertical cylinder (filled, or a ring of thickness t).
  cyl(cx, cz, r, y0, y1, m, t = 0) {
    const R = Math.ceil(r);
    this.each(Math.floor(cx - R), Math.floor(cz - R), Math.ceil(cx + R), Math.ceil(cz + R), (x, z) => {
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      if (d <= r && (!t || d > r - t)) this.fill(x, y0, z, x, y1, z, m);
    });
  }
  sphere(cx, cy, cz, r, m, onlyAir = false, minY = 0) {
    const R = Math.ceil(r);
    this.each(Math.floor(cx - R), Math.floor(cz - R), Math.ceil(cx + R), Math.ceil(cz + R), (x, z) => {
      const dx = x + 0.5 - cx, dz = z + 0.5 - cz, h2 = r * r - dx * dx - dz * dz;
      if (h2 < 0) return;
      const h = Math.sqrt(h2);
      for (let y = Math.max(minY, Math.ceil(cy - h - 0.5)); y <= Math.min(H - 1, Math.floor(cy + h - 0.5)); y++) {
        if (onlyAir) this.put(x, y, z, m); else this.set(x, y, z, m);
      }
    });
  }
  // Entities (only kept by the worker when they fall inside the chunk being built).
  coin(x, y, z, value = 1) { this.coins.push([x + 0.5, y + 0.5, z + 0.5, value]); }
  // A portal opening (inclusive box of Portal blocks) leading to `dest` = { x, y, z, yaw, label }.
  portal(x0, y0, z0, x1, y1, z1, dest) { this.portals.push([Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1), dest.x, dest.y, dest.z, dest.yaw || 0, dest.label || 'Portal']); }
  // `home`: where the chest offers to take you once opened (a castle's final chest: back outside its entrance).
  chest(x, y, z, id, coins, tier, home) { this.set(x, y, z, id); this.chests.push(home ? [x, y, z, coins, tier, home] : [x, y, z, coins, tier]); }
}

// A name of its own for every place (so the map never shows six "Dracula's Spires"): from a clearing's seed.
const NAME_A = ['Ash', 'Raven', 'Thorn', 'Mist', 'Oak', 'Stone', 'Wolf', 'Briar', 'Frost', 'Gold', 'Ember', 'Hollow', 'Moss', 'Iron',
  'Silver', 'Black', 'Rose', 'Storm', 'Elder', 'Dusk', 'Bramble', 'Fern', 'Hawk', 'Willow', 'Glimmer', 'Cinder', 'Wren', 'Marrow'];
const NAME_B = ['vale', 'moor', 'hold', 'fell', 'wood', 'mere', 'crest', 'ford', 'haven', 'reach', 'gate', 'dale', 'barrow', 'wick',
  'spire', 'marsh', 'glen', 'helm', 'combe', 'hollow', 'thorne', 'mire'];
export function placeName(seed) {
  const h = hash(seed, 0x9a3e);
  let a = NAME_A[h % NAME_A.length], b = NAME_B[(h >>> 8) % NAME_B.length];
  if (a.toLowerCase().endsWith(b.slice(0, 3))) b = NAME_B[((h >>> 8) + 7) % NAME_B.length];
  return a + b;
}

// Conquered places (clearing keys "bx0,bz0"): a castle brought down is built as a flower meadow, a dungeon, cave or
// mine you've finished has its entrance sealed. Set by the worker from the game's saved list before generating.
export const DONE = new Set();
export function setDone(list) { DONE.clear(); if (list) for (const k of list) DONE.add(k); }
export const siteKey = c => `${c.bx0},${c.bz0}`;
