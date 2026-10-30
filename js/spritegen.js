// UNDERGROWTH - live sprite factory.
// The only baked assets are the 4 base player sprites. Every other visual
// (tiles, enemies, the dragon, the altar, upgrade icons, attachment visuals
// for procedural upgrades) is generated here, in code, at runtime.

// ---------------- tiny canvas helpers ----------------
export function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function ctx2(c) {
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return x;
}
function R(x, rx, ry, rw, rh, col) {
  x.fillStyle = col;
  x.fillRect(rx, ry, rw, rh);
}
function disc(x, cx, cy, r, col) {
  x.fillStyle = col;
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let px = Math.floor(cx - r - 1); px <= cx + r + 1; px++) {
      const d = Math.hypot(px + 0.5 - cx, y + 0.5 - cy);
      if (d <= r + 0.35) x.fillRect(px, y, 1, 1);
    }
  }
}
// 1px line between two points (pixel-art friendly)
function line(x, x0, y0, x1, y1, col) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) {
    R(x, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1, col);
  }
}
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- ground tiles (16x16, texture-array layers) ----------------
export function makeTiles() {
  const grass = (seed, flowers) => {
    const c = cv(16, 16), x = ctx2(c), rnd = mulberry(seed);
    R(x, 0, 0, 16, 16, '#2c402a');
    for (let i = 0; i < 30; i++) R(x, (rnd() * 16) | 0, (rnd() * 16) | 0, 1, 1, rnd() < 0.5 ? '#243622' : '#31462e');
    for (let i = 0; i < 7; i++) {
      const bx = (rnd() * 15) | 0, by = (rnd() * 14) | 0;
      R(x, bx, by, 1, 2, rnd() < 0.5 ? '#3a5434' : '#354e30');
    }
    if (flowers) {
      const spots = [[3, 4, '#d9c06a'], [11, 3, '#c9d98a'], [6, 11, '#d9c06a'], [12, 12, '#c9d98a'], [2, 10, '#d9a84a']];
      for (const [fx, fy, fc] of spots) {
        R(x, fx, fy, 1, 1, fc);
        R(x, fx - 1, fy, 1, 1, '#3a5434'); R(x, fx + 1, fy, 1, 1, '#3a5434');
        R(x, fx, fy - 1, 1, 1, '#3a5434'); R(x, fx, fy + 1, 1, 1, '#3a5434');
      }
    }
    return c;
  };
  const tree = (seed) => {
    const c = cv(16, 16), x = ctx2(c), rnd = mulberry(seed);
    R(x, 0, 0, 16, 16, '#2c402a');
    for (let i = 0; i < 18; i++) R(x, (rnd() * 16) | 0, (rnd() * 16) | 0, 1, 1, '#243622');
    disc(x, 8, 8, 7.1, '#152512');                 // canopy shadow rim
    disc(x, 8, 8, 6.4, '#1f3620');
    disc(x, 7.4, 7.2, 5.0, '#274427');
    for (let i = 0; i < 6; i++) {                  // leaf clusters
      const a = rnd() * Math.PI * 2, d = rnd() * 4.4;
      disc(x, 7.6 + Math.cos(a) * d, 7.4 + Math.sin(a) * d, 1.35, rnd() < 0.5 ? '#33593a' : '#2f5235');
    }
    disc(x, 6.2, 5.8, 1.1, '#3e6544');             // moonlit highlight
    return c;
  };
  const rock = () => {
    const c = cv(16, 16), x = ctx2(c);
    R(x, 0, 0, 16, 16, '#2c402a');
    R(x, 1, 1, 14, 14, '#243622');
    disc(x, 8, 8.4, 4.6, '#2c2f2a');
    disc(x, 8, 8.2, 3.9, '#575c54');
    disc(x, 6.8, 7.0, 1.7, '#6d736a');
    R(x, 8, 10, 3, 1, '#454a42'); R(x, 10, 9, 1, 2, '#454a42');
    R(x, 6, 9, 1, 1, '#3a3e38'); R(x, 9, 7, 1, 1, '#3a3e38');
    return c;
  };
  const wall = (seed) => {
    const c = cv(16, 16), x = ctx2(c), rnd = mulberry(seed);
    R(x, 0, 0, 16, 16, '#0d160e');
    for (let i = 0; i < 5; i++) {
      disc(x, rnd() * 16, rnd() * 16, 2.4 + rnd() * 1.6, '#0a110b');
    }
    for (let i = 0; i < 4; i++) {
      disc(x, rnd() * 16, rnd() * 16, 1.8 + rnd() * 1.4, '#111c11');
    }
    for (let i = 0; i < 10; i++) R(x, (rnd() * 16) | 0, (rnd() * 16) | 0, 1, 1, '#16240f');
    return c;
  };
  const altar = () => {
    const c = cv(16, 16), x = ctx2(c);
    R(x, 0, 0, 16, 16, '#565b52');
    R(x, 0, 0, 16, 1, '#3c4038'); R(x, 0, 15, 16, 1, '#3c4038');
    R(x, 0, 0, 1, 16, '#3c4038'); R(x, 15, 0, 1, 16, '#3c4038');
    disc(x, 8, 8, 5.6, '#6a7062');
    disc(x, 8, 8, 4.6, '#5d6257');
    // carved ring + runes
    for (let a = 0; a < 32; a++) {
      const ang = (a / 32) * Math.PI * 2;
      R(x, Math.round(8 + Math.cos(ang) * 4.2), Math.round(8 + Math.sin(ang) * 4.2), 1, 1, '#76b8ac');
    }
    R(x, 7, 7, 2, 2, '#9ff0e0');
    R(x, 8, 2, 1, 1, '#7fe3d0'); R(x, 8, 13, 1, 1, '#7fe3d0');
    R(x, 2, 8, 1, 1, '#7fe3d0'); R(x, 13, 8, 1, 1, '#7fe3d0');
    return c;
  };
  return [grass(11, false), grass(22, false), grass(33, true), tree(44), tree(55), rock(), wall(66), wall(77), altar()];
}

