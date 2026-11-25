// Skyforge Labyrinth — an endless overgrown stone labyrinth full of castles, dungeons, caves and tunnels, each
// hiding treasure chests full of coins. Streamed in chunks built by worker threads (js/gen, js/engine).
// Built so multiplayer (e.g. Firebase Realtime Database) can be plugged in later via `window.Game.net`.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { POLYHAVEN } from './photo_textures.js';
import { SKIES } from './skies.js';
import { BLOCKS, BID, blockById, REMAP, texUrl, FRONT_FACE, T_SOLID, T_SHAPE, SHAPE } from './blocks.js';
import { World } from './engine/chunks.js';
import { BlockTextures } from './engine/textures.js';
import { Treasure } from './engine/treasure.js';
import { ExploreMap } from './engine/map.js';
import { DaySky } from './engine/sky.js';
import { FarStructures } from './engine/lod.js';
import { Gates } from './engine/gates.js';
import { makeAutoView, stepAutoView } from './engine/autoview.js';
import { OPENING, BOUGHT, STORY, ENDLESS } from './story.js';
import { KEY_ACTIONS, PAD_ACTIONS, PAD_NAMES, keyOf as boundKey, padOf, setKey, setPad, resetBinds, mapCode, mapPad, padIndex, keyLabel } from './engine/binds.js';
import { Music, TRACKS, audio, sfx } from './engine/music.js';
import { Inventory, GEAR, BLOCK_PACKS, chestBlocks, BUILD_MAX, HAMMER_LIFE, BUILDING, TORCH_TIME } from './engine/inventory.js';
import { regionPlan, RS } from './gen/maze.js';
import { GROUND, siteKey } from './gen/util.js';
import { floatingInfo } from './gen/castle.js';
import { deepInfo, biomeOf, DEEP_FLOOR, CAV_RX, CAV_RZ } from './gen/deep.js';
import { Motes } from './engine/motes.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const params = new URLSearchParams(location.search);
const CFG = {
  walkSpeed: 6,        // blocks / second
  jumpVelocity: 9.2,   // clears a 1-block step
  gravity: 28,
  eyeHeight: 1.62,
  height: 1.8,
  radius: 0.3,
  reach: 9,
  stepUp: 1.01,        // stairs, slabs and single blocks are walked up without jumping
  horizontalFov: 104,   // degrees, kept constant across split-screen shapes
  keyYawSpeed: 2.4,     // radians / second turning with the ← → keys
  padYawSpeed: 3.6,     // radians / second at full right-stick deflection
  padPitchSpeed: 2.6,
  maxRenderWidth: 3840,  // cap the drawing buffer at 4K width
  maxLocalPlayers: 4,
  seed: Number(params.get('seed')) || 1337,
  // View distance in blocks (10 to 1024). Past it the far view takes over: shrunk castles and the height-map labyrinth.
  viewBlocks: (v => (v > 32 ? v : v * 32))(Number(params.get('view')) || 4),
  get viewChunks() { return Math.max(2, Math.ceil(this.viewBlocks / 32) + 1); }, // chunk radius streamed in
  saveKey: 'skyforge.labyrinth.edits.v1',
  // Vehicles
  maxVehicleBlocks: 600,
  carMaxSpeed: 42,      // blocks / second
  carReverseSpeed: 12,
  carAccel: 16,
  carBrake: 45,
  carDrag: 5,
  carTurn: 1.9,         // radians / second at full lock
};
const VIEW_STEPS = [10, 16, 24, 32, 48, 64, 96, 128, 192, 256, 320, 384, 512, 640, 768, 1024];
CFG.viewBlocks = Math.max(10, Math.min(1024, CFG.viewBlocks));
try { const v = Number(localStorage.getItem('skyforge.view4')); if (v && !params.get('view')) CFG.viewBlocks = Math.max(10, Math.min(1024, v)); } catch (e) { /* ignore */ }
const viewStep = () => VIEW_STEPS.reduce((best, v, i) => (Math.abs(v - CFG.viewBlocks) < Math.abs(VIEW_STEPS[best] - CFG.viewBlocks) ? i : best), 0);
// The automatic view distance: from 32 blocks up to 384 (256 on phones); far enough for anyone, and the far view
// carries on beyond it.
// It always runs, behind the scenes: there is no slider to get wrong. (Only a ?view= in the address, used by the
// tests, pins the distance instead.)
const viewAuto = { on: !params.get('view'), ctl: null };
viewAuto.ctl = makeAutoView(VIEW_STEPS, VIEW_STEPS.indexOf(32), VIEW_STEPS.indexOf((matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) ? 256 : 384));

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
scene.fog = new THREE.Fog(0xd3dde8, 120, 950);

