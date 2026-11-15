# Critical

Fusionne les astres, de la poussière d'étoile à la galaxie. Jeu mobile (PWA, hors-ligne), JavaScript natif sans dépendance ni étape de build.

## Publier sur GitHub Pages
1. Le contenu du dépôt à la racine, branche `main`.
2. GitHub → **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**.
3. Après chaque changement, augmente `VERSION` dans `sw.js` pour que les joueurs reçoivent la mise à jour.

## Tester en local
```
python3 -m http.server 8000      # puis ouvre http://localhost:8000
node tools/test.mjs              # moteur : déterminisme, physique, reprise, rejeu
```

## Le jeu
On lâche des astres dans une cuve ; deux identiques fusionnent en un plus gros : poussière → orbe → astéroïde → lune → planète → géante gazeuse → naine orange → soleil → géante rouge → étoile à neutrons → trou noir → quasar → galaxie. Deux galaxies déclenchent un Big Bang.
- **Chaînes** : plusieurs fusions sur un seul lâcher multiplient les points (comète explosive à ×5).
- **Secteurs** : chaque fusion charge la jauge ; pleine, on change de secteur (nouvelle règle : gravité, vent, parois) et on reçoit de la matière exotique.
- **Raretés** : variantes rares de certains astres et six raretés de galaxie, probabilités affichées dans le codex.
- **Défi du jour** : un objectif chronométré, le même pour tous (ex. « Crée une Géante rouge en moins de 2 min »).
- **Missions du jour** et **thèmes d'arrière-plan** achetés en poussière d'étoile (✦), gagnée en jouant.
- **Classement mondial** et classement du défi du jour.
- **Première partie guidée**, reprise automatique de la partie en cours.

## Structure
- `js/fusion.js` : moteur pur et déterministe (physique, règles, `replay()`), testé dans Node
- `js/mine.js` : rendu canvas, effets, écrans du jeu, thèmes, tutoriel, défi du jour, codex
- `js/home.js` : écran d'accueil · `js/app.js` : démarrage, réglages, branchement des modules
- `js/quests.js` : missions du jour · `js/rank.js` + `js/config.js` : classement · `js/audio.js` : sons synthétisés

## Classement en ligne (Supabase)
1. Crée un projet sur supabase.com.
2. **SQL Editor → New query** : colle `supabase/schema.sql`, puis **Run**.
3. **Project Settings → API** : copie l'URL du projet et la clé **publique** dans `js/config.js`. Jamais la clé `service_role`.

Les tables sont fermées (RLS sans policy) : la clé publique ne peut appeler que 4 fonctions qui valident leurs entrées. Chaque score est stocké avec sa graine et son journal de lâchers, que `replay()` peut rejouer à l'identique pour une vérification côté serveur.

## Icône
Remplace `assets-src/icon-master.png` (1024×1024) puis lance `python3 tools/make-icons.py` (pip install pillow).

Suite du chantier : `ROADMAP.md`. Crédits : Zeyn — Mohamed Zerouati.
