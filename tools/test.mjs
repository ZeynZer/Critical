// Tests : décodage, solutions valides, déterminisme, stats de chaîne.
import assert from 'node:assert/strict';
import { LEVELS } from '../js/levels.js';
import { decode, encode, clone, run, remaining, reactors, solve } from '../js/engine.js';
import { dailyLevel } from '../js/gen.js';

let n = 0;
for (const L of LEVELS) {
  const s = decode(L);
  assert.equal(encode(s), L.g, 'encode/decode');
  const a = clone(s); for (const i of L.sol) run(a, i);
  assert.equal(remaining(a), 0, `solution invalide ${L.world}:${L.idx}`);
  const b = clone(s); for (const i of L.sol) run(b, i);
  assert.deepEqual(a.type, b.type, 'déterminisme');
  const r = solve(s, L.min);
  assert.equal(r.depth, L.min, 'minimum');
  const best = Math.max(...reactors(s).map(i => run(clone(s), i)));
  if (n++ % 6 === 0) console.log(`M${L.world + 1}-${L.idx + 1} reactors=${remaining(s)} min=${L.min} plusGrosseChaine=${best}`);
}
const t = Date.now();
const d = dailyLevel('2026-11-03');
assert.ok(d); console.log('daily', d.min, 'taps,', Date.now() - t, 'ms');
console.log('TOUT OK —', LEVELS.length, 'niveaux');

// ---- codes de partage ----
import { encodeLevel, decodeLevel, verify, group } from '../js/levelcode.js';
let nc = 0;
for (const L of LEVELS.filter((_, i) => i % 3 === 0)) {
  const lv = { w: L.w, h: L.h, g: L.g, sol: L.sol, theme: L.world, extra: 1, name: 'Niveau é' + L.idx };
  const code = encodeLevel(lv), r = decodeLevel(group(code));
  assert.ok(r.ok, 'décodage ' + (r.error || ''));
  assert.equal(r.level.g, L.g); assert.equal(r.level.theme, L.world); assert.equal(r.level.extra, 1); assert.equal(r.level.name, lv.name); assert.deepEqual(r.level.sol, L.sol);
  assert.ok(decodeLevel('https://x.github.io/Critical/#n=' + code).ok, 'lien');
  const bad = code.slice(0, 10) + (code[10] === 'A' ? 'B' : 'A') + code.slice(11);
  assert.ok(!decodeLevel(bad).ok, 'faute de frappe détectée'); nc++;
}
console.log('codes OK', nc, '· exemple', group(encodeLevel({ w: LEVELS[0].w, h: LEVELS[0].h, g: LEVELS[0].g, sol: LEVELS[0].sol, theme: 0, extra: 2, name: 'Mon niveau' })));
// niveau avec laser, mèche, cristal : le solveur doit épargner le cristal
const mk = (rows) => { const h = rows.length, w = rows[0].length; return { w, h, g: rows.join('') }; };
const T1 = decode(mk(['a1..1', '..*..', '1....', '.d..1']));
const r1 = solve(T1, 4, 5, 500); assert.ok(r1, 'solveur avec items'); const c1 = clone(T1); for (const i of r1.sols[0]) run(c1, i); assert.equal(remaining(c1), 0);
let friends = 0; for (const t of c1.type) if (t === 11) friends++; assert.equal(friends, 1, 'cristal épargné');
console.log('solveur items OK (min', r1.depth, 'taps)');

// ---- Forage (fusion) : déterminisme, bornes, progression avec un joueur aléatoire ----
import * as F from '../js/fusion.js';
const playF = (seed, drops) => { const g = F.newGame(seed), r = mulberry32(seed ^ 0x9e37); for (let i = 0; i < drops && !g.over; i++) { F.drop(g, r() * F.W); for (let k = 0; k < 40; k++) F.tick(g, 1 / 60); g.ev.length = 0; } return g; };
import { mulberry32 } from '../js/gen.js';
{
  const a = playF(7, 120), b = playF(7, 120);
  assert.equal(a.score, b.score, 'forage déterministe'); assert.equal(a.bodies.length, b.bodies.length);
  let over = 0, depth = 0, fus = 0, drops = 0;
  for (let s = 1; s <= 20; s++) {
    const g = playF(s, 400); over += g.over ? 1 : 0; depth += g.depth; fus += g.fusions; drops += g.drops;
    for (const o of g.bodies) { assert.ok(Number.isFinite(o.x + o.y + o.vx + o.vy), 'NaN'); assert.ok(o.x >= o.r - 0.01 && o.x <= F.W - o.r + 0.01 && o.y <= F.HT - o.r + 0.01, 'hors du puits'); }
    assert.ok(g.fusions > 5, 'des fusions se produisent');
  }
  // empilement stable : après repos, les noyaux ne se chevauchent presque plus et ne bougent plus
  const g2 = F.newGame(4); for (let i = 0; i < 6; i++) { g2.cur = { k: 'c', tier: i }; F.drop(g2, 1 + i * 1.5); for (let k = 0; k < 30; k++) F.tick(g2, 1 / 60); }
  for (let k = 0; k < 300; k++) F.tick(g2, 1 / 60);
  const pos = g2.bodies.map((o) => [o.x, o.y]); for (let k = 0; k < 120; k++) F.tick(g2, 1 / 60);
  assert.ok(g2.bodies.every((o, i) => Math.hypot(o.x - pos[i][0], o.y - pos[i][1]) < 0.05), 'pile au repos'); // plus rien ne bouge, malgré l'attraction des étoiles
  console.log(`forage OK · joueur aléatoire : ${over}/20 parties finies en <400 lâchers, ${(drops / 20) | 0} lâchers, strate moy. ${(depth / 20).toFixed(1)}, ${(fus / 20) | 0} fusions`);
}
{ // gravité : un petit astre près d'un soleil est attiré vers lui ; la visée suit la même courbe
  const g = F.newGame(1); g.bodies.push({ id: 99, k: 'c', tier: 6, x: 7, y: 12, vx: 0, vy: 0, r: F.TIERS[6].r, ang: 0, av: 0, age: 2, hit: true, dead: false });
  g.cur = { k: 'c', tier: 0 }; const tr = F.trace(g, 4.2); assert.ok(tr[tr.length - 2] > 4.3, 'trajectoire courbée vers le soleil');
  F.drop(g, 4.2); for (let k = 0; k < 60; k++) F.tick(g, 1 / 60); assert.ok(g.bodies.find((o) => o.tier === 0).x > 4.3, 'astre attiré');
  assert.equal(F.mod(7).inset, 0.8); assert.equal(F.mod(9).g, 1);
  console.log('gravité et secteurs OK');
}