const hemi = new THREE.HemisphereLight(0xe4f0ff, 0x707070, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 1.7);
sun.position.set(0.45, 1, 0.3).normalize();
scene.add(sun);


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
    tex => { tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex; skyDome.visible = false; hasSkyHorizon = false; skyStatus = 'skybox (fallback)'; },
    undefined,
    () => { scene.background = gradientSky(); skyStatus = 'gradient (offline)'; });
}
// Choosable skies (all Poly Haven sky HDRIs, see js/skies.js). Lighting and haze follow the time of day.
const SKY_LIGHT = {
  day: { hemi: [0xe4f0ff, 0x707070, 1.15], sun: [0xfff1dc, 1.7], fog: [0xd3dde8, 120, 950] },
  sunset: { hemi: [0xffe6d8, 0x5a5058, 0.95], sun: [0xffc896, 0.95], fog: [0xbfb2bc, 110, 900] },
  night: { hemi: [0x8a9ad0, 0x22222e, 0.78], sun: [0xb0c0ff, 0.5], fog: [0x0b0f1c, 70, 650] },
};
const skyById = new Map(SKIES.map(([id, name, kind, pure]) => [id, { id, name, kind, pure }]));
let skyRequest = 0, currentSky = null, currentGround = null, skyKind = 'day';
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
  if (id === 'dynamic' || !skyById.get(id)) {
    ++skyRequest; currentSky = 'dynamic'; skyKind = 'dynamic'; skyStatus = 'day & night';
    daySky.mesh.visible = true; skyDome.visible = false; scene.background = null;
    if (!quiet) toast('Sky: day & night');
    return;
  }
  daySky.mesh.visible = false;
  const sky = skyById.get(id);
  const L = SKY_LIGHT[sky.kind];
  hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
  sun.color.set(L.sun[0]); sun.intensity = L.sun[1];
  scene.fog.color.set(L.fog[0]); scene.fog.near = L.fog[1]; scene.fog.far = L.fog[2];
  currentSky = sky.id; skyKind = sky.kind;
  const req = ++skyRequest;
  skyStatus = 'loading ' + sky.name;
  if (!quiet) toast(`Loading sky: ${sky.name}…`);
  const url = window.SKYFIELD_SKY_URL && req === 1 ? window.SKYFIELD_SKY_URL : `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/${sky.id}_2k.hdr`;
  const loader = /\.(jpe?g|png|webp)$/i.test(url) ? new THREE.TextureLoader() : new RGBELoader();
  loader.load(url, tex => {
    if (req !== skyRequest) { tex.dispose(); return; } // a newer choice won
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if (loader instanceof THREE.TextureLoader) tex.colorSpace = THREE.SRGBColorSpace;
    const old = skyUniforms.map.value;
    bgIntensity = skyIntensity(tex, sky.kind);
    const hz = horizonOf(tex);
    if (hz) {
      skyUniforms.map.value = tex; skyDome.visible = true; scene.background = null;
      // Haze a touch lighter and greyer than the sky right at the horizon.
      skyHorizon.copy(hz).multiplyScalar(bgIntensity).lerp(new THREE.Color(0.75, 0.78, 0.82).multiplyScalar(bgIntensity * 2.4), 0.25);
      hasSkyHorizon = true;
      if (old && old !== tex) old.dispose();
    } else { scene.background = tex; scene.backgroundIntensity = bgIntensity; skyDome.visible = false; hasSkyHorizon = false; }
    skyStatus = sky.name;
    if (!quiet) toast(`Sky: ${sky.name}`);
  }, undefined, () => { if (req === skyRequest && !skyDome.visible && !(scene.background && scene.background.isTexture)) loadCubeSky(); });
}
let bgIntensity = 1;
// The sky is drawn on a dome that follows the camera (the full sky picture, horizon included).
const skyUniforms = { map: { value: null }, intensity: { value: 1 }, horizon: { value: new THREE.Color(0xd3dde8) } };
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), new THREE.ShaderMaterial({
  uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  vertexShader: `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: `uniform sampler2D map; uniform float intensity; uniform vec3 horizon; varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
      vec3 c = texture2D(map, uv).rgb * intensity;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
skyDome.renderOrder = -10; skyDome.frustumCulled = false; skyDome.visible = false;
scene.add(skyDome);
// Everything far away (sky, distant labyrinth, distant castles) is drawn first in its own pass with a far-reaching
// camera, then the streamed world on top, so neither loses depth precision.
const FAR_LAYER = 12; // (layers 1-8 are the players' avatars and block highlights)
skyDome.layers.set(FAR_LAYER);
const daySky = new DaySky(scene);
const music = new Music(); // the soundtrack (see the Music panel below)
daySky.mesh.layers.set(FAR_LAYER); daySky.mesh.visible = false;
const farCam = new THREE.PerspectiveCamera(75, 1, 6, 16000);
farCam.layers.set(FAR_LAYER);
hemi.layers.enableAll(); sun.layers.enableAll(); // light both passes
const skyHorizon = new THREE.Color(0xd3dde8);
let hasSkyHorizon = false;
// Average colour of the sky picture in a band just above the horizon (linear, before intensity).
function horizonOf(tex) {
  const img = tex.image, data = img && img.data;
  if (!data || !img.width) return null;
  const half = data instanceof Uint16Array, f = v => (half ? THREE.DataUtils.fromHalfFloat(v) : v);
  let r = 0, g = 0, b = 0, n = 0;
  for (let row = Math.floor(img.height * 0.42); row < Math.floor(img.height * 0.48); row += 2)
    for (let x = 0; x < img.width; x += 8) { const o = (row * img.width + x) * 4; r += f(data[o]); g += f(data[o + 1]); b += f(data[o + 2]); n++; }
  return n ? new THREE.Color(r / n, g / n, b / n) : null;
}

// ---------------------------------------------------------------------------
// Block textures for the palette preview and driven vehicles (the world itself draws from a texture array).
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
// Materials (and their textures) are only created the first time a block is used.
function blockMats(b) {
  if (b.materials) return b.materials;
  const f = b.faces;
  const side = f.side || f.all, top = f.top || f.all, bottom = f.bottom || f.top || f.all;
  const extra = b.render === 'cutout' ? { alphaTest: 0.5 } : b.render === 'trans' ? { transparent: true, opacity: 0.8, depthWrite: false } : {};
  const make = path => b.bright ? new THREE.MeshBasicMaterial({ map: fileTex(path), ...extra })
    : new THREE.MeshLambertMaterial({ map: fileTex(path), ...extra });
  const ms = make(side), mt = top === side ? ms : make(top), mb = bottom === side ? ms : bottom === top ? mt : make(bottom);
  b.materials = [ms, ms, mt, mb, ms, ms];
  if (b.front) b.materials[FRONT_FACE[b.facing || 0]] = make(b.front);
  return b.materials;
}
const VIS = BLOCKS.filter(b => !b.hidden);           // everything selectable
// Palette: basics, photo-real blocks, Kenney pack, wool, Minetest blocks, plants, slabs.
// Flat lists for the carousel, each with category markers (groups: [{ label, start }]).
const BLOCK_LIST = [], SKY_LIST = [];
BLOCK_LIST.groups = []; SKY_LIST.groups = [];
const GROUP_LABEL = { kenney: 'Kenney pack', wool: 'Wool', minetest: 'Minetest blocks', plants: 'Plants & lights', slabs: 'Slabs' };
const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
const PHOTO_CAT_ORDER = ['grass', 'terrain', 'sand', 'gravel', 'snow', 'rock', 'cobblestone', 'sandstone', 'brick', 'concrete', 'plaster',
  'asphalt', 'tiles', 'floor', 'roofing', 'wall', 'wood', 'bark', 'metal', 'fabric', 'leather', 'moon', 'other'];
for (const g of [undefined, 'plants', 'slabs', 'photo', 'kenney', 'wool', 'minetest']) {
  const group = VIS.filter(b => b.group === g);
  const parts = g === 'photo'
    ? PHOTO_CAT_ORDER.map(c => group.filter(b => (PHOTO_CAT_ORDER.includes(b.cat) ? b.cat : 'other') === c).sort((a, b) => a.name.localeCompare(b.name)))
    : [group];
  parts.forEach(part => {
    if (!part.length) return;
    BLOCK_LIST.groups.push({ start: BLOCK_LIST.length, label: g === undefined ? 'Basics' : g === 'photo' ? `Photo · ${cap(PHOTO_CAT_ORDER.includes(part[0].cat) ? part[0].cat : 'other')}` : GROUP_LABEL[g] });
    BLOCK_LIST.push(...part);
  });
}

// (The sky is always the living day-and-night sky; there is no sky picker.)
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
// The world: streamed chunk columns drawn with the texture-array shader.
// ---------------------------------------------------------------------------
const G = 64; // labyrinth floor height (players walk at y = 64)
const textures = new BlockTextures(renderer);
const chunkUniforms = {
  time: { value: 0 }, dayColor: { value: new THREE.Color(1, 1, 1) }, torchColor: { value: new THREE.Color(1.0, 0.72, 0.42) },
  minLight: { value: 0.035 }, fogColor: { value: new THREE.Color(0xd3dde8) }, fogNear: { value: 120 }, fogFar: { value: 450 },
  sunColor: { value: new THREE.Color(0, 0, 0) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, clipInner: { value: 0 }, clipOuter: { value: 0 }, clipCenter: { value: new THREE.Vector2() }, haze: { value: 0.5 },
  heldLight: { value: new THREE.Vector4(0, -999, 0, 0) }, // a torch in your hand: position and strength
  glowColor: { value: new THREE.Color(1.0, 0.72, 0.42) }, caveFill: { value: new THREE.Color(0, 0, 0) }, // block light's colour; the deep's glow
};
const chunkMats = textures.makeMaterials(chunkUniforms);
// The distant castles share everything but the clip radius (they give way to the real chunks).
const lodUniforms = { ...chunkUniforms, clipInner: { value: 0 }, clipOuter: { value: 0 }, clipCenter: { value: new THREE.Vector2() } };
const lodMats = textures.makeMaterials(lodUniforms);
const treasure = new Treasure(scene);
const inv = new Inventory();
// The Treasure Compass left the shop: its owners get their 4,000 coins back.
if (inv.refund) { treasure.purse += inv.refund; treasure.save(); setTimeout(() => toast(`The Treasure Compass is gone from the shop: ${inv.refund.toLocaleString()} coins refunded`), 3000); inv.save(); }
const portals = new Map(); // portal openings in loaded chunks: key -> { box, dest }
const world = new World({
  scene, textures, materials: chunkMats, seed: CFG.seed,
  onColumn: c => { treasure.addColumn(c); exploreMap.onColumn(c); for (const q of c.portals) portals.set(q.slice(0, 3).join(','), { box: q.slice(0, 6), dest: { x: q[6], y: q[7], z: q[8], yaw: q[9], label: q[10] } }); },
  onUnload: c => { treasure.removeColumn(c); for (const q of c.portals) portals.delete(q.slice(0, 3).join(',')); },
});
// Conquered places: castles brought down (a flower meadow now) and dungeons, caves and mines sealed. The world is
// built that way from then on (util.js DONE, sent to the workers with every job); kept here.
const CONQ_KEY = `skyforge.conquered.${CFG.seed}`;
const conquered = (() => { try { const v = JSON.parse(localStorage.getItem(CONQ_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } })();
world.done = conquered.map(c => c.key);
function conquer(entry, box) {
  if (!conquered.some(c => c.key === entry.key)) conquered.push(entry);
  world.done = conquered.map(c => c.key);
  try { localStorage.setItem(CONQ_KEY, JSON.stringify(conquered)); } catch (e) { /* ignore */ }
  world.regen(box[0], box[1], box[2], box[3]);
  trails.plans.delete(entry.key); if (trails.site === entry.key) { trails.site = null; trails.shown = ''; treasure.setTrail([]); }
}

// Coin trails: every place with a final chest (a castle, sky or floating castle, a dungeon, caves or a mine) gets a
// trail of coins from where you come in to the nearest unopened chest; once that one's open, a new trail runs from it
// to the next, and so on to the final chest. A worker plans the tour (worker.js trailPlan) when you arrive.
const trails = { plans: new Map(), seq: 0, site: null, shown: '', t: 0 };
world.onTrail = m => {
  const p = trails.plans.get(m.site); if (!p || p.id !== m.id) return;
  if (m.error) { p.failed = performance.now(); return; } // (e.g. you were flying: try again in a few seconds)
  p.segs = m.segs; trails.shown = '';
};
// The place you're in, if it's one with a final chest.
function siteAt(x, y, z) {
  const rx = Math.floor(x / RS), rz = Math.floor(z / RS), plan = regionPlan(rx, rz, CFG.seed);
  // Down in a cavern region: the castle in the cavern (the tunnels round it count too).
  const d = deepInfo(plan);
  if (d && y < d.ceil + 2) { // (under a castle, its crypt is higher up)
    const box = [rx * RS, rz * RS, rx * RS + RS - 1, rz * RS + RS - 1], clr = [d.c.bx0, d.c.bz0, d.c.bx1, d.c.bz1];
    return { key: d.key, box, area: clr, under: true, clr, floor: DEEP_FLOOR, deep: true };
  }
  for (const c of plan.clearings) {
    if (!['castle', 'ruins', 'skycastle', 'floating'].includes(c.kind)) continue;
    let box = [c.bx0 - 8, c.bz0 - 8, c.bx1 + 8, c.bz1 + 8], area = [c.bx0, c.bz0, c.bx1, c.bz1];
    if (c.kind === 'floating') { const f = floatingInfo(plan); if (f) { const R = f.R + 8; box = [Math.min(box[0], f.cx - R), Math.min(box[1], f.cz - R), Math.max(box[2], f.cx + R), Math.max(box[3], f.cz + R)]; area = box; } }
    if (x >= box[0] && x <= box[2] && z >= box[1] && z <= box[3]) return { key: siteKey(c), box, area, under: false, clr: [c.bx0, c.bz0, c.bx1, c.bz1] };
  }
  const c = plan.under ? (plan.under === 'tunnels' && plan.type === 'spawn' ? plan.underEntrance : plan.main) : null;
  if (c && ((x >= c.bx0 - 4 && x <= c.bx1 + 4 && z >= c.bz0 - 4 && z <= c.bz1 + 4) || y < GROUND - 3)) {
    const box = [rx * RS, rz * RS, rx * RS + RS - 1, rz * RS + RS - 1];
    return { key: siteKey(c), box, area: box, under: true };
  }
  return null;
}
function updateTrails(dt) {
  trails.t -= dt; if (trails.t > 0) return; trails.t = 0.5;
  const p = locals[0]; if (!p || !p.ready || p.vehicle) return;
  const s = siteAt(p.pos.x, p.pos.y, p.pos.z);
  if (s && !world.done.includes(s.key)) {
    trails.site = s.key;
    const had = trails.plans.get(s.key);
    if (!had || (had.failed && performance.now() - had.failed > 4000)) {
      const id = ++trails.seq;
      trails.plans.set(s.key, { id, segs: null });
      world.requestTrail({ id, site: s.key, box: s.box, area: s.area, under: s.under, start: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, final: null, opened: [...treasure.opened] });
    }
  }
  // Show the stretch to the first chest of the tour that's still shut.
  const plan = trails.site && trails.plans.get(trails.site);
  let coins = [], sig = '';
  if (plan && plan.segs) { const k = plan.segs.findIndex(sg => !treasure.opened.has(sg.to)); if (k >= 0) { coins = plan.segs[k].coins; sig = `${trails.site}:${k}`; } }
  if (sig !== trails.shown) { trails.shown = sig; treasure.setTrail(coins); }
}

// Vehicles and the multiplayer hooks use world.set / get; local edits are saved and reported.
const worldSet = world.set.bind(world);
world.set = (x, y, z, id, source = 'local') => {
  id = REMAP.get(id) || id;
  const ok = worldSet(x, y, z, id);
  if (ok) exploreMap.onEdit(x, z);
  if (ok && source === 'local') { net.onLocalBlock(x, y, z, id); scheduleSave(); }
  return ok;
};
world.isSolid = (x, y, z) => world.solidAt(x, y, z);
const exploreMap = new ExploreMap(world, textures, treasure, CFG.seed);
exploreMap.isConquered = (x, z) => conquered.some(c => Math.hypot(c.x - x, c.z - z) < 45); // ticked on the map
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const tmpM = new THREE.Matrix4();
const keyOf = (x, y, z) => `${x},${y},${z}`;

// No distance fog on the surface, ever (underground still closes in and turns dark).
// One-time tidy-up: forget settings and saves from earlier versions that nothing reads any more (the old distance
// fog box, the photo sky picker, older view distance and hotbar saves, the old map store, the 2D prototype's world).
try {
  for (const k of ['skyforge.fog', 'skyforge.sky2', 'skyforge.view', 'skyforge.view2', 'skyforge.view3', 'skyforge.viewauto', 'skyforge.labyrinth.map.v1', 'skyforge2d.world.v1']) localStorage.removeItem(k);
  for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('skyforge.labyrinth.hotbar.v1.')) localStorage.removeItem(k); }
} catch (e) { /* storage blocked */ }
// Beyond the streamed chunks: the real labyrinth as a height map (from a worker), 4 km across. The far ground
// shader ray-marches it, so its walls stand up in 3D to the horizon; past it, plain ground.
const FAR = { size: 2048, scale: 2, x0: 0, z0: 0, req: 0, cx: null, cz: null };
const farUniforms = { map: { value: null }, origin: { value: new THREE.Vector2() }, extent: { value: FAR.size * FAR.scale }, texel: { value: FAR.scale }, center: { value: new THREE.Vector2() },
  inner: { value: 300 }, G: { value: G }, uVP: { value: new THREE.Matrix4() }, pixAngle: { value: 0.002 },
  dayColor: chunkUniforms.dayColor, sunColor: chunkUniforms.sunColor, sunDir: chunkUniforms.sunDir, fogColor: chunkUniforms.fogColor, fogNear: chunkUniforms.fogNear, fogFar: chunkUniforms.fogFar, haze: chunkUniforms.haze, steps: { value: isTouch ? 56 : 96 } };
const farMat = new THREE.ShaderMaterial({
  uniforms: farUniforms, glslVersion: THREE.GLSL3, side: THREE.DoubleSide,
  vertexShader: `out vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `precision highp float;
    layout(location = 0) out highp vec4 pc_fragColor;
    #define gl_FragColor pc_fragColor
    uniform sampler2D map; uniform vec2 origin, center; uniform float extent, texel, inner, fogNear, fogFar, G, pixAngle, haze; uniform int steps;
    uniform vec3 dayColor, sunColor, sunDir, fogColor; uniform mat4 uVP;
    in vec3 vW;
    void main() {
      vec3 ro = cameraPosition, rd = normalize(vW - ro);
      float TOP = G + 6.0;
      // The part of the ray inside the wall layer [G, G + 6], beyond the streamed chunks and inside the map.
      float tIn = 0.0, tOut = 1e9; bool toGround = false;
      if (abs(rd.y) > 1e-6) {
        float ta = (G - ro.y) / rd.y, tb = (TOP - ro.y) / rd.y;
        tIn = max(0.0, min(ta, tb)); tOut = max(ta, tb); toGround = rd.y < 0.0;
      } else if (ro.y < G || ro.y > TOP) discard;
      vec2 o = ro.xz - center, d2 = rd.xz;
      float a = max(dot(d2, d2), 1e-9), b = dot(o, d2), c = dot(o, o) - inner * inner, disc = b * b - a * c;
      float tR = disc > 0.0 ? (-b + sqrt(disc)) / a : 0.0;
      vec2 bmin = origin, bmax = origin + vec2(extent);
      float tx = rd.x > 0.0 ? (bmax.x - ro.x) / rd.x : rd.x < 0.0 ? (bmin.x - ro.x) / rd.x : 1e9;
      float tz = rd.z > 0.0 ? (bmax.y - ro.z) / rd.z : rd.z < 0.0 ? (bmin.y - ro.z) / rd.z : 1e9;
      float tBox = min(tx, tz);
      if (tBox < tOut) { tOut = tBox; toGround = false; }
      float t0 = max(tIn, tR), t1 = tOut;
      if (t0 >= t1) discard;
      // Walk the height map cell by cell (2 x 2 blocks each).
      vec3 p = ro + rd * (t0 + 0.001);
      vec2 g = (p.xz - origin) / texel;
      ivec2 cell = ivec2(floor(g));
      vec2 st = vec2(rd.x >= 0.0 ? 1.0 : -1.0, rd.z >= 0.0 ? 1.0 : -1.0);
      vec2 tDelta = vec2(texel / max(abs(rd.x), 1e-6), texel / max(abs(rd.z), 1e-6));
      vec2 nextB = (vec2(cell) + max(st, 0.0)) * texel + origin;
      vec2 tMax = vec2(abs(rd.x) > 1e-6 ? (nextB.x - ro.x) / rd.x : 1e9, abs(rd.z) > 1e-6 ? (nextB.y - ro.z) / rd.z : 1e9);
      float t = t0; int axis = -1; bool hit = false; vec3 nrm = vec3(0.0, 1.0, 0.0); vec4 v = vec4(0.0); float th = t1; float hTop = G;
      for (int i = 0; i < 96; i++) {
        if (i >= steps) break;
        v = texelFetch(map, cell, 0);
        float a255 = floor(v.a * 255.0 + 0.5);
        hTop = G + floor(a255 / 16.0);
        float tExit = min(min(tMax.x, tMax.y), t1);
        float yEnter = ro.y + rd.y * t, yExit = ro.y + rd.y * tExit;
        if (hTop > G && yEnter <= hTop) { hit = true; th = t; nrm = axis == 0 ? vec3(-st.x, 0.0, 0.0) : axis == 1 ? vec3(0.0, 0.0, -st.y) : vec3(0.0, 1.0, 0.0); break; }
        if (rd.y < 0.0 && yExit <= hTop + 0.001) { hit = true; th = (hTop - ro.y) / rd.y; nrm = vec3(0.0, 1.0, 0.0); break; }
        if (tExit >= t1) break;
        if (tMax.x < tMax.y) { cell.x += int(st.x); t = tMax.x; tMax.x += tDelta.x; axis = 0; }
        else { cell.y += int(st.y); t = tMax.y; tMax.y += tDelta.y; axis = 1; }
      }
      if (!hit) { if (!toGround) discard; th = t1; hTop = G; nrm = vec3(0.0, 1.0, 0.0); v = texelFetch(map, cell, 0); }
      vec3 hp = ro + rd * th;
      float a255 = floor(v.a * 255.0 + 0.5);
      bool wall = a255 >= 16.0, over = mod(a255, 16.0) >= 8.0;
      float lod = max(0.0, log2(max(th * pixAngle / texel, 1e-4)));
      vec3 base = textureLod(map, (vec2(cell) + 0.5) / vec2(textureSize(map, 0)), min(lod, 3.0) * 0.5).rgb;
      if (wall && nrm.y > 0.5) base = over ? vec3(0.07, 0.17, 0.045) + base * 0.12 : base * 0.95;
      else if (wall) base = mix(base, vec3(0.09, 0.15, 0.06), smoothstep(G + 2.6, G, hp.y) * 0.7);
      float shade = nrm.y > 0.5 ? 1.0 : abs(nrm.x) > 0.5 ? 0.82 : 0.7;
      // Toward the map's edge, blend into the plain ground beyond it.
      vec2 e = min(hp.xz - origin, origin + vec2(extent) - hp.xz);
      base = mix(vec3(0.075, 0.14, 0.035), base, smoothstep(0.0, extent * 0.12, min(e.x, e.y)));
      vec3 col = base * (dayColor * shade + sunColor * max(dot(nrm, sunDir), 0.0));
      col = mix(col, fogColor, max(smoothstep(fogNear, fogFar, th), haze * smoothstep(500.0, 6000.0, th)));
      vec4 cp = uVP * vec4(hp, 1.0);
      gl_FragDepth = clamp(cp.z / cp.w * 0.5 + 0.5, 0.0, 1.0);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const farMap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), farMat);
farMap.rotation.x = -Math.PI / 2; farMap.visible = false; farMap.renderOrder = -2; farMap.frustumCulled = false;
// A ring wall at the edge of the streamed chunks, so low views (inside the labyrinth) see the far walls too.
const farRing = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 160, 1, true), farMat);
farRing.visible = false; farRing.renderOrder = -2; farRing.frustumCulled = false;
farMap.layers.set(FAR_LAYER); farRing.layers.set(FAR_LAYER);
scene.add(farMap, farRing);
world.onFarMap = m => {
  if (m.id !== FAR.req) return;
  const t = new THREE.DataTexture(m.rgba, m.size, m.size, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  if (farUniforms.map.value) farUniforms.map.value.dispose();
  farUniforms.map.value = t;
  const ext = m.size * m.scale;
  farUniforms.origin.value.set(m.x0, m.z0); farUniforms.extent.value = ext;
  farMap.scale.set(ext, ext, 1); farMap.position.set(m.x0 + ext / 2, G, m.z0 + ext / 2);
  farMap.visible = true; farRing.visible = true;
};
function updateFarMap(p) {
  const ext = FAR.size * FAR.scale;
  if (FAR.cx !== null && Math.hypot(p.pos.x - FAR.cx, p.pos.z - FAR.cz) < ext * 0.2) return;
  FAR.cx = Math.round(p.pos.x / 64) * 64; FAR.cz = Math.round(p.pos.z / 64) * 64;
  world.requestFarMap(FAR.cx - ext / 2, FAR.cz - ext / 2, FAR.size, FAR.scale, ++FAR.req);
}
// Plain ground beyond the labyrinth map, out to the horizon.
const farGround = new THREE.Mesh(new THREE.RingGeometry(1, 12000, 64, 1), new THREE.ShaderMaterial({
  uniforms: farUniforms,
  vertexShader: `varying float vD; void main() { vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 dayColor, sunColor, sunDir, fogColor; uniform float fogNear, fogFar, haze; varying float vD;
    void main() {
      vec3 col = vec3(0.075, 0.14, 0.035) * (dayColor + sunColor * max(sunDir.y, 0.0));
      col = mix(col, fogColor, max(smoothstep(fogNear, fogFar, vD), haze * smoothstep(500.0, 6000.0, vD)));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
farGround.rotation.x = -Math.PI / 2;
farGround.position.y = G - 0.4;
farGround.layers.set(FAR_LAYER);
scene.add(farGround);
// Every castle and floating castle out to the horizon, built for real and shrunk.
const gates = new Gates(scene, world, CFG.seed, k => sfx(k)); // wrought-iron gates into the clearings
const farStructs = new FarStructures({ scene, world, textures, materials: lodMats, seed: CFG.seed, layer: FAR_LAYER });
const LOD_RADIUS = isTouch ? 1600 : 2400;
let lodT = 0;

// Edits are saved as "x,y,z,id" entries; the generated world itself never needs saving.
let saveTimer = 0;
function saveNow() {
  try {
    const arr = [];
    for (const [k, id] of world.edits) arr.push(k + ',' + id);
    localStorage.setItem(CFG.saveKey, arr.join(';'));
  } catch (e) { /* storage unavailable */ }
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 600); }
function loadSaved() {
  let s = null;
  try { s = localStorage.getItem(CFG.saveKey); } catch (e) { /* ignore */ }
  if (!s) return;
  for (const part of s.split(';')) {
    const [x, y, z, id] = part.split(',').map(Number);
    if (!Number.isFinite(id) || (id && !blockById(id))) continue;
    const key = `${x},${y},${z}`, ck = ((x >> 5) + 32768) * 65536 + ((z >> 5) + 32768);
    world.edits.set(key, id);
    if (!world.colEdits.has(ck)) world.colEdits.set(ck, new Map());
    world.colEdits.get(ck).set(key, id);
  }
}
// Where you start: in the courtyard, in front of the fountain, looking north up the first path.
function homeSpot() {
  const c = regionPlan(0, 0, CFG.seed).main;
  return { pos: new THREE.Vector3((c.bx0 + c.bx1 + 1) / 2, G, (c.bz0 + c.bz1 + 1) / 2 + 13), yaw: 0 };
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

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 4000);
    this.camera.rotation.order = 'YXZ';
    this.camera.layers.enableAll();
    this.camera.layers.disable(FAR_LAYER); // the far pass draws those
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
  if (p.zipAim) return; // aiming a zip anchor: that hint is showing
  const pad = p.gamepadIndex !== null, touch = isTouch && p.slot === 0 && !pad;
  const chest = !p.vehicle && targetIsChest(p);
  const opened = chest && treasure.isOpened(p.target.x, p.target.y, p.target.z);
  const use = !p.vehicle && !chest && targetIsUsable(p) ? p.target.id : 0;
  const state = p.vehicle ? (touch ? 'exit' : '') : chest ? (opened ? 'empty' : 'chest') : use === BID.Portal ? 'portal' : use === BID['Portal Stone'] ? 'stone' : use === BID['Zip Anchor'] ? 'zip' : targetIsWheel(p) ? 'drive' : '';
  const dest = state === 'portal' ? (portalAt(p.target.x, p.target.y, p.target.z) || { dest: {} }).dest.label || 'somewhere' : '';
  const key = state + dest + (state === 'empty' && (treasure.chestAt(p.target.x, p.target.y, p.target.z) || {}).home ? 'home' : '') + (pad ? 'pad' : touch ? 'touch' : 'key');
  if (key === p.hud.hintKey) return;
  p.hud.hintKey = key;
  const homeChest = state === 'empty' && (treasure.chestAt(p.target.x, p.target.y, p.target.z) || {}).home;
  const text = !state ? '' : state === 'exit' ? 'Tap here to get out' : homeChest ? `${pad ? 'Press A' : touch ? 'Tap here' : 'Press E'} to go back to the castle entrance` : state === 'empty' ? 'Empty chest ✓'
    : state === 'chest' ? (pad ? 'Press A to open the treasure chest' : touch ? 'Tap here to open' : 'Press E (or right click) to open the treasure chest')
    : state === 'portal' ? `${pad ? 'Press A' : touch ? 'Tap here' : 'Press E'} to travel to ${dest}`
    : state === 'stone' ? `${pad ? 'Press A' : touch ? 'Tap here' : 'Press E'} to step through your portal stone`
    : state === 'zip' ? `${pad ? 'Press A' : touch ? 'Tap here' : 'Press E'} to ride the zip line`
    : pad ? 'Press A to drive' : touch ? 'Tap here to drive' : 'Press E to drive';
  if (text) p.hud.hint.textContent = text;
  p.hud.hint.style.opacity = state ? 1 : 0;
  p.hud.hint.classList.toggle('tappable', !!state && touch && (state !== 'empty' || !!homeChest));
}
function makeHud(p) {
  const root = document.createElement('div');
  root.className = 'phud';
  const col = '#' + PLAYER_COLORS[p.slot].toString(16).padStart(6, '0');
  root.innerHTML = `<div class="tag" style="background:${col}">P${p.slot + 1}</div><div class="purse"><span class="coin"></span><b>0</b><em></em><u></u><span class="hammer" hidden title="Hammer: blocks left before it breaks"><i>🔨</i><s></s></span><span class="hammer torch" hidden title="Torch: time left, and torches you have"><i>🔥</i><s></s></span></div><canvas class="cstrip"></canvas><div class="cross"></div><div class="bname"></div><div class="hint"></div>`
    + `<div class="palette" hidden><div class="phead"><div class="ptabs">`
    + (PAL_TABS.length > 1 ? PAL_TABS.map(t => `<button type="button" data-tab="${t}">${TAB_LABEL[t]}</button>`).join('') : '')
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
    d.innerHTML = `<img alt=""><span>${i + 1}</span><b></b>`;
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
  return { cstrip: root.querySelector('.cstrip'), torch: root.querySelector('.purse .torch'), hammer: root.querySelector('.purse .hammer:not(.torch)'), gear: root.querySelector('.purse u'), purse: root.querySelector('.purse b'), purseInfo: root.querySelector('.purse em'), root, bar, pal, tabBtns, carousel, carCells, pcat: root.querySelector('.pcat'), paction: root.querySelector('.paction'), hintKey: '',  ptitle: root.querySelector('.ptitle'), phelp: root.querySelector('.phelp'), name: root.querySelector('.bname'), hint: root.querySelector('.hint'), nameTimer: 0 };
}

// Favourites hotbar: 9 slots per player, saved in the browser. LB / RB (or 1-9, mouse wheel) switch slots;
// the palette puts a block into the current slot.
const HOTBAR_SIZE = 9;
// Slots hold blocks you own (with how many you have); they start mostly empty.
// With building off, only gear goes on the hotbar: torches (held to light the way) and zip line / portal pieces.
const BUILDER = BID['Building Blocks'];
const GEAR_BLOCKS = new Set([BID['Old Letter'], BID.Torch, BID['Zip Anchor'], BID['Portal Stone'], BUILDER]);
const onBar = id => id && (BUILDING || GEAR_BLOCKS.has(id));
if (!BUILDING) document.body.classList.add('nobuild');
function loadHotbar(slot) {
  let ids = null;
  try { ids = JSON.parse(localStorage.getItem('skyforge.labyrinth.hotbar.v2.' + slot)); } catch (e) { /* ignore */ }
  if (!Array.isArray(ids) || ids.length !== HOTBAR_SIZE) ids = BUILDING ? [BID.Planks, BID['Mossy Cobblestone'], BID.Torch, 0, 0, 0, 0, 0, 0] : [BID['Old Letter'], BID.Torch, 0, 0, 0, 0, 0, 0, 0];
  ids = ids.map(id => (id && blockById(id) && !blockById(id).hidden && onBar(id) ? id : 0));
  if (!BUILDING) { for (const g of GEAR_BLOCKS) if (inv.count(g) && !ids.includes(g)) { const k = ids.indexOf(0); if (k >= 0) ids[k] = g; } }
  return ids;
}
function saveHotbar(p) { try { localStorage.setItem('skyforge.labyrinth.hotbar.v2.' + p.slot, JSON.stringify(p.favs)); } catch (e) { /* ignore */ } }
function renderHotbar(p) {
  [...p.hud.bar.children].forEach((el, i) => {
    const id = p.favs[i], n = id ? inv.count(id) : 0, b = n ? (id === BUILDER ? blockById(skinOf()) : blockById(id)) : null;
    const img = el.querySelector('img'), cnt = el.querySelector('b');
    if (b) { if (img.getAttribute('src') !== b.icon) img.src = b.icon; img.style.visibility = 'visible'; img.alt = b.name; el.title = `${b.name} ×${n}`; cnt.textContent = n; }
    else { img.style.visibility = 'hidden'; el.title = 'Empty'; cnt.textContent = ''; }
    el.classList.toggle('sel', i === p.favIdx);
  });
}
function selectSlot(p, i, quiet) {
  p.favIdx = (i + HOTBAR_SIZE) % HOTBAR_SIZE;
  renderHotbar(p);
  selectBlock(p, p.favs[p.favIdx], quiet);
  if (!quiet && p.slot === 0 && p.favs[p.favIdx] === LETTER) openReader(); // the villain's letters
}
const cycleBlock = (p, d) => selectSlot(p, p.favIdx + d);

function selectBlock(p, id, quiet) {
  p.selected = id && inv.count(id) ? id : 0;
  if (quiet) return;
  p.hud.name.textContent = p.selected ? `${blockById(id).name} ×${inv.count(id)}` : 'Empty slot';
  p.hud.name.style.opacity = 1;
  clearTimeout(p.hud.nameTimer); p.hud.nameTimer = setTimeout(() => { p.hud.name.style.opacity = 0; }, 1200);
}
function refreshHotbars() { for (const p of locals) { renderHotbar(p); p.selected = p.favs[p.favIdx] && inv.count(p.favs[p.favIdx]) ? p.favs[p.favIdx] : 0; } }
// New blocks go into an empty hotbar slot if they aren't on the bar already.
function giveBlocks(list) {
  for (const [id, n] of list) {
    if (!onBar(id)) continue; // building is off: no plain blocks
    inv.add(id, n);
    for (const p of locals) {
      if (p.favs.includes(id)) continue;
      const k = p.favs.findIndex(f => !f || !inv.count(f));
      if (k >= 0) { p.favs[k] = id; saveHotbar(p); }
    }
  }
  refreshHotbars();
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
const PAL_TABS = ['hotbar'];
const TAB_LABEL = { hotbar: 'Blocks', sky: 'Sky' };
const listKey = p => (p.palTab === 'sky' ? 'sky' : 'blocks');
// The Blocks tab lists only blocks you own.
let OWNED = [];
const BLOCK_GROUP = new Map(); BLOCK_LIST.forEach((b, i) => BLOCK_GROUP.set(b.id, groupOf(BLOCK_LIST, i).label));
// Looks for your building blocks: every block the world is made of (photo blocks, slabs, plants and lights, the
// basics), not the cartoon packs and not the special ones (chests, portals, the letter, torches, zip anchors...).
const NOT_SKIN = new Set(['Old Letter', 'Torch', 'Zip Anchor', 'Portal Stone', 'Building Blocks', 'Steering Wheel', 'Portal', 'Water Source', 'Lava Source'].map(n => BID[n]));
const SKIN_LIST = BLOCK_LIST.filter(b => b.group !== 'kenney' && b.group !== 'wool' && !NOT_SKIN.has(b.id) && !b.chest && !(b.variantOf && blockById(b.variantOf).chest) && b.shape !== 'liquid' && !isWheel(b.id));
SKIN_LIST.groups = [];
SKIN_LIST.forEach((b, i) => { const l = BLOCK_GROUP.get(b.id); if (!SKIN_LIST.groups.length || SKIN_LIST.groups[SKIN_LIST.groups.length - 1].label !== l) SKIN_LIST.groups.push({ start: i, label: l }); });
const skinOf = () => (inv.skin && blockById(inv.skin) ? inv.skin : (BID['photo:old_stone_wall'] || SKIN_LIST[0].id));
function ownedList() {
  const out = BLOCK_LIST.filter(b => inv.count(b.id) > 0);
  out.groups = [];
  out.forEach((b, i) => { const l = BLOCK_GROUP.get(b.id); if (!out.groups.length || out.groups[out.groups.length - 1].label !== l) out.groups.push({ start: i, label: l }); });
  return out;
}
const listOf = p => (p.palTab === 'sky' ? SKY_LIST : OWNED);
const curItem = p => listOf(p)[p.cur[listKey(p)]];
function groupOf(list, i) { let g = list.groups[0]; for (const x of list.groups) if (x.start <= i) g = x; return g; }
function actionKey(p) { return p.gamepadIndex !== null ? 'A' : isTouch ? 'Tap the middle' : 'Click the middle / Enter'; }
const CAR_SCALE = [1, 0.62, 0.5, 0.42, 0.36, 0.32]; // size of each cell by distance from the centre

function updatePalTitle(p) {
  const list = listOf(p), i = p.cur[listKey(p)], item = list[i]; if (!item) return;
  const name = item.sky ? item.name : BUILDING ? `${blockById(item.id).name}  ×${inv.count(item.id)}` : `${blockById(item.id).name}${item.id === skinOf() ? '  ✓' : ''}`;
  const what = !BUILDING ? `build with this look (${inv.count(BUILDER)} blocks)` : p.palTab === 'hotbar' ? `put it in slot ${p.favIdx + 1}` : p.palTab === 'ground' ? 'make it the ground' : 'use this sky';
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
  // Building is one stack of blocks: the carousel picks the look they're placed with.
  OWNED = BUILDING ? ownedList() : SKIN_LIST;
  if (!OWNED.length) { toast('No blocks yet: find them in treasure chests or buy them in the shop (B)'); return; }
  p.palTab = 'hotbar';
  p.cur.blocks = Math.max(0, Math.min(p.cur.blocks, OWNED.length - 1));
  const bi = OWNED.findIndex(b => b.id === (BUILDING ? p.selected : skinOf())); if (bi >= 0) p.cur.blocks = bi;
  p.palOpen = true; p.palNavT = 0;
  p.hud.pal.hidden = false;
  p.hud.root.classList.add('menu');
  if (p.slot === 0) document.body.classList.add('palopen'); // hides the touch buttons so they don't cover the menu
  p.hud.phelp.textContent = p.gamepadIndex !== null ? '← →: browse · ↑ ↓: category · LT / RT: jump 10 · B: close'
    : isTouch ? 'Swipe to browse · tap a side block to move to it · tap the middle to use it'
    : '← →: browse · ↑ ↓: category · mouse wheel scrolls · Q: close';
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
  if (!BUILDING) {
    // The new look for every building block; the stack goes on the hotbar (if it isn't) and gets selected.
    inv.skin = item.id; inv.save();
    let k = p.favs.indexOf(BUILDER);
    if (k < 0) { k = p.favs.findIndex(f => !f || !inv.count(f)); if (k < 0) k = p.favIdx; p.favs[k] = BUILDER; saveHotbar(p); }
    p.favIdx = k; refreshHotbars(); closePalette(p); sfx('click');
    return;
  }
  if (p.palTab === 'hotbar') { p.favs[p.favIdx] = item.id; saveHotbar(p); closePalette(p); return; }
  setSky(item.skyId, true);
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

// Map: M / D-pad down cycles corner map -> full-screen map -> off. The full map frees the mouse for dragging.
function toggleMap() {
  const wasFull = exploreMap.isFull;
  exploreMap.cycle(locals[0]);
  syncMapLock(wasFull);
}
function closeMap(to = 1) { if (!exploreMap.isFull) return; exploreMap.close(to); syncMapLock(true); }
function syncMapLock(wasFull) {
  const p0 = locals[0];
  document.body.classList.toggle('mapopen', exploreMap.isFull);
  if (exploreMap.isFull && !wasFull) {
    if (p0) { p0.vel.x = p0.vel.z = 0; }
    if (document.pointerLockElement) { paletteUnlock = true; document.exitPointerLock(); }
  } else if (!exploreMap.isFull && wasFull && paletteUnlock && !(p0 && p0.palOpen)) { paletteUnlock = false; relocking = true; requestLock(); }
}
document.getElementById('mapclose').addEventListener('click', e => { e.stopPropagation(); closeMap(1); });
exploreMap.onOpenRequest = () => { if (!exploreMap.isFull && running) openFullMap(locals[0]); };
// B (controller) or a tap on the corner map: the full map, zoomed in on you.
function openFullMap(p) { const was = exploreMap.isFull; exploreMap.openFull(p); syncMapLock(was); }

// Your marker (one, placed on the full map): a tall beam of light in the world, and a pin on the compass at the top
// of the screen. It clears itself when you get there.
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 320, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffcf3a, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
beam.layers.enable(FAR_LAYER); beam.frustumCulled = false; beam.visible = false; beam.renderOrder = 2;
scene.add(beam);
function placeBeam(w) { beam.visible = !!w; if (w) beam.position.set(w.x, 160, w.z); }
exploreMap.onWaypoint = w => { placeBeam(w); sfx(w ? 'click' : 'tap'); toast(w ? `Marker placed${w.label ? ` on ${w.label.split(' · ')[0]}` : ''}: follow the compass at the top` : 'Marker removed'); };
placeBeam(exploreMap.waypoint);
function checkArrival() {
  const w = exploreMap.waypoint; if (!w) return;
  for (const p of locals) if (Math.hypot(p.pos.x - w.x, p.pos.z - w.z) < 4) { exploreMap.waypoint = null; try { localStorage.removeItem(exploreMap.wkey); } catch (e) { /* ignore */ } placeBeam(null); sfx('buy'); toast('You reached your marker ✓'); return; }
}
// The compass strip: the way you face in the middle, N / E / S / W, your marker (with how far) and your friends.
const COMPASS_SPAN = Math.PI * 1.1; // how much of the circle the strip shows (about 200 degrees)
function drawCompass(p) {
  const cv = p.hud.cstrip; if (!cv) return;
  // Not enough room between the coins (top left) and the edge? Drop below them (split screen, phones).
  const tnow = performance.now();
  if (!(tnow < p.cstripT)) {
    p.cstripT = tnow + 500;
    const root = p.hud.root, purse = root.querySelector('.purse'), rw = root.clientWidth, pr = purse.offsetLeft + purse.offsetWidth + 8;
    const want = Math.min(400 * (parseFloat(getComputedStyle(root).getPropertyValue('--s')) || 1), rw * 0.92);
    cv.classList.toggle('low', rw / 2 - want / 2 < pr);
  }
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'), w = cv.width, h = cv.height, mid = w / 2;
  g.clearRect(0, 0, w, h);
  const rel = (dx, dz) => { let a = Math.atan2(-dx, -dz) - p.yaw; a = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a; }; // + is to the left
  const xOf = a => mid - (a / (COMPASS_SPAN / 2)) * (mid - 10 * dpr);
  // Ticks every 15 degrees, letters at the four points.
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k < 24; k++) {
    const t = k * Math.PI / 12, a = rel(Math.sin(t), -Math.cos(t)); // k = 0 is north (-z), then clockwise
    if (Math.abs(a) > COMPASS_SPAN / 2) continue;
    const x = xOf(a), fade = 1 - Math.pow(Math.abs(a) / (COMPASS_SPAN / 2), 3);
    if (k % 6 === 0) {
      g.font = `700 ${Math.round(13 * dpr)}px Cinzel, Georgia, serif`;
      g.fillStyle = k === 0 ? `rgba(255,120,100,${fade})` : `rgba(240,228,200,${fade})`;
      g.fillText('NESW'[k / 6], x, h * 0.36);
    } else {
      g.fillStyle = `rgba(240,228,200,${0.55 * fade})`;
      g.fillRect(x - 0.5 * dpr, h * (k % 2 ? 0.3 : 0.24), dpr, h * (k % 2 ? 0.14 : 0.24));
    }
  }
  g.fillStyle = 'rgba(255,207,58,0.95)'; g.beginPath(); g.moveTo(mid, h - 2 * dpr); g.lineTo(mid - 5 * dpr, h - 9 * dpr); g.lineTo(mid + 5 * dpr, h - 9 * dpr); g.closePath(); g.fill(); // where you face
  // Things to head for: clamped to the ends of the strip (with an arrow) when they're behind you.
  const thing = (x, z, draw, label) => {
    const a = rel(x - p.pos.x, z - p.pos.z), off = Math.abs(a) > COMPASS_SPAN / 2;
    const px = off ? (a > 0 ? 14 * dpr : w - 14 * dpr) : xOf(a);
    draw(px, h * 0.36, off ? (a > 0 ? -1 : 1) : 0);
    if (label) { g.font = `700 ${Math.round(10 * dpr)}px system-ui, sans-serif`; g.fillStyle = 'rgba(255,240,200,0.95)'; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 3 * dpr; g.strokeText(label, px, h * 0.8); g.fillText(label, px, h * 0.8); }
  };
  const arrow = (px, y, side, col) => { if (!side) return; g.fillStyle = col; g.beginPath(); g.moveTo(px + side * 12 * dpr, y); g.lineTo(px + side * 7 * dpr, y - 4 * dpr); g.lineTo(px + side * 7 * dpr, y + 4 * dpr); g.closePath(); g.fill(); };
  const dist = (x, z) => { const d = Math.round(Math.hypot(x - p.pos.x, z - p.pos.z)); return d >= 1000 ? (d / 1000).toFixed(1) + 'k' : String(d); };
  for (const q of locals) {
    if (q === p) continue;
    const col = '#' + PLAYER_COLORS[q.slot].toString(16).padStart(6, '0');
    thing(q.pos.x, q.pos.z, (px, y, side) => {
      g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(px, y, 6.5 * dpr, 0, Math.PI * 2); g.fill(); g.stroke();
      g.font = `800 ${Math.round(8 * dpr)}px system-ui, sans-serif`; g.fillStyle = '#fff'; g.fillText('P' + (q.slot + 1), px, y + 0.5 * dpr);
      arrow(px, y, side, col);
    }, dist(q.pos.x, q.pos.z));
  }
  for (const r of remotePlayers.map.values()) thing(r.group.position.x, r.group.position.z, (px, y) => { g.fillStyle = '#c9a0ff'; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(px, y, 5.5 * dpr, 0, Math.PI * 2); g.fill(); g.stroke(); }, dist(r.group.position.x, r.group.position.z));
  const wp = exploreMap.waypoint;
  if (wp) thing(wp.x, wp.z, (px, y, side) => {
    const k = dpr * 0.85;
    g.fillStyle = '#ffcf3a'; g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1.5 * dpr;
    g.beginPath(); g.moveTo(px, y + 8 * k); g.bezierCurveTo(px - 7 * k, y - 1 * k, px - 7 * k, y - 11 * k, px, y - 11 * k); g.bezierCurveTo(px + 7 * k, y - 11 * k, px + 7 * k, y - 1 * k, px, y + 8 * k); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#7a2a00'; g.beginPath(); g.arc(px, y - 5 * k, 2.4 * k, 0, Math.PI * 2); g.fill();
    arrow(px, y, side, '#ffcf3a');
  }, wp.label ? `${wp.label.split(' · ')[0]} · ${dist(wp.x, wp.z)}` : dist(wp.x, wp.z));
}
// Keyboard panning of the full map (held keys), in blocks per second at the current zoom.
function panMap(dt) {
  let dx = 0, dz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  if (dx || dz) { exploreMap.pan(dx * 500 * dt / exploreMap.view.scale, dz * 500 * dt / exploreMap.view.scale); exploreMap.lastPad = false; }
}

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
  let { pos, yaw } = savedSpot() || homeSpot();
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

// Resolution: always full (up to 4K width); the view distance is what adapts to keep the frame rate up.
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
// On phones the keyboard hints mean nothing: name the on-screen buttons instead.
const touchText = msg => msg.replace(/ \(shop: B\)/g, ' (tap SHOP)').replace(/the shop \(B\)/g, 'the SHOP').replace(/press E \/ A/g, 'tap the yellow message').replace(/Press E \/ A/g, 'Tap the yellow message');
function toast(msg) {
  if (isTouch) msg = touchText(msg);
  toastEl.textContent = msg; toastEl.style.opacity = 1;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, 2200);
}

window.Game = { trails: () => trails, conquered: () => conquered, world, net, players: remotePlayers, locals, BLOCKS, BID, CFG, renderer, scene, treasure, textures, exploreMap, daySky, farStructs, music, gates, viewAuto, story: () => story, deliverLetter: () => deliverLetter(), roar: () => playRoar(), openReader: i => openReader(i), setSky: id => setSky(id), get inv() { return inv; }, portals, travel: (d) => travel(locals[0], d), openShop: () => openShop(), place: () => placeBlock(locals[0]), break: () => breakBlock(locals[0]), use: () => useAction(locals[0]), carpet: () => toggleCarpet(locals[0]), mount: (i = 0) => toggleMount(locals[i]), addPlayer: () => addLocal(), home: () => goHome(locals[0]), get player() { return locals[0]; } };
function savedSpot() {
  try { const s = JSON.parse(localStorage.getItem('skyforge.labyrinth.pos.v1') || 'null'); if (s && s.seed === CFG.seed) return { pos: new THREE.Vector3(s.x, s.y, s.z), yaw: s.yaw }; } catch (e) { /* ignore */ }
  return null;
}
function savePos() { const p = locals[0]; if (p && !p.vehicle && p.ready) try { localStorage.setItem('skyforge.labyrinth.pos.v1', JSON.stringify({ seed: CFG.seed, x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw })); } catch (e) { /* ignore */ } }
setInterval(savePos, 3000);
function goHome(p) {
  if (!p || p.vehicle) return;
  const h = homeSpot();
  p.pos.copy(h.pos).add(new THREE.Vector3(p.slot * 1.5, 0, 0)); p.yaw = h.yaw; p.pitch = 0; p.vel.set(0, 0, 0);
  toast('Back in the courtyard');
}
// Full screen, always: entered on every Play / Resume (browsers only allow it on a tap or click). iPhones can't do
// it in Safari at all, so they get a hint to add the game to the Home Screen, where it opens full screen.
let fsChanging = 0;
function goFullscreen() {
  const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement || document.webkitFullscreenElement) return;
  fsChanging = performance.now();
  try { const r = req.call(el, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed here */ }
}
const isIPhone = /iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'iPhone');
const standalone = navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
if (isIPhone && !standalone) document.querySelector('.card .iosfs').hidden = false;
document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement && running && !isTouch && !document.pointerLockElement) requestLock(); });
// Set by the automatic view distance only; remembered so the next visit starts where this one settled.
function setView(blocks) {
  CFG.viewBlocks = Math.max(10, Math.min(1024, blocks));
  try { localStorage.setItem('skyforge.view4', String(CFG.viewBlocks)); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Physics. Slabs are half-height, plants / torches / water can be walked through, unloaded chunks are solid.
// ---------------------------------------------------------------------------
function cellTop(id) { return T_SHAPE[id] === SHAPE.slab ? 0.5 : 1; }
function collidesAt(x, y, z) {
  const r = CFG.radius;
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r - 1e-6);
  const y0 = Math.floor(y), y1 = Math.floor(y + CFG.height - 1e-6);
  const z0 = Math.floor(z - r), z1 = Math.floor(z + r - 1e-6);
  for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) for (let iz = z0; iz <= z1; iz++) {
    const id = world.get(ix, iy, iz);
    if (id < 0) return true;
    if (!id || !T_SOLID[id]) continue;
    if (iy + cellTop(id) > y + 1e-6) return true;
  }
  return false;
}
// Highest solid top under the player's footprint that is at most `yhi` (and above ylo - 1): where to land.
function groundTop(x, z, ylo, yhi) {
  const r = CFG.radius;
  let best = -Infinity;
  for (let ix = Math.floor(x - r); ix <= Math.floor(x + r - 1e-6); ix++) for (let iz = Math.floor(z - r); iz <= Math.floor(z + r - 1e-6); iz++)
    for (let iy = Math.floor(ylo) - 1; iy <= Math.floor(yhi); iy++) {
      const id = world.get(ix, iy, iz);
      if (id < 0 || (id && T_SOLID[id])) { const t = iy + (id < 0 ? 1 : cellTop(id)); if (t <= yhi + 1e-4 && t > best) best = t; }
    }
  return best;
}
function moveAxis(p, axis, d) {
  const pos = p.pos, old = pos[axis];
  pos[axis] += d;
  if (!collidesAt(pos.x, pos.y, pos.z)) return false;
  const r = CFG.radius;
  if (axis === 'y') {
    if (d < 0) { const t = groundTop(pos.x, pos.z, pos.y, old); pos.y = Number.isFinite(t) ? t : old; }
    else pos.y = Math.floor(pos.y + CFG.height) - CFG.height - 1e-4;
  } else pos[axis] = d > 0 ? Math.floor(pos[axis] + r) - r - 1e-4 : Math.floor(pos[axis] - r) + 1 + r + 1e-4;
  if (collidesAt(pos.x, pos.y, pos.z)) pos[axis] = old;
  return true;
}
// Walk up stairs, slabs and single blocks without jumping (the camera glides up after you: see stepEase).
function tryStep(p, axis, d) {
  if (!p.onGround) return false;
  const pos = p.pos, ox = pos.x, oy = pos.y, oz = pos.z;
  pos.y = oy + CFG.stepUp; pos[axis] += d;
  if (!collidesAt(pos.x, pos.y, pos.z)) {
    const t = groundTop(pos.x, pos.z, oy, oy + CFG.stepUp);
    if (Number.isFinite(t) && t > oy + 1e-3) {
      pos.y = t;
      // Not onto a ledge with a drop just past it (a parapet on a tower roof, the rim of a sky castle): that takes
      // a real jump. Stairs, steps and raised floors carry on, so they're fine.
      const r = CFG.radius, ahead = { x: pos.x, z: pos.z };
      ahead[axis] = d > 0 ? Math.floor(pos[axis] + r) + 1.5 : Math.floor(pos[axis] - r) - 0.5; // the middle of the block past the step
      const ledge = !collidesAt(ahead.x, t, ahead.z) && !Number.isFinite(groundTop(ahead.x, ahead.z, t - 2, t + 0.01));
      if (!ledge && !collidesAt(pos.x, pos.y, pos.z)) return true;
    }
  }
  pos.x = ox; pos.y = oy; pos.z = oz;
  return false;
}
const isWater = id => id > 0 && T_SHAPE[id] === SHAPE.liquid;
function blockOverlapsAnyPlayer(x, y, z) {
  const r = CFG.radius;
  return locals.some(({ pos: p, vehicle }) => !vehicle && x < p.x + r && x + 1 > p.x - r && z < p.z + r && z + 1 > p.z - r && y < p.y + CFG.height && y + 1 > p.y);
}

// ---------------------------------------------------------------------------
// Block targeting (voxel DDA raycast; water is looked through)
// ---------------------------------------------------------------------------
const dirV = new THREE.Vector3();
function raycast(cam, reach = CFG.reach) {
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
  while (t <= reach) {
    const id = world.get(x, y, z);
    if (id < 0) return null;
    if (id && !isWater(id)) return { x, y, z, n, id, dist: t };
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
  }
  return null;
}
let noticeT = 0;
function notice(msg) { const now = performance.now(); if (now - noticeT < 900) return; noticeT = now; toast(msg); }
const baseId = id => { const b = blockById(id); if (isWheel(id)) return WHEEL_ID; return b.variantOf ? b.variantOf : id; };
function placeBlock(p) {
  const t = p.target; if (!t && !p.zipAim) return;
  if (t && targetIsChest(p)) { openChest(p); return; }
  if (t && useTarget(p)) return;
  const sel = p.selected;
  if (!BUILDING && sel !== BID['Zip Anchor'] && sel !== BID['Portal Stone'] && sel !== BUILDER) return;
  if (!sel || inv.count(sel) <= 0) { notice('No blocks in this slot: find blocks in treasure chests or buy them in the shop (B)'); return; }
  // The second zip anchor: placed where the preview is, up to 96 blocks from the first (no walking over there).
  let at = t;
  if (sel === BID['Zip Anchor'] && p.zipAim && !t) { // beyond arm's reach: the long-reach aim
    if (!p.zipAim.ok) { notice('Too far: a zip line reaches up to 96 blocks from the first anchor'); return; }
    at = p.zipAim.t;
  }
  const x = at.x + at.n[0], y = at.y + at.n[1], z = at.z + at.n[2];
  if (y >= BUILD_MAX) { notice(`Too high to build (limit ${BUILD_MAX}): the floating castles can only be reached by portal or by flying`); return; }
  const cur = world.get(x, y, z);
  const look = sel === BUILDER ? skinOf() : sel;
  if (y < 0 || (cur && !isWater(cur) && T_SHAPE[cur] !== SHAPE.cross) || (T_SOLID[look] && blockOverlapsAnyPlayer(x, y, z))) return;
  const id = facedId(sel === BUILDER ? skinOf() : sel, facingVariant(p.yaw));
  if (!world.set(x, y, z, id)) return;
  inv.take(sel);
  inv.placed.add(`${x},${y},${z}`);
  if (sel === BID['Zip Anchor']) linkPair(inv.zips, [x, y, z], 96, 'Zip anchor placed: put the other one within 96 blocks', 'Zip line ready! Look at an anchor and press E / A to ride');
  if (sel === BID['Portal Stone']) linkPair(inv.portalPairs, [x, y, z], Infinity, 'Portal stone placed: put the other one anywhere', 'Portal stones linked! Press E / A on one to step to the other');
  inv.save(); refreshHotbars(); rebuildRopes();
  rumble(p, 0.15, 0.35, 45);
  sfx('place');
}
// Aiming the second zip anchor: with one anchor waiting for its partner and an anchor in hand, look anywhere up to
// ~100 blocks away; a ghost anchor and the rope show where it will go (gold: in reach; red: too far).
const ZIP_REACH = 96;
function openZip() { for (let i = inv.zips.length - 1; i >= 0; i--) if (inv.zips[i].a && !inv.zips[i].b) return inv.zips[i]; return null; }
function updateZipAim(p, cam) {
  const q = p.selected === BID['Zip Anchor'] && inv.count(BID['Zip Anchor']) > 0 && !p.vehicle ? openZip() : null;
  let aim = null;
  if (q) {
    const t = raycast(cam, ZIP_REACH + 12);
    if (t && t.y >= 0) {
      const x = t.x + t.n[0], y = t.y + t.n[1], z = t.z + t.n[2], d = Math.hypot(x - q.a[0], y - q.a[1], z - q.a[2]);
      const free = world.get(x, y, z), clear = !free || isWater(free) || T_SHAPE[free] === SHAPE.cross;
      aim = { t, x, y, z, ok: d <= ZIP_REACH && d >= 2 && clear && y < BUILD_MAX, d };
    }
  }
  if (!aim && p.zipAim) p.hud.hintKey = ''; // let the usual hints back
  p.zipAim = aim;
  if (!p.zipGhost) {
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: 0xffcf3a, transparent: true, opacity: 0.4, depthWrite: false }));
    const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]), new THREE.LineDashedMaterial({ color: 0xffcf3a, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 0.9 }));
    ghost.frustumCulled = false; rope.frustumCulled = false; ghost.renderOrder = 3; rope.renderOrder = 3;
    scene.add(ghost, rope); p.zipGhost = { ghost, rope };
  }
  const { ghost, rope } = p.zipGhost;
  ghost.visible = rope.visible = !!aim;
  if (!aim) return;
  const col = aim.ok ? 0xffcf3a : 0xff5a4a;
  ghost.material.color.setHex(col); rope.material.color.setHex(col);
  ghost.position.set(aim.x + 0.5, aim.y + 0.5, aim.z + 0.5);
  rope.geometry.setFromPoints([new THREE.Vector3(q.a[0] + 0.5, q.a[1] + 1.2, q.a[2] + 0.5), new THREE.Vector3(aim.x + 0.5, aim.y + 1.2, aim.z + 0.5)]);
  rope.computeLineDistances();
  const msg = aim.ok ? `${p.gamepadIndex !== null ? 'LT' : isTouch ? 'PLACE' : 'Right click'}: put the other anchor here · ${Math.round(aim.d)} blocks` : `Too far: ${Math.round(aim.d)} of ${ZIP_REACH} blocks`;
  if (p.hud.hint.textContent !== msg) p.hud.hint.textContent = msg;
  p.hud.hint.style.opacity = 1; p.hud.hint.classList.remove('tappable'); p.hud.hintKey = 'zipaim';
}
function linkPair(list, pos, maxD, first, done) {
  const open = list.find(q => !q.b && Math.hypot(q.a[0] - pos[0], q.a[1] - pos[1], q.a[2] - pos[2]) <= maxD);
  if (open) { open.b = pos; toast(done); } else { list.push({ a: pos, b: null }); toast(first); }
}
function unlinkPair(list, pos) {
  const k = pos.join(',');
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    if (q.a && q.a.join(',') === k) { q.a = q.b; q.b = null; }
    else if (q.b && q.b.join(',') === k) q.b = null;
    if (!q.a) list.splice(i, 1);
  }
}
const partnerOf = (list, t) => { const k = `${t.x},${t.y},${t.z}`; for (const q of list) { if (q.a && q.b && q.a.join(',') === k) return q.b; if (q.a && q.b && q.b.join(',') === k) return q.a; } return null; };
function breakBlock(p) {
  const t = p.target; if (!t || t.y < 1) return;
  const key = `${t.x},${t.y},${t.z}`;
  if (t.id === BID.Portal) { notice('Portals can\u2019t be broken'); return; }
  if (inv.placed.has(key)) {
    // Your own blocks can always be picked back up.
    if (!world.set(t.x, t.y, t.z, 0)) return;
    // (a building block goes back into the one stack, whatever its look)
    const back = baseId(t.id);
    inv.placed.delete(key); inv.add(!BUILDING && !GEAR_BLOCKS.has(back) ? BUILDER : back);
    if (t.id === BID['Zip Anchor']) unlinkPair(inv.zips, [t.x, t.y, t.z]);
    if (t.id === BID['Portal Stone']) unlinkPair(inv.portalPairs, [t.x, t.y, t.z]);
    inv.save(); refreshHotbars(); rebuildRopes();
    rumble(p, 0.4, 0.2, 70);
    return;
  }
  if (CHEST_IDS.has(t.id) && treasure.chestAt(t.x, t.y, t.z) && !treasure.isOpened(t.x, t.y, t.z)) { notice('Open the chest first (E / A)'); return; }
  // One tool breaks everything: the hammer (walls, stone, wood, plants, leaves...).
  if (!inv.has('hammer')) { notice('You need the Stonebreaker Hammer to break things (shop: B)'); return; }
  // The ground itself can't be dug from the surface (no holes by accident): only once you're down in a dungeon,
  // cave, mine or crypt (a few blocks below the ground, so not just standing in a pond).
  if (t.y < GROUND && p.pos.y > GROUND - 2.5) return; // the ground can't be dug from the surface (quietly)
  if (world.set(t.x, t.y, t.z, 0)) { rumble(p, 0.4, 0.2, 70); sfx('break'); wearHammer(); }
}
// Each block broken wears the hammer a little; when it's used up it breaks and you need a new one.
function updateHammerBadge(p) {
  const el = p.hud.hammer, on = inv.has('hammer');
  el.hidden = !on; if (!on) return;
  const k = Math.max(0, Math.min(1, (inv.hammer || HAMMER_LIFE) / HAMMER_LIFE));
  el.style.setProperty('--k', (k * 360).toFixed(1) + 'deg');
  el.style.setProperty('--c', k > 0.5 ? '#6fdc6f' : k > 0.2 ? '#ffd24a' : '#ff6a5a');
  el.lastChild.textContent = inv.hammer || HAMMER_LIFE;
}
function updateHammerBadges() { for (const p of locals) updateHammerBadge(p); }
// Torches: hold one (select it on the hotbar) and it lights up around you. Each burns for TORCH_TIME seconds,
// then the next one lights, until you run out. The badge by your coins shows the time left and how many you have.
let torchSaveT = 0;
function updateTorch(dt, time) {
  const p = locals[0], u = chunkUniforms.heldLight.value;
  const n = inv.count(BID.Torch);
  const lit = p && running && p.selected === BID.Torch && n > 0;
  if (lit) {
    inv.torchT -= dt;
    if (inv.torchT <= 0) {
      inv.take(BID.Torch); inv.torchT = TORCH_TIME; refreshHotbars();
      const left = inv.count(BID.Torch);
      toast(left ? `A torch burned out: ${left} left` : 'Your last torch burned out. Buy more in the shop (B)');
    }
    torchSaveT -= dt; if (torchSaveT <= 0) { torchSaveT = 5; inv.save(); }
    const flick = 0.9 + 0.06 * Math.sin(time * 11.3) + 0.04 * Math.sin(time * 23.7);
    u.set(p.pos.x, p.pos.y + 1.4, p.pos.z, flick);
  } else if (p && inv.has('lantern') && (p.skyU ?? 1) < 0.45) {
    // The Everlasting Lantern: underground it glows around you like a torch that never burns out.
    u.set(p.pos.x, p.pos.y + 1.5, p.pos.z, 0.82 + 0.02 * Math.sin(time * 2.1));
  } else u.w = 0;
  document.body.classList.toggle('canplace', !!p && (p.selected === BID['Zip Anchor'] || p.selected === BID['Portal Stone']));
  for (const q of locals) {
    const el = q.hud.torch, show = n > 0;
    el.hidden = !show; if (!show) continue;
    const k = Math.max(0, Math.min(1, inv.torchT / TORCH_TIME));
    el.style.setProperty('--k', (k * 360).toFixed(1) + 'deg');
    el.style.setProperty('--c', lit && q === p ? '#ffb347' : 'rgba(255,179,71,0.45)');
    const s = Math.ceil(inv.torchT);
    el.lastChild.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} ×${n}`;
  }
}
function wearHammer() {
  if (!(inv.hammer > 0)) inv.hammer = HAMMER_LIFE;
  inv.hammer--;
  if (inv.hammer <= 0) { inv.items.delete('hammer'); inv.hammer = 0; sfx('break'); toast('Your hammer broke! Buy a new one in the shop (B)'); }
  else if (inv.hammer === 50 || inv.hammer === 10) toast(`Your hammer is wearing out: ${inv.hammer} blocks left`);
  inv.save(); updateHammerBadges();
}
// Treasure chests: look at one and press E / A / right click.
const CHEST_IDS = new Set(BLOCKS.filter(b => b.chest || (b.variantOf && blockById(b.variantOf).chest)).map(b => b.id));
const targetIsChest = p => p.target && CHEST_IDS.has(p.target.id) && p.target.dist < 6;
function openChest(p) {
  const { x, y, z } = p.target;
  const t = treasure.chestAt(x, y, z);
  if (treasure.isOpened(x, y, z)) {
    if (t && t.home) { askPortal(p, t.home, true); return; } // the castle's final chest: the way home, again
    toast('This chest is empty: you already took its treasure'); return;
  }
  let got = treasure.open(x, y, z);
  if (got < 0 || !t) { toast('An empty chest'); return; }
  // With building off, a floating castle's supply crate holds a purse of coins instead of blocks.
  if (!BUILDING && t.tier === 6) { const bonus = 800 + ((x * 73856093 ^ z * 19349663 ^ y * 83492791) >>> 0) % 1201; treasure.purse += bonus; treasure.save(); got += bonus; }
  rumble(p, 0.8, 0.8, 300);
  // Prizes: coins (and, with building on, blocks). Big hoards also hold a few torches.
  const blocks = BUILDING ? chestBlocks(x, y, z, t.tier) : t.tier >= 4 ? [[BID.Torch, t.tier === 5 ? 4 : t.tier === 6 ? 3 : 2]] : [];
  // Building blocks for your one stack (whatever look you choose).
  if (!BUILDING) blocks.unshift([BUILDER, [0, 8, 16, 32, 50, 64, 40][Math.min(6, t.tier || 1)]]);
  giveBlocks(blocks);
  const what = t.tier === 6 ? 'Supply crate' : t.tier >= 5 ? 'THE CASTLE HOARD' : t.tier >= 4 ? 'LEGENDARY TREASURE' : t.tier >= 3 ? 'A great treasure' : t.tier >= 2 ? 'Treasure' : 'A small treasure';
  const bl = blocks.slice(0, 3).map(([id, n]) => `${n} ${blockById(id).name}${n > 1 && id === BID.Torch ? 'es' : ''}`).join(', ') + (blocks.length > 3 ? ` +${blocks.length - 3} more` : '');
  toast(`${what}! ${got ? `+${got.toLocaleString()} coins` : ''}${got && bl ? ' · ' : ''}${bl}`);
  exploreMap.markers.push({ x: x + 0.5, z: z + 0.5, icon: '✦' });
  // The end of a castle, dungeon, cave or mine: a new letter from the villain.
  if (t.tier >= 3 && t.tier !== 6) setTimeout(() => deliverLetter(), 900);
  // A castle's final chest also offers the way home, once its letter has been read and closed.
  if (t.home) homeOffer = { p, dest: t.home };
}
let homeOffer = null;
function offerHome() { const o = homeOffer; homeOffer = null; if (o && locals.includes(o.p)) askPortal(o.p, o.dest, true); }
// Portals (built into the world), portal stones and zip line anchors: look at one and press E / A.
const USABLE = new Set([BID.Portal, BID['Portal Stone'], BID['Zip Anchor']]);
const targetIsUsable = p => p.target && USABLE.has(p.target.id) && p.target.dist < 6;
function portalAt(x, y, z) {
  for (const q of portals.values()) { const [x0, y0, z0, x1, y1, z1] = q.box; if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1) return q; }
  return null;
}
function useTarget(p) {
  if (!targetIsUsable(p)) return false;
  const t = p.target;
  if (t.id === BID.Portal) { const q = portalAt(t.x, t.y, t.z); if (q) askPortal(p, q.dest); return true; }
  if (t.id === BID['Portal Stone']) { const o = partnerOf(inv.portalPairs, t); if (o) travel(p, { x: o[0] + 0.5, y: o[1] + 1, z: o[2] + 0.5, yaw: p.yaw, label: 'your other portal stone' }); else toast('Place the second portal stone to link them'); return true; }
  if (t.id === BID['Zip Anchor']) { const o = partnerOf(inv.zips, t); if (o) { p.zip = { a: new THREE.Vector3(t.x + 0.5, t.y + 1.2, t.z + 0.5), b: new THREE.Vector3(o[0] + 0.5, o[1] + 1.2, o[2] + 0.5), t: 0 }; p.flying = false; } else toast('Place the second zip anchor within 96 blocks'); return true; }
  return false;
}
// Portals ask first (A is also jump, so it's easy to press one by accident): A / E / Enter goes, B / Esc stays.
const confirmUI = { el: document.getElementById('confirm'), open: false, p: null, dest: null, unlock: false };
function askPortal(p, dest, home) {
  const pad = p.gamepadIndex !== null, touch = isTouch && !pad;
  confirmUI.open = true; confirmUI.p = p; confirmUI.dest = dest; confirmUI.home = !!home;
  // A castle's final chest brings the castle down; a dungeon's, cave's or mine's takes you back up and seals it.
  const castle = home && dest.kind !== 'under';
  const el = confirmUI.el, go = castle ? 'Bring it down' : home ? 'Take me back' : 'Go through', stay = castle ? 'Not yet' : 'Stay here';
  el.querySelector('.ctitle').textContent = castle ? '✦ The castle is yours ✦' : home ? '✦ The way home ✦' : '✦ Portal ✦';
  el.querySelector('.ctext').textContent = castle ? 'You found its treasure. Bring the castle down? It vanishes and a flower meadow grows where it stood, coins from any chests you skipped go into your purse, and you\u2019re set down on the grass.'
    : home ? `You found the treasure. Go back up to ${dest.label || 'the entrance'}? The way down is sealed behind you.`
    : `This portal takes you to ${dest.label || 'somewhere far away'}. Go through?`;
  el.querySelector('.cyes').textContent = pad ? `Ⓐ ${go}` : touch ? go : `${go} (E)`;
  el.querySelector('.cno').textContent = pad ? `Ⓑ ${stay}` : touch ? stay : `${stay} (Esc)`;
  el.hidden = false; p.vel.set(0, 0, 0);
  if (document.pointerLockElement) { confirmUI.unlock = true; paletteUnlock = true; document.exitPointerLock(); }
  sfx('click');
}
function closeConfirm(go) {
  const { p, dest, home } = confirmUI;
  confirmUI.open = false; confirmUI.el.hidden = true; confirmUI.p = null; confirmUI.dest = null;
  if (confirmUI.unlock) { confirmUI.unlock = false; paletteUnlock = false; relocking = true; requestLock(); }
  if (!go || !p || !dest) { sfx('tap'); return; }
  if (home && dest.kind !== 'under') { bringDown(p, dest); return; }
  travel(p, dest);
  if (home && dest.site) { // back up from a dungeon, cave or mine: brick it up behind you
    conquer({ key: dest.site, kind: 'under', x: dest.x, z: dest.z - 12 }, [dest.x - 40, dest.z - 52, dest.x + 40, dest.z + 24]);
    setTimeout(() => toast('The way down is sealed behind you ✓'), 900);
  }
}

// --- Bringing a castle down -------------------------------------------------------------------------------------
// A conquered castle is simply gone: the world is rebuilt as a flower meadow and you're set down on its grass.
let landing = null; // { x, y, z, until }: hold the player there until the rebuilt ground arrives
// (an earlier version left a stone platform behind: clear one that was saved)
try { const pl = JSON.parse(localStorage.getItem('skyforge.platform') || 'null'); if (pl) setTimeout(() => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) if (world.get(pl.x + dx, pl.y + dy, pl.z + dz) > 0) world.set(pl.x + dx, pl.y + dy, pl.z + dz, 0); localStorage.removeItem('skyforge.platform'); }, 4000); } catch (e) { /* ignore */ }
function bringDown(p, home) {
  const s = siteAt(p.pos.x, p.pos.y, p.pos.z) || { key: home.site, box: [p.pos.x - 90, p.pos.z - 90, p.pos.x + 90, p.pos.z + 90] };
  const key = home.site || s.key, deep = !!s.deep, floor = deep ? s.floor : GROUND;
  const box = deep ? [s.clr[0] - 3, s.clr[1] - 3, s.clr[2] + 3, s.clr[3] + 3] : s.box;
  // Coins from the chests you skipped go into your purse.
  const plan = trails.plans.get(key);
  let bonus = 0;
  if (plan && plan.segs) for (const sg of plan.segs) if (!treasure.opened.has(sg.to)) { bonus += sg.value || 0; treasure.opened.add(sg.to); }
  if (bonus) { treasure.purse += bonus; treasure.save(); }
  if (!deep) world.hideAbove(box[0], box[1], box[2], box[3], GROUND); // (a cavern's floor and walls share those chunks: they stay until rebuilt)
  conquer({ key, kind: 'castle', x: (box[0] + box[2]) / 2, z: (box[1] + box[3]) / 2, b: s.clr, ...(deep ? { y: floor } : {}) }, [box[0] - 8, box[1] - 8, box[2] + 8, box[3] + 8]);
  farStructs.forget(key);
  // Down on the meadow, where the castle stood.
  const c = s.clr || [p.pos.x, p.pos.z, p.pos.x, p.pos.z];
  const x = Math.floor((c[0] + c[2]) / 2) + 0.5, z = Math.floor((c[1] + c[3]) / 2) + 0.5, y = s.clr ? floor : p.pos.y;
  document.body.classList.add('fading');
  setTimeout(() => document.body.classList.remove('fading'), 900);
  for (const q of locals) { if (q !== p && Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z) > 40) continue; q.pos.set(x + (q === p ? 0 : 1.5), y + 0.05, z); q.vel.set(0, 0, 0); q.zip = null; q.pitch = 0; }
  landing = { x: x, y: y + 0.05, z, until: performance.now() + 8000 };
  sfx('big');
  toast(bonus ? `The castle is gone, a meadow now ✿ +${bonus.toLocaleString()} coins from the chests you skipped` : 'The castle is gone, a meadow now ✿');
}
// Until the rebuilt ground is in (the old castle's blocks are still there for a moment), keep everyone in place.
function updateLanding() {
  if (!landing) return;
  const L = landing, fx = Math.floor(L.x), fy = Math.floor(L.y), fz = Math.floor(L.z);
  const blocked = [fy, fy + 1].some(y => { const id = world.get(fx, y, fz); return id === undefined || id < 0 || (id > 0 && T_SOLID[id]); });
  const ground = world.get(fx, fy - 1, fz);
  if ((!blocked && ground > 0) || performance.now() > L.until) { landing = null; return; }
  for (const q of locals) if (Math.hypot(q.pos.x - L.x, q.pos.z - L.z) < 3) { q.pos.y = L.y; q.vel.set(0, 0, 0); }
}
{
  const el = confirmUI.el;
  for (const ev of ['click', 'touchend', 'mousedown', 'touchstart']) el.addEventListener(ev, e => e.stopPropagation());
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) closeConfirm(b.classList.contains('cyes')); else closeConfirm(false); });
}
function travel(p, d) {
  sfx('portal');
  document.body.classList.add('fading');
  setTimeout(() => document.body.classList.remove('fading'), 650);
  p.pos.set(d.x, d.y, d.z); p.vel.set(0, 0, 0); p.yaw = d.yaw || 0; p.pitch = 0; p.zip = null;
  toast(`✦ ${d.label ? 'To ' + d.label : 'Whoosh!'}`);
  treasure.sound('chest');
  rumble(p, 0.6, 0.6, 250);
}
// Zip line ropes.
const ropes = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x8b6a3c }));
ropes.frustumCulled = false; scene.add(ropes);
function rebuildRopes() {
  const pts = [];
  for (const q of inv.zips) if (q.a && q.b) pts.push(q.a[0] + 0.5, q.a[1] + 1.2, q.a[2] + 0.5, q.b[0] + 0.5, q.b[1] + 1.2, q.b[2] + 0.5);
  ropes.geometry.dispose(); ropes.geometry = new THREE.BufferGeometry(); ropes.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}
