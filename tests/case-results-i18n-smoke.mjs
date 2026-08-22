import { equal, ok } from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { calculateCaseSolution, gradeCase } from "../netlify/functions/lib/case-grader.mjs";
import { generateCaseStatement } from "../assets/js/case-templates.js";

const language = process.argv[2];
if (!language) {
  for (const value of ["fr", "en"]) execFileSync(process.execPath, [fileURLToPath(import.meta.url), value], { stdio: "inherit" });
  console.log(JSON.stringify({ ok: true, i18n: "merger-results" }));
} else {
  class Element {
    constructor() { this.children = []; this.listeners = {}; this.classList = { add() {}, remove() {}, toggle() {} }; this.dataset = {}; this.innerHTML = ""; this.textContent = ""; }
    append(...children) { this.children.push(...children); }
    addEventListener(name, listener) { this.listeners[name] = listener; }
  }

  const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const statement = generateCaseStatement({ theme: "merger-model", difficulty: "advanced", seed: 7 });
  const answers = { ...calculateCaseSolution(statement), recommendation: "Proceed within the leverage constraints." };
  const grade = gradeCase({ theme: statement.theme, difficulty: statement.difficulty, seed: statement.seed, answers, narrativeScore: 80 });
  const session = {
    id: `case-${language}`, userId: "guest-1", sessionType: "case", status: "review", startedAt: "2026-08-22T10:00:00.000Z", completedAt: "2026-08-22T11:00:00.000Z", globalScore: grade.score,
    config: { theme: statement.theme, difficulty: statement.difficulty, timerMinutes: 60, questionCount: 0 }, questions: [],
    caseData: { templateId: statement.templateId, difficulty: statement.difficulty, seed: statement.seed, statement, answers, grade },
  };
  const state = { localUsers: [], currentLocalUserId: null, guestUser: { id: "guest-1", name: "Guest", email: "guest", createdAt: "2026-08-22T00:00:00.000Z", isGuest: true }, sessionConfig: {}, caseConfig: {}, activeSession: session, localSessions: [] };
  const storage = new Map([["interviewplus-state-v4", JSON.stringify(state)], ["interviewplus-ui-language", language]]);
  const elements = Object.fromEntries(["resultsMetrics", "resultsList", "sessionDetailPanel", "detailTitle", "detailScore", "recorrectSession", "detailQuestionNav", "detailCorrection"].map((id) => [id, new Element()]));

  globalThis.window = globalThis;
  window.INTERVIEWPLUS_CONFIG = { backendMode: "local" };
  window.location = { search: `?session=${session.id}`, href: "" };
  Object.defineProperty(globalThis, "navigator", { value: { language }, configurable: true });
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.MutationObserver = class { observe() {} };
  globalThis.document = { body: new Element(), documentElement: { lang: language }, getElementById: (id) => elements[id] || null, querySelector: () => null, querySelectorAll: () => [], createElement: () => new Element(), createTreeWalker: () => ({ nextNode: () => null }) };
  globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };

  const resultsUrl = pathToFileURL(path.join(projectRoot, "assets/js/results.js"));
  resultsUrl.searchParams.set("i18n", `${language}-${Date.now()}`);
  await import(resultsUrl.href);

  equal(elements.detailTitle.textContent.startsWith(language === "fr" ? "Modèle de fusion | Avancé" : "Merger model | Advanced"), true);
  ok(elements.detailCorrection.innerHTML.includes(language === "fr" ? "Allocation du prix d&#39;acquisition" : "Purchase price allocation"));
  ok(elements.detailCorrection.innerHTML.includes('scope="col"'));
  ok(elements.detailCorrection.innerHTML.includes('scope="row"'));
}
