// Block definitions shared by the game (main thread) and the world-generation workers. Pure data: no three.js.
// IDs are positions in this list and are what saved worlds store, so entries are only ever appended or
// retired (retired ids are swapped for a replacement when loaded).
//
// Shapes:   cube (default) · cross (two crossed sprites: plants, torches) · slab (bottom half) · liquid (water)
// Render:   opaque (default) · cutout (alpha-tested: leaves, bars, plants) · trans (blended: glass, water)
// Physics:  solid (default true) — cross plants, torches, fire and water can be walked through
// Light:    emit 0-15 (torches, lamps, lava...) · bright: drawn full-bright (lamps glow even in the dark)
import { POLYHAVEN } from './photo_textures.js';

export const K = n => 'blocks/' + n;    // Kenney texture
export const M = n => 'minetest/' + n;  // Minetest Game texture
export const P = n => `photo/${n}.jpg`;  // Poly Haven photo-scanned texture (CC0), 256x256
export const texUrl = path => `textures/${path}${path.includes('.') ? '' : '.png'}`;

const CUT = { render: 'cutout' };
const SEE = { render: 'trans' };
export const BLOCKS = [
  { name: 'Grass', faces: { side: P('forrest_ground_01'), top: P('leafy_grass'), bottom: P('forrest_ground_01') } },
  { name: 'Stone', faces: { all: P('rock_01') } },
  { name: 'Dirt', faces: { all: P('brown_mud_leaves_01') } },
  { name: 'Planks', faces: { all: P('wood_floor') } },
  { name: 'Log', faces: { side: P('bark_brown_02'), top: P('rough_wood') } },
  { name: 'Brick', faces: { all: P('red_brick') } },
  { name: 'Glass', faces: { all: K('glass') }, ...SEE },
  { name: 'Sand', faces: { all: P('coast_sand_01') } },
  { name: 'Leaves', faces: { all: K('leaves') }, ...CUT },
  { name: 'Gold Block', faces: { all: M('gold_block') } },
  { name: 'Ice', faces: { all: K('ice') } },
  { name: 'Mese Lamp', faces: { all: M('meselamp') }, emit: 15, bright: true },
  { name: 'White Wool', faces: { all: K('wool_white') } },
  { name: 'Obsidian', faces: { all: K('obsidian') } },
  { name: 'Clay', faces: { all: K('clay') } },
  { name: 'Tin Block', faces: { all: M('tin_block') } },
  { name: 'Steel Block', faces: { all: M('steel_block') } },
  { name: 'Red Wool', faces: { all: K('wool_red') } },
  { name: 'Blue Wool', faces: { all: K('wool_blue') } },
  { name: 'Coal Block', faces: { all: M('coal_block') } },
  // Steering wheel (a minecart-style control block). Its front faces the driver; ids 21-24 are its four
  // facings (vehicle forward = -z, +x, +z, -x).
  { name: 'Steering Wheel', faces: { side: M('carts_cart_side'), top: M('carts_cart_top') }, front: M('carts_cart_front'), wheel: true },
];
// Ids 22-24: the steering wheel's other facings.
for (let k = 1; k < 4; k++) BLOCKS.push({ ...BLOCKS[20], hidden: true, variantOf: 21, facing: k });
// Ids 25-136: retired hand-drawn colour blocks (16 colours x 7 styles). Saved ones load as the nearest wool or glass.
const OLD_COLORS = ['Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Teal', 'Cyan', 'Sky', 'Blue', 'Indigo', 'Purple', 'Magenta', 'Pink', 'White', 'Gray', 'Black'];
const OLD_TO_WOOL = { Red: 'Red', Orange: 'Orange', Yellow: 'Yellow', Lime: 'Green', Green: 'Dark Green', Teal: 'Cyan', Cyan: 'Cyan', Sky: 'Blue',
  Blue: 'Blue', Indigo: 'Violet', Purple: 'Violet', Magenta: 'Magenta', Pink: 'Pink', White: 'White', Gray: 'Grey', Black: 'Black' };
for (const style of ['Block', 'Tiles', 'Stripes', 'Bricks', 'Dots', 'Neon', 'Glass'])
  for (const c of OLD_COLORS) BLOCKS.push({ name: `${c} ${style}`, retired: style === 'Glass' ? 'Glass' : `${OLD_TO_WOOL[c]} Wool` });

