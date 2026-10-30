// UNDERGROWTH - THE FORGE: the upgrade-generating AI, written 100% from
// scratch for this game. No LLM, no network, no copied code - a local
// rule-driven generator that "understands" what it is building:
//
//   1. it knows the body part it is reshaping and picks effects that fit it,
// 2. it scales every number to the level the upgrade first appears at,
//   3. it composes a NAME from banks that match the primary effect, the
//      evolution tier and a forest theme whose color palette then drives the
//      redrawn sprite (name, stats and look always agree),
//   4. it writes the DESCRIPTION: stat lines only, never flavor text,
//   5. it emits a full visual instruction - a seeded parametric shape for the
//      body part (the base art is hidden and replaced) plus an optional
//      attachment - so js/spritegen.js can draw it live in code.
//
// The space is genuinely infinite: themes x forms x effect branches x level
// scaling x a uniqueness memory that never offers the same name twice.

import { S, mulberry32 } from './state.js';

let n = 0;                    // forge counter (ids + in-game seed drift)
const usedNames = new Set();  // never repeat a name within a session

// ---------------------------------------------------------------- helpers
const pick = (r, arr) => arr[(r() * arr.length) | 0];
const chance = (r, p) => r() < p;

// evolution tier from the level the upgrade is forged at
export const tierOf = (lv) => (lv < 4 ? 0 : lv < 8 ? 1 : lv < 14 ? 2 : 3);
export const rarityOf = (def) => def.rarity;

// ---------------------------------------------------------------- themes
// Each theme carries its own adjective and a color palette; the palette
// becomes the sprite color, so a "Gilded" upgrade really is gold-tinted.
const THEMES = [
  // tier 0 - soft undergrowth
  { t: 0, w: 'Moss',    c: '#7a9a5a' }, { t: 0, w: 'Fern',   c: '#5a8a6a' },
  { t: 0, w: 'Dew',     c: '#9fd0c0' }, { t: 0, w: 'Willow', c: '#8aa87a' },
  { t: 0, w: 'Sap',     c: '#c9b86a' }, { t: 0, w: 'Petal',  c: '#c9a0b0' },
  // tier 1 - sharpened midgame
  { t: 1, w: 'Thorn',   c: '#8aa65a' }, { t: 1, w: 'Amber',  c: '#d9a84a' },
  { t: 1, w: 'Bramble', c: '#6a8a4a' }, { t: 1, w: 'Rust',   c: '#b87a4a' },
  { t: 1, w: 'Silk',    c: '#b8c9d9' }, { t: 1, w: 'Venom',  c: '#9ab84a' },
  // tier 2 - the deep woods answer back
  { t: 2, w: 'Elder',   c: '#7a8a5a' }, { t: 2, w: 'Verdant', c: '#4a9a6a' },
  { t: 2, w: 'Umbral',  c: '#5a6a8a' }, { t: 2, w: 'Storm',  c: '#6a7a9a' },
  { t: 2, w: 'Gilded',  c: '#d9c96a' }, { t: 2, w: 'Hollow', c: '#7a7a8a' },
  // tier 3 - myth-tier
  { t: 3, w: 'Ancient', c: '#8a7a5a' }, { t: 3, w: 'Primal', c: '#5a8a5a' },
  { t: 3, w: 'Abyssal', c: '#4a5a7a' }, { t: 3, w: 'Lunar',  c: '#a8c0d9' },
  { t: 3, w: 'Solar',   c: '#e8c96a' }, { t: 3, w: 'Blooded', c: '#b85a5a' },
];

// optional middle word, driven by tier (kept short - no ridiculous names)
const INTENS = [
  ['Young', 'Lesser', 'Wild'],
  ['Keen', 'Greater', 'Wild'],
  ['Grand', 'Elder', 'Feral'],
  ['Prime', 'Ancient', 'Feral'],
];