rebuildRopes();
// Mounts: a horse, a flying cloud and the magic carpet. F / X (RIDE on phones) steps through the ones you own
// (horse, cloud, carpet, off). Each has a seat behind the rider: in split screen, the second player presses the
// same button next to a mounted friend to hop on the back (and again, or jump, to hop off).
const MOUNTS = ['horse', 'cloud', 'carpet'];
const MOUNT_NAME = { horse: 'Horse', cloud: 'Flying Cloud', carpet: 'Magic Carpet' };
const MOUNT_HELP = { horse: 'gallop and leap 2 blocks', cloud: 'jump to rise (up to 12 blocks over the ground), C / B to sink', carpet: 'jump to rise, C / B to sink' };
function setMount(p, m) {
  if (p.passenger && !m) { leaveSeat(p.passenger); }
  p.mount = m; p.flying = m === 'cloud' || m === 'carpet';
  if (m) p.zip = null;
}
function toggleMount(p) {
  if (p.ride) { leaveSeat(p); return; }
  // A mounted friend nearby with a free seat: hop on the back.
  if (!p.mount) for (const q of locals) if (q !== p && q.mount && !q.passenger && !q.ride && q.pos.distanceTo(p.pos) < 4.5) { takeSeat(p, q); return; }
  const owned = MOUNTS.filter(m => inv.has(m));
  if (!owned.length) { notice('Mounts are in the shop (B): a Horse, a Flying Cloud and the Magic Carpet'); return; }
  const i = p.mount ? owned.indexOf(p.mount) : -1;
  const next = i + 1 < owned.length ? owned[i + 1] : null;
  setMount(p, next);
  toast(next ? `${MOUNT_NAME[next]}: ${MOUNT_HELP[next]} · F / X: ${i + 2 < owned.length ? MOUNT_NAME[owned[i + 2]] : 'get off'}` : 'You get off');
}
function toggleCarpet(p) { // (kept for tests and old saves)
  if (!inv.has('carpet')) { notice('The Magic Carpet is in the shop (B): 60,000 coins'); return; }
  setMount(p, p.mount === 'carpet' ? null : 'carpet');
}
function takeSeat(p, q) { p.ride = q; q.passenger = p; p.camera.layers.disable(AVATAR_LAYER + q.slot); /* the rider in front doesn't block the view */ setMount(p, null); p.vel.set(0, 0, 0); toast(`P${p.slot + 1} hops on the back of the ${MOUNT_NAME[q.mount].toLowerCase()}`); }
function leaveSeat(p) {
  const q = p.ride; if (!q) return;
  q.passenger = null; p.ride = null; p.camera.layers.enable(AVATAR_LAYER + q.slot);
  // Step off to the side, somewhere free.
  for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [0, 0]]) { const x = q.pos.x + dx, z = q.pos.z + dz; if (!collidesAt(x, q.pos.y, z)) { p.pos.set(x, q.pos.y, z); break; } }
  p.vel.set(0, 0, 0);
}
// How high the eyes sit on each mount.
const MOUNT_EYE = { horse: 0.85, cloud: 0.35, carpet: 0.1 };
const mountOf = p => (p.ride ? p.ride.mount : p.mount);
// Meshes.
function mountMesh(p, kind) {
  p.meshes = p.meshes || {};
  if (p.meshes[kind]) return p.meshes[kind];
  const g = new THREE.Group();
  const box = (w, h, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color })); m.position.set(x, y, z); g.add(m); return m; };
  if (kind === 'horse') {
    const coat = 0x6b4226, dark = 0x2b1a10;
    box(0.8, 0.75, 1.9, coat, 0, 1.0, 0.1);                 // body
    box(0.42, 0.75, 0.45, coat, 0, 1.45, -0.85).rotation.x = -0.5; // neck
    box(0.36, 0.38, 0.75, coat, 0, 1.78, -1.22);             // head
    box(0.3, 0.26, 0.2, 0x3a2416, 0, 1.68, -1.6);            // muzzle
    box(0.12, 0.7, 0.55, dark, 0, 1.6, -0.82).rotation.x = -0.5; // mane
    box(0.16, 0.7, 0.16, dark, 0, 0.95, 1.12).rotation.x = 0.35; // tail
    box(0.72, 0.12, 0.7, 0x7a1f1f, 0, 1.42, 0.25);           // saddle blanket
    g.userData.legs = [[-0.26, -0.62], [0.26, -0.62], [-0.26, 0.78], [0.26, 0.78]].map(([x, z]) => {
      const leg = new THREE.Group(); leg.position.set(x, 0.75, z);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), new THREE.MeshLambertMaterial({ color: coat })); m.position.y = -0.37; leg.add(m);
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), new THREE.MeshLambertMaterial({ color: dark })); hoof.position.y = -0.72; leg.add(hoof);
      g.add(leg); return leg;
    });
  } else if (kind === 'cloud') {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8899aa, emissiveIntensity: 0.25 });
    for (const [x, y, z, r] of [[0, 0, 0, 0.75], [0.7, 0.05, 0.3, 0.55], [-0.7, 0.02, 0.25, 0.58], [0.3, 0.1, -0.75, 0.55], [-0.35, 0.08, 0.9, 0.6], [0.45, -0.05, 1.0, 0.45], [-0.6, -0.08, -0.6, 0.5]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 12, 8), mat); m.position.set(x * 1.25, y - 0.3, z * 1.1); m.scale.y = 0.6; g.add(m);
    }
  } else {
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 2.8), new THREE.MeshLambertMaterial({ color: 0xa3122a }));
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.05, 2.92), new THREE.MeshLambertMaterial({ color: 0xe8b52a }));
    trim.position.y = -0.02; g.add(trim, cloth);
  }
  scene.add(g); p.meshes[kind] = g; return g;
}
function updateMounts(dt) {
  for (const p of locals) {
    for (const kind of MOUNTS) {
      const on = p.mount === kind;
      if (!on && !(p.meshes && p.meshes[kind])) continue;
      const g = mountMesh(p, kind); g.visible = on;
      if (!on) continue;
      // The mount sits under the rider, a little forward so the friend's seat is on it too.
      const fx = -Math.sin(p.yaw) * 0.35, fz = -Math.cos(p.yaw) * 0.35;
      g.position.set(p.pos.x + fx, p.pos.y + (kind === 'horse' ? -0.15 : kind === 'cloud' ? 0.1 : -0.05), p.pos.z + fz);
      g.rotation.y = p.yaw;
      if (kind === 'horse') {
        const sp = Math.hypot(p.vel.x, p.vel.z); p.gait = (p.gait || 0) + dt * sp * 1.1;
        g.userData.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(p.gait + (i === 0 || i === 3 ? 0 : Math.PI)) * Math.min(0.7, sp * 0.08); });
        g.position.y += Math.abs(Math.sin(p.gait)) * Math.min(0.12, sp * 0.01);
      } else if (kind === 'cloud') g.position.y += Math.sin(performance.now() / 600) * 0.05;
    }
  }
}

