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
{ // défaite : seulement si un astre est ENTIÈREMENT au-dessus de la ligne, pendant 2,6 s ; dépasser en partie ne coûte rien
  const mk = (y, tier) => { const g = F.newGame(8); g.mod = { g: 0, inset: 0, n: '' }; g.bodies.push({ id: 1, k: 'c', tier, x: 5, y, vx: 0, vy: 0, r: F.TIERS[tier].r, ang: 0, av: 0, age: 5, hit: true, dead: false }); return g; };
  const run = (g, s) => { for (let k = 0; k < s * 60 && !g.over; k++) F.tick(g, 1 / 60); return g; };
  const part = run(mk(F.LINE - 0.2, 7), 12); assert.ok(!part.over, 'un astre qui dépasse en partie ne doit pas faire perdre'); assert.equal(part.danger, 0, 'pas de compte à rebours tant que l\'astre n\'est pas entièrement dehors');
  const ent = mk(F.LINE - F.TIERS[1].r - 0.1, 1);
  assert.ok(!run(ent, 2.2).over, 'le temps d\'attente doit être respecté'); assert.ok(run(ent, 1).over, 'un astre entièrement au-dessus doit faire perdre après 2,6 s');
  const back = mk(F.LINE - F.TIERS[1].r - 0.1, 1); run(back, 1.5); back.bodies[0].y = F.LINE + 3; run(back, 3); assert.ok(!back.over && back.danger === 0, 'le compte à rebours retombe quand l\'astre redescend');
  assert.ok(part.near, 'le dépassement partiel est signalé (avertissement visuel)');
  console.log('règle de défaite OK');
}
{ // absorption : chaque absorbeur avale jusqu'à son rang maximum, à son rythme, plus loin quand il est rare ; jamais un astre plus gros ni un autre absorbeur
  const mkb = (id, tier, x, y, v = 0) => ({ id, k: 'c', tier, v, x, y, vx: 0, vy: 0, r: F.TIERS[tier].r, ang: 0, av: 0, age: 5, hit: true, dead: false });
  const world = () => { const g = F.newGame(31); g.mod = { g: 0, inset: 0, n: '' }; g.over = false; return g; };
  const eats = (abTier, abV, preyTier, gap = -0.01, secs = 0.5) => {
    const g = world(), r = F.TIERS[abTier].r + F.TIERS[preyTier].r + gap; g.bodies.push(mkb(1, abTier, 5, 8, abV), mkb(2, preyTier, 5 + r, 8));
    for (let k = 0; k < secs * 60; k++) F.tick(g, 1 / 60); return !g.bodies.some((o) => o.id === 2);
  };
  const CASES = [[10, 0, 0, 1], [10, 0, 1, 1], [10, 0, 2, 0], [10, 1, 2, 1], [10, 1, 3, 0], [11, 0, 2, 1], [11, 0, 3, 0], [11, 1, 3, 1], [11, 1, 4, 0],
    [12, 0, 3, 1], [12, 0, 4, 0], [12, 2, 4, 1], [12, 2, 5, 0], [12, 5, 6, 1], [12, 5, 7, 0],
    [7, 0, 1, 0], [7, 1, 1, 1], [7, 1, 2, 0]]; // le soleil ordinaire n'avale rien, l'étoile bleue brûle les orbes
  for (const [t, v, prey, ok] of CASES) assert.equal(eats(t, v, prey), !!ok, `absorbeur ${t}:${v} / proie de rang ${prey} : attendu ${ok ? 'avalée' : 'épargnée'}`);
  assert.ok(!eats(11, 0, 10) && !eats(12, 5, 11) && !eats(10, 1, 12), 'un absorbeur n\'en avale jamais un autre');
  // portée : une galaxie critique avale à distance, un trou noir ordinaire seulement au contact
  assert.ok(eats(12, 5, 2, 0.9), 'une galaxie critique avale sans toucher'); assert.ok(!eats(10, 0, 0, 0.5), 'un trou noir ordinaire n\'avale qu\'au contact');
  // rythme : le trou noir (3 s) n'avale qu'une proie à la fois ; la galaxie critique (0,5 s) enchaîne
  const two = (t, v, secs) => { const g = world(), r = F.TIERS[t].r + F.TIERS[0].r - 0.01; g.bodies.push(mkb(1, t, 5, 8, v), mkb(2, 0, 5 + r, 8), mkb(3, 0, 5 - r, 8)); for (let k = 0; k < secs * 60; k++) F.tick(g, 1 / 60); return g.bodies.filter((o) => o.tier === 0).length; };
  assert.equal(two(10, 0, 2), 1, 'le trou noir doit attendre 3 s entre deux repas'); assert.equal(two(10, 0, 3.4), 0, 'puis avaler la seconde proie');
  assert.equal(two(12, 5, 1), 0, 'une galaxie critique enchaîne les proies');
  console.log('absorption OK');
}
{ // étoile à neutrons : le magnétar pulse plus souvent et plus fort ; la supergéante n'enfle pas
  const mkb = (id, tier, x, y, v = 0) => ({ id, k: 'c', tier, v, x, y, vx: 0, vy: 0, r: F.TIERS[tier].r, ang: 0, av: 0, age: 0, hit: true, dead: false });
  const pulses = (v) => { const g = F.newGame(32); g.mod = { g: 0, inset: 0, n: '' }; g.over = false; g.bodies.push(mkb(1, F.NEUTRON, 5, 8, v)); const probe = mkb(2, 0, 5 + F.TIERS[F.NEUTRON].r + 0.9, 8); g.bodies.push(probe);
    let n = 0, first = 0; for (let k = 0; k < 600; k++) { F.tick(g, 1 / 60); for (const e of g.ev) if (e.t === 'pulse') { n++; if (!first) first = Math.abs(probe.vx) + Math.abs(probe.vy); } g.ev.length = 0; } return { n, first }; };
  const base = pulses(0), mag = pulses(1);
  assert.ok(mag.n > base.n, `le magnétar doit pulser plus souvent (${mag.n} contre ${base.n} en 10 s)`); assert.ok(mag.first > base.first * 1.5, `et plus fort (${mag.first.toFixed(1)} contre ${base.first.toFixed(1)})`);
  const swell = (v) => { const g = F.newGame(33); g.mod = { g: 0, inset: 0, n: '' }; g.over = false; g.bodies.push(mkb(1, F.GIANT, 5, 8, v)); g.danger = -1e9; for (let k = 0; k < 3000; k++) F.tick(g, 1 / 60); return g.bodies[0].r / F.TIERS[F.GIANT].r; };
  assert.ok(swell(0) > 1.15, 'la géante rouge enfle'); assert.ok(Math.abs(swell(1) - 1) < 1e-9, 'la supergéante reste stable');
  console.log('pouvoirs des étoiles OK');
}
{ // Big Bang : deux galaxies font disparaître tout le reste (secteur vierge) et déclenchent le saut de secteur
  const mkb = (id, tier, x, y, v = 0) => ({ id, k: 'c', tier, v, x, y, vx: 0, vy: 0, r: F.TIERS[tier].r, ang: 0, av: 0, age: 5, hit: true, dead: false });
  const g = F.newGame(34); g.mod = { g: 0, inset: 0, n: '' }; g.over = false;
  g.bodies.push(mkb(1, 12, 4.5, 9, 3), mkb(2, 12, 6.2, 9, 1)); for (let i = 0; i < 8; i++) g.bodies.push(mkb(10 + i, 2 + (i % 5), 1 + i, 13));
  const s0 = g.score; let nova = null; for (let k = 0; k < 40; k++) { F.tick(g, 1 / 60); for (const e of g.ev) if (e.t === 'nova') nova = e; g.ev.length = 0; }
  assert.ok(nova, 'le Big Bang doit être signalé'); assert.equal(g.bodies.length, 0, 'plus aucun astre après le Big Bang'); assert.ok(nova.gone.length >= 10, 'la liste des astres disparus accompagne l\'événement (pour l\'animation)');
  assert.ok(g.score - s0 >= 5000, 'le Big Bang rapporte ses points'); assert.equal(g.danger, 0);
  for (let k = 0; k < 40; k++) F.tick(g, 1 / 60); assert.equal(g.depth, 1, 'le saut de secteur suit le Big Bang'); assert.equal(g.bodies.length, 0, 'le nouveau secteur est vierge');
  console.log('Big Bang OK');
}
{ // bac à sable : on ne meurt pas, rien n'est tiré au sort, l'astre choisi reste en main, pas de saut de secteur
  const g = F.newGame(35, { sandbox: true }); g.cur = { k: 'c', tier: 10, v: 1 }; let rare = 0;
  for (let i = 0; i < 60; i++) { g.cool = 0; F.drop(g, 1 + (i % 8)); for (let k = 0; k < 20; k++) F.tick(g, 1 / 60); for (const e of g.ev) if (e.t === 'rare' || e.t === 'pierce' || e.t === 'over') rare++; g.ev.length = 0; }
  for (let k = 0; k < 60 * 8; k++) F.tick(g, 1 / 60);
  assert.equal(g.over, false, 'jamais de défaite'); assert.equal(rare, 0); assert.equal(g.depth, 0, 'pas de saut de secteur'); assert.equal(g.danger, 0);
  assert.ok(g.cur.tier === 10 && g.cur.v === 1, "l'astre choisi reste en main"); const d = F.newGame(37, { sandbox: true }); d.cur = { k: 'c', tier: 3, v: 1 }; F.drop(d, 5); assert.equal(d.bodies[0].v, 1, 'la variante choisie est lâchée telle quelle');
  const h = F.newGame(36, { sandbox: true }); let rr = 0; for (let n = 0; n < 400; n++) { h.bodies.length = 0; h.bodies.push({ id: 1, k: 'c', tier: 2, v: 0, x: 4, y: 12, vx: 0, vy: 0, r: F.TIERS[2].r, ang: 0, av: 0, age: 5, hit: true, dead: false }, { id: 2, k: 'c', tier: 2, v: 0, x: 4 + F.TIERS[2].r * 1.9, y: 12, vx: 0, vy: 0, r: F.TIERS[2].r, ang: 0, av: 0, age: 5, hit: true, dead: false }); for (let k = 0; k < 10; k++) F.tick(h, 1 / 60); for (const e of h.ev) if (e.t === 'rare') rr++; h.ev.length = 0; }
  assert.equal(rr, 0, 'aucune variante rare dans le bac à sable'); console.log('bac à sable OK');
}
{ // variantes de style : fréquentes, purement visuelles, et sans effet sur la partie (anciennes parties rejouables à l'identique)
  const bot = (seed, n) => { const g = F.newGame(seed); let s = 99; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; for (let i = 0; i < n && !g.over; i++) { if (r() < 0.1) F.swapHold(g); F.drop(g, 1 + r() * 8); for (let k = 0; k < 40; k++) F.tick(g, 1 / 60); g.ev.length = 0; } return g; };
  const g = bot(5, 150); assert.equal(g.score, 27580, 'score identique à celui de l\'ancien moteur (le flux aléatoire de la partie est intact)');
  assert.equal(F.replay(5, g.log, g.n).score, 27580, 'et la rediffusion aussi');
  const cnt = {}; let fus = 0; for (let seed = 1; seed <= 25; seed++) { const h = F.newGame(seed); let s = seed; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; for (let i = 0; i < 400 && !h.over; i++) { F.drop(h, 1 + r() * 8); for (let k = 0; k < 30; k++) { F.tick(h, 1 / 60); for (const e of h.ev) { if (e.t === 'merge') fus++; if (e.t === 'rare' && e.v >= 2) { assert.ok(e.tier < F.MAX_TIER && F.STYLES[e.tier][e.v - 2] === e.p, 'style valide'); cnt[e.tier] = (cnt[e.tier] || 0) + 1; } } h.ev.length = 0; } } }
  assert.ok(Object.keys(cnt).length >= 3, 'des variantes de style apparaissent (' + JSON.stringify(cnt) + ' sur ' + fus + ' fusions)');
  for (const tier of [7, 9, 10, 11]) assert.deepEqual(F.absorbOf({ k: 'c', tier, v: 2 }), F.absorbOf({ k: 'c', tier, v: 0 }), 'un style ne donne aucun pouvoir (rang ' + tier + ')');
  console.log('variantes de style OK', JSON.stringify(cnt));
}

