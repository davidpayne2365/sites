// Underwater atmosphere: the bright wavy surface above you, shafts of sunlight, drifting specks, and bubbles.
import * as THREE from '../vendor/three.module.min.js';
import { WATER_GLSL } from './mesher.js';
import { SURF } from './world.js';

const GL3 = { glslVersion: THREE.GLSL3 };
const FRAG_HEAD = `precision highp float;\nlayout(location = 0) out highp vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor\n`;

export class FX {
  constructor(scene, U, rng = Math.random) {
    this.U = U; this.scene = scene;
    const shared = { time: U.time, surfY: U.surfY, fogDensity: U.fogDensity, fogColor: U.fogColor, dayK: U.dayK, dusk: U.dusk };

    // The surface seen from below: a bright "window" straight up (Snell's window), mirror-dark toward the sides.
    this.surface = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.ShaderMaterial({
      ...GL3, uniforms: { ...shared }, side: THREE.DoubleSide,
      vertexShader: `precision highp float; out vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: FRAG_HEAD + `precision highp int;\n${WATER_GLSL}\nin vec3 vW;
void main() {
  vec3 d = vW - cameraPosition; float dist = length(d); vec3 V = d / dist;
  vec2 q = vW.xz * 0.55;
  float r1 = sin(q.x * 1.7 + time * 1.2 + sin(q.y * 1.3 + time * 0.7));
  float r2 = sin(q.y * 2.1 - time * 0.9 + sin(q.x * 0.9 - time * 0.4));
  float r3 = sin((q.x - q.y) * 3.1 + time * 1.7);
  float rip = (r1 + r2) * 0.5 + r3 * 0.25;
  float c = V.y + rip * 0.06;
  float win = smoothstep(0.58, 0.74, c);
  vec3 skyDay = mix(vec3(0.80, 0.96, 1.0), vec3(1.0, 0.62, 0.38), dusk * 0.7) * (0.86 + 0.14 * sin(r1 * 2.0 + r2));
  skyDay += vec3(1.0, 0.98, 0.85) * pow(max(rip, 0.0), 6.0) * 0.6;
  vec3 mdir = normalize(vec3(0.25, 0.92, 0.18));
  float md = max(dot(normalize(V + vec3(rip * 0.03, 0.0, rip * 0.02)), mdir), 0.0);
  vec3 skyNight = vec3(0.025, 0.06, 0.15) + vec3(0.75, 0.85, 1.0) * (pow(md, 900.0) * 3.0 + pow(md, 40.0) * 0.18);
  vec3 sky = mix(skyNight, skyDay, dayK);
  vec3 mirror = fogColor * 0.95 + vec3(0.02, 0.05, 0.07) * (0.5 + 0.5 * rip);
  vec3 col = mix(mirror, sky, win);
  gl_FragColor = vec4(toLinear(applyFog(col, dist)), 1.0);
}` }));
    this.surface.rotation.x = Math.PI / 2; this.surface.frustumCulled = false; this.surface.renderOrder = -1;
    scene.add(this.surface);

    // Light shafts: crossed vertical ribbons, repeated around you so there are always some near.
    const N = 90, pos = [], seed = [], uv = [], idx = [];
    for (let i = 0; i < N; i++) {
      const cx = rng() * 80, cz = rng() * 80, w = 1.2 + rng() * 3.2, ph = rng() * 6.28;
      for (let k = 0; k < 2; k++) {
        const ang = rng() * 3.14 + k * 1.5708, b = pos.length / 3;
        for (const [u, v] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { pos.push(0, 0, 0); seed.push(cx, cz, w, ang + 0 * ph); uv.push(u, v, ph); }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4));
    g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 3));
    g.setIndex(idx);
    this.shafts = new THREE.Mesh(g, new THREE.ShaderMaterial({
      ...GL3, uniforms: { ...shared }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `precision highp float;
uniform float surfY; in vec4 aSeed; in vec3 aUV; out vec3 vUV; out float vDist; out float vDepthCam;
void main() {
  float span = 80.0; vec2 c = aSeed.xy;
  c += span * floor((cameraPosition.xz - c) / span + 0.5);
  float y = mix(surfY - 30.0, surfY, aUV.y);
  float shear = (surfY - y) * 0.2;
  vec3 p = vec3(c.x + shear, y, c.y);
  p.xz += vec2(cos(aSeed.w), sin(aSeed.w)) * aUV.x * aSeed.z;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vUV = aUV; vDist = length(mv.xyz); vDepthCam = surfY - cameraPosition.y;
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: FRAG_HEAD + `precision highp int;\n${WATER_GLSL}\nin vec3 vUV; in float vDist; in float vDepthCam;
void main() {
  float a = pow(1.0 - abs(vUV.x), 2.0) * pow(vUV.y, 1.6);
  a *= 0.55 + 0.45 * sin(time * 0.5 + vUV.z * 3.0 + vUV.y * 2.0);
  a *= exp(-vDepthCam * 0.045);
  a *= smoothstep(0.3, 2.5, vDist);                         // never a hard wall right at the camera
  a *= 0.25 + 0.75 * dayK;
  vec3 col = mix(vec3(0.3, 0.5, 1.0), vec3(0.55, 1.0, 0.9), dayK) * a * 0.34;
  float f = 1.0 - exp(-pow(fogDensity * vDist, 2.0));
  gl_FragColor = vec4(col * (1.0 - f) * 0.17, 1.0);   // added straight onto the (linear) picture
}` }));
    this.shafts.frustumCulled = false; this.shafts.renderOrder = 5;
    scene.add(this.shafts);

    // Drifting specks ("marine snow"): they wrap around the camera in the shader, so they cost nothing on the CPU.
    const M = 900, sp = new Float32Array(M * 3), span = 36;
    for (let i = 0; i < M * 3; i++) sp[i] = rng() * span;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snowU = { pxScale: { value: 500 } };
    this.snow = new THREE.Points(pg, new THREE.ShaderMaterial({
      ...GL3, uniforms: { ...shared, ...this.snowU, span: { value: span } }, transparent: true, depthWrite: false,
      vertexShader: `precision highp float; uniform float time, pxScale, span; out float vA; out float vY;
void main() {
  vec3 q = mod(position + vec3(time * 0.06, -time * 0.035, time * 0.02) - cameraPosition, span) - span * 0.5;
  vec3 w = cameraPosition + q; vec4 mv = viewMatrix * vec4(w, 1.0);
  float d = length(mv.xyz); vY = w.y;
  vA = smoothstep(span * 0.5, span * 0.28, length(q)) * smoothstep(0.2, 1.0, d);
  gl_PointSize = clamp(0.028 * pxScale / d, 1.0, 5.0);
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: FRAG_HEAD + `precision highp int;\n${WATER_GLSL}\nin float vA; in float vY;
void main() { vec2 p = gl_PointCoord - 0.5; float r = dot(p, p) * 4.0; if (r > 1.0) discard;
  vec3 wl = waterLight(vY); float pulse = 0.6 + 0.4 * sin(time * 2.0 + vY * 7.0);
  vec3 col = mix(vec3(0.15, 0.85, 1.0) * pulse * 1.4, vec3(0.85, 1.0, 1.0) * wl * 1.3, dayK);
  gl_FragColor = vec4(toLinear(col), vA * (0.55 + 0.4 * (1.0 - dayK)) * (1.0 - r)); }` }));
    this.snow.frustumCulled = false; this.snow.renderOrder = 6;
    scene.add(this.snow);

    // Bubbles (pooled).
    this.NB = 260; this.bpos = new Float32Array(this.NB * 3); this.bsize = new Float32Array(this.NB); this.bvel = new Float32Array(this.NB * 2); this.blife = new Float32Array(this.NB);
    const bg = new THREE.BufferGeometry();
    this.bposAttr = new THREE.BufferAttribute(this.bpos, 3); this.bsizeAttr = new THREE.BufferAttribute(this.bsize, 1);
    bg.setAttribute('position', this.bposAttr); bg.setAttribute('aSize', this.bsizeAttr);
    this.bubbles = new THREE.Points(bg, new THREE.ShaderMaterial({
      ...GL3, uniforms: { ...shared, ...this.snowU }, transparent: true, depthWrite: false,
      vertexShader: `precision highp float; uniform float pxScale; in float aSize; out float vS;
void main() { vec4 mv = viewMatrix * vec4(position, 1.0); float d = length(mv.xyz); vS = aSize;
  gl_PointSize = aSize > 0.0 ? clamp(aSize * pxScale / d, 2.0, 60.0) : 0.0; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: FRAG_HEAD + `precision highp int;\nin float vS;
void main() { vec2 p = (gl_PointCoord - 0.5) * 2.0; float r = length(p); if (r > 1.0) discard;
  float ring = smoothstep(0.62, 0.92, r) * (1.0 - smoothstep(0.92, 1.0, r));
  float hl = smoothstep(0.35, 0.0, length(p - vec2(-0.35, 0.35))) * 0.9;
  gl_FragColor = vec4(vec3(0.85, 1.0, 1.0), clamp(ring * 0.75 + hl + (1.0 - r) * 0.08, 0.0, 1.0)); }` }));
    this.bubbles.frustumCulled = false; this.bubbles.renderOrder = 7;
    scene.add(this.bubbles);
    this.bn = 0; this.sources = [];

    // Sediment puffs when a block lands: sandy clouds that billow out and fade.
    this.ND = 90; this.dpos = new Float32Array(this.ND * 3); this.dage = new Float32Array(this.ND).fill(9); this.dvel = new Float32Array(this.ND * 3);
    const dg = new THREE.BufferGeometry(); this.dposAttr = new THREE.BufferAttribute(this.dpos, 3); this.dageAttr = new THREE.BufferAttribute(this.dage, 1);
    dg.setAttribute('position', this.dposAttr); dg.setAttribute('aAge', this.dageAttr);
    this.dust = new THREE.Points(dg, new THREE.ShaderMaterial({
      ...GL3, uniforms: { ...shared, ...this.snowU }, transparent: true, depthWrite: false,
      vertexShader: `precision highp float; uniform float pxScale; in float aAge; out float vA; out float vY;
void main() { vec4 mv = viewMatrix * vec4(position, 1.0); float d = length(mv.xyz); vY = position.y; vA = aAge < 2.0 ? (1.0 - aAge / 2.0) : 0.0;
  gl_PointSize = vA > 0.0 ? clamp((0.12 + aAge * 0.18) * pxScale / d, 2.0, 120.0) : 0.0; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: FRAG_HEAD + `precision highp int;\n${WATER_GLSL}\nin float vA; in float vY;
void main() { vec2 p = gl_PointCoord - 0.5; float r = dot(p, p) * 4.0; if (r > 1.0) discard;
  gl_FragColor = vec4(toLinear(vec3(0.8, 0.74, 0.58) * waterLight(vY) * 1.5), vA * vA * 0.45 * (1.0 - r)); }` }));
    this.dust.frustumCulled = false; this.dust.renderOrder = 6; scene.add(this.dust); this.dn = 0;
  }
  puff(x, y, z) {
    for (let k = 0; k < 14; k++) {
      const i = this.dn++ % this.ND, a = Math.random() * 6.28, sp = 0.25 + Math.random() * 0.4;
      this.dpos[i * 3] = x; this.dpos[i * 3 + 1] = y; this.dpos[i * 3 + 2] = z;
      this.dvel[i * 3] = Math.cos(a) * sp; this.dvel[i * 3 + 1] = 0.1 + Math.random() * 0.25; this.dvel[i * 3 + 2] = Math.sin(a) * sp; this.dage[i] = 0;
    }
  }
  // A steady stream of bubbles from a spot (vents, beacons). rate = bubbles per second.
  addSource(x, y, z, rate, size = 0.05, spread = 0.1) { const o = { x, y, z, rate, size, spread, acc: 0, on: true }; this.sources.push(o); return o; }
  emitBubble(x, y, z, size = 0.05, vx = 0, vz = 0) {
    const i = this.bn++ % this.NB;
    this.bpos[i * 3] = x; this.bpos[i * 3 + 1] = y; this.bpos[i * 3 + 2] = z;
    this.bsize[i] = size * (0.7 + Math.random() * 0.6); this.bvel[i * 2] = vx; this.bvel[i * 2 + 1] = vz; this.blife[i] = 3 + Math.random() * 3;
  }
  update(dt, cam, pxScale) {
    this.snowU.pxScale.value = pxScale;
    for (const o of this.sources) {
      if (!o.on) continue;
      if (Math.hypot(o.x - cam.x, o.z - cam.z) > 60) continue;
      o.acc += o.rate * dt;
      while (o.acc >= 1) { o.acc -= 1; this.emitBubble(o.x + (Math.random() - 0.5) * o.spread, o.y, o.z + (Math.random() - 0.5) * o.spread, o.size); }
    }
    this.surface.position.set(cam.x, SURF, cam.z);
    for (let i = 0; i < this.NB; i++) {
      if (this.bsize[i] <= 0) continue;
      this.blife[i] -= dt;
      this.bpos[i * 3 + 1] += (0.75 + this.bsize[i] * 3) * dt;
      this.bpos[i * 3] += this.bvel[i * 2] * dt + Math.sin(this.blife[i] * 5 + i) * 0.12 * dt;
      this.bpos[i * 3 + 2] += this.bvel[i * 2 + 1] * dt + Math.cos(this.blife[i] * 4 + i) * 0.12 * dt;
      this.bvel[i * 2] *= 0.97; this.bvel[i * 2 + 1] *= 0.97;
      if (this.blife[i] <= 0 || this.bpos[i * 3 + 1] > SURF - 0.05) this.bsize[i] = 0;
    }
    this.bposAttr.needsUpdate = true; this.bsizeAttr.needsUpdate = true;
    for (let i = 0; i < this.ND; i++) {
      if (this.dage[i] >= 2) continue;
      this.dage[i] += dt; const k = Math.exp(-2.4 * dt);
      this.dvel[i * 3] *= k; this.dvel[i * 3 + 1] *= k; this.dvel[i * 3 + 2] *= k;
      this.dpos[i * 3] += this.dvel[i * 3] * dt; this.dpos[i * 3 + 1] += this.dvel[i * 3 + 1] * dt; this.dpos[i * 3 + 2] += this.dvel[i * 3 + 2] * dt;
    }
    this.dposAttr.needsUpdate = true; this.dageAttr.needsUpdate = true;
  }
}
