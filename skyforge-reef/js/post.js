// Post-processing: the scene is drawn to a texture, then glow ("bloom"), water wobble near the surface, a touch of
// colour fringing, colour grading, a soft vignette and film grain are added on the way to the screen.
import * as THREE from '../vendor/three.module.min.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
const BRIGHT = `precision highp float; varying vec2 vUv; uniform sampler2D tex; uniform vec2 px; uniform float thr;
void main(){ vec3 c = (texture2D(tex, vUv + px*vec2(-0.5,-0.5)).rgb + texture2D(tex, vUv + px*vec2(0.5,-0.5)).rgb + texture2D(tex, vUv + px*vec2(-0.5,0.5)).rgb + texture2D(tex, vUv + px*vec2(0.5,0.5)).rgb) * 0.25;
  float m = dot(c, vec3(0.299, 0.587, 0.114)); float w = smoothstep(thr, thr + 0.5, m); gl_FragColor = vec4(c * w, 1.0); }`;
const BLUR = `precision highp float; varying vec2 vUv; uniform sampler2D tex; uniform vec2 dir;
void main(){ vec3 c = texture2D(tex, vUv).rgb * 0.227027;
  c += (texture2D(tex, vUv + dir*1.3846).rgb + texture2D(tex, vUv - dir*1.3846).rgb) * 0.3162162;
  c += (texture2D(tex, vUv + dir*3.2308).rgb + texture2D(tex, vUv - dir*3.2308).rgb) * 0.0702702; gl_FragColor = vec4(c, 1.0); }`;
const COMPOSITE = `precision highp float; varying vec2 vUv;
uniform sampler2D tScene, tBloomA, tBloomC; uniform float time, wobble, bloom, vignette, grain, dayK, chroma; uniform vec3 flash; uniform vec2 res;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv, d = uv - 0.5;
  uv += wobble * 0.0035 * vec2(sin(uv.y * 22.0 + time * 1.9) + sin(uv.y * 9.0 - time * 1.1), cos(uv.x * 17.0 + time * 1.5));
  float r2 = dot(d, d);
  vec3 c;
  if (chroma > 0.0) { vec2 o = d * r2 * 0.012 * chroma; c = vec3(texture2D(tScene, uv + o).r, texture2D(tScene, uv).g, texture2D(tScene, uv - o).b); }
  else c = texture2D(tScene, uv).rgb;
  c += (texture2D(tBloomA, uv).rgb * 0.7 + texture2D(tBloomC, uv).rgb * 0.9) * bloom;
  c = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));                                  // linear light -> screen
  c += flash;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.14 + 0.08 * dayK);                                    // a little more colour
  c = c * c * (3.0 - 2.0 * c) * 0.35 + c * 0.65;                              // gentle contrast curve
  c = mix(c, c * vec3(0.9, 1.04, 1.1), (1.0 - dayK) * 0.5);                   // night leans blue
  c *= 1.0 - vignette * smoothstep(0.25, 0.85, r2 * 2.2);
  c += (hash(vUv * res + time) - 0.5) * grain;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Post {
  constructor(renderer, { mobile }) {
    this.r = renderer; this.mobile = mobile;
    this.bloomOn = true; this.scale = 1; this.size = new THREE.Vector2(1, 1); this.flash = new THREE.Vector3();
    const gl = renderer.getContext();
    this.hdr = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false;
    this.scn = new THREE.Scene(); this.scn.add(this.quad); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const t = { value: null };
    this.mBright = mk(BRIGHT, { tex: { value: null }, px: { value: new THREE.Vector2() }, thr: { value: 0.7 } });
    this.mBlur = mk(BLUR, { tex: { value: null }, dir: { value: new THREE.Vector2() } });
    this.U = { tScene: { value: null }, tBloomA: { value: null }, tBloomC: { value: null }, time: { value: 0 }, wobble: { value: 0 }, bloom: { value: 0.6 }, vignette: { value: 0.42 }, grain: { value: mobile ? 0 : 0.03 }, dayK: { value: 1 }, chroma: { value: mobile ? 0 : 1 }, flash: { value: this.flash }, res: { value: new THREE.Vector2(1, 1) } };
    this.mComp = mk(COMPOSITE, this.U);
    this.rts = null;
  }
  rt(w, h, depth, samples) {
    const rt = new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), { depthBuffer: depth, samples, type: this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    rt.texture.colorSpace = THREE.SRGBColorSpace; return rt;
  }
  setSize(w, h, scale) { // w, h: drawing buffer size in pixels
    this.scale = scale; const sw = w * scale, sh = h * scale;
    if (this.rts) for (const k of Object.keys(this.rts)) this.rts[k].dispose();
    const msaa = this.mobile ? 0 : 4;
    this.rts = { scene: this.rt(sw, sh, true, msaa), a: this.rt(sw / 4, sh / 4, false, 0), b: this.rt(sw / 4, sh / 4, false, 0), c: this.rt(sw / 8, sh / 8, false, 0), d: this.rt(sw / 8, sh / 8, false, 0) };
    this.size.set(sw, sh); this.U.res.value.set(w, h);
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.scn, this.cam); }
  render(scene, camera, t) {
    const r = this.r, R = this.rts;
    r.setRenderTarget(R.scene); r.clear(); r.render(scene, camera);
    if (this.bloomOn) {
      const bu = this.mBright.uniforms; bu.tex.value = R.scene.texture; bu.px.value.set(1 / R.scene.width, 1 / R.scene.height); this.pass(this.mBright, R.a);
      const bl = this.mBlur.uniforms;
      bl.tex.value = R.a.texture; bl.dir.value.set(1 / R.a.width, 0); this.pass(this.mBlur, R.b);
      bl.tex.value = R.b.texture; bl.dir.value.set(0, 1 / R.a.height); this.pass(this.mBlur, R.a);
      bl.tex.value = R.a.texture; bl.dir.value.set(1.5 / R.c.width, 0); this.pass(this.mBlur, R.c);
      bl.tex.value = R.c.texture; bl.dir.value.set(0, 1.5 / R.c.height); this.pass(this.mBlur, R.d);
      bl.tex.value = R.d.texture; bl.dir.value.set(1 / R.c.width, 0); this.pass(this.mBlur, R.c);
      bl.tex.value = R.c.texture; bl.dir.value.set(0, 1 / R.c.height); this.pass(this.mBlur, R.d);
    }
    const U = this.U; U.tScene.value = R.scene.texture; U.tBloomA.value = R.a.texture; U.tBloomC.value = R.d.texture; U.time.value = t;
    U.bloom.value = this.bloomOn ? (this.bloomStrength ?? 0.6) : 0;
    this.pass(this.mComp, null);
  }
}
