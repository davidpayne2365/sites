// Underground systems. Each region with one has an entrance building in a clearing: a spiral stair shaft down to
// the system, which ends at a treasure chest (with a trail of coins along the main way).
//   dungeon — levels of stone rooms joined by corridors and stair tunnels; the treasure vault on the deepest level
//   caves   — winding natural caves with chambers, crystals, mushrooms and a lake; a treasure grotto at the end
//   tunnels — a mine: winding timbered passages with dead-end side tunnels; a treasure chamber at the end
// A region's layout is computed once (and cached) as a list of clipped operations: wall linings, then carving,
// then decorations, so any chunk can draw just its own part.
import { RNG, GROUND, hash, hashf, fbm2, noise2, mix, placeName, DONE, siteKey } from './util.js';
import { RS, P } from './maze.js';
// Portals up to the floating castles (at the ends of dungeons, caves and mines, and on watchtowers) are switched
// off: the castles in the sky are something to look up at and save for (a Magic Carpet gets you there). Set this
// to true to bring the portals back.
export const SKY_PORTALS = false;
// Where a portal at (x, z) leads: the nearest floating castle's arrival plaza.
export function skyDest(x, z, seed) {
  if (!SKY_PORTALS) return null;
  const f = nearestFloating(x, z, seed, regionPlan);
  return f ? { ...f.pad, label: f.name } : null;
}
import { B, chestId, monument, brazier, statue, plantIds, portalGate } from './decor.js';
import { nearestFloating } from './castle.js';
import { regionPlan } from './maze.js';
import { ringStair, towerDoor } from './features.js';

const G = GROUND;
const NATURAL = new Set();
let natInit = false;
function initNat() { if (natInit) return; natInit = true; for (const n of ['Stone', 'Dirt']) NATURAL.add(B(n)); }

class Ops {
  constructor() { this.list = []; }
  add(phase, x0, z0, x1, z1, fn) { this.list.push({ phase, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), fn }); }
  // Line a box with `m` (only where the ground is still natural rock).
  lining(x0, y0, z0, x1, y1, z1, m) { this.add(0, x0, z0, x1, z1, vol => vol.each(x0, z0, x1, z1, (x, z) => { for (let y = y0; y <= y1; y++) if (NATURAL.has(vol.get(x, y, z))) vol.set(x, y, z, m); })); }
  air(x0, y0, z0, x1, y1, z1) { this.add(1, x0, z0, x1, z1, vol => vol.fill(x0, y0, z0, x1, y1, z1, 0)); }
  box(phase, x0, y0, z0, x1, y1, z1, m) { this.add(phase, x0, z0, x1, z1, vol => vol.fill(x0, y0, z0, x1, y1, z1, m)); }
  deco(x0, z0, x1, z1, fn) { this.add(2, x0, z0, x1, z1, fn); }
}

// Entrance and shaft geometry shared by the layout and the entrance building.
function shaftOf(plan) {
  const c = plan.under === 'tunnels' && plan.type === 'spawn' ? plan.underEntrance : plan.main;
  if (!c) return null;
  const rng = new RNG(hash(plan.rx, plan.rz, plan.seed, 0x5aa));
  const cx = Math.floor((c.bx0 + c.bx1) / 2), cz = Math.floor((c.bz0 + c.bz1) / 2);
  const s = 9, x0 = cx - 4, z0 = cz - 4;
  const yE = plan.under === 'caves' ? 44 : plan.under === 'dungeon' ? 46 : 48;
  const start = rng.int(0, 3), alongZ = rng.chance(0.5);
  // The doorway at the bottom and the point just outside it, facing away from the shaft.
  const e = s - 1;
  const [ccx, ccz] = [[x0, z0], [x0 + e - 1, z0], [x0 + e - 1, z0 + e - 1], [x0, z0 + e - 1]][start];
  const west = start === 0 || start === 3, north = start < 2;
  let px, pz, dir;
  if (alongZ) { px = west ? x0 - 3 : x0 + s + 2; pz = ccz + 1; dir = west ? [-1, 0] : [1, 0]; }
  else { px = ccx + 1; pz = north ? z0 - 3 : z0 + s + 2; dir = north ? [0, -1] : [0, 1]; }
  return { c, cx, cz, s, x0, z0, yE, start, alongZ, px, pz, dir };
}

export function buildUnderground(vol, plan) {
  if (!plan.under) return;
  initNat();
  if (!plan.ug) plan.ug = layout(plan);
  const ops = plan.ug;
  if (!ops) return;
  for (let ph = 0; ph <= 2; ph++) for (const op of ops.list) if (op.phase === ph && vol.overlaps(op.x0, op.z0, op.x1, op.z1)) op.fn(vol);
}

function layout(plan) {
  const sh = shaftOf(plan);
  if (!sh) return null;
  const rng = new RNG(hash(plan.rx, plan.rz, plan.seed, 0x0d6));
  const ops = new Ops();
  const bounds = { x0: plan.X0 + 14, z0: plan.Z0 + 14, x1: plan.X0 + RS - 15, z1: plan.Z0 + RS - 15 };
  // The shaft: a lined well with a spiral stair from the system up to the ground.
  const wallM = { dungeon: B('Stone Bricks'), caves: B('mossy_rock'), tunnels: B('Cobblestone') }[plan.under];
  ops.add(0, sh.x0 - 2, sh.z0 - 2, sh.x0 + sh.s + 1, sh.z0 + sh.s + 1, vol => {
    vol.fill(sh.x0 - 1, sh.yE - 1, sh.z0 - 1, sh.x0 + sh.s, G - 1, sh.z0 + sh.s, wallM);
    vol.fill(sh.x0, sh.yE, sh.z0, sh.x0 + sh.s - 1, G + 4, sh.z0 + sh.s - 1, 0);
  });
  ops.add(1, sh.x0 - 4, sh.z0 - 4, sh.x0 + sh.s + 3, sh.z0 + sh.s + 3, vol => {
    ringStair(vol, sh.x0, sh.z0, sh.s, sh.yE, G, wallM, sh.start);
    towerDoor(vol, sh.x0, sh.z0, sh.s, sh.yE, sh.start, sh.alongZ);
    // Torches spiralling down the core.
    for (let y = sh.yE + 3; y < G; y += 5) vol.set(sh.x0 + 2 + ((y >> 2) & 1) * (sh.s - 5), y, sh.z0 + 2, B('Mese Lamp'));
  });
  // The final chest's way home: back up beside the entrance building (it's sealed behind you: see buildEntrance).
  plan.ugHome = { x: sh.cx + 0.5, y: G, z: Math.min(sh.cz + 12, sh.c.bz1 - 1) + 0.5, yaw: 0, label: 'the entrance', site: siteKey(sh.c), kind: 'under' };
  // Connect the doorway to the system's first point.
  const P0 = { x: sh.px, y: sh.yE, z: sh.pz, dir: sh.dir };
  if (plan.under === 'dungeon') dungeon(plan, ops, rng, P0, bounds);
  else if (plan.under === 'caves') caves(plan, ops, rng, P0, bounds);
  else tunnels(plan, ops, rng, P0, bounds);
  return ops;
}

