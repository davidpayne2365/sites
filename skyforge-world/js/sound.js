// Sounds made on the fly with Web Audio (no sound files). Browsers only allow audio after a click, tap or key,
// so audioStart() is called when play starts.
let ctx = null, noise = null;
export function audioStart() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { ctx = null; }
}
// One hoof striking the ground: a short knock (filtered noise) and a low thud. delay: seconds from now.
export function hoof(vol = 0.35, pitch = 1, delay = 0) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource(); src.buffer = noise;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 * pitch; bp.Q.value = 2.5;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  src.connect(bp).connect(g).connect(ctx.destination); src.start(t, Math.random() * 0.15, 0.09);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110 * pitch, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(vol * 0.9, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g2).connect(ctx.destination); o.start(t); o.stop(t + 0.12);
}
