# OpenRouter and Cas pratiques Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OpenRouter-backed question correction and a separate, progressively difficult DCF/LBO/Merger Model practice flow, persisted through the existing local/Supabase session system and deployable on Netlify.

**Architecture:** Keep the static HTML/CSS/JavaScript application and its existing store. Add small pure modules for keyword extraction and seeded case statements, plus one Netlify correction endpoint whose service can also run from the local Node server. The Function loads the question reference from the existing private Supabase Storage workbook and caches it per warm instance. Question correction is AI-first with the existing semantic scorer as an explicit degraded fallback; practical-case numbers are graded deterministically on the server.

**Tech Stack:** Native HTML/CSS/JavaScript modules, Node.js standard library, bundled SheetJS, Netlify Functions, OpenRouter HTTP API, Supabase Auth/Postgres/Storage.

## Global Constraints

- The product label is exactly **Cas pratiques**, never « paper pratique ».
- Do not remove, reclassify, browse, or expose search over the 3,482 existing questions.
- A case starts after choosing only theme, difficulty, and timer; the field count is derived from the template.
- Validation starts correction immediately; there is no ten-second recap.
- DCF, LBO, and Merger Model keep the same core outputs across easy, intermediate, and advanced levels.
- Higher levels add inputs to derive, intermediate calculations, scenarios, and constraints.
- OpenRouter evaluates question + candidate answer + expected keywords + reference answer as one holistic relevance decision.
- The browser must never contain `OPENROUTER_API_KEY`; the key exists only in server environment variables.
- Question fallback order is `openai/gpt-oss-120b:free`, then `openai/gpt-oss-120b`, then the existing local evaluator marked `local-degraded`.
- Practical numeric grading is deterministic; OpenRouter grades only an optional narrative recommendation.
- Reuse the current store, backend adapter, RLS policies, styles, and native browser controls; add no package dependency.
- Save user answers locally before any network correction request.
- Payment and user credit management remain out of scope.

## File Map

**Create**

- `assets/js/keywords.js` — pure text normalization, automatic expected-keyword extraction, and manual override application.
- `assets/js/keyword-overrides.js` — targeted editorial overrides keyed by `<language>:<questionId>`.
- `assets/js/correction-client.js` — browser client for `POST /api/correct`.
- `netlify/functions/correct.mjs` — Netlify HTTP adapter.
- `netlify/functions/lib/question-bank.mjs` — load, normalize, and cache the private Supabase workbook.
- `netlify/functions/lib/correction-service.mjs` — validation, OpenRouter orchestration, and response normalization.
- `netlify/functions/lib/case-grader.mjs` — server-only DCF/LBO/Merger solution and weighted numeric grading.
- `assets/js/case-templates.js` — public seeded statements, difficulty modules, fields, and common output contracts.
- `case-setup.html`, `assets/js/case-setup.js` — case configuration screen.
- `case-session.html`, `assets/js/case-session.js` — timed case form.
- `tests/keywords-smoke.mjs`, `tests/correction-api-smoke.mjs`, `tests/case-engine-smoke.mjs`, `tests/case-flow-smoke.mjs`, `tests/deployment-smoke.mjs` — dependency-free checks.
- `docs/PROJECT.md` — architecture, stack, endpoint, deployment, cost, maintenance, and paid-session roadmap.

**Modify**

- `assets/js/store.js` — reuse text helpers, request AI correction, add case session lifecycle, and expose recorrection.
- `assets/js/backend.js` — map the extended generic session fields to Supabase.
- `assets/js/results.js`, `results.html` — render both session kinds and support OpenRouter recorrection.
- `assets/js/i18n.js`, `assets/css/app.css` — bilingual case copy and case/result layout.
- `index.html`, `auth.html`, `setup.html`, `session.html`, `profile.html`, `results.html` — add the Cas pratiques navigation entry.
- `serve-local.mjs` — serve the two new pages and route local `/api/correct` through the shared service.
- `supabase/schema.sql` — extend `session_runs` without replacing it.
- `netlify.toml` — Function routing and bundle configuration.
- `README.md` — replace obsolete “local-only correction” claims and link the complete documentation.
- `tests/engine-smoke.mjs`, `tests/restricted-access-smoke.mjs` — preserve regressions with the new correction and routes.

---

### Task 1: Expected keywords and server correction reference

**Files:**
- Create: `assets/js/keywords.js`
- Create: `assets/js/keyword-overrides.js`
- Create: `tests/keywords-smoke.mjs`
- Modify: `assets/js/store.js:17-145,671-838,1152-1225`
- Create: `netlify/functions/lib/question-bank.mjs`

**Interfaces:**
- Produces: `normalizeText(value): string`
- Produces: `extractKeywords(value): string[]`
- Produces: `deriveExpectedKeywords(referenceAnswer, override?): string[]`
- Produces: `KEYWORD_OVERRIDES: Readonly<Record<string, {add?: string[], remove?: string[], replace?: string[]}>>`
- Produces: `createQuestionBankLoader({fetchImpl, env, workbookBytes?})(): Promise<Map<string, QuestionReference>>`.
- `QuestionReference` is `{key, questionId, language, question, referenceAnswer, keywords}`.

