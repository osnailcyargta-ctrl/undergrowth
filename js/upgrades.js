// UNDERGROWTH - upgrade system.
// 12 hardcoded body upgrades (3 per part: legs, arms, body, eyes) +
// 10 unique upgrades (4 single, 4 capped, 2 infinite) +
// infinite procedurally generated body upgrades (see genbody.js).

import { S } from './state.js';
import { recomputeVision } from './world.js';
import { clampZoomToVision } from './camera.js';
import { candidates } from './genbody.js';
import { shuffle } from './util.js';

export const BODY = [
  // legs
  { id: 'legs1', part: 'legs', name: 'Long Stride',   desc: ['Straight reach 2'],                  tags: { reachStraight: 2 }, color: '#9fd08a', icon: 'legs-reach' },
  { id: 'legs2', part: 'legs', name: 'Spider Legs',   desc: ['Knight jumps'],                      tags: { knight: 1 },        color: '#8a9a6b', icon: 'legs-knight' },
  { id: 'legs3', part: 'legs', name: 'Deer Step',     desc: ['Diagonal reach 2', '+5% evade'],     tags: { reachDiag: 2, evade: 5 }, color: '#c9b98a', icon: 'legs-diag' },
  // arms
  { id: 'arms1', part: 'arms', name: 'Sharp Claws',   desc: ['+2 ATK'],                            tags: { atk: 2 },           color: '#d9884a', icon: 'arms-claw' },
  { id: 'arms2', part: 'arms', name: 'Thorn Fists',   desc: ['+1 ATK', 'Thorns 1'],                tags: { atk: 1, thorns: 1 }, color: '#8aa65a', icon: 'arms-thorn' },
  { id: 'arms3', part: 'arms', name: 'Reaping Sweep', desc: ['1 dmg to 4 adjacent after moving'],  tags: { cleave: 1 },        color: '#c9c98a', icon: 'arms-sweep' },
  // body
  { id: 'body1', part: 'body', name: 'Oak Heart',     desc: ['+6 max HP'],                         tags: { maxHp: 6 },          color: '#7a9a5a', icon: 'body-heart' },
  { id: 'body2', part: 'body', name: 'Fern Skin',     desc: ['+1 DEF'],                            tags: { def: 1 },            color: '#5a8a6a', icon: 'body-shield' },
  { id: 'body3', part: 'body', name: 'Titan Chest',   desc: ['+10 max HP', '+1 DEF'],              tags: { maxHp: 10, def: 1 }, color: '#9a8a5a', icon: 'body-titan' },
  // eyes
  { id: 'eyes1', part: 'eyes', name: 'Keen Eyes',     desc: ['+2 Sight', 'Unlocks zoom'],          tags: { vision: 2, zoom: 1 }, color: '#e8c96a', icon: 'eyes-eye' },
  { id: 'eyes2', part: 'eyes', name: 'Hawk Sight',    desc: ['+2 Sight'],                          tags: { vision: 2 },         color: '#d9a84a', icon: 'eyes-eye' },
  { id: 'eyes3', part: 'eyes', name: 'Owl Gaze',      desc: ['+3 Sight', 'Sense the altar'],       tags: { vision: 3, owl: 1 }, color: '#a8c9d9', icon: 'eyes-owl' },
];

