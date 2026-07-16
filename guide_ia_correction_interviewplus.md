# Guide d'utilisation du fichier InterviewPlus pour une IA de correction

## 1. Objectif

Ce document décrit la logique à appliquer pour corriger automatiquement les réponses de candidats à des questions d'entretien en M&A, Corporate Finance et Investment Banking.

Le fichier Excel de référence contient une base anglaise consolidée de **1 741 questions-réponses**. Il ne doit pas être utilisé comme un corrigé à comparer mot à mot. L'IA doit évaluer la compréhension du candidat, l'exactitude technique de sa réponse et sa capacité à répondre de façon claire et crédible dans un véritable entretien.

Trois fonctions doivent être distinguées :

1. **Correction** : analyser la réponse du candidat et identifier ses forces, ses erreurs et ses omissions.
2. **Évaluation** : attribuer une note cohérente, justifiée et comparable entre les tentatives.
3. **Refresh** : actualiser les informations nécessaires pour les questions dépendantes du contexte de marché, d'une transaction récente, d'un secteur ou d'une banque précise.

---

## 2. Structure du fichier Excel

### `EN_QA_FINAL`

Feuille principale à importer dans le simulateur.

Elle contient les **1 741 paires question-réponse** exploitables. Chaque ligne correspond à une seule question d'entretien.

| Colonne | Rôle |
|---|---|
| `#` | Identifiant final unique de la question. Utiliser cet identifiant dans le site. |
| `Category` | Grande catégorie de la question. |
| `Subcategory` | Sous-catégorie utilisée pour filtrer les questions et analyser la progression. |
| `Question` | Question à afficher au candidat. |
| `Answer` | Réponse de référence ou grille de réponse attendue. |
| `Document` | Document source utilisé pour la traçabilité. |
| `Page` | Page du document source. |
| `Original ID` | Identifiant historique avant consolidation. |
| `Original major section` | Section source générale. |
| `Original section` | Sous-section source. |
| `Answer origin` | Indique si la réponse provient du document source ou a été créée pour compléter la base. |
| `Refresh before interview` | `Yes` lorsque la question doit être actualisée avant utilisation, sinon `No`. |

### `DYNAMIC_REFRESH_GUIDE`

Sous-ensemble des **53 questions dynamiques** qui exigent une mise à jour avant utilisation.

| Colonne | Rôle |
|---|---|
| `Final #` | Identifiant de la question dans `EN_QA_FINAL`. |
| `Category` | Catégorie de la question. |
| `Subcategory` | Sous-catégorie de la question. |
| `Question` | Question à actualiser. |
| `Update guidance` | Nature de la mise à jour à réaliser. |

### `AUDIT_DECISIONS`

Journal de traçabilité. Cette feuille contient les lignes supprimées de la base de production, avec la raison de leur exclusion.

**Ne jamais importer cette feuille dans le simulateur.** Elle sert uniquement à comprendre les décisions de nettoyage.

### `TAXONOMY_EN`

Synthèse du nombre de questions par catégorie et sous-catégorie. Elle peut être utilisée pour construire les filtres du site et les tableaux de progression.

### `README` et `CHANGELOG`

Feuilles informatives destinées au suivi interne. Elles ne sont pas nécessaires pour corriger une réponse candidat.

---

## 3. Règle fondamentale

L'IA doit juger le **sens**, pas la similarité littérale avec la réponse de référence.

La colonne `Answer` est une base de connaissance et une grille de contrôle. Elle permet de déterminer les éléments importants, les liens logiques attendus, les erreurs à éviter et le niveau de précision souhaitable.

Une bonne réponse candidat peut être différente de la réponse de référence tout en étant correcte.

L'IA doit accepter :

- les synonymes ;
- les formulations équivalentes ;
- une structure différente si elle reste claire ;
- une réponse concise lorsqu'elle couvre les éléments indispensables ;
- des exemples personnels pertinents pour les questions fit ;
- des chiffres récents différents de ceux d'une ancienne réponse source, à condition qu'ils soient cohérents et datés.

L'IA doit pénaliser :

- les erreurs techniques ;
- les contradictions ;
- les réponses hors sujet ;
- les affirmations inventées ;
- les chiffres présentés comme exacts sans base fiable ;
- la récitation de mots-clés sans raisonnement ;
- les réponses trop vagues pour être crédibles en entretien.

---

