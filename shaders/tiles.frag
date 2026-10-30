// UNDERGROWTH - ground fragment: forest lighting, dithered fog-of-war edge, AO.

in vec2 vUv;
in vec2 vWorld;
in float vLayer;
in float vVis;
in float vAO;

uniform sampler2DArray uTiles;

out vec4 outColor;

void main() {
  vec4 t = texture(uTiles, vec3(vUv, vLayer));
  vec3 c = t.rgb * forestLight(vWorld);

  // fog of war: hash-dithered edge so the boundary breathes instead of cutting
  float n = hash21(vWorld * 0.9 + floor(uTime * 2.0) * 0.37);
  float vis = clamp(vVis + (n - 0.5) * 0.22, 0.0, 1.0);
  vec3 fogC = vec3(0.012, 0.021, 0.015);
  c = mix(fogC, c, vis);

  c *= vAO;
  outColor = vec4(c, 1.0);
}
