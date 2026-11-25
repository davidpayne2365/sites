// Skyforge Valley — a cozy top-down 2D take on Skyforge: build with hundreds of blocks, farm wheat,
// day / night, and local split-screen co-op with Xbox controllers. Plain canvas 2D, no libraries.
import { POLYHAVEN } from './photo_textures.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CFG = {
  walkSpeed: 4.6,          // tiles / second
  radius: 0.28,            // player collision radius (tiles)
  reach: 4,                // mouse targeting range (tiles)
  tilesTall: 13,           // how many tiles fit vertically in a player's view
  dayLength: 8 * 60,       // seconds per in-game day
  cropStage: 8,            // seconds per wheat growth stage (8 stages)
  maxLocalPlayers: 4,
  padYawDead: 0.18,
  saveKey: 'skyforge2d.world.v1',
};
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

// ---------------------------------------------------------------------------
// Items: tools + blocks. Block ids are positions in ITEMS (saved worlds store them), so only append.
// Textures: Kenney Voxel Pack (CC0), Minetest Game (CC BY-SA 3.0, see textures/minetest/licenses), Poly Haven (CC0).
// ---------------------------------------------------------------------------
const K = n => `textures/blocks/${n}.png`, M = n => `textures/minetest/${n}.png`, P = n => `textures/photo/${n}.jpg`;
const TOOLS = [
  { id: 'hoe', name: 'Hoe', icon: K('hoe'), group: 'Tools' },
  { id: 'seeds', name: 'Wheat Seeds', icon: K('wheat_seed'), group: 'Tools' },
];
const ITEMS = []; // blocks
function block(group, name, top, side = top, opt = {}) {
  ITEMS.push({ id: ITEMS.length + 1, name, top, side, group, glow: !!opt.glow, see: !!opt.see, icon: top });
}
[
  ['Grass', P('leafy_grass'), P('forrest_ground_01')], ['Stone', P('rock_01')], ['Dirt', P('brown_mud_leaves_01')],
  ['Planks', P('wood_floor')], ['Log', P('rough_wood'), P('bark_brown_02')], ['Brick', P('red_brick')], ['Glass', K('glass'), K('glass'), { see: true }],
  ['Sand', P('coast_sand_01')], ['Leaves', K('leaves'), K('leaves'), { see: true }], ['Water', K('water'), K('water'), { see: true }],
  ['Lava', K('lava'), K('lava'), { glow: true }], ['Mese Lamp', M('meselamp'), M('meselamp'), { glow: true }],
  ['Treasure Chest', M('chest_top'), M('chest_front')], ['Bookshelf', K('wood'), M('bookshelf')], ['TNT', M('tnt_top'), M('tnt_side')],
  ['Cobblestone', K('cobble')], ['Stone Bricks', K('stone_brick')], ['Gold Block', M('gold_block')], ['Diamond Block', M('diamond_block')],
  ['Steel Block', M('steel_block')], ['Obsidian', K('obsidian')], ['Snow', K('snow')], ['Ice', K('ice')], ['Cactus', K('cactus_top'), K('cactus_side')],
  ['Furnace', K('furnace_top'), K('furnace_front')], ['Hay Bale', M('farming_straw')],
].forEach(([n, t, s, o]) => block('Basics', n, t, s, o));
['White', 'Red', 'Orange', 'Yellow', 'Green', 'Dark Green', 'Cyan', 'Blue', 'Violet', 'Magenta', 'Pink', 'Brown', 'Tan', 'Grey', 'Dark Grey', 'Black']
  .forEach(c => block('Wool', `${c} Wool`, K('wool_' + c.toLowerCase().replace(' ', '_'))));
[
  ['Mossy Cobblestone', K('mossycobble')], ['Stone Block', K('stone_block')], ['Gravel', K('gravel')], ['Pine Planks', K('pine_wood')],
  ['Jungle Planks', K('junglewood')], ['Acacia Planks', K('acacia_wood')], ['Aspen Planks', K('aspen_wood')],
  ['Pine Log', K('pine_tree_top'), K('pine_tree')], ['Jungle Log', K('jungletree_top'), K('jungletree')], ['Pine Needles', K('pine_needles')],
  ['Desert Sand', K('desert_sand')], ['Sandstone', K('sandstone')], ['Sandstone Bricks', K('sandstone_brick')], ['Desert Stone', K('desert_stone')],
  ['Desert Stone Bricks', K('desert_stone_brick')], ['Obsidian Bricks', K('obsidian_brick')], ['Snowy Grass', K('snow'), K('snow_side')],
  ['Coal Ore', K('ore_coal')], ['Iron Ore', K('ore_iron')], ['Gold Ore', K('ore_gold')], ['Diamond Ore', K('ore_diamond')],
].forEach(([n, t, s]) => block('Kenney pack', n, t, s));
[
  ['Locked Chest', M('chest_top'), M('chest_lock')], ['Bottle Shelf', K('wood'), M('vessels_shelf')], ['Mese Block', M('mese_block')],
  ['Copper Block', M('copper_block')], ['Bronze Block', M('bronze_block')], ['Tin Block', M('tin_block')], ['Coal Block', M('coal_block')],
  ['Bone Box', M('bones_top'), M('bones_front')], ['Iron Bars', M('xpanes_bar'), M('xpanes_bar'), { see: true }], ['Clay Bricks', M('clay_brick')],
  ['Mossy Dirt', M('moss'), M('moss_side')], ['Pink Coral', M('coral_pink')], ['Cyan Coral', M('coral_cyan')], ['Orange Coral', M('coral_orange')],
].forEach(([n, t, s, o]) => block('Minetest blocks', n, t, s, o));
const PHOTO_ORDER = ['grass', 'terrain', 'sand', 'gravel', 'snow', 'rock', 'cobblestone', 'sandstone', 'brick', 'concrete', 'plaster',
  'asphalt', 'tiles', 'floor', 'roofing', 'wall', 'wood', 'bark', 'metal', 'fabric', 'leather', 'moon', 'other'];
