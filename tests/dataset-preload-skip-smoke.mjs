import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(testsDir);
const require = createRequire(import.meta.url);
const XLSX = require(path.join(projectRoot, "assets/js/xlsx.full.min.js"));
const storage = new Map();
let datasetFetchCalls = 0;

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
window.INTERVIEWPLUS_CONFIG = { backendMode: "local" };
globalThis.fetch = async (url) => {
  const value = String(url);
  if (value.endsWith("Questions_InterviewPlus_Bilingual.xlsx")) {
    datasetFetchCalls += 1;
    const bytes = await fs.readFile(path.join(projectRoot, "Questions_InterviewPlus_Bilingual.xlsx"));
    return new Response(bytes, {
      status: 200,
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  }
  throw new Error(`Unexpected fetch: ${value}`);
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const storeUrl = pathToFileURL(path.join(projectRoot, "assets/js/store.js"));
storeUrl.searchParams.set("smoke", String(Date.now()));
const store = await import(storeUrl.href);

await store.initializeApp({ loadDataset: false });
assert(datasetFetchCalls === 0, `Expected no dataset fetch with loadDataset:false, got ${datasetFetchCalls}`);
assert(store.getDatasetMeta().questionCount === 0, "Expected dataset to stay unloaded with loadDataset:false");

await store.initializeApp();
assert(datasetFetchCalls === 1, `Expected exactly one dataset fetch on default initializeApp(), got ${datasetFetchCalls}`);
assert(store.getDatasetMeta().questionCount === 3482, "Expected default initializeApp() to still load the full dataset");

console.log("dataset-preload-skip-smoke: OK");
