// Black wrought-iron gates at every way into a clearing (a castle, a fountain, a statue garden, a dungeon
// entrance, the courtyard...): real 3D ironwork (bars with spear-tip finials, scrollwork, an arched top), two
// leaves on hinges that swing slowly open as you walk up, away from you, and close again once you've gone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { regionPlan, RS, RC, P } from '../gen/maze.js';
import { T_SHAPE, SHAPE } from '../blocks.js';

const LEAF_W = 2, BASE_H = 3.05, ARCH = 0.55;
const topAt = x => BASE_H + ARCH * Math.sin((x / LEAF_W) * Math.PI / 2); // the arch rises to the middle of the gate

// One leaf, hinge at x = 0, reaching to x = 2, in the XY plane (all its pieces merged into one geometry).
function leafGeometry() {
  const parts = [];
  const add = (g, x, y, z = 0, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); parts.push(g); };
  const bar = (x, y0, y1, r = 0.024) => add(new THREE.CylinderGeometry(r, r, y1 - y0, 6), x, (y0 + y1) / 2);
  const rail = (y, x0 = 0.04, x1 = LEAF_W - 0.04, t = 0.07) => add(new THREE.BoxGeometry(x1 - x0, t, t), (x0 + x1) / 2, y);
  // Stiles (the hinge side and the meeting side) and rails.
  add(new THREE.BoxGeometry(0.1, topAt(0) + 0.1, 0.1), 0.05, (topAt(0) + 0.1) / 2);
  add(new THREE.BoxGeometry(0.1, topAt(LEAF_W) + 0.05, 0.1), LEAF_W - 0.05, (topAt(LEAF_W) + 0.05) / 2);
  rail(0.28); rail(1.25); rail(2.55, 0.04, LEAF_W - 0.04, 0.05);
  // The arched top rail.
  const pts = []; for (let k = 0; k <= 16; k++) { const x = 0.05 + (LEAF_W - 0.1) * k / 16; pts.push(new THREE.Vector3(x, topAt(x) - 0.12, 0)); }
  parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.035, 6, false));
  // Upright bars piercing the top rail, crowned with spear tips (and balls between).
  for (let k = 1; k <= 9; k++) {
    const x = (LEAF_W / 10) * k, t = topAt(x);
    bar(x, 0.28, t + 0.06);
    if (k % 2) add(new THREE.ConeGeometry(0.055, 0.2, 6), x, t + 0.15);
    else add(new THREE.SphereGeometry(0.045, 8, 6), x, t + 0.09);
  }
  // Dog bars below the bottom rail.
  for (let k = 1; k <= 19; k++) bar((LEAF_W / 20) * k, 0.03, 0.28, 0.014);
  // Scrollwork: a band of rings between the bottom and middle rails, and a row of small rings under the arch.
  for (let k = 0; k < 10; k++) {
    const x = (LEAF_W / 10) * (k + 0.5);
    add(new THREE.TorusGeometry(0.085, 0.014, 6, 14), x, 0.5);
    add(new THREE.TorusGeometry(0.085, 0.014, 6, 14), x, 1.03);
    add(new THREE.TorusGeometry(0.05, 0.012, 6, 12), x, 2.7);
  }
  // A long S-scroll (two half rings) in the middle panel, and a rosette.
  add(new THREE.TorusGeometry(0.32, 0.018, 6, 24, Math.PI), LEAF_W * 0.5, 1.6, 0, 0, 0, Math.PI);
  add(new THREE.TorusGeometry(0.32, 0.018, 6, 24, Math.PI), LEAF_W * 0.5, 2.2, 0);
  add(new THREE.TorusGeometry(0.11, 0.022, 6, 16), LEAF_W * 0.5, 1.9);
  add(new THREE.SphereGeometry(0.05, 8, 6), LEAF_W * 0.5, 1.9);
  // Hinge knuckles.
  for (const y of [0.55, 2.3]) add(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8), 0, y);
  return mergeGeometries(parts.map(g => g.toNonIndexed()));
}