- [ ] **Step 1: Write the failing keyword test**

Create `tests/keywords-smoke.mjs`:

```js
import { deepStrictEqual, ok } from "node:assert/strict";
import fs from "node:fs/promises";
import { deriveExpectedKeywords, normalizeText } from "../assets/js/keywords.js";
import { createQuestionBankLoader } from "../netlify/functions/lib/question-bank.mjs";

deepStrictEqual(normalizeText("Valeur d’entreprise"), "valeur d entreprise");

const automatic = deriveExpectedKeywords("WACC discounts unlevered free cash flow and terminal value.");
ok(automatic.includes("wacc"));
ok(automatic.includes("terminal"));

const overridden = deriveExpectedKeywords("WACC and terminal value", {
  add: ["cost of capital"],
  remove: ["terminal"],
});
ok(overridden.includes("cost of capital"));
ok(!overridden.includes("terminal"));

deepStrictEqual(
  deriveExpectedKeywords("ignored", { replace: ["enterprise value", "net debt"] }),
  ["enterprise value", "net debt"],
);

const bank = await createQuestionBankLoader({
  workbookBytes: await fs.readFile(new URL("../Questions_InterviewPlus_Bilingual.xlsx", import.meta.url)),
})();
deepStrictEqual(bank.size, 3482);
ok(bank.get("en:1").referenceAnswer);
ok(bank.get("fr:1").keywords.length > 0);
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run: `node tests/keywords-smoke.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `assets/js/keywords.js`.

- [ ] **Step 3: Extract the existing text logic and implement overrides**

Move the existing stop-word set, normalization, uniqueness, and keyword extraction from `store.js` into `assets/js/keywords.js`. Keep the current matching behavior for the local scorer, and add this public function:

```js
export function deriveExpectedKeywords(referenceAnswer, override = {}) {
  if (override.replace?.length) return unique(override.replace.map(normalizePhrase));
  const removed = new Set((override.remove || []).map(normalizePhrase));
  return unique([
    ...extractKeywords(referenceAnswer),
    ...(override.add || []).map(normalizePhrase),
  ]).filter((keyword) => !removed.has(keyword));
}
```

`normalizePhrase` preserves a multi-word concept as one entry after normalization. Export the helpers needed by `store.js`, import them there, and delete only their previous duplicate definitions. Create `assets/js/keyword-overrides.js` with an immutable empty map and a documented example in prose, not executable data:

```js
export const KEYWORD_OVERRIDES = Object.freeze({});
```

Create `netlify/functions/lib/question-bank.mjs` using the already bundled `assets/js/xlsx.full.min.js`, `deriveExpectedKeywords`, and `KEYWORD_OVERRIDES`. In production, fetch the existing private workbook from `${SUPABASE_URL}/storage/v1/object/${PRIVATE_QUESTION_BUCKET}/${PRIVATE_QUESTION_PATH}` with `apikey` and `Authorization: Bearer` set to `SUPABASE_SERVICE_ROLE_KEY`. For local tests and the local server, accept injected `workbookBytes` instead. Read `EN_QA_FINAL` and `FR_QR`, key entries as `${language}:${row["#"]}`, and retain only the six documented properties in memory. Reject duplicate keys, blank answers, a non-200 Storage response, or any count other than 3,482. Cache the loader promise so a warm Function parses the workbook once.

- [ ] **Step 4: Verify extraction, generation, and the existing local engine**

Run:

```bash
node tests/keywords-smoke.mjs
node -e "const fs=require('node:fs'); import('./netlify/functions/lib/question-bank.mjs').then(async ({createQuestionBankLoader})=>{const bank=await createQuestionBankLoader({workbookBytes:fs.readFileSync('Questions_InterviewPlus_Bilingual.xlsx')})(); if(bank.size!==3482) process.exit(1); console.log(bank.size)})"
node tests/engine-smoke.mjs
```

Expected: all commands exit 0; the count printed is `3482`; the engine smoke report still has `ok: true`.

- [ ] **Step 5: Commit the keyword layer**

```bash
git add assets/js/keywords.js assets/js/keyword-overrides.js assets/js/store.js netlify/functions/lib/question-bank.mjs tests/keywords-smoke.mjs
git commit -m "feat: build expected correction keywords"
```

---

### Task 2: OpenRouter correction service and Netlify endpoint

**Files:**
- Create: `netlify/functions/lib/correction-service.mjs`
- Create: `netlify/functions/correct.mjs`
- Create: `assets/js/correction-client.js`
- Create: `tests/correction-api-smoke.mjs`
- Modify: `netlify.toml`
- Modify: `serve-local.mjs:13-22,41-61,61-161`

**Interfaces:**
- Consumes: question-bank loader from Task 1.
- Produces: `createCorrectionService({fetchImpl, questionBankLoader, env}).correct(payload): Promise<CorrectionResult>`.
- Produces: `requestCorrection(payload): Promise<CorrectionResult>`.
- `CorrectionResult` is `{score, mode, provider, model, items}`.
- Question items are `{questionId, score, recognizedConcepts, missingElements, feedback}`.