## 4. Workflow de correction d'une réponse candidat

Pour chaque tentative, appliquer les étapes suivantes.

### Étape 1 : charger la bonne ligne

Utiliser l'identifiant final `#` de la feuille `EN_QA_FINAL`.

Ne pas utiliser la recherche sémantique comme méthode principale lorsque l'identifiant est disponible. La recherche sémantique peut uniquement servir de solution de secours pour retrouver une ancienne question ou traiter une importation historique.

### Étape 2 : identifier le type de question

Lire `Category` et `Subcategory`.

Les principales familles sont :

- `Behavioral / Fit`
- `Technical`
- `Deal Process / Transaction Experience`
- `Markets / Investing`
- `Industry Specific`
- `Brain Teaser / Creative`

Le niveau de sévérité et les critères secondaires doivent être adaptés au type de question.

### Étape 3 : vérifier si un refresh est nécessaire

Lire la colonne `Refresh before interview`.

- Si la valeur est `No`, utiliser la réponse de référence comme grille evergreen.
- Si la valeur est `Yes`, vérifier qu'un contexte actualisé a été généré récemment avant d'évaluer les affirmations factuelles du candidat.

Le refresh ne remplace pas la réponse de référence. Il ajoute un contexte temporaire daté.

### Étape 4 : analyser la réponse du candidat

L'analyse doit distinguer :

1. les éléments correctement couverts ;
2. les éléments manquants ;
3. les erreurs techniques ;
4. les contradictions ;
5. les affirmations non vérifiables ou inventées ;
6. la qualité de la structure ;
7. le niveau de précision ;
8. la qualité de la communication.

### Étape 5 : calculer le score

Attribuer une note sur 100 en appliquant le barème principal et les éventuels plafonnements.

### Étape 6 : générer un feedback actionnable

Le feedback doit expliquer :

- ce qui est correct ;
- l'amélioration prioritaire ;
- les éléments manquants les plus importants ;
- les erreurs techniques à corriger ;
- un conseil concret pour produire une meilleure réponse.

Le feedback ne doit pas être inutilement long. Il doit aider le candidat à améliorer sa prochaine tentative.

---

## 5. Barème principal sur 100 points

| Critère | Pondération | Description |
|---|---:|---|
| Pertinence et couverture des éléments clés | 40 pts | La réponse traite précisément la question et couvre les idées indispensables. |
| Exactitude technique | 30 pts | Les concepts, formules et liens de causalité sont corrects. |
| Structure et logique | 15 pts | La réponse suit un raisonnement compréhensible et bien organisé. |
| Profondeur et précision | 10 pts | La réponse apporte le niveau de détail adapté à la difficulté de la question. |
| Communication professionnelle | 5 pts | La réponse est claire, synthétique et crédible à l'oral. |

Total : **100 points**.

### Interprétation du score

| Score | Niveau | Interprétation |
|---:|---|---|
| 90 à 100 | Excellent | Réponse complète, exacte, structurée et crédible en entretien. |
| 75 à 89 | Bon | Réponse solide avec quelques oublis ou imprécisions mineures. |
| 60 à 74 | Acceptable | Compréhension générale correcte mais réponse incomplète ou trop superficielle. |
| 40 à 59 | Faible | Plusieurs éléments importants manquent ou le raisonnement est fragile. |
| 0 à 39 | Insuffisant | Réponse hors sujet, très vague ou techniquement incorrecte. |

---

## 6. Règles de plafonnement

Certaines erreurs empêchent d'obtenir une note élevée, même si la réponse est fluide.

| Situation | Score maximal recommandé |
|---|---:|
| Réponse complètement hors sujet | 35 |
| Contradiction majeure ou raisonnement incohérent | 50 |
| Erreur sur le concept central de la question | 60 |
| Formule critique incorrecte | 60 |
| Chiffre ou transaction inventé dans une question dynamique | 55 |
| Réponse correcte mais beaucoup trop courte pour le niveau attendu | 65 à 75 |
| Liste de mots-clés sans explication logique | 70 |
| Réponse fit sans exemple personnel alors que la question en exige un | 65 |

Exemples d'erreurs centrales :

- confondre `Enterprise Value` et `Equity Value` ;
- dire qu'une hausse du D&A réduit l'EBITDA ;
- actualiser des Unlevered Free Cash Flows au coût des capitaux propres au lieu du WACC ;
- oublier l'effet de la dette dans un LBO ;
- confondre accretion et dilution dans un merger model ;
- inventer une valeur de transaction ou un multiple présenté comme exact.

