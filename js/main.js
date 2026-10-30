// UNDERGROWTH - bootstrap, game loop and the render pipeline.
// Light pass  -> realtime lightmap FBO (1 texel per tile, shadow rays per light)
// Scene pass  -> low-res FBO (32 px per tile, nearest textures, lit by the map)
// Post pass   -> grade + vignette + grain + damage/evolve/boss feedback

import { S, idx, cheb, inGrid, expNeedFor } from './state.js';
import { getGL, makeProgram, texFromCanvas, Target, quadVAO, emptyVAO } from './gl.js';
import { loadAssets } from './assets.js';
import * as SG from './spritegen.js';
import * as W from './world.js';
import * as V from './vfx.js';
import * as UI from './ui.js';
import { CAM, update as camUpdate, screenToWorldTile } from './camera.js';
import { initInput, mouse } from './input.js';
import { legalTargets } from './turn.js';
import { spawnInitial } from './enemies.js';
import { bossCells } from './boss.js';
import { enemyCanvas, dragonCanvas, playerCanvas, crystalCanvas, moteCanvas,
         leafCanvas, tentCanvas, chestCanvas, boneCanvas } from './spritegen.js';
import { initAITest } from './aitest.js';

const PPT = 32; // pixels per tile inside the scene FBO

let gl, canvas, target, lightTarget;
let imgs;
let A_TILES, A_SHADOW;
let tilesP, entP, shadowP, flatP, partP, postP, lightP;
let quadVao, tilesVao, particleVao, particleBuf, instBuf, emptyVao;
const texCache = new Map();
let occlTex = null, occlW = 0, occlH = 0;   // occluder texture (RG8, 1 texel per tile)

// canopy fade states for tall jungle trees, keyed by tile index
const canopyAlpha = new Map();

// ---------------- shaders ----------------
const SHADER_FILES = ['common.glsl', 'quad.vert', 'entity.frag', 'shadow.frag', 'flat.frag',
  'tiles.vert', 'tiles.frag', 'particle.vert', 'particle.frag', 'post.vert', 'post.frag',
  'light.vert', 'light.frag'];

async function loadShaders() {
  const map = {};
  await Promise.all(SHADER_FILES.map(async (f) => {
    const r = await fetch('shaders/' + f);
    if (!r.ok) throw new Error('Cannot load shaders/' + f);
    map[f] = await r.text();
  }));
  return map;
}

const vsrc = (map, name) => '#version 300 es\n' + map[name];
const fsrc = (map, name) => '#version 300 es\n' + map['common.glsl'] + map[name];

// ---------------- setup ----------------
function resize() {
  CAM.W = innerWidth;
  CAM.H = innerHeight;
  const dpr = Math.min(1.75, devicePixelRatio || 1);
  canvas.width = Math.round(CAM.W * dpr);
  canvas.height = Math.round(CAM.H * dpr);
}

function setupVAOs() {
  quadVao = quadVAO(gl);

  // tiles: base quad + per-instance data
  tilesVao = gl.createVertexArray();
  gl.bindVertexArray(tilesVao);
  const qb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -0.5, -0.5, 0, 0, 0.5, -0.5, 1, 0, -0.5, 0.5, 0, 1, 0.5, 0.5, 1, 1,
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  instBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
  const stride = 20;
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 0);
  gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 8);
  gl.vertexAttribDivisor(3, 1);
  gl.enableVertexAttribArray(4);
  gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 12);
  gl.vertexAttribDivisor(4, 1);
  gl.enableVertexAttribArray(5);
  gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 16);
  gl.vertexAttribDivisor(5, 1);
  gl.bindVertexArray(null);

  // particles: interleaved pos(2) size(1) color(4)
  particleVao = gl.createVertexArray();
  gl.bindVertexArray(particleVao);
  particleBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, particleBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 28, 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 28, 12);
  gl.bindVertexArray(null);

  emptyVao = emptyVAO(gl);
}

