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

globalThis.fetch = async (url, options = {}) => {
  const value = String(url);
  if (value.endsWith("Questions_InterviewPlus_Bilingual.xlsx")) {
    const bytes = await fs.readFile(path.join(projectRoot, "Questions_InterviewPlus_Bilingual.xlsx"));
    return new Response(bytes, { status: 200 });
  }
  if (value === "/api/correct") {
    correctionCalls += 1;
    if (!correctionAvailable) throw new Error("CORRECTION_UNAVAILABLE");
    const payload = JSON.parse(options.body);
    assert(payload.type === "questions", "Correction request has the wrong type");
    assert(payload.items.every((item) => Object.keys(item).sort().join(",") === "answer,language,questionId"), "Correction request sent extra question data");
    const persisted = JSON.parse(storage.get("interviewplus-state-v4"));
    assert(persisted.activeSession.questions.every((question) => question.candidateAnswer), "Answers were not persisted before correction");
    const score = correctionCalls === 1 ? 88 : 91;
    return Response.json({
      score,
      mode: "openrouter",
      provider: "openrouter",
      model: "openai/gpt-oss-120b:free",
      items: payload.items.map((question) => ({
        questionId: question.questionId,
        score,
        recognizedConcepts: ["concept reconnu"],
        missingElements: ["élément manquant"],
        feedback: "Ajoutez une justification.",
      })),
    });
  }
  throw new Error(`Unexpected fetch: ${value}`);
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("question-correction-smoke", String(Date.now()));
const store = await import(storeUrl.href);
await store.initializeApp();
await store.continueAsGuest();

const aiSession = await store.startSession({
  questionCount: 2,
  questionLanguage: "en",
  theme: "Aleatoire",
  timerMinutes: 2,
});
aiSession.questions.forEach((question, index) => store.saveAnswer(index, question.expectedAnswer));
const completed = await store.finalizeSession();
assert(correctionCalls === 1, `Expected one correction request, got ${correctionCalls}`);
assert(completed.questions.every((question) => question.score === 88), "AI score was not stored");
assert(completed.questions.every((question) => question.strengths.includes("concept reconnu")), "Recognized concepts were not mapped to strengths");
assert(completed.questions.every((question) => question.missingPoints.includes("élément manquant")), "Missing elements were not mapped to missing points");
assert(completed.questions.every((question) => question.improvements.includes("Ajoutez une justification.")), "Feedback was not mapped to improvements");
assert(completed.questions.every((question) => question.evaluationMode === "openrouter"), "AI correction mode was not stored");
assert(completed.questions.every((question) => question.correctionProvider === "openrouter"), "AI correction provider was not stored");
assert(completed.questions.every((question) => question.correctionModel === "openai/gpt-oss-120b:free"), "AI correction model was not stored");

const recorrected = await store.recorrectSession(completed.id);
assert(correctionCalls === 2, "Recorrection did not make a correction request");
assert(recorrected.questions.every((question) => question.score === 91), "Recorrection did not replace correction fields");

correctionAvailable = false;
const unchanged = await store.recorrectSession(recorrected.id);
assert(unchanged.questions.every((question) => question.score === 91), "Failed recorrection replaced the previous result");

const fallbackSession = await store.startSession({
  questionCount: 2,
  questionLanguage: "en",
  theme: "Aleatoire",
  timerMinutes: 2,
});
fallbackSession.questions.forEach((question, index) => store.saveAnswer(index, question.expectedAnswer));
const fallback = await store.finalizeSession();
assert(fallback.questions.every((question) => typeof question.score === "number"), "Fallback did not produce numeric scores");
assert(fallback.questions.every((question) => question.evaluationMode === "local-degraded"), "Fallback mode was not marked local-degraded");

console.log(JSON.stringify({ ok: true, correctionCalls, fallbackMode: fallback.questions[0].evaluationMode }));
