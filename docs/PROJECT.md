# InterviewPlus — documentation du projet

État décrit au **30 août 2026**, branche `main` déployée en production sur Netlify. Les migrations Supabase n'ont pas été rejouées sur un projet de staging dans cette passe et aucun appel OpenRouter réel avec clé de production n'a été émis depuis l'environnement de travail local.

## Architecture

```text
Navigateur — HTML/CSS/ES modules natifs
  ├─ Questions : configuration → session chronométrée → POST /api/correct
  ├─ Cas pratiques : thème/difficulté/temps → formulaire → POST /api/correct
  └─ Supabase : Auth, historique utilisateur et classeur privé
                         │ Bearer JWT
Netlify Function `correct`
  ├─ Auth Supabase + `authorized_users`
  ├─ Questions : référence privée → OpenRouter gratuit → payant
  └─ Cas : calcul déterministe → OpenRouter seulement pour la recommandation
```

L'application n'offre ni recherche ni parcours libre des 3 482 questions avant une session. En production, le classeur n'est pas dans le bundle public : un navigateur authentifié le télécharge depuis le bucket privé pour construire la session, tandis que la Function en charge une copie indépendante pour ne jamais faire confiance à une référence envoyée par le client. Les réponses types existent donc en mémoire côté navigateur autorisé ; l'absence d'explorateur est une règle produit, pas une barrière anti-triche absolue.

Les réponses sont sauvegardées avant la correction. Après soumission, une session n'est marquée `review` qu'après correction et commit : écriture locale avant mutation mémoire en mode local, ou upsert distant comme point de commit en mode Supabase/serveur. Une panne de cache après un upsert distant n'annule pas la réussite ; une panne avant le commit conserve le brouillon `running`, réessayable.

## Stack et carte des fichiers

- **Client :** HTML, CSS, JavaScript natif, contrôles HTML accessibles et SheetJS déjà présent ; aucun framework ni nouvelle dépendance.
- **État et données :** `assets/js/store.js` gère les sessions et leur atomicité ; `assets/js/backend.js` adapte Supabase ou le serveur local ; `assets/js/correction-client.js` ajoute le Bearer et la deadline client.
- **Questions :** `assets/js/keywords.js` extrait les concepts ; `assets/js/keyword-overrides.js` contient les exceptions éditoriales ; `netlify/functions/lib/question-bank.mjs` charge et met en cache le classeur privé.
- **Cas :** `assets/js/case-templates.js` génère les énoncés publics par graine ; `netlify/functions/lib/case-grader.mjs` conserve les formules et la notation côté serveur.
- **API :** `netlify/functions/correct.mjs` gère HTTP, auth, limites et idempotence ; `netlify/functions/lib/correction-service.mjs` valide, route, borne les délais et appelle OpenRouter.
- **Interface :** `index.html` (accueil), `auth.html`, `new-session.html` (choix Questions / Cas), `setup.html` + `session.html` (tunnel Questions), `case-setup.html` + `case-session.html` (tunnel Cas), `results.html` (rend Questions et Cas) et `profile.html`. `assets/js/nav.js` standardise la barre de navigation et le lien Connexion/Mon espace sur toutes les pages ; `assets/js/mobile-nav.js` gère le menu compact ; `assets/js/theme.js` applique le thème clair/sombre choisi (stocké en `localStorage`, script anti-FOUC inline sur les 8 pages).
- **Logos :** `assets/img/logos/*.svg` sont les vrais wordmarks officiels (sourcés Wikimedia Commons, domaine public) affichés dans le bandeau de confiance ; `assets/img/logos/incoming/` est un dossier de dépôt gitignoré pour fournir un nouveau logo à intégrer sans le committer par erreur.
- **Déploiement :** `supabase/schema.sql` porte tables/RLS/bucket ; `netlify.toml` route la Function ; `scripts/build-static.mjs` produit l'allowlist publique de 40 fichiers dans `dist`.
- **Tests :** les scripts autonomes `tests/*-smoke.mjs` couvrent contrats, sécurité, atomicité, i18n, persistance, build et logique financière sans framework de test.

Le build statique exclut Functions, SQL, tests, documentation, classeurs et `keyword-overrides.js`. Netlify regroupe séparément les imports nécessaires à la Function.

## Flux Questions

Le candidat choisit langue, thème, nombre de questions et temps. À la fin du tunnel, la correction démarre directement, sans récapitulatif de dix secondes. Pour chaque réponse, le serveur croise :

1. la question ;
2. la réponse du candidat ;
3. les mots-clés attendus ;
4. la réponse type.

OpenRouter évalue exactitude et couverture des concepts comme un ensemble, sans pondération fixe artificielle. Les contenus candidat sont sérialisés comme données JSON non fiables ; le prompt système interdit de suivre leurs instructions. La sortie utilise un JSON Schema strict puis une seconde validation serveur : identifiants exacts, score 0–100, au plus 20 concepts reconnus et 20 éléments manquants de 200 caractères, feedback de 1 000 caractères maximum.

