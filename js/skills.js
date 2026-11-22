// Critical — capacités des cartes (données pures, sans DOM : utilisées par le moteur, le jeu et les tests).
// Chaque apparence (skin de pack ou variante de style) a une capacité de jeu ; on l'équipe dans le deck (une carte par rang au plus).
// Sa force dépend de sa rareté et de ses étoiles (1 à 3, améliorables) : m = RS[rareté] × SM[étoiles].
// Les capacités à pouvoir (variante « :1 » : étoile bleue, supergéante, magnétar, trou blanc, blazar) gagnent aussi en force avec les étoiles.
import { CAT } from './catalog.js';

export const RS = [1, 1.3, 1.6, 2, 2.5, 3]; // commune → cosmique
export const SM = [1, 1, 1.35, 1.75]; // étoiles : 1★, 2★, 3★
export const STAR_MAX = 3;
// Types de capacité : nom, description (m = force)
export const KINDS = {
  aimant: { n: 'Aimant', d: (m) => `Attire les astres du même rang (portée ×${(1.6 + 0.35 * m).toFixed(1)}) : les fusions viennent toutes seules.` },
  onde: { n: 'Onde', d: (m) => `Repousse ses voisins par impulsions (force ${Math.round(5 + 4 * m)}, toutes les ${(4.6 / (0.7 + 0.3 * m)).toFixed(1)} s).` },
  pulsar: { n: 'Pulsar amplifié', d: (m) => `Impulsions ${Math.round((0.3 * m) * 100)} % plus fortes, ${Math.round((1 - 1 / (1 + 0.15 * m)) * 100)} % plus fréquentes et ${Math.round(0.1 * m * 100)} % plus larges.` },
  glouton: { n: 'Glouton', d: (m) => `Avale les poussières et les orbes qu'il touche, un toutes les ${(3.6 / (1 + 0.2 * m)).toFixed(1)} s.` },
  vorace: { n: 'Vorace', d: (m) => `Avale ${Math.round((1 - 1 / (1 + 0.2 * m)) * 100)} % plus vite et de plus loin.` },
  compact: { n: 'Compact', d: (m) => `${Math.round(Math.min(0.24, 0.045 * m) * 100)} % plus petit : il laisse de la place.` },
  eclat: { n: 'Éclat', d: (m) => `Ses fusions rapportent ${Math.round(0.15 * m * 100)} % de points en plus.` },
  elan: { n: 'Élan', d: (m) => `Chaque fusion de ce rang charge la jauge de secteur de ${Math.round(1.5 * m)} de plus.` },
  souffle: { n: 'Souffle', d: (m) => `À sa naissance, vaporise poussières et orbes autour de lui (portée ×${(1.3 + 0.3 * m).toFixed(1)}).` },
  echo: { n: 'Écho', d: (m) => `Prolonge la chaîne de ${(0.22 * m).toFixed(2).replace('.', ',')} s : les combos durent plus longtemps.` },
  lest: { n: 'Lest', d: (m) => `${Math.round(0.14 * m * 100)} % plus lourd : il tombe vite et tasse la pile.` },
};
const BY_FX = { frost: 'compact', neon: 'eclat', crystal: 'echo', const: 'aimant', rings: 'elan', lava: 'souffle', holo: 'aimant', inner: 'glouton', aurora: 'elan', flame: 'onde', '': 'lest' };
// Choix par rang : les étoiles à neutrons amplifient leurs impulsions, les trous noirs et quasars deviennent plus voraces.
export function kindOf(tier, v) {
  const c = CAT[tier] && CAT[tier][v]; if (!c || v < 2 || v > 8) return null;
  if (tier === 9) return 'pulsar';
  if ((tier === 10 || tier === 11) && (c.fx === 'inner' || c.fx === 'lava' || c.fx === 'const' || c.fx === 'rings')) return 'vorace';
  if (v === 3 && !c.fx) return 'compact';
  return BY_FX[c.fx || ''] || 'lest';
}
export const rarOf = (tier, v) => (CAT[tier] && CAT[tier][v] ? CAT[tier][v].r : 0);
export const strength = (tier, v, stars) => RS[Math.max(0, Math.min(5, rarOf(tier, v)))] * SM[Math.max(1, Math.min(STAR_MAX, stars | 0 || 1))];
// Description lisible d'une carte (capacité + force), pour le deck et la carte immersive
export function describe(tier, v, stars) { const k = kindOf(tier, v); return k ? { kind: k, name: KINDS[k].n, text: KINDS[k].d(strength(tier, v, stars)) } : null; }
// Amélioration : 1★ → 2★ → 3★, payée en fragments stellaires (doublons) et en Voidium, selon la rareté
export const upgradeCost = (rar, stars) => (stars >= STAR_MAX ? null : { frag: [20, 50, 150, 400, 1000, 2500][rar] * stars, dust: 400 * (rar + 1) * stars * stars });
