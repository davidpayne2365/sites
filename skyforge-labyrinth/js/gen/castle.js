// Castles. Every castle is drawn in its own frame with the gate facing south (+w), then turned to face the
// clearing's gate. Hand-made pieces (rooms, towers, gatehouses, furniture, statues) are put together by the
// castle's own seed, so no two are alike:
//   keep      — moat, curtain walls with walkways, corner towers, gatehouse, bailey, multi-level keep with crypt
//   palace    — formal gardens and a wide multi-wing palace with domed turrets
//   fortress  — one massive block, 4-6 floors of chained halls around an open courtyard
//   towers    — a cluster of tall towers joined by bridges high above the ground
//   ruins     — a crumbling, overgrown castle swallowed by the labyrinth
//   sky       — a castle on a rock spire you climb by a spiral path, or on a floating island reached by a stair tower
import { RNG, GROUND, hash, hashf, mix, fbm2, fbm3, placeName, DONE, siteKey } from './util.js';
import { B, tree, bush, monument, fountain, lampPost, well, brazier, chestId, flowerBed, chandelier, plantFor, statue, plantIds } from './decor.js';
import { facingOf } from '../blocks.js';
import { openingPoints, clearingGround } from './features.js';
import { ringStair, towerDoor } from './features.js';
import { SIDE } from './maze.js';

const G = GROUND;

// ---------------------------------------------------------------------------
// A transformed view of the volume: local (u, w) with the gate on the +w side.
// ---------------------------------------------------------------------------
class TVol {
  constructor(vol, c) {
    this.vol = vol;
    const g = c.gate;
    this.r = { [SIDE.S]: 0, [SIDE.W]: 1, [SIDE.N]: 2, [SIDE.E]: 3 }[g];
    const WX = c.bx1 - c.bx0 + 1, DZ = c.bz1 - c.bz0 + 1;
    this.W = this.r & 1 ? DZ : WX; this.D = this.r & 1 ? WX : DZ;
    const { bx0, bz0, bx1, bz1 } = c;
    // Integer cell mapping and continuous point mapping.
    if (this.r === 0) { this.cell = (u, w) => [bx0 + u, bz0 + w]; this.inv = (x, z) => [x - bx0, z - bz0]; this.pt = (u, w) => [bx0 + u, bz0 + w]; }
    else if (this.r === 2) { this.cell = (u, w) => [bx1 - u, bz1 - w]; this.inv = (x, z) => [bx1 - x, bz1 - z]; this.pt = (u, w) => [bx1 + 1 - u, bz1 + 1 - w]; }
    else if (this.r === 3) { this.cell = (u, w) => [bx0 + w, bz1 - u]; this.inv = (x, z) => [bz1 - z, x - bx0]; this.pt = (u, w) => [bx0 + w, bz1 + 1 - u]; }
    else { this.cell = (u, w) => [bx1 - w, bz0 + u]; this.inv = (x, z) => [z - bz0, bx1 - x]; this.pt = (u, w) => [bx1 + 1 - w, bz0 + u]; }
  }
  f(face) { return (face + this.r) & 3; }
  set(u, y, w, m) { const [x, z] = this.cell(u, w); this.vol.set(x, y, z, m); }
  put(u, y, w, m) { const [x, z] = this.cell(u, w); this.vol.put(x, y, z, m); }
  get(u, y, w) { const [x, z] = this.cell(u, w); return this.vol.get(x, y, z); }
  fill(u0, y0, w0, u1, y1, w1, m, onlyAir) { const [a, b] = this.cell(u0, w0), [c, d] = this.cell(u1, w1); this.vol.fill(a, y0, b, c, y1, d, m, onlyAir); }
  shell(u0, y0, w0, u1, y1, w1, m, t = 1) {
    this.fill(u0, y0, w0, u1, y1, w0 + t - 1, m); this.fill(u0, y0, w1 - t + 1, u1, y1, w1, m);
    this.fill(u0, y0, w0, u0 + t - 1, y1, w1, m); this.fill(u1 - t + 1, y0, w0, u1, y1, w1, m);
  }
  each(u0, w0, u1, w1, fn) {
    const [a, b] = this.cell(u0, w0), [c, d] = this.cell(u1, w1);
    this.vol.each(Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d), (x, z) => { const [u, w] = this.inv(x, z); fn(u, w); });
  }
  overlaps(u0, w0, u1, w1, m = 0) { const [a, b] = this.cell(u0, w0), [c, d] = this.cell(u1, w1); return this.vol.overlaps(Math.min(a, c) - m, Math.min(b, d) - m, Math.max(a, c) + m, Math.max(b, d) + m); }
  cyl(cu, cw, r, y0, y1, m, t = 0) { const [x, z] = this.pt(cu, cw); this.vol.cyl(x, z, r, y0, y1, m, t); }
  sphere(cu, cy, cw, r, m, onlyAir, minY) { const [x, z] = this.pt(cu, cw); this.vol.sphere(x, cy, z, r, m, onlyAir, minY); }
  chest(u, y, w, facing, coins, tier, home) { const [x, z] = this.cell(u, w); this.vol.chest(x, y, z, chestId(this.f(facing)), coins, tier, home); }
  coin(u, y, w, v = 1) { const [x, z] = this.cell(u, w); this.vol.coin(x, y, z, v); }
  portal(u0, y0, w0, u1, y1, w1, dest) { const [a, b] = this.cell(u0, w0), [c, d] = this.cell(u1, w1); this.vol.portal(a, y0, b, c, y1, d, dest); }
  get fx() { return { push: ([k, u, y, w, ...rest]) => { const [x, z] = this.pt(u, w); this.vol.fx.push([k, x, y, z, ...rest]); } }; }
  get coins() { return this.vol.coins; }
  get chests() { return this.vol.chests; }
  get marks() { return this.vol.marks; }
}

// ---------------------------------------------------------------------------
// Styles: the materials of a castle.
// ---------------------------------------------------------------------------
const M = mix;
function styles() {
  const S = (name, o) => ({ name, ...o });
  return [
    S('Grey Keep', { wall: M([[B('castle_brick_01'), 12], [B('castle_wall_varriation'), 2]], 1, 6), inner: B('plastered_stone_wall'),
      trim: B('Stone Block'), floor: B('stone_tiles'), floor2: B('old_wooden_floor_01'), roof: B('grey_roof_tiles'),
      pillar: B('Stone Block'), wood: B('dark_wood'), carpet: B('Red Wool'), banner: B('Red Wool'), window: B('Iron Bars'), slab: B('Stone Bricks Slab'), path: B('cobblestone_floor_08') }),
    S('Red Castle', { wall: M([[B('castle_brick_02_red'), 12], [B('medieval_red_brick'), 2]], 2, 6), inner: B('white_plaster_rough_01'),
      trim: B('castle_brick_02_white'), floor: B('herringbone_brick'), floor2: B('oak_veneer_01'), roof: B('red_slate_roof_tiles_01'),
      pillar: B('castle_brick_02_white'), wood: B('Planks'), carpet: B('Blue Wool'), banner: B('Blue Wool'), window: B('Glass'), slab: B('Castle Brick 02 Red Slab'), path: B('brick_pavement') }),
    S('White Palace', { wall: M([[B('castle_brick_02_white'), 12], [B('white_sandstone_bricks'), 2]], 3, 6), inner: B('white_stucco'),
      trim: B('marble_01'), floor: B('marble_tiles'), floor2: B('marble_01'), roof: B('blue_metal_plate'), pillar: B('marble_01'), wood: B('white_oak_veneer'),
      carpet: B('Violet Wool'), banner: B('Violet Wool'), window: B('Framed Glass'), slab: B('Marble 01 Slab'), path: B('marble_mosaic_tiles'), gold: true }),
    S('Desert Fortress', { wall: M([[B('sandstone_blocks_05'), 12], [B('Sandstone Bricks'), 2]], 4, 6), inner: B('clay_plaster'),
      trim: B('Sandstone Block'), floor: B('terracotta_floor_tiles'), floor2: B('red_sandstone_tiles'), roof: B('clay_roof_tiles_02'), pillar: B('Sandstone Block'),
      wood: B('Acacia Planks'), carpet: B('Orange Wool'), banner: B('Orange Wool'), window: B('Iron Bars'), slab: B('Sandstone Bricks Slab'), path: B('Desert Sand') }),
    S('Obsidian Citadel', { wall: M([[B('Obsidian Bricks'), 12], [B('Obsidian Block'), 1]], 5, 6), inner: B('dark_brick_wall'),
      trim: B('Obsidian Block'), floor: B('volcanic_herringbone_01'), floor2: B('Obsidian Block'), roof: B('roof_slates_02'), pillar: B('Obsidian Block'),
      wood: B('flamed_black_veneer'), carpet: B('Magenta Wool'), banner: B('Black Wool'), window: B('Obsidian Glass'), slab: B('Obsidian Bricks Slab'), path: B('Obsidian Bricks'), lava: true }),
    S('Mossy Stronghold', { wall: M([[B('mossy_stone_wall'), 10], [B('castle_brick_broken_06'), 2], [B('mossy_brick'), 1]], 6, 6), inner: B('old_stone_wall'),
      trim: B('Mossy Cobblestone'), floor: B('mossy_brick_floor'), floor2: B('old_wooden_floor_02'), roof: B('roof_slates_03'), pillar: B('mossy_rock'),
      wood: B('weathered_brown_planks'), carpet: B('Dark Green Wool'), banner: B('Green Wool'), window: B('Iron Bars'), slab: B('Mossy Cobblestone Slab'), path: B('grassy_cobblestone') }),
    S('Ice Palace', { wall: M([[B('Ice'), 10], [B('Silver Sandstone Bricks'), 3]], 7, 6), inner: B('Silver Sandstone'), trim: B('Silver Sandstone Bricks'),
      floor: B('Ice'), floor2: B('marble_tiles'), roof: B('Snow'), pillar: B('Silver Sandstone Bricks'), wood: B('Aspen Planks'), carpet: B('Cyan Wool'), banner: B('Cyan Wool'),
      window: B('Glass'), slab: B('Ice Slab'), path: B('Silver Sand') }),
    S('Timber Hall', { wall: M([[B('beam_wall_01'), 8], [B('medieval_wall_01'), 4]], 8, 6), inner: B('medieval_wall_01'), trim: B('dark_wood'),
      floor: B('old_wooden_floor_03'), floor2: B('wooden_floor_02'), roof: B('thatch_roof_angled'), pillar: B('Log'), wood: B('Planks'), carpet: B('Brown Wool'),
      banner: B('Yellow Wool'), window: B('Glass'), slab: B('Planks Slab'), path: B('Gravel') }),
    S('Gothic Cathedral', { wall: M([[B('church_bricks_02'), 12], [B('church_bricks_03'), 2]], 9, 6), inner: B('grey_plaster_02'), trim: B('defense_wall'),
      floor: B('patterned_slate_tiles'), floor2: B('slate_floor'), roof: B('roof_slates_02'), pillar: B('defense_wall'), wood: B('smoked_walnut_veneer'), carpet: B('Red Wool'),
      banner: B('Black Wool'), window: B('Obsidian Glass'), slab: B('Church Bricks 02 Slab'), path: B('slate_driveway') }),
    S('Golden Temple', { wall: M([[B('yellow_stone_wall'), 12], [B('yellow_bricks'), 2]], 10, 6), inner: B('yellow_plaster'), trim: B('Gold Block'),
      floor: B('sandstone_blocks_08'), floor2: B('Gold Block'), roof: B('Gold Block'), pillar: B('Sandstone Block'), wood: B('teak_veneer'), carpet: B('Red Wool'),
      banner: B('Yellow Wool'), window: B('Framed Glass'), slab: B('Yellow Stone Wall Slab'), path: B('Sandstone Bricks'), gold: true }),
    S('Mountain Fort', { wall: M([[B('japanese_stone_wall'), 12], [B('stacked_stone_wall'), 2]], 11, 6), inner: B('clay_block_wall'),
      trim: B('dark_wood'), floor: B('japanese_cedar_planks'), floor2: B('stone_floor'), roof: B('ceramic_roof_01'), pillar: B('dark_wood'), wood: B('hinoki_planks'),
      carpet: B('Tan Wool'), banner: B('White Wool'), window: B('Iron Bars'), slab: B('Japanese Stone Wall Slab'), path: B('stone_pathway') }),
    S('Coral Fort', { wall: M([[B('coral_fort_wall_01'), 12], [B('coral_fort_wall_02'), 2]], 12, 6), inner: B('white_plaster_02'), trim: B('Coral Skeleton'),
      floor: B('seaworn_stone_tiles'), floor2: B('blue_floor_tiles_01'), roof: B('Cyan Coral'), pillar: B('Coral Skeleton'), wood: B('washed_grey_oak_veneer'),
      carpet: B('Cyan Wool'), banner: B('Pink Wool'), window: B('Glass'), slab: B('Coral Fort Wall 01 Slab'), path: B('aerial_beach_01') }),
  ];
}
let STY = null;
export const castleStyles = () => STY || (STY = styles());

