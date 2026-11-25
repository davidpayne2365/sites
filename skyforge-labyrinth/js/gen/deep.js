// The deep world: a network of glowing tunnels under the whole labyrinth, far below the dungeons, caves and mines.
//  - Every region has a hub chamber; winding tunnels (narrow in places, opening into wide chambers in others) join
//    each region's hub to its neighbours', so the whole network is connected.
//  - Some quiet regions (no castle and no dungeon, cave or mine above) hold a giant domed cavern with a castle in it.
//    The tunnels meet at a balcony high on the cavern's south wall, right in front of the castle: you come out of
//    the dark onto a ledge looking down on it, and a stone ramp leads down to its gate.
//  - Stairways go down from some dead ends of the labyrinth, through the back wall, to the network.
//  - Each region has its own glow: blue and white crystals, purple crystals, green and teal mushrooms (with giant
//    glowing mushrooms in the chambers), or all of them.
// Everything comes from the seed and each region's plan, so every chunk draws its own part the same way.
import { RS, P } from './maze.js';
import { GROUND, hash, hashf, siteKey, Vol, H } from './util.js';
import { B } from './decor.js';
import { buildDeepCastle, deepIdentity } from './castle.js';
import { SIDE } from './maze.js';

const G = GROUND;
export const DEEP_FLOOR = 14;
export const DEEP_CEIL = 57;
const FLOOR = DEEP_FLOOR, CEIL = DEEP_CEIL;  // the caverns: floor and highest dome (the ground's crust is above)
const NET_Y = 11, NET_TOP = 13;        // tunnel heights (below every dungeon, cave and mine)
export const CAV_RX = 76, CAV_RZ = 74;

// Does this region hold a cavern castle? Only where nothing else is: no castles above, no underground system.
export function deepInfo(plan) {
  if (plan.deep !== undefined) return plan.deep;
  let d = null;
  // Under floating castles and rock-pillar castles the ground is free all the way down (nothing digs there): a tall
  // dome. Under castles and ruins a lower one, well clear of their crypts.
  const ok = !plan.under && !(plan.rx === 0 && plan.rz === 0) && !plan.clearings.some(c => c.kind === 'spawn');
  const free = ok && (plan.type === 'floating' || plan.type === 'skycastle') && !plan.clearings.some(c => ['castle', 'ruins'].includes(c.kind));
  const below = ok && !free && plan.clearings.some(c => ['castle', 'ruins'].includes(c.kind));
  if ((free && hash(plan.rx, plan.rz, plan.seed, 0xdee9) % 100 < 85) || (below && hash(plan.rx, plan.rz, plan.seed, 0xdeea) % 100 < 70)) {
    const cx = plan.X0 + RS / 2, cz = plan.Z0 + RS / 2, dome = free ? 44 : 40;
    const c = { bx0: cx - 36, bz0: cz - 42, bx1: cx + 35, bz1: cz + 20, kind: 'castle', gate: SIDE.S, seed: hash(plan.rx, plan.rz, plan.seed, 0xca57), openings: [], tall: free };
    // (the balcony: high on the dome's south wall, well back, so the whole castle is in view)
    d = { cx, cz, c, key: siteKey(c), dome, ceil: Math.min(free ? CEIL : 54, FLOOR + dome), balcony: { x: cx, y: free ? 36 : 35, z: cz + 64 } }; // (54: crypts above reach down to 58)
  }
  plan.deep = d;
  return d;
}
export const biomeOf = plan => hash(plan.rx, plan.rz, plan.seed, 0xb10) % 6; // 0 crystal, 1 amethyst, 2 mushrooms, 3 all, 4 rose, 5 emerald
const WATER = ['Blue', 'Purple', 'Teal', 'Cyan', 'Pink', 'Green'].map(c => `Glow Water ${c}`);
const STAIR_GLOW = ['Blue', 'Purple', 'Green', 'White', 'Pink', 'Green'].map(c => `Glow Crystal ${c}`);
// Where the network meets each region: its hub (or, for a cavern region, the gate on that side).
function hubOf(plan) {
  const h = hash(plan.rx, plan.rz, plan.seed, 0x40b);
  return { x: plan.X0 + 52 + (h % 88), y: NET_Y, z: plan.Z0 + 52 + ((h >>> 8) % 88) };
}
function gateOf(plan, side) { // 'n', 'e', 's', 'w' on the ring round a cavern
  const X0 = plan.X0, Z0 = plan.Z0, m = RS / 2;
  return { n: { x: X0 + m, y: NET_Y, z: Z0 + 8 }, s: { x: X0 + m, y: NET_Y, z: Z0 + RS - 9 }, w: { x: X0 + 8, y: NET_Y, z: Z0 + m }, e: { x: X0 + RS - 9, y: NET_Y, z: Z0 + m } }[side];
}
const endFor = (plan, side) => (deepInfo(plan) ? gateOf(plan, side) : hubOf(plan));

