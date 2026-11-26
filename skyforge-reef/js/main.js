// Skyforge Reef: you are a fish in a block ocean. No HUD, no map.
//   Touch: hold to swim, drag to steer, tap with a 2nd finger to grab / let go, double-tap to change view.
//   Mouse: click to capture the mouse, hold left button to swim, move to steer, right-click grab, V = view.
import * as THREE from '../vendor/three.module.min.js';
import { World, VS, NX, NY, NZ, SURF } from './world.js';
import { B, BLOCKS, CAN_PICK, IS_CUBE, IS_SPRITE, faceTexKey } from './blocks.js';
import { loadTextures, singleTexture } from './textures.js';
import { makeMaterials, ChunkView, WATER_GLSL } from './mesher.js';
import { FX } from './fx.js';
import { PlayerFish, Life } from './fish.js';
import { Post } from './post.js';
import { Sound } from './audio.js';

const $ = id => document.getElementById(id);
const intro = $('intro'), status = $('status'), canvas = $('c');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const mobile = isTouch && Math.min(screen.width, screen.height) < 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sound = new Sound();

async function boot() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) { status.textContent = 'This needs WebGL 2. Try a newer browser.'; return; }
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.autoClear = false;
  // Quality steps (the game drops a step by itself if the device is struggling): 3 full, 2 balanced, 1 light, 0 lightest.
  const post = new Post(renderer, { mobile });
  let quality = mobile ? 2 : 3;
  const QUAL = [{ scale: 0.55, bloom: false, chroma: false }, { scale: 0.7, bloom: false, chroma: false }, { scale: 0.85, bloom: true, chroma: false }, { scale: 1, bloom: true, chroma: true }];
  const applyQuality = () => { const q = QUAL[quality], d = renderer.getDrawingBufferSize(new THREE.Vector2()); post.bloomOn = q.bloom; post.U.chroma.value = q.chroma ? 1 : 0; post.setSize(d.x, d.y, q.scale); };
  applyQuality();

  status.textContent = 'Filling the ocean…';
  await new Promise(r => setTimeout(r, 30));
  const { array: atlas, images } = await loadTextures(mobile ? 128 : 256);
  await new Promise(r => setTimeout(r, 30));
  const t0 = performance.now();
  const world = new World().generate();
  console.log('world generated in', Math.round(performance.now() - t0), 'ms');
  status.textContent = 'Growing the reef…';
  await new Promise(r => setTimeout(r, 30));

  // ---- scene ----
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.04, 150);
  const fogDensity = mobile ? 0.042 : 0.032;
  const U = { time: { value: 0 }, dayK: { value: 1 }, dusk: { value: 0 }, surfY: { value: SURF }, fogDensity: { value: fogDensity }, fogColor: { value: new THREE.Vector3(0.1, 0.5, 0.6) } };
  scene.fog = new THREE.FogExp2(0x1a8099, fogDensity);
  const hemi = new THREE.HemisphereLight(0xcdeeff, 0x2a5a6a, 1.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cf, 1.5); sun.position.set(0.3, 1, 0.2); scene.add(sun);

  const mats = makeMaterials(atlas, U);
  const view = new ChunkView(scene, world, mats, mobile ? 11 : 17);
  const fx = new FX(scene, U);
  const fish = new PlayerFish(scene, images);
  const life = new Life(scene, world);

  // ---- player ----
  const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: -Math.PI / 2, pitch: -0.12, roll: 0, vyaw: 0, vis: -Math.PI / 2 };
  P.pos.set((world.spawn.x + 0.5) * VS, (world.groundTop(world.spawn.x, world.spawn.z) + 11) * VS, (world.spawn.z + 0.5) * VS);
  let viewMode = 'third';
  const camPos = new THREE.Vector3(), camInit = { done: false };
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const setFwd = (yaw, pitch, out = fwd) => out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

  // prebuild the water around the start so the first frame isn't empty
  view.radius = 5; view.scan(P.pos); while (view.queue.length) view.buildOne(view.queue.shift());
  view.radius = mobile ? 11 : 17; view.lastScan = -1e9;

  // ---- input state ----
  const inp = { swim: false, steerX: 0, steerY: 0, mouseSwim: false, keys: new Set() };
  const ptrs = new Map(); let steerId = null; const anchor = { x: 0, y: 0 };
  let lastTap = -1e9, locked = false, started = false;
  const steerR = () => Math.min(innerWidth, innerHeight) * 0.2;

  function start() {
    if (started) return; started = true;
    intro.classList.add('hide'); sound.start();
    if (isTouch && !/iPhone|iPad/.test(navigator.userAgent) && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }
  function toggleView() { viewMode = viewMode === 'third' ? 'first' : 'third'; camInit.done = false; }

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); const first = !started; start();
    if (e.pointerType === 'mouse') {
      if (e.button === 2) { toggleGrab(); return; }
      if (!locked && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
      inp.mouseSwim = true;
      if (!locked) { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t0: e.timeStamp, moved: 0 }); steerId = e.pointerId; anchor.x = e.clientX; anchor.y = e.clientY; }
      return;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t0: e.timeStamp, moved: 0, multi: ptrs.size > 0 });
    if (steerId === null) { steerId = e.pointerId; anchor.x = e.clientX; anchor.y = e.clientY; inp.swim = true; }
    else if (!first) toggleGrab();                        // a second finger: grab or let go
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse' && locked) return;      // (mouse look while captured is handled by 'mousemove' below)
    const p = ptrs.get(e.pointerId); if (!p) return;
    p.moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y); p.x = e.clientX; p.y = e.clientY;
    if (e.pointerId === steerId) {
      const R = steerR(); let dx = p.x - anchor.x, dy = p.y - anchor.y; const len = Math.hypot(dx, dy);
      if (len > R * 1.25) { const k = (len - R * 1.25) / len; anchor.x += dx * k; anchor.y += dy * k; dx = p.x - anchor.x; dy = p.y - anchor.y; } // the thumb's "centre" follows you
      inp.steerX = dx / R; inp.steerY = dy / R;
    }
  });
  const up_ = e => {
    if (e.pointerType === 'mouse') { if (e.button === 0) { inp.mouseSwim = false; } }
    const p = ptrs.get(e.pointerId); if (!p) { if (e.pointerType === 'mouse') { steerId = null; inp.steerX = inp.steerY = 0; } return; }
    const now = e.timeStamp;   // when the finger lifted, not when this code got to run (phones can be slow)
    ptrs.delete(e.pointerId);
    if (e.pointerId === steerId) {
      if (e.type === 'pointerup' && !p.multi && ptrs.size === 0 && now - p.t0 < 230 && p.moved < 14 && e.pointerType !== 'mouse') { // a quick tap
        if (now - lastTap < 380) { toggleView(); lastTap = -1e9; } else lastTap = now;
      }
      steerId = null; inp.steerX = inp.steerY = 0; inp.swim = false;
      const next = ptrs.entries().next().value;           // another finger is still down: it takes over steering
      if (next) { steerId = next[0]; anchor.x = next[1].x; anchor.y = next[1].y; inp.swim = true; }
    }
  };
  document.addEventListener('mousemove', e => { if (locked) { P.yaw -= e.movementX * 0.0024; P.pitch = clamp(P.pitch - e.movementY * 0.0024, -1.45, 1.45); } });
  canvas.addEventListener('pointerup', up_); canvas.addEventListener('pointercancel', up_);
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (locked) { steerId = null; ptrs.clear(); inp.steerX = inp.steerY = 0; } });
  addEventListener('keydown', e => {
    if (e.repeat) return; start(); inp.keys.add(e.code);
    if (e.code === 'KeyF' || e.code === 'KeyE' || e.code === 'KeyG') toggleGrab();
    if (e.code === 'KeyV' || e.code === 'KeyC') toggleView();
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', e => inp.keys.delete(e.code));
  addEventListener('blur', () => { inp.keys.clear(); inp.swim = false; inp.mouseSwim = false; ptrs.clear(); steerId = null; inp.steerX = inp.steerY = 0; });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); applyQuality(); });
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());

  // ---- blocks you can hold ----
  const matCache = new Map();
  const matFor = key => { let m = matCache.get(key); if (!m) { m = new THREE.MeshLambertMaterial({ map: singleTexture(images, key) }); matCache.set(key, m); } return m; };
  const blockGeo = new THREE.BoxGeometry(VS, VS, VS);
  const makeBlockMesh = id => {
    const m = new THREE.Mesh(blockGeo, [0, 1, 2, 3, 4, 5].map(f => {
      if (BLOCKS[id].emit) return new THREE.MeshBasicMaterial({ map: singleTexture(images, faceTexKey(id, f)), color: 0xffffff });
      return matFor(faceTexKey(id, f));
    }));
    return m;
  };
  let carrying = 0, carryMesh = null; const carryPos = new THREE.Vector3();
  const falling = [];
  const target = { kind: null, x: 0, y: 0, z: 0, ent: null };
  const hiGeo = new THREE.BoxGeometry(VS * 1.12, VS * 1.12, VS * 1.12);
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const hi = new THREE.Mesh(hiGeo, hiMat); hi.visible = false; hi.renderOrder = 8; scene.add(hi);
  const hiEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(VS * 1.08, VS * 1.08, VS * 1.08)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  hi.add(hiEdges);

  const mouthPos = (out = new THREE.Vector3()) => out.copy(P.pos).addScaledVector(fwd, 1.1);
  const REACH = 3.2, tmpD = new THREE.Vector3(), tmpR = new THREE.Vector3(), tmpU = new THREE.Vector3();

  function findTarget() {
    target.kind = null;
    const m = mouthPos();
    right.crossVectors(fwd, up).normalize(); tmpU.crossVectors(right, fwd).normalize();
    let best = null, bestScore = 1e9;
    const consider = (hit, ang) => {
      if (!hit || !CAN_PICK[world.get(hit.x, hit.y, hit.z)] || hit.y < 2) return;
      const score = hit.dist + ang * 6;
      if (score < bestScore) { bestScore = score; best = hit; }
    };
    consider(world.raycast(m.x, m.y, m.z, fwd.x, fwd.y, fwd.z, REACH), 0);
    const T = Math.tan(0.2);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * 6.2832; tmpD.copy(fwd).addScaledVector(right, Math.cos(a) * T).addScaledVector(tmpU, Math.sin(a) * T).normalize();
      consider(world.raycast(m.x, m.y, m.z, tmpD.x, tmpD.y, tmpD.z, REACH), 1);
    }
    if (best) { target.kind = 'voxel'; target.x = best.x; target.y = best.y; target.z = best.z; }
    // blocks that are sinking
    for (const e of falling) {
      tmpD.subVectors(e.pos, m); const along = tmpD.dot(fwd);
      if (along < 0.05 || along > REACH) continue;
      const perp = Math.sqrt(Math.max(0, tmpD.lengthSq() - along * along));
      if (perp < 0.2 + along * 0.2 && (target.kind !== 'voxel' || along < bestScore)) { target.kind = 'entity'; target.ent = e; }
    }
  }
  function overlapsFish(cx, cy, cz) { // would a block in this cell be inside the fish?
    const hx = 0.32 + VS * 0.5, hy = 0.25 + VS * 0.5;
    return Math.abs((cx + 0.5) * VS - P.pos.x) < hx && Math.abs((cy + 0.5) * VS - P.pos.y) < hy && Math.abs((cz + 0.5) * VS - P.pos.z) < hx;
  }
  function toggleGrab() {
    if (!started) return;
    if (carrying) return release();
    if (!target.kind) { sound.blip(220, 160, 0.08, 0.08); return; }
    if (target.kind === 'voxel') {
      carrying = world.get(target.x, target.y, target.z); world.set(target.x, target.y, target.z, 0);
      carryPos.set((target.x + 0.5) * VS, (target.y + 0.5) * VS, (target.z + 0.5) * VS);
    } else {
      const e = target.ent; carrying = e.id; carryPos.copy(e.pos);
      scene.remove(e.mesh); falling.splice(falling.indexOf(e), 1);
    }
    carryMesh = makeBlockMesh(carrying); carryMesh.position.copy(carryPos); scene.add(carryMesh);
    sound.grab(); for (let i = 0; i < 5; i++) fx.emitBubble(carryPos.x + (Math.random() - 0.5) * 0.2, carryPos.y, carryPos.z + (Math.random() - 0.5) * 0.2, 0.05);
    target.kind = null;
  }
  function release() {
    const id = carrying; carrying = 0; scene.remove(carryMesh); carryMesh = null;
    const m = mouthPos();
    const hit = world.raycast(m.x, m.y, m.z, fwd.x, fwd.y, fwd.z, 1.15);   // let go right against a surface and it snaps on, like building
    if (hit && hit.dist > 0.02) {
      const cx = hit.x + hit.nx, cy = hit.y + hit.ny, cz = hit.z + hit.nz;
      if (world.inb(cx, cy, cz) && cy >= 2 && !world.isSolid(cx, cy, cz) && !overlapsFish(cx, cy, cz)) { world.set(cx, cy, cz, id); sound.land(); fx.puff((cx + 0.5) * VS, (cy + 0.2) * VS, (cz + 0.5) * VS); return; }
    }
    const mesh = makeBlockMesh(id); mesh.position.copy(carryPos); scene.add(mesh);
    falling.push({ id, mesh, pos: carryPos.clone(), vel: P.vel.clone().multiplyScalar(0.4).addScaledVector(fwd, 0.7), spin: (Math.random() - 0.5) * 2 });
    sound.drop();
  }
  function settle(e, px, py, pz) {
    let cx = Math.floor(px / VS), cy = Math.floor(py / VS), cz = Math.floor(pz / VS);
    cx = clamp(cx, 1, NX - 2); cz = clamp(cz, 1, NZ - 2);
    let guard = 0; while (guard++ < 60 && world.isSolid(cx, cy, cz)) cy++;
    world.set(cx, cy, cz, e.id); scene.remove(e.mesh); sound.land(); fx.puff((cx + 0.5) * VS, (cy + 0.2) * VS, (cz + 0.5) * VS);
    const i = falling.indexOf(e); if (i >= 0) falling.splice(i, 1);
  }
  function updateFalling(dt) {
    for (let i = falling.length - 1; i >= 0; i--) {
      const e = falling[i], p = e.pos;
      e.vel.y += (-1.3 - e.vel.y) * Math.min(1, 2.2 * dt);
      const drag = Math.exp(-2.5 * dt); e.vel.x *= drag; e.vel.z *= drag;
      const nx = p.x + e.vel.x * dt, nz = p.z + e.vel.z * dt;
      if (!world.isSolid(Math.floor(nx / VS), Math.floor(p.y / VS), Math.floor(p.z / VS))) p.x = nx; else e.vel.x = 0;
      if (!world.isSolid(Math.floor(p.x / VS), Math.floor(p.y / VS), Math.floor(nz / VS))) p.z = nz; else e.vel.z = 0;
      const ny = p.y + e.vel.y * dt;
      if (ny < 2.5 * VS || world.isSolid(Math.floor(p.x / VS), Math.floor((ny - VS * 0.5) / VS), Math.floor(p.z / VS))) { settle(e, p.x, p.y, p.z); continue; }
      p.y = ny;
      e.mesh.position.copy(p); e.mesh.rotation.y += e.spin * dt; e.mesh.rotation.x = Math.sin(performance.now() * 0.002 + i) * 0.25;
      e.spin *= Math.exp(-0.5 * dt);
    }
  }

  // ---- fish physics ----
  const HX = 0.3, HY = 0.24;
  function hitsSolid(x, y, z) {
    const x0 = Math.floor((x - HX) / VS), x1 = Math.floor((x + HX) / VS), y0 = Math.floor((y - HY) / VS), y1 = Math.floor((y + HY) / VS), z0 = Math.floor((z - HX) / VS), z1 = Math.floor((z + HX) / VS);
    for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) if (world.isSolid(xx, yy, zz)) return true;
    return false;
  }
  const MINX = 0.45, MAXX = NX * VS - 0.45, MINY = 0.6, MAXY = SURF - 0.5;
  function movePlayer(dt) {
    const v = P.vel, p = P.pos;
    for (const ax of ['x', 'y', 'z']) {
      const old = p[ax]; p[ax] += v[ax] * dt;
      if (hitsSolid(p.x, p.y, p.z)) { p[ax] = old; v[ax] *= -0.05; }
    }
    p.x = clamp(p.x, MINX, MAXX); p.z = clamp(p.z, MINX, MAXX); p.y = clamp(p.y, MINY, MAXY);
    let g = 0; while (hitsSolid(p.x, p.y, p.z) && g++ < 80) p.y += VS * 0.5;        // something landed on you: float up out of it
  }

  // ---- frame ----
  let last = performance.now(), tAcc = 0, slow = 0, frames = 0, tmpV = new THREE.Vector3();
  const fogShallow = new THREE.Vector3(0.07, 0.47, 0.6), fogDeep = new THREE.Vector3(0.012, 0.06, 0.15);
  const col = new THREE.Color();
  const fogNight = new THREE.Vector3(0.012, 0.05, 0.1), fogNightDeep = new THREE.Vector3(0.004, 0.012, 0.035), fogDusk = new THREE.Vector3(0.16, 0.05, -0.02);
  const DAY_LEN = 720; let tod = 0.3, flashAmt = 0;
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 2; shadow.scale.set(1, 1.7, 1);
  const shadowRoot = new THREE.Group(); scene.add(shadowRoot); shadowRoot.add(shadow);

  function frame(now) {
    requestAnimationFrame(frame);
    const dtRaw = (now - last) / 1000; last = now; if (document.hidden) return;
    const dt = Math.min(dtRaw, 0.05); tAcc += dt; U.time.value = tAcc;
    // adaptive resolution: if the phone is struggling, draw fewer pixels
    frames++; slow = slow * 0.97 + dtRaw * 0.03;
    if (frames % 120 === 0 && slow > 0.034 && quality > 0) { quality--; applyQuality(); view.radius = Math.max(7, view.radius - 2); console.log('quality ->', quality); }

    // steering
    const k = inp.keys;
    const dz = v => Math.sign(v) * Math.max(0, Math.abs(v) - 0.08) / 0.92;
    let yawRate = 0;
    if (steerId !== null && !locked) {
      yawRate = -dz(clamp(inp.steerX, -1, 1)) * 2.5; P.yaw += yawRate * dt;
      P.pitch = clamp(P.pitch - dz(clamp(inp.steerY, -1, 1)) * 1.8 * dt, -1.45, 1.45);
    }
    if (k.has('ArrowLeft')) { P.yaw += 1.8 * dt; yawRate = 1.8; } if (k.has('ArrowRight')) { P.yaw -= 1.8 * dt; yawRate = -1.8; }
    if (k.has('ArrowUp')) P.pitch = clamp(P.pitch + 1.4 * dt, -1.45, 1.45); if (k.has('ArrowDown')) P.pitch = clamp(P.pitch - 1.4 * dt, -1.45, 1.45);
    setFwd(P.yaw, P.pitch); right.crossVectors(fwd, up).normalize();

    // thrust
    let thrustF = (inp.swim || inp.mouseSwim || k.has('KeyW')) ? 1 : 0; if (k.has('KeyS')) thrustF -= 0.6;
    const thrustR = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), thrustU = (k.has('Space') ? 1 : 0) - (k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0);
    const v = P.vel;
    tmpV.set(0, 0, 0).addScaledVector(fwd, thrustF).addScaledVector(right, thrustR * 0.7).addScaledVector(up, thrustU * 0.7);
    v.addScaledVector(tmpV, 8.2 * dt);
    const drag = Math.exp(-1.9 * dt); v.multiplyScalar(drag);
    if (thrustF > 0) { // a fish turns where it points: slide sideways speed away
      const along = v.dot(fwd); tmpD.copy(fwd).multiplyScalar(along); tmpR.copy(v).sub(tmpD).multiplyScalar(Math.exp(-4.5 * dt)); v.copy(tmpD).add(tmpR);
    }
    movePlayer(dt);
    const sp = v.length(), speed01 = clamp(sp / 4, 0, 1);
    P.vyaw += (yawRate - P.vyaw) * Math.min(1, 6 * dt);
    P.roll += (clamp(-P.vyaw * 0.28, -0.6, 0.6) - P.roll) * Math.min(1, 5 * dt);
    let dy = P.yaw - P.vis; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P.vis += dy * Math.min(1, 10 * dt);

    // fish
    fish.group.visible = viewMode === 'third';
    fish.group.position.copy(P.pos); fish.group.position.y += Math.sin(tAcc * 1.6) * 0.02;
    fish.group.rotation.set(P.pitch, P.vis, P.roll, 'YXZ');
    fish.update(dt, Math.max(speed01, thrustF > 0 ? 0.5 : 0), tAcc);
    sound.setSwim(speed01); sound.tick(tAcc);
    if (sp > 1.5 && Math.random() < dt * 2.2) { mouthPos(tmpV); fx.emitBubble(tmpV.x, tmpV.y + 0.1, tmpV.z, 0.04, v.x * 0.2, v.z * 0.2); }

    // grabbing
    if (carrying) {
      const off = viewMode === 'first' ? 1.5 : 1.5, dn = viewMode === 'first' ? -0.3 : -0.1;
      tmpV.copy(P.pos).addScaledVector(fwd, off); tmpV.y += dn + Math.sin(tAcc * 2) * 0.01;
      carryPos.lerp(tmpV, 1 - Math.exp(-16 * dt)); carryMesh.position.copy(carryPos);
      carryMesh.rotation.set(0, P.vis, 0); hi.visible = false;
    } else {
      findTarget();
      if (target.kind === 'voxel') { hi.visible = true; hi.position.set((target.x + 0.5) * VS, (target.y + 0.5) * VS, (target.z + 0.5) * VS); }
      else if (target.kind === 'entity') { hi.visible = true; hi.position.copy(target.ent.pos); }
      else hi.visible = false;
      hiMat.opacity = 0.18 + 0.12 * Math.sin(tAcc * 6);
    }
    updateFalling(dt);

    // camera
    if (viewMode === 'first') {
      camera.position.copy(P.pos).addScaledVector(fwd, 0.7); camera.position.y += 0.08;
      camera.rotation.set(P.pitch, P.yaw, P.roll * 0.4, 'YXZ'); camPos.copy(camera.position); camera.fov = 80;
    } else {
      const dist = 3.8;                                   // behind, a bit above, and over the right shoulder so the block in your mouth stays visible
      tmpD.copy(P.pos).addScaledVector(fwd, -dist).addScaledVector(right, 0.85); tmpD.y += 1.15;
      tmpR.subVectors(tmpD, P.pos); const len = tmpR.length(); tmpR.divideScalar(len);
      const hit = world.raycast(P.pos.x, P.pos.y, P.pos.z, tmpR.x, tmpR.y, tmpR.z, len + 0.2);
      if (hit) tmpD.copy(P.pos).addScaledVector(tmpR, Math.max(0.35, hit.dist - 0.22));
      if (!camInit.done) { camPos.copy(tmpD); camInit.done = true; } else camPos.lerp(tmpD, 1 - Math.exp(-7 * dt));
      camera.position.copy(camPos); camera.position.y = Math.min(camera.position.y, SURF - 0.25);
      tmpV.copy(P.pos).addScaledVector(fwd, 1.8).addScaledVector(right, 0.3); tmpV.y += 0.05; camera.lookAt(tmpV); camera.fov = 72;
    }
    if (window.__camOverride) { const o = window.__camOverride; camera.position.set(o[0], o[1], o[2]); camera.lookAt(o[3], o[4], o[5]); }
    camera.updateProjectionMatrix();

    // time of day: a full day and night takes 12 minutes
    tod = (tod + dt / DAY_LEN) % 1;
    const sunH = Math.sin((tod - 0.25) * Math.PI * 2);
    const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const dayK = sstep(-0.2, 0.3, sunH), dusk = Math.exp(-(((sunH - 0.02) / 0.22) ** 2));
    U.dayK.value = dayK; U.dusk.value = dusk;
    // water colour depends on how deep you are, and the time of day
    const depth = SURF - camera.position.y, kd = 1 - Math.exp(-depth * 0.05);
    tmpV.lerpVectors(fogShallow, fogDeep, kd); tmpD.lerpVectors(fogNight, fogNightDeep, kd);
    U.fogColor.value.lerpVectors(tmpD, tmpV, dayK).addScaledVector(fogDusk, dusk * (1 - kd * 0.7));
    const fc = U.fogColor.value; scene.fog.color.setRGB(fc.x, fc.y, fc.z, THREE.SRGBColorSpace); renderer.setClearColor(scene.fog.color);
    const wl = Math.max(Math.exp(-depth * 0.04), 0.12);
    hemi.intensity = 1.9 * (0.35 + 0.65 * wl) * (0.16 + 0.84 * dayK); sun.intensity = 1.5 * wl * dayK;
    col.setRGB((0.8 * (0.5 + 0.5 * wl)) * (0.5 + 0.5 * dayK), 0.95 * (0.7 + 0.3 * dayK), 1.0, THREE.SRGBColorSpace); hemi.color.copy(col);
    sound.muffle(kd);
    // post effects: the picture wobbles near the surface and when you swim hard
    post.U.wobble.value = clamp(1 - depth / 4.5, 0, 1) * 0.9 + speed01 * 0.2; post.U.dayK.value = dayK;
    flashAmt *= Math.exp(-2.2 * dt); post.flash.set(1.0, 0.85, 0.5).multiplyScalar(flashAmt * 0.35);
    // a soft shadow on the seabed under the fish
    const sh = world.raycast(P.pos.x, P.pos.y, P.pos.z, 0, -1, 0, 7);
    if (sh && viewMode === 'third') { shadow.visible = true; shadowRoot.position.set(P.pos.x, (sh.y + 1) * VS + 0.012, P.pos.z); shadowRoot.rotation.y = P.vis; shadowMat.opacity = 0.38 * (1 - sh.dist / 7) * (0.35 + 0.65 * dayK); } else shadow.visible = false;

    life.update(tAcc);
    fx.update(dt, camera.position, post.size.y / (2 * Math.tan(camera.fov * Math.PI / 360)));
    view.update(camera.position, mobile ? 2.5 : 4, now);
    post.render(scene, camera, tAcc);
  }
  const tmpV2 = new THREE.Vector2();
  status.textContent = '';
  intro.classList.add('ready');
  requestAnimationFrame(t => { last = t; frame(t); });
  window.__reef = { P, world, camera, scene, renderer, view, inp, setView: m => { viewMode = m; camInit.done = false; }, grab: toggleGrab, falling, fish, life, post, get tod() { return tod; }, set tod(v) { tod = v; }, flash: a => { flashAmt = a; }, get carrying() { return carrying; }, target, start, fx };
}
boot().catch(err => { console.error(err); status.textContent = 'Something went wrong: ' + err.message; });
