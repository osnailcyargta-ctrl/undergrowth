// UNDERGROWTH - the AI Lab. Press CTRL+ALT+M on the main menu.
// A sandbox that runs the game's OWN enemy AI - the exact same hand-written
// functions that hunt you in a run (chooseEnemyMove / predictPlayerTile /
// bfsStep, all written from scratch for this game). Nothing here calls any
// external AI: it is pure local simulation for testing and tinkering.

import { S } from './state.js';
import { chooseEnemyMove, predictPlayerTile, simEnemy, TYPES, tierFor } from './enemies.js';
import { enemyCanvas } from './spritegen.js';
import * as UI from './ui.js';

const N = 17;            // sandbox grid (N x N)
const CENTER = 8;        // player start
const CELL = 14;         // canvas px per cell

let open = false, built = false;
let grid = null;         // 0 = grass, 1 = tree, 2 = rock
let simP = null;         // { x, y } - the scripted player
let enemy = null;        // simEnemy instance
let mem = [];            // the player's move memory (read by the AI)
let step = 0;
let caught = 0;
let running = false;

const el = {};
const IQ_LABEL = ['greedy chase', 'pattern reading', 'BFS pathfinding', 'BFS + interception'];
const PATTERNS = [
  ['loop', 'Loop'],
  ['random', 'Random'],
  ['kite', 'Kite'],
  ['still', 'Stand still'],
];

function $(id) { return document.getElementById(id); }

function build() {
  built = true;
  const typeSel = $('ai-type');
  typeSel.innerHTML = Object.keys(TYPES)
    .map((t) => `<option value="${t}">${TYPES[t].name}</option>`).join('');
  $('ai-tier').innerHTML = [0, 1, 2, 3, 4].map((t) => `<option value="${t}">Tier ${t}</option>`).join('');
  $('ai-major').innerHTML = [0, 1, 2].map((m) => `<option value="${m}">Major ${m}</option>`).join('');
  $('ai-pat').innerHTML = PATTERNS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

  $('ai-close').addEventListener('click', hide);
  $('ai-reset').addEventListener('click', reset);
  $('ai-step').addEventListener('click', () => doStep());
  $('ai-run').addEventListener('click', run20);
  $('ai-bench').addEventListener('click', bench);
  for (const id of ['ai-type', 'ai-tier', 'ai-major', 'ai-pat']) {
    $(id).addEventListener('change', reset);
  }
  reset();
}

// ---------------- sandbox world ----------------
function reset() {
  if (!built) return;
  const rnd = mulberry((S.seed ^ 0x51ab3f) + Date.now() % 100000);
  grid = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const r = rnd();
      grid[y * N + x] = r < 0.15 ? 1 : r < 0.18 ? 2 : 0;
    }
  }
  // keep the center clearing and a spawn ring open
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.max(Math.abs(x - CENTER), Math.abs(y - CENTER));
      if (d <= 1 || d === 8) grid[y * N + x] = 0;
    }
  }
  simP = { x: CENTER, y: CENTER };
  mem = [];
  step = 0;
  caught = 0;
  running = false;
  spawnEnemy();
  log(`Sandbox ready - ${enemyName()} vs ${$('ai-pat').value} player. The AI below is the real game AI.`);
  draw();
}

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spawnEnemy() {
  const type = $('ai-type').value;
  const tier = +$('ai-tier').value;
  const major = +$('ai-major').value;
  enemy = simEnemy(type, tier, major);
  const ring = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (Math.max(Math.abs(x - CENTER), Math.abs(y - CENTER)) === 8) ring.push([x, y]);
    }
  }
  const [sx, sy] = ring[(Math.random() * ring.length) | 0];
  enemy.x = sx; enemy.y = sy; enemy.px = sx; enemy.py = sy;
}

const enemyName = () => `${TYPES[enemy.type].name}${enemy.form === 'winged' ? ' (winged)' : enemy.form === 'rook' ? ' (rook)' : ''}`;

