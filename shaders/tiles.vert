// UNDERGROWTH - instanced ground tiles.
// Per-instance: tile center, texture-array layer, fog-of-war visibility, baked AO.

layout(location = 0) in vec2 aPos;    // quad corner, +/- 0.5
layout(location = 1) in vec2 aUv;
layout(location = 2) in vec2 aTile;   // world tile center (instanced)
layout(location = 3) in float aLayer; // texture array layer (instanced)
layout(location = 4) in float aVis;   // visibility factor (instanced)
layout(location = 5) in float aAO;    // ambient occlusion (instanced)

uniform vec2 uCam;
uniform vec2 uRes;
uniform float uScale;

out vec2 vUv;
out vec2 vWorld;
out float vLayer;
out float vVis;
out float vAO;

void main() {
  vec2 wp = aTile + aPos;
  vWorld = wp;
  vUv = aUv;
  vLayer = aLayer;
  vVis = aVis;
  vAO = aAO;
  vec2 px = (wp - uCam) * uScale + uRes * 0.5;
  vec2 ndc = px / uRes * 2.0 - 1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
