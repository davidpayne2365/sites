// Big and small sea life. Each creature swims by steering: it heads for a wandering goal, looks ahead for rock,
// and turns (or climbs) to avoid it, so nothing swims through the reef or the seamounts.
import * as THREE from '../vendor/three.module.min.js';
import { VS, NX, NZ, SURF } from './world.js';

const mat = (c, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color: c, emissive });
// Parts are boxes [w, h, l] at [x, y, z]. Forward is +z. seg = which body segment bends with the swimming wave.
// flap: { sign } makes it a fin that flaps about the body (pivot at its own position).
const SPECS = {
  manta: { speed: 1.5, turn: 0.9, size: 2.2, clear: 1.8, wave: 0.15, flapAmp: 0.5, flapRate: 2.2, band: [12, 22], parts: [
    { b: [1.0, 0.24, 1.4], p: [0, 0, 0], c: 0x1f2b44, seg: 0 }, { b: [0.8, 0.2, 0.5], p: [0, 0, 0.9], c: 0x1f2b44, seg: 0 }, { b: [0.9, 0.04, 1.2], p: [0, -0.13, 0], c: 0xe8eef2, seg: 0 },
    { b: [0.1, 0.1, 1.9], p: [0, 0, -1.5], c: 0x1f2b44, seg: 1 }, { b: [0.14, 0.14, 0.4], p: [-0.3, 0.05, 1.15], c: 0x1f2b44, seg: 0 }, { b: [0.14, 0.14, 0.4], p: [0.3, 0.05, 1.15], c: 0x1f2b44, seg: 0 },
    { b: [1.8, 0.07, 1.0], p: [-0.5, 0, 0], off: [-0.9, 0, 0], c: 0x25334f, flap: -1 }, { b: [1.8, 0.07, 1.0], p: [0.5, 0, 0], off: [0.9, 0, 0], c: 0x25334f, flap: 1 }] },
  turtle: { speed: 0.55, turn: 1.0, size: 0.8, clear: 1.0, wave: 0.05, flapAmp: 0.55, flapRate: 1.6, band: [4, 10], parts: [
    { b: [0.62, 0.22, 0.8], p: [0, 0, 0], c: 0x4f6e2b, seg: 0 }, { b: [0.44, 0.14, 0.56], p: [0, 0.16, -0.03], c: 0x3a5222, seg: 0 }, { b: [0.5, 0.05, 0.62], p: [0, -0.12, 0], c: 0xd8cfa0, seg: 0 },
    { b: [0.2, 0.17, 0.26], p: [0, 0.02, 0.55], c: 0x7a9a3c, seg: 0 }, { b: [0.12, 0.08, 0.2], p: [0, 0, -0.5], c: 0x7a9a3c, seg: 0 },
    { b: [0.55, 0.05, 0.22], p: [-0.31, -0.03, 0.22], off: [-0.27, 0, 0], c: 0x6f8f3a, flap: -1 }, { b: [0.55, 0.05, 0.22], p: [0.31, -0.03, 0.22], off: [0.27, 0, 0], c: 0x6f8f3a, flap: 1 },
    { b: [0.25, 0.05, 0.16], p: [-0.28, -0.03, -0.3], off: [-0.12, 0, 0], c: 0x6f8f3a, flap: -1 }, { b: [0.25, 0.05, 0.16], p: [0.28, -0.03, -0.3], off: [0.12, 0, 0], c: 0x6f8f3a, flap: 1 }] },
  shark: { speed: 1.9, turn: 1.1, size: 1.2, clear: 2.0, wave: 0.3, flapAmp: 0.1, flapRate: 1.0, band: [8, 20], parts: [
    { b: [0.5, 0.45, 0.8], p: [0, 0, 0.5], c: 0x6a7b8c, seg: 0 }, { b: [0.46, 0.18, 0.78], p: [0, -0.2, 0.5], c: 0xe0e7ea, seg: 0 }, { b: [0.4, 0.38, 0.55], p: [0, 0, 1.15], c: 0x6a7b8c, seg: 0 }, { b: [0.4, 0.14, 0.4], p: [0, -0.2, 1.15], c: 0xe0e7ea, seg: 0 },
    { b: [0.44, 0.4, 0.8], p: [0, 0, -0.3], c: 0x657687, seg: 1 }, { b: [0.3, 0.28, 0.7], p: [0, 0, -0.95], c: 0x607183, seg: 2 }, { b: [0.06, 0.7, 0.4], p: [0, 0.05, -1.45], c: 0x5a6b7d, seg: 3 }, { b: [0.06, 0.4, 0.4], p: [0, 0.4, 0.3], c: 0x5a6b7d, seg: 0 },
    { b: [0.7, 0.05, 0.3], p: [-0.3, -0.18, 0.55], off: [-0.3, 0, 0], c: 0x5a6b7d, flap: -1 }, { b: [0.7, 0.05, 0.3], p: [0.3, -0.18, 0.55], off: [0.3, 0, 0], c: 0x5a6b7d, flap: 1 }, { b: [0.08, 0.06, 0.06], p: [-0.2, 0.08, 1.4], c: 0x101418, seg: 0 }, { b: [0.08, 0.06, 0.06], p: [0.2, 0.08, 1.4], c: 0x101418, seg: 0 }] },
  whale: { speed: 1.3, turn: 0.28, size: 7, clear: 5, wave: 0.12, flapAmp: 0.25, flapRate: 0.6, band: [14, 23], parts: [
    { b: [2.4, 2.2, 4.0], p: [0, 0, 4.0], c: 0x2b3d57, seg: 0 }, { b: [2.2, 0.8, 3.8], p: [0, -1.1, 4.0], c: 0xcfd8df, seg: 0 }, { b: [2.6, 2.4, 4.0], p: [0, 0, 0], c: 0x2a3b54, seg: 1 }, { b: [2.3, 0.9, 3.8], p: [0, -1.2, 0], c: 0xcfd8df, seg: 1 },
    { b: [2.0, 1.9, 4.0], p: [0, 0, -4.0], c: 0x293a52, seg: 2 }, { b: [1.5, 0.7, 3.6], p: [0, -0.85, -4.0], c: 0xcfd8df, seg: 2 }, { b: [1.3, 1.3, 3.2], p: [0, 0, -7.4], c: 0x283850, seg: 3 }, { b: [0.8, 0.8, 2.6], p: [0, 0, -10.0], c: 0x263650, seg: 4 },
    { b: [4.6, 0.22, 1.4], p: [0, 0, -12.0], c: 0x263650, seg: 5 }, { b: [0.4, 0.5, 1.0], p: [0, 1.4, -2.5], c: 0x263650, seg: 1 }, { b: [0.5, 0.4, 0.5], p: [-1.2, 0.5, 6.2], c: 0x101418, seg: 0 }, { b: [0.5, 0.4, 0.5], p: [1.2, 0.5, 6.2], c: 0x101418, seg: 0 },
    { b: [0.3, 0.2, 3.4], p: [-1.3, -0.8, 3.2], off: [-0.2, 0, -1.7], c: 0x2a3d58, flap: -1 }, { b: [0.3, 0.2, 3.4], p: [1.3, -0.8, 3.2], off: [0.2, 0, -1.7], c: 0x2a3d58, flap: 1 }] },
};

