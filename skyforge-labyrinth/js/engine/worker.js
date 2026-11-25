// World worker: builds one 32 x 32 chunk column (with a 16-block margin so light and faces are right at the
// edges), lights it, meshes its 8 sections and sends everything back as transferable buffers.
import { generate } from '../gen/world.js';
import { computeLight, meshSection, splitBelow } from './mesher.js';
import { H, GROUND, fbm2, setDone, DONE, siteKey } from '../gen/util.js';
import { T_SHAPE, SHAPE, BID, T_SOLID } from '../blocks.js';
const PORTAL = BID['Portal'];
import { regionPlan, isWall, clearingAt, RS } from '../gen/maze.js';

const C = 32, M = 16, SX = C + 2 * M;
const DEEP_CUT = GROUND - 8; // (y 56: below it is the deep, drawn apart: skipped while everyone is up on the ground)

// A height map of the labyrinth far beyond the streamed chunks (2 blocks per pixel). RGB is the wall stone (or
// the ground), A the wall height above the floor x 16, plus 8 where the top is overgrown. The far ground shader
// ray-marches it, so the walls stand up in 3D out to the horizon.
const THEME_RGB = [[104, 114, 94], [128, 126, 120], [116, 86, 72], [172, 152, 114], [116, 110, 102], [108, 108, 100], [58, 98, 42], [128, 120, 106], [112, 112, 108]];
function farMap({ x0, z0, size, scale, seed, id }) {
  const rgba = new Uint8Array(size * size * 4);
  const kindColor = { castle: [150, 146, 134], ruins: [124, 128, 108], skycastle: [138, 132, 120], floating: [96, 140, 74], spawn: [176, 168, 146] };
  let plan = null, prx = 1e9, prz = 1e9;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = x0 + i * scale, z = z0 + j * scale;
    const rx = Math.floor(x / RS), rz = Math.floor(z / RS);
    if (rx !== prx || rz !== prz) { plan = regionPlan(rx, rz, seed); prx = rx; prz = rz; }
    const lx = x - rx * RS, lz = z - rz * RS;
    let c, a = 0;
    const h = ((x * 7 + z * 13) & 7) * 3;
    if (isWall(plan, lx, lz) || isWall(plan, lx + 1, lz) || isWall(plan, lx, lz + 1)) {
      const t = plan.theme % 9, ws = plan.seed ^ plan.theme;
      const o = fbm2(x / 7, z / 7, ws + 7, 2);
      const extra = t === 6 ? 1 : o > 0.7 ? 2 : o > 0.55 ? 1 : 0;
      c = THEME_RGB[t].map(v => v + h - 8);
      a = (4 + extra) * 16 + (extra || t === 6 ? 8 : 0);
    } else {
      const k = clearingAt(plan, lx, lz);
      c = k >= 0 ? (!DONE.has(siteKey(plan.clearings[k])) && kindColor[plan.clearings[k].kind] || [112, 142, 76]) : [92 + h, 122 + h, 60];
    }
    const o = (j * size + i) * 4;
    rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = a;
  }
  self.postMessage({ type: 'farmap', id, x0, z0, size, scale, rgba }, [rgba.buffer]);
}

