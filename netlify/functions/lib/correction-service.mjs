const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_FREE_MODEL = "openai/gpt-oss-120b:free";
const DEFAULT_PAID_MODEL = "openai/gpt-oss-120b";

import { CASE_DIFFICULTIES, CASE_THEMES, generateCaseStatement } from "../../../assets/js/case-templates.js";
import { calculateCaseSolution, gradeCase } from "./case-grader.mjs";

export function createCorrectionService({ fetchImpl = fetch, questionBankLoader, env = process.env } = {}) {
  return {
    async correct(payload) {
      if (payload?.type === "case") return correctCase({ payload, fetchImpl, env });
      const items = validatePayload(payload);
      const bank = await questionBankLoader();
      const questions = items.map((item) => resolveQuestion(bank, item));
      const messages = buildMessages(questions);
      const models = [env.OPENROUTER_FREE_MODEL || DEFAULT_FREE_MODEL, env.OPENROUTER_PAID_MODEL || DEFAULT_PAID_MODEL];

      for (const model of models) {
        const result = await requestCorrection(fetchImpl, env, model, messages, items.map(({ questionId }) => questionId));
        if (result) return normalize(result, model);
      }
      throw new Error("OPENROUTER_UNAVAILABLE");
    },
  };
}

async function correctCase({ payload, fetchImpl, env }) {
  const { theme, difficulty, seed, answers, recommendation } = validateCasePayload(payload);
  const statement = generateCaseStatement({ theme, difficulty, seed });
  if (!recommendation) return { ...gradeCase({ theme, difficulty, seed, answers }), mode: "deterministic" };

  const solution = calculateCaseSolution(statement);
  const messages = [
    { role: "system", content: "Return JSON only with score (number from 0 to 100) and feedback (string)." },
    { role: "user", content: ["[STATEMENT]", JSON.stringify(statement), "[DETERMINISTIC_RESULTS]", JSON.stringify(solution), "[RUBRIC]", statement.recommendation?.rubric || "", "[RECOMMENDATION]", recommendation].join("\n") },
  ];
  const models = [env.OPENROUTER_FREE_MODEL || DEFAULT_FREE_MODEL, env.OPENROUTER_PAID_MODEL || DEFAULT_PAID_MODEL];
  for (const model of models) {
    const narrative = await requestNarrative(fetchImpl, env, model, messages);
    if (narrative) return { ...gradeCase({ theme, difficulty, seed, answers: { ...answers, recommendation }, narrativeScore: narrative.score }), mode: "openrouter", provider: "openrouter", model, narrativeStatus: "scored", feedback: narrative.feedback };
  }
  return { ...gradeCase({ theme, difficulty, seed, answers: { ...answers, recommendation } }), mode: "deterministic", narrativeStatus: "unavailable" };
}

function validatePayload(payload) {
  if (payload?.type !== "questions") throw new Error("INVALID_CORRECTION_TYPE");
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error("INVALID_CORRECTION_ITEMS");
  if (payload.items.length > 20) throw new Error("TOO_MANY_ITEMS");

  const questionIds = new Set();
  return payload.items.map((item) => {
    if (!item || typeof item.questionId !== "string" || typeof item.language !== "string" || typeof item.answer !== "string") {
      throw new Error("INVALID_CORRECTION_ITEM");
    }
    if (item.answer.length > 8000) throw new Error("ANSWER_TOO_LONG");
    const questionId = item.questionId.trim();
    const language = item.language.trim();
    if (!questionId || !language || questionIds.has(questionId)) throw new Error("INVALID_CORRECTION_ITEM");
    questionIds.add(questionId);
    return { questionId, language, answer: item.answer };
  });
}