export class Critter {
  constructor(scene, world, kind, start) {
    this.world = world; const S = this.S = SPECS[kind]; this.kind = kind;
    this.root = new THREE.Group();
    const nSeg = 1 + Math.max(...S.parts.map(p => p.seg ?? 0)); this.segs = [];
    const segPivot = [0, -1.0, -2.0, -3.0, -4.0, -5.0].map(v => v * S.size * 0.45);
    for (let i = 0; i < nSeg; i++) { const g = new THREE.Group(); g.position.z = segPivot[i] * 0.2; this.root.add(g); this.segs.push(g); }
    this.flaps = [];
    for (const p of S.parts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...p.b), mat(p.c, p.c >> 3 & 0x0f0f0f));
      if (p.flap) { const g = new THREE.Group(); g.position.set(...p.p); m.position.set(...(p.off || [0, 0, 0])); g.add(m); this.root.add(g); this.flaps.push({ g, sign: p.flap }); }
      else { const g = this.segs[p.seg ?? 0]; m.position.set(p.p[0], p.p[1], p.p[2] - g.position.z); g.add(m); }
    }
    scene.add(this.root);
    this.pos = new THREE.Vector3(start.x, start.y, start.z); this.yaw = Math.random() * 6.28; this.pitch = 0; this.phase = Math.random() * 6.28;
    this.goal = new THREE.Vector3(); this.goalT = 0; this.newGoal(); this.probe = new THREE.Vector3(); this.dirv = new THREE.Vector3();
  }
  newGoal() {
    const S = this.S, m = 14 + S.size;
    this.goal.set(m + Math.random() * (NX * VS - 2 * m), S.band[0] + Math.random() * (S.band[1] - S.band[0]), m + Math.random() * (NZ * VS - 2 * m)); this.goalT = 30 + Math.random() * 25;
  }
  solidAt(x, y, z) { return this.world.isSolid(Math.floor(x / VS), Math.floor(y / VS), Math.floor(z / VS)); }
  update(dt, t, player) {
    const S = this.S, p = this.pos, w = this.world;
    this.goalT -= dt; if (this.goalT <= 0 || p.distanceTo(this.goal) < 4 + S.size) this.newGoal();
    const dx = this.goal.x - p.x, dz = this.goal.z - p.z;
    let wantYaw = Math.atan2(-dx, -dz), dyaw = Math.atan2(Math.sin(wantYaw - this.yaw), Math.cos(wantYaw - this.yaw));
    let turn = Math.max(-S.turn, Math.min(S.turn, dyaw * 1.4)) * dt;
    let wantPitch = Math.atan2(this.goal.y - p.y, Math.hypot(dx, dz)) * 0.5;
    // look ahead for rock
    const L = S.size * 1.8 + S.speed * 2.5, cy = Math.cos(this.pitch), fx = -Math.sin(this.yaw) * cy, fz = -Math.cos(this.yaw) * cy, fy = Math.sin(this.pitch);
    const ahead = (k, ang) => { const a = this.yaw + ang; return this.solidAt(p.x - Math.sin(a) * cy * L * k, p.y + fy * L * k, p.z - Math.cos(a) * cy * L * k); };
    if (ahead(1, 0) || ahead(0.55, 0)) {
      const left = ahead(1, 0.6), right = ahead(1, -0.6);
      turn = (left && !right ? -1 : right && !left ? 1 : (Math.sin(this.phase * 7) > 0 ? 1 : -1)) * S.turn * 2.2 * dt; wantPitch = 0.3;
    }
    const ground = w.groundTop(p.x / VS, p.z / VS) * VS;
    if (p.y < ground + S.clear) wantPitch = 0.45; else if (p.y > SURF - 2.4) wantPitch = -0.3;
    this.yaw += turn; this.pitch += (Math.max(-0.45, Math.min(0.45, wantPitch)) - this.pitch) * Math.min(1, dt * 1.2);
    const cp = Math.cos(this.pitch);
    p.x += -Math.sin(this.yaw) * cp * S.speed * dt; p.z += -Math.cos(this.yaw) * cp * S.speed * dt; p.y += Math.sin(this.pitch) * S.speed * dt;
    p.x = Math.max(8, Math.min(NX * VS - 8, p.x)); p.z = Math.max(8, Math.min(NZ * VS - 8, p.z)); p.y = Math.max(ground + S.clear * 0.6, Math.min(SURF - 2.2, p.y));
    this.phase += dt * S.flapRate * 3;
    this.root.position.copy(p);
    this.root.rotation.set(this.pitch, this.yaw + Math.PI, Math.sin(turn / Math.max(dt, 1e-3) * 0.4) * 0.0 - dyaw * 0.18, 'YXZ');
    // swimming motion
    this.segs.forEach((g, i) => { g.rotation.y = Math.sin(this.phase - i * 0.9) * S.wave * (i / Math.max(1, this.segs.length - 1) + 0.2); });
    for (const f of this.flaps) f.g.rotation.z = f.sign * Math.sin(this.phase) * S.flapAmp;
    return player ? p.distanceTo(player) : 1e9;
  }
}

