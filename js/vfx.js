// UNDERGROWTH - particle VFX (CPU simulated, GPU point sprites, additive).
// Ambient fireflies drift through the trees; actions emit bursts.

import { S } from './state.js';
import { CAM, isFollowing } from './camera.js';

const parts = [];
const MAX = 700;

function spawn(o) {
  if (parts.length >= MAX) parts.shift();
  parts.push(Object.assign({ vx: 0, vy: 0, grav: 0, drag: 1.5, seed: Math.random() * 10 }, o));
}

export function update(dt) {
  // ambient fireflies around the camera
  if (S.started && !S.over && Math.random() < dt * 2.4) {
    const hw = CAM.z * (CAM.W / Math.max(1, CAM.H)) * 0.9;
    const hh = CAM.z * 0.9;
    const green = Math.random() < 0.7;
    spawn({
      x: CAM.x + (Math.random() * 2 - 1) * hw,
      y: CAM.y + (Math.random() * 2 - 1) * hh,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      life: 3 + Math.random() * 3,
      size: 0.09 + Math.random() * 0.07,
      col: green ? [0.72, 0.86, 0.45] : [0.85, 0.72, 0.38],
      a: 0.55, flick: true,
    });
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vx -= p.vx * p.drag * dt;
    p.vy -= p.vy * p.drag * dt;
    p.vy -= (p.grav || 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

const buf = new Float32Array(MAX * 7);

export function draw(gl, prg, vao, bufHandle, camX, camY, resW, resH) {
  if (!parts.length) return;
  let n = 0;
  for (const p of parts) {
    let a = p.a * Math.min(1, p.life * 2.5);
    if (p.flick) a *= 0.55 + 0.45 * Math.sin(S.time * 6 + p.seed * 7);
    const o = n * 7;
    buf[o] = p.x; buf[o + 1] = p.y; buf[o + 2] = p.size;
    buf[o + 3] = p.col[0]; buf[o + 4] = p.col[1]; buf[o + 5] = p.col[2]; buf[o + 6] = Math.max(0, a);
    n++;
  }
  prg.use();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufHandle);
  gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, n * 7), gl.DYNAMIC_DRAW);
  gl.uniform2f(prg.u('uCam'), camX, camY);
  gl.uniform2f(prg.u('uRes'), resW, resH);
  gl.uniform1f(prg.u('uScale'), 32);
  gl.blendFunc(gl.ONE, gl.ONE); // additive
  gl.drawArrays(gl.POINTS, 0, n);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(null);
}

// ---------------- event bursts ----------------
function burst(x, y, n, col, spd, life, size, opt = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = spd * (0.4 + Math.random() * 0.8);
    spawn({
      x: x + (Math.random() - 0.5) * 0.3,
      y: y + (Math.random() - 0.5) * 0.3,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: life * (0.6 + Math.random() * 0.7),
      size: size * (0.7 + Math.random() * 0.7),
      col, a: 0.9,
      grav: opt.grav || 0,
    });
  }
}

export const FX = {
  move(x, y) { burst(x, y, 5, [0.42, 0.38, 0.28], 0.9, 0.4, 0.11); },
  leaves(x, y) { burst(x, y, 4, [0.45, 0.62, 0.35], 0.7, 0.55, 0.10); },
  wait(x, y) { burst(x, y, 4, [0.55, 0.6, 0.5], 0.4, 0.5, 0.09); },
  hit(x, y, col = [1, 0.4, 0.25]) { burst(x, y, 10, col, 2.6, 0.3, 0.13); },
  pick(x, y) { burst(x, y, 7, [1, 0.8, 0.35], 1.1, 0.45, 0.11); },
  death(x, y) {
    burst(x, y, 9, [0.45, 0.55, 0.38], 1.6, 0.6, 0.13);
    burst(x, y, 5, [0.25, 0.3, 0.22], 0.9, 0.9, 0.16);
  },
  evo(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      spawn({
        x: x + Math.cos(a) * 0.5, y: y + Math.sin(a) * 0.4,
        vx: Math.cos(a) * 0.5, vy: 0.9 + Math.random() * 1.3,
        life: 0.8 + Math.random() * 0.6, size: 0.13 + Math.random() * 0.1,
        col: [1, 0.8, 0.35], a: 1, grav: 0.4,
      });
    }
  },
  ember(x, y) {
    for (let i = 0; i < 3; i++) {
      spawn({
        x: x + (Math.random() - 0.5) * 0.8, y: y + (Math.random() - 0.5) * 0.4,
        vx: (Math.random() - 0.5) * 0.3, vy: 0.8 + Math.random() * 0.9,
        life: 0.7 + Math.random() * 0.5, size: 0.12,
        col: Math.random() < 0.5 ? [1, 0.45, 0.15] : [0.4, 0.9, 0.8], a: 0.9,
      });
    }
  },
  breath(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0) || 1;
    for (let i = 0; i < 16; i++) {
      const t = i / 16;
      spawn({
        x: x0 + (x1 - x0) * t + (Math.random() - 0.5) * 0.3,
        y: y0 + (y1 - y0) * t + (Math.random() - 0.5) * 0.3,
        vx: (x1 - x0) / d * 1.4, vy: (y1 - y0) / d * 1.4,
        life: 0.35 + Math.random() * 0.3, size: 0.16 + Math.random() * 0.1,
        col: Math.random() < 0.5 ? [1, 0.35, 0.1] : [1, 0.7, 0.2], a: 0.95,
      });
    }
  },
  bossSpawn(x, y) {
    burst(x, y, 34, [1, 0.4, 0.12], 3.2, 0.8, 0.16);
    burst(x, y, 20, [0.5, 0.1, 0.05], 2.0, 1.2, 0.2);
    for (let i = 0; i < 12; i++) {
      spawn({ x: x + (Math.random() - 0.5) * 2, y: y - 1, vx: 0, vy: 1.6 + Math.random(), life: 1.1, size: 0.14, col: [1, 0.55, 0.15], a: 1 });
    }
  },
  bossDeath(x, y) {
    burst(x, y, 50, [1, 0.65, 0.2], 4.5, 1.0, 0.18);
    burst(x, y, 30, [0.8, 0.2, 0.1], 3.0, 1.4, 0.2);
    for (let i = 0; i < 20; i++) {
      spawn({ x: x + (Math.random() - 0.5) * 2.4, y: y + (Math.random() - 0.5) * 2, vx: 0, vy: 1.2 + Math.random() * 1.6, life: 1.5, size: 0.15, col: [1, 0.85, 0.45], a: 1 });
    }
  },
};