// Pack blocks: [name, side, top, bottom, options]
function addBlocks(group, list) {
  for (const [name, side, top, bottom, opt = {}] of list) {
    BLOCKS.push({ name, group, cat: opt.cat, faces: top ? { side, top, bottom: bottom || top } : { all: side },
      front: opt.front || null, ...opt });
  }
}
// Ids 137-179: Kenney Voxel Pack (same order as before so saved worlds keep their blocks).
addBlocks('kenney', [
  ['Cobblestone', K('cobble')], ['Mossy Cobblestone', K('mossycobble')], ['Stone Bricks', K('stone_brick')], ['Stone Block', K('stone_block')],
  ['Gravel', K('gravel')], ['Pine Planks', K('pine_wood')], ['Jungle Planks', K('junglewood')], ['Acacia Planks', K('acacia_wood')],
  ['Aspen Planks', K('aspen_wood')], ['Pine Log', K('pine_tree'), K('pine_tree_top')], ['Jungle Log', K('jungletree'), K('jungletree_top')],
  ['Acacia Log', K('acacia_tree'), K('acacia_tree_top')], ['Aspen Log', K('aspen_tree'), K('aspen_tree_top')],
  ['Pine Needles', K('pine_needles'), null, null, CUT], ['Jungle Leaves', K('jungleleaves'), null, null, CUT],
  ['Acacia Leaves', K('acacia_leaves'), null, null, CUT], ['Aspen Leaves', K('aspen_leaves'), null, null, CUT],
  ['Desert Sand', K('desert_sand')], ['Silver Sand', K('silver_sand')], ['Sandstone', K('sandstone')], ['Sandstone Bricks', K('sandstone_brick')],
  ['Sandstone Block', K('sandstone_block')], ['Desert Stone', K('desert_stone')], ['Desert Stone Bricks', K('desert_stone_brick')],
  ['Desert Cobblestone', K('desert_cobble')], ['Silver Sandstone', K('silver_sandstone')], ['Silver Sandstone Bricks', K('silver_sandstone_brick')],
  ['Obsidian Glass', K('obsidian_glass'), null, null, SEE], ['Obsidian Bricks', K('obsidian_brick')],
  ['Obsidian Block', K('obsidian_block')], ['Snow', K('snow')], ['Snowy Grass', K('snow_side'), K('snow'), K('dirt')],
  ['Dry Grass', K('dry_grass_side'), K('dry_grass'), K('dirt')], ['Coal Ore', K('ore_coal')], ['Iron Ore', K('ore_iron')],
  ['Copper Ore', K('ore_copper')], ['Gold Ore', K('ore_gold'), null, null, { emit: 2 }], ['Diamond Ore', K('ore_diamond'), null, null, { emit: 4 }],
  ['Mese Ore', K('ore_mese'), null, null, { emit: 6 }],
  ['Cactus', K('cactus_side'), K('cactus_top')], ['Furnace', K('furnace_side'), K('furnace_top'), null, { front: K('furnace_front') }],
  ['Water', K('water'), null, null, { render: 'trans', shape: 'liquid', solid: false, anim: 1 }], ['Lava', K('lava'), null, null, { emit: 15, bright: true, anim: 2 }],
]);
// Wool in every colour (Kenney).
addBlocks('wool', ['Orange', 'Yellow', 'Green', 'Dark Green', 'Cyan', 'Violet', 'Magenta', 'Pink', 'Brown', 'Tan', 'Grey', 'Dark Grey', 'Black']
  .map(c => [`${c} Wool`, K('wool_' + c.toLowerCase().replace(' ', '_'))]));
