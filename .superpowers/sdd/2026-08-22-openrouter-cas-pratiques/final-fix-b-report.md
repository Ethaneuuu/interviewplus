# Vague B — sécurité OpenRouter

Date : 23 août 2026
Base : `42a378c`

## Résultat

Les trois findings sécurité importants de la revue finale sont corrigés : le point d'entrée de correction n'est plus un proxy anonyme en production, les appels fournisseur et navigateur sont bornés dans le temps, et les contenus candidats sont envoyés comme données JSON non fiables avec une sortie JSON Schema strictement validée.

## Frontière d'accès et coût

- Le handler Netlify fonctionne en mode restreint par défaut. Il exige un Bearer JWT, le vérifie via `Supabase Auth /auth/v1/user`, puis confirme l'e-mail actif dans `authorized_users` avec la service-role exclusivement serveur. Il retourne `401 AUTH_REQUIRED` ou `403 ACCESS_NOT_AUTHORIZED`; aucune règle CORS n'est utilisée comme contrôle d'accès.
- Le client joint le token de la session Supabase ou du serveur local. Le serveur local applique désormais son authentification existante à `/api/correct`.
- Une limite par utilisateur et par minute protège chaque instance chaude (`CORRECTION_MAX_REQUESTS_PER_MINUTE`, défaut `10`). Une réponse réussie est idempotente pendant dix minutes pour la combinaison utilisateur + session + corps; les erreurs ne sont pas cachées et restent réessayables.
- Le fallback payant possède un budget horaire secondaire par instance chaude (`OPENROUTER_PAID_MAX_REQUESTS_PER_HOUR`, défaut `100`). Les compteurs de tokens fournisseur valides sont journalisés sous `INTERVIEWPLUS_OPENROUTER_USAGE`, sans prompt, réponse, référence, e-mail ou clé.

Ces gardes en mémoire ne sont pas un quota distribué : plusieurs instances Netlify ont des compteurs distincts et un redémarrage les remet à zéro. Le plafond de clé OpenRouter reste donc le garde-fou durable à configurer. Un quota atomique Supabase/ledger devient nécessaire avant des sessions payantes ou un trafic multi-instance significatif. Le mode invité signé proposé par la revue n'est pas implémenté, car la configuration produit validée est restreinte et désactive les invités; ajouter ce mode maintenant créerait une seconde frontière d'authentification inutilisée.

## OpenRouter et données non fiables

- Chaque tentative OpenRouter est interrompue après `OPENROUTER_TIMEOUT_MS` (défaut `6 000 ms`, borné à `15 000 ms`); le modèle gratuit suspendu laisse ainsi la place au modèle payant. Le navigateur interrompt l'ensemble après `20 000 ms` et conserve le repli existant.
- Les questions, réponses, mots-clés, références et recommandations sont sérialisés dans un document JSON. Le message système indique explicitement qu'ils sont non fiables et que leurs instructions ne doivent jamais être suivies.
- Les requêtes utilisent `response_format.type=json_schema`, `strict=true`, `additionalProperties=false` et `max_tokens` (`300–2 200` selon le nombre de questions, `250` pour la recommandation).
- Le serveur revalide indépendamment le résultat : au plus 20 concepts reconnus et 20 manques, 200 caractères par élément, 1 000 caractères de feedback, score borné et identifiants exacts. Les réponses candidates restent limitées à 8 000 caractères chacune et 64 000 caractères au total.

## Serveur local

Le classeur bilingue est chargé et mis en cache seulement lors d'une correction `questions`. Un cas numérique déterministe fonctionne donc sans classeur. Le diagnostic de démarrage décrit désormais OpenRouter et la correction déterministe au lieu de l'ancien score sémantique local.

## TDD et vérifications

RED observés avant implémentation : absence de `createHandler`; absence de `max_tokens`; client utilisant le `fetch` global sans token; correction Questions sans `sessionId`; endpoint local acceptant encore l'anonyme; échec OpenRouter empoisonnant le cache d'idempotence.

GREEN final :

- `22/22` scripts `tests/*-smoke.mjs` réussis, dont le smoke HTTP local exécuté avec autorisation loopback;
- oracle financier : `9/9` cas au maximum attendu et `10 000` graines par combinaison;
- `node scripts/build-static.mjs` : `34` fichiers publics;
- `node --check` sur tous les `.js`/`.mjs` hors SheetJS : succès;
- `git diff --check` : succès;
- aucun motif de clé OpenRouter et aucun nom de secret serveur dans `dist`;
- le smoke de déploiement reste explicitement `skipped-cli-missing`, la CLI Netlify n'étant pas installée.

Les tests utilisent des fakes Supabase/OpenRouter; aucune clé, dépense, requête fournisseur réelle ou déploiement n'a été effectué.

## Correctifs après re-review B

Range de correction : `75a7610..HEAD`.

### B1 — trajet d'authentification

- Le switch `CORRECTION_AUTH_MODE=local` a été supprimé du code de production. `createHandler()` reçoit désormais un `authorizer` explicite uniquement pour les tests; le handler exporté conserve toujours l'authorizer Supabase fermé par défaut.
- `serve-local.mjs` sert une configuration locale `backendMode: "server"` sans modifier `assets/js/config.js`, qui reste en mode Supabase pour Netlify. Le navigateur local récupère donc le token du serveur local avec `getRemoteSession()` et le transmet en Bearer à `/api/correct`.
- Le test local couvre désormais la chaîne navigateur `getRemoteSession → Authorization: Bearer → /api/correct`, en plus des appels HTTP directs.

