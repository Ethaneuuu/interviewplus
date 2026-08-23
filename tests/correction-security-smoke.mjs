import { deepEqual, equal } from "node:assert/strict";
import { createHandler } from "../netlify/functions/correct.mjs";

const restrictedEnv = {
  CORRECTION_AUTH_MODE: "restricted",
  CORRECTION_MAX_REQUESTS_PER_MINUTE: "2",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
};

function event(body, token) {
  return {
    httpMethod: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  };
}

function authFetch({ authorized = true } = {}) {
  return async (url, options) => {
    if (url.endsWith("/auth/v1/user")) {
      if (options.headers.Authorization !== "Bearer valid-jwt") return new Response("invalid", { status: 401 });
      return Response.json({ id: "user-1", email: "user@example.com" });
    }
    if (url.includes("/rest/v1/authorized_users")) {
      equal(options.headers.Authorization, "Bearer service-role-test");
      return Response.json(authorized ? [{ email: "user@example.com" }] : []);
    }
    throw new Error(`UNEXPECTED_URL:${url}`);
  };
}

let corrections = 0;
const service = { correct: async () => ({ score: ++corrections }) };
const handler = createHandler({ env: restrictedEnv, fetchImpl: authFetch(), service });

let response = await handler(event({ type: "case", sessionId: "s1" }));
equal(response.statusCode, 401);
deepEqual(JSON.parse(response.body), { error: "AUTH_REQUIRED" });

response = await handler(event({ type: "case", sessionId: "s1" }, "invalid-jwt"));
equal(response.statusCode, 401);
deepEqual(JSON.parse(response.body), { error: "AUTH_REQUIRED" });

response = await handler(event({ type: "case", sessionId: "s1" }, "valid-jwt"));
equal(response.statusCode, 200);
equal(JSON.parse(response.body).score, 1);

response = await createHandler({ env: restrictedEnv, fetchImpl: authFetch({ authorized: false }), service })(
  event({ type: "case", sessionId: "s2" }, "valid-jwt"),
);
equal(response.statusCode, 403);
deepEqual(JSON.parse(response.body), { error: "ACCESS_NOT_AUTHORIZED" });

const retry = await handler(event({ type: "case", sessionId: "s1" }, "valid-jwt"));
equal(JSON.parse(retry.body).score, 1, "An identical retry must reuse the committed correction");
equal(corrections, 1);

let attempts = 0;
const retryableHandler = createHandler({
  env: { ...restrictedEnv, CORRECTION_MAX_REQUESTS_PER_MINUTE: "10" },
  fetchImpl: authFetch(),
  service: { correct: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("OPENROUTER_UNAVAILABLE");
    return { score: 77 };
  } },
});
equal((await retryableHandler(event({ type: "questions", sessionId: "retryable" }, "valid-jwt"))).statusCode, 502);
equal((await retryableHandler(event({ type: "questions", sessionId: "retryable" }, "valid-jwt"))).statusCode, 200);
equal(attempts, 2, "Failed corrections must not poison the idempotency cache");

await handler(event({ type: "case", sessionId: "s2" }, "valid-jwt"));
response = await handler(event({ type: "case", sessionId: "s3" }, "valid-jwt"));
equal(response.statusCode, 429);
deepEqual(JSON.parse(response.body), { error: "RATE_LIMITED" });

console.log(JSON.stringify({ ok: true, auth: "restricted", idempotence: "warm-instance", rateLimit: "warm-instance" }));
