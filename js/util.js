// UNDERGROWTH - tiny shared utils.

export const now = () => performance.now();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const ease = (t) => t * t * (3 - 2 * t);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