export const UNIQUE = [
  // single
  { id: 'u1', unique: true, cap: 1, name: 'Phoenix Ember', desc: ['Revive once at 50% HP'],   tags: { phoenix: 1 },   color: '#e87a4a', icon: 'u-ember' },
  { id: 'u2', unique: true, cap: 1, name: 'Regrowth',      desc: ['Heal 1 HP every 2 turns'], tags: { regen: 1 },     color: '#8ad98a', icon: 'u-regen' },
  { id: 'u3', unique: true, cap: 1, name: 'Last Fury',     desc: ['ATK x2 below 30% HP'],     tags: { lastFury: 1 },  color: '#d94a4a', icon: 'u-fury' },
  { id: 'u4', unique: true, cap: 1, name: 'Instinct',      desc: ['+25% EXP'],                tags: { expBonus: 0.25 }, color: '#e8d94a', icon: 'u-instinct' },
  // capped
  { id: 'u5', unique: true, cap: 5,  name: 'Iron Bark',   desc: ['+1 DEF per level'],    tags: { def: 1 },     color: '#9aa8b8', icon: 'u-iron' },
  { id: 'u6', unique: true, cap: 10, name: 'Bloodthirst', desc: ['+0.5 ATK per level'],  tags: { atk: 0.5 },   color: '#b84a5a', icon: 'u-blood' },
  { id: 'u7', unique: true, cap: 20, name: 'Focus',        desc: ['+2% crit per level'],  tags: { crit: 2 },    color: '#d9c96a', icon: 'u-focus' },
  { id: 'u8', unique: true, cap: 20, name: 'Vigor',        desc: ['+2 max HP per level'], tags: { maxHp: 2 },   color: '#8ab89a', icon: 'u-vigor' },
  // infinite
  { id: 'u9',  unique: true, cap: Infinity, name: 'Growth',  desc: ['+0.5 ATK per level', '+1 max HP per level'], tags: { atk: 0.5, maxHp: 1 }, color: '#7ab85a', icon: 'u-growth' },
  { id: 'u10', unique: true, cap: Infinity, name: 'Horizon', desc: ['+1 Sight every 2 levels'],                   tags: { horizon: 1 },          color: '#6ad9c9', icon: 'u-horizon' },
];

export function buildChoices() {
  const P = S.player;
  const bodyPool = BODY.filter((d) => !P.owned[d.id]);
  const uniquePool = UNIQUE.filter((d) => (P.owned[d.id] || 0) < d.cap);
  const genPool = candidates(S.level).filter((d) => !P.owned[d.name]);
  const pool = [...bodyPool, ...genPool];
  const out = [];
  if (pool.length) out.push(pool[(Math.random() * pool.length) | 0]);
  if (uniquePool.length) out.push(uniquePool[(Math.random() * uniquePool.length) | 0]);
  const rest = shuffle([
    ...pool.filter((d) => !out.includes(d)),
    ...uniquePool.filter((d) => !out.includes(d)),
  ]);
  while (out.length < 3 && rest.length) out.push(rest.pop());
  return out;
}

export function applyUpgrade(def) {
  const P = S.player;
  const key = def.unique ? def.id : def.name;
  P.owned[key] = (P.owned[key] || 0) + 1;
  P.head = 1; // the cube awakens: a head grows on the first evolution
  const t = def.tags || {};
  if (def.part && def.part !== 'new') {
    P.parts[def.part]++;
    if (def.part === 'eyes') P.canZoom = true;
  }
  if (def.part === 'new') P.hasNewBody = true;
  if (t.reachStraight) P.reachStraight = Math.max(P.reachStraight, t.reachStraight);
  if (t.reachDiag) P.reachDiag = Math.max(P.reachDiag, t.reachDiag);
  if (t.knight) P.knight = true;
  if (t.fly) P.fly = true;
  if (t.atk) P.atk += t.atk;
  if (t.maxHp) { P.maxHp += t.maxHp; P.hp += t.maxHp; }
  if (t.def) P.def += t.def;
  if (t.thorns) P.thorns += t.thorns;
  if (t.cleave) P.cleave = true;
  if (t.evade) P.evade += t.evade;
  if (t.vision) P.vision += t.vision;
  if (t.zoom) P.canZoom = true;
  if (t.owl) P.owl = true;
  if (t.crit) P.crit += t.crit;
  if (t.regen) P.regen = true;
  if (t.lastFury) P.lastFury = true;
  if (t.expBonus) P.expBonus = Math.max(P.expBonus, t.expBonus);
  if (t.phoenix) P.phoenix = true;
  if (t.horizon) {
    P.sightAcc += 0.5;
    while (P.sightAcc >= 1) { P.sightAcc -= 1; P.vision += 1; }
  }
  if (def.att) {
    if (def.att.kind === 'iris') P.irisColor = def.att.color;
    else {
      P.attachments.push(def.att);
      if (P.attachments.length > 8) P.attachments.shift();
    }
  }
  S.vision = P.vision;
  recomputeVision();
  clampZoomToVision();
  return def;
}
