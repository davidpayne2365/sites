// Voxel lighting and meshing, shared by the workers and the main thread (for edits).
// Arrays use the layout index = x + sx * (z + sz * (y - ay0)).
import { T_OPAQUE, T_EMIT, T_DIM, T_SHAPE, T_RENDER, SHAPE, RENDER } from '../blocks.js';

// ---------------------------------------------------------------------------
// Light: sky light (0-15, falls straight down undimmed, spreads sideways losing 1 per block) and block light
// from emitters. Packed as sky << 4 | block.
// ---------------------------------------------------------------------------
export function computeLight(ids, sx, sz, ny) {
  const n = sx * sz * ny, light = new Uint8Array(n), layer = sx * sz;
  const q = new Int32Array(n > 4e6 ? 4e6 : n);
  const qn = q.length;
  // Sky columns.
  for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
    let l = 15;
    for (let y = ny - 1; y >= 0; y--) {
      const i = x + sx * (z + sz * y), id = ids[i];
      if (id) { if (T_OPAQUE[id]) l = 0; else l = Math.max(0, l - T_DIM[id]); }
      if (!l) break;
      light[i] = l << 4;
    }
  }
  // Seed the spread from lit cells next to darker open cells.
  let head = 0, tail = 0;
  for (let y = 0; y < ny; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
    const i = x + sx * (z + sz * y), s = light[i] >> 4;
    if (s < 2) continue;
    if ((x > 0 && dark(i - 1, s)) || (x < sx - 1 && dark(i + 1, s)) || (z > 0 && dark(i - sx, s)) || (z < sz - 1 && dark(i + sx, s)) || (y > 0 && dark(i - layer, s))) {
      q[tail++ % qn] = i;
    }
  }
  function dark(j, s) { const id = ids[j]; return !T_OPAQUE[id] && (light[j] >> 4) < s - 1; }
  spread(4);
  // Block light from emitters.
  head = tail = 0;
  for (let i = 0; i < n; i++) { const e = T_EMIT[ids[i]]; if (e) { light[i] = (light[i] & 0xf0) | e; q[tail++ % qn] = i; } }
  spread(0);
  return light;

  function spread(shift) {
    const mask = shift ? 0x0f : 0xf0;
    while (head < tail) {
      const i = q[head++ % qn], l = (light[i] >> shift) & 15;
      if (l < 2) continue;
      const x = i % sx, r = (i - x) / sx, z = r % sz, y = (r - z) / sz;
      if (x > 0) go(i - 1); if (x < sx - 1) go(i + 1);
      if (z > 0) go(i - sx); if (z < sz - 1) go(i + sx);
      if (y > 0) go(i - layer); if (y < ny - 1) go(i + layer);
      function go(j) {
        const id = ids[j];
        if (T_OPAQUE[id]) return;
        const nl = l - 1 - T_DIM[id];
        if (nl > ((light[j] >> shift) & 15)) { light[j] = (light[j] & mask) | (nl << shift); q[tail++ % qn] = j; }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Meshing one 32^3 section. The arrays must hold one extra cell on every side of the section.
// Output vertices: pos Int16 x4 (x, y, z in 1/16 block, relative to (ox0, 0, oz0); w = face | u << 3 | v << 4)
// and data Uint16 x2 (block id, light = sky << 12 | block << 8 | ao << 6).
// ---------------------------------------------------------------------------
const FACES = [
  { n: [1, 0, 0], a: 0, u: 1, v: 2, c: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { n: [-1, 0, 0], a: 0, u: 1, v: 2, c: [[0, 1], [1, 1], [1, 0], [0, 0]] },
  { n: [0, 1, 0], a: 1, u: 0, v: 2, c: [[0, 0], [0, 1], [1, 1], [1, 0]] },
  { n: [0, -1, 0], a: 1, u: 0, v: 2, c: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { n: [0, 0, 1], a: 2, u: 0, v: 1, c: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { n: [0, 0, -1], a: 2, u: 0, v: 1, c: [[1, 0], [0, 0], [0, 1], [1, 1]] },
];

class Buf {
  constructor() { this.pos = new Int16Array(4096); this.dat = new Uint16Array(2048); this.idx = new Uint32Array(3072); this.nv = 0; this.ni = 0; }
  grow() {
    const p = new Int16Array(this.pos.length * 2); p.set(this.pos); this.pos = p;
    const d = new Uint16Array(this.dat.length * 2); d.set(this.dat); this.dat = d;
    const x = new Uint32Array(this.idx.length * 2); x.set(this.idx); this.idx = x;
  }
  // corners: 4 x [x, y, z] in 1/16 units; lights: 4 packed light values; flip: diagonal choice.
  quad(cs, w, id, ls, flip) {
    if ((this.nv + 4) * 4 > this.pos.length) this.grow();
    const b = this.nv;
    for (let k = 0; k < 4; k++) {
      const o = (b + k) * 4, c = cs[k];
      this.pos[o] = c[0]; this.pos[o + 1] = c[1]; this.pos[o + 2] = c[2];
      this.pos[o + 3] = w | (c[3] || 0);
      this.dat[(b + k) * 2] = id; this.dat[(b + k) * 2 + 1] = ls[k];
    }
    const I = this.idx, j = this.ni;
    if (!flip) { I[j] = b; I[j + 1] = b + 1; I[j + 2] = b + 2; I[j + 3] = b; I[j + 4] = b + 2; I[j + 5] = b + 3; }
    else { I[j] = b + 1; I[j + 1] = b + 2; I[j + 2] = b + 3; I[j + 3] = b + 1; I[j + 4] = b + 3; I[j + 5] = b; }
    this.nv += 4; this.ni += 6;
  }
  out() { return this.ni ? { pos: this.pos.slice(0, this.nv * 4), dat: this.dat.slice(0, this.nv * 2), idx: this.idx.slice(0, this.ni) } : null; }
}

// ids/light: arrays with layout x + sx * (z + sz * (y - ay0)); the section occupies local x [bx, bx+32),
// z [bz, bz+32), world y [y0, y0+32). Output positions are relative to (bx, bz) and world y.
export function meshSection(ids, light, sx, sz, ay0, ny, bx, bz, y0) {
  const S = 32, layer = sx * sz;
  const solid = new Buf(), trans = new Buf();
  const used = new Set();
  const at = (x, y, z) => { const ly = y - ay0; if (ly < 0) return -1; if (ly >= ny) return 0; return ids[x + sx * (z + sz * ly)]; };
  const lt = (x, y, z) => { const ly = y - ay0; if (ly < 0) return 0; if (ly >= ny) return 0xf0; return light[x + sx * (z + sz * ly)]; };
  const opq = id => id < 0 || T_OPAQUE[id] === 1;

  // Quick skip: an all-air section, or an all-opaque one buried in opaque neighbours.
  {
    let air = true, full = true;
    for (let y = y0 - 1; y <= y0 + S && (air || full); y++) for (let z = bz - 1; z <= bz + S && (air || full); z++) for (let x = bx - 1; x <= bx + S; x++) {
      const id = at(x, y, z);
      const inside = y >= y0 && y < y0 + S && z >= bz && z < bz + S && x >= bx && x < bx + S;
      if (inside && id > 0) air = false;
      if (!opq(id)) { if (inside || (x >= bx && x < bx + S) + (z >= bz && z < bz + S) + (y >= y0 && y < y0 + S) >= 2) full = false; }
      if (!air && !full) break;
    }
    if (air || full) return null;
  }

  const P = [0, 0, 0];
  // Smooth light for a face corner: average of the 4 open cells around the corner on the face's outer side.
  function cornerLight(nx, ny_, nz, U, V, su, sv) {
    const a = [nx, ny_, nz], b = [nx, ny_, nz], c = [nx, ny_, nz];
    a[U] += su; b[V] += sv; c[U] += su; c[V] += sv;
    const ida = at(a[0], a[1], a[2]), idb = at(b[0], b[1], b[2]), idc = at(c[0], c[1], c[2]);
    const s1 = opq(ida) ? 1 : 0, s2 = opq(idb) ? 1 : 0, s3 = opq(idc) ? 1 : 0;
    const ao = s1 && s2 ? 0 : 3 - (s1 + s2 + s3);
    let sk = 0, bl = 0, cnt = 0;
    const l0 = lt(nx, ny_, nz); sk += l0 >> 4; bl += l0 & 15; cnt++;
    if (!s1) { const l = lt(a[0], a[1], a[2]); sk += l >> 4; bl += l & 15; cnt++; }
    if (!s2) { const l = lt(b[0], b[1], b[2]); sk += l >> 4; bl += l & 15; cnt++; }
    if (!s3 && !(s1 && s2)) { const l = lt(c[0], c[1], c[2]); sk += l >> 4; bl += l & 15; cnt++; }
    return (Math.round(sk / cnt) << 12) | (Math.round(bl / cnt) << 8) | (ao << 6);
  }
  const lightPack = l => ((l >> 4) << 12) | ((l & 15) << 8) | (3 << 6);

  // --- Greedy cube faces ---
  const mId = new Int32Array(S * S), mL0 = new Uint32Array(S * S), mL1 = new Uint32Array(S * S), mF = new Uint8Array(S * S);
  for (let f = 0; f < 6; f++) {
    const F = FACES[f], A = F.a, U = F.u, V = F.v, [dx, dy, dz] = F.n;
    for (let s = 0; s < S; s++) {
      let any = false;
      mId.fill(0);
      for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
        P[A] = s; P[U] = u; P[V] = v;
        const x = bx + P[0], y = y0 + P[1], z = bz + P[2];
        const id = at(x, y, z);
        if (id <= 0) continue;
        const sh = T_SHAPE[id];
        if (sh !== SHAPE.cube && sh !== SHAPE.liquid) continue;
        const nid = at(x + dx, y + dy, z + dz);
        if (nid < 0 || (nid && T_OPAQUE[nid])) continue;
        if (nid === id && !T_OPAQUE[id]) continue;
        if (sh === SHAPE.liquid && nid && T_SHAPE[nid] === SHAPE.liquid) continue;
        if (f === 2 && nid && T_SHAPE[nid] === SHAPE.slab && T_OPAQUE[id]) continue;
        if (sh === SHAPE.liquid && f !== 2 && f !== 3) { liquidSide(x, y, z, f, id); continue; }
        if (!T_OPAQUE[id] && nid && T_RENDER[nid] === RENDER.trans && T_RENDER[id] === RENDER.trans) continue;
        const k = u + v * S;
        const nx = x + dx, ny2 = y + dy, nz = z + dz;
        const L = [];
        for (let c = 0; c < 4; c++) L.push(cornerLight(nx, ny2, nz, U, V, F.c[c][0] ? 1 : -1, F.c[c][1] ? 1 : -1));
        mId[k] = id; mL0[k] = (L[0] & 0xffff) | (L[1] << 16) >>> 0; mL1[k] = (L[2] & 0xffff) | (L[3] << 16) >>> 0;
        mF[k] = 0;
        any = true;
      }
      if (!any) continue;
      // Merge rectangles of identical faces.
      for (let v = 0; v < S; v++) for (let u = 0; u < S;) {
        const k = u + v * S, id = mId[k];
        if (!id) { u++; continue; }
        const l0 = mL0[k], l1 = mL1[k];
        let w = 1; while (u + w < S && mId[k + w] === id && mL0[k + w] === l0 && mL1[k + w] === l1) w++;
        let h = 1;
        outer: while (v + h < S) {
          for (let t = 0; t < w; t++) { const kk = u + t + (v + h) * S; if (mId[kk] !== id || mL0[kk] !== l0 || mL1[kk] !== l1) break outer; }
          h++;
        }
        for (let hh = 0; hh < h; hh++) mId.fill(0, u + (v + hh) * S, u + w + (v + hh) * S);
        emit(f, s, u, v, w, h, id, [l0 & 0xffff, l0 >>> 16, l1 & 0xffff, l1 >>> 16]);
        u += w;
      }
    }
  }
  function emit(f, s, u, v, w, h, id, ls) {
    const F = FACES[f], cs = [];
    const top = T_SHAPE[id] === SHAPE.liquid && f === 2 ? 14 : 16;
    for (let c = 0; c < 4; c++) {
      const p = [0, 0, 0];
      p[F.a] = (s + (F.n[F.a] > 0 ? 1 : 0)) * 16;
      p[F.u] = (u + F.c[c][0] * w) * 16; p[F.v] = (v + F.c[c][1] * h) * 16;
      if (F.a === 1 && F.n[1] > 0) p[1] = s * 16 + top;
      cs.push([p[0], p[1] + y0 * 16, p[2]]);
    }
    const ao = l => (l >> 6) & 3;
    const flip = ao(ls[0]) + ao(ls[2]) < ao(ls[1]) + ao(ls[3]);
    (T_RENDER[id] === RENDER.trans ? trans : solid).quad(cs, f, id, ls, flip);
    used.add(id);
  }
  function liquidSide(x, y, z, f, id) {
    const F = FACES[f], above = at(x, y + 1, z), top = above > 0 && T_SHAPE[above] === SHAPE.liquid ? 16 : 14;
    const l = lightPack(lt(x + F.n[0], y + F.n[1], z + F.n[2]));
    const cs = [];
    for (let c = 0; c < 4; c++) {
      const p = [(x - bx) * 16, y * 16, (z - bz) * 16];
      p[F.a] += F.n[F.a] > 0 ? 16 : 0;
      p[F.u] += F.c[c][0] * (F.u === 1 ? top : 16); p[F.v] += F.c[c][1] * (F.v === 1 ? top : 16);
      cs.push(p);
    }
    trans.quad(cs, f, id, [l, l, l, l], false);
    used.add(id);
  }

  // --- Crosses and slabs ---
  for (let y = y0; y < y0 + S; y++) for (let z = bz; z < bz + S; z++) for (let x = bx; x < bx + S; x++) {
    const id = at(x, y, z);
    if (id <= 0) continue;
    const sh = T_SHAPE[id];
    if (sh === SHAPE.cross) {
      const l = lightPack(lt(x, y, z)), L = [l, l, l, l];
      const X = (x - bx) * 16, Y = y * 16, Z = (z - bz) * 16, a = 1.5, b = 14.5;
      const q1 = [[X + a, Y, Z + a, 0], [X + b, Y, Z + b, 8], [X + b, Y + 16, Z + b, 24], [X + a, Y + 16, Z + a, 16]];
      const q2 = [[X + b, Y, Z + a, 0], [X + a, Y, Z + b, 8], [X + a, Y + 16, Z + b, 24], [X + b, Y + 16, Z + a, 16]];
      solid.quad(q1, 6, id, L, false); solid.quad([q1[1], q1[0], q1[3], q1[2]], 6, id, L, false);
      solid.quad(q2, 6, id, L, false); solid.quad([q2[1], q2[0], q2[3], q2[2]], 6, id, L, false);
      used.add(id);
    } else if (sh === SHAPE.slab) {
      for (let f = 0; f < 6; f++) {
        const F = FACES[f], [dx, dy, dz] = F.n;
        const nid = at(x + dx, y + dy, z + dz);
        if (f !== 2 && (nid < 0 || (nid && T_OPAQUE[nid]))) continue;
        if (f !== 2 && f !== 3 && nid === id) continue;
        const l = lightPack(f === 2 ? lt(x, y, z) : lt(x + dx, y + dy, z + dz));
        const cs = [];
        for (let c = 0; c < 4; c++) {
          const p = [(x - bx) * 16, y * 16, (z - bz) * 16];
          p[F.a] += F.n[F.a] > 0 ? (F.a === 1 ? 8 : 16) : 0;
          p[F.u] += F.c[c][0] * (F.u === 1 ? 8 : 16); p[F.v] += F.c[c][1] * (F.v === 1 ? 8 : 16);
          cs.push(p);
        }
        (T_RENDER[id] === RENDER.trans ? trans : solid).quad(cs, f, id, [l, l, l, l], false);
      }
      used.add(id);
    }
  }
  const so = solid.out(), tr = trans.out();
  if (!so && !tr) return null;
  return { solid: so, trans: tr, used: [...used] };
}

// Split a mesh part into what lies wholly below height `cut` (the deep: caverns, their castles, the tunnel network)
// and the rest, so phones can skip drawing the deep while you're up on the ground.
export function splitBelow(part, cut) {
  if (!part) return [null, null];
  const nq = part.idx.length / 6, lim = cut * 16, below = new Uint8Array(nq);
  let nb = 0;
  for (let q = 0; q < nq; q++) {
    let top = -1e9;
    for (let k = 0; k < 4; k++) top = Math.max(top, part.pos[(q * 4 + k) * 4 + 1]);
    if (top <= lim) { below[q] = 1; nb++; }
  }
  if (!nb) return [part, null];
  if (nb === nq) return [null, part];
  const take = (want, n) => {
    const pos = new Int16Array(n * 16), dat = new Uint16Array(n * 8), idx = new Uint32Array(n * 6);
    let o = 0;
    for (let q = 0; q < nq; q++) {
      if (below[q] !== want) continue;
      pos.set(part.pos.subarray(q * 16, q * 16 + 16), o * 16);
      dat.set(part.dat.subarray(q * 8, q * 8 + 8), o * 8);
      for (let k = 0; k < 6; k++) idx[o * 6 + k] = part.idx[q * 6 + k] - q * 4 + o * 4;
      o++;
    }
    return { pos, dat, idx };
  };
  return [take(0, nq - nb), take(1, nb)];
}
