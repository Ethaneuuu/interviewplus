# Audit technique InterviewPlus

> Mise à jour du 15 juillet 2026, historique : la correction distante décrite dans certaines étapes ci-dessous avait été retirée à cette date au profit du correcteur sémantique local uniquement.
>
> **Mise à jour du 23 août 2026 :** cette affirmation ne tient plus. La correction OpenRouter (`POST /api/correct`, Questions et Cas pratiques) est désormais le mode principal ; le correcteur local décrit ci-dessous n'est plus qu'un repli dégradé (voir [CORRECTION_LOCALE_GRATUITE.md](CORRECTION_LOCALE_GRATUITE.md)). L'hébergement a aussi changé : GitHub Pages a été retiré, le site est en production sur Netlify. Pour l'état courant, lire [docs/PROJECT.md](docs/PROJECT.md) et [ACCES_PRIVE.md](ACCES_PRIVE.md) ; le reste de ce document est un instantané historique, pas une référence à jour.

Date : 15 juillet 2026

## Conclusion

Le dépôt contenait deux applications concurrentes :

- la version HTML historique, reliée au classeur de 1 741 questions, au backend local et à la correction ;
- un prototype React visuellement plus récent, mais non relié à ces fonctions.

Le serveur affichait automatiquement le prototype React et masquait donc le produit fonctionnel. La version historique est désormais l'application principale sur `http://localhost:4173/`. Le prototype reste consultable sur `/modern/`.

## Corrections réalisées

### Bloquants

- Rétablissement de la version fonctionnelle à la racine du serveur.
- Conservation du prototype React sous `/modern/` sans confusion avec le produit utilisable.
- Embarquement local de SheetJS : le classeur fonctionne désormais sans téléchargement Internet au démarrage.
- Blocage explicite d'une session si le classeur est absent ou illisible, au lieu d'utiliser silencieusement une unique question de démonstration.
- Correction du lanceur macOS : aucune question obligatoire au premier lancement, attente du serveur avant ouverture du navigateur, Ollama optionnel.

### Parcours de session

- Le bouton « Précédente » reste disponible sur la dernière question.
- Une seule finalisation peut être lancée à l'expiration du chronomètre.
- Les contrôles sont verrouillés pendant la correction pour éviter les doubles appels et doubles enregistrements.
- En cas d'échec de correction, les réponses restent conservées et une relance manuelle est possible.

### Sécurité locale

- Le fichier `data/interviewplus-db.json` n'est plus servi publiquement.
- Les fichiers de configuration, sources serveur et guides internes ne sont plus exposés par le serveur statique.
- Les nouveaux mots de passe sont dérivés avec `scrypt` au lieu d'un SHA-256 rapide.
- Les anciens hashes SHA-256 restent compatibles et sont migrés après une connexion réussie.
- La déconnexion révoque aussi le token côté serveur.
- Les corps JSON entrants sont limités à 1 Mo.
- La vérification de traversée de répertoire ne repose plus sur un simple préfixe de chemin.

### Qualité du prototype React

- Ajout de la configuration ESLint manquante.
- Suppression d'une erreur de code inutilisé.
- Le lint passe sans erreur et le build de production réussit.

## Vérifications effectuées

- Validation syntaxique du serveur et de tous les modules JavaScript historiques.
- Build de production React réussi : 1 884 modules transformés.
- ESLint React : aucune erreur, six avertissements de Fast Refresh non bloquants dans les composants UI génériques.
- Lecture indépendante du classeur : 1 741 lignes exploitables, six catégories, questions et réponses présentes.
- Inspection du classeur : six feuilles, aucune erreur de formule détectée.
- Tests HTTP : accueil fonctionnel `200`, bibliothèque locale `200`, prototype `/modern/` `200`, base privée `404`, API sans token `401`.
- Cycle d'authentification local testé : création, session authentifiée, déconnexion, token refusé après déconnexion. Les données de test ont été supprimées.
- Build React et base locale laissés dans un état propre.

## Audit approfondi du 16 juillet 2026

