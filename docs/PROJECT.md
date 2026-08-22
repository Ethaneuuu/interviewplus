# InterviewPlus — exploitation

Ce document décrit le code présent dans ce dépôt. Il ne prouve ni ne suppose qu'un site est déployé, qu'une clé est configurée, ou qu'un compte fournisseur est crédité.

## Architecture

```text
Navigateur (HTML/CSS/JS natifs)
  ├─ Questions : sélection locale → réponses sauvegardées → POST /api/correct
  ├─ Cas pratiques : template + graine → réponses sauvegardées → POST /api/correct
  └─ Supabase : Auth, sessions et classeur privé pour les utilisateurs autorisés
                                      │
Netlify Function `correct` ───────────┤
  ├─ questions : référence privée + OpenRouter (gratuit, puis payant)
  └─ case : corrigé numérique déterministe, OpenRouter seulement pour la recommandation
```

Le navigateur ne reçoit ni `OPENROUTER_API_KEY`, ni `SUPABASE_SERVICE_ROLE_KEY`, ni le corrigé numérique intégral du cas **avant soumission**. Il persiste une réponse avant tout appel réseau : un échec laisse un brouillon réessayable. Après correction, la réponse de cas retourne les valeurs attendues, crédits et tolérances des champs demandés ; le navigateur les enregistre et les affiche pour l'entraînement. Le seul endpoint applicatif public de cette version est `POST /api/correct`.

## Stack et carte des fichiers

- HTML, CSS et ES modules natifs ; aucune dépendance ou framework front ajouté.
- `assets/js/store.js` orchestre les sessions, le stockage local, le repli local et la persistance distante ; `backend.js` adapte Supabase ou le serveur local ; `correction-client.js` appelle l'API.
- `assets/js/keywords.js` extrait les concepts ; `keyword-overrides.js` porte les exceptions éditoriales ; `case-templates.js` fabrique les énoncés déterministes.
- `netlify/functions/correct.mjs` est le handler ; `lib/correction-service.mjs` valide et route ; `question-bank.mjs` lit le classeur privé ; `case-grader.mjs` calcule et note.
- `supabase/schema.sql` crée les tables, le bucket et les policies ; `netlify.toml` publie `dist` et redirige `/api/correct` ; `scripts/build-static.mjs` produit `dist` sans sources privées.
- Pages : `index.html`, `auth.html`, `setup.html`, `session.html`, `results.html`, `profile.html`, `case-setup.html` et `case-session.html`.

## Flux de données

### Questions

La banque n'est pas navigable depuis l'UI. Au lancement, le navigateur charge le classeur selon le mode choisi et sélectionne la session. À la correction, il envoie seulement `questionId`, `language` et `answer`. La Function charge en mémoire chaude le classeur Supabase privé, reconstruit la question, la réponse de référence et les mots-clés, puis demande un JSON strict à OpenRouter. Une réponse OpenRouter invalide, une erreur HTTP ou une limite fait essayer le modèle payant. Si les deux échouent, le client conserve ses réponses et applique le correcteur navigateur : son résultat est marqué `local-degraded`. Une recorrection est possible depuis les résultats.

### Cas pratiques

`theme`, `difficulty` et `seed` déterminent intégralement l'énoncé. DCF, LBO et Merger Model ont les niveaux `easy`, `intermediate` et `advanced` ; un thème conserve ses livrables principaux à chaque niveau et ajoute des sorties de méthode aux niveaux suivants. Le serveur régénère l'énoncé et le corrigé à partir de la graine, compare chaque valeur à sa tolérance, et donne un crédit intermédiaire. Résultats, méthode et, lorsqu'elle existe, justification composent la note ; le seuil de réussite est 70. Une recommandation narrative n'est demandée aujourd'hui que par le Merger Model avancé et vaut au plus 5 %. Son indisponibilité ne bloque pas la note numérique : le mode reste `deterministic` avec `narrativeStatus: "unavailable"`.

## `POST /api/correct`

Méthode obligatoire : `POST`, `Content-Type: application/json`. Les autres méthodes retournent `405 {"error":"METHOD_NOT_ALLOWED"}` ; un JSON invalide retourne `400 {"error":"INVALID_JSON"}`.

