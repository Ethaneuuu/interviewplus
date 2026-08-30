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
    const payload = JSON.parse(options.body);
    return Response.json({
      score: 70, mode: "openrouter", provider: "openrouter", model: "openai/gpt-oss-120b:free",
      items: payload.items.map((item) => ({ questionId: item.questionId, score: 70, recognizedConcepts: [], missingElements: [], feedback: "ok" })),
    });
  }
  throw new Error(`Unexpected fetch: ${value}`);
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("session-pause-resume-smoke", String(Date.now()));
const store = await import(storeUrl.href);
await store.initializeApp();
await store.continueAsGuest();

const session = await store.startSession({ questionCount: 2, questionLanguage: "en", theme: "Aleatoire", timerMinutes: 30 });
store.saveAnswer(0, "A saved answer about weighted average cost of capital and capital structure choices.");

// pause keeps every field needed to resume
store.pauseActiveSession();
let paused = store.getActiveSession();
assert(paused.status === "paused", `Expected paused, got ${paused.status}`);
assert(paused.questions[0].candidateAnswer.includes("weighted average cost of capital"), "Pause dropped a saved answer");
const durable = JSON.parse(storage.get("interviewplus-state-v4")).activeSession;
assert(durable.status === "paused" && Number.isFinite(durable.pausedRemainingMs), "Pause was not persisted with remaining time");

// a paused session is never auto-finalized and costs no correction call
await store.finalizeSession({ requireComplete: false });
assert(store.getActiveSession().status === "paused", "A paused session must not be finalized");
assert(correctionCalls === 0, `Paused session triggered ${correctionCalls} correction calls`);

// resume restores a running session with the timer moved forward and answers intact
store.resumeActiveSession();
const resumed = store.getActiveSession();
assert(resumed.status === "running", `Expected running after resume, got ${resumed.status}`);
assert(new Date(resumed.endsAt).getTime() > Date.now(), "Resume did not roll the deadline forward");
assert(resumed.questions[0].candidateAnswer.includes("weighted average cost of capital"), "Resume lost the saved answer");
assert(JSON.parse(storage.get("interviewplus-state-v4")).activeSession.pausedRemainingMs === undefined, "Resume left stale pause state");

// after resume, finishing works normally
store.saveAnswer(1, "Second answer covering enterprise value to equity value bridge and net debt.");
const completed = await store.finalizeSession();
assert(completed.status === "review", "Resumed session could not be finalized");
assert(correctionCalls === 1, `Expected one correction call after resume+finish, got ${correctionCalls}`);

// quit for good clears the active session
const next = await store.startSession({ questionCount: 2, questionLanguage: "en", theme: "Aleatoire", timerMinutes: 30 });
assert(store.getActiveSession()?.id === next.id, "New session did not become active");
store.discardActiveSession();
assert(store.getActiveSession() === null, "discardActiveSession left an active session");

console.log(JSON.stringify({ ok: true, correctionCalls }));
