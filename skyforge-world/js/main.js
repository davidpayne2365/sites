// Skyforge — a flat open world with an HD sky, fast movement and block building.
// Built so multiplayer (e.g. Firebase Realtime Database) can be plugged in later via `window.Game.net`.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { buildStarterCar } from './prefabs.js';
import { buildCastle, SUN_DIR, HX, HZ } from './castle.js';
import { makeLife } from './life.js';
import { audioStart, hoof } from './sound.js';
import { Horses } from './horses.js';
import { POLYHAVEN } from './photo_textures.js';
import { SKIES } from './skies.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CFG = {
  walkSpeed: 10,       // blocks / second
  jumpVelocity: 9.2,
  gravity: 28,
  eyeHeight: 1.62,
  height: 1.8,
  radius: 0.3,
  reach: 9,
  horizontalFov: 104,   // degrees, kept constant across split-screen shapes
  padYawSpeed: 3.6,     // radians / second at full right-stick deflection
  padPitchSpeed: 2.6,
  maxRenderWidth: 3840,  // cap the drawing buffer at 4K width
  maxLocalPlayers: 4,
  saveKey: 'skyfield.blocks.v1',  // stores only changes relative to the pre-built world
  // Vehicles
  maxVehicleBlocks: 600,
  carMaxSpeed: 42,      // blocks / second
  carReverseSpeed: 12,
  carAccel: 16,
  carBrake: 45,
  carDrag: 5,
  carTurn: 1.9,         // radians / second at full lock
  // Horse (rider + horse share one taller, wider body for collisions)
  horseSpeed: 26,       // blocks / second at full gallop
  horseSprint: 40,      // holding Shift (keyboard) or clicking the left stick (controller)
  // Flying (F / controller X / FLY button): straight through anything, the way you look
  flySpeed: 70,         // blocks / second
  flyBoost: 260,        // holding Shift or clicking the left stick
  horseJump: 12.1,      // leaps 2.6 blocks
  horseEye: 2.47,
  horseHeight: 2.6,
  horseRadius: 0.45,
};

// HD sky sources (all CORS-enabled). Tried in order; the last resort is a drawn gradient.
// Poly Haven "Kloofendal 48d Partly Cloudy (Pure Sky)" — CC0 — https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky
const SKY_CUBE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/cube/skyboxsun25deg/';

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

// ---------------------------------------------------------------------------
// Renderer / scene
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fbad6);
scene.fog = new THREE.Fog(0xc9d8e8, 600, 9000);

const hemi = new THREE.HemisphereLight(0xe4f0ff, 0x707070, 1.15);
scene.add(hemi);
// The sun: low in the south-west, warm, like the castle painting's afternoon light. It casts shadows across the
// castle hill (not on phones); the scenery doesn't move, so the shadow map is drawn once.
const sun = new THREE.DirectionalLight(0xfff1dc, 1.7);
sun.target.position.set(HX, 300, HZ);
sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 3000);
scene.add(sun, sun.target);
const SHADOWS = !isTouch;
if (SHADOWS) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -1500, right: 1500, top: 1500, bottom: -1500, near: 100, far: 6000 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.5;
}


// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------
let skyStatus = 'loading HD sky…';
function gradientSky() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#2f6fb8'); grd.addColorStop(0.45, '#8fbbe6'); grd.addColorStop(0.5, '#dfe9f2'); grd.addColorStop(1, '#9aa3ad');
  g.fillStyle = grd; g.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function loadCubeSky() {
  new THREE.CubeTextureLoader().setPath(SKY_CUBE).load(
    ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'],
    tex => { tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex; skyStatus = 'skybox (fallback)'; },
    undefined,
    () => { scene.background = gradientSky(); skyStatus = 'gradient (offline)'; });
}
// Choosable skies (all Poly Haven sky HDRIs, see js/skies.js). Lighting and haze follow the time of day.
const SKY_LIGHT = {
  // Haze reaches far enough to see the whole castle from the starting field.
  day: { hemi: [0xdfeaff, 0x6e665c, 0.95], sun: [0xffe0b0, 2.2], fog: [0xb7cbe2, 600, 9000] },
  sunset: { hemi: [0xffe6d8, 0x5a5058, 0.95], sun: [0xffc896, 0.95], fog: [0xbfb2bc, 500, 8000] },
  night: { hemi: [0x8a9ad0, 0x22222e, 0.78], sun: [0xb0c0ff, 0.5], fog: [0x0b0f1c, 250, 5000] },
};
const skyById = new Map(SKIES.map(([id, name, kind, pure]) => [id, { id, name, kind, pure }]));
let skyRequest = 0, currentSky = null, currentGround = null;
// Outdoor haze (set by the sky) and the dim, dusty air inside the castle. Each player's view blends between them.
const fogBase = { color: new THREE.Color(0xb7cbe2), near: 600, far: 9000 };
const FOG_INSIDE = { color: new THREE.Color(0x1c1814), near: 80, far: 1200 };
// Poly Haven exposure-normalises its HDRIs (night skies come out as bright as day), so scale each sky so its
// average brightness suits its time of day.
const SKY_TARGET = { day: 0.31, sunset: 0.28, night: 0.03 };
function skyIntensity(tex, kind) {
  const img = tex.image, data = img && img.data;
  if (!data || !img.width) return 1;
  const half = data instanceof Uint16Array, step = Math.max(1, Math.floor(img.width * img.height / 4000));
  let sum = 0, n = 0;
  for (let i = 0; i < img.width * img.height; i += step) {
    const o = i * 4, f = v => half ? THREE.DataUtils.fromHalfFloat(v) : v;
    sum += 0.2126 * f(data[o]) + 0.7152 * f(data[o + 1]) + 0.0722 * f(data[o + 2]); n++;
  }
  const mean = sum / n;
  return Math.max(0.01, Math.min(4, SKY_TARGET[kind] / (mean || 1)));
}
function setSky(id, quiet) {
  const sky = skyById.get(id) || skyById.get('kloofendal_48d_partly_cloudy_puresky');
  const L = SKY_LIGHT[sky.kind];
  hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
  sun.color.set(L.sun[0]); sun.intensity = L.sun[1];
  fogBase.color.set(L.fog[0]); fogBase.near = L.fog[1]; fogBase.far = L.fog[2];
  currentSky = sky.id;
  castle.setTimeOfDay(sky.kind);
  try { localStorage.setItem('skyfield.sky', sky.id); } catch (e) { /* ignore */ }
  const req = ++skyRequest;
  skyStatus = 'loading ' + sky.name;
  if (!quiet) toast(`Loading sky: ${sky.name}…`);
  const url = window.SKYFIELD_SKY_URL && req === 1 ? window.SKYFIELD_SKY_URL : `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/${sky.id}_2k.hdr`;
  const loader = /\.(jpe?g|png|webp)$/i.test(url) ? new THREE.TextureLoader() : new RGBELoader();
  loader.load(url, tex => {
    if (req !== skyRequest) { tex.dispose(); return; } // a newer choice won
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if (loader instanceof THREE.TextureLoader) tex.colorSpace = THREE.SRGBColorSpace;
    const old = scene.background;
    scene.background = tex; scene.backgroundIntensity = skyIntensity(tex, sky.kind);
    if (old && old.isTexture) old.dispose();
    skyStatus = sky.name;
    if (!quiet) toast(`Sky: ${sky.name}`);
  }, undefined, () => { if (req === skyRequest && !(scene.background && scene.background.isTexture)) loadCubeSky(); });
}
let savedSky = null;
try { savedSky = localStorage.getItem('skyfield.sky'); } catch (e) { /* ignore */ }

// ---------------------------------------------------------------------------
// Block textures, all from free texture packs (nothing hand-drawn):
//   textures/blocks/   Kenney "Voxel Pack" (CC0, www.kenney.nl), 48x48
//   textures/minetest/ Minetest Game (CC BY-SA 3.0 media, see textures/minetest/licenses/), 16x16
//   textures/photo/    Poly Haven photo-scanned textures (CC0, polyhaven.com), 256x256
// ---------------------------------------------------------------------------
const texCache = new Map();
const texLoader = new THREE.TextureLoader();
function fileTex(path) {
  if (!texCache.has(path)) {
    const t = texLoader.load(texUrl(path));
    const photo = path.startsWith('photo/'); // photos look best smooth; pixel-art packs stay crisp
    t.magFilter = photo ? THREE.LinearFilter : THREE.NearestFilter;
    t.minFilter = photo ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapLinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texCache.set(path, t);
  }
  return texCache.get(path);
}
const texUrl = path => `textures/${path}${path.includes('.') ? '' : '.png'}`;
const K = n => 'blocks/' + n;    // Kenney texture
const M = n => 'minetest/' + n;  // Minetest Game texture
const P = n => `photo/${n}.jpg`;  // Poly Haven photo-scanned texture (CC0), 256x256

// ---------------------------------------------------------------------------
// Block types. Box face order: +x, -x, +y(top), -y(bottom), +z, -z
// IDs are positions in this list and are what saved worlds store, so entries are only ever appended or
// retired (retired ids are swapped for a replacement when loaded).
// ---------------------------------------------------------------------------
const CUT = { alphaTest: 0.5 };
const SEE = { transparent: true, depthWrite: false };
const BLOCKS = [
  { name: 'Grass', faces: { side: P('forrest_ground_01'), top: P('leafy_grass'), bottom: P('forrest_ground_01') } },
  { name: 'Stone', faces: { all: P('rock_01') } },
  { name: 'Dirt', faces: { all: P('brown_mud_leaves_01') } },
  { name: 'Planks', faces: { all: P('wood_floor') } },
  { name: 'Log', faces: { side: P('bark_brown_02'), top: P('rough_wood') } },
  { name: 'Brick', faces: { all: P('red_brick') } },
  { name: 'Glass', faces: { all: K('glass') }, mat: SEE },
  { name: 'Sand', faces: { all: P('coast_sand_01') } },
  { name: 'Leaves', faces: { all: K('leaves') }, mat: CUT },
  { name: 'Gold Block', faces: { all: M('gold_block') } },
  { name: 'Ice', faces: { all: K('ice') } },
  { name: 'Mese Lamp', faces: { all: M('meselamp') }, glow: true },
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
      mat: opt.mat, glow: !!opt.glow, front: opt.front || null });
  }
}
// Ids 137-179: Kenney Voxel Pack (same order as before so saved worlds keep their blocks).
addBlocks('kenney', [
  ['Cobblestone', K('cobble')], ['Mossy Cobblestone', K('mossycobble')], ['Stone Bricks', K('stone_brick')], ['Stone Block', K('stone_block')],
  ['Gravel', K('gravel')], ['Pine Planks', K('pine_wood')], ['Jungle Planks', K('junglewood')], ['Acacia Planks', K('acacia_wood')],
  ['Aspen Planks', K('aspen_wood')], ['Pine Log', K('pine_tree'), K('pine_tree_top')], ['Jungle Log', K('jungletree'), K('jungletree_top')],
  ['Acacia Log', K('acacia_tree'), K('acacia_tree_top')], ['Aspen Log', K('aspen_tree'), K('aspen_tree_top')],
  ['Pine Needles', K('pine_needles'), null, null, { mat: CUT }], ['Jungle Leaves', K('jungleleaves'), null, null, { mat: CUT }],
  ['Acacia Leaves', K('acacia_leaves'), null, null, { mat: CUT }], ['Aspen Leaves', K('aspen_leaves'), null, null, { mat: CUT }],
  ['Desert Sand', K('desert_sand')], ['Silver Sand', K('silver_sand')], ['Sandstone', K('sandstone')], ['Sandstone Bricks', K('sandstone_brick')],
  ['Sandstone Block', K('sandstone_block')], ['Desert Stone', K('desert_stone')], ['Desert Stone Bricks', K('desert_stone_brick')],
  ['Desert Cobblestone', K('desert_cobble')], ['Silver Sandstone', K('silver_sandstone')], ['Silver Sandstone Bricks', K('silver_sandstone_brick')],
  ['Obsidian Glass', K('obsidian_glass'), null, null, { mat: SEE }], ['Obsidian Bricks', K('obsidian_brick')],
  ['Obsidian Block', K('obsidian_block')], ['Snow', K('snow')], ['Snowy Grass', K('snow_side'), K('snow'), K('dirt')],
  ['Dry Grass', K('dry_grass_side'), K('dry_grass'), K('dirt')], ['Coal Ore', K('ore_coal')], ['Iron Ore', K('ore_iron')],
  ['Copper Ore', K('ore_copper')], ['Gold Ore', K('ore_gold')], ['Diamond Ore', K('ore_diamond')], ['Mese Ore', K('ore_mese')],
  ['Cactus', K('cactus_side'), K('cactus_top')], ['Furnace', K('furnace_side'), K('furnace_top'), null, { front: K('furnace_front') }],
  ['Water', K('water'), null, null, { mat: { transparent: true, opacity: 0.8, depthWrite: false } }], ['Lava', K('lava'), null, null, { glow: true }],
]);
// Wool in every colour (Kenney).
addBlocks('wool', ['Orange', 'Yellow', 'Green', 'Dark Green', 'Cyan', 'Violet', 'Magenta', 'Pink', 'Brown', 'Tan', 'Grey', 'Dark Grey', 'Black']
  .map(c => [`${c} Wool`, K('wool_' + c.toLowerCase().replace(' ', '_'))]));