Ordre : `openai/gpt-oss-120b:free`, puis `openai/gpt-oss-120b` si le temps et le budget chaud le permettent. Si les deux échouent, le client conserve les réponses et utilise le correcteur local avec `mode: "local-degraded"`. Une recorrection OpenRouter est disponible depuis les résultats et remplace uniquement les champs de correction après une réponse complète valide.

## Flux Cas pratiques

Avant lancement, l'utilisateur choisit uniquement le thème, la difficulté et le temps. L'énoncé et les champs apparaissent ensuite. La validation lance immédiatement la correction.

`theme + difficulty + seed` reproduit exactement un template versionné. Chaque thème garde les mêmes outputs cœur entre `easy`, `intermediate` et `advanced`; les niveaux supérieurs ajoutent des hypothèses à dériver, des calculs intermédiaires, des scénarios et des contraintes. Toutes les conventions utilisées par le corrigé sont publiques dans l'énoncé ; aucune valeur attendue ne l'est avant soumission.

| Thème | Facile | Intermédiaire | Avancé |
|---|---|---|---|
| DCF | Prévisions et WACC fournis | WACC à construire, mid-year/stub, Gordon + multiple et grilles de sensibilité | Segments, bêtas désendettés/réendettés et scénarios opérationnels croisés |
| LBO | Une dette et FCF direct | Tranches, revolver, cash minimum, NOL et management pool | PIK, cash sweep, call premium, projections Y1–Y5, bilan intégré, waterfall et bridge de création de valeur |
| Merger Model | Prix, mix, résultats et actions | Contraintes de financement, frais et PPA | Bilans historiques, levier maximal, DTL/goodwill, bilan combiné, rampe/NPV des synergies et EPS Y1–Y3 |

Les outputs cœur couvrent notamment UFCF/EV/equity/share price pour le DCF, sources-emplois/dette/rendements pour le LBO, et prix/financement/EPS/accrétion-dilution pour le Merger Model. Les valeurs numériques sont notées par tolérance absolue : crédit entier dans la tolérance, demi-crédit jusqu'à deux fois la tolérance, sinon zéro.

Sans narration, la note vaut 75 % résultats et 25 % méthode. Le Merger Model avancé réserve 5 % à la recommandation : 70 % résultats, 25 % méthode, 5 % justification. Une recommandation vide ne déclenche aucun appel IA et plafonne la note à 95 ; une indisponibilité OpenRouter conserve la note numérique avec `narrativeStatus: "unavailable"`. Le seuil de réussite est 70.

La page active et les résultats sont localisés explicitement en français et anglais pour les neuf combinaisons. Les anciennes lignes Supabase sans `session_json` infèrent la langue de la première question.

## `POST /api/correct`

Seul endpoint applicatif Netlify de cette version. Méthode `POST`, JSON et header `Authorization: Bearer <Supabase JWT>` obligatoires en production. Le client InterviewPlus exige aussi un `sessionId` non vide ; la Function l'utilise avec l'utilisateur et le hash du corps comme clé d'idempotence pendant dix minutes. Un `sessionId` absent ou supérieur à 128 caractères désactive ce cache et n'est pas un usage client supporté.

Le handler vérifie le JWT via `${SUPABASE_URL}/auth/v1/user`, puis exige une ligne `authorized_users` active pour l'e-mail. Il n'existe aucun `CORRECTION_AUTH_MODE` ni bypass d'environnement en production. Le CORS n'est pas utilisé comme contrôle d'accès.

### Requête Questions

```json
{
  "type": "questions",
  "sessionId": "uuid-de-session",
  "items": [
    { "questionId": "1", "language": "fr", "answer": "Le WACC est…" }
  ]
}
```

`items` contient 1 à 20 IDs uniques. Une réponse contient au plus 8 000 caractères et le lot au plus 64 000.

```json
{
  "score": 82,
  "mode": "openrouter",
  "provider": "openrouter",
  "model": "openai/gpt-oss-120b:free",
  "items": [
    {
      "questionId": "1",
      "score": 82,
      "recognizedConcepts": ["WACC"],
      "missingElements": ["structure de capital"],
      "feedback": "Ajoutez le lien avec les flux non endettés."
    }
  ]
}
```

### Requête Cas

```json
{
  "type": "case",
  "sessionId": "uuid-de-session",
  "theme": "dcf",
  "difficulty": "intermediate",
  "seed": 12345,
  "answers": { "enterprise_value": 1234.5 },
  "recommendation": "Seulement si l'énoncé la demande"
}
```

`theme` vaut `dcf`, `lbo` ou `merger-model`; `difficulty` vaut `easy`, `intermediate` ou `advanced`; `seed` est un entier non signé 32 bits. `answers` contient au plus 80 champs connus, nombres finis ou chaîne vide. `recommendation` est limitée à 2 000 caractères.

```json
{
  "score": 78.25,
  "passed": true,
  "breakdown": { "results": 80, "method": 75, "justification": 0 },
  "items": [
    { "id": "enterprise_value", "category": "results", "credit": 1, "score": 1234.5, "tolerance": 1 }
  ],
  "statement": { "templateId": "dcf-intermediate-v1" },
  "mode": "deterministic"
}
```

