// Surface features that sit in labyrinth clearings: the spawn courtyard and the smaller gardens, plus dispatch
// to the castle and underground builders.
import { RNG, GROUND, hash, hashf, mix } from './util.js';
import { P, SIDE } from './maze.js';
import { B, plantFor, tree, bush, monument, fountain, lampPost, bench, well, brazier, chestId, flowerBed, statue, STATUE_KINDS, plantIds, portalGate } from './decor.js';
import { buildCastle } from './castle.js';
import { buildEntrance, skyDest } from './under.js';

const G = GROUND;

// Centres of a clearing's openings, on its inside edge.
export function openingPoints(plan, c) {
  const pts = [];
  for (const o of c.openings) {
    if (o.side !== undefined) {
      const k = o.k;
      if (o.side === SIDE.W) pts.push({ x: c.bx0, z: plan.Z0 + P * (c.j0 + k) + 3.5, side: o.side });
      else if (o.side === SIDE.E) pts.push({ x: c.bx1, z: plan.Z0 + P * (c.j0 + k) + 3.5, side: o.side });
      else if (o.side === SIDE.N) pts.push({ x: plan.X0 + P * (c.i0 + k) + 3.5, z: c.bz0, side: o.side });
      else pts.push({ x: plan.X0 + P * (c.i0 + k) + 3.5, z: c.bz1, side: o.side });
    } else {
      const [i, j, dir] = o.cell;
      // The wall between (i, j) and its E / S neighbour; one of the two cells is in the clearing.
      if (dir === 'E') { const inside = i + 1 >= c.i0 && i + 1 <= c.i1; pts.push({ x: inside ? c.bx0 : c.bx1, z: plan.Z0 + P * j + 3.5, side: inside ? SIDE.W : SIDE.E }); }
      else { const inside = j + 1 >= c.j0 && j + 1 <= c.j1; pts.push({ x: plan.X0 + P * i + 3.5, z: inside ? c.bz0 : c.bz1, side: inside ? SIDE.N : SIDE.S }); }
    }
  }
  return pts;
}
// Grass ground with plants for a whole clearing.
export function clearingGround(vol, c, seed, lush = 0.8, floorMat) {
  const f = floorMat || B('Grass');
  vol.fill(c.bx0 - 1, G - 1, c.bz0 - 1, c.bx1 + 1, G - 1, c.bz1 + 1, f);
  vol.each(c.bx0, c.bz0, c.bx1, c.bz1, (x, z) => { const p = plantFor(x, z, seed, lush); if (p) vol.set(x, G, z, p); });
}
// A path of `m` from (ax, az) to (bx, bz): along x first, then z. Clears plants on it.
export function path(vol, ax, az, bx, bz, w, m, y = G - 1) {
  const h = Math.floor(w / 2);
  const x0 = Math.floor(Math.min(ax, bx)), x1 = Math.floor(Math.max(ax, bx)), z0 = Math.floor(Math.min(az, bz)), z1 = Math.floor(Math.max(az, bz));
  const zA = Math.floor(az), xB = Math.floor(bx);
  vol.fill(x0, y, zA - h, x1, y, zA - h + w - 1, m); vol.fill(x0, y + 1, zA - h, x1, y + 2, zA - h + w - 1, 0);
  vol.fill(xB - h, y, z0, xB - h + w - 1, y, z1, m); vol.fill(xB - h, y + 1, z0, xB - h + w - 1, y + 2, z1, 0);
}

export function buildFeature(vol, plan, c) {
  const rng = new RNG(c.seed);
  switch (c.kind) {
    case 'spawn': return spawnCourtyard(vol, plan, c, rng);
    case 'castle': case 'ruins': case 'skycastle': case 'floating': return buildCastle(vol, plan, c, rng);
    case 'dungeonEntrance': case 'cavesEntrance': case 'tunnelsEntrance': return buildEntrance(vol, plan, c, rng);
    default: return (SMALL[c.kind] || SMALL.garden)(vol, plan, c, rng);
  }
}

