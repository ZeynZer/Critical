# Critical — feuille de route

Trace d'avancement de la refonte « jeu mobile ». La version d'avant refonte reste sur la branche `main`.

## Fait (branche `claude/upbeat-hamilton-ba6vb5`)
- **Genèse** (remplace l'ancien Forage sur grille) : jeu de fusion physique d'astres, de l'orbe au trou noir. `js/fusion.js` (moteur pur, déterministe, testé) + `js/mine.js` (rendu canvas, astres pré-rendus, effets, sons, haptique, écran de fin, consignes intégrées).
  10 rangs, chaînes par lâcher, jauge de saut et changement de secteur, débris, réserve, comète explosive, matière exotique, Big Bang.
- **Missions du jour + cadeau quotidien** (`js/quests.js`), branchés sur Genèse, la campagne et le défi du jour.
- **Économie** : Genèse paie en énergie selon le secteur et le score ; probabilités des noyaux et seuils de garantie affichés ; panneau admin retiré de l'écran titre (`?admin=1`).
- **Thème** : le verre liquide d'origine est conservé partout (accueil, fenêtres, missions, Genèse).
- **Technique** : la boucle de Genèse s'arrête à la fermeture ; cache du service worker en v17.

## À faire, par priorité
1. **Réglage de Genèse sur de vrais joueurs** : tailles, rythme des sauts, fréquence des débris, seuils des missions. Les valeurs actuelles sont calées sur un joueur aléatoire simulé (`tools/test.mjs`), pas sur des humains.
2. **Backend (Supabase)** : le dépôt ne contient aucun code Supabase aujourd'hui, tout est en `localStorage` (modifiable par le joueur). À créer : comptes anonymes, sauvegarde cloud, classement hebdomadaire de Genèse, tables avec RLS, et validation serveur des scores (le moteur étant déterministe, on peut rejouer graine + liste des lâchers côté serveur).
3. **Skins dans Genèse** : seule la matière équipée s'applique, et uniquement à l'orbe de départ ; ajouter des effets de fusion par skin.
4. **Astres animés** : les astres sont des images fixes qui tournent ; surface du soleil, disque du trou noir et atmosphères pourraient être animés.
5. **Succès et statistiques** : records déjà stockés (`critical.forage.v2`), écran dédié à faire.
6. **Stores** : emballage Capacitor (le projet est du JS statique sans build, donc compatible tel quel), icônes et écrans de lancement natifs, retours haptiques natifs, mentions légales et affichage des probabilités exigés par les stores.
7. **Cascade et Campagne** : non retouchés dans cette passe (seul leur habillage a changé).