- [ ] **Step 1: Write failing service tests for validation and fallback order**

Create `tests/correction-api-smoke.mjs` with a one-question bank and an injected fake fetch. Assert these exact behaviors:

```js
import { equal, rejects } from "node:assert/strict";
import { createCorrectionService } from "../netlify/functions/lib/correction-service.mjs";

const bank = new Map([["fr:1", {
  key: "fr:1",
  questionId: "1",
  language: "fr",
  question: "Qu'est-ce que le WACC ?",
  referenceAnswer: "Le WACC actualise les free cash flows.",
  keywords: ["wacc", "free cash flows"],
}]]);

const calls = [];
const fetchImpl = async (_url, options) => {
  const request = JSON.parse(options.body);
  calls.push(request.model);
  if (request.model.endsWith(":free")) return new Response("limited", { status: 429 });
  return Response.json({ choices: [{ message: { content: JSON.stringify({
    items: [{ questionId: "1", score: 82, recognizedConcepts: ["WACC"], missingElements: ["structure de capital"], feedback: "Réponse pertinente mais incomplète." }],
  }) } }] });
};

const service = createCorrectionService({
  fetchImpl,
  questionBankLoader: async () => bank,
  env: { OPENROUTER_API_KEY: "test", OPENROUTER_FREE_MODEL: "openai/gpt-oss-120b:free", OPENROUTER_PAID_MODEL: "openai/gpt-oss-120b" },
});
const result = await service.correct({ type: "questions", sessionId: "s1", items: [{ questionId: "1", language: "fr", answer: "Le WACC est un taux d'actualisation." }] });
equal(result.score, 82);
equal(result.model, "openai/gpt-oss-120b");
equal(calls.join(","), "openai/gpt-oss-120b:free,openai/gpt-oss-120b");

await rejects(
  () => service.correct({ type: "questions", sessionId: "s1", items: Array.from({ length: 21 }, () => ({ questionId: "1", language: "fr", answer: "x" })) }),
  /TOO_MANY_ITEMS/,
);
```

Also assert rejection for an unknown question, an answer over 8,000 characters, an unknown `type`, a score outside 0–100, a missing returned item, and two invalid OpenRouter responses.

- [ ] **Step 2: Run the service test and confirm the missing module failure**

Run: `node tests/correction-api-smoke.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `correction-service.mjs`.

- [ ] **Step 3: Implement the shared service, adapters, and browser client**

In `correction-service.mjs`, validate at most 20 items and 8,000 characters per answer. Resolve each expected reference from `${language}:${questionId}`. Build one system message that requires JSON only, and one user message containing clearly delimited question, candidate answer, keywords, and reference answer. Call `https://openrouter.ai/api/v1/chat/completions` first with the free model, then the paid model after a non-2xx response, invalid JSON, or invalid schema.

Require the response to contain every requested question ID exactly once, with no extra ID. The system prompt explicitly forbids a fixed keyword/reference weighting: it must judge correctness and concept coverage holistically. Normalize valid OpenRouter content to:

```js
{
  score: Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length),
  mode: "openrouter",
  provider: "openrouter",
  model,
  items,
}
```

Throw `OPENROUTER_UNAVAILABLE` only after both models fail. Do not log prompts, answers, or the API key.

`correct.mjs` creates the cached Supabase question-bank loader from Task 1, calls the service, and maps known validation errors to HTTP 400, unavailable providers to 502, and success to 200.

`assets/js/correction-client.js` contains only:

```js
export async function requestCorrection(payload) {
  const response = await fetch("/api/correct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "CORRECTION_UNAVAILABLE");
  return data;
}
```

Add the two new pages to `publicRootFiles` in `serve-local.mjs`. For `POST /api/correct`, create a question-bank loader with bytes read from the local bilingual workbook, import the shared service, pass `process.env`, and return its result before the authentication gate; correction access is validated by a known question/case payload and bounded input rather than a server-login token, so guest sessions continue to work.

- [ ] **Step 4: Configure and verify the endpoint**

Update `netlify.toml`:

```toml
[build]
  publish = "."

[functions]
  directory = "netlify/functions"
  included_files = ["assets/js/xlsx.full.min.js"]

[[redirects]]
  from = "/api/correct"
  to = "/.netlify/functions/correct"
  status = 200
```

Run:

```bash
node tests/correction-api-smoke.mjs
node --check netlify/functions/correct.mjs
node --check netlify/functions/lib/correction-service.mjs
node --check netlify/functions/lib/question-bank.mjs
node --check serve-local.mjs
```

Expected: all commands exit 0 and the service test reports no assertion error.

- [ ] **Step 5: Commit the correction endpoint**

```bash
git add assets/js/correction-client.js netlify/functions/correct.mjs netlify/functions/lib/correction-service.mjs netlify.toml serve-local.mjs tests/correction-api-smoke.mjs
git commit -m "feat: add OpenRouter correction endpoint"
```

---

### Task 3: AI-first question correction and recorrection