// ---------------------------------------------------------------------------
// Spawn: a walled courtyard with a grand fountain and four exits into the labyrinth.
// ---------------------------------------------------------------------------
function spawnCourtyard(vol, plan, c, rng) {
  const cx = (c.bx0 + c.bx1 + 1) / 2, cz = (c.bz0 + c.bz1 + 1) / 2; // 64 x 64 courtyard, centre on a block corner
  clearingGround(vol, c, c.seed, 0.5);
  const plaza = mix([[B('cobblestone_floor_04'), 9], [B('grassy_cobblestone'), 1]], 0x5ba, 6);
  const ring = B('marble_tiles'), pathM = mix([[B('cobblestone_floor_08'), 8], [B('grassy_cobblestone'), 2]], 0x5bb, 5);
  // Round plaza with a marble ring and the fountain.
  vol.cyl(cx, cz, 15, G - 1, G - 1, plaza);
  vol.cyl(cx, cz, 15, G, G + 3, 0);
  vol.cyl(cx, cz, 15.5, G - 1, G - 1, ring, 1.2);
  vol.cyl(cx, cz, 11.5, G - 1, G - 1, ring, 1);
  fountain(vol, cx, G, cz, 7, { tiers: 3, rim: 'marble_01', stone: 'marble_01', accent: 'Gold Block' });
  // Four paths to the exits, lined with hedges and lamps; a coloured banner arch over each exit.
  const exits = [[SIDE.N, 0, -1, 'Red Wool'], [SIDE.E, 1, 0, 'Blue Wool'], [SIDE.S, 0, 1, 'Yellow Wool'], [SIDE.W, -1, 0, 'Green Wool']];
  for (const [side, dx, dz, banner] of exits) {
    const ex = dx ? (dx > 0 ? c.bx1 + 2 : c.bx0 - 2) : cx, ez = dz ? (dz > 0 ? c.bz1 + 2 : c.bz0 - 2) : cz;
    const sx = cx + dx * 15, sz = cz + dz * 15;
    const x0 = Math.floor(Math.min(sx, ex) - (dx ? 0 : 2)), x1 = Math.floor(Math.max(sx, ex) + (dx ? 0 : 1));
    const z0 = Math.floor(Math.min(sz, ez) - (dz ? 0 : 2)), z1 = Math.floor(Math.max(sz, ez) + (dz ? 0 : 1));
    vol.fill(x0, G - 1, z0, x1, G - 1, z1, pathM);
    vol.fill(x0, G, z0, x1, G + 3, z1, 0);
    // Hedges and lamps beside the path.
    for (let t = 17; t < 30; t++) {
      for (const s of [-3, 2]) {
        const hx = Math.floor(dx ? cx + dx * t : cx + s), hz = Math.floor(dz ? cz + dz * t : cz + s);
        vol.set(hx, G, hz, B('Leaves'));
        if (t % 6 === 2) { lampPost(vol, hx, G, hz, 'Stone Bricks', 2); }
        else if (hashf(hx, hz, 4) < 0.5) vol.set(hx, G + 1, hz, plantIds.flowers[hash(hx, hz) % 8]);
      }
    }
    // Arch over the exit, in the labyrinth wall line.
    const ax = Math.floor(dx ? (dx > 0 ? c.bx1 + 1 : c.bx0 - 2) : cx - 3), az = Math.floor(dz ? (dz > 0 ? c.bz1 + 1 : c.bz0 - 2) : cz - 3);
    const ax1 = dx ? ax + 1 : ax + 5, az1 = dz ? az + 1 : az + 5;
    vol.fill(ax, G + 4, az, ax1, G + 5, az1, B('castle_brick_02_white'));
    vol.fill(ax, G + 6, az, ax1, G + 6, az1, B('marble_01'));
    const mx = Math.floor(dx ? ax : cx), mz = Math.floor(dz ? az : cz);
    vol.set(mx, G + 7, mz, B('Gold Block')); vol.set(dx ? mx + 1 : mx - 1, G + 7, dz ? mz + 1 : mz - 1, B('Gold Block'));
    // Banners hanging on the courtyard side of the arch.
    const bxs = dx ? [Math.floor(dx > 0 ? c.bx1 : c.bx0)] : [Math.floor(cx - 4), Math.floor(cx + 3)];
    const bzs = dz ? [Math.floor(dz > 0 ? c.bz1 : c.bz0)] : [Math.floor(cz - 4), Math.floor(cz + 3)];
    for (const bx of bxs) for (const bz of bzs) vol.fill(bx, G + 2, bz, bx, G + 4, bz, B(banner));
    for (const bx of bxs) for (const bz of bzs) vol.set(bx, G + 5, bz, B('Mese Lamp'));
  }
  // Statues on the diagonals, facing the fountain.
  const kinds = ['knight', 'angel', 'king', 'wizard'];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], k) => {
    const x = Math.floor(cx + sx * 20), z = Math.floor(cz + sz * 20);
    const facing = sz < 0 ? 0 : 2; // toward the fountain along z
    monument(vol, x, G, z, c.seed + k, facing, { kind: kinds[k], stone: 'marble_01', base: 'castle_brick_02_white', trim: 'Gold Block', pr: 2, ph: 2, accent: 'Gold Block', scale: 1 });
    // Big trees in the corners behind the statues, benches facing the plaza.
    tree(vol, Math.floor(cx + sx * 26), G, Math.floor(cz + sz * 26), k % 2 ? 'oak' : 'aspen', 1.25);
    bench(vol, Math.floor(cx + sx * 13) - 1, G, Math.floor(cz + sz * 13), 'x', 3, 'Planks Slab');
  });
  // Flower beds along the walls.
  for (let k = 0; k < 4; k++) {
    const t = -24 + k * 16 + (k >= 2 ? 6 : 0);
    flowerBed(vol, Math.floor(cx + t), c.bz0, Math.floor(cx + t + 5), c.bz0 + 1, G, c.seed + k);
    flowerBed(vol, Math.floor(cx + t), c.bz1 - 1, Math.floor(cx + t + 5), c.bz1, G, c.seed + k + 9);
    flowerBed(vol, c.bx0, Math.floor(cz + t), c.bx0 + 1, Math.floor(cz + t + 5), G, c.seed + k + 17);
    flowerBed(vol, c.bx1 - 1, Math.floor(cz + t), c.bx1, Math.floor(cz + t + 5), G, c.seed + k + 23);
  }
  vol.marks.push(['spawn', cx, G, cz + 12]);
}