// Minetest Game blocks.
addBlocks('minetest', [
  ['Treasure Chest', M('chest_side'), M('chest_top'), null, { front: M('chest_front'), chest: true }],
  ['Locked Chest', M('chest_side'), M('chest_top'), null, { front: M('chest_lock'), chest: true }],
  ['TNT', M('tnt_side'), M('tnt_top'), M('tnt_bottom')],
  ['Bookshelf', M('bookshelf'), K('wood')], ['Bottle Shelf', M('vessels_shelf'), K('wood')],
  ['Diamond Block', M('diamond_block')], ['Mese Block', M('mese_block'), null, null, { emit: 9 }], ['Copper Block', M('copper_block')], ['Bronze Block', M('bronze_block')],
  ['Bone Box', M('bones_side'), M('bones_top'), M('bones_bottom'), { front: M('bones_front') }],
  ['Iron Bars', M('xpanes_bar'), null, null, CUT],
  ['Clay Bricks', M('clay_brick')], ['Desert Sandstone', M('desert_sandstone')], ['Desert Sandstone Bricks', M('desert_sandstone_brick')],
  ['Desert Sandstone Block', M('desert_sandstone_block')], ['Permafrost', M('permafrost')], ['Mossy Dirt', M('moss_side'), M('moss'), M('dirt')],
  ['Dry Dirt', M('dry_dirt')], ['Straw', M('farming_straw')], ['Farmland', M('dirt'), M('farming_soil')],
  ['Wet Farmland', M('farming_soil_wet_side'), M('farming_soil_wet'), M('dirt')],
  ['Brown Coral', M('coral_brown')], ['Cyan Coral', M('coral_cyan')], ['Green Coral', M('coral_green')],
  ['Orange Coral', M('coral_orange')], ['Pink Coral', M('coral_pink')], ['Coral Skeleton', M('coral_skeleton')],
]);
export const PHOTO_TEXTURES = [
  ["mossy_rock", "Mossy Rock"],
  ["leafy_grass", "Leafy Grass"],
  ["grass_path_2", "Grass Path 2"],
  ["forest_leaves_04", "Forest Leaves 04"],
  ["moss_wood", "Moss Wood"],
  ["brick_moss_001", "Brick Moss 001"],
  ["sparse_grass", "Sparse Grass"],
  ["forest_leaves_03", "Forest Leaves 03"],
  ["grass_ground", "Grass Ground"],
  ["grass_path_3", "Grass Path 3"],
  ["brown_mud_leaves_01", "Brown Mud Leaves 01"],
  ["asphalt_02", "Asphalt 02"],
  ["forrest_ground_01", "Forest Ground 01"],
  ["rocky_terrain_02", "Rocky Terrain 02"],
  ["snow_02", "Snow 02"],
  ["aerial_beach_01", "Aerial Beach 01"],
  ["rock_01", "Rock 01"],
  ["rocky_trail_02", "Rocky Trail 02"],
  ["sand_01", "Sand 01"],
  ["coast_sand_01", "Coast Sand 01"],
  ["gravelly_sand", "Gravelly Sand"],
  ["sandy_gravel_02", "Sandy Gravel 02"],
  ["sandy_gravel", "Sandy Gravel"],
  ["gravel_stones", "Gravel Stones"],
  ["snow_01", "Snow 01"],
  ["snow_03", "Snow 03"],
  ["coast_sand_rocks_02", "Coast Sand Rocks 02"],
  ["aerial_rocks_02", "Aerial Rocks 02"],
  ["aerial_grass_rock", "Aerial Grass Rock"],
  ["aerial_rocks_04", "Aerial Rocks 04"],
  ["rock_face_03", "Rock Face 03"],
  ["forest_ground_04", "Forest Ground 04"],
  ["rock_boulder_dry", "Rock Boulder Dry"],
  ["stone_tiles_02", "Stone Tiles 02"],
  ["cobblestone_floor_04", "Cobblestone Floor 04"],
  ["grassy_cobblestone", "Grassy Cobblestone"],
  ["cobblestone_floor_08", "Cobblestone Floor 08"],
  ["floor_pattern_02", "Floor Pattern 02"],
  ["cobblestone_color", "Cobblestone Color"],
  ["floor_pattern_01", "Floor Pattern 01"],
  ["rock_pitted_mossy", "Rock Pitted Mossy"],
  ["worn_rock_natural_01", "Worn Rock Natural 01"],
  ["red_brick", "Red Brick"],
  ["red_brick_03", "Red Brick 03"],
  ["medieval_blocks_03", "Medieval Blocks 03"],
  ["cracked_concrete_wall", "Cracked Concrete Wall"],
  ["brick_4", "Brick 4"],
  ["castle_brick_02_red", "Castle Brick 02 Red"],
  ["stone_brick_wall_001", "Stone Brick Wall 001"],
  ["red_bricks_04", "Red Bricks 04"],
  ["sandstone_blocks_05", "Sandstone Blocks 05"],
  ["brick_wall_006", "Brick Wall 006"],
  ["rough_block_wall", "Rough Block Wall"],
  ["concrete_floor_worn_001", "Concrete Floor Worn 001"],
  ["concrete_floor_02", "Concrete Floor 02"],
  ["concrete_layers_02", "Concrete Layers 02"],
  ["gravel_embedded_concrete", "Gravel Embedded Concrete"],
  ["concrete_wall_003", "Concrete Wall 003"],
  ["gravel_concrete_03", "Gravel Concrete 03"],
  ["beige_wall_001", "Beige Wall 001"],
  ["grey_plaster", "Grey Plaster"],
  ["plastered_wall", "Plastered Wall"],
  ["aerial_asphalt_01", "Aerial Asphalt 01"],
  ["asphalt_01", "Asphalt 01"],
  ["interior_tiles", "Interior Tiles"],
  ["worn_tile_floor", "Worn Tile Floor"],
  ["checkered_pavement_tiles", "Checkered Pavement Tiles"],
  ["stone_embedded_tiles", "Stone Embedded Tiles"],
  ["concrete_tiles_02", "Concrete Tiles 02"],
  ["brown_floor_tiles", "Brown Floor Tiles"],
  ["roof_09", "Roof 09"],
  ["roof_slates_03", "Roof Slates 03"],
  ["grey_roof_01", "Grey Roof 01"],
  ["ceramic_roof_01", "Ceramic Roof 01"],
  ["grey_roof_tiles_02", "Grey Roof Tiles 02"],
  ["plywood", "Plywood"],
  ["laminate_floor_02", "Laminate Floor 02"],
  ["wood_table_001", "Wood Table 001"],
  ["oak_veneer_01", "Oak Veneer 01"],
  ["wood_table_worn", "Wood Table Worn"],
  ["weathered_brown_planks", "Weathered Brown Planks"],
  ["wood_floor", "Wood Floor"],
  ["wood_cabinet_worn_long", "Wood Cabinet Worn Long"],
  ["bark_brown_02", "Bark Brown 02"],
  ["rough_wood", "Rough Wood"],
  ["dark_wood", "Dark Wood"],
  ["kitchen_wood", "Kitchen Wood"],
  ["bark_brown_01", "Bark Brown 01"],
  ["bark_willow", "Bark Willow"],
  ["bark_willow_02", "Bark Willow 02"],
  ["pine_bark", "Pine Bark"],
  ["tree_bark_03", "Tree Bark 03"],
  ["metal_plate", "Metal Plate"],
  ["green_metal_rust", "Green Metal Rust"],
  ["rust_coarse_01", "Rust Coarse 01"],
  ["rusty_metal_02", "Rusty Metal 02"],
  ["rusty_metal_04", "Rusty Metal 04"],
  ["factory_wall", "Factory Wall"],
  ["corrugated_iron", "Corrugated Iron"],
  ["blue_metal_plate", "Blue Metal Plate"],
  ["leather_white", "Leather White"],
  ["denmin_fabric_02", "Denim Fabric 02"],
  ["fabric_leather_02", "Fabric Leather 02"],
];
const PH_CAT = new Map(POLYHAVEN.map(([k, , cat]) => [k, cat]));
addBlocks('photo', PHOTO_TEXTURES.filter(([k]) => !['leafy_grass'].includes(k)).map(([k, name]) => [name, P(k), null, null, { cat: PH_CAT.get(k) || 'other' }]));

