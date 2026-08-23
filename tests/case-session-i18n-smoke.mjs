import { equal, notEqual, ok } from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { CASE_DIFFICULTIES, CASE_THEMES, generateCaseStatement } from "../assets/js/case-templates.js";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const storage = new Map();
globalThis.window = globalThis;
window.INTERVIEWPLUS_CONFIG = { backendMode: "local" };
Object.defineProperty(globalThis, "navigator", { value: { language: "fr" }, configurable: true });
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.MutationObserver = class { observe() {} };
globalThis.document = { body: {}, documentElement: {}, dispatchEvent() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createTreeWalker: () => ({ nextNode: () => null }) };

const i18nUrl = pathToFileURL(path.join(projectRoot, "assets/js/i18n.js"));
i18nUrl.searchParams.set("case-session-i18n", String(Date.now()));
const i18n = await import(i18nUrl.href);

for (const language of ["fr", "en"]) {
  i18n.setUiLanguage(language);
  for (const theme of CASE_THEMES) for (const difficulty of CASE_DIFFICULTIES) {
    const statement = generateCaseStatement({ theme, difficulty, seed: 7 });
    const title = i18n.caseSessionTitle(theme, difficulty);
    const instructions = i18n.caseSessionInstructions(theme, difficulty, statement.instructions);
    ok(title.length > 8 && !title.includes("easy") && !title.includes("intermediate") && !title.includes("advanced"), `${language} title is localized`);
    ok(instructions.length > 30, `${language} instructions are present for ${theme}/${difficulty}`);
    for (const field of statement.sections.flatMap(({ fields }) => fields)) {
      const label = i18n.caseInputLabel(field.id);
      ok(label && !label.includes("_"), `${language} input ${field.id} is localized`);
    }
    for (const field of statement.answerFields) {
      const label = i18n.caseOutputLabel(field.id);
      ok(label && !label.includes("_"), `${language} output ${field.id} is localized`);
    }
  }
}

i18n.setUiLanguage("fr");
const french = i18n.caseInputLabel("risk_free_rate");
i18n.setUiLanguage("en");
notEqual(french, i18n.caseInputLabel("risk_free_rate"));
equal(i18n.caseSectionLabel("inputs"), "Inputs (USD millions, except per-share data)");

console.log(JSON.stringify({ ok: true, caseSessionI18n: "9x2" }));
