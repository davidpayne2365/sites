// Horses, ported from the castles-and-dungeons branch (js/engine/horses.js there).
// Every player starts with their own saddled palomino standing beside them, facing the castle. Walk up to it and hop
// on (E / A / tap); E / B to hop off, and it stays right where you left it (kept between visits).
// Models: assets/creatures (Sketchfab, credited in assets/CREDITS.md), animated by js/creatures.js.
import { CreatureModels } from './creatures.js';

// clips: the model's own names for walk / run (gallop) / idle; attack is used for grazing (a one-shot).
export const BREEDS = [
  { id: 'palomino', model: 'cr_toon_horse_with_saddle_rigge_db8fe3', coat: 'palomino', h: 2.3, clips: { walk: 'Walk', run: 'Gallop', idle: 'Rest' } },
].map(b => ({ ...b, key: 'horse:' + b.id, id: 'horse:' + b.id }));
// Each player's starting horse: breed, name and where it waits (beside the spawn point, facing the castle).
const STARTERS = [
  { breed: 'horse:palomino', name: 'Galen', x: -4, z: 1 },
  { breed: 'horse:palomino', name: 'Juniper', x: -7.5, z: 1 },
  { breed: 'horse:palomino', name: 'Storm', x: -11, z: 1 },
  { breed: 'horse:palomino', name: 'Wren', x: -14.5, z: 1 },
];
const SAVE = 'skyforge.horse.v1';

export class Horses {
  constructor({ scene, world }) {
    this.world = world; this.models = new CreatureModels(scene);
    // Each player's own horse: mines[slot] is what's kept between visits, steeds[slot] the horse in the world
    // { c, x, y, z, yaw, ridden }.
    this.mines = []; this.steeds = [];
    for (let slot = 0; slot < 4; slot++) {
      let m = null; try { m = JSON.parse(localStorage.getItem(this.key(slot)) || 'null'); } catch (e) { /* none */ }
      if (m && (!Number.isFinite(m.x) || !BREEDS.find(b => b.id === m.breed))) m = null;
      this.mines[slot] = m;
    }
  }
  key(slot) { return slot ? `${SAVE}.p${slot + 1}` : SAVE; }
  breed(id) { return BREEDS.find(b => b.id === id) || BREEDS[0]; }
  save(slot = 0) {
    const m = this.mines[slot], st = this.steeds[slot];
    if (m && st) Object.assign(m, { x: st.x, y: st.y, z: st.z, yaw: st.yaw });
    try { localStorage.setItem(this.key(slot), JSON.stringify(m || null)); } catch (e) { /* full */ }
  }
  saveAll() { this.mines.forEach((m, slot) => { if (m) this.save(slot); }); }
  solid(x, y, z) { return this.world.isSolid(Math.floor(x), Math.floor(y), Math.floor(z)); }
  // The ground under a spot: the first standing place found scanning down from `from`.
  ground(x, z, from = 8) {
    for (let y = Math.floor(from); y >= 0; y--) if (this.solid(x, y - 1, z) && !this.solid(x, y, z)) return y;
    return 0;
  }
  // ---------------------------------------------------------------------------
  // p: player 1; players: every local player (each gets a starting horse).
  update(p, dt, players = [p]) {
    for (const q of players) if (q && !this.mines[q.slot]) { // a new player: their horse waits beside the start
      const s = STARTERS[q.slot] || STARTERS[0];
      this.mines[q.slot] = { breed: s.breed, name: s.name, x: s.x, y: 0, z: s.z, yaw: Math.PI };
    }
    for (const m of this.mines) if (m) this.models.want(this.breed(m.breed));
    this.mines.forEach((m, slot) => { if (m && !this.steeds[slot]) this.place(p, slot); });
    for (const st of this.steeds) if (st && !st.ridden) this.idleSteed(st, dt);
  }
  step(c, dt, p, x, z) {
    c.acc = (c.acc || 0) + dt; c.n = (c.n || 0) + 1;
    if (!p || Math.hypot(x - p.pos.x, z - p.pos.z) < 50 || c.n % 3 === 0) { c.mixer.update(c.acc); c.acc = 0; }
  }
  // Your horse, if you're standing close enough to hop on, or null.
  near(p, r = 3.6) {
    const s = this.steeds[p.slot || 0];
    return s && !s.ridden && Math.hypot(s.x - p.pos.x, s.z - p.pos.z) < r && Math.abs(s.y - p.pos.y) < 2.5 ? s : null;
  }
  nameOf(slot = 0) { const m = this.mines[slot]; return m ? m.name : 'your horse'; }
  mount(h, slot = 0) { this.steeds[slot].ridden = true; this.save(slot); }
  dismount(slot = 0) { const st = this.steeds[slot]; if (st) { st.ridden = false; this.save(slot); } }
  // Your horse where you left it, once you're near enough to see it (it keeps its place between visits).
  place(p, slot = 0) {
    const m = this.mines[slot]; if (!m || this.steeds[slot] || !p || Math.hypot(m.x - p.pos.x, m.z - p.pos.z) > 230) return;
    const b = this.breed(m.breed), r = this.models.ready(b.id);
    if (r === null) { this.models.want(b); return; }
    const c = r && this.models.take(b); if (!c) return;
    this.steeds[slot] = { c, x: m.x, y: m.y, z: m.z, yaw: m.yaw || 0, ridden: false };
  }
  // Riding: the horse under you, turned your way, its legs going with your speed.
  ride(p, dt) {
    const s = this.steeds[p.slot || 0]; if (!s) return;
    s.ridden = true;
    const yaw = p.yaw + Math.PI, fx = -Math.sin(p.yaw) * 0.25, fz = -Math.cos(p.yaw) * 0.25;
    s.x = p.pos.x + fx; s.z = p.pos.z + fz; s.y = p.pos.y; s.yaw = yaw;
    const c = s.c, sp = Math.hypot(p.vel.x, p.vel.z);
    c.obj.position.set(s.x, s.y - 0.05, s.z); c.obj.rotation.y = yaw;
    if (!p.onGround && p.vel.y > 1 && c.acts.run) this.models.play(c, 'run', 1.3);
    else if (sp > 7.5) this.models.play(c, 'run', Math.max(0.8, Math.min(1.6, sp / 13)));
    else if (sp > 0.6) this.models.play(c, 'walk', Math.max(0.6, Math.min(1.8, sp / 4)));
    else this.models.play(c, 'idle', 1);
    this.step(c, dt, null, s.x, s.z);
  }
  idleSteed(s, dt) {
    // (left standing over a hole, e.g. a block broken from under it: it drops to the ground)
    const gy = this.ground(s.x, s.z, s.y + 0.5);
    if (gy < s.y) s.y = Math.max(gy, s.y - 20 * dt);
    const c = s.c; c.obj.position.set(s.x, s.y - 0.05, s.z); c.obj.rotation.y = s.yaw;
    this.models.play(c, 'idle', 1); this.step(c, dt, null, s.x, s.z);
  }
}
