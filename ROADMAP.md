# Critical — feuille de route

Trace d'avancement de la refonte « jeu mobile ». La version d'avant refonte reste sur la branche `main`.

## Fait (branche `claude/upbeat-hamilton-ba6vb5`)
- **Forage reconstruit** en jeu de fusion physique : `js/fusion.js` (moteur pur, déterministe, testé) + `js/mine.js` (rendu canvas, effets, sons, haptique, écran de fin, consignes intégrées).
  Minéraux à 10 rangs, chaînes par lâcher, foreuse et percée de strates, gravats, réserve, charge explosive, catalyseur, supernova.
- **Missions du jour + cadeau quotidien** (`js/quests.js`), branchés sur le Forage, la campagne et le défi du jour.
- **Économie** : le Forage paie en énergie selon la profondeur et le score ; probabilités des noyaux et seuils de garantie affichés ; panneau admin retiré de l'écran titre (`?admin=1`).
- **Direction artistique « coupe géologique »** : accueil refait (`js/home.js`), styles communs (boutons, fenêtres, bannières) passés du verre flou à des dalles mates avec un accent ambre.
- **Technique** : le canvas principal n'est plus dessiné derrière l'accueil ; la boucle du Forage s'arrête à la fermeture ; cache du service worker en v16.

## À faire, par priorité
1. **Réglage du Forage sur de vrais joueurs** : tailles, rythme des percées, fréquence des gravats, seuils des missions. Les valeurs actuelles sont calées sur un joueur aléatoire simulé (`tools/test.mjs`), pas sur des humains.
2. **Backend (Supabase)** : le dépôt ne contient aucun code Supabase aujourd'hui, tout est en `localStorage` (modifiable par le joueur). À créer : comptes anonymes, sauvegarde cloud, classement hebdomadaire du Forage, tables avec RLS, et validation serveur des scores (le moteur étant déterministe, on peut rejouer graine + liste des lâchers côté serveur).
3. **Finir l'unification visuelle** : Collection, ouverture des noyaux, Atelier et intro gardent des éléments de l'ancien style néon (cartes arrondies, dégradés).
4. **Skins dans le Forage** : seule la matière équipée s'applique aux minéraux ; ajouter des effets de fusion par skin.
5. **Succès et statistiques** : records déjà stockés (`critical.forage.v2`), écran dédié à faire.
6. **Stores** : emballage Capacitor (le projet est du JS statique sans build, donc compatible tel quel), icônes et écrans de lancement natifs, retours haptiques natifs, mentions légales et affichage des probabilités exigés par les stores.
7. **Cascade et Campagne** : non retouchés dans cette passe (seul leur habillage a changé).