// A distant copy of one big structure (a castle or a floating castle): its real blocks, built and then shrunk
// k times (each k x k x k cube becomes one block of its top-most material), lit and meshed like a chunk.
function lod({ x0, z0, sx, sz, k, box, seed, id }) {
  const vol = generate(x0, z0, sx, sz, seed);
  const n = Math.ceil(sx / k), m = Math.ceil(sz / k), ny = H / k;
  const NX = Math.ceil(n / C), NZ = Math.ceil(m / C), LX = NX * C + 2, LZ = NZ * C + 2;
  const ids = new Uint16Array(LX * LZ * ny);
  const need = k === 2 ? 2 : Math.round(k * k * 0.75), G = GROUND; // about a k x k slab: thin walls survive
  for (let l = Math.floor(G / k); l < ny; l++) for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    let cnt = 0, top = 0;
    for (let y = l * k + k - 1; y >= l * k; y--) for (let dz = 0; dz < k; dz++) for (let dx = 0; dx < k; dx++) {
      const x = i * k + dx, z = j * k + dz;
      if (x >= sx || z >= sz || y < G) continue;
      // Inside the structure's own clearing everything counts; outside it only what stands high (towers,
      // floating rock), so the labyrinth walls and trees around it are left to the far ground.
      const wx = x0 + x, wz = z0 + z;
      if (y < G + 12 && (wx < box[0] || wx > box[2] || wz < box[1] || wz > box[3])) continue;
      const b = vol.ids[x + sx * (z + sz * y)];
      if (!b || T_SHAPE[b] === SHAPE.cross || b === PORTAL) continue;
      cnt++; if (!top) top = b;
    }
    if (cnt >= need) ids[(i + 1) + LX * ((j + 1) + LZ * l)] = top;
  }
  // Seen from afar only the outside matters: fill air that can't be reached from outside (rooms, halls), so
  // their inner faces aren't meshed.
  {
    const seen = new Uint8Array(LX * LZ * ny), q = new Int32Array(LX * LZ * ny);
    let qh = 0, qt = 0;
    const push = i => { if (!seen[i] && !ids[i]) { seen[i] = 1; q[qt++] = i; } };
    for (let l = 0; l < ny; l++) for (let j = 0; j < LZ; j++) for (let i = 0; i < LX; i++) if (i === 0 || j === 0 || i === LX - 1 || j === LZ - 1 || l === ny - 1) push(i + LX * (j + LZ * l));
    while (qh < qt) {
      const c = q[qh++], i = c % LX, j = Math.floor(c / LX) % LZ, l = Math.floor(c / (LX * LZ));
      if (i > 0) push(c - 1); if (i < LX - 1) push(c + 1);
      if (j > 0) push(c - LX); if (j < LZ - 1) push(c + LX);
      if (l > Math.floor(G / k)) push(c - LX * LZ); if (l < ny - 1) push(c + LX * LZ);
    }
    const fill = BID['Stone'];
    for (let l = Math.floor(G / k); l < ny; l++) for (let c = l * LX * LZ, e = c + LX * LZ; c < e; c++) if (!ids[c] && !seen[c]) ids[c] = fill;
  }
  const light = computeLight(ids, LX, LZ, ny);
  // All sections merged into one solid and one see-through mesh (one draw call each per structure).
  const lists = { solid: [], trans: [] }, used = new Set();
  for (let sz_ = 0; sz_ < NZ; sz_++) for (let sx_ = 0; sx_ < NX; sx_++) for (let sy = Math.floor(G / k / C); sy < ny / C; sy++) {
    const mm = meshSection(ids, light, LX, LZ, 0, ny, 1 + sx_ * C, 1 + sz_ * C, sy * C);
    if (!mm) continue;
    for (const u of mm.used) used.add(u);
    for (const kind of ['solid', 'trans']) if (mm[kind]) lists[kind].push([mm[kind], sx_ * C * 16, sz_ * C * 16]);
  }
  const merge = list => {
    if (!list.length) return null;
    let nv = 0, ni = 0;
    for (const [p] of list) { nv += p.pos.length / 4; ni += p.idx.length; }
    const pos = new Int16Array(nv * 4), dat = new Uint16Array(nv * 2), idx = new Uint32Array(ni);
    let v = 0, i = 0;
    for (const [p, ox, oz] of list) {
      const n = p.pos.length / 4;
      for (let q = 0; q < n; q++) { pos[(v + q) * 4] = p.pos[q * 4] + ox; pos[(v + q) * 4 + 1] = p.pos[q * 4 + 1]; pos[(v + q) * 4 + 2] = p.pos[q * 4 + 2] + oz; pos[(v + q) * 4 + 3] = p.pos[q * 4 + 3]; }
      dat.set(p.dat.subarray(0, n * 2), v * 2);
      for (let q = 0; q < p.idx.length; q++) idx[i + q] = p.idx[q] + v;
      v += n; i += p.idx.length;
    }
    return { pos, dat, idx };
  };
  const solid = merge(lists.solid), trans = merge(lists.trans), transfer = [];
  for (const part of [solid, trans]) if (part) transfer.push(part.pos.buffer, part.dat.buffer, part.idx.buffer);
  self.postMessage({ type: 'lod', id, x0, z0, k, solid, trans, used: [...used], dims: [n, ny, m] }, transfer);
}