// ---------------- shared small canvases ----------------
export function whiteCanvas() {
  const c = cv(4, 4), x = ctx2(c);
  R(x, 0, 0, 4, 4, '#ffffff');
  return c;
}

export function shadowCanvas() {
  const c = cv(16, 16), x = ctx2(c);
  x.translate(8, 8);
  x.scale(1, 0.6);
  const g = x.createRadialGradient(0, 0, 1, 0, 0, 7);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(-8, -12, 16, 24);
  return c;
}

export function moteCanvas() {
  const c = cv(8, 8), x = ctx2(c);
  disc(x, 4, 4, 3.2, 'rgba(232,184,74,0.30)');
  disc(x, 4, 4, 1.9, '#e8b84a');
  R(x, 3, 3, 1, 1, '#fff2c9');
  return c;
}

export function crystalCanvas() {
  const c = cv(16, 16), x = ctx2(c);
  disc(x, 8, 8, 7, 'rgba(127,227,208,0.10)');
  // pedestal
  R(x, 4, 10, 8, 3, '#4a4f46');
  R(x, 4, 10, 8, 1, '#5d6257');
  R(x, 4, 12, 8, 1, '#33362f');
  // crystal
  x.fillStyle = '#7fe3d0';
  x.beginPath();
  x.moveTo(8, 1); x.lineTo(11, 6); x.lineTo(10, 11); x.lineTo(6, 11); x.lineTo(5, 6);
  x.closePath(); x.fill();
  x.fillStyle = '#c9f5ea';
  x.beginPath();
  x.moveTo(8, 1); x.lineTo(10, 5); x.lineTo(8, 8); x.lineTo(6, 5);
  x.closePath(); x.fill();
  R(x, 8, 6, 1, 3, '#eafffa');
  return c;
}

