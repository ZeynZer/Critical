// Critical — « Genèse » : moteur de fusion (pur, déterministe, testé dans Node).
// On lâche des astres dans un puits de gravité. Deux astres de même rang qui se touchent fusionnent en un rang supérieur
// (orbe → astéroïde → lune → planète → … → trou noir). Chaque fusion charge la jauge de saut ; jauge pleine = saut
// vers le secteur suivant : l'onde vaporise les petits astres.
// Unités : largeur du puits = 10, y vers le bas, sol à y = HT.

export const W = 10, HT = 14.5, LINE = 2.7, DROP_Y = 1.35, MAX_TIER = 12;
// Rangs : 0 poussière · 1 orbe · 2 astéroïde · 3 lune · 4 planète · 5 géante gazeuse · 6 naine orange · 7 soleil · 8 géante rouge · 9 étoile à neutrons · 10 trou noir · 11 quasar · 12 galaxie
export const NEUTRON = 9, HOLE = 10, GIANT = 8, SUN = 7;
// Variantes rares : chance, à chaque création d'un astre de ce rang, d'obtenir sa version rare
export const RARE = { 3: 1 / 120, 4: 1 / 150, 5: 1 / 150, 7: 1 / 120, 8: 1 / 110, 9: 1 / 90, 10: 1 / 40, 11: 1 / 25 };
// Pouvoirs d'absorption : [rang maximum avalé, secondes entre deux repas, portée au-delà du contact].
// L'étoile bleue (soleil rare) brûle les poussières et les orbes. Le trou noir avale les poussières et les orbes ; le quasar jusqu'aux astéroïdes ; la galaxie jusqu'aux lunes, de plus en plus loin, vite et gros selon sa rareté.
export const ABSORB = {
  7: [null, [1, 4.0, 0]],                                                                              // soleil (aucun pouvoir) · étoile bleue : brûle poussières et orbes au contact
  10: [[1, 3.0, 0], [2, 1.6, 0.12]],                                                                  // trou noir · trou blanc
  11: [[2, 2.0, 0.15], [3, 1.2, 0.3]],                                                                // quasar · blazar
  12: [[3, 1.6, 0.2], [3, 1.3, 0.35], [4, 1.1, 0.5], [4, 0.9, 0.65], [5, 0.7, 0.85], [6, 0.5, 1.1]], // galaxies, de la plus courante à la critique
};
export const PULSE = [[4, 2.7, 8], [2.6, 3.4, 15]]; // étoile à neutrons · magnétar : [secondes entre deux impulsions, portée en rayons, force]
export const absorbOf = (b) => { const t = b.k === 'c' && ABSORB[b.tier]; return t ? t[b.tier === MAX_TIER ? Math.min(b.v | 0, t.length - 1) : b.v === 1 ? 1 : 0] || null : null; }; // v = 1 : variante rare à pouvoir ; v ≥ 2 : simple style
// Une galaxie tire toujours sa rareté : spirale, barrée dorée, émeraude, annulaire, prismatique, critique
// Variantes de style (v = 2, 3…) : purement visuelles, assez fréquentes. Tirées dans un flux à part (graine + n° de fusion) : la partie,
// son score et son journal ne changent pas, les anciennes parties se rejouent donc à l'identique.
export const STYLES = { 3: [1 / 24], 4: [1 / 18, 1 / 36], 5: [1 / 18, 1 / 36], 6: [1 / 16], 7: [1 / 18], 8: [1 / 16], 9: [1 / 14], 10: [1 / 18], 11: [1 / 12] };
export const MYTHIC = 9; // v = 9 : astre prismatique, obtenu seulement par fusion dans la collection (jamais en partie)
const roll2 = (a, b) => { let t = (a ^ Math.imul(b + 0x9E3779B9, 0x85EBCA6B)) >>> 0; t = Math.imul(t ^ (t >>> 15), 0x2C1B3C6D); t = Math.imul(t ^ (t >>> 12), 0x297A2D39); return ((t ^ (t >>> 15)) >>> 0) / 4294967296; };
export const GALAXY = [0.62, 0.25, 0.09, 0.03, 0.009, 0.001];
const SLOP = 0.012; // chevauchement toléré : sans lui, la correction de position fait trembler et ramper les piles
const STEP = 1 / 120, GRAV = 34, REST = 0.12, CHAIN_WINDOW = 1.0, DANGER_TIME = 2.6, COOLDOWN = 0.3;
const RAD = [0.3, 0.42, 0.55, 0.68, 0.88, 1.08, 1.28, 1.5, 1.72, 1.94, 2.18, 2.42, 2.7];
export const TIERS = RAD.map((r, i) => ({ r, pts: (i + 1) * (i + 2) * 5 }));
export const R_SPECIAL = 0.6;
export const STRATA = ['Ceinture', 'Nébuleuse', 'Amas stellaire', 'Pulsar', 'Supergéante', 'Quasar', 'Grand Vide', 'Horizon', 'Origine']; // secteurs traversés
export const need = (depth) => Math.min(260, 30 + depth * 24);
// Chaque secteur change une règle : g = intensité de la chute, inset = parois resserrées. Aucun vent : un astre qui tombe tombe droit.
const MODS = [{}, { g: 0.8, n: 'Brume : chute ralentie' }, { inset: 0.4, n: 'Cuve étroite' }, { g: 1.15, n: 'Gravité accrue' }, { g: 1.3, n: 'Gravité forte' },
  { g: 0.7, n: 'Légèreté' }, { g: 0.6, n: 'Gravité faible' }, { inset: 0.8, n: 'Puits resserré' }, { g: 1.15, inset: 0.4, n: 'Chaos originel' }];
