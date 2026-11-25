// Distant structures: every castle and floating castle out to the horizon is built for real by a worker and
// shrunk (2x just past the loaded chunks, 4x and 8x farther), so the skyline shows the actual towers, spires and islands you can go to.
// The copies fade into the real chunks: their shader skips everything inside the loaded radius.
import * as THREE from 'three';
import { regionPlan, RS } from '../gen/maze.js';

const BIG = { castle: 40, ruins: 40, skycastle: 40, floating: 72 };

export class FarStructures {
  constructor({ scene, world, textures, materials, seed, layer }) {
    Object.assign(this, { scene, world, textures, materials, seed, layer });
    this.items = new Map();   // key -> structure
    this.plans = new Map();   // 'rx,rz' -> [structures] (cached)
    this.seq = 0;
    this.byReq = new Map();
    world.onLod = m => this.receive(m);
  }
  structuresOf(rx, rz) {
    const key = rx + ',' + rz;
    if (this.plans.has(key)) return this.plans.get(key);
    const plan = regionPlan(rx, rz, this.seed), out = [];
    for (const c of plan.clearings) {
      const m = BIG[c.kind];
      if (!m || (this.world.done || []).includes(`${c.bx0},${c.bz0}`)) continue; // brought down: nothing on the skyline
      const x0 = Math.floor((c.bx0 - m) / 4) * 4, z0 = Math.floor((c.bz0 - m) / 4) * 4;
      const sx = Math.ceil((c.bx1 + m + 1 - x0) / 4) * 4, sz = Math.ceil((c.bz1 + m + 1 - z0) / 4) * 4;
      out.push({ key: `${c.bx0},${c.bz0}`, x0, z0, sx, sz, box: [c.bx0, c.bz0, c.bx1, c.bz1], cx: x0 + sx / 2, cz: z0 + sz / 2, r: Math.hypot(sx, sz) / 2, kind: c.kind });
    }
    this.plans.set(key, out);
    if (this.plans.size > 4000) this.plans.clear();
    return out;
  }
  // radius: how far to show structures; loadedR: how far the real chunks are all in.
  update(px, pz, radius, loadedR, budget) {
    const rr = Math.ceil(radius / RS) + 1, rx0 = Math.floor(px / RS), rz0 = Math.floor(pz / RS);
    const seen = new Set();
    for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
      for (const s of this.structuresOf(rx0 + dx, rz0 + dz)) {
        const d = Math.hypot(s.cx - px, s.cz - pz) - s.r;
        if (d > radius) continue;
        seen.add(s.key);
        let it = this.items.get(s.key);
        if (!it) { it = { ...s, k: 0, meshes: [], want: 0, inflight: 0 }; this.items.set(s.key, it); }
        it.d = d;
      }
    }
    for (const [key, it] of this.items) {
      if (!seen.has(key) && it.d > radius + 200) { this.drop(it); this.items.delete(key); continue; }
      // Wholly inside the real chunks: nothing to draw. Otherwise 2x detail nearer than ~900 blocks, 4x beyond.
      const covered = Math.hypot(it.cx - px, it.cz - pz) + it.r < loadedR;
      for (const m of it.meshes) m.visible = !covered;
      // Shrunk 2x just beyond the loaded chunks, 4x farther out, 8x near the horizon (a little slack either way).
      const near = loadedR + (it.k === 2 ? 260 : 200), mid = it.k === 8 ? 1250 : 1350;
      it.want = covered ? it.k : it.d < near ? 2 : it.d < mid ? 4 : 8;
    }
    // Queue the jobs still needed, nearest first.
    const need = [...this.items.values()].filter(it => it.want && it.want !== it.k && it.inflight !== it.want).sort((a, b) => a.d - b.d);
    const busy = [...this.items.values()].filter(it => it.inflight).length;
    this.world.jobs = need.slice(0, Math.max(0, budget - busy)).map(it => {
      const id = ++this.seq; it.inflight = it.want; it.req = id; this.byReq.set(id, it);
      return { type: 'lod', id, x0: it.x0, z0: it.z0, sx: it.sx, sz: it.sz, k: it.want, box: it.box };
    }).concat(this.world.jobs.filter(j => this.byReq.has(j.id) && this.byReq.get(j.id).req === j.id && this.items.has(this.byReq.get(j.id).key)));
  }
  receive(m) {
    const it = this.byReq.get(m.id);
    this.byReq.delete(m.id);
    if (!it || it.req !== m.id || !this.items.has(it.key)) return;
    it.inflight = 0;
    this.drop(it);
    it.k = m.k;
    const k = m.k, [n, ny, mz] = m.dims;
    for (const id of m.used) this.textures.use(id);
    for (const [part, mat] of [[m.solid, this.materials.solid], [m.trans, this.materials.trans]]) {
      if (!part) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('aPos', new THREE.Int16BufferAttribute(part.pos, 4));
      g.setAttribute('aData', new THREE.Uint16BufferAttribute(part.dat, 2));
      g.setIndex(new THREE.Uint32BufferAttribute(part.idx, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(n / 2, ny / 2, mz / 2), Math.hypot(n, ny, mz) / 2);
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.set(m.x0, 0, m.z0);
      mesh.scale.setScalar(k);
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      mesh.layers.set(this.layer);
      if (mat === this.materials.trans) mesh.renderOrder = 1;
      this.scene.add(mesh);
      it.meshes.push(mesh);
    }
  }
  // A castle brought down: off the skyline now (and not planned again).
  forget(key) {
    for (const [k, plan] of this.plans) { const i = plan.findIndex(s => s.key === key); if (i >= 0) plan.splice(i, 1); void k; }
    const it = this.items.get(key); if (it) { this.drop(it); this.items.delete(key); }
  }
  drop(it) { for (const m of it.meshes) { this.scene.remove(m); m.geometry.dispose(); } it.meshes = []; it.k = 0; }
  get pending() { let n = 0; for (const it of this.items.values()) if (it.want && it.want !== it.k) n++; return n; }
  get count() { let n = 0; for (const it of this.items.values()) if (it.meshes.length) n++; return n; }
}