const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
for (const cat of PHOTO_ORDER)
  POLYHAVEN.filter(([, , c]) => (PHOTO_ORDER.includes(c) ? c : 'other') === cat).sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([k, name]) => block(`Photo · ${cap(cat)}`, name, P(k)));
const blockById = id => ITEMS[id - 1];
const toolById = id => TOOLS.find(t => t.id === id);
const itemOf = id => (typeof id === 'string' ? toolById(id) : blockById(id));
const BID = {}; ITEMS.forEach(b => { if (!(b.name in BID)) BID[b.name] = b.id; });

// Carousel lists with category markers.
function makeList(items) {
  const list = [...items]; list.groups = [];
  items.forEach((it, i) => { if (!list.groups.length || list.groups[list.groups.length - 1].label !== it.group) list.groups.push({ label: it.group, start: i }); });
  return list;
}
const HOTBAR_LIST = makeList([...TOOLS, ...ITEMS]);
const GROUND_LIST = makeList(ITEMS);

// ---------------------------------------------------------------------------
// Images (loaded on demand)
// ---------------------------------------------------------------------------
const imgCache = new Map();
function img(src) {
  let im = imgCache.get(src);
  if (!im) { im = new Image(); im.src = src; imgCache.set(src, im); }
  return im.complete && im.naturalWidth ? im : null;
}
const isPhoto = src => src.startsWith('textures/photo/');

// ---------------------------------------------------------------------------
// World state: blocks, farmland, crops. Keys are "x,y" tile coordinates.
// ---------------------------------------------------------------------------
const world = { blocks: new Map(), soil: new Map(), crops: new Map(), ground: BID.Grass, time: 0.3 * CFG.dayLength };
const key = (x, y) => `${x},${y}`;
let saveTimer = 0;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 600); }
function saveNow() {
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify({
      blocks: [...world.blocks], soil: [...world.soil.keys()], crops: [...world.crops], ground: world.ground, time: world.time,
      players: locals.map(p => ({ slot: p.slot, favs: p.favs, wheat: p.wheat, x: p.x, y: p.y })),
    }));
  } catch (e) { /* storage unavailable */ }
}
let saved = null;
try { saved = JSON.parse(localStorage.getItem(CFG.saveKey)); } catch (e) { /* ignore */ }
if (saved) {
  world.blocks = new Map(saved.blocks || []);
  world.soil = new Map((saved.soil || []).map(k => [k, 1]));
  world.crops = new Map(saved.crops || []);
  if (blockById(saved.ground)) world.ground = saved.ground;
  if (typeof saved.time === 'number') world.time = saved.time;
} else {
  // A small starter farm: a fenced plot with a path, a cabin corner and a lamp.
  for (let x = -6; x <= -2; x++) for (let y = 2; y <= 5; y++) world.soil.set(key(x, y), 1);
  for (let x = -6; x <= -2; x++) world.crops.set(key(x, 3), { t: Date.now() - (x + 7) * 9000 });
  for (let x = 3; x <= 8; x++) { world.blocks.set(key(x, -5), BID.Planks); world.blocks.set(key(x, -1), BID.Planks); }
  for (let y = -4; y <= -2; y++) { world.blocks.set(key(3, y), BID.Log); world.blocks.set(key(8, y), BID.Log); }
  world.blocks.delete(key(5, -1)); world.blocks.delete(key(6, -1));
  world.blocks.set(key(4, -4), BID['Treasure Chest']); world.blocks.set(key(7, -4), BID.Bookshelf);
  world.blocks.set(key(0, -2), BID['Mese Lamp']);
  for (let y = -1; y <= 6; y++) world.blocks.delete(key(0, y));
}
const isSolid = (x, y) => world.blocks.has(key(x, y));
const cropStage = c => Math.min(8, 1 + Math.floor((Date.now() - c.t) / 1000 / CFG.cropStage));

// ---------------------------------------------------------------------------
// Canvas, split screen, players
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
  layoutViewports();
}
const PLAYER_COLORS = ['#3d8bff', '#ff5a7a', '#4cd964', '#ffb020'];
const HAIR = ['#5b3a1e', '#2b2118', '#c98a3c', '#7a2e1a'];
const hudsEl = document.getElementById('huds');
const locals = [];
const HOTBAR_SIZE = 9;
const DEFAULT_HOTBAR = ['hoe', 'seeds', BID.Planks, BID.Log, BID.Cobblestone, BID['Stone Bricks'], BID.Glass, BID['Mese Lamp'], BID['Treasure Chest']];