async function boot() {
  canvas = document.getElementById('gl');
  resize();
  window.addEventListener('resize', resize);

  gl = getGL(canvas);
  const A = await loadAssets(gl);
  imgs = A.imgs;
  A_TILES = A.tilesTex;
  A_SHADOW = A.shadowTex;

  const map = await loadShaders();
  tilesP = makeProgram(gl, vsrc(map, 'tiles.vert'), fsrc(map, 'tiles.frag'));
  entP = makeProgram(gl, vsrc(map, 'quad.vert'), fsrc(map, 'entity.frag'));
  shadowP = makeProgram(gl, vsrc(map, 'quad.vert'), fsrc(map, 'shadow.frag'));
  flatP = makeProgram(gl, vsrc(map, 'quad.vert'), fsrc(map, 'flat.frag'));
  partP = makeProgram(gl, vsrc(map, 'particle.vert'), fsrc(map, 'particle.frag'));
  postP = makeProgram(gl, vsrc(map, 'post.vert'), fsrc(map, 'post.frag'));
  lightP = makeProgram(gl, vsrc(map, 'light.vert'), fsrc(map, 'light.frag'));

  target = new Target(gl);
  lightTarget = new Target(gl);
  occlTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, occlTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  setupVAOs();

  // world + player
  S.player = {
    x: 0, y: 0, px: 0, py: 0,
    hp: 20, maxHp: 20, atk: 3, def: 0,
    vision: 4, sightAcc: 0,
    reachStraight: 0, reachDiag: 0,
    knight: false, fly: false,
    thorns: 0, cleave: false, evade: 0, crit: 0,
    expBonus: 0, regen: false, lastFury: false,
    phoenix: false, phoenixUsed: false,
    canZoom: false, owl: false, irisColor: null,
    head: 0, hasNewBody: false,
    parts: { legs: 0, arms: 0, body: 0, eyes: 0 },
    overrides: {},       // per-part sprite replacements set by upgrades
    attachments: [], owned: {},
    anim: null, flash: 0,
  };
  S.expNeed = expNeedFor(1);
  W.placeAltar();
  W.placeCamp();
  W.recomputeVision();
  spawnInitial(3);

  UI.initUI();
  UI.updateHUD();
  initInput(canvas);
  initAITest();

  requestAnimationFrame(loop);
}

// ---------------- per-frame update ----------------
const stepAnim = (e) => {
  if (!e.anim) return;
  const a = e.anim;
  const t = (performance.now() - a.t0) / a.dur;
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  e.px = a.x0 + (a.x1 - a.x0) * k;
  e.py = a.y0 + (a.y1 - a.y0) * k;
  if (t >= 1) e.anim = null;
};

function update(dt) {
  S.time += dt;
  if (S.started && !S.over && !S.modalOpen && S.countdown >= 0 && S.altar) {
    S.countdown -= dt;
    UI.updateCountdown(Math.max(1, Math.ceil(S.countdown)));
    if (Math.random() < dt * 6) V.FX.ember(S.altar.x, S.altar.y);
    if (S.countdown <= 0) {
      S.countdown = -1;
      UI.hideCountdown();
      import('./boss.js').then((B) => B.spawnDragon());
    }
  }
  stepAnim(S.player || {});
  for (const e of S.enemies) stepAnim(e);
  if (S.boss) stepAnim(S.boss);
  const decay = (e) => { if (e.flash) e.flash = Math.max(0, e.flash - dt * 4); };
  if (S.player) decay(S.player);
  S.enemies.forEach(decay);
  if (S.boss) decay(S.boss);
  S.dmgFlash = Math.max(0, S.dmgFlash - dt * 1.6);
  S.evoFlash = Math.max(0, S.evoFlash - dt * 1.1);
  S.shake = Math.max(0, S.shake - dt * 2.0);

  // tall jungle trees: the canopy above the player smoothly fades to reveal them
  for (const c of canopyAlpha.values()) {
    const target = (S.player && cheb(S.player.x, S.player.y, c.x, c.y) <= 1) ? 0.6 : 1.0;
    c.a += (target - c.a) * Math.min(1, dt * 5);
  }

  // blessed ground quietly breathes sparkles
  if (S.altar && S.altar.blessed && S.started && !S.over && Math.random() < dt * 1.2) {
    const p = S.altar.blessed[(Math.random() * S.altar.blessed.length) | 0];
    V.FX.bless(p.x, p.y);
  }

  camUpdate(dt);
  V.update(dt);
  UI.updateOverlays();
  UI.updateHUD();
}

