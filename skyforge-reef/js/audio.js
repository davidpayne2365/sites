// All sound is made in code: a deep underwater hum, a swish when you swim, bubbly blips, and a pop when you grab.
export class Sound {
  constructor() { this.ctx = null; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    const master = this.master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    // brown noise, looped
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const src = (f, q, type, gain) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = 0.9 + Math.random() * 0.2;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(master); s.start(); return { fl, g };
    };
    this.hum = src(220, 0.7, 'lowpass', 0.55);
    this.swish = src(900, 0.9, 'bandpass', 0);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 90; lfo.connect(lg); lg.connect(this.hum.fl.frequency); lfo.start();
    this.nextBloop = 0;
    // reverb: sounds in the sea ring on and on
    const secs = 3.2, rl = ctx.sampleRate * secs, imp = ctx.createBuffer(2, rl, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = imp.getChannelData(c); for (let i = 0; i < rl; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.6); }
    const conv = ctx.createConvolver(); conv.buffer = imp; const wet = this.wetIn = ctx.createGain(); wet.gain.value = 0.55; wet.connect(conv);
    const wetOut = ctx.createGain(); wetOut.gain.value = 0.9; conv.connect(wetOut); wetOut.connect(master);
    this.music = ctx.createGain(); this.music.gain.value = 0.5; this.music.connect(master); this.music.connect(wet);
    this.nextNote = ctx.currentTime + 2; this.nextPad = ctx.currentTime + 1; this.padStep = 0;
  }
  setMuted(m) { this.muted = m; if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.15); }
  // Slow generative music: soft bells in a pentatonic scale over a drifting pad. Deeper and sparser the lower you go;
  // at night the scale turns minor and dreamier.
  musicUpdate(depth01, dayK) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const scale = dayK > 0.5 ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10], root = 146.83;   // D
    if (now > this.nextPad) {
      const chordRoots = [0, -3, -5, 2], r = root * Math.pow(2, chordRoots[this.padStep++ % 4] / 12) * (dayK > 0.5 ? 1 : 0.84), dur = 9 + Math.random() * 3;
      for (const [m, v] of [[1, 0.05], [1.5, 0.035], [2.25, 0.03]]) {
        for (const det of [-5, 5]) {
          const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
          o.type = 'triangle'; o.frequency.value = r * m; o.detune.value = det; f.type = 'lowpass'; f.frequency.value = 650;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(v * (0.6 + depth01 * 0.8), now + 4); g.gain.linearRampToValueAtTime(0, now + dur + 3);
          o.connect(f); f.connect(g); g.connect(this.music); o.start(now); o.stop(now + dur + 3.2);
        }
      }
      this.nextPad = now + dur - 1;
    }
    if (now > this.nextNote) {
      const oct = depth01 > 0.6 ? 1 : 2, n = scale[Math.floor(Math.random() * scale.length)], f = root * Math.pow(2, (n + 12 * oct) / 12);
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2.005;
      const g2 = ctx.createGain(); g2.gain.value = 0.25; g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.07, now + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.music); o.start(now); o2.start(now); o.stop(now + 3.6); o2.stop(now + 3.6);
      this.nextNote = now + (0.7 + Math.random() * 1.8) * (1 + depth01 * 1.1) * (dayK > 0.5 ? 1 : 1.5);
      if (Math.random() < 0.18) this.nextNote += 3;
    }
  }
  setSwim(level) { if (this.ctx) this.swish.g.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.12); }
  muffle(depth01) { if (this.ctx) this.hum.fl.frequency.setTargetAtTime(260 - depth01 * 130, this.ctx.currentTime, 0.5); }
  blip(f0 = 420, f1 = 900, vol = 0.12, dur = 0.12) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(g); g.connect(this.master); g.connect(this.wetIn); o.start(t); o.stop(t + dur + 0.1);
  }
  tone(f, vol = 0.1, dur = 1.5, type = 'sine') {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); g.connect(this.wetIn); o.start(t); o.stop(t + dur + 0.1);
  }
  chime(root = 523.25, notes = [1, 1.25, 1.5, 2, 2.5], vol = 0.11) { notes.forEach((m, i) => setTimeout(() => { this.tone(root * m, vol, 2.2); this.tone(root * m * 2, vol * 0.3, 1.4, 'triangle'); }, i * 120)); }
  // A whale singing somewhere out in the blue: slow gliding notes, panned to where the whale is.
  whale(dist, pos, cam, t) {
    if (!this.ctx) return;
    if (!this.nextWhale) this.nextWhale = t + 8;
    if (t < this.nextWhale) return;
    this.nextWhale = t + (dist < 60 ? 22 + Math.random() * 18 : 70 + Math.random() * 60);
    if (dist > 90) return;
    const e = cam.matrixWorld.elements, dx = pos.x - cam.position.x, dy = pos.y - cam.position.y, dz = pos.z - cam.position.z, len = Math.hypot(dx, dy, dz) || 1;
    const pan = Math.max(-1, Math.min(1, (dx * e[0] + dy * e[1] + dz * e[2]) / len)), vol = 0.22 / (1 + dist / 14);
    const ctx = this.ctx, now = ctx.currentTime, out = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null, lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 520; out.gain.value = 1; if (p) { p.pan.value = pan; out.connect(lp); lp.connect(p); p.connect(this.master); } else { out.connect(lp); lp.connect(this.master); }
    let at = now + 0.1; const f0 = 110 + Math.random() * 60;
    for (let k = 0; k < 4 + Math.floor(Math.random() * 3); k++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), d = 1.6 + Math.random() * 1.6;
      const a = f0 * (0.8 + Math.random() * 1.3), b = a * (0.7 + Math.random() * 0.9);
      o.type = 'sine'; o.frequency.setValueAtTime(a, at); o.frequency.exponentialRampToValueAtTime(Math.max(50, b), at + d);
      lfo.frequency.value = 5 + Math.random() * 3; lg.gain.value = a * 0.02; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + d * 0.35); g.gain.linearRampToValueAtTime(0, at + d);
      o.connect(g); g.connect(out); o.start(at); lfo.start(at); o.stop(at + d + 0.1); lfo.stop(at + d + 0.1); at += d * 0.8;
    }
  }
  grab() { this.blip(300, 900, 0.18, 0.1); setTimeout(() => this.blip(500, 1200, 0.1, 0.08), 70); }
  drop() { this.blip(700, 260, 0.16, 0.14); }
  land() { this.blip(180, 90, 0.2, 0.1); }
  tick(t) { // a stray bubble sound now and then
    if (this.ctx && t > this.nextBloop) { this.blip(250 + Math.random() * 300, 500 + Math.random() * 700, 0.04, 0.09); this.nextBloop = t + 2 + Math.random() * 5; }
  }
}
