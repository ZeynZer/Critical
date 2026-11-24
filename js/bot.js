// Critical — robots joueurs (pur, sans DOM : console admin, tests, banc d'équilibrage).
// Le robot « Maître » ne triche pas : il ne voit que ce qu'un joueur voit (astre en main, réserve, astre suivant).
// Il essaie chaque position (et l'échange de réserve) sur une COPIE de la partie, simule la suite avec le vrai moteur,
// note le résultat, puis regarde un coup plus loin avec l'astre suivant (recherche en faisceau).
import * as F from './fusion.js';

export const LEVELS = {
  naif: { n: 'Naïf', d: 'Lâche au hasard.' },
  viseur: { n: 'Viseur', d: 'Vise l\'astre identique le plus haut.' },
  expert: { n: 'Expert', d: 'Teste chaque position sur une copie de la partie et choisit la meilleure.', pos: 14, steps: 70, beam: 0 },
  maitre: { n: 'Maître', d: 'Expert + regarde un coup plus loin avec l\'astre suivant (le plus fort, le plus lent).', pos: 16, steps: 80, beam: 4, pos2: 11, steps2: 70 },
};
const clone = (G) => (typeof structuredClone === 'function' ? structuredClone(G) : JSON.parse(JSON.stringify(G)));
const rOf = (it) => (it.k === 'c' ? F.TIERS[it.tier].r : F.R_SPECIAL);
function sim(G, steps) { // s'arrête dès que la pile est immobile (même résultat, bien moins de calcul)
  for (let i = 0; i < steps && !G.over; i++) {
    F.step(G);
    if (i >= 24 && i % 8 === 0 && !G.pend.length && G.chainT <= 0) { let mv = 0; for (const b of G.bodies) mv = Math.max(mv, Math.abs(b.vx) + Math.abs(b.vy)); if (mv < 0.25) break; }
  }
  G.ev.length = 0;
}

// Note d'une situation, comme un bon joueur : survivre d'abord (marge sous la ligne) ; les gros au fond, les tailles qui décroissent
// en montant (un petit astre enterré sous un gros ne fusionnera plus) ; voisins de tailles proches ; astres identiques rapprochés ; pile basse.
export const WEIGHTS = { margin: 4.5, marginK: 900, danger: 60000, score: 1.0, height: 9, count: 25, touch: 60, touchT: 45, bury: 160, smooth: 18, group: 40, wall: 20, feed: 120, clutter: 0, joker: 2500, comet: 700 };
export function evaluate(G, s0, W = WEIGHTS) {
  if (G.over) return -1e12;
  const B = G.bodies, HT = G.ht || F.HT; let v = 0, top = HT, big = null;
  for (const b of B) { top = Math.min(top, b.y - b.r); if (b.k === 'c' && (!big || b.tier > big.tier)) big = b; }
  // technique des bons joueurs : les petits débris vont nourrir les avaleurs (trou noir, quasar, galaxie) au lieu d'encombrer la cuve
  const eaters = []; for (const b of B) { const pw = F.absorbOf(b); if (pw) eaters.push([b, pw]); }
  for (const o of B) { if (o.k !== 'c' || o.tier > 3) continue; let fed = false, can = false;
    for (const [a, pw] of eaters) { if (o.tier > pw[0]) continue; can = true; if (Math.hypot(o.x - a.x, o.y - a.y) - a.r - o.r < pw[2] + 0.35) { fed = true; break; } }
    if (fed) v += W.feed * (1 + o.tier * 0.4); else if (can || o.tier <= 1) v -= W.clutter * (1 + o.tier * 0.3); }
  // atouts gardés en réserve : la matière exotique (copie l'astre touché : sur une galaxie, Big Bang) et la comète (nettoie les petits débris)
  if (G.hold && G.hold.k === 'j') v += W.joker; else if (G.hold && G.hold.k === 'b') v += W.comet;
  const margin = top - F.LINE;
  if (margin < W.margin) v -= (W.margin - margin) ** 2 * W.marginK;
  v -= G.danger * W.danger;
  v += (G.score - s0) * W.score;
  for (let i = 0; i < B.length; i++) {
    const a = B[i]; v -= (HT - a.y) * a.r * W.height + W.count;
    if (a.k !== 'c') continue;
    for (let j = i + 1; j < B.length; j++) {
      const b = B[j]; if (b.k !== 'c') continue; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), gap = d - a.r - b.r;
      if (a.tier === b.tier) { if (gap < 0.35) v += W.touch + a.tier * W.touchT; else v += W.group * (1 + a.tier * 0.3) / (1 + gap); } // fusion imminente, ou paire à rapprocher
      else if (gap < 0.3) v -= Math.abs(a.tier - b.tier) * W.smooth; // voisins de tailles très différentes
      const up = a.y < b.y ? a : b, dn = up === a ? b : a; // un astre posé sur un plus petit l'enterre
      if (Math.abs(dx) < (up.r + dn.r) * 0.9 && up.tier > dn.tier) v -= (up.tier - dn.tier) * W.bury * (dn.tier < 3 ? 0.5 : 1);
    }
  }
  if (big) { const wall = Math.min(big.x - big.r - G.inset, F.W - G.inset - big.x - big.r); v -= Math.max(0, wall) * (W.wall + big.tier * 6); } // le plus gros contre une paroi
  return v;
}
function positions(G, it, n) { // grille régulière + aplomb des astres identiques (les plus hauts)
  const r = rOf(it), lo = G.inset + r + 0.03, hi = F.W - G.inset - r - 0.03, xs = [];
  for (let i = 0; i < n; i++) xs.push(lo + (hi - lo) * (i / (n - 1)));
  if (it.k === 'j') for (const b of G.bodies.filter((o) => o.k === 'c').sort((a, b) => b.tier - a.tier).slice(0, 5)) xs.push(Math.max(lo, Math.min(hi, b.x)), Math.max(lo, Math.min(hi, b.x - b.r * 0.4)), Math.max(lo, Math.min(hi, b.x + b.r * 0.4))); // matière exotique : viser les plus gros
  if (it.k === 'b') for (const b of G.bodies) if (b.k === 'c' && b.tier <= 3) xs.push(Math.max(lo, Math.min(hi, b.x))); // comète : sur les petits débris
  if (it.k === 'c') for (const b of G.bodies) { const pw = F.absorbOf(b); if (pw && it.tier <= pw[0]) xs.push(Math.max(lo, Math.min(hi, b.x)), Math.max(lo, Math.min(hi, b.x - b.r * 0.5)), Math.max(lo, Math.min(hi, b.x + b.r * 0.5))); } // au-dessus d'un avaleur qui peut le manger
  if (it.k === 'c') for (const b of G.bodies.filter((o) => o.k === 'c' && o.tier === it.tier).sort((a, b) => a.y - b.y).slice(0, 3)) xs.push(Math.max(lo, Math.min(hi, b.x)), Math.max(lo, Math.min(hi, b.x - b.r * 0.6)), Math.max(lo, Math.min(hi, b.x + b.r * 0.6)));
  return [...new Set(xs.map((x) => Math.round(x * 100) / 100))];
}
let CUR_W = WEIGHTS; export const setWeights = (w) => { CUR_W = { ...WEIGHTS, ...(w || {}) }; };
function tryDrop(G, x, hold, steps, s0) { const c = clone(G); c.ev = []; if (hold && !F.swapHold(c)) return null; c.cool = 0; if (!F.drop(c, x)) return null; sim(c, steps); return { c, v: evaluate(c, s0, CUR_W), x, hold }; }