// ---------------------------------------------------------------------------
// Dungeon
// ---------------------------------------------------------------------------
const DSTYLES = () => [
  { wall: mix([[B('Stone Bricks'), 6], [B('Mossy Cobblestone'), 2], [B('Cobblestone'), 2]], 31, 3), floor: B('Cobblestone'), pillar: B('Stone Block'), trim: B('Stone Block') },
  { wall: mix([[B('castle_brick_07'), 6], [B('castle_brick_broken_06'), 3]], 32, 7), floor: B('stone_floor'), pillar: B('castle_brick_01'), trim: B('Stone Block') },
  { wall: mix([[B('Desert Stone Bricks'), 6], [B('Desert Cobblestone'), 3]], 33, 7), floor: B('Desert Stone'), pillar: B('Sandstone Block'), trim: B('Desert Stone Bricks') },
  { wall: mix([[B('Obsidian Bricks'), 7], [B('Obsidian Block'), 2]], 34, 7), floor: B('volcanic_rock_tiles'), pillar: B('Obsidian Block'), trim: B('Obsidian Block') },
  { wall: mix([[B('medieval_blocks_02'), 5], [B('medieval_blocks_06'), 3], [B('mossy_stone_wall'), 2]], 35, 3), floor: B('mossy_brick_floor'), pillar: B('Stone Block'), trim: B('medieval_blocks_05') },
  { wall: mix([[B('dark_brick_wall'), 6], [B('church_bricks_03'), 3]], 36, 7), floor: B('slate_floor'), pillar: B('defense_wall'), trim: B('Stone Block') },
];
function dungeon(plan, ops, rng, P0, bd) {
  const S = rng.pick(DSTYLES());
  const nLev = rng.int(2, 3), levY = [P0.y, P0.y - 12, P0.y - 24].slice(0, nLev);
  const rooms = [];
  const overlap = (a, b, m = 3) => !(a.x1 + m < b.x0 || b.x1 + m < a.x0 || a.z1 + m < b.z0 || b.z1 + m < a.z0);
  // Entry room right outside the shaft door.
  const ew = 9;
  const ex = P0.x + P0.dir[0] * 5, ez = P0.z + P0.dir[1] * 5;
  rooms.push({ x0: ex - 4, z0: ez - 4, x1: ex + 4, z1: ez + 4, L: 0, y: levY[0], entry: true });
  void ew;
  for (let L = 0; L < nLev; L++) {
    const want = rng.int(10, 16);
    for (let t = 0, n = 0; t < 400 && n < want; t++) {
      const w = rng.int(7, 17), d = rng.int(7, 17);
      const x0 = rng.int(bd.x0, bd.x1 - w), z0 = rng.int(bd.z0, bd.z1 - d);
      const r = { x0, z0, x1: x0 + w - 1, z1: z0 + d - 1, L, y: levY[L] };
      if (rooms.some(o => o.L === L && overlap(o, r))) continue;
      // Keep clear of the shaft.
      if (r.x1 > sh(plan).x0 - 4 && r.x0 < sh(plan).x0 + 13 && r.z1 > sh(plan).z0 - 4 && r.z0 < sh(plan).z0 + 13) continue;
      rooms.push(r); n++;
    }
  }
  rooms.forEach((r, i) => { r.id = i; r.cx = Math.floor((r.x0 + r.x1) / 2); r.cz = Math.floor((r.z0 + r.z1) / 2); });
  // Corridors: a spanning tree per level (nearest neighbours) plus loops; stair tunnels between levels.
  const edges = [];
  for (let L = 0; L < nLev; L++) {
    const lv = rooms.filter(r => r.L === L);
    const inTree = new Set([lv[0].id]);
    while (inTree.size < lv.length) {
      let best = null;
      for (const a of lv) if (inTree.has(a.id)) for (const b of lv) if (!inTree.has(b.id)) {
        const d = Math.abs(a.cx - b.cx) + Math.abs(a.cz - b.cz);
        if (!best || d < best[2]) best = [a, b, d];
      }
      edges.push([best[0], best[1]]); inTree.add(best[1].id);
    }
    for (let k = 0; k < Math.floor(lv.length / 4); k++) { const a = rng.pick(lv), b = rng.pick(lv); if (a !== b) edges.push([a, b]); }
  }
  const stairsE = [];
  for (let L = 0; L < nLev - 1; L++) {
    // Find a pair of rooms far enough apart along x or z for a 12-step stair.
    const A = rooms.filter(r => r.L === L), Bs = rooms.filter(r => r.L === L + 1);
    let pair = null;
    for (const a of rng.shuffle([...A])) { for (const b of Bs) { const d = Math.abs(a.cx - b.cx) + Math.abs(a.cz - b.cz); if (d >= 30 && d <= 90) { pair = [a, b]; break; } } if (pair) break; }
    if (!pair) { let best = 0; for (const a of A) for (const b of Bs) { const d = Math.abs(a.cx - b.cx) + Math.abs(a.cz - b.cz); if (d > best) { best = d; pair = [a, b]; } } }
    stairsE.push(pair);
  }
  const pathCells = rooms.map(() => new Set());
  const allPath = new Set();
  // A corridor's cells: an L from a's centre to b's centre (x first, or z first); when the ends are on different
  // levels, a stair (1 down per block) in the middle of the way.
  const route = (a, b, y1, y2, zFirst) => {
    const xs = Math.sign(b.cx - a.cx) || 1, zs = Math.sign(b.cz - a.cz) || 1;
    const flat = [];
    if (!zFirst) { for (let x = a.cx; x !== b.cx + xs; x += xs) flat.push([x, a.cz, 'x']); for (let z = a.cz + zs; z !== b.cz + zs; z += zs) flat.push([b.cx, z, 'z']); }
    else { for (let z = a.cz; z !== b.cz + zs; z += zs) flat.push([a.cx, z, 'z']); for (let x = a.cx + xs; x !== b.cx + xs; x += xs) flat.push([x, b.cz, 'x']); }
    const drop = y1 - y2, n = flat.length, k0 = Math.max(1, Math.floor((n - Math.abs(drop)) / 2));
    return flat.map(([x, z, ax], i) => [x, y1 - Math.sign(drop) * Math.max(0, Math.min(Math.abs(drop), i - k0)), z, ax]);
  };
  const corridor = (a, b, y1, y2, given) => {
    const cells = given || route(a, b, y1, y2, false);
    // Lining, then air (3 wide, 4 high).
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const [cx, cy, cz] of cells) { minx = Math.min(minx, cx); maxx = Math.max(maxx, cx); minz = Math.min(minz, cz); maxz = Math.max(maxz, cz); miny = Math.min(miny, cy); maxy = Math.max(maxy, cy); allPath.add(cx + ',' + cz); for (let d = -1; d <= 1; d++) { allPath.add((cx + d) + ',' + cz); allPath.add(cx + ',' + (cz + d)); } }
    ops.add(0, minx - 2, minz - 2, maxx + 2, maxz + 2, vol => { for (const [cx, cy, cz] of cells) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) for (let y = cy - 1; y <= cy + 4; y++) if (NATURAL.has(vol.get(cx + dx, y, cz + dz))) vol.set(cx + dx, y, cz + dz, y === cy - 1 ? S.floor : S.wall); });
    ops.add(1, minx - 1, minz - 1, maxx + 1, maxz + 1, vol => { for (const [cx, cy, cz] of cells) vol.fill(cx - 1, cy, cz - 1, cx + 1, cy + 3, cz + 1, 0); });
    ops.deco(minx - 1, minz - 1, maxx + 1, maxz + 1, vol => {
      cells.forEach(([cx, cy, cz, ax], i) => {
        if (i % 9 === 4) vol.put(ax === 'x' ? cx : cx + 1, cy + 3, ax === 'x' ? cz + 1 : cz, B('Mese Lamp'));
      });
    });
  };
  for (const [a, b] of edges) corridor(a, b, a.y, b.y);
  corridor({ cx: P0.x, cz: P0.z }, rooms[0], P0.y, P0.y);
  // Stair tunnels between levels: the sloping part must keep 2 blocks away from every room and level corridor,
  // or it would break through their floors. Try room pairs and both L orders until one fits.
  const flatNear = new Set();
  for (const r of rooms) for (let z = r.z0 - 3; z <= r.z1 + 3; z++) for (let x = r.x0 - 3; x <= r.x1 + 3; x++) flatNear.add(x + ',' + z);
  for (const k of allPath) { const [x, z] = k.split(',').map(Number); for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) flatNear.add((x + dx) + ',' + (z + dz)); }
  for (let si = 0; si < stairsE.length; si++) {
    const L = stairsE[si][0].L;
    const A = rooms.filter(r => r.L === L), Bs = rooms.filter(r => r.L === L + 1);
    const pairs = [];
    for (const a of A) for (const b of Bs) { const d = Math.abs(a.cx - b.cx) + Math.abs(a.cz - b.cz); if (d >= 24) pairs.push([d, a, b]); }
    pairs.sort((p, q) => p[0] - q[0]);
    let done = false;
    for (const [, a, b] of pairs) {
      for (const zFirst of [false, true]) {
        const cells = route(a, b, a.y, b.y, zFirst);
        const ok = cells.every(([x, y, z]) => y === a.y || y === b.y || !flatNear.has(x + ',' + z) ||
          (Math.abs(x - a.cx) <= (a.x1 - a.x0) / 2 + 1 && Math.abs(z - a.cz) <= (a.z1 - a.z0) / 2 + 1 && y >= a.y - 1));
        if (!ok) continue;
        corridor(a, b, a.y, b.y, cells);
        stairsE[si] = [a, b];
        done = true; break;
      }
      if (done) break;
    }
    if (!done) { const [a, b] = stairsE[si]; corridor(a, b, a.y, b.y); }
  }

  // Rooms: lining, air, then decoration.
  const graph = new Map(rooms.map(r => [r.id, []]));
  for (const [a, b] of [...edges, ...stairsE]) { graph.get(a.id).push(b.id); graph.get(b.id).push(a.id); }
  const dist = new Map([[0, 0]]), q = [0];
  while (q.length) { const a = q.shift(); for (const b of graph.get(a)) if (!dist.has(b)) { dist.set(b, dist.get(a) + 1); q.push(b); } }
  const deepL = nLev - 1;
  let vault = rooms.filter(r => r.L === deepL).sort((a, b) => (dist.get(b.id) ?? 0) - (dist.get(a.id) ?? 0))[0];
  const types = ['crypt', 'prison', 'library', 'pillars', 'flooded', 'mushroom', 'statue', 'storage', 'shrine', 'bones', 'forge', 'pillars'];
  for (const r of rooms) {
    const y = r.y, h = 5;
    ops.lining(r.x0 - 1, y - 1, r.z0 - 1, r.x1 + 1, y + h, r.z1 + 1, S.wall);
    ops.box(0, r.x0, y - 1, r.z0, r.x1, y - 1, r.z1, S.floor);
    ops.air(r.x0, y, r.z0, r.x1, y + h - 1, r.z1);
    const type = r === vault ? 'vault' : r.entry ? 'entry' : types[hash(r.id, plan.rx, plan.rz) % types.length];
    const blocked = (x, z) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (allPath.has((x + dx) + ',' + (z + dz))) return true; return false; };
    const dest = r === vault ? skyDest(r.cx, r.cz, plan.seed) : null;
    ops.deco(r.x0 - 1, r.z0 - 1, r.x1 + 1, r.z1 + 1, vol => {
      dungeonRoom(vol, r, type, S, new RNG(hash(r.id, plan.seed, 0x77)), blocked, dist.get(r.id) ?? 0, plan.ugHome);
      // The way on: a portal set into the vault wall, up to the nearest floating castle.
      if (dest) for (const [side, x, z, axis] of [['N', r.cx - 1, r.z0 - 1, 'x'], ['S', r.cx - 1, r.z1 + 1, 'x'], ['W', r.x0 - 1, r.cz - 1, 'z'], ['E', r.x1 + 1, r.cz - 1, 'z']]) {
        const inside = side === 'N' ? [[r.cx - 2, r.z0], [r.cx + 1, r.z0]] : side === 'S' ? [[r.cx - 2, r.z1], [r.cx + 1, r.z1]] : side === 'W' ? [[r.x0, r.cz - 2], [r.x0, r.cz + 1]] : [[r.x1, r.cz - 2], [r.x1, r.cz + 1]];
        const cells = [];
        for (let k = 0; k <= 3; k++) cells.push(axis === 'x' ? [inside[0][0] + k, inside[0][1]] : [inside[0][0], inside[0][1] + k]);
        if (cells.some(([cx, cz]) => blocked(cx, cz))) continue;
        for (const [cx, cz] of cells) vol.set(cx, r.y, cz, 0);
        portalGate(vol, x, r.y, z, axis, dest, 'Obsidian Bricks');
        break;
      }
    });
  }
  void P;
  function sh() { return shaftOf(plan); }
}
function dungeonRoom(vol, r, type, S, rng, blocked, depth, home) {
  const y = r.y;
  const bandCells = [];
  for (let x = r.x0; x <= r.x1; x++) { bandCells.push([x, r.z0, 0]); bandCells.push([x, r.z1, 2]); }
  for (let z = r.z0 + 1; z < r.z1; z++) { bandCells.push([r.x0, z, 3]); bandCells.push([r.x1, z, 1]); }
  const band = (fn, every = 1) => { let i = 0; for (const [x, z, f] of bandCells) { if (blocked(x, z)) continue; if (i++ % every) continue; fn(x, z, f); } };
  const centre = fn => { for (let z = r.z0 + 3; z <= r.z1 - 3; z++) for (let x = r.x0 + 3; x <= r.x1 - 3; x++) if (!blocked(x, z)) fn(x, z); };
  // Torches in the corners.
  for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]) if (!blocked(x, z)) vol.set(x, y, z, B('Torch'));
  vol.set(r.cx, y + 4, r.cz, B('Mese Lamp'));
  switch (type) {
    case 'crypt': centre((x, z) => { if ((x - r.x0) % 3 === 0 && (z - r.z0) % 4 === 3) { vol.set(x, y, z, S.trim); vol.set(x, y, z + 1 <= r.z1 - 3 ? z + 1 : z, S.trim); vol.set(x, y + 1, z, B('Stone Bricks Slab')); } }); band((x, z) => vol.set(x, y, z, B('Bone Box')), 4); break;
    case 'prison': band((x, z) => vol.fill(x, y, z, x, y + 3, z, (x + z) % 4 ? B('Iron Bars') : S.pillar)); break;
    case 'library': band((x, z) => vol.fill(x, y, z, x, y + 2, z, rng.chance(0.2) ? B('Mossy Cobblestone') : B('Bookshelf'))); centre((x, z) => { if (rng.chance(0.08)) vol.set(x, y, z, B('Planks')); }); break;
    case 'pillars': centre((x, z) => { if ((x - r.x0) % 3 === 0 && (z - r.z0) % 3 === 0) vol.fill(x, y, z, x, y + 4, z, S.pillar); }); break;
    case 'flooded': for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) { if (blocked(x, z)) continue; vol.set(x, y - 1, z, B('Water Source')); vol.set(x, y - 2, z, S.floor); } centre(() => { rng.chance(0.06); }); break;
    case 'mushroom': for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) { if (blocked(x, z)) continue; vol.set(x, y - 1, z, B('Mossy Dirt')); if (!blocked(x, z) && rng.chance(0.18)) vol.put(x, y, z, rng.chance(0.6) ? B('Red Mushroom') : B('Brown Mushroom')); } break;
    case 'statue': if (r.x1 - r.x0 >= 8 && r.z1 - r.z0 >= 8 && !blocked(r.cx, r.cz)) monument(vol, r.cx, y, r.cz, hash(r.id, 5), rng.int(0, 3), { stone: rng.pick(['Obsidian Block', 'mossy_rock', 'Stone Block']), base: 'Stone Bricks', pr: 1, ph: 1, kind: rng.pick(['lion', 'owl', 'bust']) }); break;
    case 'storage': band((x, z) => vol.fill(x, y, z, x, y + rng.int(0, 1), z, rng.pick([B('wooden_barrel'), B('Planks'), B('Straw')])), 2); break;
    case 'shrine': centre((x, z) => { if (x === r.cx && z === r.cz) { vol.set(x, y, z, B('Gold Block')); vol.set(x, y + 1, z, B('Mese Lamp')); } }); band((x, z) => { if ((x + z) % 5 === 0) brazier(vol, x, y, z); }); break;
    case 'bones': band((x, z) => vol.fill(x, y, z, x, y + rng.int(0, 1), z, B('Bone Box')), 2); break;
    case 'forge': band((x, z, f) => { vol.set(x, y, z, rng.chance(0.5) ? B('Furnace') : B('Steel Block')); void f; }, 2); centre((x, z) => { if ((x + z) % 7 === 0) { vol.set(x, y - 1, z, B('Lava Source')); vol.set(x, y, z, B('Iron Bars')); } }); break;
    case 'vault': {
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (!blocked(x, z)) vol.set(x, y - 1, z, ((x + z) & 1) ? B('Gold Block') : S.trim);
      // The big chest against the wall farthest from the way in, with gold heaped round.
      const spots = bandCells.filter(([x, z]) => !blocked(x, z));
      const [x, z, f] = spots.length ? spots[Math.floor(spots.length / 2)] : [r.cx, r.cz, 0];
      vol.chest(x, y, z, chestId(f), 600 + depth * 60 + rng.int(0, 300), 3, home);
      band((bx, bz) => { if (Math.abs(bx - x) + Math.abs(bz - z) > 1 && rng.chance(0.35)) vol.fill(bx, y, bz, bx, y + rng.int(0, 1), bz, rng.pick([B('Gold Block'), B('Gold Block'), B('Diamond Block'), B('Mese Block')])); }, 2);
      for (let k = 0; k < 12; k++) { const qx = rng.int(r.x0 + 2, r.x1 - 2), qz = rng.int(r.z0 + 2, r.z1 - 2); if (vol.get(qx, y, qz) === 0) vol.coin(qx, y, qz, 3); }
      for (const [lx, lz] of [[r.x0 + 1, r.z0 + 1], [r.x1 - 1, r.z0 + 1], [r.x0 + 1, r.z1 - 1], [r.x1 - 1, r.z1 - 1]]) vol.set(lx, y + 4, lz, B('Mese Lamp'));
      break;
    }
    default: break;
  }
  // Small chests in some side rooms.
  if (type !== 'vault' && type !== 'entry' && rng.chance(0.3)) {
    const spots = bandCells.filter(([x, z]) => !blocked(x, z));
    if (spots.length) { const [x, z, f] = rng.pick(spots); vol.chest(x, y, z, chestId(f), 40 + rng.int(0, 90) + depth * 5, 2); }
  }
}