function validateCasePayload(payload) {
  if (!CASE_THEMES.includes(payload.theme)) throw new Error("INVALID_CASE_THEME");
  if (!CASE_DIFFICULTIES.includes(payload.difficulty)) throw new Error("INVALID_CASE_DIFFICULTY");
  if (!Number.isInteger(payload.seed) || payload.seed < 0 || payload.seed > 0xffffffff) throw new Error("INVALID_CASE_SEED");
  if (!payload.answers || typeof payload.answers !== "object" || Array.isArray(payload.answers)) throw new Error("INVALID_CASE_ANSWERS");
  const statement = generateCaseStatement(payload);
  const known = new Set(statement.answerFields.map(({ id }) => id));
  const entries = Object.entries(payload.answers);
  if (entries.length > 80) throw new Error("TOO_MANY_CASE_ANSWERS");
  if (!entries.every(([id, value]) => known.has(id) && (Number.isFinite(value) || value === ""))) throw new Error("INVALID_CASE_ANSWER");
  if (payload.recommendation !== undefined && (typeof payload.recommendation !== "string" || payload.recommendation.length > 2000)) throw new Error("INVALID_CASE_RECOMMENDATION");
  if (payload.recommendation && !statement.recommendation) throw new Error("INVALID_CASE_RECOMMENDATION");
  return { theme: payload.theme, difficulty: payload.difficulty, seed: payload.seed, answers: payload.answers, recommendation: payload.recommendation || "" };
}

function resolveQuestion(bank, item) {
  const question = bank.get(`${item.language}:${item.questionId}`);
  if (!question) throw new Error("UNKNOWN_QUESTION");
  return { ...item, question };
}

function buildMessages(questions) {
  return [
    {
      role: "system",
      content: "Return JSON only with an items array. Score each answer from 0 to 100 using correctness and concept coverage holistically; do not apply a fixed keyword or reference-answer weighting. Every item must include questionId, score, recognizedConcepts, missingElements, and feedback.",
    },
    {
      role: "user",
      content: questions.map(({ answer, question }) => [
        "[QUESTION_ID]", question.questionId,
        "[QUESTION]", question.question,
        "[CANDIDATE_ANSWER]", answer,
        "[KEYWORDS]", question.keywords.join(", "),
        "[REFERENCE_ANSWER]", question.referenceAnswer,
        "[/ITEM]",
      ].join("\n")).join("\n\n"),
    },
  ];
}

async function requestCorrection(fetchImpl, env, model, messages, expectedIds) {
  try {
    const response = await fetchImpl(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
    });
    if (!response.ok) return null;
    const content = (await response.json())?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : null;
    return validItems(parsed?.items, expectedIds) ? parsed.items : null;
  } catch {
    return null;
  }
}

async function requestNarrative(fetchImpl, env, model, messages) {
  try {
    const response = await fetchImpl(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY || ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages }),
    });
    if (!response.ok) return null;
    const content = (await response.json())?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : null;
    return Number.isFinite(parsed?.score) && parsed.score >= 0 && parsed.score <= 100 && typeof parsed.feedback === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function validItems(items, expectedIds) {
  if (!Array.isArray(items) || items.length !== expectedIds.length) return false;
  const expected = new Set(expectedIds);
  const received = new Set();
  return items.every((item) => {
    if (!item || typeof item.questionId !== "string" || received.has(item.questionId) || !expected.has(item.questionId)) return false;
    if (!Number.isFinite(item.score) || item.score < 0 || item.score > 100) return false;
    if (!Array.isArray(item.recognizedConcepts) || !item.recognizedConcepts.every((value) => typeof value === "string")) return false;
    if (!Array.isArray(item.missingElements) || !item.missingElements.every((value) => typeof value === "string") || typeof item.feedback !== "string") return false;
    received.add(item.questionId);
    return true;
  }) && received.size === expected.size;
}

function normalize(items, model) {
  return {
    score: Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length),
    mode: "openrouter",
    provider: "openrouter",
    model,
    items: items.map(({ questionId, score, recognizedConcepts, missingElements, feedback }) => ({
      questionId,
      score,
      recognizedConcepts,
      missingElements,
      feedback,
    })),
  };
}
