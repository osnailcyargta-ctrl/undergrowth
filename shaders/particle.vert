// UNDERGROWTH - GPU point-sprite particles (additive).

layout(location = 0) in vec2 aPos;    // world pos
layout(location = 1) in float aSize;  // size in tiles
layout(location = 2) in vec4 aColor;

uniform vec2 uCam;
uniform vec2 uRes;
uniform float uScale;

out vec4 vColor;

void main() {
  vColor = aColor;
  vec2 px = (aPos - uCam) * uScale + uRes * 0.5;
  vec2 ndc = px / uRes * 2.0 - 1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = max(aSize * uScale, 1.0);
}
