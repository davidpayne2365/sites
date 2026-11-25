// Decorations: voxel statues, fountains, trees, plants, lamps, benches and the small garden features.
import { BID, facingOf } from '../blocks.js';
import { RNG, hash, hashf, mix } from './util.js';

export function B(name) {
  const id = BID[name] ?? BID['photo:' + name];
  if (!id) throw new Error('Unknown block: ' + name);
  return id;
}
export const AIR = 0;

// ---------------------------------------------------------------------------
// Plants
// ---------------------------------------------------------------------------
const GRASSES = ['Grass Tuft', 'Short Grass', 'Grass Clump', 'Tall Grass', 'Thick Grass'];
const FLOWERS = ['Rose', 'Tulip', 'Dandelion', 'White Dandelion', 'Geranium', 'Viola', 'Green Chrysanthemum', 'Black Tulip'];
export const plantIds = { grass: GRASSES.map(B), flowers: FLOWERS.map(B), ferns: ['Fern', 'Large Fern', 'Giant Fern', 'Jungle Grass'].map(B),
  mush: [B('Red Mushroom'), B('Brown Mushroom')], dry: [B('Dry Grass Tuft'), B('Tall Dry Grass'), B('Dry Shrub')] };
// A random plant (or nothing) for a floor cell; `lush` 0..1 scales the density.
export function plantFor(x, z, seed, lush = 1, nearWall = false) {
  const r = hashf(x, z, seed, 0x91a);
  const pick = (arr, k) => arr[hash(x, z, seed, k) % arr.length];
  if (r < 0.16 * lush) return pick(plantIds.grass, 1);
  if (nearWall && r < 0.25 * lush) return pick(plantIds.ferns, 2);
  if (r < 0.19 * lush) return pick(plantIds.flowers, 3);
  if (r > 0.995) return pick(plantIds.mush, 4);
  return 0;
}
export function flowerBed(vol, x0, z0, x1, z1, y, seed) {
  vol.fill(x0, y - 1, z0, x1, y - 1, z1, B('Mossy Dirt'));
  const f = plantIds.flowers[hash(x0, z0, seed) % plantIds.flowers.length], g = plantIds.flowers[hash(z0, x0, seed) % plantIds.flowers.length];
  vol.each(x0, z0, x1, z1, (x, z) => { const r = hashf(x, z, seed); if (r < 0.75) vol.set(x, y, z, r < 0.4 ? f : r < 0.6 ? g : plantIds.grass[hash(x, z) % 5]); });
}

// ---------------------------------------------------------------------------
// Trees (deterministic from their position)
// ---------------------------------------------------------------------------
const TREES = {
  oak: { log: 'Log', leaves: 'Leaves' }, jungle: { log: 'Jungle Log', leaves: 'Jungle Leaves' }, aspen: { log: 'Aspen Log', leaves: 'Aspen Leaves' },
  acacia: { log: 'Acacia Log', leaves: 'Acacia Leaves' }, pine: { log: 'Pine Log', leaves: 'Pine Needles' },
};
export function tree(vol, x, y, z, kind = 'oak', scale = 1) {
  const t = TREES[kind] || TREES.oak, rng = new RNG(hash(x, y, z, 0x7ee));
  const log = B(t.log), leaves = B(t.leaves);
  if (kind === 'pine') {
    const h = Math.round(rng.int(9, 13) * scale);
    vol.fill(x, y, z, x, y + h - 1, z, log);
    for (let k = 3; k <= h + 1; k++) {
      const r = Math.max(0.6, (h + 1 - k) * 0.38 + ((k & 1) ? 0.6 : 0));
      vol.cyl(x + 0.5, z + 0.5, r + 0.5, y + k, y + k, leaves);
    }
    vol.set(x, y + h, z, leaves); vol.set(x, y + h + 1, z, leaves);
    vol.fill(x, y, z, x, y + h - 1, z, log);
    return;
  }
  const h = Math.round(rng.int(kind === 'jungle' ? 8 : 5, kind === 'jungle' ? 12 : 7) * scale);
  const r = (kind === 'acacia' ? 3.6 : kind === 'jungle' ? 4.2 : 3.2) * scale;
  vol.fill(x, y, z, x, y + h - 1, z, log);
  if (kind === 'jungle' && scale > 0.9) vol.fill(x, y, z, x + 1, y + h - 1, z + 1, log);
  const cy = y + h - (kind === 'acacia' ? 0 : 1);
  const R = Math.ceil(r) + 1;
  vol.each(x - R, z - R, x + R, z + R, (lx, lz) => {
    for (let ly = cy - 3; ly <= cy + 3; ly++) {
      const dx = lx - x, dz = lz - z, dy = (ly - cy) * (kind === 'acacia' ? 2.2 : 1.25);
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + hashf(lx, ly, lz, 5) * 1.3;
      if (d < r) vol.put(lx, ly, lz, leaves);
    }
  });
  // Branches poking out.
  for (let k = 0; k < 3; k++) {
    const dx = rng.int(-1, 1), dz = rng.int(-1, 1);
    vol.set(x + dx, cy - 1, z + dz, log);
  }
}
export function bush(vol, x, y, z, r = 1.6, kind = 'Leaves') {
  const id = B(kind), R = Math.ceil(r);
  vol.each(x - R, z - R, x + R, z + R, (lx, lz) => {
    for (let ly = y; ly <= y + R; ly++) {
      const d = Math.hypot(lx - x, (ly - y) * 1.4, lz - z) + hashf(lx, ly, lz, 9) * 0.8;
      if (d < r) vol.put(lx, ly, lz, id);
    }
  });
}

