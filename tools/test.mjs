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