// ---------------------------------------------------------------------------
// Small features
// ---------------------------------------------------------------------------
function centre(c) { return [Math.floor((c.bx0 + c.bx1) / 2), Math.floor((c.bz0 + c.bz1) / 2)]; }
function pathsToCentre(vol, plan, c, m, w = 3) {
  const [x, z] = centre(c);
  for (const o of openingPoints(plan, c)) path(vol, o.x, o.z, x, z, w, m);
}
const SMALL = {
  statues(vol, plan, c, rng) {
    clearingGround(vol, c, c.seed, 0.7);
    const m = mix([[B('stone_tiles'), 4], [B('mossy_brick_floor'), 3], [B('grassy_cobblestone'), 3]], c.seed, 2);
    vol.fill(c.bx0, G - 1, c.bz0, c.bx1, G - 1, c.bz1, m);
    vol.fill(c.bx0, G, c.bz0, c.bx1, G + 1, c.bz1, 0);
    const [cx, cz] = centre(c);
    // A ring of statues facing a central one.
    const stone = rng.pick(['marble_01', 'mossy_rock', 'Stone Block', 'Sandstone Block', 'granite_tile', 'Obsidian Block']);
    monument(vol, cx, G, cz, c.seed, rng.int(0, 3), { stone, pr: 1, ph: 2, scale: c.w >= 4 ? 2 : 1, big: true, kind: rng.pick(['dragon', 'angel', 'knight', 'king', 'head']) });
    const n = 4 + rng.int(0, 2) * 2, R = Math.min(c.bx1 - c.bx0, c.bz1 - c.bz0) / 2 - 2;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, x = Math.floor(cx + Math.cos(a) * R), z = Math.floor(cz + Math.sin(a) * R);
      const f = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 1 : 3) : (Math.sin(a) > 0 ? 2 : 0);
      monument(vol, x, G, z, c.seed + k + 1, f, { stone, pr: 0, ph: 1 });
    }
    for (let k = 0; k < 6; k++) vol.coin(cx + rng.int(-4, 4), G, cz + rng.int(-4, 4), 1);
  },
  fountain(vol, plan, c, rng) {
    clearingGround(vol, c, c.seed, 0.6);
    const [cx, cz] = centre(c);
    const r = Math.min(c.bx1 - c.bx0, c.bz1 - c.bz0) / 2 - 3;
    vol.cyl(cx + 0.5, cz + 0.5, r + 2, G - 1, G - 1, mix([[B('cobblestone_floor_04'), 3], [B('mossy_brick_floor'), 2]], c.seed, 2));
    vol.cyl(cx + 0.5, cz + 0.5, r + 2, G, G + 2, 0);
    pathsToCentre(vol, plan, c, B('grassy_cobblestone'));
    const stones = [['marble_01', 'castle_brick_02_white'], ['Stone Bricks', 'Stone Block'], ['mossy_stone_wall', 'Mossy Cobblestone'], ['Sandstone Bricks', 'Sandstone Block'], ['Obsidian Bricks', 'Obsidian Block']];
    const [rim, stone] = rng.pick(stones);
    fountain(vol, cx + 0.5, G, cz + 0.5, Math.max(2.5, r - 1), { rim, stone, accent: rng.pick(['Gold Block', 'Diamond Block', 'Mese Lamp']), lamps: true });
    for (let k = 0; k < 8; k++) vol.coin(cx + rng.int(-2, 2), G - 1, cz + rng.int(-2, 2), 1); // coins thrown in the water
  },
  well(vol, plan, c, rng) {
    clearingGround(vol, c, c.seed, 0.8);
    const [cx, cz] = centre(c);
    vol.fill(cx - 3, G - 1, cz - 3, cx + 3, G - 1, cz + 3, B('cobblestone_floor_08'));
    vol.fill(cx - 3, G, cz - 3, cx + 3, G + 2, cz + 3, 0);
    well(vol, cx, G, cz, rng.pick(['Cobblestone', 'Mossy Cobblestone', 'Stone Bricks']), rng.pick(['Planks', 'Pine Planks', 'Acacia Planks']));
    // Something shiny at the bottom of the well.
    vol.coin(cx, G - 6, cz, 5);
  },
  watchtower(vol, plan, c, rng) {
    clearingGround(vol, c, c.seed, 0.8);
    const [cx, cz] = centre(c);
    const wall = B(rng.pick(['Stone Bricks', 'mossy_stone_wall', 'castle_brick_01', 'Cobblestone']));
    const h = rng.int(16, 26);
    // A square tower with a spiral stair inside to a lookout platform (and a small chest).
    const s = 4, start = rng.int(0, 3);
    vol.fill(cx - s, G - 1, cz - s, cx + s, G + h, cz + s, wall);
    vol.fill(cx - s + 1, G, cz - s + 1, cx + s - 1, G + h - 1, cz + s - 1, 0);
    // Spiral stair from the ground to the lookout floor (G + h is the floor block, so the top stand height is G + h + 1).
    ringStair(vol, cx - s + 1, cz - s + 1, 2 * s - 1, G, G + h + 1, wall, start);
    towerDoor(vol, cx - s + 1, cz - s + 1, 2 * s - 1, G, start, rng.chance(0.5));
    // Battlements.
    for (let k = -s; k <= s; k++) for (const [x, z] of [[cx + k, cz - s], [cx + k, cz + s], [cx - s, cz + k], [cx + s, cz + k]]) {
      vol.set(x, G + h + 1, z, wall); if ((k & 1) === 0) vol.set(x, G + h + 2, z, wall);
    }
    vol.chest(cx, G + h + 1, cz, chestId(rng.int(0, 3)), 40 + rng.int(0, 60), 2);
    // A portal in the north battlement, up to the nearest floating castle.
    { const dest = skyDest(cx, cz, plan.seed); if (dest) portalGate(vol, cx - 1, G + h + 1, cz - s, 'x', dest, 'Stone Bricks'); }
    vol.set(cx + 1, G + h + 1, cz + 1, B('Torch'));
    // Windows.
    for (let y = G + 4; y < G + h - 2; y += 5) for (const [x, z] of [[cx, cz - s], [cx, cz + s], [cx - s, cz], [cx + s, cz]]) vol.set(x, y, z, B('Iron Bars'));
  },
  shrine(vol, plan, c, rng) {
    clearingGround(vol, c, c.seed, 0.7);
    const [cx, cz] = centre(c);
    const m = B(rng.pick(['Sandstone Bricks', 'marble_01', 'Stone Bricks', 'mossy_brick', 'Desert Stone Bricks']));
    const floor = B(rng.pick(['marble_tiles', 'stone_tiles', 'Stone Block']));
    // Columns around a raised platform with a statue and offerings.
    vol.fill(cx - 4, G - 1, cz - 4, cx + 4, G - 1, cz + 4, floor);
    vol.fill(cx - 4, G, cz - 4, cx + 4, G + 4, cz + 4, 0);
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, -4], [-4, 0], [4, 0]]) vol.fill(cx + dx, G, cz + dz, cx + dx, G + 4, cz + dz, m);
    vol.fill(cx - 4, G + 5, cz - 4, cx + 4, G + 5, cz + 4, m);
    vol.fill(cx - 3, G + 6, cz - 3, cx + 3, G + 6, cz + 3, m);
    vol.fill(cx - 1, G + 7, cz - 1, cx + 1, G + 7, cz + 1, B('Gold Block'));
    monument(vol, cx, G, cz - 2, c.seed, 0, { stone: 'marble_01', pr: 1, ph: 1, kind: rng.pick(['angel', 'wizard', 'king', 'owl']) });
    vol.chest(cx, G, cz + 1, chestId(0), 30 + rng.int(0, 50), 1);
    brazier(vol, cx - 2, G, cz + 2); brazier(vol, cx + 2, G, cz + 2);
  },
  garden(vol, plan, c, rng) {
    clearingGround(vol, c, c.seed, 1.4);
    pathsToCentre(vol, plan, c, B('Gravel'), 2);
    const [cx, cz] = centre(c);
    for (let k = 0; k < 6; k++) {
      const x = rng.int(c.bx0 + 1, c.bx1 - 4), z = rng.int(c.bz0 + 1, c.bz1 - 3);
      flowerBed(vol, x, z, x + rng.int(1, 3), z + rng.int(1, 2), G, c.seed + k);
    }
    for (let k = 0; k < 3; k++) bush(vol, rng.int(c.bx0 + 2, c.bx1 - 2), G, rng.int(c.bz0 + 2, c.bz1 - 2), rng.range(1.2, 2.2), rng.pick(['Leaves', 'Blueberry Bush']));
    tree(vol, cx, G, cz, rng.pick(['oak', 'aspen', 'acacia']), 1.1);
    bench(vol, cx - 1, G, cz + 3, 'x', 3);
  },
  ruin(vol, plan, c, rng) {
    clearingGround(vol, c, c.seed, 1.2);
    const [cx, cz] = centre(c);
    const m = mix([[B('Mossy Cobblestone'), 4], [B('castle_brick_broken_06'), 3], [B('mossy_stone_wall'), 3]], c.seed, 2);
    const w = Math.floor((c.bx1 - c.bx0) / 2) - 2, d = Math.floor((c.bz1 - c.bz0) / 2) - 2;
    // Broken walls of an old house: height eaten away by noise, a doorway on every side.
    for (let x = cx - w; x <= cx + w; x++) for (let z = cz - d; z <= cz + d; z++) {
      const edge = x === cx - w || x === cx + w || z === cz - d || z === cz + d;
      if (!edge) continue;
      if (Math.abs(x - cx) <= 1 || Math.abs(z - cz) <= 1) continue; // doorways
      const hgt = Math.floor(hashf(x, z, c.seed) * 3 + 2 * Math.sin(x * 0.7 + z * 0.4) + 2);
      for (let y = 0; y < hgt; y++) vol.set(x, G + y, z, m);
      if (hgt > 2 && hashf(z, x, c.seed) < 0.4) vol.set(x, G + hgt, z, B('Leaves'));
    }
    vol.fill(cx - w + 1, G - 1, cz - d + 1, cx + w - 1, G - 1, cz + d - 1, mix([[B('mossy_brick_floor'), 5], [B('Grass'), 3], [B('Mossy Dirt'), 2]], c.seed, 2));
    tree(vol, cx - w + 2, G, cz + d - 2, 'oak', 0.9);
    vol.chest(cx + w - 1, G, cz - d + 1, chestId(3), 25 + rng.int(0, 40), 1);
    for (let k = 0; k < 5; k++) vol.coin(cx + rng.int(-w + 1, w - 1), G, cz + rng.int(-d + 1, d - 1), 1);
  },
  obelisk(vol, plan, c, rng) {
    clearingGround(vol, c, c.seed, 0.8);
    const [cx, cz] = centre(c);
    const m = B(rng.pick(['Obsidian Block', 'marble_01', 'Sandstone Block', 'Desert Stone Bricks', 'granite_tile']));
    vol.fill(cx - 2, G, cz - 2, cx + 2, G, cz + 2, m);
    const h = rng.int(10, 18);
    vol.fill(cx - 1, G + 1, cz - 1, cx + 1, G + h, cz + 1, m);
    vol.fill(cx, G + h + 1, cz, cx, G + h + 2, cz, B('Gold Block'));
    vol.set(cx, G + h + 3, cz, B('Mese Lamp'));
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) brazier(vol, cx + dx * 2, G, cz + dz * 2);
  },
  pond(vol, plan, c, rng) {
    clearingGround(vol, c, c.seed, 1.3);
    const [cx, cz] = centre(c);
    const rx = (c.bx1 - c.bx0) / 2 - 3, rz = (c.bz1 - c.bz0) / 2 - 3;
    vol.each(c.bx0, c.bz0, c.bx1, c.bz1, (x, z) => {
      const d = Math.hypot((x - cx) / rx, (z - cz) / rz) + (hashf(x, z, c.seed) - 0.5) * 0.2;
      if (d < 1) { vol.fill(x, G - 2, z, x, G, z, 0); vol.fill(x, G - 2, z, x, G - 1, z, B('Water Source')); vol.set(x, G - 3, z, B('Sand')); }
      else if (d < 1.25) { vol.set(x, G - 1, z, B('Sand')); if (hashf(z, x, c.seed) < 0.3) vol.set(x, G, z, B('Papyrus')); }
    });
    for (let k = 0; k < 6; k++) vol.coin(cx + rng.int(-2, 2), G - 2, cz + rng.int(-2, 2), 2);
    tree(vol, Math.floor(cx + rx + 2), G, Math.floor(cz), 'aspen');
  },
  gazebo(vol, plan, c, rng) {
    clearingGround(vol, c, c.seed, 1);
    const [cx, cz] = centre(c);
    const wood = B(rng.pick(['Planks', 'Pine Planks', 'dark_wood', 'Acacia Planks'])), roof = B(rng.pick(['red_slate_roof_tiles_01', 'grey_roof_tiles', 'clay_roof_tiles', 'roof_slates_02']));
    vol.fill(cx - 3, G - 1, cz - 3, cx + 3, G - 1, cz + 3, wood);
    vol.fill(cx - 3, G, cz - 3, cx + 3, G + 3, cz + 3, 0);
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) vol.fill(cx + dx, G, cz + dz, cx + dx, G + 3, cz + dz, B('Log'));
    for (let k = 0; k < 4; k++) vol.fill(cx - 4 + k, G + 4 + k, cz - 4 + k, cx + 4 - k, G + 4 + k, cz + 4 - k, roof);
    vol.fill(cx - 2, G + 4, cz - 2, cx + 2, G + 4, cz + 2, 0);
    vol.set(cx, G + 4 + 3, cz, roof);
    vol.set(cx, G + 6, cz, B('Mese Lamp'));
    bench(vol, cx - 2, G, cz - 2, 'x', 5); bench(vol, cx - 2, G, cz + 2, 'x', 5);
    vol.coin(cx, G, cz, 3);
  },
  grove(vol, plan, c, rng) {
    clearingGround(vol, c, c.seed, 1.6);
    const n = Math.floor((c.w * c.h) / 3);
    for (let k = 0; k < n; k++) tree(vol, rng.int(c.bx0 + 2, c.bx1 - 2), G, rng.int(c.bz0 + 2, c.bz1 - 2), rng.pick(['oak', 'pine', 'aspen', 'jungle', 'oak']), rng.range(0.8, 1.2));
    for (const o of openingPoints(plan, c)) path(vol, o.x, o.z, (c.bx0 + c.bx1) / 2, (c.bz0 + c.bz1) / 2, 2, B('forest_leaves_04'));
    const [cx, cz] = centre(c);
    vol.fill(cx - 1, G, cz - 1, cx + 1, G + 8, cz + 1, 0);
    vol.chest(cx, G, cz, chestId(0), 20 + rng.int(0, 40), 1);
    vol.set(cx + 1, G, cz, B('Red Mushroom')); vol.set(cx - 1, G, cz, B('Brown Mushroom'));
  },
};

