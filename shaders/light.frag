// UNDERGROWTH - the actual lighting shader.
// One texel per world tile. Every light SHADOW-MARCHES a ray from its origin
// to this tile through an occluder texture (trees, rocks, walls, jungle
// trunks, canopies, tents, chests, mobs - everything solid eats light), so
// light no longer bleeds through the forest. Emissive ground (blessed altar
// tiles) glows on its own. Everything here is computed per frame = realtime.

uniform sampler2D uOccl;   // RG8: R = occlusion 0..1, G = emissive 0..1
uniform vec2 uLCam;        // window origin (world tiles)
uniform vec2 uLSize;       // window size (tiles)

out vec4 outColor;

vec2 occlAt(vec2 p) {
  vec2 t = clamp(floor(p - uLCam), vec2(0.0), uLSize - 1.0);
  return texelFetch(uOccl, ivec2(t), 0).rg;
}

void main() {
  vec2 tile = uLCam + floor(gl_FragCoord.xy);
  vec2 frag = tile;                     // this tile's center: world tile centers are integers
  vec2 own = occlAt(frag);

  // cold moonlit ambient
  vec3 acc = vec3(0.135, 0.175, 0.150);

  for (int i = 0; i < MAXL; i++) {
    if (float(i) >= uLightN) break;
    vec3 L = uLightPos[i];
    float d = distance(L.xy, frag);
    float fall = smoothstep(L.z, L.z * 0.18, d);
    if (fall <= 0.001) continue;

    // shadow ray: march from the light to this tile, every solid tile eats light
    int steps = int(ceil(d / 0.38));
    float trans = 1.0;
    for (int s = 1; s <= steps; s++) {
      float t = float(s) / float(steps);
      float o = occlAt(mix(L.xy, frag, t)).r;
      float w = (s == steps) ? 0.55 : 1.0;   // the last tile soft-shadows itself
      trans *= 1.0 - o * w;
      if (trans < 0.04) { trans = 0.0; break; }
    }
    acc += uLightCol[i] * fall * trans;
  }

  // emissive blessed ground breathes on its own
  acc += vec3(0.30, 0.85, 0.75) * own.g * (0.75 + 0.25 * sin(uTime * 2.3 + tile.x * 0.7 + tile.y * 1.1));

  outColor = vec4(acc, 1.0);
}