// A winding tunnel between two points: a list of [x, y, z, r] (r: how wide), wobbling sideways and up and down.
const paths = new Map();
function tunnel(key, a, b, seed, opts = {}) {
  if (paths.has(key)) return paths.get(key);
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz, b.y - a.y), n = Math.max(2, Math.ceil(len / 1.4));
  const px = -dz / (Math.hypot(dx, dz) || 1), pz = dx / (Math.hypot(dx, dz) || 1);
  const h = k => (hash(seed, k) % 1000) / 1000;
  const amp = opts.amp ?? Math.min(14, len * 0.12), f1 = 1 + h(1) * 1.5, f2 = 2.5 + h(2) * 2, p1 = h(3) * 6.28, p2 = h(4) * 6.28;
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, env = Math.sin(Math.PI * t);
    const off = env * amp * (0.7 * Math.sin(t * 6.28 * f1 + p1) + 0.3 * Math.sin(t * 6.28 * f2 + p2));
    let y = a.y + (b.y - a.y) * t + (opts.flatY ? 0 : env * 1.6 * Math.sin(t * 6.28 * f2 + p1));
    if (opts.lo !== undefined) y = Math.max(opts.lo, Math.min(opts.hi, y));
    // Width: narrow passages and wide open spots.
    const wide = Math.sin(t * 6.28 * (1.2 + h(5)) + p2) * 0.5 + 0.5;
    const r = opts.r ?? (2.3 + wide * 1.6 + (wide > 0.85 ? (wide - 0.85) * 26 : 0));
    out.push([a.x + dx * t + px * off, y, a.z + dz * t + pz * off, r]);
  }
  paths.set(key, out);
  if (paths.size > 600) paths.delete(paths.keys().next().value);
  return out;
}
// The tunnels a region is part of: to its east and south neighbours (and theirs to it come from them).
function regionTunnels(plan, planAt) {
  const out = [];
  const E = planAt(plan.rx + 1, plan.rz), S = planAt(plan.rx, plan.rz + 1);
  out.push(tunnel(`${plan.rx},${plan.rz},e`, endFor(plan, 'e'), endFor(E, 'w'), hash(plan.rx, plan.rz, plan.seed, 0xe1), { lo: 8, hi: NET_TOP }));
  out.push(tunnel(`${plan.rx},${plan.rz},s`, endFor(plan, 's'), endFor(S, 'n'), hash(plan.rx, plan.rz, plan.seed, 0x51), { lo: 8, hi: NET_TOP }));
  const d = deepInfo(plan);
  if (d) {
    // Round the cavern: the gates joined by a ring, and the south gate up to the balcony in front of the castle.
    const X0 = plan.X0, Z0 = plan.Z0, X1 = X0 + RS - 9, Z1 = Z0 + RS - 9, x0 = X0 + 8, z0 = Z0 + 8;
    const corner = [{ x: X1, y: NET_Y, z: z0 }, { x: X1, y: NET_Y, z: Z1 }, { x: x0, y: NET_Y, z: Z1 }, { x: x0, y: NET_Y, z: z0 }];
    const ring = [gateOf(plan, 'n'), corner[0], gateOf(plan, 'e'), corner[1], gateOf(plan, 's'), corner[2], gateOf(plan, 'w'), corner[3], gateOf(plan, 'n')];
    for (let k = 0; k < ring.length - 1; k++) out.push(tunnel(`${plan.rx},${plan.rz},ring${k}`, ring[k], ring[k + 1], hash(plan.rx, plan.rz, plan.seed, k), { amp: 3, lo: 9, hi: 12, r: 2.6 }));
    // Up from the south gate to the balcony: north off the ring first (so the ring doesn't undercut it), then two
    // long gentle ramps.
    const b = d.balcony, s = gateOf(plan, 's');
    // (the two long ramps run about 9 blocks apart, so neither undercuts the other)
    const w1 = { x: s.x + 6, y: NET_Y + 1, z: s.z - 4 }, w2 = { x: s.x + 34, y: NET_Y + 9, z: s.z - 4 }, w2b = { x: s.x + 38, y: NET_Y + 11, z: s.z - 13 };
    const w3 = { x: b.x + 8, y: b.y + 1, z: b.z + 8 };
    const legs = [[s, w1], [w1, w2], [w2, w2b], [w2b, w3], [w3, { x: b.x, y: b.y + 1, z: b.z + 6 }]];
    legs.forEach(([a, c], k) => out.push(tunnel(`${plan.rx},${plan.rz},up${k}`, a, c, hash(plan.rx, plan.rz, 0x7a + k), { amp: 2, r: 2.8, flatY: true })));
  }
  return out;
}
// Stairways down from dead ends (in regions with nothing else below), each with a tunnel to the hub.
export function entrancesOf(plan) {
  if (plan.deepEnt) return plan.deepEnt;
  const out = [];
  if (!plan.under && !deepInfo(plan)) for (const [i, j, side] of plan.deadEnds) {
    if (out.length >= 2) break;
    if (hash(i, j, plan.seed, 0xdead) % 100 < 92) continue; // (the other dead ends keep their trees, statues and chests)
    const x = plan.X0 + i * P + 3.5, z = plan.Z0 + j * P + 3.5;
    if (plan.clearings.some(c => x > c.bx0 - 16 && x < c.bx1 + 16 && z > c.bz0 - 16 && z < c.bz1 + 16)) continue;
    const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][side];
    const steps = G - 1 - (NET_Y - 1), ex = x + dir[0] * (steps + 2), ez = z + dir[1] * (steps + 2);
    if (ex < plan.X0 + 10 || ex > plan.X0 + RS - 10 || ez < plan.Z0 + 10 || ez > plan.Z0 + RS - 10) continue;
    out.push({ x, z, dir, steps, i, j, end: { x: ex, y: NET_Y, z: ez } });
  }
  plan.deepEnt = out;
  return out;
}