// ---------------- lights ----------------
const lightPos = new Float32Array(18);
const lightCol = new Float32Array(18);

function setLights(prg) {
  let n = 0;
  const add = (x, y, r, col) => {
    if (n >= 6) return;
    lightPos[n * 3] = x; lightPos[n * 3 + 1] = y; lightPos[n * 3 + 2] = r;
    lightCol[n * 3] = col[0]; lightCol[n * 3 + 1] = col[1]; lightCol[n * 3 + 2] = col[2];
    n++;
  };
  const P = S.player;
  if (P) add(P.px, P.py, S.vision + 1.5, [1.0, 0.83, 0.55]);
  const A = S.altar;
  if (A) {
    const dim = A.used ? 0.35 : 1;
    add(A.x, A.y, 5.5 + 0.6 * Math.sin(S.time * 1.3), [0.22 * dim, 0.85 * dim, 0.75 * dim]);
  }
  if (S.boss) add(S.boss.px, S.boss.py, 8, [1.0, 0.28, 0.15]);
  // the dying dragon flares once more, then its light goes out with it
  if (S.bossDying) {
    const k = Math.max(0, 1 - S.bossDying.t / 1.4);
    add(S.bossDying.cx, S.bossDying.cy, 2 + 6 * k, [1.0, 0.3 + 0.4 * k, 0.12]);
  }
  gl.uniform3fv(prg.u('uLightPos'), lightPos);
  gl.uniform3fv(prg.u('uLightCol'), lightCol);
  gl.uniform1f(prg.u('uLightN'), n);
  gl.uniform1f(prg.u('uTime'), S.time);
}

function setScene(prg, camX, camY, fw, fh) {
  prg.use();
  gl.uniform2f(prg.u('uCam'), camX, camY);
  gl.uniform2f(prg.u('uRes'), fw, fh);
  gl.uniform1f(prg.u('uScale'), PPT);
}

function texFor(key, make) {
  let t = texCache.get(key);
  if (!t) {
    t = texFromCanvas(gl, make());
    texCache.set(key, t);
    if (texCache.size > 80) {
      const k0 = texCache.keys().next().value;
      gl.deleteTexture(texCache.get(k0));
      texCache.delete(k0);
    }
  }
  return t;
}

// ---------------- the realtime lightmap ----------------
// The window matches the tile draw range. R channel = occlusion (trees, rocks,
// walls, jungle trunks, canopies, tents, chests, mobs), G = emissive ground.
function computeWindow(camX, camY, halfW, halfH) {
  const x0 = Math.round(camX - halfW) - 1, x1 = Math.round(camX + halfW) + 1;
  const y0 = Math.round(camY - halfH) - 1, y1 = Math.round(camY + halfH) + 1;
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function uploadOccluders(win) {
  const { x0, y0, x1, y1, w, h } = win;
  const data = new Uint8Array(w * h * 2);
  const mobAt = new Map();
  for (const e of S.enemies) mobAt.set(idx(e.x, e.y), 140);
  if (S.boss) for (const [cx, cy] of bossCells()) mobAt.set(idx(cx, cy), 180);
  let o = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let occ = 0, emi = 0;
      if (inGrid(x, y)) {
        const t = W.tileAt(x, y);
        if (W.isSolidTile(t)) occ = 255;
        else if (W.isJungleTree(x, y - 1)) occ = 128;   // standing under a canopy
        const A = S.altar;
        if (A && A.x === x && A.y === y) emi = 120;
        else if (W.blessedAt(x, y)) emi = 110;
        const camp = W.campAt(x, y);
        if (camp) occ = Math.max(occ, camp.x === x && camp.y === y ? 120 : 90);
        const m = mobAt.get(idx(x, y));
        if (m) occ = Math.max(occ, m);
      }
      data[o++] = occ; data[o++] = emi;
    }
  }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, occlTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  if (w !== occlW || h !== occlH) {
    occlW = w; occlH = h;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, w, h, 0, gl.RG, gl.UNSIGNED_BYTE, data);
  } else {
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RG, gl.UNSIGNED_BYTE, data);
  }
}

