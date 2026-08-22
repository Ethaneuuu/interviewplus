# InterviewPlus

Application web bilingue d'entraînement aux entretiens M&A : sessions de questions chronométrées et cas pratiques DCF, LBO et Merger Model. Les questions ne sont pas parcourables avant une session.

La correction de questions utilise `POST /api/correct` : OpenRouter est essayé avec `openai/gpt-oss-120b:free`, puis `openai/gpt-oss-120b`; un échec bascule le navigateur vers le correcteur `local-degraded`. Les cas sont notés numériquement par le serveur de manière déterministe ; seule une recommandation narrative optionnelle peut appeler OpenRouter.

Pour l'architecture, le contrat API, les variables Netlify/Supabase, les quotas et coûts, les templates, la sécurité et la roadmap, lire [docs/PROJECT.md](docs/PROJECT.md).

## Démarrer

```bash
node serve-local.mjs
# http://localhost:4173

netlify dev
```

`netlify dev` nécessite les variables serveur décrites dans le document projet pour charger le classeur privé et appeler OpenRouter. Ne jamais placer la service-role Supabase ou la clé OpenRouter dans `assets/js/config.js`.

## Vérifier

```bash
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

Le guide du repli local est [CORRECTION_LOCALE_GRATUITE.md](CORRECTION_LOCALE_GRATUITE.md). Le schéma Supabase est [supabase/schema.sql](supabase/schema.sql).
