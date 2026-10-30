// UNDERGROWTH - lit entity fragment: forest lighting + hit flash + fog fade.

in vec2 vUv;
in vec2 vWorld;

uniform sampler2D uTex;
uniform float uVis;     // 0 = in fog, 1 = fully visible
uniform float uFlash;   // white hit flash
uniform vec4 uTint;     // rgb multiplier, a alpha

out vec4 outColor;

void main() {
  vec4 t = texture(uTex, vUv) * uTint;
  if (t.a < 0.02) discard;
  vec3 c = t.rgb * forestLight(vWorld) * uVis;
  c = mix(c, vec3(1.0, 0.98, 0.9), uFlash);
  outColor = vec4(c, t.a);
}