class LocalPlayer {
  constructor(slot, x, y) {
    this.slot = slot; this.x = x; this.y = y; this.fx = 0; this.fy = 1; // facing
    this.vx = 0; this.vy = 0; this.walkT = 0; this.cam = { x, y };
    const sp = saved && saved.players && saved.players.find(q => q.slot === slot);
    this.favs = sp && Array.isArray(sp.favs) && sp.favs.length === HOTBAR_SIZE && sp.favs.every(itemOf) ? sp.favs : DEFAULT_HOTBAR.slice();
    this.wheat = (sp && sp.wheat) || 0;
    if (sp && slot === 0) { this.x = sp.x; this.y = sp.y; this.cam = { x: sp.x, y: sp.y }; }
    this.favIdx = 0; this.gamepadIndex = null; this.vp = { x: 0, y: 0, w: innerWidth, h: innerHeight };
    this.useCd = 0; this.breakCd = 0; this.target = null; this.mouseTarget = null;
    this.palOpen = false; this.palTab = 'hotbar'; this.cur = { hotbar: 0, ground: 0 }; this.palNavT = 0;
    this.hud = makeHud(this);
    selectSlot(this, 0, true);
  }
  get selected() { return this.favs[this.favIdx]; }
  dispose() { this.hud.root.remove(); }
}

let splitMode = 'v';
function layoutViewports() {
  const W = innerWidth, H = innerHeight, n = locals.length;
  let rects;
  if (n <= 1) rects = [[0, 0, 1, 1]];
  else if (n === 2) rects = splitMode === 'v' ? [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] : [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]];
  else rects = [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
  locals.forEach((p, i) => {
    const [fx, fy, fw, fh] = rects[i];
    const x = Math.round(fx * W), y = Math.round(fy * H), w = Math.round((fx + fw) * W) - x, h = Math.round((fy + fh) * H) - y;
    p.vp = { x, y, w, h };
    Object.assign(p.hud.root.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    p.hud.root.style.setProperty('--s', Math.max(0.75, Math.min(2.6, Math.min(w / 1500, h / 640))).toFixed(3));
    if (p.palOpen) layoutCarousel(p);
  });
  document.body.classList.toggle('split', n > 1);
}
function toggleSplit() { splitMode = splitMode === 'v' ? 'h' : 'v'; layoutViewports(); toast(splitMode === 'v' ? 'Split screen: side by side' : 'Split screen: top / bottom'); }
function freeSlot() { for (let s = 0; s < CFG.maxLocalPlayers; s++) if (!locals.some(p => p.slot === s)) return s; return -1; }
function addLocal() {
  const slot = freeSlot(); if (slot < 0) return null;
  const host = locals[0];
  let x = 0.5, y = 0.5;
  if (host) { x = host.x + 1; y = host.y; for (let i = 0; i < 12 && isSolid(Math.floor(x), Math.floor(y)); i++) x += 1; }
  const p = new LocalPlayer(slot, x, y);
  locals.push(p); locals.sort((a, b) => a.slot - b.slot);
  layoutViewports();
  return p;
}
function removeLocal(p) { if (p.palOpen) closePalette(p); p.dispose(); locals.splice(locals.indexOf(p), 1); layoutViewports(); }

// ---------------------------------------------------------------------------
// HUD + hotbar + item carousel
// ---------------------------------------------------------------------------
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, 2200); }

function makeHud(p) {
  const root = document.createElement('div');
  root.className = 'phud';
  root.innerHTML = `<div class="tag" style="background:${PLAYER_COLORS[p.slot]}">P${p.slot + 1}</div><div class="clock"></div>`
    + `<div class="bag"><img alt="" src="${K('wheat_item')}"><span>0</span></div><div class="bname"></div><div class="hint"></div>`
    + `<div class="palette" hidden><div class="ptabs"><button type="button" data-tab="hotbar">Hotbar</button><button type="button" data-tab="ground">Ground</button></div>`
    + `<div class="pcat"></div><div class="carousel">${'<div class="ccell"><img alt=""></div>'.repeat(11)}</div>`
    + `<div class="pinfo"><div class="ptitle"></div><div class="paction"></div><div class="phelp"></div></div>`
    + `<button class="pclose" type="button">✕</button></div><div class="hotbar"></div>`;
  const bar = root.querySelector('.hotbar');
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const d = document.createElement('div'); d.className = 'slot';
    d.innerHTML = `<img alt=""><span>${i + 1}</span>`;
    const pick = e => { e.preventDefault(); e.stopPropagation(); selectSlot(p, i); };
    d.addEventListener('click', pick); d.addEventListener('touchstart', pick, { passive: false });
    bar.appendChild(d);
  }
  const carousel = root.querySelector('.carousel'), carCells = [...carousel.children];
  carCells[5].classList.add('center');
  carCells.forEach((cell, k) => cell.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (k === 5) applyPalette(p); else movePalette(p, k - 5); }));
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
  const tabBtns = [...root.querySelectorAll('.ptabs button')];
  tabBtns.forEach(b => { const go = e => { e.preventDefault(); e.stopPropagation(); setPalTab(p, b.dataset.tab); }; b.addEventListener('click', go); b.addEventListener('touchstart', go, { passive: false }); });
  const closeBtn = root.querySelector('.pclose');
  const close = e => { e.preventDefault(); e.stopPropagation(); closePalette(p); };
  closeBtn.addEventListener('click', close); closeBtn.addEventListener('touchstart', close, { passive: false });
  hudsEl.appendChild(root);
  const q = s => root.querySelector(s);
  return { root, bar, carousel, carCells, tabBtns, pal: q('.palette'), pcat: q('.pcat'), ptitle: q('.ptitle'), paction: q('.paction'), phelp: q('.phelp'),
    name: q('.bname'), hint: q('.hint'), clock: q('.clock'), bag: q('.bag span'), nameTimer: 0, hintText: '' };
}
function renderHotbar(p) {
  [...p.hud.bar.children].forEach((el, i) => {
    const it = itemOf(p.favs[i]); const im = el.querySelector('img');
    if (im.getAttribute('src') !== it.icon) im.src = it.icon;
    el.title = it.name; el.classList.toggle('sel', i === p.favIdx);
  });
}
function selectSlot(p, i, quiet) {
  p.favIdx = (i + HOTBAR_SIZE) % HOTBAR_SIZE;
  renderHotbar(p);
  if (quiet) return;
  p.hud.name.textContent = itemOf(p.selected).name; p.hud.name.style.opacity = 1;
  clearTimeout(p.hud.nameTimer); p.hud.nameTimer = setTimeout(() => { p.hud.name.style.opacity = 0; }, 1200);
}

