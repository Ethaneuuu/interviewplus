# Audit design — InterviewPlus

**Date :** 7 août 2026
**Périmètre :** site vanilla en production (racine du repo), 6 pages, `assets/css/app.css` (1 194 lignes)
**Direction retenue :** clair et premium, type Notion / Linear

---

## 1. Synthèse

Le site est **fonctionnellement avancé** et **visuellement en retard sur son ambition**. Le moteur (1 255 lignes dans `store.js`), l'auth Supabase avec RLS, les 1 741 questions bilingues et la correction sémantique locale sont du vrai travail. Le design, lui, est un empilement de décisions ponctuelles : pas de design system, pas d'échelle d'espacement, dix rayons de bordure différents, du CSS résiduel d'un ancien thème clair, et aucune gestion du focus clavier.

Le point le plus coûteux n'est pas esthétique mais structurel : **la page d'accueil télécharge 2,3 Mo pour n'afficher strictement rien de plus** (détail en §3.1). Sur mobile en 4G, c'est plusieurs secondes de page blanche avant le hero. Aucune refonte visuelle ne compensera ça.

| Axe | État | Priorité |
|---|---|---|
| Performance perçue | Critique | P0 |
| Cohérence du design system | Faible | P0 |
| Accessibilité (focus, contraste, motion) | Insuffisante | P1 |
| Responsive | Partiel (2 breakpoints) | P1 |
| Identité visuelle | Correcte mais générique | P2 |
| CSS mort / résiduel | Présent | P2 |

---

## 2. Ce qui marche déjà et qu'il faut garder

- **La structure des pages est saine.** `header.topbar` / `main.page` / `footer.site-footer` répété partout, sémantique HTML correcte (`<main>`, `<section>`, `<article>`, `<aside>`). La refonte peut se faire quasi entièrement en CSS.
- **Les variables CSS existent déjà** (`:root` avec 18 tokens). La base d'un design system est là, il faut la compléter et l'appliquer sans exception.
- **Le parcours produit est clair** : accueil → setup → session → results → profile. Aucun besoin de le repenser.
- **Le hero et le "hero-console"** (l'aperçu de session avec les barres Structure / Technical depth / Precision) est la meilleure idée visuelle du site. Il montre le produit au lieu de le décrire. À conserver et à retravailler, pas à jeter.
- **La grille de 6 thèmes** est le bon niveau d'information pour la homepage.

---

## 3. Constats page par page

### 3.1 Accueil (`index.html`) — P0

**2,3 Mo téléchargés pour rien.** `index.html` charge `xlsx.full.min.js` (932 Ko), et `home.js` appelle `initializeApp()` au premier niveau du module — donc en `await` bloquant — ce qui déclenche le chargement de `Questions_InterviewPlus_Bilingual.xlsx` (1,4 Mo) et son parsing dans le navigateur.

Or `renderHome()` cherche `document.getElementById("datasetStats")` pour afficher les pastilles "1 741 questions / X thèmes / source". **Cet élément n'existe dans aucun des 6 fichiers HTML.** Le résultat du chargement est intégralement jeté. Les seules choses réellement mises à jour sur l'accueil sont le libellé du lien Connexion et une note de bas de hero — deux informations disponibles sans toucher au classeur.

→ Retirer `xlsx.full.min.js` et l'appel à `initializeApp()` de l'accueil. Gain immédiat : ~2,3 Mo et plusieurs secondes de *time to interactive*. À faire avant toute autre chose.

**Grille de thèmes cassée.** `.topic-grid` est en `repeat(4, minmax(0, 1fr))` alors que la page contient 6 cartes. Rendu : une rangée de 4, puis une rangée de 2 orpheline et déséquilibrée. Une grille de 3 colonnes (2 rangées de 3) est la correction évidente.

**Le carrousel de logos de banques pose deux problèmes.** Visuellement, ce sont des pastilles blanches à 90 % d'opacité posées sur un fond quasi noir : ce sont les objets les plus contrastés de la page, ils captent l'œil au détriment du hero. Juridiquement, aligner Goldman Sachs, J.P. Morgan, Blackstone et KKR sans mention suggère un partenariat ou un placement d'étudiants. Il n'y a aucun `aria-label` ou texte du type "thèmes couverts : entretiens type X". Le `aria-label="Environnements visés"` existe mais n'est pas visible pour un utilisateur voyant. À reformuler en clair sur la page.

**L'animation du marquee n'a aucune protection `prefers-reduced-motion`** — le fichier CSS ne contient zéro occurrence de cette media query. Mouvement infini imposé, y compris aux utilisateurs qui ont désactivé les animations au niveau système.

**Titres :** `.hero-copy h1` fixe `max-width: 10ch` et `.premium-hero .hero-copy h1` fixe `11ch`. Deux règles concurrentes sur le même élément. Avec un titre de 11 mots, ça donne 6 à 7 lignes très hautes — spectaculaire mais illisible en diagonale.

**Témoignages :** trois citations anonymes ("Candidate, M&A internship"). Sans nom, école ou photo, elles n'apportent aucune preuve sociale et fragilisent la crédibilité plutôt que de la renforcer. Soit on obtient de vrais témoignages attribués, soit on remplace la section par des chiffres factuels (1 741 questions, 6 thèmes, correction en moins d'une seconde).

