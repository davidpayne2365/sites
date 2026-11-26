// Saves your progress in this browser: blocks you moved, where you are, the time of day, the quest, your fish.
// (Stored on this device only. Nothing is sent anywhere.)
import { NX, NY, NZ } from './world.js';
const KEY = 'skyforge-reef-save-v1';
export function loadSave() {
  try { const t = localStorage.getItem(KEY); if (!t) return null; const d = JSON.parse(t); return d && d.v === 1 ? d : null; } catch (_) { return null; }
}
export function writeSave(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (_) { return false; }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch (_) {} }
export function packEdits(map) { const out = []; for (const [i, id] of map) out.push(i, id); return out; }
export function applyEdits(world, flat) {
  const { ids, colTop } = world;
  for (let k = 0; k + 1 < flat.length; k += 2) {
    const i = flat[k], id = flat[k + 1]; if (i < 0 || i >= ids.length) continue;
    ids[i] = id; world.edits.set(i, id);
  }
  // recompute sunlight for every column that was touched
  const NXZ = NX * NZ, seen = new Set();
  for (let k = 0; k < flat.length; k += 2) { const c = flat[k] % NXZ; if (seen.has(c)) continue; seen.add(c); let y = NY - 1; const x = c % NX, z = (c / NX) | 0; while (y >= 0 && !world.isSolid(x, y, z)) y--; colTop[c] = y; }
  world.rebuildEmitters();
}