// ---------------- scripted player patterns ----------------
const LOOP = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function playerStep() {
  const pat = $('ai-pat').value;
  const free = (x, y) => x >= 0 && x < N && y >= 0 && y < N && grid[y * N + x] === 0;
  let off = null;
  if (pat === 'still') {
    off = [0, 0];
  } else if (pat === 'loop') {
    off = LOOP[step % LOOP.length];
    if (!free(simP.x + off[0], simP.y + off[1])) off = [0, 0];
  } else if (pat === 'random') {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    off = dirs[(Math.random() * dirs.length) | 0];
    if (!free(simP.x + off[0], simP.y + off[1])) off = [0, 0];
  } else if (pat === 'kite') {
    const d = Math.max(Math.abs(enemy.x - simP.x), Math.abs(enemy.y - simP.y));
    if (d <= 3) {
      let best = null, bd = -1;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (!free(simP.x + ox, simP.y + oy)) continue;
        const nd = Math.max(Math.abs(enemy.x - (simP.x + ox)), Math.abs(enemy.y - (simP.y + oy)));
        if (nd > bd) { bd = nd; best = [ox, oy]; }
      }
      off = best || [0, 0];
    } else off = [0, 0];
  }
  simP.x += off[0]; simP.y += off[1];
  mem.push({ x: off[0], y: off[1] });
  if (mem.length > 16) mem.shift();
  return off;
}

// ---------------- one simulated turn ----------------
function doStep() {
  if (!enemy) return;
  step++;
  const off = playerStep();
  const env = {
    walk: (x, y) => x >= 0 && x < N && y >= 0 && y < N && (grid[y * N + x] === 0 || (grid[y * N + x] === 1 && enemy.pattern === 'drift')),
    occ: (x, y) => x === simP.x && y === simP.y,
    predict: () => predictPlayerTile(simP, mem),
  };
  let pred = env.predict();
  if (--enemy.cd > 0) {
    log(`T${step}  player moves (${off[0]},${off[1]})  -  ${enemyName()} is winding up`);
    draw(pred);
    return;
  }
  enemy.cd = enemy.every;
  const mv = chooseEnemyMove(enemy, simP, env);
  if (mv.kind === 'attack') {
    caught++;
    log(`T${step}  player moves (${off[0]},${off[1]})  -  ATTACK lands (total ${caught})`);
  } else if (mv.kind === 'move') {
    enemy.x = mv.x; enemy.y = mv.y;
    const predTxt = pred ? `predicts next (${pred.x - simP.x >= 0 ? '+' : ''}${pred.x - simP.x},${pred.y - simP.y})` : 'no read yet';
    log(`T${step}  player moves (${off[0]},${off[1]})  -  ${enemyName()} ${mv.plan || 'moves'} to (${mv.x},${mv.y})  [${predTxt}]`);
  } else {
    log(`T${step}  player moves (${off[0]},${off[1]})  -  ${enemyName()} holds position`);
  }
  draw(pred);
}

async function run20() {
  if (running) return;
  running = true;
  for (let i = 0; i < 20 && open; i++) {
    doStep();
    await new Promise((r) => setTimeout(r, 160));
  }
  running = false;
}

// ---------------- benchmark: 50 hunts per tier ----------------
function bench() {
  log('BENCHMARK - 50 hunts per tier, loop-pattern player, spawn at distance 8...');
  const results = [];
  for (let tier = 0; tier <= 3; tier++) {
    const major = tier >= 3 ? 1 : 0;
    let wins = 0, total = 0;
    for (let h = 0; h < 50; h++) {
      const p = { x: CENTER, y: CENTER };
      const e = simEnemy($('ai-type').value, tier, major);
      const a = Math.random() * Math.PI * 2;
      e.x = CENTER + Math.round(Math.cos(a) * 8);
      e.y = CENTER + Math.round(Math.sin(a) * 8);
      const m = [];
      let win = -1;
      for (let t = 0; t < 40 && win < 0; t++) {
        // scripted loop player (same rules as the sandbox)
        const off = LOOP[t % LOOP.length];
        const fx = p.x + off[0], fy = p.y + off[1];
        if (fx >= 0 && fx < N && fy >= 0 && fy < N && grid[fy * N + fx] === 0) { p.x = fx; p.y = fy; m.push({ x: off[0], y: off[1] }); }
        else m.push({ x: 0, y: 0 });
        if (m.length > 16) m.shift();
        if (--e.cd > 0) continue;
        e.cd = e.every;
        const mv = chooseEnemyMove(e, p, {
          walk: (x, y) => x >= 0 && x < N && y >= 0 && y < N && (grid[y * N + x] === 0 || (grid[y * N + x] === 1 && e.pattern === 'drift')),
          occ: (x, y) => x === p.x && y === p.y,
          predict: () => predictPlayerTile(p, m),
        });
        if (mv.kind === 'attack') win = t;
        else if (mv.kind === 'move') { e.x = mv.x; e.y = mv.y; }
      }
      if (win >= 0) { wins++; total += win; }
    }
    const avg = wins ? (total / wins).toFixed(1) : '-';
    results.push(`TIER ${tier} [${IQ_LABEL[Math.min(tier, 3)]}] - caught ${wins}/50 - avg ${avg} turns`);
  }
  for (const r of results) log(r);
  log('Every number above was computed locally by the same code that runs in-game.');
}