// Blocks with a front (chests, furnace...) get three hidden facings so the front can point at whoever places them.
function addFacings(list) {
  list.filter(b => b.front && !b.wheel && !b.hidden && !b.variants).forEach(b => {
    b.variants = [b];
    for (let k = 1; k < 4; k++) { const v = { ...b, hidden: true, variantOf: b, facing: k, variants: null }; BLOCKS.push(v); b.variants.push(v); }
  });
}
addFacings(BLOCKS);
// Every other Poly Haven texture as a plain cube.
{
  const have = new Set(PHOTO_TEXTURES.map(([k]) => k));
  addBlocks('photo', POLYHAVEN.filter(([k]) => !have.has(k)).map(([k, name, cat]) => [name, P(k), null, null, { cat }]));
}

// --- Labyrinth update: plants, lights and slabs (appended so older saves keep their ids) ---
const PLANT = { shape: 'cross', render: 'cutout', solid: false };
addBlocks('plants', [
  ['Grass Tuft', M('grass_1'), null, null, PLANT], ['Short Grass', M('grass_2'), null, null, PLANT], ['Grass Clump', M('grass_3'), null, null, PLANT],
  ['Tall Grass', M('grass_4'), null, null, PLANT], ['Thick Grass', M('grass_5'), null, null, PLANT],
  ['Dry Grass Tuft', M('dry_grass_1'), null, null, PLANT], ['Tall Dry Grass', M('dry_grass_3'), null, null, PLANT],
  ['Jungle Grass', M('junglegrass'), null, null, PLANT], ['Fern', M('fern_1'), null, null, PLANT], ['Large Fern', M('fern_2'), null, null, PLANT],
  ['Giant Fern', M('fern_3'), null, null, PLANT], ['Dry Shrub', M('dry_shrub'), null, null, PLANT], ['Papyrus', M('papyrus'), null, null, PLANT],
  ['Sapling', M('sapling'), null, null, PLANT], ['Jungle Sapling', M('junglesapling'), null, null, PLANT], ['Bush Sapling', M('bush_sapling'), null, null, PLANT],
  ['Jungle Sprout', M('emergent_jungle_sapling'), null, null, PLANT], ['Kelp', M('kelp'), null, null, PLANT],
  ['Cactus Seedling', M('large_cactus_seedling'), null, null, PLANT],
  ['Rose', M('flowers_rose'), null, null, PLANT], ['Tulip', M('flowers_tulip'), null, null, PLANT], ['Black Tulip', M('flowers_tulip_black'), null, null, PLANT],
  ['Dandelion', M('flowers_dandelion_yellow'), null, null, PLANT], ['White Dandelion', M('flowers_dandelion_white'), null, null, PLANT],
  ['Geranium', M('flowers_geranium'), null, null, PLANT], ['Viola', M('flowers_viola'), null, null, PLANT],
  ['Green Chrysanthemum', M('flowers_chrysanthemum_green'), null, null, PLANT],
  ['Red Mushroom', M('flowers_mushroom_red'), null, null, { ...PLANT, emit: 3 }], ['Brown Mushroom', M('flowers_mushroom_brown'), null, null, PLANT],
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => [`Wheat ${n}`, K('wheat_' + n), null, null, PLANT]),
  ['Torch', M('torch_on_floor'), null, null, { ...PLANT, emit: 14, bright: true }],
  ['Fire', M('fire_basic_flame_animated'), null, null, { ...PLANT, emit: 15, bright: true, anim: 3 }],
]);
addBlocks('minetest', [
  ['Blueberry Bush', M('blueberry_bush_leaves'), null, null, CUT], ['Cloud', M('cloud')],
  ['Mese Post Light', M('mese_post_light_side'), K('wood'), null, { emit: 14, bright: true }],
  ['Framed Glass', M('glass_detail'), null, null, SEE], ['Ladder Planks', M('ladder_wood'), null, null, CUT],
  ['Water Source', M('water_source_animated'), null, null, { render: 'trans', shape: 'liquid', solid: false, anim: 1 }],
  ['Lava Source', M('lava_source_animated'), null, null, { emit: 15, bright: true, anim: 2 }],
  ['Mese Crystal Ore', M('mineral_mese'), M('mineral_mese'), null, { emit: 8 }], ['Diamond Vein', M('mineral_diamond'), null, null, { emit: 5 }],
]);
// Bottom-half slabs: smooth steps for long staircases and benches.
const SLABS = ['Stone Bricks', 'Cobblestone', 'Mossy Cobblestone', 'Stone Block', 'Planks', 'Pine Planks', 'Sandstone Bricks', 'Desert Stone Bricks',
  'Obsidian Bricks', 'Silver Sandstone Bricks', 'Snow', 'Ice'];
