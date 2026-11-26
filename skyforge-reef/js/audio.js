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
  }
  setSwim(level) { if (this.ctx) this.swish.g.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.12); }
  muffle(depth01) { if (this.ctx) this.hum.fl.frequency.setTargetAtTime(260 - depth01 * 130, this.ctx.currentTime, 0.5); }
  blip(f0 = 420, f1 = 900, vol = 0.12, dur = 0.12) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.1);
  }
  grab() { this.blip(300, 900, 0.18, 0.1); setTimeout(() => this.blip(500, 1200, 0.1, 0.08), 70); }
  drop() { this.blip(700, 260, 0.16, 0.14); }
  land() { this.blip(180, 90, 0.2, 0.1); }
  tick(t) { // a stray bubble sound now and then
    if (this.ctx && t > this.nextBloop) { this.blip(250 + Math.random() * 300, 500 + Math.random() * 700, 0.04, 0.09); this.nextBloop = t + 2 + Math.random() * 5; }
  }
}
