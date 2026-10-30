// UNDERGROWTH - ground fragment: realtime shadowed lightmap, dithered
// fog-of-war edge, AO.

in vec2 vUv;
in vec2 vWorld;
in float vLayer;
in float vVis;
in float vAO;

uniform sampler2DArray uTiles;
uniform sampler2D uLightmap;  // 1 texel per tile, computed per frame with shadows
uniform vec4 uLRect;          // lightmap window: x0, y0, w, h (world tiles)

out vec4 outColor;

void main() {
  vec4 t = texture(uTiles, vec3(vUv, vLayer));
  // +0.5 so a tile's center lands exactly on its lightmap texel center
  vec3 light = texture(uLightmap, (vWorld - uLRect.xy + 0.5) / uLRect.zw).rgb;
  vec3 c = t.rgb * light;

  // fog of war: hash-dithered edge so the boundary breathes instead of cutting
  float n = hash21(vWorld * 0.9 + floor(uTime * 2.0) * 0.37);
  float vis = clamp(vVis + (n - 0.5) * 0.22, 0.0, 1.0);
  vec3 fogC = vec3(0.012, 0.021, 0.015);
  c = mix(fogC, c, vis);

  c *= vAO;
  outColor = vec4(c, 1.0);
}
