// The ocean world: a grid of quarter-size cubes. Open water is id 0. Everything is generated from a fixed seed,
// so it is the same ocean every time (but blocks you move are not saved).
import { B, IS_CUBE, IS_SPRITE, NBLOCKS, LIGHT } from './blocks.js';

export const VS = 0.25;            // one block is 0.25 world units: a quarter of the old full-size block
export const NX = 384, NY = 112, NZ = 384;
export const CH = 16;              // chunk size in blocks
export const NCX = NX / CH, NCY = NY / CH, NCZ = NZ / CH;
export const SURF = NY * VS;       // y of the water surface (28 units)

// ---- noise -----------------------------------------------------------------------------------------------------
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
const sm = t => t * t * (3 - 2 * t);
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), tx = sm(x - xi), ty = sm(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
function fbm(x, y, s, oct) { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2; } return v / n; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class World {
  constructor() {
    this.ids = new Uint8Array(NX * NY * NZ);
    this.colTop = new Int16Array(NX * NZ).fill(-1); // highest solid cube in each column (for sunlight)
    this.dirty = new Set();                         // chunk indices that need re-meshing after an edit
    this.emitters = new Map();                      // chunk index -> glowing blocks in it: [x, y, z, strength]
    this.edits = new Map();                         // what the player changed (block index -> id), for saving
    this.onSet = null;                              // callback(x, y, z, id) after the player changes a block
  }
  ckey(cx, cy, cz) { return cx + NCX * (cz + NCZ * cy); }
  rebuildEmitters() {
    this.emitters.clear(); const ids = this.ids;
    for (let i = 0; i < ids.length; i++) if (LIGHT[ids[i]] > 0) { const x = i % NX, z = ((i / NX) | 0) % NZ, y = (i / (NX * NZ)) | 0; this.addEmitter(x, y, z, ids[i]); }
  }
  addEmitter(x, y, z, id) { const k = this.ckey(x >> 4, y >> 4, z >> 4); let a = this.emitters.get(k); if (!a) this.emitters.set(k, a = []); a.push([x, y, z, LIGHT[id]]); }
  removeEmitter(x, y, z) { const k = this.ckey(x >> 4, y >> 4, z >> 4), a = this.emitters.get(k); if (a) { const i = a.findIndex(e => e[0] === x && e[1] === y && e[2] === z); if (i >= 0) a.splice(i, 1); } }
  nearEmitters(cx, cy, cz, out) { // glowing blocks in this chunk and the 26 around it
    out.length = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const a = this.emitters.get(this.ckey(cx + dx, cy + dy, cz + dz)); if (a) for (const e of a) out.push(e);
    }
    return out;
  }
  idx(x, y, z) { return x + NX * (z + NZ * y); }
  inb(x, y, z) { return x >= 0 && x < NX && y >= 0 && y < NY && z >= 0 && z < NZ; }
  get(x, y, z) { return this.inb(x, y, z) ? this.ids[x + NX * (z + NZ * y)] : (y >= NY ? 0 : 1); }
  isSolid(x, y, z) {
    if (y >= NY) return false;
    if (y < 0 || x < 0 || x >= NX || z < 0 || z >= NZ) return true;
    return IS_CUBE[this.ids[x + NX * (z + NZ * y)]] === 1;
  }
  // Change one block (used when you pick one up or it lands) and mark the chunks that show it.
  set(x, y, z, id, record = true) {
    if (!this.inb(x, y, z)) return;
    const old = this.ids[this.idx(x, y, z)];
    this.ids[this.idx(x, y, z)] = id;
    if (record) this.edits.set(this.idx(x, y, z), id);
    if (LIGHT[old] > 0 || LIGHT[id] > 0) {
      if (LIGHT[old] > 0) this.removeEmitter(x, y, z);
      if (LIGHT[id] > 0) this.addEmitter(x, y, z, id);
      for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.markDirty((x >> 4) + dx, (y >> 4) + dy, (z >> 4) + dz);
    }
    if (record && this.onSet) this.onSet(x, y, z, id);
    const c = x + NX * z, oldTop = this.colTop[c];
    if (IS_CUBE[id]) { if (y > this.colTop[c]) this.colTop[c] = y; }
    else if (y === this.colTop[c]) { let t = y - 1; while (t >= 0 && !IS_CUBE[this.ids[this.idx(x, t, z)]]) t--; this.colTop[c] = t; }
    const cx = x >> 4, cy = y >> 4, cz = z >> 4;
    this.markDirty(cx, cy, cz);
    if ((x & 15) === 0) this.markDirty(cx - 1, cy, cz); if ((x & 15) === 15) this.markDirty(cx + 1, cy, cz);
    if ((y & 15) === 0) this.markDirty(cx, cy - 1, cz); if ((y & 15) === 15) this.markDirty(cx, cy + 1, cz);
    if ((z & 15) === 0) this.markDirty(cx, cy, cz - 1); if ((z & 15) === 15) this.markDirty(cx, cy, cz + 1);
    // If the sunlight in this column changed, the shading of blocks below (and beside) it changes too.
    if (this.colTop[c] !== oldTop) {
      const lo = Math.min(oldTop, this.colTop[c]) >> 4, hi = Math.max(oldTop, y) >> 4;
      for (let yy = Math.max(0, lo - 1); yy <= Math.min(NCY - 1, hi); yy++) {
        this.markDirty(cx, yy, cz);
        if ((x & 15) === 0) this.markDirty(cx - 1, yy, cz); if ((x & 15) === 15) this.markDirty(cx + 1, yy, cz);
        if ((z & 15) === 0) this.markDirty(cx, yy, cz - 1); if ((z & 15) === 15) this.markDirty(cx, yy, cz + 1);
      }
    }
  }
  markDirty(cx, cy, cz) { if (cx >= 0 && cx < NCX && cy >= 0 && cy < NCY && cz >= 0 && cz < NCZ) this.dirty.add(cx + NCX * (cz + NCZ * cy)); }

  // Walk a ray (world units) through the blocks. Returns the first solid cube hit, or null.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    const px = ox / VS, py = oy / VS, pz = oz / VS;
    let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tx = dx > 0 ? (x + 1 - px) * tdx : dx < 0 ? (px - x) * tdx : Infinity;
    let ty = dy > 0 ? (y + 1 - py) * tdy : dy < 0 ? (py - y) * tdy : Infinity;
    let tz = dz > 0 ? (z + 1 - pz) * tdz : dz < 0 ? (pz - z) * tdz : Infinity;
    const tmax = maxDist / VS;
    let t = 0, nx = 0, ny = 0, nz = 0;
    if (this.isSolid(x, y, z)) return { x, y, z, dist: 0, nx, ny, nz };
    for (let i = 0; i < 2000; i++) {
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
      if (t > tmax) return null;
      if (this.isSolid(x, y, z)) return { x, y, z, dist: t * VS, nx, ny, nz };
    }
    return null;
  }

  // ---- generation ---------------------------------------------------------------------------------------------
  generate() {
    const rng = mulberry32(20261126);
    const R = (a, b) => a + (b - a) * rng();
    const RI = (a, b) => Math.floor(R(a, b + 1));
    const pick = arr => arr[Math.floor(rng() * arr.length)];
    const ids = this.ids;
    const REEFS = [{ x: 250, z: 270, r: 105, h: 64 }, { x: 100, z: 92, r: 70, h: 60 }];
    const MOUNTS = [{ x: 62, z: 300, r: 24, h: 98 }, { x: 335, z: 85, r: 26, h: 102 }, { x: 330, z: 190, r: 18, h: 96 }, { x: 150, z: 205, r: 14, h: 92 }, { x: 180, z: 340, r: 20, h: 90 }];

    const heightAt = (x, z) => {
      let h = 38 + 34 * (fbm(x / 120, z / 120, 11, 4) - 0.5) + 10 * (fbm(x / 30, z / 30, 12, 2) - 0.5);
      const tz = 168 + 40 * Math.sin(x / 65) + 18 * Math.sin(x / 27 + 2);        // a winding deep trench
      const tr = 1 - smooth(8, 48, Math.abs(z - tz));
      h = h * (1 - tr) + (15 + 4 * vnoise(x / 20, z / 20, 13)) * tr;
      for (const r of REEFS) {                                                    // flat-topped reef plateaus
        const d = Math.hypot(x - r.x, z - r.z), m = 1 - smooth(r.r * 0.55, r.r, d);
        h = h * (1 - m) + (r.h + 6 * (fbm(x / 22, z / 22, 14, 2) - 0.5)) * m;
      }
      for (const s of MOUNTS) {                                                   // seamounts
        const d = Math.hypot(x - s.x, z - s.z) / s.r;
        if (d < 2.6) h = Math.max(h, s.h * Math.exp(-d * d * 1.3) + 5 * (fbm(x / 8, z / 8, 15, 2) - 0.5));
      }
      const e = Math.min(x, z, NX - 1 - x, NZ - 1 - z);                           // cliff walls round the edge
      if (e < 30) { const w = 1 - smooth(0, 30, e); h += (NY - 4 - h) * w * w; }
      return Math.max(4, Math.min(NY - 4, Math.round(h)));
    };
    const hm = new Int16Array(NX * NZ);
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) hm[x + NX * z] = heightAt(x, z);

    // Fill each column: bedrock, rock, then a few blocks of seabed on top.
    const reefness = (x, z) => { let m = 0; for (const r of REEFS) m = Math.max(m, 1 - smooth(r.r * 0.55, r.r, Math.hypot(x - r.x, z - r.z))); return m; };
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
      const h = hm[x + NX * z];
      const sl = Math.max(Math.abs(hm[Math.min(NX - 1, x + 2) + NX * z] - h), Math.abs(hm[Math.max(0, x - 2) + NX * z] - h),
        Math.abs(hm[x + NX * Math.min(NZ - 1, z + 2)] - h), Math.abs(hm[x + NX * Math.max(0, z - 2)] - h));
      const depth = NY - h, reef = reefness(x, z);
      const n1 = vnoise(x / 18, z / 18, 31), n2 = vnoise(x / 9, z / 9, 32), n3 = vnoise(x / 25, z / 25, 33);
      let top;
      if (sl >= 4) top = depth > 78 ? B.SEASIDE : n2 > 0.6 && depth < 60 ? B.MOSSROCK : B.ROCK;
      else if (h < 24) top = n1 > 0.5 ? B.MUD : B.SEASIDE;
      else if (reef > 0.4 && n3 > 0.62) top = B.CORALROCK;
      else if (n1 > 0.74 && sl < 2) top = B.PEBBLES;
      else if (n2 > 0.8) top = B.SHELL;
      else if (n1 < 0.3) top = B.DENSESAND;
      else top = B.SAND;
      const base = sl >= 4 ? top : B.ROCK;
      const col = x + NX * z;
      for (let y = 0; y <= h; y++) {
        ids[col + NX * NZ * y] = y <= 1 ? B.BEDROCK : y >= h - (sl >= 4 ? 4 : 3) ? top : y < 12 ? B.SEASIDE : base;
      }
    }

    // ---- helpers for placing things ----
    const topY = (x, z) => { for (let y = NY - 1; y >= 0; y--) if (IS_CUBE[ids[this.idx(x, y, z)]]) return y; return 0; };
    const put = (x, y, z, id, over) => { if (x < 1 || x >= NX - 1 || z < 1 || z >= NZ - 1 || y < 2 || y >= NY - 6) return; const i = this.idx(x, y, z); if (over || ids[i] === 0) ids[i] = id; };
    const flatten = (x0, z0, w, d, level, mat) => {
      for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) {
        for (let y = NY - 8; y > level; y--) ids[this.idx(x, y, z)] = 0;
        for (let y = level; y >= level - 5; y--) ids[this.idx(x, y, z)] = y === level ? mat : B.ROCK;
        for (let y = level - 6; y > 1; y--) if (!ids[this.idx(x, y, z)]) ids[this.idx(x, y, z)] = B.ROCK;
      }
    };
    const taken = new Uint8Array(NX * NZ);
    const mark = (x, z, r) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, zz = z + dz; if (xx >= 0 && xx < NX && zz >= 0 && zz < NZ) taken[xx + NX * zz] = 1; } };
    const free = (x, z, r) => { for (let dz = -r; dz <= r; dz += 2) for (let dx = -r; dx <= r; dx += 2) { const xx = x + dx, zz = z + dz; if (xx < 2 || xx >= NX - 2 || zz < 2 || zz >= NZ - 2 || taken[xx + NX * zz]) return false; } return true; };
    const flatEnough = (x, z, r) => { const h0 = hm[x + NX * z]; for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { const xx = Math.max(0, Math.min(NX - 1, x + dx)), zz = Math.max(0, Math.min(NZ - 1, z + dz)); if (Math.abs(hm[xx + NX * zz] - h0) > 3) return false; } return true; };

    const SPAWN = { x: 196, z: 270 };
    this.spawn = SPAWN;
    mark(SPAWN.x, SPAWN.z, 22);          // keep the start area clear

    // ---- sunken ruins (marble, with treasure) ----
    {
      const rx = 296, rz = 246, L = topY(rx, rz);
      flatten(rx - 15, rz - 15, 31, 31, L, B.SAND);
      for (let z = -13; z <= 13; z++) for (let x = -13; x <= 13; x++) { // chequered marble floor
        const id = ((x >> 1) + (z >> 1)) & 1 ? B.MARBLE : B.SANDBRICK;
        if (rng() > 0.06) put(rx + x, L, rz + z, id, true);
      }
      const column = (cx, cz, h) => { for (let y = 1; y <= h; y++) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) put(cx + dx, L + y, cz + dz, y === 1 || y === h ? B.WHITEBRICK : B.MARBLE, true); };
      for (let i = -12; i <= 12; i += 6) { column(rx + i, rz - 13, RI(8, 22)); column(rx + i, rz + 12, RI(8, 22)); }
      for (let i = -6; i <= 6; i += 6) { column(rx - 13, rz + i, RI(6, 20)); column(rx + 12, rz + i, RI(6, 20)); }
      for (let x = -12; x <= 12; x++) for (let y = 1; y <= 10; y++) { // back wall with an arched doorway
        if (Math.abs(x) < 4 && (y < 7 || x * x + (y - 7) * (y - 7) * 1.4 < 16)) continue;
        if (y > 6 + RI(0, 4) && rng() < 0.5) continue;
        put(rx + x, L + y, rz - 15, y % 3 === 0 ? B.RUIN : B.SANDBRICK, true);
      }
      // the treasure
      for (let i = 0; i < 3; i++) for (let dx = 0; dx < 3 - i; dx++) for (let dz = 0; dz < 3 - i; dz++) put(rx - 2 + dx + i, L + 1 + i, rz - 2 + dz + i, B.GOLD, true);
      put(rx + 4, L + 1, rz, B.CHEST, true); put(rx + 5, L + 1, rz + 1, B.CHEST, true); put(rx - 6, L + 1, rz + 2, B.CHEST, true);
      put(rx + 1, L + 4, rz + 1, B.DIAMOND, true); put(rx, L + 4, rz, B.DIAMOND, true);
      for (const [dx, dz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) { put(rx + dx, L + 1, rz + dz, B.LAMP, true); }
      for (let i = 0; i < 70; i++) put(rx + RI(-18, 18), L + 1, rz + RI(-18, 18), pick([B.RUIN, B.MARBLE, B.SANDBRICK, B.WHITEBRICK]), false);
      mark(rx, rz, 20);
    }

    // ---- shipwreck ----
    {
      const sx = 212, sz = 92, len = 46, L0 = topY(sx, sz);
      flatten(sx - 4, sz - 14, len + 8, 28, L0, B.DENSESAND);
      const wood = () => (rng() < 0.3 ? B.DARKPLANKS : B.PLANKS);
      for (let i = 0; i < len; i++) {
        const half = Math.max(1, Math.round(9 * Math.pow(Math.sin(Math.PI * (i + 3) / (len + 6)), 0.55)));
        const rise = i > len - 8 ? Math.round((i - (len - 8)) * 0.9) : 0;          // bow lifts
        for (let j = 0; j <= 9; j++) {
          const w = Math.min(half, Math.round(half * (0.35 + 0.07 * j)));
          for (let z = -w; z <= w; z++) {
            const shell = Math.abs(z) >= w - 1 || j === 0 || i % 7 === 0;
            if (!shell) continue;
            if (j >= 8 && rng() < 0.3) continue;                                    // broken top
            if (j === 9 && Math.abs(z) < w - 1) continue;
            put(sx + i, L0 + 1 + j + rise, sz + z, wood(), true);
          }
        }
        if (i > 8 && i < len - 10) for (let z = -half + 1; z < half; z++) if (rng() < 0.55) put(sx + i, L0 + 6, sz + z, B.PLANKS, true); // deck
      }
      for (let y = 1; y <= 38; y++) { put(sx + 20 + (y >> 3), L0 + y, sz, B.DARKPLANKS, true); put(sx + 20 + (y >> 3) + 1, L0 + y, sz, B.DARKPLANKS, true); }
      for (let x = -6; x <= 6; x++) put(sx + 22 + x, L0 + 30, sz, B.DARKPLANKS, true); // a broken yard-arm
      put(sx + 14, L0 + 2, sz, B.CHEST, true); put(sx + 15, L0 + 2, sz + 1, B.CHEST, true); put(sx + 13, L0 + 2, sz - 1, B.GOLD, true);
      put(sx + 24, L0 + 7, sz + 2, B.LAMP, true); put(sx + 6, L0 + 3, sz - 2, B.LAMP, true);
      mark(sx + 23, sz, 28);
    }

    // ---- coral builders ----
    const WARM = [B.WOOL_ORANGE, B.WOOL_PINK, B.WOOL_RED, B.CORAL_ORANGE, B.WOOL_YELLOW];
    const COOL = [B.WOOL_VIOLET, B.WOOL_BLUE, B.WOOL_CYAN, B.WOOL_MAGENTA];
    const GREEN = [B.WOOL_GREEN, B.WOOL_DARK_GREEN];
    const PALETTES = [WARM, COOL, GREEN, [B.WOOL_MAGENTA, B.WOOL_PINK], [B.CORAL_BROWN, B.CORAL_ORANGE], [B.WOOL_YELLOW, B.WOOL_ORANGE], [B.WOOL_BLUE, B.WOOL_VIOLET, B.WOOL_MAGENTA]];
    const staghorn = (x, y, z, dirx, dirz, len, depth, mat) => {
      for (let i = 0; i < len; i++) {
        put(x, y, z, mat, false); y++;
        if (rng() < 0.32) x += dirx; if (rng() < 0.32) z += dirz;
        if (depth > 0 && i > 2 && rng() < 0.2) staghorn(x, y, z, RI(-1, 1) || 1, RI(-1, 1), Math.floor(len * 0.55), depth - 1, mat);
      }
      put(x, y, z, mat, false);
    };
    const dome = (cx, y0, cz, r, a, b) => {
      for (let dy = 0; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy * 1.3 + dz * dz > r * r) continue;
        put(cx + dx, y0 + dy, cz + dz, vnoise((cx + dx) / 1.7, (cz + dz + dy) / 1.7, 41) > 0.5 ? a : b, false);
      }
    };
    const tubes = (cx, y0, cz, mats) => {
      const n = RI(3, 6);
      for (let t = 0; t < n; t++) {
        const tx = cx + RI(-5, 5), tz = cz + RI(-5, 5), h = RI(5, 15), mat = pick(mats);
        for (let y = 0; y <= h; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dz === 0 && y > 0) continue;
          if (Math.abs(dx) + Math.abs(dz) === 2 && rng() < 0.5) continue;
          put(tx + dx, y0 + y, tz + dz, mat, false);
        }
      }
    };
    const table = (cx, y0, cz, a, b) => {
      const h = RI(3, 8), r = RI(4, 7);
      for (let y = 0; y < h; y++) put(cx, y0 + y, cz, B.CORAL_BROWN, false);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dz * dz; if (d2 > r * r) continue;
        put(cx + dx, y0 + h, cz + dz, ((d2 >> 2) & 1) ? a : b, false);
        if (d2 > (r - 1) * (r - 1)) put(cx + dx, y0 + h + 1, cz + dz, a, false);
      }
    };
    const fan = (cx, y0, cz, mat) => { // a flat standing fan
      const along = rng() < 0.5, h = RI(5, 10);
      for (let y = 0; y < h; y++) { const w = Math.round(1 + y * 0.45); for (let k = -w; k <= w; k++) if (rng() < 0.85) put(along ? cx + k : cx, y0 + y, along ? cz : cz + k, mat, false); }
    };
    const anemone = (cx, y0, cz) => {
      const mat = pick([B.WOOL_MAGENTA, B.WOOL_ORANGE, B.WOOL_PINK]);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(cx + dx, y0, cz + dz, mat, false);
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (rng() < 0.7) put(cx + dx, y0 + 1, cz + dz, B.CORAL_PINK, false);
    };

    // ---- scatter coral formations over the reefs ----
    for (const reef of REEFS) {
      const attempts = Math.floor(reef.r * reef.r * 0.2);
      for (let k = 0; k < attempts; k++) {
        const ang = rng() * 6.2832, dist = Math.sqrt(rng()) * reef.r * 0.98;
        const x = Math.round(reef.x + Math.cos(ang) * dist), z = Math.round(reef.z + Math.sin(ang) * dist);
        if (x < 6 || z < 6 || x >= NX - 6 || z >= NZ - 6) continue;
        const gy = topY(x, z), g = ids[this.idx(x, gy, z)];
        if (g === B.ROCK || g === B.SEASIDE || g === B.MOSSROCK || g === B.MUD) continue;
        if (!flatEnough(x, z, 3)) continue;
        const kind = rng(), pal = pick(PALETTES), a = pick(pal), b = pick(pal);
        let r = 4;
        if (kind < 0.3) { r = 5; if (!free(x, z, r)) continue; staghorn(x, gy + 1, z, RI(-1, 1), RI(-1, 1), RI(9, 22), 2, a); }
        else if (kind < 0.5) { r = RI(3, 8); if (!free(x, z, r + 1)) continue; dome(x, gy + 1, z, r, a, b); r++; }
        else if (kind < 0.65) { r = 7; if (!free(x, z, r)) continue; tubes(x, gy + 1, z, pal); }
        else if (kind < 0.8) { r = 8; if (!free(x, z, r)) continue; table(x, gy + 1, z, a, b); }
        else if (kind < 0.9) { r = 6; if (!free(x, z, r)) continue; fan(x, gy + 1, z, a); }
        else { r = 3; if (!free(x, z, r)) continue; anemone(x, gy + 1, z); }
        mark(x, z, Math.max(2, r - 2));
      }
    }

    // ---- sprites: little coral fronds and sea grass dotted over the seabed ----
    const SPR = [B.CORAL_PINK, B.CORAL_CYAN, B.CORAL_GREEN];
    for (let z = 3; z < NZ - 3; z++) for (let x = 3; x < NX - 3; x++) {
      const reef = reefness(x, z);
      const p = reef > 0.3 ? 0.12 * reef : 0.025;
      if (rng() > p) continue;
      const gy = topY(x, z), g = ids[this.idx(x, gy, z)];
      if (ids[this.idx(x, gy + 1, z)] !== 0) continue;
      if (g === B.ROCK || g === B.SEASIDE || g === B.BEDROCK || g === B.MUD) continue;
      if (gy > NY - 14 || (taken[x + NX * z] && rng() < 0.7)) continue;
      const near = SPAWN.x - x, nz2 = SPAWN.z - z; if (near * near + nz2 * nz2 < 80) continue;
      put(x, gy + 1, z, reef > 0.3 ? pick(SPR) : (rng() < 0.7 ? B.SEAGRASS : B.REED), false);
      if (reef <= 0.3 && rng() < 0.4) put(x, gy + 2, z, B.SEAGRASS, false);
    }

    // ---- kelp forests on the mid-depth slopes ----
    for (let c = 0; c < 170; c++) {
      const cx = RI(20, NX - 20), cz = RI(20, NZ - 20);
      const h0 = hm[cx + NX * cz];
      if (h0 < 26 || h0 > 60 || reefness(cx, cz) > 0.25) continue;
      const n = RI(10, 26);
      for (let k = 0; k < n; k++) {
        const x = cx + RI(-7, 7), z = cz + RI(-7, 7);
        if (x < 2 || z < 2 || x >= NX - 2 || z >= NZ - 2) continue;
        const gy = topY(x, z); if (ids[this.idx(x, gy, z)] === B.ROCK || ids[this.idx(x, gy, z)] === B.SEASIDE) continue;
        const h = Math.min(RI(8, 34), NY - 10 - gy);
        for (let y = 1; y <= h; y++) put(x, gy + y, z, B.KELP, false);
      }
    }

    // ---- glowing sea lanterns in the dark, so the trench isn't pitch black ----
    for (let i = 0; i < 90; i++) {
      const x = RI(10, NX - 10), z = RI(10, NZ - 10), gy = topY(x, z);
      if (gy < 40 && ids[this.idx(x, gy + 1, z)] === 0) { put(x, gy + 1, z, B.LAMP, false); if (rng() < 0.5) put(x + 1, gy + 1, z, B.CORAL_PINK, false); }
    }

    // ---- a treasure garden of loose coloured blocks, right ahead of where you start ----
    {
      const gx = SPAWN.x + 16, gz = SPAWN.z;
      const g0 = topY(gx, gz);
      flatten(gx - 8, gz - 8, 17, 17, g0, B.SAND);
      const cols = [B.WOOL_ORANGE, B.WOOL_YELLOW, B.WOOL_MAGENTA, B.WOOL_PINK, B.WOOL_VIOLET, B.WOOL_BLUE, B.WOOL_CYAN, B.WOOL_GREEN, B.WOOL_RED, B.WOOL_WHITE];
      for (let i = 0; i < 4; i++) for (let dx = 0; dx < 4 - i; dx++) for (let dz = 0; dz < 4 - i; dz++) put(gx - 2 + dx + i, g0 + 1 + i, gz - 2 + dz + i, cols[(dx + dz + i * 3) % cols.length], true);
      const specials = [B.GOLD, B.DIAMOND, B.LAMP, B.CHEST, B.MESE, B.ORE_GOLD, B.ORE_DIAMOND, B.LAMP, B.GOLD, B.CHEST];
      for (let i = 0; i < specials.length; i++) {
        const a = i / specials.length * 6.2832, rr = 6;
        put(gx + Math.round(Math.cos(a) * rr), g0 + 1, gz + Math.round(Math.sin(a) * rr), specials[i], true);
      }
      for (let i = 0; i < 26; i++) put(gx + RI(-7, 7), g0 + 1, gz + RI(-7, 7), pick(cols), false);
    }

    // Sunlight map for shading.
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
      let y = NY - 1; while (y >= 0 && !IS_CUBE[ids[x + NX * (z + NZ * y)]]) y--; this.colTop[x + NX * z] = y;
    }
    this.hm = hm;
    this.rebuildEmitters();
    return this;
  }
  groundTop(x, z) { // y (in blocks) of the first open cell above the seabed
    x = Math.max(0, Math.min(NX - 1, x | 0)); z = Math.max(0, Math.min(NZ - 1, z | 0));
    return this.colTop[x + NX * z] + 1;
  }
}
export { NBLOCKS, IS_SPRITE };