**Files:**
- Modify: `assets/js/store.js:451-584,671-793`
- Modify: `assets/js/results.js:1-216`
- Modify: `results.html:47-61`
- Modify: `assets/js/i18n.js:1-126`
- Modify: `tests/engine-smoke.mjs`
- Create: `tests/question-correction-smoke.mjs`

**Interfaces:**
- Consumes: `requestCorrection(payload)` from Task 2.
- Produces: `recorrectSession(sessionId): Promise<Session>`.
- Stores per question: `evaluationMode`, `correctionProvider`, and `correctionModel` in addition to the existing score/feedback fields.

- [ ] **Step 1: Write a failing question correction integration test**

Create `tests/question-correction-smoke.mjs` by reusing the DOM-free window/localStorage/XLSX harness from `engine-smoke.mjs`. Make workbook fetch return the local workbook and `/api/correct` return:

```js
{
  score: 88,
  mode: "openrouter",
  provider: "openrouter",
  model: "openai/gpt-oss-120b:free",
  items: session.questions.map((question) => ({
    questionId: question.questionId,
    score: 88,
    recognizedConcepts: ["concept reconnu"],
    missingElements: ["élément manquant"],
    feedback: "Ajoutez une justification.",
  })),
}
```

Assert that finalization makes one API call, stores score 88, maps concepts to `strengths`, missing elements to `missingPoints`, feedback to `improvements`, and saves `evaluationMode === "openrouter"`. Then make `/api/correct` throw and assert the next session completes with numeric scores and `evaluationMode === "local-degraded"`.

- [ ] **Step 2: Run the integration test and confirm it fails on local-only mode**

Run: `node tests/question-correction-smoke.mjs`  
Expected: FAIL because finalization does not call `/api/correct` and still returns `semantic-local`.

- [ ] **Step 3: Replace per-question finalization with one AI-first batch**

Import `requestCorrection` in `store.js`. Before the network call, call `persist()` so every answer is saved. Send only `questionId`, `language`, and `answer`. Map the service response by question ID. If the request throws or its mapping is incomplete, call the existing `evaluateAnswerLocally` for every question and overwrite `evaluationMode` with `local-degraded`.

Add `recorrectSession(sessionId)` that finds a completed question session, submits the same payload, replaces only its correction fields after a complete valid response, persists it locally or through `upsertRemoteSession`, and leaves the old result unchanged on failure.

In `results.html`, add a hidden `#recorrectSession` button beside `#detailScore`. In `results.js`, show it only for completed question sessions, disable it while running, call `recorrectSession`, and rerender. Change `evaluationLabel` to map `openrouter` to `Correction IA`, `local-degraded` to `Correction locale dégradée`, and `deterministic` to `Correction numérique`.

- [ ] **Step 4: Verify success, fallback, recorrection, and existing behavior**

Run:

```bash
node tests/question-correction-smoke.mjs
node tests/engine-smoke.mjs
node tests/restricted-access-smoke.mjs
```

Expected: all three output JSON containing `"ok":true`; the engine smoke test now expects `local-degraded` only when its fetch harness rejects `/api/correct`.

- [ ] **Step 5: Commit question correction integration**

```bash
git add assets/js/store.js assets/js/results.js assets/js/i18n.js results.html tests/engine-smoke.mjs tests/question-correction-smoke.mjs
git commit -m "feat: use OpenRouter for question correction"
```

---

### Task 4: Seeded DCF, LBO, and Merger Model engines

**Files:**
- Create: `assets/js/case-templates.js`
- Create: `netlify/functions/lib/case-grader.mjs`
- Create: `tests/case-engine-smoke.mjs`
- Modify: `netlify/functions/lib/correction-service.mjs`
- Modify: `tests/correction-api-smoke.mjs`

**Interfaces:**
- Produces: `CASE_THEMES = ["dcf", "lbo", "merger-model"]`.
- Produces: `CASE_DIFFICULTIES = ["easy", "intermediate", "advanced"]`.
- Produces: `generateCaseStatement({theme, difficulty, seed}): CaseStatement`.
- `CaseStatement` is `{templateId, theme, difficulty, seed, title, durationOptions, instructions, sections, answerFields, coreOutputIds, recommendation}`.
- Produces server-only `calculateCaseSolution(statement): Record<string, number>`.
- Produces `gradeCase({theme, difficulty, seed, answers}): CaseGrade`.
- `CaseGrade` is `{score, passed, breakdown:{results,method,justification}, items, statement}`.

- [ ] **Step 1: Write the failing deterministic-engine test**

Create `tests/case-engine-smoke.mjs` and assert:

