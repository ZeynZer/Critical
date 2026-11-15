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
- **Missions du jour + cadeau quotidien** (`js/quests.js`), branchés sur Genèse, la campagne et le défi du jour.
- **Économie** : Genèse paie en énergie selon le secteur et le score ; probabilités des noyaux et seuils de garantie affichés ; panneau admin retiré de l'écran titre (`?admin=1`).
- **Thème** : le verre liquide d'origine est conservé partout (accueil, fenêtres, missions, Genèse) ; Cascade a un vrai bouton sur l'accueil.
- **Technique** : la boucle de Genèse s'arrête à la fermeture ; cache du service worker en v19.

## À faire, par priorité
1. **Réglage de Genèse sur de vrais joueurs** : tailles, rythme des sauts, fréquence des débris, seuils des missions. Les valeurs actuelles sont calées sur un joueur aléatoire simulé (`tools/test.mjs`), pas sur des humains.
2. **Backend (Supabase)** : le dépôt ne contient aucun code Supabase aujourd'hui, tout est en `localStorage` (modifiable par le joueur). À créer : comptes anonymes, sauvegarde cloud, classement hebdomadaire de Genèse, tables avec RLS, et validation serveur des scores (le moteur étant déterministe, on peut rejouer graine + liste des lâchers côté serveur).
3. **Thèmes d'univers complets** : les skins teintent l'orbe et les effets de fusion, mais les autres astres gardent leur dessin ; des thèmes entiers (glace, lave, néon) restent à faire.
5. **Succès et statistiques** : records déjà stockés (`critical.forage.v2`), écran dédié à faire.
6. **Stores** : emballage Capacitor (le projet est du JS statique sans build, donc compatible tel quel), icônes et écrans de lancement natifs, retours haptiques natifs, mentions légales et affichage des probabilités exigés par les stores.
7. **Cascade et Campagne** : non retouchés dans cette passe (seul leur habillage a changé).
