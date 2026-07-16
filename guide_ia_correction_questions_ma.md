# Guide d’utilisation du fichier Q/R M&A pour une IA de correction

## 1. Objectif du fichier

Ce fichier sert de base de connaissance pour corriger automatiquement les réponses de candidats à des questions d’entretien en M&A, Corporate Finance et Investment Banking.

L’IA de correction ne doit pas chercher à vérifier si le candidat récite exactement la réponse attendue. Elle doit évaluer si la réponse du candidat couvre les concepts importants, utilise un raisonnement correct, évite les erreurs techniques et répond précisément à la question posée.

Le fichier doit être utilisé comme une grille de référence, pas comme un corrigé à comparer mot à mot.

---

## 2. Structure générale du fichier Excel

Le fichier contient plusieurs feuilles. Les plus importantes pour l’IA de correction sont :

### `FR_QR`

Feuille principale en français.

Elle contient les questions traduites en français, les réponses attendues en français, les mots-clés attendus et une grille de scoring adaptée à la correction automatique.

À utiliser lorsque le site affiche les questions en français ou lorsque le candidat répond en français.

### `EN_QA`

Feuille principale en anglais.

Elle contient les questions originales, les réponses sources, les mots-clés attendus en anglais et la grille de scoring en anglais.

À utiliser lorsque le site affiche les questions en anglais ou lorsque le candidat répond en anglais.

### `Taxonomy_FR`

Feuille de classification.

Elle aide à comprendre les grandes catégories de questions : fit, accounting, valuation, DCF, LBO, M&A, merger model, markets, brainteasers, etc.

Elle peut être utilisée pour adapter le niveau de sévérité selon le type de question.

### `Mode_emploi`

Feuille synthétique de rappel.

Elle résume l’usage du fichier, mais la présente documentation Markdown doit être considérée comme la documentation principale pour une IA de correction.

---

## 3. Colonnes clés à utiliser

### Colonnes d’identification

- `ID` ou `Global #` : identifiant unique de la question.
- `Catégorie FR` ou `Standard Category` : grande catégorie de la question.
- `Sous-catégorie FR` ou `Standard Subcategory` : thème plus précis.
- `Type de question` ou `Question Type` : nature de la question, par exemple technique, fit, comportemental, marché, comptabilité, valorisation.
- `Page source` ou `Page Start` : page du document source, utile pour audit interne mais non nécessaire au scoring.
- `Document source` ou `Document` : document d’origine.

### Colonnes de contenu

- `Question FR` ou `Question` : question posée au candidat.
- `Réponse attendue FR` ou `Answer` : réponse de référence.
- `Éléments clés à citer FR` ou `Expected Key Elements EN` : concepts, mots-clés et éléments indispensables.
- `Concept / formule critique` ou `Critical Concept / Formula` : notion principale à maîtriser.
- `Grille de scoring IA FR` ou `AI Scoring Rubric EN` : règle d’évaluation recommandée.
- `Niveau attendu` ou `Expected Answer Level` : niveau de précision attendu.
- `Réponse source présente` ou `Response Exists` : indique si une réponse de référence existe dans la source.

---

## 4. Principe général de correction

Pour chaque réponse candidat, l’IA doit suivre cette logique :

1. Identifier la question posée via `ID`, `Global #`, ou via une correspondance exacte / sémantique avec la colonne question.
2. Charger la ligne correspondante dans la bonne langue.
3. Lire la réponse attendue, les éléments clés et le concept critique.
4. Analyser la réponse du candidat.
5. Déterminer si les idées attendues sont présentes, même si elles sont formulées autrement.
6. Évaluer la précision technique.
7. Évaluer la structure et la clarté.
8. Appliquer les pénalités en cas d’erreur grave, d’hallucination, de hors-sujet ou de contradiction.
9. Retourner une note, une appréciation et des axes d’amélioration.

L’IA doit toujours privilégier la compréhension conceptuelle à la récitation exacte.

---

## 5. Barème recommandé sur 100 points

Le scoring conseillé est le suivant :

| Critère | Pondération | Description |
|---|---:|---|
| Couverture des éléments clés | 40 pts | Le candidat cite les idées essentielles listées dans `Éléments clés à citer`. |
| Exactitude technique | 30 pts | Le raisonnement est juste, les formules sont correctes, les liens financiers sont exacts. |
| Structure de réponse | 15 pts | La réponse est claire, organisée et adaptée au type de question. |
| Profondeur et précision | 10 pts | Le candidat donne des nuances, exemples ou limites utiles. |
| Communication professionnelle | 5 pts | Le ton est fluide, synthétique et professionnel. |

Total : 100 points.

---

## 6. Interprétation des scores

