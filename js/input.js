// UNDERGROWTH - input: mouse to click tiles, wheel to zoom, WASD to pan.

import { S } from './state.js';
import { CAM, zoomBy } from './camera.js';
import { playerAct } from './turn.js';
import * as UI from './ui.js';

export const mouse = { x: -1, y: -1 };

export function initInput(canvas) {
  canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (!S.started || S.over || S.busy || S.modalOpen) return;
    const ppT = CAM.H / (2 * CAM.z);
    const tx = Math.round((e.clientX - CAM.W / 2) / ppT + CAM.x);
    const ty = Math.round((e.clientY - CAM.H / 2) / ppT + CAM.y);
    playerAct(tx, ty);
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!S.started || S.over || S.modalOpen) return;
    const r = zoomBy(e.deltaY > 0 ? 1 : -1); // wheel down = zoom out, wheel up = zoom in
    if (r === 'locked') UI.toast('Your eyes cannot focus yet. Take an Eyes upgrade.');
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') CAM.pan.y = 1;
    if (k === 's' || k === 'arrowdown') CAM.pan.y = -1;
    if (k === 'a' || k === 'arrowleft') CAM.pan.x = -1;
    if (k === 'd' || k === 'arrowright') CAM.pan.x = 1;
    if (k === '=' || k === '+') { if (zoomBy(1) === 'locked') UI.toast('Your eyes cannot focus yet. Take an Eyes upgrade.'); }
    if (k === '-') { if (zoomBy(-1) === 'locked') UI.toast('Your eyes cannot focus yet. Take an Eyes upgrade.'); }
    if (k === 'r' && S.over) location.reload();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup' || k === 's' || k === 'arrowdown') CAM.pan.y = 0;
    if (k === 'a' || k === 'arrowleft' || k === 'd' || k === 'arrowright') CAM.pan.x = 0;
  });
}
