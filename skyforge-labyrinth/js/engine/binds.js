// Remappable controls. The game is written against the default keys and buttons; this layer turns whatever the
// player pressed into the default it stands for (so a remapped key behaves exactly like the original).
export const KEY_ACTIONS = [
  ['forward', 'Move forward', 'KeyW'], ['back', 'Move back', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'],
  ['jump', 'Jump / rise', 'Space'], ['down', 'Sink (flying, swimming)', 'KeyC'], ['use', 'Open / use', 'KeyE'],
  ['map', 'Map', 'KeyM'], ['minimap', 'Mini map on / off', 'Tab'], ['blocks', 'Blocks menu', 'KeyQ'], ['shop', 'Shop', 'KeyB'], ['music', 'Music', 'KeyN'], ['ride', 'Ride a mount', 'KeyF'], ['home', 'Back to the courtyard', 'KeyH'],
];
// Standard gamepad button indices.
export const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home'];
export const PAD_ACTIONS = [
  ['jump', 'Jump / open a chest', 0], ['map', 'Map', 1], ['ride', 'Ride a mount', 2], ['break', 'Break (hammer)', 7], ['place', 'Use', 6],
  ['prev', 'Hotbar: previous slot', 4], ['next', 'Hotbar: next slot', 5], ['shop', 'Shop (map: centre on you)', 3],
  ['split', 'Split screen layout', 8], ['pause', 'Pause', 9],
];
const SAVE = 'skyforge.binds';
export const binds = { keys: {}, pad: {} };
try { const s = JSON.parse(localStorage.getItem(SAVE) || '{}'); binds.keys = s.keys || {}; binds.pad = s.pad || {}; } catch (e) { /* defaults */ }
export const keyOf = a => binds.keys[a] ?? KEY_ACTIONS.find(k => k[0] === a)[2];
export const padOf = a => binds.pad[a] ?? PAD_ACTIONS.find(k => k[0] === a)[2];

let codeMap = new Map(), padMap = [];
function rebuild() {
  // Keyboard: physical code -> the default code it stands for (null: does nothing).
  codeMap = new Map();
  const used = new Set(KEY_ACTIONS.map(([a]) => keyOf(a)));
  for (const [a, , def] of KEY_ACTIONS) { const k = keyOf(a); if (k !== def) { codeMap.set(k, def); if (!used.has(def)) codeMap.set(def, null); } }
  // Controller: default index -> physical index.
  padMap = PAD_NAMES.map((_, i) => i);
  // (A button moved to an action stops doing its old one, since nothing reads it at its old place any more.)
  for (const [a, , def] of PAD_ACTIONS) { const p = padOf(a); if (p !== def) padMap[def] = p; }
  // A physical button that isn't any action's default but is now bound to one stops doing its default role.
  for (const [a] of PAD_ACTIONS) { const p = padOf(a); if (!PAD_ACTIONS.some(([, , d]) => d === p)) padMap[p] = -1; }
}
rebuild();
export function save() { try { localStorage.setItem(SAVE, JSON.stringify(binds)); } catch (e) { /* ignore */ } rebuild(); }
export function setKey(action, code) {
  const old = keyOf(action);
  for (const [a] of KEY_ACTIONS) if (a !== action && keyOf(a) === code) binds.keys[a] = old; // swap
  binds.keys[action] = code; save();
}
export function setPad(action, idx) {
  const old = padOf(action);
  for (const [a] of PAD_ACTIONS) if (a !== action && padOf(a) === idx) binds.pad[a] = old; // swap
  binds.pad[action] = idx; save();
}
export function resetBinds() { binds.keys = {}; binds.pad = {}; save(); }
// The default code a physical key stands for (undefined: unchanged).
export const mapCode = code => (codeMap.has(code) ? codeMap.get(code) : code);
// Pressed states in default button order, from a physical gamepad.
export const mapPad = raw => padMap.map(p => (p >= 0 ? !!raw[p] : false));
export const padIndex = i => (padMap[i] >= 0 ? padMap[i] : i);
export const keyLabel = code => ({ Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', AltRight: 'Right Alt',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Backquote: '`', Tab: 'Tab' }[code]
  || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num '));
