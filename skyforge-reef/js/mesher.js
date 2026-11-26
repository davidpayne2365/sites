// Turns the block grid into meshes, 16 x 16 x 16 blocks at a time. Only faces you could see are made.
// Each face gets baked shading: soft corner darkening (ambient occlusion), a little per-block variation so every
// tiny cube reads as its own cube, and "is the sun reaching this?" so reef overhangs and caves are darker.
import * as THREE from '../vendor/three.module.min.js';
import { BLOCKS, IS_CUBE, IS_SPRITE, B } from './blocks.js';
import { FACE_LAYER } from './textures.js';
import { VS, NX, NY, NZ, CH, NCX, NCY, NCZ } from './world.js';

const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const FU = [[0, 1, 0], [0, 0, 1], [0, 0, 1], [1, 0, 0], [1, 0, 0], [0, 1, 0]];
const FV = [[0, 0, 1], [0, 1, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], [1, 0, 0]];
const FSHADE = [0.82, 0.82, 1.0, 0.52, 0.72, 0.72];
const AO = [0.5, 0.68, 0.85, 1.0];
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const WORLD_FLAG = new Uint8Array(BLOCKS.length), EMIT_FLAG = new Uint8Array(BLOCKS.length), TALL = new Float32Array(BLOCKS.length);
for (let i = 1; i < BLOCKS.length; i++) {
  WORLD_FLAG[i] = BLOCKS[i].world ? 8 : 0; EMIT_FLAG[i] = BLOCKS[i].emit ? 16 : 0;
  TALL[i] = (i === B.KELP || i === B.SEAGRASS || i === B.REED) ? 1.02 : 1.3;
}

// ---- shaders -----------------------------------------------------------------------------------------------------
// Water takes light away with depth (red first), so the reef is bright and warm and the trench is deep blue.
export const WATER_GLSL = /* glsl */`
uniform float time, surfY, fogDensity;
uniform vec3 fogColor;
vec3 waterLight(float y) {
  float d = max(surfY - y, 0.0);
  return max(exp(-d * vec3(0.060, 0.034, 0.022)), vec3(0.03, 0.075, 0.13));
}
float caustic(vec2 p, float t) {
  float s = 0.0;
  for (int i = 0; i < 2; i++) {
    float k = i == 0 ? 1.0 : 1.9;
    vec2 q = p * k * 1.25 + float(i) * 7.0;
    float a = sin(q.x * 2.1 + t * 0.8 * k + sin(q.y * 1.7 - t * 0.5));
    float b = sin(q.y * 2.3 - t * 0.7 * k + sin(q.x * 1.9 + t * 0.6));
    float c = sin((q.x + q.y) * 1.6 + t * 0.5 * k);
    float v = (a + b + c) / 3.0;
    s += pow(max(0.0, 1.0 - abs(v) * 1.7), 3.0) * (i == 0 ? 0.6 : 0.4);
  }
  return s;
}
vec3 applyFog(vec3 col, float dist) {
  float f = 1.0 - exp(-pow(fogDensity * dist, 2.0));
  return mix(col, fogColor, clamp(f, 0.0, 1.0));
}`;
const VERT = /* glsl */`
precision highp float;
precision highp int;
in vec4 aB;
uniform float time;
out vec3 vP;
out vec2 vUV;
out float vShade;
out float vDist;
flat out float vLayer;
flat out int vFlags;
void main() {
  vec3 p = position;
  int fl = int(aB.x + 0.5);
  if ((fl & 7) == 7) { // swaying plants: moved by their position in the world, so stacked kelp stays joined up
    p.x += sin(time * 1.1 + p.y * 2.3 + p.z * 0.9) * 0.028;
    p.z += cos(time * 0.9 + p.y * 1.9 + p.x * 0.8) * 0.028;
  }
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vP = p; vFlags = fl; vLayer = aB.y; vShade = aB.z / 255.0; vDist = length(mv.xyz);
  vUV = vec2(float((fl >> 5) & 1), float((fl >> 6) & 1));
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
precision highp float;
precision highp sampler2DArray;
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
uniform sampler2DArray atlas;
uniform float hdScale;
${WATER_GLSL}
in vec3 vP;
in vec2 vUV;
in float vShade;
in float vDist;
flat in float vLayer;
flat in int vFlags;
void main() {
  int face = vFlags & 7;
  vec3 p = vP;
  vec2 st;
  if (face == 0) st = vec2(-p.z, -p.y);
  else if (face == 1) st = vec2(p.z, -p.y);
  else if (face == 2) st = vec2(p.x, p.z);
  else if (face == 3) st = vec2(p.x, -p.z);
  else if (face == 4) st = vec2(p.x, -p.y);
  else if (face == 5) st = vec2(-p.x, -p.y);
  else st = vec2(vUV.x, 1.0 - vUV.y);
  if (face != 7) st *= ((vFlags & 8) != 0) ? hdScale : 4.0; // HD photos: one picture per ~1.2 units; block pictures: one per tiny block
  vec4 t = textureGrad(atlas, vec3(fract(st), vLayer), dFdx(st), dFdy(st));
  if (face == 7 && t.a < 0.5) discard;
  vec3 wl = waterLight(p.y);
  vec3 col;
  if ((vFlags & 16) != 0) {
    col = t.rgb * 1.5 + vec3(0.12, 0.1, 0.02);                          // lanterns glow
  } else {
    float lit = smoothstep(0.62, 1.0, vShade);                          // sunlit, not in shadow
    float up = face == 2 ? 1.0 : (face == 7 ? 0.6 : 0.3);
    col = t.rgb * vShade * wl * vec3(1.08, 1.04, 0.96) * 1.6;
    col += t.rgb * wl * caustic(p.xz, time) * 0.75 * up * lit;           // rippling light from the surface
  }
  gl_FragColor = vec4(applyFog(col, vDist), 1.0);
}`;

