// Exploration map. Everything you've seen is remembered (in IndexedDB), even far away, so the map grows as you
// explore. Three modes, cycled with M (keyboard) / D-pad down (controller):
//   corner — a small map in the top right that follows you
//   full   — a full-screen map: drag / arrows / left stick to move, wheel / + − / triggers to zoom,
//            C / right-stick click to centre on you, U / X to switch surface and underground, M / Esc / B to close
//   off
// Landmarks (castles, sky castles, dungeon, cave and mine entrances) appear once you've been near enough to see them;
// opened chests are marked with a gold star. One marker of your own: click / tap a spot on the full map (or A at the
// crosshair with a controller) to place it, again on it to remove it; the compass at the top of the screen points to it.
import { regionPlan } from '../gen/maze.js';
import { placeName } from '../gen/util.js';
import { T_SOLID, T_SHAPE, SHAPE } from '../blocks.js';
import { floatingInfo, castleIdentity, deepIdentity } from '../gen/castle.js';
import { deepInfo, entrancesOf } from '../gen/deep.js';
const C = 32, RS = 192;
const DB = 'skyforge-labyrinth', STORE = 'map';
const UNDER = { dungeon: 'Dungeon', caves: 'Caves', tunnels: 'Mine' };

export class ExploreMap {
  constructor(world, textures, treasure, seed) {
    this.world = world; this.textures = textures; this.treasure = treasure; this.seed = seed;
    this.cols = new Map();      // "cx,cz" -> { s: seen bits (1 surface, 2 underground), t: top block id, y: top height, v }
    this.regions = new Map();   // "rx,rz,layer" -> { canvas, v }
    this.marks = new Map();     // landmark key -> { x, z, icon, label, found }
    this.dirty = new Set();
    this.mode = 1;
    this.view = { x: 0, z: 0, scale: 2, follow: true, under: false };
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'map';
    document.body.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.panel = document.createElement('div');
    this.panel.id = 'mapinfo';
    this.panel.hidden = true;
    document.body.appendChild(this.panel);
    this.markers = []; // extra markers added this session
    this.wkey = `skyforge.waypoint.${seed}`;
    this.waypoint = null; // your one marker: { x, z }
    try { const w = JSON.parse(localStorage.getItem(this.wkey) || 'null'); if (w && Number.isFinite(w.x) && Number.isFinite(w.z)) this.waypoint = w; } catch (e) { /* ignore */ }
    try { const v = localStorage.getItem('skyforge.labyrinth.mapmode'); if (v === '0' || v === '1') this.mode = Number(v); } catch (e) { /* ignore */ }
    this.load();
    setInterval(() => this.save(), 4000);
    addEventListener('pagehide', () => this.save());
    this.bindMouse();
  }
  get isFull() { return this.mode === 2; }

  // --- storage ---
  key(cx, cz) { return `${this.seed}:${cx},${cz}`; }
  open() {
    if (this.dbp) return this.dbp;
    this.dbp = new Promise(res => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return this.dbp;
  }
  async load() {
    const db = await this.open();
    if (!db) return;
    const tx = db.transaction(STORE, 'readonly'), st = tx.objectStore(STORE);
    const kq = st.getAllKeys(), vq = st.getAll();
    const prefix = this.seed + ':';
    vq.onsuccess = () => {
      const keys = kq.result || [], vals = vq.result || [];
      keys.forEach((key, n) => {
        const k = String(key), v = vals[n];
        if (!k.startsWith(prefix) || !v) return;
        const rest = k.slice(prefix.length);
        if (rest === 'marks') { for (const m of v) { const have = this.marks.get(m.k); if (!have) this.marks.set(m.k, m); else if (m.found || m.known) Object.assign(have, m); } return; }
        const have = this.cols.get(rest);
        if (!have) this.cols.set(rest, { s: v.s, t: v.t, y: v.y, v: 1 });
        else for (let i = 0; i < C * C; i++) { if (!(have.s[i] & 3) && v.s[i]) { have.s[i] |= v.s[i]; have.t[i] = v.t[i]; have.y[i] = v.y[i]; } }
        this.touchRegion(rest);
      });
      this.loaded = true;
    };
  }
  async save() {
    if (!this.dirty.size && !this.marksDirty) return;
    const db = await this.open();
    if (!db) return;
    const tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE);
    for (const k of this.dirty) { const c = this.cols.get(k); if (c) st.put({ s: c.s, t: c.t, y: c.y }, this.seed + ':' + k); }
    this.dirty.clear();
    if (this.marksDirty) { st.put([...this.marks.values()], this.seed + ':marks'); this.marksDirty = false; }
  }
  col(cx, cz, make) {
    const k = cx + ',' + cz;
    let c = this.cols.get(k);
    if (!c && make) { c = { s: new Uint8Array(C * C), t: new Uint16Array(C * C), y: new Uint8Array(C * C), v: 0 }; this.cols.set(k, c); }
    return c;
  }
  touchRegion(k) {
    const [cx, cz] = k.split(',').map(Number);
    const rx = Math.floor(cx * C / RS), rz = Math.floor(cz * C / RS);
    for (const layer of [0, 1]) { const r = this.regions.get(`${rx},${rz},${layer}`); if (r) r.v = -1; }
  }

