import { equal, ok } from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { generateCaseStatement } from "../assets/js/case-templates.js";

class Element {
  constructor() { this.children = []; this.listeners = {}; this.classList = { add() {}, remove() {}, toggle() {} }; this.dataset = {}; this.disabled = false; this.innerHTML = ""; this.textContent = ""; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const statement = generateCaseStatement({ theme: "dcf", difficulty: "easy", seed: 7 });
const answerId = statement.answerFields[0].id;
const session = {
  id: "case-expired", userId: "guest-1", sessionType: "case", status: "running", startedAt: "2026-08-22T09:00:00.000Z", endsAt: "2026-08-22T10:00:00.000Z", completedAt: null, currentIndex: 0, globalScore: null,
  config: { theme: "dcf", difficulty: "easy", timerMinutes: 60, questionCount: 0 }, questions: [],
  caseData: { templateId: statement.templateId, difficulty: "easy", seed: 7, statement, answers: { [answerId]: "42" }, grade: null },
};
const state = { localUsers: [], currentLocalUserId: null, guestUser: { id: "guest-1", name: "Guest", email: "guest", createdAt: "2026-08-22T00:00:00.000Z", isGuest: true }, sessionConfig: {}, caseConfig: {}, activeSession: session, localSessions: [] };
const storage = new Map([["interviewplus-state-v4", JSON.stringify(state)]]);
const elements = Object.fromEntries(["caseTitle", "caseInstructions", "caseTimerDisplay", "caseStatement", "caseAnswers", "finishCase", "caseMessage"].map((id) => [id, new Element()]));

globalThis.window = globalThis;
window.INTERVIEWPLUS_CONFIG = { backendMode: "local" };
window.location = { href: "" };
window.setInterval = () => 0;
Object.defineProperty(globalThis, "navigator", { value: { language: "fr" }, configurable: true });
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.MutationObserver = class { observe() {} };
globalThis.document = { body: new Element(), documentElement: { lang: "fr" }, getElementById: (id) => elements[id] || null, querySelector: () => null, querySelectorAll: () => [], createElement: () => new Element(), createTreeWalker: () => ({ nextNode: () => null }) };
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
globalThis.fetch = async (url) => { if (String(url) === "/api/correct") throw new Error("CORRECTION_DOWN"); throw new Error("NO_DATASET_NEEDED"); };

const pageUrl = pathToFileURL(path.join(projectRoot, "assets/js/case-session.js"));
pageUrl.searchParams.set("expired-reload", String(Date.now()));
await import(pageUrl.href);

equal(elements.caseTitle.textContent, "Évaluation DCF | Débutant");
ok(elements.caseMessage.textContent.includes("sauvegardées"));
equal(elements.finishCase.disabled, false);
ok(elements.finishCase.listeners.click);
console.log(JSON.stringify({ ok: true, expired: "retry-visible" }));