export function makeMaterials(atlas, U) {
  const uniforms = { atlas: { value: atlas }, hdScale: { value: 0.85 }, time: U.time, surfY: U.surfY, fogDensity: U.fogDensity, fogColor: U.fogColor };
  const solid = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms, vertexShader: VERT, fragmentShader: FRAG });
  const sprite = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
  return { solid, sprite };
}

// ---- meshing -----------------------------------------------------------------------------------------------------
const MAXV = CH * CH * CH * 6 * 4;
const sPos = new Float32Array(MAXV * 3), sAB = new Uint8Array(MAXV * 4), sIdx = new Uint32Array(MAXV / 4 * 6);
const pPos = new Float32Array(CH * CH * CH * 8 * 3), pAB = new Uint8Array(CH * CH * CH * 8 * 4), pIdx = new Uint32Array(CH * CH * CH * 12);
const hash3 = (x, y, z) => { let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };

export function buildChunk(world, cx, cy, cz) {
  const ids = world.ids, colTop = world.colTop;
  const x0 = cx * CH, y0 = cy * CH, z0 = cz * CH;
  const opq = (x, y, z) => {
    if (y >= NY) return 0;
    if (y < 0 || x < 0 || x >= NX || z < 0 || z >= NZ) return 1;
    return IS_CUBE[ids[x + NX * (z + NZ * y)]];
  };
  let sv = 0, si = 0, pv = 0, pi = 0, any = false;
  for (let ly = 0; ly < CH; ly++) {
    const y = y0 + ly;
    for (let lz = 0; lz < CH; lz++) {
      const z = z0 + lz;
      for (let lx = 0; lx < CH; lx++) {
        const x = x0 + lx, id = ids[x + NX * (z + NZ * y)];
        if (!id) continue;
        const jit = 0.9 + 0.1 * hash3(x, y, z);
        if (IS_CUBE[id]) {
          for (let f = 0; f < 6; f++) {
            const n = FN[f], nx = x + n[0], ny = y + n[1], nz = z + n[2];
            if (opq(nx, ny, nz)) continue;
            const u = FU[f], v = FV[f];
            const lit = (nx < 0 || nx >= NX || nz < 0 || nz >= NZ || ny > colTop[nx + NX * nz]) ? 1 : 0.62;
            const ao = [0, 0, 0, 0];
            for (let q = 0; q < 4; q++) {
              const a = CORNERS[q][0] ? 1 : -1, b = CORNERS[q][1] ? 1 : -1;
              const s1 = opq(nx + a * u[0], ny + a * u[1], nz + a * u[2]);
              const s2 = opq(nx + b * v[0], ny + b * v[1], nz + b * v[2]);
              const c = opq(nx + a * u[0] + b * v[0], ny + a * u[1] + b * v[1], nz + a * u[2] + b * v[2]);
              ao[q] = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
            }
            const bx = n[0] > 0 ? 1 : 0, by = n[1] > 0 ? 1 : 0, bz = n[2] > 0 ? 1 : 0;
            const layer = FACE_LAYER[id * 6 + f], flags = f | WORLD_FLAG[id] | EMIT_FLAG[id];
            const base = sv;
            for (let q = 0; q < 4; q++) {
              const su = CORNERS[q][0], svv = CORNERS[q][1];
              sPos[sv * 3] = (x + bx + u[0] * su + v[0] * svv) * VS;
              sPos[sv * 3 + 1] = (y + by + u[1] * su + v[1] * svv) * VS;
              sPos[sv * 3 + 2] = (z + bz + u[2] * su + v[2] * svv) * VS;
              sAB[sv * 4] = flags; sAB[sv * 4 + 1] = layer;
              sAB[sv * 4 + 2] = Math.min(255, Math.round(255 * FSHADE[f] * AO[ao[q]] * lit * jit)); sAB[sv * 4 + 3] = 0;
              sv++;
            }
            if (ao[0] + ao[2] > ao[1] + ao[3]) { sIdx[si++] = base; sIdx[si++] = base + 1; sIdx[si++] = base + 2; sIdx[si++] = base; sIdx[si++] = base + 2; sIdx[si++] = base + 3; }
            else { sIdx[si++] = base + 1; sIdx[si++] = base + 2; sIdx[si++] = base + 3; sIdx[si++] = base + 1; sIdx[si++] = base + 3; sIdx[si++] = base; }
          }
        } else if (IS_SPRITE[id]) {
          const lit = y > colTop[x + NX * z] ? 1 : 0.62, H = TALL[id], lo = -0.1, hi = 1.1;
          const layer = FACE_LAYER[id * 6];
          const sh = Math.min(255, Math.round(255 * lit * (0.82 + 0.18 * jit)));
          for (let k = 0; k < 2; k++) {
            const base = pv;
            const ax = k ? hi : lo, az = lo, bx2 = k ? lo : hi, bz2 = hi;
            const vx = [ax, bx2, bx2, ax], vy = [0, 0, H, H], vz = [az, bz2, bz2, az];
            for (let q = 0; q < 4; q++) {
              pPos[pv * 3] = (x + vx[q]) * VS; pPos[pv * 3 + 1] = (y + vy[q]) * VS; pPos[pv * 3 + 2] = (z + vz[q]) * VS;
              const cu = q === 1 || q === 2 ? 1 : 0, cv = q >= 2 ? 1 : 0;
              pAB[pv * 4] = 7 | (cu << 5) | (cv << 6); pAB[pv * 4 + 1] = layer; pAB[pv * 4 + 2] = sh; pAB[pv * 4 + 3] = 0;
              pv++;
            }
            pIdx[pi++] = base; pIdx[pi++] = base + 1; pIdx[pi++] = base + 2; pIdx[pi++] = base; pIdx[pi++] = base + 2; pIdx[pi++] = base + 3;
          }
        }
      }
    }
  }
  const center = new THREE.Vector3((x0 + CH / 2) * VS, (y0 + CH / 2) * VS, (z0 + CH / 2) * VS), sphere = new THREE.Sphere(center, CH * VS * 0.9);
  const make = (pos, ab, idx, nv, ni) => {
    if (!nv) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, nv * 3), 3));
    g.setAttribute('aB', new THREE.BufferAttribute(ab.slice(0, nv * 4), 4, false));
    g.setIndex(new THREE.BufferAttribute(idx.slice(0, ni), 1));
    g.boundingSphere = sphere;
    return g;
  };
  return { solid: make(sPos, sAB, sIdx, sv, si), sprite: make(pPos, pAB, pIdx, pv, pi) };
}