const listOf = p => (p.palTab === 'ground' ? GROUND_LIST : HOTBAR_LIST);
const curItem = p => listOf(p)[p.cur[p.palTab]];
const groupOf = (list, i) => { let g = list.groups[0]; for (const x of list.groups) if (x.start <= i) g = x; return g; };
const CAR_SCALE = [1, 0.62, 0.5, 0.42, 0.36, 0.32];
function openPalette(p) {
  const hi = HOTBAR_LIST.findIndex(it => it.id === p.selected); if (hi >= 0) p.cur.hotbar = hi;
  const gi = GROUND_LIST.findIndex(it => it.id === world.ground); if (gi >= 0) p.cur.ground = gi;
  p.palOpen = true; p.palNavT = 0;
  p.hud.pal.hidden = false; p.hud.root.classList.add('menu');
  if (p.slot === 0) document.body.classList.add('palopen');
  p.hud.phelp.textContent = p.gamepadIndex !== null ? 'LB / RB: tab · ← →: browse · ↑ ↓: category · LT / RT: jump 10 · B: close'
    : isTouch ? 'Swipe to browse · tap a side item to move to it · tap the middle to use it'
    : '← →: browse · ↑ ↓: category · [ / ]: tab · wheel scrolls · Tab: close';
  setPalTab(p, p.palTab);
}
function closePalette(p) {
  p.palOpen = false; p.hud.pal.hidden = true; p.hud.root.classList.remove('menu');
  if (p.slot === 0) document.body.classList.remove('palopen');
}
function setPalTab(p, tab) {
  p.palTab = tab;
  p.hud.tabBtns.forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  layoutCarousel(p); renderCarousel(p);
}
function applyPalette(p) {
  const it = curItem(p); if (!it) return;
  if (p.palTab === 'hotbar') { p.favs[p.favIdx] = it.id; renderHotbar(p); scheduleSave(); closePalette(p); selectSlot(p, p.favIdx); return; }
  world.ground = it.id; scheduleSave(); rumble(p, 0.2, 0.3, 60); renderCarousel(p);
}
function movePalette(p, d, byGroup) {
  const list = listOf(p);
  let i = p.cur[p.palTab];
  if (byGroup) { const gi = list.groups.indexOf(groupOf(list, i)); i = list.groups[(gi + d + list.groups.length) % list.groups.length].start; }
  else i = (i + d + list.length * 10) % list.length;
  p.cur[p.palTab] = i;
  renderCarousel(p);
}
function renderCarousel(p) {
  const list = listOf(p), i = p.cur[p.palTab], half = 5;
  p.hud.carCells.forEach((cell, k) => {
    const it = list[(i + k - half + list.length * 10) % list.length];
    const im = cell.firstChild; if (im.getAttribute('src') !== it.icon) im.src = it.icon;
    cell.title = it.name;
  });
  const it = list[i], g = groupOf(list, i), gEnd = (list.groups[list.groups.indexOf(g) + 1] || { start: list.length }).start;
  p.hud.pcat.textContent = `${g.label}  ·  ${i - g.start + 1} / ${gEnd - g.start}`;
  const key2 = p.gamepadIndex !== null ? 'A' : isTouch ? 'Tap the middle' : 'Click the middle / Enter';
  p.hud.ptitle.textContent = it.name + (p.palTab === 'ground' && world.ground === it.id ? '  ✓ current ground' : '');
  p.hud.paction.textContent = `${key2}: ${p.palTab === 'hotbar' ? `put it in slot ${p.favIdx + 1}` : 'make it the ground'}`;
}
function layoutCarousel(p) {
  const { root, carousel, carCells } = p.hud;
  const vr = root.getBoundingClientRect();
  const sc = parseFloat(getComputedStyle(root).getPropertyValue('--s')) || 1;
  const center = Math.round(Math.min(170 * sc, vr.height * 0.28, vr.width * (isTouch ? 0.34 : 0.2)));
  const gap = Math.max(4, Math.round(6 * sc));
  let used = 0;
  carCells.forEach((cell, k) => {
    const dist = Math.abs(k - 5), sz = Math.round(center * CAR_SCALE[Math.min(dist, 5)]);
    Object.assign(cell.style, { width: sz + 'px', height: sz + 'px', opacity: String(dist === 0 ? 1 : Math.max(0.35, 1 - dist * 0.16)), display: '' });
    cell.dataset.w = sz;
  });
  for (let d = 0; d <= 5; d++) {
    const w = carCells.slice(5 - d, 6 + d).reduce((a, c) => a + Number(c.dataset.w) + gap, 0);
    if (w > vr.width - 24) { carCells[5 - d].style.display = 'none'; carCells[5 + d].style.display = 'none'; }
  }
  carousel.style.gap = gap + 'px';
}

