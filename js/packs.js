// Critical — packs d'astres : tirage (données et logique pures, sans DOM ; testé dans tools/test.mjs).
// Règles de loyauté : probabilités affichées = probabilités réelles ; garantie de série visible ; le tirage est décidé AVANT l'animation,
// qui ne fait que le raconter (les indices de l'animation annoncent la vraie meilleure rareté, jamais plus).
import { POOL, RAR } from './catalog.js';
export { RAR };
export const PACKS = {
  etoile: { n: 'Pack Étoile', cost: 1200, cards: 5, odds: [57, 27, 11, 4, 0.9, 0.1], min: 0, pity: [10, 40], col: [255, 226, 110] },
  nebuleuse: { n: 'Pack Nébuleuse', cost: 4000, cards: 5, odds: [38, 32, 19, 8.5, 2, 0.5], min: 2, pity: [5, 20], col: [160, 120, 255] },
  galaxie: { n: 'Pack Galaxie', cost: 12000, cards: 5, odds: [20, 30, 28, 15, 5.5, 1.5], min: 3, pity: [3, 10], col: [255, 120, 220] },
};
export const SCENES = ['calm', 'calm', 'rare', 'epic', 'legend', 'cosmic']; // scénario de l'animation selon la meilleure rareté du tirage
const byR = [0, 1, 2, 3, 4, 5].map((r) => POOL.filter((c) => c.r === r));
export function mulberry(a) { return () => { let t = (a = (a + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const rollR = (odds, u) => { let x = u * 100; for (let r = 0; r < odds.length; r++) { if ((x -= odds[r]) < 0) return r; } return odds.length - 1; };
const pick = (r, rng) => byR[r][Math.floor(rng() * byR[r].length)];
export const rollCards = (pack, rng) => Array.from({ length: pack.cards }, () => pick(rollR(pack.odds, rng()), rng)); // sans garantie : sert aux tests de probabilités
const bestOf = (cs) => cs.reduce((m, c, i) => (c.r > cs[m].r ? i : m), 0);
export const tellOf = (cards) => { const best = Math.max(...cards.map((c) => c.r)); return { best, scene: SCENES[best], strong: cards.filter((c) => c.r >= 3).length }; };
// pity : { e: paquets d'affilée sans épique, l: sans légendaire } propre à chaque type de pack. force : rareté imposée (administrateur, test).
export function draw(id, pity = {}, seed = (Math.random() * 2 ** 32) >>> 0, force = null) {
  const pack = PACKS[id], rng = mulberry(seed), cards = rollCards(pack, rng).map((c) => ({ ...c })), P = { e: pity.e | 0, l: pity.l | 0 };
  const lift = (r) => { const i = bestOf(cards); if (cards[i].r < r) cards[i] = { ...pick(r, rng) }; }; // la meilleure carte monte au palier garanti
  if (P.e >= pack.pity[0] - 1) lift(3);
  if (P.l >= pack.pity[1] - 1) lift(4);
  lift(pack.min);
  if (force != null) { for (let i = 0; i < cards.length; i++) if (cards[i].r > force) cards[i] = { ...pick(force, rng) }; lift(force); } // test d'animation : meilleure rareté exactement = force
  cards.sort((a, b) => a.r - b.r); // révélation : de la moins rare à la meilleure, qui vient en dernier
  const best = cards[cards.length - 1].r;
  return { pack: id, seed, cards, pity: force != null ? pity : { e: best >= 3 ? 0 : P.e + 1, l: best >= 4 ? 0 : P.l + 1 }, tell: tellOf(cards) };
}
