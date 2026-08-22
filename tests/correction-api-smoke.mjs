import { deepEqual, equal, rejects } from "node:assert/strict";
import { createCorrectionService } from "../netlify/functions/lib/correction-service.mjs";

const bank = new Map([["fr:1", {
  key: "fr:1",
  questionId: "1",
  language: "fr",
  question: "Qu'est-ce que le WACC ?",
  referenceAnswer: "Le WACC actualise les free cash flows.",
  keywords: ["wacc", "free cash flows"],
}]]);

const payload = {
  type: "questions",
  sessionId: "s1",
  items: [{ questionId: "1", language: "fr", answer: "Le WACC est un taux d'actualisation." }],
};
const env = {
  OPENROUTER_API_KEY: "test",
  OPENROUTER_FREE_MODEL: "openai/gpt-oss-120b:free",
  OPENROUTER_PAID_MODEL: "openai/gpt-oss-120b",
};
const validItems = [{
  questionId: "1",
  score: 82,
  recognizedConcepts: ["WACC"],
  missingElements: ["structure de capital"],
  feedback: "Réponse pertinente mais incomplète.",
}];

function response(items = validItems) {
  return Response.json({ choices: [{ message: { content: JSON.stringify({ items }) } }] });
}

const calls = [];
const fetchImpl = async (_url, options) => {
  const request = JSON.parse(options.body);
  calls.push(request.model);
  if (request.model.endsWith(":free")) return new Response("limited", { status: 429 });
  return response();
};

const service = createCorrectionService({ fetchImpl, questionBankLoader: async () => bank, env });
const result = await service.correct(payload);
equal(result.score, 82);
equal(result.model, "openai/gpt-oss-120b");
equal(calls.join(","), "openai/gpt-oss-120b:free,openai/gpt-oss-120b");

await rejects(
  () => service.correct({ ...payload, items: Array.from({ length: 21 }, () => payload.items[0]) }),
  /TOO_MANY_ITEMS/,
);
await rejects(() => service.correct({ ...payload, items: [{ ...payload.items[0], questionId: "missing" }] }), /UNKNOWN_QUESTION/);
await rejects(() => service.correct({ ...payload, items: [{ ...payload.items[0], answer: "x".repeat(8001) }] }), /ANSWER_TOO_LONG/);
await rejects(() => service.correct({ ...payload, type: "unknown" }), /INVALID_CORRECTION_TYPE/);

for (const invalidItems of [
  [{ ...validItems[0], score: 101 }],
  [],
]) {
  const invalidService = createCorrectionService({
    fetchImpl: async () => response(invalidItems),
    questionBankLoader: async () => bank,
    env,
  });
  await rejects(() => invalidService.correct(payload), /OPENROUTER_UNAVAILABLE/);
}

const invalidJsonCalls = [];
const invalidJsonService = createCorrectionService({
  fetchImpl: async (_url, options) => {
    invalidJsonCalls.push(JSON.parse(options.body).model);
    if (invalidJsonCalls.length === 1) return Response.json({ choices: [{ message: { content: "not-json" } }] });
    return response();
  },
  questionBankLoader: async () => bank,
  env,
});
await invalidJsonService.correct(payload);
equal(invalidJsonCalls.join(","), "openai/gpt-oss-120b:free,openai/gpt-oss-120b");

const malformedConceptItems = [{ ...validItems[0], recognizedConcepts: [42], missingElements: [null] }];
const malformedConceptCalls = [];
const malformedConceptService = createCorrectionService({
  fetchImpl: async (_url, options) => {
    malformedConceptCalls.push(JSON.parse(options.body).model);
    if (malformedConceptCalls.length === 1) return response(malformedConceptItems);
    return response([{ ...validItems[0], providerOnly: "discard" }]);
  },
  questionBankLoader: async () => bank,
  env,
});
const normalized = await malformedConceptService.correct(payload);
equal(malformedConceptCalls.join(","), "openai/gpt-oss-120b:free,openai/gpt-oss-120b");
deepEqual(normalized.items, validItems);

const invalidConceptCalls = [];
const invalidConceptService = createCorrectionService({
  fetchImpl: async (_url, options) => {
    invalidConceptCalls.push(JSON.parse(options.body).model);
    return response(malformedConceptItems);
  },
  questionBankLoader: async () => bank,
  env,
});
await rejects(() => invalidConceptService.correct(payload), /OPENROUTER_UNAVAILABLE/);
equal(invalidConceptCalls.join(","), "openai/gpt-oss-120b:free,openai/gpt-oss-120b");

console.log(JSON.stringify({ ok: true, fallback: "free-to-paid", validation: "ok" }));