// ---------------------------------------------------------------- nouns
// Nouns are keyed by the PRIMARY effect, so the name always matches what
// the upgrade actually does (and what the sprite becomes).
const NOUNS = {
  legs: {
    reachStraight: ['Stride', 'Gait', 'Pace', 'Lunge', 'Stride'],
    reachDiag:     ['Veer', 'Slope', 'Angle', 'Drift'],
    knight:        ['Spring', 'Vault', 'Bound', 'Hop'],
    evade:         ['Dart', 'Weave', 'Slip', 'Flicker'],
    atk:           ['Kick', 'Stomp', 'Hoof'],
  },
  arms: {
    atk:      ['Claws', 'Fangs', 'Talons', 'Edge', 'Bite'],
    crit:     ['Aim', 'Focus', 'Glint'],
    thorns:   ['Quills', 'Spurs', 'Bristle'],
    cleave:   ['Sweep', 'Reap', 'Scythe'],
    lastFury: ['Rage', 'Fury', 'Rout'],
    reachStraight: ['Reach', 'Grasp', 'Extend'],
  },
  body: {
    maxHp:  ['Heart', 'Bulk', 'Hide', 'Mass', 'Chest'],
    def:    ['Bark', 'Plating', 'Carapace', 'Shell'],
    thorns: ['Thorns', 'Spikes', 'Bristle'],
    regen:  ['Bloom', 'Mend', 'Sprout'],
  },
  eyes: {
    vision:   ['Eyes', 'Gaze', 'Sight', 'Pupil', 'Lens'],
    crit:     ['Glint', 'Focus', 'Aim'],
    evade:    ['Sides', 'Flicker', 'Periphery'],
    expBonus: ['Instinct', 'Insight', 'Sense'],
    owl:      ['Owl', 'Oracle', 'Watcher'],
  },
  new: {
    wings:  ['Wings', 'Pinions'],
    tail:   ['Tail', 'Lash', 'Banner'],
    cloak:  ['Cloak', 'Shroud', 'Mantle'],
    horns:  ['Horns', 'Crown', 'Antlers'],
    spines: ['Spines', 'Ridge', 'Crest'],
    orb:    ['Orb', 'Lantern', 'Comet'],
  },
};

// ---------------------------------------------------------------- new bodies
const NEW_BODIES = [
  { kind: 'wings',  icon: 'new-wings',  min: 3, tags: (lv) => ({ fly: 1, reachDiag: lv >= 8 ? 3 : 2 }) },
  { kind: 'tail',   icon: 'new-tail',   min: 1, tags: (lv) => ({ thorns: lv >= 6 ? 2 : 1, maxHp: 3 }) },
  { kind: 'cloak',  icon: 'new-cloak',  min: 1, tags: (lv) => ({ def: 1, maxHp: lv >= 8 ? 6 : 4 }) },
  { kind: 'horns',  icon: 'new-horns',  min: 1, tags: () => ({ atk: 1, vision: 1 }) },
  { kind: 'spines', icon: 'new-spines', min: 5, tags: (lv) => ({ thorns: lv >= 10 ? 3 : 2, def: 1 }) },
  { kind: 'orb',    icon: 'new-orb',    min: 5, tags: (lv) => ({ crit: lv >= 12 ? 5 : 3, vision: 1 }) },
];

// ---------------------------------------------------------------- effects
// Weighted effect rolls per body part. `num` scales with the evolution tier
// T (0..3) unless a flat rule says otherwise. Exotic effects are gated by
// level so the forge grows with you.
const ROLLS = {
  legs: [
    { w: 30, exotic: 0, icon: 'legs-reach', num: (T) => [2, 2, 3, 3][T] + (T >= 2 && Math.random() < 0.35 ? 1 : 0), tags: (v) => ({ reachStraight: v }) },
    { w: 24, exotic: 0, icon: 'legs-diag',  num: (T) => [2, 2, 2, 3][T], tags: (v) => ({ reachDiag: v }) },
    { w: 20, exotic: 0, icon: 'legs-diag',  num: (T) => [4, 6, 8, 11][T], tags: (v) => ({ evade: v }) },
    { w: 14, exotic: 1, icon: 'legs-reach', min: 5, num: () => 1, tags: () => ({ atk: 1 }) },
    { w: 12, exotic: 2, icon: 'legs-knight', min: 5, num: () => 1, tags: () => ({ knight: 1, evade: 2 }) },
  ],
  arms: [
    { w: 34, exotic: 0, icon: 'arms-claw',  num: (T) => [2, 3, 4, 5][T], tags: (v) => ({ atk: v }) },
    { w: 22, exotic: 0, icon: 'arms-sweep', num: (T) => [3, 4, 6, 8][T], tags: (v) => ({ crit: v }) },
    { w: 18, exotic: 0, icon: 'arms-thorn', num: (T) => [1, 1, 2, 2][T], tags: (v) => ({ atk: 1, thorns: v }) },
    { w: 12, exotic: 1, icon: 'arms-sweep', min: 4, num: () => 1, tags: () => ({ cleave: 1, atk: 1 }) },
    { w: 8,  exotic: 1, icon: 'arms-claw',  num: () => 2, tags: (v) => ({ reachStraight: v }) },
    { w: 6,  exotic: 2, icon: 'arms-claw',  min: 7, num: () => 1, tags: () => ({ lastFury: 1, atk: 1 }) },
  ],
  body: [
    { w: 32, exotic: 0, icon: 'body-heart',  num: (T) => [5, 8, 11, 15][T] + ((Math.random() * 3) | 0), tags: (v) => ({ maxHp: v }) },
    { w: 22, exotic: 0, icon: 'body-shield', num: (T) => [1, 1, 2, 2][T], tags: (v, T) => (T >= 2 ? { def: v, maxHp: 3 } : { def: v }) },
    { w: 18, exotic: 0, icon: 'arms-thorn',  num: (T) => [1, 2, 2, 3][T], tags: (v) => ({ thorns: v, maxHp: 2 }) },
    { w: 16, exotic: 0, icon: 'body-titan',  num: (T) => [6, 9, 12, 16][T], tags: (v, T) => ({ maxHp: v, def: T >= 1 ? 1 : 0 }) },
    { w: 12, exotic: 2, icon: 'body-heart',  min: 6, num: () => 1, tags: () => ({ regen: 1, maxHp: 3 }) },
  ],
  eyes: [
    { w: 34, exotic: 0, icon: 'eyes-eye', num: (T) => [1, 1, 2, 2][T], tags: (v, T) => (Math.random() < 0.3 ? { vision: v, crit: 2 } : { vision: v }) },
    { w: 20, exotic: 0, icon: 'eyes-eye', num: (T) => [3, 5, 7, 9][T], tags: (v) => ({ crit: v }) },
    { w: 18, exotic: 0, icon: 'eyes-eye', num: (T) => [3, 4, 5, 7][T], tags: (v) => ({ evade: v }) },
    { w: 16, exotic: 0, icon: 'eyes-eye', num: (T) => [0.1, 0.15, 0.2, 0.25][T], tags: (v) => ({ expBonus: v }) },
    { w: 12, exotic: 2, icon: 'eyes-owl', min: 6, num: () => 1, tags: () => ({ owl: 1, vision: 1 }) },
  ],
};