```js
import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { CASE_DIFFICULTIES, CASE_THEMES, generateCaseStatement } from "../assets/js/case-templates.js";
import { calculateCaseSolution, gradeCase } from "../netlify/functions/lib/case-grader.mjs";

equal(CASE_THEMES.join(","), "dcf,lbo,merger-model");
equal(CASE_DIFFICULTIES.join(","), "easy,intermediate,advanced");

for (const theme of CASE_THEMES) {
  const statements = CASE_DIFFICULTIES.map((difficulty) => generateCaseStatement({ theme, difficulty, seed: 12345 }));
  deepStrictEqual(statements[0], generateCaseStatement({ theme, difficulty: "easy", seed: 12345 }));
  deepStrictEqual(statements[0].coreOutputIds, statements[1].coreOutputIds);
  deepStrictEqual(statements[1].coreOutputIds, statements[2].coreOutputIds);
  ok(statements[1].answerFields.length > statements[0].answerFields.length);
  ok(statements[2].answerFields.length > statements[1].answerFields.length);

  for (const statement of statements) {
    const solution = calculateCaseSolution(statement);
    const grade = gradeCase({ theme, difficulty: statement.difficulty, seed: 12345, answers: solution });
    equal(grade.score, 100);
    equal(grade.passed, true);
    equal(grade.breakdown.results, 100);
  }
}
```

Also assert a blank submission scores 0, a value just inside tolerance receives full credit, a value between one and two tolerances receives half credit, and generated statements have no `expectedValue` property.

- [ ] **Step 2: Run the engine test and confirm both modules are missing**

Run: `node tests/case-engine-smoke.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the three templates with one seeded generator**

Use a 32-bit Mulberry32 generator and helpers `integer(min,max)`, `decimal(min,max,step)`, and `pick(values)`. A statement contains public inputs and answer metadata only; solution formulas stay in `case-grader.mjs`.

Define these common output contracts at every difficulty:

```js
const CORE_OUTPUTS = {
  dcf: ["ufcf_y1", "ufcf_y2", "ufcf_y3", "ufcf_y4", "ufcf_y5", "pv_ufcf", "terminal_value", "enterprise_value", "equity_value", "share_price", "sensitivity_low", "sensitivity_high"],
  lbo: ["entry_ev", "entry_equity", "sources_total", "uses_total", "fcf_y1", "fcf_y2", "fcf_y3", "fcf_y4", "fcf_y5", "debt_y1", "debt_y2", "debt_y3", "debt_y4", "debt_y5", "exit_ev", "exit_equity", "mom", "irr", "sensitivity_low", "sensitivity_high"],
  "merger-model": ["offer_price", "purchase_ev", "cash_funding", "debt_funding", "stock_funding", "new_shares", "pro_forma_net_income", "pro_forma_eps", "accretion_dilution_value", "accretion_dilution_pct"],
};
```

Difficulty modules must match the approved matrix:

- DCF easy supplies WACC and operating forecasts; intermediate supplies WACC components plus margin/CapEx/BFR drivers; advanced supplies segments, scenarios, comparable betas, target capital structure, and stub/mid-year inputs.
- LBO easy supplies EBITDA/FCF and one debt tranche; intermediate adds projections, multiple tranches, minimum cash, revolver, NOL, and management pool; advanced adds three-statement drivers, PPA, rollover, earnout, PIK, cash sweep, call premium, and management waterfall.
- Merger easy supplies price/mix/net income/shares; intermediate adds premium/mix constraints, fees, debt, and PPA inputs; advanced adds buyer/target forecasts, minimum cash, maximum leverage, DTL/write-offs, synergy ramp, integration costs, and multi-year EPS.

All monetary fields use one stated unit. Percentage fields declare `format: "percent"`; money, multiples, and per-share values declare their format and tolerances.

- [ ] **Step 4: Implement deterministic grading and connect `type: case`**

In `case-grader.mjs`, regenerate the statement from theme/difficulty/seed, calculate the solution, and score fields by their declared weight. Full points apply inside tolerance, half points inside twice the tolerance, zero otherwise. Core outputs form the `results` breakdown; intermediate fields form `method`. The total weighting is 75% results and 25% method when no narrative is requested, or 70% results, 25% method, and 5% justification when it is.

Only advanced Merger Model v1 requests `recommendation`. For that case, `correction-service.mjs` sends the recommendation, statement, deterministic results, and rubric to the same free-then-paid OpenRouter sequence. The model returns `{score, feedback}` with score constrained to 0–100; that score supplies the 5% justification component. If both model calls fail, keep the numeric score, return `justification: 0`, include `narrativeStatus: "unavailable"`, and never fail the case correction. A case passes at total score `>= 70`.

Extend `tests/correction-api-smoke.mjs` with an advanced Merger payload. Assert that valid narrative scoring contributes exactly 5% at a narrative score of 100, and that two failed model calls still return HTTP-success data with `mode: "deterministic"` and `narrativeStatus: "unavailable"`.

Add `type: "case"` validation to `correction-service.mjs`: accepted themes/difficulties, unsigned 32-bit seed, known answer IDs, numeric values or blank strings, and at most 80 answer fields. The sole `recommendation` field may contain up to 2,000 characters. Numeric grading must return even if narrative OpenRouter evaluation fails.

Run:

```bash
node tests/case-engine-smoke.mjs
node tests/correction-api-smoke.mjs
```

Expected: both exit 0; exact solutions score 100; case requests report `mode: "deterministic"` unless a recommendation is present.

- [ ] **Step 5: Commit the case engines**

```bash
git add assets/js/case-templates.js netlify/functions/lib/case-grader.mjs netlify/functions/lib/correction-service.mjs tests/case-engine-smoke.mjs tests/correction-api-smoke.mjs
git commit -m "feat: add seeded practical case engines"
```

---

### Task 5: Practical-case session lifecycle and screens

**Files:**
- Create: `case-setup.html`
- Create: `assets/js/case-setup.js`
- Create: `case-session.html`
- Create: `assets/js/case-session.js`
- Create: `tests/case-flow-smoke.mjs`
- Modify: `assets/js/store.js:128-161,294-306,330-469,534-584,959-980,1130-1150`
- Modify: `assets/css/app.css:759-864,1116-1194`
- Modify: `assets/js/i18n.js:1-126`

**Interfaces:**
- Consumes: `generateCaseStatement` from Task 4 and `requestCorrection` from Task 2.
- Produces: `getCaseConfig(): {theme,difficulty,timerMinutes}`.
- Produces: `setCaseConfig(config): void`.
- Produces: `startCaseSession(config): Promise<Session>`.
- Produces: `saveCaseAnswer(fieldId, value): Session | null`.
- Produces: `finalizeCaseSession(): Promise<Session>`.
- A case session has `sessionType: "case"`, `caseData: {templateId,difficulty,seed,statement,answers,grade}`, and `questions: []`.

- [ ] **Step 1: Write the failing case lifecycle test**

Create `tests/case-flow-smoke.mjs` with the same localStorage/window harness as `engine-smoke.mjs`. Mock `/api/correct` with `gradeCase` from Task 4. Assert:

```js
const session = await store.startCaseSession({ theme: "dcf", difficulty: "intermediate", timerMinutes: 60, seed: 12345 });
equal(session.sessionType, "case");
equal(session.caseData.statement.theme, "dcf");
equal(session.config.timerMinutes, 60);

