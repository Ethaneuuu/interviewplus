import { deepEqual, equal } from "node:assert/strict";
import { createCorrectionService } from "../netlify/functions/lib/correction-service.mjs";

globalThis.fetch = async () => {
  throw new Error("unexpected provider failure");
};

const { createHandler } = await import("../netlify/functions/correct.mjs?handler-smoke");
const handler = createHandler({ authorizer: async () => ({ id: "test-user" }) });

const malformed = await handler({ httpMethod: "POST", body: "{" });
equal(malformed.statusCode, 400);
deepEqual(JSON.parse(malformed.body), { error: "INVALID_JSON" });

const logged = [];
const originalError = console.error;
console.error = (...args) => logged.push(args);
try {
  const unexpected = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ type: "questions", items: [{ questionId: "1", language: "fr", answer: "x" }] }),
  });
  equal(unexpected.statusCode, 500);
  deepEqual(JSON.parse(unexpected.body), { error: "INTERNAL_ERROR" });
} finally {
  console.error = originalError;
}
deepEqual(logged, [["INTERVIEWPLUS_CORRECTION_ERROR", "CORRECTION_INTERNAL_ERROR"]]);

const invalidCases = [
  { type: "case", theme: "dcf", difficulty: "easy", seed: -1, answers: {} },
  { type: "case", theme: "dcf", difficulty: "easy", seed: 1, answers: { unknown: 1 } },
  { type: "case", theme: "dcf", difficulty: "easy", seed: 1, answers: Object.fromEntries(Array.from({ length: 81 }, (_, index) => [`x${index}`, 1])) },
  { type: "case", theme: "merger-model", difficulty: "advanced", seed: 1, answers: {}, recommendation: "x".repeat(2001) },
];
for (const payload of invalidCases) {
  const response = await handler({ httpMethod: "POST", body: JSON.stringify(payload) });
  equal(response.statusCode, 400, `Case validation must return 400 for ${payload.theme}`);
}

const deadlineHandler = createHandler({
  env: { CORRECTION_SERVER_TIMEOUT_MS: "10" },
  authorizer: async () => ({ id: "test-user" }),
  service: createCorrectionService({ questionBankLoader: async () => new Promise(() => {}) }),
});
const deadlineResponse = await deadlineHandler({
  httpMethod: "POST",
  body: JSON.stringify({ type: "questions", items: [{ questionId: "1", language: "fr", answer: "x" }] }),
});
equal(deadlineResponse.statusCode, 502);
deepEqual(JSON.parse(deadlineResponse.body), { error: "OPENROUTER_UNAVAILABLE" });

console.log(JSON.stringify({ ok: true, parseErrors: "stable", unexpectedErrors: "generic" }));