### B2 — deadline globale

- Le timer navigateur de `20 000 ms` démarre avant `getRemoteSession()` et borne aussi une récupération de session suspendue.
- La Function crée une deadline globale de `17 500 ms`, plafonnée à `19 000 ms`, avant l'authentification. Chaque appel Supabase dispose au plus de `2 500 ms`; la même deadline est ensuite transmise au service OpenRouter.
- Une tentative OpenRouter dispose au plus de `6 000 ms`. Le serveur réserve `500 ms` au retour HTTP et ne lance le modèle payant que s'il reste au moins `2 000 ms`. Le budget serveur par défaut laisse donc `2 500 ms` de marge avant l'abandon client.
- Les tests couvrent une session navigateur qui ne résout jamais et un budget déjà consommé par l'authentification puis le modèle gratuit : le payant ne démarre pas.

### B3 — limites avant et après authentification

- Une limite pré-auth s'applique avant Supabase par adresse technique Netlify/IP (`CORRECTION_PREAUTH_MAX_REQUESTS_PER_MINUTE`, défaut `30`). La limite utilisateur authentifié reste à `10` corrections par minute.
- Les autorisations réussies sont cachées `30 s` par hash du Bearer afin qu'un retry chaud n'appelle pas à nouveau Supabase. Cette fenêtre bornée implique un délai maximal de `30 s` pour refléter une révocation; elle est volontairement courte.
- Les caches pré-auth, utilisateur, autorisation et idempotence sont purgés par TTL et plafonnés à `500` entrées (`CORRECTION_CACHE_MAX_ENTRIES`).
- Le service local est instancié une fois au démarrage; son compteur payant ne redémarre plus à chaque requête.
- À 80 % du plafond horaire chaud, `INTERVIEWPLUS_OPENROUTER_BUDGET_ALERT` est émis. `INTERVIEWPLUS_OPENROUTER_USAGE` conserve les métriques de tokens. Ces signaux et compteurs restent secondaires et par instance; le plafond de clé OpenRouter est le seul plafond durable de cette version. Un ledger distribué reste différé jusqu'à la monétisation ou à un trafic multi-instance qui le justifie.

### Vérification de la correction de re-review

- `21/21` smoke tests sans socket locale réussis après les correctifs;
- build statique, syntaxe, diff et secrets vérifiés;
- le smoke loopback a été enrichi mais n'a pas pu être rejoué après ces derniers changements : l'autorisation d'écoute locale a été refusée car la limite d'usage de l'environnement était atteinte. Il avait réussi avant la re-review B; aucune réussite post-correctif n'est revendiquée.

## Correctif B2.1 — deadline de l'opération complète

- `createCorrectionService().correct()` pose maintenant une unique deadline native autour de toute sa promesse, avant le chargement du corpus. Son timer est toujours nettoyé dans `finally`.
- Le même `AbortSignal` est transmis au loader Supabase Storage, au `fetch` OpenRouter et à la consommation de `response.json()`. Le timer par tentative fournisseur reste actif jusqu'à la lecture et au parsing complets du corps, pas seulement jusqu'aux en-têtes.
- Une deadline Questions produit `OPENROUTER_UNAVAILABLE`, donc le repli navigateur existant. Une deadline Case narrative retourne la note déterministe avec `narrativeStatus: "unavailable"`.
- RED reproduit : un `questionBankLoader` suspendu et un `response.json()` suspendu restaient tous deux `still-pending` après `50 ms` pour une deadline de `10 ms`.
- GREEN : les deux opérations terminent avec `OPENROUTER_UNAVAILABLE`; le loader reçoit un `AbortSignal`; aucun fallback payant ne démarre hors budget.
- `24/24` smoke tests sans socket locale réussissent; le handler suspendu retourne `502 OPENROUTER_UNAVAILABLE`; build de `34` fichiers, syntaxe, diff et scan de secrets réussissent.
- Le smoke loopback demeure non exécuté après B2.1 conformément à la limite d'autorisation déjà documentée.

## Correctif B3.1 — waiters concurrents du corpus

- Le cold start du corpus n'utilise plus le signal du premier appelant. Il possède un contrôleur interne et `PRIVATE_QUESTION_LOAD_TIMEOUT_MS` (`12 000 ms` par défaut, borné entre `10` et `30 000 ms`). Son timer est nettoyé dans `finally`.
- Chaque requête attend la promesse partagée avec son propre `AbortSignal`. L'expiration d'un waiter n'annule donc ni le fetch Storage ni les autres waiters.
- Une erreur réelle du chargement partagé réinitialise toujours la promesse cachée; le prochain appel peut reconstruire le corpus. Les tests de retry Storage existants restent verts.
- RED reproduit avec deux handlers : le premier expirait, puis le second lancé `50 ms` plus tard recevait `500 CORRECTION_INTERNAL_ERROR` malgré son budget restant.
- GREEN : le premier retourne `502 OPENROUTER_UNAVAILABLE`, le second `200`, un seul fetch Storage est exécuté, et le processus de test termine sans timer ou listener actif.
- Vérification fraîche : `24/24` smoke tests sans socket, build de `34` fichiers, syntaxe complète, diff et scan de secrets réussissent; le smoke loopback reste omis selon la limite déjà documentée.
