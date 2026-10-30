// UNDERGROWTH - camera.
// The camera is never panned by hand. At full view (zoom == sight) it is
// locked in place; zoom in below full view and it follows the player.
// Zoom range: [2, min(sight, 30)]. World space is Y-UP (screen space is not).

import { S } from './state.js';
import { clamp } from './util.js';

export const CAM = {
  x: 0, y: 0,
  z: 4,            // view radius in tiles (half-height of the view)
  minZ: 2,
  W: 0, H: 0,      // canvas CSS size, kept fresh by main
};

// hard cap on zooming out, even if sight keeps growing past it
export const ZOOM_CAP = 30;
export const zoomMax = () => Math.min(S.vision, ZOOM_CAP);
// the camera follows whenever the view is tighter than the full sight range
export const isFollowing = () => CAM.z < S.vision - 1e-4;

let lastMax = 4; // zoom cap at the last sync, to detect "was at full view"

export function update(dt) {
  if (!S.started) return;
  if (!isFollowing()) return; // locked: no pan, no drift
  const P = S.player;
  const k = Math.min(1, dt * 10);
  CAM.x += (P.px - CAM.x) * k;
  CAM.y += (P.py - CAM.y) * k;
}

// returns 'locked' when the eyes cannot zoom yet
export function zoomBy(d) {
  const P = S.player;
  if (!P || !P.canZoom) return 'locked';
  const before = CAM.z;
  CAM.z = clamp(CAM.z + d, CAM.minZ, zoomMax());
  if (CAM.z !== before) return 'ok';
  return 'limit';
}

// called whenever sight changes: resting at full view auto-expands to the
// new max; a deliberately zoomed-in view is preserved (just re-clamped)
export function clampZoomToVision() {
  const wasFull = CAM.z >= lastMax - 1e-4;
  CAM.z = clamp(CAM.z, CAM.minZ, zoomMax());
  if (wasFull) CAM.z = zoomMax();
  lastMax = zoomMax();
}

export function pixelsPerTile() { return CAM.H / (2 * CAM.z); }

// world -> DOM screen coordinates (screen Y grows downward)
export function worldToScreen(wx, wy) {
  const ppT = pixelsPerTile();
  return { x: (wx - CAM.x) * ppT + CAM.W / 2, y: CAM.H / 2 - (wy - CAM.y) * ppT };
}

// DOM screen coordinates -> world tile (exact inverse of the render transform:
// the renderer draws world +Y toward the top of the screen)
export function screenToWorldTile(sx, sy) {
  const ppT = pixelsPerTile();
  return {
    x: Math.round((sx - CAM.W / 2) / ppT + CAM.x),
    y: Math.round((CAM.H / 2 - sy) / ppT + CAM.y),
  };
}

// debug handle extras (window.UG) - handy for testing and tinkering
if (typeof window !== 'undefined' && window.UG) {
  window.UG.cam = CAM;
  window.UG.zoomBy = zoomBy;
  window.UG.zoomMax = zoomMax;
  window.UG.syncZoom = clampZoomToVision;
}
