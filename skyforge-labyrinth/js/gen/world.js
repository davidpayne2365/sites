// Builds the blocks for any box of the world: solid ground, the overgrown stone labyrinth, and every region's
// castles, gardens and underground systems. Pure function of (seed, box): any worker gets identical results.
import { Vol, GROUND, H, hash, hashf, fbm2, mix, RNG } from './util.js';
import { buildDeep } from './deep.js';
import { regionPlan, isWall, clearingAt, RS, RC, P } from './maze.js';
import { B, plantFor, tree, bush, monument, chestId, lampPost, plantIds } from './decor.js';
import { buildFeature } from './features.js';
import { buildUnderground } from './under.js';

const G = GROUND;
let ids = null;
function init() {
  if (ids) return ids;
  ids = {
    stone: B('Stone'), dirt: B('Dirt'), grass: B('Grass'), leaves: B('Leaves'),
    floor: mix([[B('Grass'), 80], [B('Mossy Dirt'), 8], [B('grassy_cobblestone'), 6], [B('forest_leaves_04'), 6]], 0xf100, 7),
  };
  // Labyrinth wall themes: stone with moss, mixed per block, mossier toward the ground.
  const T = (base, moss, top) => ({ base: mix(base, 11, 5), moss: mix(moss, 12, 4), top: Array.isArray(top) ? mix(top, 13, 3) : null });
  ids.themes = [
    T([[B('mossy_stone_wall'), 8], [B('old_stone_wall'), 2], [B('castle_wall_varriation'), 1]],
      [[B('mossy_stone_wall'), 6], [B('Mossy Cobblestone'), 2], [B('rock_pitted_mossy'), 1]]),
    T([[B('castle_wall_varriation'), 8], [B('stone_wall'), 2], [B('old_stone_wall_02'), 1]],
      [[B('mossy_rock'), 6], [B('mossy_stone_wall'), 3]]),
    T([[B('mossy_brick'), 8], [B('brick_moss_001'), 3]],
      [[B('brick_moss_001'), 7], [B('mossy_brick'), 3]]),
    T([[B('old_sandstone_02'), 8], [B('mossy_sandstone'), 2]],
      [[B('mossy_sandstone'), 8], [B('rock_pitted_mossy'), 1]]),
    T([[B('stacked_stone_wall'), 8], [B('rustic_stone_wall'), 2]],
      [[B('mossy_rock'), 7], [B('lichen_rock'), 2]]),
    T([[B('Mossy Cobblestone'), 6], [B('Cobblestone'), 2]],
      [[B('Mossy Cobblestone'), 8], [B('mossy_cobblestone'), 2]]),
    // Hedge maze: a mossy footing with walls of leaves.
    T([[B('Leaves'), 8], [B('Blueberry Bush'), 1]], [[B('mossy_stone_wall'), 5], [B('Mossy Cobblestone'), 5]], 1),
    T([[B('medieval_blocks_02'), 8], [B('defense_wall'), 2]],
      [[B('mossy_stone_wall'), 6], [B('mossy_rock'), 3]]),
    T([[B('japanese_stone_wall'), 8], [B('stacked_stone_wall'), 1]],
      [[B('mossy_rock'), 6], [B('Mossy Cobblestone'), 3]]),
  ];
  ids.overgrowth = mix([[B('Leaves'), 5], [B('Jungle Leaves'), 2], [B('Blueberry Bush'), 2], [B('Aspen Leaves'), 1]], 14, 2);
  return ids;
}

// Regions whose features may reach into a box (features never extend more than `reach` past their region).
function regionsFor(x0, z0, x1, z1, reach = 72) {
  const out = [];
  for (let rz = Math.floor((z0 - reach) / RS); rz <= Math.floor((z1 + reach) / RS); rz++)
    for (let rx = Math.floor((x0 - reach) / RS); rx <= Math.floor((x1 + reach) / RS); rx++) out.push([rx, rz]);
  return out;
}

export function generate(x0, z0, sx, sz, seed, edits) {
  const I = init();
  const vol = new Vol(x0, z0, sx, sz);
  // Solid ground: stone, then dirt, then the floor.
  vol.fill(x0, 0, z0, vol.x1, G - 5, vol.z1, I.stone);
  vol.fill(x0, G - 4, z0, vol.x1, G - 2, vol.z1, I.dirt);
  vol.fill(x0, G - 1, z0, vol.x1, G - 1, vol.z1, I.floor);

  const regions = regionsFor(x0, z0, vol.x1, vol.z1).map(([rx, rz]) => regionPlan(rx, rz, seed));
  // 1. Underground systems first (they only carve below the ground), 2. the maze, 3. features on top.
  for (const plan of regions) if (vol.overlaps(plan.X0 - 40, plan.Z0 - 40, plan.X0 + RS + 40, plan.Z0 + RS + 40)) buildUnderground(vol, plan);
  for (const plan of regions) if (vol.overlaps(plan.X0, plan.Z0, plan.X0 + RS - 1, plan.Z0 + RS - 1)) drawMaze(vol, plan, I);
  for (const plan of regions) for (const c of plan.clearings) { const m = c.kind === 'floating' ? 72 : 40; if (vol.overlaps(c.bx0 - m, c.bz0 - m, c.bx1 + m, c.bz1 + m)) buildFeature(vol, plan, c); }
  // 4. The deep world: glowing tunnels under everything, caverns with castles, stairways down from dead ends.
  buildDeep(vol, regions, (rx, rz) => regionPlan(rx, rz, seed));
  // Players' own changes.
  if (edits) for (const [x, y, z, id] of edits) vol.set(x, y, z, id);
  return vol;
}