const firstField = session.caseData.statement.answerFields[0];
store.saveCaseAnswer(firstField.id, "123.4");
equal(store.getActiveSession().caseData.answers[firstField.id], "123.4");

const completed = await store.finalizeCaseSession();
equal(completed.status, "review");
equal(completed.correctionMode, "deterministic");
ok(typeof completed.globalScore === "number");
```

Assert that an invalid theme/difficulty/timer is rejected and that the answers are still present when `/api/correct` rejects.

- [ ] **Step 2: Run the lifecycle test and confirm missing exports**

Run: `node tests/case-flow-smoke.mjs`  
Expected: FAIL because `startCaseSession` is not exported.

- [ ] **Step 3: Add case state to the existing store**

Add `caseConfig` to `defaultState` with `theme: "dcf"`, `difficulty: "easy"`, and `timerMinutes: 60`. `startCaseSession` validates access, generates a random unsigned 32-bit seed unless a test supplies one, calls `generateCaseStatement`, and creates the documented generic session shape. `saveCaseAnswer` persists after every input.

`finalizeCaseSession` persists first, sends `{type:"case",sessionId,theme,difficulty,seed,answers}`, stores `caseData.grade`, `globalScore`, `correctionMode`, `correctionProvider`, `correctionModel`, completion time, and syncs through the existing local/remote session path. On request failure, leave the session running and retain answers so the existing UI can retry.

Adjust analytics to ignore `questions: []` case sessions when calculating question-category strengths, while still counting them in total sessions and overall session-score averages.

- [ ] **Step 4: Build configuration and timed case pages**

`case-setup.html` reuses `.page`, `.panel`, `.field-stack`, and `.button` styles. Its introduction is:

> S'entraîner sur des cas chronométrés développe les automatismes, la rigueur des calculs et la capacité à justifier une recommandation en entretien.

It presents only theme, difficulty, timer, and one **Lancer le cas pratique** button. `case-setup.js` saves the config, starts the session, and redirects to `case-session.html?session=<id>`.

`case-session.html` reuses the timer banner and panels. `case-session.js` renders statement sections as semantic tables, creates one native `<input type="number" step="any">` for each `answerField`, and adds a `<textarea>` only when `statement.recommendation` is true. Every input event calls `saveCaseAnswer`; validation calls `finalizeCaseSession` immediately and redirects to `results.html?session=<id>` on success.

Add only case-specific grid/table/responsive rules to `app.css`. Keep visible labels bound to `<label>` elements and keep keyboard focus styles.

Run:

```bash
node tests/case-flow-smoke.mjs
node --check assets/js/case-setup.js
node --check assets/js/case-session.js
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the case flow**

```bash
git add assets/js/store.js assets/js/case-setup.js assets/js/case-session.js assets/js/i18n.js assets/css/app.css case-setup.html case-session.html tests/case-flow-smoke.mjs
git commit -m "feat: add practical case session flow"
```

---

### Task 6: Unified results, navigation, and bilingual presentation

**Files:**
- Modify: `assets/js/results.js:29-213`
- Modify: `results.html:19-69`
- Modify: `assets/js/i18n.js:1-210`
- Modify: `index.html:25-31,104-113`
- Modify: `auth.html:21-24`
- Modify: `setup.html:21-28`
- Modify: `session.html:21-28`
- Modify: `profile.html:22-27`
- Modify: `assets/css/app.css:89-105,922-990,1116-1194`
- Modify: `tests/case-flow-smoke.mjs`

