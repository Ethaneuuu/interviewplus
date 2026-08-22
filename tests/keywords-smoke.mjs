import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
import fs from "node:fs/promises";
import { deriveExpectedKeywords, normalizeText } from "../assets/js/keywords.js";
import { createQuestionBankLoader } from "../netlify/functions/lib/question-bank.mjs";

deepStrictEqual(normalizeText("Valeur d’entreprise"), "valeur d entreprise");

const automatic = deriveExpectedKeywords("WACC discounts unlevered free cash flow and terminal value.");
ok(automatic.includes("wacc"));
ok(automatic.includes("terminal"));

const overridden = deriveExpectedKeywords("WACC and terminal value", {
  add: ["cost of capital"],
  remove: ["terminal"],
});
ok(overridden.includes("cost of capital"));
ok(!overridden.includes("terminal"));

deepStrictEqual(
  deriveExpectedKeywords("ignored", { replace: ["enterprise value", "net debt"] }),
  ["enterprise value", "net debt"],
);

const workbookBytes = await fs.readFile(new URL("../Questions_InterviewPlus_Bilingual.xlsx", import.meta.url));
const bank = await createQuestionBankLoader({
  workbookBytes,
})();
deepStrictEqual(bank.size, 3482);
ok(bank.get("en:1").referenceAnswer);
ok(bank.get("fr:1").keywords.length > 0);

const { createQuestionBankLoader: createIsolatedLoader } = await import("../netlify/functions/lib/question-bank.mjs?isolation");
const firstLoader = createIsolatedLoader({ workbookBytes });
let secondFetchCalls = 0;
const secondLoader = createIsolatedLoader({
  fetchImpl: async () => {
    secondFetchCalls += 1;
    return new Response(workbookBytes, { status: 200 });
  },
  env: {
    SUPABASE_URL: "https://example.test",
    PRIVATE_QUESTION_BUCKET: "questions",
    PRIVATE_QUESTION_PATH: "questions.xlsx",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
  },
});
await firstLoader();
await secondLoader();
strictEqual(secondFetchCalls, 1);

const { createQuestionBankLoader: createRetryingLoader } = await import("../netlify/functions/lib/question-bank.mjs?retry");
let retryFetchCalls = 0;
const retryLoader = createRetryingLoader({
  fetchImpl: async () => {
    retryFetchCalls += 1;
    return retryFetchCalls === 1
      ? new Response(null, { status: 503 })
      : new Response(workbookBytes, { status: 200 });
  },
  env: {
    SUPABASE_URL: "https://example.test",
    PRIVATE_QUESTION_BUCKET: "questions",
    PRIVATE_QUESTION_PATH: "questions.xlsx",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
  },
});
await rejects(retryLoader(), /PRIVATE_QUESTION_FILE_UNAVAILABLE:503/);
strictEqual((await retryLoader()).size, 3482);
strictEqual(retryFetchCalls, 2);
