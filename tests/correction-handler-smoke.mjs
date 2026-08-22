import { deepEqual, equal } from "node:assert/strict";

globalThis.fetch = async () => {
  throw new Error("unexpected provider failure");
};

const { handler } = await import("../netlify/functions/correct.mjs?handler-smoke");

const malformed = await handler({ httpMethod: "POST", body: "{" });
equal(malformed.statusCode, 400);
deepEqual(JSON.parse(malformed.body), { error: "INVALID_JSON" });

const unexpected = await handler({
  httpMethod: "POST",
  body: JSON.stringify({ type: "questions", items: [{ questionId: "1", language: "fr", answer: "x" }] }),
});
equal(unexpected.statusCode, 500);
deepEqual(JSON.parse(unexpected.body), { error: "INTERNAL_ERROR" });

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

console.log(JSON.stringify({ ok: true, parseErrors: "stable", unexpectedErrors: "generic" }));
