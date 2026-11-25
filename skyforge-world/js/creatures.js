// Rigged, animated creature models (assets/creatures: Sketchfab models, credited in assets/CREDITS.md), used for the
// horses. Each model is loaded once when first needed, measured in its walking pose and scaled to the height its
// species is meant to stand; every creature is a skinned copy of that (sharing its geometry and textures), with its
// own animation mixer and its own materials. Creatures that leave go back into a pool for reuse.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const pick = (clips, re, not) => clips.find(c => re.test(c.name) && !(not && not.test(c.name)));

export class CreatureModels {
  constructor(scene) { this.scene = scene; this.cat = null; this.tpl = new Map(); this.pool = new Map(); this.catP = null; }
  catalog() {
    if (!this.catP) this.catP = fetch('assets/creatures.json').then(r => r.json()).then(c => { this.cat = c; return c; }).catch(() => (this.cat = {}));
    return this.catP;
  }
  // Start loading a species' model (if it isn't already). sp: a SPECIES entry.
  want(sp) {
    if (this.tpl.has(sp.id)) return;
    this.tpl.set(sp.id, null);
    this.catalog().then(cat => {
      const e = cat[sp.model]; if (!e) { this.tpl.set(sp.id, false); return; }
      return loader.loadAsync(e.file.startsWith('/') ? e.file : 'assets/' + e.file).then(g => this.tpl.set(sp.id, this.prepare(g, sp)));
    }).catch(err => { console.warn('creature', sp.id, err); this.tpl.set(sp.id, false); });
  }
  // true: ready; false: failed (use a stand-in); null: still loading.
  ready(id) { const t = this.tpl.get(id); return t ? true : t === false ? false : null; }
  prepare(g, sp) {
    const clips = g.animations, C = sp.clips || {};
    const byName = n => n && (clips.find(c => c.name === n) || clips.find(c => c.name.endsWith('|' + n)));
    const walk = byName(C.walk) || pick(clips, /walk/i, /back|left|right|stop|start/i) || pick(clips, /run|move|crawl|fly|prowl/i) || pick(clips, /./, /idle|death|die|dead|hit|attack/i) || clips[0];
    const run = byName(C.run) || pick(clips, /run|sprint|charge/i, /stop|start/i) || walk;
    const attack = byName(C.attack) || pick(clips, /attack|bite|punch|slash|hit\b|strike|claw|smash|swing/i, /get.?hit|hurt|react/i);
    const die = byName(C.die) || pick(clips, /death|die|dead|dying/i);
    const idle = byName(C.idle) || pick(clips, /idle/i) || walk;
    // Walks and runs made with root motion would carry the creature off its spot: take the drift out of their tracks
    // (the game moves the creature itself).
    for (const clip of new Set([walk, run].filter(Boolean))) for (const tr of clip.tracks) {
      if (!tr.name.endsWith('.position')) continue;
      const v = tr.values, n = tr.times.length; if (n < 2) continue;
      for (let a = 0; a < 3; a++) {
        let lo = Infinity, hi = -Infinity; for (let i = 0; i < n; i++) { lo = Math.min(lo, v[i * 3 + a]); hi = Math.max(hi, v[i * 3 + a]); }
        const drift = v[(n - 1) * 3 + a] - v[a];
        if (hi - lo > 1e-6 && Math.abs(drift) > 0.5 * (hi - lo)) { const t0 = tr.times[0], span = tr.times[n - 1] - t0 || 1; for (let i = 0; i < n; i++) v[i * 3 + a] -= drift * (tr.times[i] - t0) / span; }
      }
    }
    // Measure in the walking pose (skinned bounds), so the height is the height the creature stands.
    const root = g.scene, mixer = new THREE.AnimationMixer(root);
    if (walk) { mixer.clipAction(walk).play(); mixer.update(0.25); }
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    root.traverse(o => {
      if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
      else if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
      if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; }
    });
    mixer.stopAllAction(); mixer.uncacheRoot(root);
    const size = box.getSize(new THREE.Vector3()), k = sp.h / Math.max(1e-6, size.y), c = box.getCenter(new THREE.Vector3());
    return { root, k, off: new THREE.Vector3(-c.x * k, -box.min.y * k, -c.z * k), walk, run, attack, die, idle, foot: Math.max(size.x, size.z) * k };
  }
  // A creature to put in the world: { obj, mixer, acts, mats, tpl }.
  take(sp) {
    const t = this.tpl.get(sp.id); if (!t) return null;
    const list = this.pool.get(sp.id); if (list && list.length) { const c = list.pop(); this.scene.add(c.obj); c.obj.visible = true; c.mixer.stopAllAction(); c.state = ''; return c; }
    const inner = SkeletonUtils.clone(t.root); inner.scale.setScalar(t.k); inner.position.copy(t.off); inner.rotation.y = sp.yaw || 0;
    const mats = [];
    inner.traverse(o => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
      for (const m of [].concat(o.material)) {
        // (no reflections out here to catch: metal reads black, so keep them matte, as the props are)
        if (m.metalness !== undefined) { m.metalness = Math.min(m.metalness, 0.15); m.roughness = Math.max(m.roughness, 0.65); }
        if (m.emissive) mats.push({ m, col: m.color.clone(), em: m.emissive.clone() });
      }
    });
    const obj = new THREE.Group(); obj.add(inner); this.scene.add(obj);
    const mixer = new THREE.AnimationMixer(inner), acts = {};
    for (const n of ['walk', 'run', 'attack', 'die', 'idle']) if (t[n]) acts[n] = mixer.clipAction(t[n]);
    if (acts.die) { acts.die.setLoop(THREE.LoopOnce, 1); acts.die.clampWhenFinished = true; }
    if (acts.attack) { acts.attack.setLoop(THREE.LoopOnce, 1); acts.attack.clampWhenFinished = false; }
    return { obj, inner, mixer, acts, mats, tpl: t, state: '', spId: sp.id };
  }
  give(c) { if (!c) return; this.scene.remove(c.obj); c.obj.rotation.set(0, 0, 0); c.obj.scale.setScalar(1); c.mixer.stopAllAction(); (this.pool.get(c.spId) || this.pool.set(c.spId, []).get(c.spId)).push(c); }
  // Play a looping state (walk, run, idle) with a crossfade; attack and die are one-shots on top.
  play(c, name, speed = 1) {
    const a = c.acts[name] || c.acts.walk; if (!a) return;
    a.timeScale = speed;
    if (c.state === name) return;
    const prev = c.acts[c.state];
    a.reset().setEffectiveWeight(1).play(); if (prev && prev !== a) prev.crossFadeTo(a, 0.2, false);
    c.state = name;
  }
  // Tint: flash white when hit, or glow with an element.
  tint(c, flash, rgb) {
    for (const e of c.mats) {
      if (rgb) e.m.color.setRGB(e.col.r * rgb[0], e.col.g * rgb[1], e.col.b * rgb[2]); else e.m.color.copy(e.col);
      e.m.emissive.copy(e.em); if (flash > 0) e.m.emissive.setRGB(e.em.r + flash * 0.7, e.em.g + flash * 0.7, e.em.b + flash * 0.7);
    }
  }
}