| Score | Niveau | Interprétation |
|---:|---|---|
| 90 à 100 | Excellent | Réponse complète, précise, structurée et professionnelle. |
| 75 à 89 | Bon | Réponse solide, avec quelques oublis ou imprécisions mineures. |
| 60 à 74 | Acceptable | Compréhension générale correcte, mais réponse incomplète ou trop superficielle. |
| 40 à 59 | Faible | Plusieurs éléments clés manquent ou le raisonnement est fragile. |
| 0 à 39 | Insuffisant | Réponse hors-sujet, techniquement fausse ou beaucoup trop vague. |

---

## 7. Règles de plafonnement du score

Certaines erreurs doivent limiter automatiquement le score maximal, même si la réponse semble bien formulée.

### Erreur sur le concept critique

Si le candidat se trompe sur le `Concept / formule critique`, le score maximal doit être plafonné à 60.

Exemple : pour une question sur le DCF, si le candidat confond WACC et coût des capitaux propres, la réponse ne peut pas être considérée comme bonne.

### Réponse techniquement dangereuse ou contradictoire

Si la réponse contient une contradiction majeure, le score maximal doit être plafonné à 50.

Exemple : dire qu’une hausse du D&A réduit l’EBITDA est faux, car le D&A est exclu de l’EBITDA.

### Réponse hors-sujet

Si la réponse ne traite pas la question posée, le score maximal doit être plafonné à 40.

### Réponse très courte mais correcte

Si la réponse est correcte mais trop brève, le score maximal doit généralement être plafonné entre 65 et 75, sauf pour les questions très simples.

### Réponse récitée mais non comprise

Si le candidat récite des mots-clés sans expliquer les liens logiques, le score doit être pénalisé. La simple présence de mots-clés ne suffit pas.

---

## 8. Gestion des mots-clés et synonymes

La colonne `Éléments clés à citer` ne doit pas être utilisée comme une recherche exacte de mots.

L’IA doit accepter :

- les synonymes ;
- les formulations équivalentes ;
- les réponses dans une autre langue si le sens est correct ;
- les exemples personnels pertinents ;
- les explications conceptuelles sans reprise exacte du vocabulaire source.

Exemple :

- `Free Cash Flow` peut être accepté sous les formes `FCF`, `cash-flow libre`, `flux de trésorerie disponible`.
- `Enterprise Value` peut être accepté sous les formes `EV`, `valeur d’entreprise`, `valeur des opérations`.
- `working capital` peut être accepté sous les formes `BFR`, `besoin en fonds de roulement`, `net working capital`.

En revanche, l’IA doit pénaliser les usages incorrects de ces termes.

---

## 9. Correction selon le type de question

### Questions techniques

Pour les questions techniques, l’IA doit être stricte sur :

- les formules ;
- les relations de cause à effet ;
- la différence entre Equity Value et Enterprise Value ;
- la distinction entre EBITDA, EBIT, Net Income et Free Cash Flow ;
- l’impact des éléments comptables sur les trois états financiers ;
- la logique des méthodes de valorisation ;
- les hypothèses d’un DCF, LBO ou merger model.

Une réponse techniquement fausse mais bien structurée ne doit pas obtenir un score élevé.

### Questions comportementales ou fit

Pour les questions fit, l’IA doit évaluer :

- la clarté de la motivation ;
- la structure de la réponse ;
- la cohérence du parcours ;
- la capacité à relier l’expérience au poste ;
- l’utilisation d’un exemple concret ;
- la capacité à montrer un rôle personnel, une action et un résultat.

Une bonne réponse fit doit éviter les généralités et montrer une vraie réflexion personnelle.

### Questions de marché ou business sense

Pour les questions marché, l’IA doit évaluer :

- la logique économique ;
- la capacité à formuler des hypothèses ;
- la prise en compte des drivers de revenus, marges, croissance et risques ;
- la capacité à structurer une analyse sans inventer de données.

L’IA ne doit pas pénaliser l’absence de chiffres exacts si le raisonnement est solide et si la question ne demande pas explicitement des données précises.

---

## 10. Format de sortie recommandé pour l’IA de correction

L’IA de correction devrait retourner un objet structuré, idéalement en JSON.

```json
{
  "question_id": 123,
  "language_detected": "fr",
  "score": 82,
  "level": "Bon",
  "is_answer_relevant": true,
  "critical_concept_understood": true,
  "key_elements_found": [
    "DCF",
    "free cash flow",
    "WACC",
    "terminal value"
  ],
  "key_elements_missing": [
    "discounting cash flows to present value"
  ],
  "technical_errors": [],
  "main_feedback": "La réponse est correcte et couvre les principaux éléments attendus, mais elle devrait mieux expliquer pourquoi les flux sont actualisés au WACC.",
  "improvement_suggestions": [
    "Ajouter une phrase sur l’actualisation des flux de trésorerie.",
    "Mentionner explicitement la valeur terminale si la question porte sur un DCF complet."
  ]
}
```