// ---------------------------------------------------------------------------
// Caves
// ---------------------------------------------------------------------------
function caves(plan, ops, rng, P0, bd) {
  const seed = hash(plan.rx, plan.rz, plan.seed, 0xca7e);
  const pts = []; // carve points [x, y, z, r, kind]
  // Coarse occupancy (4x4 columns) of every passage so far, to keep passages from crossing at other depths.
  const occ = new Map();
  const ok3 = (x, z, y, r, self, selfFrom) => {
    const R = Math.ceil((r + 3) / 4);
    const gx = Math.floor(x / 4), gz = Math.floor(z / 4);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const l = occ.get((gx + dx) + ',' + (gz + dz)); if (!l) continue;
      for (const [id, i, oy] of l) { if (id === self && i >= selfFrom) continue; if (Math.abs(oy - y) > 1.2) return false; }
    }
    return true;
  };
  const mark = (x, z, y, id, i, r) => { const R = Math.ceil((r + 1) / 4); const gx = Math.floor(x / 4), gz = Math.floor(z / 4); for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { const k = (gx + dx) + ',' + (gz + dz); (occ.get(k) || occ.set(k, []).get(k)).push([id, i, y]); } };
  // A worm: heading wanders with noise, steers back inside the region and away from other passages; descends
  // gently except around planned chambers, where it stays level.
  const worm = (sx, sy, sz, heading, len, yMin, rBase, tag, flatAt = [], id = tag) => {
    let x = sx, y = sy, z = sz, a = heading;
    const out = [];
    for (let i = 0; i < len; i++) {
      a += (noise2(i * 0.06, tag, seed) - 0.5) * 0.5;
      const cx = (bd.x0 + bd.x1) / 2, cz = (bd.z0 + bd.z1) / 2;
      if (x < bd.x0 + 16 || x > bd.x1 - 16 || z < bd.z0 + 16 || z > bd.z1 - 16) {
        const want = Math.atan2(cz - z, cx - x); let d = want - a; d = Math.atan2(Math.sin(d), Math.cos(d)); a += d * 0.15;
      }
      const flat = flatAt.some(([ci, cr]) => Math.abs(i - ci) <= cr + 3);
      const ty = yMin + (sy - yMin) * (1 - i / len);
      const ny = flat ? y : y + Math.max(-0.3, Math.min(0.15, (ty - y) * 0.08));
      const r = rBase + noise2(i * 0.08, tag + 7, seed) * 1.6;
      // Find a heading that doesn't run into another passage at a different depth.
      let moved = false;
      for (const turnBy of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6]) {
        const aa = a + turnBy, nx = x + Math.cos(aa), nz = z + Math.sin(aa);
        if (nx < plan.X0 + 6 || nx > plan.X0 + RS - 7 || nz < plan.Z0 + 6 || nz > plan.Z0 + RS - 7) continue;
        if (!ok3(nx, nz, ny, r, id, i - 14)) continue;
        a = aa; x = nx; z = nz; moved = true; break;
      }
      if (!moved) break;
      y = ny;
      mark(x, z, y, id, i, r);
      out.push([x, y, z, r, 0]);
    }
    return out;
  };
  // Lead-in from the shaft door, straight and level, then the main worm.
  const lead = [];
  for (let i = 0; i < 8; i++) { lead.push([P0.x + P0.dir[0] * i, P0.y, P0.z + P0.dir[1] * i, 2.2, 0]); mark(P0.x + P0.dir[0] * i, P0.z + P0.dir[1] * i, P0.y, 1, -1, 2.2); }
  const len = rng.int(300, 420);
  const plannedR = [1, 2, 3, 4].map(() => rng.range(6, 10));
  const flatAt = [1, 2, 3, 4].map((k, j) => [Math.floor(len * k / 5), plannedR[j]]);
  flatAt.push([len - 1, 9]);
  const main = worm(lead[7][0], P0.y, lead[7][2], Math.atan2(P0.dir[1], P0.dir[0]), len, 16, 2.6, 1, flatAt);
  pts.push(...lead, ...main);
  // Chambers along the main worm (sized so they don't break into other passages).
  const chambers = [];
  const fitR = (p, r, id, i) => { while (r > 3 && !ok3(p[0], p[2], p[1], r, id, i - r - 6)) r -= 1; return r; };
  for (let k = 1; k <= 4; k++) { const i = Math.floor(main.length * k / 5), p = main[i]; if (p) chambers.push([p[0], p[1], p[2], fitR(p, plannedR[k - 1], 1, i), k === 2 ? 1 : 0]); }
  const end = main[main.length - 1] || lead[lead.length - 1];
  chambers.push([end[0], end[1], end[2], fitR(end, 8, 1, main.length - 1), 2]); // treasure grotto
  // Side branches ending in grottos.
  const branches = [];
  for (let k = 0; k < rng.int(4, 7); k++) {
    const i0 = rng.int(20, Math.max(21, main.length - 40)), p = main[i0];
    if (!p) continue;
    const b = worm(p[0], p[1], p[2], rng.range(0, 6.28), rng.int(40, 110), Math.max(14, p[1] - 10), 2.2, 10 + k, [], 10 + k);
    if (b.length < 12) continue;
    branches.push(b); pts.push(...b);
    const e = b[b.length - 1]; chambers.push([e[0], e[1], e[2], fitR(e, rng.range(4, 6), 10 + k, b.length - 1), 3]);
  }
  pts.push(...chambers);
  plan.ugInfo = { main, chambers, branches };
  // Carving: a flat floor at each point's height and a domed ceiling.
  const carve = (vol, [px, py, pz, r, kind]) => {
    const R = Math.ceil(r), fy = Math.floor(py);
    vol.each(Math.floor(px - R), Math.floor(pz - R), Math.floor(px + R), Math.floor(pz + R), (x, z) => {
      const d = Math.hypot(x + 0.5 - px, z + 0.5 - pz);
      if (d >= r) return;
      const k = Math.sqrt(1 - (d / r) * (d / r));
      const top = fy + Math.ceil((kind ? 2.5 : 2) + r * (kind ? 0.75 : 1.1) * k);
      vol.fill(x, fy, z, x, top, z, 0);
    });
  };
  for (const p of pts) { const R = Math.ceil(p[3]) + 1; ops.add(1, Math.floor(p[0]) - R, Math.floor(p[2]) - R, Math.floor(p[0]) + R, Math.floor(p[2]) + R, vol => carve(vol, p)); }
  // Rock skin, crystals, mushrooms, lights, a lake, stalactites, coins and treasure.
  const skin = mix([[B('Stone'), 5], [B('rock_wall_08'), 3], [B('mossy_rock'), 2], [B('dark_rock'), 2], [B('Coal Ore'), 0.4], [B('Iron Ore'), 0.3]], seed, 3);
  const glow = [B('Mese Crystal Ore'), B('Diamond Vein'), B('Gold Ore'), B('Mese Ore')];
  pts.forEach((p, i) => {
    const R = Math.ceil(p[3]) + 2;
    ops.deco(Math.floor(p[0]) - R, Math.floor(p[2]) - R, Math.floor(p[0]) + R, Math.floor(p[2]) + R, vol => {
      const prng = new RNG(hash(i, seed));
      // Line nearby rock with varied stone (only cells that are still natural).
      if (i % 3 === 0) vol.each(Math.floor(p[0]) - R, Math.floor(p[2]) - R, Math.floor(p[0]) + R, Math.floor(p[2]) + R, (x, z) => {
        for (let y = Math.floor(p[1]) - 2; y <= Math.floor(p[1]) + R + 2; y++) if (NATURAL.has(vol.get(x, y, z))) vol.set(x, y, z, skin);
      });
      // Crystals in the walls (they glow), every few steps.
      if (i % 4 === 0) {
        const a = prng.range(0, 6.28), up = prng.range(0.3, 1.6);
        const x = Math.floor(p[0] + Math.cos(a) * (p[3] + 0.4)), z = Math.floor(p[2] + Math.sin(a) * (p[3] + 0.4)), y = Math.floor(p[1] + up);
        const g = prng.pick(glow);
        if (vol.get(x, y, z) && vol.get(x, y, z) !== B('Water Source')) vol.set(x, y, z, g);
      }
      // Mushrooms on the floor.
      if (i % 5 === 1) { const x = Math.floor(p[0] + prng.range(-1, 1) * p[3] * 0.6), z = Math.floor(p[2] + prng.range(-1, 1) * p[3] * 0.6), y = Math.floor(p[1]); const pl = prng.chance(0.6) ? B('Red Mushroom') : plantIds.ferns[prng.int(0, 3)]; if (vol.get(x, y, z) === 0 && vol.get(x, y - 1, z)) vol.set(x, y, z, pl); }
    });
  });
  const endC = chambers.find(ch => ch[4] === 2), dest = endC ? skyDest(endC[0], endC[2], plan.seed) : null;
  chambers.forEach(([cx, cy, cz, r, kind], i) => {
    const R = Math.ceil(r) + 2, fy = Math.floor(cy);
    ops.deco(Math.floor(cx) - R, Math.floor(cz) - R, Math.floor(cx) + R, Math.floor(cz) + R, vol => {
      const crng = new RNG(hash(i, seed, 3));
      // Stalactites from the dome.
      for (let k = 0; k < r * 1.5; k++) {
        const a = crng.range(0, 6.28), d = crng.range(1.5, r * 0.85), x = Math.floor(cx + Math.cos(a) * d), z = Math.floor(cz + Math.sin(a) * d);
        const top = fy + Math.ceil(2.5 + r * 0.75 * Math.sqrt(1 - (d / r) * (d / r)));
        const len = crng.int(1, Math.max(1, Math.min(4, top - fy - 4)));
        for (let y = top - len + 1; y <= top; y++) if (vol.get(x, y, z) === 0) vol.set(x, y, z, B('Stone'));
      }
      if (kind === 1) {
        // Underground lake (swimmable) in the middle of the chamber.
        vol.each(Math.floor(cx - r), Math.floor(cz - r), Math.floor(cx + r), Math.floor(cz + r), (x, z) => {
          const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
          if (d < r * 0.6) { vol.fill(x, fy - 2, z, x, fy - 1, z, B('Water Source')); vol.set(x, fy - 3, z, B('Sand')); }
        });
        for (let k = 0; k < 6; k++) vol.coin(Math.floor(cx) + crng.int(-2, 2), fy - 2, Math.floor(cz) + crng.int(-2, 2), 2);
      }
      // Glowing mushrooms ring.
      for (let k = 0; k < r; k++) { const a = crng.range(0, 6.28), d = r * 0.8, x = Math.floor(cx + Math.cos(a) * d), z = Math.floor(cz + Math.sin(a) * d); if (vol.get(x, fy, z) === 0) vol.set(x, fy, z, B('Red Mushroom')); }
      if (kind === 2) {
        // The treasure grotto: a chest on a gold dais, crystals all round.
        const x = Math.floor(cx), z = Math.floor(cz);
        if (dest) { // the portal's alcove
          vol.fill(x - 6, fy, z - 2, x - 4, fy + 4, z + 2, 0);
          vol.fill(x - 6, fy - 1, z - 2, x - 4, fy - 1, z + 2, B('Obsidian Block'));
        }
        vol.fill(x - 1, fy - 1, z - 1, x + 1, fy - 1, z + 1, B('Gold Block'));
        vol.chest(x, fy, z, chestId(crng.int(0, 3)), 900 + crng.int(0, 500), 3, plan.ugHome);
        for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28, xx = Math.floor(cx + Math.cos(a) * (r + 0.3)), zz = Math.floor(cz + Math.sin(a) * (r + 0.3)); const g = crng.pick(glow); if (vol.get(xx, fy + 1, zz)) vol.set(xx, fy + 1, zz, g); }
        for (let k = 0; k < 14; k++) { const qx = x + crng.int(-3, 3), qz = z + crng.int(-3, 3); if (vol.get(qx, fy, qz) === 0) vol.coin(qx, fy, qz, 3); }
        brazier(vol, x - 3, fy, z); brazier(vol, x + 3, fy, z);
        if (dest) portalGate(vol, x - 5, fy, z - 1, 'z', dest, 'Obsidian Bricks');
      } else if (kind === 3 && crng.chance(0.55)) {
        vol.chest(Math.floor(cx), fy, Math.floor(cz), chestId(crng.int(0, 3)), 60 + crng.int(0, 140), 2);
        vol.set(Math.floor(cx) + 1, fy, Math.floor(cz), B('Torch'));
      } else vol.set(Math.floor(cx), fy, Math.floor(cz), B('Torch'));
    });
  });
}