// ---------------------------------------------------------------------------
// Buildings: a footprint cut into rooms (BSP), several levels joined by doors and straight stairs, each room
// furnished according to its type. Returns the room graph; the deepest room gets the treasure.
// ---------------------------------------------------------------------------
const LH = 6; // level height: 5 air + 1 floor
// What the guided-route builder managed for each building (read by tools/castle-test.mjs).
export const CHAIN_LOG = [];
const ROUTE_CACHE = new Map();
// Room sets per kind of castle: each castle shows its own kinds of rooms (and crypt rooms), first room first.
const THEMES = {
  classic: { first: 'hall', rooms: ['dining', 'kitchen', 'armory', 'chapel', 'library', 'throne', 'bedroom', 'gallery', 'study', 'music', 'smithy', 'storage'], crypt: ['crypt', 'ossuary', 'prison', 'catacomb'] },
  royal: { first: 'hall', rooms: ['ballroom', 'throne', 'dining', 'gallery', 'music', 'library', 'fountainhall', 'greenhouse', 'bedroom', 'study', 'aquarium', 'observatory'], crypt: ['vault', 'crypt', 'catacomb'] },
  military: { first: 'hall', rooms: ['armory', 'barracks', 'smithy', 'storage', 'kitchen', 'prison', 'chapel', 'dining', 'study', 'throne', 'vault'], crypt: ['prison', 'vault', 'crypt', 'ossuary'] },
  wizard: { first: 'library', rooms: ['alchemy', 'observatory', 'study', 'gallery', 'music', 'greenhouse', 'aquarium', 'library', 'fountainhall'], crypt: ['vault', 'catacomb', 'crypt'] },
  ruin: { first: 'hall', rooms: ['crypt', 'storage', 'chapel', 'greenhouse', 'armory', 'ossuary', 'gallery', 'catacomb'], crypt: ['catacomb', 'ossuary', 'crypt'] },
  dracula: { first: 'coffins', rooms: ['coffins', 'ballroom', 'gallery', 'library', 'chapel', 'alchemy', 'throne', 'music', 'dining', 'prison', 'ossuary'], crypt: ['coffins', 'crypt', 'ossuary', 'catacomb'] },
  cloud: { first: 'fountainhall', rooms: ['ballroom', 'observatory', 'music', 'greenhouse', 'gallery', 'aquarium', 'throne', 'bedroom', 'fountainhall'], crypt: ['vault', 'catacomb'] },
  crystal: { first: 'fountainhall', rooms: ['alchemy', 'observatory', 'library', 'vault', 'gallery', 'aquarium', 'study', 'music'], crypt: ['vault', 'crypt', 'catacomb'] },
  ember: { first: 'hall', rooms: ['smithy', 'armory', 'barracks', 'throne', 'vault', 'kitchen', 'prison', 'storage', 'dining'], crypt: ['prison', 'vault', 'ossuary'] },
  jade: { first: 'fountainhall', rooms: ['greenhouse', 'chapel', 'library', 'music', 'aquarium', 'study', 'dining', 'gallery', 'observatory'], crypt: ['vault', 'crypt'] },
};
function building(T, o) {
  const { S, rng } = o;
  const x0 = o.x0, z0 = o.z0, x1 = o.x1, z1 = o.z1, y0 = o.y0 ?? G, levels = o.levels, et = o.et ?? 2;
  const ix0 = x0 + et, iz0 = z0 + et, ix1 = x1 - et, iz1 = z1 - et;
  const minR = o.minR ?? 8, maxR = o.maxR ?? rng.int(12, 18);
  // --- rooms ---
  const rooms = [];
  (function split(r, depth) {
    const w = r.x1 - r.x0 + 1, d = r.z1 - r.z0 + 1;
    const canX = w >= 2 * minR + 1, canZ = d >= 2 * minR + 1;
    const big = w > maxR || d > maxR;
    if ((!canX && !canZ) || (!big && depth > 0) || (depth > 1 && w <= 26 && d <= 26 && rng.chance(o.hallChance ?? 0.12))) { rooms.push({ ...r, id: rooms.length }); return; }
    const alongX = canX && (!canZ || w > d || (w === d && rng.chance(0.5)));
    if (alongX) { const p = rng.int(r.x0 + minR, r.x1 - minR); split({ x0: r.x0, z0: r.z0, x1: p - 1, z1: r.z1 }, depth + 1); split({ x0: p + 1, z0: r.z0, x1: r.x1, z1: r.z1 }, depth + 1); }
    else { const p = rng.int(r.z0 + minR, r.z1 - minR); split({ x0: r.x0, z0: r.z0, x1: r.x1, z1: p - 1 }, depth + 1); split({ x0: r.x0, z0: p + 1, x1: r.x1, z1: r.z1 }, depth + 1); }
  })({ x0: ix0, z0: iz0, x1: ix1, z1: iz1 }, 0);
  // Adjacency through 1-thick walls.
  const adj = [];
  for (const a of rooms) for (const b of rooms) {
    if (a.id >= b.id) continue;
    if (a.x1 + 2 === b.x0 || b.x1 + 2 === a.x0) {
      const lo = Math.max(a.z0, b.z0), hi = Math.min(a.z1, b.z1);
      if (hi - lo >= 3) adj.push({ a: a.id, b: b.id, axis: 'x', wall: a.x1 + 2 === b.x0 ? a.x1 + 1 : b.x1 + 1, lo, hi });
    }
    if (a.z1 + 2 === b.z0 || b.z1 + 2 === a.z0) {
      const lo = Math.max(a.x0, b.x0), hi = Math.min(a.x1, b.x1);
      if (hi - lo >= 3) adj.push({ a: a.id, b: b.id, axis: 'z', wall: a.z1 + 2 === b.z0 ? a.z1 + 1 : b.z1 + 1, lo, hi });
    }
  }
  // Rooms that exist on each level (upper levels can step back, leaving roof terraces).
  const crypt = o.crypt ? 1 : 0;
  let L0 = -crypt; const LtopPlan = levels - 1;
  const present = {};
  present[0] = new Set(rooms.map(r => r.id));
  const nbr = id => adj.filter(e => e.a === id || e.b === id).map(e => (e.a === id ? e.b : e.a));
  for (let L = 1; L <= LtopPlan; L++) {
    const prev = [...present[L - 1]];
    if (!o.setback || prev.length <= 2 || rng.chance(0.45)) { present[L] = new Set(prev); continue; }
    // Keep a connected ~70% of the rooms (grown from a random one).
    const keep = new Set([rng.pick(prev)]), want = Math.max(2, Math.round(prev.length * rng.range(0.55, 0.8)));
    while (keep.size < want) {
      const cand = [...keep].flatMap(nbr).filter(id => present[L - 1].has(id) && !keep.has(id));
      if (!cand.length) break;
      keep.add(rng.pick(cand));
    }
    present[L] = keep;
  }
  if (crypt) {
    // A smaller connected crypt under part of the building.
    const keep = new Set([rng.pick(rooms).id]), want = Math.max(2, Math.min(rooms.length, rng.int(3, 6)));
    while (keep.size < want) { const cand = [...keep].flatMap(nbr).filter(id => !keep.has(id)); if (!cand.length) break; keep.add(rng.pick(cand)); }
    present[-1] = keep;
  }
  const yOf = L => y0 + L * LH;
  // Occupancy per level: 0 free, 1 keep clear (walkways), 2 blocked (stairs, holes, railings).
  const OW = x1 - x0 + 1, OD = z1 - z0 + 1;
  const occ = {};
  for (let L = L0; L <= LtopPlan + 1; L++) occ[L] = new Uint8Array(OW * OD);
  const oget = (L, x, z) => (x < x0 || x > x1 || z < z0 || z > z1 ? 2 : occ[L][(x - x0) + (z - z0) * OW]);
  const oset = (L, x, z, v) => { if (x >= x0 && x <= x1 && z >= z0 && z <= z1) { const i = (x - x0) + (z - z0) * OW; occ[L][i] = Math.max(occ[L][i], v); } };
  const orect = (L, ax, az, bx, bz, v) => { for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++) for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) oset(L, x, z, v); };

  // --- entrances on level 0 (and terrace doors) ---
  const entrances = [];
  for (const en of (o.entrances || [{ side: 'S' }]).slice(0, o.chain === false ? 9 : 1)) {
    const side = en.side;
    const cands = rooms.filter(r => present[0].has(r.id) && (side === 'S' ? r.z1 === iz1 : side === 'N' ? r.z0 === iz0 : side === 'W' ? r.x0 === ix0 : r.x1 === ix1));
    if (!cands.length) continue;
    let r = cands[0], best = Infinity;
    const want = en.at ?? (side === 'S' || side === 'N' ? (x0 + x1) / 2 : (z0 + z1) / 2);
    for (const c of cands) {
      const m = side === 'S' || side === 'N' ? (c.x0 + c.x1) / 2 : (c.z0 + c.z1) / 2;
      if (Math.abs(m - want) < best) { best = Math.abs(m - want); r = c; }
    }
    const lo = side === 'S' || side === 'N' ? r.x0 : r.z0, hi = side === 'S' || side === 'N' ? r.x1 : r.z1;
    let at = Math.round(Math.max(lo + 1, Math.min(hi - 3, want - 1)));
    const cells = t => side === 'S' ? [[t, iz1], [t + 1, iz1], [t + 2, iz1], [t, iz1 - 1], [t + 1, iz1 - 1], [t + 2, iz1 - 1]]
      : side === 'N' ? [[t, iz0], [t + 1, iz0], [t + 2, iz0], [t, iz0 + 1], [t + 1, iz0 + 1], [t + 2, iz0 + 1]]
        : side === 'W' ? [[ix0, t], [ix0, t + 1], [ix0, t + 2], [ix0 + 1, t], [ix0 + 1, t + 1], [ix0 + 1, t + 2]]
          : [[ix1, t], [ix1, t + 1], [ix1, t + 2], [ix1 - 1, t], [ix1 - 1, t + 1], [ix1 - 1, t + 2]];
    for (let k = 0; k < hi - lo && !cells(at).every(([x, z]) => oget(0, x, z) < 2); k++) at = lo + 1 + ((at - lo) % Math.max(1, hi - lo - 3));
    if (!cells(at).every(([x, z]) => oget(0, x, z) < 2)) continue;
    for (const [x, z] of cells(at)) oset(0, x, z, 1);
    entrances.push({ side, at, room: r.id });
  }
  // --- the guided way through: one route from the entrance through every room on every floor, each room with
  // a single way on (a doorway, or stairs up or down), ending in the treasure room ---
  const chainLog = { seed: o.seed, theme: o.theme, rooms: 0, ok: false };
  let chain = null;
  const doors = []; // { L, e, at, open }
  const stairs = []; // { L (from), room, cells... }
  const roofAccess = o.roof === 'terrace';
  let Ltop = levels - 1;
  const terraceDoors = [];
  const stairFit = (L, r) => { const w = r.x1 - r.x0 + 1, d = r.z1 - r.z0 + 1, sw = Math.min(3, Math.max(2, Math.floor(Math.min(w, d) / 4))); return (w >= LH + 4 && d >= sw + 4) || (d >= LH + 4 && w >= sw + 4); };
  const reserveStair = st => {
    for (const [x, z] of st.steps) oset(st.L, x, z, 2);
    for (const [x, z] of st.approach) oset(st.L, x, z, 1);
    for (const [x, z] of st.steps) oset(st.L + 1, x, z, 2);
    for (const [x, z] of st.rail) oset(st.L + 1, x, z, 2);
    for (const [x, z] of st.arrive) oset(st.L + 1, x, z, 1);
  };
  const doorCells = (e, t) => e.axis === 'x' ? [[e.wall - 1, t], [e.wall - 1, t + 1], [e.wall + 1, t], [e.wall + 1, t + 1], [e.wall - 2, t], [e.wall + 2, t], [e.wall - 2, t + 1], [e.wall + 2, t + 1]]
    : [[t, e.wall - 1], [t + 1, e.wall - 1], [t, e.wall + 1], [t + 1, e.wall + 1], [t, e.wall - 2], [t, e.wall + 2], [t + 1, e.wall - 2], [t + 1, e.wall + 2]];
  if (o.chain !== false && entrances.length) {
    // The search has its own random stream and its result is cached, so every chunk of the castle gets the same
    // route without searching again.
    const ckey = `${o.seed}:${x0},${z0},${x1},${z1},${y0}:${levels}:${entrances[0].room}`;
    const cached = ROUTE_CACHE.get(ckey);
    if (cached) {
      for (const k in occ) delete occ[k];
      for (const k in cached.occ) occ[k] = cached.occ[k].slice();
      // The floors exactly as the route left them (the crypt may have been regrown or dropped).
      for (const k of Object.keys(present)) delete present[k];
      for (const [k, ids] of cached.present) present[k] = new Set(ids);
      if (!present[-1]) L0 = 0;
      if (cached.chain) {
        Ltop = cached.Ltop; doors.push(...cached.doors); stairs.push(...cached.stairs); chain = cached.chain;
      }
    } else {
      chain = planRoute();
      ROUTE_CACHE.set(ckey, { occ: Object.fromEntries(Object.entries(occ).map(([k, v]) => [k, v.slice()])), chain, Ltop, doors: [...doors], stairs: [...stairs], present: Object.entries(present).map(([k, v]) => [Number(k), [...v]]) });
      if (ROUTE_CACHE.size > 400) ROUTE_CACHE.delete(ROUTE_CACHE.keys().next().value);
    }
    if (chain) { chainLog.ok = true; chainLog.rooms = chain.length; chainLog.suites = chain.filter(c => c.suite).length; }
  }
  // The route, floor by floor: walk every room of a floor (ending in a room with space for stairs), climb, and
  // carry on, up to the top floor, where the last room is the treasure room. A crypt comes first: straight down
  // from the entrance room, round the crypt, and back up into the ground floor. Every floor is always kept: where a
  // floor's rooms can't all be walked in one line, a room is opened up into a neighbour (one stop of two rooms).
  function planRoute() {
    const srng = new RNG(hash(o.seed, 0x5e0d));
    const snap = () => Object.fromEntries(Object.entries(occ).map(([k, v]) => [k, v.slice()]));
    const restore = sn => { for (const k in occ) delete occ[k]; for (const k in sn) occ[k] = sn[k]; };
    const occ0 = snap();
    const sz = r => (r.x1 - r.x0 + 1) * (r.z1 - r.z0 + 1);
    const edge = (a, b) => adj.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    const tryStairS = (L, r) => {
      const w = r.x1 - r.x0 + 1, d = r.z1 - r.z0 + 1;
      const sw = Math.min(3, Math.max(2, Math.floor(Math.min(w, d) / 4)));
      const opts = [];
      if (w >= LH + 4 && d >= sw + 4) for (const side of ['N', 'S']) for (const dir of [1, -1]) opts.push({ along: 'x', side, dir });
      if (d >= LH + 4 && w >= sw + 4) for (const side of ['W', 'E']) for (const dir of [1, -1]) opts.push({ along: 'z', side, dir });
      srng.shuffle(opts);
      for (const op of opts) {
        const st = stairCells(r, op, sw);
        const ok = st.steps.every(([x, z]) => oget(L, x, z) === 0 && oget(L + 1, x, z) === 0)
          && st.rail.every(([x, z]) => oget(L + 1, x, z) === 0)
          && st.approach.every(([x, z]) => oget(L, x, z) < 2) && st.arrive.every(([x, z]) => oget(L + 1, x, z) < 2);
        if (ok) return { L, room: r.id, ...st, sw };
      }
      return null;
    };
    // One floor: a line from `s` through all its rooms (but `skip`), ending in one of `ends` (any room if null).
    // Returns { path, merges } where merges open missed rooms into visited neighbours.
    const routeFloor = (L, s, ends, skip, forbidEnd) => {
      const R = [...present[L]].filter(id => !skip.has(id));
      if (!R.includes(s)) return null;
      const nb = id => adj.filter(e => e.a === id || e.b === id).map(e => (e.a === id ? e.b : e.a)).filter(x => R.includes(x));
      const isEnd = id => (ends ? ends.has(id) : true) && !forbidEnd.has(id);
      const tie = new Map(R.map(id => [id, srng.next()]));
      const seen = new Set([s]), path = [s];
      let best = null, steps = 0;
      const cap = 2000 + 150 * R.length;
      const dfs = n => {
        if (isEnd(n) && (!best || path.length > best.length)) best = path.slice();
        if (path.length === R.length && isEnd(n)) return true;
        if (++steps > cap) return false;
        const cand = nb(n).filter(m => !seen.has(m));
        const left = R.length - path.length;
        // Fewest ways on first; near the end, head for a room the stairs can leave from.
        const score = m => nb(m).filter(q => !seen.has(q)).length + tie.get(m) * 0.5 - (left <= 2 && isEnd(m) ? 5 : 0);
        cand.sort((x, y) => score(x) - score(y));
        for (const m of cand) { seen.add(m); path.push(m); if (dfs(m)) return true; seen.delete(m); path.pop(); }
        return false;
      };
      dfs(s);
      if (!best) return null;
      // Open each missed room into a neighbour on the line (or into a room already opened onto it).
      const owner = new Map(best.map(id => [id, id]));
      const merges = [];
      for (let changed = true; changed;) {
        changed = false;
        for (const id of R) {
          if (owner.has(id)) continue;
          const to = nb(id).filter(x => owner.has(x)).sort((a, b2) => sz(rooms[a]) - sz(rooms[b2]))[0];
          if (to === undefined) continue;
          owner.set(id, owner.get(to)); merges.push({ L, child: id, into: to, rep: owner.get(to), e: edge(id, to) }); changed = true;
        }
      }
      if (R.some(id => !owner.has(id))) return null;
      return { L, path: best, merges };
    };
    const stairable = (L, id) => present[L + 1] && present[L + 1].has(id) && stairFit(L, rooms[id]);
    const forbidEnd = {}; // floor -> Set of rooms its route may not end in (their stairs didn't fit)
    const fe = L => forbidEnd[L] || (forbidEnd[L] = new Set());
    // The crypt lies under the entrance room (the route goes down into it first), grown out from there.
    if (present[-1] && !present[-1].has(entrances[0].room) && stairFit(-1, rooms[entrances[0].room])) {
      const want = present[-1].size, keep = new Set([entrances[0].room]);
      while (keep.size < want) {
        const cand = [...keep].flatMap(id => adj.filter(e => e.a === id || e.b === id).map(e => (e.a === id ? e.b : e.a))).filter(id => !keep.has(id));
        if (!cand.length) break;
        keep.add(cand[Math.floor(srng.next() * cand.length)]);
      }
      present[-1] = keep;
    }
    let useCrypt = !!present[-1];
    for (let attempt = 0; attempt < 30; attempt++) {
      restore(snap());
      const sn = snap();
      const s0 = entrances[0].room;
      const segs = []; // { L, path, merges }
      let ok = true;
      // Crypt first, if the entrance room has one underneath with room for stairs down.
      const cryptHere = useCrypt && present[-1].has(s0) && stairFit(-1, rooms[s0]);
      let groundStart = s0, groundSkip = new Set();
      if (cryptHere) {
        const ends = new Set([...present[-1]].filter(id => id !== s0 && present[0].has(id) && stairFit(-1, rooms[id])));
        const seg = ends.size ? routeFloor(-1, s0, ends, new Set(), fe(-1)) : null;
        if (!seg) { useCrypt = false; continue; }
        segs.push({ L: 0, path: [s0], merges: [] }, seg);
        groundStart = seg.path[seg.path.length - 1]; groundSkip = new Set([s0]);
      } else useCrypt = false;
      for (let L = 0; L <= LtopPlan && ok; L++) {
        const ends = L < LtopPlan ? new Set([...present[L]].filter(id => stairable(L, id))) : null;
        const start = L === 0 ? groundStart : segs[segs.length - 1].path[segs[segs.length - 1].path.length - 1];
        const seg = routeFloor(L, start, ends, L === 0 ? groundSkip : new Set(), fe(L));
        if (!seg) { ok = false; break; }
        segs.push(seg);
      }
      if (!ok) { if (useCrypt) { useCrypt = false; continue; } break; }
      // Build: stairs between the floors, then the doorways along each floor's line.
      let fail = null;
      const placedStairs = [], placedDoors = [];
      const climbs = []; // [lower floor, room]
      for (let i = 1; i < segs.length; i++) {
        const a = segs[i - 1], b = segs[i];
        const from = a.path[a.path.length - 1];
        if (a.L === 0 && b.L === -1) climbs.push([-1, from]);
        else if (a.L === -1) climbs.push([-1, from]);
        else climbs.push([a.L, from]);
      }
      for (const [L, id] of climbs) {
        const st = tryStairS(L, rooms[id]);
        if (!st) { fail = [L === -1 && id === s0 ? null : L, id]; break; }
        reserveStair(st); placedStairs.push(st);
      }
      if (!fail) for (const seg of segs) {
        for (const m of seg.merges) for (let t = m.e.lo + 1; t <= m.e.hi - 1; t++) for (const dd of [-1, 1]) { if (m.e.axis === 'x') oset(seg.L, m.e.wall + dd, t, 1); else oset(seg.L, t, m.e.wall + dd, 1); }
        for (let i = 1; i < seg.path.length && !fail; i++) {
          const e = edge(seg.path[i - 1], seg.path[i]), opts = [];
          for (let t = e.lo + 1; t <= e.hi - 2; t++) if (doorCells(e, t).every(([x, z]) => oget(seg.L, x, z) < 2)) opts.push(t);
          if (!opts.length) { fail = ['door', seg.L]; break; }
          const at = opts[Math.floor(opts.length / 2)];
          for (const [x, z] of doorCells(e, at)) oset(seg.L, x, z, 1);
          placedDoors.push({ L: seg.L, e, at, open: false });
        }
        if (fail) break;
      }
      if (fail) {
        restore(sn);
        if (fail[0] === 'door') { for (let L = fail[1]; L >= -1; L--) fe(L); srng.next(); }
        else if (fail[0] === null) useCrypt = false;
        else fe(fail[0]).add(fail[1]);
        continue;
      }
      for (const seg of segs) for (const m of seg.merges) placedDoors.push({ L: seg.L, e: m.e, at: m.e.lo + 1, open: true });
      // Success: every floor is on the route.
      if (!useCrypt && present[-1]) { delete present[-1]; L0 = 0; }
      Ltop = LtopPlan;
      doors.push(...placedDoors); stairs.push(...placedStairs);
      // The route as a list of rooms, each stop followed by any rooms opened into it; the treasure room last.
      const out = [];
      for (const seg of segs) for (const id of seg.path) {
        if (out.some(c => c.L === seg.L && c.id === id)) continue;
        out.push({ L: seg.L, id });
        for (const m of seg.merges) if (m.rep === id) out.push({ L: seg.L, id: m.child, suite: true });
      }
      const lastSeg = segs[segs.length - 1], lastId = lastSeg.path[lastSeg.path.length - 1];
      const lastI = out.findIndex(c => c.L === lastSeg.L && c.id === lastId && !c.suite);
      const tail = out.splice(lastI, 1)[0];
      out.push(tail);
      // From the treasure room, the way up to the roof (roof terraces, bridges) if there is one.
      if (roofAccess) { const st = tryStairS(Ltop, rooms[lastId]); if (st) { reserveStair(st); stairs.push(st); } }
      return out;
    }
    restore(occ0);
    return null;
  }
  chainLog.levels = Ltop + 1; chainLog.planned = LtopPlan + 1; chainLog.crypt = !!present[-1]; chainLog.wantCrypt = !!o.crypt;
  CHAIN_LOG.push(chainLog);
  if (!chain) {
  // --- doors (a spanning tree per level plus some loops; some walls removed for great halls) ---
  for (let L = L0; L <= levels - 1; L++) {
    const here = present[L];
    const parent = new Map(); for (const id of here) parent.set(id, id);
    const find = a => { while (parent.get(a) !== a) a = parent.get(a); return a; };
    const edges = rng.shuffle(adj.filter(e => here.has(e.a) && here.has(e.b)));
    for (const e of edges) {
      const ra = find(e.a), rb = find(e.b);
      const tree = ra !== rb;
      if (!tree && !rng.chance(0.3)) continue;
      // Door position: avoid stairs and holes on both sides.
      const opts = [];
      for (let t = e.lo + 1; t <= e.hi - 2; t++) {
        const cells = e.axis === 'x' ? [[e.wall - 1, t], [e.wall - 1, t + 1], [e.wall + 1, t], [e.wall + 1, t + 1], [e.wall - 2, t], [e.wall + 2, t], [e.wall - 2, t + 1], [e.wall + 2, t + 1]]
          : [[t, e.wall - 1], [t + 1, e.wall - 1], [t, e.wall + 1], [t + 1, e.wall + 1], [t, e.wall - 2], [t, e.wall + 2], [t + 1, e.wall - 2], [t + 1, e.wall + 2]];
        if (cells.every(([x, z]) => oget(L, x, z) < 2)) opts.push(t);
      }
      if (!opts.length) continue;
      const open = tree && rng.chance(o.openChance ?? 0.1) && e.hi - e.lo < 20 && opts.length === e.hi - e.lo - 2;
      const at = rng.pick(opts);
      doors.push({ L, e, at, open });
      if (tree) parent.set(ra, rb);
      else if (!tree) { /* loop door */ }
      const cells = e.axis === 'x' ? [[e.wall - 1, at], [e.wall - 1, at + 1], [e.wall + 1, at], [e.wall + 1, at + 1], [e.wall - 2, at], [e.wall + 2, at], [e.wall - 2, at + 1], [e.wall + 2, at + 1]]
        : [[at, e.wall - 1], [at + 1, e.wall - 1], [at, e.wall + 1], [at + 1, e.wall + 1], [at, e.wall - 2], [at, e.wall + 2], [at + 1, e.wall - 2], [at + 1, e.wall + 2]];
      for (const [x, z] of cells) oset(L, x, z, 1);
    }
  }
  // Terrace doors: rooms on a level next to a room that stops below (its roof is a terrace).
  for (let L = 1; L <= LtopPlan; L++) for (const e of adj) {
    const ha = present[L].has(e.a), hb = present[L].has(e.b);
    if (ha === hb || !present[L - 1].has(ha ? e.b : e.a)) continue;
    if (!rng.chance(0.5)) continue;
    const inRoom = ha ? e.a : e.b;
    const opts = [];
    for (let t = e.lo + 1; t <= e.hi - 2; t++) {
      const cells = e.axis === 'x' ? [[e.wall - 1, t], [e.wall - 1, t + 1], [e.wall + 1, t], [e.wall + 1, t + 1]] : [[t, e.wall - 1], [t + 1, e.wall - 1], [t, e.wall + 1], [t + 1, e.wall + 1]];
      if (cells.every(([x, z]) => oget(L, x, z) < 2)) opts.push(t);
    }
    if (!opts.length) continue;
    const at = rng.pick(opts);
    terraceDoors.push({ L, e, at, room: inRoom });
    const cells = e.axis === 'x' ? [[e.wall - 1, at], [e.wall - 1, at + 1], [e.wall + 1, at], [e.wall + 1, at + 1]] : [[at, e.wall - 1], [at + 1, e.wall - 1], [at, e.wall + 1], [at + 1, e.wall + 1]];
    for (const [x, z] of cells) oset(L, x, z, 1);
  }

  // --- stairs between levels (and up to the roof), placed around the doors ---
  for (let L = L0; L < (roofAccess ? Ltop + 1 : Ltop); L++) {
    const upper = L + 1 <= Ltop ? present[L + 1] : present[Ltop];
    const cands = rng.shuffle(rooms.filter(r => present[L].has(r.id) && upper.has(r.id)));
    let placed = null;
    for (const r of cands) {
      const w = r.x1 - r.x0 + 1, d = r.z1 - r.z0 + 1;
      const sw = Math.min(3, Math.max(2, Math.floor(Math.min(w, d) / 4)));
      const opts = [];
      if (w >= LH + 4 && d >= sw + 4) for (const side of ['N', 'S']) for (const dir of [1, -1]) opts.push({ along: 'x', side, dir });
      if (d >= LH + 4 && w >= sw + 4) for (const side of ['W', 'E']) for (const dir of [1, -1]) opts.push({ along: 'z', side, dir });
      rng.shuffle(opts);
      for (const op of opts) {
        const st = stairCells(r, op, sw);
        const ok = st.steps.every(([x, z]) => oget(L, x, z) === 0 && oget(L + 1, x, z) === 0)
          && st.rail.every(([x, z]) => oget(L + 1, x, z) === 0)
          && st.approach.every(([x, z]) => oget(L, x, z) < 2) && st.arrive.every(([x, z]) => oget(L + 1, x, z) < 2);
        if (!ok) continue;
        placed = { L, room: r.id, ...st, sw };
        break;
      }
      if (placed) break;
    }
    if (!placed) {
      // No way down to the crypt: no crypt. No way up from here: the building stops at this level (or has no roof).
      if (L < 0) { delete present[L]; L0 = 0; continue; }
      if (L + 1 <= Ltop) { for (let k = L + 1; k <= Ltop; k++) delete present[k]; Ltop = L; }
      break;
    }
    stairs.push(placed);
    // Reserve: the flight and its approach on L; the hole, railing and arrival on L + 1.
    for (const [x, z] of placed.steps) oset(L, x, z, 2);
    for (const [x, z] of placed.approach) oset(L, x, z, 1);
    for (const [x, z] of placed.steps) oset(L + 1, x, z, 2);
    for (const [x, z] of placed.rail) oset(L + 1, x, z, 2);
    for (const [x, z] of placed.arrive) oset(L + 1, x, z, 1);
  }
  } // (end of the fallback: a branching layout when no single route fits)
  // --- graph and treasure ---
  const node = (L, id) => L * 1000 + id;
  const links = new Map();
  const link = (a, b) => { (links.get(a) || links.set(a, []).get(a)).push(b); (links.get(b) || links.set(b, []).get(b)).push(a); };
  for (const d of doors) link(node(d.L, d.e.a), node(d.L, d.e.b));
  for (const s of stairs) link(node(s.L, s.room), node(Math.min(s.L + 1, Ltop), s.room));
  const dist = new Map();
  const startRoom = entrances.length ? entrances[0].room : rooms[0].id;
  const queue = [node(0, startRoom)]; dist.set(queue[0], 0);
  while (queue.length) { const a = queue.shift(); for (const b of links.get(a) || []) if (!dist.has(b)) { dist.set(b, dist.get(a) + 1); queue.push(b); } }
  let deepest = queue[0], maxD = -1;
  for (const [n, d] of dist) if (d > maxD || (d === maxD && n < 0)) { maxD = d; deepest = n; }
  let deadEnds = [...dist.keys()].filter(n => (links.get(n) || []).length === 1 && n !== deepest && n !== node(0, startRoom));
  if (chain) { dist.clear(); chain.forEach((c, i) => dist.set(node(c.L, c.id), i)); deepest = node(chain[chain.length - 1].L, chain[chain.length - 1].id); maxD = chain.length - 1; deadEnds = []; }

  // --- room types: each castle kind has its own set, used without repeats before any room type comes twice ---
  const types = new Map();
  const area = r => (r.x1 - r.x0 + 1) * (r.z1 - r.z0 + 1);
  const theme = THEMES[o.theme] || THEMES.classic;
  if (chain) {
    const bag = rng.shuffle([...theme.rooms]), cbag = rng.shuffle([...theme.crypt]);
    let bi = 0, ci = 0;
    chain.forEach((c, i) => {
      let t;
      if (i === chain.length - 1) t = 'treasury';
      else if (c.L < 0) t = cbag[ci++ % cbag.length];
      else if (i === 0 && !o.noHall) t = theme.first || 'hall';
      else { t = bag[bi++ % bag.length]; if (bi % bag.length === 0) rng.shuffle(bag); }
      types.set(node(c.L, c.id), t);
    });
    for (const m of chain.merged || []) { types.set(node(m.L, m.child), bag[bi++ % bag.length]); }
  } else for (let L = L0; L <= Ltop; L++) {
    const list = rooms.filter(r => present[L].has(r.id)).sort((a, b) => area(b) - area(a));
    const pool = L < 0 ? theme.crypt : theme.rooms;
    const bag = rng.shuffle([...pool, ...pool]);
    list.forEach((r, i) => {
      let t = bag[i % bag.length];
      if (L === 0 && i === 0 && !o.noHall) t = theme.first || 'hall';
      if (node(L, r.id) === deepest) t = 'treasury';
      types.set(node(L, r.id), t);
    });
  }

  // --- geometry (its own random stream, so skipping it far away keeps every chunk in step) ---
  const grng = new RNG(hash(o.seed, 0x9e0));
  const wallM = S.wall, inner = S.inner, floorM = S.floor;
  const H = yOf(Ltop) + LH - 1; // top of the walls (roof slab)
  const info = { rooms, entrances, top: H, deepest, present, Ltop, yOf, stairs, chain };
  if (!T.overlaps(x0, z0, x1, z1, 12)) return info;
  // Foundations, outer walls, crypt dig.
  T.fill(x0, y0 - 3, z0, x1, y0 - 1, z1, S.trim);
  if (present[-1]) {
    for (const id of present[-1]) { const r = rooms[id]; T.fill(r.x0 - 1, yOf(-1) - 1, r.z0 - 1, r.x1 + 1, y0 - 1, r.z1 + 1, wallM); }
  }
  // Per level: floor, outer wall, room interiors and inner walls.
  for (let L = L0; L <= Ltop; L++) {
    const y = yOf(L);
    for (const id of present[L]) {
      const r = rooms[id];
      // Walls around the room (outer ones thicker), air inside, the floor.
      const ox0 = r.x0 === ix0 ? x0 : r.x0 - 1, ox1 = r.x1 === ix1 ? x1 : r.x1 + 1, oz0 = r.z0 === iz0 ? z0 : r.z0 - 1, oz1 = r.z1 === iz1 ? z1 : r.z1 + 1;
      T.fill(ox0, y - 1, oz0, ox1, y + LH - 1, oz1, L < 0 ? wallM : inner);
      // Outer face of the building in the wall material.
      if (r.x0 === ix0) T.fill(x0, y - 1, oz0, x0 + et - 1, y + LH - 1, oz1, wallM);
      if (r.x1 === ix1) T.fill(x1 - et + 1, y - 1, oz0, x1, y + LH - 1, oz1, wallM);
      if (r.z0 === iz0) T.fill(ox0, y - 1, z0, ox1, y + LH - 1, z0 + et - 1, wallM);
      if (r.z1 === iz1) T.fill(ox0, y - 1, z1 - et + 1, ox1, y + LH - 1, z1, wallM);
      T.fill(r.x0, y, r.z0, r.x1, y + LH - 2, r.z1, 0);
      T.fill(r.x0, y - 1, r.z0, r.x1, y - 1, r.z1, L < 0 ? B('Cobblestone') : grng.chance(0.4) ? S.floor2 : floorM);
      // A band of trim at each floor on the outside.
      if (L >= 0) {
        if (r.x0 === ix0) T.fill(x0 - 1, y - 1, oz0, x0 - 1, y - 1, oz1, S.trim);
        if (r.x1 === ix1) T.fill(x1 + 1, y - 1, oz0, x1 + 1, y - 1, oz1, S.trim);
        if (r.z0 === iz0) T.fill(ox0, y - 1, z0 - 1, ox1, y - 1, z0 - 1, S.trim);
        if (r.z1 === iz1) T.fill(ox0, y - 1, z1 + 1, ox1, y - 1, z1 + 1, S.trim);
      }
    }
    // Roof of rooms that stop at this level (terrace with a parapet), or the top roof.
    for (const id of present[L]) {
      const r = rooms[id];
      const above = L + 1 <= Ltop && present[L + 1].has(id);
      if (above) continue;
      const ox0 = r.x0 === ix0 ? x0 : r.x0 - 1, ox1 = r.x1 === ix1 ? x1 : r.x1 + 1, oz0 = r.z0 === iz0 ? z0 : r.z0 - 1, oz1 = r.z1 === iz1 ? z1 : r.z1 + 1;
      const ry = y + LH - 1;
      T.fill(ox0, ry, oz0, ox1, ry, oz1, L < 0 ? floorM : S.trim);
      if (L >= 0 && L < Ltop && o.roof !== 'none') {
        // Terrace: parapet along the building's outer edge.
        if (r.x0 === ix0) parapet(T, x0, ry + 1, oz0, x0, oz1, S);
        if (r.x1 === ix1) parapet(T, x1, ry + 1, oz0, x1, oz1, S);
        if (r.z0 === iz0) parapet(T, ox0, ry + 1, z0, ox1, z0, S);
        if (r.z1 === iz1) parapet(T, ox0, ry + 1, z1, ox1, z1, S);
      }
    }
  }
  // Windows in the outer walls (not near inner walls or corners).
  const innerLinesX = new Set(), innerLinesZ = new Set();
  for (const r of rooms) { innerLinesX.add(r.x0 - 1); innerLinesX.add(r.x1 + 1); innerLinesZ.add(r.z0 - 1); innerLinesZ.add(r.z1 + 1); }
  for (let L = 0; L <= Ltop; L++) {
    const y = yOf(L), step = o.windowStep ?? 4;
    for (const id of present[L]) {
      const r = rooms[id];
      const win = (ax, az, bx, bz) => T.fill(ax, y + 1, az, bx, y + 2 + (L === 0 ? 0 : 1), bz, S.window);
      if (r.z0 === iz0) for (let x = r.x0 + 2; x <= r.x1 - 2; x += step) win(x, z0, x, z0 + et - 1);
      if (r.z1 === iz1) for (let x = r.x0 + 2; x <= r.x1 - 2; x += step) win(x, z1 - et + 1, x, z1);
      if (r.x0 === ix0) for (let z = r.z0 + 2; z <= r.z1 - 2; z += step) win(x0, z, x0 + et - 1, z);
      if (r.x1 === ix1) for (let z = r.z0 + 2; z <= r.z1 - 2; z += step) win(x1 - et + 1, z, x1, z);
    }
  }
  // Doors.
  for (const d of doors) {
    const y = yOf(d.L), e = d.e;
    if (d.open) {
      // Remove the wall, leaving pillars at the ends and arches in between.
      if (e.axis === 'x') { T.fill(e.wall, y, e.lo + 1, e.wall, y + LH - 3, e.hi - 1, 0); for (let t = e.lo + 4; t < e.hi - 2; t += 5) T.fill(e.wall, y, t, e.wall, y + LH - 2, t, S.pillar); }
      else { T.fill(e.lo + 1, y, e.wall, e.hi - 1, y + LH - 3, e.wall, 0); for (let t = e.lo + 4; t < e.hi - 2; t += 5) T.fill(t, y, e.wall, t, y + LH - 2, e.wall, S.pillar); }
    } else {
      if (e.axis === 'x') { T.fill(e.wall, y, d.at, e.wall, y + 2, d.at + 1, 0); T.fill(e.wall, y + 3, d.at, e.wall, y + 3, d.at + 1, S.trim); }
      else { T.fill(d.at, y, e.wall, d.at + 1, y + 2, e.wall, 0); T.fill(d.at, y + 3, e.wall, d.at + 1, y + 3, e.wall, S.trim); }
    }
  }
  for (const d of terraceDoors) {
    const y = yOf(d.L), e = d.e;
    if (e.axis === 'x') T.fill(e.wall, y, d.at, e.wall, y + 2, d.at + 1, 0); else T.fill(d.at, y, e.wall, d.at + 1, y + 2, e.wall, 0);
  }
  for (const en of entrances) {
    const y = y0, t = en.at;
    const box = en.side === 'S' ? [t, z1 - et + 1, t + 2, z1 + 1] : en.side === 'N' ? [t, z0 - 1, t + 2, z0 + et - 1] : en.side === 'W' ? [x0 - 1, t, x0 + et - 1, t + 2] : [x1 - et + 1, t, x1 + 1, t + 2];
    T.fill(box[0], y, box[1], box[2], y + 3, box[3], 0);
    T.fill(box[0], y - 1, box[1], box[2], y - 1, box[3], S.trim);
    // A grand frame around the door.
    if (en.side === 'S' || en.side === 'N') { const zz = en.side === 'S' ? z1 + 1 : z0 - 1; T.fill(t - 1, y, zz, t - 1, y + 4, zz, S.pillar); T.fill(t + 3, y, zz, t + 3, y + 4, zz, S.pillar); T.fill(t - 1, y + 4, zz, t + 3, y + 4, zz, S.trim); T.set(t + 1, y + 5, zz, B('Mese Lamp')); }
    else { const xx = en.side === 'W' ? x0 - 1 : x1 + 1; T.fill(xx, y, t - 1, xx, y + 4, t - 1, S.pillar); T.fill(xx, y, t + 3, xx, y + 4, t + 3, S.pillar); T.fill(xx, y + 4, t - 1, xx, y + 4, t + 3, S.trim); T.set(xx, y + 5, t + 1, B('Mese Lamp')); }
  }
  // Stairs.
  for (const s of stairs) {
    const y = yOf(s.L), toRoof = s.L + 1 > Ltop;
    s.steps.forEach(([x, z], i) => {
      const k = Math.floor(i / s.sw) + 1;
      T.fill(x, y, z, x, y + k - 1, z, S.trim);
      T.fill(x, y + k, z, x, y + k + 3, z, 0);
    });
    if (!toRoof) for (const [x, z] of s.rail) if (oget(s.L + 1, x, z) === 2 && T.get(x, y + LH, z) === 0) T.set(x, y + LH, z, S.slab);
    if (toRoof) for (const [x, z] of s.rail) T.set(x, y + LH, z, S.slab);
  }

  // Lights and furniture.
  const roomCtx = (L, r) => ({ T, S, rng: new RNG(hash(o.seed, L, r.id)), x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, y: yOf(L), h: LH - 1, L,
    free: (x, z) => oget(L, x, z) === 0, floor: (x, z, m) => { if (oget(L, x, z) !== 2) T.set(x, yOf(L) - 1, z, m); }, clear: (x, z, rad = 1) => { for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) if (oget(L, x + dx, z + dz) !== 0) return false; return true; },
    type: types.get(node(L, r.id)), node: node(L, r.id), dist: dist.get(node(L, r.id)) ?? 0 });
  // The way home: the castle's final chest (only in its main building) offers to take you back outside the
  // entrance once you've opened it and read the letter inside (no portals, and no walking the whole way back).
  let home = null;
  if (chain && entrances.length && (o.tier ?? 3) >= 3 && !o.noHome) {
    const en = entrances[0];
    const out = en.side === 'S' ? [en.at + 1.5, z1 + 3.5, 0, 1] : en.side === 'N' ? [en.at + 1.5, z0 - 2.5, 0, -1] : en.side === 'W' ? [x0 - 2.5, en.at + 1.5, -1, 0] : [x1 + 3.5, en.at + 1.5, 1, 0];
    const [wx, wz] = T.pt(out[0], out[1]), [wx2, wz2] = T.pt(out[0] + out[2], out[1] + out[3]);
    home = { x: wx, y: y0, z: wz, yaw: Math.atan2(-(wx2 - wx), -(wz2 - wz)), label: 'the castle entrance', site: CUR_SITE, kind: 'castle' };
  }
  for (let L = L0; L <= Ltop; L++) for (const id of present[L]) {
    const r = rooms[id], ctx = roomCtx(L, r);
    furnish(ctx);
    lightRoom(ctx);
    // Treasure.
    if (ctx.node === deepest) {
      const coins = Math.round((o.treasure ?? 400) + 40 * maxD + ctx.rng.int(0, 200));
      placeChest(ctx, coins, o.tier ?? 3, home);
      if (o.crates) placeCrates(ctx, o.crates);
    } else if (deadEnds.includes(ctx.node) && ctx.rng.chance(0.55)) placeChest(ctx, 40 + ctx.rng.int(0, 120), 2);
    // A few coins scattered on the floor as breadcrumbs.
    if (ctx.rng.chance(0.4)) for (let k = ctx.rng.int(1, 4); k > 0; k--) {
      const x = ctx.rng.int(r.x0 + 1, r.x1 - 1), z = ctx.rng.int(r.z0 + 1, r.z1 - 1);
      void x; void z; // (breadcrumb coins retired: the coin trail now leads chest to chest; the draws keep the layout)
    }
  }
  return info;
}