// Minetest Game blocks.
addBlocks('minetest', [
  ['Treasure Chest', M('chest_side'), M('chest_top'), null, { front: M('chest_front') }],
  ['Locked Chest', M('chest_side'), M('chest_top'), null, { front: M('chest_lock') }],
  ['TNT', M('tnt_side'), M('tnt_top'), M('tnt_bottom')],
  ['Bookshelf', M('bookshelf'), K('wood')], ['Bottle Shelf', M('vessels_shelf'), K('wood')],
  ['Diamond Block', M('diamond_block')], ['Mese Block', M('mese_block')], ['Copper Block', M('copper_block')], ['Bronze Block', M('bronze_block')],
  ['Bone Box', M('bones_side'), M('bones_top'), M('bones_bottom'), { front: M('bones_front') }],
  ['Iron Bars', M('xpanes_bar'), null, null, { mat: CUT }],
  ['Clay Bricks', M('clay_brick')], ['Desert Sandstone', M('desert_sandstone')], ['Desert Sandstone Bricks', M('desert_sandstone_brick')],
  ['Desert Sandstone Block', M('desert_sandstone_block')], ['Permafrost', M('permafrost')], ['Mossy Dirt', M('moss_side'), M('moss'), M('dirt')],
  ['Dry Dirt', M('dry_dirt')], ['Straw', M('farming_straw')], ['Farmland', M('dirt'), M('farming_soil')],
  ['Wet Farmland', M('farming_soil_wet_side'), M('farming_soil_wet'), M('dirt')],
  ['Brown Coral', M('coral_brown')], ['Cyan Coral', M('coral_cyan')], ['Green Coral', M('coral_green')],
  ['Orange Coral', M('coral_orange')], ['Pink Coral', M('coral_pink')], ['Coral Skeleton', M('coral_skeleton')],
]);
const PHOTO_TEXTURES = [
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
BLOCKS.filter(b => b.front && !b.wheel && !b.hidden).forEach(b => {
  b.variants = [b];
  for (let k = 1; k < 4; k++) { const v = { ...b, hidden: true, variantOf: b, facing: k, variants: null }; BLOCKS.push(v); b.variants.push(v); }
});
// Every other Poly Haven texture as a plain cube.
{
  const have = new Set(PHOTO_TEXTURES.map(([k]) => k));
  addBlocks('photo', POLYHAVEN.filter(([k]) => !have.has(k)).map(([k, name, cat]) => [name, P(k), null, null, { cat }]));
}

// Face index of the front for each facing (it points back toward the player who placed it).
const FRONT_FACE = [4, 1, 5, 0];
BLOCKS.forEach((b, i) => {
  b.id = i + 1;
  if (b.retired) { b.hidden = true; return; }
  b.icon = texUrl(b.front || b.faces.side || b.faces.all);
});
// Materials (and their textures) are only created the first time a block is used, so hundreds of
// photo textures don't all download at startup.
function blockMats(b) {
  if (b.materials) return b.materials;
  const f = b.faces;
  const side = f.side || f.all, top = f.top || f.all, bottom = f.bottom || f.top || f.all;
  const make = path => b.glow ? new THREE.MeshBasicMaterial({ map: fileTex(path), ...(b.mat || {}) })
    : new THREE.MeshLambertMaterial({ map: fileTex(path), ...(b.mat || {}) });
  const ms = make(side), mt = top === side ? ms : make(top), mb = bottom === side ? ms : bottom === top ? mt : make(bottom);
  b.materials = [ms, ms, mt, mb, ms, ms];
  if (b.front) b.materials[FRONT_FACE[b.facing || 0]] = make(b.front);
  return b.materials;
}
BLOCKS.forEach(b => { if (b.variants) b.variants = b.variants.map(v => v.id); });
const blockById = id => BLOCKS[id - 1];
const BID = {}; BLOCKS.forEach(b => { if (!(b.name in BID) && !b.retired) BID[b.name] = b.id; });
// Retired ids load as their replacement.
const REMAP = new Map(BLOCKS.filter(b => b.retired).map(b => [b.id, BID[b.retired]]));
const VIS = BLOCKS.filter(b => !b.hidden);           // everything selectable
const visIndex = new Map(VIS.map((b, i) => [b.id, i]));
// Palette rows: basics, photo-real blocks, Kenney pack, wool, Minetest blocks.
// Flat lists for the carousel, each with category markers (groups: [{ label, start }]).
const BLOCK_LIST = [], SKY_LIST = [];
BLOCK_LIST.groups = []; SKY_LIST.groups = [];
const GROUP_LABEL = { kenney: 'Kenney pack', wool: 'Wool', minetest: 'Minetest blocks' };
const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
const PHOTO_CAT_ORDER = ['grass', 'terrain', 'sand', 'gravel', 'snow', 'rock', 'cobblestone', 'sandstone', 'brick', 'concrete', 'plaster',
  'asphalt', 'tiles', 'floor', 'roofing', 'wall', 'wood', 'bark', 'metal', 'fabric', 'leather', 'moon', 'other'];
for (const g of [undefined, 'photo', 'kenney', 'wool', 'minetest']) {
  const group = VIS.filter(b => b.group === g);
  const parts = g === 'photo'
    ? PHOTO_CAT_ORDER.map(c => group.filter(b => (PHOTO_CAT_ORDER.includes(b.cat) ? b.cat : 'other') === c).sort((a, b) => a.name.localeCompare(b.name)))
    : [group];
  parts.forEach(part => {
    if (!part.length) return;
    BLOCK_LIST.groups.push({ start: BLOCK_LIST.length, label: g === undefined ? 'Basics' : g === 'photo' ? `Photo · ${cap(part[0].cat in { moon: 1 } ? 'moon' : PHOTO_CAT_ORDER.includes(part[0].cat) ? part[0].cat : 'other')}` : GROUP_LABEL[g] });
    BLOCK_LIST.push(...part);
  });
}
// Any block can be the ground (top face, tiled). Saved per browser.
function setGround(id, quiet) {
  const b = blockById(id);
  if (!b || b.retired) return;
  const path = b.faces.top || b.faces.all;
  groundTile = path.startsWith('photo/') ? 2 : 1;
  const old = ground.material.map;
  ground.material.map = path === P('leafy_grass') ? groundTexture('photo/ground_leafy_grass.jpg', 2) : groundTexture(path, groundTile);
  ground.material.needsUpdate = true;
  if (old) old.dispose();
  currentGround = id;
  try { localStorage.setItem('skyfield.ground', String(id)); } catch (e) { /* ignore */ }
  if (!quiet) toast(`Ground: ${b.name}`);
}

// Skies for the Sky tab, shown as preview pictures.
for (const [id, name, kind, pure] of SKIES) {
  const label = pure ? `Pure sky · ${cap(kind)}` : `${cap(kind)} · with landscape`;
  if (!SKY_LIST.groups.length || SKY_LIST.groups[SKY_LIST.groups.length - 1].label !== label) SKY_LIST.groups.push({ start: SKY_LIST.length, label });
  SKY_LIST.push({ sky: true, id: 'sky:' + id, skyId: id, name: `${name} (${kind})`,
    icon: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256&height=128` });
}
const WHEEL_ID = BID['Steering Wheel'];
const isWheel = id => id >= WHEEL_ID && id < WHEEL_ID + 4;
const FORWARD = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // per facing: -z, +x, +z, -x
// The id to place for a selected block, turned to face the player.
function facedId(id, facing) {
  if (id === WHEEL_ID) return WHEEL_ID + facing;
  const b = blockById(id);
  return b.variants ? b.variants[facing] : id;
}
// Rotate a placed block's facing by `turn` quarter turns (used when a vehicle parks).
function rotateId(id, turn) {
  if (isWheel(id)) return WHEEL_ID + (((id - WHEEL_ID) - turn) % 4 + 4) % 4;
  const b = blockById(id), base = b.variantOf ? (typeof b.variantOf === 'number' ? blockById(b.variantOf) : b.variantOf) : b;
  if (!base.variants) return id;
  return base.variants[(((b.facing || 0) - turn) % 4 + 4) % 4];
}

// ---------------------------------------------------------------------------
// Ground: endless grass, one tile per block (the plane follows the player).
// ---------------------------------------------------------------------------
const GROUND = 20480; // reaches past the haze, so its edge is never seen
let groundTile = 2; // blocks per texture tile (photos cover 2 blocks, pixel-art packs 1)
function groundTexture(path, tile) {
  const t = texLoader.load(texUrl(path));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const photo = path.startsWith('photo/');
  t.magFilter = photo ? THREE.LinearFilter : THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.repeat.set(GROUND / tile, GROUND / tile);
  return t;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND, GROUND),
  new THREE.MeshLambertMaterial({ map: groundTexture('photo/ground_leafy_grass.jpg', 2) }));
ground.rotation.x = -Math.PI / 2;
ground.renderOrder = -1;
scene.add(ground);

// ---------------------------------------------------------------------------
// The Giants' Castle (js/castle.js): a castle of towers on a rocky hill 1300 m north of the start, with a road up
// to the keep. It is solid (walk, ride, build and drive on it) but can't be broken, and it isn't part of the saves.
// ---------------------------------------------------------------------------
const castle = buildCastle({ texUrl, anisotropy: renderer.capabilities.getMaxAnisotropy(), lowDetail: isTouch });
scene.add(castle.group);
castle.hideGroundInside(ground.material);
ground.receiveShadow = true;
if (SHADOWS) renderer.shadowMap.needsUpdate = true;
// Birds over the hill and a dragon circling the spire (js/life.js).
const life = makeLife(scene, { hill: { x: HX, z: HZ }, spire: castle.tower });

// ---------------------------------------------------------------------------
// World: blocks stored in a Map keyed "x,y,z" -> block id. Rendered with one InstancedMesh per type.
// ---------------------------------------------------------------------------
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const tmpM = new THREE.Matrix4();
class Layer {
  constructor(def) { this.def = def; this.cap = 0; this.keys = []; this.index = new Map(); this.mesh = null; this.grow(256); }
  grow(cap) {
    const m = new THREE.InstancedMesh(boxGeo, blockMats(this.def), cap);
    m.frustumCulled = false;
    m.count = this.keys.length;
    if (this.mesh) { m.instanceMatrix.array.set(this.mesh.instanceMatrix.array.subarray(0, this.keys.length * 16)); scene.remove(this.mesh); this.mesh.dispose(); }
    m.instanceMatrix.needsUpdate = true;
    this.mesh = m; this.cap = cap; scene.add(m);
  }
  add(key, x, y, z) {
    if (this.keys.length >= this.cap) this.grow(this.cap * 2);
    const i = this.keys.length;
    tmpM.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
    this.mesh.setMatrixAt(i, tmpM);
    this.keys.push(key); this.index.set(key, i);
    this.mesh.count = this.keys.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  remove(key) {
    const i = this.index.get(key); if (i === undefined) return;
    const last = this.keys.length - 1;
    if (i !== last) {
      this.mesh.getMatrixAt(last, tmpM); this.mesh.setMatrixAt(i, tmpM);
      this.keys[i] = this.keys[last]; this.index.set(this.keys[i], i);
    }
    this.keys.pop(); this.index.delete(key);
    this.mesh.count = this.keys.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
const layers = []; // created on first use
const layerFor = id => layers[id - 1] || (layers[id - 1] = new Layer(blockById(id)));

const keyOf = (x, y, z) => `${x},${y},${z}`;
const world = {
  blocks: new Map(),
  get(x, y, z) { return this.blocks.get(keyOf(x, y, z)) || 0; },
  isSolid(x, y, z) { return y < 0 || this.blocks.has(keyOf(x, y, z)) || castle.solid(x, y, z); },
  // source: 'local' (this player), 'remote' (network), 'load' (storage)
  set(x, y, z, id, source = 'local') {
    if (y < 0 || y > 1023) return false; // tall enough to build up past the castle roof
    id = REMAP.get(id) || id;
    const k = keyOf(x, y, z), old = this.blocks.get(k) || 0;
    if (old === id) return false;
    if (old) layers[old - 1].remove(k);
    if (id) { this.blocks.set(k, id); layerFor(id).add(k, x, y, z); } else this.blocks.delete(k);
    if (source === 'local') { net.onLocalBlock(x, y, z, id); scheduleSave(); }
    return true;
  },
};

// Local persistence (until a shared database is connected).
// The starter car is generated identically every time, so only differences from them are saved
// ("x,y,z,id" entries, id 0 = removed).
const generated = new Map();
let saveTimer = 0;
function saveNow() {
  try {
    const arr = [];
    for (const [k, id] of world.blocks) if (generated.get(k) !== id) arr.push(k + ',' + id);
    for (const k of generated.keys()) if (!world.blocks.has(k)) arr.push(k + ',0');
    localStorage.setItem(CFG.saveKey, arr.join(';'));
  } catch (e) { /* storage unavailable */ }
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 600); }
function loadSaved() {
  const put = (x, y, z, id) => { generated.set(keyOf(x, y, z), id); world.set(x, y, z, id, 'load'); };
  buildStarterCar(put, BID);

  let s = null;
  try { s = localStorage.getItem(CFG.saveKey); } catch (e) { /* ignore */ }
  if (s) {
    for (const part of s.split(';')) {
      const [x, y, z, id] = part.split(',').map(Number);
      if (id === 0 || blockById(id)) world.set(x, y, z, id, 'load');
    }
    return;
  }
  // First visit: a small welcome arch and tree near spawn.
  const put2 = (x, y, z, id) => world.set(x, y, z, id, 'load');
  for (let x = -2; x <= 2; x++) for (let z = -12; z <= -8; z++) put2(x, 0, z, BID.Sand);
  for (let y = 1; y <= 3; y++) { put2(-2, y, -12, BID.Log); put2(2, y, -12, BID.Log); }
  for (let x = -2; x <= 2; x++) put2(x, 4, -12, BID.Brick);
  put2(0, 1, -10, BID.Glowstone);
  for (let y = 0; y < 4; y++) put2(9, y, -6, BID.Log);
  for (let x = 7; x <= 11; x++) for (let z = -8; z <= -4; z++) for (let y = 4; y <= 5; y++) if (Math.abs(x - 9) + Math.abs(z + 6) + (y - 4) < 4) put2(x, y, z, BID.Leaves);
  put2(9, 6, -6, BID.Leaves);
  scheduleSave();
}


// ---------------------------------------------------------------------------
// Multiplayer hooks (no-op for now). Replace these to wire up Firebase later:
//   net.onLocalBlock(x, y, z, id)  -> called when this player places (id>0) / breaks (id=0) a block
//   net.onLocalPlayer(state, slot)  -> called ~10x per second per local player with { x, y, z, yaw, pitch }
// Incoming data goes through Game.world.set(x,y,z,id,'remote') and Game.players.upsert / remove.
// ---------------------------------------------------------------------------
const net = { onLocalBlock() {}, onLocalPlayer() {} };


// ---------------------------------------------------------------------------
// Avatars: blocky characters, used for remote players and split-screen partners.
// ---------------------------------------------------------------------------
const PLAYER_COLORS = [0x3d8bff, 0xff5a7a, 0x4cd964, 0xffb020];
const skinMat = new THREE.MeshLambertMaterial({ color: 0xf1c9a5 });
const legMat = new THREE.MeshLambertMaterial({ color: 0x2c3550 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
function makeAvatar(color) {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), legMat);
  legs.position.y = 0.35;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 1.075;
  const head = new THREE.Group();
  head.position.y = 1.45;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
  skull.position.y = 0.25;
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.02), eyeMat);
  eyes.position.set(0, 0.3, -0.26);
  head.add(skull, eyes);
  g.add(legs, body, head);
  return { group: g, head };
}

// Remote (networked) players — not connected yet; see the multiplayer hooks above.
const remotePlayers = {
  map: new Map(),
  upsert(id, s) {
    let p = this.map.get(id);
    if (!p) {
      const av = makeAvatar(new THREE.Color().setHSL((hashStr(id) % 360) / 360, 0.6, 0.55));
      scene.add(av.group);
      p = { ...av, target: new THREE.Vector3(s.x, s.y, s.z), yaw: 0, pitch: 0 };
      av.group.position.copy(p.target);
      this.map.set(id, p);
    }
    p.target.set(s.x, s.y, s.z); p.yaw = s.yaw || 0; p.pitch = s.pitch || 0;
  },
  remove(id) { const p = this.map.get(id); if (p) { scene.remove(p.group); this.map.delete(id); } },
  update(dt) {
    const k = 1 - Math.exp(-dt * 12);
    for (const p of this.map.values()) { p.group.position.lerp(p.target, k); p.group.rotation.y = p.yaw; p.head.rotation.x = p.pitch; }
  },
};
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 2654435761); return h >>> 0; }

// ---------------------------------------------------------------------------
// Local players (split screen). Player 1 uses keyboard/mouse/touch and the first controller;
// each extra controller adds another player with its own screen region.
// Render layers: 0 = world, 1-4 = each local player's avatar (hidden from its own camera),
// 5-8 = each player's block highlight (shown only to that player).
// ---------------------------------------------------------------------------
const AVATAR_LAYER = 1, HILITE_LAYER = 5;
const hiliteGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
const hudsEl = document.getElementById('huds');
const locals = [];

class LocalPlayer {
  constructor(slot, pos, yaw) {
    this.slot = slot;
    this.pos = pos.clone(); this.vel = new THREE.Vector3();
    this.yaw = yaw; this.pitch = 0;
    this.onGround = false; this.selected = 1;
    this.bob = 0; this.fovBoost = 0;
    this.gamepadIndex = null; this.prev = []; this.placeCd = 0; this.breakCd = 0;
    this.target = null; this.netT = 0; this.vehicle = null;
    this.vp = { x: 0, y: 0, w: innerWidth, h: innerHeight };

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 10000);
    this.inside = 0; this.stepY = 0;
    this.camera.rotation.order = 'YXZ';
    this.camera.layers.enableAll();
    this.camera.layers.disable(AVATAR_LAYER + slot);
    for (let i = 0; i < CFG.maxLocalPlayers; i++) if (i !== slot) this.camera.layers.disable(HILITE_LAYER + i);

    this.highlight = new THREE.LineSegments(hiliteGeo, new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8 }));
    this.highlight.layers.set(HILITE_LAYER + slot);
    this.palOpen = false; this.palTab = 'hotbar'; this.cur = { blocks: 0, sky: 0 }; this.palNavT = 0;
    this.highlight.visible = false;
    scene.add(this.highlight);

    this.avatar = makeAvatar(PLAYER_COLORS[slot]);
    this.avatar.group.traverse(o => o.layers.set(AVATAR_LAYER + slot));
    scene.add(this.avatar.group);

    this.hud = makeHud(this);
    this.favs = loadHotbar(slot); this.favIdx = 0;
    selectSlot(this, 0, true);
  }
  dispose() { scene.remove(this.highlight, this.avatar.group); this.hud.root.remove(); }
}

// Usable things say how to use them: looking at a steering wheel shows "Press A / E to drive";
// on touch screens the message itself is the button ("Tap here to drive" / "Tap here to get out").
function showUseHint(p) {
  const pad = p.gamepadIndex !== null, touch = isTouch && p.slot === 0 && !pad;
  const state = p.vehicle ? (touch ? 'exit' : '') : p.horse ? (touch ? 'dismount' : '') : targetIsHorse(p) ? 'ride' : targetIsWheel(p) ? 'drive' : '';
  const key = state + (pad ? 'pad' : touch ? 'touch' : 'key');
  if (key === p.hud.hintKey) return;
  p.hud.hintKey = key;
  const verb = state === 'ride' ? 'ride' : 'drive';
  const text = !state ? '' : state === 'exit' ? 'Tap here to get out' : state === 'dismount' ? 'Tap here to get off'
    : pad ? `Press A to ${verb}` : touch ? `Tap here to ${verb}` : `Press E to ${verb}`;
  if (text) p.hud.hint.textContent = text;
  p.hud.hint.style.opacity = state ? 1 : 0;
  p.hud.hint.classList.toggle('tappable', !!state && touch);
}
function makeHud(p) {
  const root = document.createElement('div');
  root.className = 'phud';
  const col = '#' + PLAYER_COLORS[p.slot].toString(16).padStart(6, '0');
  root.innerHTML = `<div class="tag" style="background:${col}">P${p.slot + 1}</div><div class="cross"></div><div class="bname"></div><div class="hint"></div>`
    + `<div class="palette" hidden><div class="phead"><div class="ptabs">`
    + PAL_TABS.map(t => `<button type="button" data-tab="${t}">${TAB_LABEL[t]}</button>`).join('')
    + `</div><div class="pcat"></div></div>`
    + `<div class="carousel">${'<div class="ccell"><img alt=""></div>'.repeat(11)}</div>`
    + `<div class="pinfo"><div class="ptitle"></div><div class="paction"></div><div class="phelp"></div></div>`
    + `<button class="pclose" type="button">✕</button></div><div class="hotbar"></div>`;
  const bar = root.querySelector('.hotbar');
  const pal = root.querySelector('.palette');
  const carousel = root.querySelector('.carousel'), carCells = [...carousel.children];
  carCells[5].classList.add('center');
  carCells.forEach((cell, k) => cell.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    if (k === 5) applyPalette(p); else movePalette(p, k - 5);
  }));
  // Swipe (touch) and wheel (mouse) scroll the carousel.
  let swipeX = null;
  carousel.addEventListener('touchstart', e => { swipeX = e.touches[0].clientX; e.stopPropagation(); }, { passive: true });
  carousel.addEventListener('touchmove', e => {
    if (swipeX === null) return;
    const dx = e.touches[0].clientX - swipeX, step = 36;
    if (Math.abs(dx) >= step) { movePalette(p, -Math.trunc(dx / step)); swipeX += Math.trunc(dx / step) * step; }
    e.preventDefault(); e.stopPropagation();
  }, { passive: false });
  carousel.addEventListener('touchend', () => { swipeX = null; });
  carousel.addEventListener('wheel', e => { e.preventDefault(); movePalette(p, (e.deltaY || e.deltaX) > 0 ? 1 : -1); }, { passive: false });
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const d = document.createElement('div'); d.className = 'slot';
    d.innerHTML = `<img alt=""><span>${i + 1}</span>`;
    if (p.slot === 0) {
      d.addEventListener('click', () => selectSlot(p, i));
      d.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); selectSlot(p, i); }, { passive: false });
    }
    bar.appendChild(d);
  }
  const tapBtn = (sel, fn) => { const el = root.querySelector(sel); el.addEventListener('click', e => { e.stopPropagation(); fn(); }); el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false }); };
  if (p.slot === 0) tapBtn('.hint', () => { if (p.hud.hint.classList.contains('tappable')) useAction(p); });
  tapBtn('.pclose', () => closePalette(p));
  const tabBtns = [...root.querySelectorAll('.ptabs button')];
  tabBtns.forEach(btn => { const go = e => { e.preventDefault(); e.stopPropagation(); setPalTab(p, btn.dataset.tab); }; btn.addEventListener('click', go); btn.addEventListener('touchstart', go, { passive: false }); });
  hudsEl.appendChild(root);
  return { root, bar, pal, tabBtns, carousel, carCells, pcat: root.querySelector('.pcat'), paction: root.querySelector('.paction'), hintKey: '',  ptitle: root.querySelector('.ptitle'), phelp: root.querySelector('.phelp'), name: root.querySelector('.bname'), hint: root.querySelector('.hint'), nameTimer: 0 };
}

// Favourites hotbar: 9 slots per player, saved in the browser. LB / RB (or 1-9, mouse wheel) switch slots;
// the palette puts a block into the current slot.
const HOTBAR_SIZE = 9;
const DEFAULT_HOTBAR = ['Grass', 'Stone', 'Planks', 'Brick', 'Glass', 'Mese Lamp', 'Treasure Chest', 'TNT', 'Steering Wheel'];
function loadHotbar(slot) {
  let ids = null;
  try { ids = JSON.parse(localStorage.getItem('skyfield.hotbar.v1.' + slot)); } catch (e) { /* ignore */ }
  if (Array.isArray(ids)) ids = ids.map(id => REMAP.get(id) || id);
  if (!Array.isArray(ids) || ids.length !== HOTBAR_SIZE || !ids.every(id => blockById(id) && !blockById(id).hidden))
    ids = DEFAULT_HOTBAR.map(n => BLOCKS.find(b => b.name === n).id);
  return ids;
}
function saveHotbar(p) { try { localStorage.setItem('skyfield.hotbar.v1.' + p.slot, JSON.stringify(p.favs)); } catch (e) { /* ignore */ } }
function renderHotbar(p) {
  [...p.hud.bar.children].forEach((el, i) => {
    const b = blockById(p.favs[i]);
    const img = el.querySelector('img');
    if (img.getAttribute('src') !== b.icon) img.src = b.icon;
    img.alt = b.name; el.title = b.name;
    el.classList.toggle('sel', i === p.favIdx);
  });
}
function selectSlot(p, i, quiet) {
  p.favIdx = (i + HOTBAR_SIZE) % HOTBAR_SIZE;
  renderHotbar(p);
  selectBlock(p, p.favs[p.favIdx], quiet);
}
const cycleBlock = (p, d) => selectSlot(p, p.favIdx + d);

function selectBlock(p, id, quiet) {
  if (!blockById(id) || blockById(id).hidden) return;
  p.selected = id;
  if (quiet) return;
  p.hud.name.textContent = blockById(id).name; p.hud.name.style.opacity = 1;
  clearTimeout(p.hud.nameTimer); p.hud.nameTimer = setTimeout(() => { p.hud.name.style.opacity = 0; }, 1200);
}

// ---------------------------------------------------------------------------
// Block menu: a carousel along the bottom of the screen. Three tabs, switched with LB / RB (controller),
// [ / ] (keyboard) or by tapping a tab:
//   Hotbar - A puts the highlighted block into your selected hotbar slot
//   Ground - A tiles the highlighted block across the ground
//   Sky    - A switches to the highlighted sky
// Left / right moves one item, LT / RT jumps 10, up / down jumps to the previous / next category.
// The centre of the carousel is a spinning 3D preview of the highlighted block.
// ---------------------------------------------------------------------------
const PAL_TABS = ['hotbar', 'ground', 'sky'];
const TAB_LABEL = { hotbar: 'Hotbar', ground: 'Ground', sky: 'Sky' };
const listKey = p => (p.palTab === 'sky' ? 'sky' : 'blocks');
const listOf = p => (p.palTab === 'sky' ? SKY_LIST : BLOCK_LIST);
const curItem = p => listOf(p)[p.cur[listKey(p)]];
const groupOf = (list, i) => { let g = list.groups[0]; for (const x of list.groups) if (x.start <= i) g = x; return g; };
function actionKey(p) { return p.gamepadIndex !== null ? 'A' : isTouch ? 'Tap the middle' : 'Click the middle / Enter'; }
const CAR_SCALE = [1, 0.62, 0.5, 0.42, 0.36, 0.32]; // size of each cell by distance from the centre

function updatePalTitle(p) {
  const list = listOf(p), i = p.cur[listKey(p)], item = list[i]; if (!item) return;
  const name = item.sky ? item.name : blockById(item.id).name;
  const what = p.palTab === 'hotbar' ? `put it in slot ${p.favIdx + 1}` : p.palTab === 'ground' ? 'make it the ground' : 'use this sky';
  const now = p.palTab === 'ground' && currentGround === item.id ? '  ✓ current ground'
    : p.palTab === 'sky' && currentSky === item.skyId ? '  ✓ current sky' : '';
  const g = groupOf(list, i), gEnd = (list.groups[list.groups.indexOf(g) + 1] || { start: list.length }).start;
  p.hud.pcat.textContent = `${g.label}  ·  ${i - g.start + 1} / ${gEnd - g.start}`;
  p.hud.ptitle.textContent = name + now;
  p.hud.paction.textContent = `${actionKey(p)}: ${what}`;
}
// Fill the carousel cells around the current item.
function renderCarousel(p) {
  const list = listOf(p), i = p.cur[listKey(p)], half = (p.hud.carCells.length - 1) / 2;
  p.hud.carCells.forEach((cell, k) => {
    const off = k - half, item = list[(i + off + list.length * 10) % list.length];
    const img = cell.firstChild;
    const show = off !== 0 || item.sky; // the centre shows the 3D cube instead, except for skies
    if (show && img.getAttribute('src') !== item.icon) img.src = item.icon;
    img.style.visibility = show ? 'visible' : 'hidden';
    cell.title = item.sky ? item.name : blockById(item.id).name;
  });
  p.hud.carousel.classList.toggle('sky', p.palTab === 'sky');
  updatePalTitle(p);
}
function setPalTab(p, tab) {
  p.palTab = tab;
  p.hud.tabBtns.forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  layoutCarousel(p);
  renderCarousel(p);
}
function cycleTab(p, d) { setPalTab(p, PAL_TABS[(PAL_TABS.indexOf(p.palTab) + d + PAL_TABS.length) % PAL_TABS.length]); }

function openPalette(p) {
  const bi = BLOCK_LIST.findIndex(b => b.id === p.selected); if (bi >= 0) p.cur.blocks = bi;
  const si = SKY_LIST.findIndex(s => s.skyId === currentSky); if (si >= 0) p.cur.sky = si;
  p.palOpen = true; p.palNavT = 0;
  p.hud.pal.hidden = false;
  p.hud.root.classList.add('menu');
  if (p.slot === 0) document.body.classList.add('palopen'); // hides the touch buttons so they don't cover the menu
  p.hud.phelp.textContent = p.gamepadIndex !== null ? 'LB / RB: tab · ← →: browse · ↑ ↓: category · LT / RT: jump 10 · B: close'
    : isTouch ? 'Swipe to browse · tap a side block to move to it · tap the middle to use it'
    : '← →: browse · ↑ ↓: category · [ / ]: tab · mouse wheel scrolls · Tab: close';
  if (p.slot === 0 && document.pointerLockElement) { paletteUnlock = true; document.exitPointerLock(); }
  setPalTab(p, p.palTab || 'hotbar');
}
function closePalette(p) {
  p.palOpen = false;
  p.hud.pal.hidden = true;
  p.hud.root.classList.remove('menu');
  p.pvRect = null;
  if (p.slot === 0) document.body.classList.remove('palopen');
  selectSlot(p, p.favIdx);
  if (p.slot === 0 && paletteUnlock) { paletteUnlock = false; relocking = true; requestLock(); }
}
// A / Enter / tapping the middle: do what the current tab says.
function applyPalette(p) {
  const item = curItem(p); if (!item) return;
  if (p.palTab === 'hotbar') { p.favs[p.favIdx] = item.id; saveHotbar(p); closePalette(p); return; }
  if (p.palTab === 'ground') setGround(item.id, true); // the title shows "✓ current ground" instead of a pop-up
  else setSky(item.skyId, true);
  rumble(p, 0.2, 0.3, 60);
  updatePalTitle(p);
}
// Move by `d` items, or by whole categories when `byGroup` is set.
function movePalette(p, d, byGroup) {
  const list = listOf(p), key = listKey(p);
  let i = p.cur[key];
  if (byGroup) {
    const gi = list.groups.indexOf(groupOf(list, i));
    i = list.groups[(gi + d + list.groups.length) % list.groups.length].start;
  } else i = (i + d + list.length * 10) % list.length;
  p.cur[key] = i;
  renderCarousel(p);
}
let paletteUnlock = false, relocking = false;

// Size the carousel to the screen; the 3D preview is drawn into the centre cell each frame.
function layoutCarousel(p) {
  const { root, carousel, carCells } = p.hud;
  const vr = root.getBoundingClientRect();
  const sc = parseFloat(getComputedStyle(root).getPropertyValue('--s')) || 1;
  const sky = p.palTab === 'sky';
  const center = Math.round(Math.min(200 * sc, vr.height * 0.32, vr.width * (isTouch ? 0.34 : 0.22)));
  const half = (carCells.length - 1) / 2, gap = Math.max(4, Math.round(6 * sc));
  let total = 0;
  carCells.forEach((cell, k) => {
    const dist = Math.abs(k - half), sz = Math.round(center * CAR_SCALE[Math.min(dist, CAR_SCALE.length - 1)]);
    const w = sky ? sz * 2 : sz;
    Object.assign(cell.style, { width: `${w}px`, height: `${sz}px`, opacity: String(dist === 0 ? 1 : Math.max(0.35, 1 - dist * 0.16)) });
    total += w + gap;
    cell.dataset.w = w;
  });
  // Hide the outer cells that don't fit the width.
  let used = total;
  for (let d = half; d > 0 && used > vr.width - 24; d--) {
    for (const k of [half - d, half + d]) { const c = carCells[k]; if (c.style.display !== 'none') { used -= Number(c.dataset.w) + gap; c.style.display = 'none'; } }
  }
  for (let d = 0; d <= half; d++) {
    const fits = carCells.slice(half - d, half + d + 1).reduce((a, c) => a + Number(c.dataset.w) + gap, 0) <= vr.width - 24;
    if (fits) { carCells[half - d].style.display = ''; carCells[half + d].style.display = ''; }
  }
  carousel.style.gap = `${gap}px`;
  requestAnimationFrame(() => { // measure once laid out
    const r = carCells[half].getBoundingClientRect();
    p.pvRect = sky ? null : { x: r.left + 3, y: r.top + 3, size: Math.min(r.width, r.height) - 6 };
  });
}
const pvScene = new THREE.Scene();
pvScene.background = new THREE.Color(0x1a2130);
pvScene.add(new THREE.HemisphereLight(0xf2f6ff, 0x3a3a44, 1.3));
{ const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(0.6, 1, 0.8); pvScene.add(d); }
const pvCam = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
pvCam.position.set(0, 0.9, 3.3); pvCam.lookAt(0, 0, 0);
const pvMesh = new THREE.Mesh(boxGeo, []);
pvScene.add(pvMesh);
function renderPreviews(now) {
  for (const p of locals) {
    const item = p.palOpen && p.pvRect && curItem(p);
    if (!item || item.sky) continue;
    const { x, y, size } = p.pvRect;
    const px = Math.round(x), py = Math.round(innerHeight - y - size), ps = Math.round(size);
    pvMesh.material = blockMats(blockById(item.id));
    pvMesh.rotation.set(0, now * 0.0008, 0);
    renderer.setViewport(px, py, ps, ps);
    renderer.setScissor(px, py, ps, ps);
    renderer.render(pvScene, pvCam);
  }
}


function freeSlot() { for (let s = 0; s < CFG.maxLocalPlayers; s++) if (!locals.some(p => p.slot === s)) return s; return -1; }
function addLocal() {
  const slot = freeSlot(); if (slot < 0) return null;
  const host = locals[0];
  let pos = new THREE.Vector3(0.5, 0, 4.5), yaw = 0;
  if (host) {
    yaw = host.yaw;
    pos = host.pos.clone().add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(1.5 * slot));
    for (let tries = 0; tries < 20 && collidesAt(pos.x, pos.y, pos.z); tries++) pos.y += 1;
  }
  const p = new LocalPlayer(slot, pos, yaw);
  locals.push(p); locals.sort((a, b) => a.slot - b.slot);
  layoutViewports();
  return p;
}
function removeLocal(p) {
  if (p.horse) dismount(p);
  p.dispose();
  locals.splice(locals.indexOf(p), 1);
  layoutViewports();
}

// Screen regions. Two players: side by side (default) or top/bottom (View button / V key).
let splitMode = 'v';
function layoutViewports() {
  const W = innerWidth, H = innerHeight, n = locals.length;
  let rects;
  if (n <= 1) rects = [[0, 0, 1, 1]];
  else if (n === 2) rects = splitMode === 'h' ? [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] : [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]];
  else rects = [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
  locals.forEach((p, i) => {
    const [fx, fy, fw, fh] = rects[i];
    const x = Math.round(fx * W), y = Math.round(fy * H);
    const w = Math.round((fx + fw) * W) - x, h = Math.round((fy + fh) * H) - y;
    p.vp = { x, y, w, h };
    const st = p.hud.root.style;
    st.left = x + 'px'; st.top = y + 'px'; st.width = w + 'px'; st.height = h + 'px';
    st.setProperty('--s', Math.max(0.75, Math.min(2.6, Math.min(w / 1500, h / 640))).toFixed(3));
  });
  document.body.classList.toggle('split', n > 1);
}
function toggleSplit() {
  splitMode = splitMode === 'h' ? 'v' : 'h';
  layoutViewports();
  toast(splitMode === 'h' ? 'Split screen: top / bottom' : 'Split screen: side by side');
}

// Resolution: full res up to 4K width, lowered automatically if the frame rate drops.
let maxPR = 1, pr = 1;
function resetResolution() {
  maxPR = Math.max(0.5, Math.min(devicePixelRatio || 1, 2, CFG.maxRenderWidth / innerWidth));
  pr = maxPR;
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
}
resetResolution();
addEventListener('resize', () => { resetResolution(); layoutViewports(); for (const p of locals) if (p.palOpen) layoutCarousel(p); });

const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg; toastEl.style.opacity = 1;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, 2200);
}

window.Game = { world, net, players: remotePlayers, locals, BLOCKS, CFG, renderer, scene, castle, get horses() { return horses; }, get player() { return locals[0]; } };

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------
const bodyR = p => (p.horse ? CFG.horseRadius : CFG.radius);
const bodyH = p => (p.horse ? CFG.horseHeight : CFG.height);
function collidesAt(x, y, z, r = CFG.radius, h = CFG.height) {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r - 1e-6);
  const y0 = Math.floor(y), y1 = Math.floor(y + h - 1e-6);
  const z0 = Math.floor(z - r), z1 = Math.floor(z + r - 1e-6);
  for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) for (let iz = z0; iz <= z1; iz++)
    if (world.isSolid(ix, iy, iz)) return true;
  return false;
}
function moveAxis(p, axis, d) {
  const pos = p.pos, old = pos[axis];
  pos[axis] += d;
  const r = bodyR(p), h = bodyH(p);
  if (!collidesAt(pos.x, pos.y, pos.z, r, h)) return false;
  // Snap flush against the obstacle instead of stopping short.
  if (axis === 'y') pos.y = d < 0 ? Math.floor(pos.y) + 1 : Math.floor(pos.y + h) - h - 1e-4;
  else pos[axis] = d > 0 ? Math.floor(pos[axis] + r) - r - 1e-4 : Math.floor(pos[axis] - r) + 1 + r + 1e-4;
  if (collidesAt(pos.x, pos.y, pos.z, r, h)) pos[axis] = old;
  return true;
}
// Try to climb a one-block ledge: rise one block, then retry the horizontal move.
function stepUp(p, axis, d) {
  const pos = p.pos, ox = pos.x, oy = pos.y, oz = pos.z;
  const y = Math.floor(oy + 1e-3) + 1;
  const r = bodyR(p), h = bodyH(p);
  if (collidesAt(ox, y, oz, r, h)) return false;
  pos.y = y; pos[axis] += d;
  if (collidesAt(pos.x, pos.y, pos.z, r, h)) { pos.x = ox; pos.y = oy; pos.z = oz; return false; }
  p.stepY -= y - oy;
  return true;
}
function blockOverlapsAnyPlayer(x, y, z) {
  return locals.some(q => {
    const p = q.pos, r = bodyR(q);
    return !q.vehicle && x < p.x + r && x + 1 > p.x - r && z < p.z + r && z + 1 > p.z - r && y < p.y + bodyH(q) && y + 1 > p.y;
  });
}

// ---------------------------------------------------------------------------
// Block targeting (voxel DDA raycast; the ground counts as solid below y=0)
// ---------------------------------------------------------------------------
const dirV = new THREE.Vector3();
function raycast(cam) {
  cam.getWorldDirection(dirV);
  const o = cam.position;
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const dx = dirV.x, dy = dirV.y, dz = dirV.z;
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
  let tx = dx ? (sx > 0 ? x + 1 - o.x : o.x - x) * tdx : Infinity;
  let ty = dy ? (sy > 0 ? y + 1 - o.y : o.y - y) * tdy : Infinity;
  let tz = dz ? (sz > 0 ? z + 1 - o.z : o.z - z) * tdz : Infinity;
  let n = [0, 0, 0], t = 0;
  while (t <= CFG.reach) {
    if (world.isSolid(x, y, z)) return { x, y, z, n };
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
  }
  return null;
}
function placeBlock(p) {
  const t = p.target; if (!t) return;
  const x = t.x + t.n[0], y = t.y + t.n[1], z = t.z + t.n[2];
  if (y < 0 || world.get(x, y, z) || blockOverlapsAnyPlayer(x, y, z)) return;
  const id = facedId(p.selected, facingVariant(p.yaw));
  if (world.set(x, y, z, id)) rumble(p, 0.15, 0.35, 45);
}
function breakBlock(p) {
  const t = p.target; if (!t || t.y < 0) return;
  if (world.set(t.x, t.y, t.z, 0)) rumble(p, 0.4, 0.2, 70);
}


// ---------------------------------------------------------------------------
// Vehicles. Look at a Steering Wheel block and press A (or E) to drive everything connected to it.
// While driving, the blocks leave the world and move as one group; getting out (B / E) parks them
// back onto the block grid, snapped to the nearest quarter turn.
// ---------------------------------------------------------------------------
function facingVariant(yaw) {
  const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 1 : 3;
  return dz < 0 ? 0 : 2;
}
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function connectedBlocks(x, y, z) {
  const seen = new Set([keyOf(x, y, z)]), out = [], stack = [[x, y, z]];
  while (stack.length) {
    const [cx, cy, cz] = stack.pop();
    out.push([cx, cy, cz, world.get(cx, cy, cz)]);
    if (out.length > CFG.maxVehicleBlocks) return null;
    for (const [dx, dy, dz] of N6) {
      const nx = cx + dx, ny = cy + dy, nz = cz + dz, k = keyOf(nx, ny, nz);
      if (ny < 0 || seen.has(k)) continue;
      seen.add(k);
      if (world.get(nx, ny, nz)) stack.push([nx, ny, nz]);
    }
  }
  return out;
}
// Rotate (x, z) by yaw the same way THREE rotates around +y.
const rotX = (x, z, c, s) => x * c + z * s;
const rotZ = (x, z, c, s) => -x * s + z * c;

function enterVehicle(p, t) {
  const cells = connectedBlocks(t.x, t.y, t.z);
  if (!cells) { toast(`Too big to drive (max ${CFG.maxVehicleBlocks} blocks). Is it touching a building?`); return; }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, y, z] of cells) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  const pos = new THREE.Vector3((minX + maxX + 1) / 2, minY, (minZ + maxZ + 1) / 2);
  const dir = world.get(t.x, t.y, t.z) - WHEEL_ID;
  const rel = cells.map(([x, y, z, id]) => ({ x: x + 0.5 - pos.x, y: y - minY, z: z + 0.5 - pos.z, id }));
  for (const [x, y, z] of cells) world.set(x, y, z, 0);

  // Build the moving model: one instanced mesh per block type.
  const group = new THREE.Group();
  const byId = new Map();
  for (const c of rel) { if (!byId.has(c.id)) byId.set(c.id, []); byId.get(c.id).push(c); }
  for (const [id, list] of byId) {
    const m = new THREE.InstancedMesh(boxGeo, blockMats(blockById(id)), list.length);
    list.forEach((c, i) => { tmpM.makeTranslation(c.x, c.y + 0.5, c.z); m.setMatrixAt(i, tmpM); });
    group.add(m);
  }
  group.position.copy(pos);
  scene.add(group);

  const [fx, fz] = FORWARD[dir];
  const wheel = { x: t.x + 0.5 - pos.x, y: t.y - minY, z: t.z + 0.5 - pos.z };
  let radius = 0; for (const c of rel) radius = Math.max(radius, Math.hypot(c.x, c.z));
  p.vehicle = {
    rel, group, pos, dir, yaw: 0, speed: 0, fallT: 0, radius,
    seat: { x: wheel.x - fx, y: wheel.y, z: wheel.z - fz },
    camYaw: 0, camPitch: 0.32, camPos: null,
  };
  p.vel.set(0, 0, 0);
  p.highlight.visible = false;
  p.camera.layers.enable(AVATAR_LAYER + p.slot); // see yourself in the driver's seat
  toast(p.gamepadIndex !== null ? 'Driving: RT gas, LT brake / reverse, B to get out'
    : isTouch ? 'Driving: D-pad to drive and steer, JUMP to brake' : 'Driving: W / S, A / D to steer, Space brake, E to get out');
  rumble(p, 0.5, 0.5, 150);
}

function vehicleBlocked(v, px, py, pz, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (const r of v.rel) {
    const x = Math.floor(px + rotX(r.x, r.z, c, s)), z = Math.floor(pz + rotZ(r.x, r.z, c, s));
    if (world.isSolid(x, Math.round(py) + r.y, z)) return true;
  }
  // Don't drive through other players standing around.
  for (const q of locals) {
    if (q.vehicle) continue;
    const lx = q.pos.x - px, lz = q.pos.z - pz;
    const ux = rotX(lx, lz, c, -s), uz = rotZ(lx, lz, c, -s); // into the vehicle's frame
    for (const r of v.rel) if (Math.abs(ux - r.x) < 0.8 && Math.abs(uz - r.z) < 0.8 && q.pos.y < py + r.y + 1 && q.pos.y + CFG.height > py + r.y) return true;
  }
  return false;
}
function vehicleSupported(v, px, py, pz, yaw) {
  if (py <= 0) return true;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (const r of v.rel) {
    if (r.y !== 0) continue;
    if (world.isSolid(Math.floor(px + rotX(r.x, r.z, c, s)), Math.round(py) - 1, Math.floor(pz + rotZ(r.x, r.z, c, s)))) return true;
  }
  return false;
}

function driveVehicle(p, dt, throttle, steer, brake, lookX, lookY) {
  const v = p.vehicle;
  // Speed: throttle toward a target speed; pushing against the motion brakes hard.
  const target = throttle >= 0 ? throttle * CFG.carMaxSpeed : throttle * CFG.carReverseSpeed;
  let a;
  if (brake) a = -Math.sign(v.speed) * CFG.carBrake;
  else if (Math.abs(throttle) > 0.05) a = Math.sign(target - v.speed) * ((v.speed * target < 0 || Math.abs(target) < Math.abs(v.speed)) ? CFG.carBrake : CFG.carAccel);
  else a = -Math.sign(v.speed) * CFG.carDrag;
  const before = v.speed;
  v.speed += a * dt;
  if ((brake || Math.abs(throttle) <= 0.05) && Math.sign(v.speed) !== Math.sign(before)) v.speed = 0;
  if (Math.abs(throttle) > 0.05 && !brake && Math.sign(target - before) !== Math.sign(target - v.speed)) v.speed = target;

  // Steering grows with speed, then eases off at high speed.
  const grip = Math.min(1, Math.abs(v.speed) / 6) / (1 + Math.abs(v.speed) / 60);
  const newYaw = v.yaw - steer * CFG.carTurn * grip * Math.sign(v.speed || 1) * dt;
  const [f0x, f0z] = FORWARD[v.dir];
  const c = Math.cos(newYaw), s = Math.sin(newYaw);
  const fx = rotX(f0x, f0z, c, s), fz = rotZ(f0x, f0z, c, s);
  const nx = v.pos.x + fx * v.speed * dt, nz = v.pos.z + fz * v.speed * dt;
  if (!vehicleBlocked(v, nx, v.pos.y, nz, newYaw)) { v.pos.x = nx; v.pos.z = nz; v.yaw = newYaw; }
  else if (!vehicleBlocked(v, v.pos.x, v.pos.y, v.pos.z, newYaw)) { v.yaw = newYaw; v.speed *= -0.25; rumble(p, 0.8, 0.6, 180); }
  else { v.speed *= -0.25; rumble(p, 0.8, 0.6, 180); }

  // Gravity, one block at a time (vehicles don't climb).
  if (!vehicleSupported(v, v.pos.x, v.pos.y, v.pos.z, v.yaw)) {
    v.fallT += dt;
    if (v.fallT > 0.05) { v.fallT = 0; if (!vehicleBlocked(v, v.pos.x, v.pos.y - 1, v.pos.z, v.yaw)) v.pos.y -= 1; }
  } else v.fallT = 0;

  v.group.position.copy(v.pos);
  v.group.rotation.y = v.yaw;

  // The driver sits behind the wheel.
  const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
  p.pos.set(v.pos.x + rotX(v.seat.x, v.seat.z, cy, sy), v.pos.y + v.seat.y, v.pos.z + rotZ(v.seat.x, v.seat.z, cy, sy));
  const heading = Math.atan2(-fx, -fz);
  p.yaw = heading; p.pitch = 0;

  // Chase camera; the right stick / mouse orbits it and it swings back behind when released.
  if (Math.abs(lookX) > 0.01) v.camYaw -= lookX * 2.6 * dt; else v.camYaw *= Math.exp(-dt * 1.5);
  v.camPitch = Math.max(0.05, Math.min(1.2, v.camPitch + lookY * 1.6 * dt));
  const camYaw = heading + v.camYaw;
  const dist = v.radius * 1.5 + 6;
  const want = new THREE.Vector3(
    v.pos.x + Math.sin(camYaw) * dist * Math.cos(v.camPitch),
    v.pos.y + 1.5 + dist * Math.sin(v.camPitch),
    v.pos.z + Math.cos(camYaw) * dist * Math.cos(v.camPitch));
  want.y = Math.max(0.6, want.y);
  if (!v.camPos) v.camPos = want.clone(); else v.camPos.lerp(want, 1 - Math.exp(-dt * 10));
  p.camera.position.copy(v.camPos);
  p.camera.lookAt(v.pos.x, v.pos.y + 1.6, v.pos.z);
  p.fovBoost = Math.min(1, Math.abs(v.speed) / CFG.carMaxSpeed);

  p.avatar.group.position.copy(p.pos);
  p.avatar.group.rotation.y = heading;
  p.avatar.head.rotation.x = 0;
}

// Park: snap to the grid at the nearest quarter turn, find free space nearby, write the blocks back.
function exitVehicle(p, force) {
  const v = p.vehicle;
  const q = Math.round(v.yaw / (Math.PI / 2));
  const c = Math.round(Math.cos(q * Math.PI / 2)), s = Math.round(Math.sin(q * Math.PI / 2));
  const rot = v.rel.map(r => ({ x: rotX(r.x, r.z, c, s), y: r.y, z: rotZ(r.x, r.z, c, s), id: r.id }));
  const y0 = Math.round(v.pos.y);
  const bx = Math.round(v.pos.x + rot[0].x - 0.5), bz = Math.round(v.pos.z + rot[0].z - 0.5);
  const ox0 = bx - (rot[0].x - 0.5), oz0 = bz - (rot[0].z - 0.5); // grid-aligned origin
  let cells = null;
  const tries = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  for (const [ox, oz] of tries) {
    const cand = rot.map(r => [Math.round(ox0 + ox + r.x - 0.5), y0 + r.y, Math.round(oz0 + oz + r.z - 0.5), r.id]);
    if (cand.every(([x, y, z]) => !world.isSolid(x, y, z) && !blockOverlapsAnyPlayer(x, y, z))) { cells = cand; break; }
  }
  if (!cells) {
    if (!force) { toast('No room to park here. Move away from walls and try again.'); return false; }
    cells = rot.map(r => [Math.round(ox0 + r.x - 0.5), y0 + r.y, Math.round(oz0 + r.z - 0.5), r.id]);
  }
  for (const [x, y, z, id] of cells) if (!world.get(x, y, z)) world.set(x, y, z, rotateId(id, q));

  scene.remove(v.group);
  v.group.children.forEach(m => m.dispose());
  p.vehicle = null;
  p.camera.layers.disable(AVATAR_LAYER + p.slot);

  // Step out beside the vehicle.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0;
  for (const [x, y, z] of cells) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); maxY = Math.max(maxY, y); }
  const midX = (minX + maxX + 1) / 2, midZ = (minZ + maxZ + 1) / 2;
  const spots = [[minX - 1, midZ], [maxX + 2, midZ], [midX, minZ - 1], [midX, maxZ + 2], [minX - 2, midZ], [maxX + 3, midZ]];
  const spot = spots.find(([x, z]) => !collidesAt(x, y0, z));
  if (spot) p.pos.set(spot[0], y0, spot[1]); else p.pos.set(midX, maxY + 1, midZ);
  p.vel.set(0, 0, 0);
  p.pitch = 0;
  rumble(p, 0.3, 0.2, 80);
  return true;
}
const targetIsWheel = p => p.target && p.target.y >= 0 && isWheel(world.get(p.target.x, p.target.y, p.target.z));
// Flying on / off. Landing inside something lifts you out on top of it.
function toggleFly(p) {
  p.flying = !p.flying;
  if (!p.flying) { for (let k = 0; k < 800 && collidesAt(p.pos.x, p.pos.y, p.pos.z, bodyR(p), bodyH(p)); k++) p.pos.y = Math.floor(p.pos.y) + 1; }
  else p.vel.set(0, 0, 0);
  if (p.slot === 0) document.getElementById('bFly')?.classList.toggle('on', p.flying);
  toast(p.flying ? (p.gamepadIndex !== null ? 'Flying: A up, B down, click the left stick to go fast, X to land'
    : isTouch ? 'Flying: steer by looking, JUMP to rise, FLY to land' : 'Flying: Space up, C down, hold Shift to go fast, F to land') : 'Landed');
}
function useAction(p) {
  if (p.vehicle) exitVehicle(p, false);
  else if (p.horse) dismount(p);
  else if (targetIsHorse(p)) mount(p);
  else if (targetIsWheel(p)) enterVehicle(p, p.target);
}

// ---------------------------------------------------------------------------
// Horses (js/horses.js): every player has their own horse, waiting beside the start.
// Walk up to one and press E / A (or tap the message) to ride; E / B to get off. It stays where you leave it.
// ---------------------------------------------------------------------------
const horses = new Horses({ scene, world });
const targetIsHorse = p => !p.horse && !p.vehicle && !!horses.near(p);
function mount(p) {
  const h = horses.near(p); if (!h) return;
  if (collidesAt(h.x, h.y, h.z, CFG.horseRadius, CFG.horseHeight)) { toast('No room to ride here'); return; }
  horses.mount(h, p.slot);
  const st = horses.steeds[p.slot];
  p.horse = true; p.pos.set(st.x, st.y, st.z); p.vel.set(0, 0, 0); p.yaw = st.yaw - Math.PI; p.pitch = 0;
  p.highlight.visible = false;
  const name = horses.nameOf(p.slot);
  toast(p.gamepadIndex !== null ? `Riding ${name}: A to jump, click the left stick to sprint, B to get off` : isTouch ? `Riding ${name}: tap the message to get off` : `Riding ${name}: Space to jump, Shift to sprint, E to get off`);
  rumble(p, 0.3, 0.4, 120);
}
function dismount(p) {
  if (!p.horse) return;
  p.horse = false;
  horses.dismount(p.slot);
  // Step off on the left (or right, front, back); if boxed in, stand on the saddle.
  const sx = Math.cos(p.yaw), sz = -Math.sin(p.yaw), fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const spots = [[-sx * 1.3, -sz * 1.3], [sx * 1.3, sz * 1.3], [-fx * 1.8, -fz * 1.8], [fx * 1.8, fz * 1.8]];
  const spot = spots.find(([dx, dz]) => !collidesAt(p.pos.x + dx, p.pos.y, p.pos.z + dz));
  if (spot) p.pos.set(p.pos.x + spot[0], p.pos.y, p.pos.z + spot[1]); else p.pos.y += 2;
  p.vel.set(0, 0, 0);
  rumble(p, 0.2, 0.2, 60);
}
// Never lose a car that's being driven when the page closes.
addEventListener('pagehide', () => { for (const p of locals) if (p.vehicle) exitVehicle(p, true); horses.saveAll(); clearTimeout(saveTimer); saveNow(); });

// ---------------------------------------------------------------------------
// Gamepads (Xbox layout / standard mapping)
//   Left stick move · Right stick look · A jump
//   RT place · LT remove (hold to repeat) · LB/RB change favourite slot · Y block palette
//   Menu pause · View switch split layout (side by side / top-bottom)
// ---------------------------------------------------------------------------
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
let padsNow = [];
const padPrev = new Map(); // per-gamepad previous button states (for press edges)
function padButtons(gp) { return gp.buttons.map(b => b.pressed || b.value > 0.5); }
function syncPads() {
  padsNow = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
  const alive = i => padsNow[i] && padsNow[i].connected;
  for (let i = locals.length - 1; i >= 0; i--) {
    const p = locals[i];
    if (p.gamepadIndex !== null && !alive(p.gamepadIndex)) {
      if (p.slot > 0) { toast(`Player ${p.slot + 1} controller disconnected`); removeLocal(p); }
      else p.gamepadIndex = null;
    }
  }
  for (const gp of padsNow) {
    if (!gp || !gp.connected || locals.some(p => p.gamepadIndex === gp.index)) continue;
    const p = locals.find(q => q.gamepadIndex === null) || (locals.length < CFG.maxLocalPlayers ? addLocal() : null);
    if (!p) continue;
    p.gamepadIndex = gp.index;
    padPrev.set(gp.index, padButtons(gp)); // ignore the button press that woke the controller
    toast(`Controller connected: Player ${p.slot + 1}`);
    rumble(p, 0.3, 0.3, 120);
  }
}
function rumble(p, strong, weak, ms) {
  const gp = p.gamepadIndex !== null && padsNow[p.gamepadIndex];
  const va = gp && gp.vibrationActuator;
  if (va && va.playEffect) va.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: weak, strongMagnitude: strong }).catch(() => {});
}
// Returns { now, pressed(i) } for a player's controller and advances its edge state.
function readPad(p) {
  const gp = p.gamepadIndex !== null ? padsNow[p.gamepadIndex] : null;
  if (!gp) return null;
  const now = padButtons(gp), prev = padPrev.get(gp.index) || [];
  padPrev.set(gp.index, now);
  return { gp, now, pressed: i => !!now[i] && !prev[i] };
}
function stick(x, y, dead) {
  const m = Math.hypot(x, y);
  if (m < dead) return [0, 0, 0];
  const s = Math.min(1, (m - dead) / (1 - dead));
  return [x / m * s, y / m * s, s];
}

// ---------------------------------------------------------------------------
// Keyboard / mouse / touch (player 1)
// ---------------------------------------------------------------------------
const keys = new Set();
let running = false;
const touchMove = { x: 0, y: 0 };
let touchJump = false;
let pointerLockFailed = false;

const overlay = document.getElementById('overlay');
const goText = document.getElementById('goText');
function requestLock() {
  if (isTouch || pointerLockFailed) return;
  try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* drag-to-look fallback */ }
}
function startPlaying(withMouse) {
  audioStart();
  overlay.classList.add('hidden');
  running = true;
  if (withMouse) requestLock();
}
function pause() {
  running = false;
  overlay.classList.remove('hidden');
  goText.textContent = isTouch ? 'Tap to resume' : 'Click or press A to resume';
  if (document.pointerLockElement) document.exitPointerLock();
}
goText.textContent = isTouch ? 'Tap to play' : 'Click or press A to play';
overlay.addEventListener('click', () => startPlaying(true));
overlay.addEventListener('touchend', e => { e.preventDefault(); startPlaying(false); });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) relocking = false; if (!document.pointerLockElement && running && !isTouch && !paletteUnlock) pause(); });
document.addEventListener('pointerlockerror', () => { if (relocking) { relocking = false; return; } pointerLockFailed = true; }); // e.g. sandboxed iframe: use drag-to-look

function look(p, dx, dy, sens) {
  if (p.vehicle) { p.vehicle.camYaw -= dx * sens; p.vehicle.camPitch = Math.max(0.05, Math.min(1.2, p.vehicle.camPitch + dy * sens)); return; }
  p.yaw -= dx * sens;
  p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch - dy * sens));
}

addEventListener('keydown', e => {
  if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
  keys.add(e.code);
  if (!running || !locals[0]) return;
  const p0 = locals[0];
  if (e.code === 'Tab' || e.code === 'KeyQ') { if (p0.palOpen) closePalette(p0); else if (!p0.vehicle) openPalette(p0); return; }
  if (p0.palOpen) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') movePalette(p0, -1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') movePalette(p0, 1);
    if (e.code === 'ArrowUp' || e.code === 'KeyW') movePalette(p0, -1, true);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') movePalette(p0, 1, true);
    if (e.code === 'PageUp') movePalette(p0, -10);
    if (e.code === 'PageDown') movePalette(p0, 10);
    if (e.code === 'Enter' || e.code === 'Space') applyPalette(p0);
    if (e.code === 'BracketLeft') cycleTab(p0, -1);
    if (e.code === 'BracketRight') cycleTab(p0, 1);
    if (e.code === 'Escape') closePalette(p0);
    if (/^Digit[1-9]$/.test(e.code)) { p0.favIdx = Number(e.code.slice(5)) - 1; renderHotbar(p0); updatePalTitle(p0); }
    return;
  }
  if (e.code === 'KeyV') toggleSplit();
  if (e.code === 'KeyF') toggleFly(locals[0]);
  if (e.code === 'KeyE') useAction(locals[0]);
  if (/^Digit[1-9]$/.test(e.code)) selectSlot(locals[0], Number(e.code.slice(5)) - 1);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

let dragging = false, dragMoved = 0, lastX = 0, lastY = 0;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  if (!running || isTouch) return;
  const p = locals[0];
  if (p.vehicle) return;
  if (p.palOpen) return; // clicks go to the menu
  if (document.pointerLockElement === canvas) { if (e.button === 0) breakBlock(p); if (e.button === 2) placeBlock(p); return; }
  if (!pointerLockFailed) { requestLock(); return; }
  // Fallback (no pointer lock): drag to look, click to act
  dragging = true; dragMoved = 0; lastX = e.clientX; lastY = e.clientY;
  if (e.button === 2) placeBlock(p);
});
addEventListener('mouseup', e => { if (dragging && e.button === 0 && dragMoved < 6) breakBlock(locals[0]); dragging = false; });
addEventListener('mousemove', e => {
  if (!running) return;
  if (document.pointerLockElement === canvas) look(locals[0], e.movementX, e.movementY, 0.0022);
  else if (dragging) { const dx = e.clientX - lastX, dy = e.clientY - lastY; dragMoved += Math.abs(dx) + Math.abs(dy); lastX = e.clientX; lastY = e.clientY; look(locals[0], dx, dy, 0.005); }
});
addEventListener('wheel', e => { if (running) cycleBlock(locals[0], e.deltaY > 0 ? 1 : -1); }, { passive: true });

// Touch: a fixed D-pad in the bottom-left moves (slide for diagonals); dragging anywhere else looks.
const dpad = document.getElementById('dpad');
let dpadId = null;
function dpadSet(t) {
  const r = dpad.getBoundingClientRect();
  const dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
  let x = 0, y = 0;
  if (Math.hypot(dx, dy) > r.width * 0.12) {
    const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); // 8 directions
    x = Math.round(Math.cos(a) * 100) / 100; y = Math.round(Math.sin(a) * 100) / 100;
  }
  touchMove.x = x; touchMove.y = y;
  dpad.classList.toggle('u', y < 0); dpad.classList.toggle('d', y > 0);
  dpad.classList.toggle('l', x < 0); dpad.classList.toggle('r', x > 0);
}
function dpadClear() { dpadId = null; touchMove.x = touchMove.y = 0; dpad.classList.remove('u', 'd', 'l', 'r'); }
dpad.addEventListener('touchstart', e => {
  e.preventDefault(); e.stopPropagation();
  const t = e.changedTouches[0]; dpadId = t.identifier; dpadSet(t);
}, { passive: false });
dpad.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) if (t.identifier === dpadId) dpadSet(t);
}, { passive: false });
const dpadEnd = e => { for (const t of e.changedTouches) if (t.identifier === dpadId) dpadClear(); };
dpad.addEventListener('touchend', dpadEnd);
dpad.addEventListener('touchcancel', dpadEnd);

const touches = new Map();
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) touches.set(t.identifier, { x: t.clientX, y: t.clientY });
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const s = touches.get(t.identifier); if (!s) continue;
    look(locals[0], t.clientX - s.x, t.clientY - s.y, 0.0055); s.x = t.clientX; s.y = t.clientY;
  }
}, { passive: false });
function endTouch(e) { for (const t of e.changedTouches) touches.delete(t.identifier); }
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);
function bindBtn(id, down, up) {
  const el = document.getElementById(id);
  el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false });
  el.addEventListener('touchend', e => { e.preventDefault(); up && up(); }, { passive: false });
}
bindBtn('bJump', () => { touchJump = true; }, () => { touchJump = false; });
bindBtn('bPlace', () => placeBlock(locals[0]));
bindBtn('bBreak', () => breakBlock(locals[0]));
bindBtn('bFly', () => toggleFly(locals[0]));
bindBtn('bPal', () => { const p = locals[0]; if (p.palOpen) closePalette(p); else if (!p.vehicle) openPalette(p); });

// ---------------------------------------------------------------------------
// Per-player update
// ---------------------------------------------------------------------------
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();

// Driving controls: RT gas, LT brake / reverse, left stick steer, right stick orbit camera, B get out.
// Keyboard: W / S, A / D, Space brake, mouse orbits, E get out.
function updateDriver(p, dt) {
  let throttle = 0, steer = 0, brake = false, lookX = 0, lookY = 0;
  if (p.slot === 0) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) throttle += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) throttle -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
    brake = keys.has('Space') || touchJump;
    throttle -= touchMove.y; steer += touchMove.x;
  }
  const pad = readPad(p);
  if (pad) {
    const { gp, now, pressed } = pad, ax = gp.axes;
    const trig = i => gp.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0;
    throttle += trig(PAD.RT) - trig(PAD.LT);
    steer += stick(ax[0] || 0, 0, 0.12)[0];
    const [rx, ry] = stick(ax[2] || 0, ax[3] || 0, 0.15);
    lookX = rx; lookY = ry;
    brake = brake || now[PAD.X];
    if (pressed(PAD.B) || pressed(PAD.Y)) { exitVehicle(p, false); return; }
    if (pressed(PAD.VIEW)) toggleSplit();
    if (pressed(PAD.MENU)) pause();
  }
  driveVehicle(p, dt, Math.max(-1, Math.min(1, throttle)), Math.max(-1, Math.min(1, steer)), brake, lookX, lookY);
  p.target = null;
  showUseHint(p);
  p.netT += dt;
  if (p.netT > 0.1) { p.netT = 0; net.onLocalPlayer({ x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: 0 }, p.slot); }
}

function updatePlayer(p, dt) {
  if (p.vehicle) { updateDriver(p, dt); return; }
  let mx = 0, mz = 0, jump = false, down = false;
  if (p.slot === 0) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    mx += touchMove.x; mz -= touchMove.y;
    jump = keys.has('Space') || touchJump;
    down = keys.has('KeyC') || keys.has('ControlLeft');
  }

  p.placeCd -= dt; p.breakCd -= dt;
  const pad = readPad(p);
  if (p.palOpen) {
    // Browsing the palette: the player stands still; stick / D-pad / LB RB move the cursor.
    mx = 0; mz = 0; jump = false;
    if (pad) {
      const { gp, pressed } = pad, ax = gp.axes;
      const [lx, ly] = stick(ax[0] || 0, ax[1] || 0, 0.4);
      if (pressed(PAD.LB)) cycleTab(p, -1);
      if (pressed(PAD.RB)) cycleTab(p, 1);
      // Left / right: one item (holding repeats, gently speeding up). Up / down: category. LT / RT: 10 items.
      let d = (pressed(PAD.RIGHT) ? 1 : 0) - (pressed(PAD.LEFT) ? 1 : 0);
      const dg = (pressed(PAD.DOWN) ? 1 : 0) - (pressed(PAD.UP) ? 1 : 0);
      p.palNavT -= dt;
      if (!d && Math.abs(lx) > Math.abs(ly) && lx) {
        if (p.palNavT <= 0) {
          d = Math.sign(lx);
          p.palHeld = p.palNavT < -0.5 ? 0 : (p.palHeld || 0) + 1;
          p.palNavT = p.palHeld === 0 ? 0.32 : p.palHeld < 6 ? 0.16 : 0.1;
        }
      } else if (Math.abs(ly) > Math.abs(lx) && ly) {
        if (p.palNavT <= 0) { movePalette(p, Math.sign(ly), true); p.palNavT = 0.4; }
      } else if (!lx && !ly) { p.palNavT = -1; p.palHeld = 0; }
      if (pressed(PAD.RT)) d += 10;
      if (pressed(PAD.LT)) d -= 10;
      if (d) movePalette(p, d);
      if (dg) movePalette(p, dg, true);
      if (pressed(PAD.A)) applyPalette(p);
      else if (pressed(PAD.B) || pressed(PAD.Y)) closePalette(p);
    }
  } else if (pad) {
    const { gp, now, pressed } = pad, ax = gp.axes;
    const [lx, ly] = stick(ax[0] || 0, ax[1] || 0, 0.15);
    mx += lx; mz -= ly;
    const [rx, ry, rm] = stick(ax[2] || 0, ax[3] || 0, 0.12);
    if (rm > 0) {
      const curve = Math.pow(rm, 1.8) / rm; // fine aim near the centre, fast turns at the edge
      p.yaw -= rx * curve * CFG.padYawSpeed * dt;
      p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch - ry * curve * CFG.padPitchSpeed * dt));
    }
    // A on a steering wheel gets in; otherwise A jumps.
    if (pressed(PAD.A) && targetIsHorse(p)) { mount(p); return; }
    if (pressed(PAD.A) && !p.horse && targetIsWheel(p)) { enterVehicle(p, p.target); return; }
    if (pressed(PAD.B) && p.horse && !p.flying) dismount(p);
    jump = jump || now[PAD.A];
    down = down || now[PAD.B];
    if (pressed(PAD.X)) toggleFly(p);
    if (pressed(PAD.Y)) { openPalette(p); return; }
    if (pressed(PAD.LB) || pressed(PAD.LEFT)) cycleBlock(p, -1);
    if (pressed(PAD.RB) || pressed(PAD.RIGHT)) cycleBlock(p, 1);
    // RT places, LT removes. Hold to repeat.
    if (now[PAD.RT]) { const first = pressed(PAD.RT); if (first || p.placeCd <= 0) { placeBlock(p); p.placeCd = first ? 0.32 : 0.16; } }
    if (now[PAD.LT]) { const first = pressed(PAD.LT); if (first || p.breakCd <= 0) { breakBlock(p); p.breakCd = first ? 0.32 : 0.16; } }
    if (pressed(PAD.VIEW)) toggleSplit();
    if (pressed(PAD.MENU)) pause();
  }
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }

  fwd.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  right.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
  // Gallop sprint: hold Shift, or click the left stick, while riding.
  p.sprint = !!p.horse && ((p.slot === 0 && (keys.has('ShiftLeft') || keys.has('ShiftRight'))) || (pad && pad.now[PAD.LS]));
  const speed = p.horse ? (p.sprint ? CFG.horseSprint : CFG.horseSpeed) : CFG.walkSpeed;
  wish.copy(fwd).multiplyScalar(mz).addScaledVector(right, mx).multiplyScalar(speed);

  const v = p.vel;
  if (p.flying) {
    // Flying: move the way you look (up and down too), Space / A rises, C / B sinks, through anything.
    const boost = (p.slot === 0 && (keys.has('ShiftLeft') || keys.has('ShiftRight'))) || (pad && pad.now[PAD.LS]);
    const fs = boost ? CFG.flyBoost : CFG.flySpeed, cp = Math.cos(p.pitch);
    wish.set(-Math.sin(p.yaw) * cp * mz + right.x * mx, Math.sin(p.pitch) * mz + (jump ? 1 : 0) - (down ? 1 : 0), -Math.cos(p.yaw) * cp * mz + right.z * mx);
    if (wish.lengthSq() > 1) wish.normalize();
    v.lerp(wish.multiplyScalar(fs), 1 - Math.exp(-dt * 5));
    p.pos.addScaledVector(v, dt);
    p.pos.y = Math.max(0, Math.min(3000, p.pos.y));
    p.onGround = false;
    p.fovBoost = Math.max(p.fovBoost, Math.min(1, v.length() / CFG.flyBoost));
  } else {
  const k = 1 - Math.exp(-dt * (p.onGround ? 16 : 5));
  v.x += (wish.x - v.x) * k; v.z += (wish.z - v.z) * k;
  v.y = Math.max(-60, v.y - CFG.gravity * dt);
  if (jump && p.onGround) { v.y = p.horse ? CFG.horseJump : CFG.jumpVelocity; p.onGround = false; }

  // Collide in small substeps so fast movement never tunnels through blocks.
  // Walking into a ledge one block high steps up onto it (so the castle's giant staircases can be climbed).
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt / 0.2));
  const sdt = dt / steps;
  let grounded = p.onGround;
  p.onGround = false;
  for (let i = 0; i < steps; i++) {
    if (moveAxis(p, 'x', v.x * sdt) && !(grounded && stepUp(p, 'x', v.x * sdt))) v.x = 0;
    if (moveAxis(p, 'z', v.z * sdt) && !(grounded && stepUp(p, 'z', v.z * sdt))) v.z = 0;
    const dy = v.y * sdt;
    if (moveAxis(p, 'y', dy)) { if (dy < 0) { p.onGround = grounded = true; } v.y = 0; }
    else if (dy !== 0) grounded = false;
  }
  }

  // Camera: head bob on the ground.
  const hs = Math.hypot(v.x, v.z);
  if (p.onGround && hs > 0.5) p.bob += dt * Math.min(hs, 16) * 0.9; else p.bob *= 0.9;
  const bobY = p.onGround ? Math.sin(p.bob * 2) * (p.horse ? 0.07 : 0.04) * Math.min(1, hs / 10) : 0;
  const cam = p.camera;
  p.stepY *= Math.exp(-dt * 14); // ease the camera up after a step instead of snapping
  cam.position.set(p.pos.x, p.pos.y + (p.horse ? CFG.horseEye : CFG.eyeHeight) + bobY + p.stepY, p.pos.z);
  cam.rotation.set(p.pitch, p.yaw, 0);
  p.fovBoost *= Math.exp(-dt * 6);
  if (p.horse) {
    // In the saddle: the view sways with the stride, widens at a sprint, and the hooves drum.
    cam.rotation.z = Math.sin(p.bob) * 0.014 * Math.min(1, hs / 18);
    if (p.sprint && hs > 20) p.fovBoost = Math.max(p.fovBoost, Math.min(1, (hs - 20) / 20));
    p.hoofT = (p.hoofT || 0) - dt;
    if (p.onGround && hs > 1 && p.hoofT <= 0) {
      const vol = p.slot === 0 ? 0.32 : 0.18;
      if (hs > 14) { const stride = Math.max(0.24, Math.min(0.6, 11 / hs)); [0, 0.07, 0.14].forEach((d, k) => hoof(vol * (k === 2 ? 1.15 : 0.9), 0.9 + k * 0.08, d)); p.hoofT = stride; }
      else { const stride = Math.max(0.3, Math.min(1.1, 5 / hs)); hoof(vol * 0.8, 1, 0); hoof(vol * 0.7, 1.1, stride / 2); p.hoofT = stride; }
    }
  }
  // Entering a room of the keep shows its name.
  const room = castle.roomAt(p.pos.x, p.pos.y + 1, p.pos.z);
  if (room !== p.roomName) { p.roomName = room; if (room && p.slot === 0) toast(room); }

  // Avatar (what the other players see), sitting in the saddle when riding
  p.avatar.group.position.copy(p.pos);
  if (p.horse) p.avatar.group.position.y += 0.95;
  p.avatar.group.rotation.y = p.yaw;
  p.avatar.head.rotation.x = p.pitch * 0.8;

  // Target block highlight
  p.target = raycast(cam);
  showUseHint(p);
  const t = p.target, hl = p.highlight;
  if (t) {
    hl.visible = true;
    if (t.y < 0) { hl.scale.set(1, 0.02, 1); hl.position.set(t.x + 0.5, 0.01, t.z + 0.5); }
    else { hl.scale.set(1, 1, 1); hl.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5); }
  } else hl.visible = false;

  p.netT += dt;
  if (p.netT > 0.1) { p.netT = 0; net.onLocalPlayer({ x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch }, p.slot); }
}

// Keep the camera's horizontal field of view about the same whatever shape its screen region is.
function fitCamera(p) {
  const aspect = p.vp.w / p.vp.h;
  const hHalf = Math.tan(THREE.MathUtils.degToRad(CFG.horizontalFov / 2));
  const vfov = Math.min(75, THREE.MathUtils.radToDeg(2 * Math.atan(hHalf / aspect)));
  p.camera.fov = vfov * (1 + 0.12 * p.fovBoost);
  p.camera.aspect = aspect;
  p.camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const info = document.getElementById('info');
let last = performance.now(), fpsT = 0, fpsN = 0, fps = 0, slowWin = 0, fastWin = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  syncPads();

  if (running) {
    for (const p of locals) updatePlayer(p, dt);
  } else {
    // Menu: any controller's A or Menu starts/resumes; keep edge state fresh.
    let go = false;
    for (const gp of padsNow) {
      if (!gp) continue;
      const nowB = padButtons(gp), prev = padPrev.get(gp.index) || [];
      if ((nowB[PAD.A] && !prev[PAD.A]) || (nowB[PAD.MENU] && !prev[PAD.MENU])) go = true;
      padPrev.set(gp.index, nowB);
    }
    if (go) startPlaying(false);
    for (const p of locals) {
      if (p.vehicle) continue;
      p.yaw += dt * 0.05;
      p.camera.position.set(p.pos.x, p.pos.y + (p.horse ? CFG.horseEye : CFG.eyeHeight), p.pos.z);
      p.camera.rotation.set(p.pitch, p.yaw, 0);
      p.highlight.visible = false;
    }
  }
  remotePlayers.update(dt);
  castle.update(dt, now / 1000);
  life.update(dt, now / 1000);
  if (locals[0]) horses.update(locals[0], dt, locals);
  for (const q of locals) if (q.horse) horses.ride(q, dt);

  // Render each player's region.
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  const H = innerHeight;
  for (const p of locals) {
    const { x, y, w, h } = p.vp;
    fitCamera(p);
    // Indoors the air turns dim and dusty; outdoors the haze follows the sky.
    p.inside += (castle.inside(p.camera.position.x, p.camera.position.y, p.camera.position.z) - p.inside) * (1 - Math.exp(-dt * 3));
    scene.fog.color.lerpColors(fogBase.color, FOG_INSIDE.color, p.inside);
    scene.fog.near = THREE.MathUtils.lerp(fogBase.near, FOG_INSIDE.near, p.inside);
    scene.fog.far = THREE.MathUtils.lerp(fogBase.far, FOG_INSIDE.far, p.inside);
    ground.position.set(Math.round(p.pos.x / groundTile) * groundTile, 0, Math.round(p.pos.z / groundTile) * groundTile);
    renderer.setViewport(x, H - y - h, w, h);
    renderer.setScissor(x, H - y - h, w, h);
    renderer.render(scene, p.camera);
  }
  renderPreviews(now);

  fpsN++; fpsT += dt;
  if (fpsT > 0.5) {
    fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0;
    // Dynamic resolution: drop when struggling, creep back up when there's headroom.
    if (running) {
      slowWin = fps < 50 ? slowWin + 1 : 0;
      fastWin = fps >= 58 ? fastWin + 1 : 0;
      if (slowWin >= 2 && pr > 0.5) { pr = Math.max(0.5, pr * 0.85); renderer.setPixelRatio(pr); slowWin = 0; }
      else if (fastWin >= 6 && pr < maxPR) { pr = Math.min(maxPR, pr * 1.08); renderer.setPixelRatio(pr); fastWin = 0; }
    }
    const lines = [`${fps} fps   ${Math.round(innerWidth * pr)}×${Math.round(innerHeight * pr)}`];
    for (const p of locals) lines.push(`P${p.slot + 1} ${p.vehicle ? `DRIVE ${Math.abs(p.vehicle.speed).toFixed(0)} b/s` : 'WALK'} ${p.gamepadIndex !== null ? '🎮' : '⌨'}  x ${p.pos.x.toFixed(0)} y ${p.pos.y.toFixed(0)} z ${p.pos.z.toFixed(0)}`);
    lines.push(`blocks ${world.blocks.size}   sky ${skyStatus}`);
    info.textContent = lines.join('\n');
  }
  requestAnimationFrame(frame);
}

loadSaved();
setSky(savedSky || 'kloofendal_48d_partly_cloudy_puresky', true);
try { const g = Number(localStorage.getItem('skyfield.ground')); if (g) setGround(g, true); } catch (e) { /* ignore */ }
addLocal();
addEventListener('gamepadconnected', () => { if (!running) goText.textContent = 'Press A to play'; });
requestAnimationFrame(frame);
