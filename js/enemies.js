// UNDERGROWTH - enemies + the enemy AI. Every decision below is hand-written
// for this game from first principles (greedy scoring, BFS pathfinding, a tiny
// pattern reader) - no external AI, no copied code.
//
// Chess-style movement patterns:
//   shambler = king (1 tile, 8 dirs), stalker = bishop (diagonals),
//   skitter = rook (orthogonals), wisp = drifts anywhere, over trees.
//
// Evolution, driven by the player's level:
//   every 3 level ups  -> evolution tier: +HP / +ATK and a smarter brain
//                         (tier 1 reads your movement pattern, tier 2 plans
//                         with BFS pathfinding, tier 3 intercepts where you
//                         are GOING instead of where you are)
//   every 10 level ups -> major form, the forest's chess nightmare:
//                         stalker grows wings and gains knight jumps,
//                         skitter hardens into a rook tower (and gains knight
//                         jumps at the second major), everyone gets stronger.

import { S, idx, inGrid, cheb } from './state.js';
import * as W from './world.js';
import * as V from './vfx.js';
import * as UI from './ui.js';
import { damagePlayer, killEnemy, thornsHit } from './combat.js';
import { bossCells, dragonTurn } from './boss.js';
import { sleep, now, shuffle } from './util.js';

export const TYPES = {
  shambler: { name: 'Shambler', hp: 6,  atk: 2, exp: 2, pattern: 'king',   every: 1, aggro: 6 },
  stalker:  { name: 'Stalker',  hp: 5,  atk: 3, exp: 3, pattern: 'bishop', every: 1, aggro: 7 },
  skitter:  { name: 'Skitter',  hp: 9,  atk: 2, exp: 3, pattern: 'rook',   every: 2, aggro: 6 },
  wisp:     { name: 'Wisp',     hp: 4,  atk: 1, exp: 2, pattern: 'drift',  every: 1, aggro: 0 },
};

// ---------------- evolution tiers & major forms ----------------
export const tierFor = (level) => Math.floor(level / 3);
export const majorFor = (level) => Math.floor(level / 10);

// stalker: winged form at major 1; skitter: rook tower at major 1;
// knight jumps: stalker at major 1, skitter at major 2.
export function formOf(type, major) {
  if (type === 'stalker') return major >= 1 ? 'winged' : 'base';
  if (type === 'skitter') return major >= 1 ? 'rook' : 'base';
  return 'base';
}
function knightOf(type, major) {
  if (type === 'stalker') return major >= 1;
  if (type === 'skitter') return major >= 2;
  return false;
}

export function statBlock(type, tier, major, level = 0) {
  const t = TYPES[type];
  const hp = Math.round(t.hp * (1 + 0.30 * tier)) + 2 * tier + 4 * major + Math.floor(level * 0.5);
  const atk = Math.round(t.atk * (1 + 0.22 * tier)) + major + Math.floor(level * 0.25);
  return { hp, atk };
}

export function makeEnemy(type, x, y) {
  const t = TYPES[type];
  const tier = tierFor(S.level), major = majorFor(S.level);
  const st = statBlock(type, tier, major, S.level);
  return {
    type, name: t.name, x, y, px: x, py: y,
    maxHp: st.hp, hp: st.hp, atk: st.atk,
    exp: t.exp, pattern: t.pattern, every: t.every, aggro: t.aggro,
    tier, major, form: formOf(type, major), knight: knightOf(type, major),
    cd: 1, flash: 0, anim: null,
  };
}

// sandbox clone used by the hidden dev bench: same stats, no game state
export function simEnemy(type, tier, major) {
  const t = TYPES[type];
  const st = statBlock(type, tier, major, 0);
  return {
    type, name: t.name, x: 0, y: 0, px: 0, py: 0,
    maxHp: st.hp, hp: st.hp, atk: st.atk,
    exp: t.exp, pattern: t.pattern, every: t.every, aggro: t.aggro,
    tier, major, form: formOf(type, major), knight: knightOf(type, major),
    cd: 1, flash: 0, anim: null,
  };
}

