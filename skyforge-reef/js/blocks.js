// Block definitions for the reef. Pure data.
// Every block is a quarter-size cube (see VS in world.js): four blocks across make one old full-size block.
//
// Two looks, as chosen:
//  - HD photo textures (Poly Haven, CC0) for the natural seabed, rocks and ruins. They are mapped across the world,
//    so sand flows smoothly over many tiny blocks.
//  - Colourful block-pack textures (Kenney voxel pack + Minetest Game) for the coral, treasure and sea life.
//    Each tiny cube shows the whole picture, so you can see every little block.

// key -> file under textures/
export const TEX = {
  // HD photo (256 x 256)
  sand: 'photo/sand_01.jpg', densesand: 'photo/dense_sand.jpg', shell: 'photo/shell_floor_01.jpg',
  pebbles: 'photo/ganges_river_pebbles.jpg', seaside: 'photo/seaside_rock.jpg', rock: 'photo/rock_01.jpg',
  darkrock: 'photo/dark_rock.jpg', mossrock: 'photo/mossy_rock.jpg', coralrock: 'photo/coral_fort_wall_01.jpg',
  coralstone: 'photo/coral_stone_wall.jpg', mud: 'photo/coral_mud_01.jpg', marble: 'photo/marble_rock_01.jpg',
  ruin: 'photo/mossy_stone_wall.jpg', sandbrick: 'photo/seaworn_sandstone_brick.jpg', whitebrick: 'photo/white_sandstone_bricks.jpg',
  planks: 'photo/weathered_planks.jpg', darkplanks: 'photo/dark_planks.jpg', coralground: 'photo/coral_ground_02.jpg',
  // colourful block packs
  wool_orange: 'blocks/wool_orange.png', wool_yellow: 'blocks/wool_yellow.png', wool_magenta: 'blocks/wool_magenta.png',
  wool_pink: 'blocks/wool_pink.png', wool_violet: 'blocks/wool_violet.png', wool_blue: 'blocks/wool_blue.png',
  wool_cyan: 'blocks/wool_cyan.png', wool_green: 'blocks/wool_green.png', wool_dark_green: 'blocks/wool_dark_green.png',
  wool_red: 'blocks/wool_red.png', wool_white: 'blocks/wool_white.png', lava: 'blocks/lava.png', ore_gold: 'blocks/ore_gold.png', ore_diamond: 'blocks/ore_diamond.png',
  coral_orange: 'minetest/coral_orange.png', coral_brown: 'minetest/coral_brown.png', coral_skeleton: 'minetest/coral_skeleton.png',
  coral_pink: 'minetest/coral_pink.png', coral_cyan: 'minetest/coral_cyan.png', coral_green: 'minetest/coral_green.png',
  kelp: 'minetest/kelp.png', seagrass: 'minetest/junglegrass.png', reed: 'minetest/papyrus.png',
  meselamp: 'minetest/meselamp.png', gold: 'minetest/gold_block.png', diamond: 'minetest/diamond_block.png', mese: 'minetest/mese_block.png',
  chest_front: 'minetest/chest_front.png', chest_side: 'minetest/chest_side.png', chest_top: 'minetest/chest_top.png',
};
export const HD_KEYS = new Set(['sand', 'densesand', 'shell', 'pebbles', 'seaside', 'rock', 'darkrock', 'mossrock', 'coralrock', 'coralstone', 'mud',
  'marble', 'ruin', 'sandbrick', 'whitebrick', 'planks', 'darkplanks', 'coralground']);

export const BLOCKS = [{ name: 'Water', kind: 'none' }]; // id 0 is open water
export const B = {};
// opts: world (HD, mapped across the world), emit (glows), sprite (crossed picture, you swim through it), fixed (can't be picked up)
function add(key, name, side, top = side, bottom = side, opts = {}) {
  const id = BLOCKS.length;
  B[key] = id;
  BLOCKS.push({ key, name, kind: opts.sprite ? 'sprite' : 'cube', tex: { side, top, bottom }, world: !!opts.world, emit: !!opts.emit, fixed: !!opts.fixed, sway: !!opts.sprite });
  return id;
}
const W = { world: true };
add('SAND', 'Sand', 'sand', 'sand', 'sand', W);
add('DENSESAND', 'Dense Sand', 'densesand', 'densesand', 'densesand', W);
add('SHELL', 'Shell Sand', 'shell', 'shell', 'shell', W);
add('PEBBLES', 'Pebbles', 'pebbles', 'pebbles', 'pebbles', W);
add('SEASIDE', 'Seaside Rock', 'seaside', 'seaside', 'seaside', W);
add('ROCK', 'Rock', 'rock', 'rock', 'rock', W);
add('BEDROCK', 'Bedrock', 'darkrock', 'darkrock', 'darkrock', { world: true, fixed: true });
add('MOSSROCK', 'Mossy Rock', 'mossrock', 'mossrock', 'mossrock', W);
add('CORALROCK', 'Coral Rock', 'coralrock', 'coralrock', 'coralrock', W);
add('CORALSTONE', 'Coral Stone', 'coralstone', 'coralstone', 'coralstone', W);
add('MUD', 'Mud', 'mud', 'mud', 'mud', W);
add('MARBLE', 'Marble', 'marble', 'marble', 'marble', W);
add('RUIN', 'Ruin Stone', 'ruin', 'ruin', 'ruin', W);
add('SANDBRICK', 'Sandstone Brick', 'sandbrick', 'sandbrick', 'sandbrick', W);
add('WHITEBRICK', 'White Brick', 'whitebrick', 'whitebrick', 'whitebrick', W);
add('PLANKS', 'Old Planks', 'planks', 'planks', 'planks', W);
add('DARKPLANKS', 'Dark Planks', 'darkplanks', 'darkplanks', 'darkplanks', W);
add('CORALGROUND', 'Coral Ground', 'coralground', 'coralground', 'coralground', W);
for (const c of ['orange', 'yellow', 'magenta', 'pink', 'violet', 'blue', 'cyan', 'green', 'dark_green', 'red', 'white'])
  add('WOOL_' + c.toUpperCase(), c.replace('_', ' ') + ' coral', 'wool_' + c);
