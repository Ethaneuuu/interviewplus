import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(testsDir);
const require = createRequire(import.meta.url);
const XLSX = require(path.join(projectRoot, "assets/js/xlsx.full.min.js"));
const storage = new Map([["interviewplus-server-token", "token"]]);
let sessions = [];
let correctionCalls = 0;
let failRefresh = false;
let failPostUpsertPersist = false;
let failNextStatePersist = false;
let failInitialPostUpsertPersist = true;

globalThis.window = globalThis;
globalThis.XLSX = XLSX;
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    if (key === "interviewplus-state-v4" && failNextStatePersist) {
      failNextStatePersist = false;
      throw new Error("PERSIST_FAILED");
    }
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};
window.INTERVIEWPLUS_CONFIG = { backendMode: "server" };

globalThis.fetch = async (url, options = {}) => {
  const value = String(url);
  if (value.endsWith("Questions_InterviewPlus_Bilingual.xlsx")) {
    return new Response(await fs.readFile(path.join(projectRoot, "Questions_InterviewPlus_Bilingual.xlsx")), { status: 200 });
  }
  if (value === "/api/me") return Response.json({ user: { id: "user-1", name: "Candidate", email: "candidate@example.com" } });
  if (value === "/api/correct") {
    correctionCalls += 1;
    const payload = JSON.parse(options.body);
    const score = correctionCalls === 1 ? 88 : 91;
    if (failPostUpsertPersist && correctionCalls === 2) failNextStatePersist = true;
    return Response.json({
      score,
      mode: "openrouter",
      provider: "openrouter",
      model: "openai/gpt-oss-120b:free",
      items: payload.items.map((item) => ({ questionId: item.questionId, score, recognizedConcepts: [], missingElements: [], feedback: "Feedback." })),
    });
  }
  if (value === "/api/sessions" && options.method === "POST") {
    sessions = [JSON.parse(options.body).session];
    if (failInitialPostUpsertPersist) {
      failInitialPostUpsertPersist = false;
      failNextStatePersist = true;
    }
    return Response.json({ session: sessions[0] });
  }
  if (value === "/api/sessions") {
    if (failRefresh) {
      failRefresh = false;
      throw new Error("REFRESH_FAILED");
    }
    return Response.json({
      sessions: sessions.map((session) => {
        const { questionLanguage, ...config } = session.config;
        const { localOnlyMetadata, ...projection } = session;
        return { ...projection, config };
      }),
    });
  }
  throw new Error(`Unexpected fetch: ${value}`);
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("question-recorrection-remote-smoke", String(Date.now()));
const store = await import(storeUrl.href);
await store.initializeApp();

const started = await store.startSession({ questionCount: 2, questionLanguage: "fr", theme: "Aleatoire", timerMinutes: 2 });
started.questions.forEach((question, index) => store.saveAnswer(index, question.expectedAnswer));
const completed = await store.finalizeSession();
assert(completed.questions.every((question) => question.score === 88), "Initial remote correction failed");
assert(sessions[0].status === "review", "Initial remote upsert did not commit review state");

failRefresh = true;
failPostUpsertPersist = true;
const recorrected = await store.recorrectSession(completed.id);
assert(recorrected.questions.every((question) => question.score === 91), "Successful remote upsert was treated as a failed recorrection");
assert((await store.getResultsOverview()).sessions[0].questions.every((question) => question.score === 91), "Remote committed correction was not exposed after refresh failure");

const staleState = JSON.parse(storage.get("interviewplus-state-v4"));
staleState.activeSession.localOnlyMetadata = "keep-local";
storage.set("interviewplus-state-v4", JSON.stringify(staleState));

const reloadUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
reloadUrl.searchParams.set("question-recorrection-remote-reload", String(Date.now()));
const reloadedStore = await import(reloadUrl.href);
await reloadedStore.initializeApp();
const reloaded = await reloadedStore.getSessionDetails(completed.id);
assert(reloaded.questions.every((question) => question.score === 91), "Reload exposed the pre-commit active session instead of the remote correction");
assert(reloaded.config.questionLanguage === "fr", "Remote projection removed the local French question language");
assert(reloaded.questions.every((question) => question.language === "fr"), "Remote correction replaced French questions");
assert(reloaded.localOnlyMetadata === "keep-local", "Remote projection removed local session metadata");

console.log(JSON.stringify({ ok: true, correctionCalls, remoteScore: recorrected.questions[0].score }));