### Requête `questions`

```json
{
  "type": "questions",
  "sessionId": "optional-client-id",
  "items": [{ "questionId": "1", "language": "fr", "answer": "Le WACC…" }]
}
```

`items` contient 1 à 20 identifiants uniques ; chaque réponse est une chaîne d'au plus 8 000 caractères. `sessionId` n'est pas utilisé par le serveur. Une réussite retourne :

```json
{
  "score": 78,
  "mode": "openrouter",
  "provider": "openrouter",
  "model": "openai/gpt-oss-120b:free",
  "items": [{ "questionId": "1", "score": 78, "recognizedConcepts": ["WACC"], "missingElements": ["…"], "feedback": "…" }]
}
```

Chaque score est borné de 0 à 100 et chaque identifiant demandé doit revenir exactement une fois. Erreurs de validation `400` : `INVALID_CORRECTION_TYPE`, `INVALID_CORRECTION_ITEMS`, `INVALID_CORRECTION_ITEM`, `TOO_MANY_ITEMS`, `ANSWER_TOO_LONG`, `UNKNOWN_QUESTION`. Après les deux modèles indisponibles, la Function retourne `502 {"error":"OPENROUTER_UNAVAILABLE"}` ; le navigateur déclenche alors `local-degraded`. Toute autre erreur serveur est `500 {"error":"INTERNAL_ERROR"}`.

### Requête `case`

```json
{
  "type": "case",
  "theme": "dcf",
  "difficulty": "intermediate",
  "seed": 12345,
  "answers": { "enterprise_value": 1234.5 },
  "recommendation": "optional, only when the statement requests it"
}
```

`theme` vaut `dcf`, `lbo` ou `merger-model`; `difficulty` vaut `easy`, `intermediate` ou `advanced`; `seed` est un entier de 0 à 4 294 967 295. `answers` ne peut contenir que les champs de l'énoncé (au plus 80), avec un nombre fini ou `""`. La recommandation est une chaîne d'au plus 2 000 caractères et n'est recevable que si le template la demande.

```json
{
  "score": 78.25,
  "passed": true,
  "breakdown": { "results": 80, "method": 75, "justification": 0 },
  "items": [{ "id": "enterprise_value", "category": "results", "credit": 1, "score": 1234.5, "tolerance": 1 }],
  "statement": { "templateId": "dcf-intermediate-v1" },
  "mode": "deterministic"
}
```

Avec une recommandation notée, la réponse ajoute `mode: "openrouter"`, `provider`, `model`, `narrativeStatus: "scored"` et `feedback`. Les erreurs de validation `400` supplémentaires sont `INVALID_CASE_THEME`, `INVALID_CASE_DIFFICULTY`, `INVALID_CASE_SEED`, `INVALID_CASE_ANSWERS`, `TOO_MANY_CASE_ANSWERS`, `INVALID_CASE_ANSWER` et `INVALID_CASE_RECOMMENDATION`.

## Lancer, tester et diagnostiquer

Le serveur local lit le classeur du dépôt et réutilise le même service ; il ne reproduit pas l'authentification Netlify.

```bash
node serve-local.mjs
# http://localhost:4173

netlify dev

node tests/keywords-smoke.mjs
node tests/correction-api-smoke.mjs
node tests/question-correction-smoke.mjs
node tests/case-engine-smoke.mjs
node tests/case-flow-smoke.mjs
node tests/deployment-smoke.mjs
node tests/engine-smoke.mjs
node tests/restricted-access-smoke.mjs
git diff --check
```

`OPENROUTER_UNAVAILABLE` signifie que les deux appels modèle ont échoué ; vérifiez clé, crédits et limites avant de réessayer. Les erreurs `INVALID_CASE_*` et `INVALID_CORRECTION_*` sont des contrats client à corriger, pas des erreurs à masquer. Les diagnostics internes ne sont pas exposés par l'API : la Function écrit uniquement `INTERVIEWPLUS_CORRECTION_ERROR` suivi d'un code stable dans les **Netlify Function logs**. `PRIVATE_QUESTION_FILE_UNAVAILABLE` indique un classeur privé inaccessible ; `QUESTION_BANK_ERROR` indique une feuille absente, une réponse vide, un doublon ou un compte autre que 3 482 ; `CORRECTION_INTERNAL_ERROR` couvre les autres erreurs. Ces logs ne contiennent ni prompt, ni réponse candidat, ni référence, ni clé.

