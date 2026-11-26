// The reef-restoration quest, told only through the world (no text, no menus).
// Each grove is bleached white. A glowing ghost block over its altar shows the colour it wants.
// Put a block of that colour near the altar and the grove blooms back into colour.
// Heal all three and the whole reef celebrates, and you earn the golden fish.
import { B, NBLOCKS } from './blocks.js';
import { NX, NZ, VS } from './world.js';

export class Quest {
  constructor(world, hooks) {
    this.world = world; this.hooks = hooks; this.groves = world.groves; this.queue = []; this.allDone = false;
  }
  get healedCount() { return this.groves.filter(g => g.healed).length; }
  // Called whenever the player puts a block into the world.
  onPlace(x, y, z, id) {
    for (const g of this.groves) {
      if (g.healed || id !== g.need) continue;
      const dx = x - g.x, dz = z - g.z;
      if (Math.abs(dx) <= 5 && Math.abs(dz) <= 5 && y > g.base && y <= g.base + 7) { this.heal(g, false); return; }
    }
    // a wrong block on an altar: a gentle "not that one"
    for (const g of this.groves) if (!g.healed && Math.abs(x - g.x) <= 2 && Math.abs(z - g.z) <= 2 && y > g.base && y <= g.base + 5) this.hooks.onWrong?.(g);
  }
  heal(g, instant) {
    if (g.healed) return; g.healed = true;
    const w = this.world, ids = w.ids, pal = g.pal;
    const items = [];
    for (const i of g.bleached) {
      if (ids[i] !== B.CORAL_SKELETON) continue;
      const x = i % NX, z = ((i / NX) | 0) % NZ, y = (i / (NX * NZ)) | 0;
      const d = Math.hypot(x - g.x, z - g.z), h = Math.abs(i * 2654435761 % 997) / 997;
      items.push({ x, y, z, id: pal[Math.floor(h * pal.length) % pal.length], t: instant ? 0 : d * 0.22 + (y - g.base) * 0.04 });
    }
    // little fronds sprout around the grove
    const SPR = [B.CORAL_PINK, B.CORAL_CYAN, B.CORAL_GREEN, B.SEAGRASS];
    for (let n = 0; n < 160; n++) {
      const a = (n * 2.399) % 6.2832, d = 3 + (n % 17) * 0.95, x = Math.round(g.x + Math.cos(a) * d), z = Math.round(g.z + Math.sin(a) * d);
      let y = w.colTop[x + NX * z] + 1; if (y < 2 || w.ids[w.idx(x, y, z)] !== 0) continue;
      items.push({ x, y, z, id: SPR[n % SPR.length], t: instant ? 0 : d * 0.22 + 0.5 });
    }
    items.sort((a, b) => a.t - b.t);
    if (instant) { for (const it of items) if (w.get(it.x, it.y, it.z) === 0 || w.get(it.x, it.y, it.z) === B.CORAL_SKELETON) w.set(it.x, it.y, it.z, it.id, false); }
    else { this.queue.push({ items, i: 0, t: 0 }); this.hooks.onHeal?.(g); }
    if (!this.allDone && this.groves.every(q => q.healed)) { this.allDone = true; if (!instant) this.hooks.onAll?.(); }
  }
  update(dt) {
    for (let k = this.queue.length - 1; k >= 0; k--) {
      const q = this.queue[k]; q.t += dt;
      let n = 0;
      while (q.i < q.items.length && q.items[q.i].t <= q.t && n < 500) {
        const it = q.items[q.i++], cur = this.world.get(it.x, it.y, it.z);
        if (cur === B.CORAL_SKELETON || cur === 0) this.world.set(it.x, it.y, it.z, it.id, false);
        n++;
      }
      if (q.i >= q.items.length) this.queue.splice(k, 1);
    }
  }
  state() { return this.groves.map(g => g.healed ? 1 : 0); }
  restore(flags) { (flags || []).forEach((f, i) => { if (f && this.groves[i]) this.heal(this.groves[i], true); }); }
}