// Square spiral stair filling a well of size s x s (s odd >= 5) at corner (x0, z0), from stand height y0 up to y1.
// Steps run around a solid core with landings at the corners; `start` (0-3) picks the corner it begins in.
// Anything above the steps (an upper floor) is carved open, so build floors first and the stair last.
export function ringStair(vol, x0, z0, s, y0, y1, core, start = 0) {
  const slots = ringSlots(x0, z0, s);
  const n = slots.length;
  vol.fill(x0 + 2, y0, z0 + 2, x0 + s - 3, y1 - 2, z0 + s - 3, core);
  let h = 0, k = start * (n / 4);
  const total = y1 - y0;
  while (h < total) {
    const sl = slots[k % n];
    if (!sl.corner) h++;
    for (const [x, z] of sl.cells) {
      vol.fill(x, y0 + h - 2, z, x, y0 + h - 1, z, core);
      vol.fill(x, y0 + h, z, x, y0 + h + 3, z, 0);
    }
    k++;
  }
  return slots[(k - 1) % n];
}
// A 2-wide doorway through the tower wall beside the corner where ringStair (same start) begins.
export function towerDoor(vol, x0, z0, s, y0, start, alongZ = true) {
  const e = s - 1;
  const [cx, cz] = [[x0, z0], [x0 + e - 1, z0], [x0 + e - 1, z0 + e - 1], [x0, z0 + e - 1]][start];
  const west = start === 0 || start === 3, north = start < 2;
  if (alongZ) { const x = west ? x0 - 1 : x0 + s; vol.fill(x, y0, cz, x, y0 + 2, cz + 1, 0); if (west) vol.fill(x - 1, y0, cz, x - 1, y0 + 2, cz + 1, 0); else vol.fill(x + 1, y0, cz, x + 1, y0 + 2, cz + 1, 0); }
  else { const z = north ? z0 - 1 : z0 + s; vol.fill(cx, y0, z, cx + 1, y0 + 2, z, 0); if (north) vol.fill(cx, y0, z - 1, cx + 1, y0 + 2, z - 1, 0); else vol.fill(cx, y0, z + 1, cx + 1, y0 + 2, z + 1, 0); }
}
export function ringSlots(x0, z0, s) {
  const out = [], e = s - 1;
  const corner = (ax, az) => out.push({ corner: true, cells: [[ax, az], [ax + 1, az], [ax, az + 1], [ax + 1, az + 1]] });
  corner(x0, z0);
  for (let x = 2; x <= e - 2; x++) out.push({ cells: [[x0 + x, z0], [x0 + x, z0 + 1]] });
  corner(x0 + e - 1, z0);
  for (let z = 2; z <= e - 2; z++) out.push({ cells: [[x0 + e, z0 + z], [x0 + e - 1, z0 + z]] });
  corner(x0 + e - 1, z0 + e - 1);
  for (let x = e - 2; x >= 2; x--) out.push({ cells: [[x0 + x, z0 + e], [x0 + x, z0 + e - 1]] });
  corner(x0, z0 + e - 1);
  for (let z = e - 2; z >= 2; z--) out.push({ cells: [[x0, z0 + z], [x0 + 1, z0 + z]] });
  return out;
}
export { centre, SMALL };
