// UNDERGROWTH - shared GLSL chunk, prepended to every fragment shader by the loader.
// Dynamically-lit forest: up to 6 point lights (player, altar, dragon, ...).

precision highp float;
precision highp sampler2DArray;

const int MAXL = 6;
uniform vec3 uLightPos[MAXL];   // xy = world pos, z = radius (tiles)
uniform vec3 uLightCol[MAXL];
uniform float uLightN;
uniform float uTime;

vec3 forestLight(vec2 wp) {
  vec3 acc = vec3(0.155, 0.195, 0.165);          // cold moonlit ambient
  for (int i = 0; i < MAXL; i++) {
    if (float(i) >= uLightN) break;
    vec3 L = uLightPos[i];
    float d = distance(wp, L.xy);
    float a = smoothstep(L.z, L.z * 0.2, d);      // soft falloff, hot core
    acc += uLightCol[i] * a;
  }
  return acc;
}

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
