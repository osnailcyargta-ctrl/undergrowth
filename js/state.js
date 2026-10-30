// UNDERGROWTH - global mutable game state and shared constants.
// Grid coordinates are integers centered on spawn (0,0), range -48..48.

export const GRID = 97;
export const OFF = 48;

export const S = {
  started: false,
  over: false,
  busy: false,          // input locked while a turn resolves
  modalOpen: false,     // evolution popup open

  seed: (Math.random() * 1e9) | 0,
  level: 1,
  exp: 0,
  expNeed: 10,
  pendingEvo: 0,
  turn: 1,
  kills: 0,

  worldR: 8,            // playable radius, grows with level
  vision: 4,            // sight range in tiles (Chebyshev), grows with Eyes

  player: null,
  enemies: [],
  motes: [],            // { x, y, v } - exp orbs
  altar: null,          // { x, y, used, active }
  boss: null,
  pmov: [],             // the player's last move offsets - the enemy AI reads this

  explored: new Uint8Array(GRID * GRID),
  visible: new Uint8Array(GRID * GRID),

  countdown: -1,        // seconds left on the altar ritual, -1 = idle
  shake: 0,
  dmgFlash: 0,
  evoFlash: 0,
  time: 0,
};

export const idx = (x, y) => (y + OFF) * GRID + (x + OFF);

// console debug handle (window.UG) - handy for testing and tinkering
if (typeof window !== 'undefined') window.UG = S;
export const inGrid = (x, y) => x >= -OFF && x <= OFF && y >= -OFF && y <= OFF;
export const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
export const expNeedFor = (l) => Math.round(6 * Math.pow(l, 1.35) + 4);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