`items[].score` est la valeur attendue retournée seulement après soumission. Une narration notée ajoute `mode: "openrouter"`, `provider`, `model`, `narrativeStatus: "scored"` et `feedback`.

### Statuts et erreurs

- `400` : `INVALID_JSON`, `INVALID_CORRECTION_TYPE`, `INVALID_CORRECTION_ITEMS`, `INVALID_CORRECTION_ITEM`, `TOO_MANY_ITEMS`, `ANSWER_TOO_LONG`, `CORRECTION_PAYLOAD_TOO_LARGE`, `UNKNOWN_QUESTION` ou `INVALID_CASE_*`/`TOO_MANY_CASE_ANSWERS`.
- `401 AUTH_REQUIRED` : Bearer absent ou JWT invalide ; `403 ACCESS_NOT_AUTHORIZED` : utilisateur valide mais absent/inactif dans `authorized_users`.
- `429 RATE_LIMITED` : limite technique pré-auth ou limite par utilisateur dépassée.
- `502 OPENROUTER_UNAVAILABLE` : les Questions n'ont reçu aucune réponse IA valide dans le budget ; le client passe en `local-degraded`. Un Cas conserve son calcul déterministe.
- `405 METHOD_NOT_ALLOWED` pour une autre méthode ; `500 INTERNAL_ERROR` pour une configuration, Supabase, corpus ou erreur interne non exposée.

Les erreurs ne sont pas mises en cache : elles restent réessayables. Les logs internes utilisent uniquement des codes stables. `INTERVIEWPLUS_OPENROUTER_USAGE <model> <prompt_tokens> <completion_tokens> <total_tokens>` et `INTERVIEWPLUS_OPENROUTER_BUDGET_ALERT` ne contiennent ni e-mail, prompt, réponse, référence ou clé.

## Authentification locale

```bash
node serve-local.mjs
# http://localhost:4173
```

Le serveur injecte à la volée `backendMode: "server"` sans modifier `assets/js/config.js`. Après inscription/connexion locale, `getRemoteSession()` lit le token local et `correction-client.js` l'envoie en Bearer à `/api/correct`. Une correction anonyme reçoit `401`. Le loader du classeur est paresseux et partagé : un Cas déterministe fonctionne sans classeur ; une correction Questions le charge à la première demande.

Les routes `/api/auth/*`, `/api/me` et `/api/sessions` appartiennent uniquement au serveur de développement Node ; elles ne sont pas des endpoints Netlify de production.

## Délais, limites et garde-fous OpenRouter

| Variable serveur | Défaut | Rôle |
|---|---:|---|
| `CORRECTION_SERVER_TIMEOUT_MS` | `17500` | deadline globale Function, plafonnée à 19 s |
| `SUPABASE_AUTH_TIMEOUT_MS` | `2500` | délai de chaque appel Auth/autorisation, borné par la deadline |
| `OPENROUTER_TIMEOUT_MS` | `6000` | délai par tentative, borné entre 1 et 15 s |
| `CORRECTION_RETURN_MARGIN_MS` | `500` | marge réservée à la réponse HTTP, maximum 5 s |
| `OPENROUTER_PAID_MIN_BUDGET_MS` | `2000` | temps restant minimal avant de lancer le modèle payant |
| `PRIVATE_QUESTION_LOAD_TIMEOUT_MS` | `12000` | timeout propre au cold start partagé, borné entre 10 ms et 30 s |
| `CORRECTION_PREAUTH_MAX_REQUESTS_PER_MINUTE` | `30` | limite par IP/identifiant technique avant Supabase |
| `CORRECTION_MAX_REQUESTS_PER_MINUTE` | `10` | limite par utilisateur authentifié |
| `CORRECTION_AUTH_CACHE_MS` | `30000` | cache positif d'autorisation ; révocation visible sous 30 s au plus |
| `CORRECTION_CACHE_MAX_ENTRIES` | `500` | plafond et purge TTL des caches chauds |
| `OPENROUTER_PAID_MAX_REQUESTS_PER_HOUR` | `100` | plafond secondaire de tentatives payantes par instance chaude |

Le navigateur borne l'opération complète — récupération de session comprise — à 20 s. Le service garde une seule deadline autour du corpus, du fetch OpenRouter et de la lecture/parsing du corps. Le cold start du corpus possède son propre contrôleur : l'expiration d'un client n'annule pas les autres waiters.

Les limites, caches, idempotence et compteur payant ci-dessus vivent en mémoire d'une instance chaude Netlify. Ils repartent à zéro au redémarrage et ne forment pas un quota distribué. Le plafond de dépense configuré sur la clé OpenRouter est le garde-fou durable de cette version. Avant trafic multi-instance significatif ou sessions payantes, ajouter un quota atomique partagé et un ledger.

## Netlify

`netlify.toml` exécute `node scripts/build-static.mjs`, publie `dist`, inclut SheetJS dans le bundle de Function et redirige `/api/correct`.

