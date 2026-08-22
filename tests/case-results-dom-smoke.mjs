import { equal, ok } from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { generateCaseStatement } from "../assets/js/case-templates.js";
import { gradeCase } from "../netlify/functions/lib/case-grader.mjs";

class Element {
  constructor() {
    this.children = [];
    this.listeners = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.dataset = {};
    this.innerHTML = "";
    this.textContent = "";
  }
  append(...children) { this.children.push(...children); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const statement = generateCaseStatement({ theme: "dcf", difficulty: "easy", seed: 7 });
const session = {
  id: "case-1", userId: "guest-1", sessionType: "case", status: "running", startedAt: "2026-08-22T10:00:00.000Z", endsAt: "2026-08-22T11:00:00.000Z", completedAt: null, globalScore: null,
  config: { theme: "dcf", difficulty: "easy", timerMinutes: 60, questionCount: 0 }, questions: [],
  caseData: { templateId: statement.templateId, difficulty: "easy", seed: 7, statement, answers: {}, grade: null },
};
const state = { localUsers: [], currentLocalUserId: null, guestUser: { id: "guest-1", name: "Guest", email: "guest", createdAt: "2026-08-22T00:00:00.000Z", isGuest: true }, sessionConfig: {}, caseConfig: {}, activeSession: session, localSessions: [] };
const storage = new Map([["interviewplus-state-v4", JSON.stringify(state)]]);
let elements = Object.fromEntries(["caseTitle", "caseInstructions", "caseTimerDisplay", "caseStatement", "caseAnswers", "finishCase", "caseMessage"].map((id) => [id, new Element()]));

globalThis.window = globalThis;
window.INTERVIEWPLUS_CONFIG = { backendMode: "local" };
window.location = { search: "", href: "" };
window.setInterval = () => 0;
Object.defineProperty(globalThis, "navigator", { value: { language: "fr" }, configurable: true });
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.MutationObserver = class { observe() {} };
globalThis.document = {
  body: new Element(), documentElement: { lang: "fr" }, getElementById: (id) => elements[id] || null,
  querySelector: () => null, querySelectorAll: () => [], createElement: () => new Element(),
  createTreeWalker: () => ({ nextNode: () => null }),
};
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
globalThis.fetch = async (url, options) => {
  if (String(url) === "/api/correct") return Response.json({ ...gradeCase(JSON.parse(options.body)), mode: "deterministic" });
  throw new Error("NO_DATASET_NEEDED");
};

const sessionUrl = pathToFileURL(path.join(projectRoot, "assets/js/case-session.js"));
sessionUrl.searchParams.set("case-session", String(Date.now()));
await import(sessionUrl.href);
await elements.finishCase.listeners.click();
equal(window.location.href, "./results.html?session=case-1");

elements = Object.fromEntries(["resultsMetrics", "resultsList", "sessionDetailPanel", "detailTitle", "detailScore", "recorrectSession", "detailQuestionNav", "detailCorrection"].map((id) => [id, new Element()]));
document.getElementById = (id) => elements[id] || null;
window.location.search = "?session=case-1";

const resultsUrl = pathToFileURL(path.join(projectRoot, "assets/js/results.js"));
resultsUrl.searchParams.set("case-results", String(Date.now()));
await import(resultsUrl.href);

ok(elements.detailCorrection.innerHTML.includes("0%"));
ok(elements.detailCorrection.innerHTML.includes("Résultats"));
equal(elements.detailQuestionNav.children.length, 0);
equal(elements.recorrectSession.dataset.sessionId, "");
console.log(JSON.stringify({ ok: true, dom: "case-results" }));
