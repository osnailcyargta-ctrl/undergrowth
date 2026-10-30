// UNDERGROWTH - fullscreen triangle for the realtime lightmap pass.
// One fragment = one world tile; the lightmap FBO is sized to the tile window.

void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
