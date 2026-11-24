# Critical — contexte pour Claude

Jeu mobile de fusion d'astres (PWA hors-ligne, servi sur zeynzer.com via GitHub Pages). JavaScript natif en modules ES, **aucune dépendance, aucun build**. Backend : Supabase (Postgres + RPC, tables fermées par RLS). README.md = description fonctionnelle complète (à tenir à jour), ROADMAP.md = idées.

## Règles de travail du propriétaire
- Il fait confiance : résultats ambitieux et soignés, mais **tests avant de dire « fini »**, README mis à jour à chaque fonctionnalité.
- **Ne jamais affirmer qu'un test a eu lieu sur un vrai téléphone** : tout est vérifié dans Chromium (Playwright), pas sur appareil. Le dire honnêtement.
- Réponses en français, courtes, sans jargon. **Consigne permanente du propriétaire (nov. 2026) : une fois le travail testé, fusionner dans `main` et pousser soi-même, sans attendre qu'il le demande** (mise en ligne immédiate sur zeynzer.com). Jamais de PR sans demande. Si le SQL change, l'appliquer aussi dans Supabase (projet « Critical ») avant de pousser.
- Chaque changement de code servi aux joueurs : incrémenter `VERSION`/le nom de cache dans `sw.js` (`critical-vNN`) et ajouter les nouveaux fichiers JS à la liste `CORE` de `sw.js`.

## Architecture
- `index.html` charge `js/boot.js` (applique une sauvegarde cloud en attente, puis importe `js/app.js`). `js/cloud.js` : sauvegarde cloud de tout le stockage `critical.*` sauf télémétrie/installation/partie en cours ; toute nouvelle clé de stockage de progression doit être ajoutée à `SYNC`.
- `js/fusion.js` : moteur déterministe (pas fixe 1/120 s, RNG à graine, journal des lâchers rejouable). `F.W = 10` unités de largeur ; rayons `RAD`, 13 rangs (0–12). Mode bac à sable `{sandbox:true}` (jamais de défaite). Tout changement de physique casse les rediffusions/scores : `node tools/test.mjs` doit rester vert.
- `js/mine.js` : jeu (rendu canvas, modes Univers/Blitz/Défi du jour/Duel 1v1, collection, packs, sprites `paintAstre`). `js/app.js` câble les modules ; `js/home.js` accueil (pages + carrousel de modes) ; `js/rank.js` classement/profil/appels Supabase (`rpc`) ; `js/admin.js` + `js/analytics.js` console admin ; `js/event.js` + `js/cuve.js` Grande Cuve ; `js/telemetry.js` statistiques anonymes ; `js/collection.js`, `js/challenges.js`, `js/voidium.js`, `js/packs*.js`, etc.
- `supabase/schema.sql` : **un seul fichier**, rejouable à l'identique (create if not exists / or replace). Toute fonction publique : `security definer`, validation des entrées, `revoke ... from public, anon, authenticated` puis `grant execute` ciblé. Les fonctions admin appellent `admin_id(secret)`.
- Identité joueur : secret aléatoire local, seule son empreinte sha256 est stockée. La télémétrie est anonyme (identifiant d'appareil, aucun pseudo).

## Tests
```
node tools/test.mjs                      # moteur : déterminisme, physique, reprise, rejeu, cuve partagée, event
node tools/balance.mjs                   # banc d'équilibrage (robots hasard / viseur) : le talent doit payer
# robots intelligents : js/bot.js (choose, playGame, WEIGHTS) ; une partie Expert ≈ 2 min de calcul, Maître ≈ 5-9 min ; très grande variance d'une graine à l'autre (±70 k) : comparer des réglages sur ≥ 10 parties
python3 -m http.server 8000              # serveur local pour les tests navigateur (il tombe parfois : le relancer)
```
Tests SQL (PostgreSQL 16 local) : démarrer `pg_ctlcluster 16 main start`, créer une base vierge, `create role anon nologin; create role authenticated nologin;`, charger `supabase/schema.sql` puis `supabase/tests/{community,elo,blitz,event,analytics,save}.sql` **chacun sur une base neuve** (les pseudos de test se heurtent sinon : `name_taken`).
Tests navigateur : Playwright est préinstallé (`require('/opt/node22/lib/node_modules/')('playwright')`) ; mocker Supabase avec `page.route('**/rest/v1/rpc/*')`. Les clics souris/JS `.click()` cachent les bugs de superposition : pour le toucher, utiliser CDP `Input.dispatchTouchEvent`. Hook de debug : `window.__mine.G` (partie en cours).

## Pièges déjà rencontrés
- Z-index : `.hm-pager` recouvrait la barre du haut de l'accueil (profil non cliquable) → règle `z-index:6!important` dans `home.js`.
- Sprites d'astres : `paintAstre` plafonne la taille à la cuve de jeu (`B.u`) ; pour un autre canvas, passer `free = true` et dessiner à 2,78 × le rayon (taille du jeu de base). Le canvas doit suivre la taille réelle du conteneur (ResizeObserver), sinon les astres s'étirent.
- Grande Cuve : le serveur ne garde que des compteurs (masse, astres par joueur) ; l'affichage est une simulation locale (moteur en bac à sable, sol fixe, absorption des rangs ≥ 7 par le « cœur »). Pas de physique partagée entre joueurs, c'est voulu.
- `T[] || unknown` / noms ambigus en plpgsql : caster en `::text`, qualifier les colonnes dans les `assert`.
- Vidéo/capture : `recordVideo` de Playwright → `ffmpeg` ; la bande-annonce a été produite ainsi (non versionnée).
- Les mêmes tests tournent sur GitHub (`.github/workflows/tests.yml`).
- Robots (nov. 2026) : hasard ≈ « viser l'astre identique » (×1,2), ils perdent toujours vers 60-130 k points (secteur 8-10, ≈ 8-12 min). Les vrais joueurs font bien mieux (top : 884 k, secteur 35) : le talent compte, les robots naïfs ne le mesurent pas. Changer la difficulté casse les rediffusions/scores : ne le faire qu'avec une version de moteur stockée avec chaque score.