// Cells of a straight stair in room r: op.along ('x' or 'z'), op.side (wall it runs against), op.dir (+1 / -1).
function stairCells(r, op, sw) {
  const steps = [], approach = [], arrive = [], rail = [];
  const len = r.x1 - r.x0 + 1, dep = r.z1 - r.z0 + 1;
  if (op.along === 'x') {
    const zs = op.side === 'N' ? [r.z0, r.z0 + sw - 1] : [r.z1 - sw + 1, r.z1];
    const start = op.dir > 0 ? r.x0 + 2 : r.x1 - 2;
    for (let k = 0; k < LH; k++) for (let z = zs[0]; z <= zs[1]; z++) steps.push([start + op.dir * k, z]);
    for (let k = 1; k <= 2; k++) for (let z = zs[0]; z <= zs[1]; z++) { approach.push([start - op.dir * k, z]); arrive.push([start + op.dir * (LH - 1 + k), z]); }
    const rz = op.side === 'N' ? zs[1] + 1 : zs[0] - 1;
    for (let k = -1; k < LH - 1; k++) rail.push([start + op.dir * k, rz]);
    for (let z = zs[0]; z <= zs[1]; z++) rail.push([start - op.dir, z]);
    void len; void dep;
  } else {
    const xs = op.side === 'W' ? [r.x0, r.x0 + sw - 1] : [r.x1 - sw + 1, r.x1];
    const start = op.dir > 0 ? r.z0 + 2 : r.z1 - 2;
    for (let k = 0; k < LH; k++) for (let x = xs[0]; x <= xs[1]; x++) steps.push([x, start + op.dir * k]);
    for (let k = 1; k <= 2; k++) for (let x = xs[0]; x <= xs[1]; x++) { approach.push([x, start - op.dir * k]); arrive.push([x, start + op.dir * (LH - 1 + k)]); }
    const rx = op.side === 'W' ? xs[1] + 1 : xs[0] - 1;
    for (let k = -1; k < LH - 1; k++) rail.push([rx, start + op.dir * k]);
    for (let x = xs[0]; x <= xs[1]; x++) rail.push([x, start - op.dir]);
  }
  // Steps are ordered by k (sw cells per step); the last step is level with the floor above.
  const holeSteps = steps.slice(0, (LH - 1) * sw);
  return { steps, approach, arrive, rail, hole: holeSteps, all: [...steps, ...approach, ...arrive, ...rail] };
}