// ---------------- enemies ----------------
// `e` is optional: { type, form, major, tier } - the evolved forms.
export function enemyCanvas(type, frame, e) {
  const c = cv(16, 16), x = ctx2(c);
  const major = (e && e.major) || 0, tier = (e && e.tier) || 0, form = (e && e.form) || 'base';
  if (type === 'shambler') {
    R(x, 3, 4, 10, 8, '#242e20');
    R(x, 4, 5, 8, 6, '#44543c');
    disc(x, 6, 6, 1.6, '#5d7a4a');
    disc(x, 9, 8, 1.4, '#526b42');
    R(x, 4, 10, 8, 1, '#33412c');
    const ey = frame ? 8 : 7;
    const eyeCol = major >= 1 ? '#e85a3a' : '#e8c96a';
    R(x, 6, ey, 1, 1, eyeCol); R(x, 9, ey, 1, 1, eyeCol);
    if (major >= 1) { // back spikes
      R(x, 4, 3, 1, 1, '#33412c'); R(x, 7, 2, 1, 2, '#33412c'); R(x, 10, 3, 1, 1, '#33412c');
    }
    if (tier >= 2) { R(x, 5, 4, 1, 1, '#6d8a54'); R(x, 9, 5, 1, 1, '#6d8a54'); }
    R(x, 5, 12, 2, 1, '#242e20'); R(x, 9, 12, 2, 1, '#242e20');
  } else if (type === 'stalker') {
    if (form === 'winged') {
      // flapping wings behind the diamond; bigger and gold-rimmed at major 2+
      const wc = major >= 2 ? '#c9d4e8' : '#8fa8c9';
      const wd = major >= 2 ? '#8a9ab8' : '#5a6b88';
      const up = frame === 0;
      const wy = up ? 0 : 1;
      // left wing
      x.fillStyle = wd;
      x.beginPath(); x.moveTo(5, 8); x.lineTo(0, 4 + wy); x.lineTo(4, 11); x.closePath(); x.fill();
      x.fillStyle = wc;
      x.beginPath(); x.moveTo(5, 8); x.lineTo(1, 5 + wy); x.lineTo(4, 10); x.closePath(); x.fill();
      // right wing (mirrored)
      x.save(); x.translate(16, 0); x.scale(-1, 1);
      x.fillStyle = wd;
      x.beginPath(); x.moveTo(5, 8); x.lineTo(0, 4 + wy); x.lineTo(4, 11); x.closePath(); x.fill();
      x.fillStyle = wc;
      x.beginPath(); x.moveTo(5, 8); x.lineTo(1, 5 + wy); x.lineTo(4, 10); x.closePath(); x.fill();
      x.restore();
      if (major >= 2) { R(x, 3, 6 + wy, 1, 1, '#e8d98a'); R(x, 12, 6 + wy, 1, 1, '#e8d98a'); }
    }
    const off = frame ? -1 : 0;
    x.fillStyle = '#2a2433';
    x.beginPath();
    x.moveTo(8, 2 + off); x.lineTo(13, 8 + off); x.lineTo(8, 13 + off); x.lineTo(3, 8 + off);
    x.closePath(); x.fill();
    x.fillStyle = major >= 2 ? '#6e6280' : '#5a4f66';
    x.beginPath();
    x.moveTo(8, 3 + off); x.lineTo(12, 8 + off); x.lineTo(8, 12 + off); x.lineTo(4, 8 + off);
    x.closePath(); x.fill();
    const eyeCol = major >= 1 ? '#ffd0e8' : '#e8e4f0';
    R(x, 6, 8 + off, 1, 1, eyeCol); R(x, 9, 8 + off, 1, 1, eyeCol);
  } else if (type === 'skitter') {
    if (form === 'rook') {
      // hardened into a living rook tower
      const bo = frame ? 1 : 0; // slow bob
      const stone = '#5c5344', dark = '#3a362c', deep = '#2c2820';
      R(x, 3, 2 + bo, 2, 3, stone); R(x, 7, 2 + bo, 2, 3, stone); R(x, 11, 2 + bo, 2, 3, stone); // merlons
      R(x, 3, 5 + bo, 10, 1, dark);                                   // parapet
      R(x, 4, 6 + bo, 8, 7, stone);                                   // tower body
      R(x, 4, 8 + bo, 8, 1, dark); R(x, 8, 6 + bo, 1, 7, dark);       // stone seams
      R(x, 4, 6 + bo, 8, 1, '#6d6454');                               // top light
      R(x, 3, 13, 10, 2, deep);                                       // base skirt
      const eyeCol = major >= 2 ? '#ffd76a' : '#e8c96a';
      R(x, 6, 10 + bo, 1, 1, eyeCol); R(x, 9, 10 + bo, 1, 1, eyeCol);
      if (major >= 2) { // knight form: metal side wings
        R(x, 1, 7 + bo, 2, 1, '#8fa8c9'); R(x, 0, 8 + bo, 2, 1, '#5a6b88');
        R(x, 13, 7 + bo, 2, 1, '#8fa8c9'); R(x, 14, 8 + bo, 2, 1, '#5a6b88');
        R(x, 3, 2 + bo, 2, 1, '#e8d98a'); R(x, 11, 2 + bo, 2, 1, '#e8d98a');
      }
    } else {
      disc(x, 8, 8.6, 5.4, '#2c2820');
      disc(x, 8, 8.4, 4.8, '#5c5344');
      R(x, 5, 6, 6, 1, '#463f33'); R(x, 4, 9, 8, 1, '#463f33'); R(x, 6, 11, 4, 1, '#463f33');
      R(x, 7, 3, 2, 2, '#6b6152');
      const l = frame ? 1 : 0;
      R(x, 3, 5 + l, 1, 2, '#3a342a'); R(x, 12, 5 - l, 1, 2, '#3a342a');
      R(x, 2, 9 - l, 1, 2, '#3a342a'); R(x, 13, 9 + l, 1, 2, '#3a342a');
      if (tier >= 2) { R(x, 6, 7, 1, 1, '#7d745f'); R(x, 9, 8, 1, 1, '#7d745f'); }
    }
  } else if (type === 'wisp') {
    const grow = major >= 1 ? 0.7 : 0;
    const r = (frame ? 4.6 : 4.0) + grow;
    disc(x, 8, 8, r + 1.6, 'rgba(160,230,220,0.16)');
    disc(x, 8, 8, r, 'rgba(160,230,220,0.30)');
    disc(x, 8, 8, 2.6 + grow * 0.5, 'rgba(200,245,235,0.62)');
    R(x, 7, 7, 2, 2, '#eafffa');
    if (major >= 1) { R(x, 6, 7, 1, 1, '#8fe8d9'); R(x, 10, 7, 1, 1, '#8fe8d9'); }
  }
  return c;
}