// ---------------------------------------------------------------------------
// The story: the villain's letters. You start with one in your hotbar; each final chest holds another (answering
// what you've bought, or carrying the tale on). Select the letter on the hotbar to read them all again.
// ---------------------------------------------------------------------------
const LETTER = BID['Old Letter'];
const story = (() => { try { return JSON.parse(localStorage.getItem('skyforge.story') || 'null'); } catch (e) { return null; } })()
  || { got: ['opening'], next: 0, answered: [], queue: [], endless: [], fresh: true };
const saveStory = () => { try { localStorage.setItem('skyforge.story', JSON.stringify(story)); } catch (e) { /* ignore */ } };
if (story.fresh) {
  // Gear bought before the story began gets its answer too.
  for (const id of Object.keys(BOUGHT)) if (inv.has(id) && !story.queue.includes(id)) story.queue.push(id);
  delete story.fresh; saveStory();
}
if (!inv.count(LETTER)) { inv.blocks.set(LETTER, 1); inv.save(); }
function storyBought(id) { if (BOUGHT[id] && !story.answered.includes(id) && !story.queue.includes(id)) { story.queue.push(id); saveStory(); } }
const letterText = k => (k === 'opening' ? OPENING.text : k.startsWith('b:') ? BOUGHT[k.slice(2)] : k.startsWith('s:') ? STORY[+k.slice(2)] : ENDLESS[+k.slice(2)]);
function deliverLetter() {
  let k;
  const due = story.queue.find(id => !story.answered.includes(id));
  if (due) { k = 'b:' + due; story.answered.push(due); story.queue = story.queue.filter(id => id !== due); }
  else if (story.next < STORY.length) k = 's:' + story.next++;
  else {
    if (story.endless.length >= ENDLESS.length) story.endless = [];
    const left = ENDLESS.map((_, i) => i).filter(i => !story.endless.includes(i));
    const i = left[Math.floor(Math.random() * left.length)];
    story.endless.push(i); k = 'e:' + i;
  }
  story.got.push(k); saveStory();
  toast('There was a letter in the chest');
  openReader(story.got.length - 1);
}
const reader = { el: document.getElementById('letter'), open: false, i: 0, unlock: false };
function renderReader() {
  const n = story.got.length, k = story.got[reader.i];
  reader.el.querySelector('.ltext').textContent = letterText(k);
  reader.el.querySelector('.lcount').textContent = n > 1 ? `Letter ${reader.i + 1} of ${n}` : 'A letter';
  reader.el.querySelector('.lprev').disabled = reader.i <= 0;
  reader.el.querySelector('.lnext').disabled = reader.i >= n - 1;
}
function openReader(i) {
  reader.i = i ?? story.got.length - 1;
  reader.open = true; reader.el.hidden = false; document.body.classList.add('readeropen');
  if (locals[0]) locals[0].vel.set(0, 0, 0);
  if (document.pointerLockElement) { reader.unlock = true; paletteUnlock = true; document.exitPointerLock(); }
  renderReader(); sfx('click');
}
function closeReader() {
  reader.open = false; reader.el.hidden = true; document.body.classList.remove('readeropen');
  if (reader.unlock) { reader.unlock = false; paletteUnlock = false; relocking = true; requestLock(); }
  if (homeOffer) setTimeout(offerHome, 250); // the castle's final chest: now offer the way home
}
function readerStep(d) { reader.i = Math.max(0, Math.min(story.got.length - 1, reader.i + d)); renderReader(); }
{
  const el = reader.el;
  for (const ev of ['click', 'touchend', 'mousedown', 'touchstart']) el.addEventListener(ev, e => e.stopPropagation());
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('lclose')) closeReader(); else if (b.classList.contains('lprev')) readerStep(-1); else if (b.classList.contains('lnext')) readerStep(1);
  });
}

