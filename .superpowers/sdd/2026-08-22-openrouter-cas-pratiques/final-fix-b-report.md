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

- Chaque tentative OpenRouter est interrompue après `OPENROUTER_TIMEOUT_MS` (défaut `8 000 ms`, borné à `30 000 ms`); le modèle gratuit suspendu laisse ainsi la place au modèle payant. Le navigateur interrompt l'ensemble après `20 000 ms` et conserve le repli existant.
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