**Interfaces:**
- Consumes: generic session shape from Task 5.
- Results renders either a question correction or `{passed, breakdown, items}` case grade.

- [ ] **Step 1: Extend the UI smoke assertions before editing pages**

Append static file assertions to `tests/case-flow-smoke.mjs`:

```js
for (const page of ["index.html", "auth.html", "setup.html", "session.html", "results.html", "profile.html", "case-setup.html", "case-session.html"]) {
  const html = await fs.readFile(path.join(projectRoot, page), "utf8");
  ok(html.includes("case-setup.html"), `${page} misses Cas pratiques navigation`);
}
const resultsSource = await fs.readFile(path.join(projectRoot, "assets/js/results.js"), "utf8");
ok(resultsSource.includes("renderCaseDetail"));
ok(resultsSource.includes("Réussi"));
```

- [ ] **Step 2: Run the smoke test and confirm missing navigation/results**

Run: `node tests/case-flow-smoke.mjs`  
Expected: FAIL on the first missing `case-setup.html` navigation link.

- [ ] **Step 3: Render case history and detailed grading**

In `results.js`, branch on `session.sessionType === "case"`. History shows theme, difficulty, timer, score, and **Réussi** or **À retravailler**. `renderCaseDetail(session)` renders:

- total score and pass status;
- Results / Method / Justification breakdown;
- one row per graded answer with candidate value, expected value, points, and feedback;
- the optional recommendation feedback;
- a button to start another case with the same theme and difficulty.

Keep the existing question renderer unchanged except for the real correction-mode label and recorrection button from Task 3. Escape every answer and feedback string before `innerHTML` insertion.

- [ ] **Step 4: Add navigation and translations, then verify all pages**

Add `<a class="nav-link" href="./case-setup.html">Cas pratiques</a>` to the main navigation of the listed pages and set it active on both case pages. Add direct FR/EN pairs for every new visible phrase in `i18n.js`; do not infer finance terminology through automatic machine translation.

Run:

```bash
node tests/case-flow-smoke.mjs
node tests/engine-smoke.mjs
node tests/restricted-access-smoke.mjs
```

Expected: all output `"ok":true` or exit 0.

- [ ] **Step 5: Commit the unified presentation**

```bash
git add assets/js/results.js assets/js/i18n.js assets/css/app.css index.html auth.html setup.html session.html results.html profile.html tests/case-flow-smoke.mjs
git commit -m "feat: present question and case results"
```

---

### Task 7: Supabase persistence and Netlify deployment configuration

**Files:**
- Modify: `supabase/schema.sql:58-152`
- Modify: `assets/js/backend.js:227-351`
- Create: `tests/deployment-smoke.mjs`
- Modify: `tests/restricted-access-smoke.mjs`

**Interfaces:**
- Consumes: generic session fields from Tasks 3 and 5.
- Persists: `session_type`, `difficulty`, `template_id`, `case_seed`, `case_json`, `score_json`, `correction_mode`, `correction_provider`, `correction_model`.
- Keeps the existing `questions_json` column for question sessions.

- [ ] **Step 1: Write failing schema and mapping checks**

Create `tests/deployment-smoke.mjs`:

```js
import fs from "node:fs/promises";
import { ok } from "node:assert/strict";

const schema = await fs.readFile("supabase/schema.sql", "utf8");
for (const column of ["session_type", "difficulty", "template_id", "case_seed", "case_json", "score_json", "correction_mode", "correction_provider", "correction_model"]) {
  ok(schema.includes(column), `Missing Supabase column ${column}`);
}

const netlify = await fs.readFile("netlify.toml", "utf8");
ok(netlify.includes('from = "/api/correct"'));
ok(netlify.includes('included_files = ["assets/js/xlsx.full.min.js"]'));

const clientConfig = await fs.readFile("assets/js/config.example.js", "utf8");
ok(!clientConfig.includes("OPENROUTER_API_KEY"));
ok(!clientConfig.includes("SUPABASE_SERVICE_ROLE_KEY"));
ok(!clientConfig.includes("sk-or-"));
```

- [ ] **Step 2: Run the deployment test and confirm missing columns**

Run: `node tests/deployment-smoke.mjs`  
Expected: FAIL with `Missing Supabase column session_type`.

- [ ] **Step 3: Extend the existing table and backend mapping**

Add idempotent `alter table ... add column if not exists` statements after the `session_runs` creation:

```sql
alter table public.session_runs
  add column if not exists session_type text not null default 'questions'
    check (session_type in ('questions', 'case')),
  add column if not exists difficulty text
    check (difficulty is null or difficulty in ('easy', 'intermediate', 'advanced')),
  add column if not exists template_id text,
  add column if not exists case_seed bigint,
  add column if not exists case_json jsonb,
  add column if not exists score_json jsonb not null default '{}'::jsonb,
  add column if not exists correction_mode text,
  add column if not exists correction_provider text,
  add column if not exists correction_model text;
```