// The creature's roar: once a night, somewhere out in the labyrinth, if you're down in the maze to hear it.
const roar = { buf: null, loading: false, done: false, at: 0 };
function playRoar() {
  const ctx = audio.init(); if (!ctx) return;
  const go = () => {
    const src = ctx.createBufferSource(); src.buffer = roar.buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; // a little distance
    const g = ctx.createGain(); g.gain.value = 0.8;
    let out = g;
    if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = Math.random() * 1.6 - 0.8; g.connect(pn); out = pn; }
    out.connect(audio.sfx);
    src.connect(lp); lp.connect(g); src.start();
  };
  if (roar.buf) { go(); return; }
  if (roar.loading) return;
  roar.loading = true;
  fetch('sounds/frankenroar.mp3').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => { roar.buf = buf; roar.loading = false; go(); }).catch(() => { roar.loading = false; });
}
function updateRoar(dt) {
  const p = locals[0]; if (!p || !running) return;
  const night = daySky.night > 0.75;
  if (!night) { roar.done = false; roar.at = 0; return; }
  if (roar.done) return;
  if (!roar.at) roar.at = 20 + Math.random() * 70; // some time into the night
  roar.at -= dt;
  const inMaze = (p.skyU ?? 1) > 0.6 && p.pos.y < 90 && !p.flying;
  if (roar.at <= 0 && inMaze) { roar.done = true; playRoar(); }
}