Les plafonnements ne sont pas des notes automatiques. Ils fixent uniquement la note maximale possible.

---

## 7. Adaptation de l'évaluation selon le type de question

### 7.1 Questions techniques

Exemples : comptabilité, valorisation, DCF, LBO, M&A, merger model, restructuring, leveraged finance.

L'IA doit être stricte sur :

- les définitions ;
- les formules ;
- les étapes de calcul ;
- les relations de cause à effet ;
- les distinctions entre agrégats financiers ;
- la cohérence du raisonnement ;
- les hypothèses utilisées.

Une réponse bien formulée mais techniquement fausse ne doit jamais obtenir une note élevée.

Pour une question simple, une réponse courte mais exacte peut être suffisante. Pour une question de type `Walk me through`, l'IA doit exiger une réponse séquencée.

### 7.2 Questions behavioral et fit

Exemples : parcours, motivation, leadership, échec, forces et faiblesses, travail en équipe.

L'IA doit évaluer :

- la réponse directe à la question ;
- la cohérence du récit ;
- le caractère concret de l'exemple ;
- le rôle personnel du candidat ;
- les actions réellement réalisées ;
- le résultat ou l'apprentissage ;
- la crédibilité à l'oral.

Pour les questions d'expérience, privilégier une structure proche de `Situation - Task - Action - Result`, sans exiger que le candidat annonce explicitement ces quatre parties.

Une réponse générique sans exemple doit être pénalisée lorsque la question exige une expérience personnelle.

### 7.3 Questions marchés, investissement et business sense

L'IA doit évaluer :

- la capacité à structurer une analyse ;
- la compréhension des drivers de revenus, marges, croissance et risques ;
- la qualité des hypothèses ;
- la hiérarchisation des arguments ;
- la capacité à distinguer les faits, les estimations et les opinions ;
- la prudence lorsque les données ne sont pas disponibles.

Ne pas exiger un chiffre exact si la question porte avant tout sur le raisonnement.

### 7.4 Questions sur une transaction récente ou une actualité

L'IA doit évaluer :

- l'identification claire de la transaction ou du sujet ;
- la date approximative ou la période ;
- les parties impliquées ;
- la logique stratégique ;
- les éléments financiers disponibles ;
- l'opinion personnelle argumentée ;
- la capacité à reconnaître les informations non publiques.

Les données factuelles doivent être comparées au contexte actualisé produit par le module de refresh.

### 7.5 Brainteasers et questions créatives

L'IA doit valoriser :

- la clarification du problème ;
- la décomposition logique ;
- la formulation d'hypothèses ;
- le raisonnement oral ;
- la vérification du résultat ;
- la capacité à corriger une erreur en cours de route.

Le résultat final compte, mais le raisonnement doit rester visible.

---

## 8. Gestion des synonymes et formulations équivalentes

Ne jamais effectuer une recherche exacte de mots-clés comme seul mécanisme d'évaluation.

Exemples d'équivalences acceptables :

| Concept | Formulations acceptables |
|---|---|
| `Free Cash Flow` | `FCF`, `cash flow libre`, `flux de trésorerie disponible` |
| `Enterprise Value` | `EV`, `valeur d'entreprise`, `valeur des opérations` |
| `Equity Value` | `market capitalization`, `market cap`, `valeur des capitaux propres` |
| `Net Working Capital` | `NWC`, `working capital`, `BFR`, `besoin en fonds de roulement` |
| `Depreciation & Amortization` | `D&A`, `depreciation`, `amortization`, `dotations aux amortissements` |
| `Terminal Value` | `TV`, `valeur terminale` |

Le système doit vérifier que le candidat utilise ces notions correctement dans leur contexte.

---

## 9. Questions dynamiques et module de refresh

### 9.1 Définition

Une question dynamique est une question dont la qualité dépend d'informations susceptibles de devenir obsolètes :

- transaction récente ;
- niveau de marché ;
- tendance sectorielle ;
- société suivie ;
- actualité financière ;
- banque ciblée ;
- contexte de recrutement ;
- exemple de distressed company ;
- multiple, taux, cours ou valeur de transaction.

Ces questions sont signalées par :

```text
Refresh before interview = Yes
```