// ---------------- rendering ----------------
function draw(pred) {
  const c = $('ai-canvas');
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#1a2417';
  x.fillRect(0, 0, c.width, c.height);
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const t = grid[gy * N + gx];
      x.fillStyle = t === 0 ? '#243122' : t === 1 ? '#152512' : '#3a3d38';
      x.fillRect(gx * CELL, gy * CELL, CELL - 1, CELL - 1);
      if (t === 1) {
        x.fillStyle = '#2f5235';
        x.fillRect(gx * CELL + 3, gy * CELL + 3, CELL - 7, CELL - 7);
      } else if (t === 2) {
        x.fillStyle = '#575c54';
        x.fillRect(gx * CELL + 4, gy * CELL + 4, CELL - 8, CELL - 8);
      }
    }
  }
  // predicted player tile (teal diamond) - what a smart enemy aims at
  if (pred) {
    x.strokeStyle = '#7fe3d0';
    x.lineWidth = 1;
    const cx = pred.x * CELL + CELL / 2, cy = pred.y * CELL + CELL / 2;
    x.beginPath();
    x.moveTo(cx, cy - 4); x.lineTo(cx + 4, cy); x.lineTo(cx, cy + 4); x.lineTo(cx - 4, cy);
    x.closePath(); x.stroke();
  }
  // the player (amber cube with an eye)
  x.fillStyle = '#e8c96a';
  x.fillRect(simP.x * CELL + 2, simP.y * CELL + 2, CELL - 5, CELL - 5);
  x.fillStyle = '#1c2418';
  x.fillRect(simP.x * CELL + CELL - 7, simP.y * CELL + 4, 2, 2);
  // the enemy (its real in-game sprite)
  if (enemy) {
    const f = step % 2;
    x.drawImage(enemyCanvas(enemy.type, f, enemy), enemy.x * CELL, enemy.y * CELL, CELL, CELL);
  }
  // status line
  if (enemy) {
    el.status.textContent = `${enemyName()} - tier ${enemy.tier}${enemy.major ? ` major ${enemy.major}` : ''} - HP ${enemy.hp} ATK ${enemy.atk} - IQ: ${IQ_LABEL[Math.min(enemy.tier, 3)]}`;
  }
}

// ---------------- log ----------------
function log(txt) {
  const d = document.createElement('div');
  d.textContent = txt;
  el.log.appendChild(d);
  while (el.log.children.length > 10) el.log.removeChild(el.log.firstChild);
  el.log.scrollTop = el.log.scrollHeight;
}

// ---------------- popup wiring ----------------
function show() {
  if (!built) build();
  open = true;
  el.popup.hidden = false;
  reset();
}
function hide() {
  open = false;
  running = false;
  el.popup.hidden = true;
}

export function initAITest() {
  el.popup = $('aitest');
  el.log = $('ai-log');
  el.status = $('ai-status');
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      if (S.started) { UI.toast('The AI Lab is only available on the main menu.'); return; }
      open ? hide() : show();
    }
    if (open && e.key === 'Escape') hide();
  });
}