export const mod = (d) => ({ g: 1, inset: 0, n: '', ...MODS[d % MODS.length] });
// Blitz : cuve resserrée en permanence, chrono qui ne tourne qu'une fois le 1er astre lâché, tempo (lâchers rapprochés) qui multiplie les points.
export const BLITZ = { max: 10, inset: 1.7, ht: 8.6, start: 8, fast: 0.9, gainFast: 0.9, gainSlow: 0.5, drop: 25 }; // secondes ; inset en unités de cuve (W = 10)
const modOf = (G, d) => { const m = mod(d); if (G.blitz && m.inset < BLITZ.inset) m.inset = BLITZ.inset; return m; };
export const radiusOf = (b) => (b.k === 'c' ? RAD[b.tier] : R_SPECIAL);

export function mulberry32(a) { return () => { let t = (a = (a + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// mulberry32 dont l'état vit dans G.rs : la partie entière tient dans un objet JSON (sauvegarde, reprise, rejeu)
function rnd(G) { let t = (G.rs = (G.rs + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function nextItem(G) {
  const w = G.depth < 3 ? [5, 5, 3, 2] : G.depth < 6 ? [4, 5, 4, 2, 1] : [3, 4, 4, 3, 2];
  let tot = 0; for (const v of w) tot += v;
  let x = rnd(G) * tot;
  for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return { k: 'c', tier: i };
  return { k: 'c', tier: 0 };
}

export function newGame(seed = (Math.random() * 2 ** 32) >>> 0, opt = {}) {
  const G = {
    seed, rs: seed | 0, n: 0, log: [], bodies: [], nid: 1, t: 0, acc: 0, score: 0, depth: 0, drill: 0,
    chain: 0, chainT: 0, maxChain: 0, maxTier: 0, fusions: 0, drops: 0, danger: 0, near: false, cool: 0, over: false,
    cur: null, queue: [], hold: null, swapped: false, ev: [], pend: [], mod: mod(0), inset: 0, eaten: 0, ht: opt.blitz ? BLITZ.ht : HT, blitz: opt.blitz ? { left: BLITZ.start, started: false, combo: 0, mult: 1, maxMult: 1, last: -9 } : null, timeout: false, sandbox: !!opt.sandbox, // bac à sable : jamais de défaite, pas de score, pas de tirage rare, l'astre choisi reste en main
  };
  G.mod = modOf(G, 0); G.inset = G.mod.inset; G.cur = nextItem(G); G.queue = [nextItem(G), nextItem(G)];
  return G;
}

const itemR = (it) => (it.k === 'c' ? RAD[it.tier] : R_SPECIAL);
export const clampX = (it, x, inset = 0) => Math.max(inset + itemR(it) + 0.02, Math.min(W - inset - itemR(it) - 0.02, x));

function add(G, k, tier, x, y, vx = 0, vy = 0) {
  const b = { id: G.nid++, k, tier, x, y, vx, vy, r: 0, ang: 0, av: 0, age: 0, hit: false, dead: false };
  b.r = radiusOf(b); G.bodies.push(b); return b;
}

export function drop(G, x) {
  if (G.over || G.cool > 0) return false;
  const it = G.cur;
  const dx = Math.round(clampX(it, x, G.inset) * 1000) / 1000; // position arrondie au millième : c'est exactement ce que le journal enregistre
  const nb = add(G, it.k, it.tier, dx, DROP_Y); nb.fresh = true; if (it.v) nb.v = it.v;
  if (!G.sandbox) { G.cur = G.queue.shift(); G.queue.push(nextItem(G)); }
  if (G.blitz) { // tempo : un lâcher dans la seconde qui suit le précédent prolonge le combo (×1 à ×5) et rend plus de temps
    const B = G.blitz, gap = G.t - B.last, fast = gap < BLITZ.fast; B.started = true; B.combo = fast ? B.combo + 1 : 0; B.last = G.t; B.mult = 1 + Math.min(4, Math.floor(B.combo / 3)); B.maxMult = Math.max(B.maxMult, B.mult);
    const gain = fast ? BLITZ.gainFast : BLITZ.gainSlow; B.left = Math.min(BLITZ.max, B.left + gain); G.score += BLITZ.drop * B.mult; G.ev.push({ t: 'tgain', gain, mult: B.mult, x: dx, y: DROP_Y });
  }
  G.cool = COOLDOWN; G.swapped = false; G.drops++; G.log.push(G.n, Math.round(dx * 1000)); // journal (pas de calcul, position) : permet de rejouer la partie à l'identique
  return true;
}
export function swapHold(G) {
  if (G.over || G.swapped) return false;
  if (G.hold) { const h = G.hold; G.hold = G.cur; G.cur = h; } else { G.hold = G.cur; G.cur = G.queue.shift(); G.queue.push(nextItem(G)); }
  G.swapped = true; G.log.push(G.n, -1); return true;
}

const gift = (G, k) => { G.queue.unshift({ k, tier: -1 }); G.queue.length = 2; G.ev.push({ t: 'gift', k }); };

function kick(G, x, y, rad, force) {
  for (const b of G.bodies) {
    if (b.dead || !b.hit) continue; // un astre encore en chute n'est jamais poussé de côté
    const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy) || 1e-6;
    if (d < rad) { const f = force * (1 - d / rad); b.vx += (dx / d) * f; b.vy += (dy / d) * f; }
  }
}
function charge(G, n) {
  G.drill += n;
  if (G.drill >= need(G.depth) && !G.pend.some((p) => p.t === 'pierce')) G.pend.push({ t: 'pierce', at: G.t + 0.35 });
}

function fuse(G, a, b) {
  a.dead = b.dead = true;
  // une chaîne = la cascade déclenchée par UN lâcher : le noyau fraîchement lâché ouvre toujours une nouvelle chaîne
  G.chain = G.chainT > 0 && !a.fresh && !b.fresh ? G.chain + 1 : 1; G.chainT = CHAIN_WINDOW;
  if (G.chain > G.maxChain) G.maxChain = G.chain;
  G.fusions++; const bm = G.blitz ? G.blitz.mult : 1;
  if (G.blitz) G.blitz.left = Math.min(BLITZ.max, G.blitz.left + Math.min(1.2, 0.35 + 0.15 * G.chain)); // une fusion rend aussi du temps
  const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, tier = a.tier;
  if (tier >= MAX_TIER) { // deux galaxies : Big Bang. Tout disparaît (secteur vierge), puis le saut de secteur suit.
    const pts = 5000 * Math.min(G.chain, 8) * bm, gone = []; G.score += pts;
    for (const o of G.bodies) {
      if (!o.dead) { o.dead = true; if (o.k === 'c') G.score += TIERS[o.tier].pts; }
      gone.push({ x: o.x, y: o.y, k: o.k, tier: o.k === 'c' ? o.tier : -1, v: o.v | 0, r: o.r }); // pour l'animation : les astres sont aspirés vers le point d'impact
    }
    G.danger = 0; G.near = false;
    G.ev.push({ t: 'nova', x, y, chain: G.chain, pts, gone });
    if (!G.sandbox) charge(G, need(G.depth));
    return;
  }
  const n = add(G, 'c', tier + 1, x, y, (a.vx + b.vx) / 2, (a.vy + b.vy) / 2);
  n.x = Math.max(n.r, Math.min(W - n.r, n.x)); n.y = Math.min(G.ht - n.r, n.y); n.hit = true; n.age = 0.5;
  if (G.sandbox) { /* aucun tirage : une variante rare ne se débloque pas ici */ }
  else if (tier + 1 === MAX_TIER) { let x0 = rnd(G), v = 0; while (v < GALAXY.length - 1 && (x0 -= GALAXY[v]) >= 0) v++; n.v = v; G.ev.push({ t: 'rare', x, y, tier: tier + 1, v, p: GALAXY[v] }); }
  else {
    if (RARE[tier + 1] && rnd(G) < RARE[tier + 1]) { n.v = 1; G.ev.push({ t: 'rare', x, y, tier: tier + 1, v: 1, p: RARE[tier + 1] }); }
    else if (STYLES[tier + 1]) { let u = roll2(G.seed | 0, G.fusions); STYLES[tier + 1].some((p, i) => { if (u < p) { n.v = 2 + i; G.ev.push({ t: 'rare', x, y, tier: tier + 1, v: n.v, p }); return true; } u -= p; return false; }); }
  }
  const pts = TIERS[tier + 1].pts * Math.min(G.chain, 8) * (n.v === 1 || (n.v && tier + 1 === MAX_TIER) ? 3 : 1) * bm; G.score += pts; // multiplicateur de chaîne plafonné à ×8 ; une variante rare triple les points
  if (tier + 1 > G.maxTier) G.maxTier = tier + 1;
  if (!G.sandbox && tier === SUN && G.chain >= 3) { G.score += 2000; G.ev.push({ t: 'secret', id: 'binaire', x, y }); } // deux soleils réunis en pleine chaîne
  kick(G, x, y, n.r * 2.1, 2.2 + tier * 0.35);
  G.ev.push({ t: 'merge', x, y, tier: tier + 1, chain: G.chain, pts, id: n.id });
  if (G.sandbox) return;
  charge(G, tier + 1 + (G.chain - 1));
  if (G.chain === 5) gift(G, 'b'); // belle chaîne : une charge explosive offerte
}

function explode(G, b) {
  b.dead = true;
  for (const o of G.bodies) {
    if (o.dead || o === b) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (o.k === 'c' && o.tier <= 3 && d < 2.3 + o.r) { o.dead = true; G.score += TIERS[o.tier].pts; G.ev.push({ t: 'vapor', x: o.x, y: o.y, tier: o.tier }); }
  }
  kick(G, b.x, b.y, 5, 13);
  G.ev.push({ t: 'boom', x: b.x, y: b.y });
}

function pierce(G) {
  G.drill = 0; G.depth++; G.mod = modOf(G, G.depth);
  let n = 0;
  for (const b of G.bodies) {
    if (b.dead) continue;
    if (b.k === 'c' && b.tier <= 2) { b.dead = true; n++; G.score += TIERS[b.tier].pts * 2; G.ev.push({ t: 'vapor', x: b.x, y: b.y, tier: b.tier }); }
    else b.vy -= 7 + rnd(G) * 3; // le souffle soulève tout : nouvelles rencontres possibles
  }
  G.score += 500 * G.depth;
  G.ev.push({ t: 'pierce', depth: G.depth, cleared: n, pts: 500 * G.depth });
  gift(G, 'j');
}

function collide(G) {
  const B = G.bodies, n = B.length;
  let merge = null;
  for (let i = 0; i < n; i++) {
    const a = B[i]; if (a.dead) continue;
    for (let j = i + 1; j < n; j++) {
      const b = B[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
      if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
      const d2 = dx * dx + dy * dy; if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
      if (!a.hit || !b.hit) { const v = Math.hypot(a.vx - b.vx, a.vy - b.vy); if (v > 3) G.ev.push({ t: 'land', x: a.x + nx * a.r, y: a.y + ny * a.r, v }); a.hit = b.hit = true; }
      if (a.k === 'b' || b.k === 'b') { (a.k === 'b' ? a : b).fuse = true; }
      if (a.k === 'j' && b.k === 'c') { a.k = 'c'; a.tier = b.tier; a.r = b.r; G.ev.push({ t: 'morph', x: a.x, y: a.y, tier: b.tier }); }
      else if (b.k === 'j' && a.k === 'c') { b.k = 'c'; b.tier = a.tier; b.r = a.r; G.ev.push({ t: 'morph', x: b.x, y: b.y, tier: a.tier }); }
      if (!merge && a.k === 'c' && b.k === 'c' && a.tier === b.tier) { merge = [a, b]; continue; }
      const ma = a.r * a.r, mb = b.r * b.r, ia = mb / (ma + mb), ib = ma / (ma + mb), pen = Math.max(0, rr - d - SLOP) * 0.6; a.touch = b.touch = true;
      a.x -= nx * pen * ia; a.y -= ny * pen * ia; b.x += nx * pen * ib; b.y += ny * pen * ib;
      const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const jn = -(1 + REST) * vn, tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, jt = -vt * 0.04;
        a.vx -= (nx * jn + tx * jt) * ia; a.vy -= (ny * jn + ty * jt) * ia; b.vx += (nx * jn + tx * jt) * ib; b.vy += (ny * jn + ty * jt) * ib;
        a.av += vt * 0.06 / a.r; b.av += vt * 0.06 / b.r;
      }
    }
  }
  return merge;
}

// Les absorbeurs (trou noir, quasar, galaxie) avalent le plus proche de leurs petits voisins, puis doivent attendre. Jamais un autre absorbeur.
function absorb(G) {
  for (const a of G.bodies) {
    if (a.dead || a.et > 0) continue; const pw = absorbOf(a); if (!pw) continue;
    let best = null, bd = 1e9;
    for (const o of G.bodies) {
      if (o === a || o.dead || o.k !== 'c' || o.tier > pw[0]) continue;
      const d = Math.hypot(o.x - a.x, o.y - a.y) - a.r - o.r; // distance entre les bords (négative si ça se chevauche)
      if (d < pw[2] + 0.02 && d < bd) { bd = d; best = o; }
    }
    if (!best) continue;
    best.dead = true; a.et = pw[1]; G.score += Math.round(TIERS[best.tier].pts / 2); G.eaten++;
    G.ev.push({ t: 'swallow', x: best.x, y: best.y, hx: a.x, hy: a.y, tier: best.tier, by: a.tier, bv: a.v | 0 });
    if (G.eaten === 5) G.ev.push({ t: 'secret', id: 'festin', x: a.x, y: a.y });
  }
}
function walls(G, b) {
  const L = G.inset + b.r, R = W - G.inset - b.r;
  if (b.x < L) { b.x = L; if (b.vx < 0) b.vx *= -REST; }
  else if (b.x > R) { b.x = R; if (b.vx > 0) b.vx *= -REST; }
  if (b.y > G.ht - b.r) {
    b.y = G.ht - b.r; b.touch = true;
    if (!b.hit) { b.hit = true; if (b.vy > 3) G.ev.push({ t: 'land', x: b.x, y: G.ht, v: b.vy }); if (b.k === 'b') b.fuse = true; }
    if (b.vy > 0) b.vy *= -REST;
  }
}

// Seule force : la pesanteur du secteur, verticale. Pas de vent, pas d'attraction entre astres.
const fall = (G) => GRAV * G.mod.g;
// Trajectoire prévue du prochain lâcher (pour la visée) : une verticale, jusqu'au premier contact. [x, y, x, y, …]
export function trace(G, x0) {
  const it = G.cur, r = itemR(it), x = clampX(it, x0, G.inset), pts = []; let y = DROP_Y, v = 0;
  for (let i = 0; i < 150; i++) {
    v += fall(G) / 60; y += v / 60; if (i % 2 === 0) pts.push(x, y);
    if (y > G.ht - r) break;
    let hit = false; for (const b of G.bodies) if (Math.hypot(b.x - x, b.y - y) < b.r + r) { hit = true; break; }
    if (hit) break;
  }
  return pts;
}

function sub(G) {
  const dt = STEP; G.t += dt; G.n++;
  if (G.cool > 0) G.cool -= dt;
  if (G.blitz && G.blitz.started) { const B = G.blitz; if (B.combo && G.t - B.last > BLITZ.fast) { B.combo = 0; B.mult = 1; } B.left -= dt; if (B.left <= 0 && !G.over) { B.left = 0; G.over = true; G.timeout = true; G.ev.push({ t: 'over', timeout: true }); } } // le tempo retombe si on s'arrête ; temps écoulé = fin
  G.inset += (G.mod.inset - G.inset) * Math.min(1, dt * 1.5);
  if (G.chainT > 0) { G.chainT -= dt; if (G.chainT <= 0) { if (G.chain >= 3) G.ev.push({ t: 'chainEnd', chain: G.chain }); G.chain = 0; } }
  for (let i = G.pend.length - 1; i >= 0; i--) {
    const p = G.pend[i]; if (p.at > G.t) continue;
    G.pend.splice(i, 1);
    pierce(G);
  }
  const gy = fall(G);
  for (const b of G.bodies) {
    b.px = b.x; b.py = b.y; b.age += dt; b.vy += gy * dt;
    if (b.k === 'c') {
      if (b.tier === GIANT) { if (b.v !== 1) b.r = RAD[GIANT] * (1 + 0.22 * Math.min(1, b.age / 40)); } // la géante rouge enfle tant qu'on ne la fusionne pas ; la supergéante (rare) reste stable
      else if (b.tier === NEUTRON) { const pu = PULSE[b.v === 1 ? 1 : 0]; b.pt = (b.pt || 0) + dt; if (b.pt >= pu[0]) { b.pt = 0; kick(G, b.x, b.y, b.r * pu[1], pu[2]); G.ev.push({ t: 'pulse', x: b.x, y: b.y, r: b.r, v: b.v | 0, reach: pu[1] }); } } // l'étoile à neutrons repousse par impulsions ; le magnétar plus souvent et plus fort
      else if (b.et > 0) b.et -= dt;
    }
    const sp = Math.hypot(b.vx, b.vy); if (sp > 40) { b.vx *= 40 / sp; b.vy *= 40 / sp; } // pas d'effet tunnel
    b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.9992; b.ang += b.av * dt; b.av *= 0.985;
  }
  for (const b of G.bodies) { b.touch = false; }
  for (let it = 0; it < 6; it++) {
    const m = collide(G);
    for (const b of G.bodies) if (!b.dead) walls(G, b);
    if (m) fuse(G, m[0], m[1]);
  }
  // frottement de repos : un astre en contact et presque immobile s'arrête, au lieu de glisser lentement sous la pression
  // résistance de roulement au sol, UNE fois par pas (elle était appliquée à chaque passe de résolution, donc multipliée par 3 puis 6)
  for (const b of G.bodies) if (b.y >= G.ht - b.r - 1e-6) { b.vx *= 0.995; b.av = b.av * 0.9 + (b.vx / b.r) * 0.1; }
  // … et gel des micro-mouvements (< 0,008 unité/s) d'un astre en contact, sinon les piles rampent ; assez bas pour ne jamais retenir un astre qui veut rouler
  for (const b of G.bodies) if (b.touch) {
    b.av *= 0.96;
    const dx = b.x - b.px, dy = b.y - b.py;
    if (dx * dx + dy * dy < 4e-9) { b.x = b.px; b.y = b.py; b.vx = b.vy = 0; b.av *= 0.8; }
  }
  absorb(G);
  for (const b of G.bodies) if (b.fuse && !b.dead) explode(G, b);
  if (G.bodies.some((b) => b.dead)) G.bodies = G.bodies.filter((b) => !b.dead);
  // défaite : un astre posé ENTIÈREMENT au-dessus de la ligne (son bord bas compris) pendant DANGER_TIME ; un simple dépassement ne compte pas
  let hot = false, near = false;
  if (!G.sandbox) for (const b of G.bodies) if (b.hit && b.age > 1) { if (b.y + b.r < LINE) { hot = true; break; } if (b.y - b.r < LINE) near = true; }
  G.near = near || hot; // avertissement visuel seulement
  G.danger = hot ? G.danger + dt / DANGER_TIME : Math.max(0, G.danger - dt * 1.5);
  if (G.danger >= 1 && !G.pend.some((p) => p.t === 'pierce')) { G.over = true; G.ev.push({ t: 'over' }); }
}

export const step = sub; // un pas de simulation (utilisé par la rediffusion)
export function tick(G, dt) {
  if (G.over) return;
  G.acc += Math.min(dt, 0.05);
  while (G.acc >= STEP && !G.over) { G.acc -= STEP; sub(G); }
}

// Rejoue une partie depuis sa graine et son journal jusqu'au pas `end` : même moteur, même résultat.
// Sert à vérifier un score (côté serveur plus tard) : un score qui ne se rejoue pas à l'identique est faux.
export function replay(seed, log, end, opt) {
  const G = newGame(seed, opt);
  for (let i = 0; i < log.length && !G.over; i += 2) {
    while (G.n < log[i] && !G.over) sub(G);
    if (log[i + 1] < 0) swapHold(G); else drop(G, log[i + 1] / 1000);
  }
  while (G.n < end && !G.over) sub(G);
  return G;
}
