// Tests du moteur de jeu (js/fusion.js) : déterminisme, bornes, physique, reprise et rejeu.
import assert from 'node:assert/strict';
// ---- Forage (fusion) : déterminisme, bornes, progression avec un joueur aléatoire ----
import * as F from '../js/fusion.js';
const { mulberry32 } = F;
const playF = (seed, drops) => { const g = F.newGame(seed), r = mulberry32(seed ^ 0x9e37); for (let i = 0; i < drops && !g.over; i++) { F.drop(g, r() * F.W); for (let k = 0; k < 40; k++) F.tick(g, 1 / 60); g.ev.length = 0; } return g; };
{
  const a = playF(7, 120), b = playF(7, 120);
  assert.equal(a.score, b.score, 'forage déterministe'); assert.equal(a.bodies.length, b.bodies.length);
  let over = 0, depth = 0, fus = 0, drops = 0;
  for (let s = 1; s <= 6; s++) {
    const g = playF(s, 400); over += g.over ? 1 : 0; depth += g.depth; fus += g.fusions; drops += g.drops;
    for (const o of g.bodies) { assert.ok(Number.isFinite(o.x + o.y + o.vx + o.vy), 'NaN'); assert.ok(o.x >= o.r - 0.01 && o.x <= F.W - o.r + 0.01 && o.y <= F.HT - o.r + 0.01, 'hors du puits'); }
    assert.ok(g.fusions > 5, 'des fusions se produisent');
  }
  // empilement stable : après repos, les noyaux ne se chevauchent presque plus et ne bougent plus
  const g2 = F.newGame(4); for (let i = 0; i < 6; i++) { g2.cur = { k: 'c', tier: i }; F.drop(g2, 1 + i * 1.5); for (let k = 0; k < 30; k++) F.tick(g2, 1 / 60); }
  for (let k = 0; k < 300; k++) F.tick(g2, 1 / 60);
  const pos = g2.bodies.map((o) => [o.x, o.y]); for (let k = 0; k < 120; k++) F.tick(g2, 1 / 60);
  assert.ok(g2.bodies.every((o, i) => Math.hypot(o.x - pos[i][0], o.y - pos[i][1]) < 0.05), 'pile au repos'); // plus rien ne bouge, malgré l'attraction des étoiles
  console.log(`forage OK · joueur aléatoire : ${over}/6 parties finies en <400 lâchers, ${(drops / 6) | 0} lâchers, strate moy. ${(depth / 6).toFixed(1)}, ${(fus / 6) | 0} fusions`);
}
{ // pas d'attraction entre astres : un lâcher près d'un trou noir tombe droit ; le vent d'un secteur penche la visée
  const g = F.newGame(1); g.bodies.push({ id: 99, k: 'c', tier: F.HOLE, x: 7, y: 12, vx: 0, vy: 0, r: F.TIERS[F.HOLE].r, ang: 0, av: 0, age: 2, hit: true, dead: false });
  g.cur = { k: 'c', tier: 2 }; const tr = F.trace(g, 2.5); assert.ok(Math.abs(tr[tr.length - 2] - 2.5) < 1e-9, 'la trajectoire doit rester droite');
  g.mod = F.mod(5); const tw = F.trace(g, 2.5); assert.ok(tw[tw.length - 2] > 2.6, 'le vent penche la trajectoire');
  assert.equal(F.mod(7).inset, 0.8); assert.equal(F.mod(9).g, 1);
  console.log('trajectoire et secteurs OK');
}
{ // pile sous pression : 45 astres entassés ne doivent plus ramper une fois posés ; les points de fusion sont bien comptés
  const g = F.newGame(11), r = mulberry32(5); for (let i = 0; i < 45; i++) { g.drill = -1e9; g.cur = { k: 'c', tier: (i * 7) % 6 }; F.drop(g, r() * F.W); for (let k = 0; k < 24; k++) F.tick(g, 1 / 60); }
  g.over = false; g.danger = -1e9; for (let k = 0; k < 960; k++) F.tick(g, 1 / 60);
  const pos = g.bodies.map((o) => [o.id, o.x, o.y]); for (let k = 0; k < 360; k++) F.tick(g, 1 / 60);
  let mv = 0; for (const [id, x, y] of pos) { const o = g.bodies.find((q) => q.id === id); if (o) mv = Math.max(mv, Math.hypot(o.x - x, o.y - y)); }
  assert.ok(mv < 0.04, 'la pile rampe : ' + mv.toFixed(3));
  const h = F.newGame(2); h.cur = { k: 'c', tier: 1 }; F.drop(h, 5); for (let k = 0; k < 60; k++) F.tick(h, 1 / 60); h.cur = { k: 'c', tier: 1 }; F.drop(h, 5); for (let k = 0; k < 60; k++) F.tick(h, 1 / 60);
  assert.ok(h.fusions === 1 && h.score >= F.TIERS[2].pts, 'points de fusion comptés');
  assert.ok(Math.abs(F.GALAXY.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'probabilités des galaxies = 100 %');
  console.log('physique sous pression OK (déplacement max', mv.toFixed(4) + ')');
}
{ // sauvegarde/reprise et rejeu : une partie sérialisée en JSON continue à l'identique, et son journal redonne le même score
  const r = mulberry32(77), a = F.newGame(123); let b = null;
  for (let i = 0; i < 120 && !a.over; i++) { if (i % 9 === 4) F.swapHold(a); F.drop(a, r() * F.W); for (let k = 0; k < 30; k++) F.tick(a, 1 / 60 + (k % 3) * 0.004); a.ev.length = 0; if (i === 60) b = JSON.parse(JSON.stringify(a)); }
  const r2 = mulberry32(77); for (let i = 0; i < 61; i++) r2(); // même suite de positions pour la copie
  for (let i = 61; i < 120 && !b.over; i++) { if (i % 9 === 4) F.swapHold(b); F.drop(b, r2() * F.W); for (let k = 0; k < 30; k++) F.tick(b, 1 / 60 + (k % 3) * 0.004); b.ev.length = 0; }
  assert.equal(b.score, a.score, 'la partie reprise diverge'); assert.equal(b.n, a.n);
  const c = F.replay(123, a.log, a.n); assert.equal(c.score, a.score, 'le rejeu ne redonne pas le score'); assert.equal(c.depth, a.depth);
  console.log('reprise et rejeu OK (score', a.score + ',', a.log.length / 2, 'actions)');
}
