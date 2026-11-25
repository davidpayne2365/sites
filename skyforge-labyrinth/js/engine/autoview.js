// Automatic view distance: watches the frame rate and grows the view while there's headroom, shrinks it when
// frames drop, aiming for a steady 60 fps. Waits for the world to finish loading before judging a new distance,
// and remembers a distance that proved too much (for longer each time) so it doesn't keep bouncing.
// Pure logic (fed a frame-rate sample every half second), so it can be tested on its own.
export function makeAutoView(steps, minIdx, maxIdx) {
  return { steps, minIdx, maxIdx, low: 0, high: 0, changedAt: -1e9, ceiling: Infinity, ceilUntil: 0, lastUp: -1e9, wait: {} };
}
// fps: frames per second over the last half second; loading: still streaming in what's in view; now: ms.
// Returns the step index to use.
export function stepAutoView(a, idx, fps, loading, now) {
  if (now > a.ceilUntil) a.ceiling = Infinity;
  a.low = fps < 50 ? a.low + 1 : 0;
  a.high = fps >= 57 && !loading ? a.high + 1 : 0;
  const settling = loading && now - a.changedAt < 10000; // a new distance gets 10 s to load before it's judged
  if (idx > a.minIdx && (a.low >= 3 && !settling || a.low >= 2 && fps < 35)) {
    // Too much: step down, and if we only just stepped up, don't try that again for two minutes.
    // (Each time the same distance proves too much, wait twice as long before trying it again.)
    if (now - a.lastUp < 25000) { a.wait[idx] = Math.min(1800000, (a.wait[idx] || 60000) * 2); a.ceiling = idx; a.ceilUntil = now + a.wait[idx]; }
    a.low = 0; a.high = 0; a.changedAt = now;
    return idx - 1;
  }
  if (idx < a.maxIdx && idx + 1 < a.ceiling && a.high >= 8) {
    a.high = 0; a.changedAt = now; a.lastUp = now;
    return idx + 1;
  }
  return idx;
}
