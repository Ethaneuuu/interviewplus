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

console.log(JSON.stringify({ ok: true, parseErrors: "stable", unexpectedErrors: "generic" }));
