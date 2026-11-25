// The Giants' Castle, built after a fantasy-castle painting: a castle of cream and sandstone towers with brown and
// slate cone roofs, climbing a rocky, wooded hill in tiers, crowned by a white keep and a tall central tower with a
// dark spire, with jagged mountains all around. A cobbled road switchbacks up the hill to the courtyard gate, wide
// enough to gallop up on your horse, and the keep's front door is big enough to ride straight in.
//
// Inside the keep, every level is a chain of giant rooms (96 x 96 m, 48 m tall): each room has one way in and one
// way out, and the last room of a level has the staircase up to the next. Four levels, then the roof.
// Every room is lit by wall torches and a chandelier (the light is baked into the walls, floors and ceilings).
//
// Everything is generated here from boxes, cylinders and cones (no models), textured with Poly Haven photo textures
// already in textures/photo. It is solid for walking, riding, building and driving, and can't be broken.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- Layout ---------------------------------------------------------------------------------------
export const HX = 0, HZ = -1300;                      // the hill's centre (spawn is 1300 m south of it)
const TOP = 240;                                      // the top plateau, where the keep stands
const ROOM = 96, KW = 3, KD = 2, LEVELS = 4, H = 48, SLAB = 4, LH = H + SLAB, EXT = 8, IW = 2;
const KX0 = HX - ROOM * KW / 2, KX1 = KX0 + ROOM * KW;        // keep: 288 x 192 m
const KZ1 = HZ + 36, KZ0 = KZ1 - ROOM * KD;                    // KZ1 is the front (south) face
const KY = TOP, KROOF = KY + LEVELS * LH;                       // 240 .. 448
const REGION = 1260, GS = 8, GN = Math.round(2 * REGION / GS) + 1; // hill terrain grid
const MR0 = 1800, MR1 = 5400, MRS = 40, MA = 720;               // mountain ring (polar grid)
const RWH = 7;                                                   // road half width
// Each level's chain of rooms [i (west to east), j (0 back, 1 front)], from the way in to the stairs up.
const PATHS = [
  [[1, 1], [0, 1], [0, 0], [1, 0], [2, 0], [2, 1]],
  [[2, 1], [2, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
  [[0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [2, 1]],
  [[2, 1], [2, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
];
// Terraces (relative to the hill centre): flat ground the castle's buildings stand on. Smaller pads for the
// towers and houses crowding the crag are added in buildCastle.
const TERRACES = [
  { x: 0, z: 5, hx: 200, hz: 220, y: TOP, round: 40 },     // the top: the keep and its courtyard
  { x: -330, z: -20, hx: 90, hz: 110, y: 160 },             // west, middle: the timber hall and the brown spire
  { x: 335, z: -40, hx: 95, hz: 110, y: 160 },              // east, middle: sandstone walls
  { x: 440, z: 200, hx: 80, hz: 70, y: 90 },                // east, low
  { x: 60, z: 470, hx: 90, hz: 60, y: 85 },                 // front, low
];

// ---- Materials: [Poly Haven texture, metres per tile, tint] ----------------------------------------
const TEX = {
  cream: ['sandstone_blocks_05', 9, [1.45, 1.35, 1.14]], sand: ['sandstone_blocks_05', 9, [1.22, 0.97, 0.7]], keepTop: ['cobblestone_floor_08', 8, 0xe8e0d0],
  roofBrown: ['roof_3', 7, [1.08, 0.86, 0.66]], roofSlate: ['roof_slates_03', 7, [0.88, 0.84, 0.8]], roofDark: ['roof_09', 7, [0.72, 0.66, 0.6]],
  timber: ['weathered_brown_planks', 5, 0xffffff], road: ['cobblestone_floor_08', 5, 0xe0d6c4],
  wall0: ['castle_brick_01', 10, 0xffffff], wall1: ['castle_wall_slates', 10, 0xffffff], wall2: ['church_bricks_02', 10, 0xffffff], wall3: ['castle_brick_02_white', 10, 0xffffff],
  marble: ['marble_01', 10, 0xffffff], checker: ['checkered_pavement_tiles', 12, 0xffffff], parquet: ['herringbone_parquet', 6, 0xffffff],
  granite: ['granite_tile', 10, 0xffffff], tiles: ['large_floor_tiles_02', 10, 0xffffff], stonetiles: ['stone_tiles_02', 10, 0xffffff],
  beams: ['dark_wooden_planks', 8, 0xffffff], wood: ['dark_wood', 4, 0xffffff], rock: ['rock_face_03', 14, [0.95, 0.92, 0.88]],
  books: ['minetest/bookshelf.png', 3, 0xffffff], water: ['blocks/water.png', 7, [0.75, 0.95, 1.1]],
};
const COLOR = { iron: 0x2b2a2e, glow: 0xff9a3c, window: 0x221d1a, carpet: 0x5a0d0d, banner: 0x8e1b1b, trunk: 0x4a3322,
  gold: 0xc99a3a, red: 0x8e1b1b, blue: 0x1e3a8a, linen: 0xe6dcc6, white: 0xf2efe8, flag: 0xa01818,
  glowRed: 0xff3a30, glowBlue: 0x3a6cff, glowGold: 0xffc23a, glowFire: 0xff7a20 };
// What each room on each level's chain is (same order as PATHS).
const THEMES = [
  ['gallery', 'banquet', 'kitchen', 'armoury', 'library', 'chapel'],
  ['chamber', 'library', 'gallery', 'banquet', 'armoury', 'throne'],
  ['chapel', 'kitchen', 'chamber', 'library', 'gallery', 'banquet'],
  ['armoury', 'chamber', 'library', 'chapel', 'gallery', 'throne'],
];
const THEME_NAME = { gallery: 'Statue Gallery', banquet: 'Banquet Hall', kitchen: 'Great Kitchen', armoury: 'Armoury', library: 'Library',
  chapel: 'Chapel', chamber: 'Giant\'s Bedchamber', throne: 'Throne Room' };
// The sun's direction (towards the sun): low in the south-west, like the painting's warm afternoon light.
export const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
const FLOORS = ['marble', 'checker', 'parquet', 'granite', 'tiles', 'stonetiles'];

// ---- Noise ----------------------------------------------------------------------------------------
function hash2(ix, iz, s) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, s), b = hash2(ix + 1, iz, s), c = hash2(ix, iz + 1, s), d = hash2(ix + 1, iz + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, s, oct = 4) {
  let sum = 0, amp = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { sum += amp * vnoise(x * f, z * f, s + o * 17); n += amp; amp *= 0.5; f *= 2.03; }
  return sum / n;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const edgeFade = r => 1 - smooth(820, 1150, r);
const baseHill = r => 300 * Math.exp(-((r / 430) ** 2.2)) * edgeFade(r);
function rng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildCastle({ texUrl, anisotropy = 4, lowDetail = false }) {
  const R = rng(20261125);

  // ================================================================================================
  // The road: from the meadow north of the start, switchbacking up the south face to the courtyard gate.
  // ================================================================================================
  const road = []; // [u, w, y] relative to the hill centre
  {
    const roadY = r => Math.min(TOP, baseHill(r));
    const push = (u, w, y) => road.push([u, w, y]);
    const leg = (p0, r0, p1, r1) => {
      const L = Math.abs(p1 - p0) * (r0 + r1) / 2 + Math.abs(r0 - r1), n = Math.max(2, Math.ceil(L / 8));
      for (let k = 1; k <= n; k++) { const t = k / n, p = p0 + (p1 - p0) * t, r = r0 + (r1 - r0) * t; push(r * Math.sin(p), r * Math.cos(p), roadY(r)); }
    };
    push(0, 1190, 0);
    let p = -0.52, r = 900;
    leg(Math.atan2(0, 1190), 1190, p, r);
    const ends = [-1.25, -0.52];
    for (let k = 0; k < 12; k++) {
      const p1 = ends[k % 2];
      // Climb one block in five along the leg.
      let r1 = r;
      while (r1 > 200) {
        const L = Math.abs(p1 - p) * (r + r1) / 2 + (r - r1);
        if (roadY(r1) - roadY(r) >= L / 5) break;
        r1 -= 2;
      }
      if (roadY(r1) >= TOP - 12) { // last leg: swing round to the front and straight up to the gate
        let rf = r; while (roadY(rf) < TOP - 12 && rf > 200) rf -= 1;
        leg(p, r, 0, rf);
        const y0 = road[road.length - 1][2];
        for (let w = rf - 8; w >= 150; w -= 8) push(0, w, Math.min(TOP, y0 + (rf - w) / 3.5));
        break;
      }
      leg(p, r, p1, r1);
      p = p1; r = r1;
    }
  }
  const hairpins = road.filter((pt, i) => i > 1 && i < road.length - 1 && (() => {
    const a = road[i - 1], b = road[i + 1];
    const d1x = pt[0] - a[0], d1z = pt[1] - a[1], d2x = b[0] - pt[0], d2z = b[1] - pt[1];
    return (d1x * d2x + d1z * d2z) / (Math.hypot(d1x, d1z) * Math.hypot(d2x, d2z) + 1e-9) < 0.2;
  })());
  // Nearest point on the road: { d, y }
  function roadNear(u, w) {
    let best = Infinity, by = 0;
    for (let i = 1; i < road.length; i++) {
      const a = road[i - 1], b = road[i];
      const minx = Math.min(a[0], b[0]) - 60, maxx = Math.max(a[0], b[0]) + 60;
      if (u < minx || u > maxx) continue;
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (w - a[1]) * dz) / l2));
      const px = a[0] + dx * t - u, pz = a[1] + dz * t - w, d = px * px + pz * pz;
      if (d < best) { best = d; by = a[2] + (b[2] - a[2]) * t; }
    }
    return { d: Math.sqrt(best), y: by };
  }
  const sdRect = (u, w, P, round = P.round ?? 30) => {
    const dx = Math.abs(u - P.x) - P.hx + round, dz = Math.abs(w - P.z) - P.hz + round;
    return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - round;
  };

  // Pads stacked up the crag in rings, each for a tower or a house (kept clear of the road and the terraces).
  const PLATEAUS = TERRACES.map(t => ({ ...t })), pads = [];
  {
    const rOf = y => { let a = 0, b = 1100; for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (baseHill(m) > y) a = m; else b = m; } return a; };
    for (const y of [45, 75, 110, 140, 185, 215]) {
      const r = rOf(y), n = Math.floor(Math.PI * 2 * r / 88);
      for (let k = 0; k < n; k++) {
        const a = (k + R() * 0.5) / n * Math.PI * 2, u = Math.round(Math.sin(a) * r), w = Math.round(Math.cos(a) * r);
        const P = { x: u, z: w, hx: Math.round(22 + R() * 16), hz: Math.round(18 + R() * 14), y, round: 6, kind: R() < 0.45 ? 'tower' : R() < 0.7 ? 'house' : 'both' };
        if (Math.abs(a - Math.PI) < 0.7 && R() < 0.6) continue; // fewer round the back
        if (roadNear(u, w).d < RWH + 26 + Math.max(P.hx, P.hz)) continue;
        if (PLATEAUS.some(Q => sdRect(u, w, Q) < Math.max(P.hx, P.hz) + 20)) continue;
        PLATEAUS.push(P); pads.push(P);
      }
    }
  }

  // ================================================================================================
  // Terrain: the hill (a grid) and the mountains around (a polar grid). Collision follows the same grids.
  // ================================================================================================
  function terrainH(x, z) {
    const u = x - HX, w = z - HZ, r = Math.hypot(u, w);
    let h = baseHill(r);
    const fade = edgeFade(r);
    if (fade > 0) {
      const crag = 1 - Math.abs(fbm(u / 70, w / 70, 9) * 2 - 1); // ridged: rocky outcrops
      h += ((fbm(u / 130, w / 130, 3) - 0.5) * 60 + (crag - 0.55) * 46) * Math.min(1, h / 50 + 0.1) * fade;
    }
    for (const P of PLATEAUS) {
      const sd = sdRect(u, w, P);
      const band = P.round === 6 ? 18 : 40;
      if (sd < 0) h = P.y; else if (sd < band) h = P.y + (h - P.y) * smooth(0, band, sd);
    }
    const rd = roadNear(u, w);
    if (rd.d < RWH + 2) h = rd.y; else if (rd.d < RWH + 26) h = rd.y + (h - rd.y) * smooth(RWH + 2, RWH + 26, rd.d);
    return Math.max(0, h);
  }
  const hillH = new Float32Array(GN * GN);
  for (let iz = 0; iz < GN; iz++) for (let ix = 0; ix < GN; ix++) hillH[iz * GN + ix] = terrainH(HX - REGION + ix * GS, HZ - REGION + iz * GS);
  function mountainH(x, z) {
    const u = x - HX, w = z - HZ, D = Math.hypot(u, w), inner = 1850 + 650 * Math.max(0, w / (D || 1));
    const env = smooth(inner, inner + 550, D) * (1 - smooth(MR1 - 500, MR1, D));
    if (env <= 0) return -3;
    const ridge = 1 - Math.abs(fbm(u / 1000, w / 1000, 41, 5) * 2 - 1), crag = 1 - Math.abs(fbm(u / 260, w / 260, 13) * 2 - 1);
    return env * (140 + 1100 * ridge ** 2.4 + crag * 110 + fbm(u / 120, w / 120, 7) * 40);
  }
  const mtnH = new Float32Array((Math.round((MR1 - MR0) / MRS) + 1) * MA);
  const MRN = Math.round((MR1 - MR0) / MRS) + 1;
  for (let ri = 0; ri < MRN; ri++) for (let ai = 0; ai < MA; ai++) {
    const a = ai / MA * Math.PI * 2, rr = MR0 + ri * MRS;
    mtnH[ri * MA + ai] = mountainH(HX + Math.sin(a) * rr, HZ + Math.cos(a) * rr);
  }
  function groundAt(x, z) {
    const fx = (x - (HX - REGION)) / GS, fz = (z - (HZ - REGION)) / GS;
    if (fx >= 0 && fz >= 0 && fx < GN - 1 && fz < GN - 1) {
      const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, o = iz * GN + ix;
      const a = hillH[o], b = hillH[o + 1], c = hillH[o + GN], d = hillH[o + GN + 1];
      return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
    }
    const u = x - HX, w = z - HZ, D = Math.hypot(u, w);
    if (D > MR0 && D < MR1 - MRS) {
      let a = Math.atan2(u, w); if (a < 0) a += Math.PI * 2;
      const fa = a / (Math.PI * 2) * MA, fr = (D - MR0) / MRS;
      const ai = Math.floor(fa) % MA, ri = Math.floor(fr), ta = fa - Math.floor(fa), tr = fr - ri, a2 = (ai + 1) % MA;
      const h00 = mtnH[ri * MA + ai], h01 = mtnH[ri * MA + a2], h10 = mtnH[(ri + 1) * MA + ai], h11 = mtnH[(ri + 1) * MA + a2];
      return Math.max(0, h00 + (h01 - h00) * ta + (h10 - h00) * tr + (h00 - h01 - h10 + h11) * ta * tr);
    }
    return 0;
  }

  // ================================================================================================
  // Geometry store. Axis-aligned boxes go through `box` (collision + faces). Faces that look into the keep's
  // rooms are subdivided and get their torch- and chandelier-light baked in (unlit "B:" materials); every
  // other face is sunlit ("L:" materials). Round and slanted pieces are three.js geometries via `addGeo`.
  // ================================================================================================
  const S = k => (TEX[k] ? TEX[k][1] : 4);
  const parts = new Map(); // material key -> [BufferGeometry]
  // Round pieces inside the keep's rooms get the rooms' baked light too (per vertex).
  function addGeo(key, g) {
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n);
    if (!key.includes(':') && !key.startsWith('glow')) {
      g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3());
      if (insideKeep(c.x, c.y, c.z)) {
        const P = g.attributes.position, Nn = g.attributes.normal, col = new Float32Array(P.count * 3), lights = lightsAt(c.x, c.y, c.z);
        for (let v = 0; v < P.count; v++) col.set(bake(P.getX(v), P.getY(v), P.getZ(v), Nn.getX(v), Nn.getY(v), Nn.getZ(v), lights), v * 3);
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        key = 'B:' + key;
      }
    }
    if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    if (!parts.has(key)) parts.set(key, []);
    parts.get(key).push(g);
  }
  const insideKeep = (x, y, z) => x > KX0 + EXT - 0.01 && x < KX1 - EXT + 0.01 && z > KZ0 + EXT - 0.01 && z < KZ1 - EXT + 0.01 && y > KY - 0.01 && y < KROOF - 0.01;
  const roomLights = Array.from({ length: LEVELS }, () => Array.from({ length: KW }, () => Array.from({ length: KD }, () => [])));
  function lightsAt(x, y, z) {
    const l = Math.max(0, Math.min(LEVELS - 1, Math.floor((y - KY) / LH)));
    const i = Math.max(0, Math.min(KW - 1, Math.floor((x - KX0) / ROOM))), j = Math.max(0, Math.min(KD - 1, Math.floor((z - KZ0) / ROOM)));
    return roomLights[l][i][j];
  }
  function bake(x, y, z, nx, ny, nz, lights) {
    let r = 0.1, g = 0.09, b = 0.085;
    for (const L of lights) {
      const dx = L.x - x, dy = L.y - y, dz = L.z - z, d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2) || 1;
      const ndl = Math.max(0, (dx * nx + dy * ny + dz * nz) / d * 0.8 + 0.2);
      const fall = Math.max(0, 1 - d / L.r), a = L.i * fall * fall * ndl; // light reaches L.r metres
      r += L.c[0] * a; g += L.c[1] * a; b += L.c[2] * a;
    }
    const m = 1.9; return [Math.min(m, r), Math.min(m, g), Math.min(m, b)];
  }
  const buckets = new Map();
  function bucket(key) { let b = buckets.get(key); if (!b) buckets.set(key, b = { pos: [], nor: [], uv: [], col: [], idx: [] }); return b; }
  // A face given by corner c0, and edge vectors eu (u direction) and ev (v direction).
  function face(key, c0, eu, ev, n, scale) {
    const px = c0[0] + (eu[0] + ev[0]) / 2 + n[0] * 0.6, py = c0[1] + (eu[1] + ev[1]) / 2 + n[1] * 0.6, pz = c0[2] + (eu[2] + ev[2]) / 2 + n[2] * 0.6;
    const baked = !key.startsWith('glow') && insideKeep(px, py, pz);
    const b = bucket((baked ? 'B:' : 'L:') + key);
    const lu = Math.hypot(...eu), lv = Math.hypot(...ev);
    const nu = baked ? Math.max(1, Math.ceil(lu / 3)) : 1, nv = baked ? Math.max(1, Math.ceil(lv / 3)) : 1;
    const lights = baked ? lightsAt(px, py, pz) : null;
    const base = b.pos.length / 3;
    for (let a = 0; a <= nv; a++) for (let c = 0; c <= nu; c++) {
      const x = c0[0] + eu[0] * c / nu + ev[0] * a / nv, y = c0[1] + eu[1] * c / nu + ev[1] * a / nv, z = c0[2] + eu[2] * c / nu + ev[2] * a / nv;
      b.pos.push(x, y, z); b.nor.push(n[0], n[1], n[2]);
      if (n[0]) b.uv.push(z / scale, y / scale); else if (n[2]) b.uv.push(x / scale, y / scale); else b.uv.push(x / scale, z / scale);
      if (baked) b.col.push(...bake(x, y, z, n[0], n[1], n[2], lights)); else b.col.push(1, 1, 1);
    }
    for (let a = 0; a < nv; a++) for (let c = 0; c < nu; c++) {
      const i0 = base + a * (nu + 1) + c;
      b.idx.push(i0, i0 + 1, i0 + nu + 2, i0, i0 + nu + 2, i0 + nu + 1);
    }
  }
  const PX = 1, NX = 2, PY = 4, NY = 8, PZ = 16, NZ = 32;
  const cbox = [];
  function box(x0, y0, z0, x1, y1, z1, mat, opts = {}) {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    if (!opts.nocol) cbox.push(x0, y0, z0, x1, y1, z1);
    const skip = opts.skip || 0, m = typeof mat === 'string' ? { top: mat, bottom: mat, side: mat } : mat;
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    if (!(skip & PX)) face(m.side, [x1, y0, z1], [0, 0, -dz], [0, dy, 0], [1, 0, 0], S(m.side));
    if (!(skip & NX)) face(m.side, [x0, y0, z0], [0, 0, dz], [0, dy, 0], [-1, 0, 0], S(m.side));
    if (!(skip & PZ)) face(m.side, [x0, y0, z1], [dx, 0, 0], [0, dy, 0], [0, 0, 1], S(m.side));
    if (!(skip & NZ)) face(m.side, [x1, y0, z0], [-dx, 0, 0], [0, dy, 0], [0, 0, -1], S(m.side));
    if (!(skip & PY)) face(m.top, [x0, y1, z1], [dx, 0, 0], [0, 0, -dz], [0, 1, 0], S(m.top));
    if (!(skip & NY)) face(m.bottom, [x0, y0, z0], [dx, 0, 0], [0, 0, dz], [0, -1, 0], S(m.bottom));
  }
  // A straight wall with arched openings (dir 'x': runs along x, thickness in z).
  function wallRun(dir, t0, t1, c0, c1, y0, y1, openings, mat, cull = true) {
    const put = (a0, a1, b0, b1) => {
      if (a1 <= a0 || b1 <= b0) return;
      const skip = (cull && b0 === y0 ? NY : 0) | (cull && b1 === y1 ? PY : 0);
      if (dir === 'z') box(t0, b0, a0, t1, b1, a1, mat, { skip }); else box(a0, b0, t0, a1, b1, t1, mat, { skip });
    };
    openings.sort((p, q) => p.a0 - q.a0);
    let cur = c0;
    for (const o of openings) {
      put(cur, o.a0, y0, y1); put(o.a0, o.a1, y0, o.b0); put(o.a0, o.a1, o.b1, y1);
      if (o.rise) {
        const a = (o.a1 - o.a0) / 2, n = Math.max(2, Math.min(6, Math.round(o.rise / 4))), ys = o.b1 - o.rise;
        for (let k = 0; k < n; k++) {
          const yb = Math.round(ys + k * o.rise / n), yt = Math.round(ys + (k + 1) * o.rise / n);
          const t = (k + 0.5) / n, wd = Math.round(a - a * (o.pointed ? 1 - t ** 0.7 : Math.sqrt(1 - t * t)));
          if (wd > 0 && yt > yb) { put(o.a0, o.a0 + wd, yb, yt); put(o.a1 - wd, o.a1, yb, yt); }
        }
      }
      cur = o.a1;
    }
    put(cur, c1, y0, y1);
  }
  const opening = (center, width, b0, b1, rise, pointed) => ({ a0: Math.round(center - width / 2), a1: Math.round(center + width / 2), b0, b1, rise, pointed });

  // Collision for round and slanted pieces: solid y-ranges per block column.
  const cols = new Map();
  const ckey = (x, z) => (x + 32768) * 65536 + (z + 32768);
  function colAdd(x, z, y0, y1) { const k = ckey(x, z); let a = cols.get(k); if (!a) cols.set(k, a = []); a.push(Math.floor(y0), Math.ceil(y1)); }
  function disc(cx, cz, r, y0, y1) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      if ((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 <= r * r) colAdd(x, z, y0, y1);
  }
  function segCol(x1, z1, x2, z2, hw, y0, y1) {
    const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1;
    for (let x = Math.floor(Math.min(x1, x2) - hw); x <= Math.ceil(Math.max(x1, x2) + hw); x++) for (let z = Math.floor(Math.min(z1, z2) - hw); z <= Math.ceil(Math.max(z1, z2) + hw); z++) {
      const t = Math.max(0, Math.min(1, ((x + 0.5 - x1) * dx + (z + 0.5 - z1) * dz) / l2));
      if (Math.hypot(x1 + dx * t - x - 0.5, z1 + dz * t - z - 0.5) <= hw) colAdd(x, z, y0, y1);
    }
  }

  // ---- Round and slanted pieces -------------------------------------------------------------------
  function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }
  function cyl(x, z, y0, y1, r, key, opts = {}) {
    const h = y1 - y0, segs = opts.segs || Math.max(12, Math.min(40, Math.round(r * 1.6)));
    const g = new THREE.CylinderGeometry(opts.rTop ?? r, r, h, segs, 1, false);
    scaleUV(g, 2 * Math.PI * r / S(key), h / S(key));
    g.translate(x, y0 + h / 2, z);
    addGeo(key, g);
    if (opts.col !== false) disc(x, z, r, y0, y1);
  }
  function cone(x, z, y0, h, r, key) {
    const g = new THREE.ConeGeometry(r, h, Math.max(12, Math.min(40, Math.round(r * 1.6))));
    scaleUV(g, 2 * Math.PI * r / S(key), Math.hypot(h, r) / S(key));
    g.translate(x, y0 + h / 2, z);
    addGeo(key, g);
  }
  function rbox(cx, cy, cz, w, h, d, yaw, key) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, s = S(key);
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / s, uv.getY(i) * dims[f][1] / s); }
    g.rotateY(yaw); g.translate(cx, cy, cz);
    addGeo(key, g);
  }
  // A gable roof over [x0,x1] x [z0,z1] (ridge along x) from height y, `rh` tall, eaves overhanging by `ov`.
  function gable(x0, z0, x1, z1, y, rh, ov, key) {
    const zc = (z0 + z1) / 2, s = S(key), X0 = x0 - ov, X1 = x1 + ov, ZA = z0 - ov, ZB = z1 + ov, yr = y + rh, ye = y - ov * rh / (zc - z0);
    const pos = [], uv = [], idx = [];
    const quad = (a, b, c, d, uvs) => { const o = pos.length / 3; pos.push(...a, ...b, ...c, ...d); uv.push(...uvs); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
    const sl = Math.hypot(zc - ZA, yr - ye) / s;
    quad([X0, ye, ZB], [X1, ye, ZB], [X1, yr, zc], [X0, yr, zc], [X0 / s, 0, X1 / s, 0, X1 / s, sl, X0 / s, sl]);
    quad([X1, ye, ZA], [X0, ye, ZA], [X0, yr, zc], [X1, yr, zc], [X1 / s, 0, X0 / s, 0, X0 / s, sl, X1 / s, sl]);
    const o = pos.length / 3; // gable ends (triangles)
    pos.push(X1, ye, ZB, X1, ye, ZA, X1, yr, zc, X0, ye, ZA, X0, ye, ZB, X0, yr, zc);
    uv.push(ZB / s, 0, ZA / s, 0, zc / s, rh / s, ZA / s, 0, ZB / s, 0, zc / s, rh / s);
    idx.push(o, o + 1, o + 2, o + 3, o + 4, o + 5);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    addGeo(key, g);
  }
  // A round tower: shaft, a corbelled band, then a cone roof (brown, slate or dark) or a crenellated top.
  // Flags on the bigger towers: merged into one mesh whose shader waves them in the wind (fx: 0 at the pole).
  const flags = [];
  function flag(x, y, z, size = 1) {
    const g = new THREE.PlaneGeometry(9 * size, 5.5 * size, 10, 1); g.translate(4.5 * size, -2.75 * size, 0); g.translate(x, y, z);
    const P = g.attributes.position, fx = new Float32Array(P.count);
    for (let v = 0; v < P.count; v++) fx[v] = (P.getX(v) - x) / (9 * size);
    g.setAttribute('fx', new THREE.BufferAttribute(fx, 1)); g.deleteAttribute('uv');
    flags.push(g);
  }
  // A round tower: shaft with stone bands and hooded windows, a corbelled crown, a balcony on the big ones, and a
  // steep cone roof (brown, slate or dark) with flared eaves, dormers and a flag, or a crenellated top.
  function tower(u, w, y0, y1, r, wall, roof, roofH) {
    const x = HX + u, z = HZ + w;
    cyl(x, z, y0, y1, r, wall);
    for (let yy = y0 + 36; yy < y1 - 14; yy += 36) cyl(x, z, yy, yy + 1.6, r + 0.8, wall, { col: false });
    cyl(x, z, y1 - 4, y1 + (roof ? 1 : 2), r + 1.8, wall, { col: false });
    if (r >= 13 && y1 - y0 > 70) { // balcony
      const yb = Math.round(y0 + (y1 - y0) * 0.62), n = Math.round((r + 3) * Math.PI * 2 / 5);
      cyl(x, z, yb - 1.4, yb, r + 3.4, wall, { col: false });
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; rbox(x + Math.sin(a) * (r + 2.9), yb + 1.1, z + Math.cos(a) * (r + 2.9), 2.2, 2.2, 0.9, a, wall); }
    }
    for (let yy = y0 + 24; yy < y1 - 16; yy += 26) for (let k = 0; k < 6; k++) { // windows, each with a little hood above
      const a = k / 6 * Math.PI * 2 + yy * 0.37, ww = Math.max(1.6, r * 0.14), wh = Math.max(5, r * 0.55);
      rbox(x + Math.sin(a) * (r + 0.05), yy, z + Math.cos(a) * (r + 0.05), ww, wh, 0.6, a, 'window');
      rbox(x + Math.sin(a) * (r + 0.3), yy + wh / 2 + 0.5, z + Math.cos(a) * (r + 0.3), ww + 1.2, 1, 1.2, a, wall);
    }
    if (roof) {
      const RH = roofH * 1.15;
      cone(x, z, y1 + 1, 6, r + 5.5, roof); // flared eaves
      cone(x, z, y1 + 1, RH, r + 3, roof);
      if (r >= 11) for (let k = 0; k < 3; k++) { // dormers
        const a = k / 3 * Math.PI * 2 + r, t = 0.26, rr = (r + 3) * (1 - t) + 0.4, yy = y1 + 1 + RH * t;
        rbox(x + Math.sin(a) * rr, yy + 1.6, z + Math.cos(a) * rr, 3.4, 4.4, 2.6, a, wall);
        rbox(x + Math.sin(a) * (rr + 1.32), yy + 1.4, z + Math.cos(a) * (rr + 1.32), 1.8, 2.6, 0.2, a, 'window');
        cone(x + Math.sin(a) * rr, z + Math.cos(a) * rr, yy + 3.8, 3, 2.6, roof);
      }
      const top = y1 + 1 + RH + Math.max(6, r * 0.5);
      cyl(x, z, y1 + 1 + RH - 2, top, 0.6, 'roofDark', { col: false, segs: 6 }); // finial
      if (r >= 12) flag(x, top - 0.3, z, Math.min(1.6, r / 12));
    } else {
      const n = Math.max(8, Math.round((r + 1.8) * Math.PI * 2 / 7));
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; rbox(x + Math.sin(a) * (r + 1), y1 + 4.5, z + Math.cos(a) * (r + 1), 3.4, 5, 1.6, a, wall); }
    }
  }
  // An annulus (flat ring) facing up or down.
  function annulus(x, z, y, r0, r1, up, key) {
    const g = new THREE.RingGeometry(r0, r1, Math.max(16, Math.round(r1 * 1.6)), 1);
    g.rotateX(up ? -Math.PI / 2 : Math.PI / 2); g.translate(x, y, z);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r1 * 2 / S(key), uv.getY(i) * r1 * 2 / S(key));
    addGeo(key, g);
  }
  // A hollow round wall (thickness tw), optionally with a gap [a0, a1] (angles, x = r sin a, z = r cos a).
  function hollow(x, z, y0, y1, r, tw, key, gap) {
    const h = y1 - y0, segs = Math.max(16, Math.round(r * 1.6)), a0 = gap ? gap[1] : 0, len = gap ? Math.PI * 2 - (gap[1] - gap[0]) : Math.PI * 2;
    const outer = new THREE.CylinderGeometry(r, r, h, segs, 1, true, a0, len); scaleUV(outer, 2 * Math.PI * r / S(key), h / S(key)); outer.translate(x, y0 + h / 2, z); addGeo(key, outer);
    const inner = new THREE.CylinderGeometry(r - tw, r - tw, h, segs, 1, true, a0, len); scaleUV(inner, 2 * Math.PI * r / S(key), h / S(key));
    const ix = inner.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    const nn = inner.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i));
    inner.translate(x, y0 + h / 2, z); addGeo(key, inner);
    const inGap = a => { if (!gap) return false; let d = a - gap[0]; d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return d < gap[1] - gap[0]; };
    for (let cx = Math.floor(x - r); cx <= Math.ceil(x + r); cx++) for (let cz = Math.floor(z - r); cz <= Math.ceil(z + r); cz++) {
      const dx = cx + 0.5 - x, dz = cz + 0.5 - z, d = Math.hypot(dx, dz);
      if (d >= r - tw - 0.3 && d <= r + 0.3 && !inGap(Math.atan2(dx, dz))) colAdd(cx, cz, y0, y1);
    }
    if (gap) for (const a of gap) rbox(x + Math.sin(a) * (r - tw / 2), y0 + h / 2, z + Math.cos(a) * (r - tw / 2), 0.6, h, tw, a, key); // the cut ends
  }
  // A crenellated curtain wall between two points (relative), any direction.
  function curtain(u1, w1, u2, w2, y0, y1, wall, thick = 6) {
    const x1 = HX + u1, z1 = HZ + w1, x2 = HX + u2, z2 = HZ + w2, L = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(x2 - x1, z2 - z1);
    rbox((x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2, thick, y1 - y0, L, a, wall);
    segCol(x1, z1, x2, z2, thick / 2, y0, y1);
    const n = Math.floor(L / 9);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      rbox(x1 + (x2 - x1) * t, y1 + 2.5, z1 + (z2 - z1) * t, thick, 5, 4.5, a, wall);
    }
  }
  // A rectangular building (relative coords): walls up to y1, windows, and a gable roof.
  function hall(u0, w0, u1, w1, y0, y1, lower, upper, split, roofKey, roofH) {
    const x0 = HX + u0, x1 = HX + u1, z0 = HZ + w0, z1 = HZ + w1;
    box(x0, y0, z0, x1, split, z1, lower, { skip: NY });
    box(x0, split, z0, x1, y1, z1, upper, { skip: NY | PY });
    for (let x = x0 + 10; x < x1 - 6; x += 14) for (const z of [z0 - 0.3, z1 + 0.3]) rbox(x, (split + y1) / 2, z, 3, (y1 - split) * 0.5, 0.6, 0, 'window');
    gable(x0, z0, x1, z1, y1, roofH, 3, roofKey);
  }

  // ================================================================================================
  // The keep: four levels of chained rooms.
  // ================================================================================================
  const gx = i => KX0 + i * ROOM, gz = j => KZ0 + j * ROOM;
  const stairs = [], furniturePlan = [], roomNames = [];
  const T = [1, 0.66, 0.36], C = [1, 0.84, 0.62];
  // Giant furniture, one theme per room. sl: a 26 x 26 m corner slot.
  function furnish({ f, theme, slots }) {
    const W = 'wood';
    slots.forEach((sl, n) => {
      const { x0, z0, x1, z1, cx, cz } = sl, r = Math.round;
      if (theme === 'gallery') { // a statue on a plinth
        box(cx - 6, f, cz - 6, cx + 6, f + 4, cz + 6, 'cream', { skip: NY });
        box(cx - 3, f + 4, cz - 1.5, cx - 0.5, f + 13, cz + 1.5, 'cream', { nocol: true }); box(cx + 0.5, f + 4, cz - 1.5, cx + 3, f + 13, cz + 1.5, 'cream', { nocol: true });
        box(cx - 3.5, f + 13, cz - 2, cx + 3.5, f + 22, cz + 2, 'cream', { nocol: true });
        box(cx - 6, f + 19, cz - 1.2, cx - 3.5, f + 21, cz + 1.2, 'cream', { nocol: true }); box(cx + 3.5, f + 14, cz - 1.2, cx + 5.5, f + 21, cz + 1.2, 'cream', { nocol: true });
        box(cx - 1.8, f + 22, cz - 1.8, cx + 1.8, f + 25.5, cz + 1.8, 'cream', { nocol: true });
        box(cx - 2, f + 25.5, cz - 2, cx + 2, f + 26.3, cz + 2, 'gold', { nocol: true });
      } else if (theme === 'banquet') { // a long table, benches and candles
        box(x0 + 1, f + 6, cz - 4, x1 - 1, f + 7, cz + 4, W);
        for (const [a, b] of [[x0 + 2, cz - 3], [x1 - 3, cz - 3], [x0 + 2, cz + 2], [x1 - 3, cz + 2]]) box(a, f, b, a + 1, f + 6, b + 1, W, { skip: NY });
        box(x0 + 2, f, cz - 9, x1 - 2, f + 3, cz - 6, W, { skip: NY }); box(x0 + 2, f, cz + 6, x1 - 2, f + 3, cz + 9, W, { skip: NY });
        for (const a of [x0 + 6, cx, x1 - 6]) { box(a - 0.6, f + 7, cz - 0.6, a + 0.6, f + 9, cz + 0.6, 'white', { nocol: true }); box(a - 0.3, f + 9, cz - 0.3, a + 0.3, f + 10, cz + 0.3, 'glowGold', { nocol: true }); }
        for (const a of [x0 + 4, x0 + 10, x1 - 10, x1 - 4]) for (const b of [cz - 2.5, cz + 1]) box(a, f + 7, b, a + 2, f + 7.2, b + 1.5, 'white', { nocol: true });
      } else if (theme === 'kitchen') {
        if (n === 0) { // the cooking fire: a stone ring, flames and a cauldron on a spit
          box(cx - 7, f, cz - 7, cx + 7, f + 2, cz - 5, 'cream', { skip: NY }); box(cx - 7, f, cz + 5, cx + 7, f + 2, cz + 7, 'cream', { skip: NY });
          box(cx - 7, f, cz - 5, cx - 5, f + 2, cz + 5, 'cream', { skip: NY }); box(cx + 5, f, cz - 5, cx + 7, f + 2, cz + 5, 'cream', { skip: NY });
          box(cx - 4, f, cz - 4, cx + 4, f + 3, cz + 4, 'glowFire', { nocol: true }); box(cx - 2, f + 3, cz - 2, cx + 2, f + 6, cz + 2, 'glow', { nocol: true });
          cyl(cx, cz, f + 7, f + 12, 4, 'iron', { col: false, rTop: 4.6 });
          box(cx - 9, f, cz - 0.5, cx - 8, f + 14, cz + 0.5, 'iron', { nocol: true }); box(cx + 8, f, cz - 0.5, cx + 9, f + 14, cz + 0.5, 'iron', { nocol: true });
          box(cx - 9, f + 14, cz - 0.5, cx + 9, f + 15, cz + 0.5, 'iron', { nocol: true });
        } else { // a work table and barrels
          box(x0 + 2, f + 5, z0 + 3, x1 - 8, f + 6, z0 + 11, W);
          for (const [a, b] of [[x0 + 3, z0 + 4], [x1 - 10, z0 + 4], [x0 + 3, z0 + 9], [x1 - 10, z0 + 9]]) box(a, f, b, a + 1, f + 5, b + 1, W, { skip: NY });
          for (const [a, b] of [[x1 - 4, z0 + 5], [x1 - 4, z1 - 6], [x0 + 6, z1 - 5], [cx + 3, z1 - 5]]) { cyl(a, b, f, f + 6, 2.6, W); cyl(a, b, f + 1.2, f + 1.8, 2.75, 'iron', { col: false }); cyl(a, b, f + 4.2, f + 4.8, 2.75, 'iron', { col: false }); }
        }
      } else if (theme === 'armoury') { // suits of armour, a weapon rack and shields
        for (const a of [x0 + 6, x1 - 6]) {
          box(a - 2.5, f, z0 + 3, a + 2.5, f + 1, z0 + 8, 'cream', { skip: NY });
          box(a - 2, f + 1, z0 + 4.5, a - 0.4, f + 8, z0 + 6.5, 'iron', { nocol: true }); box(a + 0.4, f + 1, z0 + 4.5, a + 2, f + 8, z0 + 6.5, 'iron', { nocol: true });
          box(a - 2.6, f + 8, z0 + 4, a + 2.6, f + 14, z0 + 7, 'iron', { nocol: true });
          box(a - 3.6, f + 9, z0 + 4.5, a - 2.6, f + 13.5, z0 + 6.5, 'iron', { nocol: true }); box(a + 2.6, f + 9, z0 + 4.5, a + 3.6, f + 13.5, z0 + 6.5, 'iron', { nocol: true });
          box(a - 1.5, f + 14, z0 + 4, a + 1.5, f + 17, z0 + 7, 'iron', { nocol: true }); box(a - 0.3, f + 17, z0 + 5.2, a + 0.3, f + 18.5, z0 + 5.8, 'red', { nocol: true });
        }
        box(x0 + 2, f, z1 - 6, x1 - 2, f + 1, z1 - 4, W, { skip: NY }); box(x0 + 2, f + 12, z1 - 6, x1 - 2, f + 13, z1 - 4, W, { nocol: true });
        for (let a = x0 + 4; a < x1 - 3; a += 3) { box(a, f + 1, z1 - 5.3, a + 0.4, f + 17, z1 - 4.7, W, { nocol: true }); box(a - 0.3, f + 17, z1 - 5.5, a + 0.7, f + 19, z1 - 4.5, 'iron', { nocol: true }); }
        for (const [a, b] of [[cx - 4, cz], [cx + 4, cz]]) { const g = new THREE.CylinderGeometry(3.2, 3.2, 0.5, 18); g.rotateX(Math.PI / 2); g.translate(a, f + 6, b); addGeo(n % 2 ? 'blue' : 'red', g); }
      } else if (theme === 'library') { // tall bookcases, a reading desk
        box(x0 + 1, f, z0 + 2, x1 - 1, f + 16, z0 + 5, { top: W, bottom: W, side: 'books' });
        box(x0 + 1, f, z1 - 5, x1 - 1, f + 16, z1 - 2, { top: W, bottom: W, side: 'books' });
        box(cx - 5, f + 5, cz - 3, cx + 5, f + 6, cz + 3, W); for (const [a, b] of [[cx - 4.5, cz - 2.5], [cx + 3.5, cz - 2.5], [cx - 4.5, cz + 1.5], [cx + 3.5, cz + 1.5]]) box(a, f, b, a + 1, f + 5, b + 1, W, { skip: NY });
        box(cx - 2, f + 6, cz - 1, cx + 1, f + 6.6, cz + 1.5, 'linen', { nocol: true }); box(cx + 2, f + 6, cz - 0.4, cx + 2.6, f + 7.4, cz + 0.2, 'glowGold', { nocol: true });
      } else if (theme === 'chapel') {
        if (n === 0) { // the altar, candles and a stained-glass screen
          box(cx - 8, f, cz - 3, cx + 8, f + 6, cz + 3, 'cream', { skip: NY }); box(cx - 8.5, f + 6, cz - 3.5, cx + 8.5, f + 6.6, cz + 3.5, 'gold', { nocol: true });
          for (const a of [cx - 6, cx - 2, cx + 2, cx + 6]) { box(a - 0.4, f + 6.6, cz - 0.4, a + 0.4, f + 9, cz + 0.4, 'white', { nocol: true }); box(a - 0.25, f + 9, cz - 0.25, a + 0.25, f + 10, cz + 0.25, 'glowGold', { nocol: true }); }
          const cols = ['glowRed', 'glowBlue', 'glowGold', 'glowBlue', 'glowRed'];
          cols.forEach((c, k2) => box(cx - 10 + k2 * 4, f + 10, cz - 7, cx - 7 + k2 * 4, f + 26, cz - 6.5, c, { nocol: true }));
          box(cx - 11, f + 8, cz - 7.5, cx + 11, f + 10, cz - 6, 'cream', { nocol: true }); box(cx - 11, f + 26, cz - 7.5, cx + 11, f + 28, cz - 6, 'cream', { nocol: true });
        } else for (let b = z0 + 4; b < z1 - 3; b += 7) { // rows of pews
          box(x0 + 2, f, b, x1 - 2, f + 3, b + 3, W, { skip: NY }); box(x0 + 2, f + 3, b + 2.4, x1 - 2, f + 7, b + 3, W, { nocol: true });
        }
      } else if (theme === 'chamber') {
        if (n === slots.length - 1 || n === 1) { // the giant bed
          box(x0 + 2, f, z0 + 2, x1 - 2, f + 4, z1 - 2, W, { skip: NY });
          box(x0 + 3, f + 4, z0 + 3, x1 - 3, f + 7, z1 - 3, 'linen');
          box(x0 + 3, f + 7, z0 + 9, x1 - 3, f + 7.6, z1 - 3, n === 1 ? 'blue' : 'red', { nocol: true });
          box(x0 + 5, f + 7, z0 + 3.5, cx - 1, f + 9, z0 + 8, 'white', { nocol: true }); box(cx + 1, f + 7, z0 + 3.5, x1 - 5, f + 9, z0 + 8, 'white', { nocol: true });
          box(x0 + 2, f, z0, x1 - 2, f + 18, z0 + 2, W);
          for (const [a, b] of [[x0 + 2, z0], [x1 - 3, z0], [x0 + 2, z1 - 3], [x1 - 3, z1 - 3]]) box(a, f + 4, b, a + 1, f + 24, b + 1, W, { nocol: true });
        } else { // a wardrobe and a rug
          box(x0 + 4, f, z0 + 4, x1 - 4, f + 22, z0 + 10, W);
          box(cx - 0.3, f + 2, z0 + 10, cx + 0.3, f + 20, z0 + 10.3, 'iron', { nocol: true });
          box(x0 + 2, f, z0 + 14, x1 - 2, f + 0.08, z1 - 2, n % 2 ? 'blue' : 'red', { nocol: true, skip: NY });
        }
      } else if (theme === 'throne') {
        if (n === slots.length - 1) { // the dais and the throne
          box(x0, f, z0, x1, f + 2, z1, 'marble', { skip: NY }); box(x0 + 4, f + 2, z0 + 4, x1 - 4, f + 4, z1 - 4, 'marble', { skip: NY });
          box(cx - 7, f + 4, cz - 2, cx + 7, f + 10, cz + 6, 'gold');
          box(cx - 7, f + 10, cz + 4, cx + 7, f + 30, cz + 6, 'gold');
          box(cx - 7, f + 10, cz - 2, cx - 5, f + 15, cz + 4, 'gold', { nocol: true }); box(cx + 5, f + 10, cz - 2, cx + 7, f + 15, cz + 4, 'gold', { nocol: true });
          box(cx - 5, f + 10, cz - 1, cx + 5, f + 11, cz + 4, 'red', { nocol: true }); box(cx - 5, f + 11, cz + 3.6, cx + 5, f + 27, cz + 4, 'red', { nocol: true });
          for (const a of [-5, 0, 5]) box(cx + a - 1, f + 30, cz + 4.5, cx + a + 1, f + 34, cz + 5.5, 'gold', { nocol: true });
        } else { // pillars with banners
          cyl(cx, cz, f, f + H, 3.5, 'cream');
          cyl(cx, cz, f, f + 2, 5, 'cream', { col: false }); cyl(cx, cz, f + H - 3, f + H, 5, 'cream', { col: false });
          box(cx - 3, f + 12, cz + 3.6, cx + 3, f + 36, cz + 4.1, 'red', { nocol: true }); box(cx - 3, f + 33, cz + 3.5, cx + 3, f + 34, cz + 4.2, 'gold', { nocol: true });
        }
      }
    });
  }
  for (let l = 0; l < LEVELS; l++) {
    const f = KY + l * LH;
    for (let i = 0; i < KW; i++) for (let j = 0; j < KD; j++) {
      const L = roomLights[l][i][j], cx0 = gx(i), cz0 = gz(j);
      const in0 = i === 0 ? EXT : IW, in1 = i === KW - 1 ? EXT : IW, jn0 = j === 0 ? EXT : IW, jn1 = j === KD - 1 ? EXT : IW;
      // wall torches (nx, nz: the way from the wall into the room)
      for (const a of [24, 72]) {
        L.push({ x: cx0 + in0 + 3, y: f + 15, z: cz0 + a, i: 2.4, r: 30, c: T, nx: 1, nz: 0 }, { x: cx0 + ROOM - in1 - 3, y: f + 15, z: cz0 + a, i: 2.4, r: 30, c: T, nx: -1, nz: 0 });
        L.push({ x: cx0 + a, y: f + 15, z: cz0 + jn0 + 3, i: 2.4, r: 30, c: T, nx: 0, nz: 1 }, { x: cx0 + a, y: f + 15, z: cz0 + ROOM - jn1 - 3, i: 2.4, r: 30, c: T, nx: 0, nz: -1 });
      }
      L.push({ x: cx0 + 48, y: f + H - 17, z: cz0 + 48, i: 1.5, r: 75, c: C, big: true });
    }
    // Furniture: each room on the chain has a theme. Pieces go in the room's four corner "slots", clear of the
    // carpet lanes through the middle; the corner the stairs (or the stairwell railing from below) use is left empty.
    PATHS[l].forEach(([i, j], k) => {
      const theme = THEMES[l][k], cx0 = gx(i), cz0 = gz(j), busy = k === PATHS[l].length - 1 || (k === 0 && l > 0);
      const slots = [[14, 14], [56, 14], [14, 56], [56, 56]].filter((q, n) => !(busy && n === 0)).map(([a, b]) => ({ x0: cx0 + a, z0: cz0 + b, x1: cx0 + a + 26, z1: cz0 + b + 26, cx: cx0 + a + 13, cz: cz0 + b + 13 }));
      if (busy) slots[1].z0 += 8; // (the stairwell reaches a little into the slot beside it)
      const P = { l, f, i, j, theme, slots, lights: roomLights[l][i][j] };
      furniturePlan.push(P);
      const fire = [1, 0.55, 0.22], candle = [1, 0.75, 0.45];
      for (const sl of slots) {
        if (theme === 'banquet') P.lights.push({ x: sl.cx, y: f + 10, z: sl.cz, i: 1.1, r: 22, c: candle });
        if (theme === 'kitchen' && sl === slots[0]) P.lights.push({ x: sl.cx, y: f + 4, z: sl.cz, i: 3, r: 40, c: fire });
        if (theme === 'chapel' && sl === slots[0]) P.lights.push({ x: sl.cx, y: f + 12, z: sl.cz, i: 1.6, r: 30, c: [0.7, 0.75, 1] });
        if (theme === 'throne' && sl === slots[slots.length - 1]) P.lights.push({ x: sl.cx, y: f + 22, z: sl.cz, i: 1.5, r: 30, c: [1, 0.85, 0.5] });
      }
      roomNames.push({ l, i, j, name: THEME_NAME[theme] });
    });
  }
  for (let l = 0; l < LEVELS; l++) {
    const f = KY + l * LH, top = f + H, path = PATHS[l], wallMat = 'wall' + l;
    const isLink = (a, b) => path.some((c, k) => k > 0 && ((c[0] === a[0] && c[1] === a[1] && path[k - 1][0] === b[0] && path[k - 1][1] === b[1]) || (c[0] === b[0] && c[1] === b[1] && path[k - 1][0] === a[0] && path[k - 1][1] === a[1])));
    const door = (c0, c1) => [opening((c0 + c1) / 2, 28, f, f + 36, 14)];
    // Walls between rooms: a doorway only between rooms that follow each other on this level's path.
    for (let i = 1; i < KW; i++) for (let j = 0; j < KD; j++) {
      const c0 = j === 0 ? KZ0 + EXT : gz(j) + IW, c1 = j === KD - 1 ? KZ1 - EXT : gz(j + 1) - IW;
      wallRun('z', gx(i) - IW, gx(i) + IW, c0, c1, f, top, isLink([i - 1, j], [i, j]) ? door(c0, c1) : [], wallMat);
    }
    for (let j = 1; j < KD; j++) for (let i = 0; i < KW; i++) {
      const c0 = i === 0 ? KX0 + EXT : gx(i) + IW, c1 = i === KW - 1 ? KX1 - EXT : gx(i + 1) - IW;
      wallRun('x', gz(j) - IW, gz(j) + IW, c0, c1, f, top, isLink([i, j - 1], [i, j]) ? door(c0, c1) : [], wallMat);
    }
    for (let i = 1; i < KW; i++) for (let j = 1; j < KD; j++) box(gx(i) - IW, f, gz(j) - IW, gx(i) + IW, top, gz(j) + IW, wallMat, { skip: NY | PY });
    // Outer walls (with the slab band): tall arched windows, and on the first level the front door.
    const y1 = l === LEVELS - 1 ? KROOF : f + LH;
    const winds = (alongX, k) => {
      const base = alongX ? gx(k) : gz(k);
      if (l === 0 && alongX && k === 1) return [];
      return [32, 64].map(a => opening(base + a, 8, f + 12, f + 38, 4));
    };
    const front = [], back = [], west = [], east = [];
    for (let k = 0; k < KW; k++) { front.push(...winds(true, k)); back.push(...winds(true, k)); }
    for (let k = 0; k < KD; k++) { west.push(...winds(false, k)); east.push(...winds(false, k)); }
    if (l === 0) front.push(opening(HX, 36, f, f + 44, 18));
    wallRun('x', KZ1 - EXT, KZ1, KX0, KX1, f, y1, front, 'cream');
    wallRun('x', KZ0, KZ0 + EXT, KX0, KX1, f, y1, back, 'cream');
    wallRun('z', KX0, KX0 + EXT, KZ0 + EXT, KZ1 - EXT, f, y1, west.filter(o => o.a0 > KZ0 + EXT), 'cream');
    wallRun('z', KX1 - EXT, KX1, KZ0 + EXT, KZ1 - EXT, f, y1, east.filter(o => o.a0 > KZ0 + EXT), 'cream');
    // Floor (level 0) and the slab above, with the stairwell cut out of the last room's ceiling.
    const end = path[path.length - 1], above = l + 1 < LEVELS ? 'floor' : 'keepTop';
    for (let i = 0; i < KW; i++) for (let j = 0; j < KD; j++) {
      const x0 = Math.max(gx(i), KX0 + EXT), x1 = Math.min(gx(i + 1), KX1 - EXT), z0 = Math.max(gz(j), KZ0 + EXT), z1 = Math.min(gz(j + 1), KZ1 - EXT);
      const floorOf = (lv) => FLOORS[(lv * 7 + i * 3 + j * 5) % FLOORS.length];
      if (l === 0) box(x0, KY - 6, z0, x1, KY, z1, floorOf(0), { skip: NY | PX | NX | PZ | NZ });
      const mat = { top: above === 'floor' ? floorOf(l + 1) : 'keepTop', bottom: 'beams', side: wallMat };
      if (end[0] === i && end[1] === j) {
        const sx = gx(i) + 12, z0s = gz(j) + 20, half = LH / 2, zl = z0s + half, zEnd = zl + 12;
        stairs.push({ level: l, floor: f, x: sx, z: z0s, rise: LH });
        box(x0, top, z0, x1, top + SLAB, z0s, mat, { skip: PX | NX | PZ | NZ });
        box(x0, top, zEnd, x1, top + SLAB, z1, mat, { skip: PX | NX | PZ | NZ });
        box(x0, top, z0s, sx, top + SLAB, zEnd, mat, { skip: NX | PZ | NZ });
        box(sx + 28, top, z0s, x1, top + SLAB, zEnd, mat, { skip: PX | PZ | NZ });
        const st = { top: 'stonetiles', bottom: wallMat, side: wallMat };
        for (let k = 1; k <= half; k++) box(sx, f, z0s + k - 1, sx + 14, f + k, z0s + k, st, { skip: NY | (k < half ? PZ : 0) });
        box(sx, f, zl, sx + 28, f + half, zEnd, st, { skip: NY });
        for (let m = 1; m <= half; m++) box(sx + 14, f + half, zl - m, sx + 28, f + half + m, zl - m + 1, st, { skip: NY | (m < half ? NZ : 0) });
        box(sx + 14, f, z0s, sx + 28, f + half, zl, st, { skip: NY | PZ });
        const F = f + LH, rm = l + 1 < LEVELS ? 'wall' + (l + 1) : 'cream';
        box(sx - 2, F, z0s - 2, sx, F + 2, zEnd + 2, rm, { skip: NY });
        box(sx + 28, F, z0s - 2, sx + 30, F + 2, zEnd + 2, rm, { skip: NY });
        box(sx, F, zEnd, sx + 28, F + 2, zEnd + 2, rm, { skip: NY });
        box(sx, F, z0s - 2, sx + 14, F + 2, z0s, rm, { skip: NY });
      } else box(x0, top, z0, x1, top + SLAB, z1, mat, { skip: PX | NX | PZ | NZ });
    }
    // Torches, chandeliers and a red carpet from each room's way in to its way out.
    for (let i = 0; i < KW; i++) for (let j = 0; j < KD; j++) {
      for (const Lt of roomLights[l][i][j]) {
        if (Lt.big) { // chandelier
          const x = Math.round(Lt.x), z = Math.round(Lt.z), y = Math.round(Lt.y);
          box(x, y + 4, z, x + 1, top, z + 1, 'iron', { skip: PY });
          box(x - 10, y + 3, z - 10, x + 11, y + 4, z + 11, 'iron');
          box(x - 4, y - 1, z - 4, x + 5, y + 3, z + 5, 'glow');
          for (let k = 0; k < 8; k++) { const dx = Math.round(Math.sin(k * Math.PI / 4) * 9), dz = Math.round(Math.cos(k * Math.PI / 4) * 9); box(x + dx, y + 4, z + dz, x + dx + 1, y + 7, z + dz + 1, 'glow'); }
        } else { // torch: an iron arm from the wall, a cup, and the flame
          const wx = Lt.x, wz = Lt.z, y = Lt.y, ax = wx - Lt.nx * 3, az = wz - Lt.nz * 3;
          box(Math.min(ax, wx) - 0.5, y - 5, Math.min(az, wz) - 0.5, Math.max(ax, wx) + 0.5, y - 4, Math.max(az, wz) + 0.5, 'iron', { nocol: true });
          box(wx - 0.6, y - 7, wz - 0.6, wx + 0.6, y - 2, wz + 0.6, 'iron', { nocol: true });
          box(wx - 1.6, y - 2, wz - 1.6, wx + 1.6, y - 0.8, wz + 1.6, 'iron', { nocol: true });
          box(wx - 1.2, y - 0.8, wz - 1.2, wx + 1.2, y + 3.2, wz + 1.2, 'glow', { nocol: true });
        }
      }
    }
    for (let k = 0; k < path.length; k++) {
      const [i, j] = path[k], cx = gx(i) + 48, cz = gz(j) + 48;
      const ends = [];
      const prev = path[k - 1], next = path[k + 1];
      if (prev) ends.push([(gx(prev[0]) + 48 + cx) / 2, (gz(prev[1]) + 48 + cz) / 2]);
      else if (l === 0) ends.push([HX, KZ1 - EXT]); // the front door
      if (next) ends.push([(gx(next[0]) + 48 + cx) / 2, (gz(next[1]) + 48 + cz) / 2]);
      else ends.push([gx(i) + 12 + 7, gz(j) + 13]); // the foot of the stairs
      // an L: from the middle of the room along z, then along x (keeps clear of the stairs)
      for (const [ex, ez] of ends) {
        if (ez !== cz) box(cx - 5, f, Math.min(ez, cz) - 5, cx + 5, f + 0.06, Math.max(ez, cz) + 5, 'carpet', { nocol: true, skip: NY });
        if (ex !== cx) box(Math.min(ex, cx) - 5, f, ez - 5, Math.max(ex, cx) + 5, f + 0.06, ez + 5, 'carpet', { nocol: true, skip: NY });
      }
    }
    for (const F of furniturePlan) if (F.l === l) furnish(F);
  }
  // Keep exterior: a foundation into the rock, a corbelled ledge and battlements, round corner turrets with slate
  // cones, a cluster of turrets on the roof, and the great central tower with its dark spire.
  box(KX0, KY - 40, KZ0, KX1, KY - 6, KZ1, 'cream', { skip: NY | PY });
  box(HX - 18, KY - 6, KZ1 - EXT, HX + 18, KY, KZ1, 'cream', { skip: NY }); // threshold under the front door
  for (let k = 1; k < KW; k++) { box(gx(k) - 3, KY - 40, KZ1, gx(k) + 3, KROOF, KZ1 + 3, 'cream', { skip: NY | NZ }); box(gx(k) - 3, KY - 40, KZ0 - 3, gx(k) + 3, KROOF, KZ0, 'cream', { skip: NY | PZ }); }
  for (let k = 1; k < KD; k++) { box(KX0 - 3, KY - 40, gz(k) - 3, KX0, KROOF, gz(k) + 3, 'cream', { skip: NY | PX }); box(KX1, KY - 40, gz(k) - 3, KX1 + 3, KROOF, gz(k) + 3, 'cream', { skip: NY | NX }); }
  for (let l = 1; l < LEVELS; l++) {
    const y = KY + l * LH - 3;
    box(KX0 - 1.5, y, KZ1, KX1 + 1.5, y + 2, KZ1 + 1.5, 'cream', { nocol: true, skip: NZ }); box(KX0 - 1.5, y, KZ0 - 1.5, KX1 + 1.5, y + 2, KZ0, 'cream', { nocol: true, skip: PZ });
    box(KX0 - 1.5, y, KZ0, KX0, y + 2, KZ1, 'cream', { nocol: true, skip: PX | PZ | NZ }); box(KX1, y, KZ0, KX1 + 1.5, y + 2, KZ1, 'cream', { nocol: true, skip: NX | PZ | NZ });
  }
  for (const [x0, z0, x1, z1] of [[KX0 - 2, KZ1 - EXT, KX1 + 2, KZ1 + 2], [KX0 - 2, KZ0 - 2, KX1 + 2, KZ0 + EXT], [KX0 - 2, KZ0 + EXT, KX0 + EXT, KZ1 - EXT], [KX1 - EXT, KZ0 + EXT, KX1 + 2, KZ1 - EXT]]) {
    box(x0, KROOF - 3, z0, x1, KROOF, z1, 'cream', { skip: PY }); // corbelled ledge
    box(x0, KROOF, z0, x1, KROOF + 6, z1, 'cream', { skip: NY });
    const alongX = x1 - x0 > z1 - z0;
    for (let a = (alongX ? x0 : z0) + 2; a + 5 <= (alongX ? x1 : z1) - 2; a += 10)
      alongX ? box(a, KROOF + 6, z0, a + 5, KROOF + 12, z1, 'cream', { skip: NY }) : box(x0, KROOF + 6, a, x1, KROOF + 12, a + 5, 'cream', { skip: NY });
  }
  for (const [u, w] of [[KX0 - HX - 6, KZ0 - HZ - 6], [KX1 - HX + 6, KZ0 - HZ - 6], [KX0 - HX - 6, KZ1 - HZ + 6], [KX1 - HX + 6, KZ1 - HZ + 6]]) tower(u, w, KY - 40, KROOF + 44, 15, 'cream', 'roofSlate', 62);
  tower(-90, -20, KROOF, KROOF + 70, 10, 'cream', 'roofSlate', 40);
  tower(95, -10, KROOF, KROOF + 56, 9, 'cream', 'roofSlate', 34);
  tower(110, -125, KROOF, KROOF + 88, 11, 'cream', 'roofSlate', 46);
  tower(-100, 28, KROOF, KROOF + 40, 9, 'cream', 'roofBrown', 30);
  // The great central tower, hollow: a door from the roof, a spiral staircase round a central column, and a
  // lookout with eight open arches under the dark spire.
  const TX = HX + 25, TZ = HZ - 70, DOOR_A = -Math.PI / 2, SP = { a0: DOOR_A + 0.4, da: 0.2, n: 240, r0: 4.2, r1: 16.8 }, LOOK = KROOF + SP.n;
  {
    const x = TX, z = TZ, tw = 3;
    hollow(x, z, KROOF, KROOF + 18, 30, tw, 'cream', [DOOR_A - 0.2, DOOR_A + 0.2]);
    rbox(x + Math.sin(DOOR_A) * 30.4, KROOF + 19, z + Math.cos(DOOR_A) * 30.4, 14, 2, 1.4, DOOR_A, 'cream'); // lintel
    hollow(x, z, KROOF + 18, KROOF + 110, 30, tw, 'cream');
    cyl(x, z, KROOF + 106, KROOF + 112, 32, 'cream', { col: false }); // (a band; its caps are hidden in the walls)
    annulus(x, z, KROOF + 110, 22, 27, false, 'cream');
    hollow(x, z, KROOF + 110, KROOF + 196, 25, tw, 'cream');
    annulus(x, z, KROOF + 112.01, 25, 32, true, 'cream');
    cyl(x, z, KROOF + 192, KROOF + 198, 27, 'cream', { col: false });
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; rbox(x + Math.sin(a) * 26, KROOF + 201, z + Math.cos(a) * 26, 3.4, 6, 1.6, a, 'cream'); }
    annulus(x, z, KROOF + 196, 17, 22, false, 'cream');
    hollow(x, z, KROOF + 196, LOOK, 20, tw, 'cream');
    annulus(x, z, KROOF + 198.01, 20, 27, true, 'cream');
    for (let yy = KROOF + 26; yy < LOOK - 8; yy += 28) for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + yy * 0.1, rr = yy < KROOF + 110 ? 30 : yy < KROOF + 196 ? 25 : 20;
      rbox(x + Math.sin(a) * (rr + 0.05), yy, z + Math.cos(a) * (rr + 0.05), 3, 9, 0.6, a, 'window');
    }
    cyl(x, z, KROOF, LOOK + 24, 4, 'cream'); // the central column
    for (let k = 1; k <= SP.n; k++) { // the spiral: one block up per step
      const a = SP.a0 + k * SP.da, rm = (SP.r0 + SP.r1) / 2;
      rbox(x + Math.sin(a) * rm, KROOF + k - 0.5, z + Math.cos(a) * rm, 3.8, 1, SP.r1 - SP.r0, a, 'stonetiles');
      segCol(x + Math.sin(a) * SP.r0, z + Math.cos(a) * SP.r0, x + Math.sin(a) * SP.r1, z + Math.cos(a) * SP.r1, 1.8, KROOF + k - 1, KROOF + k);
    }
    // The lookout floor (open above the last turn of the stairs), a low parapet, and eight arches.
    const aEnd = SP.a0 + SP.n * SP.da, gapA = aEnd - 2.6, fl = new THREE.CylinderGeometry(17, 17, 1, 48, 1, false, aEnd + 0.12, Math.PI * 2 - 2.72);
    fl.translate(x, LOOK - 0.5, z); { const P = fl.attributes.position, uv = fl.attributes.uv; for (let v = 0; v < P.count; v++) uv.setXY(v, P.getX(v) / S('stonetiles'), P.getZ(v) / S('stonetiles')); } addGeo('stonetiles', fl);
    for (let cx = Math.floor(x - 18); cx <= Math.ceil(x + 18); cx++) for (let cz = Math.floor(z - 18); cz <= Math.ceil(z + 18); cz++) {
      const dx = cx + 0.5 - x, dz = cz + 0.5 - z, d = Math.hypot(dx, dz);
      let da = Math.atan2(dx, dz) - gapA; da = ((da % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (d >= 3.5 && d <= 17.5 && da > 2.6 + 0.12) colAdd(cx, cz, LOOK - 1, LOOK);
    }
    hollow(x, z, LOOK - 1, LOOK + 1.4, 20, tw, 'cream');
    for (let cx = Math.floor(x - 21); cx <= Math.ceil(x + 21); cx++) for (let cz = Math.floor(z - 21); cz <= Math.ceil(z + 21); cz++) {
      const d = Math.hypot(cx + 0.5 - x, cz + 0.5 - z); if (d >= 16.7 && d <= 20.3) colAdd(cx, cz, LOOK + 1, LOOK + 2);
    }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; rbox(x + Math.sin(a) * 18.5, LOOK + 12, z + Math.cos(a) * 18.5, 4.5, 24, 3, a, 'cream'); disc(x + Math.sin(a) * 18.5, z + Math.cos(a) * 18.5, 1.8, LOOK, LOOK + 24); }
    cyl(x, z, LOOK + 24, LOOK + 28, 22.5, 'cream');
    cone(x, z, LOOK + 28, 6, 27, 'roofDark');
    cone(x, z, LOOK + 28, 150, 23.5, 'roofDark');
    cyl(x, z, LOOK + 174, LOOK + 194, 0.8, 'roofDark', { col: false, segs: 6 });
    flag(x, LOOK + 193.5, z, 2.2);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; tower(x - HX + Math.sin(a) * 24, z - HZ + Math.cos(a) * 24, LOOK + 22, LOOK + 34, 2.2, 'cream', 'roofDark', 12); } // pinnacles
  }

  // Towers set into the keep's faces (only as deep as its outer wall), so it reads as a cluster of towers.
  {
    const fw = KZ1 - HZ, bw = KZ0 - HZ, wu = KX0 - HX, eu = KX1 - HX, att = (u, w, r, top, roof, rh) => tower(u, w, KY - 40, top, r, 'cream', roof, rh);
    att(-95, fw + 8, 14, KROOF + 22, 'roofBrown', 50); att(95, fw + 8, 14, KROOF + 48, 'roofSlate', 54);
    att(-60, bw - 8, 14, KROOF + 30, 'roofSlate', 50); att(70, bw - 10, 16, KROOF + 76, 'roofBrown', 60);
    att(wu - 8, -60, 14, KROOF + 12, 'roofBrown', 46); att(eu + 8, -40, 14, KROOF + 38, 'roofSlate', 50);
  }

  // ================================================================================================
  // The rest of the castle (relative coordinates): terraces stacked up the crag, crowded with towers, halls and
  // houses, with walls wrapping round them, like the painting.
  // ================================================================================================
  // Top terrace: a curtain wall with round towers, the gatehouse where the road comes in, halls in the courtyard.
  {
    const y0 = TOP - 25, y1 = TOP + 30, X = 188, ZB = -203, ZF = 213;
    curtain(-X, ZF, -26, ZF, y0, y1, 'cream'); curtain(26, ZF, X, ZF, y0, y1, 'cream');
    curtain(-X, ZB, X, ZB, y0, y1, 'cream'); curtain(-X, ZB, -X, ZF, y0, y1, 'cream'); curtain(X, ZB, X, ZF, y0, y1, 'cream');
    for (const [u, w] of [[-X, ZF], [X, ZF], [-X, ZB], [X, ZB]]) tower(u, w, y0 - 30, TOP + 66, 16, 'cream', 'roofBrown', 56);
    for (const w of [-90, 80]) { tower(-X, w, y0 - 20, TOP + 54, 12, 'cream', 'roofBrown', 42); tower(X, w, y0 - 20, TOP + 54, 12, 'cream', 'roofSlate', 42); }
    tower(-40, ZF + 4, y0, TOP + 78, 13, 'cream', 'roofSlate', 46); tower(40, ZF + 4, y0, TOP + 78, 13, 'cream', 'roofSlate', 46);
    box(HX - 27, TOP + 40, HZ + ZF - 3, HX + 27, TOP + 54, HZ + ZF + 3, 'cream');
    for (let a = -26; a < 26; a += 9) box(HX + a, TOP + 54, HZ + ZF - 3, HX + a + 5, TOP + 59, HZ + ZF + 3, 'cream', { skip: NY });
    hall(-176, 70, -112, 130, TOP - 4, TOP + 40, 'cream', 'timber', TOP + 20, 'roofBrown', 26);
    hall(112, 70, 176, 130, TOP - 4, TOP + 44, 'cream', 'cream', TOP + 22, 'roofBrown', 28);
    tower(-150, 175, TOP - 10, TOP + 70, 10, 'cream', 'roofBrown', 38);
    tower(150, 170, TOP - 10, TOP + 84, 10, 'cream', 'roofSlate', 40);
  }
  // West middle terrace: the timber hall, the tower with the tall brown spire, and the gothic arch ruin.
  {
    const y = 160;
    hall(-400, 10, -280, 70, y - 14, y + 44, 'cream', 'timber', y + 22, 'roofBrown', 30);
    tower(-280, -80, y - 60, y + 150, 19, 'cream', 'roofBrown', 92);
    tower(-380, -100, y - 40, y + 70, 12, 'cream', 'roofBrown', 40);
    wallRun('z', HX - 426, HX - 418, HZ - 120, HZ - 20, y - 30, y + 96, [opening(HZ - 70, 52, y + 4, y + 80, 34, true)], 'cream', false);
    tower(-422, -128, y - 40, y + 104, 8, 'cream', 'roofDark', 30);
    tower(-410, 85, y - 50, y + 52, 11, 'sand', 'roofBrown', 32); tower(-250, 85, y - 50, y + 46, 11, 'sand', 'roofBrown', 30);
    curtain(-410, 85, -250, 85, y - 40, y + 26, 'sand');
  }
  // East middle terrace: sandstone walls with round towers and copper cones around a square keep.
  {
    const y = 160, y0 = y - 30, y1 = y + 34;
    curtain(262, 55, 410, 55, y0, y1, 'sand'); curtain(262, -130, 410, -130, y0, y1, 'sand');
    curtain(262, -130, 262, 55, y0, y1, 'sand'); curtain(410, -130, 410, 55, y0, y1, 'sand');
    tower(262, 55, y0 - 20, y + 76, 16, 'sand', 'roofBrown', 50); tower(410, 55, y0 - 30, y + 60, 16, 'sand', 'roofBrown', 48);
    tower(262, -130, y0, y + 92, 15, 'sand', 'roofBrown', 52); tower(410, -130, y0, y + 70, 15, 'sand', 'roofBrown', 46);
    tower(336, 55, y0 - 10, y + 54, 11, 'cream', 'roofBrown', 34);
    box(HX + 300, y - 10, HZ - 90, HX + 360, y + 96, HZ - 30, 'sand', { skip: NY });
    for (let a = 300; a < 360; a += 10) for (const [w0, w1] of [[-90, -86], [-34, -30]]) box(HX + a, y + 96, HZ + w0, HX + a + 5, y + 102, HZ + w1, 'sand', { skip: NY });
    for (let a = -86; a < -34; a += 10) for (const [u0, u1] of [[300, 304], [356, 360]]) box(HX + u0, y + 96, HZ + a, HX + u1, y + 102, HZ + a + 5, 'sand', { skip: NY });
    hall(368, -10, 402, 40, y - 10, y + 30, 'sand', 'cream', y + 12, 'roofBrown', 20);
  }
  // East low terrace: towers stepping down the hillside, joined to the walls above.
  {
    const y = 90;
    tower(410, 235, y - 40, y + 82, 16, 'sand', 'roofBrown', 52);
    tower(500, 160, y - 40, y + 60, 12, 'sand', 'roofBrown', 40);
    tower(470, 262, y - 30, y + 40, 9, 'cream', 'roofBrown', 28);
    curtain(410, 235, 500, 160, y - 20, y + 34, 'sand');
    curtain(410, 55, 410, 150, y - 10, y + 70, 'sand');
    hall(432, 176, 486, 214, y - 6, y + 26, 'sand', 'cream', y + 10, 'roofBrown', 18);
  }
  // Front low terrace: cream walls and towers, some crenellated, some with cones, round a hall.
  {
    const y = 85, y0 = y - 25, y1 = y + 32;
    curtain(-15, 515, 135, 515, y0, y1, 'cream'); curtain(-15, 425, 135, 425, y0, y1, 'cream');
    curtain(-15, 425, -15, 515, y0, y1, 'cream'); curtain(135, 425, 135, 515, y0, y1, 'cream');
    tower(-15, 515, y0 - 15, y + 64, 15, 'sand', null);
    tower(135, 515, y0 - 15, y + 56, 14, 'cream', 'roofBrown', 44);
    tower(-15, 425, y0, y + 78, 14, 'cream', null);
    tower(135, 425, y0, y + 86, 14, 'cream', 'roofSlate', 48);
    hall(20, 450, 100, 490, y - 6, y + 34, 'cream', 'cream', y + 14, 'roofBrown', 22);
  }
  // The crowded pads up the crag: a tower, a house, or a house with a turret on each.
  for (const P of pads) {
    const { x: u, z: w, hx, hz, y } = P, wall = R() < 0.65 ? 'cream' : 'sand', roof = R() < 0.72 ? 'roofBrown' : 'roofSlate';
    if (P.kind === 'tower') { const r = Math.min(hx, hz) * 0.8; tower(u, w, y - 40, y + 50 + R() * 90, r, wall, R() < 0.85 ? roof : null, r * 2.6 + R() * 20); }
    else {
      const top = y + 30 + Math.round(R() * 26);
      hall(u - hx + 2, w - hz + 2, u + hx - 2, w + hz - 2, y - 36, top, wall, R() < 0.5 ? 'timber' : 'cream', y + 16 + Math.round(R() * 10), roof, 16 + R() * 10);
      if (P.kind === 'both') tower(u + hx - 7, w + hz - 7, y - 36, top + 26 + R() * 34, 8 + R() * 3, 'cream', R() < 0.5 ? 'roofSlate' : 'roofBrown', 28);
    }
  }
  // Along the road: little round gate towers at the hairpins, and lanterns on posts.
  for (const [u, w, y] of hairpins) {
    const r = Math.hypot(u, w), a = Math.atan2(u, w), out = a > 0 ? 0.07 : -0.07;
    tower(Math.sin(a + out) * (r + 4), Math.cos(a + out) * (r + 4), y - 8, y + 34, 7, 'sand', 'roofBrown', 22);
  }
  {
    let acc = 0, side = 1;
    for (let i = 1; i < road.length; i++) {
      const a = road[i - 1], b = road[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      acc += seg;
      if (acc < 44) continue;
      acc = 0; side = -side;
      const dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg, x = HX + b[0] - dz * side * (RWH + 2), z = HZ + b[1] + dx * side * (RWH + 2), y = b[2];
      box(Math.floor(x), Math.floor(y) - 1, Math.floor(z), Math.floor(x) + 1, Math.floor(y) + 9, Math.floor(z) + 1, 'iron');
      box(x - 1, y + 9, z - 1, x + 2, y + 11.5, z + 2, 'glow', { nocol: true });
      box(x - 1.3, y + 11.5, z - 1.3, x + 2.3, y + 12.2, z + 2.3, 'iron', { nocol: true });
    }
  }

  // The gatehouse where the road starts to climb: two towers and an arch over the road.
  {
    const i = road.findIndex(([u, w]) => Math.hypot(u, w) < 840), [u, w, y] = road[i], [u2, w2] = road[i + 1];
    const l = Math.hypot(u2 - u, w2 - w), nx = -(w2 - w) / l, nz = (u2 - u) / l, yaw = Math.atan2(-nz, nx);
    for (const sd of [-1, 1]) tower(u + nx * 17 * sd, w + nz * 17 * sd, y - 12, y + 54, 9, 'sand', 'roofBrown', 30);
    rbox(HX + u, y + 39, HZ + w, 26, 10, 7, yaw, 'sand');
    for (let k = -3; k <= 3; k++) rbox(HX + u + nx * k * 4.2, y + 46.5, HZ + w + nz * k * 4.2, 2.4, 5, 7, yaw, 'sand');
    for (const sd of [-1, 1]) rbox(HX + u + nx * 10 * sd, y + 30, HZ + w + nz * 10 * sd, 4, 8, 7, yaw, 'sand'); // arch shoulders
  }
  const clearOfRoad = (u1, w1, u2, w2, m) => { for (let t = 0; t <= 1; t += 0.05) if (roadNear(u1 + (u2 - u1) * t, w1 + (w2 - w1) * t).d < m) return false; return true; };
  // Watchtowers, walls and little houses scattered down the slopes.
  {
    const towers = [];
    for (let t = 0; t < 4000 && towers.length < (lowDetail ? 4 : 7); t++) {
      const a = R() * Math.PI * 2, r = 560 + R() * 300, u = Math.sin(a) * r, w = Math.cos(a) * r, h = groundAt(HX + u, HZ + w);
      if (h < 12 || roadNear(u, w).d < 45 || PLATEAUS.some(P => sdRect(u, w, P) < 30) || towers.some(q => Math.hypot(q[0] - u, q[1] - w) < 120)) continue;
      towers.push([u, w, h, a]);
      tower(u, w, h - 10, h + 28 + R() * 36, 6 + R() * 4, R() < 0.5 ? 'sand' : 'cream', R() < 0.75 ? 'roofBrown' : 'roofSlate', 24 + R() * 14);
    }
    towers.sort((p, q) => p[3] - q[3]);
    for (let k = 0; k < towers.length; k++) {
      const [u1, w1, h1] = towers[k], [u2, w2, h2] = towers[(k + 1) % towers.length];
      if (Math.hypot(u2 - u1, w2 - w1) > 175 || Math.abs(h2 - h1) > 45 || !clearOfRoad(u1, w1, u2, w2, RWH + 14)) continue;
      curtain(u1, w1, u2, w2, Math.min(h1, h2) - 8, Math.max(h1, h2) + 12, 'sand', 5);
    }
    let houses = 0;
    for (let t = 0; t < 4000 && houses < 0; t++) {
      const a = R() * Math.PI * 2, r = 320 + R() * 700, u = Math.round(Math.sin(a) * r), w = Math.round(Math.cos(a) * r);
      const corners = [[0, 0], [22, 0], [0, 14], [22, 14]].map(([du, dw]) => groundAt(HX + u + du, HZ + w + dw));
      const lo = Math.min(...corners), hi = Math.max(...corners);
      if (lo < 6 || hi - lo > 9 || !clearOfRoad(u - 8, w - 8, u + 30, w + 22, RWH + 10) || PLATEAUS.some(P => sdRect(u + 11, w + 7, P) < 25)) continue;
      houses++;
      hall(u, w, u + 22, w + 14, Math.floor(lo) - 3, Math.ceil(hi) + 13, 'cream', R() < 0.5 ? 'timber' : 'cream', Math.ceil(hi) + 5, R() < 0.8 ? 'roofBrown' : 'roofSlate', 9);
    }
  }
  // Rock outcrops on the slopes and below the terraces.
  {
    let n = 0;
    for (let t = 0; t < 6000 && n < (lowDetail ? 60 : 150); t++) {
      const u = (R() * 2 - 1) * 1100, w = (R() * 2 - 1) * 1100, r = Math.hypot(u, w);
      if (r < 260 || r > 1050) continue;
      const x = HX + u, z = HZ + w, h = groundAt(x, z), rimmed = PLATEAUS.some(P => { const d = sdRect(u, w, P); return d > 10 && d < 60; });
      if (h < 4 || roadNear(u, w).d < RWH + 22 || PLATEAUS.some(P => sdRect(u, w, P) < 10) || (!rimmed && R() < 0.5)) continue;
      n++;
      const sz = 5 + R() * R() * 24, g = new THREE.IcosahedronGeometry(1, 1), P = g.attributes.position;
      for (let v = 0; v < P.count; v++) { const k = 0.75 + 0.5 * vnoise(P.getX(v) * 2 + t, P.getZ(v) * 2 + n, 5); P.setXYZ(v, P.getX(v) * k, P.getY(v) * k * 0.7, P.getZ(v) * k); }
      g.computeVertexNormals(); g.scale(sz, sz, sz); g.rotateY(R() * 6.3); g.translate(x, h + sz * 0.15, z);
      scaleUV(g, sz * 4 / S('rock'), sz * 2 / S('rock'));
      addGeo('rock', g);
      disc(x, z, sz * 0.75, h - 2, h + sz * 0.7);
    }
  }
  // A waterfall cascading from the east middle terrace down to a pool on the terrace below.
  const fall = [];
  {
    let u = 360, w = 72;
    for (let k = 0; k < 60; k++) {
      fall.push([u, w, groundAt(HX + u, HZ + w)]);
      if (sdRect(u, w, PLATEAUS[3]) < -8) break;
      u += 1.7; w += 5.7;
    }
  }

  // ================================================================================================
  // Meshes
  // ================================================================================================
  const loader = new THREE.TextureLoader();
  const texCache = new Map();
  const tex = (file, repeat = true) => {
    if (texCache.has(file)) return texCache.get(file);
    const t = loader.load(texUrl(file.includes('/') ? file : `photo/${file}.jpg`));
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (file.startsWith('minetest/')) { t.magFilter = THREE.NearestFilter; }
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy;
    texCache.set(file, t);
    return t;
  };
  function material(k) {
    const baked = k.startsWith('B:'), key = k.slice(2);
    if (key.startsWith('glow')) return new THREE.MeshBasicMaterial({ color: COLOR[key] });
    const opts = { vertexColors: true };
    if (TEX[key]) { const t = TEX[key][2]; opts.map = tex(TEX[key][0]); opts.color = Array.isArray(t) ? new THREE.Color().setRGB(...t) : new THREE.Color(t); } else opts.color = new THREE.Color(COLOR[key]);
    const m = baked ? new THREE.MeshBasicMaterial(opts) : new THREE.MeshLambertMaterial(opts);
    if (key === 'carpet') { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; }
    return m;
  }
  const group = new THREE.Group();
  group.name = 'castle';
  let windowMat = null;
  const baked = [], glows = [];
  for (const [k, b] of buckets) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    g.setIndex(b.idx);
    const pk = k.startsWith('B:') ? k : 'L:' + k.slice(2);
    if (!parts.has(pk)) parts.set(pk, []);
    parts.get(pk).push(g);
  }
  const merged = new Map();
  for (const [k, list] of parts) {
    const key = k.includes(':') ? k : 'L:' + k;
    if (!merged.has(key)) merged.set(key, []);
    merged.get(key).push(...list);
  }
  for (const [k, list] of merged) {
    const g = mergeGeometries(list);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material(k));
    if (k.endsWith('carpet')) mesh.renderOrder = 1;
    if (k.startsWith('L:') && !k.includes('glow')) { mesh.castShadow = !k.endsWith('window'); mesh.receiveShadow = true; }
    if (k === 'L:window') windowMat = mesh.material;
    if (k.startsWith('B:')) baked.push({ m: mesh.material, c: mesh.material.color.clone() });
    if (k.includes('glow')) glows.push({ m: mesh.material, c: mesh.material.color.clone() });
    group.add(mesh);
  }
  // Flags, waving.
  const time = { value: 0 };
  if (flags.length) {
    const fm = new THREE.MeshLambertMaterial({ color: COLOR.flag, side: THREE.DoubleSide });
    fm.onBeforeCompile = sh => {
      sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float fx;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += sin(fx * 5.0 - uTime * 5.0 + position.x * 0.03 + position.z * 0.05) * fx * 1.4;\ntransformed.y -= fx * fx * 0.8;');
    };
    const fg = mergeGeometries(flags); fg.computeBoundingSphere();
    const fmesh = new THREE.Mesh(fg, fm); fmesh.castShadow = true; group.add(fmesh);
  }
  // The waterfall: water flowing down a strip over the rocks, into a pool.
  let waterTex = null;
  if (fall.length > 2) {
    const wm = material('L:water'); waterTex = wm.map = loader.load(texUrl('blocks/water.png')); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.colorSpace = THREE.SRGBColorSpace;
    Object.assign(wm, { transparent: true, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
    const pos = [], uv = [], idx = []; let along = 0;
    fall.forEach(([u, w, h], k) => {
      if (k) along += Math.hypot(u - fall[k - 1][0], w - fall[k - 1][1], h - fall[k - 1][2]);
      for (const sd of [-1, 1]) { const x = HX + u + sd * 7, z = HZ + w; pos.push(x, groundAt(x, z) + 0.7, z); uv.push((sd + 1) * 0.6, along / 7); }
      if (k) { const o = k * 2; idx.push(o - 2, o - 1, o, o - 1, o + 1, o); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
    g.setIndex(idx); g.computeVertexNormals();
    const nor = g.attributes.normal; for (let i = 0; i < nor.count; i++) if (nor.getY(i) < 0) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
    wm.side = THREE.DoubleSide;
    group.add(new THREE.Mesh(g, wm));
    const [pu, pw, ph] = fall[fall.length - 1], pool = new THREE.CylinderGeometry(16, 16, 0.4, 32);
    scaleUV(pool, 2 * Math.PI * 16 / S('water'), 1); pool.translate(HX + pu, ph + 0.5, HZ + pw + 8);
    group.add(new THREE.Mesh(pool, wm));
  }
  // Sunbeams slanting in through the keep's south and west windows (daytime only).
  let beams = null;
  if (!lowDetail) {
    const pos = [], col = [], dir = SUN_DIR.clone().multiplyScalar(-70);
    const beam = (c) => { // c: 4 window corners (inner face)
      const e = c.map(p => [p[0] + dir.x, p[1] + dir.y, p[2] + dir.z]);
      for (let k = 0; k < 4; k++) {
        const a = c[k], b = c[(k + 1) % 4], a2 = e[k], b2 = e[(k + 1) % 4];
        pos.push(...a, ...b, ...b2, ...a, ...b2, ...a2);
        const w = [0.075, 0.06, 0.04], z0 = [0, 0, 0];
        col.push(...w, ...w, ...z0, ...w, ...z0, ...z0);
      }
    };
    for (let l = 0; l < LEVELS; l++) {
      const f = KY + l * LH;
      for (let k = 0; k < KW; k++) for (const a of [32, 64]) {
        if (l === 0 && k === 1) continue;
        const x0 = gx(k) + a - 4, x1 = gx(k) + a + 4, z = KZ1 - EXT;
        beam([[x0, f + 12, z], [x1, f + 12, z], [x1, f + 34, z], [x0, f + 34, z]]);
      }
      for (let k = 0; k < KD; k++) for (const a of [32, 64]) {
        const z0 = gz(k) + a - 4, z1 = gz(k) + a + 4, x = KX0 + EXT;
        beam([[x, f + 12, z0], [x, f + 12, z1], [x, f + 34, z1], [x, f + 34, z0]]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    beams = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beams.renderOrder = 2;
    group.add(beams);
  }

  // Terrain meshes (hill grid, mountain ring) with one material that paints grass on the flats and rock on the
  // steeps (and on the high peaks), and hides any terrain inside the keep.
  const rockT = tex('rock_face_03');
  const terrainShader = mtn => sh => {
    sh.uniforms.rockMap = { value: rockT };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform sampler2D rockMap;\nconst float uMtn = ${mtn}.0;\nvarying vec3 vWP;\nvarying vec3 vWN;`)
      .replace('#include <map_fragment>', `
        if (vWP.x > ${(KX0 + 1).toFixed(1)} && vWP.x < ${(KX1 - 1).toFixed(1)} && vWP.z > ${(KZ0 + 1).toFixed(1)} && vWP.z < ${(KZ1 - 1).toFixed(1)} && vWP.y > ${KY - 20}.0) discard;
        vec3 wn = normalize(vWN);
        vec3 bw = pow(abs(wn), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 rk = texture2D(rockMap, vWP.zy / 30.0).rgb * bw.x + texture2D(rockMap, vWP.xz / 30.0).rgb * bw.y + texture2D(rockMap, vWP.xy / 30.0).rgb * bw.z;
        rk = mix(rk, vec3(dot(rk, vec3(0.33))), 0.45) * vec3(1.02, 1.0, 0.97);
        vec3 gr = texture2D(map, vWP.xz / 2.0).rgb;
        vec3 forest = gr * vec3(0.62, 0.8, 0.58);
        vec3 g = mix(gr, forest, smoothstep(4.0, 40.0, vWP.y));
        float steep = max(smoothstep(0.93, 0.8, wn.y), smoothstep(380.0, 700.0, vWP.y));
        // the mountains: forested lower slopes, bare grey rock and crags higher up
        float mrock = clamp(max(smoothstep(0.62, 0.38, wn.y), smoothstep(300.0, 700.0, vWP.y)) + (rk.r - 0.45) * 0.7, 0.0, 1.0);
        steep = mix(steep, mrock, uMtn);
        g = mix(g, gr * vec3(0.4, 0.58, 0.38), uMtn);
        vec3 grey = mix(rk, vec3(dot(rk, vec3(0.33))), 0.7) * 1.3;
        diffuseColor.rgb *= mix(g, mix(rk, grey, uMtn), steep);`);
  };
  const terrainMat = new THREE.MeshLambertMaterial({ map: tex('ground_leafy_grass') });
  terrainMat.onBeforeCompile = terrainShader(0); terrainMat.customProgramCacheKey = () => 'hill-terrain';
  const mountainMat = new THREE.MeshLambertMaterial({ map: tex('ground_leafy_grass') });
  mountainMat.onBeforeCompile = terrainShader(1); mountainMat.customProgramCacheKey = () => 'mountain-terrain';
  // The hill, in tiles (so what's off-screen isn't drawn); normals come from the whole grid so tiles meet smoothly.
  {
    const T = 45, nrm = (ix, iz) => {
      const h = (a, b) => hillH[Math.max(0, Math.min(GN - 1, b)) * GN + Math.max(0, Math.min(GN - 1, a))];
      const v = new THREE.Vector3(h(ix - 1, iz) - h(ix + 1, iz), 2 * GS, h(ix, iz - 1) - h(ix, iz + 1)); return v.normalize();
    };
    for (let tz = 0; tz < GN - 1; tz += T) for (let tx = 0; tx < GN - 1; tx += T) {
      const nx = Math.min(T, GN - 1 - tx) + 1, nz = Math.min(T, GN - 1 - tz) + 1, pos = new Float32Array(nx * nz * 3), nor = new Float32Array(nx * nz * 3), idx = [];
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const ix = tx + i, iz = tz + j, o = (j * nx + i) * 3, n = nrm(ix, iz);
        pos[o] = HX - REGION + ix * GS; pos[o + 1] = hillH[iz * GN + ix]; pos[o + 2] = HZ - REGION + iz * GS;
        nor[o] = n.x; nor[o + 1] = n.y; nor[o + 2] = n.z;
      }
      for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i; idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(idx); g.computeBoundingSphere();
      const hill = new THREE.Mesh(g, terrainMat); hill.receiveShadow = true; hill.castShadow = true;
      group.add(hill);
    }
  }
  // The mountains, in 24 sectors (fewer points around the ring on phones).
  {
    const step = lowDetail ? 2 : 1, per = MA / 24;
    for (let s0 = 0; s0 < MA; s0 += per) {
      const cols = [];
      for (let ai = s0; ai <= s0 + per; ai += step) cols.push(ai);
      const pos = new Float32Array(MRN * cols.length * 3), idx = [];
      for (let ri = 0; ri < MRN; ri++) cols.forEach((ai, c) => {
        const a = ai / MA * Math.PI * 2, rr = MR0 + ri * MRS, o = (ri * cols.length + c) * 3;
        pos[o] = HX + Math.sin(a) * rr; pos[o + 1] = mtnH[ri * MA + (ai % MA)]; pos[o + 2] = HZ + Math.cos(a) * rr;
      });
      const nc = cols.length;
      for (let ri = 0; ri < MRN - 1; ri++) for (let c = 0; c < nc - 1; c++) { const a = ri * nc + c, b = a + nc; idx.push(a, b, a + 1, a + 1, b, b + 1); } // (facing up)
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
      group.add(new THREE.Mesh(g, mountainMat));
    }
  }
  // The road surface: cobbles laid over the terrain, with round landings at the hairpins.
  {
    const roadMat = material('L:road');
    roadMat.polygonOffset = true; roadMat.polygonOffsetFactor = -2; roadMat.polygonOffsetUnits = -6;
    const pos = [], uv = [], idx = [];
    let along = 0;
    for (let i = 0; i < road.length; i++) {
      const a = road[Math.max(0, i - 1)], b = road[Math.min(road.length - 1, i + 1)], p = road[i];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      if (i > 0) along += Math.hypot(p[0] - road[i - 1][0], p[1] - road[i - 1][1]);
      for (const s of [-1, 1]) {
        const x = HX + p[0] + nx * RWH * s, z = HZ + p[1] + nz * RWH * s;
        pos.push(x, groundAt(x, z) + 0.12, z); uv.push((s + 1) * RWH / S('road'), along / S('road'));
      }
      if (i > 0) { const o = i * 2; idx.push(o - 2, o, o - 1, o - 1, o, o + 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
    for (let t = 0; t < idx.length; t += 3) { // wind every triangle to face up
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map(k => k * 3);
      const ux = pos[b] - pos[a], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vz = pos[c + 2] - pos[a + 2];
      if (uz * vx - ux * vz < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
    }
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const roadMesh = new THREE.Mesh(g, roadMat); roadMesh.receiveShadow = true;
    group.add(roadMesh);
    for (const [u, w, y] of hairpins) {
      const d = new THREE.CylinderGeometry(RWH + 4, RWH + 4, 0.2, 28); scaleUV(d, 2 * Math.PI * (RWH + 4) / S('road'), 1);
      d.translate(HX + u, y + 0.1, HZ + w);
      group.add(new THREE.Mesh(d, roadMat));
    }
  }
  // Pine woods on the hillside (not on the road or the terraces).
  {
    const trunk = new THREE.CylinderGeometry(0.7, 1, 7, 6); trunk.translate(0, 3.5, 0);
    const c1 = new THREE.ConeGeometry(6, 15, 8); c1.translate(0, 11, 0);
    const c2 = new THREE.ConeGeometry(4.4, 11, 8); c2.translate(0, 19, 0);
    const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); const col = new THREE.Color(c); for (let i = 0; i < n; i++) col.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const geo = mergeGeometries([paint(trunk, 0x4a3322), paint(c1, 0x2c4a2a), paint(c2, 0x335532)].map(g => { g.deleteAttribute('uv'); return g; }));
    const spots = [];
    for (let t = 0; t < 120000 && spots.length < (lowDetail ? 800 : 2400); t++) {
      const u = (R() * 2 - 1) * 1150, w = (R() * 2 - 1) * 1150, r = Math.hypot(u, w);
      if (r < 200 || r > 1120 || R() > smooth(0.4, 0.62, fbm(u / 150, w / 150, 77))) continue; // in groves
      const x = HX + u, z = HZ + w, h = groundAt(x, z);
      const sl = Math.hypot(groundAt(x + 4, z) - groundAt(x - 4, z), groundAt(x, z + 4) - groundAt(x, z - 4)) / 8;
      if (sl > 0.9 || (h < 2 && R() < 0.8)) continue;
      if (roadNear(u, w).d < RWH + 16) continue;
      if (PLATEAUS.some(P => sdRect(u, w, P) < 12)) continue;
      if (Math.abs(u) < 170 && w > -200 && w < 230) continue;
      spots.push([x, h, z, 0.55 + R() * R() * 2.1, R() * 6.3]);
    }
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
    spots.forEach(([x, y, z, s, a], i) => {
      m4.compose(new THREE.Vector3(x, y - 0.5, z), q.setFromAxisAngle(up, a), sc.set(s, s * (0.85 + R() * 0.4), s));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, tint.setHSL(0.3 + R() * 0.06, 0.25 + R() * 0.2, 0.42 + R() * 0.22));
    });
    mesh.computeBoundingSphere(); mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    // Bushes, thickest round the buildings on the crag.
    const bush = new THREE.IcosahedronGeometry(1, 0); bush.deleteAttribute('uv'); bush.scale(1, 0.7, 1);
    const bspots = [];
    for (let t = 0; t < 60000 && bspots.length < (lowDetail ? 500 : 1600); t++) {
      const u = (R() * 2 - 1) * 900, w = (R() * 2 - 1) * 900, r = Math.hypot(u, w);
      if (r < 180 || r > 880) continue;
      const near = PLATEAUS.reduce((m, P) => Math.min(m, sdRect(u, w, P)), Infinity);
      if (near < 3 || (near > 30 && R() < 0.75)) continue;
      if (roadNear(u, w).d < RWH + 3) continue;
      const x = HX + u, z = HZ + w;
      bspots.push([x, groundAt(x, z), z, 2.2 + R() * 4]);
    }
    const bm = new THREE.InstancedMesh(bush, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), bspots.length);
    bspots.forEach(([x, y, z, sz], i) => {
      m4.compose(new THREE.Vector3(x, y + sz * 0.3, z), q.setFromAxisAngle(up, R() * 6.3), sc.set(sz, sz, sz));
      bm.setMatrixAt(i, m4); bm.setColorAt(i, tint.setHSL(0.26 + R() * 0.08, 0.35 + R() * 0.2, 0.22 + R() * 0.12));
    });
    bm.computeBoundingSphere(); bm.receiveShadow = true;
    group.add(bm);
  }

  // ================================================================================================
  // Collision
  // ================================================================================================
  const B = 32, BX0 = HX - REGION, BZ0 = HZ - REGION, NB = Math.ceil(2 * REGION / B);
  const grid = Array.from({ length: NB * NB }, () => []);
  const boxes = Int32Array.from(cbox.map(v => Math.round(v)));
  for (let o = 0; o < boxes.length; o += 6) {
    const bx0 = Math.max(0, Math.floor((boxes[o] - BX0) / B)), bx1 = Math.min(NB - 1, Math.floor((boxes[o + 3] - 1 - BX0) / B));
    const bz0 = Math.max(0, Math.floor((boxes[o + 2] - BZ0) / B)), bz1 = Math.min(NB - 1, Math.floor((boxes[o + 5] - 1 - BZ0) / B));
    for (let a = bx0; a <= bx1; a++) for (let c = bz0; c <= bz1; c++) grid[a * NB + c].push(o);
  }
  const cells = grid.map(l => Int32Array.from(l));
  function solid(x, y, z) {
    if (y < Math.round(groundAt(x + 0.5, z + 0.5))) return true;
    const col = cols.get(ckey(x, z));
    if (col) for (let k = 0; k < col.length; k += 2) if (y >= col[k] && y < col[k + 1]) return true;
    const a = Math.floor((x - BX0) / B), c = Math.floor((z - BZ0) / B);
    if (a < 0 || c < 0 || a >= NB || c >= NB) return false;
    const list = cells[a * NB + c];
    for (let k = 0; k < list.length; k++) {
      const o = list[k];
      if (x >= boxes[o] && x < boxes[o + 3] && y >= boxes[o + 1] && y < boxes[o + 4] && z >= boxes[o + 2] && z < boxes[o + 5]) return true;
    }
    return false;
  }
  // 1 inside the keep's rooms (for the indoor air), 0 elsewhere.
  const inside = (x, y, z) => (x > KX0 && x < KX1 && z > KZ0 && z < KZ1 && y > KY - 1 && y < KROOF - 2 ? 1 : 0);
  // The flat grass plane is cut away over the hill's terrain mesh.
  function hideGroundInside(material) {
    material.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vCastleXZ;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvCastleXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vCastleXZ;')
        .replace('void main() {', `void main() {
          if (abs(vCastleXZ.x - ${HX.toFixed(1)}) < ${REGION.toFixed(1)} && abs(vCastleXZ.y - ${HZ.toFixed(1)}) < ${REGION.toFixed(1)}) discard;`);
    };
    material.needsUpdate = true;
  }
  const roadStart = { x: HX + road[0][0], z: HZ + road[0][1] };
  // Per frame: flags wave, water flows, torches and candles flicker.
  function update(dt, t) {
    time.value = t;
    if (waterTex) waterTex.offset.y -= dt * 0.9;
    const fl = 1 + 0.05 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1) + 0.03 * Math.sin(t * 23.7);
    for (const g of glows) g.m.color.copy(g.c).multiplyScalar(fl);
    const bl = 1 + 0.025 * Math.sin(t * 7.7) * Math.sin(t * 4.1 + 2);
    for (const b of baked) b.m.color.copy(b.c).multiplyScalar(bl);
  }
  // Day: sunbeams through the windows. Night: the windows glow warm.
  function setTimeOfDay(kind) {
    if (beams) beams.visible = kind === 'day';
    if (windowMat) { windowMat.emissive.set(0xffa040); windowMat.emissiveIntensity = kind === 'night' ? 1.1 : kind === 'sunset' ? 0.35 : 0; }
  }
  // The name of the keep room at a spot, or ''.
  function roomAt(x, y, z) {
    if (!inside(x, y, z)) return '';
    const l = Math.floor((y - KY) / LH), i = Math.floor((x - KX0) / ROOM), j = Math.floor((z - KZ0) / ROOM);
    const r = roomNames.find(q => q.l === l && q.i === i && q.j === j);
    return r ? `Level ${l + 1}: ${r.name}` : '';
  }
  const towerInfo = { x: TX, z: TZ, y0: KROOF, look: LOOK, ...SP };
  return { group, solid, inside, update, setTimeOfDay, roomAt, tower: towerInfo, hideGroundInside, groundAt, stairs, road: road.map(([u, w, y]) => [HX + u, y, HZ + w]), roadStart, keep: { KX0, KX1, KZ0, KZ1, KY, KROOF, door: { x: HX, z: KZ1 } } };
}
