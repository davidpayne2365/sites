// The streamed world on the main thread: chunk columns arrive from a pool of workers (blocks, light and meshes);
// players' edits change blocks, relight around them and remesh just the touched sections.
import * as THREE from 'three';
import { T_OPAQUE, T_EMIT, T_DIM, T_SOLID, T_SHAPE, SHAPE } from '../blocks.js';
import { meshSection } from './mesher.js';

export const C = 32, H = 256, NSEC = H / C;
const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

export class World {
  constructor({ scene, textures, materials, seed, onColumn, onUnload }) {
    this.scene = scene; this.textures = textures; this.materials = materials; this.seed = seed;
    this.cols = new Map();
    this.pending = new Map();
    this.onColumn = onColumn; this.onUnload = onUnload;
    this.edits = new Map(); // "x,y,z" -> id
    this.colEdits = new Map(); // column key -> Map("x,y,z" -> id)
    this.dirty = new Set(); // "cx,cz,sy" sections to remesh
    this.stats = { gen: 0, light: 0, mesh: 0, n: 0 };
    const n = Math.max(2, Math.min(12, (navigator.hardwareConcurrency || 4) - 1));
    this.workers = [];
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      w.busy = 0;
      w.onmessage = e => {
        if (e.data.type === 'farmap') { this.onFarMap && this.onFarMap(e.data); return; }
        if (e.data.type === 'trail') { w.busy--; this.onTrail && this.onTrail(e.data); return; }
        w.busy--;
        if (e.data.type === 'lod') { this.onLod && this.onLod(e.data); return; }
        this.receive(e.data);
      };
      w.onerror = e => console.error('worker error', e.message || e);
      this.workers.push(w);
    }
    this.seq = 0;
    this.jobs = [];        // distant-structure jobs, nearest first (see lod.js)
    this.missR = Infinity; // distance (blocks) to the nearest column not loaded yet
    this.done = [];        // conquered places (see util.js DONE), sent with every job
  }
  // The coin trail through an underground system (worked out by a worker: see worker.js trailPlan).
  requestTrail(msg) { const w = this.workers.reduce((a, b) => (b.busy < a.busy ? b : a)); w.busy++; w.postMessage({ ...msg, type: 'trail', seed: this.seed, done: this.done }); }
  // Hide what's drawn at or above height y in this box (a castle coming down: the falling copy takes over until the
  // rebuilt columns arrive).
  hideAbove(x0, z0, x1, z1, y) {
    for (const c of this.cols.values()) {
      if (c.cx * C + C <= x0 || c.cx * C > x1 || c.cz * C + C <= z0 || c.cz * C > z1) continue;
      for (let sy = Math.floor(y / C); sy < c.meshes.length; sy++) if (c.meshes[sy]) for (const o of c.meshes[sy]) { o.visible = false; o.userData.held = true; }
    }
    // (and skip redrawing them meanwhile: the rebuilt columns replace them anyway)
    for (const k of [...this.dirty]) { const [cx, cz] = String(k).split(',').map(Number); if (!(cx * C + C <= x0 || cx * C > x1 || cz * C + C <= z0 || cz * C > z1)) this.dirty.delete(k); }
  }
  // Build these columns again (a place was conquered): the old ones stay on screen until the new ones arrive.
  regen(x0, z0, x1, z1) {
    for (const [k, c] of this.cols) {
      if (c.cx * C + C <= x0 || c.cx * C > x1 || c.cz * C + C <= z0 || c.cz * C > z1) continue;
      const w = this.workers.reduce((a, b) => (b.busy < a.busy ? b : a));
      this.request(w, c.cx, c.cz, k);
    }
  }
  // A labyrinth picture for the far distance (computed by the last worker so chunk building isn't held up).
  requestFarMap(x0, z0, size, scale, id) { this.workers[this.workers.length - 1].postMessage({ type: 'farmap', x0, z0, size, scale, seed: this.seed, id, done: this.done }); }

  // --- block access ---
  col(cx, cz) { return this.cols.get(ckey(cx, cz)); }
  get(x, y, z) {
    if (y < 0) return 1;
    if (y >= H) return 0;
    const c = this.cols.get(ckey(x >> 5, z >> 5));
    if (!c) return -1;
    const s = c.sections[y >> 5];
    return s.ids ? s.ids[(x & 31) + C * ((z & 31) + C * (y & 31))] : s.uni;
  }
  light(x, y, z) {
    if (y >= H) return 0xf0;
    if (y < 0) return 0;
    const c = this.cols.get(ckey(x >> 5, z >> 5));
    if (!c) return 0;
    const s = c.sections[y >> 5];
    return s.light ? s.light[(x & 31) + C * ((z & 31) + C * (y & 31))] : s.uniL;
  }
  loaded(x, z) { return this.cols.has(ckey(x >> 5, z >> 5)); }
  solidAt(x, y, z) { const id = this.get(x, y, z); return id < 0 ? 1 : id ? T_SOLID[id] : 0; }

  // --- streaming ---
  update(centres, radius) {
    // Request the nearest missing columns; drop far ones.
    const want = [];
    const r2 = radius * radius;
    for (const [px, pz] of centres) {
      const ccx = Math.floor(px / C), ccz = Math.floor(pz / C);
      for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        const k = ckey(ccx + dx, ccz + dz);
        if (!this.cols.has(k) && !this.pending.has(k)) want.push([d2, ccx + dx, ccz + dz, k]);
      }
    }
    want.sort((a, b) => a[0] - b[0]);
    let miss = Infinity;
    for (const [px, pz] of centres) for (const [, cx, cz] of want.slice(0, 64)) miss = Math.min(miss, Math.hypot(cx * C + 16 - px, cz * C + 16 - pz) - 24);
    for (const [k] of this.pending) { const cx = Math.floor(k / 65536) - 32768, cz = (k % 65536) - 32768; for (const [px, pz] of centres) miss = Math.min(miss, Math.hypot(cx * C + 16 - px, cz * C + 16 - pz) - 24); }
    this.missR = Math.max(0, miss);
    for (const [, cx, cz, k] of want) {
      const w = this.workers.reduce((a, b) => (b.busy < a.busy ? b : a));
      if (w.busy >= 2) break;
      if (this.pending.has(k)) continue;
      this.request(w, cx, cz, k);
    }
    // Distant structures: on the spare worker while chunks stream in, on every idle worker once they're done.
    for (let i = this.workers.length - 1; i >= 0 && this.jobs.length; i--) {
      const w = this.workers[i];
      if (w.busy || (want.length && i !== this.workers.length - 1)) continue;
      w.busy++; w.postMessage({ ...this.jobs.shift(), seed: this.seed, done: this.done });
    }
    const far = (radius + 2) * (radius + 2);
    for (const [k, c] of this.cols) {
      let keep = false;
      for (const [px, pz] of centres) { const dx = c.cx - Math.floor(px / C), dz = c.cz - Math.floor(pz / C); if (dx * dx + dz * dz <= far) { keep = true; break; } }
      if (!keep) this.unload(k, c);
    }
  }
  request(w, cx, cz, k) {
    const edits = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const m = this.colEdits.get(ckey(cx + dx, cz + dz));
      if (m) for (const [key, id] of m) { const [x, y, z] = key.split(',').map(Number); edits.push([x, y, z, id]); }
    }
    const id = ++this.seq;
    this.pending.set(k, id);
    w.busy++;
    w.postMessage({ type: 'gen', cx, cz, seed: this.seed, edits, id, done: this.done });
  }
  receive(m) {
    const k = ckey(m.cx, m.cz);
    if (this.pending.get(k) !== m.id) return; // superseded or unloaded
    this.pending.delete(k);
    const old = this.cols.get(k); if (old) this.unload(k, old); // a rebuilt column replaces the old one
    const st = this.stats; st.gen += m.ms[0]; st.light += m.ms[1]; st.mesh += m.ms[2]; st.n++;
    const c = { cx: m.cx, cz: m.cz, sections: m.sections, meshes: new Array(NSEC).fill(null), topId: m.topId, topY: m.topY,
      chests: m.chests, coins: m.coins, fx: m.fx, marks: m.marks, portals: m.portals || [] };
    this.cols.set(k, c);
    for (let sy = 0; sy < NSEC; sy++) this.setMesh(c, sy, m.meshes[sy]);
    this.onColumn && this.onColumn(c);
  }
  unload(k, c) {
    for (let sy = 0; sy < NSEC; sy++) this.setMesh(c, sy, null);
    this.cols.delete(k);
    this.onUnload && this.onUnload(c);
  }
  setMesh(c, sy, m) {
    const old = c.meshes[sy];
    if (old) { for (const o of old) { this.scene.remove(o); o.geometry.dispose(); } }
    c.meshes[sy] = null;
    if (!m) return;
    for (const id of m.used) this.textures.use(id);
    const objs = [];
    const S = this.materials.solid, T = this.materials.trans;
    for (const [part, mat, deep] of [[m.solid, S, 0], [m.trans, T, 0], [m.dsolid, S, 1], [m.dtrans, T, 1]]) {
      if (!part) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('aPos', new THREE.Int16BufferAttribute(part.pos, 4));
      g.setAttribute('aData', new THREE.Uint16BufferAttribute(part.dat, 2));
      g.setIndex(new THREE.Uint32BufferAttribute(part.idx, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(16, sy * C + 16, 16), 28);
      g.boundingBox = new THREE.Box3(new THREE.Vector3(0, sy * C, 0), new THREE.Vector3(C, sy * C + C, C));
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.set(c.cx * C, 0, c.cz * C);
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      if (mat === this.materials.trans) mesh.renderOrder = 1;
      if (deep) { mesh.userData.deep = true; mesh.visible = this.deepShown(c); }
      this.scene.add(mesh);
      objs.push(mesh);
    }
    c.meshes[sy] = objs;
  }

  // The deep (everything below y 56: caverns, their castles, the tunnel network) can be left undrawn while every
  // player is up on the ground, apart from the few columns right round them (so a stairway down still looks right).
  // near: null (draw it all) or a list of [cx, cz] the players stand in.
  deepShown(c) {
    const n = this.deepNear;
    if (!n) return true;
    for (const [x, z] of n) if (Math.abs(c.cx - x) <= 1 && Math.abs(c.cz - z) <= 1) return true;
    return false;
  }
  setDeepNear(near) {
    const key = near ? near.map(a => a.join(',')).join(';') : '';
    if (key === this.deepKey) return;
    this.deepKey = key; this.deepNear = near;
    for (const c of this.cols.values()) {
      const show = this.deepShown(c);
      for (const objs of c.meshes) if (objs) for (const o of objs) if (o.userData.deep && !o.userData.held) o.visible = show;
    }
  }

  // --- edits ---
  set(x, y, z, id) {
    if (y < 0 || y >= H) return false;
    const c = this.col(x >> 5, z >> 5);
    if (!c) return false;
    const sec = c.sections[y >> 5];
    if (!sec.ids) { sec.ids = new Uint16Array(C * C * C).fill(sec.uni); sec.light = new Uint8Array(C * C * C).fill(sec.uniL); }
    const i = (x & 31) + C * ((z & 31) + C * (y & 31)), old = sec.ids[i];
    if (old === id) return false;
    sec.ids[i] = id;
    const key = `${x},${y},${z}`, ck = ckey(x >> 5, z >> 5);
    this.edits.set(key, id);
    if (!this.colEdits.has(ck)) this.colEdits.set(ck, new Map());
    this.colEdits.get(ck).set(key, id);
    this.relight(x, y, z, old, id);
    this.touch(x, y, z);
    if (c.topId) { // keep the map in step
      const t = (x & 31) + (z & 31) * C;
      if (id && T_SHAPE[id] !== SHAPE.cross && y >= c.topY[t]) { c.topId[t] = id; c.topY[t] = y; c.mapV = (c.mapV || 0) + 1; }
      else if (!id && y === c.topY[t]) { for (let yy = y - 1; yy >= 0; yy--) { const b = this.get(x, yy, z); if (b > 0 && T_SHAPE[b] !== SHAPE.cross) { c.topId[t] = b; c.topY[t] = yy; break; } } c.mapV = (c.mapV || 0) + 1; }
    }
    return true;
  }
  // Mark the section holding (x, y, z) and any neighbour sections whose faces depend on it.
  touch(x, y, z) {
    const cx = x >> 5, cz = z >> 5, sy = y >> 5;
    const add = (a, b, s) => { if (s >= 0 && s < NSEC && this.col(a, b)) this.dirty.add(`${a},${b},${s}`); };
    add(cx, cz, sy);
    const lx = x & 31, lz = z & 31, ly = y & 31;
    if (lx === 0) add(cx - 1, cz, sy); if (lx === 31) add(cx + 1, cz, sy);
    if (lz === 0) add(cx, cz - 1, sy); if (lz === 31) add(cx, cz + 1, sy);
    if (ly === 0) add(cx, cz, sy - 1); if (ly === 31) add(cx, cz, sy + 1);
    // Corners matter for smooth lighting too.
    if ((lx === 0 || lx === 31) && (lz === 0 || lz === 31)) add(cx + (lx ? 1 : -1), cz + (lz ? 1 : -1), sy);
  }
  setLight(x, y, z, v) {
    if (y < 0 || y >= H) return;
    const c = this.col(x >> 5, z >> 5); if (!c) return;
    const sec = c.sections[y >> 5];
    if (!sec.light) { sec.ids = new Uint16Array(C * C * C).fill(sec.uni); sec.light = new Uint8Array(C * C * C).fill(sec.uniL); }
    const i = (x & 31) + C * ((z & 31) + C * (y & 31));
    if (sec.light[i] !== v) { sec.light[i] = v; this.touch(x, y, z); }
  }
  // Incremental light update for one changed cell (standard removal + refill flood, both channels).
  relight(x, y, z, oldId, newId) {
    const N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const ch of [4, 0]) {
      const get = (a, b, c) => (this.light(a, b, c) >> ch) & 15;
      const put = (a, b, c, v) => { const l = this.light(a, b, c); this.setLight(a, b, c, ch ? (l & 0x0f) | (v << 4) : (l & 0xf0) | v); };
      const rem = [], add = [];
      const cur = get(x, y, z);
      // Remove the old light at the cell and everything that depended on it.
      put(x, y, z, 0);
      rem.push([x, y, z, cur]);
      let guard = 0;
      while (rem.length && guard++ < 200000) {
        const [a, b, c, lv] = rem.pop();
        for (const [dx, dy, dz] of N) {
          const nx = a + dx, ny = b + dy, nz = c + dz;
          if (!this.loaded(nx, nz) || ny < 0 || ny >= H) continue;
          const nl = get(nx, ny, nz);
          if (!nl) continue;
          const dependent = nl < lv || (ch && dy === -1 && lv === 15 && nl === 15);
          if (dependent) { put(nx, ny, nz, 0); rem.push([nx, ny, nz, nl]); }
          else add.push([nx, ny, nz]);
        }
      }
      // New sources: the cell itself if it emits, and open-sky cells.
      if (!ch && T_EMIT[newId]) { put(x, y, z, T_EMIT[newId]); add.push([x, y, z]); }
      if (ch && !T_OPAQUE[newId]) {
        const above = y + 1 >= H ? 15 : get(x, y + 1, z);
        if (above === 15 && !T_DIM[newId]) { put(x, y, z, 15); add.push([x, y, z]); }
      }
      while (add.length && guard++ < 400000) {
        const [a, b, c] = add.pop();
        const lv = get(a, b, c);
        if (lv < 2) continue;
        for (const [dx, dy, dz] of N) {
          const nx = a + dx, ny = b + dy, nz = c + dz;
          if (ny < 0 || ny >= H || !this.loaded(nx, nz)) continue;
          const nid = this.get(nx, ny, nz);
          if (nid < 0 || T_OPAQUE[nid]) continue;
          const nl = ch && dy === -1 && lv === 15 && !T_DIM[nid] ? 15 : lv - 1 - T_DIM[nid];
          if (nl > get(nx, ny, nz)) { put(nx, ny, nz, nl); add.push([nx, ny, nz]); }
        }
      }
    }
  }
  // Remesh a few dirty sections per frame on the main thread.
  flushDirty(max = 6) {
    let n = 0;
    for (const key of this.dirty) {
      this.dirty.delete(key);
      const [cx, cz, sy] = key.split(',').map(Number);
      const c = this.col(cx, cz);
      if (!c) continue;
      this.remesh(c, sy);
      if (++n >= max) break;
    }
  }
  remesh(c, sy) {
    const S = C + 2, y0 = sy * C;
    const ids = new Uint16Array(S * S * S), lt = new Uint8Array(S * S * S);
    const bx = c.cx * C - 1, bz = c.cz * C - 1;
    for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const wy = y0 - 1 + y, i = x + S * (z + S * y);
      const id = this.get(bx + x, wy, bz + z);
      ids[i] = id < 0 ? 1 : id; // unloaded neighbours count as solid
      lt[i] = this.light(bx + x, wy, bz + z);
    }
    const m = meshSection(ids, lt, S, S, y0 - 1, S, 1, 1, y0);
    this.setMesh(c, sy, m);
  }
}