const SLAB_PHOTO = ['castle_brick_01', 'castle_brick_02_red', 'castle_brick_02_white', 'castle_brick_07', 'marble_01', 'medieval_blocks_02',
  'mossy_stone_wall', 'mossy_brick', 'white_sandstone_bricks', 'dark_brick_wall', 'yellow_stone_wall', 'japanese_stone_wall', 'dark_wood',
  'old_wooden_floor_01', 'stone_tiles', 'cobblestone_floor_04', 'red_sandstone_wall', 'coral_fort_wall_01', 'volcanic_rock_tiles', 'church_bricks_02',
  'rock_wall_08', 'rough_wood', 'clay_roof_tiles', 'roof_slates_02', 'grey_roof_tiles', 'red_slate_roof_tiles_01', 'thatch_roof_angled', 'ceramic_roof_01'];
const byName = new Map(BLOCKS.map(b => [b.name, b]));
const phName = new Map(POLYHAVEN.map(([k, name]) => [k, name]));
for (const n of [...SLABS, ...SLAB_PHOTO.map(k => phName.get(k))]) {
  const b = byName.get(n); if (!b) continue;
  BLOCKS.push({ name: `${n} Slab`, group: 'slabs', faces: b.faces, shape: 'slab', render: b.render, slabOf: n });
}