add('CORAL_ORANGE', 'Orange Coral', 'coral_orange');
add('CORAL_BROWN', 'Brown Coral', 'coral_brown');
add('CORAL_SKELETON', 'Bleached Coral', 'coral_skeleton');
add('GOLD', 'Gold Block', 'gold');
add('DIAMOND', 'Diamond Block', 'diamond');
add('MESE', 'Mese Block', 'mese');
add('LAMP', 'Sea Lantern', 'meselamp', 'meselamp', 'meselamp', { emit: true });
add('CHEST', 'Treasure Chest', 'chest_side', 'chest_top', 'chest_top');
add('ORE_GOLD', 'Gold Ore', 'ore_gold');
add('MAGMA', 'Warm Vent Rock', 'lava', 'lava', 'lava', { emit: true });
add('ORE_DIAMOND', 'Diamond Ore', 'ore_diamond');
// Sprites (see-through plants you can swim through): crossed pictures one block wide.
add('CORAL_PINK', 'Pink Coral', 'coral_pink', 'coral_pink', 'coral_pink', { sprite: true });
add('CORAL_CYAN', 'Cyan Coral', 'coral_cyan', 'coral_cyan', 'coral_cyan', { sprite: true });
add('CORAL_GREEN', 'Green Coral', 'coral_green', 'coral_green', 'coral_green', { sprite: true });
add('KELP', 'Kelp', 'kelp', 'kelp', 'kelp', { sprite: true });
add('SEAGRASS', 'Sea Grass', 'seagrass', 'seagrass', 'seagrass', { sprite: true });
add('REED', 'Reed', 'reed', 'reed', 'reed', { sprite: true });

export const NBLOCKS = BLOCKS.length;
// How strongly a block lights up the blocks around it (0 = not at all).
export const LIGHT = new Float32Array(NBLOCKS);
LIGHT[B.LAMP] = 1; LIGHT[B.MAGMA] = 0.9; LIGHT[B.MESE] = 0.45; LIGHT[B.ORE_DIAMOND] = 0.3; LIGHT[B.DIAMOND] = 0.25;
// How fast each block sinks when you let go of it (units per second). Light coral drifts down, gold plummets.
export const SINK = new Float32Array(NBLOCKS).fill(1.0);
for (const k of Object.keys(B)) if (k.startsWith('WOOL_') || k.startsWith('CORAL_')) SINK[B[k]] = 0.55;
for (const k of ['LAMP', 'SHELL', 'SAND', 'DENSESAND']) SINK[B[k]] = 0.8;
for (const k of ['GOLD', 'DIAMOND', 'MESE', 'ORE_GOLD', 'ORE_DIAMOND', 'CHEST', 'ROCK', 'SEASIDE', 'BEDROCK', 'MARBLE', 'RUIN']) SINK[B[k]] = 1.9;
// Lookup tables used by the mesher and physics.
export const IS_CUBE = new Uint8Array(NBLOCKS), IS_SPRITE = new Uint8Array(NBLOCKS), CAN_PICK = new Uint8Array(NBLOCKS);
for (let i = 1; i < NBLOCKS; i++) {
  IS_CUBE[i] = BLOCKS[i].kind === 'cube' ? 1 : 0;
  IS_SPRITE[i] = BLOCKS[i].kind === 'sprite' ? 1 : 0;
  CAN_PICK[i] = IS_CUBE[i] && !BLOCKS[i].fixed ? 1 : 0;
}
// Faces: 0 +x, 1 -x, 2 +y (top), 3 -y (bottom), 4 +z, 5 -z.
export function faceTexKey(id, face) {
  const t = BLOCKS[id].tex;
  return face === 2 ? t.top : face === 3 ? t.bottom : t.side;
}
