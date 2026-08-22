# InterviewPlus — correction OpenRouter et cas pratiques

Date : 22 août 2026  
Statut : design validé

## 1. Objectif

InterviewPlus doit proposer deux parcours d'entraînement distincts :

1. les sessions de questions d'entretien existantes ;
2. une page autonome **Cas pratiques** pour s'entraîner au DCF, au LBO et au Merger Model.

Les questions existantes restent toutes dans leur base actuelle. L'utilisateur ne peut ni parcourir ni rechercher la banque avant de lancer une session. Les exercices de modélisation constituent un parcours séparé et ne sont pas transformés en questions classiques.

À terme, ces deux parcours pourront être monétisés sous forme de sessions payantes. La facturation utilisateur et le paiement sont documentés comme évolution, mais exclus de cette version.

## 2. Principes produit validés

- La page et la navigation utilisent le terme **Cas pratiques**, jamais « paper pratique ».
- Avant un cas, l'utilisateur choisit uniquement le thème, la difficulté et le temps.
- Une phrase d'introduction explique que la répétition de cas chronométrés développe les automatismes, la rigueur et la capacité à justifier une recommandation en entretien.
- L'énoncé et les champs de réponse apparaissent seulement après le lancement.
- La validation lance immédiatement la correction, sans récapitulatif ni délai de dix secondes.
- Les niveaux d'un même thème demandent les mêmes livrables principaux. La difficulté augmente par les données à dériver, les paramètres supplémentaires et les contraintes à intégrer.

## 3. Architecture retenue

L'application reste en HTML, CSS et JavaScript natifs. Les pages existantes, `assets/js/backend.js`, le stockage local et Supabase sont réutilisés. Aucun framework ni dépendance front supplémentaire n'est requis.

Une Netlify Function reçoit les demandes de correction. Elle protège la clé OpenRouter, valide les entrées et orchestre les modes de correction. Le navigateur ne reçoit jamais la clé, le corrigé numérique complet ni les instructions internes du correcteur.

```text
Navigateur
  ├── Session de questions ──┐
  └── Cas pratique ──────────┼── POST /api/correct
                             │       ├── correction OpenRouter
                             │       └── correction numérique déterministe
                             └── Supabase : sessions et résultats
```

Le choix est volontairement minimal : une fonction, un point d'entrée et deux branches métier explicites. Une architecture de services séparés ne sera envisagée que si le volume ou les règles de sécurité l'exigent.

## 4. Parcours « Questions »

Le parcours existant conserve le choix du thème, du nombre de questions et du temps. Il ne propose pas d'explorateur de la banque.

### Correction

Pour chaque réponse, OpenRouter reçoit :

- la question ;
- la réponse du candidat ;
- les mots-clés attendus ;
- la réponse type.

Le modèle évalue l'ensemble de ces éléments et renvoie :

- un pourcentage de pertinence de 0 à 100 ;
- les concepts reconnus ;
- les éléments manquants ou inexacts ;
- un retour court et actionnable.

Il n'existe pas de pondération arbitraire fixe entre la réponse type et les mots-clés. Le modèle doit vérifier à la fois la couverture des concepts attendus et la justesse globale de la réponse. Le score final est borné et le format de sortie est validé côté serveur.

### Mots-clés

Les mots-clés servent de concepts attendus pour la correction, pas de commandes conversationnelles.

Ils sont obtenus en deux couches :

1. extraction automatique depuis la réponse type existante ;
2. fichier d'exception manuel pour ajouter, retirer ou remplacer les concepts des questions qui le nécessitent.

Cette structure évite de maintenir manuellement plusieurs milliers de lignes tout en gardant un contrôle éditorial ciblé.

### Modèles et repli

Ordre prévu :

1. `openai/gpt-oss-120b:free` ;
2. `openai/gpt-oss-120b` si le modèle gratuit est indisponible ou limité ;
3. correcteur local existant, signalé dans le résultat comme **mode dégradé**.

La page de résultats permet de relancer une correction OpenRouter. L'interface n'affiche pas de sélecteur de fournisseur : le choix du modèle est une décision serveur.

## 5. Parcours « Cas pratiques »

### Écran de configuration

La page autonome propose :

- thème : DCF, LBO ou Merger Model ;
- difficulté : facile, intermédiaire ou avancée ;
- durée.

Le lancement crée une instance déterministe du template sélectionné. Un même identifiant de template et une même graine reproduisent exactement l'énoncé, les données et le corrigé.

### Écran de session

Le cas est réalisé dans un formulaire numérique dans le navigateur. Le nombre de champs découle du template et de ses modules ; il n'est pas demandé à l'utilisateur avant la session.

Les livrables principaux sont identiques entre les niveaux d'un même thème. Les niveaux supérieurs demandent davantage d'étapes intermédiaires. Une recommandation narrative courte n'est affichée que lorsque le template source l'exige.