### 3.2 Authentification (`auth.html`) — P2

Page la plus propre du lot : `.auth-intro` centré, grille 2 colonnes inscription/connexion, `.guest-card` en pleine largeur, indicateur de robustesse du mot de passe (`.password-meter` à 4 paliers), et bouton d'affichage du mot de passe. Bon travail.

Deux réserves : `.auth-message` est le seul retour d'erreur et il est centré sous les deux formulaires, donc éloigné du champ fautif ; et c'est la seule page qui ne charge pas SheetJS, ce qui prouve au passage que les autres pourraient s'en passer aussi sur le chemin critique.

### 3.3 Setup (`setup.html`) — P1

C'est la page qui décide de toute l'expérience (nombre de questions, thème, timer) et c'est un simple empilement de champs dans un `.setup-panel`. Aucune prévisualisation de ce que la session va donner, aucun préréglage. Pour un produit d'entraînement, des préréglages du type "Sprint 5 questions / 10 min", "Technical 15 / 30 min", "Simulation complète 25 / 45 min" élimineraient trois décisions à chaque session.

### 3.4 Session (`session.html`) — P1

**`.section-head` n'existe pas dans le CSS.** La classe est utilisée dans `session.html`, `results.html` et `profile.html` (5 occurrences au total) et n'a aucune règle associée. L'intention était clairement un `display: flex; justify-content: space-between` — titre à gauche, pastille de score à droite. En l'absence de règle, le bloc s'empile verticalement et la pastille "Score global" atterrit sous le titre. Bug visible sur trois pages.

**Le timer n'a pas d'états.** `.timer-card strong` est en 2,2 rem, couleur `--ink` fixe. Aucun changement visuel sous les 2 minutes, aucun à 30 secondes. Dans un produit dont la promesse est "répondre sous pression", c'est l'élément qui devrait le plus communiquer.

