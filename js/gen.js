// Critical — générateur de niveaux. Même code côté Node (campagne pré-générée) et navigateur (défi quotidien).
import { decode, encode, clone, run, solve, remaining, reactors } from './engine.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export const WORLDS = [
  { id: 1, name: 'Noyau', sub: 'Une étincelle, une chaîne.', hue: 190, col: '#4df3ff' },
  { id: 2, name: 'Pulsar', sub: 'Les ondes passent en diagonale.', hue: 320, col: '#ff4fd8' },
  { id: 3, name: 'Blindage', sub: 'Des murs et des cœurs solides.', hue: 250, col: '#9b8cff' },
  { id: 4, name: 'Prisme', sub: 'Les miroirs plient la trajectoire.', hue: 165, col: '#5dffc0' },
  { id: 5, name: 'Nova', sub: 'Huit directions, zéro marge.', hue: 38, col: '#ffc247' },
  { id: 6, name: 'Critique', sub: 'Tout ensemble. Bonne chance.', hue: 350, col: '#ff5c7a' },
];
export const PER_WORLD = 10;

// Paramètres d'un niveau de campagne (monde wi, rang k de 0 à 9)
export function levelParams(wi, k) {
  const r = (a, b) => Math.round(a + ((b - a) * k) / (PER_WORLD - 1));
  const P = [
    { w: 5, h: 7, n: [4 + (k > 0) + (k > 2) + (k > 4) + (k > 6) + (k > 8), 0], types: [1, 0, 0], hpMax: k < 3 ? 1 : 2, walls: 0, mir: 0, sol: k < 3 ? 1 : k < 9 ? 2 : 3 },
    { w: 6, h: 8, n: [r(6, 10), 0], types: [3, 2, 0], hpMax: 2, walls: 0, mir: 0, sol: k < 4 ? 2 : 3 },
    { w: 6, h: 8, n: [r(7, 11), 0], types: [3, 1, 0], hpMax: 3, walls: r(2, 4), mir: 0, sol: k < 3 ? 2 : 3 },
    { w: 6, h: 8, n: [r(7, 11), 0], types: [3, 1, 0], hpMax: 2, walls: r(1, 3), mir: r(2, 5), sol: k < 3 ? 2 : 3 },
    { w: 6, h: 8, n: [r(7, 11), 0], types: [2, 1, 2], hpMax: 2, walls: r(1, 3), mir: r(0, 2), sol: k < 3 ? 2 : 3 },
    { w: 7, h: 9, n: [r(9, 13), 0], types: [2, 2, 2], hpMax: 3, walls: r(2, 5), mir: r(2, 4), sol: k < 5 ? 3 : 4 },
  ][wi];
  return { ...P, tries: 600 };
}

function build(rng, P) {
  const { w, h } = P, n = w * h;
  const type = new Uint8Array(n), hp = new Uint8Array(n);
  const cells = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [cells[i], cells[j]] = [cells[j], cells[i]]; }
  let p = 0;
  for (let k = 0; k < P.walls; k++) type[cells[p++]] = 4;
  for (let k = 0; k < P.mir; k++) type[cells[p++]] = rng() < 0.5 ? 5 : 6;
  const tw = P.types, tot = tw[0] + tw[1] + tw[2];
  const cnt = P.n[0];
  for (let k = 0; k < cnt; k++) {
    let x = rng() * tot, t = 1;
    if (x >= tw[0]) { x -= tw[0]; t = x < tw[1] ? 2 : 3; }
    const i = cells[p++];
    type[i] = t;
    hp[i] = 1 + ((rng() * rng() * P.hpMax) | 0); // biais vers les petits pv
    if (hp[i] > P.hpMax) hp[i] = P.hpMax;
  }
  return { w, h, type, hp };
}

// Génère le meilleur niveau trouvé dans le budget (tries / ms).
export function generate(rng, P, ms = Infinity) {
  const t0 = Date.now();
  let best = null;
  for (let a = 0; a < P.tries; a++) {
    const s = build(rng, P);
    if (!remaining(s)) continue;
    const r = solve(s, P.sol, 12);
    if (!r || r.depth !== P.sol) continue;
    // « effet waouh » : meilleure chaîne qu'un seul tap peut déclencher + rareté des solutions
    let maxChain = 0;
    for (const i of reactors(s)) { const c = clone(s); maxChain = Math.max(maxChain, run(c, i)); }
    const score = maxChain / remaining(s) + (r.sols.length <= 2 ? 0.5 : 0) + rng() * 0.15;
    if (!best || score > best.score) best = { score, def: { w: s.w, h: s.h, g: encode(s), min: r.depth, sol: r.sols[0] } };
    if (best.score > 1.6 || Date.now() - t0 > ms) break;
  }
  return best && best.def;
}

export function campaignLevel(wi, k) {
  const rng = mulberry32(hashStr('critical:' + wi + ':' + k));
  const P = levelParams(wi, k);
  return generate(rng, P);
}

// Défi quotidien : même graine pour tout le monde (date locale).
export function dailyLevel(dateStr, ms = 1800) {
  const rng = mulberry32(hashStr('critical:daily:' + dateStr));
  const P = { w: 6, h: 8, n: [10, 0], types: [3, 2, 2], hpMax: 3, walls: 2, mir: 2, sol: 3, tries: 80 };
  return generate(rng, P, ms) || generate(rng, { ...P, sol: 2, tries: 400 }, ms * 2);
}
export { decode };
