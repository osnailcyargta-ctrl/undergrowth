// UNDERGROWTH - the boss. The Ancient Dragon: 2x2 body, queen movement
// pattern, up to 8 blocks per move, breath attack at contact.
// It PHASES through trees, rocks and walls - only the edge of the world and
// living bodies can stop it. Only ever summoned on purpose, by stepping onto
// the altar tile.
//
// Nerfed by the forest's own law: it only moves EVERY OTHER TURN, and while
// it lives every other enemy is frozen. When it dies it SHATTERS into five
// bone pieces that tumble across the ground before fading.

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
    if (!inGrid(cx, cy)) return true;   // terrain means nothing to it; the void does
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
    hp, maxHp: hp, atk: 7 + Math.floor(S.level * 0.4), flash: 0, anim: null,
    cd: 2,          // moves every 2nd turn
    active: false,
  };
  S.shake = Math.max(S.shake, 0.9);
  V.FX.bossSpawn(spot.ox + 1, spot.oy + 1);
  UI.showBoss();
  UI.toast('THE DRAGON WAKES');
}

export async function dragonTurn() {
  const b = S.boss;
  const P = S.player;
  if (!b || S.over || S.bossDying) return;

  // breathes and moves only on its active turn (every other turn)
  b.cd = (b.cd || 2) - 1;
  b.active = b.cd <= 0;
  if (b.active) b.cd = 2;
  else return;       // coiled up: it does nothing this turn

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
  if (!b || S.bossDying) return;
  b.hp -= dmg;
  b.flash = 1;
  V.FX.hit(b.px, b.py, [1, 0.5, 0.2]);
  UI.updateBoss();
  if (b.hp <= 0) {
    b.hp = 0;
    S.kills++;
    awardExp(30);          // exp flows immediately; the shatter plays out below
    UI.hideBoss();
    S.shake = 1.1;
    S.evoFlash = 1;
    V.FX.bossDeath(b.px, b.py);
    shatterDragon(b);
  }
}

// ---------------- the shatter: dragon breaks into 5 bone pieces ----------------
// The pieces fly outward with spin and gravity, skid, glow, then fade. When
// the last one is gone the dragon is truly dead and the world expands.

const BONE_DEFS = [
  { i: 0, ox: 0.0, oy: 0.9, size: 1.05 },  // skull
  { i: 1, ox: -0.9, oy: 0.1, size: 0.95 }, // rib
  { i: 2, ox: 0.1, oy: -0.2, size: 0.8 },  // vertebra
  { i: 3, ox: 0.9, oy: 0.3, size: 1.0 },   // wing bone
  { i: 4, ox: -0.2, oy: -0.9, size: 0.75 },// claw
];

function shatterDragon(b) {
  const cx = b.px, cy = b.py;
  S.bossDying = {
    t: 0, cx, cy,
    bones: BONE_DEFS.map(({ i, ox, oy, size }) => {
      const a = Math.atan2(oy, ox) + (Math.random() - 0.5) * 0.9;
      const sp = 1.6 + Math.random() * 1.6;
      return {
        kind: i,
        x: cx + ox, y: cy + oy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 + 0.9,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 7,
        size, a: 1,
      };
    }),
  };
  S.boss = null;           // gameplay-wise the dragon is gone the moment it breaks
  S.countdown = -1;
  dieTick();
}

async function dieTick() {
  const D = S.bossDying;
  for (let step = 0; step < 18 && S.bossDying === D; step++) {
    await sleep(80);
    if (S.bossDying !== D) return;
    const dt = 0.08;
    for (const bn of D.bones) {
      bn.x += bn.vx * dt;
      bn.y += bn.vy * dt;
      bn.vx -= bn.vx * 2.6 * dt;
      bn.vy -= bn.vy * 2.6 * dt + 2.8 * dt;
      bn.rot += bn.vr * dt;
      bn.vr -= bn.vr * 1.8 * dt;
    }
    D.t += dt;
    if (step === 4) V.FX.bossDeathRing(D.cx, D.cy);
    if (step % 3 === 1) V.FX.ember(D.cx + (Math.random() - 0.5) * 2, D.cy + (Math.random() - 0.5) * 2);
    if (D.t > 1.1) for (const bn of D.bones) bn.a = Math.max(0, bn.a - 0.09);
  }
  if (S.bossDying !== D) return;
  dropMotes(Math.round(D.cx), Math.round(D.cy), 6);
  S.bossDying = null;
  expandAfterBoss();
  UI.toast('The forest exhales.');
}

function expandAfterBoss() {
  // the dead dragon's territory joins the world; a new altar rises somewhere else
  W.expandWorld();
  W.placeAltar();
}
