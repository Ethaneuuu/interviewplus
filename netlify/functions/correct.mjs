import { createQuestionBankLoader } from "./lib/question-bank.mjs";
import { createCorrectionService } from "./lib/correction-service.mjs";

const questionBankLoader = createQuestionBankLoader();
const service = createCorrectionService({ questionBankLoader });

export async function handler(event) {
  if (event.httpMethod !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" });

  try {
    const payload = JSON.parse(event.body || "{}");
    return reply(200, await service.correct(payload));
  } catch (error) {
    const code = String(error?.message || "CORRECTION_UNAVAILABLE");
    return reply(code === "OPENROUTER_UNAVAILABLE" ? 502 : isValidationError(code) ? 400 : 500, { error: code });
  }
}

function isValidationError(code) {
  return ["INVALID_CORRECTION_TYPE", "INVALID_CORRECTION_ITEMS", "INVALID_CORRECTION_ITEM", "TOO_MANY_ITEMS", "ANSWER_TOO_LONG", "UNKNOWN_QUESTION"].includes(code);
}

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