Variables obligatoires :

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret serveur>
OPENROUTER_API_KEY=<secret serveur>
```

Variables avec défaut :

```text
PRIVATE_QUESTION_BUCKET=interviewplus-private
PRIVATE_QUESTION_PATH=Questions_InterviewPlus_Bilingual.xlsx
OPENROUTER_FREE_MODEL=openai/gpt-oss-120b:free
OPENROUTER_PAID_MODEL=openai/gpt-oss-120b
```

Ajouter au besoin les réglages de la table précédente. Aucun secret ne doit être copié dans `assets/js/config.js` ou `config.example.js`.

Déploiement :

1. connecter le dépôt à Netlify et conserver la commande/publish de `netlify.toml` ;
2. définir les variables serveur dans l'environnement Netlify ;
3. renseigner `supabaseUrl` et `supabaseAnonKey` publics dans `assets/js/config.js` ;
4. lancer une preview, vérifier la Function, puis seulement publier.

**État actuel : déployé et validé en live** sur `https://wonderful-jelly-b6826d.netlify.app`, dépôt connecté pour déploiement continu (build automatique à chaque push sur `main`). GitHub Pages a été retiré (workflow supprimé, hébergement désactivé) : Netlify est l'unique cible de production, seule capable d'exécuter la Function `/api/correct`. Vérifié en direct : page d'accueil `200`, `/api/correct` anonyme renvoie `401 AUTH_REQUIRED` (auth Supabase appliquée), et les fichiers hors `dist/` (code serveur, docs, tests, classeur) renvoient `404`. La CLI Netlify reste absente de l'environnement de travail local ; le bundle/cold start n'a donc jamais été rejoué par la CLI elle-même — la Function tourne bien en production, mais ce test spécifique reste `skipped-cli-missing` dans le smoke de déploiement.

## Supabase

1. Exécuter `supabase/schema.sql` dans le SQL Editor.
2. Charger `Questions_InterviewPlus_Bilingual.xlsx` dans le bucket privé `interviewplus-private` au chemin exact configuré.
3. Optionnel : pré-approuver des e-mails dans `public.authorized_users` avec `active = true` avant même leur inscription ; sinon, l'inscription libre crée automatiquement leur ligne avec `active = false` (voir Authentification / approbation ci-dessous).
4. Configurer Auth Site URL et Redirect URLs pour local, preview et production.
5. Vérifier avec des comptes distincts que chacun ne lit/modifie que son profil, ses `session_runs` et l'objet privé autorisé.

Le schéma active RLS sur `authorized_users`, `profiles` et `session_runs`. `public.is_authorized_user()` vérifie l'e-mail JWT actif ; les policies de session imposent `auth.uid() = user_id`. Les données Case sont stockées dans les colonnes additives `session_type`, `difficulty`, `template_id`, `case_seed`, `case_json`, `score_json`, `correction_mode`, `correction_provider`, `correction_model` et dans l'enveloppe complète `session_json`.

### Authentification / approbation

L'inscription est ouverte à n'importe quelle adresse (`allowPublicSignup: true`). Le déclencheur `handle_new_user` (sur `auth.users`) crée automatiquement, en plus de `profiles`, une ligne `authorized_users` pour l'adresse (mise en minuscules), avec `active = false`, sauf si une ligne existe déjà pour cette adresse quelle que soit sa casse (comparaison `lower(email)`) — auquel cas sa valeur `active` existante est conservée. Un compte `active = false` peut s'authentifier auprès de Supabase Auth mais `getRemoteCurrentUser()` (client) et `authorize()` (Function `/api/correct`) le rejettent et le déconnectent : `ACCOUNT_PENDING_APPROVAL` côté client, `403 ACCESS_NOT_AUTHORIZED` côté API.

Il n'existe aucune interface d'administration dans l'app : l'administrateur approuve un compte en passant `active` à `true` sur sa ligne dans `Table Editor > authorized_users` (Supabase). Les deux vérifications d'autorisation (`backend.js` côté client, `correct.mjs` côté Function) comparent l'e-mail avec `ilike` (insensible à la casse) pour tolérer une ligne pré-approuvée saisie manuellement avec une casse différente de celle utilisée à l'inscription.

La migration et les policies ont été contrôlées statiquement et avec des fakes. Elles n'ont pas été appliquées à un projet Supabase de staging dans cette passe.

## Mots-clés et banque de questions

Le loader lit `EN_QA_FINAL` et `FR_QR`, utilise la clé `<langue>:<id>`, exige exactement 3 482 entrées et conserve question, réponse type et mots-clés. Une exception ciblée se déclare dans `assets/js/keyword-overrides.js` :

```js
export const KEYWORD_OVERRIDES = Object.freeze({
  "en:42": { add: ["enterprise value"], remove: ["terminal"], replace: ["wacc", "free cash flow"] },
});
```

`replace` remplace l'extraction ; sinon `add` et `remove` la complètent. Le cache se reconstruit au cold start ou après une vraie erreur de chargement.