// ---------------------------------------------------------------------------
// The shop (B / Y / SHOP): spend coins on gear and building blocks.
// ---------------------------------------------------------------------------
const shop = { open: false, tab: 'gear', sel: 0, el: document.getElementById('shop'), unlock: false };
function shopItems() { return shop.tab === 'gear' || !BUILDING ? GEAR : BLOCK_PACKS; }
function renderShop() {
  const items = shopItems();
  shop.sel = Math.max(0, Math.min(shop.sel, items.length - 1));
  shop.el.querySelector('.spurse').textContent = treasure.purse.toLocaleString();
  shop.el.querySelectorAll('.stabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === shop.tab));
  const grid = shop.el.querySelector('.sgrid');
  grid.innerHTML = items.map((it, i) => {
    const owned = it.item && inv.has(it.id), afford = treasure.purse >= it.price;
    const have = it.blocks ? it.blocks.map(([n]) => inv.count(BID[n])).reduce((a, b) => a + b, 0) : 0;
    return `<div class="sitem${i === shop.sel ? ' sel' : ''}${owned ? ' owned' : ''}" data-i="${i}">
      ${it.emoji ? `<span class="semoji">${it.emoji}</span>` : `<img src="textures/${it.icon}" alt="">`}<div class="sbody"><div class="sname">${it.name}</div><div class="sdesc">${it.desc || it.blocks.map(([n, c]) => `${c} ${n}`).join(', ')}</div></div>
      <div class="sbuy">${owned ? '<span class="sown">Owned ✓</span>' : `<button type="button" class="${afford ? '' : 'poor'}">${it.price.toLocaleString()} <i></i></button>`}${have ? `<small>you have ${have}</small>` : ''}</div></div>`;
  }).join('');
  grid.querySelectorAll('.sitem').forEach(el => {
    const i = Number(el.dataset.i);
    el.addEventListener('mouseenter', () => { shop.sel = i; grid.querySelectorAll('.sitem').forEach(x => x.classList.toggle('sel', x === el)); });
    const btn = el.querySelector('button');
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); shop.sel = i; buy(); });
  });
  const cur = grid.children[shop.sel]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
}
function buy() {
  const it = shopItems()[shop.sel]; if (!it) return;
  if (it.item && inv.has(it.id)) { toast(`You already have the ${it.name}`); return; }
  if (treasure.purse < it.price) { toast(`Not enough coins: ${it.name} costs ${it.price.toLocaleString()}, you have ${treasure.purse.toLocaleString()}`); return; }
  treasure.purse -= it.price; treasure.save();
  if (it.item) inv.items.add(it.id);
  if (it.id === 'hammer') inv.hammer = HAMMER_LIFE;
  storyBought(it.id);
  if (it.blocks) giveBlocks(it.blocks.map(([n, c]) => [BID[n], c]));
  inv.save();
  sfx('buy');
  toast(`Bought: ${it.name}!${MOUNTS.includes(it.id) ? ' Press F / X (RIDE on phones) to ride; a second player presses it nearby to hop on the back.' : it.id === 'glider' ? ' Hold jump while falling to glide.' : ''}`);
  renderShop();
  for (const p of locals) p.hud.gear.textContent = gearIcons();
}
function openShop() {
  if (shop.open) { closeShop(); return; }
  shop.open = true; shop.el.hidden = false; document.body.classList.add('shopopen');
  if (locals[0]) locals[0].vel.set(0, 0, 0);
  if (document.pointerLockElement) { shop.unlock = true; paletteUnlock = true; document.exitPointerLock(); }
  renderShop();
}
function closeShop() {
  shop.open = false; shop.el.hidden = true; document.body.classList.remove('shopopen');
  if (shop.unlock) { shop.unlock = false; paletteUnlock = false; relocking = true; requestLock(); }
}
// ---------------------------------------------------------------------------
// Music: pick an album (or Auto, which fits where you are), set the volumes.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Controls: remap keyboard keys and controller buttons (pause screen → Controls).
// ---------------------------------------------------------------------------
const bindsUI = { el: document.getElementById('binds'), open: false, tab: 'keys', wait: null, padStart: null };
function renderBinds() {
  const el = bindsUI.el, keys = bindsUI.tab === 'keys';
  el.querySelectorAll('.mmodes button[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === bindsUI.tab));
  const list = keys ? KEY_ACTIONS : PAD_ACTIONS;
  el.querySelector('.blist').innerHTML = list.map(([a, label]) => {
    const waiting = bindsUI.wait === a;
    const cur = keys ? keyLabel(boundKey(a)) : PAD_NAMES[padOf(a)];
    return `<span>${label}</span><button type="button" data-a="${a}" class="${waiting ? 'wait' : ''}">${waiting ? (keys ? 'Press a key…' : 'Press a button…') : cur}</button>`;
  }).join('');
}
function openBinds() { bindsUI.open = true; bindsUI.wait = null; bindsUI.el.hidden = false; document.body.classList.add('bindsopen'); renderBinds(); }
function closeBinds() { bindsUI.open = false; bindsUI.wait = null; bindsUI.el.hidden = true; document.body.classList.remove('bindsopen'); }
// While waiting for a controller button: the first button newly pressed on any controller.
function pollPadBind() {
  if (!bindsUI.wait || bindsUI.tab !== 'pad') return;
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  const raw = pads.map(gp => gp.buttons.map(b => b.pressed || b.value > 0.5));
  if (!bindsUI.padStart) { bindsUI.padStart = raw; return; }
  for (let g = 0; g < raw.length; g++) for (let i = 0; i < raw[g].length; i++) {
    if (raw[g][i] && !(bindsUI.padStart[g] && bindsUI.padStart[g][i])) {
      setPad(bindsUI.wait, i); bindsUI.wait = null; bindsUI.padStart = null; renderBinds(); sfx('click');
      for (const gp of pads) padPrev.set(gp.index, padButtons(gp)); // don't let that press act in the menu
      return;
    }
  }
  bindsUI.padStart = raw.map((r, g) => r.map((v, i) => v && bindsUI.padStart[g] && bindsUI.padStart[g][i]));
}
{
  const el = bindsUI.el;
  for (const ev of ['click', 'touchend', 'mousedown', 'touchstart']) el.addEventListener(ev, e => e.stopPropagation());
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('mclose')) { closeBinds(); return; }
    if (b.dataset.tab) { bindsUI.tab = b.dataset.tab; bindsUI.wait = null; }
    else if (b.classList.contains('breset')) { resetBinds(); bindsUI.wait = null; toast('Controls reset to the defaults'); }
    else if (b.dataset.a) { bindsUI.wait = bindsUI.wait === b.dataset.a ? null : b.dataset.a; bindsUI.padStart = null; }
    renderBinds();
  });
  const btn = document.getElementById('bindsBtn');
  for (const ev of ['click', 'touchend', 'mousedown', 'touchstart']) btn.addEventListener(ev, e => e.stopPropagation());
  btn.addEventListener('click', () => openBinds());
  btn.addEventListener('touchend', e => { e.preventDefault(); openBinds(); });
}
// Keyboard remapping: a remapped key is turned into the default key it stands for before the game sees it; while
// waiting for a new key in the Controls panel, the next key press is taken for that.
for (const type of ['keydown', 'keyup']) addEventListener(type, e => {
  if (e.__remapped) return;
  if (bindsUI.open) {
    e.stopImmediatePropagation();
    if (type === 'keydown' && bindsUI.wait && bindsUI.tab === 'keys') {
      e.preventDefault();
      if (e.code !== 'Escape') { setKey(bindsUI.wait, e.code); sfx('click'); }
      bindsUI.wait = null; renderBinds();
    } else if (type === 'keydown' && e.code === 'Escape') closeBinds();
    return;
  }
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  const m = mapCode(e.code);
  if (m === e.code) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (m) { const ev = new KeyboardEvent(type, { code: m, key: e.key, repeat: e.repeat, bubbles: true }); ev.__remapped = true; window.dispatchEvent(ev); }
}, true);
const musicUI = { el: document.getElementById('music'), open: false, unlock: false };
function renderMusic() {
  const el = musicUI.el, playing = music.mode === 'off' ? null : music.playing;
  const now = music.mode === 'off' ? 'Music is off' : playing ? `Now playing: ${TRACKS.find(t => t.id === playing).title} · ${TRACKS.find(t => t.id === playing).mood}` : music.mode === 'auto' ? 'Auto: the next piece begins soon' : 'Starting soon';
  el.querySelector('.mnow').textContent = now;
  el.querySelectorAll('.mmodes button[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === music.mode));
  el.querySelector('.mgrid').innerHTML = TRACKS.map(t => `<button type="button" class="malb${music.mode === 'track' && music.trackId === t.id ? ' on' : ''}${playing === t.id ? ' playing' : ''}" data-id="${t.id}">
    <img src="${music.coverOf(t.id)}" alt=""><span class="mt">${t.title}</span><span class="mm">${t.mood}</span><span class="eq">♪ playing</span></button>`).join('');
}
function openMusic() {
  if (musicUI.open) { closeMusic(); return; }
  music.start();
  musicUI.open = true; musicUI.el.hidden = false; document.body.classList.add('musicopen');
  if (document.pointerLockElement) { musicUI.unlock = true; paletteUnlock = true; document.exitPointerLock(); }
  renderMusic();
}
function closeMusic() {
  musicUI.open = false; musicUI.el.hidden = true; document.body.classList.remove('musicopen');
  if (musicUI.unlock) { musicUI.unlock = false; paletteUnlock = false; relocking = true; requestLock(); }
}
{
  const el = musicUI.el;
  for (const ev of ['click', 'touchend', 'mousedown', 'touchstart']) el.addEventListener(ev, e => e.stopPropagation());
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    music.start();
    if (b.classList.contains('mclose')) { closeMusic(); return; }
    if (b.classList.contains('mnext')) music.next();
    else if (b.dataset.mode) music.choose(b.dataset.mode);
    else if (b.dataset.id) music.choose('track', b.dataset.id);
    sfx('click');
    renderMusic();
  });
  const vm = el.querySelector('#volMusic'), vs = el.querySelector('#volSfx');
  vm.value = Math.round(audio.vMusic * 100); vs.value = Math.round(audio.vSfx * 100);
  vm.addEventListener('input', () => { audio.setVolumes(vm.value / 100); music.save(); });
  vs.addEventListener('input', () => { audio.setVolumes(undefined, vs.value / 100); music.save(); sfx('coin'); });
  const btn = document.getElementById('musicBtn');
  for (const ev of ['click', 'touchend', 'mousedown', 'touchstart']) btn.addEventListener(ev, e => e.stopPropagation());
  btn.addEventListener('click', () => openMusic());
  btn.addEventListener('touchend', e => { e.preventDefault(); openMusic(); });
}
let musicT = 0;
function updateMusic(dt) {
  const p = locals[0]; if (!p) return;
  const u = Math.min(1, (p.skyU ?? 1) * 1.6), h = daySky.uniforms.sunDir.value.y;
  music.update({ under: u < 0.35, surface: u > 0.6 && p.pos.y < 110, high: p.pos.y > 110 && u > 0.6, night: daySky.night > 0.6, dusk: h > -0.08 && h < 0.16, day: daySky.day });
  musicT -= dt;
  if (musicUI.open && musicT <= 0) { musicT = 1; renderMusic(); }
}
function shopKey(e) {
  const n = shopItems().length, cols = innerWidth > 900 ? 2 : 1;
  if (e.code === 'Escape' || e.code === 'KeyB' || e.code === 'Tab') closeShop();
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') { shop.sel = Math.min(n - 1, shop.sel + cols); renderShop(); }
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') { shop.sel = Math.max(0, shop.sel - cols); renderShop(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { shop.sel = Math.min(n - 1, shop.sel + 1); renderShop(); }
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { shop.sel = Math.max(0, shop.sel - 1); renderShop(); }
  else if (e.code === 'Enter' || e.code === 'Space') buy();
  else if (e.code === 'BracketLeft' || e.code === 'BracketRight' || e.code === 'KeyQ' || e.code === 'KeyE') { shop.tab = shop.tab === 'gear' ? 'blocks' : 'gear'; shop.sel = 0; renderShop(); }
}
shop.el.querySelector('.sclose').addEventListener('click', e => { e.stopPropagation(); closeShop(); });
shop.el.querySelectorAll('.stabs button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); shop.tab = b.dataset.tab; shop.sel = 0; renderShop(); }));
for (const ev of ['mousedown', 'click', 'touchstart', 'touchend', 'wheel']) shop.el.addEventListener(ev, e => e.stopPropagation(), { passive: true });
const GEAR_ICON = { lantern: '🏮', boots: '👢', glider: '🪂', horse: '🐎', cloud: '☁️', carpet: '🧞' };
const gearIcons = () => [...inv.items].map(i => GEAR_ICON[i] || '').join(' ');

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
      if (world.get(nx, ny, nz) > 0) stack.push([nx, ny, nz]);
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
function useAction(p) {
  if (p.vehicle) exitVehicle(p, false);
  else if (targetIsChest(p)) openChest(p);
  else if (useTarget(p)) { /* portal, portal stone or zip line */ }
  else if (targetIsWheel(p)) enterVehicle(p, p.target);
}
// Never lose a car that's being driven when the page closes.
addEventListener('pagehide', () => { for (const p of locals) if (p.vehicle) exitVehicle(p, true); clearTimeout(saveTimer); saveNow(); });

// ---------------------------------------------------------------------------
// Gamepads (Xbox layout / standard mapping)
//   Left stick move · Right stick look · A jump
//   RT break · LT use / place (hold to repeat) · LB/RB change favourite slot · Y block palette
//   Menu pause · View switch split layout (side by side / top-bottom)
// ---------------------------------------------------------------------------
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
let padsNow = [];
const padPrev = new Map(); // per-gamepad previous button states (for press edges)
function padButtons(gp) { return mapPad(gp.buttons.map(b => b.pressed || b.value > 0.5)); } // in default button order (see binds.js)
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
// No pull-to-refresh or page dragging on phones (a swipe down used to reload the game): only menu lists scroll,
// and even they stop at their top and bottom, so the drag never carries on into the page.
let touchY = 0;
document.addEventListener('touchstart', e => { if (e.touches.length === 1) touchY = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchmove', e => {
  if (e.touches.length !== 1) { e.preventDefault(); return; } // no pinch-zooming the page either
  const dy = e.touches[0].clientY - touchY;
  let el = e.target instanceof Element ? e.target : null;
  while (el && el !== document.body) {
    const st = getComputedStyle(el);
    if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      const atTop = el.scrollTop <= 0, atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((dy > 0 && atTop) || (dy < 0 && atEnd)) e.preventDefault();
      return;
    }
    el = el.parentElement;
  }
  e.preventDefault();
}, { passive: false });
const goText = document.getElementById('goText');
// Pointer lock: the mouse turns the view without holding a button. One request at a time (a second one while the
// first is under way fails, e.g. Play plus going full screen), and a failure only means drag-to-look for good after
// several in a row with no success ever (a sandboxed frame that never allows it).
let lockPending = 0, lockFails = 0, lockEver = false;
function requestLock() {
  if (isTouch || pointerLockFailed || !canvas.requestPointerLock || document.pointerLockElement === canvas) return;
  if (lockPending && performance.now() - lockPending < 1500) return;
  lockPending = performance.now();
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { lockPending = 0; }
}
// In full screen, Esc comes to the game (it opens the menu) rather than leaving full screen (Chrome, Edge).
function keyboardLock(on) {
  const kb = navigator.keyboard; if (!kb || !kb.lock) return;
  try { if (on) { const r = kb.lock(['Escape']); if (r && r.catch) r.catch(() => {}); } else kb.unlock(); } catch (e) { /* not allowed */ }
}
function startPlaying(withMouse) {
  music.start(); // a tap or click: browsers let sound start now
  overlay.classList.add('hidden');
  running = true;
  for (const gp of padsNow) if (gp) padPrev.set(gp.index, padButtons(gp)); // the press that started play doesn't also act in it
  goFullscreen();
  keyboardLock(true);
  if (withMouse) requestLock();
}
function pause() {
  running = false;
  overlay.classList.remove('hidden');
  goText.textContent = isTouch ? '▶ Resume' : '▶ Resume · A';
  if (document.pointerLockElement) document.exitPointerLock();
  keyboardLock(false); // (on the pause screen Esc leaves full screen as usual)
}
goText.textContent = isTouch ? '▶ Play' : '▶ Play · A';
// Desktop: a click anywhere on the pause screen plays (except on its controls). Phones: only the Play button does,
// so you can scroll and change settings without being thrown into the game.
overlay.addEventListener('click', e => { if (e.target.closest('details, summary, select, input, label, button:not(#goText)')) return; if (isTouch && !e.target.closest('#goText')) return; startPlaying(true); });
overlay.addEventListener('touchend', e => { if (!e.target.closest('#goText')) return; e.preventDefault(); startPlaying(false); });
document.addEventListener('pointerlockchange', () => { lockPending = 0; if (document.pointerLockElement) { relocking = false; lockEver = true; lockFails = 0; } if (!document.pointerLockElement && running && !isTouch && !paletteUnlock && performance.now() - fsChanging > 1500) pause(); });
document.addEventListener('pointerlockerror', () => { lockPending = 0; if (relocking) { relocking = false; return; } if (++lockFails >= 3 && !lockEver) pointerLockFailed = true; }); // e.g. sandboxed iframe: use drag-to-look

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
  if (shop.open) { shopKey(e); return; }
  if (confirmUI.open && confirmUI.p === locals[0]) { if (e.repeat) return; if (e.code === 'KeyE' || e.code === 'Enter') closeConfirm(true); else if (['Escape', 'KeyQ', 'Backspace', 'Tab'].includes(e.code)) closeConfirm(false); return; }
  if (reader.open) { if (['Escape', 'KeyE', 'Enter', 'Tab'].includes(e.code)) closeReader(); else if (e.code === 'ArrowLeft' || e.code === 'KeyA') readerStep(-1); else if (e.code === 'ArrowRight' || e.code === 'KeyD') readerStep(1); return; }
  if (musicUI.open) { if (e.code === 'Escape' || e.code === 'KeyN') closeMusic(); return; }
  if (e.code === 'KeyN') { openMusic(); return; }
  if (exploreMap.isFull) {
    exploreMap.lastPad = false;
    if (e.code === 'KeyM') closeMap(0);
    else if (e.code === 'Tab') closeMap(1);
    else if (e.code === 'Escape') closeMap(1);
    else if (e.code === 'KeyC' || e.code === 'Space') exploreMap.view.follow = true;
    else if (e.code === 'KeyU') exploreMap.view.under = !exploreMap.view.under;
    else if (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'NumpadEnter') exploreMap.placeAtCrosshair();
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') exploreMap.zoom(1.4);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') exploreMap.zoom(1 / 1.4);
    return;
  }
  if (e.code === 'KeyQ') { if (p0.palOpen) closePalette(p0); else if (!p0.vehicle) openPalette(p0); return; }
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
  if (e.code === 'Escape') { pause(); return; } // (the menu)
  if (e.code === 'Tab') { exploreMap.mode = exploreMap.mode ? 0 : 1; exploreMap.close(exploreMap.mode); return; } // mini map on / off
  if (e.code === 'KeyV') toggleSplit();
  if (e.code === 'KeyB') { openShop(); return; }
  if (e.code === 'KeyF') toggleMount(locals[0]);
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyH') goHome(locals[0]);
  if (e.code === 'F3') { e.preventDefault(); document.body.classList.toggle('debug'); }
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
bindBtn('bMenu', () => pause());
bindBtn('bShop', () => openShop());
bindBtn('bCarpet', () => toggleMount(locals[0]));
setInterval(() => document.body.classList.toggle('hascarpet', MOUNTS.some(m => inv.has(m))), 1000);
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
    const trig = i => { const b = gp.buttons[padIndex(i)]; return b ? b.value || (b.pressed ? 1 : 0) : 0; };
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
    if (keys.has('KeyD')) mx += 1;
    if (keys.has('KeyA')) mx -= 1;
    mx += touchMove.x; mz -= touchMove.y;
    jump = keys.has('Space') || touchJump;
    down = keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ShiftLeft');
  }

  p.placeCd -= dt; p.breakCd -= dt;
  const pad = readPad(p);
  if (confirmUI.open && confirmUI.p === p) {
    mx = 0; mz = 0; jump = false;
    if (pad) { const { pressed } = pad; if (pressed(PAD.A)) closeConfirm(true); else if (pressed(PAD.B)) closeConfirm(false); }
  } else if (p.slot === 0 && reader.open) {
    mx = 0; mz = 0; jump = false;
    if (pad) { const { pressed } = pad; if (pressed(PAD.B) || pressed(PAD.A)) closeReader(); if (pressed(PAD.LB)) readerStep(-1); if (pressed(PAD.RB)) readerStep(1); }
  } else if (p.slot === 0 && shop.open) {
    mx = 0; mz = 0; jump = false;
    if (pad) {
      const { gp, pressed } = pad, ax = gp.axes, n = shopItems().length;
      const [, ly] = stick(ax[0] || 0, ax[1] || 0, 0.5);
      p.palNavT = (p.palNavT || 0) - dt;
      let d = 0; // the D-pad does nothing: the stick browses
      if (ly && p.palNavT <= 0) { d = Math.sign(ly); p.palNavT = 0.22; }
      if (d) { shop.sel = Math.max(0, Math.min(n - 1, shop.sel + d)); renderShop(); }
      if (pressed(PAD.LB) || pressed(PAD.RB)) { shop.tab = shop.tab === 'gear' ? 'blocks' : 'gear'; shop.sel = 0; renderShop(); }
      if (pressed(PAD.A)) buy();
      if (pressed(PAD.B) || pressed(PAD.Y)) closeShop();
    }
  } else if (p.slot === 0 && exploreMap.isFull && !p.palOpen) {
    // Full-screen map open: the player stands still; the controller moves and zooms the map.
    mx = 0; mz = 0; jump = false;
    if (pad) {
      const { gp, now, pressed } = pad, ax = gp.axes;
      const [lx, ly, lm] = stick(ax[0] || 0, ax[1] || 0, 0.15);
      const [rx, ry] = stick(ax[2] || 0, ax[3] || 0, 0.2);
      const sc = exploreMap.view.scale;
      if (lm || rx || ry) { exploreMap.pan((lx + rx) * 420 * dt / sc, (ly + ry) * 420 * dt / sc); exploreMap.lastPad = true; }
      const trig = i => { const b = gp.buttons[padIndex(i)]; return b ? b.value || (now[i] ? 1 : 0) : 0; };
      const z = trig(PAD.RT) - trig(PAD.LT);
      if (Math.abs(z) > 0.05) { exploreMap.zoom(Math.pow(3, z * dt)); exploreMap.lastPad = true; }
      if (pressed(PAD.LB)) exploreMap.zoom(1 / 1.5);
      if (pressed(PAD.RB)) exploreMap.zoom(1.5);
      if (pressed(PAD.Y)) exploreMap.view.follow = true;
      if (pressed(PAD.A)) { exploreMap.lastPad = true; exploreMap.placeAtCrosshair(); }
      if (pressed(PAD.X)) exploreMap.view.under = !exploreMap.view.under;
      if (pressed(PAD.B)) { exploreMap.lastPad = true; closeMap(1); }
      if (pressed(PAD.MENU)) pause();
    }
  } else if (p.palOpen) {
    // Browsing the palette: the player stands still; stick / D-pad / LB RB move the cursor.
    mx = 0; mz = 0; jump = false;
    if (pad) {
      const { gp, pressed } = pad, ax = gp.axes;
      const [lx, ly] = stick(ax[0] || 0, ax[1] || 0, 0.4);
      if (pressed(PAD.LB)) cycleTab(p, -1);
      if (pressed(PAD.RB)) cycleTab(p, 1);
      // Left / right: one item (holding repeats, gently speeding up). Up / down: category. LT / RT: 10 items.
      let d = 0;
      const dg = 0;
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
    if (pressed(PAD.A) && targetIsWheel(p)) { enterVehicle(p, p.target); return; }
    if (pressed(PAD.A) && targetIsChest(p)) { openChest(p); return; }
    if (pressed(PAD.A) && targetIsUsable(p)) { useTarget(p); return; }
    if (pressed(PAD.Y) && p.slot === 0) { openShop(); return; }
    if (pressed(PAD.X)) toggleMount(p);
    jump = jump || now[PAD.A];
    // B: the full map, zoomed in on you (on the magic carpet or swimming, hold B to go down instead).
    if (p.flying || p.swimming) down = down || now[PAD.B];
    else if (pressed(PAD.B) && p.slot === 0) { openFullMap(p); return; }
    if (pressed(PAD.LB)) cycleBlock(p, -1);
    if (pressed(PAD.RB)) cycleBlock(p, 1);
    // RT breaks (with the hammer), LT uses / places. Hold to repeat.
    if (now[PAD.LT]) { const first = pressed(PAD.LT); if (first || p.placeCd <= 0) { placeBlock(p); p.placeCd = first ? 0.32 : 0.16; } }
    if (now[PAD.RT]) { const first = pressed(PAD.RT); if (first || p.breakCd <= 0) { breakBlock(p); p.breakCd = first ? 0.32 : 0.16; } }
    if (pressed(PAD.VIEW)) toggleSplit();
    if (pressed(PAD.MENU)) pause();
  }
  // ← → turn (when no menu or map is open).
  if (p.slot === 0 && !p.palOpen && !shop.open && !reader.open && !confirmUI.open && !exploreMap.isFull) {
    const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
    if (turn) p.yaw += turn * CFG.keyYawSpeed * dt;
  }
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }

  fwd.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  right.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
  const speed = CFG.walkSpeed;
  wish.copy(fwd).multiplyScalar(mz).addScaledVector(right, mx).multiplyScalar(speed);

  const v = p.vel;
  const fx = Math.floor(p.pos.x), fz = Math.floor(p.pos.z);
  const swim = isWater(world.get(fx, Math.floor(p.pos.y + 0.3), fz)) || isWater(world.get(fx, Math.floor(p.pos.y + 1.1), fz));
  const headWet = isWater(world.get(fx, Math.floor(p.pos.y + 1.5), fz));
  p.swimming = swim;
  // Until the ground under a player has streamed in, they wait in place.
  const waiting = world.get(fx, Math.floor(p.pos.y), fz) < 0 || world.get(fx, Math.floor(p.pos.y) - 1, fz) < 0;
  if (waiting) v.set(0, 0, 0);
  else if (p.ride) {
    // A passenger: sit behind the rider, look around freely; jump hops off.
    const q = p.ride;
    if (!locals.includes(q) || !q.mount) { leaveSeat(p); }
    else {
      p.pos.set(q.pos.x + Math.sin(q.yaw) * 0.85, q.pos.y + 0.02, q.pos.z + Math.cos(q.yaw) * 0.85);
      v.set(0, 0, 0); p.onGround = true; p.ready = true;
      if (jump && !p.prevJump) leaveSeat(p);
    }
    p.prevJump = jump;
  } else if (p.zip) {
    // Riding a zip line: hang under the rope and slide to the far anchor.
    const z = p.zip, len = z.a.distanceTo(z.b);
    z.t = Math.min(1, z.t + dt * 14 / Math.max(1, len));
    p.pos.lerpVectors(z.a, z.b, z.t); p.pos.y -= 2.1; v.set(0, 0, 0);
    if (z.t >= 1) { p.pos.copy(z.b); p.pos.y -= 0.2; p.zip = null; }
  } else {
    p.ready = true;
    const fly = p.flying && (p.mount === 'carpet' || p.mount === 'cloud') && inv.has(p.mount);
    const horse = p.mount === 'horse' && inv.has('horse');
    p.gliding = !fly && !swim && inv.has('glider') && jump && !p.onGround && v.y < -1;
    if (p.gliding) { wish.copy(fwd).multiplyScalar(9).addScaledVector(right, mx * 4); }
    const k = 1 - Math.exp(-dt * (p.onGround ? 16 : swim ? 7 : fly ? 6 : p.gliding ? 1.5 : 5));
    const sp = swim ? (horse ? 1 : 0.65) : fly ? (p.mount === 'cloud' ? 1.7 : 2.4) : horse ? 2.3 : 1;
    v.x += (wish.x * sp - v.x) * k; v.z += (wish.z * sp - v.z) * k;
    if (fly) {
      let up = (jump ? 1 : 0) - (down ? 1 : 0);
      if (p.mount === 'cloud') {
        // The cloud stays low: at most 12 blocks over the ground below it.
        let gy = Math.floor(p.pos.y); for (let k = 0; k < 48 && gy > 0 && !world.isSolid(Math.floor(p.pos.x), gy - 1, Math.floor(p.pos.z)); k++) gy--;
        if (p.pos.y > gy + 12 && up > 0) up = 0;
        if (p.pos.y > gy + 12.5) up = -0.6;
      }
      v.y += (up * 9 - v.y) * (1 - Math.exp(-dt * 6));
    } else if (swim) {
      // Water: sink slowly, hold jump to swim up; at the edge, jump climbs out.
      v.y = Math.max(-3, v.y - CFG.gravity * 0.22 * dt);
      if (jump) v.y = Math.min(4.2, v.y + 28 * dt);
      if (jump && !headWet && p.hitWall) v.y = CFG.jumpVelocity;
    } else {
      v.y = Math.max(-60, v.y - CFG.gravity * dt);
      if (jump && p.onGround) { v.y = inv.has('boots') || horse ? 11.6 : CFG.jumpVelocity; p.onGround = false; }
      if (p.gliding) v.y = Math.max(v.y, -2.4);
    }
    // Collide in small substeps so fast movement never tunnels through blocks.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt / 0.2));
    const sdt = dt / steps;
    let grounded = p.onGround;
    p.onGround = false; p.hitWall = false;
    for (let i = 0; i < steps; i++) {
      for (const ax of ['x', 'z']) {
        const d = v[ax] * sdt;
        if (!d) continue;
        const ox = p.pos.x, oy = p.pos.y, oz = p.pos.z;
        if (moveAxis(p, ax, d)) {
          p.pos.set(ox, oy, oz);
          if (tryStep({ onGround: grounded, pos: p.pos }, ax, d)) { p.stepEase = Math.min(1.2, (p.stepEase || 0) + p.pos.y - oy); continue; }
          moveAxis(p, ax, d); v[ax] = 0; p.hitWall = true;
        }
      }
      const dy = v.y * sdt;
      if (moveAxis(p, 'y', dy)) { if (dy < 0) { p.onGround = true; grounded = true; } v.y = 0; }
    }
    if (!p.onGround && v.y <= 0 && collidesAt(p.pos.x, p.pos.y - 0.02, p.pos.z)) p.onGround = true;
  }

  // Camera: head bob on the ground.
  const hs = Math.hypot(v.x, v.z);
  if (p.onGround && hs > 0.5) p.bob += dt * Math.min(hs, 16) * 0.9; else p.bob *= 0.9;
  const bobY = p.onGround ? Math.sin(p.bob * 2) * 0.04 * Math.min(1, hs / 10) : 0;
  const cam = p.camera;
  p.stepEase = (p.stepEase || 0) * Math.exp(-dt * 14); // a step up lifts the view smoothly, not in one jerk
  cam.position.set(p.pos.x, p.pos.y + CFG.eyeHeight + bobY - p.stepEase + (MOUNT_EYE[mountOf(p)] || 0), p.pos.z);
  cam.rotation.set(p.pitch, p.yaw, 0);
  p.fovBoost *= Math.exp(-dt * 6);

  // Avatar (what the other players see)
  p.avatar.group.position.copy(p.pos);
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
  updateZipAim(p, cam);

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

