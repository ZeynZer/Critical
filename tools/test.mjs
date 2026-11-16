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
  for (let d = 0; d < 9; d++) { g.mod = F.mod(d); const t2 = F.trace(g, 2.5); assert.ok(t2.every((v, i) => i % 2 || v === 2.5), `visée courbe au secteur ${d + 1}`); }
  // et en vrai : sans pesanteur ni vent, un petit astre posé près d'un trou noir ne bouge pas du tout
  const z = F.newGame(2); z.mod = { g: 0, wind: 0, alt: 0, inset: 0, n: '' }; z.over = false;
  for (const [id, tier, x, y] of [[1, F.HOLE, 7, 7], [2, 2, 4.6, 7], [3, F.HOLE + 2, 2, 11]]) z.bodies.push({ id, k: 'c', tier, x, y, vx: 0, vy: 0, r: F.TIERS[tier].r, ang: 0, av: 0, age: 2, hit: true, dead: false });
  for (let k = 0; k < 240; k++) F.tick(z, 1 / 60);
  assert.ok(z.bodies.every((o) => Math.hypot(o.vx, o.vy) < 1e-9), 'des astres s\'attirent');
  assert.equal(F.mod(7).inset, 0.8); assert.equal(F.mod(9).g, 1);
  console.log('trajectoire droite et secteurs OK');
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
{ // un astre qui tombe tombe droit, dans tous les secteurs, même quand une fusion voisine pousse tout autour
  for (let d = 0; d < 9; d++) {
    const g = F.newGame(5 + d); g.depth = d; g.mod = F.mod(d); g.inset = g.mod.inset; g.cur = { k: 'c', tier: 1 }; F.drop(g, 3.3);
    const b = g.bodies[0], x0 = b.x; let landed = false;
    for (let k = 0; k < 600 && !landed; k++) { F.tick(g, 1 / 60); landed = b.hit; if (!landed) assert.equal(b.x, x0, `l'astre dévie en tombant (secteur ${d + 1})`); }
    assert.ok(landed, 'l\'astre doit atterrir');
  }
  const g = F.newGame(9); for (const y of [13.9, 13.9]) g.bodies.push({ id: g.nid++, k: 'c', tier: 3, x: 3 + (y > 13.95 ? 0 : 0.2), y, vx: 0, vy: 0, r: F.TIERS[3].r, ang: 0, av: 0, age: 2, hit: true, dead: false });
  const f = { id: g.nid++, k: 'c', tier: 1, x: 4.3, y: 11.6, vx: 0, vy: 0, r: F.TIERS[1].r, ang: 0, av: 0, age: 0, hit: false, dead: false }; g.bodies.push(f);
  for (let k = 0; k < 40; k++) { F.tick(g, 1 / 60); if (!f.hit) assert.equal(f.x, 4.3, 'une onde de fusion dévie un astre en chute'); }
  assert.ok(g.fusions >= 1, 'le test doit avoir déclenché une fusion');
  console.log('chute droite OK (9 secteurs, onde de fusion)');
}
{ // un astre posé presque au sommet d'un autre doit rouler et tomber vite : pas de frottement qui le fige
  for (const deg of [2, 4, 8, 15]) {
    const g = F.newGame(3); g.over = false; g.danger = -1e9; const R = F.TIERS[7].r, r = F.TIERS[2].r, a = deg * Math.PI / 180;
    g.bodies.push({ id: 1, k: 'c', tier: 7, x: 5, y: F.HT - R, vx: 0, vy: 0, r: R, ang: 0, av: 0, age: 5, hit: true, dead: false });
    const s = { id: 2, k: 'c', tier: 2, x: 5 + (R + r) * Math.sin(a), y: F.HT - R - (R + r) * Math.cos(a), vx: 0, vy: 0, r, ang: 0, av: 0, age: 5, hit: true, dead: false }; g.bodies.push(s);
    let t = 0; while (t < 4 && s.y < F.HT - r - 0.05) { F.tick(g, 1 / 60); t += 1 / 60; }
    assert.ok(s.y >= F.HT - r - 0.05, `l'astre reste coincé sur l'autre à ${deg}° (y=${s.y.toFixed(2)} après ${t.toFixed(1)} s)`);
    assert.ok(t < 2.2, `l'astre roule trop lentement à ${deg}° : ${t.toFixed(2)} s`);
  }
  console.log('roulement OK');
}
