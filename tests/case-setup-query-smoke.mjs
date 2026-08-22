import { equal } from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

class Element {
  constructor() { this.value = ""; this.listeners = {}; this.classList = { add() {}, remove() {}, toggle() {} }; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const elements = Object.fromEntries(["caseTheme", "caseDifficulty", "caseTimer", "startCase", "caseSetupMessage"].map((id) => [id, new Element()]));
const state = {
  localUsers: [], currentLocalUserId: null,
  guestUser: { id: "guest-1", name: "Guest", email: "guest", createdAt: "2026-08-22T00:00:00.000Z", isGuest: true },
  sessionConfig: {}, caseConfig: { theme: "dcf", difficulty: "easy", timerMinutes: 45 }, activeSession: null, localSessions: [],
};
const storage = new Map([["interviewplus-state-v4", JSON.stringify(state)]]);

globalThis.window = globalThis;
window.INTERVIEWPLUS_CONFIG = { backendMode: "local" };
window.location = { search: "?theme=merger-model&difficulty=advanced", href: "" };
Object.defineProperty(globalThis, "navigator", { value: { language: "fr" }, configurable: true });
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.MutationObserver = class { observe() {} };
globalThis.document = {
  body: new Element(), documentElement: { lang: "fr" }, getElementById: (id) => elements[id] || null,
  querySelector: () => null, querySelectorAll: () => [], createTreeWalker: () => ({ nextNode: () => null }),
};
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };

const pageUrl = pathToFileURL(path.join(projectRoot, "assets/js/case-setup.js"));
pageUrl.searchParams.set("query", String(Date.now()));
await import(pageUrl.href);

equal(elements.caseTheme.value, "merger-model");
equal(elements.caseDifficulty.value, "advanced");
equal(elements.caseTimer.value, "45");
console.log(JSON.stringify({ ok: true, query: "prioritized" }));
