// UNDERGROWTH - generic textured/flat quad (entities, shadows, overlays).
// Tile space: 1.0 = one world tile. The scene is rendered into a low-res FBO,
// then post-processed, giving the whole game a consistent pixel look.

layout(location = 0) in vec2 aPos;   // quad corner, +/- 0.5
layout(location = 1) in vec2 aUv;

uniform vec2 uPos;      // world center
uniform vec2 uSize;     // world size (tiles)
uniform vec2 uCam;      // camera center (world)
uniform vec2 uRes;      // scene FBO size (px)
uniform float uScale;   // pixels per tile inside the FBO

out vec2 vUv;
out vec2 vWorld;

void main() {
  vec2 wp = uPos + aPos * uSize;
  vWorld = wp;
  vUv = aUv;
  vec2 px = (wp - uCam) * uScale + uRes * 0.5;
  vec2 ndc = px / uRes * 2.0 - 1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