{ // packs : probabilités réelles = probabilités affichées, garanties, indices honnêtes, déterminisme
  const { PACKS, rollCards, draw, mulberry, SCENES } = await import('../js/packs.js'); const { POOL, CAT } = await import('../js/catalog.js');
  for (const [id, pk] of Object.entries(PACKS)) assert.ok(Math.abs(pk.odds.reduce((a, b) => a + b, 0) - 100) < 1e-9, 'les probabilités de ' + id + ' font 100 %');
  assert.ok([0, 1, 2, 3, 4, 5].every((r) => POOL.some((c) => c.r === r)), 'chaque rareté a des cartes'); assert.equal(new Set(POOL.map((c) => c.key)).size, POOL.length, 'cartes uniques');
  for (const [t, vs] of Object.entries(CAT)) for (const [v, e] of Object.entries(vs)) { assert.ok(e.n && e.c.length === 3 && e.r >= 0 && e.r <= 5, `fiche ${t}:${v}`); if (+v >= 4) assert.equal(e.src, 'pack'); }
  const rng = mulberry(123), N = 400000, cnt = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < N / 5; i++) for (const c of rollCards(PACKS.etoile, rng)) cnt[c.r]++;
  PACKS.etoile.odds.forEach((p, r) => { const exp = (N * p) / 100, tol = Math.max(5 * Math.sqrt(exp), exp * 0.04); assert.ok(Math.abs(cnt[r] - exp) < tol, `rareté ${r} : ${cnt[r]} tirés pour ${exp.toFixed(0)} attendus`); });
  for (const [id, pk] of Object.entries(PACKS)) { let py = {}, gap = 0, maxGap = 0; for (let i = 0; i < 4000; i++) { const d = draw(id, py, 1000 + i); py = d.pity; assert.ok(d.tell.best >= pk.min, `${id} : au moins la rareté garantie`); assert.equal(d.tell.scene, SCENES[Math.max(...d.cards.map((c) => c.r))], 'l\'indice annonce la vraie meilleure rareté'); assert.ok(d.cards.every((c, k) => !k || d.cards[k - 1].r <= c.r), 'ordre de révélation croissant'); gap = d.tell.best >= 3 ? 0 : gap + 1; maxGap = Math.max(maxGap, gap); } assert.ok(maxGap < pk.pity[0], `${id} : un épique au plus tous les ${pk.pity[0]} packs (série max ${maxGap})`); }
  assert.deepEqual(draw('etoile', {}, 77).cards, draw('etoile', {}, 77).cards, 'même graine, même tirage');
  for (let r = 0; r <= 5; r++) { const d = draw('galaxie', {}, 9 + r, r); assert.equal(d.tell.best, r, 'rareté forcée ' + r); }
  console.log('packs OK');
}
{ // Blitz : cuve resserrée, chrono qui ne démarre qu'au 1er lâcher, tempo, fin au temps écoulé, rejeu identique
  const g = F.newGame(5, { blitz: true }); assert.ok(g.inset >= F.BLITZ.inset - 1e-9 && g.blitz.left === F.BLITZ.start, 'cuve étroite dès le départ');
  for (let i = 0; i < 600; i++) F.step(g); assert.ok(!g.over && g.blitz.left === F.BLITZ.start, 'le chrono attend le premier lâcher');
  F.drop(g, 5); assert.ok(g.blitz.started && g.blitz.left > F.BLITZ.start, 'le 1er lâcher lance le chrono et rend du temps');
  let n = 0; while (!g.over && n++ < 120 * 30) F.step(g); assert.ok(g.over && g.timeout && g.blitz.left === 0, 'plus aucun lâcher : le temps s\'écoule et la partie se termine');
  assert.ok(g.t < F.BLITZ.start + 12, 'fin dans le temps imparti (≈ 8 s + gain du lâcher)');
  // tempo : lâchers rapprochés → multiplicateur ; arrêt → retombe
  const h = F.newGame(9, { blitz: true }); let k = 0; 
  while (h.drops < 14 && !h.over && k++ < 120 * 40) { F.step(h); if (h.cool <= 0 && h.t - h.blitz.last >= 0.5) { if (F.drop(h, 3 + (h.drops % 5))) { } } }
  assert.ok(h.blitz.maxMult >= 3, 'un rythme soutenu monte le tempo (×' + h.blitz.maxMult + ')'); for (let i = 0; i < 160; i++) F.step(h); assert.equal(h.blitz.mult, 1, 'le tempo retombe à l\'arrêt');
  const a = F.replay(h.seed, h.log, h.n, { blitz: true }); assert.equal(a.score, h.score, 'le Blitz se rejoue à l\'identique'); assert.equal(F.newGame(5).blitz, null, 'le mode normal ne change pas');
  console.log('blitz OK (tempo max ×' + h.blitz.maxMult + ', score ' + h.score + ')');
}
{ // pouvoirs équipés : la variante à pouvoir à chaque fusion de ce rang, sans bonus de points ; consignés dans le journal, rejouables
  const mk = (G, t) => { G.bodies.length = 0; const r = F.TIERS[t].r; G.bodies.push({ id: 1, k: 'c', tier: t, v: 0, x: 4, y: 10, vx: 0, vy: 0, r, ang: 0, av: 0, age: 5, hit: true, dead: false }, { id: 2, k: 'c', tier: t, v: 0, x: 4 + r * 1.9, y: 10, vx: 0, vy: 0, r, ang: 0, av: 0, age: 5, hit: true, dead: false }); G.chain = 0; G.chainT = 0; };
  const run = (power) => { const G = F.newGame(41); if (power) { G.log.push(0, -1e6 - F.maskOf({ 8: 1 })); F.act(G, G.log[1]); } mk(G, 7); G.score = 0; for (let k = 0; k < 20 && !G.bodies.some((b) => b.tier === 8); k++) F.tick(G, 1 / 60); return [G, G.bodies.find((b) => b.tier === 8)]; };
  const [g0, b0] = run(false), [g1, b1] = run(true);
  assert.ok(b0 && !b0.v, 'sans pouvoir équipé : astre ordinaire'); assert.ok(b1 && b1.v === 1 && b1.eq, 'pouvoir équipé : supergéante à chaque fusion'); assert.equal(g1.score, g0.score, 'aucun bonus de points pour un pouvoir équipé');
  assert.deepEqual(F.powersOf(F.maskOf({ 8: 1, 3: 1 })), { 3: 1, 8: 1 }, 'masque aller-retour');
  const r = F.replay(g1.seed, g1.log, g1.n); assert.deepEqual(r.powers, { 8: 1 }, 'le rejeu lit les pouvoirs dans le journal');
  console.log('pouvoirs équipés OK');
}
{ // cuve partagée : tours alternés sans attente, propriétaire des astres, perdant = celui dont l'astre dépasse, rejeu identique
  const play = () => { const G = F.newGame(17, { shared: true }); let guard = 0; const xs = [5, 5.2, 4.8, 5, 5.1, 4.9]; // on empile au même endroit : la cuve finit par déborder
    while (!G.over && guard++ < 400) { for (let k = 0; k < 30 && !G.over; k++) F.step(G); if (G.over) break; const t = G.shared.turn; assert.ok(F.drop(G, xs[guard % xs.length]), 'lâcher autorisé tout de suite (0,25 s après le précédent)'); assert.equal(G.shared.last, t, 'le lâcheur est mémorisé'); assert.equal(G.shared.turn, t ^ 1, 'à l\'autre aussitôt'); assert.ok(!F.drop(G, 5), 'pas deux lâchers dans le même instant'); }
    return G; };
  const a = play(), b = play(); assert.ok(a.over && (a.shared.loser === 0 || a.shared.loser === 1), 'la cuve finit par déborder : un perdant désigné'); assert.equal(a.shared.loser, b.shared.loser); assert.equal(a.score, b.score, 'même partie des deux côtés');
  assert.ok(Math.abs(a.shared.drops[0] - a.shared.drops[1]) <= 1, 'tours alternés'); assert.equal(F.swapHold(F.newGame(1, { shared: true })), false, 'pas de réserve en duel de cuve');
  assert.ok(a.inset >= F.SHARED.inset - 1e-6 && a.ht === F.SHARED.ht, 'cuve réduite'); const r = F.replay(a.seed, a.log, a.n, { shared: true }); assert.equal(r.score, a.score, 'rejeu identique');
  const rep = F.newGame(17, { shared: true }); rep.noEnd = true; for (let k = 0; k < 120 * 400 && !rep.over; k++) { F.step(rep); if (k % 40 === 0) F.drop(rep, 5); } assert.ok(!rep.over, 'une copie « noEnd » (invité) ne termine jamais la partie elle-même');
  console.log('cuve partagée OK (perdant ' + a.shared.loser + ' après ' + a.drops + ' lâchers)');
}
{ // partie sauvegardée avant l'ajout de G.ht (sol) : rien ne doit traverser le sol à la reprise
  const g = JSON.parse(JSON.stringify(F.newGame(8))); delete g.ht; delete g.shared; delete g.blitz; delete g.powers;
  for (let i = 0; i < 12; i++) { for (let k = 0; k < 150; k++) F.step(g); F.drop(g, 2 + i * 0.6); }
  for (let k = 0; k < 400; k++) F.step(g); assert.ok(g.bodies.length > 0 && g.bodies.every((b) => b.y <= F.HT - b.r + 1e-6), 'une ancienne sauvegarde garde son sol');
  console.log('reprise d\'ancienne sauvegarde OK');
}
{ // Grande Cuve : chiffres de l'événement
  const C = await import('../js/cuve.js'); assert.equal(C.galaxies(4096 * 3 + 5), 3, 'galaxie = 4 096 de masse'); assert.equal(C.astresPerGalaxy, 1429, '≈ 1 429 astres posés par galaxie');
  assert.ok(Math.abs(C.MEAN_MASS - 43 / 15) < 1e-9, 'masse moyenne par astre'); assert.ok(C.pick(0) === 0 && C.pick(0.999) === 3 && [...Array(1000)].every((_, i) => C.TIERS.includes(C.pick(i / 1000))), 'tirage dans les rangs 0 à 3');
  console.log('Grande Cuve OK (' + C.astresPerGalaxy + ' astres par galaxie)');
}
{ // Deck de capacités (apparences + étoiles) et mode Shaker : tout passe par le journal, rejeu identique
  const S = await import('../js/skills.js'), CAT = (await import('../js/catalog.js')).CAT;
  let n = 0; for (const t of Object.keys(CAT)) for (const v of Object.keys(CAT[t])) if (+v >= 2 && +v <= 8) { assert.ok(S.kindOf(+t, +v), 'capacité pour ' + t + ':' + v); n++; }
  assert.ok(n >= 40, 'au moins 40 apparences à capacité : ' + n);
  const kinds = new Set(); for (const t of Object.keys(CAT)) for (const v of Object.keys(CAT[t])) if (+v >= 2) kinds.add(S.kindOf(+t, +v)); assert.ok(kinds.size >= 9, 'capacités variées : ' + [...kinds]);
  assert.ok(S.strength(9, 4, 3) > S.strength(9, 4, 1) && S.strength(9, 8, 1) > S.strength(9, 2, 1), 'étoiles et rareté renforcent');
  const deck = [{ tier: 9, v: 4, stars: 3 }, { tier: 4, v: 7, stars: 2 }, { tier: 5, v: 4, stars: 1 }, { tier: 6, v: 5, stars: 1 }, { tier: 10, v: 1, stars: 3 }];
  const run = (seed, d, shakes) => { const g = F.newGame(seed, { shake: !!shakes }), r = mulberry32(seed); F.equip(g, d); for (let i = 0; i < 260 && !g.over; i++) { F.drop(g, r() * F.W); for (let k = 0; k < 50; k++) { F.tick(g, 1 / 60); if (shakes && k === 25 && i % 3 === 0) F.shake(g, (r() - 0.5) * 40, -r() * 25); } g.ev.length = 0; } return g; };
  const a = run(11, deck, false), b = F.replay(11, a.log, a.n);
  assert.equal(b.score, a.score, 'deck : rejeu identique'); assert.equal(b.bodies.length, a.bodies.length);
  assert.ok(a.bodies.some((x) => x.sk) || a.fusions > 50, 'des astres du deck apparaissent');
  const c = run(12, deck, true), d2 = F.replay(12, c.log, c.n, { shake: true });
  assert.ok(c.shaker.n > 20, 'des secousses : ' + c.shaker.n); assert.equal(d2.score, c.score, 'shaker : rejeu identique'); assert.equal(d2.shaker.n, c.shaker.n);
  // un pulsar 3★ pousse plus fort qu'un 1★ : même situation, vitesse transmise au voisin
  const push = (stars) => { const g = F.newGame(3); F.equip(g, [{ tier: 9, v: 4, stars }]); const p = { id: 900, k: 'c', tier: 9, x: 5, y: 13, vx: 0, vy: 0, r: 1.94, ang: 0, av: 0, age: 0, hit: true, sk: true, v: 4 }, o = { id: 901, k: 'c', tier: 1, x: 7.6, y: 13, vx: 0, vy: 0, r: 0.42, ang: 0, av: 0, age: 0, hit: true }; g.bodies = [p, o];
    let best = 0; for (let k = 0; k < 120 * 5; k++) { F.step(g); best = Math.max(best, Math.abs(o.vx)); } return best; };
  const p1 = push(1), p3 = push(3); assert.ok(p3 > p1 * 1.15, `pulsar 3★ (${p3.toFixed(2)}) > 1★ (${p1.toFixed(2)})`);
  // les anciennes parties (sans deck) ne changent pas
  const old = playF(7, 120), again = F.replay(old.seed, old.log, old.n); assert.equal(again.score, old.score, 'ancienne partie inchangée');
  console.log(`deck et étoiles OK (${n} apparences à capacité, ${kinds.size} capacités, pulsar 1★ ${p1.toFixed(1)} → 3★ ${p3.toFixed(1)}) · shaker OK (${c.shaker.n} secousses rejouées)`);
}
