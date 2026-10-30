// UNDERGROWTH - UI: HUD, toasts, evolution cards, boss bar, edge indicators.

import { S, cheb } from './state.js';
import { buildChoices, applyUpgrade } from './upgrades.js';
import { iconCanvas } from './spritegen.js';
import { CAM, worldToScreen, isFollowing } from './camera.js';

const el = {};
let booted = false;

export function initUI() {
  const $ = (id) => document.getElementById(id);
  Object.assign(el, {
    hud: $('hud'), hint: $('hint'),
    hpfill: $('hpfill'), hptext: $('hptext'),
    expfill: $('expfill'), exptext: $('exptext'),
    sight: $('sight'), turn: $('turn'), atk: $('atk'),
    zoominfo: $('zoominfo'), toasts: $('toasts'),
    bossbar: $('bossbar'), bossfill: $('bossfill'),
    countdown: $('countdown'), arrow: $('arrow'), glint: $('glint'),
    evolve: $('evolve'), cards: $('evolve-cards'),
    intro: $('intro'), gameover: $('gameover'), goStats: $('go-stats'),
  });
  document.getElementById('intro-start').addEventListener('click', start);
  document.getElementById('go-restart').addEventListener('click', () => location.reload());
  booted = true;
}

function start() {
  S.started = true;
  el.intro.hidden = true;
  el.hud.hidden = false;
  el.hint.hidden = false;
  toast('Click a tile beside you to move.');
  setTimeout(() => { if (el.hint) el.hint.style.opacity = '0.35'; }, 7000);
  updateHUD();
}

export function toast(txt) {
  if (!booted) return;
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = txt;
  el.toasts.appendChild(d);
  setTimeout(() => d.remove(), 3400);
}

export function updateHUD() {
  const P = S.player;
  if (!P || !booted) return;
  el.hpfill.style.width = (100 * Math.max(0, P.hp) / P.maxHp) + '%';
  el.hptext.textContent = `${Math.max(0, Math.round(P.hp))} / ${Math.round(P.maxHp)}`;
  el.expfill.style.width = (100 * S.exp / S.expNeed) + '%';
  el.exptext.textContent = `LV ${S.level}`;
  el.sight.textContent = `SIGHT ${S.vision}`;
  el.turn.textContent = `TURN ${S.turn}`;
  el.atk.textContent = `ATK ${P.atk % 1 ? P.atk.toFixed(1) : P.atk}`;
  el.zoominfo.textContent = `ZOOM ${CAM.z % 1 ? CAM.z.toFixed(1) : CAM.z} / ${S.vision}`;
}

export function showGameOver() {
  el.hint.hidden = true;
  el.goStats.textContent = `LEVEL ${S.level} - TURN ${S.turn} - KILLS ${S.kills}`;
  el.gameover.hidden = false;
}

export function updateCountdown(n) { el.countdown.hidden = false; el.countdown.textContent = n; }
export function hideCountdown() { el.countdown.hidden = true; }
export function showBoss() { el.bossbar.hidden = false; updateBoss(); }
export function updateBoss() {
  if (S.boss) el.bossfill.style.width = (100 * Math.max(0, S.boss.hp) / S.boss.maxHp) + '%';
}
export function hideBoss() { el.bossbar.hidden = true; }

// roguelike card popup; resolves with the chosen upgrade applied
export function showEvolution() {
  return new Promise((resolve) => {
    S.modalOpen = true;
    el.evolve.hidden = false;
    el.cards.innerHTML = '';
    const P = S.player;
    for (const def of buildChoices()) {
      const card = document.createElement('div');
      card.className = 'card';
      const kind = document.createElement('div');
      kind.className = 'card-kind';
      kind.textContent = def.unique ? 'unique upgrade' : (def.header || def.part + ' upgrade');
      const icon = document.createElement('div');
      icon.className = 'card-icon';
      icon.appendChild(iconCanvas(def));
      const name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = def.name;
      const desc = document.createElement('div');
      desc.className = 'card-desc';
      desc.style.whiteSpace = 'pre-line';
      desc.textContent = def.desc.join('\n');
      card.append(kind, icon, name, desc);
      if (def.unique) {
        const lvl = document.createElement('div');
        lvl.className = 'card-lvl';
        const owned = P.owned[def.id] || 0;
        lvl.textContent = def.cap === 1 ? 'SINGLE' : (def.cap === Infinity ? 'INFINITE' : `LEVEL ${owned} / ${def.cap}`);
        card.appendChild(lvl);
      }
      card.addEventListener('click', () => {
        applyUpgrade(def);
        el.evolve.hidden = true;
        S.modalOpen = false;
        updateHUD();
        resolve();
      });
      el.cards.appendChild(card);
    }
  });
}

// per-frame DOM overlays: off-screen player arrow + Owl Gaze altar glint
export function updateOverlays() {
  const P = S.player;
  if (!P || !booted) return;
  const W = innerWidth, H = innerHeight;
  const scr = worldToScreen(P.px, P.py);
  const off = scr.x < 8 || scr.x > W - 8 || scr.y < 8 || scr.y > H - 8;
  if (off && S.started && !S.over && !S.modalOpen && !isFollowing()) {
    el.arrow.hidden = false;
    const m = 30;
    const x = Math.max(m, Math.min(W - m, scr.x));
    const y = Math.max(m, Math.min(H - m, scr.y));
    el.arrow.style.left = (x - 7) + 'px';
    el.arrow.style.top = (y - 6) + 'px';
    const ang = Math.atan2(scr.y - H / 2, scr.x - W / 2) * 180 / Math.PI + 90;
    el.arrow.style.transform = `rotate(${ang}deg)`;
  } else {
    el.arrow.hidden = true;
  }
  const A = S.altar;
  if (P.owl && A && !A.used && !S.boss && cheb(P.x, P.y, A.x, A.y) > S.vision && S.started && !S.over) {
    const a = worldToScreen(A.x, A.y);
    if (a.x < 8 || a.x > W - 8 || a.y < 8 || a.y > H - 8) {
      const m = 36;
      el.glint.hidden = false;
      el.glint.style.left = (Math.max(m, Math.min(W - m, a.x)) - 5) + 'px';
      el.glint.style.top = (Math.max(m, Math.min(H - m, a.y)) - 5) + 'px';
    } else el.glint.hidden = true;
  } else {
    el.glint.hidden = true;
  }
}
