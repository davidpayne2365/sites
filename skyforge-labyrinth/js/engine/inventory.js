// Inventory and shop. You start with a few blocks; more come from treasure chests and the shop (blocks are never
// mined). Tools and gear are bought with coins. Saved in the browser.
import { BID, blockById } from '../blocks.js';

const SAVE = 'skyforge.labyrinth.inventory.v1';
// Building is set aside for now: Skyforge is about exploring and buying gear. With BUILDING off there's no block
// carousel, no block packs in the shop and no blocks in chests; only gear goes on the hotbar (torches, which you
// hold to light the way, and the zip line and portal stone pieces). Set it to true to bring building back.
export const BUILDING = false;
// What stays its own stack: the letter, torches, zip anchors, portal stones and the building blocks themselves.
const KEEP = new Set(['Old Letter', 'Torch', 'Zip Anchor', 'Portal Stone', 'Building Blocks'].map(n => BID[n]));
// How long one torch burns while you hold it (seconds).
export const TORCH_TIME = 180;
export const BUILD_MAX = 120; // no building at or above this height: the floating castles must be reached by portal

// Shop catalogue. Prices are set so the best gear takes many hours of exploring (a big chest is 400-3,600 coins,
// a floating castle's hoard 8,000-12,000).
export const GEAR = [
  { id: 'torches', name: 'Torches ×8', price: 300, icon: 'minetest/torch_on_floor.png', blocks: [['Torch', 8]], desc: 'Select a torch on your hotbar to light up around you. Each one burns for 3 minutes.' },
  { id: 'hammer', name: 'Stonebreaker Hammer', price: 2500, icon: 'blocks/stone_brick.png', item: true, desc: 'Break anything: stone, brick, wood, plants, leaves, hedges, even the labyrinth walls. Wears out after 300 blocks.' },
  { id: 'boots', name: 'Spring Boots', price: 6000, icon: 'blocks/wool_green.png', item: true, desc: 'Jump over 2 blocks high.' },
  { id: 'glider', name: 'Glider', price: 9000, icon: 'blocks/wool_white.png', item: true, desc: 'Hold jump while falling to glide. Leap off a floating castle and sail down.' },
  { id: 'portals', name: 'Portal Stones (pair)', price: 15000, icon: 'minetest/mese_block.png', blocks: [['Portal Stone', 2]], desc: 'Place two anywhere: press E / A on one to step to the other.' },
  { id: 'horse', name: 'Horse', price: 20000, emoji: '🐎', item: true, desc: 'Gallop through the labyrinth more than twice as fast and leap 2 blocks. Room for a friend on the back.' },
  { id: 'cloud', name: 'Flying Cloud', price: 30000, emoji: '☁️', item: true, desc: 'Drift over the labyrinth walls, up to 12 blocks above the ground (not high enough for floating castles). Carries a friend.' },
  { id: 'carpet', name: 'Magic Carpet', price: 60000, icon: 'blocks/wool_red.png', item: true, desc: 'Fly anywhere, even up to the floating castles: jump to rise, C / B to sink. Carries a friend.' },
];
export const BLOCK_PACKS = [
  { id: 'p_planks', name: '32 Planks', price: 60, icon: 'photo/wood_floor.jpg', blocks: [['Planks', 32]] },
  { id: 'p_cobble', name: '32 Cobblestone', price: 60, icon: 'blocks/cobble.png', blocks: [['Cobblestone', 32]] },
  { id: 'p_mossy', name: '32 Mossy Cobblestone', price: 70, icon: 'blocks/mossycobble.png', blocks: [['Mossy Cobblestone', 32]] },
  { id: 'p_bricks', name: '32 Stone Bricks', price: 90, icon: 'blocks/stone_brick.png', blocks: [['Stone Bricks', 32]] },
  { id: 'p_slabs', name: '24 Stone Brick Slabs', price: 80, icon: 'blocks/stone_brick.png', blocks: [['Stone Bricks Slab', 24]] },
  { id: 'p_castle', name: '32 Castle Bricks', price: 120, icon: 'photo/castle_brick_01.jpg', blocks: [['Castle Brick 01', 32]] },
  { id: 'p_glass', name: '16 Glass', price: 80, icon: 'blocks/glass.png', blocks: [['Glass', 16]] },
  { id: 'p_garden', name: 'Garden Pack', price: 90, icon: 'minetest/flowers_rose.png', blocks: [['Leaves', 24], ['Rose', 6], ['Tulip', 6], ['Dandelion', 6], ['Fern', 6]] },
  { id: 'p_wool', name: 'Wool Pack (8 colours)', price: 140, icon: 'blocks/wool_violet.png', blocks: ['Red', 'Blue', 'Yellow', 'Green', 'Violet', 'Orange', 'Black', 'White'].map(c => [`${c} Wool`, 8]) },
  { id: 'p_marble', name: '16 Marble', price: 140, icon: 'photo/marble_01.jpg', blocks: [['Marble 01', 16]] },
  { id: 'p_lamps', name: '8 Mese Lamps', price: 180, icon: 'minetest/meselamp.png', blocks: [['Mese Lamp', 8]] },
  { id: 'p_gold', name: '4 Gold Blocks', price: 600, icon: 'minetest/gold_block.png', blocks: [['Gold Block', 4]] },
];

