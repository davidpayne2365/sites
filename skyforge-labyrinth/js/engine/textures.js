// Every block texture lives in one texture array (256 x 256 layers, loaded on first use), and a small lookup
// texture maps (block id, face) to a layer, so a whole chunk draws in one call whatever blocks it holds.
import * as THREE from 'three';
import { BLOCKS, blockById, texUrl, FRONT_FACE, NBLOCKS } from '../blocks.js';

const S = 256;
export class BlockTextures {
  constructor(renderer) {
    this.renderer = renderer;
    this.cap = 96; this.n = 1;
    this.data = new Uint8Array(S * S * 4 * this.cap);
    this.data.fill(128); // layer 0: grey until a texture arrives
    this.byPath = new Map();
    this.colors = new Float32Array(NBLOCKS * 3).fill(0.5); // average colour per block (for the map)
    this.layerColor = [[0.5, 0.5, 0.5]];
    this.colorVersion = 0;
    this.ready = new Uint8Array(NBLOCKS);
    this.makeTex();
    // Lookup: x = face (0-5 cube faces, 6 = flags), y = block id.
    this.lut = new Float32Array(8 * NBLOCKS);
    this.lutTex = new THREE.DataTexture(this.lut, 8, NBLOCKS, THREE.RedFormat, THREE.FloatType);
    this.lutTex.needsUpdate = true;
    this.dirty = false; this.lutDirty = false; this.lastUpload = 0;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = S;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }
  makeTex() {
    const t = new THREE.DataArrayTexture(this.data, S, S, this.cap);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true;
    if (this.tex) this.tex.dispose();
    this.tex = t;
    for (const m of this.materials || []) m.uniforms.atlas.value = t;
  }
  // A layer for a texture file. `solid`: the face belongs to a solid, opaque block, so any see-through pixels
  // (like the hanging edge of moss on Mossy Dirt) are filled from the `back` texture (or the average colour);
  // otherwise you'd look through the block into nothing.
  // `look`: { tint: '#rrggbb' dyes the photo, holes: 0..1 cuts leafy gaps (for photo foliage) }.
  layer(path, solid = false, back = null, look = null) {
    const key = (solid ? `${path}#${back || ''}` : path) + (look ? `|${look.tint || ''}|${look.holes || ''}` : '');
    let i = this.byPath.get(key);
    if (i !== undefined) return i;
    if (this.n >= this.cap) {
      const cap = this.cap * 2, d = new Uint8Array(S * S * 4 * cap);
      d.set(this.data); d.fill(128, this.data.length);
      this.data = d; this.cap = cap; this.makeTex();
    }
    i = this.n++;
    this.byPath.set(key, i);
    this.layerColor[i] = [0.5, 0.5, 0.5];
    const load = p => new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = texUrl(p); });
    Promise.all([load(path), solid && back && back !== path ? load(back) : null]).then(([img, under]) => {
      if (!img) return;
      const g = this.ctx, photo = path.startsWith('photo/');
      g.clearRect(0, 0, S, S);
      g.imageSmoothingEnabled = photo;
      // Animated strips (water, lava, fire) use their first frame.
      const draw = im => g.drawImage(im, 0, 0, im.width, Math.min(im.width, im.height), 0, 0, S, S);
      draw(img);
      if (look && look.tint) {
        // Dye: multiply by the colour (a little brighter first so dark dyes keep their weave).
        g.globalCompositeOperation = 'multiply'; g.fillStyle = look.tint; g.fillRect(0, 0, S, S);
        g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(40,40,40,1)'; g.fillRect(0, 0, S, S);
        g.globalCompositeOperation = 'destination-in'; draw(img); // (keep the picture's own see-through parts)
        g.globalCompositeOperation = 'source-over';
      }
      let px = g.getImageData(0, 0, S, S).data;
      if (look && look.holes) {
        // Leafy gaps: clusters of small leaf-shaped holes from two octaves of smooth noise (tiles seamlessly).
        const N = 16, rnd = (i, j, s) => { let h = (((i % N) + N) % N) * 374761393 + (((j % N) + N) % N) * 668265263 + s * 982451653; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
        const noise = (x, y, cells, s) => { const fx = x / S * cells, fy = y / S * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sm = t => t * t * (3 - 2 * t);
          const w = c => ((c % cells) + cells) % cells, a = rnd(w(ix), w(iy), s), b = rnd(w(ix + 1), w(iy), s), c = rnd(w(ix), w(iy + 1), s), d = rnd(w(ix + 1), w(iy + 1), s);
          return (a + (b - a) * sm(tx)) * (1 - sm(ty)) + (c + (d - c) * sm(tx)) * sm(ty); };
        const cut = 1 - look.holes;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const v = noise(x, y, 8, 1) * 0.55 + noise(x, y, 16, 2) * 0.45;
          if (v > cut) px[(y * S + x) * 4 + 3] = 0;
        }
      }
      if (solid) {
        let holes = false;
        for (let k = 3; k < px.length; k += 4) if (px[k] < 250) { holes = true; break; }
        if (holes) {
          let r = 0, gg = 0, b = 0, n = 0;
          for (let k = 0; k < px.length; k += 16) if (px[k + 3] > 100) { r += px[k]; gg += px[k + 1]; b += px[k + 2]; n++; }
          g.clearRect(0, 0, S, S);
          if (under) draw(under);
          g.globalCompositeOperation = 'destination-over'; // fill whatever is still clear with the average colour
          g.fillStyle = n ? `rgb(${r / n | 0},${gg / n | 0},${b / n | 0})` : '#777'; g.fillRect(0, 0, S, S);
          g.globalCompositeOperation = 'source-over';
          draw(img);
          px = g.getImageData(0, 0, S, S).data;
        }
      }
      this.data.set(px, i * S * S * 4);
      let r = 0, gg = 0, b = 0, n = 0;
      for (let k = 0; k < px.length; k += 64) if (px[k + 3] > 100) { r += px[k]; gg += px[k + 1]; b += px[k + 2]; n++; }
      if (n) this.layerColor[i] = [r / n / 255, gg / n / 255, b / n / 255];
      this.dirty = true;
      this.refreshColors();
    });
    return i;
  }
  // Make sure a block's textures are (being) loaded and its lookup row is filled.
  use(id) {
    if (this.ready[id] || !blockById(id)) return;
    this.ready[id] = 1;
    const b = blockById(id), f = b.faces;
    const side = f.side || f.all, top = f.top || f.all, bottom = f.bottom || f.top || f.all;
    const solid = b.opaque, back = solid ? bottom : null, look = b.tint || b.holes ? { tint: b.tint, holes: b.holes } : null;
    const lay = p => this.layer(p, solid, back, look);
    const L = [lay(side), lay(side), lay(top), lay(bottom), lay(side), lay(side)];
    if (b.front) L[FRONT_FACE[b.facing || 0]] = lay(b.front);
    for (let k = 0; k < 6; k++) this.lut[id * 8 + k] = L[k];
    this.lut[id * 8 + 6] = (b.anim || 0) | (b.bright ? 4 : 0) | (b.render === 'cutout' ? 8 : 0);
    this.lutDirty = true;
    b._topLayer = L[2];
  }
  refreshColors() {
    for (const b of BLOCKS) if (b._topLayer !== undefined) {
      const c = this.layerColor[b._topLayer];
      this.colors[b.id * 3] = c[0]; this.colors[b.id * 3 + 1] = c[1]; this.colors[b.id * 3 + 2] = c[2];
    }
    this.colorVersion++;
  }
  // Upload changes at most a few times a second.
  flush(now) {
    if (this.lutDirty) { this.lutTex.needsUpdate = true; this.lutDirty = false; }
    if (this.dirty && now - this.lastUpload > 250) { this.tex.needsUpdate = true; this.dirty = false; this.lastUpload = now; }
  }
  // Chunk materials: opaque/cutout (alpha tested) and blended (water, glass).
  makeMaterials(uniforms) {
    const common = { atlas: { value: this.tex }, lut: { value: this.lutTex }, ...uniforms };
    const solid = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { ...common, opacity: { value: 1 }, alphaCut: { value: 0.5 } },
      vertexShader: VERT, fragmentShader: FRAG });
    const trans = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { ...common, opacity: { value: 0.78 }, alphaCut: { value: 0.02 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
    this.materials = [...(this.materials || []), solid, trans];
    return { solid, trans };
  }
}