function drawMaze(vol, plan, I) {
  const th = I.themes[plan.theme % I.themes.length], hedge = plan.theme % I.themes.length === 6;
  const seed = plan.seed ^ plan.theme;
  const X0 = plan.X0, Z0 = plan.Z0;
  vol.each(X0, Z0, X0 + RS - 1, Z0 + RS - 1, (x, z) => {
    const lx = x - X0, lz = z - Z0;
    if (isWall(plan, lx, lz)) {
      // Moss creeps up from the ground in patches.
      const mossH = 1 + Math.floor(fbm2(x / 9, z / 9, seed, 2) * 4.2);
      for (let y = G; y < G + 4; y++) vol.set(x, y, z, hedge ? (y === G ? th.moss : th.base) : y - G < mossH ? th.moss : th.base);
      // Overgrown tops: hedges and bushes spilling over the wall.
      const o = fbm2(x / 7, z / 7, seed + 7, 2);
      if (hedge || o > 0.55) { vol.set(x, G + 4, z, I.overgrowth); if (o > 0.7) vol.set(x, G + 5, z, I.overgrowth); }
      return;
    }
    if (clearingAt(plan, lx, lz) >= 0) return; // features dress their own ground
    // Corridor: plants, ferns along walls, leaves hanging over the edges.
    const ox = lx % P, oz = lz % P, nearWall = ox === 2 || ox === 5 || oz === 2 || oz === 5;
    const lush = 0.6 + fbm2(x / 20, z / 20, seed + 3, 2);
    const p = plantFor(x, z, seed, lush, nearWall);
    if (p) vol.set(x, G, z, p);
    if (nearWall && fbm2(x / 7, z / 7, seed + 7, 2) > 0.62 && hashf(x, z, seed, 3) < 0.5) vol.set(x, G + 3, z, I.overgrowth);
  });

  // Lamps on some wall posts so the labyrinth glows at night.
  for (let j = 1; j < RC; j++) for (let i = 1; i < RC; i++) {
    if (hash(i, j, plan.seed, 0x1a3) % 23) continue;
    const x = X0 + i * P, z = Z0 + j * P;
    if (!isWall(plan, i * P, j * P)) continue;
    vol.fill(x, G + 4, z, x + 1, G + 4, z + 1, B('Mossy Cobblestone'));
    vol.set(x, G + 5, z, B('Mese Post Light'));
  }

  // Dead ends: overgrown trees, forgotten statues, and small hidden chests.
  for (const [i, j, side] of plan.deadEnds) {
    const r = hash(i, j, plan.seed, 0xdead) % 100;
    const cx = X0 + i * P + 2, cz = Z0 + j * P + 2; // corner of the 4x4 cell interior
    if (!vol.overlaps(cx - 6, cz - 6, cx + 9, cz + 9)) continue;
    // The far wall of the dead end (opposite its opening).
    const back = [[3, 1.5], [0, 1.5], [1.5, 3], [1.5, 0]][side]; // W open -> back is E, etc.
    const bx = cx + Math.round(back[0]), bz = cz + Math.round(back[1]);
    if (r < 22) tree(vol, cx + 1 + (r & 1), G, cz + 1 + ((r >> 1) & 1), ['oak', 'oak', 'aspen', 'jungle', 'acacia'][r % 5], 0.9);
    else if (r < 30) monument(vol, cx + 1 + (side === 0 ? 1 : 0), G, cz + 1 + (side === 2 ? 1 : 0), plan.seed + i * 31 + j, [1, 3, 0, 2][side] ^ 2, { stone: 'mossy_rock', base: 'Mossy Cobblestone', pr: 0, ph: 1 });
    else if (r < 41) {
      // A small treasure tucked under a bush, facing the way in.
      const facing = [3, 1, 2, 0][side] ^ 2; // front toward the opening
      const fx = [cx + 3, cx, cx + 1, cx + 1][side], fz = [cz + 1, cz + 1, cz + 3, cz][side];
      vol.chest(fx, G, fz, chestId(facingToward(side)), 15 + (hash(i, j, plan.seed) % 40), 1);
      vol.fill(fx - 1, G + 1, fz - 1, fx + 1, G + 1, fz + 1, I.overgrowth);
      vol.set(fx, G + 1, fz, 0);
      vol.set(fx, G + 1, fz, B('Leaves'));
      for (let k = 0; k < 3; k++) vol.coin(cx + 1 + k % 2, G, cz + 1 + (k >> 1), 1);
    } else if (r < 47) {
      vol.set(bx, G, bz, B('Torch'));
      for (let k = 0; k < 4; k++) vol.coin(cx + (k & 1) * 3, G, cz + (k >> 1) * 3, 1);
    } else if (r < 60) bush(vol, cx + 1.5, G, cz + 1.5, 2.2, ['Leaves', 'Blueberry Bush', 'Jungle Leaves'][r % 3]);
  }
}
// Chest facing so its front looks out of a dead end whose opening is on `side` (W, E, N, S).
function facingToward(side) { return [1, 3, 2, 0][side]; }

export { G, H, regionPlan, RS };