// Which kind of castle stands in a cavern: the one its seed picks if it fits under the dome everywhere, else the
// first of the others that does (built whole once to measure; the same answer in every worker and chunk).
const KINDS = new Map();
function castleKind(d) {
  if (KINDS.has(d.key)) return KINDS.get(d.key);
  const c = d.c, dy = G - FLOOR, first = deepIdentity(c).kind;
  let pick = null;
  for (const k of [first, 'palace', 'keep', 'fortress', 'towers'].filter((k, i, a) => a.indexOf(k) === i)) {
    const t = new Vol(c.bx0 - 2, c.bz0 - 2, c.bx1 - c.bx0 + 5, c.bz1 - c.bz0 + 5);
    buildDeepCastle(t, c, k);
    let fits = true;
    for (let z = c.bz0; z <= c.bz1 && fits; z++) for (let x = c.bx0; x <= c.bx1 && fits; x++) {
      const e = Math.hypot((x - d.cx) / CAV_RX, (z - d.cz) / CAV_RZ), roof = Math.min(d.ceil - 2, FLOOR + d.dome * Math.sqrt(Math.max(0, 1 - e * e)) - 3) + dy;
      for (let y = Math.floor(roof); y < H && fits; y++) if (t.get(x, y, z)) fits = false;
    }
    if (fits) { pick = k; break; }
  }
  pick = pick || 'palace';
  KINDS.set(d.key, pick);
  return pick;
}
// Draw the deep world into a chunk's volume.
export function buildDeep(vol, plans, planAt) {
  const carved = [], keepOut = []; // (no glowing decorations in the castles or on their balconies and ramps)
  // (the caverns and tunnels never come up past CEIL, which keeps the ground's crust whole; only stairways do)
  const air = (x, y, z, top = CEIL + 1) => { if (y < 2 || y > top || !vol.has(x, y, z)) return; if (vol.get(x, y, z) !== 0) { vol.ids[vol.idx(x, y, z)] = 0; carved.push(x, y, z); } };
  const near = (x0, z0, x1, z1) => vol.overlaps(x0, z0, x1, z1);
  // Neighbouring regions too: tunnels and stairs cross region edges.
  const all = new Map();
  for (const p of plans) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const q = planAt(p.rx + dx, p.rz + dz); all.set(q.rx + ',' + q.rz, q); }
  for (const plan of all.values()) {
    // (no early skip here: a region's tunnels run deep into its neighbours; each tube is checked on its own below)
    const d = deepInfo(plan);
    // The cavern: a dome over a flat floor that rises into a bowl at the edges.
    if (d && near(d.cx - CAV_RX, d.cz - CAV_RZ, d.cx + CAV_RX, d.cz + CAV_RZ)) {
      vol.each(d.cx - CAV_RX, d.cz - CAV_RZ, d.cx + CAV_RX, d.cz + CAV_RZ, (x, z) => {
        const ex = (x - d.cx) / CAV_RX, ez = (z - d.cz) / CAV_RZ, e = Math.hypot(ex, ez) + (hashf(x >> 2, z >> 2, plan.seed, 0xca) - 0.5) * 0.05;
        if (e >= 1) return;
        const fl = FLOOR + (e > 0.82 ? Math.round((e - 0.82) / 0.18 * 22) : 0);
        const ce = Math.min(d.ceil, Math.round(FLOOR + d.dome * Math.sqrt(Math.max(0, 1 - e * e)) + (hashf(x >> 1, z >> 1, plan.seed, 0xce) - 0.5) * 3));
        for (let y = fl; y <= ce; y++) air(x, y, z);
      });
    }
    // The network.
    const tubes = regionTunnels(plan, planAt);
    if (!d) { const h = hubOf(plan); tubes.push([[h.x, h.y, h.z, 9 + (hash(plan.rx, plan.rz, 0x4b) % 5)]]); } // the hub chamber
    for (const e of entrancesOf(plan)) {
      tubes.push(tunnel(`${plan.rx},${plan.rz},ent${e.i},${e.j}`, e.end, hubOf(plan), hash(e.i, e.j, plan.seed, 0xe7), { lo: 8, hi: NET_TOP, r: 2.4 }));
      // The stairway: down from the dead end through its back wall, one step per block.
      const pxw = Math.abs(e.dir[1]), pzw = Math.abs(e.dir[0]);
      if (near(Math.min(e.x, e.end.x) - 4, Math.min(e.z, e.end.z) - 4, Math.max(e.x, e.end.x) + 4, Math.max(e.z, e.end.z) + 4)) {
        for (let k = 0; k <= e.steps + 2; k++) {
          const sx = Math.floor(e.x + e.dir[0] * k), sz = Math.floor(e.z + e.dir[1] * k), fy = Math.max(NET_Y - 1, G - 1 - k);
          for (let w = -1; w <= 1; w++) {
            const x = sx + pxw * w, z = sz + pzw * w;
            if (!vol.has(x, fy, z)) continue;
            vol.set(x, fy, z, B('Stone Bricks'));
            for (let y = fy + 1; y <= fy + 4; y++) { if (k < 2 && y >= G) continue; air(x, y, z, G + 1); }
          }
          if (k % 7 === 3) { const x = sx + pxw * 2, z = sz + pzw * 2; if (vol.has(x, fy + 3, z) && vol.get(x, fy + 3, z)) vol.set(x, fy + 3, z, B(STAIR_GLOW[biomeOf(plan)])); }
        }
        // A glowing crystal over the way down, so you see it from the corridor.
        const tx = Math.floor(e.x + e.dir[0] * 3), tz = Math.floor(e.z + e.dir[1] * 3); // on top of the back wall
        if (vol.has(tx, G + 4, tz)) vol.set(tx, G + 4, tz, B('Glow Crystal Blue'));
      }
    }
    for (const t of tubes) {
      let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
      for (const [x, , z, r] of t) { bx0 = Math.min(bx0, x - r); bz0 = Math.min(bz0, z - r); bx1 = Math.max(bx1, x + r); bz1 = Math.max(bz1, z + r); }
      if (!near(bx0 - 1, bz0 - 1, bx1 + 1, bz1 + 1)) continue;
      for (const [cx, cy, cz, r] of t) {
        if (!near(cx - r - 1, cz - r - 1, cx + r + 1, cz + r + 1)) continue;
        const ry = Math.max(2, Math.min(r * 0.8, plan.under ? 4 : 9)), fl = Math.floor(cy) - 1; // (one flat floor height for every tunnel, so where they meet the floors line up)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
          const q = ((x + 0.5 - cx) / r) ** 2 + ((z + 0.5 - cz) / r) ** 2; if (q > 1) continue;
          const top = Math.floor(cy + ry * Math.sqrt(1 - q));
          for (let y = fl; y <= top; y++) air(x, y, z);
        }
      }
    }
    // The balcony and the ramp down to the castle.
    if (d) keepOut.push([d.c.bx0 - 6, d.c.bz0 - 6, d.c.bx1 + 6, d.c.bz1 + 6], [d.cx - 6, d.balcony.z - 30, d.cx + 6, d.balcony.z + 8]);
    if (d && near(d.cx - 8, d.cz + 30, d.cx + 8, d.cz + 74)) {
      const b = d.balcony;
      for (let z = b.z - 4; z <= b.z + 6; z++) for (let x = b.x - 4; x <= b.x + 4; x++) { if (!vol.has(x, b.y - 1, z)) continue; vol.set(x, b.y - 1, z, B('Stone Bricks')); for (let y = b.y; y < b.y + 5; y++) air(x, y, z); }
      for (const x of [b.x - 4, b.x + 4]) for (let z = b.z - 4; z <= b.z; z += 2) if (vol.has(x, b.y, z)) vol.set(x, b.y, z, B('Stone Bricks Slab'));
      for (const x of [b.x - 4, b.x + 4]) if (vol.has(x, b.y + 1, b.z - 4)) vol.set(x, b.y + 1, b.z - 4, B('Glow Crystal White'));
      for (let k = 0; b.y - 1 - k > FLOOR - 1; k++) { // one block down per block, solid down to the floor
        const z = b.z - 5 - k, top = b.y - 1 - k;
        for (let x = b.x - 2; x <= b.x + 2; x++) for (let y = FLOOR - 1; y <= top; y++) if (vol.has(x, y, z)) vol.set(x, y, z, B('Stone Bricks'));
      }
    }
    // The castle: built at the usual height in a scratch volume, then lowered into the cavern.
    if (d && near(d.c.bx0 - 40, d.c.bz0 - 40, d.c.bx1 + 40, d.c.bz1 + 40)) {
      const t = new Vol(vol.x0, vol.z0, vol.sx, vol.sz), stone = B('Stone');
      t.fill(vol.x0, 0, vol.z0, t.x1, G - 2, t.z1, stone);
      buildDeepCastle(t, d.c, castleKind(d));
      const dy = G - FLOOR, c = d.c, ws = B('Water Source'), gw = B(WATER[biomeOf(plan)]);
      vol.each(Math.max(vol.x0, c.bx0 - 30), Math.max(vol.z0, c.bz0 - 30), Math.min(vol.x1, c.bx1 + 30), Math.min(vol.z1, c.bz1 + 30), (x, z) => {
        const inside = x >= c.bx0 && x <= c.bx1 && z >= c.bz0 && z <= c.bz1;
        for (let y = Math.max(0, G - 16); y < H; y++) {
          const ty = y - dy; if (ty < 1 || ty > d.ceil - 1) continue;
          let id = t.ids[t.idx(x, y, z)];
          if (id === ws) id = gw; // (the castle's water glows)
          if (y < G ? inside : id !== 0) vol.ids[vol.idx(x, ty, z)] = id; // (below and at floor level: exactly as built, holes for stairs included)
        }
      });
      const low = a => [a[0], a[1] - dy, a[2], ...a.slice(3)];
      for (const ch of t.chests) { const l = low(ch); if (l[5]) l[5] = { ...l[5], y: l[5].y - dy }; vol.chests.push(l); }
      for (const cn of t.coins) vol.coins.push(low(cn));
      for (const mk of t.marks) vol.marks.push([mk[0], mk[1], mk[2] - dy, mk[3], ...mk.slice(4)]);
      // A glowing moat all round, two deep, with a stone bridge where the path comes to the gate.
      vol.each(Math.max(vol.x0, c.bx0 - 5), Math.max(vol.z0, c.bz0 - 5), Math.min(vol.x1, c.bx1 + 5), Math.min(vol.z1, c.bz1 + 5), (x, z) => {
        const o = Math.max(c.bx0 - x, x - c.bx1, c.bz0 - z, z - c.bz1); // (how far outside the castle's box)
        if (o < 2 || o > 4) return;
        if (vol.get(x, FLOOR, z) !== 0 || vol.get(x, FLOOR + 1, z) !== 0 || !vol.get(x, FLOOR - 1, z)) return;
        if (z > c.bz1 && Math.abs(x - d.cx) <= 2) { vol.set(x, FLOOR - 1, z, B('Stone Bricks')); return; }
        vol.set(x, FLOOR - 1, z, gw); vol.set(x, FLOOR - 2, z, gw); vol.set(x, FLOOR - 3, z, B('Stone Bricks'));
      });
    }
  }
  decorate(vol, carved, planAt, keepOut);
}
// Glow: crystals on walls and ceilings, mushrooms on floors (giant ones in the wide places), moss and gravel.
function decorate(vol, carved, planAt, keepOut) {
  const CRY = [['Glow Crystal Blue', 'Glow Crystal White'], ['Glow Crystal Purple', 'Glow Crystal White'], ['Glow Crystal Green', 'Glow Crystal Blue'], ['Glow Crystal Blue', 'Glow Crystal Purple', 'Glow Crystal Green', 'Glow Crystal White'], ['Glow Crystal Pink', 'Glow Crystal Purple', 'Glow Crystal Pink'], ['Glow Crystal Green', 'Glow Crystal White']].map(l => l.map(B));
  const SHR = [['Glow Shroom Blue'], ['Glow Shroom Purple'], ['Glow Shroom Teal', 'Glow Shroom Green'], ['Glow Shroom Teal', 'Glow Shroom Purple', 'Glow Shroom Blue'], ['Glow Shroom Pink', 'Glow Shroom Purple'], ['Glow Shroom Green', 'Glow Shroom Teal']].map(l => l.map(B));
  const CAP = [B('Glow Cap Teal'), B('Glow Cap Purple')], moss = B('Moss Block'), gravel = B('Gravel'), stem = B('Log');
  const solid = (x, y, z) => { const id = vol.get(x, y, z); return id !== 0 && vol.has(x, y, z); };
  for (let i = 0; i < carved.length; i += 3) {
    const x = carved[i], y = carved[i + 1], z = carved[i + 2];
    if (vol.get(x, y, z) !== 0 || x < vol.x0 + 1 || z < vol.z0 + 1 || x > vol.x1 - 1 || z > vol.z1 - 1) continue;
    if (keepOut.some(b => x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3])) continue;
    const plan = planAt(Math.floor(x / RS), Math.floor(z / RS)), bio = biomeOf(plan), r = hashf(x, y, z, 0xd33);
    const below = vol.get(x, y - 1, z), above = vol.get(x, y + 1, z);
    if (below && solid(x, y - 1, z) && below !== moss) {
      if (r < 0.5) vol.set(x, y - 1, z, bio === 2 || r < 0.2 ? moss : gravel);
      if (r > 0.965) vol.set(x, y, z, SHR[bio][Math.floor(r * 97) % SHR[bio].length]);
      else if (r > 0.925 && r <= 0.93 && (bio === 2 || bio === 3 || bio === 5) && vol.get(x, y + 6, z) === 0 && [[3, 0], [-3, 0], [0, 3], [0, -3]].every(([dx, dz]) => vol.get(x + dx, y + 1, z + dz) === 0 && vol.get(x + dx, y + 4, z + dz) === 0)) {
        // A giant glowing mushroom.
        const h = 3 + Math.floor(r * 1000) % 3, cap = CAP[Math.floor(r * 3000) % 2];
        for (let k = 0; k < h; k++) if (vol.get(x, y + k, z) === 0) vol.set(x, y + k, z, stem);
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dz) < 4 && vol.get(x + dx, y + h, z + dz) === 0) vol.set(x + dx, y + h, z + dz, cap);
      }
    } else if (above && solid(x, y + 1, z)) {
      if (r > 0.965) { const l = CRY[bio], m = l[Math.floor(r * 131) % l.length]; vol.set(x, y, z, m); if (r > 0.985 && vol.get(x, y - 1, z) === 0 && vol.get(x, y - 2, z) === 0 && vol.get(x, y - 3, z) === 0 && vol.get(x, y - 4, z) === 0) vol.set(x, y - 1, z, m); }
    } else if (r > 0.988) {
      // A crystal cluster on the wall.
      const l = CRY[bio];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (solid(x + dx, y, z + dz)) { vol.set(x, y, z, l[Math.floor(r * 71) % l.length]); break; }
    }
  }
}