const VERT = /* glsl */`
precision highp float;
precision highp int;
in vec4 aPos;
in vec2 aData;
uniform sampler2D lut;
uniform float time;
uniform vec3 dayColor, torchColor, sunColor, sunDir, glowColor, caveFill;
uniform float minLight;
out vec3 vUv;
out vec3 vW;
out vec3 vLight;
out float vFogDepth;
flat out int vFlags;
void main() {
  vec3 p = aPos.xyz / 16.0;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  int w = int(aPos.w + 0.5), face = w & 7, id = int(aData.x + 0.5);
  float layer = texelFetch(lut, ivec2(face == 6 ? 0 : face, id), 0).r;
  int flags = int(texelFetch(lut, ivec2(6, id), 0).r + 0.5);
  vec2 uv;
  if (face == 0) uv = vec2(-wp.z, -wp.y);
  else if (face == 1) uv = vec2(wp.z, -wp.y);
  else if (face == 2) uv = vec2(wp.x, wp.z);
  else if (face == 3) uv = vec2(wp.x, -wp.z);
  else if (face == 4) uv = vec2(wp.x, -wp.y);
  else if (face == 5) uv = vec2(-wp.x, -wp.y);
  else uv = vec2(float((w >> 3) & 1) * 0.999, 0.999 - float((w >> 4) & 1) * 0.998);
  int anim = flags & 3;
  if (anim == 1) uv += vec2(time * 0.04, time * 0.11);
  else if (anim == 2) uv += vec2(sin(time * 0.3) * 0.2, time * 0.03);
  vUv = vec3(uv, layer);
  int li = int(aData.y + 0.5);
  float sky = float((li >> 12) & 15) / 15.0, blk = float((li >> 8) & 15) / 15.0, ao = float((li >> 6) & 3) / 3.0;
  float shade = face == 2 ? 1.0 : face == 3 ? 0.55 : face < 2 ? 0.82 : face < 6 ? 0.7 : 0.9;
  // Sky light (ambient, cool) plus direct sun or moon light (warm) on the faces turned toward it, outdoors only.
  vec3 n = face == 0 ? vec3(1.0, 0.0, 0.0) : face == 1 ? vec3(-1.0, 0.0, 0.0) : face == 2 ? vec3(0.0, 1.0, 0.0) : face == 3 ? vec3(0.0, -1.0, 0.0) : face == 4 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 0.0, -1.0);
  float ndl = face == 6 ? 0.25 + 0.5 * max(sunDir.y, 0.0) : max(dot(n, sunDir), 0.0);
  vec3 c = (dayColor * shade + sunColor * ndl * smoothstep(0.6, 1.0, sky)) * pow(sky, 2.2) + glowColor * pow(blk, 1.8) * (0.55 + 0.45 * shade);
  c += caveFill * (1.0 - sky) * (0.55 + 0.45 * shade); // the deep: a soft glow over everything
  c = max(c, vec3(minLight)) * (0.42 + 0.58 * ao);
  if ((flags & 4) != 0) c = vec3(1.15);
  vLight = c;
  vFlags = flags;
  vec4 mv = viewMatrix * wp;
  vFogDepth = -mv.z;
  vW = wp.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
precision highp float;
precision highp sampler2DArray;
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
uniform sampler2DArray atlas;
uniform vec3 fogColor;
uniform float fogNear, fogFar, opacity, alphaCut, clipInner, clipOuter, haze;
uniform vec4 heldLight;
uniform vec3 torchColor;
uniform vec2 clipCenter;
in vec3 vUv;
in vec3 vW;
in vec3 vLight;
in float vFogDepth;
flat in int vFlags;
void main() {
  if (clipInner > 0.0 && distance(vW.xz, clipCenter) < clipInner) discard; // distant copies give way to real chunks
  if (clipOuter > 0.0 && distance(vW.xz, clipCenter) > clipOuter) discard; // real chunks stop at the view distance
  vec2 uv = vUv.xy;
  vec4 t = textureGrad(atlas, vec3(fract(uv), vUv.z), dFdx(uv), dFdy(uv));
  if (t.a < alphaCut) discard;
  vec3 light = vLight;
  // A torch in the player's hand: warm light that fades over about 14 blocks.
  if (heldLight.w > 0.0) { float d = distance(vW, heldLight.xyz); light += torchColor * heldLight.w * 0.95 * pow(max(0.0, 1.0 - d / 14.0), 1.7); }
  vec3 col = t.rgb * light;
  float f = smoothstep(fogNear, fogFar, vFogDepth);
  col = mix(col, fogColor, max(f, haze * smoothstep(500.0, 6000.0, vFogDepth))); // fog, or just the air far away
  gl_FragColor = vec4(col, opacity < 1.0 ? opacity * max(t.a, 0.6) : 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