// Roof spots that keep clear (by `r`) of where the stair up to the roof arrives.
function roofCorners(b, spots, r = 5) {
  const roofStair = b.stairs.find(st => st.L === b.Ltop);
  if (!roofStair) return spots;
  return spots.filter(([u, w]) => [...roofStair.steps, ...roofStair.arrive, ...roofStair.rail].every(([x, z]) => Math.hypot(x - u, z - w) > r));
}
// Is (u, w) (with a margin) over a room that exists on the top floor?
function onTopRoof(b, u, w, m = 0) {
  const top = b.present[b.Ltop];
  return b.rooms.some(r => top.has(r.id) && u - m >= r.x0 - 1 && u + m <= r.x1 + 1 && w - m >= r.z0 - 1 && w + m <= r.z1 + 1);
}
function parapet(T, ax, y, az, bx, bz, S) {
  T.fill(ax, y, az, bx, y, bz, S.wall);
  T.each(ax, az, bx, bz, (u, w) => { if (((u + w) & 1) === 0) T.set(u, y + 1, w, S.wall); });
}

function placeChest(ctx, coins, tier, home) {
  const { T, rng } = ctx;
  // Against a wall, on a free band cell, facing into the room.
  const spots = [];
  for (let x = ctx.x0 + 1; x <= ctx.x1 - 1; x++) { if (ctx.free(x, ctx.z0)) spots.push([x, ctx.z0, 0]); if (ctx.free(x, ctx.z1)) spots.push([x, ctx.z1, 2]); }
  for (let z = ctx.z0 + 1; z <= ctx.z1 - 1; z++) { if (ctx.free(ctx.x0, z)) spots.push([ctx.x0, z, 3]); if (ctx.free(ctx.x1, z)) spots.push([ctx.x1, z, 1]); }
  if (!spots.length) return;
  // Prefer the middle of a wall.
  spots.sort((a, b) => Math.abs(a[0] - (ctx.x0 + ctx.x1) / 2) + Math.abs(a[1] - (ctx.z0 + ctx.z1) / 2) - Math.abs(b[0] - (ctx.x0 + ctx.x1) / 2) - Math.abs(b[1] - (ctx.z0 + ctx.z1) / 2));
  const [x, z, f] = tier >= 3 ? spots[spots.length - 1 - rng.int(0, Math.min(3, spots.length - 1))] : rng.pick(spots);
  T.chest(x, ctx.y, z, f, coins, tier, home);
  if (tier >= 3) {
    // Gold and coins heaped around the big chest.
    const g = B('Gold Block');
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (ctx.free(x + dx, z + dz) && rng.chance(0.7)) T.set(x + dx, ctx.y, z + dz, rng.chance(0.3) ? B('Diamond Block') : g);
    for (let k = 0; k < 10; k++) { const cx = x + rng.int(-3, 3), cz = z + rng.int(-3, 3); if (cx >= ctx.x0 && cx <= ctx.x1 && cz >= ctx.z0 && cz <= ctx.z1 && T.get(cx, ctx.y, cz) === 0) T.coin(cx, ctx.y, cz, 2); }
    T.set(x, ctx.y + ctx.h - 1, z, B('Mese Lamp'));
  }
}

// Supply crates (Locked Chests full of building blocks) around a treasure room.
function placeCrates(ctx, n) {
  const spots = [];
  for (let x = ctx.x0 + 2; x <= ctx.x1 - 2; x += 3) { if (ctx.free(x, ctx.z0)) spots.push([x, ctx.z0, 0]); if (ctx.free(x, ctx.z1)) spots.push([x, ctx.z1, 2]); }
  for (let i = 0; i < n && spots.length; i++) {
    const [x, z, f] = spots.splice(ctx.rng.int(0, spots.length - 1), 1)[0];
    const [wx, wz] = ctx.T.cell(x, z);
    ctx.T.vol.chest(wx, ctx.y, wz, facingOf('Locked Chest', ctx.T.f(f)), 0, 6);
  }
}
function lightRoom(ctx) {
  const { T, rng } = ctx;
  const w = ctx.x1 - ctx.x0 + 1, d = ctx.z1 - ctx.z0 + 1, top = ctx.y + ctx.h;
  // Chandeliers in big rooms, lamps set in the ceiling otherwise, sconces on long walls.
  if (w >= 9 && d >= 9 && ctx.L >= 0) {
    for (let x = ctx.x0 + 4; x <= ctx.x1 - 4; x += 7) for (let z = ctx.z0 + 4; z <= ctx.z1 - 4; z += 7) chandelier(T, x, top, z, 1);
  } else {
    T.set(Math.floor((ctx.x0 + ctx.x1) / 2), top, Math.floor((ctx.z0 + ctx.z1) / 2), B('Mese Lamp'));
  }
  const lamp = ctx.L < 0 ? B('Torch') : null;
  for (let x = ctx.x0 + 2; x <= ctx.x1 - 2; x += 6) {
    if (lamp) { if (ctx.free(x, ctx.z0)) T.set(x, ctx.y, ctx.z0, lamp); }
    else { T.set(x, ctx.y + 2, ctx.z0 - 1, B('Mese Lamp')); T.set(x, ctx.y + 2, ctx.z1 + 1, B('Mese Lamp')); }
  }
  void rng;
}

// ---------------------------------------------------------------------------
// Furniture for each room type. Rule that keeps every room walkable: things go only against the walls (the
// "band") or in the middle (at least 3 blocks from the walls), never in the ring between, and never on the
// cells kept clear for doors and stairs.
// ---------------------------------------------------------------------------
function band(ctx, fn, every = 1) {
  const out = [];
  for (let x = ctx.x0; x <= ctx.x1; x++) { out.push([x, ctx.z0, 0]); out.push([x, ctx.z1, 2]); }
  for (let z = ctx.z0 + 1; z <= ctx.z1 - 1; z++) { out.push([ctx.x0, z, 3]); out.push([ctx.x1, z, 1]); }
  let i = 0;
  for (const [x, z, f] of out) { if (!ctx.free(x, z)) continue; if (i++ % every) continue; fn(x, z, f); }
}
function centre(ctx, fn) {
  for (let z = ctx.z0 + 3; z <= ctx.z1 - 3; z++) for (let x = ctx.x0 + 3; x <= ctx.x1 - 3; x++) if (ctx.clear(x, z, 1)) fn(x, z);
}
const isCorner = (ctx, x, z) => (x === ctx.x0 || x === ctx.x1) && (z === ctx.z0 || z === ctx.z1);
function floorPattern(ctx, a, b) { ctx.T.each(ctx.x0, ctx.z0, ctx.x1, ctx.z1, (x, z) => ctx.floor(x, z, ((x + z) & 1) ? a : b)); }
function runner(ctx, m) {
  const w = ctx.x1 - ctx.x0, d = ctx.z1 - ctx.z0;
  if (w >= d) { const z = Math.floor((ctx.z0 + ctx.z1) / 2); ctx.T.each(ctx.x0, z - 1, ctx.x1, z + 1, (x, zz) => ctx.floor(x, zz, m)); }
  else { const x = Math.floor((ctx.x0 + ctx.x1) / 2); ctx.T.each(x - 1, ctx.z0, x + 1, ctx.z1, (xx, z) => ctx.floor(xx, z, m)); }
}
function pillarsRows(ctx, m, step = 4) {
  const { T } = ctx;
  for (let x = ctx.x0 + 3; x <= ctx.x1 - 3; x += step) for (const z of [ctx.z0 + 3, ctx.z1 - 3]) if (ctx.clear(x, z, 1)) T.fill(x, ctx.y, z, x, ctx.y + ctx.h - 1, z, m);
}
function longTable(ctx, m, chair) {
  const { T } = ctx;
  const w = ctx.x1 - ctx.x0, d = ctx.z1 - ctx.z0;
  if (w >= d) { const z = Math.floor((ctx.z0 + ctx.z1) / 2); for (let x = ctx.x0 + 4; x <= ctx.x1 - 4; x++) if (ctx.clear(x, z, 1)) { T.set(x, ctx.y, z, m); if (chair) { if (ctx.clear(x, z - 1, 0)) T.set(x, ctx.y, z - 1, chair); if (ctx.clear(x, z + 1, 0)) T.set(x, ctx.y, z + 1, chair); } } }
  else { const x = Math.floor((ctx.x0 + ctx.x1) / 2); for (let z = ctx.z0 + 4; z <= ctx.z1 - 4; z++) if (ctx.clear(x, z, 1)) { T.set(x, ctx.y, z, m); if (chair) { if (ctx.clear(x - 1, z, 0)) T.set(x - 1, ctx.y, z, chair); if (ctx.clear(x + 1, z, 0)) T.set(x + 1, ctx.y, z, chair); } } }
}
const WOOLS = ['Red Wool', 'Blue Wool', 'Violet Wool', 'Orange Wool', 'Yellow Wool', 'Cyan Wool', 'Magenta Wool', 'Pink Wool', 'Dark Green Wool', 'Black Wool'];
function furnish(ctx) {
  const { T, S, rng } = ctx;
  const y = ctx.y, W = id => B(id);
  switch (ctx.type) {
    case 'hall': {
      runner(ctx, S.carpet);
      pillarsRows(ctx, S.pillar, 4);
      longTable(ctx, S.wood, W('Planks Slab'));
      band(ctx, (x, z) => { if (!isCorner(ctx, x, z)) T.fill(x, y + 1, z, x, y + 3, z, S.banner); }, 5);
      band(ctx, (x, z) => { if (isCorner(ctx, x, z)) brazier(T, x, y, z); });
      break;
    }
    case 'throne': {
      runner(ctx, S.carpet);
      pillarsRows(ctx, S.pillar, 3);
      // The throne against the far (north) wall's middle.
      const x = Math.floor((ctx.x0 + ctx.x1) / 2), z = ctx.z0;
      if (ctx.free(x, z)) { T.set(x, y, z, W('Gold Block')); T.set(x, y + 1, z, S.carpet); T.set(x, y + 2, z, W('Gold Block')); if (ctx.free(x - 1, z)) T.set(x - 1, y, z, W('Gold Block')); if (ctx.free(x + 1, z)) T.set(x + 1, y, z, W('Gold Block')); }
      band(ctx, (bx, bz) => T.fill(bx, y + 1, bz, bx, y + 3, bz, S.banner), 4);
      band(ctx, (bx, bz) => { if (isCorner(ctx, bx, bz)) monumentSmall(T, bx, y, bz, S); });
      break;
    }
    case 'library': {
      band(ctx, (x, z) => T.fill(x, y, z, x, y + 2 + (rng.chance(0.4) ? 1 : 0), z, W('Bookshelf')));
      centre(ctx, (x, z) => { if ((x - ctx.x0) % 4 === 0 && (z - ctx.z0) % 3 === 0) { T.set(x, y, z, S.wood); T.set(x, y + 1, z, W('Torch')); } });
      break;
    }
    case 'armory': {
      band(ctx, (x, z, f) => { const k = (x + z) % 3; if (k === 0) T.fill(x, y, z, x, y + 1, z, W('Iron Bars')); else if (k === 1) { T.set(x, y, z, W('Steel Block')); } else { T.set(x, y, z, W('Steel Block')); T.set(x, y + 1, z, W('Iron Bars')); T.set(x, y + 2, z, W('Tin Block')); } void f; });
      centre(ctx, (x, z) => { if ((x + z) % 5 === 0) { T.set(x, y, z, W('Straw')); T.set(x, y + 1, z, W('Straw')); T.set(x, y + 2, z, W('Brown Wool')); } });
      break;
    }
    case 'dining': {
      floorPattern(ctx, S.floor, S.floor2);
      longTable(ctx, S.wood, W('Planks Slab'));
      band(ctx, (x, z) => T.fill(x, y, z, x, y + 1, z, W('Bottle Shelf')), 3);
      break;
    }
    case 'kitchen': {
      band(ctx, (x, z, f) => { const k = (x * 7 + z) % 4; T.set(x, y, z, k === 0 ? facing('Furnace', T, f) : k === 1 ? W('wooden_barrel') : k === 2 ? W('Straw') : S.wood); if (k === 0) T.set(x, y + 1, z, W('Furnace')); });
      centre(ctx, (x, z) => { if ((x + 2 * z) % 4 === 0) { T.set(x, y, z, S.wood); } });
      break;
    }
    case 'bedroom': {
      const rugW = rng.pick(WOOLS);
      ctx.T.each(ctx.x0 + 2, ctx.z0 + 2, ctx.x1 - 2, ctx.z1 - 2, (x, z) => ctx.floor(x, z, W(rugW)));
      let beds = 0;
      band(ctx, (x, z) => {
        if (beds > 2 || isCorner(ctx, x, z)) return;
        T.set(x, y, z, W(rng.pick(['Red Wool', 'Blue Wool', 'White Wool', 'Violet Wool']))); beds++;
      }, 4);
      band(ctx, (x, z) => { if (isCorner(ctx, x, z)) { T.fill(x, y, z, x, y + 2, z, W('wood_cabinet_worn_long')); } });
      break;
    }
    case 'chapel': {
      runner(ctx, S.carpet);
      centre(ctx, (x, z) => { if ((z - ctx.z0) % 2 === 1 && Math.abs(x - (ctx.x0 + ctx.x1) / 2) > 1.5) T.set(x, y, z, W('Planks Slab')); });
      const x = Math.floor((ctx.x0 + ctx.x1) / 2);
      if (ctx.free(x, ctx.z0)) { T.set(x, y, ctx.z0, W('Gold Block')); T.set(x, y + 1, ctx.z0, W('Mese Lamp')); }
      band(ctx, (bx, bz) => T.set(bx, y, bz, W('Torch')), 3);
      break;
    }
    case 'gallery': {
      floorPattern(ctx, S.floor, S.floor2);
      let k = 0;
      centre(ctx, (x, z) => { if ((x - ctx.x0) % 6 === 3 && (z - ctx.z0) % 6 === 3 && ctx.clear(x, z, 2)) { T.set(x, y, z, S.trim); statue(T, rng.pick(['owl', 'bust']), x, y + 1, z, { a: rng.pick([W('marble_01'), W('Gold Block'), W('Bronze Block'), S.pillar]) }, (k++) & 3, 1); } });
      band(ctx, (x, z) => T.fill(x, y + 1, z, x, y + 2, z, W(rng.pick(WOOLS))), 3);
      break;
    }
    case 'storage': {
      band(ctx, (x, z) => { const h = rng.int(0, 2); T.fill(x, y, z, x, y + h, z, rng.pick([W('wooden_barrel'), W('Planks'), W('Pine Planks'), W('Straw')])); });
      centre(ctx, (x, z) => { if (rng.chance(0.25)) T.set(x, y, z, rng.pick([W('wooden_barrel'), W('Straw'), W('Planks')])); });
      break;
    }
    case 'barracks': {
      band(ctx, (x, z) => { if (!isCorner(ctx, x, z)) T.set(x, y, z, W(((x + z) & 1) ? 'Red Wool' : 'Planks Slab')); }, 2);
      centre(ctx, (x, z) => { if ((x + z) % 4 === 0) T.set(x, y, z, S.wood); });
      break;
    }
    case 'smithy': {
      band(ctx, (x, z, f) => { T.set(x, y, z, (x + z) % 3 ? facing('Furnace', T, f) : W('Steel Block')); });
      centre(ctx, (x, z) => { if ((x + z) % 6 === 0 && ctx.clear(x, z, 2)) { T.set(x, y - 1, z, W('Lava Source')); T.set(x, y, z, W('Iron Bars')); } });
      break;
    }
    case 'fountainhall': {
      floorPattern(ctx, S.floor, S.floor2);
      const cx = (ctx.x0 + ctx.x1 + 1) / 2, cz = (ctx.z0 + ctx.z1 + 1) / 2, r = Math.min(ctx.x1 - ctx.x0, ctx.z1 - ctx.z0) / 2 - 4;
      if (r >= 1.5) fountain(T, cx, y, cz, Math.min(4, r), { tiers: 1, rim: 'marble_01', stone: 'castle_brick_02_white', accent: 'Gold Block' });
      band(ctx, (x, z) => { T.set(x, y, z, W('Mossy Dirt')); T.set(x, y + 1, z, plantFor(x, z, 3, 3) || W('Fern')); }, 2);
      break;
    }
    case 'greenhouse': {
      centre(ctx, (x, z) => { T.set(x, y - 1, z, W('Wet Farmland')); T.set(x, y, z, W('Wheat ' + rng.int(3, 8))); });
      band(ctx, (x, z) => { T.set(x, y, z, W('Mossy Dirt')); T.set(x, y + 1, z, W(rng.pick(['Rose', 'Tulip', 'Geranium', 'Viola', 'Fern', 'Dandelion']))); });
      break;
    }
    case 'study': {
      band(ctx, (x, z) => T.fill(x, y, z, x, y + 2, z, W(((x + z) & 3) ? 'Bookshelf' : 'Bottle Shelf')), 1);
      centre(ctx, (x, z) => { if ((x + z) % 7 === 0) { T.set(x, y, z, S.wood); T.set(x, y + 1, z, W('Torch')); } });
      break;
    }
    case 'alchemy': {
      band(ctx, (x, z) => T.fill(x, y, z, x, y + 1, z, W(rng.pick(['Bottle Shelf', 'Bottle Shelf', 'TNT', 'Mese Block']))));
      centre(ctx, (x, z) => { if ((x * 3 + z) % 9 === 0 && ctx.clear(x, z, 2)) { T.set(x, y, z, W('Obsidian Glass')); T.set(x, y - 1, z, W('Lava Source')); T.set(x, y + 1, z, W('Mese Crystal Ore')); } });
      break;
    }
    case 'ballroom': {
      floorPattern(ctx, W('White Wool'), W('Black Wool'));
      pillarsRows(ctx, S.pillar, 5);
      centre(ctx, (x, z) => { if ((x - ctx.x0) % 5 === 0 && (z - ctx.z0) % 5 === 0) T.set(x, y + ctx.h - 2, z, W('Mese Lamp')); });
      break;
    }
    case 'aquarium': {
      const ax0 = ctx.x0 + 3, ax1 = ctx.x1 - 3, az0 = ctx.z0 + 3, az1 = ctx.z1 - 3;
      if (ax1 - ax0 >= 2 && az1 - az0 >= 2 && ctx.clear((ax0 + ax1) >> 1, (az0 + az1) >> 1, 1)) {
        let ok = true; for (let z = az0; z <= az1 && ok; z++) for (let x = ax0; x <= ax1; x++) if (!ctx.free(x, z)) { ok = false; break; }
        if (ok) {
          T.fill(ax0, y, az0, ax1, y + 3, az1, W('Glass'));
          T.fill(ax0 + 1, y, az0 + 1, ax1 - 1, y + 3, az1 - 1, W('Water Source'));
          T.each(ax0 + 1, az0 + 1, ax1 - 1, az1 - 1, (x, z) => { const r = hashf(x, z, 77); if (r < 0.35) T.set(x, y, z, W(['Brown Coral', 'Cyan Coral', 'Green Coral', 'Orange Coral', 'Pink Coral'][hash(x, z, 5) % 5])); else if (r < 0.5) T.set(x, y, z, W('Kelp')); });
        }
      }
      band(ctx, (x, z) => T.set(x, y, z, W('Bottle Shelf')), 4);
      break;
    }
    case 'observatory': {
      ctx.T.each(ctx.x0, ctx.z0, ctx.x1, ctx.z1, (x, z) => ctx.floor(x, z, hashf(x, z, 9) < 0.06 ? W('Mese Lamp') : W('Blue Wool')));
      const cx = Math.floor((ctx.x0 + ctx.x1) / 2), cz = Math.floor((ctx.z0 + ctx.z1) / 2);
      if (ctx.clear(cx, cz, 2)) { T.set(cx, y, cz, W('Bronze Block')); T.set(cx, y + 1, cz, W('Steel Block')); T.set(cx + 1, y + 2, cz, W('Steel Block')); T.set(cx + 2, y + 3, cz, W('Glass')); }
      break;
    }
    case 'music': {
      band(ctx, (x, z) => T.fill(x, y, z, x, y + 1, z, W(rng.pick(['Jungle Planks', 'dark_wood', 'Bronze Block']))), 3);
      centre(ctx, (x, z) => { if ((x + z) % 3 === 0) T.set(x, y, z, W('Planks Slab')); });
      break;
    }
    case 'coffins': {
      // Dracula's coffin hall: rows of dark coffins under candles, a blood-red runner down the middle.
      runner(ctx, W('Red Fabric'));
      centre(ctx, (x, z) => {
        if ((x - ctx.x0) % 4 === 1 && (z - ctx.z0) % 5 === 1 && ctx.clear(x, z, 1) && ctx.clear(x, z + 2, 1)) {
          T.fill(x, y, z, x, y, z + 2, W('dark_wood')); T.fill(x, y + 1, z, x, y + 1, z + 2, W('Dark Wood Slab'));
          T.set(x, y + 2, z + 1, W('Torch'));
        }
      });
      band(ctx, (x, z, f) => { T.fill(x, y + 1, z, x, y + 3, z, W('Red Fabric')); }, 4);
      band(ctx, (x, z) => { if (isCorner(ctx, x, z)) brazier(T, x, y, z); });
      break;
    }
    case 'treasury': {
      floorPattern(ctx, W('Gold Block'), S.floor);
      band(ctx, (x, z) => { if (rng.chance(0.45)) T.fill(x, y, z, x, y + rng.int(0, 1), z, W(rng.pick(['Gold Block', 'Gold Block', 'Diamond Block', 'Mese Block', 'Bronze Block']))); }, 2);
      centre(ctx, (x, z) => { if (rng.chance(0.08)) T.coin(x, y, z, 3); });
      break;
    }
    case 'crypt': case 'catacomb': {
      centre(ctx, (x, z) => { if ((x - ctx.x0) % 4 === 3 && (z - ctx.z0) % 3 === 0 && ctx.clear(x, z + 1, 1)) { T.set(x, y, z, W('Stone Block')); T.set(x, y, z + 1, W('Stone Block')); T.set(x, y + 1, z, W('Stone Bricks Slab')); T.set(x, y + 1, z + 1, W('Stone Bricks Slab')); } });
      band(ctx, (x, z, f) => T.set(x, y, z, facing('Bone Box', T, f)), 3);
      break;
    }
    case 'ossuary': {
      band(ctx, (x, z, f) => T.fill(x, y, z, x, y + 1, z, facing('Bone Box', T, f)), 1);
      break;
    }
    case 'prison': {
      band(ctx, (x, z) => T.fill(x, y, z, x, y + 2, z, (x + z) % 3 ? W('Iron Bars') : W('Bone Box')), 1);
      break;
    }
    case 'vault': {
      band(ctx, (x, z) => { if (rng.chance(0.3)) T.set(x, y, z, W('Gold Block')); }, 2);
      break;
    }
    default: break;
  }
}
// A facing block (furnace / bone box) on a band cell, looking into the room (band side f is already that facing).
const facing = (name, T, f) => facingOf(name, T.f(f));
function monumentSmall(T, x, y, z, S) { T.set(x, y, z, S.trim); T.set(x, y + 1, z, B('Steel Block')); T.set(x, y + 2, z, B('Iron Bars')); }