// living enemies evolve when the player levels up (called on every level up)
export function evolveEnemies() {
  if (!S.enemies.length) return;
  const tier = tierFor(S.level), major = majorFor(S.level);
  let anyTier = false, anyMajor = false;
  for (const e of S.enemies) {
    if (tier > (e.tier || 0)) {
      e.tier = tier;
      e.maxHp += 2 + tier;
      e.hp = Math.min(e.maxHp, e.hp + 2 + tier);
      e.atk += 1;
      e.flash = 1;
      V.FX.evo(e.px, e.py);
      anyTier = true;
    } else {
      // every single level up nudges living enemies a little stronger too
      e.maxHp += 1;
      e.hp = Math.min(e.maxHp, e.hp + 1);
    }
    if (major > (e.major || 0)) {
      e.major = major;
      e.maxHp += 4;
      e.hp = Math.min(e.maxHp, e.hp + 4);
      e.atk += 1;
      e.form = formOf(e.type, e.major);
      if (knightOf(e.type, e.major) && !e.knight) e.knight = true;
      e.flash = 1;
      V.FX.evo(e.px, e.py);
      anyMajor = true;
    }
  }
  if (anyMajor) UI.toast('The forest adapts - enemies take new forms');
  else if (anyTier) UI.toast('The undergrowth evolves - enemies grow cunning');
}

// ---------------- spawning ----------------
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
  const target = Math.min(2 + Math.floor(S.level * 0.8), 9);
  if (S.enemies.length >= target || S.turn % 2 === 1) return;
  const pool = ['shambler', 'shambler'];
  if (S.level >= 2) pool.push('stalker', 'wisp');
  if (S.level >= 3) pool.push('skitter', 'stalker');
  if (S.level >= 10) pool.push('stalker', 'skitter'); // majors enter the mix
  trySpawn(pool[(Math.random() * pool.length) | 0], 5, 8);
}

// ---------------- the AI (from scratch) ----------------
// move offsets for one step of a pattern; knight jumps are extra offsets
const K  = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const D4 = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const O4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const KN = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2]];

export function patternOffsets(e) {
  const base = e.pattern === 'bishop' ? D4 : e.pattern === 'rook' ? O4 : K;
  return e.knight ? base.concat(KN) : base;
}

