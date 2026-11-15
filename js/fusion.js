// Critical — « Genèse » : moteur de fusion (pur, déterministe, testé dans Node).
// On lâche des astres dans un puits de gravité. Deux astres de même rang qui se touchent fusionnent en un rang supérieur
// (orbe → astéroïde → lune → planète → … → trou noir). Chaque fusion charge la jauge de saut ; jauge pleine = saut
// vers le secteur suivant : l'onde vaporise les petits astres et les débris, puis de nouveaux débris arrivent.
// Unités : largeur du puits = 10, y vers le bas, sol à y = HT.
import { mulberry32 } from './gen.js';

export const W = 10, HT = 14.5, LINE = 2.7, DROP_Y = 1.35, MAX_TIER = 9;
const STEP = 1 / 120, GRAV = 34, REST = 0.12, CHAIN_WINDOW = 1.0, DANGER_TIME = 2.6, COOLDOWN = 0.42;
const RAD = [0.44, 0.58, 0.74, 0.92, 1.12, 1.34, 1.58, 1.84, 2.12, 2.42];
export const TIERS = RAD.map((r, i) => ({ r, pts: (i + 1) * (i + 2) * 5 }));
export const R_RUBBLE = 0.5, R_SPECIAL = 0.6;
export const STRATA = ['Ceinture', 'Nébuleuse', 'Amas stellaire', 'Pulsar', 'Supergéante', 'Quasar', 'Grand Vide', 'Horizon', 'Origine']; // secteurs traversés
export const need = (depth) => Math.min(260, 30 + depth * 24);
export const radiusOf = (b) => (b.k === 'c' ? RAD[b.tier] : b.k === 'r' ? R_RUBBLE : R_SPECIAL);

function nextItem(G) {
  const w = G.depth < 3 ? [5, 4, 3, 1] : G.depth < 6 ? [4, 4, 3, 2] : [4, 4, 3, 2, 1];
  let tot = 0; for (const v of w) tot += v;
  let x = G.rnd() * tot;
  for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return { k: 'c', tier: i };
  return { k: 'c', tier: 0 };
}

export function newGame(seed = (Math.random() * 2 ** 32) >>> 0) {
  const G = {
    seed, rnd: mulberry32(seed), bodies: [], nid: 1, t: 0, acc: 0, score: 0, depth: 0, drill: 0,
    chain: 0, chainT: 0, maxChain: 0, maxTier: 0, fusions: 0, drops: 0, danger: 0, cool: 0, over: false,
    cur: null, queue: [], hold: null, swapped: false, ev: [], pend: [],
  };
  G.cur = nextItem(G); G.queue = [nextItem(G), nextItem(G)];
  return G;
}

const itemR = (it) => (it.k === 'c' ? RAD[it.tier] : R_SPECIAL);
export const clampX = (it, x) => Math.max(itemR(it) + 0.02, Math.min(W - itemR(it) - 0.02, x));

function add(G, k, tier, x, y, vx = 0, vy = 0) {
  const b = { id: G.nid++, k, tier, x, y, vx, vy, r: 0, ang: 0, av: 0, age: 0, hit: false, dead: false };
  b.r = radiusOf(b); G.bodies.push(b); return b;
}

export function drop(G, x) {
  if (G.over || G.cool > 0) return false;
  const it = G.cur;
  add(G, it.k, it.tier, clampX(it, x), DROP_Y).fresh = true;
  G.cur = G.queue.shift(); G.queue.push(nextItem(G));
  G.cool = COOLDOWN; G.swapped = false; G.drops++;
  return true;
}
export function swapHold(G) {
  if (G.over || G.swapped) return false;
  if (G.hold) { const h = G.hold; G.hold = G.cur; G.cur = h; } else { G.hold = G.cur; G.cur = G.queue.shift(); G.queue.push(nextItem(G)); }
  G.swapped = true; return true;
}

const gift = (G, k) => { G.queue.unshift({ k, tier: -1 }); G.queue.length = 2; G.ev.push({ t: 'gift', k }); };

function kick(G, x, y, rad, force) {
  for (const b of G.bodies) {
    if (b.dead) continue;
    const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy) || 1e-6;
    if (d < rad) { const f = force * (1 - d / rad); b.vx += (dx / d) * f; b.vy += (dy / d) * f; }
  }
}
function clearRubble(G, x, y, rad) {
  for (const b of G.bodies) if (!b.dead && b.k === 'r' && Math.hypot(b.x - x, b.y - y) < rad + b.r) { b.dead = true; G.score += 15; G.ev.push({ t: 'crumble', x: b.x, y: b.y }); }
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
  G.fusions++;
  const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, tier = a.tier;
  if (tier >= MAX_TIER) { // deux noyaux ultimes : supernova
    const pts = 5000 * Math.min(G.chain, 8); G.score += pts;
    kick(G, x, y, 7, 16); clearRubble(G, x, y, 99);
    G.ev.push({ t: 'nova', x, y, chain: G.chain, pts });
    charge(G, need(G.depth));
    return;
  }
  const n = add(G, 'c', tier + 1, x, y, (a.vx + b.vx) / 2, (a.vy + b.vy) / 2);
  n.x = Math.max(n.r, Math.min(W - n.r, n.x)); n.y = Math.min(HT - n.r, n.y); n.hit = true; n.age = 0.5;
  const pts = TIERS[tier + 1].pts * Math.min(G.chain, 8); // multiplicateur plafonné : le score reste lisible G.score += pts;
  if (tier + 1 > G.maxTier) G.maxTier = tier + 1;
  kick(G, x, y, n.r * 2.1, 2.2 + tier * 0.35);
  clearRubble(G, x, y, n.r + 0.45);
  G.ev.push({ t: 'merge', x, y, tier: tier + 1, chain: G.chain, pts, id: n.id });
  charge(G, tier + 1 + (G.chain - 1));
  if (G.chain === 5) gift(G, 'b'); // belle chaîne : une charge explosive offerte
}