function drawLightmap(win) {
  lightTarget.size(win.w, win.h);
  lightTarget.bind();
  gl.disable(gl.BLEND);
  lightP.use();
  gl.bindVertexArray(emptyVao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, occlTex);
  gl.uniform1i(lightP.u('uOccl'), 0);
  gl.uniform2f(lightP.u('uLCam'), win.x0, win.y0);
  gl.uniform2f(lightP.u('uLSize'), win.w, win.h);
  setLights(lightP);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

function bindLightmap(prg, win) {
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, lightTarget.tex);
  gl.uniform1i(prg.u('uLightmap'), 1);
  gl.uniform4f(prg.u('uLRect'), win.x0, win.y0, win.w, win.h);
}

// ---------------- scene passes ----------------
function drawTiles(win, camX, camY, fw, fh) {
  const { x0, x1, y0, y1 } = win;
  const n = win.w * win.h;
  const data = new Float32Array(n * 5);
  let o = 0;
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const layer = W.tileAt(x, y);
      const i = idx(x, y);
      const vis = S.visible[i] ? 1 : (S.explored[i] ? 0.45 : 0.0);
      let bn = 0;
      for (const [ox, oy] of NB) { if (W.isSolidTile(W.tileAt(x + ox, y + oy))) bn++; }
      data[o++] = x; data[o++] = y; data[o++] = layer; data[o++] = vis; data[o++] = 1 - 0.12 * bn;
    }
  }
  setScene(tilesP, camX, camY, fw, fh);
  bindLightmap(tilesP, win);
  gl.bindVertexArray(tilesVao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, A_TILES);
  gl.uniform1i(tilesP.u('uTiles'), 0);
  gl.uniform1f(tilesP.u('uTime'), S.time);
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
  gl.bindVertexArray(null);
}

