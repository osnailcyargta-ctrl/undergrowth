// UNDERGROWTH - camera.
// Free camera by default: it does NOT follow the player and can only pan
// within the original camera range (spawn +/- 4 tiles). While zoomed in
// (z below sight range) it follows the player. Zoom range: [2, sight].

import { S } from './state.js';
import { clamp } from './util.js';

export const CAM = {
  x: 0, y: 0,
  z: 4,            // view radius in tiles (half-height of the view)
  minZ: 2,
  W: 0, H: 0,      // canvas CSS size, kept fresh by main
  pan: { x: 0, y: 0 },
};

export const isFollowing = () => CAM.z < S.vision - 1e-4;

export function update(dt) {
  if (!S.started) return;
  if (isFollowing()) {
    const P = S.player;
    const k = Math.min(1, dt * 10);
    CAM.x += (P.px - CAM.x) * k;
    CAM.y += (P.py - CAM.y) * k;
  } else {
    const sp = 9 * dt;
    CAM.x += CAM.pan.x * sp;
    CAM.y += CAM.pan.y * sp;
    // soft clamp to the original camera range
    const b = 4;
    const k = Math.min(1, dt * 6);
    CAM.x += (clamp(CAM.x, -b, b) - CAM.x) * k;
    CAM.y += (clamp(CAM.y, -b, b) - CAM.y) * k;
  }
}

// returns 'locked' when the eyes cannot zoom yet
export function zoomBy(d) {
  const P = S.player;
  if (!P || !P.canZoom) return 'locked';
  const before = CAM.z;
  CAM.z = clamp(CAM.z + d, CAM.minZ, S.vision);
  if (CAM.z !== before) return 'ok';
  return 'limit';
}

export function clampZoomToVision() {
  CAM.z = clamp(CAM.z, CAM.minZ, S.vision);
}

export function pixelsPerTile() { return CAM.H / (2 * CAM.z); }

export function worldToScreen(wx, wy) {
  const ppT = pixelsPerTile();
  return { x: (wx - CAM.x) * ppT + CAM.W / 2, y: (wy - CAM.y) * ppT + CAM.H / 2 };
}

export function screenToWorldTile(sx, sy) {
  const ppT = pixelsPerTile();
  return {
    x: Math.round((sx - CAM.W / 2) / ppT + CAM.x),
    y: Math.round((sy - CAM.H / 2) / ppT + CAM.y),
  };
}
