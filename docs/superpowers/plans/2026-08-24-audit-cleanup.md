# Nettoyage post-audit (accueil + CSS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les 5 points concrets et vérifiés (pas seulement documentés) restés ouverts après les audits techniques : le chargement inutile de 2,3 Mo sur l'accueil, un bug de layout `.section-head` sur 4 pages, la grille de thèmes cassée, l'absence totale de focus clavier / `prefers-reduced-motion`, et du CSS mort.

**Architecture:** Cinq correctifs indépendants et à faible risque sur du code existant (aucune nouvelle page, aucune nouvelle dépendance). Chaque tâche est testable seule et n'a pas de dépendance sur les autres.

**Tech Stack:** HTML/CSS/JS natifs, tests `tests/*-smoke.mjs` (Node, assertions `assert()` sans framework).

**Spec:** `docs/PROJECT.md` (section "Prochaines étapes") et `docs/AUDIT_DESIGN.md` (sections 3.1, 3.4, 4.1, 4.2, 4.3) — les deux ont été relus et confrontés au code actuel avant d'écrire ce plan (plusieurs affirmations de `docs/PROJECT.md` sur des correctifs "déjà faits" étaient inexactes : aucune des 5 tâches ci-dessous n'était réellement appliquée).

## Global Constraints

- Aucune nouvelle dépendance : vanilla JS/CSS uniquement (cf. `README.md`, `docs/PROJECT.md`).
- `initializeApp()` doit continuer à charger le classeur par défaut pour toutes les pages sauf l'accueil — ne pas casser `setup.html`, `session.html`, `results.html`, `profile.html`, `auth.html`, `case-setup.html`, `case-session.html`.
- Garder le thème sombre actuel (`--bg: #030712`, `--accent: #38bdf8`, etc.) — la refonte claire de `docs/AUDIT_DESIGN.md` §5 est hors périmètre de ce plan.
- Chaque tâche se termine verte sur : la suite `tests/*-smoke.mjs` concernée, puis `git diff --check`.
- Ne pas modifier `scripts/build-static.mjs` ni la liste des 34 fichiers publiés (aucune tâche n'ajoute/supprime un fichier livré).

---

### Task 1 : Charger le classeur (2,3 Mo) uniquement sur les pages qui en ont besoin, pas sur l'accueil

**Contexte vérifié :** `assets/js/home.js:13` appelle `initializeApp()`, qui appelle inconditionnellement `ensureDatasetLoaded()` (`assets/js/store.js:153-157`) dès qu'un utilisateur est connecté ou que l'accès n'est pas restreint. `renderHome()` dans `home.js` n'utilise jamais `bootstrap.datasetMeta` — seuls `currentUser` et `backendMode` sont lus. Il n'existe aucun élément `#datasetStats` dans `index.html` (vérifié : absent des 6 pages HTML). Le fallback de correction locale dans `syncActiveSession()` (`store.js:687-712` → `correctQuestions` → `evaluateAnswerLocally`) utilise les données déjà embarquées dans l'objet session, pas le cache `datasetCache` — donc ne pas précharger le classeur sur l'accueil ne casse rien d'autre.

**Files:**
- Modify: `assets/js/store.js:153` (signature de `initializeApp`)
- Modify: `assets/js/home.js:13` (site d'appel)
- Modify: `index.html:16` (retrait du `<script>` xlsx)
- Test: `tests/dataset-preload-skip-smoke.mjs` (nouveau)

**Interfaces:**
- Consumes: rien de nouveau — utilise l'`initializeApp()` existant.
- Produces: `initializeApp(options)` accepte désormais `{ loadDataset?: boolean }` (défaut `true`). Les 8 autres appelants (`case-setup.js`, `case-session.js`, `auth.js`, `session.js`, `setup.js`, `profile.js`, `results.js`) continuent d'appeler `initializeApp()` sans argument et gardent le comportement actuel.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/dataset-preload-skip-smoke.mjs` :

```js
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(testsDir);
const require = createRequire(import.meta.url);
const XLSX = require(path.join(projectRoot, "assets/js/xlsx.full.min.js"));
const storage = new Map();
let datasetFetchCalls = 0;

globalThis.window = globalThis;
globalThis.XLSX = XLSX;
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};
window.INTERVIEWPLUS_CONFIG = { backendMode: "local" };
globalThis.fetch = async (url) => {
  const value = String(url);
  if (value.endsWith("Questions_InterviewPlus_Bilingual.xlsx")) {
    datasetFetchCalls += 1;
    const bytes = await fs.readFile(path.join(projectRoot, "Questions_InterviewPlus_Bilingual.xlsx"));
    return new Response(bytes, {
      status: 200,
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  }
  throw new Error(`Unexpected fetch: ${value}`);
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("smoke", String(Date.now()));
const store = await import(storeUrl.href);

await store.initializeApp({ loadDataset: false });
assert(datasetFetchCalls === 0, `Expected no dataset fetch with loadDataset:false, got ${datasetFetchCalls}`);
assert(store.getDatasetMeta().questionCount === 0, "Expected dataset to stay unloaded with loadDataset:false");

await store.initializeApp();
assert(datasetFetchCalls === 1, `Expected exactly one dataset fetch on default initializeApp(), got ${datasetFetchCalls}`);
assert(store.getDatasetMeta().questionCount === 3482, "Expected default initializeApp() to still load the full dataset");

console.log("dataset-preload-skip-smoke: OK");
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `node tests/dataset-preload-skip-smoke.mjs`
Expected: FAIL sur la première assertion (`datasetFetchCalls === 0`) — aujourd'hui `initializeApp()` charge toujours le classeur en mode local, l'option `loadDataset` n'existe pas encore et est silencieusement ignorée.

- [ ] **Step 3: Rendre le chargement du classeur optionnel dans `store.js`**

Dans `assets/js/store.js`, remplacer :

```js
export async function initializeApp() {
  await hydrateCurrentUser();
  if (!isRestrictedAccess() || currentUser) {
    await ensureDatasetLoaded();
  }
```

par :

```js
export async function initializeApp({ loadDataset = true } = {}) {
  await hydrateCurrentUser();
  if (loadDataset && (!isRestrictedAccess() || currentUser)) {
    await ensureDatasetLoaded();
  }
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `node tests/dataset-preload-skip-smoke.mjs`
Expected: PASS, affiche `dataset-preload-skip-smoke: OK`.

- [ ] **Step 5: Ne plus précharger le classeur sur l'accueil**

Dans `assets/js/home.js`, remplacer :

```js
const bootstrap = await initializeApp();
```

par :

```js
const bootstrap = await initializeApp({ loadDataset: false });
```

Dans `index.html`, supprimer la ligne :

```html
  <script defer src="./assets/js/xlsx.full.min.js"></script>
```

- [ ] **Step 6: Vérifier la non-régression sur les autres pages**

Run: `node tests/engine-smoke.mjs`
Expected: PASS — ce test appelle `initializeApp()` par défaut et vérifie `questionCount === 3482`, ce qui confirme que les pages autres que l'accueil chargent toujours le classeur normalement.

- [ ] **Step 7: Commit**

```bash
git add assets/js/store.js assets/js/home.js index.html tests/dataset-preload-skip-smoke.mjs
git commit -m "perf: skip the 2.3MB question bank preload on the home page"
```

---

### Task 2 : Ajouter la règle CSS manquante `.section-head`

**Contexte vérifié :** `.section-head` est utilisé dans `session.html:71`, `results.html:42` et `:56`, `profile.html:44` et `:54`, `case-session.html:36` (6 occurrences sur 4 pages), mais aucune règle `.section-head` n'existe dans `assets/css/app.css`. Structure HTML constante : un premier enfant `<div>` contenant `.eyebrow` + `h2`, suivi optionnellement d'un `<span class="pill">` et/ou d'un `<button>` (voir `results.html:47`). Sans règle, ces éléments s'empilent verticalement au lieu d'afficher le titre à gauche et la pastille/bouton à droite.

**Files:**
- Modify: `assets/css/app.css` (nouvelle règle après le bloc `.panel h2`, ligne 653-655)
- Test: `tests/css-fixes-smoke.mjs` (nouveau, réutilisé et complété par les Tasks 3-5)

**Interfaces:**
- Consumes: rien.
- Produces: la classe CSS `.section-head` (flex, `justify-content: space-between`), consommée par le HTML existant sans modification.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/css-fixes-smoke.mjs` :

```js
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(testsDir);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const css = await fs.readFile(path.join(projectRoot, "assets/css/app.css"), "utf8");

assert(
  /\.section-head\s*{[^}]*justify-content:\s*space-between/s.test(css),
  "Expected a .section-head rule with justify-content: space-between"
);

console.log("css-fixes-smoke: OK");
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `node tests/css-fixes-smoke.mjs`
Expected: FAIL — `.section-head` n'existe pas dans `app.css`.

- [ ] **Step 3: Ajouter la règle**

Dans `assets/css/app.css`, juste après le bloc (lignes 653-655) :

```css
.panel h2 {
  font-size: clamp(1.5rem, 2.2vw, 2.1rem);
}
```

ajouter :

```css
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `node tests/css-fixes-smoke.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/css/app.css tests/css-fixes-smoke.mjs
git commit -m "fix: add the missing .section-head layout rule"
```

---

### Task 3 : Séparer `.topic-grid` de `.feature-grid` et passer la grille de thèmes à 3 colonnes

**Contexte vérifié :** `assets/css/app.css:506-511` définit une seule règle partagée `.topic-grid, .feature-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }`. `index.html` contient 6 `.topic-card` (section thèmes) mais seulement 4 `.feature-card` (section "01-04"). Avec 4 colonnes, les thèmes rendent une rangée de 4 puis une rangée orpheline de 2. `.feature-grid` doit rester à 4 colonnes (compte exact), seul `.topic-grid` doit passer à 3. Le breakpoint `@media (max-width: 1080px)` (ligne ~1168) traite déjà `.topic-grid` séparément et le fait passer à 1 colonne — aucun changement nécessaire à cet endroit.

**Files:**
- Modify: `assets/css/app.css:506-511`
- Test: `tests/css-fixes-smoke.mjs` (complété)

**Interfaces:**
- Consumes: le fichier `tests/css-fixes-smoke.mjs` créé en Task 2.
- Produces: rien consommé par une tâche suivante.

- [ ] **Step 1: Étendre le test qui échoue**

Dans `tests/css-fixes-smoke.mjs`, avant `console.log`, ajouter :

```js
assert(
  /\.topic-grid\s*{[^}]*grid-template-columns:\s*repeat\(3,/s.test(css),
  "Expected .topic-grid to use a 3-column grid"
);
assert(
  /\.feature-grid\s*{[^}]*grid-template-columns:\s*repeat\(4,/s.test(css),
  "Expected .feature-grid to keep its 4-column grid"
);
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `node tests/css-fixes-smoke.mjs`
Expected: FAIL — `.topic-grid` et `.feature-grid` partagent encore la même règle à 4 colonnes.

- [ ] **Step 3: Séparer les règles**

Dans `assets/css/app.css`, remplacer :

```css
.topic-grid,
.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
```

par :

```css
.topic-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `node tests/css-fixes-smoke.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/css/app.css tests/css-fixes-smoke.mjs
git commit -m "fix: give the 6-card theme grid its own 3-column layout"
```

---

### Task 4 : Ajouter `:focus-visible` global et `prefers-reduced-motion`

**Contexte vérifié :** `grep -n "focus-visible\|prefers-reduced-motion" assets/css/app.css` ne renvoie aucun résultat. Le fichier ne contient que trois sélecteurs `:focus` (`.field input/textarea/select`, lignes 868-870), avec un anneau teal à 16 % d'opacité peu visible et qui ne couvre pas `.button`, `.nav-link`, `.question-nav button`, `.history-item`. Le marquee de logos (`@keyframes logo-scroll`, ligne 479) tourne en boucle infinie sans coupure pour les utilisateurs ayant désactivé les animations au niveau système.

**Files:**
- Modify: `assets/css/app.css` (ajout en fin de fichier)
- Test: `tests/css-fixes-smoke.mjs` (complété)

**Interfaces:**
- Consumes: le fichier `tests/css-fixes-smoke.mjs` des Tasks 2-3.
- Produces: rien consommé par une tâche suivante.

- [ ] **Step 1: Étendre le test qui échoue**

Dans `tests/css-fixes-smoke.mjs`, avant `console.log`, ajouter :

```js
assert(/:focus-visible\s*{/.test(css), "Expected a global :focus-visible rule");
assert(
  /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css),
  "Expected a prefers-reduced-motion media query"
);
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `node tests/css-fixes-smoke.mjs`
Expected: FAIL — aucune des deux règles n'existe.

- [ ] **Step 3: Ajouter les deux règles en fin de fichier**

À la fin de `assets/css/app.css`, ajouter :

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 6px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `node tests/css-fixes-smoke.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/css/app.css tests/css-fixes-smoke.mjs
git commit -m "fix: add keyboard focus rings and honor prefers-reduced-motion"
```

---

### Task 5 : Supprimer le CSS mort `.score-shell` / `.score-ring`

**Contexte vérifié :** `grep -rn "score-ring\|scoreRing\|score-shell" assets/js/*.js *.html` ne renvoie aucun résultat — ces trois classes ne sont utilisées dans aucun fichier HTML ni JS du dépôt, seulement définies dans `assets/css/app.css:891-912`. Le `conic-gradient` de `.score-ring` déclare deux fois `360deg` (no-op, ne dessine jamais d'arc), mais comme la classe n'est de toute façon jamais posée sur un élément, corriger le calcul serait du travail sur du code mort. Suppression plutôt que réparation, cohérent avec le nettoyage déjà fait dans `4afd63f`.

**Files:**
- Modify: `assets/css/app.css:891-912` (suppression)
- Test: `tests/css-fixes-smoke.mjs` (complété)

**Interfaces:**
- Consumes: le fichier `tests/css-fixes-smoke.mjs` des Tasks 2-4.
- Produces: rien.

- [ ] **Step 1: Étendre le test qui échoue**

Dans `tests/css-fixes-smoke.mjs`, avant `console.log`, ajouter :

```js
assert(!/\.score-ring\b/.test(css), "Expected dead .score-ring CSS to be removed");
assert(!/\.score-shell\b/.test(css), "Expected dead .score-shell CSS to be removed");
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `node tests/css-fixes-smoke.mjs`
Expected: FAIL — `.score-shell` et `.score-ring` sont encore présents.

- [ ] **Step 3: Supprimer les règles mortes**

Dans `assets/css/app.css`, supprimer entièrement le bloc :

```css
.score-shell {
  display: grid;
  gap: 12px;
  justify-items: center;
  text-align: center;
}

.score-ring {
  width: 160px;
  height: 160px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, rgba(9, 18, 36, 0.96) 0 56%, transparent 57%),
    conic-gradient(rgba(22, 38, 58, 0.08) 360deg, rgba(22, 38, 58, 0.08) 360deg);
}

.score-ring strong {
  display: block;
  font-size: 2.6rem;
  line-height: 1;
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `node tests/css-fixes-smoke.mjs`
Expected: PASS.

- [ ] **Step 5: Vérification finale complète**

Run:
```bash
for test in tests/*-smoke.mjs; do
  [ "$test" = "tests/local-correction-contract-smoke.mjs" ] || node "$test" || exit 1
done
node scripts/build-static.mjs
git diff --check
```
Expected: tous les smokes passent (y compris les nouveaux `dataset-preload-skip-smoke.mjs` et `css-fixes-smoke.mjs`), le build statique réussit, aucun conflit de fin de ligne.

- [ ] **Step 6: Commit**

```bash
git add assets/css/app.css tests/css-fixes-smoke.mjs
git commit -m "chore: remove dead .score-shell/.score-ring CSS"
```