// Menus with a controller (the pause screen, Music and Controls): the left stick or D-pad moves a gold outline
// between buttons, sliders, boxes and lists; A presses, left / right moves a slider or changes a choice, the right
// stick scrolls, B goes back, Menu plays. Physical buttons are used here, whatever the game's remapping.
const padNav = { el: null, sig: '', back: null, shown: false, dir: '', hold: 0, prev: new Map() };
function navRoot() { return running ? null : bindsUI.open ? bindsUI.el : musicUI.open ? musicUI.el : overlay.querySelector('.card'); }
function navItems(root) {
  return [...root.querySelectorAll('button, input, select, summary')].filter(e => !e.disabled && e.getClientRects().length && e.offsetParent !== null);
}
const navSig = e => e.id || e.dataset.a || e.dataset.id || e.dataset.mode || e.dataset.tab || e.className || e.textContent;
function navShow(el) {
  for (const o of document.querySelectorAll('.padfocus')) if (o !== el) o.classList.remove('padfocus');
  padNav.el = el; padNav.sig = el ? navSig(el) : '';
  if (el) { el.classList.add('padfocus'); el.scrollIntoView({ block: 'nearest' }); }
}
function navHide() { for (const o of document.querySelectorAll('.padfocus')) o.classList.remove('padfocus'); padNav.shown = false; }
// Where the outline starts: back on the button that opened a panel, else Play, else what's selected, else the top.
function navDefault(root, items) {
  const back = padNav.back && root === overlay.querySelector('.card') ? document.getElementById(padNav.back) : null;
  if (back) padNav.back = null;
  return back || (root.contains(goText) ? goText : null) || items.find(e => e.classList.contains('on') && e.dataset.id) || items.find(e => e.classList.contains('on')) || items[0];
}
// Up / down goes to the nearest row in that direction, then the closest control in it; left / right stays in the row.
function navMove(items, dir) {
  const c = padNav.el.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
  const cand = [];
  for (const e of items) {
    if (e === padNav.el) continue;
    const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const along = dir === 'r' ? r.left - c.right + c.width / 2 - 1 : dir === 'l' ? c.left - r.right + c.width / 2 - 1 : dir === 'd' ? y - cy : cy - y;
    if (along < 6) continue;
    if ((dir === 'l' || dir === 'r') && !(r.top < c.bottom - 2 && r.bottom > c.top + 2)) continue; // same row only
    cand.push({ e, along, across: dir === 'l' || dir === 'r' ? Math.abs(y - cy) : Math.abs(x - cx) });
  }
  if (!cand.length) return;
  const near = Math.min(...cand.map(k => k.along));
  const row = cand.filter(k => k.along <= near + 14);
  row.sort((p, q) => p.across - q.across || p.along - q.along);
  navShow(row[0].e); sfx('tap');
}
// Left / right on a slider or a dropdown changes it instead of moving.
function navAdjust(el, dir) {
  if (el.tagName === 'INPUT' && el.type === 'range') {
    const min = +el.min || 0, max = +el.max || 100, st = Math.max(+el.step || 1, (max - min) / 20);
    el.value = Math.min(max, Math.max(min, +el.value + (dir === 'r' ? st : -st)));
  } else if (el.tagName === 'SELECT') {
    el.selectedIndex = (el.selectedIndex + (dir === 'r' ? 1 : -1) + el.options.length) % el.options.length;
  } else return false;
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  sfx('tap'); return true;
}
function navPress(el) {
  if (el === goText) { startPlaying(false); return; }
  if (el.id === 'musicBtn' || el.id === 'bindsBtn') padNav.back = el.id;
  if (el.tagName === 'SELECT') { navAdjust(el, 'r'); return; }
  if (el.tagName === 'INPUT' && el.type === 'range') return;
  el.click();
}
function navBack() {
  if (bindsUI.open) { if (bindsUI.wait) { bindsUI.wait = null; renderBinds(); } else closeBinds(); }
  else if (musicUI.open) closeMusic();
  else return;
  sfx('click');
}
function updatePadNav(dt) {
  const root = navRoot();
  const pads = padsNow.filter(Boolean);
  if (!root) { for (const gp of pads) padNav.prev.set(gp.index, gp.buttons.map(b => b.pressed)); navHide(); return; }
  const waitingPad = bindsUI.open && bindsUI.wait && bindsUI.tab === 'pad';
  let dir = '', a = false, b = false, menu = false, scroll = 0;
  for (const gp of pads) {
    const now = gp.buttons.map(x => x.pressed || x.value > 0.5), prev = padNav.prev.get(gp.index) || now;
    padNav.prev.set(gp.index, now);
    const hit = i => now[i] && !prev[i];
    a = a || hit(0); b = b || hit(1); menu = menu || hit(9);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (now[12] || ay < -0.55) dir = 'u'; else if (now[13] || ay > 0.55) dir = 'd';
    else if (now[14] || ax < -0.55) dir = 'l'; else if (now[15] || ax > 0.55) dir = 'r';
    const ry = gp.axes[3] || 0; if (Math.abs(ry) > 0.25) scroll += ry;
  }
  if (waitingPad) { padNav.dir = dir; return; } // the next button press is being taken for the binding
  // Keep the outline on the same control when a panel redraws itself.
  const items = navItems(root);
  if (padNav.el && !root.contains(padNav.el)) padNav.el = items.find(e => navSig(e) === padNav.sig) || null;
  // The pause screen itself: Start or B plays on at once, and so does A until you've moved to a button.
  if (!bindsUI.open && !musicUI.open && (menu || b || (a && !padNav.shown))) { navHide(); startPlaying(false); return; }
  const used = a || b || menu || dir || scroll;
  if (used && !padNav.shown) {
    padNav.shown = true;
    navShow(padNav.el && items.includes(padNav.el) ? padNav.el : navDefault(root, items));
    padNav.dir = dir; return; // the first touch just shows where you are
  }
  if (!padNav.shown) return;
  if (!padNav.el || !items.includes(padNav.el)) navShow(navDefault(root, items));
  else padNav.el.classList.add('padfocus');
  if (scroll) root.scrollTop += scroll * 900 * dt;
  // Held directions repeat: once, then after a short wait, then steadily.
  if (!dir) { padNav.dir = ''; padNav.hold = 0; }
  else if (dir !== padNav.dir) { padNav.dir = dir; padNav.hold = 0.38; }
  else { padNav.hold -= dt; if (padNav.hold > 0) dir = ''; else padNav.hold = 0.11; }
  if (dir && padNav.el) { if (!((dir === 'l' || dir === 'r') && navAdjust(padNav.el, dir))) navMove(items, dir); }
  if (a && padNav.el) navPress(padNav.el);
  else if (b) navBack();
  else if (menu) { if (bindsUI.open) closeBinds(); else if (musicUI.open) closeMusic(); else startPlaying(false); }
}
// The outline goes away when the mouse or a finger takes over (browsers send still 'moves' after scrolling: ignored).
addEventListener('mousemove', e => { if (padNav.shown && Math.abs(e.movementX) + Math.abs(e.movementY) > 3) navHide(); }, { passive: true });
addEventListener('touchstart', () => { if (padNav.shown) navHide(); }, { passive: true });

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const info = document.getElementById('info');
const perfFps = document.getElementById('perfFps'), perfLoad = document.getElementById('perfLoad');
let last = performance.now(), fpsT = 0, fpsN = 0, fps = 0, hudT = 0, ringFor = 0;
const clearKeep = new THREE.Color();
const UNDER_FOG = new THREE.Color(0x07060a), tmpFog = new THREE.Color(), tmpFog2 = new THREE.Color();
// The deep: in the tunnels and caverns far below, light glows in the colours of the place (crystal blue and white,
// amethyst purple, mushroom teal and green, or all of them), the air shimmers with motes, and in a cavern the
// view opens right across it.
const DEEP_COL = [new THREE.Color(0.55, 0.8, 1.0), new THREE.Color(0.78, 0.56, 1.0), new THREE.Color(0.42, 1.0, 0.72), new THREE.Color(0.55, 0.88, 1.0), new THREE.Color(1.0, 0.5, 0.85), new THREE.Color(0.45, 1.0, 0.55)];
const motes = new Motes(scene), deepCol = new THREE.Color(), deepFog = new THREE.Color();
const deepState = { cave: 0, cavern: 0, col: new THREE.Color(0.55, 0.88, 1.0), t: 0, plan: null };
function updateDeep(p, dt) {
  const rx = Math.floor(p.pos.x / RS), rz = Math.floor(p.pos.z / RS);
  deepState.t -= dt;
  if (deepState.t <= 0 || !deepState.plan || deepState.plan.rx !== rx || deepState.plan.rz !== rz) { deepState.t = 0.5; deepState.plan = regionPlan(rx, rz, CFG.seed); }
  const plan = deepState.plan, d = deepInfo(plan), y = p.pos.y;
  const inCavern = !!d && y < d.ceil + 2 && Math.hypot((p.pos.x - d.cx) / CAV_RX, (p.pos.z - d.cz) / CAV_RZ) < 1.05;
  const want = inCavern ? 1 : y < 36 ? 0.7 : 0, k = 1 - Math.exp(-dt * 1.5);
  deepState.cave += (want - deepState.cave) * k;
  deepState.cavern += ((inCavern ? 1 : 0) - deepState.cavern) * k;
  if (want) deepState.col.lerp(DEEP_COL[biomeOf(plan)], k);
  motes.set(d && y < d.ceil + 2 && Math.hypot(p.pos.x - d.cx, p.pos.z - d.cz) < 160 ? { key: d.key, cx: d.cx, cz: d.cz, rx: CAV_RX - 6, rz: CAV_RZ - 6, floor: DEEP_FLOOR, top: d.ceil, biome: biomeOf(plan) } : null);
}