- Toutes les pages publiques répondent correctement : accueil, authentification, configuration, session, résultats et profil.
- Les 54 liaisons principales entre le JavaScript et les éléments de page ont été contrôlées ; aucune cible statique obligatoire ne manque.
- Les 75 références locales des pages ont été contrôlées ; aucun fichier lié ne manque.
- Le moteur a été exécuté avec de vraies questions : sélection sans doublon, timer, réponses, correction, historique, profil et persistance validés.
- Le fallback sémantique a été validé avec un endpoint Ollama indisponible.
- Les réponses de référence obtiennent désormais un score cohérent ; les réponses de très faible effort restent à zéro.
- Le faux déclenchement de la règle « formule Equity Value » sur des questions ECM/DCM a été corrigé.
- Le thème Brain Teaser expose maintenant sa limite réelle de 14 questions et empêche les configurations impossibles.
- Les 53 questions nécessitant une actualisation sont maintenant comptées dans le setup et signalées pendant la session et dans le corrigé.
- Un test réutilisable a été ajouté dans `tests/engine-smoke.mjs`.

## Mise à niveau bilingue du 16 juillet 2026

- Ajout d'un corpus français complet correspondant aux 1 741 questions et réponses anglaises.
- Conservation des mêmes identifiants et métadonnées de source dans les deux langues.
- Ajout des feuilles `FR_QR` et `TAXONOMY_FR` dans `Questions_InterviewPlus_Bilingual.xlsx`.
- Séparation stricte des thèmes et des comptages par langue pour éviter les mélanges français/anglais.
- Ajout d'un sélecteur FR/EN global, mémorisé dans le navigateur.
- Adaptation des pages de configuration, session, résultats, profil et authentification.
- Localisation du feedback de correction locale et des consignes envoyées aux moteurs IA.
- Extension du test moteur aux 3 482 lignes bilingues et à la création d'une session française.

## Correction publique à faible coût

- Remplacement de l'ancien modèle par défaut par `gpt-5.4-nano`.
- Ajout d'une seconde lecture automatique avec `gpt-5.4-mini` pour les évaluations peu confiantes ou ambiguës.
- Mutualisation de la logique Vercel et Netlify dans `lib/evaluation-service.js`.
- Ajout d'un schéma JSON strict incluant un indice de confiance.
- Validation des tailles d'entrée, timeout, nouvelle tentative et limitation de débit.
- Suppression des appels payants pour les réponses vides ou manifestement insuffisantes.
- Conservation du scoring sémantique local comme secours automatique.
- Ajout du test `tests/evaluation-service-smoke.cjs` et du guide `DEPLOIEMENT_CORRECTION_IA.md`.

## Limites restantes

### Priorité haute avant une mise en ligne publique

- Le prototype React reste une maquette : authentification simulée, dix questions codées en dur, langues non traduites, score auto-déclaré par checklist, métriques marketing fictives.
- La version fonctionnelle sert le classeur complet au navigateur. Les réponses attendues peuvent donc être téléchargées par un utilisateur ; une vraie protection exige de déplacer les questions et corrections côté serveur.
- Le backend JSON local est adapté à une utilisation personnelle, pas à plusieurs utilisateurs simultanés : aucune transaction ni stratégie de verrouillage interprocessus.
- Il n'existe pas encore de tests automatisés de parcours navigateur dans le dépôt.

### Priorité moyenne

- Sans Ollama, la correction sémantique locale fonctionne mais reste moins fiable qu'un modèle IA bien configuré, notamment pour les réponses comportementales et les formulations éloignées du corrigé.
- Les 53 questions marquées « Refresh before interview » nécessitent des données récentes ; l'application ne les actualise pas automatiquement.
- La réinitialisation de mot de passe n'est pas disponible avec le backend local.
- Les polices Google sont encore distantes. Leur absence n'empêche pas l'utilisation, mais modifie légèrement le rendu hors ligne.
- La traduction française a été générée hors ligne puis normalisée sur les principaux termes financiers. Une relecture éditoriale spécialisée reste recommandée avant une diffusion académique ou commerciale à grande échelle.

## Recommandation d'architecture

Conserver la version historique comme moteur de production immédiat, puis migrer progressivement son backend, son chargement de questions et son évaluation dans le prototype React. Ne pas activer le prototype comme page principale tant que les cinq fonctions suivantes ne sont pas réellement branchées : comptes, classeur complet, session persistante, correction IA avec fallback et historique synchronisé.