### 9.2 Moment du refresh

Le refresh doit être réalisé :

- avant l'affichage de la question au candidat ;
- avant la génération d'une correction détaillée ;
- après expiration du contexte temporaire ;
- immédiatement si l'utilisateur demande les données les plus récentes.

Le module ne doit jamais supposer que les informations enregistrées lors d'une tentative précédente sont encore à jour.

### 9.3 Utilisation de `DYNAMIC_REFRESH_GUIDE`

Pour chaque question dynamique :

1. retrouver la ligne grâce à `Final #` ;
2. lire `Update guidance` ;
3. identifier les informations à mettre à jour ;
4. collecter uniquement les faits utiles ;
5. enregistrer la date de vérification ;
6. enregistrer les sources utilisées ;
7. transmettre le contexte actualisé au correcteur.

### 9.4 Catégories de refresh

#### Contexte de banque ou de recrutement

Exemple de consigne :

```text
Adapt the context to the target firm and the current recruiting environment before use.
```

À actualiser :

- nom de la banque ou de l'équipe ;
- activité récente pertinente ;
- positionnement de l'équipe ;
- contexte de recrutement si nécessaire ;
- formulation de la question.

#### Transaction récente

Exemple de consigne :

```text
Refresh the transaction examples, dates, disclosed values, parties, and strategic rationale immediately before use.
```

À actualiser :

- nom de la cible ;
- nom de l'acquéreur ;
- date d'annonce ou de clôture selon la question ;
- valeur de transaction si elle est publique ;
- multiples si disponibles ;
- logique stratégique ;
- sources ;
- éléments non divulgués à indiquer explicitement comme tels.

#### Marché ou secteur

Exemple de consigne :

```text
Refresh market levels, dates, recent examples, and supporting rationale immediately before use.
```

À actualiser :

- date des données ;
- niveau ou tendance de marché ;
- exemple récent ;
- logique économique ;
- source fiable ;
- distinction claire entre fait et opinion.

### 9.5 Sources à privilégier

Pour les questions nécessitant des données actuelles, utiliser en priorité :

1. les communiqués de presse officiels ;
2. les publications réglementaires ;
3. les rapports annuels et présentations investisseurs ;
4. les sites officiels des sociétés ;
5. les sources financières reconnues ;
6. les articles de presse fiables lorsque l'information primaire n'est pas disponible.

Ne jamais inventer un chiffre manquant. Utiliser explicitement :

```text
Not publicly disclosed
```

lorsque l'information n'est pas publique.

### 9.6 Stockage recommandé du contexte temporaire

Le refresh doit être stocké séparément de la réponse evergreen du fichier Excel.

Exemple :

```json
{
  "question_id": 1157,
  "refresh_required": true,
  "refresh_status": "completed",
  "refreshed_at": "2026-05-31T10:30:00+02:00",
  "valid_until": "2026-06-07T10:30:00+02:00",
  "refresh_type": "recent_transaction",
  "refreshed_context": {
    "transaction": "Example transaction",
    "announcement_date": "2026-05-20",
    "parties": ["Buyer", "Target"],
    "transaction_value": "Not publicly disclosed",
    "strategic_rationale": [
      "Rationale 1",
      "Rationale 2"
    ]
  },
  "sources": [
    {
      "title": "Official press release",
      "url": "https://example.com",
      "published_at": "2026-05-20"
    }
  ]
}
```

### 9.7 Durée de validité recommandée

| Type de question | Durée de validité recommandée |
|---|---:|
| Banque ciblée ou environnement de recrutement | 30 jours |
| Tendance sectorielle | 14 jours |
| Transaction récente | 7 jours |
| Actualité financière ou distressed situation | 7 jours |
| Niveau de marché, taux, cours ou multiples actuels | 24 heures |

Lorsque le contexte a expiré, lancer un nouveau refresh.

### 9.8 Comportement en cas d'échec du refresh

Si aucune donnée fiable n'est disponible :

1. ne pas inventer de réponse ;
2. signaler que le refresh n'a pas abouti ;
3. conserver la logique evergreen de la réponse de référence ;
4. reformuler la question dans une version non datée lorsque cela est possible ;
5. retirer temporairement la question de la session si elle exige impérativement un fait récent.

---

## 10. Format JSON recommandé pour la correction

