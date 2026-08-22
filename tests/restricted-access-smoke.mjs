import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(testsDir);
const require = createRequire(import.meta.url);
const XLSX = require(path.join(projectRoot, "assets/js/xlsx.full.min.js"));
const storage = new Map();
let fetchCalls = 0;

globalThis.window = globalThis;
globalThis.XLSX = XLSX;
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};
window.INTERVIEWPLUS_CONFIG = {
  backendMode: "local",
  restrictedAccess: true,
  allowPublicSignup: false,
  allowGuestAccess: false,
};
globalThis.fetch = async () => {
  fetchCalls += 1;
  throw new Error("No public fetch should occur before authentication");
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of ["config.js", "config.example.js"]) {
  const clientConfig = await fs.readFile(path.join(projectRoot, "assets/js", file), "utf8");
  assert(!clientConfig.includes("OPENROUTER_API_KEY"), `${file} exposes the OpenRouter key name`);
  assert(!clientConfig.includes("SUPABASE_SERVICE_ROLE_KEY"), `${file} exposes the Supabase service-role key name`);
  assert(!/sk-or-[A-Za-z0-9]/.test(clientConfig), `${file} exposes an OpenRouter key`);
}

async function expectError(action, expectedMessage) {
  try {
    await action();
  } catch (error) {
    assert(error?.message === expectedMessage, `Expected ${expectedMessage}, got ${error?.message}`);
    return;
  }
  throw new Error(`Expected ${expectedMessage}`);
}

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("restricted", String(Date.now()));
const store = await import(storeUrl.href);
await store.initializeApp();

assert(store.isRestrictedAccess() === true, "Restricted mode is not active");
assert(store.getCurrentUser() === null, "Anonymous visitor unexpectedly authenticated");
assert(fetchCalls === 0, "Question workbook was fetched before authentication");
await expectError(() => store.continueAsGuest(), "GUEST_ACCESS_DISABLED");
await expectError(
  () => store.registerUser({ name: "Test", email: "test@example.com", password: "Password1" }),
  "PUBLIC_SIGNUP_DISABLED",
);
await expectError(
  () => store.startSession({ questionCount: 5, questionLanguage: "fr", theme: "Aleatoire", timerMinutes: 5 }),
  "ACCESS_REQUIRED",
);

console.log(JSON.stringify({
  ok: true,
  anonymousWorkbookFetches: fetchCalls,
  guestAccess: "blocked",
  publicSignup: "blocked",
  anonymousSession: "blocked",
}));
