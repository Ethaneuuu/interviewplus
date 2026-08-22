import { equal, ok, rejects } from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { gradeCase } from "../netlify/functions/lib/case-grader.mjs";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const page of ["index.html", "auth.html", "setup.html", "session.html", "results.html", "profile.html", "case-setup.html", "case-session.html"]) {
  const html = await fs.readFile(path.join(projectRoot, page), "utf8");
  ok(html.includes("case-setup.html"), `${page} misses Cas pratiques navigation`);
}
for (const page of ["case-setup.html", "case-session.html"]) {
  const html = await fs.readFile(path.join(projectRoot, page), "utf8");
  ok(html.includes('aria-current="page"'), `${page} misses active-page state`);
}
const resultsSource = await fs.readFile(path.join(projectRoot, "assets/js/results.js"), "utf8");
ok(resultsSource.includes("renderCaseDetail"));
ok(resultsSource.includes("Réussi"));
const storage = new Map();
let correctionFails = false;

globalThis.window = globalThis;
window.INTERVIEWPLUS_CONFIG = { backendMode: "local" };
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.fetch = async (url, options) => {
  if (String(url) !== "/api/correct") throw new Error(`Unexpected fetch: ${url}`);
  if (correctionFails) throw new Error("CORRECTION_UNAVAILABLE");
  const payload = JSON.parse(options.body);
  return Response.json({ ...gradeCase(payload), mode: "deterministic" });
};

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("case-flow", String(Date.now()));
const store = await import(storeUrl.href);
await store.continueAsGuest();

const session = await store.startCaseSession({ theme: "dcf", difficulty: "intermediate", timerMinutes: 60, seed: 12345 });
equal(session.sessionType, "case");
equal(session.caseData.statement.theme, "dcf");
equal(session.config.timerMinutes, 60);

const firstField = session.caseData.statement.answerFields[0];
store.saveCaseAnswer(firstField.id, "123.4");
equal(store.getActiveSession().caseData.answers[firstField.id], "123.4");

const completed = await store.finalizeCaseSession();
equal(completed.status, "review");
equal(completed.correctionMode, "deterministic");
ok(typeof completed.globalScore === "number");

await rejects(() => store.startCaseSession({ theme: "invalid", difficulty: "easy", timerMinutes: 60 }), /INVALID_CASE_THEME/);
await rejects(() => store.startCaseSession({ theme: "dcf", difficulty: "invalid", timerMinutes: 60 }), /INVALID_CASE_DIFFICULTY/);
await rejects(() => store.startCaseSession({ theme: "dcf", difficulty: "easy", timerMinutes: 0 }), /INVALID_CASE_TIMER/);

const retry = await store.startCaseSession({ theme: "dcf", difficulty: "easy", timerMinutes: 60, seed: 7 });
store.saveCaseAnswer(retry.caseData.statement.answerFields[0].id, "42");
correctionFails = true;
await rejects(() => store.finalizeCaseSession(), /CORRECTION_UNAVAILABLE/);
equal(store.getActiveSession().status, "running");
equal(store.getActiveSession().caseData.answers[retry.caseData.statement.answerFields[0].id], "42");

console.log(JSON.stringify({ ok: true, lifecycle: "case" }));
