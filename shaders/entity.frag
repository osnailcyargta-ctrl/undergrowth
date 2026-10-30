// UNDERGROWTH - lit entity fragment: realtime shadowed lightmap, optional
// sprite rotation (boss bones tumble), hit flash, fog fade.

in vec2 vUv;
in vec2 vWorld;

uniform sampler2D uTex;
uniform sampler2D uLightmap;  // 1 texel per tile, computed per frame with shadows
uniform vec4 uLRect;          // lightmap window: x0, y0, w, h (world tiles)
uniform float uVis;     // 0 = in fog, 1 = fully visible
uniform float uFlash;   // white hit flash
uniform vec4 uTint;     // rgb multiplier, a alpha
uniform float uRot;     // sprite rotation (radians, around the center)

out vec4 outColor;

void main() {
  vec2 uv = vUv - 0.5;
  float cs = cos(uRot), sn = sin(uRot);
  uv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs) + 0.5;
  vec4 t = texture(uTex, uv) * uTint;
  if (t.a < 0.02) discard;
  // +0.5 so a tile's center lands exactly on its lightmap texel center
  vec3 light = texture(uLightmap, (vWorld - uLRect.xy + 0.5) / uLRect.zw).rgb;
  vec3 c = t.rgb * light * uVis;
  c = mix(c, vec3(1.0, 0.98, 0.9), uFlash);
  outColor = vec4(c, t.a);
}