// Never more than 60 frames a second, even on faster screens: smooth enough, and kind to the fans.
let nextFrame = 0;
function frame(now) {
  if (now < nextFrame - 2) { requestAnimationFrame(frame); return; }
  nextFrame = Math.max(nextFrame + 1000 / 60, now - 1000 / 60);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  syncPads();

  updatePadNav(dt); // menus (does nothing while playing, but keeps its button states fresh)
  if (running) {
    for (const p of locals) updatePlayer(p, dt);
    checkArrival();
    updateTrails(dt);
    updateLanding();
    if (locals[0]) updateDeep(locals[0], dt);
  } else {
    // Menu: controllers move around it (see updatePadNav); keep the game's edge state fresh for when it resumes.
    if (bindsUI.open) pollPadBind();
    for (const gp of padsNow) if (gp) padPrev.set(gp.index, padButtons(gp));
    for (const p of locals) {
      if (p.vehicle) continue;
      p.yaw += dt * 0.05;
      p.camera.position.set(p.pos.x, p.pos.y + CFG.eyeHeight, p.pos.z);
      p.camera.rotation.set(p.pitch, p.yaw, 0);
      p.highlight.visible = false;
    }
  }
  remotePlayers.update(dt);

  // Stream the world around every player, finish edits, upload textures.
  world.update(locals.map(p => [p.pos.x, p.pos.z]), CFG.viewChunks);
  world.flushDirty();
  // The deep (caverns, their castles, the tunnel network) isn't drawn while everyone is up on the ground, apart
  // from right round you; it all comes back the moment you go below ground level.
  world.setDeepNear(locals.length && locals.every(p => p.pos.y > GROUND - 0.5) ? locals.map(p => [Math.floor(p.pos.x / 32), Math.floor(p.pos.z / 32)]) : null);
  textures.flush(now);
  const time = now / 1000;
  chunkUniforms.time.value = time;
  const got = treasure.update(dt, time, running ? locals.filter(p => !p.vehicle).map(p => p.pos) : []);
  if (got) toast(`+${got} coin${got > 1 ? 's' : ''}`);
  for (const p of locals) if (p.ready) exploreMap.reveal(p.pos.x, p.pos.y, p.pos.z);
  if (locals[0]) exploreMap.scout(locals[0].pos.x, locals[0].pos.z);
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.2;
    for (const p of locals) {
      p.hud.purse.textContent = treasure.purse.toLocaleString(); p.hud.purseInfo.textContent = `${treasure.opened.size} chest${treasure.opened.size === 1 ? '' : 's'}`;
      const gi = gearIcons(); if (p.hud.gear.textContent !== gi) p.hud.gear.textContent = gi;
      updateHammerBadge(p);
      p.hud.root.classList.toggle('gliding', !!p.gliding);
    }
    if (shop.open) shop.el.querySelector('.spurse').textContent = treasure.purse.toLocaleString();
  }

  // Light and haze: from the living sky (sun, moon, time of day), or from the chosen photo sky.
  const L = SKY_LIGHT[skyKind] || SKY_LIGHT.day;
  const fogBase = tmpFog2;
  let minL = 0.04;
  if (skyKind === 'dynamic') {
    daySky.update(running ? dt : dt * 0.3, time);
    chunkUniforms.dayColor.value.copy(daySky.ambient);
    chunkUniforms.sunColor.value.copy(daySky.direct);
    chunkUniforms.sunDir.value.copy(daySky.lightDir);
    fogBase.copy(daySky.horizon);
    hemi.color.copy(daySky.ambient).multiplyScalar(1.6); hemi.groundColor.copy(daySky.ambient).multiplyScalar(0.5); hemi.intensity = 1;
    sun.color.copy(daySky.direct); sun.intensity = 2.2; sun.position.copy(daySky.lightDir);
    minL = 0.03 + 0.01 * daySky.day;
  } else {
    const DAY = { day: [1.05, 1.03, 1.0], sunset: [0.95, 0.74, 0.6], night: [0.3, 0.36, 0.6] }[skyKind] || [1, 1, 1];
    chunkUniforms.dayColor.value.setRGB(DAY[0], DAY[1], DAY[2]);
    chunkUniforms.sunColor.value.setRGB(0, 0, 0);
    fogBase.set(L.fog[0]);
    minL = skyKind === 'night' ? 0.025 : 0.04;
  }
  if (ringFor !== CFG.viewBlocks) {
    ringFor = CFG.viewBlocks;
    farGround.geometry.dispose();
    farGround.geometry = new THREE.RingGeometry(Math.max(6, CFG.viewBlocks - 6), 12000, 96, 1);
  }
  // How far the real chunks reach right now (while they stream in, the far copies fill the gap).
  const loadedR = Math.max(8, Math.min(CFG.viewBlocks, world.missR));
  lodT -= dt;
  if (lodT <= 0 && locals[0]) { lodT = 0.5; farStructs.update(locals[0].pos.x, locals[0].pos.z, LOD_RADIUS, loadedR, 6); }

  // Render each player's region: the far pass (sky, distant labyrinth and castles), then the world.
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  const H = innerHeight;
  for (const p of locals) {
    const { x, y, w, h } = p.vp;
    fitCamera(p);
    const cp = p.camera.position;
    const sky = (world.light(Math.floor(cp.x), Math.floor(cp.y), Math.floor(cp.z)) >> 4) / 15;
    p.skyU = p.skyU === undefined ? sky : p.skyU + (sky - p.skyU) * (1 - Math.exp(-dt * 2.5));
    const u = Math.min(1, p.skyU * 1.6);
    tmpFog.copy(fogBase);
    const cave = deepState.cave * (1 - u), cav = deepState.cavern * (1 - u);
    deepFog.copy(UNDER_FOG).lerp(deepCol.copy(deepState.col).multiplyScalar(0.09), cave);
    tmpFog.lerp(deepFog, 1 - u);
    chunkUniforms.fogColor.value.copy(tmpFog);
    chunkUniforms.glowColor.value.copy(chunkUniforms.torchColor.value).lerp(deepState.col, cave);
    chunkUniforms.caveFill.value.copy(deepState.col).multiplyScalar(0.08 + 0.2 * cav).multiplyScalar(cave);
    motes.update(time, cave);
    chunkUniforms.minLight.value = inv.has('lantern') && u < 0.6 ? 0.2 : minL;
    const surfaceFar = 60000;
    chunkUniforms.fogFar.value = (60 + 200 * cav) + (surfaceFar - 60 - 200 * cav) * u * u; // (a cavern: see right across it)
    chunkUniforms.fogNear.value = chunkUniforms.fogFar.value * (0.25 + 0.5 * u); // clear view almost to the edge
    farUniforms.center.value.set(p.pos.x, p.pos.z); farUniforms.inner.value = loadedR;
    lodUniforms.clipCenter.value.set(p.pos.x, p.pos.z); lodUniforms.clipInner.value = loadedR;
    chunkUniforms.clipCenter.value.set(p.pos.x, p.pos.z); chunkUniforms.clipOuter.value = loadedR; // real blocks stop at the view distance
    farRing.position.set(p.pos.x, G + 3, p.pos.z); farRing.scale.set(loadedR, 6, loadedR);
    if (p === locals[0]) updateFarMap(p);
    scene.fog.color.copy(tmpFog); scene.fog.near = chunkUniforms.fogNear.value; scene.fog.far = chunkUniforms.fogFar.value;
    scene.backgroundIntensity = (bgIntensity ?? 1) * (0.15 + 0.85 * u);
    skyUniforms.intensity.value = bgIntensity * (0.15 + 0.85 * u); skyUniforms.horizon.value.copy(tmpFog);
    daySky.uniforms.brightness.value = 0.15 + 0.85 * u;
    skyDome.position.copy(p.camera.position); daySky.mesh.position.copy(p.camera.position);
    farGround.position.set(p.pos.x, G - 0.3, p.pos.z);
    renderer.setViewport(x, H - y - h, w, h);
    renderer.setScissor(x, H - y - h, w, h);
    p.camera.updateMatrixWorld();
    farCam.fov = p.camera.fov; farCam.aspect = p.camera.aspect; farCam.updateProjectionMatrix();
    farCam.position.copy(p.camera.position); farCam.quaternion.copy(p.camera.quaternion); farCam.updateMatrixWorld();
    farUniforms.uVP.value.multiplyMatrices(farCam.projectionMatrix, farCam.matrixWorldInverse);
    farUniforms.pixAngle.value = 2 * Math.tan(THREE.MathUtils.degToRad(farCam.fov / 2)) / Math.max(1, h * pr);
    if (u < 0.02 && cp.y < GROUND - 4) { // underground: no sky and no far labyrinth, just the dark
      renderer.getClearColor(clearKeep); const ca = renderer.getClearAlpha();
      renderer.setClearColor(tmpFog, 1); renderer.clear(); renderer.setClearColor(clearKeep, ca);
    } else renderer.render(scene, farCam);
    renderer.clearDepth();
    const bg = scene.background; scene.background = null; renderer.autoClear = false;
    renderer.render(scene, p.camera);
    renderer.autoClear = true; scene.background = bg;
  }
  renderPreviews(now);
  if (exploreMap.isFull) panMap(dt);
  updateMusic(dt);
  updateMounts(dt);
  updateRoar(dt);
  if (running) gates.update(dt, locals, CFG.viewBlocks + 6);
  updateTorch(dt, now / 1000);
  exploreMap.draw(locals, { x: homeSpot().pos.x, z: homeSpot().pos.z - 13 });
  for (const p of locals) drawCompass(p);

  // Frame rate over real time (dt is capped, so it can't be used to count slow frames).
  fpsN++; if (!fpsT) fpsT = now;
  if (now - fpsT > 500) {
    fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now;
    // High quality graphics too much for this device? Off again after a few slow seconds of play.
    // Pause screen: a live frame rate, and whether everything in view has finished loading, so view settings can
    // be tried out and judged.
    if (!running) {
      perfFps.textContent = `${fps} fps`;
      perfFps.className = fps >= 50 ? 'good' : fps >= 30 ? 'ok' : 'bad';
      const building = world.pending.size, far = farStructs.pending;
      perfLoad.textContent = world.missR < CFG.viewBlocks || building ? `loading the world… (${building} chunks building)` : far ? `loading distant castles… (${far} to go)` : '✓ everything in view is loaded';
    }
    // Automatic view distance (the resolution is never lowered): as far as keeps a steady 60 fps.
    if (viewAuto.on && !document.hidden) {
      const loading = world.pending.size > 0 || world.missR < CFG.viewBlocks;
      const i = viewStep(), ni = stepAutoView(viewAuto.ctl, i, fps, loading, now);
      if (ni !== i) setView(VIEW_STEPS[ni]);
    }
    const lines = [`${fps} fps   ${Math.round(innerWidth * pr)}×${Math.round(innerHeight * pr)}`];
    for (const p of locals) lines.push(`P${p.slot + 1} ${p.vehicle ? `DRIVE ${Math.abs(p.vehicle.speed).toFixed(0)} b/s` : 'WALK'} ${p.gamepadIndex !== null ? '🎮' : '⌨'}  x ${p.pos.x.toFixed(0)} y ${p.pos.y.toFixed(0)} z ${p.pos.z.toFixed(0)}`);
    const st = world.stats, n = Math.max(1, st.n);
    lines.push(`chunks ${world.cols.size} (+${world.pending.size})  gen ${(st.gen / n).toFixed(0)} light ${(st.light / n).toFixed(0)} mesh ${(st.mesh / n).toFixed(0)} ms   sky ${skyStatus}`);
    lines.push(`coins ${treasure.purse}  chests opened ${treasure.opened.size}  view ${CFG.viewBlocks}  far castles ${farStructs.count}  time ${(daySky.tod * 24).toFixed(1)}h`);
    info.textContent = lines.join('\n');
  }
  requestAnimationFrame(frame);
}

loadSaved();
// The machete was retired (the hammer breaks everything now): give back what it cost.
if (inv.items.has('machete')) { inv.items.delete('machete'); inv.save(); treasure.purse += 300; treasure.save(); setTimeout(() => toast('The machete is gone: the hammer breaks everything now. Your 300 coins are back'), 5000); }
setSky('dynamic', true); // photo skies are no longer offered
addLocal();
if (inv.fresh) setTimeout(() => toast('Someone left you a letter. Select it on your hotbar (slot 1) to read it'), 4000);
addEventListener('gamepadconnected', () => { if (!running) goText.textContent = '▶ Play · A'; });
requestAnimationFrame(frame);
