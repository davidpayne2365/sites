// Music and sounds, all real recordings (sounds/music, sounds/sfx; credits in sounds/LICENSE.txt): four calm
// tracks, one per album, each with its own pixel-art cover; recorded sound effects; crickets at night and drips in
// caves. Everything is mastered quietly with headroom and goes through a limiter at the end, so nothing clips, and
// phones get the deep bass cut that their little speakers can't play (that is what crackles).

// --- Shared audio graph --------------------------------------------------------------------------------------
const store = (() => { try { return JSON.parse(localStorage.getItem('skyforge.music') || '{}'); } catch (e) { return {}; } })();
const PHONE = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
export const audio = {
  ctx: null, vMusic: store.vMusic ?? 0.6, vSfx: store.vSfx ?? 0.7,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = this.ctx = new AC();
    // master -> (phones: bass cut) -> brick-wall limiter -> speakers
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.85;
    if (PHONE) {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 150; hp.Q.value = 0.7;
      this.master.connect(hp); hp.connect(limiter);
    } else this.master.connect(limiter);
    this.music = ctx.createGain(); this.music.gain.value = this.vMusic; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.vSfx; this.sfx.connect(this.master);
    return ctx;
  },
  setVolumes(m, s) {
    if (m !== undefined) this.vMusic = m;
    if (s !== undefined) this.vSfx = s;
    if (this.ctx) { this.music.gain.setTargetAtTime(this.vMusic, this.ctx.currentTime, 0.1); this.sfx.gain.setTargetAtTime(this.vSfx, this.ctx.currentTime, 0.1); }
  },
};
function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// --- The albums: one recorded track each (all CC0, from OpenGameArt.org) --------------------------------------
export const TRACKS = [
  { id: 'lantern', title: 'Lantern Halls', song: 'Afternoon Nap', artist: 'Tsorthan Grove' },
  { id: 'twilight', title: 'Twilight Garden', song: 'Another August', artist: 'The Cynic Project' },
  { id: 'waltz', title: 'Old Stone Waltz', song: 'Rising Moon', artist: 'RandomMind' },
  { id: 'rain', title: 'Rain on Moss', song: 'Daydream', artist: 'Tsorthan Grove' },
].map(t => ({ ...t, mood: `“${t.song}” by ${t.artist}`, src: `sounds/music/${t.id}.mp3` }));

// --- Recorded sounds ------------------------------------------------------------------------------------------
// Short sounds are fetched once and played from memory.
const buffers = new Map();
function loadBuffer(url) {
  const ctx = audio.ctx;
  if (!buffers.has(url)) buffers.set(url, fetch(url).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).catch(() => { buffers.delete(url); return null; }));
  return buffers.get(url);
}
function playBuffer(url, vol, { rate = 1, loop = false, out } = {}) {
  const ctx = audio.init(); if (!ctx) return null;
  const g = ctx.createGain(); g.gain.value = vol; g.connect(out || audio.sfx);
  const h = { gain: g, src: null, stopped: false, stop(fade = 0.05) { this.stopped = true; const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, fade / 3); if (this.src) try { this.src.stop(t + fade + 0.05); } catch (e) { /* done */ } } };
  loadBuffer(url).then(buf => {
    if (!buf || h.stopped) return;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate; src.loop = loop;
    src.connect(g); src.start(); h.src = src;
  });
  return h;
}
const SFX = {
  coin: ['coin', 0.55, 0.08], chest: ['chest', 0.8, 0], big: ['big', 0.9, 0], place: ['place', 0.6, 0.06], break: ['break', 0.75, 0.1],
  buy: ['buy', 0.8, 0], portal: ['portal', 0.8, 0], click: ['click', 0.45, 0], tap: ['tap', 0.35, 0],
  gate: ['gate-open', 0.7, 0.06], gateClose: ['gate-close', 0.55, 0.06],
};
export function sfx(kind) {
  const s = SFX[kind]; if (!s) return;
  const [file, vol, vary] = s;
  playBuffer(`sounds/sfx/${file}.mp3`, vol, { rate: 1 + (Math.random() * 2 - 1) * vary });
}
// Warm the cache so the first coin isn't late.
function preload() { for (const [file] of Object.values(SFX)) loadBuffer(`sounds/sfx/${file}.mp3`); }