```bash
node -e "const fs=require('node:fs'); import('./netlify/functions/lib/question-bank.mjs').then(async ({createQuestionBankLoader})=>{const bank=await createQuestionBankLoader({workbookBytes:fs.readFileSync('Questions_InterviewPlus_Bilingual.xlsx')})(); if(bank.size!==3482) process.exit(1); console.log(bank.size)})"
```

## Créer un template

Un thème possède un générateur public et une formule serveur, pas neuf exercices copiés. Pour ajouter un thème :

1. ajouter son ID à `CASE_THEMES` et ses livrables stables à `CORE_OUTPUTS` ;
2. ajouter les sorties de méthode progressives à `METHOD_OUTPUTS` et les données publiques à `publicInputs` ;
3. ajouter les formules à `case-grader.mjs` sans constante cachée ;
4. localiser les nouveaux IDs dans `assets/js/i18n.js` ;
5. étendre l'oracle indépendant et les smokes de reproductibilité/invariants.

Chaque champ précise format, poids et tolérance absolue. La graine doit être reproductible, toutes les hypothèses déterminantes doivent être visibles, et l'oracle ne doit importer ni `case-grader.mjs` ni `calculateCaseSolution`.

## OpenRouter — Coûts et quotas

Choix actuel : `openai/gpt-oss-120b:free`, puis `openai/gpt-oss-120b`. Il maximise la qualité disponible via le palier gratuit tout en gardant un fallback payant très peu coûteux. Aucun sélecteur de fournisseur n'est exposé à l'utilisateur.

