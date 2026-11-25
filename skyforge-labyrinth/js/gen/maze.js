// The infinite labyrinth. The world is cut into regions of 32 x 32 maze cells (192 x 192 blocks). Each region is a
// spanning tree of corridors (plus a few loops) built only from its own seed, and every pair of neighbouring regions
// agrees on the openings in the wall between them, so the whole endless maze is one connected labyrinth.
// Regions also reserve rectangular clearings for castles, dungeon entrances, gardens and so on.
import { RNG, hash } from './util.js';

export const P = 6;          // cell pitch in blocks: walls 2 thick, corridors 4 wide
export const RC = 32;        // cells per region side
export const RS = P * RC;    // region size in blocks (192)

// Openings in the wall between region (rx, rz) and its east / south neighbour, row or column k.
function borderE(rx, rz, k, seed) { return hash(rx, rz, k, seed ^ 0x51e) % 6 === 0 || k === 2 + hash(rx, rz, seed ^ 0xe0) % 28; }
function borderS(rx, rz, k, seed) { return hash(rx, rz, k, seed ^ 0x5a5) % 6 === 0 || k === 2 + hash(rx, rz, seed ^ 0x50) % 28; }

const SIDE = { W: 0, E: 1, N: 2, S: 3 };

// Fixed regions around spawn: each of the four courtyard exits leads toward a different adventure.
const FIXED = { '0,0': 'spawn', '0,-1': 'castle', '1,0': 'dungeon', '0,1': 'caves', '-1,0': 'skycastle', '1,-1': 'tunnels', '-1,1': 'ruins', '1,1': 'floating', '-1,-1': 'castle' };

const cache = new Map();
export function regionPlan(rx, rz, seed) {
  const key = rx + ',' + rz + ',' + seed;
  let plan = cache.get(key);
  if (plan) return plan;
  plan = buildPlan(rx, rz, seed);
  cache.set(key, plan);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return plan;
}

