import { createRequire } from "node:module";
import { deriveExpectedKeywords } from "../../../assets/js/keywords.js";
import { KEYWORD_OVERRIDES } from "../../../assets/js/keyword-overrides.js";

const require = createRequire(import.meta.url);
const XLSX = require("../../../assets/js/xlsx.full.min.js");

export function createQuestionBankLoader({ fetchImpl = fetch, env = process.env, workbookBytes } = {}) {
  let questionBankPromise;
  return () => {
    if (!questionBankPromise) {
      questionBankPromise = loadQuestionBank({ fetchImpl, env, workbookBytes }).catch((error) => {
        questionBankPromise = undefined;
        throw error;
      });
    }
    return questionBankPromise;
  };
}

async function loadQuestionBank({ fetchImpl, env, workbookBytes }) {
  const bytes = workbookBytes || await fetchWorkbook(fetchImpl, env);
  const workbook = XLSX.read(bytes, { type: "buffer" });
  const bank = new Map();

  addRows(bank, workbook.Sheets.EN_QA_FINAL, "en");
  addRows(bank, workbook.Sheets.FR_QR, "fr");

  if (bank.size !== 3482) throw new Error(`QUESTION_BANK_COUNT_INVALID:${bank.size}`);
  return bank;
}

async function fetchWorkbook(fetchImpl, env) {
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const bucket = env.PRIVATE_QUESTION_BUCKET;
  const objectPath = env.PRIVATE_QUESTION_PATH;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetchImpl(`${baseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (response.status !== 200) throw new Error(`PRIVATE_QUESTION_FILE_UNAVAILABLE:${response.status}`);
  return response.arrayBuffer();
}

function addRows(bank, worksheet, language) {
  if (!worksheet) throw new Error(`QUESTION_BANK_SHEET_MISSING:${language}`);
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  for (const row of rows) {
    const questionId = String(row["#"] || "").trim();
    const referenceAnswer = String(row.Answer || "").trim();
    if (!referenceAnswer) throw new Error(`QUESTION_BANK_ANSWER_BLANK:${language}:${questionId}`);

    const key = `${language}:${questionId}`;
    if (bank.has(key)) throw new Error(`QUESTION_BANK_DUPLICATE:${key}`);
    bank.set(key, {
      key,
      questionId,
      language,
      question: String(row.Question || "").trim(),
      referenceAnswer,
      keywords: deriveExpectedKeywords(referenceAnswer, KEYWORD_OVERRIDES[key]),
    });
  }
}