---

## 11. Prompt système conseillé pour l’IA de correction

Le site peut utiliser le prompt suivant comme base.

```text
Tu es une IA spécialisée dans la correction de réponses d’entretien en M&A, Corporate Finance et Investment Banking.

Tu dois corriger la réponse d’un candidat à partir d’une ligne de référence issue du fichier Q/R.

Tu reçois :
- la question posée ;
- la réponse du candidat ;
- la réponse attendue ;
- les éléments clés attendus ;
- le concept ou la formule critique ;
- la grille de scoring recommandée ;
- le type de question.

Ta mission :
1. Évaluer si la réponse répond réellement à la question.
2. Identifier les éléments clés présents et manquants.
3. Vérifier l’exactitude technique.
4. Ne pas comparer mot à mot, mais juger le sens.
5. Accepter les synonymes et formulations équivalentes.
6. Pénaliser les erreurs techniques, contradictions, hallucinations et hors-sujets.
7. Donner une note sur 100.
8. Retourner un feedback court, précis et actionnable.

Tu dois être exigeant mais juste. Une réponse bien formulée mais techniquement fausse ne doit pas obtenir un score élevé. Une réponse courte mais parfaitement correcte peut obtenir un bon score si la question est simple, mais doit être pénalisée si elle manque de profondeur pour une question avancée.
```

---

## 12. Exemple de logique de correction

### Données d’entrée

Question : `Walk me through a DCF.`

Éléments clés attendus :

- projection des Free Cash Flows ;
- calcul du WACC ;
- calcul de la Terminal Value ;
- actualisation des flux ;
- obtention de l’Enterprise Value.

Réponse candidat :

```text
A DCF values a company by forecasting its future cash flows and discounting them back using the WACC. Then we add a terminal value and get the enterprise value.
```

### Analyse attendue

Éléments présents :

- future cash flows ;
- discounting ;
- WACC ;
- terminal value ;
- enterprise value.

Éléments manquants :

- période de projection explicite ;
- conversion éventuelle d’Enterprise Value à Equity Value ;
- détails sur les méthodes de terminal value.

Score recommandé : 85 à 90 selon le niveau attendu.

---

## 13. Erreurs fréquentes à détecter

L’IA doit être attentive aux erreurs suivantes :

- confondre Enterprise Value et Equity Value ;
- inclure le cash dans Enterprise Value de manière incorrecte ;
- utiliser le coût des capitaux propres à la place du WACC dans un DCF unlevered ;
- dire que le D&A impacte l’EBITDA ;
- oublier l’impact fiscal dans le calcul du Free Cash Flow ;
- confondre chiffre d’affaires, EBITDA, EBIT et résultat net ;
- ne pas distinguer accretion / dilution dans un merger model ;
- oublier l’effet de la dette dans un LBO ;
- donner une réponse purement théorique à une question comportementale qui demande un exemple personnel.

---

## 14. Règles de feedback au candidat

Le feedback doit être :

- court ;
- précis ;
- orienté amélioration ;
- directement relié à la question ;
- sans jugement personnel inutile.

### Bon feedback

```text
Bonne réponse sur la logique générale du DCF. Il manque toutefois une mention explicite de la valeur terminale et du passage de l’Enterprise Value à l’Equity Value.
```

### Mauvais feedback

```text
Réponse pas assez bonne. Il faut revoir le DCF.
```

Le second feedback est trop vague et ne permet pas au candidat de progresser.

---

## 15. Recommandations d’intégration pour le site

Pour chaque tentative candidat, le site devrait stocker :

- l’identifiant de la question ;
- la réponse du candidat ;
- la langue détectée ;
- le score global ;
- les éléments clés trouvés ;
- les éléments clés manquants ;
- les erreurs techniques détectées ;
- le feedback final ;
- la date de tentative ;
- la progression du candidat par catégorie.

Cela permettra ensuite de produire des statistiques utiles :

- score moyen par catégorie ;
- thèmes faibles du candidat ;
- progression dans le temps ;
- questions souvent ratées ;
- erreurs techniques les plus fréquentes.

---

## 16. Règle finale importante

Le fichier Excel fournit une base de référence. L’IA doit l’utiliser pour guider la correction, mais elle doit toujours raisonner sur le fond.

Une bonne correction doit répondre à trois questions :

1. Le candidat a-t-il compris le concept ?
2. Sa réponse est-elle techniquement correcte ?
3. Sa réponse serait-elle crédible dans un vrai entretien M&A ?

Si la réponse à l’une de ces trois questions est négative, le score doit être ajusté en conséquence.