// The coin trail through a place with a final chest (a castle, sky or floating castle, a dungeon, caves or a mine):
// builds the place, finds every spot a player can stand in it, then orders its unopened chests as a tour from where
// you are (always the nearest next, the final chest last) and returns the way to each one as coin positions.
//   box: [x0, z0, x1, z1] to build; under: only chests below ground (an underground system), else at or above the
//   crypts; start: where you are; final: the final chest's key (or null: the highest tier); opened: chests to skip.
function trailPlan({ id, site, box, area, under, start, final, opened, seed }) {
  const X0 = box[0] - 2, Z0 = box[1] - 2, SX = box[2] - box[0] + 5, SZ = box[3] - box[1] + 5;
  const vol = generate(X0, Z0, SX, SZ, seed);
  const done = new Set(opened || []), A = area || box; // chests count only inside the place itself (not the maze round it)
  const chs = vol.chests.filter(c => c[0] >= A[0] && c[0] <= A[2] && c[2] >= A[1] && c[2] <= A[3]
    && (under ? c[1] < GROUND - 3 : c[1] >= GROUND - 16) && !done.has(`${c[0]},${c[1]},${c[2]}`));
  if (!chs.length) { self.postMessage({ type: 'trail', id, site, segs: [] }); return; }
  // Only the heights that matter: from the lowest of you and the chests to just above the highest.
  let ylo = start.y, yhi = start.y;
  for (const c of chs) { ylo = Math.min(ylo, c[1]); yhi = Math.max(yhi, c[1]); }
  const YL = Math.max(2, Math.floor(ylo) - 28), YH = Math.min(H - 3, Math.ceil(yhi) + 32), NY = YH - YL + 1; // (crypts and caverns: routes often go a long way down first)
  const ids = vol.ids, at = (x, y, z) => ids[x + SX * (z + SZ * y)];
  const solid = id => id > 0 && T_SOLID[id] && T_SHAPE[id] !== SHAPE.cross && T_SHAPE[id] !== SHAPE.liquid;
  const open = id => !id || !T_SOLID[id] || T_SHAPE[id] === SHAPE.cross || T_SHAPE[id] === SHAPE.liquid;
  const stand = (x, y, z) => x > 0 && z > 0 && x < SX - 1 && z < SZ - 1 && y > YL && y < YH && open(at(x, y, z)) && open(at(x, y + 1, z)) && (solid(at(x, y - 1, z)) || T_SHAPE[at(x, y - 1, z)] === SHAPE.liquid);
  const idx = (x, y, z) => x + SX * (z + SZ * (y - YL)), N = SX * SZ * NY;
  const dist = new Int32Array(N), par = new Int32Array(N), q = new Int32Array(N); // reused by every search
  const unidx = i => { const y = Math.floor(i / (SX * SZ)), r = i % (SX * SZ); return [r % SX, y + YL, Math.floor(r / SX)]; };
  const bfs = src => {
    dist.fill(-1); par.fill(-1);
    let h = 0, t = 0;
    for (const i of src) if (dist[i] < 0) { dist[i] = 0; q[t++] = i; }
    while (h < t) {
      const i = q[h++], [x, y, z] = unidx(i);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        // Same level, a step or jump up one (with head room), or a fall of any height (as the reach test allows).
        let ny = -1;
        if (stand(nx, y, nz)) ny = y;
        else if (stand(nx, y + 1, nz) && open(at(x, y + 2, z))) ny = y + 1;
        else if (open(at(nx, y, nz)) && open(at(nx, y + 1, nz))) for (let d = 1; y - d > YL; d++) { if (!open(at(nx, y - d, nz))) break; if (stand(nx, y - d, nz)) { ny = y - d; break; } }
        if (ny < 0) continue;
        const j = idx(nx, ny, nz);
        if (dist[j] >= 0) continue;
        dist[j] = dist[i] + 1; par[j] = i; q[t++] = j;
      }
      // Swim up and down through water.
      if (T_SHAPE[at(x, y, z)] === SHAPE.liquid && stand(x, y + 1, z)) { const j = idx(x, y + 1, z); if (dist[j] < 0) { dist[j] = dist[i] + 1; par[j] = i; q[t++] = j; } }
      if (T_SHAPE[at(x, y - 1, z)] === SHAPE.liquid && stand(x, y - 1, z)) { const j = idx(x, y - 1, z); if (dist[j] < 0) { dist[j] = dist[i] + 1; par[j] = i; q[t++] = j; } }
    }
  };
  // Start: the nearest spot you could be standing on.
  const sx = Math.floor(start.x) - X0, sy = Math.floor(start.y), sz = Math.floor(start.z) - Z0;
  let s0 = -1;
  for (let r = 0; r < 5 && s0 < 0; r++) for (let dz = -r; dz <= r && s0 < 0; dz++) for (let dx = -r; dx <= r && s0 < 0; dx++) for (let dy = 0; dy <= 3 && s0 < 0; dy++) for (const y of [sy - dy, sy + dy]) if (s0 < 0 && stand(sx + dx, y, sz + dz)) s0 = idx(sx + dx, y, sz + dz);
  if (s0 < 0) { self.postMessage({ type: 'trail', id, site, error: 'no start' }); return; }
  // Each chest with the spots you can open it from.
  const chests = chs.map(c => {
    const x = c[0] - X0, y = c[1], z = c[2] - Z0, spots = [];
    // You can open a chest from a couple of blocks away: any spot that close counts (nearest ones first).
    for (let r = 1; r <= 2 && !spots.length; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) for (const yy of [y, y - 1, y + 1, y + 2, y - 2]) if ((dx || dz) && stand(x + dx, yy, z + dz)) spots.push(idx(x + dx, yy, z + dz));
    return { key: `${c[0]},${c[1]},${c[2]}`, tier: c[4], value: c[3], home: !!c[5], spots };
  }).filter(c => c.spots.length);
  bfs([s0]);
  const live = chests.filter(c => c.spots.some(i => dist[i] >= 0));
  // The final chest: the one named, else the one with the way home, else the biggest (supply crates never count).
  const rank = c => (c.home ? 100 : 0) + (c.tier === 6 ? -50 : c.tier);
  const fin = live.find(c => c.key === final) || (final ? null : live.reduce((a, c) => (!a || rank(c) > rank(a) ? c : a), null));
  const left = new Set(live.filter(c => c !== fin)), segs = [], walked = [s0];
  // Tour: the nearest unopened chest next; the final chest last. Each stretch starts from the chest just opened;
  // only when nothing is reachable from there (a drop you can't climb back up) does it start from earlier on.
  const pick = () => {
    let next = null, nd = Infinity, end = -1;
    for (const c of left) for (const i of c.spots) if (dist[i] >= 0 && dist[i] < nd) { nd = dist[i]; next = c; end = i; }
    if (!next && fin) { for (const i of fin.spots) if (dist[i] >= 0 && (end < 0 || dist[i] < dist[end])) end = i; if (end >= 0) next = fin; }
    return next ? { next, end } : null;
  };
  for (;;) {
    let p = pick();
    if (!p && walked.length > 1) { bfs(walked); p = pick(); }
    if (!p) break;
    const { next, end } = p;
    left.delete(next);
    const cells = []; for (let i = end; i >= 0; i = par[i]) cells.push(i);
    cells.reverse();
    const coins = [];
    cells.forEach((i, k) => { if (k % 3 === 2 && k < cells.length - 1) { const [x, y, z] = unidx(i); coins.push([x + X0 + 0.5, y + 0.5, z + Z0 + 0.5]); } });
    segs.push({ to: next.key, value: next.value, coins, final: next === fin });
    if (next === fin) break;
    for (const i of cells) walked.push(i);
    bfs([end]);
  }
  self.postMessage({ type: 'trail', id, site, segs, found: chs.length, reachable: live.length });
}