// Keeps the chunks near the player built, drops far ones, and rebuilds chunks that were edited.
export class ChunkView {
  constructor(scene, world, materials, radius) {
    this.scene = scene; this.world = world; this.mats = materials; this.radius = radius;
    this.meshes = new Map(); // chunk index -> [solidMesh, spriteMesh]
    this.queue = []; this.lastScan = -1e9; this.camChunk = [-99, -99];
  }
  buildOne(ci) {
    const cx = ci % NCX, cz = ((ci / NCX) | 0) % NCZ, cy = (ci / (NCX * NCZ)) | 0;
    this.drop(ci);
    const g = buildChunk(this.world, cx, cy, cz), arr = [];
    if (g.solid) { const m = new THREE.Mesh(g.solid, this.mats.solid); m.matrixAutoUpdate = false; m.frustumCulled = true; this.scene.add(m); arr.push(m); }
    if (g.sprite) { const m = new THREE.Mesh(g.sprite, this.mats.sprite); m.matrixAutoUpdate = false; this.scene.add(m); arr.push(m); }
    this.meshes.set(ci, arr);
  }
  drop(ci) {
    const old = this.meshes.get(ci);
    if (old) { for (const m of old) { this.scene.remove(m); m.geometry.dispose(); } this.meshes.delete(ci); }
  }
  scan(cam) {
    const ccx = Math.floor(cam.x / VS / CH), ccz = Math.floor(cam.z / VS / CH), R = this.radius;
    const want = [];
    for (let cz = Math.max(0, ccz - R); cz <= Math.min(NCZ - 1, ccz + R); cz++)
      for (let cx = Math.max(0, ccx - R); cx <= Math.min(NCX - 1, ccx + R); cx++) {
        const d = Math.hypot(cx - ccx, cz - ccz); if (d > R) continue;
        for (let cy = 0; cy < NCY; cy++) { const ci = cx + NCX * (cz + NCZ * cy); if (!this.meshes.has(ci) && !this.empty?.has(ci)) want.push([d, ci]); }
      }
    want.sort((a, b) => a[0] - b[0]);
    this.queue = want.map(w => w[1]);
    for (const [ci] of this.meshes) { // let go of far chunks
      const cx = ci % NCX, cz = ((ci / NCX) | 0) % NCZ;
      if (Math.hypot(cx - ccx, cz - ccz) > R + 3) this.drop(ci);
    }
  }
  // Build for up to `budget` ms. Returns how many chunks are still waiting.
  update(cam, budget, now) {
    if (now - this.lastScan > 400) { this.scan(cam); this.lastScan = now; }
    const t0 = performance.now();
    // Edits first, so picking a block up shows at once.
    if (this.world.dirty.size) { for (const ci of this.world.dirty) this.buildOne(ci); this.world.dirty.clear(); }
    while (this.queue.length && performance.now() - t0 < budget) this.buildOne(this.queue.shift());
    return this.queue.length;
  }
}
