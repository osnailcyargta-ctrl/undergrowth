// UNDERGROWTH - combat helpers shared by enemies, boss and the turn engine.

import { S, expNeedFor, cheb, inGrid } from './state.js';
import { expandWorld, walkable } from './world.js';
import * as V from './vfx.js';
import * as UI from './ui.js';

export function enemyAt(x, y) {
  return S.enemies.find((e) => e.x === x && e.y === y);
}

export function awardExp(n) {
  const P = S.player;
  if (P.expBonus) n = Math.round(n * (1 + P.expBonus));
  S.exp += n;
  while (S.exp >= S.expNeed) {
    S.exp -= S.expNeed;
    S.level++;
    S.expNeed = expNeedFor(S.level);
    S.pendingEvo++;
    levelUpFx();
  }
}

function levelUpFx() {
  const P = S.player;
  P.hp = P.maxHp;               // full heal on evolve
  expandWorld();
  S.evoFlash = 1;
  V.FX.evo(P.px, P.py);
  UI.toast('Level up - choose your evolution');
  UI.updateHUD();
}

export function damagePlayer(dmg) {
  const P = S.player;
  if (S.over) return;
  if (P.evade > 0 && Math.random() * 100 < P.evade) {
    V.FX.wait(P.px, P.py);      // soft gray puff = dodge
    return;
  }
  const d = Math.max(1, Math.round(dmg));
  P.hp -= d;
  S.dmgFlash = 1;
  S.shake = Math.max(S.shake, 0.35);
  V.FX.hit(P.px, P.py, [1, 0.3, 0.2]);
  UI.updateHUD();
  if (P.hp <= 0) {
    if (P.phoenix && !P.phoenixUsed) {
      P.phoenixUsed = true;
      P.hp = Math.ceil(P.maxHp / 2);
      V.FX.evo(P.px, P.py);
      UI.toast('The ember burns. You rise.');
      UI.updateHUD();
    } else {
      P.hp = 0;
      S.over = true;
      UI.showGameOver();
    }
  }
}

export function dropMotes(x, y, n) {
  for (let i = 0; i < n; i++) {
    const spots = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
    for (const [ox, oy] of spots) {
      const nx = x + ox, ny = y + oy;
      if (inGrid(nx, ny) && walkable(nx, ny) && !S.motes.some((m) => m.x === nx && m.y === ny)) {
        S.motes.push({ x: nx, y: ny, v: 2 });
        break;
      }
    }
  }
}

export function killEnemy(e) {
  const i = S.enemies.indexOf(e);
  if (i >= 0) S.enemies.splice(i, 1);
  S.kills++;
  V.FX.death(e.px, e.py);
  dropMotes(e.x, e.y, e.exp >= 3 ? 2 : 1);
  awardExp(e.exp);
}

export function thornsHit(e) {
  const P = S.player;
  if (P.thorns <= 0) return;
  e.hp -= P.thorns;
  e.flash = 1;
  V.FX.hit(e.px, e.py, [0.7, 0.9, 0.4]);
  if (e.hp <= 0) killEnemy(e);
}
