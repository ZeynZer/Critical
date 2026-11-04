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
