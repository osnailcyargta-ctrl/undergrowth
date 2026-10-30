// UNDERGROWTH - enemies. Each type moves with its own pattern:
// shambler = king (1 tile, 8 dirs), stalker = bishop (diagonal only),
// skitter = rook (orthogonal only, slow), wisp = drifts anywhere, over trees.

import { S, idx, inGrid, cheb } from './state.js';
import * as W from './world.js';
import * as V from './vfx.js';
import { damagePlayer, killEnemy, thornsHit } from './combat.js';
import { bossCells, dragonTurn } from './boss.js';
import { sleep, now, shuffle } from './util.js';

export const TYPES = {
  shambler: { name: 'Shambler', hp: 6,  atk: 2, exp: 2, pattern: 'king',   every: 1, aggro: 6 },
  stalker:  { name: 'Stalker',  hp: 5,  atk: 3, exp: 3, pattern: 'bishop', every: 1, aggro: 7 },
  skitter:  { name: 'Skitter',  hp: 9,  atk: 2, exp: 3, pattern: 'rook',   every: 2, aggro: 6 },
  wisp:     { name: 'Wisp',     hp: 4,  atk: 1, exp: 2, pattern: 'drift',  every: 1, aggro: 0 },
};

export function occupied(x, y) {
  const P = S.player;
  if (P && P.x === x && P.y === y) return true;
  if (S.enemies.some((e) => e.x === x && e.y === y)) return true;
  if (bossCells().some((c) => c[0] === x && c[1] === y)) return true;
  return false;
}

export function tileFreeFor(e, x, y) {
  if (!inGrid(x, y)) return false;
  if (!W.walkable(x, y, e.pattern === 'drift')) return false;
  if (occupied(x, y)) return false;
  return true;
}

export function makeEnemy(type, x, y) {
  const t = TYPES[type];
  const hp = t.hp + Math.floor(S.level * 0.7);
  return {
    type, name: t.name, x, y, px: x, py: y,
    maxHp: hp, hp,
    atk: t.atk + Math.floor(S.level * 0.35),
    exp: t.exp, pattern: t.pattern, every: t.every, aggro: t.aggro,
    cd: 1, flash: 0, anim: null,
  };
}

function trySpawn(type, minD, maxD) {
  const P = S.player;
  for (let tries = 0; tries < 40; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = minD + Math.random() * (maxD - minD);
    const x = Math.round(P.x + Math.cos(a) * d);
    const y = Math.round(P.y + Math.sin(a) * d);
    if (cheb(x, y, P.x, P.y) < minD) continue;
    if (S.visible[idx(x, y)]) continue;          // only in the fog
    if (!tileFreeFor({ pattern: 'king' }, x, y)) continue;
    S.enemies.push(makeEnemy(type, x, y));
    return true;
  }
  return false;
}

export function spawnInitial(n) {
  const pool = ['shambler', 'shambler', 'stalker'];
  for (let i = 0; i < n; i++) trySpawn(pool[i % pool.length], 5, 7);
}

export function spawnTick() {
  const target = Math.min(2 + Math.floor(S.level * 0.8), 8);
  if (S.enemies.length >= target || S.turn % 2 === 1) return;
  const pool = ['shambler', 'shambler'];
  if (S.level >= 2) pool.push('stalker', 'wisp');
  if (S.level >= 3) pool.push('skitter', 'stalker');
  trySpawn(pool[(Math.random() * pool.length) | 0], 5, 8);
}

function patternOffsets(e) {
  const K = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const O = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (e.pattern === 'bishop') return D;
  if (e.pattern === 'rook') return O;
  return K;
}

async function moveEnemy(e, nx, ny) {
  e.anim = { x0: e.px, y0: e.py, x1: nx, y1: ny, t0: now(), dur: 140 };
  await sleep(150);
  e.x = nx; e.y = ny;
  V.FX.move(e.px, e.py);
}

export async function enemyTurnsAll() {
  if (S.boss) await dragonTurn();
  if (S.over) return;
  const P = S.player;
  for (const e of [...S.enemies]) {
    if (S.over) return;
    if (e.hp <= 0) continue;
    if (--e.cd > 0) continue;
    e.cd = e.every;
    const d = cheb(e.x, e.y, P.x, P.y);
    const offs = patternOffsets(e);
    // attack when the player stands on a pattern-consistent adjacent tile
    const canHit = d <= 1 && offs.some(([ox, oy]) => P.x === e.x + ox && P.y === e.y + oy);
    if (canHit) {
      e.anim = { x0: e.px, y0: e.py, x1: P.px, y1: P.py, t0: now(), dur: 110 };
      await sleep(130);
      e.anim = { x0: e.px, y0: e.py, x1: e.x, y1: e.y, t0: now(), dur: 110 };
      damagePlayer(e.atk - P.def);
      thornsHit(e);
      await sleep(90);
      continue;
    }
    let moved = false;
    if (d <= e.aggro) {
      let best = null, bd = d;
      for (const [ox, oy] of shuffle(offs)) {
        const nx = e.x + ox, ny = e.y + oy;
        if (!tileFreeFor(e, nx, ny)) continue;
        const nd = cheb(nx, ny, P.x, P.y);
        if (nd < bd) { bd = nd; best = [nx, ny]; }
      }
      if (best) { await moveEnemy(e, best[0], best[1]); moved = true; }
    }
    if (!moved && Math.random() < (e.pattern === 'drift' ? 0.6 : 0.35)) {
      const [ox, oy] = offs[(Math.random() * offs.length) | 0];
      if (tileFreeFor(e, e.x + ox, e.y + oy)) await moveEnemy(e, e.x + ox, e.y + oy);
    }
  }
}
