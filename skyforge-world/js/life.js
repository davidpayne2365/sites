// Life around the castle: flocks of birds wheeling over the hill, and a dragon circling the great spire.
// Built from plain shapes (no models); everything moves in update().
import * as THREE from 'three';

export function makeLife(scene, { hill, spire }) {
  // ---- Birds: each a body and two flapping wings (instanced) ----------------------------------------
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, 2.6, 0, -0.2, 0, 0, -0.7], 3));
  wing.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1c1a1a, side: THREE.DoubleSide });
  const flocks = [
    { x: hill.x - 150, z: hill.z + 250, y: 420, r: 260, speed: 0.11, n: 14 },
    { x: hill.x + 400, z: hill.z - 100, y: 330, r: 180, speed: -0.15, n: 10 },
    { x: hill.x - 200, z: hill.z + 900, y: 150, r: 320, speed: 0.08, n: 12 },
  ];
  const N = flocks.reduce((a, f) => a + f.n, 0);
  const wingsR = new THREE.InstancedMesh(wing, birdMat, N), wingsL = new THREE.InstancedMesh(wing, birdMat, N);
  wingsR.frustumCulled = wingsL.frustumCulled = false;
  scene.add(wingsR, wingsL);
  const birds = [];
  flocks.forEach(f => { for (let i = 0; i < f.n; i++) birds.push({ f, phase: i * 0.21 + Math.random() * 0.1, dr: (Math.random() - 0.5) * 40, dy: (Math.random() - 0.5) * 24, flap: Math.random() * 6 }); });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qr = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(1.6, 1.6, 1.6), scL = new THREE.Vector3(-1.6, 1.6, 1.6);

  // ---- The dragon ---------------------------------------------------------------------------------
  const red = new THREE.MeshLambertMaterial({ color: 0x6a1c14 }), dark = new THREE.MeshLambertMaterial({ color: 0x3a120c, side: THREE.DoubleSide });
  const horn = new THREE.MeshLambertMaterial({ color: 0xd8ccb0 }), eye = new THREE.MeshBasicMaterial({ color: 0xffb020 });
  const dragon = new THREE.Group(), spine = [];
  const add = (g, m, x, y, z, parent = dragon) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o; };
  for (let k = 0; k < 12; k++) { // neck to tail (the head is at +z)
    const s = k < 3 ? 5 - k * 0.3 : Math.max(1.2, 7 - (k - 3) * 0.7);
    spine.push(add(new THREE.BoxGeometry(s * 1.6, s * 1.3, 9), red, 0, 0, 30 - k * 8.5));
  }
  const head = add(new THREE.BoxGeometry(7, 6, 13), red, 0, 1, 42);
  add(new THREE.BoxGeometry(6, 2, 10), red, 0, -3.4, 3, head); // jaw
  for (const sd of [-1, 1]) {
    const h = add(new THREE.ConeGeometry(1.2, 9, 6), horn, sd * 2.4, 4.5, -4, head); h.rotation.x = -0.9;
    add(new THREE.BoxGeometry(0.8, 0.8, 0.8), eye, sd * 3.6, 1.5, 3, head);
  }
  const wings = [-1, 1].map(sd => {
    const pivot = new THREE.Group(); pivot.position.set(sd * 6, 3, 14); dragon.add(pivot);
    const g = new THREE.BufferGeometry();
    const P = [[0, 0, 4], [70, 4, -2], [62, 0, -26], [34, 0, -32], [10, 0, -16]].map(([x, y, z]) => [x * sd, y, z]);
    const v = []; for (let i = 1; i < P.length - 1; i++) v.push(...P[0], ...P[i], ...P[i + 1]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    add(g, dark, 0, 0, 0, pivot);
    const bone = add(new THREE.BoxGeometry(70, 1.6, 1.6), red, 35 * sd, 2, 1, pivot); bone.rotation.y = 0.08 * sd;
    return { pivot, sd };
  });
  for (const [x, z] of [[-4, 18], [4, 18], [-4, -8], [4, -8]]) add(new THREE.BoxGeometry(2, 7, 2.4), red, x, -6, z);
  dragon.scale.setScalar(1.5);
  scene.add(dragon);
  const tgt = new THREE.Vector3();

  function update(dt, t) {
    // birds
    let i = 0;
    for (const b of birds) {
      const f = b.f, a = t * f.speed + b.phase, r = f.r + b.dr;
      p.set(f.x + Math.sin(a) * r, f.y + b.dy + Math.sin(t * 0.7 + b.phase * 3) * 6, f.z + Math.cos(a) * r);
      const yaw = a + (f.speed > 0 ? Math.PI / 2 : -Math.PI / 2), flap = Math.sin(t * 9 + b.flap) * 0.7;
      q.setFromEuler(e.set(0, yaw, 0));
      m4.compose(p, qr.copy(q).multiply(new THREE.Quaternion().setFromEuler(e.set(0, 0, flap))), sc); wingsR.setMatrixAt(i, m4);
      m4.compose(p, qr.copy(q).multiply(new THREE.Quaternion().setFromEuler(e.set(0, 0, -flap))), scL); wingsL.setMatrixAt(i, m4);
      i++;
    }
    wingsR.instanceMatrix.needsUpdate = wingsL.instanceMatrix.needsUpdate = true;
    // dragon: a slow, banking circle round the spire, its body rippling and its wings beating
    const a = t * 0.06, R = 330, y = spire.look + 130 + Math.sin(t * 0.25) * 40;
    dragon.position.set(spire.x + Math.sin(a) * R, y, spire.z + Math.cos(a) * R);
    tgt.set(spire.x + Math.sin(a + 0.05) * R, y + Math.cos(t * 0.25) * 2, spire.z + Math.cos(a + 0.05) * R);
    dragon.lookAt(tgt);
    dragon.rotateZ(-0.35);
    spine.forEach((s, k) => { s.position.y = Math.sin(t * 2.2 - k * 0.55) * (1 + k * 0.25); s.position.x = Math.sin(t * 1.3 - k * 0.4) * k * 0.3; });
    head.position.y = 1 + Math.sin(t * 2.2 + 0.6) * 0.8;
    for (const w of wings) w.pivot.rotation.z = w.sd * (Math.sin(t * 2.4) * 0.55 + 0.1);
  }
  return { update };
}
