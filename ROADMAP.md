# Critical — feuille de route

Trace d'avancement de la refonte « jeu mobile ». La version d'avant refonte reste sur la branche `main`.

## Fait (branche `claude/upbeat-hamilton-ba6vb5`)
- **Genèse** (remplace l'ancien Forage sur grille) : jeu de fusion physique d'astres, de l'orbe au trou noir. `js/fusion.js` (moteur pur, déterministe, testé) + `js/mine.js` (rendu canvas, astres animés par calques (surfaces qui défilent, plasma, halos, disque d'accrétion), effets, sons, haptique, écran de fin, consignes intégrées).
  10 rangs, chaînes par lâcher, jauge de saut et changement de secteur, débris, réserve, comète explosive, matière exotique, Big Bang.
- **Gravité et pouvoirs** : les étoiles attirent les astres plus petits (visée à trajectoire courbe), l'étoile à neutrons repousse par impulsions, la géante rouge enfle, le trou noir avale ses petits voisins.
- **Secteurs à règles** : brume, attraction doublée, vent alterné, gravité forte ou faible, vent constant, parois resserrées, chaos.
- **Saut de secteur animé** : implosion (grille d'espace-temps qui se creuse, étoiles aspirées), bang, puis onde et déploiement du nouveau ciel. Ralenti pour le premier trou noir et le Big Bang.
- **Codex** : 10 astres + 3 découvertes secrètes, chaque nouvelle entrée rapporte de l'énergie.
- **Univers du jour** : même tirage pour tous, une tentative comptée par jour, score partageable (local : pas de classement tant qu'il n'y a pas de backend).
- **Skins et musique** : la couleur de la skin teinte l'orbe et son effet d'explosion s'applique aux fusions ; la musique s'intensifie avec la taille des astres, battement de cœur près de la ligne.
- **Physique revue** : chevauchement toléré + frottement statique (les piles ne rampent plus sous la pression, testé sur 6 tirages), 6 passes de résolution, astres dessinés à la taille exacte de leur collision (astéroïde compris).
- **13 rangs** : poussière d'étoile → orbe → astéroïde → lune → planète → géante gazeuse → naine orange → soleil → géante rouge → étoile à neutrons → trou noir → quasar → galaxie. Seuls l'étoile à neutrons et le trou noir attirent.
- **Raretés** : 6 variantes rares (1 sur 25 à 1 sur 150 selon le rang) et 6 raretés de galaxie (62 % → 1 sur 1 000), révélation animée avec la probabilité, entrées au codex.
- **Toucher** : appui n'importe où, l'astre suit le doigt en douceur, relâché mémorisé pendant la recharge.
- **Sons** : un timbre par famille d'astres (roche, planète, étoile, astre extrême, galactique), légèrement désaccordé à chaque fois.
- **Performances** : chaque rang d'astre animé est assemblé une fois toutes les 2 images puis copié (au lieu d'une découpe et de 3 à 5 dessins par astre), plus de `shadowBlur` par image, accueil masqué et figé pendant une partie, démo de l'accueil à demi-cadence. Mesuré sur la scène de test : 24 → 56 images/s en rendu logiciel.
- **Toucher** : on vise dans la cuve, même pendant qu'un astre tombe ; sortir de la cuve annule.
- **Classement mondial** (`js/rank.js`, `supabase/schema.sql`) : pseudo demandé une fois, tableau mondial et tableau de l'univers du jour, défilement infini, mon rang, scores mis en attente hors connexion. Testé de bout en bout sur un Postgres local ; à activer en remplissant `js/config.js`.
- **Reprise de partie** : la partie en cours est sauvegardée à chaque lâcher et reprise à l'ouverture ; « Abandonner » dans l'aide.
- **Débris retirés** ; gravité à partir du trou noir seulement.
- **Accueil** : fond spatial avec trou noir animé, verre sans flou d'arrière-plan (bien plus léger), Cascade / Niveaux / Atelier / Code rangés dans « Plus ».
- **Missions du jour + cadeau quotidien** (`js/quests.js`), branchés sur Genèse, la campagne et le défi du jour.
- **Économie** : Genèse paie en énergie selon le secteur et le score ; probabilités des noyaux et seuils de garantie affichés ; panneau admin retiré de l'écran titre (`?admin=1`).
- **Thème** : le verre liquide d'origine est conservé partout (accueil, fenêtres, missions, Genèse) ; Cascade a un vrai bouton sur l'accueil.
- **Technique** : la boucle de Genèse s'arrête à la fermeture ; cache du service worker en v22.

## À faire, par priorité
1. **Réglage de Genèse sur de vrais joueurs** : tailles, rythme des sauts, fréquence des débris, seuils des missions. Les valeurs actuelles sont calées sur un joueur aléatoire simulé (`tools/test.mjs`), pas sur des humains.
2. **Vérification serveur des scores** : aujourd'hui des garde-fous de plausibilité en SQL ; le journal de chaque partie est stocké, il reste à le rejouer dans une Edge Function avec `replay()`. Sauvegarde cloud de la progression et filtre de pseudos injurieux à faire aussi.
3. **Pas encore faits** : thèmes d'univers complets comme récompense des noyaux, objectifs en cours de partie, mode zen, première partie guidée, rythme des 13 rangs.
3. **Thèmes d'univers complets** : les skins teintent l'orbe et les effets de fusion, mais les autres astres gardent leur dessin ; des thèmes entiers (glace, lave, néon) restent à faire.
5. **Succès et statistiques** : records déjà stockés (`critical.forage.v2`), écran dédié à faire.
6. **Stores** : emballage Capacitor (le projet est du JS statique sans build, donc compatible tel quel), icônes et écrans de lancement natifs, retours haptiques natifs, mentions légales et affichage des probabilités exigés par les stores.
7. **Cascade et Campagne** : non retouchés dans cette passe (seul leur habillage a changé).
