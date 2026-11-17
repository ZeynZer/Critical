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
node tools/test-audio.mjs        # son dans un vrai navigateur (playwright + serveur local) : veille en arrière-plan, mode silencieux
```

## Le jeu
On lâche des astres dans une cuve ; deux identiques fusionnent en un plus gros : poussière → orbe → astéroïde → lune → planète → géante gazeuse → naine orange → soleil → géante rouge → étoile à neutrons → trou noir → quasar → galaxie. Deux galaxies déclenchent un Big Bang.
- **Chaînes** : plusieurs fusions sur un seul lâcher multiplient les points (comète explosive à ×5).
- **Secteurs** : chaque fusion charge la jauge ; pleine, on change de secteur (nouvelle règle : intensité de la chute, parois resserrées ; jamais de vent : un astre qui tombe tombe droit) et on reçoit de la matière exotique.
- **Absorbeurs** : le trou noir avale poussières et orbes ; le quasar, jusqu'aux astéroïdes ; la galaxie, jusqu'aux lunes, et de plus en plus gros, vite et loin selon sa rareté (la critique avale jusqu'aux naines orange sans même toucher). Une aura pointillée montre jusqu'où chacun avale. Variantes rares plus puissantes : trou blanc, blazar, étoile bleue (brûle poussières et orbes), supergéante (ne gonfle jamais), magnétar (impulsions bien plus fortes et rapprochées).
- **Big Bang** : deux galaxies qui se touchent font disparaître tous les astres (points compris) : secteur vierge, puis saut de secteur.
- **Raretés** : variantes rares de certains astres et six raretés de galaxie, probabilités affichées dans le codex.
- **Défi du jour** : un objectif chronométré, le même pour tous (ex. « Crée une Géante rouge en moins de 2 min »).
- **Missions** (trois onglets) : missions du jour ; jours de connexion (« Jour N » = N-ᵉ jour joué, pas de série à ne pas casser, récompenses sans limite de temps) ; paliers de temps de jeu actif (20 min, 1 h, 5 h…). Récompenses : poussière d'étoile et thèmes (un thème déjà possédé est converti en poussière).
- **Thèmes d'arrière-plan** achetés en poussière d'étoile (✦), gagnée en jouant ou offerte par les missions. Le **temps de jeu** apparaît sur le profil public.
- **Classement mondial**, classement du défi du jour et **profils publics** : on touche un joueur pour voir sa vitrine (jusqu'à 3 astres découverts, animés), sa devise et ses stats ; chacun peut modifier son profil.
- **Profil** : bouton dans le menu ; un astre découvert au choix devient ton astre de profil (affiché en grand, dans le menu et devant ton pseudo dans le classement), les deux suivants forment ta vitrine. Utilisable hors connexion : les modifications partent dès que le réseau revient.
- **Défaite** : seulement si un astre reste **entièrement** au-dessus de la ligne pendant 2,6 s ; la ligne devient ambrée quand un astre la touche, rouge quand le danger est réel.
- **Première partie guidée**, reprise automatique de la partie en cours.

## Structure
- `js/fusion.js` : moteur pur et déterministe (physique, règles, `replay()`), testé dans Node
- `js/mine.js` : rendu canvas, effets, écrans du jeu, thèmes, tutoriel, défi du jour, codex
- `js/home.js` : écran d'accueil · `js/blackhole.js` : le trou noir de l'accueil (rayons de lumière courbés par la gravité, calculés une fois en WebGL puis animés ; l'image `assets/blackhole.webp` s'affiche d'abord et reste seule sans WebGL ou en mouvement réduit) · `js/app.js` : démarrage, réglages, branchement des modules
- `js/quests.js` : missions du jour · `js/rank.js` + `js/config.js` : classement · `js/audio.js` : sons synthétisés, session « ambiance » (respecte le mode silencieux, se mélange aux autres sons), mise en veille en arrière-plan

## Classement en ligne (Supabase)
1. Crée un projet sur supabase.com.
2. **SQL Editor → New query** : colle `supabase/schema.sql`, puis **Run**.
3. **Project Settings → API** : copie l'URL du projet et la clé **publique** dans `js/config.js`. Jamais la clé `service_role`.

**Mise à jour d'une base existante** : recolle simplement `supabase/schema.sql` en entier et lance-le. Les joueurs et les scores sont conservés ; seules des colonnes de profil sont ajoutées. À faire avant de publier une version du jeu qui contient les profils.

Les tables sont fermées (RLS sans policy) : la clé publique ne peut appeler que 7 fonctions (`register`, `submit_score`, `leaderboard`, `my_rank`, `set_profile`, `get_profile`, `report_playtime`) qui valident leurs entrées. La vitrine d'un profil est déclarative : le serveur vérifie le format, pas que l'astre a vraiment été obtenu. Le temps de jeu est déclaré par l'appareil mais borné par le temps réellement écoulé depuis le dernier envoi. Chaque score est stocké avec sa graine et son journal de lâchers, que `replay()` peut rejouer à l'identique pour une vérification côté serveur.

## Image du trou noir
`assets/blackhole.webp` est générée avec le même moteur que l'animation, en très haute définition : lance un serveur local puis `node tools/bake-blackhole.mjs` (nécessite playwright) pour la régénérer après une modification de `js/blackhole.js`.

## Icône
Remplace `assets-src/icon-master.png` (1024×1024) puis lance `python3 tools/make-icons.py` (pip install pillow).

Suite du chantier : `ROADMAP.md`. Crédits : Zeyn — Mohamed Zerouati.