### Correction

Les résultats numériques sont corrigés côté serveur avec :

- une valeur attendue ;
- une tolérance absolue ou relative ;
- un poids par réponse ;
- un score séparant résultats, méthode et justification lorsque ces éléments sont demandés.

Les calculs intermédiaires permettent d'attribuer des points même si une erreur se propage jusqu'au résultat final. Les pondérations sont normalisées pour rendre les scores comparables entre niveaux.

La recommandation narrative optionnelle peut être évaluée par OpenRouter à faible poids. Le modèle reçoit l'énoncé, les résultats calculés, la réponse du candidat et la grille attendue. Il ne doit pas corriger les résultats numériques.

## 6. Progression des difficultés

Règle commune : **ce qui est fourni au niveau facile est calculé au niveau intermédiaire, puis construit et soumis à des contraintes au niveau avancé**.

### DCF

Livrables communs : UFCF annuels et actualisés, valeur terminale, Enterprise Value, Equity Value, valeur par action et sensibilité.

| Élément | Facile | Intermédiaire | Avancé |
|---|---|---|---|
| Prévisions | Chiffre d'affaires et EBIT/EBITDA fournis | Croissance, marges, D&A, CapEx et BFR à appliquer | Prévisions par segment et scénarios |
| UFCF | Donnés ou calcul direct | Construction depuis l'EBIT | Construction par scénario avec contraintes opérationnelles |
| WACC | Fourni | Variables fournies : taux sans risque, bêta, prime de risque, coût de la dette, impôt, structure du capital | Désendettement/réendettement des bêtas et structure cible |
| Valeur terminale | Méthode et paramètres fournis | Deux méthodes à calculer | Deux méthodes à comparer et contrôler par les comparables |
| Actualisation | Annuelle | Mid-year convention fournie | Stub period et convention à déterminer |
| Sensibilité | Plages fournies | WACC/croissance et WACC/multiple | Scénarios opérationnels croisés avec la valorisation |

### LBO

Livrables communs : Enterprise Value et Equity Value d'entrée, sources et emplois, cash-flow de remboursement, dette annuelle, valeur de sortie, MoM, IRR et sensibilité/création de valeur.

| Élément | Facile | Intermédiaire | Avancé |
|---|---|---|---|
| Opérations | EBITDA et cash-flow fournis | Compte de résultat et cash-flow à projeter | Trois états financiers et scénarios intégrés |
| Dette | Une tranche, remboursement simple | Plusieurs tranches, amortissement, trésorerie minimale et revolver | PIK, cash sweep, call premium et contraintes de crédit |
| Transaction | Multiples d'entrée/sortie fournis | Sources/emplois détaillés et management pool | PPA, rollover, earnout et instruments actionnaires |
| Fiscalité | Taux d'impôt simple | NOL et déductibilité courante | Fiscalité intégrée aux états financiers |
| Rendements | Sponsor MoM/IRR | Sponsor et management | Waterfall sponsor/management et attribution de création de valeur |

### Merger Model

Livrables communs : prix d'offre et Enterprise Value d'acquisition, financement cash/dette/actions, nouvelles actions, résultat net et EPS pro forma, accrétion/dilution en valeur et en pourcentage.

| Élément | Facile | Intermédiaire | Avancé |
|---|---|---|---|
| Données | Prix, mix, résultats nets et actions fournis | Prime et mix à reconstruire sous contraintes | Prévisions complètes de l'acquéreur et de la cible |
| Financement | Intérêt et synergies simples | Frais, dette et contraintes de mix | Trésorerie minimale, levier maximal et prix compétitif |
| PPA | Ajustements minimaux fournis | Immobilisations, incorporels et amortissement | Goodwill, DTL, write-offs et bilan combiné complet |
| Synergies | Montant annuel fourni | Synergies et coûts d'intégration | Montée en puissance, coûts ponctuels et NPV des synergies |
| Résultat | Accrétion/dilution sur un an | Accrétion/dilution détaillée | Accrétion/dilution pluriannuelle et recommandation |

## 7. Templates et génération des chiffres

Il existe un template de base par thème, complété par des modules de difficulté. Il n'existe pas neuf exercices indépendants.

Chaque template contient :

- des plages réalistes de génération ;
- des relations entre variables ;
- des contraintes de cohérence ;
- les formules du corrigé ;
- les champs visibles par niveau ;
- les tolérances et pondérations.

Le générateur utilise une graine et rejette toute instance incohérente, par exemple une dette impossible à rembourser, un WACC hors plage raisonnable ou un financement dépassant les contraintes annoncées.

Les rapports annuels et mémorandums du corpus servent à calibrer des données réalistes. Les tests, corrigés et supports de formation déterminent les étapes, livrables et niveaux. Les fichiers sources ne sont pas copiés dans le bundle public.

## 8. API

### `POST /api/correct`