export class Gates {
  constructor(scene, world, seed, sound) {
    this.scene = scene; this.world = world; this.seed = seed; this.sound = sound;
    this.geo = leafGeometry();
    this.mat = new THREE.MeshPhongMaterial({ color: 0x16161a, specular: 0x5a5a60, shininess: 38 });
    this.plans = new Map(); // 'rx,rz' -> [gate spots]
    this.live = new Map();  // key -> gate
    this.t = 0;
  }
  // Every opening between a corridor and a clearing in a region.
  spotsOf(rx, rz) {
    const key = rx + ',' + rz;
    if (this.plans.has(key)) return this.plans.get(key);
    const plan = regionPlan(rx, rz, this.seed), C = plan.clear, out = [];
    const X0 = rx * RS, Z0 = rz * RS;
    for (let j = 0; j < RC; j++) for (let i = 0; i < RC; i++) {
      // Across x: the wall between cells (i-1, j) and (i, j).
      if (i > 0 && plan.openE[i - 1 + j * RC] && (C[i - 1 + j * RC] >= 0) !== (C[i + j * RC] >= 0))
        out.push({ key: `x${X0 + i * P},${Z0 + j * P}`, axis: 'x', x: X0 + i * P, z: Z0 + j * P + 2 });
      // Across z: the wall between cells (i, j-1) and (i, j).
      if (j > 0 && plan.openS[i + (j - 1) * RC] && (C[i + (j - 1) * RC] >= 0) !== (C[i + j * RC] >= 0))
        out.push({ key: `z${X0 + i * P},${Z0 + j * P}`, axis: 'z', x: X0 + i * P + 2, z: Z0 + j * P });
    }
    this.plans.set(key, out);
    if (this.plans.size > 300) this.plans.delete(this.plans.keys().next().value);
    return out;
  }
  // The opening must really be open (nothing built across it) before a gate goes in.
  clear(s) {
    const W = this.world, G = 64;
    for (let k = 0; k < 4; k++) for (const d of [0, 1]) for (const y of [G, G + 2]) {
      const x = s.axis === 'x' ? s.x + d : s.x + k, z = s.axis === 'x' ? s.z + k : s.z + d;
      const id = W.get(x, y, z);
      if (id !== 0 && !(id > 0 && T_SHAPE[id] === SHAPE.cross)) return false; // grass and flowers are fine
    }
    return true;
  }
  make(s) {
    const g = new THREE.Group();
    const mk = mirror => { const m = new THREE.Mesh(this.geo, this.mat); if (mirror) m.scale.x = -1; return m; };
    const left = new THREE.Group(), right = new THREE.Group();
    left.add(mk(false)); right.add(mk(true)); right.position.x = 4;
    g.add(left, right);
    // Local x runs along the opening; the gate stands on the line between the wall's two block columns.
    if (s.axis === 'x') { g.position.set(s.x + 1, 64, s.z); g.rotation.y = -Math.PI / 2; } else { g.position.set(s.x, 64, s.z + 1); }
    g.updateMatrixWorld(true);
    this.scene.add(g);
    return { ...s, group: g, left, right, angle: 0, target: 0, dir: 1, away: 0 };
  }
  update(dt, players, radius) {
    this.t -= dt;
    const p0 = players[0];
    if (this.t <= 0 && p0) {
      this.t = 0.5;
      const want = new Set();
      const r = Math.min(80, radius), rr = Math.ceil(r / RS) + 1, rx0 = Math.floor(p0.pos.x / RS), rz0 = Math.floor(p0.pos.z / RS);
      for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) for (const s of this.spotsOf(rx0 + dx, rz0 + dz)) {
        if (Math.hypot(s.x - p0.pos.x, s.z - p0.pos.z) > r) continue;
        if (!this.live.has(s.key) && !this.clear(s)) continue;
        want.add(s.key);
        if (!this.live.has(s.key)) this.live.set(s.key, this.make(s));
      }
      for (const [k, g] of this.live) if (!want.has(k)) { this.scene.remove(g.group); this.live.delete(k); }
    }
    // Swing: open (away from whoever comes) when someone is near, close a while after they've gone.
    const tmp = new THREE.Vector3();
    for (const g of this.live.values()) {
      let near = null, nd = Infinity;
      for (const p of players) {
        if (Math.abs(p.pos.y - 64) > 4) continue;
        const cx = g.axis === 'x' ? g.x + 1 : g.x + 2, cz = g.axis === 'x' ? g.z + 2 : g.z + 1;
        const d = Math.hypot(p.pos.x - cx, p.pos.z - cz);
        if (d < nd) { nd = d; near = p; }
      }
      if (near && nd < 6.5) {
        if (g.target === 0) {
          tmp.copy(near.pos); g.group.worldToLocal(tmp);
          g.dir = tmp.z < 0 ? 1 : -1; // swing away from the visitor
          g.target = 1; if (this.sound) this.sound('gate');
        }
        g.away = 0;
      } else if (g.target === 1) {
        g.away += dt;
        if (g.away > 4 && (!near || nd > 9)) { g.target = 0; if (this.sound) this.sound('gateClose'); }
      }
      // Slow, heavy movement.
      g.angle += (g.target - g.angle) * (1 - Math.exp(-dt * 1.3));
      const a = g.angle * Math.PI * 0.48;
      g.left.rotation.y = -a * g.dir;
      g.right.rotation.y = a * g.dir;
    }
  }
  get count() { return this.live.size; }
}
