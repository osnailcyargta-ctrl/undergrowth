// UNDERGROWTH - deterministic infinite-ish forest.
// tileAt() is a pure function of (x, y, seed, worldR): no storage, the world
// "expands" simply by growing worldR as the player levels up.

import { S, idx, inGrid, cheb, mulberry32 } from './state.js';

// deterministic per-tile hash -> [0,1)
export function h2(x, y, s) {
  let n = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 974711;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return (n >>> 0) / 4294967296;
}

// tile texture-array layers
export const T_GRASS_A = 0, T_GRASS_B = 1, T_GRASS_FL = 2,
             T_TREE_A = 3, T_TREE_B = 4, T_ROCK = 5,
             T_WALL_A = 6, T_WALL_B = 7, T_ALTAR = 8;

export function tileAt(x, y) {
  if (!inGrid(x, y)) return T_WALL_A;
  const d = cheb(x, y, 0, 0);
  if (d > S.worldR) return h2(x, y, 21) < 0.5 ? T_WALL_A : T_WALL_B;
  if (S.altar && S.altar.x === x && S.altar.y === y) return T_ALTAR;
  if (d <= 2) return h2(x, y, 11) < 0.5 ? T_GRASS_A : T_GRASS_B;   // spawn clearing
  if (h2(x, y, 3) < 0.145) return h2(x, y, 5) < 0.5 ? T_TREE_A : T_TREE_B;
  if (h2(x, y, 7) < 0.022) return T_ROCK;
  if (h2(x, y, 9) < 0.055) return T_GRASS_FL;
  return h2(x, y, 11) < 0.5 ? T_GRASS_A : T_GRASS_B;
}

export const isTree = (x, y) => { const t = tileAt(x, y); return t === T_TREE_A || t === T_TREE_B; };
export const isWall = (x, y) => { const t = tileAt(x, y); return t === T_WALL_A || t === T_WALL_B; };

export function walkable(x, y, fly = false) {
  const t = tileAt(x, y);
  if (t === T_TREE_A || t === T_TREE_B) return fly;  // wings glide over canopies
  if (t === T_ROCK || t === T_WALL_A || t === T_WALL_B) return false;
  return true;
}

// ---------------- fog of war (Chebyshev radius around the player) ----------------
export function recomputeVision() {
  const P = S.player;
  if (!P) return;
  S.visible.fill(0);
  const r = S.vision;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = P.x + dx, y = P.y + dy;
      if (!inGrid(x, y)) continue;
      const i = idx(x, y);
      S.visible[i] = 1;
      S.explored[i] = 1;
    }
  }
}

// ---------------- world growth ----------------
let rng = mulberry32(S.seed ^ 0x5f3759df);

export function expandWorld() {
  const oldR = S.worldR;
  S.worldR = Math.min(S.worldR + 2, 28);
  // sprinkle a few exp motes into the fresh ring
  for (let n = 0; n < 6; n++) {
    for (let tries = 0; tries < 24; tries++) {
      const a = rng() * Math.PI * 2;
      const d = oldR + rng() * (S.worldR - oldR);
      const x = Math.round(Math.cos(a) * d), y = Math.round(Math.sin(a) * d);
      if (walkable(x, y) && !S.motes.some(m => m.x === x && m.y === y)) {
        S.motes.push({ x, y, v: 2 });
        break;
      }
    }
  }
}

// one altar per map; a fresh one rises after the dragon falls
export function placeAltar() {
  for (let tries = 0; tries < 400; tries++) {
    const a = rng() * Math.PI * 2;
    const d = S.worldR * (0.55 + rng() * 0.35);
    const x = Math.round(Math.cos(a) * d), y = Math.round(Math.sin(a) * d);
    if (cheb(x, y, 0, 0) < 5 || cheb(x, y, 0, 0) > S.worldR - 1) continue;
    if (!walkable(x, y)) continue;
    if (S.enemies.some(e => e.x === x && e.y === y)) continue;
    if (S.altar && S.altar.x === x && S.altar.y === y) continue;
    S.altar = { x, y, used: false, active: false };
    return;
  }
  S.altar = { x: 6, y: 0, used: false, active: false }; // safe fallback
}