**La zone de réponse est un `<textarea rows="12">** sans compteur de mots, sans sauvegarde visible, sans repère de longueur attendue. Le candidat écrit à l'aveugle.

**Hiérarchie inversée.** La question est un `<h2>` dans un `.question-block` posé à l'intérieur d'un `.panel` — donc deux cadres imbriqués, deux bordures, deux fonds translucides. Pendant une session, l'écran ne devrait contenir qu'une chose lisible : la question. Ici elle est enfermée dans des boîtes concentriques.

### 3.5 Résultats (`results.html`) — P2

`.results-review-layout` en deux colonnes avec `.results-question-nav` en `position: sticky` : c'est le bon pattern. Les cartes de feedback à trois tons (`-success` / `-warning` / `-danger`) sont bien pensées.

Problème : `.result-feedback-stack` en `repeat(3, 1fr)` à l'intérieur d'une colonne qui fait déjà moins de 60 % de la largeur → trois colonnes de texte très étroites, avec des listes à puces dedans. À passer en une seule colonne empilée.

### 3.6 Profil (`profile.html`) — P2

Barres de progression maison (`.chart-track` / `.chart-bar`, hauteur 12 px). Correct mais minimal : pas d'évolution dans le temps, seulement un état instantané par catégorie. C'est la page qui bénéficierait le plus d'un vrai graphique, et c'est justement là que le prototype React a déjà `recharts` en dépendance.

---

## 4. Problèmes transverses

### 4.1 Pas d'échelle, donc pas de système

**Rayons de bordure :** 999px (×11), `--radius-xl` 28px (×3), `--radius-lg` 20px (×3), puis 30px, 26px, 24px, 22px, 18px, 16px (×2), 50% (×2). Dix valeurs distinctes. Un `.hero-console` à 30px contient des `.console-topline` à 22px, eux-mêmes dans un `.premium-hero` à 28px — trois arrondis différents emboîtés, l'œil le perçoit comme du flou.

**Espacements :** 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 52, 64 px, sans logique. Aucun token d'espacement dans `:root`.

**Hauteurs figées :** `min-height` à 210px, 230px, 560px sur les cartes et le hero. Le contenu se bat contre le contenant au lieu de le définir.

### 4.2 Accessibilité

- **Focus clavier quasi inexistant.** Le fichier ne contient que trois sélecteurs `:focus`, tous sur `.field input/textarea/select`, et leur style est `outline: 2px solid rgba(13, 92, 99, 0.16)` — un teal à 16 % d'opacité, invisible sur fond sombre. Les `.button`, `.nav-link`, `.question-nav button` et `.history-item` n'ont **aucun** style de focus. Le site est inutilisable au clavier.
- **Contraste :** `--elite-blue #2563eb` sur les panneaux donne **3,54:1**, sous le seuil AA de 4,5:1. Il est utilisé pour `.feature-card strong` (les numéros 01–04) et `.testimonial-card strong` (les attributions). Le reste est bon : `--ink-soft` à 7,85:1, `--primary` à 5,47:1, `--ink` à 18,74:1.
- **`prefers-reduced-motion` : 0 occurrence.**
- **`.sr-only` est défini** mais n'est utilisé dans aucun HTML statique ; le motif est réécrit à la main dans `.bank-logo figcaption` au lieu d'être réutilisé.

### 4.3 CSS résiduel d'un ancien thème clair

Plusieurs règles ont été écrites pour un fond clair et n'ont jamais été mises à jour :

- `.empty-box` : `border: 1px dashed rgba(22, 38, 58, 0.18)` — un bleu-noir à 18 % sur fond `#030712`, donc une bordure invisible.
- `.score-pill.score-mid` : `color: #1b1300` (texte quasi noir) sur `rgba(194, 123, 0, 0.24)`.
- `.score-ring` : le `conic-gradient` déclare deux fois la même couleur à `360deg` — c'est un no-op, l'anneau de score ne dessine aucun arc. Code mort.
- Le `:focus` en teal `rgba(13, 92, 99, ...)` mentionné plus haut, couleur qui n'appartient à aucune palette du fichier.

### 4.4 Performance de rendu

`backdrop-filter: blur(18px)` est appliqué sur 5 groupes de sélecteurs qui couvrent le topbar, tous les panneaux, toutes les cartes, le marquee et le hero-console — soit plusieurs dizaines d'éléments simultanés, empilés au-dessus d'un `body` portant trois `radial-gradient` plus un `linear-gradient`. C'est la recette classique du scroll saccadé sur machine modeste et de la batterie qui chauffe sur mobile.

### 4.5 Responsive

Deux breakpoints seulement : 1080px et 720px. Entre les deux, `.topic-grid`, `.grid-3`, `.roadmap` et `.results-review-layout` passent tous directement en **une seule colonne**. Sur un iPad en paysage (1024px) ou un petit portable, on obtient des cartes de 900 px de large contenant deux lignes de texte. Il manque un palier intermédiaire.