// ---------------------------------------------------------------- stats text
// The description is ONLY the stats added - never flavor text.
export function describeStats(t) {
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
  if (t.cleave) d.push('Cleave: 1 dmg to 4 adjacent after moving');
  if (t.regen) d.push('Heal 1 HP every 2 turns');
  if (t.lastFury) d.push('ATK x2 below 30% HP');
  if (t.expBonus) d.push(`+${Math.round(t.expBonus * 100)}% EXP`);
  return d;
}

// ---------------------------------------------------------------- naming
function composeName(r, part, key, theme, tier) {
  const bank = NOUNS[part][key] || NOUNS[part][part] || ['Gift'];
  const noun = pick(r, bank);
  const family = THEMES.filter((t) => t.t === tier);
  for (let i = 0; i < 10; i++) {
    // the name leads with the sprite's own theme word; a family synonym is
    // only a fallback flourish, so name and palette always agree
    const adj = chance(r, 0.78) || !family.length ? theme.w : pick(r, family).w;
    const name = chance(r, 0.18) ? `${adj} ${pick(r, INTENS[tier])} ${noun}` : `${adj} ${noun}`;
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
  }
  const name = `${theme.w} ${noun} ${++n}`;
  usedNames.add(name);
  return name;
}

// ---------------------------------------------------------------- visuals
// Seeded parametric shape for the replaced body part. spritegen.js calls
// this with the SAME seed, so the lab preview and the live game render the
// exact same code-drawn art.
const FORMS = {
  legs:  ['stilt legs', 'arched legs', 'cluster legs', 'coil legs', 'blade legs'],
  arms:  ['curved claws', 'long blades', 'heavy fists', 'whip arms', 'pincers'],
  body:  ['plated hide', 'bark skin', 'spiked back', 'gem core', 'frond shoulders'],
  eyes:  ['wide eyes', 'slit pupils', 'third eye', 'halo eyes', 'compound eyes'],
};

export function genPartParams(part, seed) {
  const r = mulberry32(seed);
  const theme = pick(r, THEMES);
  const form = (r() * 5) | 0;
  const p = {
    theme: theme.w, color: theme.c,
    color2: shade(theme.c, r() < 0.5 ? -0.3 : 0.35),
    form, len: 2 + ((r() * 3) | 0), count: 2 + ((r() * 3) | 0),
    iris: pick(r, ['#ffd76a', '#7fe3d0', '#d98ae8', '#a8d9ff', '#e88a6a', '#b8e89a']),
    tip: r() < 0.5 ? 'claw' : 'hoof', spikes: 2 + ((r() * 3) | 0), glow: r() < 0.4,
  };
  return p;
}

