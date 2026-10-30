// UNDERGROWTH - the boss. The Ancient Dragon: 2x2 body, queen movement
// pattern, up to 8 blocks per turn, breath attack at contact.
// Only ever summoned on purpose, by stepping onto the altar tile.

import { S, inGrid, cheb } from './state.js';
import * as W from './world.js';
import * as V from './vfx.js';
import * as UI from './ui.js';
import { awardExp, damagePlayer, dropMotes } from './combat.js';
import { sleep } from './util.js';

export function bossCells() {
  const b = S.boss;
  if (!b) return [];
  return [[b.ox, b.oy], [b.ox + 1, b.oy], [b.ox, b.oy + 1], [b.ox + 1, b.oy + 1]];
}

const bodyAt = (ox, oy) => [[ox, oy], [ox + 1, oy], [ox, oy + 1], [ox + 1, oy + 1]];

function cellsBlocked(ox, oy) {
  const P = S.player;
  for (const [cx, cy] of bodyAt(ox, oy)) {
    if (!inGrid(cx, cy)) return true;
    if (!W.walkable(cx, cy, false)) return true;
    if (P && P.x === cx && P.y === cy) return true;
    if (S.enemies.some((e) => e.x === cx && e.y === cy)) return true;
  }
  return false;
}

export function spawnDragon() {
  const A = S.altar;
  let spot = null;
  outer:
  for (let r = 0; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const ox = A.x + dx, oy = A.y + dy;
        if (!cellsBlocked(ox, oy)) {
          const cx = Math.round(ox + 1), cy = Math.round(oy + 1);
          if (cheb(cx, cy, S.player.x, S.player.y) >= 3) { spot = { ox, oy }; break outer; }
        }
      }
    }
  }
  if (!spot) spot = { ox: S.altar.x - 2, oy: S.altar.y - 2 };
  const hp = 55 + 12 * S.level;
  S.boss = {
    ox: spot.ox, oy: spot.oy,
    px: spot.ox + 1, py: spot.oy + 1,
    hp, maxHp: hp, atk: 7, flash: 0, anim: null,
  };
  S.shake = Math.max(S.shake, 0.9);
  V.FX.bossSpawn(spot.ox + 1, spot.oy + 1);
  UI.showBoss();
  UI.toast('THE DRAGON WAKES');
}

export async function dragonTurn() {
  const b = S.boss;
  const P = S.player;
  if (!b || S.over) return;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let best = null, bestD = cheb(Math.round(b.px), Math.round(b.py), P.x, P.y);
  for (const [dx, dy] of DIRS) {
    let k = 0;
    while (k < 8) {
      const nox = b.ox + dx * (k + 1), noy = b.oy + dy * (k + 1);
      if (cellsBlocked(nox, noy)) break;
      k++;
      const nd = cheb(Math.round(nox + 1), Math.round(noy + 1), P.x, P.y);
      if (nd < bestD) { bestD = nd; best = { dx, dy, k }; }
    }
  }
  if (best) {
    const x0 = b.px, y0 = b.py;
    b.ox += best.dx * best.k;
    b.oy += best.dy * best.k;
    b.anim = { x0, y0, x1: b.ox + 1, y1: b.oy + 1, t0: performance.now(), dur: 240 };
    S.shake = Math.max(S.shake, 0.22);
    await sleep(260);
  }
  if (S.over) return;
  // breath attack at contact
  const near = bossCells().some(([cx, cy]) => cheb(cx, cy, P.x, P.y) <= 1);
  if (near) {
    V.FX.breath(b.px, b.py, P.px, P.py);
    S.shake = Math.max(S.shake, 0.5);
    await sleep(140);
    damagePlayer(Math.max(2, b.atk - P.def));
    await sleep(120);
  }
}

export function damageDragon(dmg) {
  const b = S.boss;
  if (!b) return;
  b.hp -= dmg;
  b.flash = 1;
  V.FX.hit(b.px, b.py, [1, 0.5, 0.2]);
  UI.updateBoss();
  if (b.hp <= 0) {
    V.FX.bossDeath(b.px, b.py);
    S.shake = 1;
    S.kills++;
    awardExp(30);
    dropMotes(b.ox, b.oy, 6);
    b.hp = 0;
    S.boss = null;
    S.countdown = -1;
    UI.hideBoss();
    expandAfterBoss();
    UI.toast('The forest exhales.');
  }
}

function expandAfterBoss() {
  // the dead dragon's territory joins the world; a new altar rises somewhere else
  W.expandWorld();
  W.placeAltar();
}