### 4.6 Duplication du projet

Deux sites cohabitent dans le repo. Le prototype React (`Nouveau site`, TanStack Start + Tailwind 4 + ~40 composants shadcn/ui, 2 139 lignes de routes) n'est branché ni sur Supabase ni sur `store.js`. Il double la surface de maintenance sans rien apporter en production. Le dossier contient aussi des fichiers manifestement issus de copier-coller : `app (1).tsx`, `app.sessions (1).tsx`, un `.DS_Store`, un dossier `.tanstack/tmp` et un `dist/` compilé.

Décision à prendre maintenant : soit on migre pour de bon, soit on récupère la direction visuelle et on supprime le dossier. Le laisser en l'état est le pire des trois.

### 4.7 Divers

- Le `README.md` documente les chemins en `C:\Users\esmad\Documents\InterviewPlus\...` — inutilisable pour quiconque, y compris sur ton propre Mac.
- 3 commits git au total. Aucun historique exploitable pour revenir en arrière si une refonte tourne mal. À corriger avant de toucher au CSS : commiter l'état actuel comme point de restauration.
- `.testimonial-section` est utilisée en HTML sans règle CSS (sans conséquence, mais symptomatique).

---

## 5. Direction proposée : clair et premium

L'objectif : que le site inspire le sérieux d'un outil professionnel, pas d'une landing page crypto. Le dark bleu-nuit actuel avec glassmorphism et dégradés est daté (2021) et fatigant sur des sessions de révision de 30 à 45 minutes, qui sont précisément le cas d'usage principal.

### 5.1 Palette

| Token | Valeur | Usage |
|---|---|---|
| `--bg` | `#FFFFFF` | Fond principal |
| `--bg-subtle` | `#FAFAF9` | Fond de section alternée |
| `--surface` | `#FFFFFF` | Cartes |
| `--border` | `#E7E5E4` | Bordures (1px, opaques — plus de rgba) |
| `--ink` | `#1C1917` | Texte principal (16,9:1) |
| `--ink-soft` | `#57534E` | Texte secondaire (7,4:1) |
| `--ink-faint` | `#A8A29E` | Métadonnées uniquement |
| `--accent` | `#1D4ED8` | Bleu d'action, un seul bleu |
| `--accent-soft` | `#EFF6FF` | Fonds d'état actif |
| `--success` | `#15803D` | Score élevé |
| `--warning` | `#B45309` | Score moyen |
| `--danger` | `#B91C1C` | Score faible |

Principe : **une seule couleur d'accent**, réservée aux actions et aux états. Aujourd'hui il y a `--primary`, `--primary-strong`, `--accent`, `--elite-blue`, `--elite-light` — cinq bleus qui se disputent l'attention.

Les couleurs de score restent les seules couleurs sémantiques, ce qui les rend immédiatement lisibles dans les corrections.

### 5.2 Typographie

Passer à **une seule famille**. Instrument Serif en `clamp(2.8rem, 4.8vw, 5rem)` sur des titres de 11 mots est le choix le plus daté du site. Linear et Notion utilisent Inter, tout simplement.

- Interface et titres : Inter (ou la font stack système, qui coûte 0 Ko).
- Chiffres, timer, scores : `font-variant-numeric: tabular-nums`, indispensable pour que le compte à rebours ne tremble pas à chaque seconde.
- Échelle : 12 / 14 / 16 / 20 / 24 / 32 / 44 px. Sept tailles, pas plus.

### 5.3 Tokens de système

```css
:root {
  /* espacement — échelle de 4 */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px;

  /* rayons — trois valeurs, pas dix */
  --r-sm: 6px;   /* champs, pastilles */
  --r-md: 10px;  /* cartes, boutons */
  --r-lg: 16px;  /* panneaux, hero */

  /* élévation — des ombres discrètes, pas de blur */
  --sh-1: 0 1px 2px rgba(28, 25, 23, 0.06);
  --sh-2: 0 4px 12px rgba(28, 25, 23, 0.08);
}
```