self.onmessage = e => {
  const msg = e.data;
  setDone(msg.done);
  if (msg.type === 'farmap') { farMap(msg); return; }
  if (msg.type === 'trail') { trailPlan(msg); return; }
  if (msg.type === 'lod') { lod(msg); return; }
  if (msg.type !== 'gen') return;
  const { cx, cz, seed, edits, id } = msg;
  const t0 = performance.now();
  const x0 = cx * C - M, z0 = cz * C - M;
  const vol = generate(x0, z0, SX, SX, seed, edits);
  const t1 = performance.now();
  const light = computeLight(vol.ids, SX, SX, H);
  const t2 = performance.now();
  const meshes = [], transfer = [];
  for (let sy = 0; sy < H / C; sy++) {
    const m = meshSection(vol.ids, light, SX, SX, 0, H, M, M, sy * C);
    // (the deep, below DEEP_CUT, kept apart: see splitBelow)
    if (m && sy * C < DEEP_CUT) { [m.solid, m.dsolid] = splitBelow(m.solid, DEEP_CUT); [m.trans, m.dtrans] = splitBelow(m.trans, DEEP_CUT); }
    meshes.push(m);
    if (m) for (const part of [m.solid, m.trans, m.dsolid, m.dtrans]) if (part) transfer.push(part.pos.buffer, part.dat.buffer, part.idx.buffer);
  }
  const t3 = performance.now();
  // The column's own blocks and light, section by section (uniform sections are sent as a single value).
  const sections = [];
  for (let sy = 0; sy < H / C; sy++) {
    const ids = new Uint16Array(C * C * C), lt = new Uint8Array(C * C * C);
    let uni = true;
    const first = vol.ids[M + SX * (M + SX * sy * C)], firstL = light[M + SX * (M + SX * sy * C)];
    for (let y = 0; y < C; y++) for (let z = 0; z < C; z++) {
      const src = M + SX * (z + M + SX * (y + sy * C)), dst = C * (z + C * y);
      for (let x = 0; x < C; x++) {
        const a = vol.ids[src + x], l = light[src + x];
        ids[dst + x] = a; lt[dst + x] = l;
        if (a !== first || l !== firstL) uni = false;
      }
    }
    if (uni) sections.push({ uni: first, uniL: firstL });
    else { sections.push({ ids, light: lt }); transfer.push(ids.buffer, lt.buffer); }
  }
  // Map: the highest visible block of every column.
  const topId = new Uint16Array(C * C), topY = new Uint8Array(C * C);
  for (let z = 0; z < C; z++) for (let x = 0; x < C; x++) {
    for (let y = H - 1; y >= 0; y--) {
      const b = vol.ids[x + M + SX * (z + M + SX * y)];
      if (b && T_SHAPE[b] !== SHAPE.cross) { topId[x + z * C] = b; topY[x + z * C] = y; break; }
    }
  }
  transfer.push(topId.buffer, topY.buffer);
  const inside = ([x, , z]) => x >= cx * C && x < cx * C + C && z >= cz * C && z < cz * C + C;
  const insideF = f => f[1] >= cx * C && f[1] < cx * C + C && f[3] >= cz * C && f[3] < cz * C + C;
  self.postMessage({
    type: 'col', id, cx, cz, sections, meshes, topId, topY,
    chests: vol.chests.filter(inside),
    portals: vol.portals.filter(p => p[3] >= cx * C && p[0] < cx * C + C && p[5] >= cz * C && p[2] < cz * C + C), coins: vol.coins.filter(inside), fx: vol.fx.filter(insideF),
    marks: vol.marks.filter(m => m[1] >= cx * C && m[1] < cx * C + C && m[3] >= cz * C && m[3] < cz * C + C),
    ms: [t1 - t0, t2 - t1, t3 - t2],
  }, transfer);
};
