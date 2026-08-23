import { equal, ok, rejects } from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { gradeCase } from "../netlify/functions/lib/case-grader.mjs";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const storage = new Map([["interviewplus-server-token", "token"]]);
let sessions = [];
let failPost = true;
let failRefresh = false;
let failNextPersist = false;
let failInitialPostUpsertPersist = true;

globalThis.window = globalThis;
window.INTERVIEWPLUS_CONFIG = { backendMode: "server" };
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => {
    if (key === "interviewplus-state-v4" && failNextPersist) {
      failNextPersist = false;
      throw new Error("PERSIST_FAILED");
    }
    storage.set(key, String(value));
  },
  removeItem: (key) => storage.delete(key),
};
globalThis.fetch = async (url, options = {}) => {
  const value = String(url);
  if (value === "/api/me") return Response.json({ user: { id: "candidate-1", name: "Candidate", email: "candidate@example.com" } });
  if (value === "/api/correct") return Response.json({ ...gradeCase(JSON.parse(options.body)), mode: "deterministic" });
  if (value === "/api/sessions" && options.method === "POST") {
    if (failPost) return Response.json({ error: "SESSION_DOWN" }, { status: 503 });
    sessions = [JSON.parse(options.body).session];
    if (failInitialPostUpsertPersist) {
      failInitialPostUpsertPersist = false;
      failNextPersist = true;
    }
    return Response.json({ session: sessions[0] });
  }
  if (value === "/api/sessions") {
    if (failRefresh) return Response.json({ error: "REFRESH_DOWN" }, { status: 503 });
    return Response.json({ sessions });
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("case-remote", String(Date.now()));
const store = await import(storeUrl.href);
await store.initializeApp();

const started = await store.startCaseSession({ theme: "dcf", difficulty: "easy", timerMinutes: 60, seed: 7 });
const fieldId = started.caseData.statement.answerFields[0].id;
store.saveCaseAnswer(fieldId, "42");
await rejects(() => store.finalizeCaseSession(), /SESSION_DOWN/);
equal(store.getActiveSession().status, "running");
equal(store.getActiveSession().caseData.answers[fieldId], "42");

failPost = false;
failRefresh = true;
const completed = await store.finalizeCaseSession();
equal(completed.status, "review");
equal(completed.caseData.answers[fieldId], "42");
ok(completed.caseData.grade);

const persisted = JSON.parse(storage.get("interviewplus-state-v4"));
persisted.activeSession = null;
storage.set("interviewplus-state-v4", JSON.stringify(persisted));
failRefresh = false;
const reloadUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
reloadUrl.searchParams.set("case-remote-reload", String(Date.now()));
const reloadedStore = await import(reloadUrl.href);
await reloadedStore.initializeApp();
const remote = (await reloadedStore.getResultsOverview()).sessions[0];
equal(remote.sessionType, "case");
equal(remote.caseData.answers[fieldId], "42");
ok(remote.caseData.grade);

console.log(JSON.stringify({ ok: true, remote: "retry-safe" }));