export function shade(hex, amt) {
  const v = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + amt))));
  const h = (c) => c.toString(16).padStart(2, '0');
  return `#${h(f((v >> 16) & 255))}${h(f((v >> 8) & 255))}${h(f(v & 255))}`;
}

// ---------------------------------------------------------------- the forge
// forgeOne(level, rng?, opts?) -> one complete upgrade definition.
// opts.excludeKinds: Set of new-body attachment kinds already owned.
export function forgeOne(level, rng, opts = {}) {
  if (!rng) rng = mulberry32((Math.random() * 0xffffffff) >>> 0);

  // 1) roll the body part ('new' = a brand-new part grows instead)
  const tier = tierOf(level);
  const part = (opts.forceNew && level >= 3) || chance(rng, level >= 3 ? 0.22 : 0)
    ? 'new'
    : pick(rng, ['legs', 'arms', 'body', 'eyes']);

  // 2) roll the effect branch (respects level gates) and scale it
  if (part === 'new') {
    const pool = NEW_BODIES.filter((b) => b.min <= level && !(opts.excludeKinds && opts.excludeKinds.has(b.kind)));
    const nb = pick(rng, pool.length ? pool : NEW_BODIES);
    const ntags = nb.tags(level);
    return finish({ kind: nb.kind, icon: nb.icon, tags: ntags, level, tier, r: rng });
  }
  const pool = ROLLS[part].filter((it) => !it.min || level >= it.min);
  const roll = weightedRoll(rng, pool);
  const tags = roll.tags(roll.num(tier), tier);
  const exotic = roll.exotic + (Object.keys(tags).filter((k) => tags[k]).length > 1 ? 1 : 0);
  const rarity = exotic >= 2 ? 'prime' : exotic === 1 ? 'rare' : 'common';

  // 3) the visual: a seeded parametric shape whose palette comes from a
  //    theme - the name is then composed from that SAME theme, so name,
  //    stats and sprite always agree
  const seed = (rng() * 0xffffffff) >>> 0;
  const vis = genPartParams(part, seed);
  const key = primaryKey(tags, part);
  const name = composeName(rng, part, key, { w: vis.theme, c: vis.color }, tier);

  // 4) small attachment flourish for some rolls (drawn in code)
  const att = chance(rng, 0.5)
    ? { kind: pick(rng, ['stripe', 'gloves', 'chest', 'glow']), color: vis.color2 }
    : part === 'eyes'
      ? { kind: 'iris', color: vis.iris }
      : null;

  const def = {
    id: 'f' + (++n),
    part,
    header: `${part} upgrade`,
    name,
    desc: describeStats(tags),
    tags,
    att,
    icon: roll.icon,
    color: vis.color,
    sprite: 'G' + seed,          // base part art is hidden, this is drawn instead
    gen: vis,
    formLabel: FORMS[part][vis.form],
    rarity,
    level,
  };
  return def;
}

function weightedRoll(r, list) {
  let sum = 0;
  for (const it of list) sum += it.w;
  let x = r() * sum;
  for (const it of list) { x -= it.w; if (x <= 0) return it; }
  return list[0];
}

function primaryKey(tags, part) {
  const keys = Object.keys(tags).filter((k) => tags[k]);
  for (const k of ['reachStraight', 'knight', 'cleave', 'regen', 'owl', 'lastFury', 'fly', 'reachDiag', 'vision', 'atk', 'maxHp', 'def', 'thorns', 'crit', 'evade', 'expBonus']) {
    if (keys.includes(k)) return k;
  }
  return keys[0] || part;
}

function finish(o) {
  const seed = (o.r() * 0xffffffff) >>> 0;
  const vis = genPartParams('body', seed);
  const name = composeName(o.r, 'new', o.kind, { w: vis.theme, c: vis.color }, o.tier);
  return {
    id: 'f' + (++n),
    part: 'new',
    header: 'new body upgrade',
    name,
    desc: describeStats(o.tags),
    tags: o.tags,
    att: { kind: o.kind, color: vis.color },
    icon: o.icon,
    color: vis.color,
    gen: vis,
    formLabel: o.kind + ' grows',
    rarity: 'prime',
    level: o.level,
  };
}

// two fresh candidates per evolution roll (the live game path)
export function candidates(level) {
  const rng = mulberry32((S.seed ^ (level * 7919)) + n * 104729 + S.turn * 31);
  const P = S.player;
  const owned = new Set(P ? P.attachments.map((a) => a.kind) : []);
  const out = [];
  for (let i = 0; i < 2; i++) {
    const forceNew = P && !P.hasNewBody && level >= 3 && i === 0;
    out.push(forgeOne(level, rng, { forceNew, excludeKinds: owned }));
  }
  return out;
}