Requête commune :

```json
{
  "type": "questions",
  "sessionId": "uuid",
  "items": []
}
```

`type` accepte `questions` ou `case`.

Pour `questions`, chaque item contient l'identifiant de la question et la réponse du candidat. La fonction récupère ou reconstruit les attentes côté serveur, appelle OpenRouter et renvoie le score ainsi que le retour structuré.

Pour `case`, la requête contient le template, la graine, le niveau et les réponses. La fonction reconstruit le corrigé déterministe, applique les tolérances et appelle OpenRouter uniquement si une justification narrative est prévue.

La fonction refuse les types inconnus, les sessions trop volumineuses, les réponses mal formées et les identifiants de template invalides. Les erreurs fournisseur n'effacent jamais les réponses de l'utilisateur.

Réponse minimale :

```json
{
  "score": 78,
  "mode": "openrouter",
  "model": "openai/gpt-oss-120b:free",
  "items": []
}
```

`mode` vaut `openrouter`, `deterministic` ou `local-degraded`.

## 9. Données Supabase

La table de sessions existante est étendue plutôt que dupliquée. Les nouveaux champs couvrent :

- le type de session ;
- le niveau, l'identifiant du template et la graine pour un cas ;
- les réponses et le détail du score ;
- le mode, le fournisseur et le modèle de correction.

Les règles RLS existantes restent la base : un utilisateur authentifié ne lit et ne modifie que ses propres sessions. Les secrets OpenRouter sont exclusivement des variables d'environnement Netlify.

## 10. Déploiement et consommation OpenRouter

Netlify sert les fichiers statiques et la Function. Supabase conserve l'authentification, l'historique et les politiques RLS.

Variables serveur prévues :

- `OPENROUTER_API_KEY` ;
- `OPENROUTER_FREE_MODEL=openai/gpt-oss-120b:free` ;
- `OPENROUTER_PAID_MODEL=openai/gpt-oss-120b`.

Les appels effectués avec plusieurs clés d'un même compte ou workspace OpenRouter consomment les mêmes crédits globaux, même si OpenRouter permet le suivi et une limite de dépense par clé. Cette consommation est séparée d'un abonnement ChatGPT et de la facturation directe OpenAI, sauf configuration BYOK explicite.

Au 22 août 2026, le modèle payant retenu est affiché par OpenRouter à 0,03 USD par million de tokens d'entrée et 0,17 USD par million de tokens de sortie. Avec une hypothèse de 1 000 tokens d'entrée et 300 tokens de sortie, 1 000 corrections coûtent environ 0,081 USD. Les limites du modèle gratuit restent dépendantes des règles OpenRouter en vigueur et doivent être surveillées côté exploitation.

Références officielles :

- <https://openrouter.ai/openai/gpt-oss-120b>
- <https://openrouter.ai/docs/api-reference/limits>
- <https://openrouter.ai/docs/use-cases/usage-accounting>

## 11. Documentation à livrer avec l'implémentation

La documentation projet devra couvrir :

- architecture et flux des deux parcours ;
- stack et responsabilités des fichiers ;
- contrat de `POST /api/correct` ;
- configuration locale, Netlify, Supabase et OpenRouter ;
- quota, suivi des coûts et modes de repli ;
- ajout d'exceptions de mots-clés et création d'un nouveau template de cas ;
- évolution envisagée vers des sessions payantes, sans implémenter de paiement.

## 12. Gestion des erreurs

- Une réponse utilisateur est enregistrée localement avant l'appel réseau.
- Une erreur OpenRouter déclenche le modèle payant, puis le correcteur local dégradé pour les questions.
- Une erreur de correction narrative n'empêche pas la note numérique d'un cas.
- Une instance de cas incohérente est rejetée avant affichage et régénérée avec une nouvelle graine.
- Le résultat précise toujours le mode de correction réellement utilisé.

## 13. Vérification

Les contrôles minimaux à automatiser sont :

1. extraction des mots-clés et priorité des exceptions manuelles ;
2. validation stricte de la réponse OpenRouter et ordre des replis ;
3. reproductibilité des cas par graine et respect des contraintes ;
4. même contrat de livrables entre les niveaux, avec activation correcte des modules ;
5. pondérations, tolérances, crédit des étapes intermédiaires et parcours complet jusqu'au résultat.

Les tests existants restent exécutés. Les nouveaux tests utilisent le moteur JavaScript sans appel réseau réel ; OpenRouter est simulé par une réponse JSON contrôlée.

## 14. Hors périmètre

- navigation ou recherche libre dans la banque de questions avant une session ;
- suppression ou reclassement des 3 482 questions existantes ;
- import d'un modèle Excel par l'utilisateur ;
- reproduction exacte des fichiers sources ou distribution du corpus ;
- paiement, abonnements et portefeuille de crédits utilisateur ;
- éditeur générique de templates dans l'interface.