// ---------------------------------------------------------------------------
// Towers: square or round shells around a square spiral stair, with a lookout room or battlements on top.
// ---------------------------------------------------------------------------
function tower(T, cu, cw, o) {
  const { S, rng } = o;
  const round = o.round, s = o.s ?? 7, y0 = o.y0 ?? G, h = o.h; // s: stair well size (odd)
  const half = (s - 1) / 2, R = o.R ?? half + 2.5;
  const top = y0 + h; // stand height on top
  const x0 = cu - half, z0 = cw - half;
  if (!T.overlaps(cu - R - 6, cw - R - 6, cu + R + 6, cw + R + 6)) return top;
  // Shell (solid), then hollow the well.
  if (round) T.cyl(cu + 0.5, cw + 0.5, R, y0 - 3, top - 1, S.wall);
  else T.fill(cu - Math.ceil(R - 0.5), y0 - 3, cw - Math.ceil(R - 0.5), cu + Math.ceil(R - 0.5), top - 1, cw + Math.ceil(R - 0.5), S.wall);
  T.fill(x0, y0, z0, x0 + s - 1, top - 2, z0 + s - 1, 0);
  // Arrow slits.
  for (let y = y0 + 5; y < top - 3; y += 6) for (const [du, dw] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const ru = Math.round(cu + du * (R - 0.5)), rw = Math.round(cw + dw * (R - 0.5));
    T.fill(Math.min(ru, cu + du * (half + 1)), y, Math.min(rw, cw + dw * (half + 1)), Math.max(ru, cu + du * (half + 1)), y + 1, Math.max(rw, cw + dw * (half + 1)), S.window);
  }
  // Floor on top, then the stair carves its way up through it.
  const R2 = round ? R : Math.ceil(R - 0.5) + 0.5;
  if (round) T.cyl(cu + 0.5, cw + 0.5, R + 0.8, top - 1, top - 1, S.trim); else T.fill(cu - Math.ceil(R), top - 1, cw - Math.ceil(R), cu + Math.ceil(R), top - 1, cw + Math.ceil(R), S.trim);
  const start = o.door ?? 2; // corner index where the stair starts (door side)
  ringStair(T, x0, z0, s, y0, top, S.trim, start);
  towerDoor(T, x0, z0, s, y0, start, o.doorAlongZ ?? false);
  // Doorway through the thicker shell, out to the ground.
  const e = s - 1, west = start === 0 || start === 3, north = start < 2;
  const [cx] = [[x0, z0], [x0 + e - 1, z0], [x0 + e - 1, z0 + e - 1], [x0, z0 + e - 1]][start];
  if (!(o.doorAlongZ ?? false)) { const zz = north ? z0 - 1 : z0 + s; for (let k = 0; k <= Math.ceil(R - half); k++) T.fill(cx, y0, north ? zz - k : zz + k, cx + 1, y0 + 2, north ? zz - k : zz + k, 0); }
  void west;
  // Battlements or a lookout room with a pointed roof.
  if (o.roof === 'cone' || o.roof === 'pyramid') {
    const rh = 4;
    if (round) { T.cyl(cu + 0.5, cw + 0.5, R, top, top + rh - 1, S.wall, 1); }
    else T.shell(cu - Math.ceil(R - 0.5), top, cw - Math.ceil(R - 0.5), cu + Math.ceil(R - 0.5), top + rh - 1, cw + Math.ceil(R - 0.5), S.wall);
    // Big open windows on all four sides.
    for (const [du, dw] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) T.fill(cu + du * Math.round(R - 0.5) - (dw ? 1 : 0), top + 1, cw + dw * Math.round(R - 0.5) - (du ? 1 : 0), cu + du * Math.round(R - 0.5) + (dw ? 1 : 0), top + 2, cw + dw * Math.round(R - 0.5) + (du ? 1 : 0), 0);
    const roofM = o.roofM ?? S.roof;
    let r = R + 1, y = top + rh;
    while (r > 0.6) {
      if (round || o.roof === 'cone') T.cyl(cu + 0.5, cw + 0.5, r, y, y, roofM);
      else { const k = Math.ceil(r - 0.5); T.fill(cu - k, y, cw - k, cu + k, y, cw + k, roofM); }
      r -= o.steep ?? 0.75; y++;
    }
    T.fill(cu, y, cw, cu, y + 1, cw, S.trim);
    T.set(cu, y + 2, cw, o.flag ?? S.banner);
    T.set(cu, top + rh - 1, cw, B('Mese Lamp'));
  } else {
    if (round) { T.cyl(cu + 0.5, cw + 0.5, R2, top, top, S.wall, 1); T.each(cu - R - 1, cw - R - 1, cu + R + 1, cw + R + 1, (u, w) => { const d = Math.hypot(u + 0.5 - cu - 0.5, w + 0.5 - cw - 0.5); if (d <= R && d > R - 1 && ((u + w) & 1) === 0) T.set(u, top + 1, w, S.wall); }); }
    else { const k = Math.ceil(R - 0.5); T.shell(cu - k, top, cw - k, cu + k, top, cw + k, S.wall); T.each(cu - k, cw - k, cu + k, cw + k, (u, w) => { if ((Math.abs(u - cu) === k || Math.abs(w - cw) === k) && ((u + w) & 1) === 0) T.set(u, top + 1, w, S.wall); }); }
    T.set(cu + half, top, cw + half, B('Torch'));
  }
  return top;
}

// ---------------------------------------------------------------------------
// The castle itself.
// ---------------------------------------------------------------------------
// What a castle clearing will be, without building it (the map names every castle before you've seen it). Must draw
// from the clearing's RNG exactly as buildCastle does.
export function castleIdentity(c) {
  const rng = new RNG(c.seed);
  const kind = c.kind === 'floating' ? 'floating' : c.kind === 'ruins' ? 'ruins' : c.kind === 'skycastle' ? 'sky' : rng.weighted([['keep', 40], ['palace', 20], ['fortress', 20], ['towers', 20]]);
  const S = rng.pick(castleStyles());
  return { kind, name: `${S.name} of ${placeName(c.seed)}` };
}
let CUR_SITE = null; // the clearing being built (its final chest carries it: see building() and main.js)
// A castle brought down: a meadow of flowers where it stood, with a stone and a gold star in the middle.
function meadow(vol, c) {
  vol.fill(c.bx0 - 1, G, c.bz0 - 1, c.bx1 + 1, G + 3, c.bz1 + 1, 0);
  vol.fill(c.bx0 - 1, G - 1, c.bz0 - 1, c.bx1 + 1, G - 1, c.bz1 + 1, B('Grass'));
  vol.each(c.bx0, c.bz0, c.bx1, c.bz1, (x, z) => {
    const r = hashf(x, z, c.seed, 0x3ad0);
    if (r < 0.34) vol.set(x, G, z, plantIds.flowers[hash(x, z, c.seed, 5) % plantIds.flowers.length]);
    else if (r < 0.58) vol.set(x, G, z, plantIds.grass[hash(x, z, c.seed, 6) % plantIds.grass.length]);
  });
  const cx = Math.floor((c.bx0 + c.bx1) / 2), cz = Math.floor((c.bz0 + c.bz1) / 2);
  vol.fill(cx - 1, G - 1, cz - 1, cx + 1, G - 1, cz + 1, B('Mossy Cobblestone'));
  vol.fill(cx, G, cz, cx, G + 1, cz, B('Mossy Stone Wall'));
  vol.set(cx, G + 2, cz, B('Gold Block'));
  vol.set(cx, G + 3, cz, B('Mese Lamp'));
}
// A castle in a giant cavern far below the labyrinth (see deep.js, which builds it at the usual height and lowers it
// into the cavern).
export function deepIdentity(c) {
  const rng = new RNG(c.seed);
  const kind = deepKind(c, rng), S = rng.pick(castleStyles()); // (the kind may be swapped for one that fits: see deep.js)
  return { kind, name: `Deep ${S.name} of ${placeName(c.seed)}` };
}
export function buildDeepCastle(vol, c, want) {
  const rng = new RNG(c.seed);
  CUR_SITE = siteKey(c);
  if (DONE.has(CUR_SITE)) { meadow(vol, c); return; }
  const T = new TVol(vol, c);
  let kind = deepKind(c, rng); const S = { ...rng.pick(castleStyles()) }; // (the style and name stay; the kind may be swapped
  if (want) kind = want;                                                    //  for one that fits under the dome)
  S.rng = rng;
  clearingGround(vol, c, c.seed, 0.9, B('Moss Block'));
  const W = T.W, D = T.D, o = { T, S, rng, W, D, c, plan: null, seed: c.seed };
  const gateU = Math.floor(W / 2) - 1;
  T.fill(gateU - 1, G - 1, D - 8, gateU + 3, G - 1, D - 1, S.path);
  { const [mx, mz] = T.pt(W / 2, D / 2); vol.marks.push(['castle', mx, G, mz, `Deep ${S.name} of ${placeName(c.seed)}`, kind]); }
  if (kind === 'keep') keepCastle(o); else if (kind === 'palace') palace(o); else if (kind === 'towers') towerCluster(o); else fortress(o);
}
// Under a tall dome any kind of castle fits; under a low one (beneath a castle above), keeps and fortresses.
function deepKind(c, rng) { return c.tall ? rng.weighted([['keep', 35], ['palace', 25], ['fortress', 20], ['towers', 20]]) : rng.pick(['keep', 'fortress', 'keep']); }
export function buildCastle(vol, plan, c, rng) {
  CUR_SITE = siteKey(c);
  if (DONE.has(CUR_SITE)) { meadow(vol, c); return; }
  const T = new TVol(vol, c.kind === 'floating' ? { ...c, gate: SIDE.S } : c);
  const sty = castleStyles();
  const kind = c.kind === 'floating' ? 'floating' : c.kind === 'ruins' ? 'ruins' : c.kind === 'skycastle' ? 'sky' : rng.weighted([['keep', 40], ['palace', 20], ['fortress', 20], ['towers', 20]]);
  const S = { ...rng.pick(sty) };
  if (kind === 'ruins') { const m = sty[5]; Object.assign(S, { wall: m.wall, trim: m.trim, inner: m.inner, pillar: m.pillar }); }
  S.rng = rng;
  // Ground of the clearing.
  clearingGround(vol, c, c.seed, 0.9);
  const W = T.W, D = T.D;
  const o = { T, S, rng, W, D, c, plan, seed: c.seed };
  if (kind === 'floating') { skyFortress(o, floatingInfo(plan)); return; }
  // A path from the gate side of the clearing to the castle gate.
  const gateU = Math.floor(W / 2) - 1;
  T.fill(gateU - 1, G - 1, D - 8, gateU + 3, G - 1, D - 1, S.path);
  { const [mx, mz] = T.pt(W / 2, D / 2); vol.marks.push(['castle', mx, G, mz, `${S.name} of ${placeName(c.seed)}`, kind]); }
  if (kind === 'keep') keepCastle(o);
  else if (kind === 'palace') palace(o);
  else if (kind === 'fortress') fortress(o);
  else if (kind === 'towers') towerCluster(o);
  else if (kind === 'ruins') ruins(o);
  else if (kind === 'floating') skyFortress(o, floatingInfo(plan));
  else skyCastle(o);
}

