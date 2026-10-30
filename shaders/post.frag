// UNDERGROWTH - post-processing: color grade, vignette, grain, damage flash,
// evolve bloom, boss heartbeat, altar countdown urgency.

in vec2 vUv;

uniform sampler2D uScene;
uniform vec2 uRes;
// uTime comes from common.glsl
uniform float uDmg;    // 0..1 red damage flash
uniform float uEvo;    // 0..1 golden evolve flash
uniform float uBoss;   // 0..1 dragon alive
uniform float uCount;  // 0..1 altar countdown urgency

out vec4 outColor;

void main() {
  vec3 c = texture(uScene, vUv).rgb;

  // gentle grade: cooler shadows, greener mids
  c = pow(c, vec3(0.92, 0.96, 0.90));
  c *= vec3(0.98, 1.045, 0.99);

  // vignette
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  float vig = smoothstep(0.95, 0.32, length(q));
  c *= 0.52 + 0.48 * vig;

  // film grain
  float g = hash21(vUv * uRes * 0.5 + fract(uTime) * 173.0);
  c += (g - 0.5) * 0.05;

  // damage: blood at the edges
  c = mix(c, vec3(0.55, 0.04, 0.04), clamp(uDmg * (1.0 - vig) * 1.4, 0.0, 1.0));

  // evolve: golden bloom
  c += vec3(1.0, 0.78, 0.30) * uEvo * (0.30 + 0.70 * (1.0 - vig));

  // boss presence: slow crimson heartbeat on the edges
  float beat = 0.5 + 0.5 * sin(uTime * 4.6);
  c = mix(c, vec3(0.42, 0.03, 0.03), uBoss * beat * (1.0 - vig) * 0.85);

  // altar countdown urgency
  c = mix(c, vec3(0.5, 0.06, 0.03), uCount * beat * (1.0 - vig));

  outColor = vec4(c, 1.0);
}
