import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(testsDir);
const require = createRequire(import.meta.url);
const XLSX = require(path.join(projectRoot, "assets/js/xlsx.full.min.js"));
const storage = new Map();
let correctionCalls = 0;
let correctionAvailable = true;

globalThis.window = globalThis;
globalThis.XLSX = XLSX;
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
window.INTERVIEWPLUS_CONFIG = { backendMode: "local" };
globalThis.fetch = async (url, options = {}) => {
  const value = String(url);
  if (value.endsWith("Questions_InterviewPlus_Bilingual.xlsx")) {
    return new Response(await fs.readFile(path.join(projectRoot, "Questions_InterviewPlus_Bilingual.xlsx")), { status: 200 });
  }
  if (value === "/api/correct") {
    correctionCalls += 1;
    if (!correctionAvailable) throw new Error("CORRECTION_UNAVAILABLE");
    const payload = JSON.parse(options.body);
    return Response.json({
      score: 80,
      mode: "openrouter",
      provider: "openrouter",
      model: "openai/gpt-oss-120b:free",
      items: payload.items.map((item) => ({
        questionId: item.questionId,
        score: 80,
        recognizedConcepts: [],
        missingElements: [],
        feedback: "ok",
      })),
    });
  }
  throw new Error(`Unexpected fetch: ${value}`);
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("session-finish-validation-smoke", String(Date.now()));
const store = await import(storeUrl.href);
await store.initializeApp();
await store.continueAsGuest();

// --- 0 answers => no API call, typed error listing every question, still running
let session = await store.startSession({ questionCount: 3, questionLanguage: "en", theme: "Aleatoire", timerMinutes: 5 });
await store.finalizeSession().then(
  () => { throw new Error("finalizeSession resolved with zero answers"); },
  (error) => {
    assert(error.message === "INCOMPLETE_ANSWERS", `Expected INCOMPLETE_ANSWERS, got ${error.message}`);
    assert(JSON.stringify(error.missing) === JSON.stringify([1, 2, 3]), `Expected missing [1,2,3], got ${JSON.stringify(error.missing)}`);
  },
);
assert(correctionCalls === 0, `Zero-answer finish must not call the API, got ${correctionCalls}`);
assert(store.getActiveSession().status === "running", "Zero-answer finish must not end the session");
assert(JSON.stringify(store.getUnansweredQuestions()) === JSON.stringify([1, 2, 3]), "getUnansweredQuestions wrong for empty session");

// --- partial answers => no API call, only blank questions reported
store.saveAnswer(0, "A real answer about weighted average cost of capital and capital structure.");
await store.finalizeSession().then(
  () => { throw new Error("finalizeSession resolved with a partial session"); },
  (error) => {
    assert(error.message === "INCOMPLETE_ANSWERS", "Partial finish did not raise INCOMPLETE_ANSWERS");
    assert(JSON.stringify(error.missing) === JSON.stringify([2, 3]), `Expected missing [2,3], got ${JSON.stringify(error.missing)}`);
  },
);
assert(correctionCalls === 0, `Partial finish must not call the API, got ${correctionCalls}`);
assert(store.getActiveSession().status === "running", "Partial finish must not end the session");

// --- all answered => submission allowed, exactly one API call
store.saveAnswer(1, "Enterprise value bridges to equity value by subtracting net debt and minority interest.");
store.saveAnswer(2, "Accretion dilution compares pro forma EPS with standalone EPS after the financing mix.");
const completed = await store.finalizeSession();
assert(completed.status === "review", "Complete session did not finalize");
assert(correctionCalls === 1, `Complete finish should call the API once, got ${correctionCalls}`);

// --- double submit => single request (in-flight de-dup)
session = await store.startSession({ questionCount: 2, questionLanguage: "en", theme: "Aleatoire", timerMinutes: 5 });
session.questions.forEach((_, index) => store.saveAnswer(index, "A complete answer covering the expected financial concepts and reasoning."));
const before = correctionCalls;
const [a, b] = await Promise.all([store.finalizeSession(), store.finalizeSession()]);
assert(correctionCalls === before + 1, `Double submit made ${correctionCalls - before} requests, expected 1`);
assert(a.status === "review" && b.status === "review", "Concurrent finalize calls did not both resolve to the finished session");

// --- API error => graceful local fallback, session still usable (finalized, no throw)
correctionAvailable = false;
session = await store.startSession({ questionCount: 2, questionLanguage: "en", theme: "Aleatoire", timerMinutes: 5 });
session.questions.forEach((_, index) => store.saveAnswer(index, "A complete answer covering the expected financial concepts and reasoning."));
const degraded = await store.finalizeSession();
assert(degraded.status === "review", "API error should still finalize via local fallback");
assert(degraded.questions.every((question) => question.evaluationMode === "local-degraded"), "API error path did not mark local-degraded");

// --- timeout path: requireComplete:false finalizes an incomplete session without a gate
correctionAvailable = true;
session = await store.startSession({ questionCount: 3, questionLanguage: "en", theme: "Aleatoire", timerMinutes: 5 });
store.saveAnswer(0, "Only one answer before time runs out, still a valid finalize on timeout.");
const timedOut = await store.finalizeSession({ requireComplete: false });
assert(timedOut.status === "review", "Timeout finalize (requireComplete:false) must end the session");

console.log(JSON.stringify({ ok: true, correctionCalls }));