// Clear a rectangle to bare ground (keeps the floor), removing plants.
function clearGround(T, u0, w0, u1, w1, m) { T.fill(u0, G, w0, u1, G + 1, w1, 0); if (m) T.fill(u0, G - 1, w0, u1, G - 1, w1, m); }

function curtain(o, u0, w0, u1, w1, h, opts = {}) {
  const { T, S, rng } = o;
  const t = 3, top = G + h;
  // Walls with a walkway on top and crenellations on the outer edge.
  T.shell(u0, G - 2, w0, u1, top - 1, w1, S.wall, t);
  T.shell(u0, top, w0, u1, top, w1, S.wall, 1);
  T.each(u0, w0, u1, w1, (u, w) => { if ((u === u0 || u === u1 || w === w0 || w === w1) && ((u + w) & 1) === 0) T.set(u, top + 1, w, S.wall); });
  // Inner face: a trim band and lamps.
  for (let u = u0 + 6; u < u1 - 5; u += 8) { T.set(u, G + 3, w0 + t, B('Mese Lamp')); T.set(u, G + 3, w1 - t, B('Mese Lamp')); }
  // Stairs up to the walkway along the inner face (north wall: two flights; side walls one each).
  const flights = [];
  const flight = (us, ws, du, dw, n) => { // n steps from (us, ws) going (du, dw); stair 2 wide toward the inside
    for (let k = 0; k < n; k++) {
      const u = us + du * k, w = ws + dw * k;
      const pu = dw ? 1 : 0, pw = du ? 1 : 0; // perpendicular (toward inside)
      T.fill(u, G, w, u + pu, G + k, w + pw, S.trim);
      T.fill(u, G + k + 1, w, u + pu, G + k + 4, w + pw, 0);
    }
    flights.push([us, ws]);
  };
  const n = h; // rise to the walkway (top is the stand height on the wall)
  if (u1 - u0 > n + 20) { flight(u0 + 8, w0 + t, 1, 0, n); flight(u1 - 8, w0 + t, -1, 0, n); }
  if (w1 - w0 > n + 24) { flight(u0 + t, w1 - 10, 0, -1, n); flight(u1 - t - 1, w1 - 10, 0, -1, n); }
  void rng; void opts;
  return top;
}

function gatehouse(o, gu, w, h, moat) {
  const { T, S } = o;
  // Gate passage 4 wide, 5 high through the south wall, flanked by two towers.
  T.fill(gu - 1, G, w - 1, gu + 2, G + 4, w + 3, 0);
  T.fill(gu - 1, G - 1, w - 1, gu + 2, G - 1, w + 3, S.path);
  T.fill(gu - 1, G + 4, w + 3, gu + 2, G + 4, w + 3, B('Iron Bars')); // portcullis, raised
  for (const su of [gu - 5, gu + 6]) tower(T, su, w + 1, { S, rng: o.rng, s: 5, R: 3.5, h: h + 6, round: o.round, roof: 'battle', door: 0 });
  T.fill(gu - 3, G + h, w - 1, gu + 4, G + h + 4, w + 3, S.wall);
  T.fill(gu - 1, G + h + 1, w - 1, gu + 2, G + h + 3, w + 3, 0);
  if (moat) {
    // Drawbridge over the moat.
    T.fill(gu - 1, G - 1, w + 4, gu + 2, G - 1, w + 8, o.S.wood);
    T.fill(gu - 1, G, w + 4, gu + 2, G + 2, w + 8, 0);
    T.fill(gu - 2, G, w + 4, gu - 2, G, w + 8, B('Iron Bars')); T.fill(gu + 3, G, w + 4, gu + 3, G, w + 8, B('Iron Bars'));
  }
}

function keepCastle(o) {
  const { T, S, rng, W, D } = o;
  const moat = rng.chance(0.6);
  const m = 6, mw = moat ? 3 : 0;
  const u0 = m + mw, w0 = m + mw, u1 = W - 1 - m - mw, w1 = D - 1 - m - mw;
  if (moat) {
    T.shell(m, G - 3, m, W - 1 - m, G - 1, D - 1 - m, B('Water Source'), mw);
    T.shell(m, G - 4, m, W - 1 - m, G - 4, D - 1 - m, B('Stone Bricks'), mw);
    T.shell(m, G, m, W - 1 - m, G + 1, D - 1 - m, 0, mw);
  }
  o.round = rng.chance(0.6);
  const wallH = rng.int(9, 13);
  // Bailey ground.
  T.fill(u0 + 3, G - 1, w0 + 3, u1 - 3, G - 1, w1 - 3, B('Grass'));
  curtain(o, u0, w0, u1, w1, wallH);
  // Corner (and mid) towers.
  const tH = wallH + rng.int(7, 14), R = o.round ? 5.5 : 5;
  const corners = [[u0 + 3, w0 + 3, 0], [u1 - 3, w0 + 3, 1], [u1 - 3, w1 - 3, 2], [u0 + 3, w1 - 3, 3]];
  const roofKind = rng.pick(['cone', 'pyramid', 'battle']);
  for (const [cu, cw, k] of corners) tower(T, cu, cw, { S, rng, s: 7, R, h: tH + rng.int(-2, 3), round: o.round, roof: roofKind, door: (k + 2) & 3, doorAlongZ: false });
  if (u1 - u0 > 80) tower(T, Math.floor((u0 + u1) / 2), w0 + 3, { S, rng, s: 7, R, h: tH, round: o.round, roof: roofKind, door: 3 });
  gatehouse(o, Math.floor(W / 2) - 1, w1 - 2, wallH, moat);
  // The keep at the back of the bailey.
  const kw = Math.min(u1 - u0 - 16, rng.int(40, 70)), kd = Math.min(w1 - w0 - 30, rng.int(32, 52));
  const ku0 = Math.floor(W / 2 - kw / 2), kw0 = w0 + 8;
  const levels = rng.int(3, 5);
  const keep = building(T, { S, rng, theme: 'classic', seed: o.seed + 1, x0: ku0, z0: kw0, x1: ku0 + kw - 1, z1: kw0 + kd - 1, levels, crypt: rng.chance(0.75), roof: 'terrace',
    entrances: [{ side: 'S' }], setback: rng.chance(0.6), treasure: 500 + levels * 120, tier: 4 });
  // Roof terrace: parapet and a great tower rising from the roof.
  const ry = keep.top + 1;
  parapet(T, ku0, ry, kw0, ku0 + kw - 1, kw0, S); parapet(T, ku0, ry, kw0 + kd - 1, ku0 + kw - 1, kw0 + kd - 1, S);
  parapet(T, ku0, ry, kw0, ku0, kw0 + kd - 1, S); parapet(T, ku0 + kw - 1, ry, kw0, ku0 + kw - 1, kw0 + kd - 1, S);
  if (keep.present[keep.Ltop].size === keep.rooms.length) {
    // Turrets at the keep's roof corners (decorative caps), clear of the roof stair.
    for (const [tu, tw] of roofCorners(keep, [[ku0 + 1, kw0 + 1], [ku0 + kw - 2, kw0 + 1], [ku0 + 1, kw0 + kd - 2], [ku0 + kw - 2, kw0 + kd - 2]])) {
      T.cyl(tu + 0.5, tw + 0.5, 2.6, ry, ry + 5, S.wall);
      let r = 3.4, y = ry + 6; while (r > 0.6) { T.cyl(tu + 0.5, tw + 0.5, r, y, y, S.roof); r -= 0.6; y++; }
      T.set(tu, y, tw, S.banner);
    }
  }
  // Bailey: a fountain or well in front of the keep, statues along the path, trees and a small chapel / stable.
  const fu = Math.floor(W / 2), fw = Math.floor((kw0 + kd + w1) / 2);
  if (rng.chance(0.6)) fountain(T, fu + 0.5, G, fw + 0.5, 3.5, { tiers: 2, rim: 'marble_01', stone: 'castle_brick_02_white' }); else well(T, fu, G, fw);
  T.fill(fu - 1, G - 1, kw0 + kd, fu + 1, G - 1, w1 - 3, S.path);
  T.fill(fu - 1, G, kw0 + kd, fu + 1, G + 1, w1 - 3, 0);
  for (let w = kw0 + kd + 3; w < w1 - 6; w += 7) for (const su of [fu - 4, fu + 4]) if (Math.abs(w - fw) > 6) monument(T, su, G, w, o.seed + w + su, su < fu ? 3 : 1, { stone: rng.pick(['marble_01', 'Stone Block', 'granite_tile']), pr: 0, ph: 1 });
  for (let k = 0; k < 8; k++) {
    const tu = rng.int(u0 + 6, u1 - 6), tw = rng.int(kw0 + kd + 3, w1 - 6);
    if (Math.abs(tu - fu) > 7) tree(T, tu, G, tw, rng.pick(['oak', 'aspen', 'pine']), 0.9);
  }
  // Side buildings in the bailey: stables, smithy, chapel...
  const sideW = Math.floor((ku0 - u0 - 10));
  if (sideW >= 14) {
    building(T, { S, rng, theme: 'classic', seed: o.seed + 2, x0: u0 + 5, z0: kw0, x1: u0 + 5 + sideW - 1, z1: kw0 + Math.min(kd, 26) - 1, levels: rng.int(1, 2), roof: 'terrace', et: 1, entrances: [{ side: 'E' }], treasure: 120, tier: 2, noHall: true, minR: 7 });
    building(T, { S, rng, theme: 'military', seed: o.seed + 3, x0: u1 - 5 - sideW + 1, z0: kw0, x1: u1 - 5, z1: kw0 + Math.min(kd, 26) - 1, levels: rng.int(1, 2), roof: 'terrace', et: 1, entrances: [{ side: 'W' }], treasure: 120, tier: 2, noHall: true, minR: 7 });
  }
}

function palace(o) {
  const { T, S, rng, W, D } = o;
  // Formal garden in front: hedges, flower beds, a big fountain, statues.
  const mainD = Math.floor(D * rng.range(0.38, 0.48)), m = 4;
  const levels = rng.int(2, 3);
  const main = building(T, { S, rng, theme: 'royal', seed: o.seed + 1, x0: m, z0: m, x1: W - 1 - m, z1: m + mainD - 1, levels, crypt: rng.chance(0.5), roof: 'terrace',
    entrances: [{ side: 'S' }], setback: false, openChance: 0.18, treasure: 500 + levels * 150, tier: 4, maxR: rng.int(14, 20) });
  const wingW = Math.floor(W * 0.2);
  const wings = rng.chance(0.75);
  if (wings) {
    for (const [a, side] of [[m, 'E'], [W - m - wingW, 'W']]) building(T, { S, rng, theme: 'royal', seed: o.seed + a, x0: a, z0: m + mainD + 4, x1: a + wingW - 1, z1: D - 12, levels: rng.int(1, 2), roof: 'terrace', entrances: [{ side }], treasure: 150, tier: 2, et: 1, minR: 7 });
  }
  // Domed turrets on the roof corners.
  for (const [cu, cw] of roofCorners(main, [[m + 3, m + 3], [W - m - 4, m + 3], [m + 3, m + mainD - 4], [W - m - 4, m + mainD - 4]])) {
    const top = main.top + rng.int(6, 12);
    T.cyl(cu + 0.5, cw + 0.5, 2.5, main.top, top, S.wall);
    T.sphere(cu + 0.5, top + 1, cw + 0.5, 3.4, S.roof, false, top);
    T.set(cu, top + 5, cw, B('Gold Block')); T.set(cu, top + 6, cw, B('Mese Lamp'));
  }
  // A central dome on the roof.
  if (rng.chance(0.7) && roofCorners(main, [[Math.floor(W / 2), Math.floor(m + mainD / 2)]], Math.min(9, mainD / 3) + 3).length) {
    const cu = W / 2, cw = m + mainD / 2, r = Math.min(9, mainD / 3);
    T.cyl(cu, cw, r, main.top, main.top + 3, S.wall);
    T.sphere(cu, main.top + 4, cw, r + 0.5, S.roof, false, main.top + 1);
    T.set(Math.floor(cu), main.top + 5 + Math.ceil(r), Math.floor(cw), B('Gold Block'));
  }
  // Gardens.
  const gu0 = wings ? m + wingW + 3 : m + 2, gu1 = wings ? W - m - wingW - 4 : W - m - 3, gw0 = m + mainD + 3, gw1 = D - 6;
  const cu = Math.floor((gu0 + gu1) / 2), cw = Math.floor((gw0 + gw1) / 2);
  T.fill(cu - 1, G - 1, gw0, cu + 1, G - 1, D - 1, S.path); T.fill(gu0, G - 1, cw - 1, gu1, G - 1, cw + 1, S.path);
  fountain(T, cu + 0.5, G, cw + 0.5, Math.min(6, (gu1 - gu0) / 6), { rim: 'marble_01', stone: 'castle_brick_02_white', accent: S.gold ? 'Gold Block' : 'Diamond Block', lamps: true });
  for (let u = gu0 + 2; u <= gu1 - 2; u += 6) for (let w = gw0 + 2; w <= gw1 - 2; w += 6) {
    if (Math.abs(u - cu) < 9 && Math.abs(w - cw) < 9) continue;
    if (Math.abs(u - cu) <= 2 || Math.abs(w - cw) <= 2) continue;
    if (rng.chance(0.5)) { T.fill(u - 1, G, w - 1, u + 1, G, w + 1, B('Leaves')); T.set(u, G + 1, w, B('Leaves')); }
    else flowerBed(T, u - 1, w - 1, u + 1, w + 1, G, o.seed + u * 7 + w);
  }
  for (let w = gw0 + 4; w < gw1; w += 8) for (const su of [cu - 4, cu + 4]) if (Math.abs(w - cw) > 7) monument(T, su, G, w, o.seed + w * 3 + su, su < cu ? 3 : 1, { stone: 'marble_01', base: 'castle_brick_02_white', trim: 'Gold Block', pr: 0, ph: 1 });
}

function fortress(o) {
  const { T, S, rng, W, D } = o;
  const m = 5, levels = rng.int(4, 6);
  const f = building(T, { S, rng, theme: 'military', seed: o.seed + 1, x0: m, z0: m, x1: W - 1 - m, z1: D - 1 - m, levels, crypt: true, roof: 'terrace', entrances: [{ side: 'S' }, { side: rng.pick(['E', 'W']) }],
    setback: rng.chance(0.5), treasure: 700 + levels * 140, tier: 4, maxR: rng.int(11, 15), hallChance: 0.08 });
  const ry = f.top + 1;
  parapet(T, m, ry, m, W - 1 - m, m, S); parapet(T, m, ry, D - 1 - m, W - 1 - m, D - 1 - m, S);
  parapet(T, m, ry, m, m, D - 1 - m, S); parapet(T, W - 1 - m, ry, m, W - 1 - m, D - 1 - m, S);
  // Towers rising from the roof corners (their doors open onto the roof terrace).
  const round = rng.chance(0.5), roof = rng.pick(['cone', 'pyramid', 'battle']), th = rng.int(10, 18);
  const spots = [[m + 6, m + 6, 2], [W - 1 - m - 6, m + 6, 3], [W - 1 - m - 6, D - 1 - m - 6, 0], [m + 6, D - 1 - m - 6, 1]];
  for (const [cu, cw, door] of spots) if (roofCorners(f, [[cu, cw]], 8).length) tower(T, cu, cw, { S, rng, s: 7, R: 5.5, y0: f.top + 1, h: th, round, roof, door });
  // Buttresses along the walls.
  for (let u = m + 6; u < W - m - 6; u += 8) { T.fill(u, G - 1, D - m, u + 1, G + levels * 3, D - m, S.trim); T.fill(u, G - 1, m - 1, u + 1, G + levels * 3, m - 1, S.trim); }
  // Banners hanging on the front.
  for (let u = m + 4; u < W - m - 4; u += 7) T.fill(u, G + levels * LH - 6, D - m, u, G + levels * LH - 2, D - m, S.banner);
}

function towerCluster(o) {
  const { T, S, rng, W, D } = o;
  // Towers on a grid, each a tall narrow building with straight stairs (one or two rooms per floor), joined by
  // bridges between floors of neighbouring towers.
  const nu = W > 110 ? 3 : 2, nw = D > 110 ? 3 : 2;
  const size = 15, gapU = Math.floor((W - 10 - nu * size) / Math.max(1, nu - 1)), gapW = Math.floor((D - 14 - nw * size) / Math.max(1, nw - 1));
  const towers = [];
  const round = rng.chance(0.4);
  let tallest = null;
  for (let j = 0; j < nw; j++) for (let i = 0; i < nu; i++) {
    const u0 = 5 + i * (size + gapU), w0 = 5 + j * (size + gapW);
    const levels = rng.int(3, 8);
    const t = { u0, w0, u1: u0 + size - 1, w1: w0 + size - 1, levels, i, j };
    towers.push(t);
    if (!tallest || levels > tallest.levels) tallest = t;
  }
  for (const t of towers) {
    const front = t.j === nw - 1;
    t.b = building(T, { S, rng, theme: 'wizard', seed: o.seed + t.i * 10 + t.j, x0: t.u0, z0: t.w0, x1: t.u1, z1: t.w1, levels: t.levels, roof: 'terrace', minR: 11, maxR: 11, et: 2,
      entrances: [{ side: front ? 'S' : rng.pick(['E', 'W', 'S']) }], treasure: t === tallest ? 900 : 120, tier: t === tallest ? 4 : 2, noHall: true });
    const ry = t.b.top + 1;
    parapet(T, t.u0, ry, t.w0, t.u1, t.w0, S); parapet(T, t.u0, ry, t.w1, t.u1, t.w1, S);
    parapet(T, t.u0, ry, t.w0, t.u0, t.w1, S); parapet(T, t.u1, ry, t.w0, t.u1, t.w1, S);
    // A pointed cap on some.
    if (rng.chance(0.5)) {
      const cu = (t.u0 + t.u1) / 2 + 0.5, cw = (t.w0 + t.w1) / 2 + 0.5;
      let r = 4.5, y = ry + 3; T.cyl(cu, cw, 3.5, ry, ry + 2, S.wall, 1);
      T.fill(Math.floor(cu) - 1, ry, Math.floor(cw) + 2, Math.floor(cu), ry + 2, Math.floor(cw) + 3, 0);
      while (r > 0.6) { T.cyl(cu, cw, r, y, y, round ? S.roof : S.trim); r -= 0.7; y++; }
    }
  }
  // Bridges between neighbours at a shared floor.
  for (const a of towers) for (const b of towers) {
    if (!((b.i === a.i + 1 && b.j === a.j) || (b.j === a.j + 1 && b.i === a.i))) continue;
    const L = rng.int(1, Math.min(a.levels, b.levels) - 1);
    if (L < 1) continue;
    const y = G + L * LH;
    if (b.i === a.i + 1) {
      const w = Math.floor((a.w0 + a.w1) / 2);
      T.fill(a.u1 - 1, y - 1, w - 1, b.u0 + 1, y - 1, w + 1, S.trim);
      T.fill(a.u1 + 1, y, w - 2, b.u0 - 1, y, w - 2, S.wall); T.fill(a.u1 + 1, y, w + 2, b.u0 - 1, y, w + 2, S.wall);
      T.fill(a.u1 - 1, y, w - 1, b.u0 + 1, y + 2, w + 1, 0);
      for (let u = a.u1 + 3; u < b.u0 - 2; u += 5) T.set(u, y + 1, w - 2, B('Mese Post Light'));
      // Arches underneath.
      for (let u = a.u1 + 1; u < b.u0; u++) { const t = (u - a.u1) / (b.u0 - a.u1); T.fill(u, y - 2 - Math.round(Math.sin(t * Math.PI) * 2), w, u, y - 2, w, S.trim); }
    } else {
      const u = Math.floor((a.u0 + a.u1) / 2);
      T.fill(u - 1, y - 1, a.w1 - 1, u + 1, y - 1, b.w0 + 1, S.trim);
      T.fill(u - 2, y, a.w1 + 1, u - 2, y, b.w0 - 1, S.wall); T.fill(u + 2, y, a.w1 + 1, u + 2, y, b.w0 - 1, S.wall);
      T.fill(u - 1, y, a.w1 - 1, u + 1, y + 2, b.w0 + 1, 0);
      for (let w = a.w1 + 3; w < b.w0 - 2; w += 5) T.set(u - 2, y + 1, w, B('Mese Post Light'));
      for (let w = a.w1 + 1; w < b.w0; w++) { const t = (w - a.w1) / (b.w0 - a.w1); T.fill(u, y - 2 - Math.round(Math.sin(t * Math.PI) * 2), w, u, y - 2, w, S.trim); }
    }
  }
  // Courtyard centrepiece in the open space between the first four towers.
  const cu = Math.floor(5 + size + gapU / 2), cw = Math.floor(5 + size + gapW / 2);
  if (rng.chance(0.5)) fountain(T, cu + 0.5, G, cw + 0.5, 3, { tiers: 2 }); else monument(T, cu, G, cw, o.seed, 0, { big: true, scale: 2, kind: rng.pick(['dragon', 'angel', 'knight']), pr: 2, ph: 2 });
}

