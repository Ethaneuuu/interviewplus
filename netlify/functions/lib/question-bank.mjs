import { deriveExpectedKeywords } from "../../../assets/js/keywords.js";
import { KEYWORD_OVERRIDES } from "../../../assets/js/keyword-overrides.js";
import XLSX from "../../../assets/js/xlsx.full.min.js";

export function createQuestionBankLoader({ fetchImpl = fetch, env = process.env, workbookBytes } = {}) {
  let questionBankPromise;
  return ({ signal } = {}) => {
    if (!questionBankPromise) {
      questionBankPromise = loadSharedQuestionBank({ fetchImpl, env, workbookBytes }).catch((error) => {
        questionBankPromise = undefined;
        throw error;
      });
    }
    return signal ? withAbort(questionBankPromise, signal) : questionBankPromise;
  };
}

async function loadSharedQuestionBank({ fetchImpl, env, workbookBytes }) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error("PRIVATE_QUESTION_LOAD_TIMEOUT")),
    questionLoadTimeout(env),
  );
  try {
    return await withAbort(loadQuestionBank({ fetchImpl, env, workbookBytes, signal: controller.signal }), controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function loadQuestionBank({ fetchImpl, env, workbookBytes, signal }) {
  const bytes = workbookBytes || await fetchWorkbook(fetchImpl, env, signal);
  const workbook = XLSX.read(bytes, { type: "buffer" });
  const bank = new Map();

  addRows(bank, workbook.Sheets.EN_QA_FINAL, "en");
  addRows(bank, workbook.Sheets.FR_QR, "fr");

  if (bank.size !== 3482) throw new Error(`QUESTION_BANK_COUNT_INVALID:${bank.size}`);
  return bank;
}

async function fetchWorkbook(fetchImpl, env, signal) {
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const bucket = env.PRIVATE_QUESTION_BUCKET || "interviewplus-private";
  const objectPath = env.PRIVATE_QUESTION_PATH || "Questions_InterviewPlus_Bilingual.xlsx";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetchImpl(`${baseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    signal,
  });
  if (response.status !== 200) throw new Error(`PRIVATE_QUESTION_FILE_UNAVAILABLE:${response.status}`);
  return response.arrayBuffer();
}

function questionLoadTimeout(env) {
  const configured = Number(env.PRIVATE_QUESTION_LOAD_TIMEOUT_MS || 12000);
  return Number.isFinite(configured) ? Math.min(30000, Math.max(10, configured)) : 12000;
}

function withAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new Error("PRIVATE_QUESTION_LOAD_TIMEOUT"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then(
      (value) => { signal.removeEventListener("abort", abort); resolve(value); },
      (error) => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
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
