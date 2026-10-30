// UNDERGROWTH - input: click / tap a tile to act, wheel or pinch to zoom.
// There is no manual camera panning: the camera is locked at full view and
// follows the player automatically while zoomed in.

import { S } from './state.js';
import { CAM, zoomBy, zoomMax, screenToWorldTile } from './camera.js';
import { playerAct } from './turn.js';
import * as UI from './ui.js';

export const mouse = { x: -1, y: -1 };

const ZOOM_HINT = 'Your eyes cannot focus yet. Take an Eyes upgrade.';

function actAt(sx, sy) {
  if (!S.started || S.over || S.busy || S.modalOpen) return;
  const t = screenToWorldTile(sx, sy);
  playerAct(t.x, t.y);
}

export function initInput(canvas) {
  canvas.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
  });

  // --- unified pointer handling: mouse clicks, touch taps, pinch zoom ---
  const pts = new Map();          // active pointers, id -> {x, y}
  let pinchD0 = 0, pinchZ0 = 0;   // pinch baseline: finger distance / zoom
  let tap = null;                 // pending single-finger tap
  let pinchHinted = false;

  const startPinch = () => {
    const [a, b] = [...pts.values()];
    pinchD0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    pinchZ0 = CAM.z;
    if ((!S.player || !S.player.canZoom) && !pinchHinted) {
      UI.toast(ZOOM_HINT);
      pinchHinted = true;
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!S.started || S.over || S.modalOpen) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'mouse') {
      tap = null;
      actAt(e.clientX, e.clientY);
    } else if (pts.size === 1) {
      tap = { x: e.clientX, y: e.clientY, moved: false };
    } else {
      tap = null; // second finger down: this is a pinch, not a tap
      if (pts.size === 2) startPinch();
    }
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 14) tap.moved = true;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size >= 2 && pinchD0 && S.player && S.player.canZoom) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      // spread fingers = zoom in (view radius shrinks), pinch close = zoom out
      CAM.z = Math.max(CAM.minZ, Math.min(zoomMax(), pinchZ0 * pinchD0 / d));
    }
    e.preventDefault();
  });

  const release = (e) => {
    const had = pts.delete(e.pointerId);
    if (had && pts.size === 1) { pinchD0 = 0; tap = null; } // pinch ended early
    if (e.pointerType !== 'mouse' && tap && !tap.moved && pts.size === 0) {
      actAt(tap.x, tap.y); // a clean tap acts where the finger lifted
    }
    if (pts.size === 0) { tap = null; pinchD0 = 0; pinchHinted = false; }
    e.preventDefault();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!S.started || S.over || S.modalOpen) return;
    const r = zoomBy(e.deltaY > 0 ? 1 : -1); // wheel down = zoom out, wheel up = zoom in
    if (r === 'locked') UI.toast(ZOOM_HINT);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === '=' || k === '+') { if (zoomBy(1) === 'locked') UI.toast(ZOOM_HINT); }
    if (k === '-') { if (zoomBy(-1) === 'locked') UI.toast(ZOOM_HINT); }
    if (k === 'r' && S.over) location.reload();
  });
}
