# Critical — feuille de route

## État actuel
L'application ne contient plus que le jeu de fusion d'astres. Les anciens modes (Campagne, Cascade, Atelier, codes de niveaux), les noyaux à ouvrir et les skins ont été retirés ; ils restent dans l'historique git.

Fait : trou noir de l'accueil (physique cuite une fois en haute définition, animation légère, image pré-rendue en secours), bouton Profil avec astre de profil, profils publics du classement (vitrine d'astres, devise), moteur physique testé (13 rangs, chaînes, secteurs, raretés, rejeu), astres animés, saut de secteur animé, première partie guidée, reprise de partie, défi du jour chronométré, missions du jour, thèmes d'arrière-plan achetés en poussière d'étoile, codex, classement mondial Supabase, écran de démarrage, cache hors-ligne.

Son : session « ambiance » (mode silencieux respecté, mélange avec la musique de l'utilisateur), suspension complète en arrière-plan et reprise en fondu, plus de battement de cœur en pause. Reste à faire : curseurs de volume, mixage (limiteur, plafond de voix, tampons réutilisés, baisse de la musique pendant les moments forts), musique liée au menu / jeu / danger / fin, catalogue de sons d'interface ; tests sur de vrais iPhone et Android.

## À faire, par priorité
1. **Essais sur de vrais téléphones** : fluidité, toucher, sons (jamais écoutés pendant le développement).
2. **Équilibrage sur de vrais joueurs** : rythme des 13 rangs, durées des défis du jour (réglées sur un joueur simulé), prix des thèmes.
3. **Vérification serveur des scores** : rejouer le journal de chaque partie dans une Edge Function avec `replay()` (attention : le moteur a changé, les journaux des anciennes versions ne se rejouent plus à l'identique ; il faudra stocker une version de moteur avec chaque score) ; filtre de pseudos injurieux.
4. **Stores** : emballage Capacitor, icônes et écrans de lancement natifs, mentions légales, politique de confidentialité (le classement stocke un pseudo).
5. **Idées** : objectifs en cours de partie, mode zen, sauvegarde cloud de la progression, thème appliqué aussi à l'accueil.
