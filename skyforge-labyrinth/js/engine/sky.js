// The living sky: a day and night cycle with a sun, a moon, drifting fluffy clouds, stars and the Milky Way.
// It also works out the light for the world: cool sky light from above plus warm direct sun (or pale moon)
// light on the faces turned toward it, and the haze colour at the horizon.
import * as THREE from 'three';

// A tileable cloud noise texture (several octaves of smooth value noise).
function noiseTexture() {
  const N = 256, data = new Uint8Array(N * N * 4);
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  const octaves = [[4, 0.42], [8, 0.27], [16, 0.16], [32, 0.09], [64, 0.06]];
  const out = new Float32Array(N * N);
  for (const [cells, amp] of octaves) {
    const s = cells * 7 + 3;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * cells, fy = y / N * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const a = hash(ix % cells, iy % cells, s), b = hash((ix + 1) % cells, iy % cells, s), c = hash(ix % cells, (iy + 1) % cells, s), d = hash((ix + 1) % cells, (iy + 1) % cells, s);
      out[x + y * N] += amp * ((a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty);
    }
  }
  for (let i = 0; i < N * N; i++) { const v = Math.max(0, Math.min(255, Math.round(out[i] * 255))); data[i * 4] = v; data[i * 4 + 1] = data[(((i % N) + 97) % N + Math.floor(i / N) * N) * 4] || v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

const VERT = `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const FRAG = `
uniform vec3 sunDir, moonDir;
uniform float time, cover, brightness;
uniform sampler2D noise;
varying vec3 vDir;
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float nz(vec2 uv) { return texture2D(noise, uv).r; }
float fbm(vec2 uv) { return nz(uv) * 0.55 + nz(uv * 2.13 + 0.17) * 0.27 + nz(uv * 4.37 + 0.41) * 0.13 + nz(uv * 9.1 + 0.73) * 0.05; }
void main() {
  vec3 d = normalize(vDir);
  float sh = sunDir.y, up = max(d.y, 0.0);
  float day = smoothstep(-0.14, 0.22, sh);
  float dq = (sh - 0.02) / 0.17, dusk = exp(-dq * dq);
  float night = 1.0 - smoothstep(-0.2, 0.02, sh);
  float sd = max(dot(d, sunDir), 0.0), md = max(dot(d, moonDir), 0.0);
  // Sky gradient: deep blue overhead, pale at the horizon; navy at night.
  float hz = pow(1.0 - up, 3.5);
  vec3 zen = mix(vec3(0.0035, 0.0065, 0.02), vec3(0.09, 0.25, 0.68), day);
  vec3 hor = mix(vec3(0.016, 0.026, 0.055), vec3(0.52, 0.69, 0.9), day);
  vec3 col = mix(zen, hor, hz);
  // Sunrise and sunset: an orange glow around the sun and a pink band along the horizon.
  col += vec3(1.0, 0.4, 0.13) * dusk * pow(1.0 - up, 5.0) * (0.25 + 1.3 * pow(sd, 4.0));
  col += vec3(0.75, 0.3, 0.42) * dusk * 0.14 * pow(1.0 - up, 2.0);
  // Below the horizon (seen from high places): a darker haze.
  col = mix(col, col * 0.55, smoothstep(0.0, -0.25, d.y));
  float above = smoothstep(-0.03, 0.03, d.y);
  // Stars, twinkling, and a faint Milky Way.
  float starVis = night * smoothstep(0.0, 0.2, d.y);
  if (starVis > 0.005) {
    vec3 p = d * 170.0, cell = floor(p), f = fract(p) - 0.5;
    float r = h13(cell);
    if (r > 0.982) {
      vec3 off = vec3(h13(cell + 1.7), h13(cell + 3.1), h13(cell + 5.3)) - 0.5;
      float b = smoothstep(0.32, 0.0, length(f - off * 0.4)) * (0.35 + 4.0 * pow((r - 0.982) / 0.018, 4.0));
      b *= 0.75 + 0.25 * sin(time * (1.5 + r * 6.0) + r * 300.0);
      col += mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.86, 0.7), h13(cell + 9.9)) * b * starVis;
    }
    float mq = dot(d, normalize(vec3(0.35, 0.42, 0.84))) * 3.2, mw = exp(-mq * mq);
    col += vec3(0.05, 0.05, 0.075) * mw * smoothstep(0.35, 0.8, fbm(d.xz * 1.7 + d.y * 0.7)) * starVis * 2.0;
  }
  // The sun and the moon.
  vec3 sunC = mix(vec3(1.0, 0.42, 0.16), vec3(1.0, 0.95, 0.86), smoothstep(0.0, 0.35, sh));
  col += sunC * above * (smoothstep(0.99955, 0.9998, dot(d, sunDir)) * 30.0 + pow(sd, 400.0) * 1.5 + pow(sd, 14.0) * 0.22 * day);
  float moon = smoothstep(0.99965, 0.99985, dot(d, moonDir));
  if (moon > 0.0) col = mix(col, vec3(0.85, 0.88, 0.95) * (0.75 + 0.35 * fbm(d.xz * 90.0)) * (0.6 + 1.6 * night), moon * above);
  col += vec3(0.25, 0.3, 0.45) * pow(md, 80.0) * 0.4 * night * above;
  // Fluffy clouds: a drifting layer, brighter on the edges facing the sun, darker and thicker in the middle.
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.1) * 0.16 + vec2(time * 0.0016, time * 0.0007);
    float n = fbm(uv);
    float big = nz(uv * 0.23 + 0.5);
    float cov = cover + (0.5 - big) * 0.22;
    float dens = smoothstep(cov, cov + 0.16, n);
    if (dens > 0.0) {
      vec3 L = sh > -0.1 ? sunDir : moonDir;
      float n2 = fbm(uv + normalize(L.xz + 1e-4) * 0.012);
      float lit = clamp(0.62 + (n - n2) * 9.0, 0.0, 1.0);
      float core = smoothstep(cov + 0.06, cov + 0.32, n);
      vec3 white = mix(vec3(1.02, 0.99, 0.95), vec3(1.05, 0.6, 0.38), dusk);
      vec3 shadow = mix(vec3(0.5, 0.55, 0.66), vec3(0.45, 0.32, 0.4), dusk);
      vec3 cDay = mix(shadow, white, lit) * (1.0 - core * 0.22) + sunC * pow(sd, 7.0) * (1.0 - core) * 0.7 * day;
      vec3 cNight = vec3(0.025, 0.03, 0.045) + vec3(0.07, 0.08, 0.1) * lit * smoothstep(0.0, 0.3, moonDir.y);
      vec3 cc = mix(cNight, cDay, smoothstep(-0.12, 0.12, sh));
      col = mix(col, cc, dens * smoothstep(0.0, 0.16, d.y) * 0.96);
    }
  }
  gl_FragColor = vec4(col * brightness, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class DaySky {
  constructor(scene) {
    this.uniforms = {
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, moonDir: { value: new THREE.Vector3(0, -1, 0) },
      time: { value: 0 }, cover: { value: 0.5 }, brightness: { value: 1 }, noise: { value: noiseTexture() },
    };
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    }));
    this.mesh.renderOrder = -10; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.tod = 0.3; // time of day: 0.25 sunrise, 0.5 noon-ish, 0.75 sunset ... (see sunAt)
    this.mode = 'cycle'; // always day & night (no longer a choice)
    try { const v = localStorage.getItem('skyforge.tod'), t = Number(v); if (v !== null && v !== '' && t >= 0 && t < 1) this.tod = t; } catch (e) { /* ignore */ }
    this.saveT = 0;
    // Results for the world's lighting (linear colours).
    this.ambient = new THREE.Color(); this.direct = new THREE.Color(); this.lightDir = new THREE.Vector3(); this.horizon = new THREE.Color();
    this.update(0, 0);
  }
  // The sun's direction for a time of day: it rises in the east, passes high in the south, sets in the west.
  sunAt(tod) {
    const a = (tod - 0.25) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.93 + 0.08, -0.36).normalize();
  }
  setMode(m) { this.mode = m; try { localStorage.setItem('skyforge.skymode', m); } catch (e) { /* ignore */ } }
  update(dt, time) {
    // A full day is about 17 minutes: 13 of daylight, nights pass three times faster.
    const s = this.sunAt(this.tod);
    if (this.mode === 'cycle') this.tod = (this.tod + dt / 1500 * (s.y < -0.08 ? 3 : 1)) % 1;
    else { const goal = this.mode === 'day' ? 0.42 : 0.92; this.tod += (goal - this.tod) * Math.min(1, dt * 0.8); }
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 5; try { localStorage.setItem('skyforge.tod', this.tod.toFixed(4)); } catch (e) { /* ignore */ } }
    const sun = this.sunAt(this.tod), moon = sun.clone().negate(); moon.y = Math.abs(moon.y) * 0.9 + 0.05 * (moon.y < 0 ? -1 : 1); moon.normalize();
    this.uniforms.sunDir.value.copy(sun); this.uniforms.moonDir.value.copy(moon); this.uniforms.time.value = time;
    const h = sun.y, day = smooth(-0.12, 0.25, h), dusk = Math.exp(-(((h - 0.03) / 0.16) ** 2)), night = 1 - smooth(-0.2, 0.02, h);
    // Sky light (ambient): soft blue by day, warm at dusk, a low moonlit blue at night.
    let amb = lerp3([0.2, 0.24, 0.4], [0.6, 0.65, 0.75], day);
    amb = lerp3(amb, [0.62, 0.5, 0.5], dusk * 0.55);
    this.ambient.setRGB(...amb);
    // Direct light: the sun (warm, orange when low) or the moon.
    if (h > -0.06) {
      const k = smooth(-0.06, 0.2, h);
      const c = lerp3([1.0, 0.55, 0.3], [0.68, 0.62, 0.52], smooth(0.05, 0.4, h));
      this.direct.setRGB(c[0] * k, c[1] * k, c[2] * k); this.lightDir.copy(sun);
    } else {
      const k = smooth(-0.06, -0.25, h) * smooth(0.0, 0.25, moon.y);
      this.direct.setRGB(0.17 * k, 0.21 * k, 0.32 * k); this.lightDir.copy(moon);
    }
    const hz = lerp3([0.02, 0.03, 0.06], [0.62, 0.74, 0.88], day);
    this.horizon.setRGB(...lerp3(hz, [0.85, 0.55, 0.42], dusk * 0.5));
    this.night = night; this.day = day;
  }
}