Zéro `backdrop-filter`. Zéro dégradé de fond. La profondeur vient des bordures 1px et d'ombres à peine perceptibles — c'est exactement la signature Linear/Notion, et c'est aussi ce qui rend le scroll fluide.

### 5.4 Composants clés à revoir

**Boutons** — Aujourd'hui : 48px de haut, `border-radius: 999px`, dégradé bleu-cyan, `translateY(-1px)` au survol. Proposition : 36px (ou 40px pour l'action principale), `--r-md`, aplat `--accent` uni, changement de fond au survol, et surtout un `:focus-visible` avec un anneau de 2px décalé de 2px. Les boutons entièrement arrondis lisent "consumer app" ; les entretiens M&A lisent "outil pro".

**Cartes** — Fond blanc, bordure `--border` 1px, `--r-md`, `--sh-1`. Suppression des `min-height` : c'est le contenu qui fixe la hauteur.

**Timer** — Le composant à traiter en priorité. Chiffres en tabular-nums, 40px, et trois états explicites : neutre (`--ink`), alerte sous 2 min (`--warning`), critique sous 30 s (`--danger` + un pulse **désactivé sous `prefers-reduced-motion`**). Barre de progression fine sous le chiffre.

**Écran de session** — Une seule surface, pas de panneau dans un panneau. La question en 24px, poids 500, sur fond blanc, avec 720px de largeur maximale pour le confort de lecture. La navigation des questions passe en colonne latérale discrète ou en barre de pastilles horizontale au-dessus. Tout le reste disparaît : c'est un mode focus.

**Grille de thèmes** — 3 colonnes en desktop, 2 en tablette, 1 en mobile. Les 6 cartes retrouvent un équilibre.

### 5.5 Points d'accessibilité à intégrer dès le départ

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--r-sm);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Et une vérification systématique : tout texte à moins de 4,5:1 est corrigé, pas justifié.

---

## 6. Plan d'exécution recommandé

**Étape 0 — Assainir (30 min, aucun risque)**
Commiter l'état actuel comme point de restauration. Retirer `xlsx.full.min.js` et l'appel `initializeApp()` de l'accueil. Corriger `.topic-grid` en 3 colonnes. Ajouter la règle `.section-head` manquante. Supprimer le CSS résiduel du thème clair. Ces quatre corrections règlent les bugs les plus visibles sans toucher à l'identité.

**Étape 1 — Poser le système (½ journée)**
Réécrire le bloc `:root` avec la palette claire et les tokens d'espacement/rayon/ombre. Ajouter `:focus-visible` global et `prefers-reduced-motion`. À ce stade le site est déjà clair et cohérent, sans avoir touché au HTML.

**Étape 2 — Reprendre les composants (1 journée)**
Boutons, cartes, champs, pastilles, topbar. Suppression des `backdrop-filter` et des dégradés. Ajout du breakpoint intermédiaire à 900px.

**Étape 3 — Refondre les écrans à forte valeur (1 journée)**
Session (mode focus + timer à états), Résultats (feedback en colonne unique), Setup (préréglages).

**Étape 4 — Décider du sort du prototype React**
Soit migration assumée, soit suppression du dossier. Pas d'entre-deux.

**Étape 5 — Nettoyage**
README avec des chemins réels, suppression des `.DS_Store`, `dist/`, `.tanstack/tmp` et des fichiers `(1)`.

---

## 7. Ce qu'il reste à trancher

1. **Clair uniquement, ou clair par défaut avec bascule sombre ?** La bascule double le travail de tokens mais se code proprement si elle est prévue dès l'étape 1 — beaucoup plus cher à rajouter après.
2. **Les logos de banques restent-ils ?** Recommandation : les remplacer par une formulation explicite du type "Questions calibrées sur les process bulge bracket et elite boutique", sans logo.
3. **Les témoignages anonymes :** vrais témoignages attribués, ou remplacement par des chiffres produit ?
4. **Instrument Serif :** on l'abandonne complètement, ou on le garde uniquement sur le H1 de l'accueil comme signature de marque ?