// Portals, the player's portal stones and zip line anchors.
addBlocks('special', [
  ['Portal', K('wool_violet'), null, null, { render: 'trans', solid: false, emit: 11, bright: true, anim: 1, unbreakable: true }],
  ['Portal Stone', K('obsidian_brick'), M('mese_block'), null, { emit: 10, bright: true }],
  ['Zip Anchor', M('bronze_block'), M('meselamp'), null, { emit: 9 }],
]);

// Photo foliage (ambientCG moss photos with leafy gaps cut in) and photo fabric dyed in each colour: the world
// uses these instead of the cartoon Kenney leaves and wool.
const A = n => 'acg/' + n + '.jpg';
addBlocks('photo2', [
  ['Moss Hedge', A('moss_003'), null, null, { render: 'cutout', holes: 0.16 }],
  ['Dark Foliage', A('moss_004'), null, null, { render: 'cutout', holes: 0.2 }],
  ['Bright Foliage', A('moss_002'), null, null, { render: 'cutout', holes: 0.2 }],
  ...[['White', '#f2efe8'], ['Tan', '#c8a878'], ['Black', '#3a3a3e'], ['Blue', '#3f62b8'], ['Red', '#b8333a'], ['Violet', '#7a4bb0'],
    ['Dark Green', '#3f7040'], ['Orange', '#d8823a'], ['Yellow', '#e0c048'], ['Cyan', '#3fa7b0'], ['Magenta', '#b04a9c'], ['Pink', '#e08aa8'],
    ['Brown', '#7a5236'], ['Green', '#6aa84a'], ['Grey', '#9a9a9a'], ['Dark Grey', '#5a5a5e']]
    .map(([c, tint]) => [`${c} Fabric`, P('poly_wool_herringbone'), null, null, { tint }]),
  ['Moss Block', A('moss_003'), null, null, {}],
  ['Gilded Metal', P('metal_plate'), null, null, { tint: '#e2b04a' }],
  ['Bronze Metal', P('metal_plate'), null, null, { tint: '#b98048' }],
  ['Copper Metal', P('metal_plate'), null, null, { tint: '#cf7a46' }],
  ['Amber Lamp', P('metal_plate_02'), null, null, { tint: '#ffd68a', emit: 14, bright: true }],
]);
// The villain's letters (a hotbar item, never placed in the world).
addBlocks('story', [['Old Letter', 'story/letter.png', null, null, { shape: 'cross', solid: false }]]);
// Building blocks: one stack on the hotbar that places whichever look you've chosen (any block in the world). Never
// placed itself; its icon on the hotbar shows the chosen look.
addBlocks('story', [['Building Blocks', P('old_stone_wall'), null, null, {}]]);
// The deep caves: glowing crystals, mushrooms and caps in blue, purple, green, teal and white (copies of ice, mushrooms
// and moss, tinted and lit).
{
  const like = n => BLOCKS.find(b => b.name === n);
  const glow = (name, base, tint, emit, extra = {}) => { const b = like(base); if (b) BLOCKS.push({ ...b, name, group: 'plants', tint, emit, bright: true, ...extra }); };
  for (const [c, t] of [['Blue', '#2e9bff'], ['Purple', '#9b55ff'], ['Green', '#2cf08a'], ['White', '#bfe2ff']]) glow(`Glow Crystal ${c}`, 'Ice', t, 13);
  for (const [c, t] of [['Teal', '#62ffe6'], ['Blue', '#86b8ff'], ['Green', '#a6ff7a'], ['Purple', '#e0a0ff']]) glow(`Glow Shroom ${c}`, 'Red Mushroom', t, 11);
  for (const [c, t] of [['Teal', '#4fe8d0'], ['Purple', '#b07cff']]) glow(`Glow Cap ${c}`, 'Moss Block', t, 10);
  // (added later, so they come after the others: block numbers already in saved worlds stay the same)
  glow('Glow Crystal Pink', 'Ice', '#ff4fc0', 13); glow('Glow Shroom Pink', 'Red Mushroom', '#ff8ad8', 11);
  // Glowing water for the moats of the cavern castles.
  for (const [c, t] of [['Blue', '#3aa8ff'], ['Purple', '#a463ff'], ['Teal', '#2cf0c4'], ['Cyan', '#5fe6ff'], ['Pink', '#ff63cf'], ['Green', '#4dff74']]) glow(`Glow Water ${c}`, 'Water Source', t, 12);
}

