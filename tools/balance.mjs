// Critical — banc d'équilibrage : des robots de niveaux différents jouent des parties complètes avec le vrai moteur (fusion.js).
// But : vérifier que bien jouer rapporte nettement plus que jouer au hasard, et mesurer la durée des parties.
// Rien n'est modifié : l'outil ne fait que mesurer. Usage : node tools/balance.mjs [parties=30] [lâchers max=500]
import * as F from '../js/fusion.js';

const GAMES = +process.argv[2] || 30, MAX = +process.argv[3] || 500, SEC_PER_DROP = 1.5;
const lcg = (s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const BOTS = {
  hasard: (g, r) => 0.6 + r() * 8.8, // lâche n'importe où
  viseur: (g, r) => { // vise l'astre identique le plus haut, sinon un bord
    if (g.cur.k !== 'c') return 0.6 + r() * 8.8;
    const m = g.bodies.filter((b) => b.k === 'c' && b.tier === g.cur.tier).sort((a, b) => a.y - b.y)[0];
    return m ? m.x : r() < 0.5 ? 0.6 : 9.4;
  },
};
function play(seed, bot) {
  const g = F.newGame(seed), r = lcg(seed);
  while (!g.over && g.drops < MAX) { F.drop(g, BOTS[bot](g, r)); for (let k = 0; k < 60; k++) F.tick(g, 1 / 60); g.ev.length = 0; }
  return g;
}
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const out = {};
for (const bot of Object.keys(BOTS)) {
  const R = []; for (let i = 1; i <= GAMES; i++) R.push(play(i * 7919, bot));
  out[bot] = {
    'lâchers (médiane)': med(R.map((g) => g.drops)), 'durée estimée (min)': +(med(R.map((g) => g.drops)) * SEC_PER_DROP / 60).toFixed(1),
    'score (médiane)': med(R.map((g) => g.score)), 'secteur (médiane)': med(R.map((g) => g.depth + 1)),
    'parties jamais perdues': `${R.filter((g) => !g.over).length} / ${GAMES}`, 'Voidium (médiane)': med(R.map((g) => Math.min(800, Math.round(g.depth * 50 + g.score / 200)))),
  };
}
console.table(out);
const gap = out.viseur['score (médiane)'] / Math.max(1, out.hasard['score (médiane)']);
console.log(`Écart de score viseur / hasard : ×${gap.toFixed(2)} ${gap < 1.5 ? '→ le talent compte peu (cible : ×2 ou plus)' : '→ le talent est récompensé'}`);
