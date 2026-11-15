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
node tools/test.mjs              # vérifie les 60 niveaux et le moteur du Forage
# panneau de test des noyaux : ajoute ?admin=1 à l'adresse
```

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
- **Forage (mode principal)** : on lâche des minéraux dans un puits ; deux identiques fusionnent en un plus gros. Une chaîne = plusieurs fusions déclenchées par un seul lâcher (multiplicateur, charge explosive à ×5). Chaque fusion charge la foreuse : jauge pleine, la strate cède, le souffle vaporise les petits minéraux et un catalyseur est offert, puis des gravats tombent. Moteur dans `js/fusion.js` (pur, testé), rendu dans `js/mine.js`.
- **Missions du jour** (`js/quests.js`) : 3 missions par jour + cadeau quotidien, payés en énergie ; les 3 terminées = noyau Rare garanti.
- **Cascade (sans fin)** : les réacteurs tombent par vagues, de plus en plus vite. Un tap tire immédiatement et les chaînes peuvent se chevaucher. Chaîne de 3 ou plus = multiplicateur +1 (max ×8), un tap raté brise la série, 3 brèches = fin. Les vagues sont générées par le solveur : au début presque toutes les cases marchent, plus tard une seule est la bonne.
- **Campagne** : 60 niveaux en 6 mondes, 3 étoiles par niveau.
- **Défi du jour** : même niveau pour tout le monde.

## Règles
Chaque réacteur tapé explose et tire dans ses directions (noyau `+`, pulsar `×`, étoile les deux). Un tir touche le premier élément rencontré : il retire 1 PV à un réacteur, il est bloqué par un mur, et les miroirs `/` `\` dévient les tirs droits. Vide tous les réacteurs : 3 étoiles si tu y arrives dans le minimum de taps.

Suite du chantier : voir `ROADMAP.md`.
