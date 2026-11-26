// Loads every block picture into one texture array (one layer per picture), so a whole chunk draws in one call.
import * as THREE from '../vendor/three.module.min.js';
import { TEX, HD_KEYS, BLOCKS, NBLOCKS, faceTexKey } from './blocks.js';

export const KEYS = Object.keys(TEX);
export const LAYER = {}; KEYS.forEach((k, i) => { LAYER[k] = i; });

// Which layer each face of each block uses. Index: id * 6 + face.
export const FACE_LAYER = new Uint8Array(NBLOCKS * 6);
for (let id = 1; id < NBLOCKS; id++) for (let f = 0; f < 6; f++) FACE_LAYER[id * 6 + f] = LAYER[faceTexKey(id, f)];

const loadImage = src => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => fail(new Error('missing ' + src)); im.src = src; });

export async function loadTextures(size) {
  const images = {};
  await Promise.all(KEYS.map(async k => { images[k] = await loadImage('textures/' + TEX[k]); }));
  const S = size, n = KEYS.length, data = new Uint8Array(S * S * 4 * n);
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true });
  KEYS.forEach((k, i) => {
    const im = images[k];
    g.clearRect(0, 0, S, S);
    g.imageSmoothingEnabled = HD_KEYS.has(k);       // photos stay smooth, block-pack pictures stay crisp and pixelly
    g.drawImage(im, 0, 0, im.width, Math.min(im.width, im.height), 0, 0, S, S);
    const px = g.getImageData(0, 0, S, S).data;
    // See-through pictures (coral fronds, kelp): colour the empty pixels like the rest so the edges don't go dark or pink.
    let r = 0, gg = 0, b = 0, c = 0, hasAlpha = false;
    for (let p = 0; p < px.length; p += 4) { if (px[p + 3] > 200) { r += px[p]; gg += px[p + 1]; b += px[p + 2]; c++; } else hasAlpha = true; }
    if (hasAlpha && c) { r = (r / c) | 0; gg = (gg / c) | 0; b = (b / c) | 0; for (let p = 0; p < px.length; p += 4) if (px[p + 3] < 20) { px[p] = r; px[p + 1] = gg; px[p + 2] = b; } }
    data.set(px, i * S * S * 4);
  });
  const tex = new THREE.DataArrayTexture(data, S, S, n);
  tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4; tex.needsUpdate = true;
  return { array: tex, images };
}

// Ordinary textures for things that are not part of the world grid (the fish, the block in its mouth).
const single = new Map();
export function singleTexture(images, key) {
  let t = single.get(key);
  if (t) return t;
  t = new THREE.Texture(images[key]);
  t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  if (!HD_KEYS.has(key)) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; }
  else { t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; }
  single.set(key, t);
  return t;
}