function drawHighlights(camX, camY, fw, fh) {
  if (!S.started || S.busy || S.over || S.modalOpen) return;
  setScene(flatP, camX, camY, fw, fh);
  gl.bindVertexArray(quadVao);
  const legal = legalTargets();
  const hover = screenToWorldTile(mouse.x, mouse.y);
  gl.uniform2f(flatP.u('uSize'), 0.92, 0.92);
  for (const [, v] of legal) {
    let col;
    if (v.kind === 'move') col = [1, 0.95, 0.7, 0.09];
    else if (v.kind === 'attack') col = [1, 0.4, 0.25, 0.14];
    else col = [0.7, 0.85, 0.7, 0.07];
    if (hover.x === v.x && hover.y === v.y) col = [col[0], col[1], col[2], v.kind === 'attack' ? 0.4 : 0.26];
    gl.uniform4f(flatP.u('uColor'), col[0], col[1], col[2], col[3]);
    gl.uniform2f(flatP.u('uPos'), v.x, v.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  gl.bindVertexArray(null);
}

// glowing blessed ground around the altar (the lightmap adds the aura light)
function drawBlessed(camX, camY, fw, fh) {
  const A = S.altar;
  if (!A || !A.blessed) return;
  setScene(flatP, camX, camY, fw, fh);
  gl.bindVertexArray(quadVao);
  gl.uniform2f(flatP.u('uSize'), 0.94, 0.94);
  const pul = 0.10 + 0.05 * Math.sin(S.time * 2.3);
  for (const p of A.blessed) {
    const i = idx(p.x, p.y);
    if (!S.explored[i]) continue;              // fog hides the blessing too
    const vis = S.visible[i] ? 1 : 0.45;
    gl.uniform4f(flatP.u('uColor'), 0.35, 0.9, 0.8, pul * vis);
    gl.uniform2f(flatP.u('uPos'), p.x, p.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  gl.bindVertexArray(null);
}

function drawShadows(camX, camY, fw, fh) {
  setScene(shadowP, camX, camY, fw, fh);
  gl.bindVertexArray(quadVao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, A_SHADOW);
  gl.uniform1i(shadowP.u('uTex'), 0);
  const sh = (x, y, s, a = 0.38) => {
    gl.uniform2f(shadowP.u('uPos'), x, y - 0.2);
    gl.uniform2f(shadowP.u('uSize'), s, s * 0.8);
    gl.uniform1f(shadowP.u('uAlpha'), a);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  for (const e of S.enemies) {
    if (S.visible[idx(e.x, e.y)]) sh(e.px, e.py, 0.9);
  }
  if (S.boss && bossCells().some(([cx, cy]) => S.visible[idx(cx, cy)])) sh(S.boss.px, S.boss.py, 1.9, 0.5);
  if (S.player) sh(S.player.px, S.player.py, 0.95);
  gl.bindVertexArray(null);
}

const frameNow = (e) => (e.anim ? (Math.floor(S.time * 12) % 2) : (Math.floor(S.time * 2) % 2));

function playerKey(P, frame) {
  const ov = P.overrides || {};
  return `pl:${frame}:${P.parts.legs}${P.parts.arms}${P.parts.body}${P.parts.eyes}:${P.head}:${P.irisColor}:${P.attachments.map((a) => a.kind + a.color).join('|')}:${ov.legs || ''}.${ov.arms || ''}.${ov.body || ''}.${ov.eyes || ''}`;
}

function drawEntities(win, camX, camY, fw, fh) {
  setScene(entP, camX, camY, fw, fh);
  bindLightmap(entP, win);
  gl.uniform1f(entP.u('uTime'), S.time);
  gl.bindVertexArray(quadVao);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(entP.u('uTex'), 0);
  const visAt = (x, y) => (S.visible[idx(x, y)] ? 1 : 0);
  const memAt = (x, y) => (S.visible[idx(x, y)] ? 1 : (S.explored[idx(x, y)] ? 0.45 : 0));
  const drawEnt = (tex, x, y, size, vis, flash = 0, alpha = 1, rot = 0) => {
    if (vis <= 0) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform2f(entP.u('uPos'), x, y);
    gl.uniform2f(entP.u('uSize'), size, size);
    gl.uniform1f(entP.u('uVis'), vis);
    gl.uniform1f(entP.u('uFlash'), flash);
    gl.uniform4f(entP.u('uTint'), 1, 1, 1, alpha);
    gl.uniform1f(entP.u('uRot'), rot);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const A = S.altar;
  if (A) drawEnt(texFor('crystal', crystalCanvas), A.x, A.y + 0.05 + 0.04 * Math.sin(S.time * 2), 0.95, memAt(A.x, A.y), 0, 0.95);
  // camps: tent + chest (the chest swaps to its opened sprite once looted)
  for (const c of S.camps) {
    drawEnt(texFor('tent', tentCanvas), c.x, c.y + 0.18, 1.55, memAt(c.x, c.y));
    drawEnt(texFor(c.looted ? 'chestO' : 'chestC', () => chestCanvas(c.looted)), c.cx, c.cy, 0.95, memAt(c.cx, c.cy));
  }
  for (const m of S.motes) {
    if (visAt(m.x, m.y)) drawEnt(texFor('mote', moteCanvas), m.x, m.y + 0.1 * Math.sin(S.time * 3 + m.x * 1.7), 0.36, 1);
  }
  for (const e of S.enemies) {
    const f = frameNow(e);
    drawEnt(texFor(`en:${e.type}:${f}:${e.form || 'base'}:${e.tier || 0}:${e.major || 0}`, () => enemyCanvas(e.type, f, e)), e.px, e.py, 0.95, visAt(e.x, e.y), e.flash);
  }
  if (S.boss) {
    const b = S.boss;
    const vis = Math.max(...bossCells().map(([cx, cy]) => visAt(cx, cy)));
    const f = Math.floor(S.time * 2.5) % 2;
    drawEnt(texFor(`dr:${f}`, () => dragonCanvas(f)), b.px, b.py + 0.05 * Math.sin(S.time * 2), 2.05, vis, b.flash);
  }
  // the dragon's bones tumble, spin and fade
  if (S.bossDying) {
    for (const bn of S.bossDying.bones) {
      drawEnt(texFor(`bone${bn.kind}`, () => boneCanvas(bn.kind)), bn.x, bn.y, bn.size, 1, 0, bn.a, bn.rot);
    }
  }
  const P = S.player;
  if (P) {
    const f = frameNow(P);
    drawEnt(texFor(playerKey(P, f), () => playerCanvas(P, imgs, f)), P.px, P.py, 1.0, 1, P.flash);
  }
  // tall jungle trees: leaf canopies one tile above the trunk, drawn last so
  // they hang OVER everything (and fade when the player stands beneath)
  for (let y = win.y0; y <= win.y1; y++) {
    for (let x = win.x0; x <= win.x1; x++) {
      if (!W.isJungleTree(x, y)) continue;
      const mem = memAt(x, y + 1);
      if (mem <= 0) continue;
      const key = idx(x, y + 1);
      let ca = canopyAlpha.get(key);
      if (!ca) { ca = { x, y: y + 1, a: 1 }; canopyAlpha.set(key, ca); }
      const variant = W.h2(x, y, 5) < 0.5 ? 0 : 1;
      drawEnt(texFor(`leaf${variant}`, () => leafCanvas(variant ? 77 : 42)), x, y + 1, 1.35, mem, 0, ca.a);
    }
  }
  gl.bindVertexArray(null);
}

function drawPost() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.BLEND);
  postP.use();
  gl.bindVertexArray(emptyVao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, target.tex);
  gl.uniform1i(postP.u('uScene'), 0);
  gl.uniform2f(postP.u('uRes'), canvas.width, canvas.height);
  gl.uniform1f(postP.u('uTime'), S.time);
  gl.uniform1f(postP.u('uDmg'), Math.min(1, S.dmgFlash));
  gl.uniform1f(postP.u('uEvo'), Math.min(1, S.evoFlash));
  gl.uniform1f(postP.u('uBoss'), S.boss ? 1 : 0);
  gl.uniform1f(postP.u('uCount'), S.countdown >= 0 ? Math.min(1, 1.2 - S.countdown / 5) : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

function render() {
  const halfH = CAM.z;
  const halfW = halfH * (CAM.W / Math.max(1, CAM.H));
  const fw = Math.min(2048, Math.ceil(halfW * 2 * PPT));
  const fh = Math.min(2048, Math.ceil(halfH * 2 * PPT));
  target.size(fw, fh);
  const shx = (Math.random() - 0.5) * S.shake * 0.4;
  const shy = (Math.random() - 0.5) * S.shake * 0.4;
  const camX = CAM.x + shx, camY = CAM.y + shy;
  const win = computeWindow(camX, camY, halfW, halfH);

  // pass 1: realtime lightmap (own low-res FBO, one texel per tile)
  uploadOccluders(win);
  drawLightmap(win);

  // pass 2: the scene, lit by the map above
  target.bind();
  gl.clearColor(0.012, 0.021, 0.015, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.activeTexture(gl.TEXTURE0);
  drawTiles(win, camX, camY, fw, fh);
  drawBlessed(camX, camY, fw, fh);
  drawHighlights(camX, camY, fw, fh);
  drawShadows(camX, camY, fw, fh);
  drawEntities(win, camX, camY, fw, fh);
  V.draw(gl, partP, particleVao, particleBuf, camX, camY, fw, fh);
  drawPost();
}

let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

boot().catch((err) => {
  console.error(err);
  const e = document.getElementById('err');
  e.hidden = false;
  e.textContent = 'Failed to start: ' + err.message;
});
