# Correction locale gratuite

## Fonctionnement

InterviewPlus corrige chaque réponse directement dans le navigateur. Aucun service externe, compte, abonnement, serveur de modèle ou clé API n'est nécessaire.

Le moteur attribue une note sur 100 à partir de cinq contrôles :

1. couverture des concepts financiers attendus ;
2. présence des points importants du corrigé ;
3. cohérence des formules et des relations financières ;
4. structure et niveau de détail de la réponse ;
5. détection des réponses vides, hors sujet ou contradictoires.

Le correcteur accepte les synonymes financiers usuels en français et en anglais. Il ne demande pas une copie mot à mot du corrigé.

## Mise en ligne

La correction étant exécutée dans le navigateur, aucun réglage particulier n'est requis :

- Vercel : publier le dossier ;
- Netlify : publier le dossier ;
- GitHub Pages : publier les fichiers statiques ;
- hébergement classique : copier les fichiers du projet.

Il n'y a aucune variable secrète ni aucun coût par correction.

## Confidentialité

La réponse du candidat ne quitte pas son navigateur pour être corrigée. Elle n'est envoyée à aucun fournisseur de modèle.

Si le mode invité est utilisé, les sessions restent dans le stockage local du navigateur. Si Supabase ou le serveur InterviewPlus est activé pour les comptes, les sessions peuvent être enregistrées dans le backend configuré.

## Précision et limites

Cette méthode est fiable pour les questions techniques possédant une réponse de référence structurée, notamment les formules, définitions, passerelles de valorisation et concepts de finance.

Elle est moins fine pour :

- les réponses comportementales très personnelles ;
- les formulations très éloignées du corrigé ;
- une réponse correcte utilisant un vocabulaire totalement absent des synonymes connus ;
- l'évaluation du ton oral, de l'assurance ou de la qualité de présentation.

Pour améliorer la précision sans coût, enrichir dans le classeur les colonnes de réponse attendue, éléments clés, concept critique et barème. Ajouter de nouveaux synonymes dans la liste `financeConcepts` de `assets/js/store.js` améliore également la reconnaissance.

## Test

```bash
node tests/engine-smoke.mjs
```

Le test vérifie notamment les 3 482 questions bilingues, la notation des réponses de référence, le rejet des réponses sans effort, la persistance et l'absence d'appel à un service de correction externe.
