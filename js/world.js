// UNDERGROWTH - deterministic infinite-ish forest.
// tileAt() is a pure function of (x, y, seed, worldR): no storage, the world
// "expands" simply by growing worldR as the player levels up.
//
// Biomes: the map mixes the normal dark forest with JUNGLE patches - brighter
// green ground and very tall trees (a 1x2 sprite: branches below, a leaf
// canopy one tile above the trunk that fades when you stand under it).

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
             T_WALL_A = 6, T_WALL_B = 7, T_ALTAR = 8,
             T_JGRASS_A = 9, T_JGRASS_B = 10, T_JTREE = 11;

// ---------------- biome ----------------
// two octaves of chunky noise: small jungle groves (7-tile blocks) clustered
// into large woodland regions (13-tile blocks) - big enough that its beasts
// can spawn inside it
export function isJungle(x, y) {
  if (cheb(x, y, 0, 0) <= 3) return false;              // spawn clearing is always normal forest
  if (h2(Math.floor(x / 13), Math.floor(y / 13), 37) < 0.14) return true;
  return h2(Math.floor(x / 7), Math.floor(y / 7), 31) < 0.15;
}

export function tileAt(x, y) {
  if (!inGrid(x, y)) return T_WALL_A;
  const d = cheb(x, y, 0, 0);
  if (d > S.worldR) return h2(x, y, 21) < 0.5 ? T_WALL_A : T_WALL_B;
  if (S.altar && S.altar.x === x && S.altar.y === y) return T_ALTAR;
  const j = isJungle(x, y);
  if (j && h2(x, y, 3) < 0.155) return T_JTREE;         // tall jungle tree (trunk)
  if (!j && h2(x, y, 3) < 0.145) return h2(x, y, 5) < 0.5 ? T_TREE_A : T_TREE_B;
  if (h2(x, y, 7) < 0.022) return T_ROCK;
  if (j) return h2(x, y, 11) < 0.5 ? T_JGRASS_A : T_JGRASS_B;
  if (h2(x, y, 9) < 0.055) return T_GRASS_FL;
  return h2(x, y, 11) < 0.5 ? T_GRASS_A : T_GRASS_B;
}

export const isTree = (x, y) => { const t = tileAt(x, y); return t === T_TREE_A || t === T_TREE_B; };
export const isWall = (x, y) => { const t = tileAt(x, y); return t === T_WALL_A || t === T_WALL_B; };
// the tall jungle tree: solid trunk tile + a leaf canopy sprite one tile above
export const isJungleTree = (x, y) => tileAt(x, y) === T_JTREE;
export const isJungleGrass = (x, y) => { const t = tileAt(x, y); return t === T_JGRASS_A || t === T_JGRASS_B; };

// tiles that cast ambient occlusion on their neighbours
export function isSolidTile(t) { return t === T_TREE_A || t === T_TREE_B || t === T_ROCK || t === T_WALL_A || t === T_WALL_B || t === T_JTREE; }

// ---------------- camps ----------------
// A camp is a tent + a chest. The chest is interacted with exactly like the
// altar (walk onto it, get pushed back) and bursts into EXP.
export function campAt(x, y) {
  for (const c of S.camps) {
    if ((c.x === x && c.y === y) || (c.cx === x && c.cy === y)) return c;
  }
  return null;
}
export function chestAt(x, y) {
  for (const c of S.camps) if (c.cx === x && c.cy === y) return c;
  return null;
}

export function walkable(x, y, fly = false) {
  const t = tileAt(x, y);
  if (t === T_TREE_A || t === T_TREE_B || t === T_JTREE) return fly;  // wings glide over canopies
  if (t === T_ROCK || t === T_WALL_A || t === T_WALL_B) return false;
  for (const c of S.camps) if (c.x === x && c.y === y) return fly;    // tents are solid
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
  if (rng() < 0.65) placeCamp();
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
    if (campAt(x, y) || campAt(x - 1, y)) continue;
    S.altar = { x, y, used: false, active: false };
    blessAltar();
    return;
  }
  S.altar = { x: 6, y: 0, used: false, active: false }; // safe fallback
  blessAltar();
}

// the altar blesses 3 random tiles of the 3x3 around it: glowing ground that
// heals 1 HP per turn while you stand on it
function blessAltar() {
  const A = S.altar;
  const spots = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    .map(([ox, oy]) => ({ x: A.x + ox, y: A.y + oy }))
    .filter((p) => walkable(p.x, p.y));
  for (let i = spots.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  A.blessed = spots.slice(0, 3);
}

export function blessedAt(x, y) {
  const A = S.altar;
  if (!A || !A.blessed) return false;
  return A.blessed.some((p) => p.x === x && p.y === y);
}

// a camp: tent tile (solid) + chest tile right of it (interactable)
export function placeCamp() {
  for (let tries = 0; tries < 300; tries++) {
    const a = rng() * Math.PI * 2;
    const d = S.worldR * (0.4 + rng() * 0.5);
    const x = Math.round(Math.cos(a) * d), y = Math.round(Math.sin(a) * d);
    const cx = x + 1, cy = y;
    if (cheb(x, y, 0, 0) < 4 || cheb(x, y, 0, 0) > S.worldR - 1) continue;
    if (!walkable(x, y) || !walkable(cx, cy)) continue;
    if (S.altar && cheb(x, y, S.altar.x, S.altar.y) < 3) continue;
    if (chestAt(cx, cy) || S.altar && S.altar.blessed && S.altar.blessed.some(p => (p.x === cx && p.y === cy))) continue;
    if (S.motes.some(m => m.x === cx && m.y === cy)) continue;
    S.camps.push({ x, y, cx, cy, looted: false });
    return;
  }
}

// debug handle extras (window.UG) - handy for testing and tinkering
if (typeof window !== 'undefined' && window.UG) {
  window.UG.tile = tileAt;
  window.UG.jungle = isJungle;
}
