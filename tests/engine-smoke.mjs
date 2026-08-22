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
window.INTERVIEWPLUS_CONFIG = {
  backendMode: "local",
};
globalThis.fetch = async (url) => {
  const value = String(url);
  if (value.endsWith("Questions_InterviewPlus_Bilingual.xlsx")) {
    const bytes = await fs.readFile(path.join(projectRoot, "Questions_InterviewPlus_Bilingual.xlsx"));
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  }
  if (value === "/api/correct") {
    correctionCalls += 1;
    throw new Error("CORRECTION_UNAVAILABLE");
  }
  throw new Error(`Unexpected fetch: ${value}`);
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("smoke", String(Date.now()));
const store = await import(storeUrl.href);
const bootstrap = await store.initializeApp();
const meta = store.getDatasetMeta();

assert(meta.questionCount === 3482, `Expected 3482 bilingual questions, got ${meta.questionCount}`);
assert(meta.themeCount === 6, `Expected 6 themes, got ${meta.themeCount}`);
assert(meta.languages.join(",") === "en,fr", "English and French datasets not detected");
assert(meta.questionCountsByLanguage.en === 1741, "English question count mismatch");
assert(meta.questionCountsByLanguage.fr === 1741, "French question count mismatch");
assert(meta.dynamicQuestionCount === 106, "Dynamic question count mismatch");
assert(meta.dynamicQuestionCountsByLanguage.en === 53, "English dynamic question count mismatch");
assert(meta.dynamicQuestionCountsByLanguage.fr === 53, "French dynamic question count mismatch");
assert(meta.degraded === false, "Dataset unexpectedly degraded");
assert(bootstrap.backendMode === "local", "Local backend mode not reported");

const guest = await store.continueAsGuest();
assert(guest.isGuest === true, "Guest mode failed");
const brainTheme = "Brain Teaser / Creative";
assert(store.getAvailableQuestionCount(brainTheme, "en") === 14, "Brain teaser availability mismatch");
assert(store.getThemeOptions("en").includes(brainTheme), "English topics are missing");
assert(store.getThemeOptions("fr").includes("Logique / Créativité"), "French topics are missing");

const frenchSession = await store.startSession({
  questionCount: 5,
  questionLanguage: "fr",
  theme: "Aleatoire",
  timerMinutes: 2,
});
assert(frenchSession.questions.every((question) => question.language === "fr"), "French session contains non-French rows");
assert(frenchSession.questions.every((question) => question.question && question.expectedAnswer), "French session contains incomplete rows");

let insufficientRejected = false;
try {
  await store.startSession({
    questionCount: 15,
    questionLanguage: "en",
    theme: brainTheme,
    timerMinutes: 2,
  });
} catch (error) {
  insufficientRejected = error?.message === "NOT_ENOUGH_QUESTIONS";
}
assert(insufficientRejected, "Oversized theme session was not rejected");

const active = await store.startSession({
  questionCount: 10,
  questionLanguage: "en",
  theme: "Aleatoire",
  timerMinutes: 2,
});
assert(active.questions.length === 10, "Wrong session question count");
assert(
  new Set(active.questions.map((question) => question.questionId)).size === 10,
  "Duplicate questions selected",
);
assert(active.remainingMs > 0 && active.remainingMs <= 120000, "Timer bounds invalid");

active.questions.forEach((question, index) => {
  store.saveAnswer(index, question.expectedAnswer);
});
const completed = await store.finalizeSession();
assert(completed.status === "review", "Session did not finalize");
assert(
  completed.questions.every((question) => typeof question.score === "number"),
  "Missing question scores",
);
assert(
  completed.questions.every((question) => question.evaluationMode === "local-degraded"),
  "The degraded local evaluator was not used after correction failed",
);
assert(completed.globalScore >= 75, `Reference answers scored too low: ${completed.globalScore}`);
const lowestReference = [...completed.questions].sort((a, b) => a.score - b.score)[0];
assert(
  lowestReference.score >= 70,
  `Reference answer scored ${lowestReference.score}: ${lowestReference.question}`,
);

const overview = await store.getResultsOverview();
assert(overview.completedSessions === 1, "History did not record the session");
assert(overview.sessions[0].id === completed.id, "Recorded session mismatch");
const analytics = await store.getProfileAnalytics();
assert(analytics.sessionsCount === 1, "Profile session count mismatch");
assert(analytics.categories.length >= 1, "Profile analytics missing");

const persisted = JSON.parse(storage.get("interviewplus-state-v4"));
assert(persisted.localSessions.length === 1, "Session not persisted");
assert(persisted.activeSession.status === "review", "Final state not persisted");

const weakSession = await store.startSession({
  questionCount: 5,
  questionLanguage: "en",
  theme: "Aleatoire",
  timerMinutes: 2,
});
weakSession.questions.forEach((_, index) => store.saveAnswer(index, "test"));
const weakCompleted = await store.finalizeSession();
assert(
  weakCompleted.globalScore === 0,
  `Low-effort answers should score 0, got ${weakCompleted.globalScore}`,
);

console.log(
  JSON.stringify({
    ok: true,
    datasetQuestions: meta.questionCount,
    themes: meta.themeCount,
    dynamicQuestions: meta.dynamicQuestionCount,
    referenceAnswerScore: completed.globalScore,
    referenceAnswerMinimum: lowestReference.score,
    lowEffortScore: weakCompleted.globalScore,
    externalEvaluationCalls: correctionCalls,
    persistence: "ok",
  }),
);
