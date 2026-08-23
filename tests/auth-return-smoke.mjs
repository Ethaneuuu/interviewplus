import { equal } from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let replaced = "";
globalThis.window = globalThis;
window.INTERVIEWPLUS_CONFIG = { backendMode: "local", restrictedAccess: true };
window.location = { replace(value) { replaced = value; } };
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("auth-return", String(Date.now()));
const { requireAuthorizedAccess, safeAuthReturnDestination } = await import(storeUrl.href);

for (const page of ["setup.html", "session.html", "results.html", "profile.html", "case-setup.html", "case-session.html"]) {
  equal(safeAuthReturnDestination(page), page);
}
for (const unsafe of ["https://evil.example", "//evil.example", "../case-session.html", "case-session.html?next=https://evil.example", ""]) {
  equal(safeAuthReturnDestination(unsafe), "setup.html");
}

try { requireAuthorizedAccess("case-session.html"); } catch (error) { equal(error.message, "ACCESS_REDIRECT"); }
equal(replaced, "./auth.html?returnTo=case-session.html");

console.log(JSON.stringify({ ok: true, authReturn: "case-safe" }));