function ruins(o) {
  const { T, S, rng, W, D } = o;
  // An old castle: a single-storey keep with half its upper floor gone, crumbling curtain walls, trees inside.
  const m = 4, u0 = m, w0 = m, u1 = W - 1 - m, w1 = D - 1 - m;
  const wallH = rng.int(7, 10);
  T.shell(u0, G - 2, w0, u1, G + wallH, w1, S.wall, 2);
  // Erode the walls: big bites out of the top, some gaps all the way down.
  T.each(u0, w0, u1, w1, (u, w) => {
    if (!(u <= u0 + 1 || u >= u1 - 1 || w <= w0 + 1 || w >= w1 - 1)) return;
    const n = fbm2(u / 9, w / 9, o.seed, 2);
    const keep = Math.floor(n * (wallH + 4) - 3);
    T.fill(u, G + Math.max(0, keep), w, u, G + wallH, w, 0);
    if (keep > 0 && hashf(u, w, o.seed) < 0.4) T.put(u, G + keep, w, B('Leaves'));
  });
  // Gaps to walk through on every side.
  const mu = Math.floor(W / 2), mw = Math.floor(D / 2);
  T.fill(mu - 2, G, w1 - 1, mu + 1, G + wallH, w1, 0); T.fill(mu - 2, G, w0, mu + 1, G + wallH, w0 + 1, 0);
  T.fill(u0, G, mw - 2, u0 + 1, G + wallH, mw + 1, 0); T.fill(u1 - 1, G, mw - 2, u1, G + wallH, mw + 1, 0);
  // Broken towers.
  for (const [cu, cw] of [[u0 + 1, w0 + 1], [u1 - 1, w0 + 1], [u1 - 1, w1 - 1], [u0 + 1, w1 - 1]]) {
    const h = rng.int(6, 16);
    T.cyl(cu + 0.5, cw + 0.5, 4.5, G - 1, G + h, S.wall, 1.5);
    T.each(cu - 5, cw - 5, cu + 5, cw + 5, (u, w) => { const k = Math.floor(fbm2(u / 4, w / 4, o.seed + 9, 2) * 8); T.fill(u, G + h - k, w, u, G + h, w, 0); });
  }
  // The keep: one or two storeys, chained rooms, a crypt with the treasure.
  const kw = Math.min(u1 - u0 - 14, rng.int(30, 46)), kd = Math.min(w1 - w0 - 16, rng.int(24, 36));
  const ku0 = Math.floor(W / 2 - kw / 2), kw0 = w0 + 6;
  const k = building(T, { S, rng, theme: 'ruin', seed: o.seed + 1, x0: ku0, z0: kw0, x1: ku0 + kw - 1, z1: kw0 + kd - 1, levels: rng.int(1, 2), crypt: true, roof: 'none',
    entrances: [{ side: 'S' }, { side: rng.pick(['E', 'W']) }], treasure: 450, tier: 3, hallChance: 0.3 });
  // Roof collapsed: knock holes in the top with noise and let plants in.
  T.each(ku0, kw0, ku0 + kw - 1, kw0 + kd - 1, (u, w) => {
    const n = fbm2(u / 6, w / 6, o.seed + 3, 2);
    if (n > 0.52) T.set(u, k.top, w, 0);
    else if (n > 0.45) T.set(u, k.top + 1, w, B('Leaves'));
  });
  // Overgrowth everywhere in the bailey.
  for (let n = 0; n < 14; n++) {
    const tu = rng.int(u0 + 4, u1 - 4), tw = rng.int(w0 + 4, w1 - 4);
    if (tu > ku0 - 4 && tu < ku0 + kw + 3 && tw > kw0 - 4 && tw < kw0 + kd + 3) continue;
    if (rng.chance(0.6)) tree(T, tu, G, tw, rng.pick(['oak', 'jungle', 'aspen']), rng.range(0.8, 1.3)); else bush(T, tu, G, tw, rng.range(1.5, 2.8), rng.pick(['Leaves', 'Jungle Leaves', 'Blueberry Bush']));
  }
  T.each(u0 + 2, w0 + 2, u1 - 2, w1 - 2, (u, w) => { if (T.get(u, G, w) === 0) { const p = plantFor(u, w, o.seed, 2); if (p) T.set(u, G, w, p); } });
}

// ---------------------------------------------------------------------------
// Sky castles.
// ---------------------------------------------------------------------------
function skyCastle(o) {
  const { rng } = o;
  if (rng.chance(0.55)) spireCastle(o); else floatingCastle(o);
}
// A castle on top of a rock mesa; a walled spiral path winds up its outside.
function spireCastle(o) {
  const { T, S, rng, W, D } = o;
  const cu = W / 2, cw = D / 2;
  const Rp = rng.int(19, 24), top = G + rng.int(65, 100);
  const rock = mix([[B('rock_wall_08'), 4], [B('cliff_side'), 3], [B('Stone'), 2], [B('mossy_rock'), 1]], o.seed, 4);
  // The mesa: a rough column, widest in a few bulges, grass on top, roots hanging over the rim.
  T.each(Math.floor(cu - Rp - 2), Math.floor(cw - Rp - 2), Math.ceil(cu + Rp + 2), Math.ceil(cw + Rp + 2), (u, w) => {
    const du = u + 0.5 - cu, dw = w + 0.5 - cw, d = Math.hypot(du, dw);
    if (d >= Rp) return;
    const inner = d < Rp - 1.5;
    T.fill(u, G - 2, w, u, top - 2, w, rock);
    T.set(u, top - 1, w, B('Grass'));
    if (!inner && hashf(u, w, o.seed) < 0.3) T.fill(u, top - 2 - (hash(u, w) % 6), w, u, top - 2, w, B('Jungle Leaves'));
  });
  // Inside the mesa: a tower of rooms, floor upon floor for the whole height of the rock, joined like any castle
  // (one guided route up through every room, the treasure at the top). A doorway at the foot (away from where the
  // spiral path starts) tunnels in; or dig in from the path at any height. Its own RNG, so the castle on top keeps
  // its layout.
  {
    const s = Math.floor((Rp - 3) * Math.SQRT2), iu0 = Math.floor(cu - s / 2), iw0 = Math.floor(cw - s / 2);
    const lv = Math.max(3, Math.floor((top - 5 - G) / LH)); // stops under the top castle's foundations
    const irng = new RNG(hash(o.seed, 4242));
    const theme = irng.pick(['classic', 'wizard', 'military', 'royal']);
    const tb = building(T, { S, rng: irng, theme, seed: o.seed + 77, x0: iu0, z0: iw0, x1: iu0 + s - 1, z1: iw0 + s - 1, levels: lv, roof: 'none',
      entrances: [{ side: 'N' }], treasure: 900 + lv * 120, tier: 4, minR: 7, maxR: 12, noHome: true }); // the castle on top is the end
    const en = tb.entrances[0];
    if (en) {
      const t = en.at, out = Math.floor(cw - Rp - 2);
      T.fill(t, G, out, t + 2, G + 3, iw0 - 1, 0);          // the tunnel through the rock
      T.fill(t, G - 1, out, t + 2, G - 1, iw0 - 1, S.path);  // paved
      for (let w = iw0 - 3; w > out + 1; w -= 4) { T.set(t - 1, G + 2, w, B('Mese Lamp')); T.set(t + 3, G + 2, w, B('Mese Lamp')); }
      // A frame round the mouth of the tunnel.
      const mw = Math.floor(cw - Math.sqrt(Math.max(0, Rp * Rp - (t + 1.5 - cu) ** 2))) - 1;
      T.fill(t - 1, G, mw, t - 1, G + 4, mw, S.pillar); T.fill(t + 3, G, mw, t + 3, G + 4, mw, S.pillar); T.fill(t - 1, G + 4, mw, t + 3, G + 4, mw, S.trim);
    }
  }
  // Spiral path: a 3-wide ledge outside the mesa rising 1 block per 2 along the path (slabs make the half steps).
  const r0 = Rp, r1 = Rp + 3, rm = (r0 + r1) / 2, slope = 0.5;
  const turn = 2 * Math.PI * rm * slope; // rise per full turn
  const a0 = Math.PI / 2; // starts on the gate side (+w)
  const rise = top - G;
  T.each(Math.floor(cu - r1 - 1), Math.floor(cw - r1 - 1), Math.ceil(cu + r1 + 1), Math.ceil(cw + r1 + 1), (u, w) => {
    const du = u + 0.5 - cu, dw = w + 0.5 - cw, d = Math.hypot(du, dw);
    if (d < r0 || d >= r1 + 1) return;
    let a = Math.atan2(dw, du) - a0; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    for (let t = 0; ; t++) {
      const h2 = Math.floor((a * rm * slope + t * turn) * 2); // height in half blocks
      const hb = Math.floor(h2 / 2), half = h2 & 1;
      if (h2 > 2 * rise) break; // the last step is level with the top
      const y = G + hb;
      if (d >= r1) {
        if (hb >= 2) { T.fill(u, y - 2, w, u, y + 1, w, S.wall); if ((u * 7 + w * 3 + t) % 13 === 0) T.set(u, y + 2, w, B('Mese Post Light')); }
      } else {
        T.fill(u, y - 3, w, u, y - 1, w, S.trim);
        T.set(u, y, w, half ? S.slab : 0);
        T.fill(u, y + 1, w, u, y + 4, w, 0);
      }
    }
  });
  // The castle on top.
  const s = Math.floor((Rp - 2) * 1.35);
  const bu0 = Math.floor(cu - s / 2), bw0 = Math.floor(cw - s / 2);
  const levels = rng.int(2, 4);
  const b = building(T, { S, rng, theme: 'wizard', seed: o.seed + 1, x0: bu0, z0: bw0, x1: bu0 + s - 1, z1: bw0 + s - 1, y0: top, levels, roof: 'terrace',
    entrances: [{ side: 'S' }, { side: 'N' }, { side: 'E' }, { side: 'W' }], treasure: 1200 + levels * 200, tier: 4, setback: true });
  const ry = b.top + 1;
  parapet(T, bu0, ry, bw0, bu0 + s - 1, bw0, S); parapet(T, bu0, ry, bw0 + s - 1, bu0 + s - 1, bw0 + s - 1, S);
  parapet(T, bu0, ry, bw0, bu0, bw0 + s - 1, S); parapet(T, bu0 + s - 1, ry, bw0, bu0 + s - 1, bw0 + s - 1, S);
  // Turrets on the rim between the castle and the edge.
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, tu = Math.floor(cu + Math.cos(a) * (Rp - 3.5)), tw = Math.floor(cw + Math.sin(a) * (Rp - 3.5));
    T.cyl(tu + 0.5, tw + 0.5, 2, top, top + 8, S.wall);
    let r = 2.8, y = top + 9; while (r > 0.6) { T.cyl(tu + 0.5, tw + 0.5, r, y, y, S.roof); r -= 0.5; y++; }
    T.set(tu, y, tw, S.banner);
    T.set(tu, top + 7, tw, B('Mese Lamp'));
  }
  // A path of the castle's stone around the top.
  T.cyl(cu, cw, Rp - 1, top - 1, top - 1, S.path, 3);
  // Gate posts at the foot of the path.
  const fu = Math.floor(cu + Math.cos(a0) * rm), fw = Math.floor(cw + Math.sin(a0) * rm);
  lampPost(T, fu - 3, G, fw + 3, 'Stone Bricks'); lampPost(T, fu + 3, G, fw + 3, 'Stone Bricks');
}
// A floating island castle reached by a tall stair tower and a bridge.
function floatingCastle(o) {
  const { T, S, rng, W, D } = o;
  const top = G + rng.int(55, 85), R = rng.int(22, 27);
  const cu = W / 2, cw = D / 2 - 6;
  const rock = mix([[B('rock_wall_08'), 4], [B('cliff_side'), 3], [B('Stone'), 2], [B('Dirt'), 1]], o.seed, 4);
  // Island: an inverted cone of rock with a grassy top.
  T.each(Math.floor(cu - R - 2), Math.floor(cw - R - 2), Math.ceil(cu + R + 2), Math.ceil(cw + R + 2), (u, w) => {
    const d = Math.hypot(u + 0.5 - cu, w + 0.5 - cw) + (fbm2(u / 8, w / 8, o.seed, 2) - 0.5) * 4;
    if (d > R) return;
    const depth = Math.floor((1 - d / R) * 26 + 3 + fbm2(u / 5, w / 5, o.seed + 1, 2) * 6);
    T.fill(u, top - depth, w, u, top - 2, w, rock);
    T.set(u, top - 1, w, B('Grass'));
    if (hashf(u, w, o.seed) < 0.06) T.fill(u, top - depth - 1 - (hash(u, w) % 6), w, u, top - depth - 1, w, B('Jungle Leaves'));
  });
  // Stair tower at the front, tall enough to reach the island's surface, then a bridge.
  const levels = Math.ceil((top - G) / LH);
  const towerTop = G + levels * LH; // stand height of the tower's roof
  const tu0 = Math.floor(cu - 7), tw0 = Math.floor(D - 22);
  const tb = building(T, { S, rng, theme: 'wizard', seed: o.seed + 9, x0: tu0, z0: tw0, x1: tu0 + 14, z1: tw0 + 14, levels, roof: 'terrace', minR: 11, maxR: 11,
    entrances: [{ side: 'S' }], treasure: 60, tier: 2, noHall: true });
  parapet(T, tu0, tb.top + 1, tw0, tu0 + 14, tw0, S); parapet(T, tu0, tb.top + 1, tw0 + 14, tu0 + 14, tw0 + 14, S);
  parapet(T, tu0, tb.top + 1, tw0, tu0, tw0 + 14, S); parapet(T, tu0 + 14, tb.top + 1, tw0, tu0 + 14, tw0 + 14, S);
  // Bridge from the tower roof to the island edge, then steps down to the island surface.
  const bu = Math.floor(cu), bridgeY = towerTop;
  const edgeW = Math.ceil(cw + R - 3);
  T.fill(bu - 1, bridgeY - 1, edgeW - 2, bu + 1, bridgeY - 1, tw0 + 1, S.trim);
  T.fill(bu - 1, bridgeY, edgeW - 2, bu + 1, bridgeY + 3, tw0 + 1, 0);
  T.fill(bu - 2, bridgeY, edgeW, bu - 2, bridgeY, tw0 - 1, S.wall); T.fill(bu + 2, bridgeY, edgeW, bu + 2, bridgeY, tw0 - 1, S.wall);
  for (let w = edgeW; w < tw0; w += 4) T.set(bu - 2, bridgeY + 1, w, B('Mese Post Light'));
  // Steps down (or up) from the bridge to the island top.
  let y = bridgeY, w = edgeW - 2;
  while (y > top) { y--; w--; T.fill(bu - 1, y - 1, w, bu + 1, y - 1, w, S.trim); T.fill(bu - 1, y, w, bu + 1, y + 3, w, 0); }
  while (y < top) { T.fill(bu - 1, y - 1, w, bu + 1, y, w, S.trim); y++; w--; T.fill(bu - 1, y, w, bu + 1, y + 3, w, 0); }
  // The castle on the island.
  const s = Math.floor(R * 1.15);
  const bu0 = Math.floor(cu - s / 2), bw0 = Math.floor(cw - s / 2) - 2;
  const lv = rng.int(2, 4);
  const b = building(T, { S, rng, theme: 'royal', seed: o.seed + 1, x0: bu0, z0: bw0, x1: bu0 + s - 1, z1: bw0 + s - 1, y0: top, levels: lv, roof: 'terrace',
    entrances: [{ side: 'S' }], treasure: 1300 + lv * 200, tier: 4, setback: true });
  const ry = b.top + 1;
  parapet(T, bu0, ry, bw0, bu0 + s - 1, bw0, S); parapet(T, bu0, ry, bw0 + s - 1, bu0 + s - 1, bw0 + s - 1, S);
  parapet(T, bu0, ry, bw0, bu0, bw0 + s - 1, S); parapet(T, bu0 + s - 1, ry, bw0, bu0 + s - 1, bw0 + s - 1, S);
  for (const [tu, tw] of [[bu0 - 1, bw0 - 1], [bu0 + s, bw0 - 1], [bu0 - 1, bw0 + s], [bu0 + s, bw0 + s]]) {
    T.cyl(tu + 0.5, tw + 0.5, 3, top - 1, b.top + 6, S.wall);
    let r = 4, yy = b.top + 7; while (r > 0.6) { T.cyl(tu + 0.5, tw + 0.5, r, yy, yy, S.roof); r -= 0.5; yy++; }
    T.set(tu, yy, tw, S.banner);
  }
  // Path on the island from the steps to the door, and a rim of slabs.
  T.fill(bu - 1, top - 1, bw0 + s, bu + 1, top - 1, w, S.path);
  T.each(Math.floor(cu - R - 3), Math.floor(cw - R - 3), Math.ceil(cu + R + 3), Math.ceil(cw + R + 3), (u, ww) => {
    if (Math.hypot(u + 0.5 - cu, ww + 0.5 - cw) < R - 4) return; // only the island's rim (never the stair tower's roof)
    if (u >= tu0 - 2 && u <= tu0 + 16 && ww >= tw0 - 2 && ww <= tw0 + 16) return;
    if (T.get(u, top - 1, ww) && !T.get(u, top - 1, ww - 1) + !T.get(u, top - 1, ww + 1) + !T.get(u - 1, top - 1, ww) + !T.get(u + 1, top - 1, ww) > 0 && T.get(u, top, ww) === 0) T.set(u, top, ww, S.slab);
  });
  for (let n = 0; n < 6; n++) { const a = rng.range(0, 6.28), d = rng.range(R * 0.75, R - 3); tree(T, Math.floor(cu + Math.cos(a) * d), top, Math.floor(cw + Math.sin(a) * d), rng.pick(['oak', 'aspen']), 0.8); }
}
export { TVol, building, tower };

