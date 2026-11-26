// You: a clownfish built out of quarter-size wool cubes (same size as the world's blocks).
// Plus the life of the reef: schools of little fish and drifting jellyfish.
import * as THREE from '../vendor/three.module.min.js';
import { singleTexture } from './textures.js';
import { VS, NX, NZ, SURF } from './world.js';

// Cubes of the clownfish, in block units. Forward is -z, up is +y. [x, y, z, colour]; colour: 0 orange, 1 white, 2 black
function fishCubes() {
  const c = [];
  const slice = (z, w, y0, y1, col = 0) => { for (let x = -w; x <= w; x++) for (let y = y0; y <= y1; y++) c.push([x, y, z, col]); };
  slice(-4, 0, -1, 0);
  slice(-3, 1, -1, 1);
  slice(-2, 1, -2, 2, 1);          // white head band
  slice(-1, 1, -2, 2);
  slice(0, 1, -2, 2);
  slice(1, 1, -2, 1, 1);           // white middle band
  slice(2, 0, -1, 1);
  slice(3, 0, -1, 0, 1);           // white tail band
  slice(4, 0, -2, 2);
  slice(5, 0, -3, 3);              // tail fin
  for (let z = -1; z <= 1; z++) c.push([0, 3, z, 0]);    // back fin
  c.push([0, 4, 0, 0]);
  for (const s of [-1, 1]) { c.push([s * 2, -1, -2, 0]); c.push([s * 2, -1, -1, 0]); } // side fins
  // eyes, and the black edges of the tail
  for (const s of [-1, 1]) { const i = c.findIndex(q => q[0] === s && q[1] === 0 && q[2] === -3); c[i][3] = 2; }
  c.push([0, 3, 5, 2], [0, -3, 5, 2]);
  return c;
}

