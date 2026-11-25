// Treasure: chests (open them for coins), loose coins (walk through to collect), fountain spray and coin sounds.
import * as THREE from 'three';
import { sfx } from './music.js';

const SAVE = 'skyforge.labyrinth.treasure.v1';

export class Treasure {
  constructor(scene) {
    this.scene = scene;
    this.chests = new Map(); // "x,y,z" -> { coins, tier, home? }
    this.coins = new Map();  // column -> [{ x, y, z, v, key, got }]
    this.trail = [];         // the coin trail to the next chest (see main.js trails): same coins, laid at runtime
    this.purse = 0; this.opened = new Set(); this.taken = new Set(); this.found = 0;
    try {
      const s = JSON.parse(localStorage.getItem(SAVE) || 'null');
      if (s) { this.purse = s.purse || 0; this.opened = new Set(s.opened || []); this.taken = new Set(s.taken || []); }
    } catch (e) { /* ignore */ }
    // Spinning coins: one instanced mesh.
    const g = new THREE.CylinderGeometry(0.26, 0.26, 0.06, 20);
    g.rotateX(Math.PI / 2);
    const m = new THREE.MeshLambertMaterial({ color: 0xffd34a, emissive: 0x7a5200 });
    this.cap = 8192;
    this.mesh = new THREE.InstancedMesh(g, m, this.cap);
    this.mesh.count = 0; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    // Bursts of coins flying out of opened chests.
    this.bursts = [];
    const bg = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12); bg.rotateX(Math.PI / 2);
    this.burstMesh = new THREE.InstancedMesh(bg, m, 600);
    this.burstMesh.count = 0; this.burstMesh.frustumCulled = false;
    scene.add(this.burstMesh);
    // Fountain spray (particles animated entirely in the shader).
    this.sprays = new Map();
    this.sprayMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, scale: { value: 600 } }, transparent: true, depthWrite: false,
      vertexShader: `attribute vec4 seed; uniform float time; uniform float scale; varying float vA;
        void main(){ float t = fract(time * (0.35 + seed.w * 0.25) + seed.z); float a = seed.x * 6.2832;
          float r = seed.y; vec3 p = position + vec3(cos(a) * r * t, (2.2 + seed.w * 1.6) * t - 3.6 * t * t, sin(a) * r * t);
          vA = 1.0 - t; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = scale * 0.07 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; if (dot(d, d) > 0.25) discard; gl_FragColor = vec4(0.75, 0.88, 1.0, 0.55 * vA); }`,
    });
    this.ctx = null;
  }
  save() { try { localStorage.setItem(SAVE, JSON.stringify({ purse: this.purse, opened: [...this.opened], taken: [...this.taken] })); } catch (e) { /* full */ } }
  addColumn(c) {
    for (const [x, y, z, coins, tier, home] of c.chests) this.chests.set(`${x},${y},${z}`, { coins, tier, home });
    const list = [];
    for (const [x, y, z, v] of c.coins) {
      const key = `${Math.floor(x * 2)},${Math.floor(y * 2)},${Math.floor(z * 2)}`;
      if (!this.taken.has(key)) list.push({ x, y, z, v, key, got: false, ph: (x * 7.1 + z * 3.3) % 6.28 });
    }
    this.coins.set(c.cx + ',' + c.cz, list);
    if (c.fx.length) {
      const pos = [], seed = [];
      for (const f of c.fx) {
        if (f[0] !== 'spray') continue;
        const [, x, y, z, r, s] = f, n = Math.round(60 + 140 * s);
        for (let k = 0; k < n; k++) { pos.push(x, y, z); seed.push(Math.random(), r * (0.5 + Math.random() * 0.5), Math.random(), s * Math.random()); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 4));
      const pts = new THREE.Points(g, this.sprayMat);
      pts.frustumCulled = false;
      this.scene.add(pts);
      this.sprays.set(c.cx + ',' + c.cz, pts);
    }
  }
  removeColumn(c) {
    const k = c.cx + ',' + c.cz;
    this.coins.delete(k);
    for (const [x, y, z] of c.chests) this.chests.delete(`${x},${y},${z}`);
    const s = this.sprays.get(k); if (s) { this.scene.remove(s); s.geometry.dispose(); this.sprays.delete(k); }
  }
  chestAt(x, y, z) { return this.chests.get(`${x},${y},${z}`); }
  isOpened(x, y, z) { return this.opened.has(`${x},${y},${z}`); }
  open(x, y, z) {
    const key = `${x},${y},${z}`, c = this.chests.get(key);
    if (!c || this.opened.has(key)) return -1;
    this.opened.add(key);
    this.purse += c.coins; this.found++;
    this.save();
    const n = Math.min(80, 12 + c.coins / 6 + (c.tier >= 5 ? 40 : 0));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3;
      this.bursts.push({ x: x + 0.5, y: y + 1, z: z + 0.5, vx: Math.cos(a) * sp, vy: 4 + Math.random() * 5, vz: Math.sin(a) * sp, t: 0, life: 1.2 + Math.random() * 0.8 });
    }
    this.sound(c.coins >= 300 || c.tier >= 5 ? 'big' : 'chest');
    return c.coins;
  }
  // Animate coins, collect those players walk through. Returns coins collected this frame.
  update(dt, time, players) {
    let got = 0;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
    let n = 0;
    for (const list of [...this.coins.values(), this.trail]) for (const c of list) {
      if (c.got) continue;
      for (const p of players) {
        const dx = p.x - c.x, dz = p.z - c.z, dy = p.y + 0.9 - c.y;
        if (dx * dx + dz * dz < 0.7 && Math.abs(dy) < 1.3) { c.got = true; this.taken.add(c.key); this.purse += c.v; got += c.v; break; }
      }
      if (c.got || n >= this.cap) continue;
      Q.setFromAxisAngle(Y, time * 2.4 + c.ph);
      V.set(c.x, c.y + Math.sin(time * 2 + c.ph) * 0.08, c.z);
      M.compose(V, Q, Sc);
      this.mesh.setMatrixAt(n++, M);
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
    if (got) { this.sound('coin'); this.saveSoon(); }
    // Bursts.
    let b = 0;
    this.bursts = this.bursts.filter(p => (p.t += dt) < p.life);
    for (const p of this.bursts) {
      p.vy -= 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      Q.setFromAxisAngle(Y, p.t * 9); V.set(p.x, p.y, p.z); M.compose(V, Q, Sc);
      if (b < 600) this.burstMesh.setMatrixAt(b++, M);
    }
    this.burstMesh.count = b; this.burstMesh.instanceMatrix.needsUpdate = true;
    this.sprayMat.uniforms.time.value = time;
    return got;
  }
  // Lay a coin trail (positions); coins already picked up stay gone.
  setTrail(points) {
    this.trail = points.map(([x, y, z]) => ({ x, y, z, v: 1, key: `t:${Math.floor(x * 2)},${Math.floor(y * 2)},${Math.floor(z * 2)}`, got: false, ph: (x * 7.1 + z * 3.3) % 6.28 }))
      .filter(c => !this.taken.has(c.key));
  }
  saveSoon() { clearTimeout(this.st); this.st = setTimeout(() => this.save(), 800); }
  // Little synthesized sounds (soft bells; see music.js).
  sound(kind) { try { sfx(kind); } catch (e) { /* no audio */ } }
}