// Décision : { x, hold } — hold = échanger avec la réserve avant de lâcher
export function choose(G, level = 'maitre', rnd = Math.random) {
  if (level === 'naif') return { x: G.inset + 0.5 + rnd() * (F.W - 2 * G.inset - 1), hold: false };
  if (level === 'viseur') { const it = G.cur; if (it.k !== 'c') return { x: F.W / 2, hold: false }; const m = G.bodies.filter((b) => b.k === 'c' && b.tier === it.tier).sort((a, b) => a.y - b.y)[0]; return { x: m ? m.x : rnd() < 0.5 ? 0.6 : F.W - 0.6, hold: false }; }
  const L = LEVELS[level] || LEVELS.maitre, s0 = G.score, cands = [];
  const canHold = !G.swapped && !G.shared;
  const same = G.hold && G.hold.k === G.cur.k && G.hold.tier === G.cur.tier;
  for (const hold of canHold && !same ? [false, true] : [false]) {
    let it = G.cur; if (hold) { const c = clone(G); F.swapHold(c); it = c.cur; }
    for (const x of positions(G, it, L.pos)) { const r = tryDrop(G, x, hold, L.steps, s0); if (r) cands.push(r); }
  }
  if (!cands.length) return { x: F.W / 2, hold: false };
  cands.sort((a, b) => b.v - a.v);
  if (L.beam) for (const k of cands.slice(0, L.beam)) { // un coup plus loin, avec l'astre suivant (connu du joueur)
    let best = -1e12; for (const x of positions(k.c, k.c.cur, L.pos2)) { const r = tryDrop(k.c, x, false, L.steps2, s0); if (r && r.v > best) best = r.v; }
    k.v2 = best > -1e11 ? best : k.v - 1e6; // la valeur d'un coup = la meilleure suite possible avec l'astre suivant
  }
  const pick = L.beam ? cands.slice(0, L.beam).sort((a, b) => b.v2 - a.v2)[0] : cands[0];
  return { x: pick.x, hold: pick.hold };
}
// Le robot lâche quand le précédent est posé (pile presque immobile) ou au bout d'1,2 s de jeu
export function ready(G, last) {
  if (G.over || G.cool > 0) return false; if (G.t - last >= 1.2) return true;
  for (const b of G.bodies) if (Math.abs(b.vx) + Math.abs(b.vy) > 1.2) return false; return G.t - last >= 0.35;
}
// Partie complète sans affichage (tests, série en console admin) : renvoie la partie terminée
export function playGame(seed, level, opt = {}) {
  const G = F.newGame(seed, opt.mode === 'blitz' ? { blitz: true } : {}); let last = -9, s = (seed ^ 0x5bd1e995) >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const max = opt.maxDrops || 5000;
  while (!G.over && G.drops < max) {
    if (ready(G, last)) { const d = choose(G, level, rnd); if (d.hold) F.swapHold(G); if (F.drop(G, d.x)) last = G.t; }
    F.step(G); if (G.ev.length > 200) G.ev.length = 0;
    if (opt.onStep && G.n % 600 === 0 && opt.onStep(G) === false) break;
  }
  G.ev.length = 0; return G;
}