// ---------------------------------------------------------------------------
// Tunnels: an old mine of winding timbered passages.
// ---------------------------------------------------------------------------
function tunnels(plan, ops, rng, P0, bd) {
  const used = new Map(); // "x,z" -> y of the floor
  const segs = []; // { cells: [[x, y, z]], dir, main }
  const free = (x, z, y) => { if (x < plan.X0 + 6 || x > plan.X0 + RS - 7 || z < plan.Z0 + 6 || z > plan.Z0 + RS - 7) return false; const u = used.get(x + ',' + z); return u === undefined; };
  const mark = (x, z, y) => { for (let d = -2; d <= 2; d++) for (let e = -2; e <= 2; e++) used.set((x + d) + ',' + (z + e), y); };
  // Lay one straight segment from (x, y, z) heading dir; returns the end or null if blocked.
  const tryseg = (x, y, z, dir, len, descend, main) => {
    const cells = [];
    let cy = y;
    for (let k = 1; k <= len; k++) {
      const nx = x + dir[0] * k, nz = z + dir[1] * k;
      if (descend && k <= descend) cy--;
      // The cells across the tunnel must be free (except right at the start, which joins the previous one).
      if (k > 2) for (let s = -2; s <= 2; s++) { const ax = nx + (dir[1] ? s : 0) + dir[0] * 2, az = nz + (dir[0] ? s : 0) + dir[1] * 2; if (!free(ax, az, cy)) return null; }
      cells.push([nx, cy, nz]);
    }
    for (const [cx, cyy, cz] of cells) mark(cx, cz, cyy);
    segs.push({ cells, dir, main, start: [x, y, z] });
    return cells[cells.length - 1];
  };
  const turn = (dir, s) => (s > 0 ? [-dir[1], dir[0]] : [dir[1], -dir[0]]);
  // Last resort: a short straight passage whatever is in the way.
  const forceSeg = (p, dir) => { const cells = []; for (let k = 1; k <= 6; k++) cells.push([p[0] + dir[0] * k, p[1], p[2] + dir[1] * k]); for (const [cx, cy, cz] of cells) mark(cx, cz, cy); segs.push({ cells, dir, main: true, start: p }); return cells[5]; };
  let best = null;
  // Try a few walks and keep the longest main way (the treasure is at its end).
  for (let attempt = 0; attempt < 6; attempt++) {
    used.clear(); segs.length = 0;
    const wr = new RNG(hash(attempt, plan.rx, plan.rz, plan.seed));
    for (let k = -3; k <= 3; k++) for (let j = -3; j <= 3; j++) mark(sh(plan).cx + k * 2, sh(plan).cz + j * 2, 99);
    let p = [P0.x - P0.dir[0], P0.y, P0.z - P0.dir[1]], dir = P0.dir;
    let total = 0;
    const first = tryseg(p[0], p[1], p[2], dir, 6, 0, true) || (attempt === 5 ? forceSeg(p, dir) : null); if (!first) continue; p = first; total += 6;
    for (let n = 0; n < 60 && total < 520; n++) {
      const opts = wr.shuffle([0, 0, 1, -1, 1, -1]);
      let done = false;
      for (const o of opts) {
        const nd = o ? turn(dir, o) : dir, len = wr.int(6, 18);
        const desc = p[1] > 22 && wr.chance(0.25) ? Math.min(len - 2, wr.int(3, 5)) : 0;
        const e = tryseg(p[0], p[1], p[2], nd, len, desc, true);
        if (e) { p = e; dir = nd; total += len; done = true; break; }
      }
      if (!done) break;
    }
    if (!best || total > best.total) best = { total, segs: segs.map(s => ({ ...s, cells: [...s.cells] })), used: new Map(used), end: p, dir };
    if (total > 380) break;
  }
  used.clear(); for (const [k, v] of best.used) used.set(k, v);
  segs.length = 0; segs.push(...best.segs);
  // Side passages (dead ends, some with small finds).
  const mainSegs = [...segs];
  const nb = rng.int(6, 11);
  const ends = [];
  for (let b = 0; b < nb; b++) {
    const s = rng.pick(mainSegs.slice(1)), c = s.cells[rng.int(2, Math.max(2, s.cells.length - 2))];
    if (!c) continue;
    let dir = turn(s.dir, rng.chance(0.5) ? 1 : -1), p = c;
    const n = rng.int(2, 5);
    let ok = false;
    for (let k = 0; k < n; k++) {
      const len = rng.int(5, 14), e = tryseg(p[0], p[1], p[2], dir, len, p[1] > 22 && rng.chance(0.2) ? 3 : 0, false);
      if (!e) break;
      p = e; ok = true; dir = rng.chance(0.5) ? dir : turn(dir, rng.chance(0.5) ? 1 : -1);
    }
    if (ok) ends.push(p);
  }
  // Draw every segment: carve 3 wide x 4 high, timber frames every 4 blocks, lights, gravel floor.
  const floorM = mix([[B('Gravel'), 4], [B('Dirt'), 2], [B('Planks'), 1]], 41, 3);
  const wallM = mix([[B('Stone'), 4], [B('rock_wall_08'), 2], [B('Cobblestone'), 1], [B('Coal Ore'), 0.3]], 42, 3);
  const log = B('Log'), plank = B('Planks');
  segs.forEach((s, si) => {
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    for (const [x, , z] of s.cells) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
    const [sx, sz] = s.dir[0] ? [0, 1] : [1, 0]; // across
    ops.add(0, minx - 3, minz - 3, maxx + 3, maxz + 3, vol => {
      for (const [x, y, z] of s.cells) for (let k = -2; k <= 2; k++) for (let yy = y - 1; yy <= y + 4; yy++) {
        const ax = x + sx * k, az = z + sz * k;
        if (NATURAL.has(vol.get(ax, yy, az))) vol.set(ax, yy, az, yy === y - 1 ? floorM : wallM);
      }
    });
    ops.add(1, minx - 2, minz - 2, maxx + 2, maxz + 2, vol => {
      for (const [x, y, z] of s.cells) vol.fill(x - sx, y, z - sz, x + sx, y + 3, z + sz, 0);
      // Where a stair drops, keep the head room clear above the step behind.
      for (const [x, y, z] of s.cells) vol.fill(x - sx, y + 4, z - sz, x + sx, y + 4, z + sz, 0);
    });
    ops.deco(minx - 2, minz - 2, maxx + 2, maxz + 2, vol => {
      s.cells.forEach(([x, y, z], i) => {
        if (i % 4 === 1) {
          // Posts in the walls, beam across the ceiling.
          vol.fill(x - 2 * sx, y, z - 2 * sz, x - 2 * sx, y + 3, z - 2 * sz, log);
          vol.fill(x + 2 * sx, y, z + 2 * sz, x + 2 * sx, y + 3, z + 2 * sz, log);
          vol.fill(x - 2 * sx, y + 4, z - 2 * sz, x + 2 * sx, y + 4, z + 2 * sz, plank);
          if ((i + si) % 3 === 0) vol.set(x, y + 4, z, B('Mese Lamp'));
        }
        if (!s.main && i % 9 === 5 && vol.get(x + sx, y, z + sz) === 0) vol.set(x + sx, y, z + sz, B('Torch'));
      });
    });
  });
  // The treasure chamber at the end of the main way.
  const [ex, ey, ez] = best.end, d = best.dir;
  const cx = ex + d[0] * 5, cz = ez + d[1] * 5;
  ops.lining(cx - 6, ey - 1, cz - 6, cx + 6, ey + 6, cz + 6, B('Stone Bricks'));
  ops.air(cx - 5, ey, cz - 5, cx + 5, ey + 5, cz + 5);
  ops.air(ex, ey, ez, ex + d[0] * 2, ey + 3, ez + d[1] * 2);
  const tseed = hash(plan.rx, plan.rz, plan.seed, 0x7c);
  const tdest = skyDest(cx, cz, plan.seed);
  ops.deco(cx - 6, cz - 6, cx + 6, cz + 6, vol => {
    const rng = new RNG(tseed);
    vol.fill(cx - 5, ey - 1, cz - 5, cx + 5, ey - 1, cz + 5, B('Planks'));
    for (const [px, pz] of [[cx - 4, cz - 4], [cx + 4, cz - 4], [cx - 4, cz + 4], [cx + 4, cz + 4]]) { vol.fill(px, ey, pz, px, ey + 5, pz, log); vol.set(px, ey + 5, pz, B('Mese Lamp')); }
    const bx = cx + d[0] * 4, bz = cz + d[1] * 4;
    const f = d[0] > 0 ? 1 : d[0] < 0 ? 3 : d[1] > 0 ? 2 : 0; // facing back toward the way in
    vol.chest(bx, ey, bz, chestId(f), 800 + rng.int(0, 400), 3, plan.ugHome);
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (vol.get(bx + ox, ey, bz + oz) === 0 && !(bx + ox === cx && bz + oz === cz)) vol.set(bx + ox, ey, bz + oz, B('Gold Block'));
    for (let k = 0; k < 10; k++) { const qx = cx + rng.int(-3, 3), qz = cz + rng.int(-3, 3); if (vol.get(qx, ey, qz) === 0) vol.coin(qx, ey, qz, 3); }
    vol.set(cx, ey, cz, B('wooden_barrel'));
    if (tdest) { if (d[0]) portalGate(vol, cx - 1, ey, cz - 6, 'x', tdest, 'Stone Bricks'); else portalGate(vol, cx - 6, ey, cz - 1, 'z', tdest, 'Stone Bricks'); }
  });
  // Small finds at the ends of side passages.
  ends.forEach((p, i) => {
    ops.deco(p[0] - 2, p[2] - 2, p[0] + 2, p[2] + 2, vol => {
      const er = new RNG(hash(i, plan.seed, 0xe0));
      if (er.chance(0.5)) vol.chest(p[0], p[1], p[2], chestId(er.int(0, 3)), 40 + er.int(0, 120), 2);
      else { vol.set(p[0], p[1], p[2], B('wooden_barrel')); vol.coin(p[0], p[1] + 1, p[2], 3); }
      vol.set(p[0], p[1] + 3, p[2], B('Mese Lamp'));
    });
  });
  function sh() { return shaftOf(plan); }
}