```json
{
  "question_id": 278,
  "category": "Technical",
  "subcategory": "DCF",
  "language_detected": "en",
  "refresh_required": false,
  "refresh_status": "not_required",
  "score": 84,
  "level": "Good",
  "is_answer_relevant": true,
  "critical_concept_understood": true,
  "key_elements_found": [
    "forecast unlevered free cash flow",
    "calculate terminal value",
    "discount cash flows using WACC",
    "derive enterprise value"
  ],
  "key_elements_missing": [
    "bridge from enterprise value to equity value"
  ],
  "technical_errors": [],
  "unsupported_claims": [],
  "score_breakdown": {
    "relevance_and_key_elements": 35,
    "technical_accuracy": 27,
    "structure_and_logic": 13,
    "depth_and_precision": 6,
    "professional_communication": 3
  },
  "main_feedback": "Your answer covers the core DCF logic and is technically sound. To make it interview-ready, add the bridge from enterprise value to equity value and mention the two common terminal value approaches.",
  "improvement_suggestions": [
    "State the projection period before explaining the terminal value.",
    "Finish by subtracting net debt and other claims to reach equity value."
  ]
}
```

### Champs complémentaires pour une question dynamique

```json
{
  "question_id": 1157,
  "refresh_required": true,
  "refresh_status": "completed",
  "refreshed_at": "2026-05-31T10:30:00+02:00",
  "reference_sources": [
    {
      "title": "Official press release",
      "url": "https://example.com",
      "published_at": "2026-05-20"
    }
  ],
  "factual_accuracy_against_refreshed_context": true,
  "stale_or_incorrect_claims": []
}
```

---

## 11. Prompt système conseillé pour l'IA de correction

```text
You are an interview-answer evaluator specialized in M&A, Corporate Finance, Investment Banking, capital markets and behavioral interviews.

You receive:
- the final question ID;
- the category and subcategory;
- the interview question;
- the candidate's answer;
- the evergreen reference answer;
- the answer origin;
- the Refresh before interview flag;
- when required, a dated refreshed context with sources.

Your task:
1. Evaluate whether the candidate actually answers the question.
2. Judge meaning and reasoning, not word-for-word similarity.
3. Identify correctly covered concepts, missing elements, technical errors, contradictions and unsupported claims.
4. Apply the scoring framework out of 100.
5. Apply score caps when a central concept is wrong, the answer is off-topic, a formula is wrong, or a factual claim is invented.
6. Adapt expectations to the type of question.
7. For dynamic questions, compare factual claims only against the dated refreshed context. Do not rely on stale information.
8. Accept equivalent formulations and synonyms when the reasoning is correct.
9. Produce concise, specific and actionable feedback.
10. Return valid JSON only, using the required correction schema.

Be demanding but fair. A fluent answer with incorrect reasoning must not receive a high score. A concise but fully correct answer may receive a strong score when the question is simple.
```

---

## 12. Prompt système conseillé pour le module de refresh

```text
You are a refresh agent for an M&A and Investment Banking interview simulator.

You receive:
- the question ID;
- the question;
- the category and subcategory;
- the update guidance;
- the current date;
- when relevant, the target firm, geography and interview context.

Your task:
1. Identify which factual elements must be updated before the question can be used.
2. Collect only the information required to ask the question and evaluate a candidate answer.
3. Prioritize primary and reliable sources.
4. Record the verification date and the source for each important factual claim.
5. Clearly separate facts, estimates and opinions.
6. Never invent missing figures. Write "Not publicly disclosed" when appropriate.
7. Return a concise refreshed context in valid JSON.
8. Set refresh_status to "failed" if reliable information cannot be obtained.
9. Recommend an evergreen reformulation when the dynamic version cannot be used safely.

The refreshed context must supplement the evergreen answer. It must never overwrite it.
```

---

## 13. Exemple de correction d'une question statique

### Données d'entrée

```text
Question: Walk me through a DCF.

Candidate answer:
A DCF values a company by forecasting future cash flows, discounting them back using the WACC and adding a terminal value to derive enterprise value.
```

### Analyse attendue

Éléments correctement couverts :

- prévision des flux de trésorerie ;
- actualisation ;
- WACC ;
- valeur terminale ;
- Enterprise Value.

Éléments à ajouter :

- période de projection ;
- méthodes de calcul de la valeur terminale ;
- passage de l'Enterprise Value à l'Equity Value.

