// Glow motes: thousands of tiny drifting, pulsing lights filling a deep cavern (blue, white, green, teal and purple
// to suit the cavern's glow), so the whole dome shimmers. Built when you come near a cavern, dropped when you leave.
import * as THREE from 'three';

const PALETTES = [
  [[0.55, 0.82, 1.0], [0.9, 0.96, 1.0], [0.45, 0.65, 1.0]],             // crystal: blue and white
  [[0.78, 0.55, 1.0], [0.95, 0.75, 1.0], [0.55, 0.5, 1.0]],             // amethyst: purple
  [[0.45, 1.0, 0.75], [0.6, 1.0, 0.5], [0.4, 0.95, 0.95]],              // mushrooms: teal and green
  [[0.5, 0.85, 1.0], [0.8, 0.6, 1.0], [0.5, 1.0, 0.7], [0.95, 0.97, 1.0]], // all of them
  [[1.0, 0.5, 0.85], [1.0, 0.75, 0.95], [0.8, 0.55, 1.0]],            // rose: pink and magenta
  [[0.45, 1.0, 0.55], [0.85, 1.0, 0.9], [0.35, 0.95, 0.75]],            // emerald: green and white
];

export class Motes {
  constructor(scene) {
    this.scene = scene; this.cur = null; this.key = null;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { time: { value: 0 }, fade: { value: 0 } },
      vertexShader: `attribute vec4 seed; attribute vec3 col; uniform float time; varying vec3 vC; varying float vP;
        void main(){ float t = time * seed.y + seed.x; vec3 p = position + vec3(sin(t) * 1.6, sin(t * 0.7) * 1.1, cos(t * 0.8) * 1.6);
          vP = 0.45 + 0.55 * sin(time * (0.8 + seed.z * 1.6) + seed.x * 3.0); vC = col;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp(160.0 / -mv.z, 1.5, 7.0) * (0.6 + seed.w * 0.8); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float fade; varying vec3 vC; varying float vP;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; float a = 1.0 - r * 4.0; a *= a; gl_FragColor = vec4(vC * a * vP * fade * 1.3, 1.0); }`,
    });
  }
  // cav: { key, cx, cz, rx, rz, floor, top, biome } or null.
  set(cav) {
    const key = cav ? cav.key : null;
    if (key === this.key) return;
    this.key = key;
    if (this.cur) { this.scene.remove(this.cur); this.cur.geometry.dispose(); this.cur = null; }
    if (!cav) return;
    let s = Math.abs(key.split(',').reduce((a, v) => a * 31 + Number(v), 11)) % 2147483647 || 1;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const pal = PALETTES[cav.biome] || PALETTES[3], n = 1300;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sd = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      let x, z, e;
      do { x = rnd() * 2 - 1; z = rnd() * 2 - 1; e = Math.hypot(x, z); } while (e > 0.9);
      const top = cav.floor + (cav.top - cav.floor) * Math.sqrt(1 - e * e) - 3;
      pos.set([cav.cx + x * cav.rx, cav.floor + 1 + rnd() * Math.max(2, top - cav.floor - 1), cav.cz + z * cav.rz], i * 3);
      col.set(pal[Math.floor(rnd() * pal.length)], i * 3);
      sd.set([rnd() * 6.28, 0.15 + rnd() * 0.35, rnd(), rnd()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('col', new THREE.BufferAttribute(col, 3)); g.setAttribute('seed', new THREE.BufferAttribute(sd, 4));
    this.cur = new THREE.Points(g, this.mat); this.cur.frustumCulled = false;
    this.scene.add(this.cur);
  }
  update(time, fade) { this.mat.uniforms.time.value = time; this.mat.uniforms.fade.value = fade; if (this.cur) this.cur.visible = fade > 0.01; }
}