// Blocks found in a chest (deterministic from its position and tier).
const COMMON = ['Planks', 'Cobblestone', 'Mossy Cobblestone', 'Stone Bricks', 'Glass', 'Torch', 'Leaves', 'Gravel', 'Pine Planks', 'Brick',
  'Castle Brick 01', 'Stone Bricks Slab', 'Planks Slab', 'Red Wool', 'Blue Wool', 'Yellow Wool', 'Sandstone Bricks', 'Stone Block', 'Bookshelf', 'Iron Bars'];
const RARE = ['Mese Lamp', 'Marble 01', 'Gold Block', 'Obsidian Bricks', 'Framed Glass', 'Mese Post Light', 'Diamond Block', 'Castle Brick 02 White',
  'Marble Tiles', 'Obsidian Glass', 'Mese Block', 'Copper Block'];
function hash(a, b, c, d) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) ^ Math.imul(b | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) ^ Math.imul(c | 0, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) ^ Math.imul(d | 0, 0x165667b1);
  return (Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0);
}
export function chestBlocks(x, y, z, tier) {
  const plan = { 1: [1, 4, 8, 0], 2: [2, 8, 16, 0], 3: [3, 16, 32, 1], 4: [5, 24, 48, 2], 5: [8, 48, 96, 4], 6: [3, 48, 80, 1] }[tier] || [1, 4, 8, 0];
  const [types, lo, hi, rare] = plan;
  const out = new Map();
  for (let k = 0; k < types; k++) {
    const r = hash(x, y, z, k + 1);
    const name = k < rare ? RARE[r % RARE.length] : COMMON[r % COMMON.length];
    const id = BID[name];
    if (!id) continue;
    out.set(id, (out.get(id) || 0) + lo + ((r >>> 8) % (hi - lo + 1)));
  }
  if (tier >= 5) out.set(BID.Torch, (out.get(BID.Torch) || 0) + 32);
  return [...out];
}

// The hammer wears out: it breaks after this many blocks (picking up your own blocks doesn't count).
export const HAMMER_LIFE = 300;

export class Inventory {
  constructor() {
    this.blocks = new Map(); this.items = new Set(); this.placed = new Set();
    this.zips = []; this.portalPairs = []; // [{ a: [x,y,z], b: [x,y,z] | null }]
    this.torchT = TORCH_TIME; this.hammer = 0;
    this.load();
  }
  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { /* ignore */ }
    if (!s) {
      // A small start: a few torches (and, when building is on, some planks and mossy stones).
      if (BUILDING) { this.blocks.set(BID.Planks, 24); this.blocks.set(BID['Mossy Cobblestone'], 24); }
      this.blocks.set(BID.Torch, 4);
      this.fresh = true;
      return;
    }
    for (const [id, n] of s.blocks || []) if (blockById(id) && n > 0) this.blocks.set(id, n);
    this.items = new Set(s.items || []); this.placed = new Set(s.placed || []);
    // The Treasure Compass was taken out of the shop: give its owners their coins back (once).
    if (this.items.delete('compass')) this.refund = (this.refund || 0) + 4000;
    this.zips = s.zips || []; this.portalPairs = s.portalPairs || [];
    this.hammer = s.hammer > 0 ? s.hammer : this.items.has('hammer') ? HAMMER_LIFE : 0;
    this.torchT = s.torchT > 0 ? s.torchT : TORCH_TIME;
    this.skin = s.skin && blockById(s.skin) ? s.skin : 0;
    // Building comes back as one stack: any plain blocks left from before join it.
    if (!BUILDING) for (const [id, n] of [...this.blocks]) if (!KEEP.has(id)) { this.blocks.delete(id); this.blocks.set(BID['Building Blocks'], this.count(BID['Building Blocks']) + n); }
  }
  save() {
    try { localStorage.setItem(SAVE, JSON.stringify({ blocks: [...this.blocks], items: [...this.items], placed: [...this.placed], zips: this.zips, portalPairs: this.portalPairs, hammer: this.hammer || 0, torchT: this.torchT || TORCH_TIME, skin: this.skin || 0 })); } catch (e) { /* full */ }
  }
  count(id) { return this.blocks.get(id) || 0; }
  add(id, n = 1) { if (!id || n <= 0) return; this.blocks.set(id, this.count(id) + n); this.save(); }
  take(id) { const n = this.count(id); if (n <= 0) return false; if (n === 1) this.blocks.delete(id); else this.blocks.set(id, n - 1); this.save(); return true; }
  has(item) { return this.items.has(item); }
}