Score indicatif : **82 à 88** selon le niveau de détail attendu.

---

## 14. Exemple de correction d'une question dynamique

### Question

```text
Tell me about an M&A deal that interested you recently.
```

### Traitement attendu

Avant d'afficher la question :

1. lancer le module de refresh ;
2. sélectionner une transaction récente et documentée ;
3. enregistrer les parties, la date, la valeur si elle est publique et la logique stratégique ;
4. fournir ce contexte au correcteur.

Pendant la correction :

- ne pas exiger que le candidat cite la même transaction que celle sélectionnée par le refresh ;
- vérifier la cohérence des faits avancés par le candidat ;
- valoriser une analyse structurée ;
- pénaliser les chiffres inventés ;
- accepter explicitement qu'une information ne soit pas publique.

Une excellente réponse doit présenter la transaction, expliquer la logique stratégique, commenter les éléments financiers disponibles et formuler une opinion personnelle argumentée.

---

## 15. Règles de feedback au candidat

Le feedback doit être :

- direct ;
- spécifique ;
- hiérarchisé ;
- orienté amélioration ;
- relié à la question ;
- suffisamment court pour être lu après une simulation.

### Bon feedback

```text
Your answer explains the core DCF steps clearly. Add the bridge from enterprise value to equity value and mention the two standard terminal value methods to make the response complete.
```

### Mauvais feedback

```text
Your answer is not detailed enough. Review DCFs.
```

Le second feedback ne permet pas au candidat de comprendre précisément ce qu'il doit améliorer.

---

## 16. Données à stocker pour chaque tentative

Le site devrait enregistrer :

- `question_id` ;
- `candidate_answer` ;
- `language_detected` ;
- `score` ;
- `score_breakdown` ;
- `level` ;
- `key_elements_found` ;
- `key_elements_missing` ;
- `technical_errors` ;
- `unsupported_claims` ;
- `main_feedback` ;
- `improvement_suggestions` ;
- `refresh_required` ;
- `refresh_status` ;
- `refreshed_at` si applicable ;
- `reference_sources` si applicable ;
- `attempted_at`.

Ces données permettent de calculer :

- le score moyen global ;
- le score moyen par catégorie ;
- les thèmes faibles du candidat ;
- la progression dans le temps ;
- les questions souvent ratées ;
- les erreurs techniques les plus fréquentes ;
- les questions dynamiques dont le contexte doit être renouvelé.

---

## 17. Règles d'intégration importantes

1. Importer uniquement `EN_QA_FINAL`.
2. Utiliser la colonne `#` comme identifiant primaire dans le site.
3. Ne jamais importer `AUDIT_DECISIONS` dans la base de questions.
4. Conserver `Answer origin` pour la traçabilité.
5. Déclencher le refresh lorsque `Refresh before interview = Yes`.
6. Conserver la réponse evergreen dans `Answer`.
7. Stocker le contexte actualisé dans une table séparée.
8. Horodater chaque refresh.
9. Expirer automatiquement les contextes temporaires.
10. Ne jamais inventer une donnée manquante.
11. Ne pas comparer les réponses mot à mot.
12. Toujours retourner un feedback actionnable.

---

## 18. Contrôle qualité final

Avant de retourner une correction, l'IA doit vérifier :

1. Ai-je évalué la question réellement posée ?
2. Ai-je distingué les éléments manquants des erreurs factuelles ?
3. Ai-je vérifié le concept central ?
4. Ai-je adapté mes attentes au type de question ?
5. Ai-je appliqué les plafonnements éventuels ?
6. La note est-elle cohérente avec le feedback ?
7. Pour une question dynamique, le contexte utilisé est-il encore valide ?
8. Ai-je évité toute donnée inventée ?
9. Le candidat comprend-il clairement comment améliorer sa réponse ?
10. Le retour serait-il crédible dans une préparation réelle à un entretien M&A ?

---

## 19. Règle finale

Le fichier Excel fournit une base de référence structurée. Il ne remplace pas le raisonnement de l'IA.

Une correction de qualité doit répondre à trois questions :

1. Le candidat a-t-il compris le concept ou l'objectif de la question ?
2. Sa réponse est-elle techniquement correcte et factuellement crédible ?
3. Sa réponse serait-elle convaincante dans un véritable entretien ?

Si l'une de ces trois réponses est négative, la note et le feedback doivent le refléter clairement.
