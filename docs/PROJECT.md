# InterviewPlus — documentation du projet

État décrit au **23 août 2026**. Cette documentation décrit le worktree `feat/openrouter-cas-pratiques`; elle ne signifie pas que le site est déployé, que les migrations ont été appliquées ou que des secrets de production sont configurés.

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
- **Interface :** `case-setup.html` choisit thème, difficulté et durée ; `case-session.html` affiche l'énoncé après lancement ; `results.html` rend Questions et Cas. Les pages historiques restent `index.html`, `auth.html`, `setup.html`, `session.html` et `profile.html`.
- **Déploiement :** `supabase/schema.sql` porte tables/RLS/bucket ; `netlify.toml` route la Function ; `scripts/build-static.mjs` produit l'allowlist publique de 34 fichiers dans `dist`.
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
3. Ajouter les e-mails autorisés dans `public.authorized_users` avec `active = true`.
4. Configurer Auth Site URL et Redirect URLs pour local, preview et production.
5. Vérifier avec des comptes distincts que chacun ne lit/modifie que son profil, ses `session_runs` et l'objet privé autorisé.

Le schéma active RLS sur `authorized_users`, `profiles` et `session_runs`. `public.is_authorized_user()` vérifie l'e-mail JWT actif ; les policies de session imposent `auth.uid() = user_id`. Les données Case sont stockées dans les colonnes additives `session_type`, `difficulty`, `template_id`, `case_seed`, `case_json`, `score_json`, `correction_mode`, `correction_provider`, `correction_model` et dans l'enveloppe complète `session_json`.

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

## État d'avancement — 23 août 2026

- Plan `docs/superpowers/plans/2026-08-22-openrouter-cas-pratiques.md` : 8/8 tâches complétées et approuvées (ledger SDD).
- Revue finale : Critical 1/2, Important 1-7 et Minor 1/2 tous fermés, dernière vague `APPROVED_B4` (`.superpowers/sdd/2026-08-22-openrouter-cas-pratiques/final-review.md`). Commits fusionnés sur `main` : `75a7610` (frontière OpenRouter sécurisée) puis `5e43410` (fermeture des vagues B2.1, B3.1 et C — deadline complète, loader partagé à waiters indépendants, trajet local Bearer, limites chaudes, atomicité, retour auth Case, i18n des 9 cas, historique FR).
- Vérification la plus récente sur `main` fusionné : **25/25 smokes verts, y compris le contrat HTTP local en loopback** (précédemment bloqué par un sandbox, rejoué avec succès), oracle **9/9** au maximum attendu avec **10 000 graines**, build statique **34 fichiers**, syntaxe/diff/secrets verts.
- `main` fusionné et déployé en production sur Netlify (voir section Netlify ci-dessus) ; GitHub Pages retiré (`2c58dad`).
- QA visuelle desktop/390 px toujours non exécutée faute de navigateur automatisé disponible ; CLI Netlify absente de l'environnement de travail local ; aucun appel OpenRouter réel avec clé de production n'a été effectué depuis cet environnement.

## Sessions payantes — roadmap

Le paiement est volontairement hors périmètre. L'objectif produit est de monétiser à terme l'accès aux sessions d'entraînement Questions et Cas. Avant d'ajouter un bouton ou un SDK de paiement, il faut : entitlements contrôlés côté serveur, solde de crédits atomique, checkout fournisseur, webhook signé, ledger immuable, idempotence de chaque crédit/débit, réconciliation et remboursements. La Function devra vérifier le droit à la session avant toute consommation OpenRouter.