// ---------------------------------------------------------------------------
// Entrance buildings over the shafts.
// ---------------------------------------------------------------------------
export function buildEntrance(vol, plan, c, rng) {
  const sh = shaftOf(plan);
  if (!sh || sh.c !== c) return;
  const { x0, z0, s, cx, cz } = sh;
  // Ground of the clearing.
  vol.fill(c.bx0 - 1, G - 1, c.bz0 - 1, c.bx1 + 1, G - 1, c.bz1 + 1, B('Grass'));
  vol.each(c.bx0, c.bz0, c.bx1, c.bz1, (x, z) => { const r = hashf(x, z, c.seed); if (r < 0.15) vol.set(x, G, z, plantIds.grass[hash(x, z) % 5]); });
  const kind = plan.under;
  const out = 3; // the structure stands 3 blocks around the shaft wall
  const ax0 = x0 - out, az0 = z0 - out, ax1 = x0 + s - 1 + out, az1 = z0 + s - 1 + out;
  if (kind === 'dungeon') {
    // A mausoleum: a stone hall with columns, a stepped roof and two guardian statues.
    const m = B(rng.pick(['Stone Bricks', 'marble_01', 'Obsidian Bricks', 'castle_brick_07', 'Desert Stone Bricks']));
    vol.fill(ax0, G - 1, az0, ax1, G - 1, az1, B('stone_tiles'));
    for (let x = ax0; x <= ax1; x += 3) for (const z of [az0, az1]) vol.fill(x, G, z, x, G + 5, z, m);
    for (let z = az0; z <= az1; z += 3) for (const x of [ax0, ax1]) vol.fill(x, G, z, x, G + 5, z, m);
    for (let k = 0; k < 4; k++) vol.fill(ax0 - 1 + k, G + 6 + k, az0 - 1 + k, ax1 + 1 - k, G + 6 + k, az1 + 1 - k, m);
    vol.fill(ax0 + 4, G + 6, az0 + 4, ax1 - 4, G + 8, az1 - 4, 0);
    vol.set(cx, G + 10, cz, B('Mese Lamp'));
    for (const [dx, f] of [[-1, 0], [1, 0]]) monument(vol, cx + dx * (out + 6), G, az1 + 3, c.seed + dx, f, { kind: rng.pick(['knight', 'lion', 'angel']), stone: 'mossy_rock', base: 'Stone Bricks', pr: 1, ph: 1 });
    brazier(vol, ax0, G + 6 + 4, az0); brazier(vol, ax1, G + 6 + 4, az1);
  } else if (kind === 'caves') {
    // A rocky hill with the cave mouth.
    const rock = mix([[B('mossy_rock'), 4], [B('rock_wall_08'), 3], [B('Stone'), 2]], c.seed, 3);
    vol.each(ax0 - 5, az0 - 5, ax1 + 5, az1 + 5, (x, z) => {
      const d = Math.hypot(x + 0.5 - (cx + 0.5), z + 0.5 - (cz + 0.5));
      const h = Math.floor(9.5 - d * 0.95 + fbm2(x / 4, z / 4, c.seed, 2) * 2.5);
      if (h > 0) { vol.fill(x, G, z, x, G + h - 1, z, rock); if (hashf(x, z, 7) < 0.6) vol.set(x, G + h, z, hashf(x, z, 8) < 0.5 ? B('Leaves') : B('Mossy Dirt')); }
    });
    // Openings into the shaft on all four sides.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let k = 0; k < 12; k++) vol.fill(cx + dx * k - (dz ? 1 : 0), G, cz + dz * k - (dx ? 1 : 0), cx + dx * k + (dz ? 1 : 0), G + 3, cz + dz * k + (dx ? 1 : 0), 0);
    }
    vol.fill(x0, G, z0, x0 + s - 1, G + 12, z0 + s - 1, 0);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) vol.set(cx + dx * 9, G + 4, cz + dz * 9, B('Mese Crystal Ore'));
  } else {
    // Mine head: a timber frame over the shaft with a pulley, crates and lamps.
    vol.fill(ax0, G - 1, az0, ax1, G - 1, az1, B('Planks'));
    for (const [x, z] of [[ax0, az0], [ax1, az0], [ax0, az1], [ax1, az1]]) vol.fill(x, G, z, x, G + 7, z, B('Log'));
    vol.shell(ax0, G + 8, az0, ax1, G + 8, az1, B('Log'));
    vol.fill(ax0 + 1, G + 9, az0 + 1, ax1 - 1, G + 9, az1 - 1, B('Planks'));
    vol.fill(cx, G + 10, cz, cx, G + 11, cz, B('Log'));
    vol.set(cx, G + 7, cz, B('Steel Block'));
    for (let k = 0; k < 5; k++) vol.set(ax0 - 2, G, az0 + 2 + k * 3, rng.pick([B('wooden_barrel'), B('Planks'), B('Straw')]));
    for (const [x, z] of [[ax0, az0], [ax1, az1]]) vol.set(x, G + 8, z, B('Mese Lamp'));
  }
  // Re-open the top of the shaft (the stair arrives at ground level).
  const wallM = { dungeon: B('Stone Bricks'), caves: B('mossy_rock'), tunnels: B('Cobblestone') }[kind];
  vol.fill(x0, G - 1, z0, x0 + s - 1, G + 4, z0 + s - 1, 0);
  ringStair(vol, x0, z0, s, sh.yE, G, wallM, sh.start);
  vol.fill(x0 + 2, G - 1, z0 + 2, x0 + s - 3, G - 1, z0 + s - 3, B('Stone Bricks'));
  vol.set(x0 + 4, G, z0 + 4, B('Mese Post Light'));
  vol.marks.push(['under', cx, G, cz, kind, placeName(c.seed)]);
  // Finished: the way down is bricked over, with vines growing across it and a gold star on top.
  if (DONE.has(siteKey(c))) {
    vol.fill(x0, G - 3, z0, x0 + s - 1, G - 1, z0 + s - 1, B('Stone Bricks'));
    vol.fill(x0, G, z0, x0 + s - 1, G + 4, z0 + s - 1, 0);
    vol.each(x0, z0, x0 + s - 1, z0 + s - 1, (x, z) => { const r = hashf(x, z, c.seed, 0x5ea1); if (r < 0.35) vol.set(x, G - 1, z, B('Mossy Cobblestone')); else if (r < 0.6) vol.set(x, G, z, plantIds.ferns[hash(x, z) % plantIds.ferns.length]); });
    vol.set(cx, G, cz, B('Gold Block'));
  }
}
