// UNDERGROWTH - turn engine.
// Player action (click a tile in reach, or click self to wait) -> animations
// -> exp/level/evolution popups -> every enemy takes its turn -> next turn.

import { S, inGrid, cheb } from './state.js';
import * as W from './world.js';
import * as V from './vfx.js';
import * as UI from './ui.js';
import { enemyAt, awardExp, killEnemy } from './combat.js';
import { enemyTurnsAll, spawnTick } from './enemies.js';
import { bossCells, damageDragon } from './boss.js';
import { sleep, now } from './util.js';

// every tile the player can legally click right now
export function legalTargets() {
  const P = S.player;
  const map = new Map();
  const put = (x, y, v) => map.set(x + ',' + y, v);

  const test = (x, y) => {
    if (!inGrid(x, y)) return null;
    const en = enemyAt(x, y);
    if (en) return { kind: 'attack', enemy: en, x, y };
    if (S.boss && bossCells().some(([cx, cy]) => cx === x && cy === y)) {
      return { kind: 'attack', dragon: true, x, y };
    }
    if (!W.walkable(x, y, P.fly)) return null;
    return { kind: 'move', x, y };
  };

  put(P.x, P.y, { kind: 'wait', x: P.x, y: P.y });

  const K = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const O = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const KN = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2]];

  for (const [ox, oy] of K) {
    const r = test(P.x + ox, P.y + oy);
    if (r) put(P.x + ox, P.y + oy, r);
  }
  if (P.reachStraight >= 2) {
    for (const [ox, oy] of O) {
      const mx = P.x + ox, my = P.y + oy;
      if (!inGrid(mx, my) || !W.walkable(mx, my, P.fly)) continue;
      const r = test(P.x + ox * P.reachStraight, P.y + oy * P.reachStraight);
      if (r) put(r.x, r.y, r);
    }
  }
  if (P.reachDiag >= 2) {
    for (const [ox, oy] of D) {
      const mx = P.x + ox, my = P.y + oy;
      if (!inGrid(mx, my) || !W.walkable(mx, my, P.fly)) continue;
      const r = test(P.x + ox * P.reachDiag, P.y + oy * P.reachDiag);
      if (r) put(r.x, r.y, r);
    }
  }
  if (P.knight) {
    for (const [ox, oy] of KN) {
      const r = test(P.x + ox, P.y + oy);
      if (r) put(r.x, r.y, r);
    }
  }
  return map;
}

export async function playerAct(x, y) {
  if (S.busy || S.over || !S.started || S.modalOpen) return;
  const P = S.player;
  const t = legalTargets().get(x + ',' + y);
  if (!t) return;
  S.busy = true;
  try {
    const prevX = P.x, prevY = P.y;
    if (t.kind === 'wait') {
      S.pmov.push({ x: 0, y: 0 }); // standing still is a pattern too
      if (S.pmov.length > 16) S.pmov.shift();
      V.FX.wait(P.px, P.py);
      await sleep(130);
    } else if (t.kind === 'attack') {
      await doAttack(t);
    } else {
      await doMove(t, prevX, prevY);
    }
    W.recomputeVision();
    UI.updateHUD();

    while (S.pendingEvo > 0 && !S.over) {
      S.pendingEvo--;
      await UI.showEvolution();
    }
    if (!S.over) {
      await enemyTurnsAll();
      W.recomputeVision();
      UI.updateHUD();
      spawnTick();
      while (S.pendingEvo > 0 && !S.over) {
        S.pendingEvo--;
        await UI.showEvolution();
      }
      S.turn++;
      if (P.regen && S.turn % 2 === 0 && P.hp < P.maxHp) {
        P.hp++;
        V.FX.pick(P.px, P.py);
      }
      UI.updateHUD();
    }
  } finally {
    S.busy = false;
  }
}

async function doMove(t, prevX, prevY) {
  const P = S.player;
  const A = S.altar;
  // walking INTO the altar tile is the deliberate boss trigger:
  // the player is pushed back to the previous tile, then the ritual starts
  if (A && !A.used && t.x === A.x && t.y === A.y) {
    P.anim = { x0: P.px, y0: P.py, x1: A.x, y1: A.y, t0: now(), dur: 130 };
    await sleep(150);
    P.anim = { x0: P.px, y0: P.py, x1: prevX, y1: prevY, t0: now(), dur: 180 };
    await sleep(200);
    P.x = prevX; P.y = prevY;
    A.used = true;
    S.countdown = 5.0;
    S.shake = Math.max(S.shake, 0.4);
    UI.toast('The altar flares. Something has noticed.');
    V.FX.ember(A.x, A.y);
    return;
  }
  // simple move: one tile, or a straight/diagonal/knight path
  const steps = [];
  if (Math.abs(t.x - P.x) > 1 || Math.abs(t.y - P.y) > 1) {
    // long step: interpolate through the intermediate tile
    const sx = Math.sign(t.x - P.x), sy = Math.sign(t.y - P.y);
    steps.push([P.x + sx, P.y + sy]);
  }
  steps.push([t.x, t.y]);
  // the enemy AI reads this memory to learn movement patterns
  S.pmov.push({ x: t.x - prevX, y: t.y - prevY });
  if (S.pmov.length > 16) S.pmov.shift();
  for (const [sx, sy] of steps) {
    P.anim = { x0: P.px, y0: P.py, x1: sx, y1: sy, t0: now(), dur: 130 };
    await sleep(145);
    P.x = sx; P.y = sy;
    const mi = S.motes.findIndex((m) => m.x === sx && m.y === sy);
    if (mi >= 0) {
      const m = S.motes[mi];
      S.motes.splice(mi, 1);
      awardExp(m.v);
      V.FX.pick(sx, sy);
    }
    if (P.fly) V.FX.leaves(sx, sy); else V.FX.move(sx, sy);
  }
  // Reaping Sweep: strike all 4-adjacent enemies after moving
  if (P.cleave) {
    for (const e of [...S.enemies]) {
      if (Math.abs(e.x - P.x) + Math.abs(e.y - P.y) === 1) {
        e.hp -= 1;
        e.flash = 1;
        V.FX.hit(e.px, e.py, [0.9, 0.9, 0.5]);
        if (e.hp <= 0) killEnemy(e);
      }
    }
    if (S.enemies.length) await sleep(120);
  }
}

async function doAttack(t) {
  const P = S.player;
  const tx = t.x, ty = t.y;
  // lunge toward the target and back
  P.anim = { x0: P.px, y0: P.py, x1: P.px + (tx - P.px) * 0.4, y1: P.py + (ty - P.py) * 0.4, t0: now(), dur: 90 };
  await sleep(100);
  P.anim = { x0: P.px, y0: P.py, x1: P.x, y1: P.y, t0: now(), dur: 110 };
  let dmg = P.atk;
  if (P.lastFury && P.hp < P.maxHp * 0.3) dmg *= 2;
  const crit = Math.random() * 100 < P.crit;
  if (crit) dmg *= 2;
  dmg = Math.max(1, Math.round(dmg));
  if (t.dragon) {
    damageDragon(dmg);
  } else {
    const e = t.enemy;
    e.hp -= dmg;
    e.flash = 1;
    V.FX.hit(e.px, e.py, crit ? [1, 0.9, 0.4] : [1, 0.4, 0.25]);
    if (e.hp <= 0) killEnemy(e);
  }
  UI.updateHUD();
  await sleep(150);
}
