// UNDERGROWTH - soft round particle, premultiplied for additive blending.

in vec4 vColor;

out vec4 outColor;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * vColor.a;
  outColor = vec4(vColor.rgb * a, a);
}