// ---------------------------------------------------------------------------
// Voxel statues. Models are layers from the bottom up; each layer is rows from back (-z) to front (+z).
// Keys: a main stone, b accent (gold / steel), c dark, g glow, w cloth, l leaves.
// ---------------------------------------------------------------------------
const MODELS = {
  knight: [
    ['.....', '.a.a.', '.....'], ['.....', '.a.a.', '.....'], ['.....', '.a.a.', '.....'],
    ['.....', '.aaa.', '.....'], ['.....', 'aaaaa', 'c...b'], ['.....', 'aaaaa', 'c...b'], ['.....', 'aaaaa', 'c...b'],
    ['.....', '.aaa.', '....b'], ['.....', '..a..', '....b'], ['.....', '.cac.', '....b'], ['.....', '..b..', '.....'],
  ],
  king: [
    ['.....', '.www.', '.www.'], ['.....', '.www.', '.www.'], ['.....', '.www.', '.www.'], ['..w..', 'wwwww', '.www.'],
    ['.....', 'aaaaa', '.a.ab'], ['.....', 'aaaaa', '....b'], ['.....', '.aaa.', '....g'], ['.....', '..a..', '.....'],
    ['.....', '.bab.', '.....'], ['.....', '.b.b.', '.....'],
  ],
  angel: [
    ['.......', '..a.a..', '.......'], ['.......', '..a.a..', '.......'], ['.......', '..aaa..', '.......'],
    ['a.....a', 'aaaaaaa', '.......'], ['aa...aa', '.aaaaa.', '.......'], ['aaa.aaa', '..aaa..', '.......'],
    ['.aa.aa.', '...a...', '.......'], ['..a.a..', '..aaa..', '.......'], ['.......', '...a...', '.......'], ['.......', '..bbb..', '.......'],
  ],
  lion: [
    ['.......', '.a...a.', '.a...a.'], ['.......', '.aaaaa.', '.aaaaa.'], ['a......', '.aaaaa.', 'caaaaa.'],
    ['.......', '.....aa', '....aaa'], ['.......', '.....cc', '....ccc'],
  ],
  wizard: [
    ['.....', '.www.', '.www.'], ['.....', '.www.', '.www.'], ['.....', '.www.', '.www.'], ['.....', 'wwwww', '....c'],
    ['.....', 'wwwww', '....c'], ['.....', '.www.', '....c'], ['.....', '..a..', '....c'], ['.....', '.www.', '....g'],
    ['.....', '..w..', '.....'], ['.....', '..w..', '.....'],
  ],
  bust: [
    ['...', '.a.', '...'], ['...', 'aaa', '.b.'], ['...', '.a.', '...'],
  ],
  owl: [
    ['...', 'aaa', 'aaa'], ['...', 'aaa', 'aaa'], ['...', 'aaa', 'bab'], ['...', 'a.a', '...'],
  ],
  head: [
    ['.....', 'aaaaa', 'aaaaa'], ['.....', 'aaaaa', 'aaaaa'], ['.....', 'aaaaa', 'ca.ac'], ['.....', 'aaaaa', 'aaaaa'],
    ['.....', 'aaaaa', 'a.a.a'], ['.....', 'aaaaa', 'aaaaa'], ['.....', 'aaaaa', 'aaaaa'], ['.....', '.aaa.', '.....'],
  ],
  dragon: [
    ['.........', '..a...a..', '..a...a..', '.........'], ['.........', '..aaaaa..', '..aaaaa..', '.........'],
    ['a........', '.aaaaaaa.', '.aaaaaaa.', '.........'], ['aa.....a.', '.aaaaaaaa', '..aaaaa.a', '.......aa'],
    ['.aa...aaa', 'a..aaaa..', '.......aa', '.......ga'], ['..a.aa...', '..a......', '.......cc', '.........'],
    ['...a.....', '.........', '.........', '.........'],
  ],
};
// Draw a statue on top of (x, y, z). facing 0..3 turns it to face +z, -x, -z, +x; scale makes it chunkier.
export function statue(vol, kind, x, y, z, mats, facing = 0, scale = 1) {
  const model = MODELS[kind] || MODELS.knight;
  const d = model[0].length, w = model[0][0].length;
  const key = { a: mats.a, b: mats.b ?? mats.a, c: mats.c ?? mats.a, g: mats.g ?? B('Mese Lamp'), w: mats.w ?? mats.a, l: B('Leaves') };
  model.forEach((layer, ly) => layer.forEach((row, rz) => [...row].forEach((ch, rx) => {
    if (ch === '.') return;
    let ox = rx - (w >> 1), oz = rz - (d >> 1);
    for (let k = 0; k < facing; k++) [ox, oz] = [-oz, ox];
    const m = key[ch];
    vol.fill(x + ox * scale, y + ly * scale, z + oz * scale, x + ox * scale + scale - 1, y + ly * scale + scale - 1, z + oz * scale + scale - 1, m);
  })));
  return model.length * scale;
}
export const STATUE_KINDS = ['knight', 'king', 'angel', 'lion', 'wizard', 'owl', 'head', 'dragon'];
export function pedestal(vol, x, y, z, r, h, m, trim) {
  vol.fill(x - r, y, z - r, x + r, y + h - 1, z + r, m);
  if (trim) vol.fill(x - r, y + h - 1, z - r, x + r, y + h - 1, z + r, trim);
  return y + h;
}
// A statue on a pedestal (statue kind and stone picked from the seed when not given).
export function monument(vol, x, y, z, seed, facing = 0, opts = {}) {
  const rng = new RNG(hash(seed, x, z));
  const stones = ['marble_01', 'castle_brick_02_white', 'Stone Block', 'Sandstone Block', 'mossy_rock', 'Obsidian Block', 'granite_tile', 'Silver Sandstone',
    'rock_wall_08', 'Desert Stone'];
  const a = B(opts.stone || rng.pick(stones)), b = B(opts.accent || rng.pick(['Gold Block', 'Steel Block', 'Bronze Block', 'Copper Block', 'Diamond Block']));
  const kind = opts.kind || rng.pick(STATUE_KINDS.filter(k => k !== 'dragon' || opts.big));
  const scale = opts.scale || 1;
  const top = pedestal(vol, x, y, z, opts.pr ?? 1, opts.ph ?? 2, B(opts.base || 'Stone Bricks'), opts.trim ? B(opts.trim) : 0);
  statue(vol, kind, x, top, z, { a, b, c: B(opts.dark || 'Obsidian Block'), w: B(opts.cloth || rng.pick(['Red Wool', 'Blue Wool', 'Violet Wool', 'Dark Green Wool'])) }, facing, scale);
}

