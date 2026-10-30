// UNDERGROWTH - procedural body upgrade generator (rule-based, no LLM).
// Each evolution roll may offer fresh, never-repeating upgrades: it picks the
// body part, a name that matches the stats, level-scaled numbers, and a
// visual instruction (color + attachment kind) so the sprite can be redrawn.

import { S, mulberry32 } from './state.js';

let n = 0;
const usedNames = new Set();

const ADJ = [
  ['Moss', 'Dew', 'Fern', 'Willow'],      // early
  ['Thorn', 'Amber', 'Bramble', 'Sap'],   // mid
  ['Elder', 'Verdant', 'Umbral', 'Storm'], // late
];
const NOUNS = {
  legs: ['Stride', 'Step', 'Pace', 'Gait'],
  arms: ['Claws', 'Fists', 'Grip', 'Strike'],
  body: ['Heart', 'Hide', 'Carapace', 'Bulk'],
  eyes: ['Eyes', 'Gaze', 'Sight', 'Pupil'],
};
const PART_COLOR = { legs: '#9fd08a', arms: '#d9884a', body: '#7a9a5a', eyes: '#e8c96a' };

const NEW_BODIES = [
  { kind: 'wings', noun: 'Wings',  icon: 'new-wings',  color: '#8fa8c9', tags: (l) => ({ fly: 1, reachDiag: 2 }) },
  { kind: 'tail',  noun: 'Tail',   icon: 'new-tail',   color: '#b88a4a', tags: (l) => ({ thorns: l >= 6 ? 2 : 1, maxHp: 3 }) },
  { kind: 'cloak', noun: 'Cloak',  icon: 'new-cloak',  color: '#5a7a6a', tags: (l) => ({ def: 1, maxHp: 4 }) },
  { kind: 'horns', noun: 'Horns',  icon: 'new-horns',  color: '#d9c9a8', tags: (l) => ({ atk: 1, vision: 1 }) },
];

function describe(t) {
  const d = [];
  if (t.atk) d.push(`+${t.atk % 1 ? t.atk.toFixed(1) : t.atk} ATK`);
  if (t.maxHp) d.push(`+${t.maxHp} max HP`);
  if (t.def) d.push(`+${t.def} DEF`);
  if (t.vision) d.push(`+${t.vision} Sight`);
  if (t.reachStraight) d.push(`Straight reach ${t.reachStraight}`);
  if (t.reachDiag) d.push(`Diagonal reach ${t.reachDiag}`);
  if (t.knight) d.push('Knight jumps');
  if (t.fly) d.push('Fly over trees');
  if (t.thorns) d.push(`Thorns ${t.thorns}`);
  if (t.crit) d.push(`+${t.crit}% crit`);
  if (t.evade) d.push(`+${t.evade}% evade`);
  if (t.owl) d.push('Sense the altar');
  return d;
}

function uniqueName(rng, adj, noun) {
  for (let i = 0; i < 8; i++) {
    const a = ADJ[(rng() * ADJ.length) | 0][(rng() * 4) | 0];
    const name = `${a} ${noun}`;
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
  }
  const name = `${adj} ${noun} ${++n}`;
  usedNames.add(name);
  return name;
}

function genPart(level, rng) {
  const parts = ['legs', 'arms', 'body', 'eyes'];
  const part = parts[(rng() * 4) | 0];
  const tier = level < 4 ? 0 : level < 8 ? 1 : 2;
  const adj = ADJ[tier][(rng() * 4) | 0];
  const noun = NOUNS[part][(rng() * 4) | 0];
  const name = uniqueName(rng, adj, noun);
  let tags = {}, att = null, icon;
  if (part === 'legs') {
    const r = rng();
    if (r < 0.4) { tags = { reachStraight: tier >= 2 ? 3 : 2 }; icon = 'legs-reach'; att = { kind: 'stripe', color: '#9fd08a' }; }
    else if (r < 0.75) { tags = { evade: [4, 6, 9][tier] }; icon = 'legs-diag'; att = { kind: 'stripe', color: '#c9b98a' }; }
    else { tags = { atk: 1 }; icon = 'legs-reach'; att = { kind: 'gloves', color: '#9fd08a' }; }
  } else if (part === 'arms') {
    const r = rng();
    if (r < 0.4) { tags = { atk: [2, 3, 4][tier] }; icon = 'arms-claw'; att = { kind: 'gloves', color: '#d9884a' }; }
    else if (r < 0.7) { tags = { atk: 1, thorns: tier >= 2 ? 2 : 1 }; icon = 'arms-thorn'; att = { kind: 'gloves', color: '#8aa65a' }; }
    else { tags = { crit: [3, 4, 6][tier] }; icon = 'arms-sweep'; att = { kind: 'glow', color: '#e8c96a' }; }
  } else if (part === 'body') {
    const r = rng();
    if (r < 0.4) { tags = { maxHp: [4, 7, 10][tier] + ((rng() * 3) | 0) }; icon = 'body-heart'; att = { kind: 'chest', color: '#7a9a5a' }; }
    else if (r < 0.7) { tags = { def: 1 }; icon = 'body-shield'; att = { kind: 'chest', color: '#5a8a6a' }; }
    else { tags = { maxHp: [5, 8, 12][tier], def: 1 }; icon = 'body-titan'; att = { kind: 'chest', color: '#9a8a5a' }; }
  } else {
    const r = rng();
    if (r < 0.6) { tags = { vision: 1 }; icon = 'eyes-eye'; att = { kind: 'iris', color: ['#ffd76a', '#7fe3d0', '#d98ae8', '#a8d9ff'][(rng() * 4) | 0] }; }
    else { tags = { vision: 1, crit: 2 }; icon = 'eyes-owl'; att = { kind: 'iris', color: ['#7fe3d0', '#d98ae8', '#a8d9ff'][(rng() * 3) | 0] }; }
  }
  return {
    id: 'gen' + (++n), part, header: `${part} upgrade`,
    name, desc: describe(tags), tags, att, icon, color: PART_COLOR[part],
  };
}

function genNew(level, rng) {
  const P = S.player;
  const have = new Set(P.attachments.map((a) => a.kind));
  let pool = NEW_BODIES.filter((b) => !have.has(b.kind));
  if (!pool.length) pool = NEW_BODIES;
  const t = pool[(rng() * pool.length) | 0];
  const tier = level < 4 ? 0 : level < 8 ? 1 : 2;
  const adj = ADJ[tier][(rng() * 4) | 0];
  const name = uniqueName(rng, adj, t.noun);
  const tags = t.tags(level);
  return {
    id: 'gen' + (++n), part: 'new', header: 'new body upgrade',
    name, desc: describe(tags), tags,
    att: { kind: t.kind, color: t.color }, icon: t.icon, color: t.color,
  };
}

// two fresh candidates per evolution roll
export function candidates(level) {
  const rng = mulberry32((S.seed ^ (level * 7919)) + n * 104729 + S.turn * 31);
  const out = [];
  const P = S.player;
  for (let i = 0; i < 2; i++) {
    const forceNew = !P.hasNewBody && level >= 3 && i === 0;
    const isNew = forceNew || (level >= 2 && rng() < 0.28);
    out.push(isNew ? genNew(level, rng) : genPart(level, rng));
  }
  return out;
}
