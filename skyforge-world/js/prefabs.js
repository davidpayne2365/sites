// Pre-built things placed with ordinary blocks (players can break and build on them).
// `put(x, y, z, id)` places a block; `B` maps block names to ids.

// A small red car parked beside spawn, facing the city (-z).
export function buildStarterCar(put, B, x0 = 4, z0 = -1) {
  const W = B['Steering Wheel']; // the base id faces -z
  const rows = [
    // y = 0 (chassis + tires), rows front (z0) to back (z0 + 4), columns x0..x0+2
    [['Coal Block', 'Red Wool', 'Coal Block'], ['Red Wool', 'Red Wool', 'Red Wool'], ['Red Wool', 'Red Wool', 'Red Wool'],
      ['Red Wool', 'Red Wool', 'Red Wool'], ['Coal Block', 'Red Wool', 'Coal Block']],
    // y = 1 (headlights, steering wheel, seats)
    [['Mese Lamp', 'Red Wool', 'Mese Lamp'], ['Red Wool', 'WHEEL', 'Red Wool'], ['Red Wool', null, 'Red Wool'],
      ['Red Wool', 'White Wool', 'Red Wool'], ['Red Wool', 'Red Wool', 'Red Wool']],
    // y = 2 (windshield)
    [['Glass', 'Glass', 'Glass'], [null, null, null], [null, null, null], [null, null, null], [null, null, null]],
  ];
  rows.forEach((layer, y) => layer.forEach((row, dz) => row.forEach((name, dx) => {
    if (!name) return;
    put(x0 + dx, y, z0 + dz, name === 'WHEEL' ? W : B[name]);
  })));
}