// ---------------------------------------------------------------------------
// Fountains: tiers of basins with water, a column and spray (drawn as particles by the game).
// ---------------------------------------------------------------------------
export function fountain(vol, cx, y, cz, r, opts = {}) {
  const rim = B(opts.rim || 'marble_01'), stone = B(opts.stone || 'castle_brick_02_white'), water = B('Water Source');
  const accent = B(opts.accent || 'Gold Block');
  // Basin: sunk 2 deep, water level with the ground, a 1-high rim.
  vol.cyl(cx, cz, r + 1, y - 3, y - 3, stone);
  vol.cyl(cx, cz, r, y - 2, y - 1, water);
  vol.cyl(cx, cz, r + 1, y - 2, y - 1, stone, 1);
  vol.cyl(cx, cz, r + 1, y, y, rim, 1);
  const tiers = opts.tiers ?? (r >= 6 ? 3 : r >= 4 ? 2 : 1);
  const col = r >= 5 ? 1.2 : 0.8;
  let top = y, tr = r, below = y - 1;
  const spill = [];
  for (let t = 1; t <= tiers; t++) {
    tr = Math.max(1.5, r * (t === 1 ? 0.45 : 0.45 / t));
    top = y + 2 + t * 3;
    // A slim column up to the bowl, the bowl (thin floor, rim, water), water spilling over its edge.
    vol.cyl(cx, cz, col, below + 1, top - 1, stone);
    vol.cyl(cx, cz, tr + 1, top - 1, top - 1, stone);
    vol.cyl(cx, cz, tr * 0.6, top - 2, top - 2, stone);
    vol.cyl(cx, cz, tr + 1, top, top, rim, 1);
    vol.cyl(cx, cz, tr, top, top, water);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + t * 0.4;
      const fx = Math.floor(cx + Math.cos(a) * (tr + 1.6)), fz = Math.floor(cz + Math.sin(a) * (tr + 1.6));
      spill.push([fx, fz, top - 1, below + 1]);
    }
    vol.fx.push(['spray', cx, top + 0.9, cz, tr + 0.8, 0.45]);
    below = top;
  }
  for (const [fx, fz, from, to] of spill) for (let yy = to; yy <= from; yy++) vol.put(fx, yy, fz, water);
  // Crown and the main jet.
  vol.cyl(cx, cz, col, top + 1, top + 2, stone);
  vol.set(Math.floor(cx), top + 3, Math.floor(cz), accent);
  vol.fx.push(['spray', cx, top + 4.2, cz, tr + 1.6, 1]);
  vol.fx.push(['spray', cx, y + 0.9, cz, r * 0.85, 0.5]);
  if (opts.lamps) for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, lx = Math.floor(cx + Math.cos(a) * (r + 2.5)), lz = Math.floor(cz + Math.sin(a) * (r + 2.5));
    lampPost(vol, lx, y, lz, opts.lampPost);
  }
  return top;
}
export function lampPost(vol, x, y, z, post = 'Cobblestone', h = 3) {
  vol.fill(x, y, z, x, y + h - 1, z, B(post));
  vol.set(x, y + h, z, B('Mese Post Light'));
}
export function bench(vol, x, y, z, along = 'x', len = 3, m = 'Planks Slab') {
  const id = B(m);
  for (let k = 0; k < len; k++) vol.set(along === 'x' ? x + k : x, y, along === 'x' ? z : z + k, id);
}
export function well(vol, x, y, z, m = 'Cobblestone', roof = 'Planks') {
  // 3x3 shaft of water, rim, posts and a little roof.
  vol.fill(x - 1, y - 6, z - 1, x + 1, y - 1, z + 1, B('Water Source'));
  vol.shell(x - 2, y - 7, z - 2, x + 2, y, z + 2, B(m));
  vol.fill(x - 2, y - 7, z - 2, x + 2, y - 7, z + 2, B(m));
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) vol.fill(x + dx, y + 1, z + dz, x + dx, y + 3, z + dz, B('Log'));
  vol.fill(x - 2, y + 4, z - 2, x + 2, y + 4, z + 2, B(roof));
  vol.fill(x - 1, y + 5, z - 1, x + 1, y + 5, z + 1, B(roof));
  vol.set(x, y + 3, z, B('Steel Block'));
}
// Brazier: a block with fire on top.
export function brazier(vol, x, y, z, m = 'Bronze Block') { vol.set(x, y, z, B(m)); vol.set(x, y + 1, z, B('Fire')); }
export function torch(vol, x, y, z) { vol.set(x, y, z, B('Torch')); }
// Hanging chandelier from a ceiling at `top` (the ceiling block y).
export function chandelier(vol, x, top, z, len = 1) {
  for (let k = 1; k <= len; k++) vol.set(x, top - k, z, B('Iron Bars'));
  vol.set(x, top - len - 1, z, B('Mese Lamp'));
}
// A portal gate: a 2-wide, 3-tall opening of glowing Portal blocks in a stone frame, standing on (x, y, z).
// axis 'x': the opening runs along x (you face it along z); 'z': along z. Leads to dest { x, y, z, yaw, label }.
export function portalGate(vol, x, y, z, axis, dest, frame = 'Obsidian Bricks') {
  const f = B(frame), pt = B('Portal'), ax = axis === 'x';
  const at = (a, b) => (ax ? [x + a, z] : [x, z + a]);
  for (let a = -1; a <= 2; a++) for (let b = -1; b <= 3; b++) {
    const [px, pz] = at(a, b);
    const inside = a >= 0 && a <= 1 && b >= 0 && b <= 2;
    vol.set(px, y + b, pz, inside ? pt : f);
  }
  const [lx, lz] = at(-1, 0), [rx, rz] = at(2, 0);
  vol.set(lx, y + 4, lz, B('Mese Lamp')); vol.set(rx, y + 4, rz, B('Mese Lamp'));
  const [ax0, az0] = at(0, 0), [ax1, az1] = at(1, 0);
  vol.portal(ax0, y, az0, ax1, y + 2, az1, dest);
}
export { mix, hashf, hash };
export const chestId = facing => facingOf('Treasure Chest', facing);
