# Critical

Un tap. Une réaction en chaîne. Puzzle néon (PWA mobile, hors-ligne).

## Publier sur GitHub Pages
1. Mets tout le contenu de ce dossier à la racine du dépôt (`ZeynZer/Critical`), branche `main`.
2. GitHub → **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`**.
3. Le jeu est en ligne sur `https://zeynzer.github.io/Critical/`. Sur téléphone : *Ajouter à l'écran d'accueil*.

Aucune étape de build : c'est du JavaScript natif (modules ES), sans dépendance.

## Tester en local
```
python3 -m http.server 8000      # puis ouvre http://localhost:8000
node tools/test.mjs              # vérifie les 60 niveaux et le moteur de Genèse
# panneau de test des noyaux : ajoute ?admin=1 à l'adresse
```

## Classement en ligne (Supabase)
Le jeu fonctionne sans ; le classement s'active dès que `js/config.js` est rempli.
1. Crée un projet sur supabase.com.
2. Dans **SQL Editor → New query**, colle tout le contenu de `supabase/schema.sql`, puis **Run**.
3. Dans **Project Settings → API**, copie l'**URL du projet** et la clé **publique** (`anon` / `publishable`) dans `js/config.js`. Jamais la clé `service_role`.
4. Change `VERSION` dans `sw.js` et publie.

Les tables sont fermées (RLS sans policy) : la clé publique ne peut appeler que 4 fonctions (`register`, `submit_score`, `leaderboard`, `my_rank`) qui valident leurs entrées. Chaque score est stocké avec sa graine et son journal de lâchers : `replay()` dans `js/fusion.js` rejoue la partie à l'identique, ce qui permettra une vérification complète côté serveur (Edge Function) si la triche apparaît.

## Tes assets (tous facultatifs, le jeu tourne sans)
| Fichier | Rôle |
|---|---|
| `assets-src/icon-master.png` (1024×1024) | Icône. Remplace-la puis lance `python3 tools/make-icons.py` (pip install pillow). |
| `assets/title-bg.webp` (1080×1920) | Fond des menus (détecté automatiquement). |
| `assets/bg-world1.webp` … `bg-world6.webp` (1080×1920) | Fonds des 6 mondes (détectés automatiquement). |
| `assets/social.png` (1200×630) | Aperçu du lien partagé. |

Après avoir ajouté des fichiers, change `VERSION` dans `sw.js` (ex. `critical-v2`) pour que les joueurs reçoivent la mise à jour.

## Structure
- `js/engine.js` : simulation déterministe + solveur (même code navigateur/Node)
- `js/gen.js` : générateur de niveaux (campagne + défi quotidien)
- `js/levels.js` : 60 niveaux générés (`node tools/gen-levels.mjs` pour régénérer)
- `js/main.js` : rendu canvas, effets, interface
- `js/audio.js` : sons et musique synthétisés (aucun fichier audio)

## Modes
- **Genèse (mode principal)** : on lâche des astres dans un puits de gravité ; deux identiques fusionnent en un plus gros (poussière → orbe → astéroïde → lune → planète → géante gazeuse → étoiles → trou noir → quasar → galaxie ; deux galaxies = Big Bang ; variantes et galaxies rares à probabilités affichées). Une chaîne = plusieurs fusions déclenchées par un seul lâcher (multiplicateur, comète explosive à ×5). Chaque fusion charge la jauge de saut : pleine, on change de secteur, l'onde vaporise les petits astres, de la matière exotique est offerte, puis des débris arrivent. Moteur dans `js/fusion.js` (pur, testé), rendu dans `js/mine.js`.
- **Missions du jour** (`js/quests.js`) : 3 missions par jour + cadeau quotidien, payés en énergie ; les 3 terminées = noyau Rare garanti.
- **Cascade (sans fin)** : les réacteurs tombent par vagues, de plus en plus vite. Un tap tire immédiatement et les chaînes peuvent se chevaucher. Chaîne de 3 ou plus = multiplicateur +1 (max ×8), un tap raté brise la série, 3 brèches = fin. Les vagues sont générées par le solveur : au début presque toutes les cases marchent, plus tard une seule est la bonne.
- **Campagne** : 60 niveaux en 6 mondes, 3 étoiles par niveau.
- **Défi du jour** : même niveau pour tout le monde.

## Règles
Chaque réacteur tapé explose et tire dans ses directions (noyau `+`, pulsar `×`, étoile les deux). Un tir touche le premier élément rencontré : il retire 1 PV à un réacteur, il est bloqué par un mur, et les miroirs `/` `\` dévient les tirs droits. Vide tous les réacteurs : 3 étoiles si tu y arrives dans le minimum de taps.

Suite du chantier : voir `ROADMAP.md`.
