// Critical — catalogue des variantes d'astres (données pures, sans DOM : utilisé par le jeu, les packs et les tests).
// CAT[rang][v] = { n: nom, c: teinte, fx: effet visuel, r: rareté 0..5, src: d'où elle vient }
//   v = 1 : variante rare à pouvoir (tirée en partie) · v = 2, 3 : styles fréquents (tirés en partie) · v = 4 à 8 : skins de pack · v = 9 : prismatique (fusion)
// Rareté : 0 commune · 1 peu commune · 2 rare · 3 épique · 4 légendaire · 5 cosmique.
export const RAR = ['Commune', 'Peu commune', 'Rare', 'Épique', 'Légendaire', 'Cosmique'];
export const MYTHIC = 9;
const D = (n, c, r, fx = '') => ({ n, c, r, fx, src: 'drop' }), P = (n, c, fx, r) => ({ n, c, fx, r, src: 'pack' });
export const CAT = {
  3: { 1: D('Lune de glace', [130, 220, 255], 3), 2: D('Lune d\'ambre', [255, 190, 90], 0), 4: P('Lune de givre', [200, 235, 255], 'frost', 1), 5: P('Lune néon', [255, 80, 200], 'neon', 2), 6: P('Lune cristalline', [160, 255, 240], 'crystal', 3), 7: P('Lune constellée', [140, 160, 255], 'const', 4) },
  4: { 1: D('Monde de lave', [255, 84, 36], 3), 2: D('Monde de jade', [70, 230, 150], 0), 3: D('Monde de cristal', [190, 240, 255], 1), 4: P('Monde océan', [40, 140, 255], 'rings', 1), 5: P('Monde néon', [90, 255, 170], 'neon', 2), 6: P('Monde de braise', [255, 120, 40], 'lava', 3), 7: P('Monde holographique', [255, 255, 255], 'holo', 4), 8: P('Monde-galaxie', [120, 100, 255], 'inner', 5) },
  5: { 1: D('Géante de saphir', [64, 120, 255], 3), 2: D('Géante d\'émeraude', [60, 220, 140], 0), 3: D('Géante pourpre', [190, 90, 255], 1), 4: P('Géante de givre', [200, 235, 255], 'frost', 1), 5: P('Géante aux anneaux d\'or', [255, 215, 110], 'rings', 2), 6: P('Géante néon', [255, 90, 160], 'neon', 2), 7: P('Géante de cristal', [150, 255, 230], 'crystal', 3), 8: P('Géante aurorale', [120, 255, 200], 'aurora', 4) },
  6: { 2: D('Naine violette', [170, 100, 255], 0), 4: P('Naine bleue', [90, 150, 255], 'flame', 1), 5: P('Naine de braise', [255, 110, 50], 'lava', 2), 6: P('Naine néon', [255, 80, 220], 'neon', 3), 7: P('Naine constellée', [255, 230, 150], 'const', 4) },
  7: { 1: D('Étoile bleue', [100, 170, 255], 4), 2: D('Soleil rose', [255, 110, 190], 0), 4: P('Soleil d\'or', [255, 210, 60], 'flame', 1), 5: P('Soleil de givre', [190, 230, 255], 'frost', 2), 6: P('Soleil néon', [80, 255, 220], 'neon', 3), 7: P('Soleil holographique', [255, 255, 255], 'holo', 4), 8: P('Soleil-galaxie', [255, 160, 90], 'inner', 5) },
  8: { 1: D('Supergéante', [255, 190, 70], 4), 2: D('Géante d\'azur', [90, 200, 255], 0), 4: P('Géante pourpre ardente', [190, 60, 255], 'flame', 1), 5: P('Géante de braise', [255, 140, 40], 'lava', 2), 6: P('Géante cristalline', [255, 170, 190], 'crystal', 3), 7: P('Géante aurorale rouge', [255, 120, 150], 'aurora', 4) },
  9: { 1: D('Magnétar', [90, 255, 200], 4), 2: D('Pulsar rose', [255, 120, 220], 1), 4: P('Pulsar cyan', [80, 255, 255], 'neon', 2), 5: P('Pulsar doré', [255, 200, 80], 'flame', 2), 6: P('Pulsar de cristal', [200, 220, 255], 'crystal', 3), 7: P('Pulsar holographique', [255, 255, 255], 'holo', 4), 8: P('Pulsar-galaxie', [160, 120, 255], 'inner', 5) },
  10: { 1: D('Trou blanc', [190, 255, 255], 4), 2: D('Trou noir écarlate', [255, 80, 80], 1), 4: P('Trou noir azur', [70, 150, 255], 'rings', 1), 5: P('Trou noir néon', [255, 60, 200], 'neon', 2), 6: P('Trou noir de braise', [255, 120, 30], 'lava', 3), 7: P('Trou noir holographique', [255, 255, 255], 'holo', 4), 8: P('Trou noir constellé', [170, 170, 255], 'const', 4) },
  11: { 1: D('Blazar', [110, 255, 190], 4), 2: D('Quasar azur', [80, 170, 255], 2), 4: P('Quasar d\'or', [255, 215, 100], 'flame', 2), 5: P('Quasar néon', [255, 70, 190], 'neon', 3), 6: P('Quasar cristallin', [170, 255, 255], 'crystal', 3), 7: P('Quasar holographique', [255, 255, 255], 'holo', 4), 8: P('Quasar-galaxie', [200, 130, 255], 'inner', 5) },
};
export const GAL_R = [0, 1, 2, 3, 4, 5]; // une galaxie « 12:v » a pour rareté son indice
// Toutes les cartes qu'un pack peut donner : variantes (hors prismatique) et galaxies.
export const POOL = (() => {
  const L = [];
  for (const t of Object.keys(CAT)) for (const v of Object.keys(CAT[t])) L.push({ key: t + ':' + v, tier: +t, v: +v, r: CAT[t][v].r });
  for (let v = 0; v < 6; v++) L.push({ key: '12:' + v, tier: 12, v, r: GAL_R[v] });
  return L;
})();
// Une variante est équipable comme apparence de son rang si elle n'a aucun pouvoir (style, skin de pack, prismatique).
export const equipable = (tier, v) => tier < 12 && (v >= 2);