export function dragonCanvas(frame) {
  const c = cv(32, 32), x = ctx2(c);
  // wings
  x.fillStyle = '#3d1512';
  if (frame === 0) {
    x.beginPath(); x.moveTo(7, 12); x.lineTo(0, 4); x.lineTo(6, 20); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(25, 12); x.lineTo(32, 4); x.lineTo(26, 20); x.closePath(); x.fill();
  } else {
    x.beginPath(); x.moveTo(7, 12); x.lineTo(3, 1); x.lineTo(11, 18); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(25, 12); x.lineTo(29, 1); x.lineTo(21, 18); x.closePath(); x.fill();
  }
  x.fillStyle = '#5a201c';
  if (frame === 0) {
    x.beginPath(); x.moveTo(7, 12); x.lineTo(1, 5); x.lineTo(6, 18); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(25, 12); x.lineTo(31, 5); x.lineTo(26, 18); x.closePath(); x.fill();
  } else {
    x.beginPath(); x.moveTo(7, 12); x.lineTo(4, 2); x.lineTo(11, 17); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(25, 12); x.lineTo(28, 2); x.lineTo(21, 17); x.closePath(); x.fill();
  }
  // tail
  x.fillStyle = '#5a201c';
  x.beginPath(); x.moveTo(13, 24); x.quadraticCurveTo(9, 30, 4, 28); x.lineTo(6, 26);
  x.quadraticCurveTo(10, 27, 14, 23); x.closePath(); x.fill();
  // body
  x.fillStyle = '#2e0f0c';
  x.beginPath(); x.ellipse(16, 18, 11, 8, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#6e2a24';
  x.beginPath(); x.ellipse(16, 18, 10, 7, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#8a4234';
  x.beginPath(); x.ellipse(16, 20, 7, 4, 0, 0, Math.PI * 2); x.fill();
  R(x, 12, 19, 9, 1, '#a3563f'); R(x, 13, 21, 7, 1, '#a3563f');
  // neck + head
  x.fillStyle = '#5a201c';
  x.beginPath(); x.ellipse(16, 10, 4, 5, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#7a322a';
  x.beginPath(); x.ellipse(16, 8, 3.6, 3.4, 0, 0, Math.PI * 2); x.fill();
  // horns
  x.fillStyle = '#d9c9a8';
  x.fillRect(13, 3, 1, 3); x.fillRect(18, 3, 1, 3);
  x.fillStyle = '#efe4c8';
  x.fillRect(13, 3, 1, 1); x.fillRect(18, 3, 1, 1);
  // eyes
  R(x, 14, 7, 1, 1, '#ffd76a'); R(x, 17, 7, 1, 1, '#ffd76a');
  // chest ember
  R(x, 16, 17, 2, 2, '#e8a04a');
  return c;
}

// ---------------- player compositor ----------------
// draw order: back attachments -> legs -> body -> arms -> head -> front attachments

// mirror helper: draw fn once, then mirrored around the sprite's center line
function mirrored(x, fn) {
  fn();
  x.save();
  x.translate(15, 0);
  x.scale(-1, 1);
  fn();
  x.restore();
}

// Code-drawn body-part replacements. When an upgrade carries a `sprite` key
// the base part art is HIDDEN and one of these takes its place, so every
// evolution visibly reshapes the creature.
export function partOverride(x, part, kind, frame) {
  const f = frame ? 1 : 0;
  if (part === 'legs') {
    if (kind === 'stride') {
      // two long legs with an exaggerated stride
      const hip = 11;
      mirrored(x, () => {
        line(x, 6, hip, 4 - f, 13, '#5a6b44');
        line(x, 4 - f, 13, 3 - f, 15, '#43522f');
        R(x, 3 - f, 15, 2, 1, '#2f3a22');            // foot
      });
    } else if (kind === 'spider') {
      // eight articulated limbs: hip - raised knee - tip, 4 per side
      const dk = '#2f3a22', lt = '#4c5c34';
      mirrored(x, () => {
        line(x, 6, 9, 3, 6 - f, lt); line(x, 3, 6 - f, 1, 8 + f, dk);   // forward-up
        line(x, 5, 11, 1, 10, lt); line(x, 1, 10, 0, 13 - f, dk);       // mid-out
        line(x, 6, 12, 3, 13, lt); line(x, 3, 13, 1, 15, dk);           // back-down
        line(x, 6, 10, 2, 8 + f, dk); line(x, 2, 8 + f, 0, 11, lt);     // upper-back
        R(x, 3, 6 - f, 1, 1, '#6d7d4c');                                 // knee glint
      });
    } else if (kind === 'deer') {
      mirrored(x, () => {
        line(x, 5, 11, 4, 14, '#a8926a');
        line(x, 6, 11, 6 + f, 15, '#8a765a');
        R(x, 4, 14, 1, 2, '#2c2416');                 // hoof
        R(x, 6 + f, 15, 1, 1, '#2c2416');
      });
    }
  } else if (part === 'arms') {
    if (kind === 'claw') {
      mirrored(x, () => {
        line(x, 3, 8, 1, 6, '#8a6a3a');               // arm
        line(x, 1, 6, 0, 3, '#d9884a');               // claw curve
        line(x, 2, 6, 1, 4, '#e8b06a');               // inner edge
        R(x, 0, 3, 1, 1, '#f2d9a8');                  // tip
      });
    } else if (kind === 'thornfist') {
      mirrored(x, () => {
        R(x, 2, 8, 1, 2, '#5a6b3a');                  // wrist
        R(x, 1, 9, 3, 3, '#6d8a4a');                  // fist
        R(x, 0, 9, 1, 1, '#d9e8b0'); R(x, 3, 9, 1, 1, '#d9e8b0');
        R(x, 1, 12, 1, 1, '#d9e8b0'); R(x, 3, 12, 1, 1, '#d9e8b0');
      });
    } else if (kind === 'scythe') {
      mirrored(x, () => {
        line(x, 4, 9, 2, 10, '#4a3a24');              // handle
        line(x, 4, 6, 1, 4, '#c9c98a');               // blade curve
        line(x, 1, 4, 0, 8, '#c9c98a');
        line(x, 3, 6, 1, 5, '#e8e8b0');               // edge highlight
        R(x, 0, 8, 1, 1, '#f2f2c9');                  // tip
      });
    }
  } else if (part === 'body') {
    if (kind === 'oak') {
      R(x, 4, 4, 8, 9, '#6b5136');
      R(x, 6, 4, 1, 9, '#553f28'); R(x, 9, 4, 1, 9, '#553f28');
      R(x, 4, 4, 1, 9, '#553f28'); R(x, 11, 4, 1, 9, '#553f28');
      R(x, 4, 4, 8, 1, '#5a7a4a');                    // moss rim
      disc(x, 7, 9, 1, '#3d2c1a');                    // knot
      R(x, 5, 5, 2, 1, '#7d6244');                    // grain light
    } else if (kind === 'fern') {
      R(x, 4, 4, 8, 9, '#3f6b42');
      R(x, 7, 4, 1, 9, '#2e5231');                    // stem
      line(x, 7, 6, 5, 5, '#6fa860'); line(x, 7, 6, 10, 5, '#6fa860');
      line(x, 7, 9, 5, 8, '#6fa860'); line(x, 7, 9, 10, 8, '#6fa860');
      line(x, 7, 12, 5, 11, '#6fa860'); line(x, 7, 12, 10, 11, '#6fa860');
    } else if (kind === 'titan') {
      R(x, 3, 3, 10, 10, '#6d736a');
      R(x, 3, 3, 3, 2, '#828884'); R(x, 10, 3, 3, 2, '#828884');   // pauldrons
      R(x, 3, 7, 10, 1, '#4a4f46');                   // seam
      R(x, 3, 3, 10, 1, '#828884');
      R(x, 7, 9, 2, 2, '#9ff0e0');                    // core gem
      R(x, 4, 12, 1, 1, '#4a4f46'); R(x, 11, 12, 1, 1, '#4a4f46'); // rivets
    }
  } else if (part === 'eyes') {
    if (kind === 'keen') {
      R(x, 5, 6, 2, 2, '#ffd76a'); R(x, 9, 6, 2, 2, '#ffd76a');
      R(x, 6, 7, 1, 1, '#1c2418'); R(x, 9, 7, 1, 1, '#1c2418');
      R(x, 5, 6, 1, 1, '#fff8d8'); R(x, 10, 6, 1, 1, '#fff8d8');
    } else if (kind === 'hawk') {
      R(x, 5, 7, 2, 1, '#e8a04a'); R(x, 9, 7, 2, 1, '#e8a04a');
      R(x, 4, 6, 1, 1, '#7a5a2a'); R(x, 6, 6, 1, 1, '#7a5a2a');
      R(x, 9, 6, 1, 1, '#7a5a2a'); R(x, 11, 6, 1, 1, '#7a5a2a');
      R(x, 6, 7, 1, 1, '#1c2418'); R(x, 9, 7, 1, 1, '#1c2418');
    } else if (kind === 'owl') {
      disc(x, 6, 7, 1.7, '#f2ead0'); disc(x, 9, 7, 1.7, '#f2ead0');
      disc(x, 6, 7, 0.9, '#e8c96a'); disc(x, 9, 7, 0.9, '#e8c96a');
      R(x, 6, 7, 1, 1, '#1c2418'); R(x, 9, 7, 1, 1, '#1c2418');
      R(x, 5, 4, 1, 1, '#8a7a5a'); R(x, 10, 4, 1, 1, '#8a7a5a');   // brow feathers
    }
  }
}

export function playerCanvas(P, imgs, frame) {
  const c = cv(16, 16), x = ctx2(c);
  const back = ['wings', 'tail', 'cloak'];
  for (const att of P.attachments) if (back.includes(att.kind)) drawAtt(x, att, frame);
  const ov = P.overrides || {};
  const bob = frame === 1 ? -1 : 0;
  if (P.parts.legs > 0) {
    if (ov.legs) partOverride(x, 'legs', ov.legs, frame);
    else x.drawImage(imgs.legs, 0, 0);
  }
  if (ov.body) partOverride(x, 'body', ov.body, frame);
  else x.drawImage(imgs.body, 0, 0);
  if (P.parts.arms > 0) {
    if (ov.arms) partOverride(x, 'arms', ov.arms, frame);
    else x.drawImage(imgs.arms, 0, bob);
  }
  if (P.head) x.drawImage(imgs.head, 0, bob);
  for (const att of P.attachments) if (!back.includes(att.kind)) drawAtt(x, att, frame);
  if (P.parts.eyes > 0) {
    if (ov.eyes) partOverride(x, 'eyes', ov.eyes, frame);
    else {
      const iris = P.irisColor || '#ffd76a';
      R(x, 5, 7, 1, 1, '#1c2418'); R(x, 6, 7, 1, 1, iris);
      R(x, 10, 7, 1, 1, '#1c2418'); R(x, 9, 7, 1, 1, iris);
    }
  }
  return c;
}

function drawWing(x, att, frame) {
  const col = att.color || '#8fa8c9';
  const dark = shade(col, -0.35);
  const rows = frame === 0
    ? [[0, 0, 3], [-1, 1, 4], [-2, 2, 4], [-1, 3, 3], [0, 4, 2]]
    : [[1, 0, 3], [0, 1, 4], [-1, 2, 4], [0, 3, 3], [1, 4, 2]];
  const paint = () => rows.forEach(([dx, dy, w], i) => R(x, 1 + dx, 4 + dy, w, 1, i < 4 ? col : dark));
  paint();
  x.save();
  x.translate(16, 0);
  x.scale(-1, 1);
  paint();
  x.restore();
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function drawAtt(x, att, frame) {
  const col = att.color || '#b8d98a';
  switch (att.kind) {
    case 'wings': drawWing(x, att, frame); break;
    case 'tail':
      R(x, 6, 12, 4, 1, col);
      R(x, 5 + (frame ? 1 : 0), 13, 3, 1, col);
      R(x, 5 + (frame ? 1 : 0), 14, 1, 1, shade(col, 0.3));
      break;
    case 'cloak':
      x.globalAlpha = 0.85;
      R(x, 3, 4, 10, 9, col);
      x.globalAlpha = 0.5;
      R(x, 4 + (frame ? 1 : 0), 13, 8 - (frame ? 1 : 0), 1, col);
      x.globalAlpha = 1;
      break;
    case 'horns':
      R(x, 5, 1, 1, 2, '#d9c9a8'); R(x, 10, 1, 1, 2, '#d9c9a8');
      R(x, 5, 1, 1, 1, '#efe4c8'); R(x, 10, 1, 1, 1, '#efe4c8');
      break;
    case 'stripe':
      x.globalAlpha = 0.9;
      R(x, 5, 6, 6, 1, col); R(x, 5, 9, 6, 1, col);
      x.globalAlpha = 1;
      break;
    case 'gloves':
      R(x, 1, 9, 3, 2, col); R(x, 12, 9, 3, 2, col);
      break;
    case 'chest':
      R(x, 7, 7, 2, 2, col);
      R(x, 7, 6, 1, 1, shade(col, -0.3)); R(x, 8, 9, 1, 1, shade(col, -0.3));
      break;
    case 'glow':
      x.globalAlpha = 0.7;
      R(x, 3, 5, 1, 1, col); R(x, 12, 5, 1, 1, col); R(x, 8, 3, 1, 1, col);
      x.globalAlpha = 1;
      break;
  }
}

// ---------------- upgrade icons (16x16, upscaled by CSS) ----------------
export function iconCanvas(def) {
  const c = cv(16, 16), x = ctx2(c);
  const col = def.color || '#b8d98a';
  const dk = '#1c2418';
  const k = def.icon || 'body-heart';
  const heart = (ox, oy) => {
    R(x, ox + 1, oy, 2, 1, col); R(x, ox + 5, oy, 2, 1, col);
    R(x, ox, oy + 1, 8, 2, col);
    R(x, ox + 1, oy + 3, 6, 1, col);
    R(x, ox + 2, oy + 4, 4, 1, col);
    R(x, ox + 3, oy + 5, 2, 1, col);
  };
  const shield = (w = 8) => {
    const ox = 8 - w / 2;
    R(x, ox, 4, w, 6, col);
    R(x, ox + 1, 10, w - 2, 1, col);
    R(x, ox + 2, 11, w - 4, 1, col);
    R(x, ox, 4, w, 1, dk);
  };
  const eye = (iris = col) => {
    R(x, 3, 6, 10, 1, col); R(x, 2, 7, 12, 2, col); R(x, 3, 9, 10, 1, col);
    R(x, 7, 7, 2, 2, dk); R(x, 7, 7, 1, 1, iris);
  };
  switch (k) {
    case 'legs-reach':
      for (const ox of [4, 7, 10]) for (let i = 0; i < 4; i++) { R(x, ox + i, 5 + i, 1, 1, col); R(x, ox + i, 10 - i, 1, 1, col); }
      break;
    case 'legs-knight':
      R(x, 5, 4, 2, 8, col); R(x, 5, 10, 5, 2, col); R(x, 10, 8, 1, 2, col);
      R(x, 5, 4, 2, 1, dk);
      break;
    case 'legs-diag':
      for (let i = 0; i < 7; i++) R(x, 4 + i, 11 - i, 1, 1, col);
      R(x, 10, 3, 2, 2, col); R(x, 3, 6, 1, 1, dk); R(x, 6, 3, 1, 1, dk);
      break;
    case 'arms-claw':
      for (let s = 0; s < 3; s++) for (let i = 0; i < 6; i++) R(x, 3 + s * 4 + i, 4 + i, 1, 1, s === 1 ? col : shade(col, -0.2));
      break;
    case 'arms-thorn':
      R(x, 5, 6, 6, 5, col); R(x, 6, 5, 4, 1, col);
      R(x, 4, 5, 1, 1, col); R(x, 11, 5, 1, 1, col); R(x, 4, 11, 1, 1, col); R(x, 11, 11, 1, 1, col);
      R(x, 7, 7, 2, 2, dk);
      break;
    case 'arms-sweep':
      for (let a = 0; a < 24; a++) {
        const ang = Math.PI + (a / 24) * Math.PI;
        R(x, Math.round(8 + Math.cos(ang) * 5), Math.round(10 + Math.sin(ang) * 5), 1, 1, col);
      }
      R(x, 7, 9, 2, 2, dk);
      break;
    case 'body-heart': heart(4, 5); break;
    case 'body-shield': shield(8); break;
    case 'body-titan': shield(10); R(x, 7, 7, 2, 2, '#fff2c9'); break;
    case 'eyes-eye': eye(); break;
    case 'eyes-owl': eye('#a8c9d9'); R(x, 4, 4, 8, 1, col); break;
    case 'u-ember':
      R(x, 7, 2, 2, 2, col); R(x, 6, 4, 4, 3, col); R(x, 5, 7, 6, 4, col);
      R(x, 6, 11, 4, 1, col); R(x, 7, 8, 2, 3, '#fff2c9');
      break;
    case 'u-regen':
      for (let a = 0; a < 26; a++) {
        const t = a / 26 * Math.PI * 2.2, r = 0.8 + a * 0.22;
        R(x, Math.round(8 + Math.cos(t) * r), Math.round(8 + Math.sin(t) * r), 1, 1, col);
      }
      break;
    case 'u-fury':
      for (let i = 0; i < 4; i++) R(x, 3 + i, 12 - i, 1, 1, col);
      for (let i = 0; i < 4; i++) R(x, 9 + i, 6 - i, 1, 1, col);
      R(x, 7, 8, 2, 2, col);
      break;
    case 'u-instinct':
      R(x, 7, 6, 2, 2, col);
      R(x, 7, 2, 2, 1, col); R(x, 7, 11, 2, 1, col); R(x, 2, 6, 1, 2, col); R(x, 11, 6, 1, 2, col);
      R(x, 4, 4, 1, 1, shade(col, 0.3)); R(x, 11, 4, 1, 1, shade(col, 0.3));
      R(x, 4, 9, 1, 1, shade(col, 0.3)); R(x, 11, 9, 1, 1, shade(col, 0.3));
      break;
    case 'u-iron': shield(8); R(x, 4, 7, 8, 1, dk); R(x, 5, 7, 6, 1, shade(col, 0.35)); break;
    case 'u-blood':
      R(x, 7, 3, 2, 2, col); R(x, 6, 5, 4, 3, col); R(x, 5, 8, 6, 2, col);
      R(x, 6, 10, 4, 1, col); R(x, 7, 11, 2, 1, col);
      break;
    case 'u-focus':
      for (let a = 0; a < 28; a++) {
        const ang = (a / 28) * Math.PI * 2;
        R(x, Math.round(8 + Math.cos(ang) * 5), Math.round(8 + Math.sin(ang) * 5), 1, 1, col);
      }
      R(x, 7, 7, 2, 2, col); R(x, 8, 2, 1, 3, col); R(x, 8, 11, 1, 3, col);
      R(x, 2, 8, 3, 1, col); R(x, 11, 8, 3, 1, col);
      break;
    case 'u-vigor': heart(4, 6); R(x, 7, 2, 2, 2, col); R(x, 6, 3, 4, 1, col); break;
    case 'u-growth':
      R(x, 7, 6, 2, 7, col);
      R(x, 5, 5, 6, 1, col); R(x, 6, 4, 4, 1, col); R(x, 7, 3, 2, 1, col);
      break;
    case 'u-horizon':
      R(x, 2, 10, 12, 1, col);
      for (let a = 0; a < 16; a++) {
        const ang = Math.PI + (a / 15) * Math.PI;
        R(x, Math.round(8 + Math.cos(ang) * 4), Math.round(10 + Math.sin(ang) * 4), 1, 1, col);
      }
      R(x, 1, 8, 1, 1, col); R(x, 14, 8, 1, 1, col);
      break;
    case 'new-wings':
      R(x, 7, 6, 2, 3, dk);
      for (let i = 0; i < 5; i++) { R(x, 2 + i, 5 + i, 5 - i, 1, col); R(x, 9, 5 + i, 5 - i, 1, col); }
      break;
    case 'new-tail':
      R(x, 3, 10, 10, 1, col); R(x, 4, 8, 1, 3, col); R(x, 11, 7, 1, 4, col);
      R(x, 11, 6, 1, 1, shade(col, 0.35));
      break;
    case 'new-cloak':
      R(x, 5, 3, 6, 4, col); R(x, 4, 6, 8, 5, col);
      R(x, 4, 11, 2, 2, col); R(x, 10, 11, 2, 2, col);
      R(x, 7, 4, 2, 2, dk);
      break;
    case 'new-horns':
      R(x, 4, 10, 2, 3, col); R(x, 10, 10, 2, 3, col);
      R(x, 3, 6, 2, 5, shade(col, 0.25)); R(x, 11, 6, 2, 5, shade(col, 0.25));
      R(x, 3, 5, 1, 2, col); R(x, 12, 5, 1, 2, col);
      break;
    default: heart(4, 5);
  }
  return c;
}
