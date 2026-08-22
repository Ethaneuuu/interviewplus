import { deepStrictEqual, ok } from "node:assert/strict";
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

const bank = await createQuestionBankLoader({
  workbookBytes: await fs.readFile(new URL("../Questions_InterviewPlus_Bilingual.xlsx", import.meta.url)),
})();
deepStrictEqual(bank.size, 3482);
ok(bank.get("en:1").referenceAnswer);
ok(bank.get("fr:1").keywords.length > 0);