## Netlify

`netlify.toml` exécute `node scripts/build-static.mjs`, publie `dist`, bundle SheetJS pour la Function et redirige `/api/correct`. Dans les variables d'environnement de site, définir les valeurs serveur suivantes, sans les copier dans `assets/js/config.js` ou `assets/js/config.example.js` :

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret serveur>
PRIVATE_QUESTION_BUCKET=interviewplus-private
PRIVATE_QUESTION_PATH=Questions_InterviewPlus_Bilingual.xlsx
OPENROUTER_API_KEY=<secret serveur>
OPENROUTER_FREE_MODEL=openai/gpt-oss-120b:free
OPENROUTER_PAID_MODEL=openai/gpt-oss-120b
```

Les deux noms de bucket, chemin et modèles ont des valeurs par défaut, mais les secrets et `SUPABASE_URL` sont requis en production. Prévisualiser avec `netlify dev`; construire hors ligne avec `netlify build --offline` si la CLI est installée. Connecter ensuite le dépôt et configurer les variables dans Netlify avant tout déploiement ; ce dépôt ne contient ni clé ni déclaration d'environnement déployé.

## Supabase

1. Exécuter `supabase/schema.sql` dans le SQL Editor.
2. Créer/remplir le bucket privé `interviewplus-private` avec `Questions_InterviewPlus_Bilingual.xlsx` ; la migration le rend non public.
3. Configurer dans Auth la Site URL et les Redirect URLs exactes des environnements local et Netlify.
4. Configurer seulement `supabaseUrl` et `supabaseAnonKey` côté navigateur, puis le mode voulu dans `assets/js/config.js` (voir `config.example.js`). La clé anon est publique par conception, la service-role ne l'est jamais.
5. Vérifier en tant qu'utilisateur autorisé que son profil et ses propres `session_runs` sont accessibles ; vérifier qu'un utilisateur non autorisé, un autre utilisateur, et `anon` ne peuvent pas lire les objets ou sessions concernés.

Le schéma applique RLS à `profiles`, `session_runs`, `authorized_users` et au bucket. `public.is_authorized_user()` vérifie l'e-mail JWT dans `authorized_users`; les policies de `session_runs` imposent `auth.uid() = user_id`. Les colonnes de session des cas sont `session_type`, `difficulty`, `template_id`, `case_seed`, `case_json`, `score_json`, `correction_mode`, `correction_provider` et `correction_model`.

## Réponse, mots-clés et référence

La référence n'est jamais fournie par le client : le loader lit `EN_QA_FINAL` et `FR_QR`, clé `"<langue>:<id>"`, exige 3 482 réponses et ne garde que question, réponse de référence et mots-clés. Les mots-clés proviennent de la réponse type normalisée. Une exception ciblée se déclare dans `assets/js/keyword-overrides.js` :

```js
export const KEYWORD_OVERRIDES = Object.freeze({
  "en:42": { add: ["enterprise value"], remove: ["terminal"], replace: ["wacc", "free cash flow"] },
});
```

`replace` prévaut sur l'extraction ; sinon `add` et `remove` complètent/retirent les concepts. Il n'existe pas de fichier de banque compilé : le cache de Function se reconstruit au prochain démarrage. Pour vérifier/reconstruire ce cache depuis le classeur actuel :

```bash
node -e "const fs=require('node:fs'); import('./netlify/functions/lib/question-bank.mjs').then(async ({createQuestionBankLoader})=>{const bank=await createQuestionBankLoader({workbookBytes:fs.readFileSync('Questions_InterviewPlus_Bilingual.xlsx')})(); if(bank.size!==3482) process.exit(1); console.log(bank.size)})"
```

## Créer un template

Ajouter un quatrième thème est une modification de code, pas un éditeur UI : ajouter le thème dans `CASE_THEMES`, ses sorties principales dans `CORE_OUTPUTS`, ses sorties de méthode par niveau dans `METHOD_OUTPUTS`, ses entrées réalistes dans `publicInputs`, puis sa formule dans `case-grader.mjs`. Conserver un seul template versionné par thème/niveau (`<theme>-<difficulty>-v1`), les mêmes `coreOutputIds` entre niveaux, et des modules intermédiaires croissants. La graine doit toujours produire la même instance ; les données doivent respecter les contraintes financières avant affichage. Chaque champ précise poids, format et une tolérance **absolue** : une valeur dans la tolérance reçoit tout le crédit ; au-delà et jusqu'à `2 × tolerance`, elle reçoit un demi-crédit. Les tolérances relatives exigent un type explicite et une branche de calcul avant d'être documentées ou utilisées. Ajouter les libellés i18n et les smoke tests de reproductibilité, contraintes, crédit intermédiaire et parcours.

## OpenRouter — Coûts et quotas

Ordre serveur : `openai/gpt-oss-120b:free`, puis `openai/gpt-oss-120b`; pour les questions, l'échec des deux mène au mode navigateur `local-degraded`. Pour un cas, le calcul déterministe reste disponible si la partie narrative ne l'est pas. Aucun sélecteur de modèle n'est exposé au candidat.

Au **23 août 2026**, la page modèle affiche pour `openai/gpt-oss-120b` 0,03 USD/M tokens en entrée et 0,17 USD/M en sortie. À l'hypothèse de 1 000 tokens d'entrée et 300 en sortie, cela fait `1,000 × (1,000 × 0.03 / 1,000,000 + 300 × 0.17 / 1,000,000) = 0.081 USD` pour 1 000 corrections. C'est une hypothèse de planification, pas un plafond : vérifier prix, modèles et limites avant exploitation sur les pages officielles [modèle](https://openrouter.ai/openai/gpt-oss-120b) et [limites](https://openrouter.ai/docs/api-reference/limits).

Une clé peut avoir un plafond et un suivi propres (`GET /api/v1/key` : `limit_remaining`, usages), mais OpenRouter gouverne la capacité globalement : multiplier les clés ou les comptes ne contourne pas les limites de débit. Le solde et les crédits du compte/workspace restent la source partagée des dépenses ; la limite de clé est seulement un garde-fou. Surveiller aussi les erreurs 402/429 et les données `usage` renvoyées par OpenRouter ([usage accounting](https://openrouter.ai/docs/use-cases/usage-accounting)). Ce budget est distinct d'un abonnement ChatGPT et de la facturation directe OpenAI ; il ne se mélange à eux qu'en cas de configuration explicite BYOK.

## Sécurité et maintenance

- Ne jamais journaliser une clé, une réponse complète ou une référence de correction ; faire tourner immédiatement une clé exposée.
- Ne publier ni le classeur, ni `keyword-overrides.js`, ni `netlify/`, `supabase/`, `tests/` ou `docs/` : le build vérifie cette exclusion.
- Garder RLS activé après toute migration, tester les trois rôles d'accès, et limiter les variables de service à Netlify.
- Mettre à jour les prix, limites et modèles avant chaque ouverture significative ; suivre taux d'échec, modes réellement utilisés et coût par correction.
- Exécuter la suite ci-dessus avant une version. Les tests ne nécessitent aucun appel OpenRouter réel ; les réponses y sont simulées.

## Sessions payantes — roadmap

Le paiement est hors périmètre. Avant de le construire, définir des entitlements côté serveur, un solde de crédits atomique, un checkout fournisseur, un webhook vérifié qui alimente un ledger immuable, et une clé d'idempotence à chaque crédit/débit. Le droit d'effectuer une correction devra être contrôlé dans la Function avant OpenRouter, avec réconciliation du ledger et gestion des remboursements. Ne pas ajouter un bouton, SDK de paiement ou table de facturation tant que ces règles métier et le fournisseur ne sont pas décidés.