function buildPlan(rx, rz, seed) {
  const rng = new RNG(hash(rx, rz, seed, 0x2e610));
  const X0 = rx * RS, Z0 = rz * RS;
  const type = FIXED[rx + ',' + rz] || rng.weighted([['castle', 30], ['skycastle', 10], ['floating', 14], ['dungeon', 17], ['caves', 13], ['tunnels', 13], ['ruins', 7]]);
  const plan = {
    rx, rz, X0, Z0, seed, type, rng,
    theme: rng.int(0, 1000),
    clear: new Int16Array(RC * RC).fill(-1),
    clearings: [],
    openE: new Uint8Array(RC * RC), openS: new Uint8Array(RC * RC),
    borderW: new Uint8Array(RC), borderN: new Uint8Array(RC),
    deadEnds: [],
  };
  for (let k = 0; k < RC; k++) {
    plan.borderW[k] = borderE(rx - 1, rz, k, seed) ? 1 : 0;
    plan.borderN[k] = borderS(rx, rz - 1, k, seed) ? 1 : 0;
    plan.openE[RC - 1 + k * RC] = borderE(rx, rz, k, seed) ? 1 : 0;
    plan.openS[k + (RC - 1) * RC] = borderS(rx, rz, k, seed) ? 1 : 0;
  }

  // --- Clearings ---
  const free = (i0, j0, i1, j1, gap = 1) => {
    if (i0 < 2 || j0 < 2 || i1 > RC - 3 || j1 > RC - 3) return false;
    for (let j = j0 - gap; j <= j1 + gap; j++) for (let i = i0 - gap; i <= i1 + gap; i++)
      if (i >= 0 && j >= 0 && i < RC && j < RC && plan.clear[i + j * RC] >= 0) return false;
    return true;
  };
  const add = (i0, j0, w, h, kind, extra = {}) => {
    const i1 = i0 + w - 1, j1 = j0 + h - 1, id = plan.clearings.length;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) plan.clear[i + j * RC] = id;
    const c = { id, kind, i0, j0, i1, j1, w, h, seed: hash(rx, rz, id, seed ^ 0xc1ea),
      bx0: X0 + P * i0 + 2, bz0: Z0 + P * j0 + 2, bx1: X0 + P * i1 + P - 1, bz1: Z0 + P * j1 + P - 1, openings: [], ...extra };
    plan.clearings.push(c);
    return c;
  };
  const place = (w, h, kind, tries = 40, extra) => {
    for (let t = 0; t < tries; t++) {
      const i0 = rng.int(2, RC - 2 - w), j0 = rng.int(2, RC - 2 - h);
      if (free(i0, j0, i0 + w - 1, j0 + h - 1)) return add(i0, j0, w, h, kind, extra);
    }
    return null;
  };

  let main = null;
  if (type === 'spawn') {
    main = add(10, 10, 11, 11, 'spawn');
    main.fixedOpenings = [[SIDE.W, 5], [SIDE.E, 5], [SIDE.N, 5], [SIDE.S, 5]];
  } else if (type === 'castle') {
    const w = rng.int(19, 24), h = rng.int(19, 24);
    main = add(rng.int(2, RC - 2 - w), rng.int(2, RC - 2 - h), w, h, 'castle');
  } else if (type === 'ruins') {
    const w = rng.int(13, 17), h = rng.int(13, 17);
    main = add(rng.int(3, RC - 3 - w), rng.int(3, RC - 3 - h), w, h, 'ruins');
  } else if (type === 'floating') {
    // A garden on the ground under a castle floating far overhead.
    main = add(11, 11, 10, 10, 'floating');
  } else if (type === 'skycastle') {
    main = add(rng.int(7, 11), rng.int(7, 11), 14, 14, 'skycastle');
  } else {
    main = place(5, 5, type + 'Entrance', 60);
  }
  plan.main = main;
  // The region's underground system lives below its whole footprint; its stairs come up in the main clearing
  // (castles keep their own crypts, so they get no other underground).
  plan.under = ['dungeon', 'caves', 'tunnels'].includes(type) ? type : type === 'spawn' ? 'tunnels' : null;
  if (type === 'spawn') plan.underEntrance = place(4, 4, 'tunnelsEntrance', 80);

  // Smaller features scattered through the maze.
  const nSmall = type === 'castle' ? rng.int(1, 3) : rng.int(4, 7);
  for (let n = 0; n < nSmall; n++) {
    const kind = rng.weighted([['statues', 14], ['fountain', 12], ['well', 7], ['watchtower', 10], ['shrine', 10], ['garden', 10],
      ['ruin', 9], ['obelisk', 6], ['pond', 7], ['gazebo', 7], ['grove', 8]]);
    const s = { statues: [3, 4], fountain: [3, 4], well: [2, 2], watchtower: [3, 3], shrine: [3, 4], garden: [3, 5], ruin: [3, 5],
      obelisk: [2, 3], pond: [3, 5], gazebo: [3, 3], grove: [3, 5] }[kind];
    place(rng.int(s[0], s[1]), rng.int(s[0], s[1]), kind, 30);
  }

  // --- Maze: Kruskal over cells; clearings are single nodes so corridors join them only where needed ---
  const N = RC * RC, parent = new Int32Array(N + plan.clearings.length);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const node = (i, j) => { const c = plan.clear[i + j * RC]; return c >= 0 ? N + c : i + j * RC; };
  const open = (i, j, dir) => { if (dir === 'E') plan.openE[i + j * RC] = 1; else plan.openS[i + j * RC] = 1; };
  const join = (a, b) => { const ra = find(a), rb = find(b); if (ra === rb) return false; parent[ra] = rb; return true; };
  // Walls inside a clearing are all open.
  for (let j = 0; j < RC; j++) for (let i = 0; i < RC; i++) {
    const c = plan.clear[i + j * RC]; if (c < 0) continue;
    if (i + 1 < RC && plan.clear[i + 1 + j * RC] === c) open(i, j, 'E');
    if (j + 1 < RC && plan.clear[i + (j + 1) * RC] === c) open(i, j, 'S');
  }
  // Openings a feature asks for (gate sides) come first.
  const sideCell = (c, side, k) => {
    // returns [i, j, dir] of the wall between the clearing and the outside cell on `side`, k cells along
    if (side === SIDE.W) return [c.i0 - 1, c.j0 + k, 'E'];
    if (side === SIDE.E) return [c.i1, c.j0 + k, 'E'];
    if (side === SIDE.N) return [c.i0 + k, c.j0 - 1, 'S'];
    return [c.i0 + k, c.j1, 'S'];
  };
  const outside = (c, side, k) => side === SIDE.W ? [c.i0 - 1, c.j0 + k] : side === SIDE.E ? [c.i1 + 1, c.j0 + k] : side === SIDE.N ? [c.i0 + k, c.j0 - 1] : [c.i0 + k, c.j1 + 1];
  for (const c of plan.clearings) {
    let want = c.fixedOpenings;
    if (!want) {
      // One gate in the middle of a random side, and sometimes a back door.
      const gate = rng.int(0, 3), len = gate < 2 ? c.h : c.w;
      want = [[gate, Math.floor(len / 2)]];
      c.gate = gate;
      if (c.w * c.h >= 12 && rng.chance(0.7)) { const s2 = gate ^ 1, l2 = s2 < 2 ? c.h : c.w; want.push([s2, rng.int(1, l2 - 2)]); }
    } else c.gate = SIDE.S;
    for (const [side, k] of want) {
      const [i, j, dir] = sideCell(c, side, k);
      open(i, j, dir);
      const [oi, oj] = outside(c, side, k);
      join(N + c.id, node(oi, oj));
      c.openings.push({ side, k });
    }
  }
  // Kruskal: corridor walls first (random order), then clearing walls only if a part would otherwise be cut off.
  const inner = [], edge = [];
  for (let j = 0; j < RC; j++) for (let i = 0; i < RC; i++) {
    for (const dir of ['E', 'S']) {
      const i2 = dir === 'E' ? i + 1 : i, j2 = dir === 'S' ? j + 1 : j;
      if (i2 >= RC || j2 >= RC) continue;
      const a = plan.clear[i + j * RC], b = plan.clear[i2 + j2 * RC];
      if (a >= 0 && a === b) continue;
      (a < 0 && b < 0 ? inner : edge).push([i, j, dir, i2, j2]);
    }
  }
  rng.shuffle(inner); rng.shuffle(edge);
  const rest = [];
  for (const e of inner) { if (join(node(e[0], e[1]), node(e[3], e[4]))) open(e[0], e[1], e[2]); else rest.push(e); }
  const spawnLike = c => c.fixedOpenings;
  for (const e of edge) {
    const a = plan.clear[e[0] + e[1] * RC], b = plan.clear[e[3] + e[4] * RC];
    const c = plan.clearings[a >= 0 ? a : b];
    if (spawnLike(c)) continue; // the courtyard keeps exactly its four exits
    if (join(node(e[0], e[1]), node(e[3], e[4]))) { open(e[0], e[1], e[2]); c.openings.push({ cell: [e[0], e[1], e[2]] }); }
  }
  // A few extra loops so the labyrinth isn't one long tree.
  for (const e of rest) if (rng.chance(0.07)) open(e[0], e[1], e[2]);

  // Dead ends (one open side): trees, statues and small hidden treasures go here.
  for (let j = 0; j < RC; j++) for (let i = 0; i < RC; i++) {
    if (plan.clear[i + j * RC] >= 0) continue;
    const w = i > 0 ? plan.openE[i - 1 + j * RC] : plan.borderW[j], e = plan.openE[i + j * RC];
    const n = j > 0 ? plan.openS[i + (j - 1) * RC] : plan.borderN[i], s = plan.openS[i + j * RC];
    if (w + e + n + s === 1) plan.deadEnds.push([i, j, w ? SIDE.W : e ? SIDE.E : n ? SIDE.N : SIDE.S]);
  }
  return plan;
}

// Is the block at region-local (lx, lz) part of a labyrinth wall?
export function isWall(plan, lx, lz) {
  const i = Math.floor(lx / P), j = Math.floor(lz / P), ox = lx - i * P, oz = lz - j * P;
  if (ox >= 2 && oz >= 2) return false;
  const C = plan.clear;
  if (ox < 2 && oz < 2) {
    if (i === 0 || j === 0) return true;
    const c = C[i + j * RC];
    return !(c >= 0 && C[i - 1 + j * RC] === c && C[i + (j - 1) * RC] === c && C[i - 1 + (j - 1) * RC] === c);
  }
  if (ox < 2) return i === 0 ? !plan.borderW[j] : !plan.openE[i - 1 + j * RC];
  return j === 0 ? !plan.borderN[i] : !plan.openS[i + (j - 1) * RC];
}
export const clearingAt = (plan, lx, lz) => plan.clear[Math.floor(lx / P) + Math.floor(lz / P) * RC];
export { SIDE };
