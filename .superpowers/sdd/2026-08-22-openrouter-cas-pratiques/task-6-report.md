# Task 6 report — Résultats unifiés et navigation Cas pratiques

## Résultat

- L'historique distingue les Cas pratiques avec thème, difficulté, timer, score et statut Réussi / À retravailler.
- Le détail affiche les ventilations Résultats, Méthode et Justification, chaque réponse numérique (réponse, valeur attendue, points, retour), et le retour IA facultatif sur la recommandation.
- Le lien « Refaire ce cas » conserve le thème et la difficulté; la navigation « Cas pratiques » est présente sur toutes les pages concernées et active sur les deux pages de cas.
- Les nouveaux libellés ont des paires FR/EN explicites. Aucune recherche de banque de questions n'a été ajoutée.

## TDD

- RED : `node tests/case-flow-smoke.mjs` a échoué sur `index.html misses Cas pratiques navigation` avant les liens globaux.
- RED : `node tests/case-results-dom-smoke.mjs` a échoué avant les lignes détaillées et avant le lien de reprise prérempli.
- RED : le même smoke a échoué lorsqu'une réponse effacée était rendue comme `0`; les valeurs vides sont désormais affichées `--`.
- GREEN : les deux smoke tests passent avec les détails de notation et le lien de reprise.

## Vérification

`for test_file in tests/*-smoke.mjs; do node "$test_file" || exit 1; done`, `node --check assets/js/results.js` et `git diff --check` passent tous (23 août 2026).

## Fichiers

- `assets/js/results.js`
- `assets/js/i18n.js`
- `assets/css/app.css`
- `index.html`, `auth.html`, `setup.html`, `session.html`, `results.html`, `profile.html`
- `tests/case-flow-smoke.mjs`, `tests/case-results-dom-smoke.mjs`

DONE
