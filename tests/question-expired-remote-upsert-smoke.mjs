import { equal, rejects } from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const question = {
  index: 0, questionId: "q1", category: "Technical", subcategory: "DCF", question: "What is a DCF?", expectedAnswer: "A discounted cash flow valuation uses free cash flows and WACC.",
  keyElements: "free cash flows; WACC", criticalConcept: "WACC", scoringRubric: "Explain discounting", questionType: "Technical", expectedLevel: "Analyst", answerOrigin: "Workbook", refreshBeforeInterview: "no", language: "en",
  candidateAnswer: "A discounted cash flow valuation uses free cash flows and WACC.", score: null, strengths: [], improvements: [], missingPoints: [],
};
const activeSession = {
  id: "question-expired", userId: "candidate-1", userName: "Candidate", sourceLabel: "Questions", status: "running", startedAt: "2026-08-22T09:00:00.000Z", endsAt: "2026-08-22T10:00:00.000Z", completedAt: null,
  currentIndex: 0, globalScore: null, config: { questionCount: 1, questionLanguage: "en", theme: "Technical", timerMinutes: 1 }, questions: [question],
};
const initialState = { localUsers: [], currentLocalUserId: null, guestUser: null, sessionConfig: {}, caseConfig: {}, activeSession, localSessions: [] };
const storage = new Map([["interviewplus-server-token", "token"], ["interviewplus-state-v4", JSON.stringify(initialState)]]);

globalThis.window = globalThis;
window.INTERVIEWPLUS_CONFIG = { backendMode: "server" };
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
globalThis.fetch = async (url, options = {}) => {
  const value = String(url);
  if (value === "/api/me") return Response.json({ user: { id: "candidate-1", name: "Candidate", email: "candidate@example.com" } });
  if (value === "/api/correct") throw new Error("CORRECTION_DOWN");
  if (value === "/api/sessions" && options.method === "POST") return Response.json({ error: "SESSION_DOWN" }, { status: 503 });
  if (value === "/api/sessions") return Response.json({ sessions: [] });
  throw new Error(`Unexpected fetch: ${url}`);
};

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("question-expired-upsert", String(Date.now()));
const store = await import(storeUrl.href);
await rejects(() => store.initializeApp(), /SESSION_DOWN/);
equal(store.getActiveSession().status, "running");
equal(store.getActiveSession().questions[0].score, null);
equal(JSON.parse(storage.get("interviewplus-state-v4")).activeSession.status, "running");

console.log(JSON.stringify({ ok: true, question: "expired-upsert-atomic" }));