Keep every current RLS policy. Update `upsertRemoteSession` and `mapRemoteSession` to round-trip the new fields. For question sessions send `case_json: null`; for case sessions send `questions_json: []` and the case payload in `case_json`. The local Node server already stores the complete session JSON, so do not add a second mapping there.

- [ ] **Step 4: Lock deployment configuration and run regression checks**

Keep Supabase URL and anon key in public `config.js`. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PRIVATE_QUESTION_BUCKET=interviewplus-private`, `PRIVATE_QUESTION_PATH=Questions_InterviewPlus_Bilingual.xlsx`, `OPENROUTER_API_KEY`, `OPENROUTER_FREE_MODEL=openai/gpt-oss-120b:free`, and `OPENROUTER_PAID_MODEL=openai/gpt-oss-120b` as Netlify environment variables. The service uses the documented bucket, path, and model names as defaults when only the two required secrets and URL are configured locally. Do not put any server variable or service-role key in `assets/js/config.js` or `assets/js/config.example.js`.

Run:

```bash
node tests/deployment-smoke.mjs
node tests/restricted-access-smoke.mjs
git diff --check
```

Expected: all commands exit 0; no string beginning `sk-or-` appears in tracked files.

- [ ] **Step 5: Commit deployment and persistence**

```bash
git add supabase/schema.sql assets/js/backend.js tests/deployment-smoke.mjs tests/restricted-access-smoke.mjs
git commit -m "feat: persist and deploy practical sessions"
```

---

### Task 8: Complete project documentation and end-to-end verification

**Files:**
- Create: `docs/PROJECT.md`
- Modify: `README.md`
- Modify: `CORRECTION_LOCALE_GRATUITE.md`
- Modify: `tests/deployment-smoke.mjs`

**Interfaces:**
- Documents the final architecture and the only public application endpoint `POST /api/correct`.
- Documents required server environment variables without including secret values.

- [ ] **Step 1: Add failing documentation assertions**

Append to `tests/deployment-smoke.mjs`:

```js
const docs = await fs.readFile("docs/PROJECT.md", "utf8");
for (const heading of ["Architecture", "Stack", "POST /api/correct", "Netlify", "Supabase", "OpenRouter", "Coûts et quotas", "Créer un template", "Sessions payantes"]) {
  ok(docs.includes(heading), `Missing documentation section ${heading}`);
}
ok(docs.includes("openai/gpt-oss-120b:free"));
ok(docs.includes("local-degraded"));
```

- [ ] **Step 2: Run the documentation check and confirm the missing file failure**

Run: `node tests/deployment-smoke.mjs`  
Expected: FAIL with `ENOENT` for `docs/PROJECT.md`.

- [ ] **Step 3: Write the complete operational documentation**

Create `docs/PROJECT.md` with these concrete sections:

1. architecture diagram and browser/Function/Supabase responsibilities;
2. stack and file map;
3. question and practical-case data flows;
4. full request/response/error contract for `POST /api/correct` for both types;
5. local startup with `node serve-local.mjs` and production-like startup with `netlify dev`;
6. Netlify setup, redirects, Supabase service-role variables, and `OPENROUTER_API_KEY`/model variables;
7. Supabase schema execution, storage bucket, Auth URLs, and RLS verification;
8. OpenRouter model order, per-key tracking versus shared workspace credits, direct OpenAI/ChatGPT billing separation, and the dated cost assumption of about 0.081 USD per 1,000 corrections at 1,000 input + 300 output tokens;
9. keyword override format and question-bank rebuild command;
10. template structure, seed reproducibility, common outputs, tolerances, and how to add a fourth theme;
11. test commands and failure modes;
12. future paid sessions: entitlements, credits, checkout, webhook ledger, and idempotency as roadmap only.

Update `README.md` so it no longer claims there is no API/model/cost. Link `docs/PROJECT.md`. Rename the local-correction guide's role to degraded fallback and keep its algorithm documentation accurate.

- [ ] **Step 4: Run the full verification suite and inspect the site**

Run:

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

Expected: every test exits 0; JSON smoke reports contain `"ok":true`; `git diff --check` is silent.

Start `netlify dev`, then verify in the browser at desktop and 390 px width:

1. a question session validates directly, displays `Correction IA`, and can be corrigée de nouveau ;
2. DCF easy and advanced show the same core outputs, with more intermediate fields at advanced level;
3. LBO and Merger Model can be launched and retain entered values after a correction-network failure;
4. a completed case displays score, pass status, results/method/justification breakdown, and detailed tolerances;
5. no page exposes a question-bank browser, OpenRouter key, or server correction reference.

- [ ] **Step 5: Commit documentation and verified final state**

```bash
git add README.md CORRECTION_LOCALE_GRATUITE.md docs/PROJECT.md tests/deployment-smoke.mjs
git commit -m "docs: document InterviewPlus architecture and deployment"
```

After the commit, run `git status --short`. Expected: only pre-existing user-owned untracked paths such as `.superpowers/`, `AUDIT_DESIGN.md`, and `references/` may remain; no implementation file is unstaged.