  // --- exploring ---
  // A chunk arrived: refresh what's known of its cells and remember its landmarks.
  onColumn(c) {
    const k = c.cx + ',' + c.cz, m = this.cols.get(k);
    if (m) { for (let i = 0; i < C * C; i++) if (m.s[i] & 1) { m.t[i] = c.topId[i]; m.y[i] = c.topY[i]; } this.touchRegion(k); }
    for (const mk of c.marks) {
      let x, z, icon, label;
      if (mk[0] === 'castle') { x = mk[1]; z = mk[3]; icon = mk[5] === 'sky' || mk[5] === 'floating' ? '☁' : /^Deep /.test(mk[4]) ? '✧' : '♜'; label = mk[4]; }
      else if (mk[0] === 'under') { x = mk[1]; z = mk[3]; icon = mk[4] === 'caves' ? '◒' : mk[4] === 'tunnels' ? '⛏' : '⚱'; label = `${UNDER[mk[4]] || 'Entrance'}${mk[5] ? ' of ' + mk[5] : ''}`; }
      else if (mk[0] === 'floating') { x = mk[1]; z = mk[3]; icon = '☁'; label = `${mk[4]}`; }
      else continue;
      const key = `${Math.round(x)},${Math.round(z)}`, have = this.marks.get(key);
      // The real name replaces the rumour (keeping whether you've found it).
      if (have) { have.label = label; have.icon = icon; have.known = true; } else this.marks.set(key, { k: key, x, z, icon, label, found: false, known: true });
    }
  }
  // Rumours: every big landmark within ~8 regions shows on the map (dim, with a "?") before you find it, so you
  // know where to head; the labyrinth paths themselves stay hidden until you walk them.
  scout(px, pz) {
    if (!this.scanned) { this.scanned = new Set(); this.scanQ = []; }
    const rx0 = Math.floor(px / RS), rz0 = Math.floor(pz / RS);
    if (this.scanFrom !== rx0 + ',' + rz0) {
      this.scanFrom = rx0 + ',' + rz0;
      this.scanQ = [];
      for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) if (!this.scanned.has((rx0 + dx) + ',' + (rz0 + dz))) this.scanQ.push([dx * dx + dz * dz, rx0 + dx, rz0 + dz]);
      this.scanQ.sort((a, b) => b[0] - a[0]);
    }
    for (let n = 0; n < 3 && this.scanQ.length; n++) {
      const [, rx, rz] = this.scanQ.pop(), k = rx + ',' + rz;
      if (this.scanned.has(k)) continue;
      this.scanned.add(k);
      const plan = regionPlan(rx, rz, this.seed);
      const add = (x, z, icon, label) => { const key = `${Math.round(x)},${Math.round(z)}`; if (!this.marks.has(key)) this.marks.set(key, { k: key, x, z, icon, label, found: false }); };
      for (const c of plan.clearings) {
        if (c.kind === 'floating') { const f = floatingInfo(plan); if (f) add(f.cx, f.cz, '☁', `${f.name}`); }
        else if (c.kind === 'castle' || c.kind === 'ruins' || c.kind === 'skycastle') { const id = castleIdentity(c); add((c.bx0 + c.bx1 + 1) / 2, (c.bz0 + c.bz1 + 1) / 2, c.kind === 'skycastle' ? '☁' : '♜', id.name); }
        else if (/Entrance$/.test(c.kind)) { const t = c.kind.replace('Entrance', ''); add(Math.floor((c.bx0 + c.bx1) / 2), Math.floor((c.bz0 + c.bz1) / 2), t === 'caves' ? '◒' : t === 'tunnels' ? '⛏' : '⚱', `${UNDER[t]} of ${placeName(c.seed)}`); }
      }
      // The deep: castles in glowing caverns far below, and the stairways down to them.
      const d = deepInfo(plan);
      if (d) add((d.c.bx0 + d.c.bx1 + 1) / 2, (d.c.bz0 + d.c.bz1 + 1) / 2, '✧', deepIdentity(d.c).name);
      for (const e of entrancesOf(plan)) add(Math.floor(e.x), Math.floor(e.z), '⇩', 'Stairway to the Deep');
    }
  }
  onEdit(x, z) {
    const c = this.cols.get((x >> 5) + ',' + (z >> 5)), wc = this.world.col(x >> 5, z >> 5);
    if (!c || !wc) return;
    const i = (x & 31) + (z & 31) * C;
    if (c.s[i] & 1) { c.t[i] = wc.topId[i]; c.y[i] = wc.topY[i]; c.v++; this.dirty.add((x >> 5) + ',' + (z >> 5)); this.touchRegion((x >> 5) + ',' + (z >> 5)); }
  }
  // Reveal around a player: a wide circle on the surface (higher up you see further), a narrow one underground.
  reveal(x, y, z) {
    const under = y < 60, r = under ? 4 : Math.min(24, 9 + Math.max(0, y - 68) * 0.25), bit = under ? 2 : 1;
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r), z0 = Math.floor(z - r), z1 = Math.floor(z + r);
    let lastK = '', c = null, wc = null;
    for (let wz = z0; wz <= z1; wz++) for (let wx = x0; wx <= x1; wx++) {
      if ((wx - x) * (wx - x) + (wz - z) * (wz - z) > r * r) continue;
      const k = (wx >> 5) + ',' + (wz >> 5);
      if (k !== lastK) { c = this.col(wx >> 5, wz >> 5, false); wc = this.world.col(wx >> 5, wz >> 5); lastK = k; }
      const i = (wx & 31) + (wz & 31) * C;
      if (c && (c.s[i] & bit)) continue;
      if (bit === 1 && !wc) continue; // wait until the chunk is here so the colour is known
      if (!c) c = this.col(wx >> 5, wz >> 5, true);
      c.s[i] |= bit;
      if (wc) { c.t[i] = wc.topId[i]; c.y[i] = wc.topY[i]; }
      this.dirty.add(k); this.touchRegion(k);
    }
    // Landmarks within sight (castles tower over the walls) become known.
    for (const m of this.marks.values()) if (!m.found && Math.hypot(m.x - x, m.z - z) < (m.icon === '☁' ? 160 : m.icon === '♜' ? 90 : 30)) { m.found = true; this.marksDirty = true; }
  }

  // --- drawing ---
  regionCanvas(rx, rz, under) {
    const key = `${rx},${rz},${under ? 1 : 0}`;
    let r = this.regions.get(key);
    const cv = this.textures.colorVersion;
    if (r && r.v === cv) return r.canvas;
    let any = false;
    for (let cz = rz * 6; cz < rz * 6 + 6 && !any; cz++) for (let cx = rx * 6; cx < rx * 6 + 6; cx++) if (this.cols.has(cx + ',' + cz)) { any = true; break; }
    if (!any) return null;
    if (!r) { const c = document.createElement('canvas'); c.width = c.height = RS; r = { canvas: c, g: c.getContext('2d'), v: -1 }; this.regions.set(key, r); }
    r.v = cv;
    const img = r.g.createImageData(RS, RS), d = img.data, cols = this.textures.colors, tex = this.textures;
    // Surface heights first (-1: not seen), so each spot can be shaded against its neighbours: the maze walls
    // stand up, lit from the top left, with a dark line along the foot of every wall. That makes the grid of
    // corridors crisp even where hedges and paths are similar greens.
    const Hm = under ? null : new Int16Array(RS * RS).fill(-1);
    if (Hm) for (let cz = 0; cz < 6; cz++) for (let cx = 0; cx < 6; cx++) {
      const m = this.cols.get((rx * 6 + cx) + ',' + (rz * 6 + cz)); if (!m) continue;
      for (let lz = 0; lz < C; lz++) for (let lx = 0; lx < C; lx++) { const i = lx + lz * C; if (m.s[i] & 1) Hm[(cz * C + lz) * RS + cx * C + lx] = m.y[i]; }
    }
    const hAt = (px, pz, y) => { if (px < 0 || pz < 0 || px >= RS || pz >= RS) return y; const h = Hm[pz * RS + px]; return h < 0 ? y : h; };
    for (let cz = 0; cz < 6; cz++) for (let cx = 0; cx < 6; cx++) {
      const m = this.cols.get((rx * 6 + cx) + ',' + (rz * 6 + cz));
      if (!m) continue;
      for (let lz = 0; lz < C; lz++) for (let lx = 0; lx < C; lx++) {
        const i = lx + lz * C, s = m.s[i];
        if (!s) continue;
        const o = ((cz * C + lz) * RS + cx * C + lx) * 4;
        if (under) {
          if (s & 2) { d[o] = 236; d[o + 1] = 178; d[o + 2] = 92; d[o + 3] = 255; }
          else { d[o] = 52; d[o + 1] = 60; d[o + 2] = 52; d[o + 3] = 200; }
          continue;
        }
        if (!(s & 1)) { if (s & 2) { d[o] = 120; d[o + 1] = 92; d[o + 2] = 56; d[o + 3] = 255; } continue; }
        const id = m.t[i], y = m.y[i];
        if (id && !tex.ready[id]) tex.use(id);
        let sh = Math.max(0.45, Math.min(1.55, 0.55 + (y - 60) * 0.09));
        const px = cx * C + lx, pz = cz * C + lz;
        const yl = hAt(px - 1, pz, y), yu = hAt(px, pz - 1, y), yr = hAt(px + 1, pz, y), yd = hAt(px, pz + 1, y);
        sh *= 1 + Math.max(-3, Math.min(3, (y - yl) + (y - yu))) * 0.08;  // lit from the top left
        if (Math.max(yl, yu, yr, yd) - y >= 2) sh *= 0.5;                  // the foot of a wall: a dark line
        else if (y - Math.min(yl, yu, yr, yd) >= 2) sh *= 1.15;            // the top edge of a wall: a bright rim
        d[o] = Math.min(255, cols[id * 3] * 255 * sh); d[o + 1] = Math.min(255, cols[id * 3 + 1] * 255 * sh); d[o + 2] = Math.min(255, cols[id * 3 + 2] * 255 * sh); d[o + 3] = 255;
      }
    }
    r.g.putImageData(img, 0, 0);
    return r.canvas;
  }
  // The full map opens zoomed in on you (about 200 blocks across), on the layer you're on.
  openFull(player) { this.mode = 2; const v = this.view; v.follow = true; v.scale = 6; v.under = !!player && player.pos.y < 60; }
  cycle(player) { this.mode = (this.mode + 1) % 3; if (this.mode === 2) this.openFull(player); try { localStorage.setItem('skyforge.labyrinth.mapmode', String(this.mode === 2 ? 1 : this.mode)); } catch (e) { /* ignore */ } }
  close(to = 1) { if (this.mode === 2) this.mode = to; try { localStorage.setItem('skyforge.labyrinth.mapmode', String(to)); } catch (e) { /* ignore */ } }
  zoom(f, sx, sy) {
    const v = this.view, cv = this.canvas, dpr = this.dpr || 1;
    const ns = Math.max(0.12, Math.min(12, v.scale * f));
    if (sx !== undefined) {
      // Keep the point under the cursor in place.
      const wx = v.x + (sx * dpr - cv.width / 2) / (v.scale * dpr), wz = v.z + (sy * dpr - cv.height / 2) / (v.scale * dpr);
      v.x = wx - (sx * dpr - cv.width / 2) / (ns * dpr); v.z = wz - (sy * dpr - cv.height / 2) / (ns * dpr);
      v.follow = false;
    }
    v.scale = ns;
  }
  pan(dx, dz) { this.view.x += dx; this.view.z += dz; this.view.follow = false; }
  // A point on the full map (CSS pixels from its top left) in world blocks.
  toWorld(px, py) { const v = this.view, cv = this.canvas, dpr = this.dpr || 1; return { x: v.x + (px * dpr - cv.width / 2) / (v.scale * dpr), z: v.z + (py * dpr - cv.height / 2) / (v.scale * dpr) }; }
  // Your one marker: placing it again moves it; placing it on itself removes it.
  setWaypoint(w) {
    this.waypoint = w;
    try { if (w) localStorage.setItem(this.wkey, JSON.stringify({ x: Math.round(w.x * 10) / 10, z: Math.round(w.z * 10) / 10, label: w.label })); else localStorage.removeItem(this.wkey); } catch (e) { /* ignore */ }
    if (this.onWaypoint) this.onWaypoint(w);
  }
  toggleWaypoint(x, z, label) {
    const w = this.waypoint, near = w && Math.hypot(w.x - x, w.z - z) * this.view.scale < 16;
    this.setWaypoint(near ? null : label ? { x, z, label } : { x, z });
  }
  // The place nearest a point on the full map (CSS pixels), within `r` pixels: the crosshair and clicks snap to it.
  placeNear(px, py, r = 22) {
    const w = this.toWorld(px, py), s = this.view.scale;
    let best = null, bd = r;
    for (const p of this.places || []) { const d = Math.hypot(p.x - w.x, p.z - w.z) * s; if (d < bd) { bd = d; best = p; } }
    return best;
  }
  // A (controller) / Enter / E: put your marker on the place under the crosshair, or right at the crosshair.
  placeAtCrosshair() {
    const cv = this.canvas, dpr = this.dpr || 1, p = this.placeNear(cv.width / 2 / dpr, cv.height / 2 / dpr);
    if (p) this.toggleWaypoint(p.x, p.z, p.label); else this.toggleWaypoint(this.view.x, this.view.z);
  }
  bindMouse() {
    let drag = null;
    let dragged = 0;
    this.canvas.addEventListener('mousedown', e => { if (!this.isFull) return; drag = [e.clientX, e.clientY]; dragged = 0; e.preventDefault(); });
    addEventListener('mousemove', e => { if (!drag) return; const s = this.view.scale; dragged += Math.abs(e.clientX - drag[0]) + Math.abs(e.clientY - drag[1]); this.pan(-(e.clientX - drag[0]) / s, -(e.clientY - drag[1]) / s); drag = [e.clientX, e.clientY]; });
    addEventListener('mouseup', e => {
      // A click without dragging places (or removes) your marker there.
      if (drag && dragged < 5 && this.isFull) { const r = this.canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, p = this.placeNear(px, py, 16), w = this.toWorld(px, py); if (p) this.toggleWaypoint(p.x, p.z, p.label); else this.toggleWaypoint(w.x, w.z); }
      drag = null;
    });
    this.canvas.addEventListener('wheel', e => { if (!this.isFull) return; e.preventDefault(); e.stopPropagation(); const r = this.canvas.getBoundingClientRect(); this.zoom(e.deltaY > 0 ? 1 / 1.2 : 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    // Touch: tap the corner map to open the full map; one finger drags, two fingers pinch to zoom.
    let touches = new Map(), pinch = null, moved = 0, multi = false;
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault(); e.stopPropagation();
      for (const t of e.changedTouches) touches.set(t.identifier, [t.clientX, t.clientY]);
      if (touches.size === 1) { moved = 0; multi = false; }
      if (touches.size >= 2) multi = true;
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    }, { passive: false });
    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault(); e.stopPropagation();
      if (!this.isFull) return;
      const before = new Map(touches);
      for (const t of e.changedTouches) touches.set(t.identifier, [t.clientX, t.clientY]);
      if (touches.size >= 2) {
        const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const r = this.canvas.getBoundingClientRect();
        if (pinch) this.zoom(d / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
        pinch = d;
      } else {
        for (const t of e.changedTouches) { const p = before.get(t.identifier); if (!p) continue; const dx = t.clientX - p[0], dy = t.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy); this.pan(-dx / this.view.scale, -dy / this.view.scale); }
      }
    }, { passive: false });
    const end = e => {
      e.stopPropagation();
      for (const t of e.changedTouches) touches.delete(t.identifier);
      if (touches.size < 2) pinch = null;
      if (!this.isFull && moved < 10 && this.onOpenRequest) this.onOpenRequest();
      // A tap on the full map (no drag, no pinch) places or removes your marker.
      else if (this.isFull && moved < 10 && !multi && touches.size === 0) { const t = e.changedTouches[0], r = this.canvas.getBoundingClientRect(), px = t.clientX - r.left, py = t.clientY - r.top, p = this.placeNear(px, py, 26), w = this.toWorld(px, py); if (p) this.toggleWaypoint(p.x, p.z, p.label); else this.toggleWaypoint(w.x, w.z); }
    };
    this.canvas.addEventListener('touchend', end);
    this.canvas.addEventListener('touchcancel', end);
    this.canvas.addEventListener('click', e => { if (!this.isFull && this.onOpenRequest) { e.stopPropagation(); this.onOpenRequest(); } });
  }
  // `slot`: which cached plan (the full map's and the corner map's are kept apart). `explored`: only show places
  // you've seen (the corner map), on the layer you're on.
  floorPlan(player, ax0, az0, ax1, az1, slot = 'fp', explored = false) {
    const now = performance.now(), py = Math.floor(player.pos.y + 0.05);
    const c = this[slot];
    if (c && now - c.t < 350 && c.py === py && c.ax0 === ax0 && c.az0 === az0 && c.ax1 === ax1 && c.az1 === az1) return c;
    const w = Math.min(400, ax1 - ax0 + 1), h = Math.min(400, az1 - az0 + 1);
    const cv = (c && c.canvas.width === w && c.canvas.height === h) ? c.canvas : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data, W = this.world, col = this.textures.colors;
    const solid = id => id > 0 && T_SOLID[id] && T_SHAPE[id] !== SHAPE.cross;
    const bit = player.pos.y < 60 ? 2 : 1;
    let lastK = '', ec = null;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = ax0 + i, z = az0 + j, o = (j * w + i) * 4;
      if (explored) {
        const k = (x >> 5) + ',' + (z >> 5);
        if (k !== lastK) { ec = this.cols.get(k); lastK = k; }
        if (!ec || !(ec.s[(x & 31) + (z & 31) * C] & bit)) { d[o + 3] = 0; continue; }
      }
      const feet = W.get(x, py, z);
      if (feet < 0) { d[o + 3] = 0; continue; } // not loaded
      const head = W.get(x, py + 1, z);
      let r, gg, b, a = 235;
      const tint = (id, k) => { r = col[id * 3] * 255 * k; gg = col[id * 3 + 1] * 255 * k; b = col[id * 3 + 2] * 255 * k; };
      if (solid(head)) { tint(head, 0.32); } // wall
      else if (solid(feet) && T_SHAPE[feet] !== SHAPE.slab) { tint(feet, 0.62); r += 18; gg += 18; b += 18; } // a step up
      else if (feet > 0 && T_SHAPE[feet] === SHAPE.liquid) { r = 40; gg = 90; b = 170; }
      else {
        let depth = 0, below = 0;
        for (let k = 1; k <= 8; k++) { below = W.get(x, py - k, z); if (solid(below) || (below > 0 && T_SHAPE[below] === SHAPE.liquid)) { depth = k; break; } }
        if (!depth) { r = 8; gg = 10; b = 18; } // a long drop
        else if (T_SHAPE[below] === SHAPE.liquid) { r = 40; gg = 90; b = 170; }
        else { tint(below, depth === 1 ? 1 : Math.max(0.35, 0.8 - depth * 0.1)); }
      }
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = a;
    }
    g.putImageData(img, 0, 0);
    this[slot] = { canvas: cv, x0: ax0, z0: az0, w, h, t: now, py, ax0, az0, ax1, az1 };
    return this[slot];
  }
  draw(players, home) {
    const cv = this.canvas, player = players[0];
    if (!this.mode || !player) { cv.style.display = 'none'; this.panel.hidden = true; return; }
    cv.style.display = 'block';
    const full = this.mode === 2;
    const dpr = this.dpr = Math.min(2, devicePixelRatio || 1);
    const W = full ? innerWidth : Math.round(Math.min(300, innerWidth * 0.2, innerHeight * 0.3)), Hh = full ? innerHeight : W;
    if (cv.width !== W * dpr || cv.height !== Hh * dpr) { cv.width = W * dpr; cv.height = Hh * dpr; cv.style.width = W + 'px'; cv.style.height = Hh + 'px'; }
    cv.className = full ? 'full' : 'corner';
    this.panel.hidden = true; // no floating info box on the map
    const v = this.view;
    const under = full ? v.under : player.pos.y < 60;
    if (!full || v.follow) { v.x = player.pos.x; v.z = player.pos.z; }
    const scale = (full ? v.scale : 2.6) * dpr;
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = under ? '#0c0a08' : '#0d1117';
    g.fillRect(0, 0, cv.width, cv.height);
    g.imageSmoothingEnabled = scale < 1;
    const x0 = v.x - cv.width / 2 / scale, z0 = v.z - cv.height / 2 / scale, x1 = v.x + cv.width / 2 / scale, z1 = v.z + cv.height / 2 / scale;
    const sx = x => (x - x0) * scale, sz = z => (z - z0) * scale;
    let shown = 0;
    for (let rz = Math.floor(z0 / RS); rz <= Math.floor(z1 / RS); rz++) for (let rx = Math.floor(x0 / RS); rx <= Math.floor(x1 / RS); rx++) {
      const t = this.regionCanvas(rx, rz, under);
      if (t) { g.drawImage(t, sx(rx * RS), sz(rz * RS), RS * scale, RS * scale); shown++; }
    }
    // Zoomed in: a live floor plan of the level you're on (walls, floors, drops, water), from the loaded blocks,
    // so you can find your way around castle floors and dungeon rooms. Only where you've been, and only on the
    // view (surface or underground) you're on.
    if (full && v.scale >= 2.5 && under === player.pos.y < 60) {
      const fp = this.floorPlan(player, Math.floor(x0), Math.floor(z0), Math.ceil(x1), Math.ceil(z1), 'fp', true);
      if (fp) { g.imageSmoothingEnabled = false; g.drawImage(fp.canvas, sx(fp.x0), sz(fp.z0), fp.w * scale, fp.h * scale); }
    }
    // The corner map: the same crisp floor plan around you (walls dark, paths light), on places you've explored.
    // Its window is snapped to a grid so it's only rebuilt a few times a second.
    if (!full) {
      const sn = 16, bx0 = Math.floor(x0 / sn) * sn - sn, bz0 = Math.floor(z0 / sn) * sn - sn, bx1 = Math.ceil(x1 / sn) * sn + sn, bz1 = Math.ceil(z1 / sn) * sn + sn;
      const fp = this.floorPlan(player, bx0, bz0, bx1, bz1, 'fpm', true);
      if (fp) { g.imageSmoothingEnabled = false; g.drawImage(fp.canvas, sx(fp.x0), sz(fp.z0), fp.w * scale, fp.h * scale); }
    }
    // Region grid and names (full map).
    if (full && v.scale < 2.5) {
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = dpr;
      g.font = `${Math.round(11 * dpr)}px system-ui`; g.fillStyle = 'rgba(255,255,255,0.35)'; g.textAlign = 'left'; g.textBaseline = 'top';
      for (let rx = Math.floor(x0 / RS); rx <= Math.floor(x1 / RS) + 1; rx++) { g.beginPath(); g.moveTo(sx(rx * RS), 0); g.lineTo(sx(rx * RS), cv.height); g.stroke(); }
      for (let rz = Math.floor(z0 / RS); rz <= Math.floor(z1 / RS) + 1; rz++) { g.beginPath(); g.moveTo(0, sz(rz * RS)); g.lineTo(cv.width, sz(rz * RS)); g.stroke(); }
    }
    // Markers: landmarks you've found, opened chests, home, the players.
    const fs = Math.round((full ? 15 : 11) * dpr);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const drawIcon = (x, z, icon, color, label) => {
      const px = sx(x), pz = sz(z);
      if (px < -40 || pz < -40 || px > cv.width + 40 || pz > cv.height + 40) return;
      g.font = `bold ${fs}px system-ui`;
      g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(icon, px, pz);
      g.fillStyle = color; g.fillText(icon, px, pz); // no words on the map: just the places' symbols
    };
    let nearest = null;
    const places = []; // what the full map names (and the crosshair snaps to)
    for (const m of this.marks.values()) {
      // Above ground: the surface's castles; underground: the cavern castles. Stairways down and the dungeon, cave
      // and mine entrances show on both.
      if (m.icon === '✧' ? !under : (m.icon === '♜' || m.icon === '☁') && under) continue;
      const d = Math.hypot(m.x - player.pos.x, m.z - player.pos.z);
      if (m.found) { drawIcon(m.x, m.z, m.icon, m.icon === '☁' ? '#bfe3ff' : m.icon === '♜' ? '#ffd9a0' : '#e9c38a'); places.push({ x: m.x, z: m.z, label: m.label, found: true, big: m.icon !== '◒' && m.icon !== '⛏' && m.icon !== '⚱' }); }
      else {
        // Castles show from anywhere; dungeon, cave and mine entrances only within 600 blocks (less clutter).
        if (d > 600 && m.icon !== '♜' && m.icon !== '☁') continue;
        drawIcon(m.x, m.z, m.icon, 'rgba(170,180,200,0.6)');
        places.push({ x: m.x, z: m.z, label: m.label, found: false, big: m.icon === '♜' || m.icon === '☁' });
        if (!nearest || d < nearest.d) nearest = { d, m };
      }
    }
    for (const k of this.treasure.opened) { const [x, y, z] = k.split(',').map(Number); if ((y < 60) === under) drawIcon(x + 0.5, z + 0.5, '✦', '#ffd24a'); }
    for (const m of this.markers) drawIcon(m.x, m.z, m.icon, '#ffd24a');
    drawIcon(home.x, home.z, '⛲', '#8fd3ff');
    places.push({ x: home.x, z: home.z, label: 'The Courtyard', found: true, big: true });
    this.places = full ? places : null;
    // The full map names every place under its symbol. Labels that would overlap are left out (the most important
    // and the ones nearest the middle win); the place under the crosshair is always named, in gold.
    this.hover = full ? this.placeNear(cv.width / 2 / dpr, cv.height / 2 / dpr) : null;
    if (full) {
      const c0 = cv.width / 2, c1 = cv.height / 2, taken = [];
      const order = places.map(p => ({ p, px: sx(p.x), pz: sz(p.z) })).filter(o => o.px > -80 && o.pz > -40 && o.px < cv.width + 80 && o.pz < cv.height + 40)
        .sort((a, b) => (a.p === this.hover ? -1 : b.p === this.hover ? 1 : 0) || (b.p.big - a.p.big) || (b.p.found - a.p.found) || (Math.hypot(a.px - c0, a.pz - c1) - Math.hypot(b.px - c0, b.pz - c1)));
      for (const o of order) {
        const hov = o.p === this.hover, size = Math.round((hov ? 15 : o.p.big ? 12.5 : 11) * dpr);
        g.font = `${hov ? 800 : 700} ${size}px system-ui, sans-serif`;
        const tw = g.measureText(o.p.label).width, y = o.pz + fs * 0.95, box = [o.px - tw / 2 - 3 * dpr, y - size / 2 - 2 * dpr, o.px + tw / 2 + 3 * dpr, y + size / 2 + 2 * dpr];
        if (!hov && taken.some(t => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1])) continue;
        taken.push(box);
        const done = this.isConquered && this.isConquered(o.p.x, o.p.z) && o.p.label !== 'The Courtyard', text = done ? `✓ ${o.p.label}` : o.p.label;
        g.lineWidth = 3.5 * dpr; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(text, o.px, y);
        g.fillStyle = hov ? '#ffcf3a' : done ? '#8fe08a' : o.p.found ? 'rgba(255,244,220,0.95)' : 'rgba(200,208,224,0.75)'; g.fillText(text, o.px, y);
        if (hov) { g.strokeStyle = '#ffcf3a'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(o.px, o.pz, fs * 0.95, 0, Math.PI * 2); g.stroke(); }
      }
    }
    // Your marker: a gold pin; on the corner map, an arrow at the edge when it's off the map.
    const w = this.waypoint;
    if (w) {
      const px = sx(w.x), pz = sz(w.z), k = (full ? 1.4 : 1) * dpr;
      const pin = (x, y) => {
        g.save(); g.translate(x, y);
        g.fillStyle = '#ffcf3a'; g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1.5 * dpr;
        g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-7 * k, -9 * k, -7 * k, -19 * k, 0, -19 * k); g.bezierCurveTo(7 * k, -19 * k, 7 * k, -9 * k, 0, 0); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#7a2a00'; g.beginPath(); g.arc(0, -13 * k, 2.6 * k, 0, Math.PI * 2); g.fill();
        g.restore();
      };
      const m = 12 * dpr;
      if (px >= m && pz >= m && px <= cv.width - m && pz <= cv.height - m) pin(px, pz);
      else {
        const cx = cv.width / 2, cz = cv.height / 2, a = Math.atan2(pz - cz, px - cx);
        const t = Math.min((cx - m) / Math.max(1e-6, Math.abs(Math.cos(a))), (cz - m) / Math.max(1e-6, Math.abs(Math.sin(a))));
        const ex = cx + Math.cos(a) * t, ez = cz + Math.sin(a) * t;
        g.save(); g.translate(ex, ez); g.rotate(a);
        g.fillStyle = '#ffcf3a'; g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1.5 * dpr;
        g.beginPath(); g.moveTo(8 * k, 0); g.lineTo(-5 * k, -6 * k); g.lineTo(-2 * k, 0); g.lineTo(-5 * k, 6 * k); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
    }
    // The full map's crosshair: where A (or Enter / E) puts your marker, snapping onto the place beneath it.
    if (full) {
      const c0 = cv.width / 2, c1 = cv.height / 2, r = 9 * dpr;
      g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 4 * dpr; g.beginPath(); g.moveTo(c0 - r, c1); g.lineTo(c0 + r, c1); g.moveTo(c0, c1 - r); g.lineTo(c0, c1 + r); g.stroke();
      g.strokeStyle = '#ffcf3a'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(c0 - r, c1); g.lineTo(c0 + r, c1); g.moveTo(c0, c1 - r); g.lineTo(c0, c1 + r); g.stroke();
    }
    players.forEach((p, i) => {
      g.save(); g.translate(sx(p.pos.x), sz(p.pos.z)); g.rotate(-p.yaw);
      const k = (full ? 1.5 : 1) * dpr;
      g.fillStyle = ['#ffd24a', '#ff5a7a', '#4cd964', '#3d8bff'][i % 4]; g.strokeStyle = '#000'; g.lineWidth = dpr;
      g.beginPath(); g.moveTo(0, -7 * k); g.lineTo(5 * k, 6 * k); g.lineTo(0, 3 * k); g.lineTo(-5 * k, 6 * k); g.closePath(); g.fill(); g.stroke();
      g.restore();
    });
    // North marker, layer tag, scale bar.
    // North: a small arrow at the top (no text); underground: an amber frame.
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(cv.width / 2, 4 * dpr); g.lineTo(cv.width / 2 + 5 * dpr, 13 * dpr); g.lineTo(cv.width / 2 - 5 * dpr, 13 * dpr); g.closePath(); g.fill();
    if (under) { g.strokeStyle = 'rgba(236,178,92,0.7)'; g.lineWidth = 3 * dpr; g.strokeRect(1.5 * dpr, 1.5 * dpr, cv.width - 3 * dpr, cv.height - 3 * dpr); }
    if (full) {
      let found = 0, regions = new Set();
      for (const m of this.marks.values()) if (m.found) found++;
      for (const k of this.cols.keys()) { const [cx, cz] = k.split(',').map(Number); regions.add(Math.floor(cx / 6) + ',' + Math.floor(cz / 6)); }
      const key = document.body.classList.contains('touch') ? 'Tap a place: put your marker there · drag to move · pinch to zoom · ✕ to close'
        : this.lastPad ? 'Sticks: move the crosshair · A: put your marker there · LT / RT: zoom · Y: centre on you · X: surface / underground · B: close'
        : 'Click a place, or Enter at the crosshair: put your marker there · drag or arrows: move · wheel or + / −: zoom · C: centre on you · Esc: close';
      const dir = nearest ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((Math.atan2(nearest.m.x - player.pos.x, -(nearest.m.z - player.pos.z)) / (Math.PI * 2)) * 8 + 8)) % 8] : '';
      const near = nearest ? `<br>Nearest unexplored: <b>${nearest.m.label}${nearest.m.known ? '' : '?'}</b>, ${Math.round(nearest.d)} blocks ${dir}` : '';
      const html = `<b>MAP</b> · ${under ? 'Underground' : 'Surface'} · ${regions.size} region${regions.size === 1 ? '' : 's'} explored · ${found} landmark${found === 1 ? '' : 's'} found · ${this.treasure.opened.size} chest${this.treasure.opened.size === 1 ? '' : 's'} opened${near}<br><span>${key}</span>`;
      if (this.panel.innerHTML !== html) this.panel.innerHTML = html;
    }
  }
}