// ---------------------------------------------------------------------------
// Actions: use (place / till / plant / harvest) and remove
// ---------------------------------------------------------------------------
function targetTile(p) {
  if (p.mouseTarget && p.slot === 0 && performance.now() - mouse.t < 4000) return p.mouseTarget;
  return { x: Math.floor(p.x) + p.fx, y: Math.floor(p.y) + p.fy };
}
function overlapsPlayer(x, y) {
  return locals.some(q => q.x + CFG.radius > x && q.x - CFG.radius < x + 1 && q.y + CFG.radius > y && q.y - CFG.radius < y + 1);
}
function useAction(p) {
  const t = p.target; if (!t) return;
  const k = key(t.x, t.y), crop = world.crops.get(k);
  if (crop && cropStage(crop) >= 8) { // harvest ripe wheat
    world.crops.delete(k); p.wheat += 1 + (Math.random() < 0.35 ? 1 : 0);
    p.hud.bag.textContent = p.wheat; rumble(p, 0.25, 0.4, 80); scheduleSave(); return;
  }
  const sel = p.selected;
  if (sel === 'hoe') {
    if (!isSolid(t.x, t.y) && !world.soil.has(k)) { world.soil.set(k, 1); rumble(p, 0.15, 0.3, 50); scheduleSave(); }
  } else if (sel === 'seeds') {
    if (world.soil.has(k) && !crop) { world.crops.set(k, { t: Date.now() }); rumble(p, 0.1, 0.25, 40); scheduleSave(); }
  } else if (typeof sel === 'number') {
    if (!isSolid(t.x, t.y) && !crop && !overlapsPlayer(t.x, t.y)) { world.blocks.set(k, sel); world.soil.delete(k); rumble(p, 0.15, 0.35, 45); scheduleSave(); }
  }
}
function breakAction(p) {
  const t = p.target; if (!t) return;
  const k = key(t.x, t.y);
  if (world.blocks.delete(k) || world.crops.delete(k) || world.soil.delete(k)) { rumble(p, 0.4, 0.2, 70); scheduleSave(); }
}
function updateHint(p) {
  const t = p.target; let text = '';
  if (t && !p.palOpen) {
    const k = key(t.x, t.y), crop = world.crops.get(k), sel = p.selected;
    const btn = p.gamepadIndex !== null ? 'A' : isTouch ? 'USE' : 'E / right click';
    if (crop && cropStage(crop) >= 8) text = `${btn}: harvest wheat`;
    else if (sel === 'hoe' && !isSolid(t.x, t.y) && !world.soil.has(k)) text = `${btn}: till the soil`;
    else if (sel === 'seeds' && world.soil.has(k) && !crop) text = `${btn}: plant seeds`;
    else if (sel === 'seeds' && !world.soil.has(k)) text = 'Till the ground with the Hoe first';
  }
  if (text !== p.hud.hintText) { p.hud.hintText = text; if (text) p.hud.hint.textContent = text; p.hud.hint.style.opacity = text ? 1 : 0; }
}

// ---------------------------------------------------------------------------
// Input: keyboard / mouse / touch (player 1) and gamepads (everyone)
// ---------------------------------------------------------------------------
const keys = new Set();
let running = false;
const overlay = document.getElementById('overlay'), goText = document.getElementById('goText');
goText.textContent = isTouch ? 'Tap to play' : 'Click or press A to play';
function start() { overlay.classList.add('hidden'); running = true; }
function pause() { running = false; overlay.classList.remove('hidden'); goText.textContent = isTouch ? 'Tap to resume' : 'Click or press A to resume'; saveNow(); }
overlay.addEventListener('click', start);
overlay.addEventListener('touchend', e => { e.preventDefault(); start(); });

addEventListener('keydown', e => {
  if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
  keys.add(e.code);
  const p = locals[0]; if (!running || !p) { if (e.code === 'Escape' && !running) start(); return; }
  if (e.code === 'Tab' || e.code === 'KeyQ') { if (p.palOpen) closePalette(p); else openPalette(p); return; }
  if (p.palOpen) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') movePalette(p, -1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') movePalette(p, 1);
    if (e.code === 'ArrowUp' || e.code === 'KeyW') movePalette(p, -1, true);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') movePalette(p, 1, true);
    if (e.code === 'PageUp') movePalette(p, -10);
    if (e.code === 'PageDown') movePalette(p, 10);
    if (e.code === 'Enter' || e.code === 'Space') applyPalette(p);
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') setPalTab(p, p.palTab === 'hotbar' ? 'ground' : 'hotbar');
    if (/^Digit[1-9]$/.test(e.code)) { p.favIdx = Number(e.code.slice(5)) - 1; renderHotbar(p); renderCarousel(p); }
    if (e.code === 'Escape') closePalette(p);
    return;
  }
  if (e.code === 'Escape') pause();
  if (e.code === 'KeyE') useAction(p);
  if (e.code === 'KeyV') toggleSplit();
  if (/^Digit[1-9]$/.test(e.code)) selectSlot(p, Number(e.code.slice(5)) - 1);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const mouse = { x: 0, y: 0, t: -1e9 };
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousemove', e => { if (isTouch) return; mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now(); });
canvas.addEventListener('mousedown', e => {
  const p = locals[0]; if (!running || isTouch || !p || p.palOpen) return;
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now();
  p.target = targetTile(p);
  if (e.button === 2) useAction(p); else if (e.button === 0) breakAction(p);
});
addEventListener('wheel', e => { const p = locals[0]; if (running && p && !p.palOpen) selectSlot(p, p.favIdx + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });

// Touch: D-pad moves; USE / BREAK / ITEMS buttons.
const touchMove = { x: 0, y: 0 };
const dpad = document.getElementById('dpad');
let dpadId = null;
function dpadSet(t) {
  const r = dpad.getBoundingClientRect(), dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
  let x = 0, y = 0;
  if (Math.hypot(dx, dy) > r.width * 0.12) { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); x = Math.round(Math.cos(a) * 100) / 100; y = Math.round(Math.sin(a) * 100) / 100; }
  touchMove.x = x; touchMove.y = y;
  dpad.classList.toggle('u', y < 0); dpad.classList.toggle('d', y > 0); dpad.classList.toggle('l', x < 0); dpad.classList.toggle('r', x > 0);
}
dpad.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; dpadId = t.identifier; dpadSet(t); }, { passive: false });
dpad.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === dpadId) dpadSet(t); }, { passive: false });
const dpadEnd = e => { for (const t of e.changedTouches) if (t.identifier === dpadId) { dpadId = null; touchMove.x = touchMove.y = 0; dpad.classList.remove('u', 'd', 'l', 'r'); } };
dpad.addEventListener('touchend', dpadEnd); dpad.addEventListener('touchcancel', dpadEnd);
canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
function bindBtn(id, fn) { document.getElementById(id).addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (running && locals[0]) fn(locals[0]); }, { passive: false }); }
bindBtn('bUse', p => useAction(p));
bindBtn('bBreak', p => breakAction(p));
bindBtn('bPal', p => (p.palOpen ? closePalette(p) : openPalette(p)));

