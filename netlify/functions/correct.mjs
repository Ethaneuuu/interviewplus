import { createQuestionBankLoader } from "./lib/question-bank.mjs";
import { createCorrectionService } from "./lib/correction-service.mjs";

const questionBankLoader = createQuestionBankLoader();
const service = createCorrectionService({ questionBankLoader });

export async function handler(event) {
  if (event.httpMethod !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: "INVALID_JSON" });
  }

  try {
    return reply(200, await service.correct(payload));
  } catch (error) {
    const code = String(error?.message || "CORRECTION_UNAVAILABLE");
    if (code === "OPENROUTER_UNAVAILABLE") return reply(502, { error: code });
    if (isValidationError(code)) return reply(400, { error: code });
    console.error("INTERVIEWPLUS_CORRECTION_ERROR", safeErrorCode(code));
    return reply(500, { error: "INTERNAL_ERROR" });
  }
}

function safeErrorCode(code) {
  if (code.startsWith("PRIVATE_QUESTION_FILE_UNAVAILABLE:")) return "PRIVATE_QUESTION_FILE_UNAVAILABLE";
  if (code.startsWith("QUESTION_BANK_")) return "QUESTION_BANK_ERROR";
  return "CORRECTION_INTERNAL_ERROR";
}

function isValidationError(code) {
  return ["INVALID_CORRECTION_TYPE", "INVALID_CORRECTION_ITEMS", "INVALID_CORRECTION_ITEM", "TOO_MANY_ITEMS", "ANSWER_TOO_LONG", "UNKNOWN_QUESTION", "INVALID_CASE_THEME", "INVALID_CASE_DIFFICULTY", "INVALID_CASE_SEED", "INVALID_CASE_ANSWERS", "TOO_MANY_CASE_ANSWERS", "INVALID_CASE_ANSWER", "INVALID_CASE_RECOMMENDATION"].includes(code);
}

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