// Pattern reader: watches the player's last moves (S.pmov) and predicts the
// tile they are moving toward next. Detects exact cycles (period 1..4) and
// otherwise falls back to the most frequent recent move.
export function predictPlayerTile(P, mem = S.pmov) {
  const m = mem || [];
  const n = m.length;
  if (!P || n < 3) return null;
  for (let p = 1; p <= 4 && p * 2 <= n; p++) {
    let ok = true;
    for (let i = n - 1; i >= n - p; i--) {
      if (m[i].x !== m[i - p].x || m[i].y !== m[i - p].y) { ok = false; break; }
    }
    if (ok) {
      return { x: P.x + m[n - 1].x, y: P.y + m[n - 1].y, conf: 2, why: 'cycle' };
    }
  }
  const recent = m.slice(-8);
  const counts = new Map();
  for (const o of recent) {
    const k = o.x + ',' + o.y;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let best = null, bc = 1;
  for (const [k, c] of counts) if (c > bc) { bc = c; best = k; }
  if (!best) return null;
  const parts = best.split(',');
  return { x: P.x + +parts[0], y: P.y + +parts[1], conf: 1, why: 'habit' };
}

// BFS pathfinding over pattern-consistent steps. Returns the first step of
// the shortest path toward (tx, ty); if the target is unreachable (bishop
// parity, walls) it returns a step toward the closest reachable cell.
export function bfsStep(e, tx, ty, walkFn, occFn, maxDepth = 14) {
  const offs = patternOffsets(e);
  const start = { x: e.x, y: e.y };
  const prev = new Map();
  prev.set(start.x + ',' + start.y, null);
  let frontier = [start];
  let best = start, bestScore = Infinity, reached = false;
  for (let depth = 0; depth < maxDepth && frontier.length && !reached; depth++) {
    const next = [];
    for (const c of frontier) {
      const d = cheb(c.x, c.y, tx, ty);
      const score = d * 100 + depth;
      if (score < bestScore) { bestScore = score; best = c; }
      if (d === 0) { reached = true; break; }
      for (const [ox, oy] of offs) {
        const nx = c.x + ox, ny = c.y + oy;
        const k = nx + ',' + ny;
        if (prev.has(k)) continue;
        if (!walkFn(nx, ny) || occFn(nx, ny)) continue;
        prev.set(k, c);
        next.push({ x: nx, y: ny });
      }
    }
    frontier = next;
  }
  if (best === start) return null;
  let cur = best;
  while (prev.get(cur.x + ',' + cur.y) !== start && prev.get(cur.x + ',' + cur.y)) {
    cur = prev.get(cur.x + ',' + cur.y);
  }
  return { x: cur.x, y: cur.y };
}

// greedy one-step scoring; smarter enemies also weigh the predicted tile
function greedyStep(e, walkFn, occFn, P, pred, wPred) {
  let best = null, bs = Infinity;
  for (const [ox, oy] of shuffle(patternOffsets(e))) {
    const nx = e.x + ox, ny = e.y + oy;
    if (!walkFn(nx, ny) || occFn(nx, ny)) continue;
    let s = cheb(nx, ny, P.x, P.y);
    if (pred) s += cheb(nx, ny, pred.x, pred.y) * wPred;
    if (s < bs) { bs = s; best = { x: nx, y: ny }; }
  }
  return best;
}

// THE decision function. Used by the live game AND the AI Lab sandbox, so
// what you test there is exactly what hunts you in the run.
//   env = { walk(x,y), occ(x,y), predict() -> {x,y,conf} | null }
// returns { kind: 'attack' } | { kind: 'move', x, y } | { kind: 'stay' }
export function chooseEnemyMove(e, P, env) {
  const offs = patternOffsets(e);
  // 1) attack when the player stands on a reachable attack tile
  if (offs.some(([ox, oy]) => P.x === e.x + ox && P.y === e.y + oy)) {
    return { kind: 'attack' };
  }
  const d = cheb(e.x, e.y, P.x, P.y);
  // 2) deliberate hunt while the player is inside aggro range
  if (d <= e.aggro) {
    const iq = Math.min(e.tier || 0, 3);
    const pred = iq >= 1 && env.predict ? env.predict() : null;
    if (iq >= 2) {
      // plan with pathfinding: tier 3 charges where you are GOING
      const target = (iq >= 3 && pred) ? pred : P;
      const step = bfsStep(e, target.x, target.y, env.walk, env.occ);
      if (step) return { kind: 'move', x: step.x, y: step.y, plan: 'bfs' };
    }
    const step = greedyStep(e, env.walk, env.occ, P, pred, 0.6 + 0.2 * iq);
    if (step) return { kind: 'move', x: step.x, y: step.y, plan: pred ? 'intercept' : 'chase' };
  }
  // 3) idle wander
  if (Math.random() < (e.pattern === 'drift' ? 0.6 : 0.35)) {
    const [ox, oy] = offs[(Math.random() * offs.length) | 0];
    if (env.walk(e.x + ox, e.y + oy) && !env.occ(e.x + ox, e.y + oy)) {
      return { kind: 'move', x: e.x + ox, y: e.y + oy, plan: 'wander' };
    }
  }
  return { kind: 'stay' };
}

// ---------------- executing turns ----------------
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
    const env = {
      walk: (x, y) => W.walkable(x, y, e.pattern === 'drift'),
      occ: (x, y) => occupied(x, y),
      predict: () => predictPlayerTile(P),
    };
    const mv = chooseEnemyMove(e, P, env);
    if (mv.kind === 'attack') {
      e.anim = { x0: e.px, y0: e.py, x1: P.px, y1: P.py, t0: now(), dur: 110 };
      await sleep(130);
      e.anim = { x0: e.px, y0: e.py, x1: e.x, y1: e.y, t0: now(), dur: 110 };
      damagePlayer(e.atk - P.def);
      thornsHit(e);
      await sleep(90);
    } else if (mv.kind === 'move') {
      await moveEnemy(e, mv.x, mv.y);
    }
  }
}