function explode(G, b) {
  b.dead = true;
  for (const o of G.bodies) {
    if (o.dead || o === b) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (o.k === 'c' && o.tier <= 2 && d < 2.3 + o.r) { o.dead = true; G.score += TIERS[o.tier].pts; G.ev.push({ t: 'vapor', x: o.x, y: o.y, tier: o.tier }); }
  }
  clearRubble(G, b.x, b.y, 3);
  kick(G, b.x, b.y, 5, 13);
  G.ev.push({ t: 'boom', x: b.x, y: b.y });
}

function pierce(G) {
  G.drill = 0; G.depth++;
  let n = 0;
  for (const b of G.bodies) {
    if (b.dead) continue;
    if (b.k === 'r' || (b.k === 'c' && b.tier <= 1)) { b.dead = true; n++; G.score += b.k === 'c' ? TIERS[b.tier].pts * 2 : 15; G.ev.push({ t: 'vapor', x: b.x, y: b.y, tier: b.k === 'c' ? b.tier : -1 }); }
    else b.vy -= 7 + G.rnd() * 3; // le souffle soulève tout : nouvelles rencontres possibles
  }
  G.score += 500 * G.depth;
  G.ev.push({ t: 'pierce', depth: G.depth, cleared: n, pts: 500 * G.depth });
  gift(G, 'j');
  const k = Math.min(6, G.depth);
  for (let i = 0; i < k; i++) G.pend.push({ t: 'rubble', at: G.t + 1.5 + i * 0.28, x: R_RUBBLE + G.rnd() * (W - 2 * R_RUBBLE) });
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
      const ma = a.r * a.r, mb = b.r * b.r, ia = mb / (ma + mb), ib = ma / (ma + mb), pen = (rr - d) * 0.8;
      a.x -= nx * pen * ia; a.y -= ny * pen * ia; b.x += nx * pen * ib; b.y += ny * pen * ib;
      const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const jn = -(1 + REST) * vn, tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, jt = -vt * 0.12;
        a.vx -= (nx * jn + tx * jt) * ia; a.vy -= (ny * jn + ty * jt) * ia; b.vx += (nx * jn + tx * jt) * ib; b.vy += (ny * jn + ty * jt) * ib;
        a.av += vt * 0.06 / a.r; b.av += vt * 0.06 / b.r;
      }
    }
  }
  return merge;
}

function walls(G, b) {
  if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx *= -REST; }
  else if (b.x > W - b.r) { b.x = W - b.r; if (b.vx > 0) b.vx *= -REST; }
  if (b.y > HT - b.r) {
    b.y = HT - b.r;
    if (!b.hit) { b.hit = true; if (b.vy > 3) G.ev.push({ t: 'land', x: b.x, y: HT, v: b.vy }); if (b.k === 'b') b.fuse = true; }
    if (b.vy > 0) b.vy *= -REST;
    b.vx *= 0.985; b.av = b.av * 0.9 + (b.vx / b.r) * 0.1; // roule au sol
  }
}

function sub(G) {
  const dt = STEP; G.t += dt;
  if (G.cool > 0) G.cool -= dt;
  if (G.chainT > 0) { G.chainT -= dt; if (G.chainT <= 0) { if (G.chain >= 3) G.ev.push({ t: 'chainEnd', chain: G.chain }); G.chain = 0; } }
  for (let i = G.pend.length - 1; i >= 0; i--) {
    const p = G.pend[i]; if (p.at > G.t) continue;
    G.pend.splice(i, 1);
    if (p.t === 'pierce') pierce(G); else { const r = add(G, 'r', -1, p.x, -R_RUBBLE); r.vy = 4; G.ev.push({ t: 'rubble', x: p.x }); }
  }
  for (const b of G.bodies) {
    b.age += dt; b.vy += GRAV * dt;
    const sp = Math.hypot(b.vx, b.vy); if (sp > 40) { b.vx *= 40 / sp; b.vy *= 40 / sp; } // pas d'effet tunnel
    b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.9992; b.ang += b.av * dt; b.av *= 0.985;
  }
  for (let it = 0; it < 3; it++) {
    const m = collide(G);
    for (const b of G.bodies) if (!b.dead) walls(G, b);
    if (m) fuse(G, m[0], m[1]);
  }
  for (const b of G.bodies) if (b.fuse && !b.dead) explode(G, b);
  if (G.bodies.some((b) => b.dead)) G.bodies = G.bodies.filter((b) => !b.dead);
  // danger : un noyau posé dépasse la ligne
  let hot = false;
  for (const b of G.bodies) if (b.hit && b.age > 1 && b.y - b.r < LINE) { hot = true; break; }
  G.danger = hot ? G.danger + dt / DANGER_TIME : Math.max(0, G.danger - dt * 1.5);
  if (G.danger >= 1 && !G.pend.some((p) => p.t === 'pierce')) { G.over = true; G.ev.push({ t: 'over' }); }
}

export function tick(G, dt) {
  if (G.over) return;
  G.acc += Math.min(dt, 0.05);
  while (G.acc >= STEP && !G.over) { G.acc -= STEP; sub(G); }
}