function cover(id) {
  const N = 48, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), r = rngOf(id.length * 7919 + id.charCodeAt(0) * 31);
  const px = (x, y, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const sky = (top, bot, h = N) => { for (let y = 0; y < h; y++) { const k = y / h; g.fillStyle = `rgb(${top.map((v, i) => Math.round(v + (bot[i] - v) * k)).join(',')})`; g.fillRect(0, y, N, 1); } };
  const hills = (y0, col, amp, f, ph) => { for (let x = 0; x < N; x++) { const h = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 2) * amp * 0.4; px(x, h, col, 1, N - h); } };
  const stars = n => { for (let i = 0; i < n; i++) px(r() * N, r() * N * 0.6, r() < 0.3 ? '#fff6d0' : '#dfe8ff'); };
  const castle = (x, base, col, s = 1) => { px(x, base - 10 * s, col, 14 * s, 10 * s); px(x - 2 * s, base - 16 * s, col, 4 * s, 16 * s); px(x + 12 * s, base - 18 * s, col, 4 * s, 18 * s); px(x + 5 * s, base - 14 * s, col, 4 * s, 4 * s); for (let i = 0; i < 7; i++) px(x + i * 2 * s, base - 11 * s, col, s, s); px(x - 2 * s, base - 18 * s, col, 4 * s, 2 * s); px(x + 13 * s, base - 21 * s, col, 2 * s, 3 * s); };
  if (id === 'mossy') {
    sky([92, 160, 230], [196, 228, 250], 34); px(36, 6, '#fff2b0', 5, 5); px(35, 7, '#fff2b0', 7, 3);
    for (let i = 0; i < 3; i++) { const cx = 4 + i * 15 + r() * 4, cy = 8 + r() * 8; px(cx, cy, '#ffffff', 8, 2); px(cx + 2, cy - 1, '#ffffff', 4, 1); }
    hills(30, '#5f9a3a', 2, 0.18, 1); px(0, 34, '#7b8077', N, 6); for (let x = 0; x < N; x += 3) px(x, 34, '#4f8a30', 2 + (x % 2), 2 + (x % 3));
    for (let x = 0; x < N; x += 4) px(x + 1, 36, '#6a6f68', 2, 1);
    px(0, 40, '#4a8a2c', N, 8); for (let i = 0; i < 14; i++) px(r() * N, 41 + r() * 6, ['#f2d14b', '#e46a8b', '#ffffff', '#9f7be0'][i % 4]);
  } else if (id === 'lantern') {
    sky([40, 26, 20], [70, 46, 30]);
    for (let a = 0; a < 3; a++) { const x = 3 + a * 15; px(x, 10, '#2a1a12', 12, 30); for (let y = 0; y < 4; y++) px(x + y, 10 - y, '#2a1a12', 12 - y * 2, 1); px(x + 2, 14, '#140c08', 8, 26); }
    px(0, 40, '#5a3e2a', N, 8); for (let x = 0; x < N; x += 6) px(x, 40, '#4a3222', 1, 8);
    for (const x of [9, 24, 39]) { px(x - 3, 12, 'rgba(255,190,90,0.18)', 7, 9); px(x - 1, 14, '#ffcf6a', 3, 4); px(x, 12, '#3a2618', 1, 2); px(x - 1, 18, '#8a5a2a', 3, 1); }
  } else if (id === 'sky') {
    sky([120, 170, 235], [235, 225, 230]);
    for (let i = 0; i < 4; i++) { const cx = r() * 40, cy = 30 + r() * 14; px(cx, cy, '#ffffff', 12, 3); px(cx + 3, cy - 2, '#ffffff', 6, 2); }
    px(12, 26, '#6e5a44', 24, 4); px(15, 30, '#5a4834', 18, 3); px(19, 33, '#4a3a2a', 10, 3); px(22, 36, '#3e3024', 4, 3);
    for (let x = 13; x < 36; x += 2) px(x, 25, '#5c9a3c', 2, 2); for (let x = 16; x < 33; x += 3) px(x, 30 + r() * 4, '#4f8f33', 1, 4 + r() * 6);
    castle(17, 25, '#d9d4cc', 0.7); px(29, 9, '#8a2a3a', 1, 3);
  } else if (id === 'caves') {
    sky([10, 12, 20], [22, 20, 30]);
    for (let x = 0; x < N; x++) { const h = 8 + Math.sin(x * 0.4) * 3 + r() * 2; px(x, 0, '#2a2834', 1, h); const b = 40 + Math.sin(x * 0.3 + 1) * 3; px(x, b, '#2a2834', 1, N - b); }
    for (let i = 0; i < 6; i++) { const x = 3 + r() * 40, y = 34 + r() * 6, col = ['#4fe0e8', '#a66bff', '#7fffd4'][i % 3]; px(x - 2, y - 3, col === '#4fe0e8' ? 'rgba(79,224,232,0.18)' : 'rgba(166,107,255,0.18)', 5, 8); px(x, y - 4, col, 1, 6); px(x - 1, y - 1, col, 1, 3); px(x + 1, y - 2, col, 1, 4); }
    for (let i = 0; i < 5; i++) px(r() * N, 9 + r() * 4, '#3a3646', 1, 2 + r() * 4);
    px(18, 44, '#24304a', 14, 2); px(20, 43, '#2e3c5a', 10, 1);
  } else if (id === 'twilight') {
    sky([60, 40, 110], [250, 150, 90]); px(20, 26, '#ffd27a', 8, 4); px(21, 25, '#ffd27a', 6, 1);
    hills(30, '#2a2440', 1.5, 0.25, 0); for (let x = 0; x < N; x += 7) { px(x, 26, '#1e1a30', 5, 6); px(x + 1, 24, '#1e1a30', 3, 2); }
    px(0, 36, '#241e36', N, 12); for (let i = 0; i < 10; i++) px(r() * N, 28 + r() * 16, '#fff7a0');
  } else if (id === 'starfall') {
    sky([6, 10, 30], [30, 34, 70]); stars(40);
    for (let i = 0; i < 3; i++) { const x = 8 + i * 13 + r() * 5, y = 4 + r() * 8; for (let k = 0; k < 6; k++) px(x - k, y + k * 0.6, `rgba(255,255,255,${1 - k / 6})`); }
    px(36, 6, '#f3f0dc', 6, 6); px(38, 6, '#0a0f2a', 4, 4);
    hills(36, '#0e1226', 2, 0.15, 2); castle(6, 38, '#0b0e1e', 0.9); px(9, 30, '#ffd27a'); px(16, 32, '#ffd27a');
  } else if (id === 'waltz') {
    sky([150, 190, 230], [250, 220, 180]);
    px(14, 8, '#b8b0a2', 20, 40); for (let x = 14; x < 34; x += 3) px(x, 6, '#b8b0a2', 2, 2); for (let y = 10; y < 46; y += 3) for (let x = 14 + (y % 2) * 2; x < 34; x += 4) px(x, y, '#a69e90', 3, 1);
    px(21, 18, '#2a2030', 6, 8); px(22, 17, '#2a2030', 4, 1); px(23, 19, '#ffcf6a', 2, 5);
    for (const [x, col] of [[10, '#b03040'], [36, '#3050b0']]) { px(x, 10, '#5a4a3a', 1, 14); px(x + 1, 10, col, 4, 7); px(x + 1, 17, col, 2, 2); }
    for (let x = 14; x < 34; x += 2) px(x, 44 + (x % 3), '#4f8f33', 2, 4);
  } else if (id === 'rain') {
    sky([70, 90, 100], [120, 140, 140]);
    hills(30, '#3c5a44', 2, 0.2, 3); px(0, 38, '#2e4a34', N, 10); px(12, 42, '#5a7a86', 18, 2); px(14, 41, '#6a8a96', 14, 1);
    for (let i = 0; i < 60; i++) px(r() * N, r() * N, 'rgba(210,230,240,0.55)', 1, 3);
    for (let i = 0; i < 8; i++) px(r() * N, 37, '#5c8a4a', 2, 2);
  }
  // Scale up crisply.
  const big = document.createElement('canvas'); big.width = big.height = 240;
  const bg = big.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(c, 0, 0, 240, 240);
  return big.toDataURL();
}

