// UNDERGROWTH - soft blob shadow under every creature.

in vec2 vUv;
in vec2 vWorld;

uniform sampler2D uTex;
uniform float uAlpha;

out vec4 outColor;

void main() {
  float a = texture(uTex, vUv).a * uAlpha;
  outColor = vec4(0.0, 0.0, 0.0, a);
}
