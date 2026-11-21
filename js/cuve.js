// Critical — la Grande Cuve (événement collaboratif du week-end) : règles communes au client et au serveur (supabase/schema.sql : event_drop, event_claim).
// Chaque astre posé a une masse 2^rang ; deux astres identiques fusionnent, donc la masse totale se conserve et 4 096 de masse (2^12) = une galaxie.
// Le serveur n'a besoin que de la masse totale (un compteur) : aucune physique partagée, donc aucun conflit entre des centaines de joueurs.
export const GAL_MASS = 4096, TIERS = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3]; // tirage des astres posés : rangs 0 à 3, pondérés 5 · 5 · 3 · 2
export const mass = (t) => 2 ** t, MEAN_MASS = TIERS.reduce((a, t) => a + 2 ** t, 0) / TIERS.length; // ≈ 2,87 de masse par astre
export const galaxies = (m) => Math.floor(m / GAL_MASS);
export const astresPerGalaxy = Math.round(GAL_MASS / MEAN_MASS); // ≈ 1 429 astres posés pour une galaxie (fusions parfaites)
export const MILESTONES = [[25, 500, 0], [50, 1000, 1], [75, 2000, 0], [100, 5000, 2], [150, 4000, 0], [200, 8000, 3]]; // % de l'objectif · Voidium · packs (0 aucun, 1 Étoile, 2 Nébuleuse, 3 Galaxie)
export const PART = [[100, 2000, 'etoile'], [1000, 6000, 'nebuleuse'], [5000, 15000, 'galaxie']]; // astres posés pour la participation finale · Voidium · pack
export const TOP = [30000, 20000, 12000]; // récompense des trois premiers du classement
export const MIN_PART = 50; // astres posés pour toucher les paliers collectifs
export const pick = (r) => TIERS[Math.floor(r * TIERS.length) % TIERS.length];
