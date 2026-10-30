// UNDERGROWTH - asset loading.
// The ONLY image assets are the 4 baked base sprites (head/body/legs/arms).
// Tiles are assembled into a texture array; everything else is drawn live
// in code (see spritegen.js).

import { texArrayFromCanvases, texFromCanvas } from './gl.js';
import * as SG from './spritegen.js';

function loadImg(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Missing asset: ' + src));
    img.src = src;
  });
}

export async function loadAssets(gl) {
  const imgs = {};
  for (const n of ['head', 'body', 'legs', 'arms']) {
    imgs[n] = await loadImg(`assets/${n}.png`);
  }

  // ground tile texture array
  const tiles = SG.makeTiles();
  const tilesTex = texArrayFromCanvases(gl, tiles, 16);

  // shared live-generated textures
  const shadowTex = texFromCanvas(gl, SG.shadowCanvas());
  const moteTex = texFromCanvas(gl, SG.moteCanvas());
  const crystalTex = texFromCanvas(gl, SG.crystalCanvas());
  const whiteTex = texFromCanvas(gl, SG.whiteCanvas());

  return { imgs, tilesTex, tileCount: tiles.length, shadowTex, moteTex, crystalTex, whiteTex };
}
