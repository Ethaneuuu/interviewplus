import { equal, ok } from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { generateCaseStatement } from "../assets/js/case-templates.js";

const [language, theme, difficulty] = process.argv.slice(2);
if (!language) {
  for (const lang of ["fr", "en"]) for (const caseTheme of ["dcf", "lbo", "merger-model"]) for (const level of ["easy", "intermediate", "advanced"]) {
    execFileSync(process.execPath, [fileURLToPath(import.meta.url), lang, caseTheme, level], { stdio: "inherit" });
  }
  console.log(JSON.stringify({ ok: true, caseSessionDomI18n: "9x2" }));
} else {
  class Element {
    constructor() { this.children = []; this.listeners = {}; this.classList = { add() {}, remove() {}, toggle() {} }; this.dataset = {}; this.disabled = false; this.innerHTML = ""; this.textContent = ""; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
  }

  const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const statement = generateCaseStatement({ theme, difficulty, seed: 7 });
  const session = {
    id: `case-${language}-${theme}-${difficulty}`, userId: "guest-1", sessionType: "case", status: "running", startedAt: new Date().toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), completedAt: null, currentIndex: 0, globalScore: null,
    config: { theme, difficulty, timerMinutes: 60, questionCount: 0 }, questions: [], caseData: { templateId: statement.templateId, difficulty, seed: 7, statement, answers: {}, grade: null },
  };
  const state = { localUsers: [], currentLocalUserId: null, guestUser: { id: "guest-1", name: "Guest", email: "guest", createdAt: new Date().toISOString(), isGuest: true }, sessionConfig: {}, caseConfig: {}, activeSession: session, localSessions: [] };
  const storage = new Map([["interviewplus-state-v4", JSON.stringify(state)], ["interviewplus-ui-language", language]]);
  const elements = Object.fromEntries(["caseTitle", "caseInstructions", "caseTimerDisplay", "caseStatement", "caseAnswers", "finishCase", "caseMessage"].map((id) => [id, new Element()]));

  globalThis.window = globalThis;
  window.INTERVIEWPLUS_CONFIG = { backendMode: "local" };
  window.location = { href: "" };
  window.setInterval = () => 0;
  Object.defineProperty(globalThis, "navigator", { value: { language }, configurable: true });
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.MutationObserver = class { observe() {} };
  globalThis.document = { body: new Element(), documentElement: { lang: language }, dispatchEvent() {}, getElementById: (id) => elements[id] || null, querySelector: () => null, querySelectorAll: () => [], createElement: () => new Element(), createTreeWalker: () => ({ nextNode: () => null }) };
  globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
  globalThis.fetch = async () => new Response("missing", { status: 404 });

  const pageUrl = pathToFileURL(path.join(projectRoot, "assets/js/case-session.js"));
  pageUrl.searchParams.set("case-session-dom-i18n", `${language}-${theme}-${difficulty}-${Date.now()}`);
  await import(pageUrl.href);

  const expectedThemes = { fr: { dcf: "Évaluation DCF", lbo: "Modèle LBO", "merger-model": "Modèle de fusion" }, en: { dcf: "DCF valuation", lbo: "LBO model", "merger-model": "Merger model" } };
  const expectedLevels = { fr: { easy: "Débutant", intermediate: "Intermédiaire", advanced: "Avancé" }, en: { easy: "Easy", intermediate: "Intermediate", advanced: "Advanced" } };
  equal(elements.caseTitle.textContent, `${expectedThemes[language][theme]} | ${expectedLevels[language][difficulty]}`);
  ok(elements.caseInstructions.textContent.startsWith(language === "fr" ? "Construisez" : "Complete"));
  equal(elements.caseStatement.children[1].textContent, language === "fr" ? "Données (millions USD, sauf données par action)" : "Inputs (USD millions, except per-share data)");
  ok(elements.caseStatement.children[2].innerHTML.includes(language === "fr" ? "Poste" : "Item"));
  const visibleLabels = elements.caseStatement.children[2].children[0].children.map((row) => row.children[0].textContent);
  const answerLabels = elements.caseAnswers.children.map((label) => label.children[0].textContent);
  ok([...visibleLabels, ...answerLabels].every((label) => label && !label.includes("_")));
}