Au **23 août 2026**, OpenRouter affiche 0,03 USD par million de tokens en entrée et 0,17 USD en sortie pour le modèle payant. Avec 1 000 tokens d'entrée et 300 de sortie, l'hypothèse est d'environ **0,081 USD pour 1 000 corrections**. Ce calcul est indicatif : vérifier [la page modèle](https://openrouter.ai/openai/gpt-oss-120b), [les limites](https://openrouter.ai/docs/api-reference/limits) et [l'usage](https://openrouter.ai/docs/use-cases/usage-accounting) avant ouverture.

Une nouvelle clé OpenRouter peut avoir son propre suivi et son propre plafond, mais les crédits restent partagés au niveau du compte/workspace. Elle ne crée donc pas une facturation globale indépendante. Cette consommation est séparée d'un abonnement ChatGPT et d'une facturation directe OpenAI, sauf BYOK explicitement configuré.

## Vérifier

Suite sans socket locale :

```bash
for test in tests/*-smoke.mjs; do
  [ "$test" = "tests/local-correction-contract-smoke.mjs" ] || node "$test" || exit 1
done
node scripts/build-static.mjs
git diff --check
```

Contrat HTTP local, à exécuter dans un environnement autorisant le loopback :

```bash
node tests/local-correction-contract-smoke.mjs
```

La suite utilise des fakes : elle ne dépense aucun crédit et ne contacte pas OpenRouter/Supabase live. `OPENROUTER_UNAVAILABLE` signifie que les réponses fournisseur n'ont pas été obtenues/validées dans le budget. Les logs `PRIVATE_QUESTION_FILE_UNAVAILABLE`, `QUESTION_BANK_ERROR` et `CORRECTION_INTERNAL_ERROR` permettent de distinguer corpus indisponible, corpus invalide et panne interne sans exposer de donnée utilisateur.

## État d'avancement — 30 août 2026

### Lot correctifs UX (30 août 2026)

Quinze points de bug/incohérence corrigés dans le code existant, sans refonte, en réutilisant composants et patterns actuels.

- **Header stable** : `#authNavLink` est livré `hidden` et n'est révélé que par `wireAuthNavLink()` une fois l'auth résolue — plus de bascule visible « Connexion » ↔ « Mon espace ».
- **Nav consolidée** : « Nouvelle session » + « Cas pratiques » + « Sessions » remplacés par une seule entrée « S'entraîner » → `new-session.html` (page de choix Questions / Cas). Les doublons « Profil » / « Sessions » retirés ; `profile.html` devient l'espace unique « Sessions & progression » avec historique, bannière de reprise et graphiques.
- **Hero** : suppression de la mention « <nom> | compte synchronisé » et de son emplacement vide.
- **Logos** : monochromes en CSS (`filter: grayscale(1) brightness(0)`, adapté clair/sombre), rangée horizontale, fondu progressif sur les bords via `mask-image` ; générique (tout `img` de la piste est stylé).
- **Fin de session Questions** : `finalizeSession({ requireComplete })` fait une validation locale AVANT tout appel API ; réponses manquantes → aucune requête, session non terminée, message « Vous n'avez pas répondu aux questions suivantes… » + numéros listés et surlignés dans le navigateur. Garde in-flight contre le double-clic. Nouveau `tests/session-finish-validation-smoke.mjs`.
- **Affichage des cas** : plus de tableau « Données du cas » séparé — les chiffres sont tissés dans l'énoncé (liste « Hypothèses retenues ») + un `<details>` « Rappel des données chiffrées » repliable dans la zone de saisie. Écran structuré « Énoncé » (titre explicite) → contenu → « Réponses » → tableau de saisie pleine largeur, empilé et responsive.
- **Tableau de réponses unique** : résultats et méthode fusionnés en un seul tableau (le grader lit toujours `field.category` du statement, inchangé).
- **Colonnes temporelles** : `N+1`…`N+5` au lieu de `FY27`/`FY28` partout (templates, labels de sortie, en-têtes de grille) ; une série d'années partielle devient des lignes individuelles pour que chaque cellule visible soit réellement éditable (corrige les cellules mortes 2028-2031).
- **Pause / quitter** (`assets/js/session-exit.js`, partagé Questions + Cas) : bouton « Mettre en pause » (sauve et sort), bouton « Quitter » ouvrant un `<dialog>` natif « continuer / mettre en pause et sauvegarder / quitter définitivement » ; garde `beforeunload` pendant la session. `store.pauseActiveSession` gèle le temps restant et garde réponses + index ; `resumeActiveSession` relance le compte à rebours ; une session en pause n'est jamais corrigée automatiquement. Reprise depuis la bannière de `profile.html`. Nouveau `tests/session-pause-resume-smoke.mjs`.
- Vérification : **30/30 smokes verts** (hors contrat HTTP loopback), `node scripts/build-static.mjs` → **40 fichiers**, `git diff --check` propre, QA visuelle du tunnel Cas (nouvelle mise en page, pause, labels N+) à 1440 px.

#### Reprise — à checker avant de déployer ce lot en ligne

**État au moment de la pause :** les 6 commits ci-dessous sont sur `main` **en local, non poussés**. `git push origin main` déclenche le build Netlify et met le lot en production. Ne pousser qu'après avoir tout validé ci-dessous.

```
368ff00 docs: log the 15-point UX correctness batch
9a1653f fix(case): relabel the explicit year output labels to N+ notation
580d53a feat: pause / quit flow for question sessions and practical cases
b2ddfd5 refactor(case): inline data into the prompt, single answer table, N+ years
2a95951 fix: gate "Terminer la session" on locally-validated answers
771b4a1 fix: stable header + consolidated "S'entraîner" nav + mono logos
```

**Étape 0 — Claude réactive le localhost.** Au début de la session de reprise, demander à Claude de relancer le serveur de dev :

```bash
node serve-local.mjs        # → http://localhost:4173/
```

Le site est visible sur **http://localhost:4173/**. Port occupé → `node serve-local.mjs --port 3000`.

**Étape 1 — tests + build (automatique, ~1 min).** Claude lance :

```bash
for test in tests/*-smoke.mjs; do
  [ "$test" = "tests/local-correction-contract-smoke.mjs" ] || node "$test" || exit 1
done
node scripts/build-static.mjs      # attendu : "Built 40 public files in dist"
git diff --check                   # attendu : aucune sortie
```

Attendu : **30 smokes verts**, **40 fichiers**, `git diff --check` muet. Les tests utilisent des fakes — aucun crédit OpenRouter/Supabase dépensé.

**Étape 2 — QA visuelle desktop (manuelle, ~10 min) sur http://localhost:4173/ :**

1. **Header stable** — sur chaque page, après un refresh (F5) *et* après une navigation interne : le lien d'auth ne clignote pas entre « Connexion » et « Mon espace ».
2. **Nav consolidée** — une seule entrée « S'entraîner » dans la barre ; elle mène à `new-session.html` (choix Questions / Cas). Plus de « Cas pratique », « Session » ni « Profil » séparés.
3. **Espace unique** — `profile.html` affiche profil + historique + bannière de reprise + graphiques ; « Mon espace » n'est plus une destination indépendante.
4. **Accueil** — logos en noir et blanc, alignés horizontalement, avec un fondu progressif à gauche et à droite ; **plus aucune** mention « … compte(s) synchronisé(s) » dans le hero, ni espace vide à la place.
5. **Fin de session Questions sans réponses** — lancer une session, laisser des réponses vides, cliquer « Terminer la session » : aucun appel réseau (onglet Network), la session ne se termine pas, message « Vous n'avez pas répondu aux questions suivantes… » + numéros des questions listés et surlignés dans le navigateur. Refaire avec seulement une partie des réponses remplies.
6. **Double-clic** — double-cliquer « Terminer la session » avec toutes les réponses : une seule requête `/api/correct`.
7. **Cas pratique** — écran dans l'ordre : titre « Énoncé » → contenu complet du cas → titre « Réponses » → zone de saisie pleine largeur. Les chiffres du cas sont dans la prose de l'énoncé (« Hypothèses retenues : … ») ; **pas** de tableau « Données du cas » séparé ; un `<details>` « Rappel des données chiffrées » repliable est disponible près des réponses.
8. **Tableau de réponses** — un seul tableau (résultats + méthode fusionnés). En-têtes de colonnes en `N+1 … N+5` (jamais `FY27`/`FY28`). **Chaque cellule affichée est éditable**, y compris les dernières années — vérifier en tapant une valeur dans chaque colonne.
9. **Pause / Quitter** — boutons présents dans le bandeau de session (Questions *et* Cas). « Mettre en pause » sauve et sort ; « Quitter » ouvre une fenêtre avec 3 choix (continuer / mettre en pause et sauvegarder / quitter définitivement). Tenter une navigation pendant une session en cours → avertissement du navigateur.
10. **Reprise** — une session mise en pause réapparaît dans la bannière de `profile.html` et se reprend avec réponses + question courante + progression intactes, chrono relancé.

**Étape 3 — QA visuelle mobile 390 px (manuelle).** Non faisable via l'outil Chrome de Claude (fenêtre bloquée à ~1372 px). À faire soi-même : DevTools → device toolbar → 390 px, sur l'accueil, `new-session`, `profile`, le tableau de réponses Cas et la fenêtre « Quitter ». Vérifier que rien ne déborde horizontalement.

**Étape 4 — déployer.** Tout vert → dire à Claude de pousser, ou : `git push origin main`. Netlify build et publie automatiquement. Vérifier ensuite en live : accueil `200`, `/api/correct` anonyme `401 AUTH_REQUIRED`.

### Lot design + UX (24–30 août 2026)

- **Logos réels** (`920e7dc`) : les 8 placeholders SVG du bandeau de confiance remplacés par les vrais wordmarks (Goldman Sachs, J.P. Morgan, Morgan Stanley, Evercore, Lazard, Rothschild & Co, Blackstone, KKR), sourcés Wikimedia Commons.
- **Refonte liquid-glass clair/sombre** (`9c6dbf9`) : système de couleurs en variables CSS avec trois états — clair par défaut sur `:root`, override `prefers-color-scheme: dark`, override explicite `[data-theme]` pour le toggle manuel persisté en `localStorage` (`assets/js/theme.js`). Topbar, hero et bandeau roadmap restent un « chrome » sombre fixe dans les deux thèmes ; le reste bascule. Script anti-FOUC inline sur les 8 pages. Corrige au passage un `.feature-grid` déclaré deux fois. Nouveau smoke `tests/theme-system-smoke.mjs`.
- **Overhaul session/cas + navigation** (`40e1b0f`) : Cas pratiques génère une narration (entreprise et chiffres aléatoires par graine) et une grille de réponses type Excel à colonnes FY ; page Session avec nav de questions repliable et espacement corrigé ; page Setup débarrassée du bandeau admin ; nouvelle page `new-session.html` (choix Questions / Cas) ; correction de `requireAuthorizedAccess()` qui prenait une session invité périmée pour une connexion valide et laissait des invités franchir le mur de login ; nav standardisée via `assets/js/nav.js`. `scripts/generate-test-history.mjs` seede un historique réaliste pour la QA.
- **Nettoyage post-audit** (`0e47fb8`, `bdd952d`, `97d1134`, `29a71f8`, `521d29a`, plan `docs/superpowers/plans/2026-08-24-audit-cleanup.md`) : accueil ne précharge plus le classeur de 2,3 Mo (`initializeApp({ loadDataset: false })`, nouveau `tests/dataset-preload-skip-smoke.mjs`) ; règle de layout `.section-head` ajoutée ; grille de thèmes à 6 cartes remise en 3 colonnes ; focus clavier visible et respect de `prefers-reduced-motion` ; CSS mort `.score-shell`/`.score-ring` supprimé.
- **Découplage classeur, pages sans corpus** (30 août) : `auth.js`, `profile.js`, `case-setup.js`, `case-session.js` passent aussi `loadDataset: false` ; `profile.html` ne charge plus le bundle `xlsx.full.min.js`. `tests/dataset-preload-skip-smoke.mjs` vérifie statiquement les 6 pages opt-out.
- **Bug dev corrigé** (30 août) : `serve-local.mjs` ne servait pas `new-session.html` (absent de `publicRootFiles`) — la page vers laquelle pointe le lien de nav « Nouvelle session » renvoyait 404 en local (la prod via `dist` n'était pas touchée). Ajout à l'allowlist + garde dans `tests/deployment-smoke.mjs` : le serveur local doit servir toutes les pages HTML racine du build.
- **QA visuelle desktop** (30 août, via l'extension Chrome) : accueil, `new-session`, `auth`, `setup`, `case-setup`, `results`, `profile` vérifiés en thème clair **et** sombre à 1440 px — rendu propre, nav cohérente, formulaires et cartes lisibles, toggle de thème fonctionnel. La brève teinte grise du fond de `profile.html` juste après le toggle est la transition CSS `background-color`, pas un bug. **QA 390 px non faite** : `resize_window` de l'extension ne réduit pas la fenêtre sous ~1372 px dans cet environnement.
- Vérification 30 août sur `main` : **27/27 smokes verts** (hors contrat HTTP loopback, non rejoué dans cette passe), `node scripts/build-static.mjs` → **39 fichiers**, `git diff --check` propre.

### Lot OpenRouter Cas pratiques (SDD, 22–23 août 2026)

- Plan `docs/superpowers/plans/2026-08-22-openrouter-cas-pratiques.md` : 8/8 tâches complétées et approuvées (ledger SDD).
- Revue finale : Critical 1/2, Important 1-7 et Minor 1/2 tous fermés, dernière vague `APPROVED_B4` (`.superpowers/sdd/2026-08-22-openrouter-cas-pratiques/final-review.md`). Commits fusionnés sur `main` : `75a7610` (frontière OpenRouter sécurisée) puis `5e43410` (fermeture des vagues B2.1, B3.1 et C — deadline complète, loader partagé à waiters indépendants, trajet local Bearer, limites chaudes, atomicité, retour auth Case, i18n des 9 cas, historique FR).
- Vérification de ce lot sur `main` fusionné : **25/25 smokes verts, y compris le contrat HTTP local en loopback** (précédemment bloqué par un sandbox, rejoué avec succès), oracle **9/9** au maximum attendu avec **10 000 graines**, build statique **34 fichiers** (39 après le lot design), syntaxe/diff/secrets verts.
- `main` fusionné et déployé en production sur Netlify (voir section Netlify ci-dessus) ; GitHub Pages retiré (`2c58dad`), site vérifié 404 après désactivation.
- Documentation resynchronisée avec l'infra réelle (`cf786da`) : `ACCES_PRIVE_GITHUB_PAGES.md` renommé `ACCES_PRIVE.md` et réécrit pour Netlify, `AUDIT_TECHNIQUE.md` marqué comme instantané historique.
- Nettoyage ponytail (audit + review, `4afd63f`) : suppression de `vercel.json`, `.nojekyll`, `serve-local.ps1`/`stop-local.ps1` (doublon Windows jamais mis à jour, sans route `/api/correct`), des deux guides `guide_ia_correction_*.md` sans référence, du prototype React `Nouveau site/` et des fichiers `.xlsx` racine dupliqués/non référencés ; suppression du code mort `buildStrengths`/`buildImprovements`/`requireCurrentUser` et des replis pré-`crypto.randomUUID`/`getRandomValues` dans `store.js` ; retrait du chargement du classeur au bootstrap de `index.html` (résultat jamais consommé, `#datasetStats` n'existe dans aucune page — voir Prochaines étapes). `docs/AUDIT_DESIGN.md` archivé (n'était jamais commité).
- Dépôt de travail déplacé hors de Google Drive vers `~/Documents/InterviewPlus` (un dossier synchronisé Drive et Git en parallèle sur le même arbre `.git` est fragile) ; l'ancien dossier Drive a été supprimé. Les documents de cas pratiques personnels (`references/cas-pratiques-a-analyser/`, jamais suivis par Git) ont été déplacés dans un dossier Drive séparé, hors du dépôt.
- QA visuelle desktop/390 px toujours non exécutée faute de navigateur automatisé disponible ; CLI Netlify absente de l'environnement de travail local (la Function tourne bien en prod, vérifié par requêtes live, mais son cold-start réel via la CLI n'a jamais été rejoué) ; aucun appel OpenRouter réel avec clé de production n'a été effectué depuis cet environnement.

## Prochaines étapes

- **QA visuelle 390 px.** Le desktop clair/sombre a été validé le 30 août (voir État d'avancement) mais pas le mobile : `resize_window` de l'extension Chrome ne descend pas sous ~1372 px ici. À faire dans un vrai navigateur redimensionnable ou via les DevTools (device toolbar), en priorité sur la nav compacte (`assets/js/mobile-nav.js`), la grille de thèmes et la grille de réponses Cas.
- **Cold start Netlify réel** via la CLI (`netlify dev`/`netlify deploy`), jamais rejoué localement faute de CLI installable dans le sandbox ; la Function est vérifiée fonctionnelle en production par requêtes live, mais pas par ce test spécifique.
- **Lot correctifs UX (30 août) — non déployé.** 6 commits sur `main` en local, non poussés. Reprendre par la checklist « Reprise — à checker avant de déployer ce lot en ligne » (section État d'avancement) : Claude réactive `node serve-local.mjs` (http://localhost:4173/), relance tests + build, puis QA visuelle des 10 parcours, puis `git push origin main`.
- **Contrat HTTP loopback** (`tests/local-correction-contract-smoke.mjs`) : non rejoué dans la passe du 30 août, à relancer dans un environnement autorisant le loopback avant le prochain merge touchant la Function.
- **Sessions payantes** : voir roadmap ci-dessous, toujours hors périmètre.

## Sessions payantes — roadmap

Le paiement est volontairement hors périmètre. L'objectif produit est de monétiser à terme l'accès aux sessions d'entraînement Questions et Cas. Avant d'ajouter un bouton ou un SDK de paiement, il faut : entitlements contrôlés côté serveur, solde de crédits atomique, checkout fournisseur, webhook signé, ledger immuable, idempotence de chaque crédit/débit, réconciliation et remboursements. La Function devra vérifier le droit à la session avant toute consommation OpenRouter.