// --- The player: plays the albums, Auto mode, ambience --------------------------------------------------------
// Tracks stream from <audio> elements (no big decode in memory) through the music bus. Two elements take turns so
// one can fade out while the next fades in; both are unlocked by the first tap or click (phones need that).
export class Music {
  constructor() {
    // 'auto', 'track' or 'off'. Phones start with the music off until the player turns it on there; sounds stay on.
    this.phone = PHONE;
    this.mode = PHONE ? (store.phoneMode || 'off') : (store.mode || 'auto');
    this.trackId = TRACKS.some(t => t.id === store.track) ? store.track : 'lantern';
    this.seed = (Date.now() & 0xffff) + 1;
    this.playing = null; this.started = false; this.restUntil = 0; this.began = 0;
    this.decks = []; this.cur = null;
    this.amb = {};
    this.covers = {};
  }
  coverOf(id) { return this.covers[id] || (this.covers[id] = cover(id)); }
  save() {
    // A phone keeps its own choice (phoneMode); a computer's stays in mode.
    const s = { ...store, track: this.trackId, vMusic: audio.vMusic, vSfx: audio.vSfx };
    if (this.phone) s.phoneMode = this.mode; else s.mode = this.mode;
    Object.assign(store, s);
    try { localStorage.setItem('skyforge.music', JSON.stringify(s)); } catch (e) { /* ignore */ }
  }
  start() {
    const ctx = audio.init(); if (!ctx) return;
    if (!this.decks.length) {
      for (let i = 0; i < 2; i++) {
        const el = new Audio(); el.preload = 'none'; el.crossOrigin = 'anonymous';
        const g = ctx.createGain(); g.gain.value = 0;
        try { ctx.createMediaElementSource(el).connect(g); } catch (e) { /* already wired */ }
        g.connect(audio.music);
        const deck = { el, g, id: null };
        el.addEventListener('ended', () => { if (this.cur === deck) this.ended(); });
        // Unlock it now, inside the tap or click (a silent, instantly paused play).
        el.muted = true; const p = el.play(); if (p && p.catch) p.catch(() => {}); el.pause(); el.muted = false;
        this.decks.push(deck);
      }
      preload();
    }
    this.started = true;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 250);
  }
  choose(mode, id) {
    this.mode = mode; if (id) this.trackId = id;
    this.save();
    this.fadeOut(1.5); this.restUntil = 0;
  }
  next() { this.seed++; this.fadeOut(1.5); this.restUntil = 0; this.skip = this.playing; }
  update(where) { this.where = where; }
  wanted() {
    if (this.mode === 'track') return this.trackId;
    const w = this.where || {};
    // Four albums: Lantern Halls below ground, Twilight Garden at dusk and up high, Rain on Moss at night, and
    // Old Stone Waltz or Lantern Halls by day.
    const pick = list => { const l = list.filter(id => id !== this.skip); return l[this.seed % l.length] || list[0]; };
    if (w.under) return pick(['lantern', 'rain']);
    if (w.dusk || w.high) return pick(['twilight', 'waltz']);
    if (w.night) return pick(['rain', 'twilight']);
    return pick(['waltz', 'lantern']);
  }
  fadeOut(secs) {
    const d = this.cur; if (!d) return;
    const ctx = audio.ctx, t = ctx.currentTime;
    d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(0, t + secs);
    const el = d.el; setTimeout(() => { if (this.cur !== d) el.pause(); }, secs * 1000 + 100);
    this.cur = null; this.playing = null;
  }
  play(id) {
    const T = TRACKS.find(t => t.id === id) || TRACKS[0];
    const d = this.decks.find(k => k !== this.cur) || this.decks[0];
    const ctx = audio.ctx, t = ctx.currentTime;
    this.fadeOut(3);
    d.el.loop = this.mode === 'track';
    if (d.id !== T.id) { d.el.src = T.src; d.id = T.id; } else d.el.currentTime = 0;
    d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(0, t); d.g.gain.linearRampToValueAtTime(1, t + 3);
    const p = d.el.play(); if (p && p.catch) p.catch(() => {});
    this.cur = d; this.playing = T.id; this.began = t; this.skip = null;
  }
  ended() {
    // A breath of quiet between pieces, like a walk without music.
    this.cur = null; this.playing = null; this.seed++;
    this.restUntil = audio.ctx.currentTime + 8 + Math.random() * 20;
  }
  tick() {
    const ctx = audio.ctx; if (!ctx) return;
    const now = ctx.currentTime;
    this.ambience();
    if (this.mode === 'off') { if (this.cur) this.fadeOut(2); return; }
    const want = this.wanted();
    if (this.cur) {
      this.cur.el.loop = this.mode === 'track';
      // A picked album plays at once; in Auto, a change of place lets the piece have its say first.
      const stale = this.mode === 'track' ? this.playing !== want : this.playing !== want && now - this.began > 25;
      if (stale) this.play(want);
      return;
    }
    if (now >= this.restUntil) this.play(want);
  }
  // --- Ambience under the music: crickets on summer nights, water dripping in caves ---
  ambience() {
    const w = this.where || {}, A = this.amb;
    const want = { crickets: !!(w.surface && w.night), drips: !!w.under };
    for (const [name, on] of Object.entries(want)) {
      if (on && !A[name]) A[name] = playBuffer(`sounds/sfx/${name}.mp3`, name === 'crickets' ? 0.35 : 0.5, { loop: true });
      else if (!on && A[name]) { A[name].stop(2.5); A[name] = null; }
    }
  }
}
