# Correcteur local gratuit — repli dégradé

Le correcteur local est le repli de sécurité des **questions** lorsque `POST /api/correct` ne peut pas obtenir une correction OpenRouter. Le résultat est explicitement marqué `local-degraded`; il ne remplace pas le parcours normal OpenRouter et il n'est pas utilisé pour noter les résultats numériques des cas pratiques.

Il s'exécute dans le navigateur, sans clé ni appel à un fournisseur de modèle. Il compare la réponse candidat au corrigé embarqué selon la couverture des concepts et points attendus, les formules et relations financières, la structure/le détail, et les réponses vides, hors sujet ou contradictoires. Il accepte les synonymes financiers courants FR/EN, sans imposer une copie mot à mot.

La réponse est sauvegardée avant l'appel distant. Après l'échec des modèles gratuit puis payant, le mode local donne une note et un retour réessayables ; une recorrection peut repasser par OpenRouter depuis les résultats.

Limites : moins fin pour une réponse comportementale, une formulation correcte très éloignée du corrigé, le vocabulaire absent des synonymes, le ton oral ou la présentation. Les améliorations éditoriales passent par la réponse de référence et les exceptions de mots-clés ; le format est décrit dans [docs/PROJECT.md](docs/PROJECT.md#réponse-mots-clés-et-référence).

```bash
node tests/engine-smoke.mjs
node tests/question-correction-smoke.mjs
```