// Crabs scuttling over the seabed. They scurry away if you come close.
export class Crabs {
  constructor(scene, world, n = 44) {
    this.world = world; this.n = n; this.d = new THREE.Object3D();
    const parts = [[0.16, 0.07, 0.11, 0, 0.05, 0, 0], [0.04, 0.04, 0.07, -0.1, 0.07, 0.08, 1], [0.04, 0.04, 0.07, 0.1, 0.07, 0.08, 1], [0.07, 0.05, 0.05, -0.1, 0.07, 0.12, 1], [0.07, 0.05, 0.05, 0.1, 0.07, 0.12, 1],
      [0.03, 0.03, 0.08, -0.11, 0.02, -0.02, 2], [0.03, 0.03, 0.08, 0.11, 0.02, -0.02, 2], [0.03, 0.03, 0.08, -0.11, 0.02, 0.04, 2], [0.03, 0.03, 0.08, 0.11, 0.02, 0.04, 2]];
    const pos = [], nrm = [], idx = [];
    for (const [w, h, l, x, y, z] of parts) { const g = new THREE.BoxGeometry(w, h, l); g.translate(x, y, z); const b = pos.length / 3, p = g.attributes.position, nn = g.attributes.normal; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(nn.getX(i), nn.getY(i), nn.getZ(i)); } for (const i of g.index.array) idx.push(b + i); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); geo.setIndex(idx);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x220a04 }), n); this.mesh.frustumCulled = false;
    const col = new THREE.Color(), cols = [0xe8552b, 0xd9742e, 0xc23b2a, 0xe8a23a];
    this.crabs = [];
    for (let i = 0; i < n; i++) {
      let x, z, tries = 0;
      do { const R = Math.random() < 0.7 ? { x: 62, z: 67, r: 22 } : { x: 25, z: 23, r: 14 }; const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * R.r; x = R.x + Math.cos(a) * d; z = R.z + Math.sin(a) * d; tries++; } while (tries < 6 && world.hm && world.hm[Math.floor(x / VS) + NX * Math.floor(z / VS)] > 90);
      this.crabs.push({ x, z, yaw: Math.random() * 6.28, sp: 0, t: Math.random() * 3 });
      this.mesh.setColorAt(i, col.setHex(cols[i % cols.length]));
    }
    this.mesh.instanceColor.needsUpdate = true; scene.add(this.mesh);
  }
  update(dt, t, player) {
    const w = this.world, d = this.d;
    for (let i = 0; i < this.n; i++) {
      const c = this.crabs[i];
      const dx = c.x - player.x, dz = c.z - player.z, dd = Math.hypot(dx, dz);
      const gy = w.groundTop(c.x / VS, c.z / VS) * VS;
      if (dd < 2.6 && Math.abs(player.y - gy) < 3.5) { const a = Math.atan2(dx, dz); c.yaw += Math.atan2(Math.sin(a - c.yaw), Math.cos(a - c.yaw)) * Math.min(1, dt * 8); c.sp = 1.5; }   // scurry away
      else { c.t -= dt; if (c.t <= 0) { c.t = 1 + Math.random() * 3; c.sp = Math.random() < 0.55 ? 0.35 : 0; c.yaw += (Math.random() - 0.5) * 2.2; } }
      const nx = c.x + Math.sin(c.yaw) * c.sp * dt, nz = c.z + Math.cos(c.yaw) * c.sp * dt;
      const ng = w.groundTop(nx / VS, nz / VS) * VS;
      if (Math.abs(ng - gy) < 0.4 && nx > 5 && nz > 5 && nx < NX * VS - 5 && nz < NZ * VS - 5 && !w.isSolid(Math.floor(nx / VS), Math.floor(ng / VS), Math.floor(nz / VS))) { c.x = nx; c.z = nz; } else c.yaw += 1.7;
      d.position.set(c.x, gy + 0.005, c.z); d.rotation.set(0, c.yaw + Math.PI / 2, Math.sin(t * 22 + i) * 0.05 * (c.sp > 0 ? 1 : 0)); d.scale.setScalar(1.15); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export function makeCreatures(scene, world) {
  const ground = (x, z) => world.groundTop(x / VS, z / VS) * VS;
  const spawn = (kind, x, z, up) => new Critter(scene, world, kind, { x, y: ground(x, z) + up, z });
  const list = [
    spawn('manta', 62, 55, 5), spawn('manta', 30, 70, 6), spawn('manta', 70, 28, 7),
    spawn('turtle', 55, 68, 2), spawn('turtle', 64, 60, 2.5), spawn('turtle', 26, 25, 2), spawn('turtle', 40, 60, 2),
    spawn('shark', 58, 62, 4), spawn('shark', 35, 30, 4),
    spawn('whale', 48, 20, 12),
  ];
  list.whale = list[list.length - 1];
  return list;
}