// ---------------------------------------------------------------------------
// Floating castles: huge castles on mossy rocks far above the labyrinth, with no way up from the ground. You
// reach them by the portals at the ends of dungeons, caves, mine tunnels and on watchtowers (or by flying).
// Variants: Dracula (dark gothic, needle spires), Cloud Palace, Crystal Citadel, Ember Fortress, Jade Temple,
// Overgrown Sky Ruin.
// ---------------------------------------------------------------------------
const FLOAT_VARIANTS = ['dracula', 'dracula', 'cloud', 'crystal', 'ember', 'jade', 'ruin'];
export function floatingInfo(plan) {
  const c = plan.main;
  if (!c || c.kind !== 'floating') return null;
  const cx = Math.floor((c.bx0 + c.bx1) / 2), cz = Math.floor((c.bz0 + c.bz1) / 2);
  const h = hash(c.seed, 0xf10a7);
  const R = 52 + (h % 11), top = 166 + ((h >>> 8) % 14);
  const variant = FLOAT_VARIANTS[(h >>> 16) % FLOAT_VARIANTS.length];
  const names = { dracula: 'Dracula’s Spires', cloud: 'Cloud Palace', crystal: 'Crystal Citadel', ember: 'Ember Fortress', jade: 'Jade Sky Temple', ruin: 'Overgrown Sky Ruin' };
  return { cx, cz, R, top, variant, name: `${names[variant]} of ${placeName(c.seed)}`,
    pad: { x: cx + 0.5, y: top, z: cz + R - 13 + 0.5, yaw: 0 },
    below: { x: cx + 0.5, y: GROUND, z: c.bz1 - 2 + 0.5, yaw: 0 } };
}
// The nearest floating castle to (x, z): its arrival pad (or null).
export function nearestFloating(x, z, seed, regionPlan) {
  const RSZ = 192, rx0 = Math.floor(x / RSZ), rz0 = Math.floor(z / RSZ);
  let best = null;
  for (let rz = rz0 - 4; rz <= rz0 + 4; rz++) for (let rx = rx0 - 4; rx <= rx0 + 4; rx++) {
    const info = floatingInfo(regionPlan(rx, rz, seed));
    if (!info) continue;
    const d = Math.hypot(info.cx - x, info.cz - z);
    if (!best || d < best.d) best = { d, info };
  }
  return best && best.info;
}
function skyFortress(o, info) {
  const { T, rng } = o;
  const sty = castleStyles();
  const pickS = { dracula: [8, 4], cloud: [2], crystal: [6], ember: [4], jade: [10], ruin: [5] }[info.variant];
  const S = { ...sty[rng.pick(pickS)] };
  if (info.variant === 'dracula') Object.assign(S, { roof: B('Obsidian Bricks'), banner: rng.pick([B('Red Wool'), B('Black Wool')]), carpet: B('Red Wool'), window: B('Obsidian Glass') });
  if (info.variant === 'cloud') Object.assign(S, { roof: B('Gold Block') });
  const cu = info.cx - o.c.bx0 + 0.5, cw = info.cz - o.c.bz0 + 0.5, R = info.R, top = info.top;
  const seed = o.seed;
  // --- The ground garden below, in the castle's shadow: a still lake and a statue gazing up. ---
  {
    const gu = Math.floor(cu), gw = Math.floor(cw);
    T.each(gu - 16, gw - 16, gu + 16, gw + 16, (u, w) => {
      const d = Math.hypot(u - gu, w - gw) + (hashf(u, w, seed) - 0.5) * 2;
      if (d < 12) { T.fill(u, G - 2, w, u, G, w, 0); T.fill(u, G - 2, w, u, G - 1, w, B('Water Source')); T.set(u, G - 3, w, B('Sand')); if (hashf(w, u, seed) < 0.04) T.set(u, G - 1, w, B('Water Source')); }
      else if (d < 14) { T.set(u, G - 1, w, B('mossy_brick_floor')); T.set(u, G, w, hashf(u, w, 3) < 0.2 ? B('Papyrus') : 0); }
    });
    monument(T, gu, G, gw, seed, 2, { kind: 'angel', stone: 'marble_01', pr: 1, ph: 2, scale: 1 });
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const u = Math.floor(gu + Math.cos(a) * 18), w = Math.floor(gw + Math.sin(a) * 18); T.fill(u, G, w, u, G + rng.int(3, 7), w, B('mossy_stone_wall')); }
    o.T.vol.marks.push(['floating', info.cx, G, info.cz, info.name, info.variant]);
  }
  // --- The rock: an inverted cone of mossy stone, moss streaming down its sides and underside. ---
  const rock = mix([[B('rock_wall_08'), 4], [B('cliff_side'), 3], [B('mossy_rock'), 3], [B('Stone'), 2]], seed, 4);
  const mossy = mix([[B('mossy_rock'), 5], [B('Mossy Cobblestone'), 3], [B('mossy_stone_wall'), 2]], seed + 1, 3);
  const strand = mix([[B('Jungle Leaves'), 4], [B('Leaves'), 3], [B('Blueberry Bush'), 1], [B('Mossy Dirt'), 2]], seed + 2, 2);
  const topM = info.variant === 'crystal' ? B('Snow') : info.variant === 'ember' ? B('volcanic_rock_tiles') : B('Grass');
  const radius = (u, w) => R + fbm2(u / 9, w / 9, seed + 5, 2) * 3.5;
  const rockIsland = (ru, rw, rR, rTop, depthK, strands, surf) => {
    T.each(Math.floor(ru - rR - 4), Math.floor(rw - rR - 4), Math.ceil(ru + rR + 4), Math.ceil(rw + rR + 4), (u, w) => {
      const d = Math.hypot(u + 0.5 - ru, w + 0.5 - rw), rr = rR === R ? radius(u, w) : rR + fbm2(u / 4, w / 4, seed + 9, 2) * 1.5;
      if (d >= rr) return;
      const k = 1 - d / rr;
      const depth = Math.floor(Math.pow(k, 0.7) * rR * depthK + 3 + fbm2(u / 5, w / 5, seed + 3, 2) * 6);
      const bot = Math.max(rTop - depth, 140);
      for (let y = bot; y <= rTop - 2; y++) T.set(u, y, w, rTop - y < 6 || hashf(u, y, w) < 0.15 ? mossy : rock);
      T.set(u, rTop - 1, w, surf);
      // Moss and roots streaming down from the underside and the outer slopes.
      if (strands && (d > rr * 0.35 || hashf(w, u, seed) < 0.1) && hashf(u, w, seed + 7) < 0.42) {
        const len = Math.min(2 + (hash(u, w, seed) % (d > rr * 0.75 ? 14 : 8)), bot - 128);
        if (len > 0) T.fill(u, bot - len, w, u, bot - 1, w, strand);
      }
    });
  };
  rockIsland(cu, cw, R, top, 0.6, true, topM);
  // Satellite rocks drifting around the castle (with a tree, a crystal or a shrine on each).
  for (let n = rng.int(4, 7), k = 0; k < n; k++) {
    const a = rng.range(0, 6.28), dist = R + rng.range(6, 14), rr = rng.range(5, 10);
    const su = cu + Math.cos(a) * dist, sw = cw + Math.sin(a) * dist, st = top + rng.int(-14, 16);
    rockIsland(su, sw, rr, st, 1.3, true, topM);
    const what = rng.int(0, 2);
    if (what === 0) tree(T, Math.floor(su), st, Math.floor(sw), rng.pick(['oak', 'pine', 'aspen']), 0.8);
    else if (what === 1) T.fill(Math.floor(su), st, Math.floor(sw), Math.floor(su), st + rng.int(2, 4), Math.floor(sw), info.variant === 'ember' ? B('Lava Source') : B('Mese Crystal Ore'));
    else monument(T, Math.floor(su), st, Math.floor(sw), seed + k, rng.int(0, 3), { kind: 'owl', stone: 'Obsidian Block', pr: 0, ph: 1 });
  }
  // A waterfall (a lava fall for the Ember Fortress) pouring off the edge into the sky.
  {
    const a = rng.range(0, 6.28), fu = Math.floor(cu + Math.cos(a) * (R + 1.5)), fw = Math.floor(cw + Math.sin(a) * (R + 1.5));
    const fall = info.variant === 'ember' ? B('Lava Source') : B('Water Source');
    T.fill(fu, 130, fw, fu + 1, top - 1, fw + 1, fall); // ends well above anything you can build
    T.fill(Math.floor(cu + Math.cos(a) * (R - 3)), top - 1, Math.floor(cw + Math.sin(a) * (R - 3)), fu, top - 1, fw, fall);
    if (info.variant !== 'ember') T.fx.push(['spray', fu + 1, 130, fw + 1, 3, 1]);
  }
  // --- The castle ---
  const hw = Math.floor(R * 0.575), x0 = Math.floor(cu) - hw, x1 = Math.floor(cu) + hw, z0 = Math.floor(cw - R * 0.62), z1 = z0 + Math.floor(R * 0.8);
  const levels = info.variant === 'cloud' || info.variant === 'ruin' ? rng.int(2, 3) : rng.int(3, 4);
  const b = building(T, { S, rng, theme: info.variant, seed: seed + 1, x0, z0, x1, z1, y0: top, levels, crypt: info.variant !== 'cloud', roof: info.variant === 'ruin' ? 'none' : 'terrace',
    entrances: [{ side: 'S' }, { side: rng.pick(['E', 'W']) }], setback: info.variant !== 'jade', treasure: 6000 + levels * 900, tier: 5, crates: 5, openChance: 0.15, maxR: rng.int(14, 18) });
  const ry = b.top + 1;
  if (info.variant !== 'ruin') { parapet(T, x0, ry, z0, x1, z0, S); parapet(T, x0, ry, z1, x1, z1, S); parapet(T, x0, ry, z0, x0, z1, S); parapet(T, x1, ry, z0, x1, z1, S); }
  const roofH = b.top - top;
  // Corner towers with spires (needles for Dracula, pagodas for Jade, gold for Cloud...).
  const steep = { dracula: 0.28, cloud: 0.5, crystal: 0.35, ember: 0.6, jade: 1.2, ruin: 0.7 }[info.variant];
  const roofKind = info.variant === 'jade' ? 'pyramid' : info.variant === 'ember' ? 'battle' : 'cone';
  const roofM = info.variant === 'crystal' ? B('Diamond Block') : info.variant === 'cloud' ? B('Gold Block') : S.roof;
  [[x0 - 5, z0 + 6, 1], [x1 + 5, z0 + 6, 0], [x0 - 5, z1 + 5, 2], [x1 + 5, z1 + 5, 3], [Math.floor(cu), z0 - 6, 1]].forEach(([tu, tw, door]) => {
    const h = Math.min(roofH + rng.int(8, 18), 228 - top);
    tower(T, tu, tw, { S, rng, s: 7, R: 4.5, y0: top, h, round: info.variant !== 'jade', roof: roofKind, steep, roofM, door, flag: S.banner });
    if (info.variant === 'jade') for (let k = 1; k <= 2; k++) { const yy = top + Math.floor(h * k / 3); for (let r = 6.5; r > 4; r -= 1) T.cyl(tu + 0.5, tw + 0.5, r, yy + Math.round(6.5 - r), yy + Math.round(6.5 - r), roofM, 1.2); }
  });
  // Spires rising from the roof (clear of the roof stair).
  const spires = info.variant === 'dracula' ? rng.int(9, 15) : info.variant === 'ruin' ? 0 : rng.int(3, 7);
  for (let k = 0; k < spires; k++) {
    const su = rng.int(x0 + 4, x1 - 4), sw = rng.int(z0 + 4, z1 - 4), r = rng.range(1.5, 2.6), h = rng.int(6, 16);
    if (!roofCorners(b, [[su, sw]], r + 3).length || !onTopRoof(b, su, sw, r + 1)) continue;
    const yTop = Math.min(ry + h, 236);
    T.cyl(su + 0.5, sw + 0.5, r, ry, yTop, S.wall);
    T.set(su, yTop - 2, sw, B('Mese Lamp'));
    let rr = r + 0.6, y = yTop + 1;
    while (rr > 0.5 && y < 252) { T.cyl(su + 0.5, sw + 0.5, rr, y, y, roofM); rr -= steep; y++; }
    if (y < 254) T.set(su, y, sw, info.variant === 'cloud' ? B('Gold Block') : S.trim);
  }
  // The great central spire (Dracula) or a golden dome (Cloud) or crystal shards (Crystal).
  const ccu = Math.floor(cu), ccw = Math.floor((z0 + z1) / 2);
  if (roofCorners(b, [[ccu, ccw]], 8).length && onTopRoof(b, ccu, ccw, 8)) {
    if (info.variant === 'dracula') {
      const yTop = Math.min(ry + rng.int(18, 26), 230);
      T.cyl(ccu + 0.5, ccw + 0.5, 3.5, ry, yTop, S.wall);
      for (let y = ry + 4; y < yTop; y += 5) for (const [du, dw] of [[0, -4], [0, 3], [-4, 0], [3, 0]]) T.set(ccu + du, y, ccw + dw, B('Mese Lamp'));
      let rr = 4.4, y = yTop + 1; while (rr > 0.5 && y < 253) { T.cyl(ccu + 0.5, ccw + 0.5, rr, y, y, roofM); rr -= 0.22; y++; }
    } else if (info.variant === 'cloud') {
      T.cyl(ccu + 0.5, ccw + 0.5, 7, ry, ry + 3, S.wall);
      T.sphere(ccu + 0.5, ry + 4, ccw + 0.5, 7.5, B('Gold Block'), false, ry + 4);
      T.set(ccu, ry + 12, ccw, B('Mese Lamp'));
    } else if (info.variant === 'crystal') {
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, du = Math.round(Math.cos(a) * 3), dw = Math.round(Math.sin(a) * 3), h = rng.int(6, 16); T.fill(ccu + du, ry, ccw + dw, ccu + du, ry + h, ccw + dw, rng.pick([B('Diamond Block'), B('Glass'), B('Mese Crystal Ore'), B('Ice')])); }
    }
  }
  // Clouds drifting under the Cloud Palace.
  if (info.variant === 'cloud') for (let k = 0; k < 10; k++) { const a = rng.range(0, 6.28), d = rng.range(R * 0.6, R + 10); T.sphere(cu + Math.cos(a) * d, top - rng.int(6, 22), cw + Math.sin(a) * d, rng.range(2.5, 5), B('Cloud'), true); }
  // Crystal shards jutting out of the rock.
  if (info.variant === 'crystal') for (let k = 0; k < 14; k++) { const a = rng.range(0, 6.28), d = rng.range(R * 0.5, R - 2), u = Math.floor(cu + Math.cos(a) * d), w = Math.floor(cw + Math.sin(a) * d); if (w > z1 + 2 && w < cw + R - 16) continue; T.fill(u, top, w, u, top + rng.int(2, 6), w, rng.pick([B('Diamond Block'), B('Ice'), B('Mese Crystal Ore')])); }
  // --- The courtyard: paving, statues, lamps, and the portal hall at the south edge. ---
  const pz0 = z1 + 6, pz1 = Math.floor(cw + R - 6);
  T.each(x0 + 2, pz0, x1 - 2, pz1, (u, w) => { if (Math.hypot(u + 0.5 - cu, w + 0.5 - cw) < R - 3) { T.set(u, top - 1, w, S.path); T.fill(u, top, w, u, top + 3, w, 0); } });
  T.fill(Math.floor(cu) - 1, top - 1, z1, Math.floor(cu) + 1, top - 1, pz1, S.trim);
  const gargoyle = info.variant === 'cloud' ? 'angel' : info.variant === 'jade' ? 'lion' : 'owl';
  for (let w = pz0 + 2; w < pz1 - 9; w += 6) for (const su of [Math.floor(cu) - 5, Math.floor(cu) + 5]) monument(T, su, top, w, seed + w + su, su < cu ? 3 : 1, { kind: gargoyle, stone: { cloud: 'marble_01', jade: 'Stone Block', crystal: 'Ice', ruin: 'mossy_rock', ember: 'volcanic_rock_tiles', dracula: 'dark_brick_wall' }[info.variant], base: 'Stone Bricks', pr: 0, ph: 1 });
  for (const su of [x0 + 3, x1 - 3]) for (let w = pz0 + 1; w < pz1; w += 7) lampPost(T, su, top, w, 'Obsidian Bricks', 3);
  // Two return portals: to the courtyard, and down to the labyrinth below this castle.
  const pw = Math.floor(cw + R - 9);
  // (No portals on the plaza: jump off, glide down, or fly.)
  T.fill(Math.floor(cu) - 7, top - 1, pw - 4, Math.floor(cu) + 6, top - 1, pw + 1, B('marble_tiles'));
  // A low wall around the rim so you don't wander off the edge (step over it to jump, if you have a glider).
  T.each(Math.floor(cu - R - 4), Math.floor(cw - R - 4), Math.ceil(cu + R + 4), Math.ceil(cw + R + 4), (u, w) => {
    const d = Math.hypot(u + 0.5 - cu, w + 0.5 - cw), rr = radius(u, w);
    if (d > rr - 1.6 && d <= rr - 0.6 && T.get(u, top, w) === 0) T.set(u, top, w, S.slab);
  });
}
import { regionPlan as _regionPlan } from './maze.js';
function homeDest() {
  const c = _regionPlan(0, 0, 1).main; // the courtyard is in the same place for every seed
  return { x: (c.bx0 + c.bx1 + 1) / 2, y: G, z: (c.bz0 + c.bz1 + 1) / 2 + 13, yaw: 0 };
}
export { homeDest };