// Face index of the front for each facing (it points back toward the player who placed it).
export const FRONT_FACE = [4, 1, 5, 0];
BLOCKS.forEach((b, i) => {
  b.id = i + 1;
  if (b.retired) { b.hidden = true; return; }
  b.icon = texUrl(b.front || b.faces.side || b.faces.all);
  b.shape = b.shape || 'cube';
  b.render = b.render || 'opaque';
  if (b.solid === undefined) b.solid = true;
  b.emit = b.emit || 0;
  // Light passes through everything that isn't a full opaque cube; leaves and water dim it.
  b.opaque = b.shape === 'cube' && b.render === 'opaque';
  b.dim = b.shape === 'liquid' ? 2 : b.render === 'cutout' && b.shape === 'cube' ? 1 : 0;
});
BLOCKS.forEach(b => { if (b.variants) b.variants = b.variants.map(v => v.id); if (b.variantOf && typeof b.variantOf === 'object') b.variantOf = b.variantOf.id; });
export const blockById = id => BLOCKS[id - 1];
export const BID = {}; BLOCKS.forEach(b => { if (!(b.name in BID) && !b.retired) BID[b.name] = b.id; });
// Retired ids load as their replacement.
export const REMAP = new Map(BLOCKS.filter(b => b.retired).map(b => [b.id, BID[b.retired]]));
export const NBLOCKS = BLOCKS.length + 1;
// Fast per-id property tables (index = id; 0 = air).
export const T_OPAQUE = new Uint8Array(NBLOCKS), T_SOLID = new Uint8Array(NBLOCKS), T_EMIT = new Uint8Array(NBLOCKS),
  T_DIM = new Uint8Array(NBLOCKS), T_SHAPE = new Uint8Array(NBLOCKS), T_RENDER = new Uint8Array(NBLOCKS);