export class PlayerFish {
  constructor(scene, images) {
    this.group = new THREE.Group();
    this.cubes = fishCubes();
    const box = new THREE.BoxGeometry(VS * 0.98, VS * 0.98, VS * 0.98);
    // A little self-lit, so you stay bright and colourful even in deep water.
    const lit = key => { const map = singleTexture(images, key); return new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.42 }); };
    const mats = [lit('wool_orange'), lit('wool_white'), new THREE.MeshLambertMaterial({ color: 0x15171c, emissive: 0x222a33 })];
    this.parts = mats.map((m, i) => {
      const n = this.cubes.filter(q => q[3] === i).length;
      const mesh = new THREE.InstancedMesh(box, m, n); mesh.frustumCulled = false; this.group.add(mesh);
      return { mesh, list: this.cubes.filter(q => q[3] === i) };
    });
    this.inner = this.group; scene.add(this.group);
    this.phase = 0; this.dummy = new THREE.Object3D();
    this.mouth = new THREE.Vector3(0, -0.02, -1.15); // where the carried block sits, in fish space
  }
  // speed: 0..1 how hard it is swimming.
  update(dt, speed01, t) {
    this.phase += dt * (3.0 + speed01 * 9.0);
    const amp = 0.35 + speed01 * 0.85, d = this.dummy;
    for (const p of this.parts) {
      p.list.forEach((q, i) => {
        const z = q[2], k = Math.min(1, Math.max(0, (z + 2) / 7)), kk = k * k;
        const off = Math.sin(this.phase - z * 0.55) * amp * kk * 1.6;
        const slope = Math.cos(this.phase - z * 0.55) * amp * kk * 0.35;
        let x = q[0];
        if (Math.abs(q[0]) === 2) x += Math.sign(q[0]) * (0.25 + 0.25 * Math.sin(t * 5 + q[2]));  // flapping side fins
        d.position.set((x + off) * VS, q[1] * VS + (z > 3 ? 0 : 0), z * VS);
        d.rotation.set(0, -slope, 0);
        d.updateMatrix(); p.mesh.setMatrixAt(i, d.matrix);
      });
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

// ---- little fish: merged boxes (forward is +z), drawn as instances ----------------------------------------------------
function mergedFishGeometry() {
  const parts = [[0.12, 0.17, 0.30, 0, 0, 0, 0], [0.09, 0.13, 0.12, 0, 0, 0.2, 0], [0.02, 0.15, 0.12, 0, 0, -0.2, 1], [0.02, 0.07, 0.14, 0, 0.1, 0, 0], [0.13, 0.03, 0.08, 0, -0.07, 0.07, 0]];
  const pos = [], nrm = [], idx = [], col = [];
  for (const [w, h, l, x, y, z, tail] of parts) {
    const g = new THREE.BoxGeometry(w, h, l); g.translate(x, y, z);
    const b = pos.length / 3, p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(n.getX(i), n.getY(i), n.getZ(i)); const s = tail ? 0 : 1; col.push(s, s, s); }
    for (const i of g.index.array) idx.push(b + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  return g;
}
const SCHOOLS = [
  // count, size, colours, centre (blocks), wander radius, height above seabed, ring radius
  { n: 46, s: 1.0, c: [0x4aa8ff, 0xffd23a], x: 250, z: 270, w: 70, h: 5, r: 3.2 },
  { n: 40, s: 0.9, c: [0xff8a1f, 0xff5d8f], x: 215, z: 275, w: 40, h: 3.5, r: 2.6 },
  { n: 36, s: 0.9, c: [0xff8a1f, 0xffc04a], x: 100, z: 92, w: 50, h: 4, r: 3.0 },
  { n: 30, s: 1.1, c: [0xc9d6df, 0x9fb4c4], x: 300, z: 200, w: 60, h: 8, r: 4.0 },
  { n: 28, s: 0.8, c: [0x7cffd2, 0x42d6ff], x: 150, z: 300, w: 60, h: 6, r: 3.0 },
  { n: 12, s: 2.2, c: [0x6f86a8, 0x8fa3be], x: 200, z: 180, w: 120, h: 10, r: 6.0 },
  { n: 14, s: 1.4, c: [0xffe14a, 0xffa530], x: 330, z: 300, w: 40, h: 4, r: 3.5 },
];
export class Life {
  constructor(scene, world) {
    this.world = world;
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: false });
    const geo = mergedFishGeometry();
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.fish = [];
    const total = SCHOOLS.reduce((a, s) => a + s.n, 0);
    this.mesh = new THREE.InstancedMesh(geo, this.mat, total); this.mesh.frustumCulled = false;
    let i = 0; const col = new THREE.Color();
    SCHOOLS.forEach((s, si) => {
      for (let k = 0; k < s.n; k++, i++) {
        const rs = Math.random;
        this.fish.push({ s, a: rs() * 6.28, b: rs() * 6.28, sp: 0.35 + rs() * 0.25, r: s.r * (0.4 + rs() * 0.8), yo: (rs() - 0.5) * 2.2, p: new THREE.Vector3(), prev: new THREE.Vector3(), sc: s.s * (0.85 + rs() * 0.3), si });
        this.mesh.setColorAt(i, col.setHex(s.c[k % s.c.length]));
      }
    });
    this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
    // Jellyfish: glowing pulsing bells.
    const jg = new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    this.jmat = new THREE.MeshBasicMaterial({ color: 0xff7bd5, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.jn = 22; this.jelly = new THREE.InstancedMesh(jg, this.jmat, this.jn); this.jelly.frustumCulled = false;
    this.jdata = [];
    for (let k = 0; k < this.jn; k++) {
      const x = 20 + Math.random() * (NX * VS - 40), z = 20 + Math.random() * (NZ * VS - 40);
      this.jdata.push({ x, z, y: 8 + Math.random() * 14, ph: Math.random() * 6.28, sc: 0.8 + Math.random() * 1.4 });
      this.jelly.setColorAt(k, col.setHex([0xff7bd5, 0x7bd5ff, 0xb48bff, 0xffa97b][k % 4]));
    }
    this.jelly.instanceColor.needsUpdate = true;
    scene.add(this.jelly);
    this.d = new THREE.Object3D();
  }
  update(t) {
    const d = this.d, w = this.world;
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i], s = f.s;
      const tt = t * f.sp;
      const cx = s.x * VS + Math.sin(t * 0.045 * (1 + f.si * 0.3) + f.si) * s.w * VS * 0.5, cz = s.z * VS + Math.cos(t * 0.037 * (1 + f.si * 0.2) + f.si * 2) * s.w * VS * 0.5;
      const x = cx + Math.cos(tt + f.a) * f.r, z = cz + Math.sin(tt * 1.1 + f.a) * f.r * 0.8;
      const gy = w.groundTop(x / VS, z / VS) * VS;
      let y = gy + s.h * 0.5 + 0.8 + Math.sin(tt * 0.8 + f.b) * 0.5 + f.yo * 0.5;
      y = Math.min(y, SURF - 1.2);
      f.prev.copy(f.p); f.p.set(x, y, z);
      if (f.prev.lengthSq() === 0) f.prev.copy(f.p);
      d.position.copy(f.p);
      d.lookAt(f.p.x + (f.p.x - f.prev.x) * 50 + 1e-4, f.p.y + (f.p.y - f.prev.y) * 50, f.p.z + (f.p.z - f.prev.z) * 50 + 1e-4);
      d.rotateZ(Math.sin(t * 9 * f.sp + f.a) * 0.12);
      d.scale.setScalar(f.sc);
      d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    for (let k = 0; k < this.jn; k++) {
      const j = this.jdata[k], pulse = Math.sin(t * 1.6 + j.ph);
      const gy = w.groundTop(j.x / VS, j.z / VS) * VS;
      const y = Math.max(gy + 1.5, j.y + Math.sin(t * 0.2 + j.ph) * 2 + pulse * 0.25);
      d.position.set(j.x + Math.sin(t * 0.1 + j.ph) * 1.5, Math.min(y, SURF - 1.5), j.z + Math.cos(t * 0.08 + j.ph) * 1.5);
      d.rotation.set(0, 0, 0);
      d.scale.set(j.sc * (1 - pulse * 0.1), j.sc * (1 + pulse * 0.18), j.sc * (1 - pulse * 0.1));
      d.updateMatrix(); this.jelly.setMatrixAt(k, d.matrix);
    }
    this.jelly.instanceMatrix.needsUpdate = true;
  }
}