// Gamepads (Xbox layout / standard mapping)
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
let padsNow = [];
const padPrev = new Map();
const padButtons = gp => gp.buttons.map(b => b.pressed || b.value > 0.5);
function syncPads() {
  padsNow = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
  const alive = i => padsNow[i] && padsNow[i].connected;
  for (let i = locals.length - 1; i >= 0; i--) {
    const p = locals[i];
    if (p.gamepadIndex !== null && !alive(p.gamepadIndex)) {
      if (p.slot > 0) { toast(`Player ${p.slot + 1} controller disconnected`); removeLocal(p); } else p.gamepadIndex = null;
    }
  }
  for (const gp of padsNow) {
    if (!gp || !gp.connected || locals.some(p => p.gamepadIndex === gp.index)) continue;
    const p = locals.find(q => q.gamepadIndex === null) || (locals.length < CFG.maxLocalPlayers ? addLocal() : null);
    if (!p) continue;
    p.gamepadIndex = gp.index; padPrev.set(gp.index, padButtons(gp));
    toast(`Controller connected: Player ${p.slot + 1}`); rumble(p, 0.3, 0.3, 120);
  }
}
function rumble(p, strong, weak, ms) {
  const gp = p.gamepadIndex !== null && padsNow[p.gamepadIndex], va = gp && gp.vibrationActuator;
  if (va && va.playEffect) va.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: weak, strongMagnitude: strong }).catch(() => {});
}
function readPad(p) {
  const gp = p.gamepadIndex !== null ? padsNow[p.gamepadIndex] : null; if (!gp) return null;
  const now = padButtons(gp), prev = padPrev.get(gp.index) || [];
  padPrev.set(gp.index, now);
  return { gp, now, pressed: i => !!now[i] && !prev[i] };
}
function stick(x, y, dead) { const m = Math.hypot(x, y); if (m < dead) return [0, 0, 0]; const s = Math.min(1, (m - dead) / (1 - dead)); return [x / m * s, y / m * s, s]; }

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function collides(x, y) {
  const r = CFG.radius;
  for (let ix = Math.floor(x - r); ix <= Math.floor(x + r - 1e-6); ix++)
    for (let iy = Math.floor(y - r); iy <= Math.floor(y + r - 1e-6); iy++) if (isSolid(ix, iy)) return true;
  return false;
}
function updatePlayer(p, dt) {
  let mx = 0, my = 0;
  if (p.slot === 0) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    mx += touchMove.x; my += touchMove.y;
  }
  p.useCd -= dt; p.breakCd -= dt;
  const pad = readPad(p);
  if (p.palOpen) {
    mx = my = 0;
    if (pad) {
      const { gp, pressed } = pad, ax = gp.axes;
      const [lx, ly] = stick(ax[0] || 0, ax[1] || 0, 0.4);
      if (pressed(PAD.LB) || pressed(PAD.RB)) setPalTab(p, p.palTab === 'hotbar' ? 'ground' : 'hotbar');
      let d = (pressed(PAD.RIGHT) ? 1 : 0) - (pressed(PAD.LEFT) ? 1 : 0);
      const dg = (pressed(PAD.DOWN) ? 1 : 0) - (pressed(PAD.UP) ? 1 : 0);
      p.palNavT -= dt;
      if (!d && Math.abs(lx) > Math.abs(ly) && lx) {
        if (p.palNavT <= 0) { d = Math.sign(lx); p.palHeld = p.palNavT < -0.5 ? 0 : (p.palHeld || 0) + 1; p.palNavT = p.palHeld === 0 ? 0.32 : p.palHeld < 6 ? 0.16 : 0.1; }
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
    const [lx, ly] = stick(ax[0] || 0, ax[1] || 0, CFG.padYawDead);
    mx += lx + (now[PAD.RIGHT] ? 1 : 0) - (now[PAD.LEFT] ? 1 : 0);
    my += ly + (now[PAD.DOWN] ? 1 : 0) - (now[PAD.UP] ? 1 : 0);
    if (pressed(PAD.LB)) selectSlot(p, p.favIdx - 1);
    if (pressed(PAD.RB)) selectSlot(p, p.favIdx + 1);
    const holdUse = now[PAD.A] || now[PAD.RT], firstUse = pressed(PAD.A) || pressed(PAD.RT);
    if (holdUse && (firstUse || p.useCd <= 0)) { p.target = targetTile(p); useAction(p); p.useCd = firstUse ? 0.32 : 0.16; }
    if (now[PAD.LT] && (pressed(PAD.LT) || p.breakCd <= 0)) { p.target = targetTile(p); breakAction(p); p.breakCd = pressed(PAD.LT) ? 0.32 : 0.16; }
    if (pressed(PAD.Y)) openPalette(p);
    if (pressed(PAD.VIEW)) toggleSplit();
    if (pressed(PAD.MENU)) pause();
  }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  // Face the main direction of movement (4 directions, like classic farm games).
  if (ml > 0.2) { if (Math.abs(mx) > Math.abs(my)) { p.fx = Math.sign(mx); p.fy = 0; } else { p.fx = 0; p.fy = Math.sign(my); } }
  const k = 1 - Math.exp(-dt * 18);
  p.vx += (mx * CFG.walkSpeed - p.vx) * k; p.vy += (my * CFG.walkSpeed - p.vy) * k;
  const nx = p.x + p.vx * dt; if (!collides(nx, p.y)) p.x = nx; else p.vx = 0;
  const ny = p.y + p.vy * dt; if (!collides(p.x, ny)) p.y = ny; else p.vy = 0;
  const sp = Math.hypot(p.vx, p.vy);
  p.walkT = sp > 0.3 ? p.walkT + dt * sp * 2.2 : 0;
  p.cam.x += (p.x - p.cam.x) * (1 - Math.exp(-dt * 8)); p.cam.y += (p.y - p.cam.y) * (1 - Math.exp(-dt * 8));
  // Mouse target (player 1, desktop): tile under the cursor if within reach.
  p.mouseTarget = null;
  if (p.slot === 0 && !isTouch && performance.now() - mouse.t < 4000) {
    const tp = tilePx(p), cx = p.vp.x + p.vp.w / 2, cy = p.vp.y + p.vp.h / 2;
    const wx = Math.floor(p.cam.x + (mouse.x - cx) / tp), wy = Math.floor(p.cam.y + (mouse.y - cy) / tp);
    if (Math.hypot(wx + 0.5 - p.x, wy + 0.5 - p.y) <= CFG.reach) p.mouseTarget = { x: wx, y: wy };
  }
  p.target = targetTile(p);
  updateHint(p);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const tilePx = p => Math.max(20, Math.round(p.vp.h / CFG.tilesTall));
const groundPatterns = new Map();
function drawTex(src, x, y, w, h, sx, sy, sw, sh) {
  const im = img(src); if (!im) return false;
  ctx.imageSmoothingEnabled = isPhoto(src);
  if (sw) ctx.drawImage(im, sx * im.width, sy * im.height, sw * im.width, sh * im.height, x, y, w, h);
  else ctx.drawImage(im, x, y, w, h);
  return true;
}
function daylight() { // 0 = midnight, 1 = noon
  const t = (world.time / CFG.dayLength) % 1;
  return Math.max(0, Math.min(1, 0.5 - 0.5 * Math.cos((t - 0.0) * Math.PI * 2) * 1.25 + 0.12));
}
function clockText() {
  const t = (world.time / CFG.dayLength) % 1, day = Math.floor(world.time / CFG.dayLength) + 1;
  let mins = Math.floor(t * 24 * 60); const h = Math.floor(mins / 60), m = Math.floor((mins % 60) / 10) * 10;
  const hh = ((h + 11) % 12) + 1;
  return `Day ${day} · ${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
function drawPlayer(q, sx, sy, tp, t) {
  const s = tp / 32, bob = q.walkT ? Math.sin(q.walkT * Math.PI) * 1.5 * s : 0, leg = q.walkT ? Math.sin(q.walkT * Math.PI) * 3 * s : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(sx, sy, 9 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a3048'; // legs
  ctx.fillRect(sx - 6 * s, sy - 10 * s + leg, 5 * s, 10 * s - leg); ctx.fillRect(sx + 1 * s, sy - 10 * s - leg, 5 * s, 10 * s + leg);
  ctx.fillStyle = PLAYER_COLORS[q.slot]; // shirt
  ctx.fillRect(sx - 8 * s, sy - 24 * s - bob, 16 * s, 15 * s);
  ctx.fillStyle = '#f1c9a5'; // head
  ctx.fillRect(sx - 7 * s, sy - 37 * s - bob, 14 * s, 13 * s);
  ctx.fillStyle = HAIR[q.slot]; // hair
  ctx.fillRect(sx - 8 * s, sy - 39 * s - bob, 16 * s, 5 * s);
  if (q.fy < 0) ctx.fillRect(sx - 8 * s, sy - 36 * s - bob, 16 * s, 9 * s); // back of the head
  else {
    ctx.fillStyle = '#2a2230';
    const ex = q.fx * 3 * s;
    if (q.fx === 0) { ctx.fillRect(sx - 4 * s, sy - 31 * s - bob, 2 * s, 3 * s); ctx.fillRect(sx + 2 * s, sy - 31 * s - bob, 2 * s, 3 * s); }
    else ctx.fillRect(sx + ex - 1 * s, sy - 31 * s - bob, 2 * s, 3 * s);
  }
}
function drawBlock(b, x, y, tp) {
  const lift = tp * 0.5;
  if (b.see) ctx.globalAlpha = 0.75;
  drawTex(b.side, x, y + tp - lift, tp, lift, 0, 0.5, 1, 0.5); // front face
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + tp - lift, tp, lift);
  if (!drawTex(b.top, x, y - lift, tp, tp)) { ctx.fillStyle = '#777'; ctx.fillRect(x, y - lift, tp, tp); }
  ctx.globalAlpha = 1;
}
function renderView(p, now) {
  const { x: vx, y: vy, w: vw, h: vh } = p.vp, tp = tilePx(p);
  ctx.save();
  ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
  const ox = vx + vw / 2 - p.cam.x * tp, oy = vy + vh / 2 - p.cam.y * tp; // screen position of world (0,0)
  const x0 = Math.floor((vx - ox) / tp) - 1, x1 = Math.ceil((vx + vw - ox) / tp) + 1;
  const y0 = Math.floor((vy - oy) / tp) - 1, y1 = Math.ceil((vy + vh - oy) / tp) + 2;
  // Ground: a repeating pattern of the chosen block's top texture.
  const gb = blockById(world.ground), gim = img(gb.top);
  if (gim) {
    let pat = groundPatterns.get(gb.top); if (!pat) { pat = ctx.createPattern(gim, 'repeat'); groundPatterns.set(gb.top, pat); }
    const span = (isPhoto(gb.top) ? 2 : 1) * tp, sc = span / gim.width;
    pat.setTransform(new DOMMatrix().translate(ox, oy).scale(sc));
    ctx.imageSmoothingEnabled = isPhoto(gb.top);
    ctx.fillStyle = pat; ctx.fillRect(vx, vy, vw, vh);
  } else { ctx.fillStyle = '#4d6b2e'; ctx.fillRect(vx, vy, vw, vh); }
  // Farmland
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!world.soil.has(key(tx, ty))) continue;
    if (!drawTex(M('farming_soil'), ox + tx * tp, oy + ty * tp, tp, tp)) { ctx.fillStyle = '#5a3d22'; ctx.fillRect(ox + tx * tp, oy + ty * tp, tp, tp); }
  }
  // Target tile
  if (p.target && !p.palOpen) {
    const t = p.target, lift = isSolid(t.x, t.y) ? tp * 0.5 : 0;
    ctx.strokeStyle = 'rgba(255,207,74,0.95)'; ctx.lineWidth = Math.max(2, tp / 16);
    ctx.strokeRect(ox + t.x * tp + 1, oy + t.y * tp - lift + 1, tp - 2, tp - 2);
  }
  // Rows top to bottom so things lower on screen draw in front (blocks, crops, players).
  const lamps = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const k = key(tx, ty), id = world.blocks.get(k), sx = ox + tx * tp, sy = oy + ty * tp;
      if (id) { const b = blockById(id); if (b) { drawBlock(b, sx, sy, tp); if (b.glow) lamps.push([sx + tp / 2, sy]); } }
      const c = world.crops.get(k);
      if (c) drawTex(K('wheat_' + cropStage(c)), sx, sy - tp * 0.45, tp, tp * 1.3);
    }
    for (const q of locals) if (Math.floor(q.y) === ty) drawPlayer(q, ox + q.x * tp, oy + q.y * tp, tp, now);
  }
  // Day / night
  const light = daylight();
  if (light < 0.98) {
    ctx.globalCompositeOperation = 'multiply';
    const n = 1 - light;
    ctx.fillStyle = `rgb(${Math.round(255 - 190 * n)}, ${Math.round(255 - 170 * n)}, ${Math.round(255 - 90 * n)})`;
    ctx.fillRect(vx, vy, vw, vh);
    ctx.globalCompositeOperation = 'lighter';
    for (const [lx, ly] of lamps) {
      const r = tp * 3.2, g = ctx.createRadialGradient(lx, ly, tp * 0.2, lx, ly, r);
      g.addColorStop(0, `rgba(255,220,140,${0.55 * n})`); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  p.hud.clock.textContent = clockText();
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  syncPads();
  if (running) {
    world.time += dt;
    for (const p of locals) updatePlayer(p, dt);
  } else {
    let go = false;
    for (const gp of padsNow) {
      if (!gp) continue;
      const b = padButtons(gp), prev = padPrev.get(gp.index) || [];
      if ((b[PAD.A] && !prev[PAD.A]) || (b[PAD.MENU] && !prev[PAD.MENU])) go = true;
      padPrev.set(gp.index, b);
    }
    if (go) start();
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, innerWidth, innerHeight);
  for (const p of locals) renderView(p, now);
  if (locals.length > 1) { // split lines
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    for (const p of locals) { ctx.fillRect(p.vp.x + p.vp.w - 1, p.vp.y, 2, p.vp.h); ctx.fillRect(p.vp.x, p.vp.y + p.vp.h - 1, p.vp.w, 2); }
  }
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
addEventListener('pagehide', saveNow);
setInterval(saveNow, 15000); // keep crop timers and the clock saved
addLocal();
resize();
locals.forEach(p => { p.hud.bag.textContent = p.wheat; });
addEventListener('gamepadconnected', () => { if (!running) goText.textContent = 'Press A to play'; });
window.Game2D = { world, locals, ITEMS, TOOLS, CFG };
requestAnimationFrame(frame);