export const SHAPE = { cube: 0, cross: 1, slab: 2, liquid: 3 }, RENDER = { opaque: 0, cutout: 1, trans: 2 };
for (const b of BLOCKS) {
  if (b.retired) continue;
  T_OPAQUE[b.id] = b.opaque ? 1 : 0; T_SOLID[b.id] = b.solid ? 1 : 0; T_EMIT[b.id] = b.emit;
  T_DIM[b.id] = b.dim; T_SHAPE[b.id] = SHAPE[b.shape]; T_RENDER[b.id] = RENDER[b.render];
}
// The world uses photo blocks only: every cartoon (Kenney) block the generator asks for is swapped for a photo one
// as it's written (see Vol.set). Players' own blocks keep whatever they chose.
const PHOTO_SWAP = {
  'Mossy Cobblestone': 'photo:mossy_cobblestone', Cobblestone: 'photo:cobblestone_05', 'Stone Bricks': 'photo:old_stone_wall',
  'Stone Block': 'photo:stone_brick_wall_001', 'Desert Stone Bricks': 'photo:sandstone_blocks_08', 'Desert Cobblestone': 'photo:medieval_blocks_02',
  'Desert Stone': 'photo:rock_pitted_mossy', 'Sandstone Block': 'photo:white_sandstone_bricks', 'Sandstone Bricks': 'photo:red_sandstone_wall',
  'Silver Sandstone': 'photo:large_sandstone_blocks', 'Silver Sandstone Bricks': 'photo:large_sandstone_blocks',
  'Obsidian Block': 'photo:rock_wall_13', 'Obsidian Bricks': 'photo:dark_brick_wall', Obsidian: 'photo:rock_wall_13', Gravel: 'photo:gravel',
  'Desert Sand': 'photo:sand_01', 'Silver Sand': 'photo:coast_sand_01', Snow: 'photo:snow_02', Clay: 'photo:red_sandstone_wall',
  'Jungle Log': 'photo:bark_brown_01', 'Aspen Log': 'photo:bark_platanus', 'Acacia Log': 'photo:pine_bark', 'Pine Log': 'photo:pine_bark',
  'Pine Planks': 'photo:dark_planks', 'Acacia Planks': 'photo:oak_wood_planks', 'Jungle Planks': 'photo:brown_planks_05', 'Aspen Planks': 'photo:oak_wood_planks',
  'Coal Ore': 'photo:rock_wall_08', Leaves: 'Moss Hedge', 'Jungle Leaves': 'Dark Foliage', 'Pine Needles': 'Dark Foliage',
  'Aspen Leaves': 'Bright Foliage', 'Acacia Leaves': 'Bright Foliage', 'Iron Ore': 'photo:rock_wall_10',
  'Stone Bricks Slab': 'Mossy Stone Wall Slab', 'Cobblestone Slab': 'Cobblestone Floor 04 Slab', 'Mossy Cobblestone Slab': 'Mossy Stone Wall Slab',
  'Stone Block Slab': 'Castle Brick 07 Slab', 'Pine Planks Slab': 'Dark Wood Slab', 'Sandstone Bricks Slab': 'Red Sandstone Wall Slab',
  'Desert Stone Bricks Slab': 'White Sandstone Bricks Slab', 'Obsidian Bricks Slab': 'Dark Brick Wall Slab', 'Silver Sandstone Bricks Slab': 'White Sandstone Bricks Slab',
  'Blueberry Bush': 'Dark Foliage', 'Mossy Dirt': 'Moss Block', 'Gold Block': 'Gilded Metal', 'Steel Block': 'photo:metal_plate', 'Tin Block': 'photo:metal_plate_02',
  'Bronze Block': 'Bronze Metal', 'Copper Block': 'Copper Metal', 'Straw': 'photo:thatch_roof_angled', 'Mese Post Light': 'Amber Lamp', 'Mese Lamp': 'Amber Lamp',
};
for (const c of ['White', 'Tan', 'Black', 'Blue', 'Red', 'Violet', 'Dark Green', 'Orange', 'Yellow', 'Cyan', 'Magenta', 'Pink', 'Brown', 'Green', 'Grey', 'Dark Grey']) PHOTO_SWAP[`${c} Wool`] = `${c} Fabric`;
export const GEN_REMAP = new Uint16Array(NBLOCKS).map((_, i) => i);
// (filled in below, once photo ids are known)
// Photo id -> block id ("photo:castle_brick_01"), for the world generator.
for (const b of BLOCKS) { const f = b.faces && b.faces.all; if (f && f.startsWith('photo/') && !b.retired && b.shape === 'cube' && !b.tint && !b.emit && !(('photo:' + f.slice(6, -4)) in BID)) BID['photo:' + f.slice(6, -4)] = b.id; }
for (const [from, to] of Object.entries(PHOTO_SWAP)) { const f = BID[from], t = BID[to]; if (f && t) GEN_REMAP[f] = t; }
// Facing variants of a block (front toward -z, +x, +z, -x).
export const facingOf = (name, facing) => { const b = blockById(BID[name]); return b.variants ? b.variants[facing & 3] : b.id; };
